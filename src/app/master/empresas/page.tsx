"use client"

import { useEffect, useState } from "react"
import { fetchCollection, updateDocument, deleteDocument } from "@/lib/firebase/client-utils"
import type { Company, SaaSPlan } from "@/lib/types/database"
import { formatCurrency } from "@/lib/utils"
import { Loader2, Building2, Search, Ban, Unlock, Trash2, CreditCard, Clock, CheckCircle, Eye, Edit3, X, Calendar } from "lucide-react"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
  border: '2px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
  fontSize: '0.875rem', fontWeight: 500, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '0.375rem'
}

const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: '#ecfdf5', color: '#059669', label: 'Ativa' },
  trial: { bg: '#eff6ff', color: '#2563eb', label: 'Trial' },
  pending: { bg: '#fffbeb', color: '#d97706', label: 'Pendente' },
  overdue: { bg: '#fef2f2', color: '#ef4444', label: 'Atrasado' },
  cancelled: { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelado' },
  blocked: { bg: '#fef2f2', color: '#ef4444', label: 'Bloqueado' },
}

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [plans, setPlans] = useState<SaaSPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showDetail, setShowDetail] = useState<Company | null>(null)
  const [showTrialModal, setShowTrialModal] = useState<Company | null>(null)
  const [showPlanModal, setShowPlanModal] = useState<Company | null>(null)
  const [newTrialDate, setNewTrialDate] = useState("")
  const [newPlanId, setNewPlanId] = useState("")
  const { ConfirmationDialog, confirm } = useConfirm()

  const load = async () => {
    setLoading(true)
    const [c, p] = await Promise.all([
      fetchCollection<Company>("companies"),
      fetchCollection<SaaSPlan>("saas_plans"),
    ])
    c.sort((a, b) => b.created_at.localeCompare(a.created_at))
    setCompanies(c)
    setPlans(p)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleBlock = async (company: Company) => {
    const confirmed = await confirm({
      title: "Bloquear empresa",
      message: `Tem certeza que deseja bloquear a empresa "${company.name}"?\n\nEla perderá acesso ao sistema.`,
      confirmText: "Bloquear",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    await updateDocument("companies", company.id, { is_blocked: true, subscription_status: "blocked" })
    toast.success("Empresa bloqueada")
    load()
  }

  const handleUnblock = async (company: Company) => {
    await updateDocument("companies", company.id, { is_blocked: false, subscription_status: "active" })
    toast.success("Empresa desbloqueada")
    load()
  }

  const handleMarkPaid = async (company: Company) => {
    const confirmed = await confirm({
      title: "Confirmar Pagamento",
      message: `Confirmar pagamento da empresa "${company.name}"?\n\nO vencimento será atualizado para o próximo mês.`,
      confirmText: "Confirmar pagamento",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
    await updateDocument("companies", company.id, {
      subscription_status: "active",
      is_blocked: false,
      payment_due_date: nextMonth.toISOString().split("T")[0],
    })
    toast.success("Pagamento confirmado!")
    load()
  }

  const handleExtendTrial = async () => {
    if (!showTrialModal || !newTrialDate) return
    await updateDocument("companies", showTrialModal.id, {
      trial_ends_at: newTrialDate + "T23:59:59.000Z",
      subscription_status: "trial",
      is_blocked: false,
    })
    toast.success("Trial estendido!")
    setShowTrialModal(null)
    setNewTrialDate("")
    load()
  }

  const handleChangePlan = async () => {
    if (!showPlanModal || !newPlanId) return
    await updateDocument("companies", showPlanModal.id, { plan_id: newPlanId })
    toast.success("Plano alterado!")
    setShowPlanModal(null)
    setNewPlanId("")
    load()
  }

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: "Excluir empresa",
      message: `Tem certeza que deseja excluir a empresa "${name}" permanentemente?\n\nEsta ação NÃO pode ser desfeita e todos os dados serão perdidos.`,
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    await deleteDocument("companies", id)
    toast.success("Empresa excluída")
    load()
  }

  const filtered = companies.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.owner_email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "all" ||
      (statusFilter === "blocked" ? c.is_blocked : c.subscription_status === statusFilter)
    return matchSearch && matchStatus
  })

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'rgba(255,255,255,0.3)' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.5rem' }} placeholder="Buscar empresa ou email..." />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ ...inputStyle, width: 'auto', minWidth: '130px', cursor: 'pointer' }}>
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="trial">Trial</option>
          <option value="pending">Pendentes</option>
          <option value="overdue">Atrasados</option>
          <option value="blocked">Bloqueados</option>
        </select>
      </div>

      {/* Companies Table */}
      <div style={{ background: '#1a1035', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', fontFamily: "var(--font-heading)" }}>Empresas ({filtered.length})</h3>
        </div>
        {filtered.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            {filtered.map(company => {
              const plan = plans.find(p => p.id === company.plan_id)
              const sc = statusConfig[company.is_blocked ? 'blocked' : company.subscription_status] || statusConfig.pending
              const trialExpired = company.subscription_status === 'trial' && company.trial_ends_at && new Date(company.trial_ends_at) < new Date()
              return (
                <div key={company.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1.5rem',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: trialExpired ? 'rgba(239,68,68,0.05)' : 'transparent',
                }}>
                  {/* Avatar */}
                  <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: company.is_blocked ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: company.is_blocked ? '#ef4444' : '#f59e0b', fontSize: '1rem', fontWeight: 700, flexShrink: 0 }}>
                    {company.name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <p style={{ fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>{company.name}</p>
                    <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)' }}>{company.owner_name} • {company.owner_email}</p>
                  </div>

                  {/* Plan */}
                  <div style={{ minWidth: '80px', textAlign: 'center' }} className="hidden sm:block">
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '0.375rem', background: 'rgba(124,92,252,0.1)', color: '#a78bfa' }}>
                      {plan?.name || "—"}
                    </span>
                  </div>

                  {/* Status */}
                  <div style={{ minWidth: '75px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '0.125rem 0.5rem', borderRadius: '999px', background: sc.bg, color: sc.color }}>
                      {trialExpired ? 'Trial Expirado' : sc.label}
                    </span>
                  </div>

                  {/* Trial/Due Date */}
                  <div style={{ minWidth: '80px', textAlign: 'center' }} className="hidden md:block">
                    {company.trial_ends_at && (
                      <p style={{ fontSize: '0.6875rem', color: trialExpired ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>
                        Trial: {company.trial_ends_at.split("T")[0].split("-").reverse().join("/")}
                      </p>
                    )}
                    {company.payment_due_date && (
                      <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)' }}>
                        Vcto: {company.payment_due_date.split("-").reverse().join("/")}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    <button onClick={() => setShowDetail(company)} title="Detalhes"
                      style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>
                      <Eye style={{ width: '0.875rem', height: '0.875rem' }} />
                    </button>
                    <button onClick={() => handleMarkPaid(company)} title="Marcar pago"
                      style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: 'rgba(34,201,151,0.1)', cursor: 'pointer', color: '#22c997' }}>
                      <CheckCircle style={{ width: '0.875rem', height: '0.875rem' }} />
                    </button>
                    <button onClick={() => { setShowTrialModal(company); setNewTrialDate("") }} title="Estender trial"
                      style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: 'rgba(91,141,239,0.1)', cursor: 'pointer', color: '#5b8def' }}>
                      <Calendar style={{ width: '0.875rem', height: '0.875rem' }} />
                    </button>
                    <button onClick={() => { setShowPlanModal(company); setNewPlanId("") }} title="Alterar plano"
                      style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: 'rgba(124,92,252,0.1)', cursor: 'pointer', color: '#a78bfa' }}>
                      <CreditCard style={{ width: '0.875rem', height: '0.875rem' }} />
                    </button>
                    {company.is_blocked ? (
                      <button onClick={() => handleUnblock(company)} title="Desbloquear"
                        style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: 'rgba(34,201,151,0.1)', cursor: 'pointer', color: '#22c997' }}>
                        <Unlock style={{ width: '0.875rem', height: '0.875rem' }} />
                      </button>
                    ) : (
                      <button onClick={() => handleBlock(company)} title="Bloquear"
                        style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', color: '#ef4444' }}>
                        <Ban style={{ width: '0.875rem', height: '0.875rem' }} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(company.id, company.name)} title="Excluir"
                      style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: 'rgba(239,68,68,0.05)', cursor: 'pointer', color: '#f87171' }}>
                      <Trash2 style={{ width: '0.875rem', height: '0.875rem' }} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <Building2 style={{ width: '2rem', height: '2rem', color: 'rgba(255,255,255,0.2)', margin: '0 auto 0.75rem' }} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Nenhuma empresa encontrada</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={() => setShowDetail(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#1a1035', borderRadius: '1rem', width: '100%', maxWidth: '28rem', padding: '2rem', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', fontFamily: "var(--font-heading)" }}>{showDetail.name}</h3>
              <button onClick={() => setShowDetail(null)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                ['Proprietário', showDetail.owner_name],
                ['Email', showDetail.owner_email],
                ['WhatsApp', showDetail.whatsapp || '—'],
                ['CNPJ/CPF', showDetail.document || '—'],
                ['Endereço', showDetail.address || '—'],
                ['Slug', showDetail.slug],
                ['Plano', plans.find(p => p.id === showDetail.plan_id)?.name || '—'],
                ['Status', statusConfig[showDetail.is_blocked ? 'blocked' : showDetail.subscription_status]?.label || showDetail.subscription_status],
                ['Trial até', showDetail.trial_ends_at?.split("T")[0]?.split("-").reverse().join("/") || '—'],
                ['Vencimento', showDetail.payment_due_date?.split("-").reverse().join("/") || '—'],
                ['Criado em', new Date(showDetail.created_at).toLocaleDateString('pt-BR')],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#fff' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Extend Trial Modal */}
      {showTrialModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={() => setShowTrialModal(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#1a1035', borderRadius: '1rem', width: '100%', maxWidth: '24rem', padding: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#fff', marginBottom: '1rem', fontFamily: "var(--font-heading)" }}>Estender Trial - {showTrialModal.name}</h3>
            <div>
              <label style={labelStyle}>Nova data de expiração</label>
              <input type="date" value={newTrialDate} onChange={e => setNewTrialDate(e.target.value)} style={inputStyle} />
            </div>
            <button onClick={handleExtendTrial}
              style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #5b8def, #93b5f5)' }}>
              Estender Trial
            </button>
          </div>
        </>
      )}

      {/* Change Plan Modal */}
      {showPlanModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={() => setShowPlanModal(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#1a1035', borderRadius: '1rem', width: '100%', maxWidth: '24rem', padding: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#fff', marginBottom: '1rem', fontFamily: "var(--font-heading)" }}>Alterar Plano - {showPlanModal.name}</h3>
            <div>
              <label style={labelStyle}>Novo Plano</label>
              <select value={newPlanId} onChange={e => setNewPlanId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">Selecione...</option>
                {plans.filter(p => p.is_active).map(p => (
                  <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}/mês</option>
                ))}
              </select>
            </div>
            <button onClick={handleChangePlan}
              style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)' }}>
              Alterar Plano
            </button>
          </div>
        </>
      )}
      <ConfirmationDialog />
    </div>
  )
}
