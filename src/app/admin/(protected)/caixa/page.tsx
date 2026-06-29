"use client"

import { useEffect, useState } from "react"
import { fetchCollectionWhere, fetchCollectionWithQueries, createDocument, updateDocument, fetchCollection } from "@/lib/firebase/client-utils"
import type { CashRegister, FinancialEntry, Employee } from "@/lib/types/database"
import { formatCurrency, toLocalDateStr } from "@/lib/utils"
import { Loader2, Landmark, DollarSign, Clock, Lock, Unlock, AlertTriangle, CheckCircle, X, Filter, Search, Receipt, Calendar, Users, Eye, Plus, Shield } from "lucide-react"
import { toast } from "sonner"
import { usePermission } from "@/lib/rbac/usePermission"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useTenant } from "@/lib/auth/tenant-context"
import { CashMovementDetailsModal } from "@/components/admin/caixa/cash-movement-details-modal"
import { ExportButtons } from "@/components/ui/export-buttons"
import { createHistoryEvent } from "@/lib/firebase/history-service"

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
  border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d',
  fontSize: '0.875rem', fontWeight: 500, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem'
}

export default function CaixaPage() {
  const { saasUser, user, isSuperAdmin, isOwner } = useTenant()
  const { can } = usePermission()
  
  const [loading, setLoading] = useState(true)
  const [searchDate, setSearchDate] = useState(toLocalDateStr())
  const [searchProf, setSearchProf] = useState("all")
  
  const [allRegisters, setAllRegisters] = useState<CashRegister[]>([])
  const [selectedRegisterId, setSelectedRegisterId] = useState<string | null>(null)
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showExtraConfirm, setShowExtraConfirm] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<FinancialEntry | null>(null)
  
  const [openingAmount, setOpeningAmount] = useState("")
  const [registerName, setRegisterName] = useState("")
  const [closingAmount, setClosingAmount] = useState("")
  const [closingNotes, setClosingNotes] = useState("")

  const canManageCash = isSuperAdmin || isOwner || can("cash.manage")
  const canViewAll = isSuperAdmin || isOwner || can("cash.view_all") || can("cash.manage")
  const currentUid = user?.uid || saasUser?.firebase_uid || ""

  const currentRegister = allRegisters.find(r => r.id === selectedRegisterId) || null
  const openRegisters = allRegisters.filter(r => r.status === "open")
  const closedRegisters = allRegisters.filter(r => r.status === "closed")

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
      
      setAllRegisters(registers)
      setEmployees(emps)
      
      // Auto-select logic
      if (registers.length > 0) {
        const prevSelected = selectedRegisterId && registers.find(r => r.id === selectedRegisterId)
        if (prevSelected) {
          // Keep current selection
        } else {
          // Try to find user's own register first
          const myRegister = registers.find(r => r.status === "open" && (r.opened_by_uid === currentUid || r.opened_by_user_id === saasUser?.id))
          if (myRegister) {
            setSelectedRegisterId(myRegister.id)
          } else if (registers.length === 1) {
            setSelectedRegisterId(registers[0].id)
          } else if (canViewAll && registers.find(r => r.status === "open")) {
            setSelectedRegisterId(registers.find(r => r.status === "open")!.id)
          } else {
            setSelectedRegisterId(registers[0].id)
          }
        }
      } else {
        setSelectedRegisterId(null)
      }

      setFinancialEntries(entries)
    } catch(err) {
      console.error(err)
      toast.error("Erro ao carregar dados do caixa.")
    }
    setLoading(false)
  }

  useEffect(() => { loadData(searchDate) }, [searchDate])

  // Filter entries for the selected register
  const registerEntries = (() => {
    if (!currentRegister) return []
    let filtered = financialEntries.filter(e => e.cash_register_id === currentRegister.id || (!e.cash_register_id && e.date === searchDate))
    if (searchProf !== "all") {
      filtered = filtered.filter(e => e.employee_id === searchProf)
    }
    return filtered
  })()

  const handleOpenCaixa = async (forceExtra = false) => {
    if (openingAmount.trim() === "" || isNaN(parseFloat(openingAmount)) || parseFloat(openingAmount) < 0) {
      return toast.error("Informe um valor de abertura válido (ex: 0,00 ou maior)")
    }
    
    // Check for existing open registers
    if (!forceExtra && openRegisters.length > 0) {
      if (canManageCash) {
        setShowExtraConfirm(true)
        return
      } else {
        toast.error("Já existe um caixa aberto para esta data.")
        return
      }
    }

    try {
      const isExtra = forceExtra && openRegisters.length > 0
      const operatorName = saasUser?.name || user?.displayName || "Operador"
      
      await createDocument("cash_registers", {
        company_id: saasUser?.id || null,
        date: searchDate,
        opening_amount: parseFloat(openingAmount),
        closing_amount: null,
        expected_amount: null,
        difference: null,
        status: "open",
        opened_by_user_id: saasUser?.id || null,
        opened_by_name: operatorName,
        opened_by_uid: currentUid || null,
        opened_by_email: user?.email || saasUser?.email || null,
        cash_register_name: registerName.trim() || null,
        is_extra_register: isExtra,
        opening_notes: null,
        notes: null,
        opened_at: new Date().toISOString(),
        closed_at: null,
      })

      // Audit
      await createHistoryEvent({
        action_type: isExtra ? "cash_register_extra_open" : "cash_register_open",
        action_title: isExtra ? "Caixa extra aberto" : "Caixa aberto",
        action_description: `${operatorName} abriu o caixa${isExtra ? " (extra)" : ""} com valor R$ ${parseFloat(openingAmount).toFixed(2)} para ${searchDate}`,
        performed_by_user_id: currentUid || "system",
        performed_by_name: operatorName,
        performed_by_email: user?.email || saasUser?.email || null,
      }).catch(() => {})

      toast.success("Caixa aberto!")
      setShowOpenModal(false)
      setShowExtraConfirm(false)
      setOpeningAmount("")
      setRegisterName("")
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
      const closerName = saasUser?.name || user?.displayName || "Operador"
      
      await updateDocument("cash_registers", currentRegister.id, {
        closing_amount: closingVal,
        expected_amount: expectedCashBalance,
        difference: diff,
        status: "closed",
        notes: closingNotes || null,
        closed_at: new Date().toISOString(),
        closed_by_uid: currentUid || null,
        closed_by_name: closerName,
        closed_by_email: user?.email || saasUser?.email || null,
      })

      // Audit
      await createHistoryEvent({
        action_type: "cash_register_close",
        action_title: "Caixa fechado",
        action_description: `${closerName} fechou o caixa de ${currentRegister.opened_by_name || "?"} | Esperado: R$ ${expectedCashBalance.toFixed(2)} | Contado: R$ ${closingVal.toFixed(2)} | Diferença: R$ ${diff.toFixed(2)}`,
        performed_by_user_id: currentUid || "system",
        performed_by_name: closerName,
        performed_by_email: user?.email || saasUser?.email || null,
      }).catch(() => {})

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

  const handleSelectRegister = async (regId: string) => {
    const reg = allRegisters.find(r => r.id === regId)
    if (!reg) return
    
    // Check access permission
    const isMyRegister = reg.opened_by_uid === currentUid || reg.opened_by_user_id === saasUser?.id
    if (!isMyRegister && !canViewAll) {
      toast.error("Você não tem permissão para acessar este caixa.")
      return
    }

    setSelectedRegisterId(regId)

    // Audit: admin accessing another operator's register
    if (!isMyRegister && canViewAll) {
      await createHistoryEvent({
        action_type: "cash_register_admin_access",
        action_title: "Admin acessou caixa de outro",
        action_description: `${saasUser?.name || "Admin"} acessou o caixa de ${reg.opened_by_name || "?"} (${searchDate})`,
        performed_by_user_id: currentUid || "system",
        performed_by_name: saasUser?.name || "Admin",
        performed_by_email: user?.email || saasUser?.email || null,
      }).catch(() => {})
    }
  }

  // Calculations
  const isOpen = currentRegister?.status === "open"
  const isClosed = currentRegister?.status === "closed"
  
  const validEntries = registerEntries.filter(e => !e.is_refunded)
  
  const getSumByMethod = (method: string) => validEntries.filter(e => e.type === "income" && e.payment_method === method).reduce((s,e) => s + (e.paid_amount || 0), 0)
  
  const valCash = getSumByMethod("cash")
  const valPix = getSumByMethod("pix")
  const valCredit = getSumByMethod("credit_card")
  const valDebit = getSumByMethod("debit_card")
  const valTransfer = getSumByMethod("transfer")
  const valCourtesy = getSumByMethod("courtesy")
  const valClientCredit = getSumByMethod("client_credit")
  const valOther = getSumByMethod("other")
  
  const totalRecebidoGeral = valCash + valPix + valCredit + valDebit + valTransfer + valCourtesy + valOther
  const totalRecebidoExterno = valCash + valPix + valCredit + valDebit + valTransfer + valOther
  
  const despesas = validEntries.filter(e => e.type === "expense" && e.category !== "sangria").reduce((s,e) => s + e.amount, 0)
  const sangria = validEntries.filter(e => e.type === "expense" && e.category === "sangria").reduce((s,e) => s + e.amount, 0)
  
  // Saldo da gaveta: SOMENTE dinheiro físico
  const expectedCashBalance = (currentRegister?.opening_amount || 0) + valCash - despesas - sangria

  const getMethodLabel = (id: string) => {
    const map: Record<string,string> = { cash: "Dinheiro", pix: "Pix", credit_card: "Crédito", debit_card: "Débito", transfer: "Transf.", courtesy: "Cortesia", client_credit: "Crédito Cli.", other: "Outro" }
    return map[id] || id
  }

  // Quick summary for register cards
  const getRegisterTotalReceived = (regId: string) => {
    return financialEntries
      .filter(e => e.cash_register_id === regId && e.type === "income" && !e.is_refunded)
      .reduce((s, e) => s + (e.paid_amount || 0), 0)
  }

  const exportConfig = {
    title: `Fechamentos do Caixa - ${searchDate}`,
    fileName: `caixa_${searchDate}`,
    data: registerEntries,
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

  const registerLabel = (reg: CashRegister) => {
    return reg.cash_register_name || `Caixa de ${(reg.opened_by_name || "Operador").split(' ')[0]}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      
      {/* Header and Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: '#fff', padding: '1.25rem 1.5rem', borderRadius: '1rem', border: '1px solid #e8ecf4', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>
            {currentRegister 
              ? <>{registerLabel(currentRegister)}<span style={{ color: '#7c5cfc' }}></span>, do dia {(searchDate || "").split("-").reverse().join("/")}</>
              : <>Caixa <span style={{ color: '#7c5cfc' }}>{saasUser?.name ? saasUser.name.split(' ')[0] : "Usuário"}</span>, do dia {(searchDate || "").split("-").reverse().join("/")}</>
            }
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
          {/* Register selector — show when multiple registers exist */}
          {allRegisters.length > 1 && (
            <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e8ecf4', padding: '1.25rem 1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Users style={{ width: '1rem', height: '1rem', color: '#7c5cfc' }} />
                <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#7c5cfc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Caixas do Dia ({allRegisters.length})
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {allRegisters.map(reg => {
                  const isSelected = reg.id === selectedRegisterId
                  const isMyReg = reg.opened_by_uid === currentUid || reg.opened_by_user_id === saasUser?.id
                  const canAccess = isMyReg || canViewAll
                  const regTotal = getRegisterTotalReceived(reg.id)
                  const openTime = reg.opened_at && !isNaN(new Date(reg.opened_at).getTime()) ? new Date(reg.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : "--:--"
                  
                  return (
                    <button key={reg.id} 
                      onClick={() => canAccess ? handleSelectRegister(reg.id) : toast.error("Sem permissão para acessar este caixa.")}
                      disabled={!canAccess}
                      style={{ 
                        padding: '1rem', borderRadius: '0.75rem', textAlign: 'left', cursor: canAccess ? 'pointer' : 'not-allowed',
                        border: isSelected ? '2px solid #7c5cfc' : '2px solid #e8ecf4', 
                        background: isSelected ? '#f5f3ff' : (canAccess ? '#fff' : '#f8f9fa'),
                        opacity: canAccess ? 1 : 0.6,
                        transition: 'all 0.2s',
                        boxShadow: isSelected ? '0 4px 14px rgba(124,92,252,0.15)' : 'none',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d' }}>{registerLabel(reg)}</span>
                        <span style={{ fontSize: '0.625rem', padding: '0.15rem 0.4rem', borderRadius: '1rem', fontWeight: 700, 
                          background: reg.status === "open" ? '#ecfdf5' : '#f1f5f9', 
                          color: reg.status === "open" ? '#059669' : '#475569' 
                        }}>
                          {reg.status === "open" ? "ABERTO" : "FECHADO"}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <span>Abertura: {openTime} • R$ {reg.opening_amount?.toFixed(2)}</span>
                        <span>Recebido: {formatCurrency(regTotal)}</span>
                        {!isMyReg && <span style={{ color: '#ea580c', fontWeight: 600 }}>Operador: {reg.opened_by_name?.split(' ')[0] || "?"}</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* No register state */}
          {allRegisters.length === 0 ? (
            <div style={{ padding: '2rem', background: '#fefce8', border: '1px solid #fef08a', borderRadius: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
              <AlertTriangle style={{ width: '2rem', height: '2rem', color: '#ca8a04' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#854d0e' }}>Caixa Não Aberto</h3>
              <p style={{ color: '#a16207', fontSize: '0.875rem' }}>Não existe caixa aberto para esta data.</p>
              <PermissionGate permission="cash.open">
                <button onClick={() => setShowOpenModal(true)} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', background: '#1e1e2d', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', border: 'none' }}>
                  <Unlock style={{ width: '16px', height: '16px' }} /> Abrir Caixa Agora
                </button>
              </PermissionGate>
            </div>
          ) : !currentRegister ? (
            <div style={{ padding: '2rem', background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '1rem', textAlign: 'center' }}>
              <p style={{ color: '#4338ca', fontWeight: 600 }}>Selecione um caixa acima para visualizar.</p>
            </div>
          ) : (
            <>
              {/* Action: open extra register */}
              {canManageCash && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <PermissionGate permission="cash.open">
                    <button onClick={() => setShowOpenModal(true)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '2px solid #e8ecf4', background: '#fff', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Plus style={{ width: '12px', height: '12px' }} /> Abrir Outro Caixa
                    </button>
                  </PermissionGate>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                
                {/* CAIXA METRICS (Left) */}
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

                {/* RIGHT SIDE — Payment breakdown + Total Geral */}
                <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.5rem', background: '#fafbfc', borderBottom: '1px solid #f3f4f6' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recebidos por Forma de Pagamento</h3>
                  </div>
                  <div style={{ padding: '0 1.5rem' }}>
                    {[
                      { label: "Dinheiro", value: valCash },
                      { label: "Pix", value: valPix },
                      { label: "Crédito", value: valCredit },
                      { label: "Débito", value: valDebit },
                      { label: "Transferência", value: valTransfer },
                      { label: "Outros / Cortesia", value: valCourtesy + valOther },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: '0.8125rem', color: '#4b5563', fontWeight: 500 }}>{item.label}</span>
                        <span style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 700 }}>{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                    
                    {/* Total Geral do Caixa */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', background: '#f5f3ff', margin: '0 -1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem', borderTop: '2px solid #e9e5ff' }}>
                      <span style={{ fontSize: '0.9375rem', color: '#7c5cfc', fontWeight: 800 }}>Total Recebido Geral</span>
                      <span style={{ fontSize: '1.125rem', color: '#7c5cfc', fontWeight: 800 }}>{formatCurrency(totalRecebidoGeral)}</span>
                    </div>

                    {/* Total Externo (sem cortesia) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', background: '#fff7ed', margin: '0 -1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                      <span style={{ fontSize: '0.8125rem', color: '#ea580c', fontWeight: 700 }}>Total Recebido (Externo)</span>
                      <span style={{ fontSize: '0.875rem', color: '#ea580c', fontWeight: 800 }}>{formatCurrency(totalRecebidoExterno)}</span>
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

              {/* Entries table */}
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
                      {registerEntries.length > 0 ? [...registerEntries].sort((a,b) => {
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
            </>
          )}
        </>
      )}

      {/* ================ MODALS ================ */}

      {/* Open Register Modal */}
      {showOpenModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={() => { setShowOpenModal(false); setShowExtraConfirm(false) }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '26rem', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>Abrir Caixa</h3>
              <button onClick={() => { setShowOpenModal(false); setShowExtraConfirm(false) }} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X style={{ width: '1.25rem', height: '1.25rem', color: '#9ca3af' }} />
              </button>
            </div>

            {/* Warning if registers already exist */}
            {openRegisters.length > 0 && !showExtraConfirm && (
              <div style={{ padding: '1rem', background: '#fefce8', border: '1px solid #fef08a', borderRadius: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <AlertTriangle style={{ width: '1rem', height: '1rem', color: '#ca8a04' }} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#854d0e' }}>Já existe caixa aberto para esta data.</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a16207' }}>
                  {openRegisters.map(r => (
                    <div key={r.id} style={{ marginTop: '0.25rem' }}>
                      • {r.opened_by_name || "Operador"} — aberto às {r.opened_at && !isNaN(new Date(r.opened_at).getTime()) ? new Date(r.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : "--:--"} — R$ {r.opening_amount?.toFixed(2)}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button onClick={() => { setShowOpenModal(false) }} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: '2px solid #e8ecf4', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={() => { if (openRegisters.length === 1) handleSelectRegister(openRegisters[0].id); setShowOpenModal(false) }} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: 'none', background: '#7c5cfc', color: '#fff', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}>
                    Ver Caixa Aberto
                  </button>
                </div>
                {canManageCash && (
                  <button onClick={() => setShowExtraConfirm(true)} style={{ width: '100%', marginTop: '0.5rem', padding: '0.5rem', borderRadius: '0.5rem', border: '1px dashed #d97706', background: 'transparent', color: '#d97706', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>
                    <Shield style={{ width: '12px', height: '12px', display: 'inline', marginRight: '0.25rem' }} />
                    Abrir outro caixa mesmo assim (Admin)
                  </button>
                )}
              </div>
            )}

            {/* Extra confirm */}
            {showExtraConfirm && (
              <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <AlertTriangle style={{ width: '1rem', height: '1rem', color: '#ef4444' }} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#991b1b' }}>Atenção</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#991b1b', lineHeight: 1.5 }}>
                  Já existe um caixa aberto para esta data. Abrir outro caixa pode dividir os lançamentos do dia. Deseja continuar?
                </p>
              </div>
            )}

            {/* Form (shown when no open registers or showExtraConfirm) */}
            {(openRegisters.length === 0 || showExtraConfirm) && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Valor de Abertura (R$)</label>
                    <input type="number" step="0.01" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)}
                      style={inputStyle} placeholder="Ex: 0,00" />
                  </div>
                  <div>
                    <label style={labelStyle}>Nome do Caixa (opcional)</label>
                    <input type="text" value={registerName} onChange={e => setRegisterName(e.target.value)}
                      style={inputStyle} placeholder={`Ex: Caixa de ${saasUser?.name?.split(' ')[0] || "Operador"}`} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                  {showExtraConfirm && (
                    <button onClick={() => setShowExtraConfirm(false)}
                      style={{ flex: 1, padding: '0.875rem', borderRadius: '0.75rem', border: '2px solid #e8ecf4', background: '#fff', color: '#64748b', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  )}
                  <button onClick={() => handleOpenCaixa(showExtraConfirm)}
                    style={{ flex: 1, padding: '0.875rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.9375rem', border: 'none', cursor: 'pointer', background: showExtraConfirm ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'linear-gradient(135deg, #10b981, #34d399)', boxShadow: showExtraConfirm ? '0 4px 14px rgba(217,119,6,0.3)' : '0 4px 14px rgba(16,185,129,0.3)' }}>
                    {showExtraConfirm ? "Abrir Caixa Extra" : "Confirmar Abertura"}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Close Register Modal */}
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
            
            {/* Operator info */}
            {currentRegister.opened_by_name && currentRegister.opened_by_uid !== currentUid && (
              <div style={{ padding: '0.75rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.75rem', color: '#9a3412', fontWeight: 600 }}>
                ⚠️ Você está fechando o caixa de <strong>{currentRegister.opened_by_name}</strong>
              </div>
            )}

            <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid #bbf7d0', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8125rem', color: '#166534', fontWeight: 600, marginBottom: '0.25rem' }}>Saldo Esperado em Dinheiro:</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669' }}>{formatCurrency(expectedCashBalance)}</p>
              <p style={{ fontSize: '0.6875rem', color: '#15803d', marginTop: '0.25rem' }}>Total Geral Recebido: {formatCurrency(totalRecebidoGeral)}</p>
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
