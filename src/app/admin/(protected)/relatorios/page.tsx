"use client"

import { useEffect, useState } from "react"
import { fetchCollection } from "@/lib/firebase/client-utils"
import type { Appointment, Service, Employee, Client, FinancialEntry, CashRegister } from "@/lib/types/database"
import { formatCurrency, toLocalDateStr } from "@/lib/utils"
import { Loader2, TrendingUp, Users, DollarSign, CreditCard, AlertTriangle, Scissors, Printer, CalendarDays, ArrowRight } from "lucide-react"
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts"
import { PermissionGate } from "@/components/ui/permission-gate"
import { usePermission } from "@/lib/rbac/usePermission"
import { DailyFinancialModal } from "@/components/admin/relatorios/daily-financial-modal"
import { ExportButtons } from "@/components/ui/export-buttons"

const inputStyle: React.CSSProperties = { padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d', fontSize: '0.875rem', fontWeight: 500, outline: 'none' }
type ReportTab = "revenue" | "clients" | "professionals" | "payments" | "services"
const paymentLabels: Record<string, string> = { cash: "Dinheiro", pix: "PIX", credit_card: "Crédito", debit_card: "Débito" }
const PIE_COLORS = ["#7c5cfc","#22c997","#5b8def","#ffb547","#f25c5c","#a78bfa"]

export default function RelatoriosPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [loading, setLoading] = useState(true)
  const { can } = usePermission()
  
  const availableTabs = [
    ...(can("reports.finance") ? [{ id: "revenue" as ReportTab, label: "Receita", icon: TrendingUp }] : []),
    ...(can("reports.clients") ? [{ id: "clients" as ReportTab, label: "Clientes", icon: Users }] : []),
    ...(can("reports.professionals") ? [{ id: "professionals" as ReportTab, label: "Profissionais", icon: Users }] : []),
    ...(can("reports.finance") ? [{ id: "payments" as ReportTab, label: "Pagamentos", icon: CreditCard }] : []),
    ...(can("reports.services") ? [{ id: "services" as ReportTab, label: "Serviços", icon: Scissors }] : []),
  ]
  
  const [activeTab, setActiveTab] = useState<ReportTab>(availableTabs.length > 0 ? availableTabs[0].id : "revenue")
  
  // Period filter
  const [periodStart, setPeriodStart] = useState(() => {
    const n = new Date(); return toLocalDateStr(new Date(n.getFullYear(), n.getMonth(), 1))
  })
  const [periodEnd, setPeriodEnd] = useState(() => {
    const n = new Date(); return toLocalDateStr(new Date(n.getFullYear(), n.getMonth() + 1, 0))
  })

  // Modal State
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [a, s, e, c, f, r] = await Promise.all([
        fetchCollection<Appointment>("appointments"),
        fetchCollection<Service>("services"),
        fetchCollection<Employee>("employees"),
        fetchCollection<Client>("clients"),
        fetchCollection<FinancialEntry>("financial_entries"),
        fetchCollection<CashRegister>("cash_registers"),
      ])
      setAppointments(a); setEmployees(e); setClients(c); setEntries(f); setRegisters(r); setLoading(false)
    }
    load()
  }, [])

  // Filter by period
  const periodAppts = appointments.filter(a => a.appointment_date >= periodStart && a.appointment_date <= periodEnd)
  const completedPeriod = periodAppts.filter(a => a.status === "completed")
  const periodRevenue = completedPeriod.reduce((s, a) => s + (a.service_price || 0), 0)
  
  const periodEntries = entries.filter(e => e.date >= periodStart && e.date <= periodEnd)
  const periodIncome = periodEntries.filter(e => e.type === "income" && !e.is_refunded).reduce((s, e) => s + (e.paid_amount || e.amount), 0)
  const periodExpense = periodEntries.filter(e => e.type === "expense" && !e.is_refunded).reduce((s, e) => s + (e.paid_amount || e.amount), 0)

  // Daily Ledger
  const daysMap: Record<string, { income: number, expense: number, balance: number, date: string }> = {}
  periodEntries.forEach(e => {
    if (!daysMap[e.date]) daysMap[e.date] = { income: 0, expense: 0, balance: 0, date: e.date }
    const amount = e.paid_amount || e.amount
    if (e.type === "income" && !e.is_refunded) daysMap[e.date].income += amount
    if (e.type === "expense" && !e.is_refunded) daysMap[e.date].expense += amount
  })
  const dailyReport = Object.values(daysMap).sort((a,b) => b.date.localeCompare(a.date))

  // Payment pie
  const paymentMethods: Record<string, number> = {}
  completedPeriod.forEach(a => {
    const m = a.payment_method || "cash"
    paymentMethods[m] = (paymentMethods[m] || 0) + (a.service_price || 0)
  })
  const pieData = Object.entries(paymentMethods).map(([name, value]) => ({ name: paymentLabels[name] || name, value }))

  // Services ranking
  const serviceCount: Record<string, { name: string; count: number; revenue: number }> = {}
  completedPeriod.forEach(a => {
    const k = a.service_name
    if (!serviceCount[k]) serviceCount[k] = { name: k, count: 0, revenue: 0 }
    serviceCount[k].count++; serviceCount[k].revenue += a.service_price || 0
  })
  const topServices = Object.values(serviceCount).sort((a, b) => b.revenue - a.revenue)

  // Professionals
  const empPerformance = employees.map(emp => {
    const empApts = completedPeriod.filter(a => a.employee_id === emp.id)
    const revenue = empApts.reduce((s, a) => s + (a.service_price || 0), 0)
    return { ...emp, serviceCount: empApts.length, revenue, commission: revenue * ((emp.commission_percent || 0) / 100) }
  }).sort((a, b) => b.revenue - a.revenue)

  const debtors = clients.filter(c => (c.debt_amount || 0) > 0).sort((a, b) => (b.debt_amount || 0) - (a.debt_amount || 0))

  const handlePrint = () => window.print()

  const getActiveTabExportData = () => {
    switch (activeTab) {
      case "revenue":
        return {
          title: `Receita por Pagamento - ${periodStart} a ${periodEnd}`,
          fileName: `receita_${periodStart}_${periodEnd}`,
          data: pieData,
          columns: [
            { header: "Forma de Pagamento", key: "name" },
            { header: "Valor Total", key: "value", format: (v: any) => formatCurrency(Number(v)) }
          ]
        }
      case "clients":
        return {
          title: `Clientes Devedores - ${periodStart} a ${periodEnd}`,
          fileName: `clientes_devedores_${periodStart}_${periodEnd}`,
          data: debtors,
          columns: [
            { header: "Cliente", key: "name" },
            { header: "Telefone", key: "phone" },
            { header: "Valor em Débito", key: "debt_amount", format: (v: any) => formatCurrency(Number(v)) }
          ]
        }
      case "professionals":
        return {
          title: `Desempenho de Profissionais - ${periodStart} a ${periodEnd}`,
          fileName: `desempenho_profissionais_${periodStart}_${periodEnd}`,
          data: empPerformance,
          columns: [
            { header: "Profissional", key: "name" },
            { header: "Serviços Realizados", key: "serviceCount" },
            { header: "Receita Gerada", key: "revenue", format: (v: any) => formatCurrency(Number(v)) },
            { header: "Comissão Gerada", key: "commission", format: (v: any) => formatCurrency(Number(v)) },
            { header: "Comissão Base (%)", key: "commission_percent", format: (v: any) => `${v || 0}%` }
          ]
        }
      case "payments":
        return {
          title: `Receita por Pagamento Detalhada - ${periodStart} a ${periodEnd}`,
          fileName: `receita_detalhada_${periodStart}_${periodEnd}`,
          data: Object.entries(paymentMethods).map(([k, v]) => ({ method: paymentLabels[k] || k, amount: v })),
          columns: [
            { header: "Forma de Pagamento", key: "method" },
            { header: "Valor Total", key: "amount", format: (v: any) => formatCurrency(Number(v)) }
          ]
        }
      case "services":
        return {
          title: `Serviços Mais Realizados - ${periodStart} a ${periodEnd}`,
          fileName: `servicos_realizados_${periodStart}_${periodEnd}`,
          data: topServices,
          columns: [
            { header: "Serviço", key: "name" },
            { header: "Quantidade Realizada", key: "count" },
            { header: "Receita Total", key: "revenue", format: (v: any) => formatCurrency(Number(v)) }
          ]
        }
      default:
        return { title: "", fileName: "", data: [], columns: [] }
    }
  }

  const exportConfig = getActiveTabExportData()

  const dailyLedgerExportConfig = {
    title: `Histórico Diário - ${periodStart} a ${periodEnd}`,
    fileName: `historico_diario_${periodStart}_${periodEnd}`,
    data: dailyReport,
    columns: [
      { header: "Data", key: "date", format: (v: any) => String(v).split('-').reverse().join('/') },
      { header: "Entradas", key: "income", format: (v: any) => formatCurrency(Number(v)) },
      { header: "Saídas", key: "expense", format: (v: any) => formatCurrency(Number(v)) },
      { header: "Saldo", key: "balance", format: (v: any, row: any) => formatCurrency((row.income || 0) - (row.expense || 0)) }
    ]
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Selected Date Modal */}
      {selectedDate && (
        <DailyFinancialModal
          date={selectedDate}
          entries={entries.filter(e => e.date === selectedDate)}
          registers={registers.filter(r => r.date === selectedDate)}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
        {[
          { label: "Receita Serviços", value: formatCurrency(periodRevenue), color: '#059669', g: 'linear-gradient(135deg,#22c997,#5ee0b8)' },
          { label: "Entradas Totais", value: formatCurrency(periodIncome), color: '#2563eb', g: 'linear-gradient(135deg,#5b8def,#93b5f5)' },
          { label: "Saídas/Despesas", value: formatCurrency(periodExpense), color: '#ef4444', g: 'linear-gradient(135deg,#f25c5c,#f78888)' },
          { label: "Lucro Líquido", value: formatCurrency(periodIncome - periodExpense), color: (periodIncome - periodExpense) >= 0 ? '#059669' : '#ef4444', g: 'linear-gradient(135deg,#7c5cfc,#a78bfa)' },
          { label: "Agendamentos", value: String(periodAppts.length), color: '#1e1e2d', g: 'linear-gradient(135deg,#ffb547,#ffd08a)' },
        ].map((stat, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: stat.g, marginBottom: '0.625rem' }}>
              <DollarSign style={{ width: '1rem', height: '1rem', color: '#fff' }} />
            </div>
            <p style={{ fontSize: '0.6875rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.25rem' }}>{stat.label}</p>
            <p style={{ fontSize: '1.125rem', fontWeight: 800, color: stat.color, fontFamily: "var(--font-heading)" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Tabs + Print */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', background: '#fff', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', marginBottom: '0.375rem', textTransform: 'uppercase' }}>Período De</label>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', marginBottom: '0.375rem', textTransform: 'uppercase' }}>Até</label>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={inputStyle} />
          </div>
        </div>
        
        <div style={{ flex: 1 }} />
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.25rem', background: '#f3f4f6', borderRadius: '0.75rem', padding: '0.25rem' }}>
            {availableTabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ padding: '0.5rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.375rem', background: activeTab === tab.id ? '#fff' : 'transparent', color: activeTab === tab.id ? '#7c5cfc' : '#6b7280', boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                <tab.icon style={{ width: '0.875rem', height: '0.875rem' }} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
          <PermissionGate permission="reports.print">
            <ExportButtons 
              data={exportConfig.data}
              columns={exportConfig.columns}
              fileName={exportConfig.fileName}
              title={exportConfig.title}
            />
            <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Printer style={{ width: '1rem', height: '1rem' }} /> Imprimir Tela
            </button>
          </PermissionGate>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Daily Report List */}
        <PermissionGate permission="reports.financial">
          <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden', gridColumn: '1 / -1' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', background: '#fafbfc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarDays style={{ width: '1.125rem', height: '1.125rem', color: '#fff' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>Histórico Diário</h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.125rem' }}>Selecione um dia para ver o detalhamento completo de caixa e financeiro.</p>
                </div>
              </div>
              <PermissionGate permission="reports.print">
                <ExportButtons 
                  data={dailyLedgerExportConfig.data}
                  columns={dailyLedgerExportConfig.columns}
                  fileName={dailyLedgerExportConfig.fileName}
                  title={dailyLedgerExportConfig.title}
                />
              </PermissionGate>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Data</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Entradas</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Saídas</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Saldo</th>
                    <th style={{ padding: '1rem 1.5rem', width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {dailyReport.length > 0 ? dailyReport.map(day => (
                    <tr 
                      key={day.date} 
                      onClick={() => setSelectedDate(day.date)}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.2s', background: '#fff' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.875rem', color: '#1e293b', fontWeight: 700 }}>
                        {day.date.split('-').reverse().join('/')}
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.875rem', color: '#059669', fontWeight: 700 }}>
                        {formatCurrency(day.income)}
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.875rem', color: '#ef4444', fontWeight: 700 }}>
                        {formatCurrency(day.expense)}
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.875rem', color: (day.income - day.expense) >= 0 ? '#2563eb' : '#ef4444', fontWeight: 800 }}>
                        {formatCurrency(day.income - day.expense)}
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', color: '#cbd5e1' }}>
                        <ArrowRight style={{ width: '1.25rem', height: '1.25rem' }} />
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                        Nenhuma movimentação no período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </PermissionGate>

        {/* Tab content */}
        <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden', gridColumn: '1 / -1' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f3f4f6', background: '#fafbfc' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>
              {availableTabs.find(t => t.id === activeTab)?.label}
            </h3>
          </div>

          {activeTab === "revenue" && (
            <div style={{ padding: '1.5rem' }}>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={{ borderRadius: '0.75rem', border: 'none', fontSize: '0.8125rem' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.75rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>Sem dados para este período</p>}
            </div>
          )}

          {activeTab === "clients" && (
            debtors.length > 0 ? (
              <div>
                {debtors.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2' }}>
                      <AlertTriangle style={{ width: '1rem', height: '1rem', color: '#ef4444' }} />
                    </div>
                    <div style={{ flex: 1 }}><p style={{ fontWeight: 600, color: '#1e1e2d', fontSize: '0.875rem' }}>{c.name}</p><p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{c.phone}</p></div>
                    <p style={{ fontWeight: 800, color: '#ef4444' }}>{formatCurrency(c.debt_amount || 0)}</p>
                  </div>
                ))}
                <div style={{ padding: '0.75rem 1.5rem', background: '#fef2f2', borderTop: '1px solid #fecaca' }}>
                  <p style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.875rem', textAlign: 'right' }}>Total: {formatCurrency(debtors.reduce((s, c) => s + (c.debt_amount || 0), 0))}</p>
                </div>
              </div>
            ) : <div style={{ padding: '3rem', textAlign: 'center' }}><p style={{ color: '#059669', fontWeight: 600 }}>🎉 Nenhum cliente devedor!</p></div>
          )}

          {activeTab === "professionals" && (
            <div>
              {empPerformance.map((emp, i) => (
                <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#f3f4f6', fontSize: '0.6875rem', fontWeight: 800, color: i < 3 ? '#fff' : '#9ca3af' }}>{i+1}</div>
                  <div style={{ flex: 1 }}><p style={{ fontWeight: 600, color: '#1e1e2d', fontSize: '0.875rem' }}>{emp.name}</p><p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{emp.serviceCount} serviços • {emp.commission_percent || 0}% comissão</p></div>
                  <div style={{ textAlign: 'right' }}><p style={{ fontWeight: 800, color: '#059669', fontSize: '0.875rem' }}>{formatCurrency(emp.revenue)}</p><p style={{ fontSize: '0.6875rem', color: '#7c5cfc', fontWeight: 600 }}>Comissão: {formatCurrency(emp.commission)}</p></div>
                </div>
              ))}
              {empPerformance.length === 0 && <div style={{ padding: '3rem', textAlign: 'center' }}><p style={{ color: '#9ca3af' }}>Nenhum dado de profissional</p></div>}
            </div>
          )}

          {activeTab === "payments" && (
            <div style={{ padding: '1.5rem' }}>
              {Object.entries(paymentMethods).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Object.entries(paymentMethods).sort((a, b) => b[1] - a[1]).map(([method, amount]) => {
                    const total = Object.values(paymentMethods).reduce((s, v) => s + v, 0)
                    const pct = total > 0 ? (amount / total) * 100 : 0
                    const colors: Record<string, string> = { cash: '#22c997', pix: '#7c5cfc', credit_card: '#5b8def', debit_card: '#ffb547' }
                    return (
                      <div key={method}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e1e2d' }}>{paymentLabels[method] || method}</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>{formatCurrency(amount)} ({pct.toFixed(1)}%)</span>
                        </div>
                        <div style={{ height: '0.5rem', background: '#f3f4f6', borderRadius: '0.25rem', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '0.25rem', background: colors[method] || '#7c5cfc', width: `${pct}%`, transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : <p style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>Sem dados de pagamento</p>}
            </div>
          )}

          {activeTab === "services" && (
            topServices.length > 0 ? (
              <div>
                {topServices.map((svc, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#f3f4f6', fontSize: '0.6875rem', fontWeight: 800, color: i < 3 ? '#fff' : '#9ca3af' }}>{i+1}</div>
                    <div style={{ flex: 1 }}><p style={{ fontWeight: 600, color: '#1e1e2d', fontSize: '0.875rem' }}>{svc.name}</p><p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{svc.count} realizados</p></div>
                    <p style={{ fontWeight: 800, color: '#7c5cfc' }}>{formatCurrency(svc.revenue)}</p>
                  </div>
                ))}
              </div>
            ) : <div style={{ padding: '3rem', textAlign: 'center' }}><p style={{ color: '#9ca3af' }}>Sem dados de serviços</p></div>
          )}
        </div>
      </div>
    </div>
  )
}
