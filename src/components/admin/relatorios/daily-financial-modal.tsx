"use client"

import { X, TrendingUp, TrendingDown, DollarSign, Receipt, Printer } from "lucide-react"
import { formatCurrency, toLocalDateStr } from "@/lib/utils"
import type { FinancialEntry, CashRegister } from "@/lib/types/database"
import { useEffect } from "react"

interface DailyFinancialModalProps {
  date: string
  entries: FinancialEntry[]
  registers: CashRegister[]
  onClose: () => void
}

export function DailyFinancialModal({ date, entries, registers, onClose }: DailyFinancialModalProps) {
  
  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const incomes = entries.filter(e => e.type === "income" && !e.is_refunded)
  const expenses = entries.filter(e => e.type === "expense" && !e.is_refunded)
  const refunds = entries.filter(e => e.is_refunded)

  const totalIncome = incomes.reduce((s, e) => s + (e.paid_amount || e.amount), 0)
  const totalExpense = expenses.reduce((s, e) => s + (e.paid_amount || e.amount), 0)
  const balance = totalIncome - totalExpense

  const dateFormatted = date.split('-').reverse().join('/')

  const getMethodLabel = (id: string) => {
    const map: Record<string, string> = { cash: "Dinheiro", pix: "Pix", credit_card: "Crédito", debit_card: "Débito", transfer: "Transf.", courtesy: "Cortesia", client_credit: "Crédito Cli.", other: "Outro" }
    return map[id] || id
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      {/* CSS to control print layout: hides everything except this modal content during print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #daily-financial-modal-content, #daily-financial-modal-content * {
            visibility: visible;
          }
          #daily-financial-modal-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={onClose} />
      <div 
        style={{ 
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', 
          zIndex: 10000, background: '#fff', borderRadius: '1.25rem', width: '90%', maxWidth: '800px', 
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' 
        }}
      >
        <div id="daily-financial-modal-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          
          {/* Header */}
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>
                Relatório Diário - {dateFormatted}
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                Resumo financeiro, caixa e comissões do dia.
              </p>
            </div>
            <div className="no-print" style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}>
                <Printer style={{ width: '16px', height: '16px' }} /> Imprimir
              </button>
              <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: '#f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: '1.25rem', height: '1.25rem', color: '#64748b' }} />
              </button>
            </div>
          </div>

          <div style={{ overflowY: 'auto', padding: '1.5rem' }}>
            
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: '#f0fdf4', borderRadius: '1rem', padding: '1rem', border: '1px solid #bbf7d0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <TrendingUp style={{ width: '1rem', height: '1rem', color: '#16a34a' }} />
                  <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 700 }}>Entradas Totais</span>
                </div>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>{formatCurrency(totalIncome)}</p>
              </div>
              <div style={{ background: '#fef2f2', borderRadius: '1rem', padding: '1rem', border: '1px solid #fecaca' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <TrendingDown style={{ width: '1rem', height: '1rem', color: '#dc2626' }} />
                  <span style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 700 }}>Saídas Totais</span>
                </div>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>{formatCurrency(totalExpense)}</p>
              </div>
              <div style={{ background: balance >= 0 ? '#eff6ff' : '#fef2f2', borderRadius: '1rem', padding: '1rem', border: `1px solid ${balance >= 0 ? '#bfdbfe' : '#fecaca'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <DollarSign style={{ width: '1rem', height: '1rem', color: balance >= 0 ? '#2563eb' : '#dc2626' }} />
                  <span style={{ fontSize: '0.75rem', color: balance >= 0 ? '#1d4ed8' : '#b91c1c', fontWeight: 700 }}>Saldo do Dia</span>
                </div>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: balance >= 0 ? '#2563eb' : '#ef4444' }}>{formatCurrency(balance)}</p>
              </div>
            </div>

            {/* Cash Registers Section */}
            {registers.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e1e2d', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  Fechamentos de Caixa
                </h3>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {registers.map(reg => (
                    <div key={reg.id} style={{ background: '#fafbfc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Operador</p>
                        <p style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 600 }}>{reg.opened_by_name || 'Sistema'}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Abertura</p>
                        <p style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 600 }}>{formatCurrency(reg.opening_amount)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Fechamento</p>
                        <p style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 600 }}>{formatCurrency(reg.closing_amount || 0)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Diferença</p>
                        <p style={{ fontSize: '0.875rem', color: (reg.difference || 0) < 0 ? '#ef4444' : '#059669', fontWeight: 800 }}>
                          {formatCurrency(reg.difference || 0)}
                        </p>
                      </div>
                      <div style={{ flex: 1, textAlign: 'right' }}>
                        <span style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem', borderRadius: '1rem', background: reg.status === 'closed' ? '#f1f5f9' : '#ecfdf5', color: reg.status === 'closed' ? '#475569' : '#059669', fontWeight: 700 }}>
                          {reg.status === 'closed' ? 'FECHADO' : 'ABERTO'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Entries List */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e1e2d', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                Movimentações Detalhadas
              </h3>
              
              {entries.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>Nenhuma movimentação encontrada neste dia.</p>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.75rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Hora</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Descrição / Cliente</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Categoria</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Forma</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(entry => {
                        const isRef = entry.is_refunded
                        const timeStr = entry.created_at && !isNaN(new Date(entry.created_at).getTime()) 
                          ? new Date(entry.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
                          : "--:--"
                        
                        const val = entry.paid_amount || entry.amount
                        const isExpense = entry.type === "expense"

                        return (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9', background: isRef ? '#fef2f2' : '#fff', opacity: isRef ? 0.7 : 1 }}>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>
                              {timeStr}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <p style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 700 }}>
                                {entry.description || entry.service_name || "Lançamento"}
                              </p>
                              {entry.client_name && (
                                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Cli: {entry.client_name}</p>
                              )}
                              {entry.employee_name && (
                                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Prof: {entry.employee_name}</p>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: '#475569' }}>
                              <span style={{ padding: '0.25rem 0.5rem', background: '#f1f5f9', borderRadius: '0.25rem', fontWeight: 600, fontSize: '0.6875rem' }}>
                                {entry.category === 'commission' ? 'Comissão' : 
                                 entry.category === 'sangria' ? 'Sangria' : 
                                 entry.category === 'service' ? 'Serviço' :
                                 entry.category === 'product' ? 'Produto' : 'Outro'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: '#1e293b', fontWeight: 600 }}>
                              {getMethodLabel(entry.payment_method)}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: isExpense ? '#ef4444' : '#059669', fontWeight: 800, textAlign: 'right' }}>
                              {isExpense ? "-" : ""}{formatCurrency(val)}
                              {isRef && <span style={{ display: 'block', fontSize: '0.625rem', color: '#ef4444', marginTop: '0.125rem' }}>(ESTORNADO)</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
