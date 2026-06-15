"use client"

import { useMemo, useEffect, useState } from "react"
import { useAgendaStore } from "./agenda-store"
import { toLocalDateStr } from "@/lib/utils"

interface Props {
  searchStr: string
  onSelectDate: (date: string) => void
  onClose: () => void
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function formatLastVisit(lastVisitDate: string | null) {
  if (!lastVisitDate) return ""
  const [y, m, d] = lastVisitDate.split('-').map(Number)
  const visit = new Date(y, m - 1, d)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  visit.setHours(0, 0, 0, 0)
  
  const diffDays = Math.floor((now.getTime() - visit.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "Última visita hoje"
  if (diffDays === 1) return "Última visita ontem"
  if (diffDays < 7) return `Última visita há ${diffDays} dias`
  
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks === 1) return "Última visita há 1 semana"
  if (diffWeeks < 4) return `Última visita há ${diffWeeks} semanas`
  
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return "Última visita há 1 mês"
  return `Última visita há ${diffMonths} meses`
}

export function ClientSearchPopup({ searchStr, onSelectDate, onClose }: Props) {
  const store = useAgendaStore()
  const [delayedSearch, setDelayedSearch] = useState("")

  // Simple debounce
  useEffect(() => {
    const timer = setTimeout(() => setDelayedSearch(searchStr), 100)
    return () => clearTimeout(timer)
  }, [searchStr])

  const results = useMemo(() => {
    const s = normalizeSearch(delayedSearch)
    if (s.length < 1) return null

    const sDigits = onlyDigits(delayedSearch)

    // 1. Find ALL matched clients
    const matchedClients = store.clients.filter(c => {
      const matchName = normalizeSearch(c.name || '').includes(s)
      const matchNick = normalizeSearch(c.nickname || '').includes(s)
      const matchSocial = normalizeSearch((c as any).social_name || '').includes(s)
      const matchEmail = normalizeSearch(c.email || '').includes(s)
      
      const matchPhone = sDigits.length >= 4 && onlyDigits(c.phone || '').includes(sDigits)
      const matchWhatsapp = sDigits.length >= 4 && onlyDigits(c.whatsapp || '').includes(sDigits)
      const matchCpf = sDigits.length >= 4 && onlyDigits(c.cpf || '').includes(sDigits)
      const matchRg = sDigits.length >= 4 && onlyDigits(c.rg || '').includes(sDigits)
      
      return matchName || matchNick || matchSocial || matchEmail || matchPhone || matchWhatsapp || matchCpf || matchRg
    })

    const matchedClientIds = new Set(matchedClients.map(c => c.id))

    // 2. Filter appointments
    let clientAppointments = store.appointments.filter(a => {
        if (a.status === 'cancelled') return false
        if (a.type === 'block' || a.type === 'absence' || a.type === 'free') return false
        
        if (matchedClientIds.size > 0) {
            return a.client_id ? matchedClientIds.has(a.client_id) : false
        }
        
        return normalizeSearch(a.client_name || '').includes(s)
    })

    if (clientAppointments.length === 0) {
      return { isEmpty: true, clientName: "" }
    }

    // Sort ASC by date and time
    clientAppointments.sort((a, b) => {
       const dateA = a.appointment_date + 'T' + (a.appointment_time || '00:00')
       const dateB = b.appointment_date + 'T' + (b.appointment_time || '00:00')
       return dateA.localeCompare(dateB)
    })

    const todayStr = toLocalDateStr()
    
    const todayApts = clientAppointments.filter(a => a.appointment_date === todayStr)
    const futureApts = clientAppointments.filter(a => a.appointment_date > todayStr)
    const pastApts = clientAppointments.filter(a => a.appointment_date < todayStr)
    
    // Sort past appointments DESC (most recent first)
    pastApts.sort((a, b) => {
       const dateA = a.appointment_date + 'T' + (a.appointment_time || '00:00')
       const dateB = b.appointment_date + 'T' + (b.appointment_time || '00:00')
       return dateB.localeCompare(dateA) // DESC
    })

    const pastAptsSliced = pastApts.slice(0, 10)
    const completedPastApts = pastApts.filter(a => a.status === 'completed' || a.status === 'payment_pending')
    const lastVisitApt = completedPastApts.length > 0 ? completedPastApts[0] : null
    
    const lastVisitText = (matchedClients.length === 1 && matchedClients[0].last_visit) 
      ? formatLastVisit(matchedClients[0].last_visit) 
      : formatLastVisit(lastVisitApt?.appointment_date || null)

    const clientName = matchedClients.length === 1 
      ? matchedClients[0].name 
      : (matchedClients.length > 1 ? "Vários clientes encontrados" : (clientAppointments[0]?.client_name || ""))

    return { 
      isEmpty: false,
      todayApts, 
      futureApts, 
      pastApts: pastAptsSliced,
      hasMorePast: pastApts.length > 10,
      lastVisitText,
      clientName
    }
  }, [delayedSearch, store.clients, store.appointments])

  if (!results) return null

  return (
    <div style={{
      position: 'absolute', top: '110%', left: 0, width: '100%', minWidth: '320px',
      background: '#fff', borderRadius: '0.75rem', border: '1px solid #e8ecf4',
      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
      zIndex: 50, overflow: 'hidden', padding: '0.5rem 0',
      maxHeight: '400px', overflowY: 'auto'
    }}>
      {results.isEmpty ? (
        <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#8b8fa7' }}>
          Nenhum resultado encontrado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {results.todayApts && results.todayApts.length > 0 && (
            <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #f1f3f9' }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#7c5cfc', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Hoje
              </p>
              {results.todayApts.map(apt => (
                <div 
                  key={apt.id} 
                  onClick={() => { onSelectDate(apt.appointment_date); onClose() }}
                  style={{ 
                    display: 'flex', flexDirection: 'column', gap: '0.25rem', 
                    padding: '0.75rem', marginBottom: '0.5rem', 
                    background: '#fafbfc', border: '1px solid #e8ecf4', borderRadius: '0.5rem',
                    cursor: 'pointer', transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fafbfc'}
                >
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.125rem' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#fff', background: '#7c5cfc', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                      Hoje
                    </span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#4b5563', background: '#e5e7eb', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                      {apt.appointment_time}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0, overflowWrap: 'anywhere' }}>
                    <strong style={{ color: '#1e1e2d' }}>Cliente:</strong> {apt.client_name}
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0, overflowWrap: 'anywhere' }}>
                    <strong style={{ color: '#1e1e2d' }}>Serviço:</strong> <span style={{ color: '#059669', fontWeight: 600 }}>{apt.service_name}</span>
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0, overflowWrap: 'anywhere' }}>
                    <strong style={{ color: '#1e1e2d' }}>Profissional:</strong> {apt.employee_name || 'Profissional não definido'}
                  </p>
                  {results.lastVisitText && (
                    <p style={{ fontSize: '0.6875rem', color: '#8b8fa7', marginTop: '0.125rem', fontStyle: 'italic', margin: 0 }}>
                      ● {results.lastVisitText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {results.futureApts && results.futureApts.length > 0 && (
            <div style={{ padding: '0.5rem 1rem' }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Outros Agendamentos
              </p>
              {results.futureApts.map(apt => {
                const [y, m, d] = apt.appointment_date.split('-')
                return (
                  <div 
                    key={apt.id} 
                    onClick={() => { onSelectDate(apt.appointment_date); onClose() }}
                    style={{ 
                      display: 'flex', flexDirection: 'column', gap: '0.25rem', 
                      padding: '0.75rem', marginBottom: '0.5rem', 
                      background: '#fafbfc', border: '1px solid #e8ecf4', borderRadius: '0.5rem',
                      cursor: 'pointer', transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fafbfc'}
                  >
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.125rem' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#fff', background: '#64748b', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                        {`${d}/${m}/${y}`}
                      </span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#4b5563', background: '#e5e7eb', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                        {apt.appointment_time}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0, overflowWrap: 'anywhere' }}>
                      <strong style={{ color: '#1e1e2d' }}>Cliente:</strong> {apt.client_name}
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0, overflowWrap: 'anywhere' }}>
                      <strong style={{ color: '#1e1e2d' }}>Serviço:</strong> <span style={{ color: '#059669', fontWeight: 600 }}>{apt.service_name}</span>
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0, overflowWrap: 'anywhere' }}>
                      <strong style={{ color: '#1e1e2d' }}>Profissional:</strong> {apt.employee_name || 'Profissional não definido'}
                    </p>
                    {results.lastVisitText && (
                      <p style={{ fontSize: '0.6875rem', color: '#8b8fa7', marginTop: '0.125rem', fontStyle: 'italic', margin: 0 }}>
                        ● {results.lastVisitText}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {results.pastApts && results.pastApts.length > 0 && (
            <div style={{ padding: '0.5rem 1rem' }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Agendamentos Anteriores
              </p>
              {results.pastApts.map(apt => {
                const [y, m, d] = apt.appointment_date.split('-')
                return (
                  <div 
                    key={apt.id} 
                    onClick={() => { onSelectDate(apt.appointment_date); onClose() }}
                    style={{ 
                      display: 'flex', flexDirection: 'column', gap: '0.25rem', 
                      padding: '0.75rem', marginBottom: '0.5rem', 
                      background: '#fafbfc', border: '1px solid #e8ecf4', borderRadius: '0.5rem',
                      cursor: 'pointer', transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fafbfc'}
                  >
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.125rem' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#fff', background: '#9ca3af', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                        {`${d}/${m}/${y}`}
                      </span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#4b5563', background: '#e5e7eb', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                        {apt.appointment_time}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0, overflowWrap: 'anywhere' }}>
                      <strong style={{ color: '#1e1e2d' }}>Cliente:</strong> {apt.client_name}
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0, overflowWrap: 'anywhere' }}>
                      <strong style={{ color: '#1e1e2d' }}>Serviço:</strong> <span style={{ color: '#059669', fontWeight: 600 }}>{apt.service_name}</span>
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0, overflowWrap: 'anywhere' }}>
                      <strong style={{ color: '#1e1e2d' }}>Profissional:</strong> {apt.employee_name || 'Profissional não definido'}
                    </p>
                  </div>
                )
              })}
              {results.hasMorePast && (
                <p style={{ fontSize: '0.625rem', color: '#8b8fa7', fontStyle: 'italic', marginTop: '0.25rem' }}>
                  Mostrando os últimos 10 agendamentos anteriores.
                </p>
              )}
            </div>
          )}

          {results.todayApts?.length === 0 && results.futureApts?.length === 0 && results.pastApts?.length === 0 && (
            <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#8b8fa7' }}>
              Nenhum agendamento encontrado para este termo.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
