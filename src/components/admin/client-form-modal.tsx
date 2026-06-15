"use client"
import { useState, useRef, useEffect } from "react"
import { X, Camera, Upload, Star, Loader2 } from "lucide-react"
import type { Client, ClientGender, ClientMaritalStatus, ClientReferralSource, ClientAddress } from "@/lib/types/database"
import { formatCPF, validateCPF, formatPhone, maskCEP } from "@/lib/utils"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"
import { toast } from "sonner"

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
  border: '2px solid #e8ecf4', fontSize: '0.8125rem', color: '#1e1e2d',
  outline: 'none', background: '#fafbfc', minHeight: '40px',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem',
}
const sectionTitle: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 700, color: '#1e1e2d',
  marginBottom: '0.75rem', paddingBottom: '0.375rem',
  borderBottom: '1px solid #f1f3f9',
}

const tabs = [
  { id: 'pessoal', label: 'Dados Pessoais' },
  { id: 'contato', label: 'Contato' },
  { id: 'endereco', label: 'Endereço' },
  { id: 'extras', label: 'Extras' },
]

interface Props {
  client: Client | null
  onClose: () => void
  onSave: (data: any, photoFile: File | null, oldPhotoUrl: string | null) => Promise<void>
}

export function ClientFormModal({ client, onClose, onSave }: Props) {
  const [tab, setTab] = useState('pessoal')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Dados pessoais
  const [name, setName] = useState("")
  const [nickname, setNickname] = useState("")
  const [cpf, setCpf] = useState("")
  const [rg, setRg] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [gender, setGender] = useState<ClientGender | "">("")
  const [maritalStatus, setMaritalStatus] = useState<ClientMaritalStatus | "">("")

  // Contato
  const [phone, setPhone] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [isWhatsapp, setIsWhatsapp] = useState(true)
  const [email, setEmail] = useState("")

  // Endereço
  const [address, setAddress] = useState<ClientAddress>({})
  const [loadingCep, setLoadingCep] = useState(false)

  // Extras
  const [notes, setNotes] = useState("")
  const [instagram, setInstagram] = useState("")
  const [referralSource, setReferralSource] = useState<ClientReferralSource | "">("")
  const [referredBy, setReferredBy] = useState("")
  const [isVip, setIsVip] = useState(false)
  const [debtAmount, setDebtAmount] = useState("0")
  const [onlineBookingBlocked, setOnlineBookingBlocked] = useState(false)

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  // Populate on edit
  useEffect(() => {
    if (!client) return
    setName(client.name || "")
    setNickname(client.nickname || "")
    setCpf(client.cpf ? formatCPF(client.cpf) : "")
    setRg(client.rg || "")
    setBirthDate(client.birth_date || "")
    setGender(client.gender || "")
    setMaritalStatus(client.marital_status || "")
    setPhone(client.phone || "")
    setWhatsapp(client.whatsapp || "")
    setIsWhatsapp(client.is_whatsapp !== false)
    setEmail(client.email || "")
    setAddress(client.address || {})
    setNotes(client.notes || "")
    setInstagram(client.instagram || "")
    setReferralSource(client.referral_source || "")
    setReferredBy(client.referred_by || "")
    setIsVip(client.is_vip || false)
    setDebtAmount(String(client.debt_amount || 0))
    setPhotoUrl(client.photo_url || null)
    setOnlineBookingBlocked(client.online_booking_blocked || false)
  }, [client])

  const formatDateLocale = (isoStr?: string | null) => {
    if (!isoStr) return "Nenhuma"
    try {
      const d = new Date(isoStr)
      if (isNaN(d.getTime())) return isoStr
      const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
      return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`
    } catch {
      return isoStr
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (máx 5MB)"); return }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const lookupCEP = async (cepVal: string) => {
    const clean = cepVal.replace(/\D/g, "")
    if (clean.length !== 8) return
    setLoadingCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setAddress(prev => ({
          ...prev, cep: clean,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }))
      }
    } catch { /* ignore */ }
    setLoadingCep(false)
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return }
    if (!phone.trim()) { toast.error("Telefone é obrigatório"); return }

    const cleanCpf = cpf.replace(/\D/g, "")
    if (cleanCpf && cleanCpf.length === 11 && !validateCPF(cleanCpf)) {
      toast.error("CPF inválido"); return
    }

    // Check CPF duplicate
    if (cleanCpf && cleanCpf.length === 11) {
      try {
        const existing = await fetchCollectionWhere<Client>("clients", "cpf", "==", cleanCpf)
        if (existing.length > 0 && (!client || existing[0].id !== client.id)) {
          toast.error(`CPF já cadastrado para: ${existing[0].name}`); return
        }
      } catch { /* continue */ }
    }

    const debtVal = parseFloat(debtAmount) || 0
    const data: any = {
      name: name.trim(),
      nickname: nickname.trim() || null,
      cpf: cleanCpf || null,
      rg: rg.trim() || null,
      birth_date: birthDate || null,
      gender: gender || null,
      marital_status: maritalStatus || null,
      phone: phone.replace(/\D/g, ""),
      whatsapp: whatsapp.replace(/\D/g, "") || null,
      is_whatsapp: isWhatsapp,
      email: email.trim() || null,
      address: Object.values(address).some(v => v) ? address : null,
      notes: notes.trim() || null,
      instagram: instagram.trim() || null,
      referral_source: referralSource || null,
      referred_by: referredBy.trim() || null,
      is_vip: isVip,
      debt_amount: debtVal,
      status: debtVal > 0 ? "debtor" : "active",
      online_booking_blocked: onlineBookingBlocked,
    }

    if (!client) {
      data.total_spent = 0
      data.appointment_count = 0
      data.last_visit = null
    }

    setSaving(true)
    try {
      const oldUrl = (photoFile || !photoUrl) ? (client?.photo_url ?? null) : null
      await onSave(data, photoFile, oldUrl)
    } catch {
      toast.error("Erro ao salvar cliente")
    }
    setSaving(false)
  }

  const photoSrc = photoPreview || photoUrl
  const formatPhoneInput = (v: string) => {
    const c = v.replace(/\D/g, "").slice(0, 11)
    if (c.length <= 2) return c
    if (c.length <= 7) return `(${c.slice(0, 2)}) ${c.slice(2)}`
    return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', zIndex: 9998 }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', pointerEvents: 'none' }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '600px', maxHeight: '88vh',
          display: 'flex', flexDirection: 'column', pointerEvents: 'auto',
          boxShadow: '0 25px 80px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.1)',
          animation: 'modalScaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1)', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f3f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(180deg, #faf8ff 0%, #fff 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {photoSrc ? (
                <img src={photoSrc} alt="" style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', objectFit: 'cover', border: '2px solid #e0d4ff' }} />
              ) : (
                <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1rem', fontWeight: 800 }}>
                  {name ? name.charAt(0).toUpperCase() : '?'}
                </div>
              )}
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', fontWeight: 700, color: '#1e1e2d' }}>
                  {client ? 'Editar Cliente' : 'Novo Cliente'}
                </h3>
                <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>Preencha as informações do cliente</p>
              </div>
            </div>
            <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.625rem', border: 'none', background: '#f1f3f9', cursor: 'pointer', display: 'flex' }}>
              <X style={{ width: '16px', height: '16px', color: '#8b8fa7' }} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #f1f3f9', flexShrink: 0, padding: '0 1.5rem', gap: '0.25rem' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '0.625rem 0.875rem', fontSize: '0.75rem', fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? '#7c5cfc' : '#8b8fa7', background: 'transparent', border: 'none',
                borderBottom: tab === t.id ? '2px solid #7c5cfc' : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>

            {/* TAB: DADOS PESSOAIS */}
            {tab === 'pessoal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {/* Client Summary Card */}
                {client && (
                  <div style={{ padding: '1.25rem', background: '#fff', border: '1px solid #e8ecf4', borderRadius: '1rem', marginBottom: '0.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {photoSrc ? (
                        <img src={photoSrc} alt="" style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', objectFit: 'cover', background: '#f1f3f9' }} />
                      ) : (
                        <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', background: '#f1f3f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '1.25rem', fontWeight: 700 }}>
                          {client.name ? client.name.charAt(0).toUpperCase() : '?'}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 800, color: '#1e1e2d', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{client.name}</h4>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                          <span>Gênero: {client.gender === 'feminino' ? 'Feminino' : client.gender === 'masculino' ? 'Masculino' : 'Não informado'}</span>
                          <span>Nascimento: {client.birth_date ? client.birth_date.split('-').reverse().join('/') : 'Não informado'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', borderTop: '1px solid #f1f3f9', paddingTop: '0.75rem', gap: '1rem' }}>
                      <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #f1f3f9' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', marginBottom: '0.25rem' }}>Cliente desde</div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e1e2d' }}>{formatDateLocale(client.created_at)}</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', marginBottom: '0.25rem' }}>Última visita</div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e1e2d' }}>{formatDateLocale(client.last_visit)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Photo Upload Area */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.25rem' }}>
                  <div style={{ position: 'relative' }}>
                    {photoSrc ? (
                      <img src={photoSrc} alt="" style={{ width: '4rem', height: '4rem', borderRadius: '1rem', objectFit: 'cover', border: '2px solid #e0d4ff' }} />
                    ) : (
                      <div style={{ width: '4rem', height: '4rem', borderRadius: '1rem', background: '#f1f3f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Camera style={{ width: '1.25rem', height: '1.25rem', color: '#8b8fa7' }} />
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e0d4ff', background: '#f5f3ff', color: '#7c5cfc', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer' }}>
                      <Upload style={{ width: '12px', height: '12px' }} /> {photoSrc ? 'Trocar foto' : 'Adicionar foto'}
                    </button>
                    {photoSrc && (
                      <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoUrl(null) }} style={{ fontSize: '0.625rem', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>Remover</button>
                    )}
                  </div>
                </div>

                {/* VIP Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', background: isVip ? '#fffbeb' : '#fafbfc', border: isVip ? '1px solid #fde68a' : '1px solid #e8ecf4', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Star style={{ width: '14px', height: '14px', color: isVip ? '#d97706' : '#9ca3af', fill: isVip ? '#d97706' : 'none' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isVip ? '#92400e' : '#6b7280' }}>Cliente VIP</span>
                  </div>
                  <button type="button" onClick={() => setIsVip(!isVip)} style={{
                    width: '2.25rem', height: '1.25rem', borderRadius: '999px', border: 'none', cursor: 'pointer', position: 'relative',
                    background: isVip ? '#d97706' : '#d1d5db', transition: 'background 0.2s',
                  }}>
                    <span style={{ position: 'absolute', top: '2px', left: isVip ? '16px' : '2px', width: '1rem', height: '1rem', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Nome completo *</label>
                    <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Nome completo" />
                  </div>
                  <div>
                    <label style={labelStyle}>Apelido / Nome social</label>
                    <input value={nickname} onChange={e => setNickname(e.target.value)} style={inputStyle} placeholder="Apelido" />
                  </div>
                  <div>
                    <label style={labelStyle}>CPF</label>
                    <input value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} style={inputStyle} placeholder="000.000.000-00" maxLength={14} />
                  </div>
                  <div>
                    <label style={labelStyle}>RG</label>
                    <input value={rg} onChange={e => setRg(e.target.value)} style={inputStyle} placeholder="RG" />
                  </div>
                  <div>
                    <label style={labelStyle}>Data de nascimento</label>
                    <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Gênero</label>
                    <select value={gender} onChange={e => setGender(e.target.value as ClientGender)} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">Não informado</option>
                      <option value="feminino">Feminino</option>
                      <option value="masculino">Masculino</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Estado civil</label>
                    <select value={maritalStatus} onChange={e => setMaritalStatus(e.target.value as ClientMaritalStatus)} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">Não informado</option>
                      <option value="solteiro">Solteiro(a)</option>
                      <option value="casado">Casado(a)</option>
                      <option value="divorciado">Divorciado(a)</option>
                      <option value="viuvo">Viúvo(a)</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CONTATO */}
            {tab === 'contato' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div>
                  <label style={labelStyle}>Telefone principal *</label>
                  <input value={formatPhoneInput(phone)} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="(00) 00000-0000" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={isWhatsapp} onChange={e => setIsWhatsapp(e.target.checked)} id="isWa" style={{ accentColor: '#7c5cfc' }} />
                  <label htmlFor="isWa" style={{ fontSize: '0.75rem', color: '#6b7280', cursor: 'pointer' }}>Este telefone é WhatsApp</label>
                </div>
                {!isWhatsapp && (
                  <div>
                    <label style={labelStyle}>WhatsApp</label>
                    <input value={formatPhoneInput(whatsapp)} onChange={e => setWhatsapp(e.target.value)} style={inputStyle} placeholder="(00) 00000-0000" />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="email@exemplo.com" />
                </div>
                <div>
                  <label style={labelStyle}>Valor em débito (R$)</label>
                  <input type="number" step="0.01" value={debtAmount} onChange={e => setDebtAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
                </div>
              </div>
            )}

            {/* TAB: ENDEREÇO */}
            {tab === 'endereco' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
                  <div>
                    <label style={labelStyle}>CEP</label>
                    <input value={maskCEP(address.cep || "")} onChange={e => setAddress(p => ({ ...p, cep: e.target.value }))} onBlur={e => lookupCEP(e.target.value)} style={inputStyle} placeholder="00000-000" maxLength={9} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button onClick={() => lookupCEP(address.cep || "")} disabled={loadingCep} style={{ padding: '0.625rem 1rem', borderRadius: '0.625rem', border: 'none', background: '#f0ecff', color: '#7c5cfc', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', minHeight: '40px' }}>
                      {loadingCep ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : 'Buscar'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Rua</label>
                    <input value={address.street || ""} onChange={e => setAddress(p => ({ ...p, street: e.target.value }))} style={inputStyle} placeholder="Rua / Avenida" />
                  </div>
                  <div>
                    <label style={labelStyle}>Número</label>
                    <input value={address.number || ""} onChange={e => setAddress(p => ({ ...p, number: e.target.value }))} style={inputStyle} placeholder="Nº" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Complemento</label>
                  <input value={address.complement || ""} onChange={e => setAddress(p => ({ ...p, complement: e.target.value }))} style={inputStyle} placeholder="Apto, Bloco, etc." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Bairro</label>
                    <input value={address.neighborhood || ""} onChange={e => setAddress(p => ({ ...p, neighborhood: e.target.value }))} style={inputStyle} placeholder="Bairro" />
                  </div>
                  <div>
                    <label style={labelStyle}>Cidade</label>
                    <input value={address.city || ""} onChange={e => setAddress(p => ({ ...p, city: e.target.value }))} style={inputStyle} placeholder="Cidade" />
                  </div>
                  <div>
                    <label style={labelStyle}>UF</label>
                    <input value={address.state || ""} onChange={e => setAddress(p => ({ ...p, state: e.target.value.toUpperCase().slice(0, 2) }))} style={inputStyle} placeholder="UF" maxLength={2} />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: EXTRAS */}
            {tab === 'extras' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {/* Online Booking Block */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem', borderRadius: '0.75rem', background: onlineBookingBlocked ? '#fef2f2' : '#fafbfc', border: onlineBookingBlocked ? '1px solid #fca5a5' : '1px solid #e8ecf4', transition: 'all 0.2s', marginBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: onlineBookingBlocked ? '#b91c1c' : '#1e1e2d' }}>Bloquear agendamento online para este cliente</span>
                    <span style={{ fontSize: '0.6875rem', color: onlineBookingBlocked ? '#ef4444' : '#6b7280' }}>Impede que o cliente agende pela página pública.</span>
                  </div>
                  <button type="button" onClick={() => setOnlineBookingBlocked(!onlineBookingBlocked)} style={{
                    width: '2.5rem', height: '1.375rem', borderRadius: '999px', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
                    background: onlineBookingBlocked ? '#ef4444' : '#d1d5db', transition: 'background 0.2s',
                  }}>
                    <span style={{ position: 'absolute', top: '2px', left: onlineBookingBlocked ? '20px' : '2px', width: '1.125rem', height: '1.125rem', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }} />
                  </button>
                </div>
                
                <div>
                  <label style={labelStyle}>Instagram</label>
                  <input value={instagram} onChange={e => setInstagram(e.target.value)} style={inputStyle} placeholder="@usuario" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Como conheceu o salão?</label>
                    <select value={referralSource} onChange={e => setReferralSource(e.target.value as ClientReferralSource)} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">Não informado</option>
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="google">Google</option>
                      <option value="indicacao">Indicação</option>
                      <option value="passando_pela_rua">Passando pela rua</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Indicado por</label>
                    <input value={referredBy} onChange={e => setReferredBy(e.target.value)} style={inputStyle} placeholder="Nome de quem indicou" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Observações</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'none' as const }} placeholder="Anotações sobre o cliente..." />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f3f9', flexShrink: 0, display: 'flex', gap: '0.75rem' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '2px solid #e8ecf4', background: '#fff', color: '#555', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', minHeight: '44px' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} style={{
              flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none',
              background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff',
              fontWeight: 700, fontSize: '0.8125rem', cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1, minHeight: '44px',
              boxShadow: '0 4px 14px rgba(124,92,252,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
            }}>
              {saving && <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />}
              {saving ? 'Salvando...' : (client ? 'Salvar Alterações' : 'Cadastrar Cliente')}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalScaleIn { from { transform: scale(0.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </>
  )
}
