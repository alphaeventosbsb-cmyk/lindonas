"use client"

import { useEffect, useState } from "react"
import { fetchCollection, createDocument, updateDocument } from "@/lib/firebase/client-utils"
import type { Invoice, Appointment, BusinessSettings } from "@/lib/types/database"
import { formatCurrency, formatPhone } from "@/lib/utils"
import { Loader2, FileText, Plus, X, Printer, CheckCircle, XCircle, Search, Hash, Building2 } from "lucide-react"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"
import { usePermission } from "@/lib/rbac/usePermission"
import { PermissionGate } from "@/components/ui/permission-gate"
import { ExportButtons } from "@/components/ui/export-buttons"

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
  border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d',
  fontSize: '0.875rem', fontWeight: 500, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem'
}

const paymentLabels: Record<string, string> = {
  cash: "Dinheiro", pix: "PIX", credit_card: "Crédito", debit_card: "Débito"
}

export default function NotasFiscaisPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showReceipt, setShowReceipt] = useState<Invoice | null>(null)
  const [search, setSearch] = useState("")
  const [form, setForm] = useState({
    client_name: "", client_phone: "", service_name: "", amount: "",
    payment_method: "pix", appointment_id: "",
  })
  const { ConfirmationDialog, confirm } = useConfirm()
  const { can } = usePermission()

  const load = async () => {
    setLoading(true)
    const [i, a, s] = await Promise.all([
      fetchCollection<Invoice>("invoices"),
      fetchCollection<Appointment>("appointments"),
      fetchCollection<BusinessSettings>("settings"),
    ])
    i.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    setInvoices(i)
    setAppointments(a.filter(ap => ap.status === "completed"))
    if (s.length > 0) setSettings(s[0])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setForm({ client_name: "", client_phone: "", service_name: "", amount: "", payment_method: "pix", appointment_id: "" })
    setShowForm(true)
  }

  const fillFromAppointment = (aptId: string) => {
    const apt = appointments.find(a => a.id === aptId)
    if (apt) {
      setForm({
        ...form,
        appointment_id: aptId,
        client_name: apt.client_name,
        client_phone: apt.client_phone,
        service_name: apt.service_name,
        amount: String(apt.service_price),
        payment_method: apt.payment_method || "pix",
      })
    }
  }

  const generateNumber = () => {
    const now = new Date()
    return `NF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(invoices.length + 1).padStart(4, '0')}`
  }

  const handleSave = async () => {
    if (!form.client_name || !form.service_name || !form.amount) return toast.error("Preencha os campos obrigatórios")
    await createDocument("invoices", {
      appointment_id: form.appointment_id || null,
      client_name: form.client_name,
      client_phone: form.client_phone,
      service_name: form.service_name,
      amount: parseFloat(form.amount),
      payment_method: form.payment_method,
      cnpj: settings?.cnpj || null,
      company_name: settings?.company_legal_name || settings?.business_name || null,
      invoice_number: generateNumber(),
      status: "issued",
      issued_at: new Date().toISOString(),
    })
    toast.success("Nota fiscal emitida!")
    setShowForm(false)
    load()
  }

  const handleCancel = async (id: string, invoiceNumber: string) => {
    const confirmed = await confirm({
      title: "Cancelar nota fiscal",
      message: `Tem certeza que deseja cancelar a nota fiscal ${invoiceNumber}?\n\nEssa ação não poderá ser desfeita.`,
      confirmText: "Cancelar nota",
      cancelText: "Voltar",
      variant: "danger",
    })
    if (!confirmed) return
    await updateDocument("invoices", id, { status: "cancelled" })
    toast.success("Nota fiscal cancelada")
    load()
  }

  const filtered = invoices.filter(i =>
    i.client_name.toLowerCase().includes(search.toLowerCase()) ||
    i.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    i.service_name.toLowerCase().includes(search.toLowerCase())
  )

  const printReceipt = (invoice: Invoice) => {
    setShowReceipt(invoice)
    setTimeout(() => {
      window.print()
    }, 300)
  }

  const exportConfig = {
    title: `Notas Fiscais Emitidas`,
    fileName: `notas_fiscais`,
    data: filtered,
    columns: [
      { header: "Número NF", key: "invoice_number" },
      { header: "Cliente", key: "client_name" },
      { header: "Serviço", key: "service_name" },
      { header: "Pagamento", key: "payment_method", format: (v: any) => paymentLabels[String(v)] || String(v) },
      { header: "Valor", key: "amount", format: (v: any) => formatCurrency(Number(v)) },
      { header: "Data Emissão", key: "issued_at", format: (v: any) => v ? new Date(String(v)).toLocaleDateString('pt-BR') : "—" },
      { header: "Status", key: "status", format: (v: any) => v === "issued" ? "Emitida" : "Cancelada" }
    ]
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Config Warning */}
      {(!settings?.cnpj) && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Building2 style={{ width: '1.25rem', height: '1.25rem', color: '#d97706', flexShrink: 0 }} />
          <p style={{ fontSize: '0.875rem', color: '#92400e' }}>
            Configure o CNPJ e dados da empresa em <strong>Configurações</strong> para emissão completa de notas fiscais.
          </p>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 4px 14px rgba(124,92,252,0.25)' }}>
              <FileText style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>Total Emitidas</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>{invoices.filter(i => i.status === "issued").length}</p>
        </div>
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #22c997, #5ee0b8)', boxShadow: '0 4px 14px rgba(34,201,151,0.25)' }}>
              <Hash style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>Valor Total</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', fontFamily: "var(--font-heading)" }}>
            {formatCurrency(invoices.filter(i => i.status === "issued").reduce((s, i) => s + i.amount, 0))}
          </p>
        </div>
      </div>

      {/* Filters + Add */}
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#9ca3af' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.5rem' }}
            placeholder="Buscar por cliente ou número..." />
        </div>
        <ExportButtons 
          data={exportConfig.data}
          columns={exportConfig.columns}
          fileName={exportConfig.fileName}
          title={exportConfig.title}
        />
        <PermissionGate permission="invoices.create">
          <button onClick={openNew}
            style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 4px 14px rgba(124,92,252,0.3)', whiteSpace: 'nowrap' }}>
            <Plus style={{ width: '1rem', height: '1rem' }} /> Emitir Nota
          </button>
        </PermissionGate>
      </div>

      {/* Modal */}
      {showForm && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={() => setShowForm(false)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: '28rem', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>Emitir Nota Fiscal</h3>
              <button onClick={() => setShowForm(false)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X style={{ width: '1.25rem', height: '1.25rem', color: '#9ca3af' }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {appointments.length > 0 && (
                <div>
                  <label style={labelStyle}>Preencher de Agendamento</label>
                  <select onChange={e => fillFromAppointment(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">Selecione (opcional)...</option>
                    {appointments.slice(0, 20).map(a => (
                      <option key={a.id} value={a.id}>{a.client_name} - {a.service_name} ({a.appointment_date})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Nome do Cliente *</label>
                <input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} style={inputStyle} placeholder="Nome completo" />
              </div>
              <div>
                <label style={labelStyle}>Telefone</label>
                <input value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })} style={inputStyle} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label style={labelStyle}>Serviço *</label>
                <input value={form.service_name} onChange={e => setForm({ ...form, service_name: e.target.value })} style={inputStyle} placeholder="Nome do serviço" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Valor (R$) *</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle} placeholder="0.00" />
                </div>
                <div>
                  <label style={labelStyle}>Pagamento</label>
                  <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="cash">Dinheiro</option>
                    <option value="pix">PIX</option>
                    <option value="credit_card">Cartão Crédito</option>
                    <option value="debit_card">Cartão Débito</option>
                  </select>
                </div>
              </div>
              <button onClick={handleSave}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', marginTop: '0.5rem', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 4px 14px rgba(124,92,252,0.3)' }}>
                Emitir Nota Fiscal
              </button>
            </div>
          </div>
        </>
      )}

      {/* Invoices List */}
      <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f3f4f6', background: '#fafbfc' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>Notas Fiscais ({filtered.length})</h3>
        </div>
        {filtered.length > 0 ? (
          <div>
            {filtered.map((inv) => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: inv.status === "issued" ? '#ecfdf5' : inv.status === "cancelled" ? '#fef2f2' : '#f3f4f6' }}>
                  {inv.status === "issued" ?
                    <CheckCircle style={{ width: '1rem', height: '1rem', color: '#059669' }} /> :
                    <XCircle style={{ width: '1rem', height: '1rem', color: '#ef4444' }} />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.125rem' }}>
                    <p style={{ fontWeight: 700, color: '#7c5cfc', fontSize: '0.75rem', fontFamily: 'monospace' }}>{inv.invoice_number}</p>
                    <span style={{
                      fontSize: '0.5625rem', fontWeight: 700, padding: '0.125rem 0.375rem', borderRadius: '999px',
                      background: inv.status === "issued" ? '#ecfdf5' : '#fef2f2',
                      color: inv.status === "issued" ? '#059669' : '#ef4444',
                      border: `1px solid ${inv.status === "issued" ? '#a7f3d0' : '#fecaca'}`,
                    }}>
                      {inv.status === "issued" ? "Emitida" : "Cancelada"}
                    </span>
                  </div>
                  <p style={{ fontWeight: 600, color: '#1e1e2d', fontSize: '0.875rem' }}>{inv.client_name}</p>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {inv.service_name} • {paymentLabels[inv.payment_method] || inv.payment_method}
                    {inv.issued_at && ` • ${new Date(inv.issued_at).toLocaleDateString('pt-BR')}`}
                  </p>
                </div>
                <p style={{ fontWeight: 800, color: '#1e1e2d', whiteSpace: 'nowrap' }}>{formatCurrency(inv.amount)}</p>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button onClick={() => printReceipt(inv)} style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: '#f3f4f6', cursor: 'pointer' }}>
                    <Printer style={{ width: '0.875rem', height: '0.875rem', color: '#6b7280' }} />
                  </button>
                  {inv.status === "issued" && (
                    <PermissionGate permission="invoices.edit">
                      <button onClick={() => handleCancel(inv.id, inv.invoice_number)} style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                        <XCircle style={{ width: '0.875rem', height: '0.875rem', color: '#f87171' }} />
                      </button>
                    </PermissionGate>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <FileText style={{ width: '2rem', height: '2rem', color: '#d1d5db', margin: '0 auto 0.75rem' }} />
            <p style={{ color: '#6b7280', fontWeight: 600 }}>Nenhuma nota fiscal emitida</p>
          </div>
        )}
      </div>

      {/* Print Receipt Modal */}
      {showReceipt && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={() => setShowReceipt(null)} />
          <div id="receipt-print" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: '24rem', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #e5e7eb', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.125rem', color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>
                {settings?.business_name || "Agenda Online"}
              </h3>
              {settings?.cnpj && <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>CNPJ: {settings.cnpj}</p>}
              {settings?.address && <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>{settings.address}</p>}
            </div>
            <div style={{ borderBottom: '2px dashed #e5e7eb', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.25rem' }}>CUPOM NÃO FISCAL</p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>{showReceipt.invoice_number}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Cliente:</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{showReceipt.client_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Serviço:</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{showReceipt.service_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Pagamento:</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{paymentLabels[showReceipt.payment_method] || showReceipt.payment_method}</span>
              </div>
            </div>
            <div style={{ borderTop: '2px dashed #e5e7eb', paddingTop: '1rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>TOTAL</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d' }}>{formatCurrency(showReceipt.amount)}</p>
              {showReceipt.issued_at && (
                <p style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                  Emitido em: {new Date(showReceipt.issued_at).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
            <button onClick={() => setShowReceipt(null)}
              style={{ width: '100%', marginTop: '1.25rem', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
              Fechar
            </button>
          </div>
        </>
      )}
      <ConfirmationDialog />
    </div>
  )
}
