"use client"
import { useState, useEffect, useMemo } from "react"
import { fetchCollection } from "@/lib/firebase/client-utils"
import { getDb } from "@/lib/firebase/config"
import { collection, getDocs, query, orderBy, limit, where } from "firebase/firestore"
import type { HistoryEvent } from "@/lib/firebase/history-service"
import type { Client, Employee } from "@/lib/types/database"
import { Search, History, Calendar, User, UserCog, Filter, Loader2, ArrowRight } from "lucide-react"
import { useTenant } from "@/lib/auth/tenant-context"

const getSafeDisplayName = (evt: any) => {
  const isMaster = evt.performed_by_email === 'carbeto34@gmail.com' || evt.performed_by_email === 'alphaeventosbsb@gmail.com';
  const nameLower = (evt.performed_by_name || "").toLowerCase();
  
  if (nameLower.includes('katia')) {
    if (evt.performed_by_email === 'alphaeventosbsb@gmail.com') return 'Alpha / Admin';
    return 'Carbeto / Admin'; // Default fallback for old records missing email
  }
  
  if (isMaster) {
     return evt.performed_by_email === 'carbeto34@gmail.com' ? 'Carbeto / Admin' : 'Alpha / Admin';
  }
  
  return evt.performed_by_name || evt.performed_by_email || 'Sistema';
}

export function HistoricoPage() {
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchClient, setSearchClient] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("")
  const [dateStart, setDateStart] = useState("")
  const [dateEnd, setDateEnd] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const [cli, emp] = await Promise.all([
          fetchCollection<Client>("clients"),
          fetchCollection<Employee>("employees")
        ])
        setClients(cli)
        setEmployees(emp)

        // Load recent events (max 500 for performance)
        const q = query(collection(getDb(), "appointment_history"), orderBy("created_at", "desc"), limit(500))
        const snapshot = await getDocs(q)
        const recentEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as HistoryEvent)
        setEvents(recentEvents)
      } catch (err) {
        console.error("Erro ao carregar histórico", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (searchClient && e.client_name && !e.client_name.toLowerCase().includes(searchClient.toLowerCase())) return false
      
      // Ação segura contra null/undefined e com mapeamento robusto
      if (actionFilter && actionFilter !== "all") {
        const typeStr = (e.action_type || "").toLowerCase()
        const titleStr = (e.action_title || "").toLowerCase()
        let matched = false
        
        switch (actionFilter) {
          case 'APPOINTMENT_DELETED':
            matched = typeStr.includes('delete') || titleStr.includes('excluído')
            break
          case 'APPOINTMENT_CREATED':
            matched = typeStr.includes('create') || (titleStr.includes('agendamento criado') && !titleStr.includes('apoio'))
            break
          case 'STATUS_CHANGED':
            matched = typeStr.includes('status') || titleStr.includes('status alterado')
            break
          case 'APPOINTMENT_MOVED':
            matched = (typeStr.includes('move') || titleStr.includes('movido na agenda')) && !titleStr.includes('recortar')
            break
          case 'GLOBAL_TIME_RELEASED':
            matched = titleStr.includes('liberação de horário geral')
            break
          case 'GLOBAL_TIME_BLOCKED':
            matched = titleStr.includes('bloqueio de horário geral')
            break
          case 'TOTAL_VALUE_UPDATED':
            matched = titleStr.includes('valor total')
            break
          case 'SUPPORT_APPOINTMENT_CREATED':
            matched = titleStr.includes('apoio')
            break
          case 'SPLIT_UPDATED':
            matched = titleStr.includes('rateio')
            break
          case 'PAYMENT_CLOSED':
            matched = titleStr.includes('pagamento')
            break
          case 'MOVED_BY_CUT_AND_PASTE':
            matched = titleStr.includes('recortar e colar')
            break
          case 'SERVICES_ADDED':
            matched = titleStr.includes('serviços adicionados') || typeStr.includes('service_add')
            break
          case 'APPOINTMENT_UPDATED':
            matched = typeStr === 'update' || titleStr.includes('editado')
            break
          case 'TIME_RELEASED':
            matched = typeStr === 'free' || (titleStr.includes('liberação de horário') && !titleStr.includes('geral'))
            break
          case 'TIME_BLOCKED':
            matched = typeStr === 'block' || (titleStr.includes('bloqueio') && !titleStr.includes('geral'))
            break
          default:
            matched = typeStr === actionFilter.toLowerCase() || titleStr === actionFilter.toLowerCase()
        }
        if (!matched) return false
      }

      if (userFilter && e.performed_by_name && !e.performed_by_name.toLowerCase().includes(userFilter.toLowerCase())) return false
      if (dateStart && new Date(e.created_at) < new Date(dateStart + "T00:00:00")) return false
      if (dateEnd && new Date(e.created_at) > new Date(dateEnd + "T23:59:59")) return false
      return true
    })
  }, [events, searchClient, actionFilter, userFilter, dateStart, dateEnd])

  const ACTION_OPTIONS = [
    { label: 'Todas', value: 'all' },
    { label: 'Agendamento excluído', value: 'APPOINTMENT_DELETED' },
    { label: 'Agendamento criado', value: 'APPOINTMENT_CREATED' },
    { label: 'Status alterado', value: 'STATUS_CHANGED' },
    { label: 'Movido na agenda', value: 'APPOINTMENT_MOVED' },
    { label: 'Liberação de Horário Geral', value: 'GLOBAL_TIME_RELEASED' },
    { label: 'Bloqueio de Horário Geral', value: 'GLOBAL_TIME_BLOCKED' },
    { label: 'Valor total atualizado', value: 'TOTAL_VALUE_UPDATED' },
    { label: 'Agendamento criado (Apoio)', value: 'SUPPORT_APPOINTMENT_CREATED' },
    { label: 'Rateio atualizado', value: 'SPLIT_UPDATED' },
    { label: 'Pagamento fechado', value: 'PAYMENT_CLOSED' },
    { label: 'Movido via Recortar e Colar', value: 'MOVED_BY_CUT_AND_PASTE' },
    { label: 'Serviços adicionados', value: 'SERVICES_ADDED' },
    { label: 'Agendamento editado', value: 'APPOINTMENT_UPDATED' },
    { label: 'Liberação de Horário', value: 'TIME_RELEASED' },
    { label: 'Bloqueio de Horário', value: 'TIME_BLOCKED' }
  ]

  const [selectedEvent, setSelectedEvent] = useState<HistoryEvent | null>(null)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <Loader2 style={{ width: '2rem', height: '2rem', color: '#7c5cfc', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    padding: '0.625rem 0.875rem', borderRadius: '0.625rem', border: '1px solid #e2e8f0',
    fontSize: '0.8125rem', color: '#1e1e2d', background: '#fff', outline: 'none'
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History style={{ color: '#7c5cfc' }} /> Histórico de Agendamentos
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>Auditoria completa de todas as ações no sistema.</p>
      </div>

      {/* Filters */}
      <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', flex: 1, minWidth: '200px' }}>
          <label style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Cliente</label>
          <input type="text" value={searchClient} onChange={e => setSearchClient(e.target.value)} placeholder="Nome do cliente..." style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', flex: 1, minWidth: '150px' }}>
          <label style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Ação</label>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={inputStyle}>
            {ACTION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', flex: 1, minWidth: '150px' }}>
          <label style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Usuário / Recepcionista</label>
          <input type="text" value={userFilter} onChange={e => setUserFilter(e.target.value)} placeholder="Quem fez a ação..." style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Início</label>
          <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Fim</label>
          <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {/* Compact List */}
      <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {filteredEvents.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            Nenhum registro encontrado com estes filtros.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Table Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1.5fr 2fr 1fr', gap: '1rem', padding: '1rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              <div>Data e Hora</div>
              <div>Ação / Cliente</div>
              <div>Descrição Básica</div>
              <div>Usuário</div>
            </div>
            
            {/* Table Rows */}
            {filteredEvents.map((evt, i) => (
              <div key={evt.id} onClick={() => setSelectedEvent(evt)} style={{
                display: 'grid', gridTemplateColumns: '120px 1.5fr 2fr 1fr', gap: '1rem', padding: '1rem 1.5rem',
                borderBottom: i < filteredEvents.length - 1 ? '1px solid #f1f5f9' : 'none',
                alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s',
                background: '#fff'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b' }}>
                    {new Date(evt.created_at).toLocaleDateString('pt-BR')}
                  </p>
                  <p style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                    {new Date(evt.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#166534' }}>{evt.action_title}</p>
                  {evt.client_name && <p style={{ fontSize: '0.75rem', color: '#7c5cfc', fontWeight: 600 }}>{evt.client_name}</p>}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {evt.action_description}
                </div>
                <div>
                  <p style={{ fontSize: '0.8125rem', color: '#1e293b', fontWeight: 600 }}>{getSafeDisplayName(evt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEvent && (
        <>
          <div onClick={() => setSelectedEvent(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9998, animation: 'modalFadeIn 0.2s' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', padding: '2rem', borderRadius: '1.5rem', width: '90%', maxWidth: '500px', zIndex: 9999, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', animation: 'modalScaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.25rem 0.625rem', borderRadius: '999px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                  {selectedEvent.action_title}
                </span>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.75rem', fontWeight: 600 }}>
                  {new Date(selectedEvent.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <button onClick={() => setSelectedEvent(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '0.5rem', padding: '0.375rem', cursor: 'pointer' }}>
                <span style={{ color: '#64748b', fontWeight: 800 }}>X</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>O que aconteceu</p>
                <p style={{ fontSize: '0.9375rem', color: '#1e293b', fontWeight: 500, lineHeight: 1.5, marginTop: '0.25rem' }}>
                  {selectedEvent.action_description}
                </p>
              </div>

              {selectedEvent.client_name && (
                <div>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Cliente Afetado</p>
                  <p style={{ fontSize: '0.9375rem', color: '#7c5cfc', fontWeight: 600, marginTop: '0.25rem' }}>
                    {selectedEvent.client_name}
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <div>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <UserCog style={{ width: '12px', height: '12px' }} /> Quem fez a ação
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 600, marginTop: '0.25rem' }}>
                    {getSafeDisplayName(selectedEvent)}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Cargo: {selectedEvent.performed_by_role || 'Padrão'}
                  </p>
                </div>
                {selectedEvent.professional_name && (
                  <div>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <User style={{ width: '12px', height: '12px' }} /> Profissional da agenda
                    </p>
                    <p style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 600, marginTop: '0.25rem' }}>
                      {selectedEvent.professional_name}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
