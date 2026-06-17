"use client"

import { useEffect, useState, useMemo } from "react"
import { fetchCollection } from "@/lib/firebase/client-utils"
import type { Client, Appointment } from "@/lib/types/database"
import { formatCurrency, toLocalDateStr } from "@/lib/utils"
import { Loader2, Trophy, ArrowUpRight, ArrowDownRight, Star, Calendar, Search } from "lucide-react"
import { ExpandableImage } from "@/components/ui/expandable-image"
import { toast } from "sonner"
import { ExportButtons } from "@/components/ui/export-buttons"

type Period = "all" | "today" | "week" | "month" | "year" | "custom"
type SortBy = "visits" | "revenue" | "ticket"

const inputStyle: React.CSSProperties = { padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d', fontSize: '0.875rem', fontWeight: 500, outline: 'none' }

export default function RankingClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>("all")
  const [sortBy, setSortBy] = useState<SortBy>("revenue")

  const [inputStart, setInputStart] = useState(() => {
    const n = new Date(); return toLocalDateStr(new Date(n.getFullYear(), n.getMonth(), 1))
  })
  const [inputEnd, setInputEnd] = useState(() => {
    const n = new Date(); return toLocalDateStr(new Date(n.getFullYear(), n.getMonth() + 1, 0))
  })
  const [customStart, setCustomStart] = useState(inputStart)
  const [customEnd, setCustomEnd] = useState(inputEnd)
  const [isSearching, setIsSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const handleSearch = () => {
    if (inputStart > inputEnd) {
      toast.error("A data inicial não pode ser maior que a data final.")
      return
    }
    if (!inputStart || !inputEnd) {
      toast.warning("Por favor, preencha ambas as datas.")
      return
    }
    setIsSearching(true)
    setTimeout(() => {
      setCustomStart(inputStart)
      setCustomEnd(inputEnd)
      setPeriod("custom")
      setIsSearching(false)
    }, 400)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const load = async () => {
    setLoading(true)
    const [c, a] = await Promise.all([
      fetchCollection<Client>("clients", "name"),
      fetchCollection<Appointment>("appointments"),
    ])
    setClients(c)
    setAppointments(a.filter(apt => apt.status === "completed" || apt.status === "closed"))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const rankingData = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    
    // Filter appointments by period
    const filteredAppointments = appointments.filter(apt => {
      if (period === "all") return true
      const aptDate = apt.appointment_date // YYYY-MM-DD
      
      if (period === "custom") {
        return aptDate >= customStart && aptDate <= customEnd
      }

      if (period === "today") return aptDate === todayStr
      
      const aptD = new Date(aptDate)
      if (period === "week") {
        const weekAgo = new Date()
        weekAgo.setDate(now.getDate() - 7)
        return aptD >= weekAgo
      }
      if (period === "month") {
        return aptD.getMonth() === now.getMonth() && aptD.getFullYear() === now.getFullYear()
      }
      if (period === "year") {
        return aptD.getFullYear() === now.getFullYear()
      }
      return true
    })

    // Group by client
    const stats: Record<string, { visits: number, revenue: number, lastVisit: string | null }> = {}
    clients.forEach(c => {
      stats[c.id] = { visits: 0, revenue: 0, lastVisit: c.last_visit }
    })

    filteredAppointments.forEach(apt => {
      if (apt.client_id && stats[apt.client_id]) {
        stats[apt.client_id].visits += 1
        stats[apt.client_id].revenue += apt.service_price || 0
      } else {
        // Fallback matching by name
        const c = clients.find(cl => cl.name.toLowerCase() === apt.client_name.toLowerCase())
        if (c && stats[c.id]) {
          stats[c.id].visits += 1
          stats[c.id].revenue += apt.service_price || 0
        }
      }
    })

    let data = clients.map(c => {
      const s = stats[c.id]
      const visits = period === "all" ? Math.max(c.appointment_count || 0, s.visits) : s.visits
      const revenue = period === "all" ? Math.max(c.total_spent || 0, s.revenue) : s.revenue
      const ticket = visits > 0 ? revenue / visits : 0
      return { ...c, stats: { visits, revenue, ticket, lastVisit: s.lastVisit } }
    }).filter(c => c.stats.visits > 0 || c.stats.revenue > 0)

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      data = data.filter(c => 
        c.name.toLowerCase().includes(term) || 
        (c.phone && c.phone.replace(/\D/g, '').includes(term.replace(/\D/g, '')))
      )
    }

    data.sort((a, b) => {
      if (sortBy === "revenue") return b.stats.revenue - a.stats.revenue
      if (sortBy === "visits") return b.stats.visits - a.stats.visits
      return b.stats.ticket - a.stats.ticket
    })

    return data
  }, [clients, appointments, period, sortBy, customStart, customEnd, searchTerm])

  const exportConfig = {
    title: `Ranking de Clientes (${period === "custom" ? `${customStart.split('-').reverse().join('/')} a ${customEnd.split('-').reverse().join('/')}` : period})`,
    fileName: `ranking_clientes_${period === "custom" ? "personalizado" : period}`,
    data: rankingData.map((c, idx) => ({ ...c, position: idx + 1 })),
    columns: [
      { header: "Posição", key: "position" },
      { header: "Cliente", key: "name", format: (v: any, row: any) => `${v}${row.is_vip ? " (VIP)" : ""}` },
      { header: "Telefone", key: "phone", format: (v: any) => v || "—" },
      { header: "Visitas", key: "stats", format: (v: any) => String(v.visits) },
      { header: "Ticket Médio", key: "stats", format: (v: any) => formatCurrency(v.ticket) },
      { header: "Faturamento", key: "stats", format: (v: any) => formatCurrency(v.revenue) },
      { header: "Última Visita", key: "stats", format: (v: any) => v.lastVisit ? new Date(v.lastVisit).toLocaleDateString('pt-BR') : "—" }
    ]
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" /></div>

  const topClient = rankingData[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top 3 Highlights */}
      {rankingData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {rankingData.slice(0, 3).map((client, idx) => (
            <div key={client.id} style={{ background: idx === 0 ? 'linear-gradient(135deg, #7c5cfc, #a78bfa)' : '#fff', borderRadius: '1rem', padding: '1.5rem', border: idx === 0 ? 'none' : '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', position: 'relative', overflow: 'hidden' }}>
              {idx === 0 && <Trophy style={{ position: 'absolute', right: '-1rem', top: '-1rem', width: '6rem', height: '6rem', color: 'rgba(255,255,255,0.1)' }} />}
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: idx === 0 ? '#fff' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.25rem', color: idx === 0 ? '#7c5cfc' : '#1e293b' }}>
                  {idx + 1}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: idx === 0 ? '#fff' : '#1e293b', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    {client.name} {client.is_vip && <Star style={{ width: '14px', height: '14px', color: idx === 0 ? '#fcd34d' : '#d97706', fill: idx === 0 ? '#fcd34d' : '#d97706' }} />}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: idx === 0 ? 'rgba(255,255,255,0.8)' : '#64748b' }}>Última visita: {client.stats.lastVisit ? new Date(client.stats.lastVisit).toLocaleDateString('pt-BR') : 'N/A'}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ background: idx === 0 ? 'rgba(255,255,255,0.2)' : '#f8fafc', padding: '0.75rem', borderRadius: '0.75rem' }}>
                  <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 700, color: idx === 0 ? 'rgba(255,255,255,0.9)' : '#64748b' }}>Total Gasto</p>
                  <p style={{ fontSize: '1rem', fontWeight: 800, color: idx === 0 ? '#fff' : '#059669' }}>{formatCurrency(client.stats.revenue)}</p>
                </div>
                <div style={{ background: idx === 0 ? 'rgba(255,255,255,0.2)' : '#f8fafc', padding: '0.75rem', borderRadius: '0.75rem' }}>
                  <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 700, color: idx === 0 ? 'rgba(255,255,255,0.9)' : '#64748b' }}>Visitas</p>
                  <p style={{ fontSize: '1rem', fontWeight: 800, color: idx === 0 ? '#fff' : '#1e293b' }}>{client.stats.visits}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e5e7eb', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', marginBottom: '0.375rem', textTransform: 'uppercase' }}>Filtro Rápido</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar style={{ width: '1.25rem', height: '1.25rem', color: '#64748b' }} />
              <select value={period} onChange={e => setPeriod(e.target.value as Period)}
                style={inputStyle}>
                <option value="all">Todo o Período</option>
                <option value="today">Hoje</option>
                <option value="week">Esta Semana</option>
                <option value="month">Este Mês</option>
                <option value="year">Este Ano</option>
                {period === "custom" && <option value="custom">Personalizado</option>}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', marginBottom: '0.375rem', textTransform: 'uppercase' }}>Período De</label>
            <input type="date" value={inputStart} onChange={e => setInputStart(e.target.value)} onKeyDown={handleKeyDown} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', marginBottom: '0.375rem', textTransform: 'uppercase' }}>Até</label>
            <input type="date" value={inputEnd} onChange={e => setInputEnd(e.target.value)} onKeyDown={handleKeyDown} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button 
              onClick={handleSearch} 
              disabled={isSearching} 
              title="Pesquisar período"
              style={{ 
                height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', 
                padding: '0 1rem', borderRadius: '0.75rem', border: 'none', background: '#7c5cfc', color: '#fff', 
                fontWeight: 700, cursor: isSearching ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(124,92,252,0.2)'
              }}
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', position: 'relative', marginLeft: '0.5rem' }}>
            <Search style={{ width: '1rem', height: '1rem', color: '#94a3b8', position: 'absolute', left: '0.75rem', bottom: '0.875rem' }} />
            <input 
              type="text" 
              placeholder="Buscar cliente..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '2.25rem', width: '220px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
             <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', marginBottom: '0.375rem', textTransform: 'uppercase' }}>Ordenar por</label>
             <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
              style={inputStyle}>
              <option value="revenue">Maior Faturamento</option>
              <option value="visits">Mais Visitas</option>
              <option value="ticket">Maior Ticket Médio</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', height: '42px' }}>
            <ExportButtons 
              data={exportConfig.data}
              columns={exportConfig.columns}
              fileName={exportConfig.fileName}
              title={exportConfig.title}
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '1rem 1.25rem', textAlign: 'center', width: '60px', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Pos</th>
              <th style={{ padding: '1rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Cliente</th>
              <th style={{ padding: '1rem 1.25rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Visitas</th>
              <th style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Ticket Médio</th>
              <th style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Faturamento</th>
            </tr>
          </thead>
          <tbody>
            {rankingData.map((client, idx) => (
              <tr key={client.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '2rem', height: '2rem', borderRadius: '0.5rem', background: idx < 3 ? '#fef3c7' : '#f1f5f9', color: idx < 3 ? '#d97706' : '#64748b', fontWeight: 700, fontSize: '0.875rem' }}>
                    {idx + 1}
                  </span>
                </td>
                <td style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {client.photo_url ? (
                      <ExpandableImage src={client.photo_url} alt={client.name} style={{ width: '2rem', height: '2rem', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: '#e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem' }}>
                        {client.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {client.name}
                        {client.is_vip && <Star style={{ width: '12px', height: '12px', color: '#d97706', fill: '#d97706' }} />}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{client.phone}</p>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1rem 1.25rem', textAlign: 'center', fontWeight: 600, color: '#334155' }}>
                  {client.stats.visits}
                </td>
                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>
                  {formatCurrency(client.stats.ticket)}
                </td>
                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                  {formatCurrency(client.stats.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rankingData.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            Nenhum dado encontrado para o período selecionado.
          </div>
        )}
      </div>
    </div>
  )
}
