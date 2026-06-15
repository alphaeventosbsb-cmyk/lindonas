"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { useAgendaStore } from "./agenda-store"
import { statusCfg } from "./status-config"
import { formatCurrency } from "@/lib/utils"
import type { Appointment } from "@/lib/types/database"

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface Props {
  onAction: (action: string, apt: Appointment) => void
  onStatusChange: (id: string, status: string) => void
}

export function AgendaWeekView({ onAction, onStatusChange }: Props) {
  const store = useAgendaStore()
  const selectedDate = new Date(store.selectedDate + 'T12:00:00')

  /* Calculate week range */
  const weekDates = useMemo(() => {
    const start = new Date(selectedDate)
    start.setDate(start.getDate() - start.getDay()) // Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return { date: `${y}-${m}-${day}`, dayName: WEEKDAYS[i], dayNum: d.getDate(), isToday: `${y}-${m}-${day}` === new Date().toISOString().split('T')[0] }
    })
  }, [store.selectedDate])

  const filteredApts = store.getFilteredAppointments()

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Week header */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid #e8ecf4', background: '#fff', flexShrink: 0,
      }}>
        {weekDates.map((wd, i) => {
          const isSelected = wd.date === store.selectedDate
          const dayApts = filteredApts.filter(a => a.appointment_date === wd.date)
          return (
            <button
              key={wd.date}
              onClick={() => {
                store.setSelectedDate(wd.date)
                store.setViewMode('day')
              }}
              style={{
                padding: '0.625rem 0.5rem', textAlign: 'center',
                borderRight: i < 6 ? '1px solid #f1f3f9' : 'none',
                border: 'none', borderBottom: isSelected ? '3px solid #7c5cfc' : '3px solid transparent',
                background: wd.isToday ? '#faf8ff' : 'transparent',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <p style={{
                fontSize: '0.5625rem', fontWeight: 600, color: '#8b8fa7',
                textTransform: 'uppercase',
              }}>
                {wd.dayName}
              </p>
              <p style={{
                fontSize: '1.125rem', fontWeight: wd.isToday ? 800 : 600,
                color: wd.isToday ? '#7c5cfc' : '#1e1e2d',
                fontFamily: 'var(--font-heading)',
              }}>
                {wd.dayNum}
              </p>
              {dayApts.length > 0 && (
                <span style={{
                  fontSize: '0.5625rem', fontWeight: 700, color: '#7c5cfc',
                  background: '#f0ecff', padding: '0.0625rem 0.375rem', borderRadius: '999px',
                }}>
                  {dayApts.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Week content */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        flex: 1, overflow: 'auto',
      }}>
        {weekDates.map((wd, i) => {
          const dayApts = filteredApts.filter(a => a.appointment_date === wd.date)
          dayApts.sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
          
          return (
            <div
              key={wd.date}
              style={{
                borderRight: i < 6 ? '1px solid #f1f3f9' : 'none',
                padding: '0.375rem',
                display: 'flex', flexDirection: 'column', gap: '0.25rem',
                background: wd.isToday ? '#faf8ff' : 'transparent',
                minHeight: '200px',
              }}
            >
              {dayApts.length === 0 ? null : dayApts.map(apt => {
                const sc = statusCfg[apt.status] || statusCfg.pending
                
                let border = sc.border
                let dot = sc.dot
                let bg = '#fff'
                
                const service = store.services.find(s => s.id === apt.service_id)
                if (service?.color_hex) {
                  dot = service.color_hex
                  border = service.color_hex + '55'
                  bg = service.color_hex + '0A'
                }

                return (
                  <motion.div
                    key={apt.id}
                    whileHover={{ scale: 1.02, y: -1 }}
                    onClick={() => store.setSelectedAppointment(apt)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      store.setContextMenu({ appointment: apt, x: e.clientX, y: e.clientY })
                    }}
                    style={{
                      padding: '0.375rem 0.5rem', borderRadius: '0.5rem',
                      background: bg, border: `1px solid ${border}`,
                      borderLeft: `3px solid ${dot}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.125rem' }}>
                      <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: dot }}>
                        {apt.appointment_time}
                      </span>
                      <span style={{ fontSize: '0.5rem', fontWeight: 700, color: '#7c5cfc' }}>
                        {formatCurrency(apt.service_price)}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.625rem', fontWeight: 700, color: '#1e1e2d',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {apt.is_shared_service && <span style={{ color: '#6d28d9', marginRight: '4px' }}>[COMP]</span>}
                      {apt.client_name}
                    </p>
                    <p style={{
                      fontSize: '0.5rem', color: '#8b8fa7',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {apt.service_name}
                    </p>
                  </motion.div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
