"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight, Lock } from "lucide-react"
import { useAgendaStore } from "./agenda-store"
import { useAgendaSizeStore, type SizePreset } from "./agenda-size-store"
import { ServiceCategoryFilter } from "./service-category-filter"
import { toLocalDateStr } from "@/lib/utils"
import { PermissionGate } from "@/components/ui/permission-gate"

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export function MiniCalendar() {
  const store = useAgendaStore()
  const selectedDate = store.selectedDate
  const dateObj = new Date(selectedDate + 'T12:00:00')
  const year = dateObj.getFullYear()
  const month = dateObj.getMonth()

  const today = toLocalDateStr()

  /* Count appointments per day for indicators */
  const appointmentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    store.appointments.forEach(apt => {
      if (apt.status !== 'closed') {
        counts[apt.appointment_date] = (counts[apt.appointment_date] || 0) + 1
      }
    })
    return counts
  }, [store.appointments])

  /* Generate calendar grid */
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPad = firstDay.getDay()
    
    const days: { date: string; day: number; isCurrentMonth: boolean }[] = []
    
    // Previous month padding
    const prevMonthLast = new Date(year, month, 0).getDate()
    for (let i = startPad - 1; i >= 0; i--) {
      const d = prevMonthLast - i
      const m = month === 0 ? 11 : month - 1
      const y = month === 0 ? year - 1 : year
      days.push({
        date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isCurrentMonth: false,
      })
    }
    
    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isCurrentMonth: true,
      })
    }
    
    // Next month padding
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1
      const y = month === 11 ? year + 1 : year
      days.push({
        date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isCurrentMonth: false,
      })
    }
    
    return days
  }, [year, month])

  const navigateMonth = (dir: number) => {
    const newDate = new Date(year, month + dir, 1)
    store.setSelectedDate(toLocalDateStr(newDate))
  }

  /* Professional summary for selected day */
  const selectedDayApts = store.getAppointmentsForDate(selectedDate)
  const totalRevenue = selectedDayApts.reduce((sum, a) => sum + (a.service_price || 0), 0)

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: '#fafbfc', overflow: 'auto',
    }}>
      {/* Month header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.875rem 1rem 0.5rem',
      }}>
        <button onClick={() => navigateMonth(-1)} style={{
          padding: '0.375rem', borderRadius: '0.5rem', border: 'none',
          background: 'transparent', cursor: 'pointer',
        }}>
          <ChevronLeft style={{ width: '16px', height: '16px', color: '#555' }} />
        </button>
        <p style={{
          fontSize: '0.875rem', fontWeight: 700, color: '#1e1e2d',
          fontFamily: 'var(--font-heading)',
        }}>
          {MONTHS[month]} {year}
        </p>
        <button onClick={() => navigateMonth(1)} style={{
          padding: '0.375rem', borderRadius: '0.5rem', border: 'none',
          background: 'transparent', cursor: 'pointer',
        }}>
          <ChevronRight style={{ width: '16px', height: '16px', color: '#555' }} />
        </button>
      </div>

      {/* Weekday headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        padding: '0 0.75rem', gap: '0',
      }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: '0.5625rem', fontWeight: 700,
            color: '#8b8fa7', textTransform: 'uppercase', padding: '0.25rem 0',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        padding: '0.25rem 0.75rem', gap: '0.125rem',
      }}>
        {calendarDays.map((day, i) => {
          const isSelected = day.date === selectedDate
          const isToday = day.date === today
          const count = appointmentCounts[day.date] || 0
          
          return (
            <button
              key={i}
              onClick={() => store.setSelectedDate(day.date)}
              style={{
                position: 'relative',
                aspectRatio: '1', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '0.0625rem',
                borderRadius: '0.5rem', border: 'none',
                background: isSelected
                  ? 'linear-gradient(135deg, #7c5cfc, #a78bfa)'
                  : isToday ? '#f0ecff' : 'transparent',
                cursor: 'pointer', transition: 'all 0.15s',
                fontSize: '0.6875rem',
                fontWeight: isSelected || isToday ? 700 : day.isCurrentMonth ? 500 : 400,
                color: isSelected ? '#fff' : !day.isCurrentMonth ? '#d1d5db' : isToday ? '#7c5cfc' : '#374151',
              }}
            >
              <span>{day.day}</span>
              {/* Appointment count indicator */}
              {count > 0 && (
                <div style={{
                  display: 'flex', gap: '1px',
                }}>
                  {Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                    <div key={j} style={{
                      width: '3px', height: '3px', borderRadius: '50%',
                      background: isSelected ? 'rgba(255,255,255,0.7)' : '#7c5cfc',
                    }} />
                  ))}
                  {count > 3 && (
                    <span style={{
                      fontSize: '0.375rem', fontWeight: 700,
                      color: isSelected ? 'rgba(255,255,255,0.7)' : '#7c5cfc',
                    }}>
                      +
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Day summary */}
      <div style={{
        padding: '0.75rem 1rem', borderTop: '1px solid #e8ecf4',
        marginTop: 'auto',
      }}>
        <p style={{
          fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem',
        }}>
          Resumo do dia
        </p>

        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <div style={{
            flex: 1, padding: '0.5rem', borderRadius: '0.625rem',
            background: '#f0ecff', textAlign: 'center',
          }}>
            <p style={{ fontSize: '1rem', fontWeight: 800, color: '#7c5cfc' }}>
              {selectedDayApts.length}
            </p>
            <p style={{ fontSize: '0.5rem', fontWeight: 600, color: '#7c5cfc' }}>
              Agendamentos
            </p>
          </div>
          <div style={{
            flex: 1, padding: '0.5rem', borderRadius: '0.625rem',
            background: '#ecfdf5', textAlign: 'center',
          }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 800, color: '#059669' }}>
              R$ {totalRevenue.toFixed(0)}
            </p>
            <p style={{ fontSize: '0.5rem', fontWeight: 600, color: '#059669' }}>
              Faturamento
            </p>
          </div>
        </div>


      </div>

      {/* ── Agenda Size Control ─────────────────────────── */}
      <AgendaSizeControl />

      {/* ── Service Category Filter ─────────────────────── */}
      <ServiceCategoryFilter />

      {/* ── Global Block Button ─────────────────────────── */}
      <PermissionGate permission="agenda.block_time">
        <div style={{ padding: '0.75rem 1rem', marginTop: 'auto', borderTop: '1px solid #e8ecf4' }}>
          <button
            onClick={() => store.setShowGlobalBlockModal(true)}
            style={{
              width: '100%', padding: '0.625rem', borderRadius: '0.5rem',
              border: '1px solid #fecaca', background: '#fef2f2',
              color: '#ef4444', fontSize: '0.6875rem', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '0.375rem', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#fee2e2'
              e.currentTarget.style.borderColor = '#fca5a5'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#fef2f2'
              e.currentTarget.style.borderColor = '#fecaca'
            }}
          >
            <Lock style={{ width: '12px', height: '12px' }} />
            Bloquear horário geral
          </button>
        </div>
      </PermissionGate>
    </div>
  )
}

/* ── Size Preset Button ──────────────────────────────── */
function SizeBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '0.3125rem 0', borderRadius: '0.375rem',
        border: active ? '1.5px solid #7c5cfc' : '1.5px solid #e8ecf4',
        background: active ? 'linear-gradient(135deg, #f5f3ff, #ede9fe)' : '#fff',
        color: active ? '#7c5cfc' : '#8b8fa7',
        fontSize: '0.625rem', fontWeight: 800, cursor: 'pointer',
        transition: 'all 0.15s',
        letterSpacing: '0.02em',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.borderColor = '#c4b5fd'
          e.currentTarget.style.color = '#7c5cfc'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.borderColor = '#e8ecf4'
          e.currentTarget.style.color = '#8b8fa7'
        }
      }}
    >
      {label}
    </button>
  )
}

/* ── Agenda Size Control Panel ───────────────────────── */
function AgendaSizeControl() {
  const sizeStore = useAgendaSizeStore()
  const presets: SizePreset[] = ['PP', 'P', 'M', 'G']

  const hasCustomWidths = Object.keys(sizeStore.customColumnWidths).length > 0

  return (
    <div style={{
      padding: '0.75rem 1rem', borderTop: '1px solid #e8ecf4',
    }}>
      <p style={{
        fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem',
      }}>
        📐 Tamanho da agenda
      </p>

      {/* Row size */}
      <div style={{ marginBottom: '0.5rem' }}>
        <p style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#555', marginBottom: '0.25rem' }}>
          Linha
        </p>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {presets.map(p => (
            <SizeBtn
              key={`row-${p}`}
              label={p}
              active={sizeStore.rowSize === p}
              onClick={() => sizeStore.setRowSize(p)}
            />
          ))}
        </div>
      </div>

      {/* Column size */}
      <div style={{ marginBottom: '0.5rem' }}>
        <p style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#555', marginBottom: '0.25rem' }}>
          Coluna
        </p>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {presets.map(p => (
            <SizeBtn
              key={`col-${p}`}
              label={p}
              active={sizeStore.colSize === p}
              onClick={() => sizeStore.setColSize(p)}
            />
          ))}
        </div>
      </div>

      {/* Reset button */}
      {(sizeStore.rowSize !== 'M' || sizeStore.colSize !== 'P' || hasCustomWidths) && (
        <button
          onClick={() => sizeStore.resetAll()}
          style={{
            width: '100%', padding: '0.3125rem', borderRadius: '0.375rem',
            border: '1px solid #fee2e2', background: '#fff',
            color: '#ef4444', fontSize: '0.5625rem', fontWeight: 700,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#fef2f2'
            e.currentTarget.style.borderColor = '#fca5a5'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#fff'
            e.currentTarget.style.borderColor = '#fee2e2'
          }}
        >
          Resetar tamanho
        </button>
      )}

      {hasCustomWidths && (
        <p style={{ fontSize: '0.5rem', color: '#8b8fa7', marginTop: '0.375rem', lineHeight: 1.3 }}>
          Colunas personalizadas ativas. Alterar o tamanho da coluna vai resetar as personalizações.
        </p>
      )}
    </div>
  )
}
