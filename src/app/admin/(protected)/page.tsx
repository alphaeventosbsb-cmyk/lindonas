"use client"

import { useEffect, useState } from "react"
import { fetchCollection } from "@/lib/firebase/client-utils"
import type { Appointment, Service, Employee, Client, FinancialEntry } from "@/lib/types/database"
import { CalendarDays, Users, Scissors, DollarSign, TrendingUp, Clock, Loader2, Calendar, Link2, Copy, Check, ExternalLink, UserCheck, AlertTriangle, CreditCard } from "lucide-react"
import { formatCurrency, toLocalDateStr } from "@/lib/utils"

export default function AdminDashboardPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      const [apt, svc, emp, cli, fin] = await Promise.all([
        fetchCollection<Appointment>("appointments"),
        fetchCollection<Service>("services"),
        fetchCollection<Employee>("employees"),
        fetchCollection<Client>("clients"),
        fetchCollection<FinancialEntry>("financial_entries"),
      ])
      setAppointments(apt)
      setServices(svc)
      setEmployees(emp)
      setClients(cli)
      setEntries(fin)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#7c5cfc' }} />
      </div>
    )
  }

  const today = toLocalDateStr()
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const todayApts = appointments.filter(a => a.appointment_date === today && a.status !== "cancelled")
  const confirmedApts = appointments.filter(a => ["confirmed", "pending"].includes(a.status))
  const completedApts = appointments.filter(a => a.status === "completed")
  const totalRevenue = completedApts.reduce((sum, a) => sum + (a.service_price || 0), 0)

  const monthCompleted = completedApts.filter(a => a.appointment_date.startsWith(thisMonth))
  const monthRevenue = monthCompleted.reduce((sum, a) => sum + (a.service_price || 0), 0)

  const monthEntries = entries.filter(e => e.date.startsWith(thisMonth))
  const monthExpenses = monthEntries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0)

  const debtors = clients.filter(c => (c.debt_amount || 0) > 0)
  const totalDebt = debtors.reduce((s, c) => s + (c.debt_amount || 0), 0)

  const stats = [
    { label: "Agendamentos Hoje", value: todayApts.length, icon: CalendarDays, gradient: "linear-gradient(135deg, #7c5cfc, #a78bfa)", shadow: "rgba(124,92,252,0.25)" },
    { label: "Próximos", value: confirmedApts.length, icon: Clock, gradient: "linear-gradient(135deg, #5b8def, #93b5f5)", shadow: "rgba(91,141,239,0.25)" },
    { label: "Serviços Ativos", value: services.filter(s => s.is_active).length, icon: Scissors, gradient: "linear-gradient(135deg, #22c997, #5ee0b8)", shadow: "rgba(34,201,151,0.25)" },
    { label: "Profissionais", value: employees.filter(e => e.is_active).length, icon: Users, gradient: "linear-gradient(135deg, #ffb547, #ffd08a)", shadow: "rgba(255,181,71,0.25)" },
    { label: "Clientes", value: clients.length, icon: UserCheck, gradient: "linear-gradient(135deg, #e879a0, #f0a5bd)", shadow: "rgba(232,121,160,0.25)" },
    { label: "Receita do Mês", value: formatCurrency(monthRevenue), icon: TrendingUp, gradient: "linear-gradient(135deg, #22c997, #2dd4a8)", shadow: "rgba(34,201,151,0.25)" },
    { label: "Despesas do Mês", value: formatCurrency(monthExpenses), icon: CreditCard, gradient: "linear-gradient(135deg, #f25c5c, #f78888)", shadow: "rgba(242,92,92,0.25)" },
    { label: "Receita Total", value: formatCurrency(totalRevenue), icon: DollarSign, gradient: "linear-gradient(135deg, #7c5cfc, #6340e0)", shadow: "rgba(124,92,252,0.25)" },
  ]

  const upcomingApts = appointments
    .filter(a => a.appointment_date >= today && ["confirmed", "pending"].includes(a.status))
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date) || a.appointment_time.localeCompare(b.appointment_time))
    .slice(0, 10)

  const statusColors: Record<string, { bg: string; color: string; border: string }> = {
    confirmed: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
    pending: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
    completed: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    cancelled: { bg: '#fef2f2', color: '#ef4444', border: '#fecaca' },
    in_progress: { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
  }
  const statusLabels: Record<string, string> = {
    confirmed: "Confirmado", pending: "Pendente", completed: "Concluído", cancelled: "Cancelado", in_progress: "Em andamento",
  }

  // Staff Presence
  const staffMembers = employees.filter(e => e.is_active !== false)
  const staffWithPresence = staffMembers.map(e => {
    const isOnline = e.is_online || (e.last_seen && new Date().getTime() - new Date(e.last_seen).getTime() < 5 * 60 * 1000)
    return { ...e, computed_online: isOnline }
  })
  staffWithPresence.sort((a, b) => {
    if (a.computed_online && !b.computed_online) return -1
    if (!a.computed_online && b.computed_online) return 1
    if (a.last_seen && b.last_seen) return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
    if (a.last_seen && !b.last_seen) return -1
    if (!a.last_seen && b.last_seen) return 1
    return a.name.localeCompare(b.name)
  })
  const onlineCount = staffWithPresence.filter(s => s.computed_online).length
  const offlineCount = staffWithPresence.length - onlineCount

  // ── Shared Styles ──
  const card: React.CSSProperties = { background: '#fff', borderRadius: '1rem', border: '1px solid #e8ecf4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }
  const sectionHeader: React.CSSProperties = { padding: '0.875rem 1.25rem', borderBottom: '1px solid #f1f3f9', display: 'flex', alignItems: 'center', gap: '0.75rem' }
  const iconBox = (bg: string): React.CSSProperties => ({ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, flexShrink: 0 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
      {/* ── Welcome Banner ── */}
      <div style={{ padding: 'clamp(2rem, 4vw, 3rem)', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #2a2150 0%, #3d2d7a 40%, #7c5cfc 100%)', borderRadius: '1.25rem' }}>
        <div style={{ position: 'absolute', top: '-4rem', right: '-4rem', width: '16rem', height: '16rem', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', filter: 'blur(32px)' }} />
        <div style={{ position: 'absolute', bottom: '-2rem', left: '20%', width: '12rem', height: '12rem', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', filter: 'blur(24px)' }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1rem', marginBottom: '0.5rem', fontWeight: 500 }}>👋 Olá, bem-vindo!</p>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>Painel de Controle</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem' }}>Acompanhe seus agendamentos, serviços e receitas em tempo real.</p>
        </div>
      </div>

      {/* ── Booking Link ── */}
      <div style={{ ...card, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ ...iconBox('linear-gradient(135deg, #7c5cfc, #a78bfa)'), width: '3rem', height: '3rem', boxShadow: '0 2px 8px rgba(124,92,252,0.25)' }}>
          <Link2 style={{ width: '20px', height: '20px', color: '#fff' }} />
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1e1e2d', marginBottom: '2px' }}>Link de Agendamento</p>
          <p style={{ fontSize: '0.875rem', color: '#8b8fa7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeof window !== 'undefined' ? window.location.origin : '...'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
          <button onClick={() => { navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.origin : ''); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, border: '1px solid #e8ecf4', background: '#fff', color: '#555', cursor: 'pointer', minHeight: '40px', transition: 'all 0.2s' }}>
            {copied ? <Check style={{ width: '16px', height: '16px', color: '#22c997' }} /> : <Copy style={{ width: '16px', height: '16px', color: '#8b8fa7' }} />}
            {copied ? 'Copiado!' : 'Copiar Link'}
          </button>
          <a href="/" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 700, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 2px 8px rgba(124,92,252,0.25)', minHeight: '40px', transition: 'all 0.2s' }}>
            <ExternalLink style={{ width: '16px', height: '16px' }} /> Abrir Página
          </a>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {stats.map((stat, i) => (
          <div key={i} style={{ ...card, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'box-shadow 0.2s', cursor: 'default' }}>
            <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: stat.gradient, boxShadow: `0 4px 12px ${stat.shadow}` }}>
              <stat.icon style={{ width: '24px', height: '24px', color: '#fff' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '0.875rem', color: '#8b8fa7', fontWeight: 500, lineHeight: 1.3, marginBottom: '4px' }}>{stat.label}</p>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 800, color: '#1e1e2d', lineHeight: 1.1 }}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart + Debtors row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Status da Equipe */}
        <div style={card}>
          <div style={{ ...sectionHeader, padding: '1.25rem 1.5rem', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ ...iconBox('#ecfdf5'), width: '2.5rem', height: '2.5rem' }}><UserCheck style={{ width: '20px', height: '20px', color: '#22c997' }} /></div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 700, color: '#1e1e2d' }}>Status da Equipe</h3>
                <p style={{ fontSize: '0.875rem', color: '#8b8fa7' }}>
                  <span style={{ color: '#22c997', fontWeight: 600 }}>{onlineCount} Online</span> • {offlineCount} Offline
                </p>
              </div>
            </div>
          </div>
          <div style={{ maxHeight: '15.5rem', overflowY: 'auto' }}>
            {staffWithPresence.length > 0 ? staffWithPresence.map(staff => {
              const presenceText = staff.computed_online ? "Online" : (staff.last_seen ? (() => {
                const diffMs = new Date().getTime() - new Date(staff.last_seen).getTime()
                const diffMins = Math.floor(diffMs / (60 * 1000))
                if (diffMins < 60) return `há ${diffMins} minutos`
                const diffHours = Math.floor(diffMins / 60)
                if (diffHours < 24) return `há ${diffHours} horas`
                const diffDays = Math.floor(diffHours / 24)
                return `há ${diffDays} dias`
              })() : "Nunca acessou")

              return (
                <div key={staff.id} style={{ padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #f5f5fa' }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b', fontSize: '0.875rem', fontWeight: 700, flexShrink: 0, position: 'relative' }}>
                    {staff.name.charAt(0)}
                    <div style={{ position: 'absolute', bottom: '0', right: '0', width: '10px', height: '10px', borderRadius: '50%', background: staff.computed_online ? '#22c997' : '#cbd5e1', border: '2px solid #fff' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1e1e2d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staff.name}</p>
                    <p style={{ fontSize: '0.8125rem', color: '#8b8fa7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staff.email || staff.google_email || "Sem e-mail"}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {staff.computed_online ? (
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#22c997', background: '#ecfdf5', padding: '0.25rem 0.625rem', borderRadius: '99px' }}>Online</span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>{presenceText}</span>
                    )}
                  </div>
                </div>
              )
            }) : (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.875rem', color: '#8b8fa7' }}>Nenhum membro da equipe encontrado</p>
              </div>
            )}
          </div>
        </div>

        {/* Debtors */}
        <div style={card}>
          <div style={{ ...sectionHeader, padding: '1.25rem 1.5rem' }}>
            <div style={{ ...iconBox('#fef2f2'), width: '2.5rem', height: '2.5rem' }}><AlertTriangle style={{ width: '20px', height: '20px', color: '#ef4444' }} /></div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 700, color: '#1e1e2d' }}>Devedores</h3>
              <p style={{ fontSize: '0.875rem', color: '#8b8fa7' }}>{debtors.length} clientes • Total: {formatCurrency(totalDebt)}</p>
            </div>
          </div>
          {debtors.length > 0 ? (
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {debtors.slice(0, 8).map((client) => (
                <div key={client.id} style={{ padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #f5f5fa' }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#ef4444', fontSize: '0.875rem', fontWeight: 700, flexShrink: 0 }}>
                    {client.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1e1e2d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</p>
                    <p style={{ fontSize: '0.875rem', color: '#8b8fa7' }}>{client.phone}</p>
                  </div>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>{formatCurrency(client.debt_amount || 0)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
              <div style={{ width: '4rem', height: '4rem', borderRadius: '1rem', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Check style={{ width: '28px', height: '28px', color: '#22c997' }} />
              </div>
              <p style={{ fontSize: '1.125rem', fontWeight: 600, color: '#22c997' }}>Nenhum devedor!</p>
              <p style={{ fontSize: '0.875rem', color: '#8b8fa7', marginTop: '0.25rem' }}>Todos os clientes estão em dia</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Upcoming Appointments ── */}
      <div style={card}>
        <div style={{ ...sectionHeader, padding: '1.25rem 1.5rem', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ ...iconBox('#f5f3ff'), width: '2.5rem', height: '2.5rem' }}><Calendar style={{ width: '20px', height: '20px', color: '#7c5cfc' }} /></div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 700, color: '#1e1e2d' }}>Próximos Agendamentos</h3>
              <p style={{ fontSize: '0.875rem', color: '#8b8fa7' }}>{upcomingApts.length} agendamentos futuros</p>
            </div>
          </div>
        </div>

        {upcomingApts.length > 0 ? (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {/* Desktop table header */}
            <div className="hidden md:flex" style={{ padding: '0.75rem 1.5rem', gap: '1.5rem', alignItems: 'center', background: '#fafbfc', borderBottom: '1px solid #f1f3f9' }}>
              <span style={{ width: '4rem', fontSize: '0.75rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data</span>
              <span style={{ flex: 2, fontSize: '0.75rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</span>
              <span style={{ flex: 2, fontSize: '0.75rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Serviço</span>
              <span style={{ width: '5rem', fontSize: '0.75rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Horário</span>
              <span style={{ width: '7rem', fontSize: '0.75rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Status</span>
            </div>

            {upcomingApts.map((apt) => {
              const sc = statusColors[apt.status] || statusColors.pending
              const dateObj = new Date(apt.appointment_date + 'T12:00:00')
              const dayNum = apt.appointment_date.slice(8, 10)
              const monthStr = dateObj.toLocaleDateString('pt-BR', { month: 'short' })
              const employee = employees.find(e => e.id === apt.employee_id)

              return (
                <div key={apt.id} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f5f5fa', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  {/* Date badge */}
                  <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.75rem', background: '#f5f3ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7c5cfc', lineHeight: 1 }}>{dayNum}</span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', marginTop: '2px' }}>{monthStr.replace('.', '')}</span>
                  </div>

                  {/* Client + Service info */}
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1e1e2d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apt.client_name}</p>
                    <p style={{ fontSize: '0.875rem', color: '#8b8fa7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {apt.service_name}{employee ? ` • ${employee.name}` : ''}
                    </p>
                  </div>

                  {/* Time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                    <Clock style={{ width: '16px', height: '16px', color: '#8b8fa7' }} />
                    <span style={{ fontSize: '1rem', fontWeight: 600, color: '#1e1e2d' }}>{apt.appointment_time}</span>
                  </div>

                  {/* Status badge */}
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.375rem 0.875rem', borderRadius: '9999px', whiteSpace: 'nowrap', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, flexShrink: 0 }}>
                    {statusLabels[apt.status] || apt.status}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
            <div style={{ width: '4.5rem', height: '4.5rem', borderRadius: '1.25rem', background: '#f1f3f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <CalendarDays style={{ width: '32px', height: '32px', color: '#8b8fa7' }} />
            </div>
            <p style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1e1e2d' }}>Nenhum agendamento próximo</p>
            <p style={{ fontSize: '0.875rem', color: '#8b8fa7', marginTop: '0.5rem' }}>Os novos agendamentos aparecerão aqui</p>
          </div>
        )}
      </div>
    </div>
  )
}
