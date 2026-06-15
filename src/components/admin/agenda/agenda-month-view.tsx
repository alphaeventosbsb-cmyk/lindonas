"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { Ban } from "lucide-react"
import { useAgendaStore } from "./agenda-store"
import { statusCfg } from "./status-config"
import { toLocalDateStr } from "@/lib/utils"

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export function AgendaMonthView() {
  const store = useAgendaStore()
  const dateObj = new Date(store.selectedDate + 'T12:00:00')
  const year = dateObj.getFullYear()
  const month = dateObj.getMonth()
  const today = toLocalDateStr()

  const filteredApts = store.getFilteredAppointments()

  /* Count appointments per day */
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, { total: number; statuses: Record<string, number>; revenue: number }> = {}
    filteredApts.forEach(apt => {
      if (!map[apt.appointment_date]) {
        map[apt.appointment_date] = { total: 0, statuses: {}, revenue: 0 }
      }
      map[apt.appointment_date].total++
      map[apt.appointment_date].statuses[apt.status] = (map[apt.appointment_date].statuses[apt.status] || 0) + 1
      map[apt.appointment_date].revenue += apt.service_price || 0
    })
    return map
  }, [filteredApts])

  /* Generate calendar */
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPad = firstDay.getDay()
    const days: { date: string; day: number; isCurrentMonth: boolean }[] = []

    const prevLast = new Date(year, month, 0).getDate()
    for (let i = startPad - 1; i >= 0; i--) {
      const d = prevLast - i
      const m = month === 0 ? 11 : month - 1
      const y = month === 0 ? year - 1 : year
      days.push({ date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false })
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: true })
    }
    const rem = 42 - days.length
    for (let d = 1; d <= rem; d++) {
      const m = month === 11 ? 0 : month + 1
      const y = month === 11 ? year + 1 : year
      days.push({ date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false })
    }
    return days
  }, [year, month])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Month title */}
      <div style={{
        padding: '0.75rem 1rem', background: '#fff', borderBottom: '1px solid #e8ecf4',
        flexShrink: 0, textAlign: 'center',
      }}>
        <h3 style={{
          fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 700, color: '#1e1e2d',
        }}>
          {MONTHS[month]} {year}
        </h3>
      </div>

      {/* Weekday headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        background: '#fafbfc', borderBottom: '1px solid #e8ecf4', flexShrink: 0,
      }}>
        {WEEKDAYS.map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: '0.6875rem', fontWeight: 700,
            color: '#8b8fa7', padding: '0.5rem', textTransform: 'uppercase',
            borderRight: i < 6 ? '1px solid #f1f3f9' : 'none',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gridTemplateRows: 'repeat(6, 1fr)', flex: 1, overflow: 'hidden',
      }}>
        {calendarDays.map((day, i) => {
          const isToday = day.date === today
          const isSelected = day.date === store.selectedDate
          const data = appointmentsByDate[day.date]
          const isBlocked = store.blockedDates.find(b => b.date === day.date)

          return (
            <motion.button
              key={i}
              whileHover={{ backgroundColor: '#f5f3ff' }}
              onClick={() => {
                store.setSelectedDate(day.date)
                store.setViewMode('day')
              }}
              style={{
                padding: '0.375rem', textAlign: 'left',
                borderRight: (i + 1) % 7 !== 0 ? '1px solid #f1f3f9' : 'none',
                borderBottom: '1px solid #f1f3f9',
                background: isSelected ? '#faf8ff' : isToday ? '#f0ecff08' : 'transparent',
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                gap: '0.25rem', border: 'none',
                opacity: day.isCurrentMonth ? 1 : 0.35,
                transition: 'all 0.15s', overflow: 'hidden',
                outline: isSelected ? '2px solid #7c5cfc' : 'none',
                outlineOffset: '-2px',
                borderRadius: '0',
              }}
            >
              {/* Day number */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '0.75rem', fontWeight: isToday ? 800 : 600,
                  color: isToday ? '#7c5cfc' : '#374151',
                  width: isToday ? '1.375rem' : 'auto', height: isToday ? '1.375rem' : 'auto',
                  borderRadius: isToday ? '50%' : '0',
                  background: isToday ? '#7c5cfc' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  ...(isToday ? { color: '#fff', fontSize: '0.625rem' } : {}),
                }}>
                  {day.day}
                </span>
                {data && data.total > 0 && (
                  <span style={{
                    fontSize: '0.5rem', fontWeight: 700, color: '#7c5cfc',
                    background: '#f0ecff', padding: '0 0.25rem', borderRadius: '999px',
                  }}>
                    {data.total}
                  </span>
                )}
              </div>

              {/* Status indicators */}
              {data && day.isCurrentMonth && !isBlocked && (
                <div style={{ display: 'flex', gap: '0.125rem', flexWrap: 'wrap' }}>
                  {Object.entries(data.statuses).slice(0, 3).map(([status, count]) => {
                    const sc = statusCfg[status]
                    if (!sc) return null
                    return (
                      <div key={status} style={{
                        width: '100%', height: '3px', borderRadius: '2px',
                        background: sc.dot, opacity: 0.6,
                      }} />
                    )
                  })}
                </div>
              )}

              {/* Blocked indicator */}
              {isBlocked && day.isCurrentMonth && (
                <div style={{ fontSize: '0.5rem', color: '#ef4444', fontWeight: 700, marginTop: 'auto', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
                  <Ban style={{ width: '8px', height: '8px' }} /> Bloqueada
                </div>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
