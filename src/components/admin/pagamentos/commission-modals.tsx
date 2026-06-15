"use client"

import { useState, useEffect, useMemo } from "react"
import { X, CheckCircle, Loader2, Banknote, Calendar, CreditCard, DollarSign, Wallet, AlertTriangle } from "lucide-react"
import type { Employee, Commission, CashRegister } from "@/lib/types/database"
import { formatCurrency, toLocalDateStr } from "@/lib/utils"
import { fetchCollectionWhere, updateDocument, createDocument } from "@/lib/firebase/client-utils"
import { toast } from "sonner"

type ModalType = "services" | "revenue" | "payment" | null

interface CommissionModalsProps {
  activeModal: ModalType
  employee: Employee | null
  globalCommissions: Commission[] // All commissions for this employee to allow local filtering
  globalPeriodStart: string
  globalPeriodEnd: string
  onClose: () => void
  onRefresh: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
  border: '2px solid #e8ecf4', fontSize: '0.8125rem', color: '#1e1e2d', outline: 'none', background: '#fff',
}

export function CommissionModals({ activeModal, employee, globalCommissions, globalPeriodStart, globalPeriodEnd, onClose, onRefresh }: CommissionModalsProps) {
  if (!activeModal || !employee) return null

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfc', borderRadius: '1rem 1rem 0 0' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>
              {activeModal === "services" && `Serviços realizados — ${employee.name}`}
              {activeModal === "revenue" && `Receita gerada — ${employee.name}`}
              {activeModal === "payment" && `Pagamento de comissão — ${employee.name}`}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.25rem' }}>
              Comissão base cadastrada: {employee.commission_percent || 0}%
            </p>
          </div>
          <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <X style={{ width: '1.25rem', height: '1.25rem', color: '#9ca3af' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {activeModal === "services" && <ServicesModalContent commissions={globalCommissions} start={globalPeriodStart} end={globalPeriodEnd} onRefresh={onRefresh} employeeName={employee.name} />}
          {activeModal === "revenue" && <RevenueModalContent commissions={globalCommissions} defaultStart={globalPeriodStart} defaultEnd={globalPeriodEnd} />}
          {activeModal === "payment" && <PaymentModalContent employee={employee} commissions={globalCommissions} start={globalPeriodStart} end={globalPeriodEnd} onRefresh={onRefresh} />}
        </div>
      </div>
    </>
  )
}

// ============================================================================
// 1. SERVICES MODAL CONTENT
// ============================================================================
function ServicesModalContent({ commissions, start, end, onRefresh, employeeName }: { commissions: Commission[], start: string, end: string, onRefresh: () => void, employeeName: string }) {
  const [editingCommission, setEditingCommission] = useState<Commission | null>(null)

  // Filter commissions for the global period
  const periodCommissions = useMemo(() => {
    return commissions.filter(c => {
      if (start && c.performed_at < start) return false
      if (end && c.performed_at > end) return false
      return true
    }).sort((a, b) => b.performed_at.localeCompare(a.performed_at))
  }, [commissions, start, end])

  if (periodCommissions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p style={{ color: '#64748b' }}>Nenhum serviço registrado neste período.</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Data</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cliente</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Serviço</th>
            <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Valor Serviço</th>
            <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Valor Recebido</th>
            <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>%</th>
            <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Comissão (R$)</th>
          </tr>
        </thead>
        <tbody>
          {periodCommissions.map(c => (
            <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }} onClick={() => setEditingCommission(c)} onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <td style={{ padding: '0.75rem', fontSize: '0.8125rem', color: '#1e1e2d' }}>{c.performed_at.split('-').reverse().join('/')}</td>
              <td style={{ padding: '0.75rem', fontSize: '0.8125rem', color: '#1e1e2d', fontWeight: 600 }}>{c.client_name_snapshot || "-"}</td>
              <td style={{ padding: '0.75rem', fontSize: '0.8125rem', color: '#64748b' }}>{c.service_name_snapshot || "-"}</td>
              <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8125rem', color: '#64748b' }}>{formatCurrency(c.service_amount)}</td>
              <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8125rem', color: '#059669', fontWeight: 600 }}>{formatCurrency(c.paid_amount)}</td>
              <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8125rem', color: '#64748b' }}>{c.commission_percentage}%</td>
              <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8125rem', color: '#7c5cfc', fontWeight: 700 }} title={c.commission_adjusted_amount !== undefined ? `Calculado: ${formatCurrency(c.commission_calculated_amount ?? 0)}\nAjustado para: ${formatCurrency(c.commission_final_amount ?? 0)}` : ''}>
                {formatCurrency(c.commission_final_amount ?? c.commission_amount)}
                {c.commission_adjusted_amount !== undefined && (
                   <span style={{ display: 'block', fontSize: '0.625rem', color: '#d97706', fontWeight: 600 }}>Ajustado ✎</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {editingCommission && (
        <EditCommissionModal
          commission={editingCommission}
          employeeName={employeeName}
          onClose={() => setEditingCommission(null)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  )
}

function EditCommissionModal({ commission, employeeName, onClose, onRefresh }: { commission: Commission, employeeName: string, onClose: () => void, onRefresh: () => void }) {
  const isPaid = commission.status === "paid"
  const calculatedAmount = commission.commission_calculated_amount ?? commission.commission_amount
  
  const [adjustedAmount, setAdjustedAmount] = useState(
    commission.commission_adjusted_amount !== undefined ? String(commission.commission_adjusted_amount) : String(calculatedAmount)
  )
  const [reason, setReason] = useState(commission.commission_adjustment_reason || "")
  const [releaseDate, setReleaseDate] = useState(
    commission.commission_release_date || toLocalDateStr()
  )
  const [isSaving, setIsSaving] = useState(false)
  const [showConfirmOver, setShowConfirmOver] = useState(false)

  const handleSave = () => {
    if (isPaid) return
    const val = parseFloat(adjustedAmount)
    if (isNaN(val) || val < 0) return toast.error("Valor inválido")
    if (val > commission.paid_amount) {
      setShowConfirmOver(true)
    } else {
      doSave(val)
    }
  }

  const doSave = async (val: number) => {
    setIsSaving(true)
    setShowConfirmOver(false)
    try {
      await updateDocument("commissions", commission.id, {
        commission_calculated_amount: calculatedAmount,
        commission_adjusted_amount: val,
        commission_final_amount: val,
        commission_amount: val, // Keep backward compatibility for aggregations
        commission_adjustment_reason: reason,
        commission_adjusted_at: new Date().toISOString(),
        commission_release_date: releaseDate,
      })
      toast.success("Rateio ajustado com sucesso")
      onRefresh()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error("Erro ao salvar rateio")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10001 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 10002, background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: '500px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden'
      }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfc' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>
            Editar Rateio
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <X style={{ width: '1.25rem', height: '1.25rem', color: '#9ca3af' }} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isPaid && (
            <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#ef4444', fontSize: '0.8125rem', fontWeight: 600, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <AlertTriangle style={{ width: '1rem', height: '1rem' }} />
              Esta comissão já foi paga e não pode ser alterada.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8125rem' }}>
            <div><strong style={{ color: '#64748b' }}>Profissional:</strong> <span style={{ color: '#1e1e2d', fontWeight: 600 }}>{employeeName}</span></div>
            <div><strong style={{ color: '#64748b' }}>Cliente:</strong> <span style={{ color: '#1e1e2d', fontWeight: 600 }}>{commission.client_name_snapshot}</span></div>
            <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: '#64748b' }}>Serviço:</strong> <span style={{ color: '#1e1e2d', fontWeight: 600 }}>{commission.service_name_snapshot}</span></div>
            <div><strong style={{ color: '#64748b' }}>Preço original:</strong> <span style={{ color: '#1e1e2d', fontWeight: 600 }}>{formatCurrency(commission.service_amount)}</span></div>
            <div><strong style={{ color: '#64748b' }}>Valor pago:</strong> <span style={{ color: '#1e1e2d', fontWeight: 600 }}>{formatCurrency(commission.paid_amount)}</span></div>
            <div><strong style={{ color: '#64748b' }}>Data Original:</strong> <span style={{ color: '#1e1e2d', fontWeight: 600 }}>{commission.performed_at.split('-').reverse().join('/')}</span></div>
            <div><strong style={{ color: '#64748b' }}>Comissão base:</strong> <span style={{ color: '#1e1e2d', fontWeight: 600 }}>{commission.commission_percentage}%</span></div>
          </div>

          <div style={{ height: '1px', background: '#f1f5f9', margin: '0.5rem 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#64748b', textAlign: 'right' }}>Rateio Calculado:</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e1e2d' }}>{formatCurrency(calculatedAmount)}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d', textAlign: 'right' }}>Rateio a Pagar:</span>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>R$</span>
              <input type="number" step="0.01" min="0" value={adjustedAmount} onChange={e => setAdjustedAmount(e.target.value)} disabled={isPaid} style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', border: '2px solid #e8ecf4', fontSize: '0.8125rem', outline: 'none', background: '#fff', paddingLeft: '2rem', fontWeight: 700, color: '#7c5cfc' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d', textAlign: 'right' }}>Data da Liberação:</span>
            <input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} disabled={isPaid} style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', border: '2px solid #e8ecf4', fontSize: '0.8125rem', color: '#1e1e2d', outline: 'none', background: '#fff' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d', textAlign: 'right', marginTop: '0.5rem' }}>Observação:</span>
            <textarea value={reason} onChange={e => setReason(e.target.value)} disabled={isPaid} rows={2} style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', border: '2px solid #e8ecf4', fontSize: '0.8125rem', color: '#1e1e2d', outline: 'none', background: '#fff', resize: 'none' }} placeholder="Ex: Ajustado por causa de retrabalho" />
          </div>

          {showConfirmOver && (
            <div style={{ padding: '1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem' }}>
              <p style={{ fontSize: '0.8125rem', color: '#d97706', fontWeight: 600, marginBottom: '0.75rem' }}>Atenção: o rateio informado é maior que o valor recebido neste serviço. Deseja salvar mesmo assim?</p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowConfirmOver(false)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Não, revisar</button>
                <button onClick={() => doSave(parseFloat(adjustedAmount))} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: 'none', background: '#d97706', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Sim, salvar</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem' }}>
            <button onClick={onClose} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.625rem', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={isPaid || isSaving} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.625rem', border: 'none', background: (isPaid || isSaving) ? '#cbd5e1' : '#7c5cfc', color: '#fff', fontSize: '0.8125rem', fontWeight: 700, cursor: (isPaid || isSaving) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSaving ? 'Salvando...' : 'Salvar Rateio'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}

// ============================================================================
// 2. REVENUE MODAL CONTENT
// ============================================================================
function RevenueModalContent({ commissions, defaultStart, defaultEnd }: { commissions: Commission[], defaultStart: string, defaultEnd: string }) {
  const [localStart, setLocalStart] = useState(defaultStart)
  const [localEnd, setLocalEnd] = useState(defaultEnd)

  const stats = useMemo(() => {
    const periodComms = commissions.filter(c => {
      if (localStart && c.performed_at < localStart) return false
      if (localEnd && c.performed_at > localEnd) return false
      return true
    })

    const totalServices = periodComms.length
    const totalRevenue = periodComms.reduce((sum, c) => sum + c.paid_amount, 0)
    const commissionTotal = periodComms.reduce((sum, c) => sum + c.commission_amount, 0)
    const commissionPaid = periodComms.filter(c => c.status === "paid").reduce((sum, c) => sum + c.commission_amount, 0)
    const commissionPending = periodComms.filter(c => c.status === "pending").reduce((sum, c) => sum + c.commission_amount, 0)

    return { periodComms, totalServices, totalRevenue, commissionTotal, commissionPaid, commissionPending }
  }, [commissions, localStart, localEnd])

  const setPreset = (days: number, monthOffset = 0) => {
    const today = new Date()
    if (monthOffset !== 0) {
      today.setMonth(today.getMonth() + monthOffset)
      const start = toLocalDateStr(new Date(today.getFullYear(), today.getMonth(), 1))
      const end = toLocalDateStr(new Date(today.getFullYear(), today.getMonth() + 1, 0))
      setLocalStart(start)
      setLocalEnd(end)
      return
    }
    const start = new Date(today)
    start.setDate(today.getDate() - days)
    setLocalStart(toLocalDateStr(start))
    setLocalEnd(toLocalDateStr(today))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Filters */}
      <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => setPreset(0)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Hoje</button>
          <button onClick={() => setPreset(7)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Últimos 7 dias</button>
          <button onClick={() => setPreset(0, 0)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Este Mês</button>
          <button onClick={() => setPreset(0, -1)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Mês Passado</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: 'auto' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>De</label>
            <input type="date" value={localStart} onChange={e => setLocalStart(e.target.value)} style={{ ...inputStyle, padding: '0.375rem 0.75rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Até</label>
            <input type="date" value={localEnd} onChange={e => setLocalEnd(e.target.value)} style={{ ...inputStyle, padding: '0.375rem 0.75rem' }} />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
        <div style={{ padding: '1rem', background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <p style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Serviços Realizados</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d' }}>{stats.totalServices}</p>
        </div>
        <div style={{ padding: '1rem', background: '#ecfdf5', borderRadius: '0.75rem', border: '1px solid #a7f3d0', textAlign: 'center' }}>
          <p style={{ fontSize: '0.6875rem', color: '#047857', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Receita Recebida</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>{formatCurrency(stats.totalRevenue)}</p>
        </div>
        <div style={{ padding: '1rem', background: '#f0ecff', borderRadius: '0.75rem', border: '1px solid #e0d4ff', textAlign: 'center' }}>
          <p style={{ fontSize: '0.6875rem', color: '#7c5cfc', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Comissão Total</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7c5cfc' }}>{formatCurrency(stats.commissionTotal)}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ padding: '0.875rem', background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>Comissão Paga</span>
          <span style={{ fontSize: '1rem', color: '#059669', fontWeight: 800 }}>{formatCurrency(stats.commissionPaid)}</span>
        </div>
        <div style={{ padding: '0.875rem', background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>Comissão Pendente</span>
          <span style={{ fontSize: '1rem', color: '#d97706', fontWeight: 800 }}>{formatCurrency(stats.commissionPending)}</span>
        </div>
      </div>

    </div>
  )
}

// ============================================================================
// 3. PAYMENT MODAL CONTENT
// ============================================================================
function PaymentModalContent({ employee, commissions, start, end, onRefresh }: { employee: Employee, commissions: Commission[], start: string, end: string, onRefresh: () => void }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Register checking
  const [hasOpenRegister, setHasOpenRegister] = useState<boolean | null>(null)
  const [showOpenRegister, setShowOpenRegister] = useState(false)
  const [openingAmount, setOpeningAmount] = useState("")

  const periodCommissions = useMemo(() => {
    return commissions.filter(c => {
      if (start && c.performed_at < start) return false
      if (end && c.performed_at > end) return false
      return true
    }).sort((a, b) => b.performed_at.localeCompare(a.performed_at))
  }, [commissions, start, end])

  useEffect(() => {
    // Select all pending by default
    const pendings = periodCommissions.filter(c => c.status === "pending").map(c => c.id)
    setSelectedIds(new Set(pendings))
  }, [periodCommissions])

  useEffect(() => {
    // Check cash register
    const today = toLocalDateStr()
    fetchCollectionWhere<CashRegister>("cash_registers", "date", "==", today)
      .then(res => setHasOpenRegister(res.length > 0 && res[0].status === "open"))
  }, [])

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const selectedTotal = useMemo(() => {
    return periodCommissions.filter(c => selectedIds.has(c.id)).reduce((sum, c) => sum + c.commission_amount, 0)
  }, [periodCommissions, selectedIds])

  const handleOpenRegister = async () => {
    if (!openingAmount) return toast.error("Informe o valor de abertura")
    try {
      setIsProcessing(true)
      await createDocument("cash_registers", {
        date: toLocalDateStr(),
        opening_amount: parseFloat(openingAmount),
        closing_amount: null,
        expected_amount: null,
        difference: null,
        status: "open",
        notes: "Aberto para pagamento de comissão",
        opened_at: new Date().toISOString(),
        closed_at: null,
      })
      toast.success("Caixa aberto com sucesso!")
      setHasOpenRegister(true)
      setShowOpenRegister(false)
    } catch (err) {
      console.error(err)
      toast.error("Erro ao abrir caixa")
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePayCommissions = async () => {
    if (selectedIds.size === 0) return toast.error("Selecione as comissões")
    if (hasOpenRegister === false) return toast.error("Abra o caixa primeiro")

    setIsProcessing(true)
    try {
      const activeRegisters = await fetchCollectionWhere<CashRegister>("cash_registers", "date", "==", toLocalDateStr())
      const activeRegister = activeRegisters.find(r => r.status === "open")
      
      if (!activeRegister) {
        toast.error("Nenhum caixa aberto encontrado para registrar a saída")
        setIsProcessing(false)
        return
      }

      // 1. Register Expense in financial_entries
      const finEntry = await createDocument("financial_entries", {
        appointment_id: null,
        client_id: null,
        client_name: null,
        amount: selectedTotal,
        payment_method: "cash", // Assuming cash outflow from register, you could expand this later
        status: "paid",
        date: toLocalDateStr(),
        created_at: new Date().toISOString(),
        type: "expense",
        category: "commission",
        reference_type: "commission_payment",
        notes: `Pagamento de ${selectedIds.size} comissão(ões) para ${employee.name}`,
      })

      // 2. Register Output in cash_register via cash_entries (assuming we have that table, if not just tracking in financial_entries is enough based on how the system is currently built. Let's stick to standard.)
      
      // Wait, we need to update all selected commissions to 'paid'
      for (const id of selectedIds) {
        await updateDocument("commissions", id, {
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_id: finEntry.id, // Linking to the expense
          cash_register_id: activeRegister.id
        })
      }

      toast.success("Comissões pagas com sucesso!")
      onRefresh() // Will reload commissions globally and this component will update
    } catch (err) {
      console.error(err)
      toast.error("Erro ao realizar pagamento")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      
      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.75rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <tr>
              <th style={{ padding: '0.75rem', width: '40px', textAlign: 'center' }}></th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Data</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Serviço / Cliente</th>
              <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Valor Recebido</th>
              <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Comissão</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {periodCommissions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Nenhuma comissão neste período.</td>
              </tr>
            ) : periodCommissions.map(c => {
              const isPaid = c.status === "paid"
              const isSelected = selectedIds.has(c.id)
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', background: isSelected ? '#f5f3ff' : '#fff', cursor: isPaid ? 'default' : 'pointer', opacity: isPaid ? 0.7 : 1 }} onClick={() => !isPaid && toggleSelect(c.id)}>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <input type="checkbox" checked={isSelected} readOnly disabled={isPaid} style={{ cursor: isPaid ? 'default' : 'pointer' }} />
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.8125rem', color: '#64748b' }}>{c.performed_at.split('-').reverse().join('/')}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <p style={{ fontSize: '0.8125rem', color: '#1e1e2d', fontWeight: 600 }}>{c.service_name_snapshot}</p>
                    <p style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>{c.client_name_snapshot}</p>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8125rem', color: '#059669', fontWeight: 600 }}>{formatCurrency(c.paid_amount)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8125rem', color: '#7c5cfc', fontWeight: 700 }}>{formatCurrency(c.commission_amount)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    {isPaid ? 
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.5rem', borderRadius: '999px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>Pago</span> : 
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.5rem', borderRadius: '999px', background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>Pendente</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Actions & Cash Register check */}
      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{selectedIds.size} selecionadas</p>
          <p style={{ fontSize: '1.25rem', color: '#1e1e2d', fontWeight: 800 }}>Total a Pagar: <span style={{ color: '#7c5cfc' }}>{formatCurrency(selectedTotal)}</span></p>
        </div>

        {hasOpenRegister === false ? (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
             {showOpenRegister ? (
               <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="number" step="0.01" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} style={{ ...inputStyle, width: '120px', padding: '0.5rem' }} placeholder="R$ 0,00" />
                  <button onClick={() => setShowOpenRegister(false)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={handleOpenRegister} disabled={isProcessing} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', background: '#10b981', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Confirmar</button>
               </div>
             ) : (
               <>
                 <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Banknote style={{ width: '14px', height: '14px' }} /> Caixa Fechado</span>
                 <button onClick={() => setShowOpenRegister(true)} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.625rem', border: 'none', background: '#1e1e2d', color: '#fff', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>Abrir Caixa para Pagar</button>
               </>
             )}
           </div>
        ) : (
          <button 
            onClick={handlePayCommissions} 
            disabled={selectedIds.size === 0 || isProcessing}
            style={{ 
              padding: '0.875rem 1.5rem', borderRadius: '0.75rem', border: 'none', 
              background: selectedIds.size > 0 ? 'linear-gradient(135deg, #10b981, #34d399)' : '#cbd5e1', 
              color: '#fff', fontSize: '0.875rem', fontWeight: 700, cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              boxShadow: selectedIds.size > 0 ? '0 4px 14px rgba(16,185,129,0.3)' : 'none'
            }}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            Pagar Selecionadas
          </button>
        )}
      </div>

    </div>
  )
}
