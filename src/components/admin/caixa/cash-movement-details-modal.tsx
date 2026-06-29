"use client"

import { useState, useEffect } from "react"
import { formatCurrency, formatPhone } from "@/lib/utils"
import { X, DollarSign, CreditCard, Smartphone, Banknote, ArrowRightLeft, Gift, HelpCircle, User, Scissors, Calendar, Clock, CheckCircle, Save, Undo2 } from "lucide-react"
import { getDocument, updateDocument, fetchCollectionWhere } from "@/lib/firebase/client-utils"
import type { FinancialEntry, Appointment, Client, Commission } from "@/lib/types/database"
import { toast } from "sonner"
import { usePermission } from "@/lib/rbac/usePermission"
import { useTenant } from "@/lib/auth/tenant-context"

interface Props {
  entry: FinancialEntry
  onClose: () => void
  onUpdated: () => void
}

const paymentMethods = [
  { id: "cash", label: "Dinheiro", icon: Banknote },
  { id: "pix", label: "PIX", icon: Smartphone },
  { id: "credit_card", label: "Crédito", icon: CreditCard },
  { id: "debit_card", label: "Débito", icon: CreditCard },
  { id: "transfer", label: "Transferência", icon: ArrowRightLeft },
  { id: "courtesy", label: "Cortesia", icon: Gift },
  { id: "client_credit", label: "Crédito do Cliente", icon: CreditCard },
  { id: "other", label: "Outro", icon: HelpCircle },
]

export function CashMovementDetailsModal({ entry, onClose, onUpdated }: Props) {
  const { saasUser } = useTenant()
  const { can } = usePermission()
  
  const [loading, setLoading] = useState(true)
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [client, setClient] = useState<Client | null>(null)
  
  const [isEditing, setIsEditing] = useState(false)
  const [method, setMethod] = useState<import('@/lib/types/database').PaymentMethod | string>(entry.payment_method || "cash")
  const [amount, setAmount] = useState(entry.paid_amount?.toString() || entry.amount?.toString() || "0")
  const [notes, setNotes] = useState(entry.notes || "")
  const [submitting, setSubmitting] = useState(false)

  const canEdit = can("cash.payment.edit")
  const canRefund = can("cash.payment.refund")

  useEffect(() => {
    const loadData = async () => {
      if (entry.reference_type === "appointment" && entry.reference_id) {
        try {
          const apt = await getDocument<Appointment>("appointments", entry.reference_id)
          setAppointment(apt)
          
          if (apt?.client_id) {
            const cl = await getDocument<Client>("clients", apt.client_id)
            setClient(cl)
          }

          const comms = await fetchCollectionWhere<Commission>("commissions", "payment_id", "==", entry.id)
          setCommissions(comms)
        } catch(e) {
          console.error("Erro ao carregar detalhes", e)
        }
      }
      setLoading(false)
    }
    loadData()
  }, [entry])

  const handleSave = async () => {
    setSubmitting(true)
    try {
      const newAmount = Number(amount)
      const isMethodChanged = method !== entry.payment_method
      const isAmountChanged = newAmount !== entry.paid_amount
      
      if (isAmountChanged && entry.reference_type === "appointment" && client) {
        // We'd need to properly handle recalculating client debts/credits,
        // For now, only simple saves or note/method changes
        // A full complex edit is beyond simple update.
      }

      await updateDocument("financial_entries", entry.id, {
        payment_method: method,
        paid_amount: newAmount,
        notes: notes || null,
        // basic difference logic
        remaining_amount: Math.max(0, entry.amount - newAmount),
      })
      
      toast.success("Pagamento atualizado com sucesso!")
      setIsEditing(false)
      onUpdated()
    } catch(err) {
      toast.error("Erro ao atualizar pagamento")
    }
    setSubmitting(false)
  }

  const handleRefund = async () => {
    if (!window.confirm("Tem certeza que deseja estornar este pagamento? O valor será removido do caixa, comissões pendentes serão canceladas e o agendamento voltará para pagamento pendente.")) return
    
    setSubmitting(true)
    try {
      // 1. Mark financial entry as refunded
      await updateDocument("financial_entries", entry.id, {
        is_refunded: true,
        refund_notes: `Estornado por ${saasUser?.name || 'Admin'} em ${new Date().toLocaleString()}`,
        status: "refunded",
        payment_status: "refunded"
      })

      // 2. Revert appointment status if it exists
      if (appointment) {
        await updateDocument("appointments", appointment.id, {
          payment_status: "pending",
          status: "completed" // Usually if they revert payment, service was done but pending pay
        })
      }

      // 3. Cancel pending commissions
      for (const comm of commissions) {
        if (comm.status === "pending") {
          await updateDocument("commissions", comm.id, {
            status: "cancelled",
            commission_adjustment_reason: "Pagamento estornado"
          })
        }
      }

      // 4. Update Client balances (simplified logic: just mark it)
      toast.success("Pagamento estornado com sucesso!")
      onUpdated()
      onClose()
    } catch(err) {
      toast.error("Erro ao estornar pagamento")
    }
    setSubmitting(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
    border: '2px solid #e8ecf4', fontSize: '0.875rem', color: '#1e1e2d', outline: 'none', background: '#fafbfc',
  }

  const getMethodLabel = (id: string) => paymentMethods.find(m => m.id === id)?.label || id

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '600px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f3f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: '#f0ecff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Banknote style={{ width: '1.125rem', height: '1.125rem', color: '#7c5cfc' }} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 700, color: '#1e1e2d' }}>Detalhes do Fechamento</h3>
              <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>
                {entry.is_refunded ? (
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>ESTORNADO</span>
                ) : (
                  `Registrado em ${(entry.date || "").split("-").reverse().join("/")}`
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: '#f1f3f9', cursor: 'pointer', display: 'flex' }}>
            <X style={{ width: '16px', height: '16px', color: '#8b8fa7' }} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center' }}>Carregando...</div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* General Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.6875rem', color: '#8b8fa7', fontWeight: 700, marginBottom: '0.25rem' }}>CLIENTE</span>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e1e2d' }}>{entry.client_name || "Avulso"}</p>
                {entry.client_phone && <p style={{ fontSize: '0.75rem', color: '#64748b' }}>{formatPhone(entry.client_phone)}</p>}
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.6875rem', color: '#8b8fa7', fontWeight: 700, marginBottom: '0.25rem' }}>SERVIÇO</span>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e1e2d' }}>{entry.service_name}</p>
                {appointment && <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Horário: {appointment.appointment_time}</p>}
              </div>
            </div>

            {/* Financial Block */}
            <div style={{ background: '#fafbfc', borderRadius: '0.875rem', padding: '1rem', border: '1px solid #e8ecf4' }}>
              <span style={{ display: 'block', fontSize: '0.6875rem', color: '#8b8fa7', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase' }}>Dados Financeiros</span>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Valor Total do Serviço</span>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1e1e2d' }}>{formatCurrency(entry.amount)}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Desconto Aplicado</span>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: entry.discount ? '#059669' : '#1e1e2d' }}>{formatCurrency(entry.discount || 0)}</p>
                </div>
              </div>

              {!isEditing ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '0.75rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Valor Pago (Caixa)</span>
                    <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7c5cfc' }}>{formatCurrency(entry.paid_amount || entry.amount)}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Forma de Pagamento</span>
                    <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1e1e2d', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      {getMethodLabel(entry.payment_method)}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #c4b5fd' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Valor Pago</label>
                    <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Forma de Pagamento</label>
                    <select value={method} onChange={e => setMethod(e.target.value)} style={inputStyle}>
                      {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.label}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Observações:</span>
                {!isEditing ? (
                  <p style={{ fontSize: '0.875rem', color: '#1e1e2d', background: '#fff', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', minHeight: '40px' }}>
                    {entry.notes || "Nenhuma observação"}
                  </p>
                ) : (
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: '60px', marginTop: '0.25rem' }} />
                )}
              </div>
            </div>

            {/* Caixa / Operador Info */}
            {(entry.cash_register_id || entry.cash_operator_name || entry.payment_group_id) && (
              <div style={{ background: '#f0f4ff', borderRadius: '0.875rem', padding: '1rem', border: '1px solid #c7d2fe' }}>
                <span style={{ display: 'block', fontSize: '0.6875rem', color: '#4338ca', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase' }}>Dados do Caixa</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {entry.cash_operator_name && (
                    <div>
                      <span style={{ fontSize: '0.6875rem', color: '#6366f1' }}>Operador do Caixa</span>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b' }}>{entry.cash_operator_name}</p>
                    </div>
                  )}
                  {entry.cash_register_id && (
                    <div>
                      <span style={{ fontSize: '0.6875rem', color: '#6366f1' }}>Caixa ID</span>
                      <p style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#475569', fontFamily: 'monospace' }}>{entry.cash_register_id.slice(0, 12)}...</p>
                    </div>
                  )}
                  {entry.payment_group_id && (
                    <div>
                      <span style={{ fontSize: '0.6875rem', color: '#6366f1' }}>Grupo de Pagamento</span>
                      <p style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#475569', fontFamily: 'monospace' }}>{entry.payment_group_id.slice(0, 12)}...</p>
                    </div>
                  )}
                  {entry.employee_name && (
                    <div>
                      <span style={{ fontSize: '0.6875rem', color: '#6366f1' }}>Profissional</span>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b' }}>{entry.employee_name}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Commissions */}
            {commissions.length > 0 && (
              <div style={{ background: '#fdf4ff', borderRadius: '0.875rem', padding: '1rem', border: '1px solid #fbcfe8' }}>
                <span style={{ display: 'block', fontSize: '0.6875rem', color: '#be185d', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase' }}>Comissões Geradas</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {commissions.map(comm => (
                    <div key={comm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #fce7f3' }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>{comm.professional_name_snapshot}</span>
                        <span style={{ fontSize: '0.625rem', color: '#64748b' }}>Base: {formatCurrency(comm.paid_amount)} ({comm.commission_percentage}%)</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 800, color: '#db2777' }}>{formatCurrency(comm.commission_amount)}</span>
                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: comm.status === "paid" ? '#059669' : (comm.status === "cancelled" ? '#ef4444' : '#d97706') }}>
                          {comm.status === "paid" ? "PAGA" : (comm.status === "cancelled" ? "CANCELADA" : "PENDENTE")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {entry.is_refunded && entry.refund_notes && (
               <div style={{ background: '#fef2f2', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #fecaca' }}>
                 <p style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 700 }}>Motivo / Log Estorno:</p>
                 <p style={{ fontSize: '0.875rem', color: '#b91c1c' }}>{entry.refund_notes}</p>
               </div>
            )}

          </div>
        )}

        {/* Footer Actions */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f3f9', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexShrink: 0 }}>
          {!isEditing ? (
            <>
              {canRefund && !entry.is_refunded ? (
                <button onClick={handleRefund} disabled={submitting} style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: '#fef2f2', color: '#ef4444', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Undo2 style={{ width: '16px', height: '16px' }} /> Estornar
                </button>
              ) : <div />}
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={onClose} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', border: '2px solid #e8ecf4', background: '#fff', color: '#555', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}>
                  Fechar
                </button>
                {canEdit && !entry.is_refunded && (
                  <button onClick={() => setIsEditing(true)} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', border: 'none', background: '#1e1e2d', color: '#fff', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                    Editar Valores
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditing(false)} disabled={submitting} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', border: '2px solid #e8ecf4', background: '#fff', color: '#555', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={submitting} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Save style={{ width: '16px', height: '16px' }} /> Salvar
              </button>
            </>
          )}
        </div>
        
      </div>
    </div>
  )
}
