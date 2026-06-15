"use client"

import { useEffect, useState } from "react"
import { fetchCollectionWhere, fetchCollectionWithQueries, createDocument, updateDocument, fetchCollection } from "@/lib/firebase/client-utils"
import type { CashRegister, FinancialEntry, Employee } from "@/lib/types/database"
import { formatCurrency, toLocalDateStr } from "@/lib/utils"
import { Loader2, Landmark, DollarSign, Clock, Lock, Unlock, AlertTriangle, CheckCircle, X, Filter, Search, Receipt, Calendar } from "lucide-react"
import { toast } from "sonner"
import { usePermission } from "@/lib/rbac/usePermission"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useTenant } from "@/lib/auth/tenant-context"
import { CashMovementDetailsModal } from "@/components/admin/caixa/cash-movement-details-modal"
import { ExportButtons } from "@/components/ui/export-buttons"

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
  border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d',
  fontSize: '0.875rem', fontWeight: 500, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem'
}

export default function CaixaPage() {
  const { saasUser } = useTenant()
  const { can } = usePermission()
  
  const [loading, setLoading] = useState(true)
  const [searchDate, setSearchDate] = useState(toLocalDateStr())
  const [searchProf, setSearchProf] = useState("all")
  
  const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null)
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<FinancialEntry | null>(null)
  
  const [openingAmount, setOpeningAmount] = useState("")
  const [closingAmount, setClosingAmount] = useState("")
  const [closingNotes, setClosingNotes] = useState("")

  const loadData = async (dateStr: string) => {
    setLoading(true)
    try {
      const qRegisters = [
        { field: "company_id", operator: "==" as const, value: saasUser?.id },
        { field: "date", operator: "==" as const, value: dateStr }
      ]
      const qEntries = [
        { field: "company_id", operator: "==" as const, value: saasUser?.id },
        { field: "date", operator: "==" as const, value: dateStr }
      ]
      const [registers, entries, emps] = await Promise.all([
        fetchCollectionWithQueries<CashRegister>("cash_registers", qRegisters),
        fetchCollectionWithQueries<FinancialEntry>("financial_entries", qEntries),
        fetchCollectionWhere<Employee>("employees", "company_id", "==", saasUser?.id)
      ])
      
      const register = registers.length > 0 ? registers[0] : null
      setCurrentRegister(register)
      setEmployees(emps)
      
      if (register) {
        // If there's an open register for this date, show all entries that are either from this date OR explicitly linked to this cash_register_id
        // But for simplicity, we fetched by date. Let's filter by professional if needed.
        let filtered = entries.filter(e => e.cash_register_id === register.id || e.date === dateStr)
        if (searchProf !== "all") {
          filtered = filtered.filter(e => e.employee_id === searchProf)
        }
        setFinancialEntries(filtered)
      } else {
        setFinancialEntries([])
      }
    } catch(err) {
      console.error(err)
      toast.error("Erro ao carregar dados do caixa.")
    }
    setLoading(false)
  }

  useEffect(() => { loadData(searchDate) }, [searchDate, searchProf])

  const handleOpen = async () => {
    if (openingAmount.trim() === "" || isNaN(parseFloat(openingAmount)) || parseFloat(openingAmount) < 0) {
      return toast.error("Informe um valor de abertura válido (ex: 0,00 ou maior)")
    }
    try {
      await createDocument("cash_registers", {
        company_id: saasUser?.id || null,
        date: searchDate,
        opening_amount: parseFloat(openingAmount),
        closing_amount: null,
        expected_amount: null,
        difference: null,
        status: "open",
        opened_by_user_id: saasUser?.id || null,
        opened_by_name: saasUser?.name || null,
        notes: null,
        opened_at: new Date().toISOString(),
        closed_at: null,
      })
      toast.success("Caixa aberto!")
      setShowOpenModal(false)
      setOpeningAmount("")
      loadData(searchDate)
    } catch (err) {
      console.error("Erro ao abrir caixa:", err)
      toast.error("Erro ao abrir caixa")
    }
  }

  const handleClose = async () => {
    if (!closingAmount) return toast.error("Informe o valor contado no fechamento")
    if (!currentRegister) return
    try {
      const closingVal = parseFloat(closingAmount)
      const diff = closingVal - expectedCashBalance
      await updateDocument("cash_registers", currentRegister.id, {
        closing_amount: closingVal,
        expected_amount: expectedCashBalance,
        difference: diff,
        status: "closed",
        notes: closingNotes || null,
        closed_at: new Date().toISOString(),
      })
      toast.success("Caixa fechado!")
      setShowCloseModal(false)
      setClosingAmount("")
      setClosingNotes("")
      loadData(searchDate)
    } catch (err) {
      console.error("Erro ao fechar caixa:", err)
      toast.error("Erro ao fechar caixa")
    }
  }

  // Calculations
  const isOpen = currentRegister?.status === "open"
  const isClosed = currentRegister?.status === "closed"
  
  // Filter out refunded entries for the totals calculation
  const validEntries = financialEntries.filter(e => !e.is_refunded)
  
  const getSumByMethod = (method: string) => validEntries.filter(e => e.type === "income" && e.payment_method === method).reduce((s,e) => s + (e.paid_amount || 0), 0)
  
  const valCash = getSumByMethod("cash")
  const valPix = getSumByMethod("pix")
  const valCredit = getSumByMethod("credit_card")
  const valDebit = getSumByMethod("debit_card")
  const valTransfer = getSumByMethod("transfer")
  const valCourtesy = getSumByMethod("courtesy")
  const valClientCredit = getSumByMethod("client_credit")
  const valOther = getSumByMethod("other")
  
  const totalRecebido = valCash + valPix + valCredit + valDebit + valTransfer + valOther
  
  const despesas = validEntries.filter(e => e.type === "expense" && e.category !== "sangria").reduce((s,e) => s + e.amount, 0)
  const sangria = validEntries.filter(e => e.type === "expense" && e.category === "sangria").reduce((s,e) => s + e.amount, 0)
  
  const expectedCashBalance = (currentRegister?.opening_amount || 0) + valCash - despesas - sangria

  const getMethodLabel = (id: string) => {
    const map: Record<string,string> = { cash: "Dinheiro", pix: "Pix", credit_card: "Crédito", debit_card: "Débito", transfer: "Transf.", courtesy: "Cortesia", client_credit: "Crédito Cli.", other: "Outro" }
    return map[id] || id
  }

  const exportConfig = {
    title: `Fechamentos do Caixa - ${searchDate}`,
    fileName: `caixa_${searchDate}`,
    data: financialEntries,
    columns: [
      { header: "Hora", key: "created_at", format: (v: any) => v && !isNaN(new Date(v).getTime()) ? new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : "--:--" },
      { header: "Cliente", key: "client_name", format: (v: any) => v || "Avulso" },
      { header: "Serviço", key: "service_name", format: (v: any, row: any) => v || row.description || "—" },
      { header: "Profissional", key: "employee_name", format: (v: any) => v || "Vários" },
      { header: "Forma de Pagamento", key: "payment_method", format: (v: any) => getMethodLabel(String(v)) },
      { header: "Valor", key: "amount", format: (v: any, row: any) => `${row.type === "expense" ? "-" : ""}${formatCurrency(row.paid_amount || row.amount)}` },
      { header: "Status", key: "payment_status", format: (v: any, row: any) => row.is_refunded ? "ESTORNADO" : v === "partial" ? "PARCIAL" : "PAGO" }
    ]
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      
      {/* Header and Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: '#fff', padding: '1.25rem 1.5rem', borderRadius: '1rem', border: '1px solid #e8ecf4', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>
            Caixa <span style={{ color: '#7c5cfc' }}>{currentRegister?.opened_by_name ? currentRegister.opened_by_name.split(' ')[0] : (saasUser?.name ? saasUser.name.split(' ')[0] : "Usuário")}</span>, do dia {(searchDate || "").split("-").reverse().join("/")}
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>Conferência e fechamentos do dia.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Calendar style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#8b8fa7' }} />
            <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)}
              style={{ paddingLeft: '2.25rem', paddingRight: '0.75rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', borderRadius: '0.5rem', border: '2px solid #e8ecf4', background: '#fafbfc', fontSize: '0.8125rem', color: '#1e1e2d', outline: 'none' }} />
          </div>
          
          <div style={{ position: 'relative' }}>
            <Filter style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#8b8fa7' }} />
            <select value={searchProf} onChange={e => setSearchProf(e.target.value)}
              style={{ paddingLeft: '2.25rem', paddingRight: '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', borderRadius: '0.5rem', border: '2px solid #e8ecf4', background: '#fafbfc', fontSize: '0.8125rem', color: '#1e1e2d', outline: 'none', appearance: 'none', minWidth: '150px' }}>
              <option value="all">Todos os Profissionais</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          
          <button onClick={() => { setSearchDate(toLocalDateStr()); setSearchProf("all") }}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '2px solid #e8ecf4', background: '#fff', color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
            Hoje
          </button>
          
          <PermissionGate permission="cash.view">
            <ExportButtons 
              data={exportConfig.data}
              columns={exportConfig.columns}
              fileName={exportConfig.fileName}
              title={exportConfig.title}
              exportPermissionKey="cash.export"
              moduleName="caixa"
            />
          </PermissionGate>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" /></div>
      ) : (
        <>
          {/* Action Bar */}
          {!currentRegister ? (
            <div style={{ padding: '2rem', background: '#fefce8', border: '1px solid #fef08a', borderRadius: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
              <AlertTriangle style={{ width: '2rem', height: '2rem', color: '#ca8a04' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#854d0e' }}>Caixa Não Aberto</h3>
              <p style={{ color: '#a16207', fontSize: '0.875rem' }}>Não existe caixa aberto para esta data.</p>
              <PermissionGate permission="cash.open">
                <button onClick={() => setShowOpenModal(true)} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', background: '#1e1e2d', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <Unlock style={{ width: '16px', height: '16px' }} /> Abrir Caixa Agora
                </button>
              </PermissionGate>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              
              {/* CAIXA (Lado Esquerdo) */}
              <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.5rem', background: '#fafbfc', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#7c5cfc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Métricas do Caixa</h3>
                  {isOpen ? (
                     <span style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem', borderRadius: '1rem', background: '#ecfdf5', color: '#059669', fontWeight: 700 }}>EM OPERAÇÃO</span>
                  ) : (
                     <span style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem', borderRadius: '1rem', background: '#f1f5f9', color: '#475569', fontWeight: 700 }}>FECHADO</span>
                  )}
                </div>
                <div style={{ padding: '0 1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#4b5563', fontWeight: 500 }}>Abertura de Caixa</span>
                    <span style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 700 }}>{formatCurrency(currentRegister.opening_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6', background: '#f0fdf4', margin: '0 -1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#047857', fontWeight: 600 }}>Recebimento em dinheiro</span>
                    <span style={{ fontSize: '0.8125rem', color: '#047857', fontWeight: 800 }}>+{formatCurrency(valCash)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6', background: '#fef2f2', margin: '0 -1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#b91c1c', fontWeight: 600 }}>Despesas do caixa</span>
                    <span style={{ fontSize: '0.8125rem', color: '#b91c1c', fontWeight: 800 }}>-{formatCurrency(despesas)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6', background: '#fef2f2', margin: '0 -1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#b91c1c', fontWeight: 600 }}>Sangria</span>
                    <span style={{ fontSize: '0.8125rem', color: '#b91c1c', fontWeight: 800 }}>-{formatCurrency(sangria)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderBottom: '1px dashed #cbd5e1' }}>
                    <span style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 800 }}>Saldo do caixa em dinheiro (Esperado)</span>
                    <span style={{ fontSize: '1rem', color: '#1e293b', fontWeight: 800 }}>{formatCurrency(expectedCashBalance)}</span>
                  </div>
                  {isClosed && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: '0.8125rem', color: '#4b5563', fontWeight: 500 }}>Valor de Fechamento (Informado)</span>
                        <span style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 700 }}>{formatCurrency(currentRegister.closing_amount || 0)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', background: (currentRegister.difference || 0) === 0 ? '#ecfdf5' : '#fef2f2', margin: '0 -1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                        <span style={{ fontSize: '0.875rem', color: (currentRegister.difference || 0) === 0 ? '#059669' : '#ef4444', fontWeight: 800 }}>Diferença de Saldo</span>
                        <span style={{ fontSize: '1rem', color: (currentRegister.difference || 0) === 0 ? '#059669' : '#ef4444', fontWeight: 800 }}>{formatCurrency(currentRegister.difference || 0)}</span>
                      </div>
                    </>
                  )}
                </div>
                {isOpen && (
                  <div style={{ padding: '1rem 1.5rem', background: '#fafbfc', borderTop: '1px solid #e5e7eb' }}>
                    <PermissionGate permission="cash.close">
                      <button onClick={() => setShowCloseModal(true)} style={{ width: '100%', padding: '0.875rem', borderRadius: '0.75rem', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(239,68,68,0.2)' }}>
                        <Lock style={{ width: '16px', height: '16px' }} /> Fechar Caixa
                      </button>
                    </PermissionGate>
                  </div>
                )}
              </div>

              {/* RECEBIDOS POR FORMA (Lado Direito) */}
              <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.5rem', background: '#fafbfc', borderBottom: '1px solid #f3f4f6' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recebidos por Forma de Pagamento</h3>
                </div>
                <div style={{ padding: '0 1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#4b5563', fontWeight: 500 }}>Dinheiro</span>
                    <span style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 700 }}>{formatCurrency(valCash)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#4b5563', fontWeight: 500 }}>Pix</span>
                    <span style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 700 }}>{formatCurrency(valPix)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#4b5563', fontWeight: 500 }}>Crédito</span>
                    <span style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 700 }}>{formatCurrency(valCredit)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#4b5563', fontWeight: 500 }}>Débito</span>
                    <span style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 700 }}>{formatCurrency(valDebit)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#4b5563', fontWeight: 500 }}>Transferência</span>
                    <span style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 700 }}>{formatCurrency(valTransfer)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#4b5563', fontWeight: 500 }}>Outros / Cortesia</span>
                    <span style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 700 }}>{formatCurrency(valCourtesy + valOther)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', background: '#fff7ed', margin: '0 -1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#ea580c', fontWeight: 800 }}>Total Recebido (Externo)</span>
                    <span style={{ fontSize: '1rem', color: '#ea580c', fontWeight: 800 }}>{formatCurrency(totalRecebido)}</span>
                  </div>
                  {valClientCredit > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', background: '#f8fafc', margin: '0 -1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Uso de Crédito de Clientes</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>{formatCurrency(valClientCredit)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Fechamentos do dia */}
          {currentRegister && (
            <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.5rem', background: '#fafbfc', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #3b82f6, #60a5fa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Receipt style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} />
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>Fechamentos do Dia</h3>
              </div>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Hora/Ref</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Cliente</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Serviço(s)</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Profissional</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Forma</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Valor</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialEntries.length > 0 ? [...financialEntries].sort((a,b) => {
                      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
                      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
                      return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
                    }).map(entry => {
                      const isRef = entry.is_refunded
                      const timeStr = entry.created_at && !isNaN(new Date(entry.created_at).getTime()) 
                        ? new Date(entry.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
                        : "--:--"
                      return (
                        <tr key={entry.id} onClick={() => setSelectedEntry(entry)} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: isRef ? '#fef2f2' : '#fff', transition: 'background 0.2s', opacity: isRef ? 0.7 : 1 }}>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>
                            {timeStr}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#1e293b', fontWeight: 700 }}>
                            {entry.client_name || "Avulso"}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.8125rem', color: '#475569', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {entry.service_name || entry.description}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.8125rem', color: '#475569' }}>
                            {entry.employee_name || "Vários"}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.8125rem', color: '#1e293b', fontWeight: 600 }}>
                            {getMethodLabel(entry.payment_method)}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: entry.type === "expense" ? '#ef4444' : '#059669', fontWeight: 800 }}>
                            {entry.type === "expense" ? "-" : ""}{formatCurrency(entry.paid_amount || entry.amount)}
                          </td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                            {isRef ? (
                              <span style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem', borderRadius: '1rem', background: '#fef2f2', color: '#ef4444', fontWeight: 700 }}>ESTORNADO</span>
                            ) : entry.payment_status === "partial" ? (
                              <span style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem', borderRadius: '1rem', background: '#fff7ed', color: '#ea580c', fontWeight: 700 }}>PARCIAL</span>
                            ) : (
                              <span style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem', borderRadius: '1rem', background: '#ecfdf5', color: '#059669', fontWeight: 700 }}>PAGO</span>
                            )}
                          </td>
                        </tr>
                      )
                    }) : (
                      <tr>
                        <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                          Nenhum fechamento registrado neste caixa.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showOpenModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={() => setShowOpenModal(false)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '24rem', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>Abrir Caixa</h3>
              <button onClick={() => setShowOpenModal(false)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X style={{ width: '1.25rem', height: '1.25rem', color: '#9ca3af' }} />
              </button>
            </div>
            <div>
              <label style={labelStyle}>Valor de Abertura (R$)</label>
              <input type="number" step="0.01" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)}
                style={inputStyle} placeholder="Ex: 0,00" />
            </div>
            <button onClick={handleOpen}
              style={{ width: '100%', marginTop: '1.5rem', padding: '0.875rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.9375rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #10b981, #34d399)', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}>
              Confirmar Abertura
            </button>
          </div>
        </>
      )}

      {showCloseModal && currentRegister && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={() => setShowCloseModal(false)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '26rem', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>Fechar Caixa</h3>
              <button onClick={() => setShowCloseModal(false)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X style={{ width: '1.25rem', height: '1.25rem', color: '#9ca3af' }} />
              </button>
            </div>
            <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid #bbf7d0', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8125rem', color: '#166534', fontWeight: 600, marginBottom: '0.25rem' }}>Saldo Esperado em Dinheiro:</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669' }}>{formatCurrency(expectedCashBalance)}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Valor Contado no Caixa (R$)</label>
                <input type="number" step="0.01" value={closingAmount} onChange={e => setClosingAmount(e.target.value)}
                  style={inputStyle} placeholder="0.00" />
              </div>
              <div>
                <label style={labelStyle}>Observações / Motivo da Diferença</label>
                <textarea value={closingNotes} onChange={e => setClosingNotes(e.target.value)} rows={3}
                  style={{ ...inputStyle, resize: 'none' as const }} placeholder="Notas sobre o fechamento..." />
              </div>
            </div>
            <button onClick={handleClose}
              style={{ width: '100%', marginTop: '1.5rem', padding: '0.875rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.9375rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #ef4444, #f87171)', boxShadow: '0 4px 14px rgba(239,68,68,0.3)' }}>
              Confirmar Fechamento
            </button>
          </div>
        </>
      )}

      {selectedEntry && (
        <CashMovementDetailsModal 
          entry={selectedEntry} 
          onClose={() => setSelectedEntry(null)} 
          onUpdated={() => { loadData(searchDate) }}
        />
      )}
    </div>
  )
}
