"use client"

import { useEffect, useState, useMemo } from "react"
import { fetchCollection } from "@/lib/firebase/client-utils"
import type { Employee, Appointment, Commission } from "@/lib/types/database"
import { formatCurrency, toLocalDateStr } from "@/lib/utils"
import { Loader2, CreditCard, Users, Clock, CheckCircle, Search, Filter, LayoutGrid, List, ArrowDownUp, AlertTriangle } from "lucide-react"
import { CommissionModals } from "@/components/admin/pagamentos/commission-modals"
import { usePermission } from "@/lib/rbac/usePermission"
import { useTenant } from "@/lib/auth/tenant-context"
import { ExportButtons } from "@/components/ui/export-buttons"
import { PermissionGate } from "@/components/ui/permission-gate"

export default function PagamentosPage() {
  const { can } = usePermission()
  const { employee } = useTenant()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)

  // View state
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards")
  
  // Modal state
  const [activeModal, setActiveModal] = useState<"services" | "revenue" | "payment" | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all" | "pending">("active")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")

  const load = async () => {
    setLoading(true)
    const [e, c] = await Promise.all([
      fetchCollection<Employee>("employees"),
      fetchCollection<Commission>("commissions"),
    ])
    
    // Sort employees alphabetically
    e.sort((a, b) => a.name.localeCompare(b.name))
    setEmployees(e)
    setCommissions(c)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Default to current month
    const now = new Date()
    const start = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
    const end = toLocalDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    setPeriodStart(start)
    setPeriodEnd(end)
  }, [])

  // Filter employees based on search and status
  const filteredEmployees = useMemo(() => {
    let list = employees
    if (!can("commissions.view")) {
      if (can("commissions.view_own") && employee) {
        list = list.filter(e => e.id === employee.id)
      } else {
        list = []
      }
    }
    return list.filter(emp => {
      const matchSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase())
      
      let hasPending = false
      if (statusFilter === "pending") {
        const empComms = commissions.filter(c => {
          if (c.professional_id !== emp.id) return false
          if (periodStart && c.performed_at < periodStart) return false
          if (periodEnd && c.performed_at > periodEnd) return false
          if (c.status === "cancelled") return false
          return true
        })
        hasPending = empComms.some(c => c.status === "pending" && c.commission_amount > 0)
      }

      const matchStatus = statusFilter === "all" || 
                          (statusFilter === "active" && emp.is_active) || 
                          (statusFilter === "inactive" && !emp.is_active) ||
                          (statusFilter === "pending" && hasPending)
      return matchSearch && matchStatus
    })
  }, [employees, searchTerm, statusFilter, can, employee, commissions, periodStart, periodEnd])

  // Calculate stats per employee
  const getEmployeeStats = (empId: string) => {
    const empComms = commissions.filter(c => {
      if (c.professional_id !== empId) return false
      if (periodStart && c.performed_at < periodStart) return false
      if (periodEnd && c.performed_at > periodEnd) return false
      if (c.status === "cancelled") return false
      return true
    })

    const totalServices = empComms.length
    const totalRevenue = empComms.reduce((sum, c) => sum + c.paid_amount, 0)
    const totalCommission = empComms.reduce((sum, c) => sum + c.commission_amount, 0)
    const pendingComms = empComms.filter(c => c.status === "pending").reduce((sum, c) => sum + c.commission_amount, 0)

    return { totalServices, totalRevenue, totalCommission, pendingComms }
  }

  // Global stats based on filtered period and service (across all employees)
  const globalStats = useMemo(() => {
    const periodComms = commissions.filter(c => {
      if (!can("commissions.view") && can("commissions.view_own") && employee) {
        if (c.professional_id !== employee.id) return false
      }
      if (periodStart && c.performed_at < periodStart) return false
      if (periodEnd && c.performed_at > periodEnd) return false
      if (c.status === "cancelled") return false
      return true
    })
    
    const pendingComms = periodComms.filter(c => c.status === "pending").reduce((sum, c) => sum + c.commission_amount, 0)
    const paidComms = periodComms.filter(c => c.status === "paid").reduce((sum, c) => sum + c.commission_amount, 0)

    return { pendingComms, paidComms }
  }, [commissions, periodStart, periodEnd, can, employee])

  const gradients = [
    "linear-gradient(135deg, #7c5cfc, #a78bfa)", "linear-gradient(135deg, #22c997, #5ee0b8)",
    "linear-gradient(135deg, #5b8def, #93b5f5)", "linear-gradient(135deg, #ffb547, #ffd08a)",
    "linear-gradient(135deg, #f25c5c, #f78888)", "linear-gradient(135deg, #e879a0, #f0a5bd)",
  ]

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
    border: '2px solid #e8ecf4', fontSize: '0.8125rem', color: '#1e1e2d', outline: 'none', background: '#fff',
  }

  const getHoverStyle = (baseStyle: React.CSSProperties): React.CSSProperties => ({
    ...baseStyle,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  })

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" /></div>

  const handleOpenModal = (modal: "services" | "revenue" | "payment", empId: string) => {
    setSelectedEmployeeId(empId)
    setActiveModal(modal)
  }

  const exportData = filteredEmployees.map(emp => {
    const stats = getEmployeeStats(emp.id)
    return {
      name: emp.name,
      status: emp.is_active ? "Ativo" : "Inativo",
      commission_percent: emp.commission_percent || 0,
      totalServices: stats.totalServices,
      totalRevenue: stats.totalRevenue,
      totalCommission: stats.totalCommission,
      pendingComms: stats.pendingComms
    }
  })

  const exportConfig = {
    title: `Relatório de Comissões - ${periodStart} a ${periodEnd}`,
    fileName: `comissoes_${periodStart}_${periodEnd}`,
    data: exportData,
    columns: [
      { header: "Profissional", key: "name" },
      { header: "Status", key: "status" },
      { header: "Comissão Base (%)", key: "commission_percent", format: (v: any) => `${v}%` },
      { header: "Serviços Realizados", key: "totalServices" },
      { header: "Receita Gerada", key: "totalRevenue", format: (v: any) => formatCurrency(Number(v)) },
      { header: "Total Comissão", key: "totalCommission", format: (v: any) => formatCurrency(Number(v)) },
      { header: "Comissões Pendentes", key: "pendingComms", format: (v: any) => formatCurrency(Number(v)) }
    ]
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Global Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 4px 14px rgba(124,92,252,0.25)' }}>
              <Users style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>Profissionais Exibidos</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>{filteredEmployees.length}</p>
        </div>
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #ffb547, #ffd08a)', boxShadow: '0 4px 14px rgba(255,181,71,0.25)' }}>
              <Clock style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>Comissões Pendentes (Período)</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706', fontFamily: "var(--font-heading)" }}>{formatCurrency(globalStats.pendingComms)}</p>
        </div>
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #22c997, #5ee0b8)', boxShadow: '0 4px 14px rgba(34,201,151,0.25)' }}>
              <CheckCircle style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>Comissões Pagas (Período)</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', fontFamily: "var(--font-heading)" }}>{formatCurrency(globalStats.paidComms)}</p>
        </div>
      </div>

      {/* Filters & View Controls */}
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', flex: 1 }}>
            
            {/* Search */}
            <div style={{ minWidth: '200px', flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', marginBottom: '0.375rem', textTransform: 'uppercase' }}>Buscar Profissional</label>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#9ca3af' }} />
                <input 
                  type="text" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  placeholder="Nome do profissional..." 
                  style={{ ...inputStyle, paddingLeft: '2.25rem' }} 
                />
              </div>
            </div>

            {/* Status Filter */}
            <div style={{ minWidth: '120px' }}>
              <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', marginBottom: '0.375rem', textTransform: 'uppercase' }}>Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={inputStyle}>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="all">Todos</option>
                <option value="pending">Pendentes</option>
              </select>
            </div>

            {/* Date Range */}
            <div style={{ minWidth: '130px' }}>
              <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', marginBottom: '0.375rem', textTransform: 'uppercase' }}>De</label>
              <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ minWidth: '130px' }}>
              <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', marginBottom: '0.375rem', textTransform: 'uppercase' }}>Até</label>
              <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* View Toggles & Export */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <PermissionGate permission="commissions.view">
              <ExportButtons 
                data={exportConfig.data}
                columns={exportConfig.columns}
                fileName={exportConfig.fileName}
                title={exportConfig.title}
                exportPermissionKey="commissions.export"
                moduleName="comissões"
              />
            </PermissionGate>
            <div style={{ display: 'flex', gap: '0.375rem', background: '#f8fafc', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <button 
              onClick={() => setViewMode("cards")}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
                border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.15s',
                background: viewMode === "cards" ? '#fff' : 'transparent',
                color: viewMode === "cards" ? '#7c5cfc' : '#64748b',
                boxShadow: viewMode === "cards" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <LayoutGrid style={{ width: '14px', height: '14px' }} /> Cards
            </button>
            <button 
              onClick={() => setViewMode("list")}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
                border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.15s',
                background: viewMode === "list" ? '#fff' : 'transparent',
                color: viewMode === "list" ? '#7c5cfc' : '#64748b',
                boxShadow: viewMode === "list" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <List style={{ width: '14px', height: '14px' }} /> Lista
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f3f4f6', background: '#fafbfc', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)' }}>
            <CreditCard style={{ width: '1rem', height: '1rem', color: '#fff' }} />
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>Detalhamento por Profissional</h3>
        </div>

        {filteredEmployees.length === 0 ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <Users style={{ width: '2.5rem', height: '2.5rem', color: '#cbd5e1', margin: '0 auto 1rem' }} />
            <p style={{ color: '#64748b', fontWeight: 600 }}>Nenhum profissional encontrado com os filtros atuais.</p>
          </div>
        ) : (
          viewMode === "cards" ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', padding: '1rem' }}>
              {filteredEmployees.map((emp, i) => {
                const stats = getEmployeeStats(emp.id)
                return (
                  <div key={emp.id} style={{ borderRadius: '0.75rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <div style={{ height: '3px', background: gradients[i % gradients.length] }} />
                    <div style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9375rem', fontWeight: 700, background: gradients[i % gradients.length] }}>
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, color: '#1e1e2d', fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</span>
                            {stats.pendingComms > 0 && (
                              <span title="Possui comissões pendentes" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.25rem', height: '1.25rem', borderRadius: '50%', backgroundColor: '#fef3c7', color: '#d97706' }}>
                                <AlertTriangle style={{ width: '0.75rem', height: '0.75rem' }} />
                              </span>
                            )}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {emp.is_active ? "Ativo" : "Inativo"} • {emp.commission_percent || 0}% comissão base
                          </p>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div 
                          onClick={() => handleOpenModal("services", emp.id)}
                          style={{ padding: '0.625rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                          onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                        >
                          <p style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Serviços Realizados</p>
                          <p style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1e1e2d' }}>{stats.totalServices}</p>
                        </div>
                        <div 
                          onClick={() => handleOpenModal("revenue", emp.id)}
                          style={{ padding: '0.625rem', background: '#ecfdf5', borderRadius: '0.5rem', border: '1px solid #a7f3d0', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#d1fae5'}
                          onMouseLeave={e => e.currentTarget.style.background = '#ecfdf5'}
                        >
                          <p style={{ fontSize: '0.625rem', color: '#047857', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Receita Gerada</p>
                          <p style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>{formatCurrency(stats.totalRevenue)}</p>
                        </div>
                      </div>

                      <div 
                        onClick={() => handleOpenModal("payment", emp.id)}
                        style={{ padding: '0.75rem', background: '#f0ecff', borderRadius: '0.5rem', border: '1px solid #e0d4ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#e6dfff'}
                        onMouseLeave={e => e.currentTarget.style.background = '#f0ecff'}
                      >
                        <p style={{ fontSize: '0.6875rem', color: '#7c5cfc', fontWeight: 700, textTransform: 'uppercase' }}>Total em Comissões</p>
                        <p style={{ fontSize: '1.125rem', fontWeight: 800, color: '#7c5cfc' }}>{formatCurrency(stats.totalCommission)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Profissional</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'center', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Comissão Base</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'center', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Serviços Realizados</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Receita Gerada</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp, i) => {
                    const stats = getEmployeeStats(emp.id)
                    return (
                      <tr key={emp.id} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700, background: gradients[i % gradients.length], flexShrink: 0 }}>
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontWeight: 600, color: '#1e1e2d', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</span>
                                {stats.pendingComms > 0 && (
                                  <span title="Possui comissões pendentes" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.25rem', height: '1.25rem', borderRadius: '50%', backgroundColor: '#fef3c7', color: '#d97706' }}>
                                    <AlertTriangle style={{ width: '0.75rem', height: '0.75rem' }} />
                                  </span>
                                )}
                              </p>
                              <p style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>{emp.is_active ? "Ativo" : "Inativo"}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 600, color: '#64748b' }}>
                          {emp.commission_percent || 0}%
                        </td>
                        <td 
                          onClick={() => handleOpenModal("services", emp.id)}
                          style={{ padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: '#1e1e2d', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                        >
                          {stats.totalServices}
                        </td>
                        <td 
                          onClick={() => handleOpenModal("revenue", emp.id)}
                          style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#059669', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                        >
                          {formatCurrency(stats.totalRevenue)}
                        </td>
                        <td 
                          onClick={() => handleOpenModal("payment", emp.id)}
                          style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 800, color: '#7c5cfc', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                        >
                          {formatCurrency(stats.totalCommission)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <CommissionModals
        activeModal={activeModal}
        employee={employees.find(e => e.id === selectedEmployeeId) || null}
        globalCommissions={commissions.filter(c => c.professional_id === selectedEmployeeId)}
        globalPeriodStart={periodStart}
        globalPeriodEnd={periodEnd}
        onClose={() => { setActiveModal(null); setSelectedEmployeeId(null) }}
        onRefresh={() => load()}
      />
    </div>
  )
}
