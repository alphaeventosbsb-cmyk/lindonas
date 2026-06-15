"use client"

import { useEffect, useState } from "react"
import { fetchCollection, createDocument, updateDocument } from "@/lib/firebase/client-utils"
import type { SaaSPayment, Company, SaaSPlan } from "@/lib/types/database"
import { formatCurrency } from "@/lib/utils"
import { Loader2, CreditCard, CheckCircle, Clock, AlertTriangle, Plus, X, Search, DollarSign } from "lucide-react"
import { toast } from "sonner"

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
  border: '2px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
  fontSize: '0.875rem', fontWeight: 500, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '0.375rem'
}

const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
  paid: { bg: '#ecfdf5', color: '#059669', label: 'Pago' },
  pending: { bg: '#fffbeb', color: '#d97706', label: 'Pendente' },
  overdue: { bg: '#fef2f2', color: '#ef4444', label: 'Atrasado' },
  cancelled: { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelado' },
}

export default function CobrancasPage() {
  const [payments, setPayments] = useState<SaaSPayment[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [plans, setPlans] = useState<SaaSPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [form, setForm] = useState({ company_id: "", amount: "", method: "pix", due_date: "", notes: "" })

  const load = async () => {
    setLoading(true)
    const [p, c, pl] = await Promise.all([
      fetchCollection<SaaSPayment>("saas_payments"),
      fetchCollection<Company>("companies"),
      fetchCollection<SaaSPlan>("saas_plans"),
    ])
    p.sort((a, b) => b.created_at.localeCompare(a.created_at))
    setPayments(p)
    setCompanies(c)
    setPlans(pl)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.company_id || !form.amount || !form.due_date) return toast.error("Preencha os campos obrigatórios")
    const company = companies.find(c => c.id === form.company_id)
    await createDocument("saas_payments", {
      company_id: form.company_id,
      company_name: company?.name || "",
      subscription_id: null,
      amount: parseFloat(form.amount),
      method: form.method,
      status: "pending",
      paid_at: null,
      due_date: form.due_date,
      notes: form.notes || null,
    })
    toast.success("Cobrança criada!")
    setShowForm(false)
    load()
  }

  const handleMarkPaid = async (payment: SaaSPayment) => {
    await updateDocument("saas_payments", payment.id, {
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    // Also update company status
    if (payment.company_id) {
      const now = new Date()
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
      await updateDocument("companies", payment.company_id, {
        subscription_status: "active",
        is_blocked: false,
        payment_due_date: nextMonth.toISOString().split("T")[0],
      })
    }
    toast.success("Pagamento confirmado!")
    load()
  }

  const handleMarkOverdue = async (id: string) => {
    await updateDocument("saas_payments", id, { status: "overdue" })
    toast.success("Marcado como atrasado")
    load()
  }

  const totalReceived = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0)
  const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0)
  const totalOverdue = payments.filter(p => p.status === "overdue").reduce((s, p) => s + p.amount, 0)

  const filtered = payments.filter(p => {
    const matchSearch = p.company_name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "all" || p.status === statusFilter
    return matchSearch && matchStatus
  })

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {[
          { label: "Total Recebido", value: formatCurrency(totalReceived), icon: CheckCircle, gradient: "linear-gradient(135deg, #22c997, #5ee0b8)" },
          { label: "Pendentes", value: formatCurrency(totalPending), icon: Clock, gradient: "linear-gradient(135deg, #ffb547, #ffd08a)" },
          { label: "Atrasados", value: formatCurrency(totalOverdue), icon: AlertTriangle, gradient: "linear-gradient(135deg, #f25c5c, #f78888)" },
        ].map((stat, i) => (
          <div key={i} style={{ background: '#1a1035', borderRadius: '1rem', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: stat.gradient }}>
                <stat.icon style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{stat.label}</span>
            </div>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', fontFamily: "var(--font-heading)" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Actions + Filter */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => { setForm({ company_id: "", amount: "", method: "pix", due_date: "", notes: "" }); setShowForm(true) }}
          style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
          <Plus style={{ width: '1rem', height: '1rem' }} /> Nova Cobrança
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'rgba(255,255,255,0.3)' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.5rem' }} placeholder="Buscar empresa..." />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ ...inputStyle, width: 'auto', minWidth: '120px', cursor: 'pointer' }}>
          <option value="all">Todos</option>
          <option value="paid">Pagos</option>
          <option value="pending">Pendentes</option>
          <option value="overdue">Atrasados</option>
        </select>
      </div>

      {/* Payments List */}
      <div style={{ background: '#1a1035', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', fontFamily: "var(--font-heading)" }}>Cobranças ({filtered.length})</h3>
        </div>
        {filtered.length > 0 ? (
          <div>
            {filtered.map(pay => {
              const sc = statusConfig[pay.status] || statusConfig.pending
              return (
                <div key={pay.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: pay.status === "paid" ? 'rgba(34,201,151,0.1)' : pay.status === "overdue" ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)' }}>
                    {pay.status === "paid" ? <CheckCircle style={{ width: '1rem', height: '1rem', color: '#22c997' }} /> :
                     pay.status === "overdue" ? <AlertTriangle style={{ width: '1rem', height: '1rem', color: '#ef4444' }} /> :
                     <Clock style={{ width: '1rem', height: '1rem', color: '#f59e0b' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, color: '#fff', fontSize: '0.875rem' }}>{pay.company_name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                      Vencimento: {pay.due_date.split("-").reverse().join("/")} • {pay.method.toUpperCase()}
                      {pay.notes && ` • ${pay.notes}`}
                    </p>
                  </div>
                  <p style={{ fontWeight: 800, color: '#fff', fontSize: '0.9375rem', whiteSpace: 'nowrap' }}>{formatCurrency(pay.amount)}</p>
                  <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '0.125rem 0.5rem', borderRadius: '999px', background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>
                    {sc.label}
                  </span>
                  {pay.status !== "paid" && (
                    <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                      <button onClick={() => handleMarkPaid(pay)} title="Confirmar pagamento"
                        style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: 'rgba(34,201,151,0.1)', cursor: 'pointer', color: '#22c997' }}>
                        <CheckCircle style={{ width: '0.875rem', height: '0.875rem' }} />
                      </button>
                      {pay.status === "pending" && (
                        <button onClick={() => handleMarkOverdue(pay.id)} title="Marcar atrasado"
                          style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', color: '#ef4444' }}>
                          <AlertTriangle style={{ width: '0.875rem', height: '0.875rem' }} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <DollarSign style={{ width: '2rem', height: '2rem', color: 'rgba(255,255,255,0.2)', margin: '0 auto 0.75rem' }} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Nenhuma cobrança encontrada</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showForm && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={() => setShowForm(false)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#1a1035', borderRadius: '1rem', width: '100%', maxWidth: '28rem', padding: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', fontFamily: "var(--font-heading)" }}>Nova Cobrança</h3>
              <button onClick={() => setShowForm(false)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Empresa *</label>
                <select value={form.company_id} onChange={e => {
                  const c = companies.find(co => co.id === e.target.value)
                  const plan = c?.plan_id ? plans.find(p => p.id === c.plan_id) : null
                  setForm({ ...form, company_id: e.target.value, amount: plan ? String(plan.price) : form.amount })
                }} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Selecione...</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Valor (R$) *</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Vencimento *</label>
                  <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Método</label>
                <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="pix">PIX</option>
                  <option value="boleto">Boleto</option>
                  <option value="cartao">Cartão</option>
                  <option value="transferencia">Transferência</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Observações</label>
                <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={inputStyle} placeholder="Notas..." />
              </div>
              <button onClick={handleCreate}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
                Criar Cobrança
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
