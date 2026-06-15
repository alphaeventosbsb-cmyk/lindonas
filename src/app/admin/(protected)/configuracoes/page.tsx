"use client"

import { useEffect, useState } from "react"
import { fetchCollection, createDocument, updateDocument } from "@/lib/firebase/client-utils"
import { useTenant } from "@/lib/auth/tenant-context"
import type { BusinessSettings, BusinessHour, BlockedDate, Company } from "@/lib/types/database"
import { Loader2, Save, Store, Clock, Plus, Trash2, X, Ban, Building2, Palette, Upload, Image, Camera, UserPlus, ShieldCheck, Mail } from "lucide-react"
import { toast } from "sonner"

const weekDays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
  border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d',
  fontSize: '0.875rem', fontWeight: 500, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem'
}

export default function ConfiguracoesPage() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ business_name: "Agendamento Online", whatsapp: "61998148986", phone: "", address: "", instagram: "", cnpj: "", company_legal_name: "", off_day_color: "" })
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [hoursForm, setHoursForm] = useState<Array<{ day: number; start: string; end: string; active: boolean }>>([])
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [blockDate, setBlockDate] = useState("")
  const [blockReason, setBlockReason] = useState("")
  const [adminEmails, setAdminEmails] = useState<string[]>([])
  const [newAdminEmail, setNewAdminEmail] = useState("")
  const [savingAdmin, setSavingAdmin] = useState(false)

  const { companyId, company: tenantCompany } = useTenant()

  useEffect(() => {
    async function load() {
      const [s, h, b] = await Promise.all([
        fetchCollection<BusinessSettings>("settings"),
        fetchCollection<BusinessHour>("business_hours"),
        fetchCollection<BlockedDate>("blocked_dates"),
      ])
      if (s.length > 0) {
        const cfg = s[0]
        setSettings(cfg)
        setForm({
          business_name: cfg.business_name || "", whatsapp: cfg.whatsapp || "",
          phone: cfg.phone || "", address: cfg.address || "", instagram: cfg.instagram || "",
          cnpj: cfg.cnpj || "", company_legal_name: cfg.company_legal_name || "",
          off_day_color: cfg.off_day_color || "",
        })
        setLogoUrl(cfg.logo_url || null)
        // Load admin emails from settings
        setAdminEmails((cfg as any).authorized_admin_emails || [])
      }
      const hf = weekDays.map((_, i) => {
        const existing = h.find(x => x.day_of_week === i)
        return { day: i, start: existing?.start_time || "08:00", end: existing?.end_time || "18:00", active: existing?.is_active ?? (i >= 1 && i <= 5) }
      })
      setHoursForm(hf)
      setHours(h)
      b.sort((a, c) => a.date.localeCompare(c.date))
      setBlockedDates(b)
      setLoading(false)
    }
    load()
  }, [])

  const saveSettings = async () => {
    const data = {
      business_name: form.business_name, whatsapp: form.whatsapp,
      phone: form.phone || null, address: form.address || null, instagram: form.instagram || null,
      logo_url: logoUrl, primary_color: null, off_day_color: form.off_day_color || null,
      cnpj: form.cnpj || null, company_legal_name: form.company_legal_name || null,
    }
    if (settings) await updateDocument("settings", settings.id, data)
    else await createDocument("settings", data)
    toast.success("Configurações salvas!")
  }

  const saveHours = async () => {
    for (const h of hoursForm) {
      const existing = hours.find(x => x.day_of_week === h.day)
      const data = { day_of_week: h.day, start_time: h.start, end_time: h.end, is_active: h.active }
      if (existing) await updateDocument("business_hours", existing.id, data)
      else await createDocument("business_hours", data)
    }
    toast.success("Horários salvos!")
  }

  const addBlockedDate = async () => {
    if (!blockDate) return toast.error("Selecione uma data")
    await createDocument("blocked_dates", { date: blockDate, reason: blockReason || null })
    toast.success("Data bloqueada!")
    setShowBlockModal(false)
    setBlockDate("")
    setBlockReason("")
    const b = await fetchCollection<BlockedDate>("blocked_dates")
    b.sort((a, c) => a.date.localeCompare(c.date))
    setBlockedDates(b)
  }

  const removeBlockedDate = async (id: string) => {
    const { deleteDocument } = await import("@/lib/firebase/client-utils")
    await deleteDocument("blocked_dates", id)
    toast.success("Data desbloqueada")
    setBlockedDates(prev => prev.filter(d => d.id !== id))
  }

  const addAdminEmail = async () => {
    const email = newAdminEmail.trim().toLowerCase()
    if (!email) return toast.error("Digite um email")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Email inválido")
    if (adminEmails.includes(email)) return toast.error("Email já adicionado")
    if (!settings) return toast.error("Configurações não carregadas. Recarregue a página.")
    setSavingAdmin(true)
    try {
      const updated = [...adminEmails, email]
      await updateDocument("settings", settings.id, { authorized_admin_emails: updated })
      setAdminEmails(updated)
      setNewAdminEmail("")
      toast.success("Co-admin adicionado com sucesso!")
    } catch (err: any) {
      console.error("Erro ao adicionar co-admin:", err)
      toast.error(`Erro: ${err.message || err}`)
    }
    setSavingAdmin(false)
  }

  const removeAdminEmail = async (email: string) => {
    if (!settings) return
    setSavingAdmin(true)
    try {
      const updated = adminEmails.filter(e => e !== email)
      await updateDocument("settings", settings.id, { authorized_admin_emails: updated })
      setAdminEmails(updated)
      toast.success("Co-admin removido")
    } catch (err: any) {
      console.error("Erro ao remover co-admin:", err)
      toast.error(`Erro: ${err.message || err}`)
    }
    setSavingAdmin(false)
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" /></div>

  const sectionHeader = (icon: React.ReactNode, title: string, subtitle: string, gradient: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', background: '#fafbfc' }}>
      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradient, boxShadow: '0 4px 10px rgba(0,0,0,0.12)' }}>
        {icon}
      </div>
      <div>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>{title}</h2>
        <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>{subtitle}</p>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: '40rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Logo Upload */}
      <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {sectionHeader(<Camera className="w-5 h-5" style={{ color: '#fff' }} />, "Logo do Negócio", "Aparece na página de agendamento online", "linear-gradient(135deg, #e87c3e, #f5a623)")}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          {/* Preview */}
          <div style={{ width: '8rem', height: '8rem', borderRadius: '1rem', border: '2px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fafbfc', position: 'relative' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: '#9ca3af' }}>
                <Image style={{ width: '2rem', height: '2rem' }} />
                <span style={{ fontSize: '0.625rem', fontWeight: 600 }}>Sem logo</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', borderRadius: '0.625rem', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff', fontSize: '0.8125rem', fontWeight: 700, cursor: uploading ? 'wait' : 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.25)', opacity: uploading ? 0.7 : 1 }}>
              <Upload style={{ width: '14px', height: '14px' }} />
              {uploading ? 'Enviando...' : 'Enviar Logo'}
              <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (file.size > 5 * 1024 * 1024) { toast.error('Imagem muito grande (máx 5MB)'); return }
                  setUploading(true)
                  try {
                    const dataUrl = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader()
                      reader.onload = () => {
                        const img = document.createElement('img')
                        img.onload = () => {
                          const canvas = document.createElement('canvas')
                          const maxSize = 400
                          let w = img.width, h = img.height
                          if (w > maxSize || h > maxSize) {
                            if (w > h) { h = Math.round(h * maxSize / w); w = maxSize }
                            else { w = Math.round(w * maxSize / h); h = maxSize }
                          }
                          canvas.width = w; canvas.height = h
                          const ctx = canvas.getContext('2d')!
                          ctx.drawImage(img, 0, 0, w, h)
                          resolve(canvas.toDataURL('image/webp', 0.85))
                        }
                        img.onerror = reject
                        img.src = reader.result as string
                      }
                      reader.onerror = reject
                      reader.readAsDataURL(file)
                    })
                    setLogoUrl(dataUrl)
                    if (settings) await updateDocument('settings', settings.id, { logo_url: dataUrl })
                    if (companyId) await updateDocument('companies', companyId, { logo_url: dataUrl })
                    toast.success('Logo enviada com sucesso!')
                  } catch (err) { console.error(err); toast.error('Erro ao enviar logo') }
                  setUploading(false)
                  e.target.value = ''
                }} />
            </label>
            {logoUrl && (
              <button onClick={async () => {
                try {
                  setLogoUrl(null)
                  if (settings) await updateDocument('settings', settings.id, { logo_url: null })
                  if (companyId) await updateDocument('companies', companyId, { logo_url: null })
                  toast.success('Logo removida')
                } catch { toast.error('Erro ao remover') }
              }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', borderRadius: '0.625rem', background: '#fef2f2', color: '#ef4444', fontSize: '0.8125rem', fontWeight: 700, border: '1px solid #fecaca', cursor: 'pointer' }}>
                <Trash2 style={{ width: '14px', height: '14px' }} /> Remover
              </button>
            )}
          </div>
          <p style={{ fontSize: '0.6875rem', color: '#9ca3af', textAlign: 'center' }}>Formatos: JPG, PNG, WEBP • Máx: 5MB</p>
        </div>
      </div>

      {/* Business Info */}
      <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {sectionHeader(<Store className="w-5 h-5" style={{ color: '#fff' }} />, "Informações do Negócio", "Dados exibidos no site público", "linear-gradient(135deg, #7c5cfc, #a78bfa)")}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Nome do Negócio</label>
            <input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>WhatsApp</label>
              <input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} style={inputStyle} placeholder="61998148986" />
            </div>
            <div>
              <label style={labelStyle}>Telefone fixo</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} placeholder="(00) 0000-0000" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Endereço</label>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} style={inputStyle} placeholder="Rua, número, bairro" />
          </div>
          <div>
            <label style={labelStyle}>Instagram</label>
            <input value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} style={inputStyle} placeholder="@seunegocio" />
          </div>
          <button onClick={saveSettings}
            style={{ padding: '0.625rem 1.5rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', marginTop: '0.25rem', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 4px 14px rgba(124,92,252,0.3)' }}>
            <Save className="w-4 h-4" /> Salvar Configurações
          </button>
        </div>
      </div>

      {/* Aparência da Agenda */}
      <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {sectionHeader(<Palette className="w-5 h-5" style={{ color: '#fff' }} />, "Aparência da Agenda", "Cores e estilos da sua agenda", "linear-gradient(135deg, #ec4899, #f472b6)")}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Cor da Coluna de Folga (Profissionais)</label>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <input type="color" value={form.off_day_color || "#ef4444"} onChange={e => setForm({ ...form, off_day_color: e.target.value })} style={{ width: '40px', height: '40px', border: 'none', padding: 0, borderRadius: '0.375rem', cursor: 'pointer' }} />
              <input value={form.off_day_color || ""} onChange={e => setForm({ ...form, off_day_color: e.target.value })} style={{ ...inputStyle, flex: 1 }} placeholder="#ef4444 (padrão)" />
            </div>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Essa cor será usada para destacar a coluna de profissionais que não trabalham no dia.</p>
          </div>
          <button onClick={saveSettings}
            style={{ padding: '0.625rem 1.5rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', marginTop: '0.25rem', background: 'linear-gradient(135deg, #ec4899, #f472b6)', boxShadow: '0 4px 14px rgba(236,72,153,0.3)' }}>
            <Save className="w-4 h-4" /> Salvar Aparência
          </button>
        </div>
      </div>

      {/* Fiscal Data */}
      <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {sectionHeader(<Building2 className="w-5 h-5" style={{ color: '#fff' }} />, "Dados Fiscais", "CNPJ e razão social para notas fiscais", "linear-gradient(135deg, #5b8def, #93b5f5)")}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>CNPJ</label>
            <input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} style={inputStyle} placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <label style={labelStyle}>Razão Social</label>
            <input value={form.company_legal_name} onChange={e => setForm({ ...form, company_legal_name: e.target.value })} style={inputStyle} placeholder="Nome legal da empresa" />
          </div>
          <button onClick={saveSettings}
            style={{ padding: '0.625rem 1.5rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #5b8def, #93b5f5)', boxShadow: '0 4px 14px rgba(91,141,239,0.3)' }}>
            <Save className="w-4 h-4" /> Salvar Dados Fiscais
          </button>
        </div>
      </div>

      {/* Hours */}
      <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {sectionHeader(<Clock className="w-5 h-5" style={{ color: '#fff' }} />, "Horários de Funcionamento", "Defina os dias e horários de atendimento", "linear-gradient(135deg, #22c997, #5ee0b8)")}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {hoursForm.map((h, i) => (
            <div key={h.day} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', background: h.active ? '#f9fafb' : 'transparent' }}>
              <button onClick={() => {
                const nf = [...hoursForm]; nf[i].active = !nf[i].active; setHoursForm(nf)
              }}
                style={{
                  width: '5.5rem', padding: '0.5rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 700,
                  flexShrink: 0, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                  background: h.active ? 'linear-gradient(135deg, #7c5cfc, #a78bfa)' : '#f3f4f6',
                  color: h.active ? '#fff' : '#9ca3af',
                  boxShadow: h.active ? '0 2px 8px rgba(124,92,252,0.3)' : 'none',
                }}>
                {weekDays[h.day].slice(0, 3)}
              </button>
              {h.active ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                  <input type="time" value={h.start}
                    onChange={e => { const nf = [...hoursForm]; nf[i].start = e.target.value; setHoursForm(nf) }}
                    style={{ ...inputStyle, width: '7rem', padding: '0.5rem 0.75rem' }} />
                  <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontWeight: 500 }}>às</span>
                  <input type="time" value={h.end}
                    onChange={e => { const nf = [...hoursForm]; nf[i].end = e.target.value; setHoursForm(nf) }}
                    style={{ ...inputStyle, width: '7rem', padding: '0.5rem 0.75rem' }} />
                </div>
              ) : (
                <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontWeight: 500, fontStyle: 'italic' }}>Fechado</span>
              )}
            </div>
          ))}
          <button onClick={saveHours}
            style={{ padding: '0.625rem 1.5rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', marginTop: '0.75rem', background: 'linear-gradient(135deg, #22c997, #5ee0b8)', boxShadow: '0 4px 14px rgba(34,201,151,0.3)' }}>
            <Save className="w-4 h-4" /> Salvar Horários
          </button>
        </div>
      </div>

      {/* Blocked Dates */}
      <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {sectionHeader(<Ban className="w-5 h-5" style={{ color: '#fff' }} />, "Datas Bloqueadas", "Feriados e dias sem atendimento", "linear-gradient(135deg, #f25c5c, #f78888)")}
        <div style={{ padding: '1.5rem' }}>
          <button onClick={() => setShowBlockModal(true)}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', color: '#fff', fontWeight: 700, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem', border: 'none', cursor: 'pointer', marginBottom: '1rem', background: 'linear-gradient(135deg, #f25c5c, #f78888)', boxShadow: '0 4px 14px rgba(242,92,92,0.3)' }}>
            <Plus style={{ width: '0.875rem', height: '0.875rem' }} /> Bloquear Data
          </button>
          {blockedDates.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {blockedDates.map((bd) => (
                <div key={bd.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <Ban style={{ width: '0.875rem', height: '0.875rem', color: '#ef4444', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e1e2d' }}>{bd.date.split("-").reverse().join("/")}</span>
                  {bd.reason && <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>— {bd.reason}</span>}
                  <button onClick={() => removeBlockedDate(bd.id)} style={{ marginLeft: 'auto', padding: '0.25rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                    <Trash2 style={{ width: '0.875rem', height: '0.875rem', color: '#ef4444' }} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#6b7280', textAlign: 'center', padding: '1rem' }}>Nenhuma data bloqueada</p>
          )}
        </div>
      </div>

      {/* Co-Admin Management */}
      <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {sectionHeader(<ShieldCheck className="w-5 h-5" style={{ color: '#fff' }} />, "Co-Administradores", "Adicione emails que podem gerenciar a empresa como admin", "linear-gradient(135deg, #8b5cf6, #c084fc)")}
        <div style={{ padding: '1.5rem' }}>
          {/* Info banner */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem 1rem', background: '#f5f3ff', borderRadius: '0.75rem', border: '1px solid #e9e5ff', marginBottom: '1.25rem' }}>
            <Mail style={{ width: '1.125rem', height: '1.125rem', color: '#8b5cf6', flexShrink: 0, marginTop: '0.125rem' }} />
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.6 }}>
              Emails adicionados aqui poderão fazer login com Google e terão <strong style={{ color: '#1e1e2d' }}>acesso total ao painel</strong> como administrador da empresa.
            </p>
          </div>

          {/* Add email input */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="email"
              value={newAdminEmail}
              onChange={e => setNewAdminEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAdminEmail()}
              style={{ ...inputStyle, flex: 1 }}
              placeholder="email@exemplo.com"
            />
            <button
              onClick={addAdminEmail}
              disabled={savingAdmin}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.625rem 1.25rem', borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #8b5cf6, #c084fc)',
                color: '#fff', fontWeight: 700, fontSize: '0.8125rem',
                border: 'none', cursor: savingAdmin ? 'wait' : 'pointer',
                boxShadow: '0 4px 14px rgba(139,92,246,0.3)',
                opacity: savingAdmin ? 0.7 : 1, whiteSpace: 'nowrap',
              }}
            >
              <UserPlus style={{ width: '1rem', height: '1rem' }} />
              Adicionar
            </button>
          </div>

          {/* Email list */}
          {adminEmails.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {adminEmails.map((email) => (
                <div key={email} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem', borderRadius: '0.75rem',
                  background: '#f9fafb', border: '1px solid #e5e7eb',
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: '2rem', height: '2rem', borderRadius: '0.5rem',
                    background: 'linear-gradient(135deg, #8b5cf6, #c084fc)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, boxShadow: '0 2px 6px rgba(139,92,246,0.25)',
                  }}>
                    <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>
                      {email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e1e2d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</p>
                    <p style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>Acesso total como admin</p>
                  </div>
                  <span style={{
                    padding: '0.1875rem 0.5rem', borderRadius: '999px',
                    fontSize: '0.625rem', fontWeight: 700,
                    background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0',
                  }}>ADMIN</span>
                  <button
                    onClick={() => removeAdminEmail(email)}
                    disabled={savingAdmin}
                    title="Remover co-admin"
                    style={{
                      padding: '0.375rem', borderRadius: '0.375rem',
                      border: 'none', background: 'transparent',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    <Trash2 style={{ width: '0.875rem', height: '0.875rem', color: '#ef4444' }} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af' }}>
              <ShieldCheck style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.4 }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Nenhum co-admin cadastrado</p>
              <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Adicione emails para compartilhar acesso administrativo</p>
            </div>
          )}
        </div>
      </div>

      {/* Block Date Modal */}
      {showBlockModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={() => setShowBlockModal(false)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: '24rem', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>Bloquear Data</h3>
              <button onClick={() => setShowBlockModal(false)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X style={{ width: '1.25rem', height: '1.25rem', color: '#9ca3af' }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Data *</label>
                <input type="date" value={blockDate} onChange={e => setBlockDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Motivo</label>
                <input value={blockReason} onChange={e => setBlockReason(e.target.value)} style={inputStyle} placeholder="Ex: Feriado, Recesso..." />
              </div>
              <button onClick={addBlockedDate}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #f25c5c, #f78888)', boxShadow: '0 4px 14px rgba(242,92,92,0.3)' }}>
                Bloquear Data
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
