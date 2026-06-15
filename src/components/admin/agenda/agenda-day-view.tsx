"use client"

import { useMemo, useRef, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Maximize2, Minimize2 } from "lucide-react"
import { useAgendaStore } from "./agenda-store"
import { AppointmentCard } from "./appointment-card"
import type { Appointment, Employee } from "@/lib/types/database"
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, useDroppable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core"
import { useState } from "react"
import { useAgendaSizeStore } from "./agenda-size-store"
import { updateAppointment } from "@/lib/firebase/client-utils"
import { useTenant } from "@/lib/auth/tenant-context"
import { toast } from "sonner"
import { checkBusinessRules } from "@/lib/utils"
import { useConfirm } from "@/components/ui/confirm-modal"

// Dynamic sizes — these are now read from the size store at render time
// SLOT_HEIGHT and COLUMN_WIDTH are no longer constants

interface Props {
  onStatusChange: (id: string, status: string) => void
  onAction: (action: string, apt: Appointment) => void
  onMove: (appointmentId: string, newEmployeeId: string, newTime?: string) => void
}

export function AgendaDayView({ onStatusChange, onAction, onMove }: Props) {
  const store = useAgendaStore()
  const sizeStore = useAgendaSizeStore()
  const { saasUser } = useTenant()
  const gridRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [draggingApt, setDraggingApt] = useState<Appointment | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const selectedDate = useAgendaStore(s => s.selectedDate)
  const { ConfirmationDialog, confirm } = useConfirm()

  // Dynamic sizes from store
  const SLOT_HEIGHT = sizeStore.getSlotHeight()

  const activeEmployees = store.getActiveEmployees()
  const dayAppointments = store.getAppointmentsForDate(selectedDate)

  // Measure container width for expanded mode alignment
  useEffect(() => {
    const el = containerRef.current || gridRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    setContainerWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Calculate column width for expanded mode — single source of truth
  const TIME_COL_WIDTH = 60
  const hasUnassigned = useMemo(() => {
    const map: Record<string, boolean> = {}
    dayAppointments.forEach(apt => {
      const empId = apt.employee_id || 'unassigned'
      if (!activeEmployees.find(e => e.id === empId)) map['unassigned'] = true
    })
    return !!map['unassigned']
  }, [dayAppointments, activeEmployees])

  const totalCols = activeEmployees.length + (hasUnassigned ? 1 : 0)
  const expandedColWidth = useMemo(() => {
    if (!store.expanded || containerWidth <= 0 || totalCols <= 0) return 0
    const available = containerWidth - TIME_COL_WIDTH
    return Math.max(Math.floor(available / totalCols), 90)
  }, [store.expanded, containerWidth, totalCols])

  // Resolve the actual column width to use per professional
  const getResolvedColumnWidth = useCallback((empId: string) => {
    const baseWidth = sizeStore.getColumnWidth(empId)
    if (store.expanded && expandedColWidth > 0) {
      return Math.max(expandedColWidth, baseWidth)
    }
    return baseWidth
  }, [sizeStore, store.expanded, expandedColWidth])

  // Helper: get card height using current dynamic SLOT_HEIGHT
  const getCardHeight = useCallback((durationMinutes: number): number => {
    return Math.max((durationMinutes / 30) * SLOT_HEIGHT, SLOT_HEIGHT * 0.8)
  }, [SLOT_HEIGHT])

  /* --- Dynamic Bounds Logic --- */
  const bounds = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00')
    const dayOfWeek = d.getDay()
    
    // 1. Start with business hours from settings (primary source)
    let minHour = -1
    let maxHour = -1
    
    const bh = store.businessHours.find(b => b.day_of_week === dayOfWeek)
    if (bh && bh.is_active && bh.start_time && bh.end_time) {
      minHour = parseInt(bh.start_time.split(':')[0])
      const endMin = parseInt(bh.end_time.split(':')[1] || '0')
      maxHour = parseInt(bh.end_time.split(':')[0]) + (endMin > 0 ? 1 : 0)
    }
    
    // 2. If no business hours configured, use fallback 08:00-18:00
    if (minHour < 0 || maxHour < 0) {
      minHour = 8
      maxHour = 18
    }

    // 3. Expand grid only if appointments exist outside business hours
    dayAppointments.forEach(apt => {
      if (apt.appointment_time) {
        const h = parseInt(apt.appointment_time.split(':')[0])
        if (h < minHour) minHour = h
        if (apt.end_time) {
          const endMin = parseInt(apt.end_time.split(':')[1] || '0')
          const hEnd = parseInt(apt.end_time.split(':')[0]) + (endMin > 0 ? 1 : 0)
          if (hEnd > maxHour) maxHour = hEnd
        } else {
          if (h + 1 > maxHour) maxHour = h + 1
        }
      }
    })

    // 4. Safety bounds
    if (minHour < 0) minHour = 0
    if (maxHour > 24) maxHour = 24
    if (minHour >= maxHour) { minHour = 8; maxHour = 18 }

    // Expand bounds to fill viewport better only when expanded
    if (store.expanded) {
      minHour = Math.min(minHour, 7)
      maxHour = Math.max(maxHour, 22)
    }

    return { start: minHour, end: maxHour }
  }, [store.businessHours, selectedDate, dayAppointments, store.expanded])

  const timeSlots = useMemo(() => {
    const slots: string[] = []
    for (let h = bounds.start; h < bounds.end; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
      slots.push(`${String(h).padStart(2, '0')}:30`)
    }
    return slots
  }, [bounds])

  const getCardPosition = useCallback((time: string) => {
    const [h, m] = time.split(':').map(Number)
    const minutesFromStart = (h - bounds.start) * 60 + m
    return (minutesFromStart / 30) * SLOT_HEIGHT
  }, [bounds.start, SLOT_HEIGHT])

  const getCurrentTimePosition = useCallback(() => {
    const now = new Date()
    const h = now.getHours()
    const m = now.getMinutes()
    if (h < bounds.start || h >= bounds.end) return null
    const minutesFromStart = (h - bounds.start) * 60 + m
    return (minutesFromStart / 30) * SLOT_HEIGHT
  }, [bounds.start, bounds.end, SLOT_HEIGHT])

  const [currentTimePos, setCurrentTimePos] = useState<number | null>(null)


  /* Update current time indicator */
  useEffect(() => {
    setCurrentTimePos(getCurrentTimePosition())
    const interval = setInterval(() => {
      setCurrentTimePos(getCurrentTimePosition())
    }, 30000) // update every 30s
    return () => clearInterval(interval)
  }, [getCurrentTimePosition])

  /* Auto-scroll to current time or 8am on load / date change */
  const scrollDateRef = useRef(selectedDate)
  useEffect(() => {
    scrollDateRef.current = selectedDate
    if (gridRef.current) {
      const timePos = getCurrentTimePosition()
      if (timePos !== null) {
        const scrollTo = Math.max(0, timePos - 150)
        setTimeout(() => {
          gridRef.current?.scrollTo({ top: scrollTo, behavior: 'smooth' })
        }, 100)
      } else {
        // Scroll to 8am area
        const eightAm = 2 * SLOT_HEIGHT // Assuming 8am is the second hour from 6am or so, we rely on scroll target
        setTimeout(() => {
          gridRef.current?.scrollTo({ top: eightAm, behavior: 'smooth' })
        }, 100)
      }
    }
  }, [selectedDate, getCurrentTimePosition])

  /* DnD sensors */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const apt = dayAppointments.find(a => a.id === event.active.id)
    if (apt) setDraggingApt(apt)
  }, [dayAppointments])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingApt(null)
    const { active, over } = event
    if (!over) return

    const overId = String(over.id)
    let newEmployeeId: string | undefined
    let newTime: string | undefined

    if (overId.startsWith('slot-')) {
      // Format: slot-{employeeId}-{HH:MM}
      const firstDash = overId.indexOf('-')
      const rest = overId.slice(firstDash + 1)
      // Find the last dash before the time (time is always HH:MM, 5 chars)
      const timePart = rest.slice(-5) // HH:MM
      const empPart = rest.slice(0, rest.length - 6) // everything before "-HH:MM"
      newEmployeeId = empPart
      newTime = timePart
    } else if (overId.startsWith('employee-')) {
      newEmployeeId = overId.replace('employee-', '')
    }

    if (newEmployeeId) {
      onMove(String(active.id), newEmployeeId, newTime)
    }
  }, [onMove])

  /* Group appointments by employee */
  const appointmentsByEmployee = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    activeEmployees.forEach(emp => { map[emp.id] = [] })
    map['unassigned'] = []

    dayAppointments.forEach(apt => {
      const empId = apt.employee_id || 'unassigned'
      if (map[empId]) {
        map[empId].push(apt)
      } else {
        map['unassigned'].push(apt)
      }
    })
    return map
  }, [dayAppointments, activeEmployees])

  const isToday = selectedDate === new Date().toISOString().split('T')[0]

  if (activeEmployees.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Nenhum profissional disponível neste dia.</p>
        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Todos os profissionais estão de folga ou não trabalham nesta data.</p>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <style>{`
        .agenda-scroll-container {
          scrollbar-width: thin;
          scrollbar-color: #c4b5fd #f1f3f9;
        }
        .agenda-scroll-container::-webkit-scrollbar {
          height: 14px;
          width: 14px;
        }
        .agenda-scroll-container::-webkit-scrollbar-track {
          background: #f8f9fc;
          border-radius: 8px;
        }
        .agenda-scroll-container::-webkit-scrollbar-thumb {
          background-color: #a78bfa;
          border-radius: 8px;
          border: 3px solid #f8f9fc;
        }
        .agenda-scroll-container::-webkit-scrollbar-thumb:hover {
          background-color: #7c5cfc;
        }
      `}</style>
      <div 
        ref={(el) => {
          (gridRef as any).current = el;
          (containerRef as any).current = el;
        }}
        className="agenda-scroll-container"
        style={{ 
          height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column',
          scrollBehavior: 'smooth', position: 'relative'
        }}
      >
        {/* Professional headers — sticky */}
        <div style={{
          display: 'flex', flexShrink: 0, borderBottom: '1px solid #e8ecf4',
          background: '#fff', position: 'sticky', top: 0, zIndex: 20,
          width: 'max-content', minWidth: '100%'
        }}>
          {/* Time ruler header / Expand Toggle */}
          <div style={{
            position: 'sticky', left: 0, zIndex: 30,
            width: '60px', minWidth: '60px', flexShrink: 0,
            borderRight: '1px solid #e8ecf4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: store.expanded ? '#f5f3ff' : '#fff',
            transition: 'background 0.2s',
          }}>
            <button
              onClick={() => store.toggleExpanded()}
              title={store.expanded ? 'Retrair agenda' : 'Expandir agenda'}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '0.375rem', borderRadius: '0.375rem',
                border: store.expanded ? '1px solid #c4b5fd' : '1px solid transparent',
                background: store.expanded ? 'linear-gradient(135deg, #f5f3ff, #ede9fe)' : 'transparent',
                cursor: 'pointer', transition: 'all 0.15s ease',
                boxShadow: store.expanded ? '0 2px 8px rgba(124,92,252,0.15)' : 'none',
              }}
              onMouseEnter={e => {
                if (!store.expanded) {
                  e.currentTarget.style.background = '#fafbfc'
                  e.currentTarget.style.border = '1px solid #e8ecf4'
                }
              }}
              onMouseLeave={e => {
                if (!store.expanded) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.border = '1px solid transparent'
                }
              }}
            >
              {store.expanded ? (
                <Minimize2 style={{ width: '14px', height: '14px', color: '#7c5cfc' }} />
              ) : (
                <Maximize2 style={{ width: '14px', height: '14px', color: '#8b8fa7' }} />
              )}
            </button>
          </div>

          {/* Employee headers */}
          <div style={{ display: 'flex', flex: 1 }}>
            {activeEmployees.map((emp, i) => (
              <ProfessionalHeader key={emp.id} employee={emp} count={appointmentsByEmployee[emp.id]?.length || 0} index={i} columnWidth={getResolvedColumnWidth(emp.id)} expandedColWidth={expandedColWidth} />
            ))}
            {/* Unassigned column */}
            {appointmentsByEmployee['unassigned']?.length > 0 && (
              <div style={{
                flex: store.expanded && expandedColWidth > 0 ? `0 0 ${Math.max(expandedColWidth, sizeStore.getDefaultColumnWidth())}px` : `0 0 ${sizeStore.getDefaultColumnWidth()}px`,
                minWidth: `${sizeStore.getDefaultColumnWidth()}px`,
                maxWidth: store.expanded && expandedColWidth > 0 ? `${Math.max(expandedColWidth, sizeStore.getDefaultColumnWidth())}px` : `${sizeStore.getDefaultColumnWidth()}px`,
                padding: '0.375rem 0.5rem', borderRight: '1px solid #f1f3f9',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <div style={{
                  width: '2rem', height: '2rem', borderRadius: '0.625rem',
                  background: '#f1f3f9', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#8b8fa7',
                }}>?</div>
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8b8fa7' }}>Sem profissional</p>
                  <p style={{ fontSize: '0.5625rem', color: '#b4b8cc' }}>
                    {appointmentsByEmployee['unassigned']?.length || 0} agendamentos
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Time grid */}
        <div
          style={{
            display: 'flex', flex: 1, position: 'relative',
            width: 'max-content', minWidth: '100%'
          }}
        >
          {/* Time ruler */}
          <div style={{
            width: '60px', minWidth: '60px', flexShrink: 0,
            borderRight: '1px solid #e8ecf4', position: 'sticky', left: 0,
            zIndex: 15, background: '#fafbfc',
          }}>
            {timeSlots.map((time, i) => (
              <div key={time} style={{
                height: `${SLOT_HEIGHT}px`, display: 'flex', alignItems: 'flex-start',
                justifyContent: 'center', paddingTop: '0.125rem',
                borderBottom: i % 2 === 1 ? '1px solid #e8ecf4' : '1px solid #f1f3f9',
              }}>
                {i % 2 === 0 && (
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 700, color: '#555',
                    fontFamily: 'var(--font-heading)',
                  }}>
                    {time}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Columns for each employee */}
          <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
            {activeEmployees.length === 0 && (!appointmentsByEmployee['unassigned'] || appointmentsByEmployee['unassigned'].length === 0) && (
              <div style={{
                position: 'absolute', top: '100px', left: '0', right: '0',
                display: 'flex', justifyContent: 'center', zIndex: 10
              }}>
                <div style={{
                  background: '#f8fafc', border: '1px dashed #cbd5e1',
                  borderRadius: '0.75rem', padding: '1.5rem 3rem', textAlign: 'center', color: '#64748b'
                }}>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>Nenhum profissional encontrado para esta categoria.</p>
                  <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Selecione "Todas" ou mude o filtro para visualizar a agenda.</p>
                </div>
              </div>
            )}
            {activeEmployees.map(emp => (
              <ProfessionalColumn
                key={emp.id}
                employee={emp}
                appointments={appointmentsByEmployee[emp.id] || []}
                isToday={isToday}
                currentTimePos={currentTimePos}
                onAction={onAction}
                onStatusChange={onStatusChange}
                confirmFn={confirm}
                timeSlots={timeSlots}
                getCardPosition={getCardPosition}
                getCardHeight={getCardHeight}
                slotHeight={SLOT_HEIGHT}
                columnWidth={getResolvedColumnWidth(emp.id)}
                startHour={bounds.start}
                endHour={bounds.end}
              />
            ))}
            {/* Unassigned appointments column */}
            {appointmentsByEmployee['unassigned']?.length > 0 && (
              <ProfessionalColumn
                employee={null}
                appointments={appointmentsByEmployee['unassigned']}
                isToday={isToday}
                currentTimePos={currentTimePos}
                onAction={onAction}
                onStatusChange={onStatusChange}
                confirmFn={confirm}
                timeSlots={timeSlots}
                getCardPosition={getCardPosition}
                getCardHeight={getCardHeight}
                slotHeight={SLOT_HEIGHT}
                columnWidth={store.expanded && expandedColWidth > 0 ? Math.max(expandedColWidth, sizeStore.getDefaultColumnWidth()) : sizeStore.getDefaultColumnWidth()}
                startHour={bounds.start}
                endHour={bounds.end}
              />
            )}
          </div>

          {/* Current time line */}
          {isToday && currentTimePos !== null && (
            <div style={{
              position: 'absolute', top: `${currentTimePos}px`, left: '60px', right: 0,
              height: '2px', background: '#ef4444', zIndex: 8,
              pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', left: '-5px', top: '-4px',
                width: '10px', height: '10px', borderRadius: '50%',
                background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.4)',
              }} />
            </div>
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {draggingApt && (
          <div style={{
            background: '#fff', borderRadius: '0.5rem', padding: '0.5rem',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)', border: '2px solid #7c5cfc',
            opacity: 0.9, maxWidth: '200px',
          }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e1e2d' }}>
              {draggingApt.client_name}
            </p>
            <p style={{ fontSize: '0.625rem', color: '#8b8fa7' }}>
              {draggingApt.appointment_time} • {draggingApt.service_name}
            </p>
          </div>
        )}
      </DragOverlay>
      <ConfirmationDialog />
    </DndContext>
  )
}

/* ── Professional Header ──────────────────────────────── */
function ProfessionalHeader({ employee, count, index, columnWidth, expandedColWidth }: { employee: Employee; count: number; index: number; columnWidth: number; expandedColWidth: number }) {
  const store = useAgendaStore()
  const sizeStore = useAgendaSizeStore()
  const initials = employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const color = employee.calendar_color
  const hoverBg = color ? `${color}10` : '#faf8ff'

  // Resize handle state
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startWidth: columnWidth }

    const handleMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const delta = ev.clientX - resizeRef.current.startX
      const newWidth = resizeRef.current.startWidth + delta
      sizeStore.setCustomColumnWidth(employee.id, newWidth)
    }

    const handleUp = () => {
      resizeRef.current = null
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => store.setEditingEmployeeId(employee.id)}
      style={{
        flex: store.expanded && expandedColWidth > 0 ? `0 0 ${columnWidth}px` : `0 0 ${columnWidth}px`,
        minWidth: `${columnWidth}px`,
        maxWidth: `${columnWidth}px`,
        padding: '0.375rem 0.5rem', borderRight: '1px solid #f1f3f9',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        cursor: 'pointer', transition: 'background 0.15s',
        position: 'relative',
        background: color ? `${color}08` : 'transparent',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = hoverBg }}
      onMouseLeave={e => { e.currentTarget.style.background = color ? `${color}08` : 'transparent' }}
      title={`Editar cadastro de ${employee.name}`}
    >
      {color && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: color }} />}
      {/* Avatar */}
      {employee.photo_url ? (
        <img
          src={employee.photo_url}
          alt={employee.name}
          style={{
            width: '1.75rem', height: '1.75rem', borderRadius: '0.5rem',
            objectFit: 'cover', flexShrink: 0,
            border: '2px solid #e8ecf4',
          }}
        />
      ) : (
        <div style={{
          width: '1.75rem', height: '1.75rem', borderRadius: '0.5rem',
          background: color || `linear-gradient(135deg, #7c5cfc, #a78bfa)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.625rem', fontWeight: 800, color: '#fff', flexShrink: 0,
          boxShadow: color ? `0 2px 8px ${color}40` : '0 2px 8px rgba(124,92,252,0.25)',
        }}>
          {initials}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '0.6875rem', fontWeight: 700, color: '#1e1e2d',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: '1.2'
        }}>
          {employee.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          {employee.specialty && (
            <span style={{ 
              fontSize: '0.5625rem', color: '#8b8fa7',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1, minWidth: 0
            }}>
              {employee.specialty}
            </span>
          )}
          <span style={{
            fontSize: '0.5625rem', fontWeight: 700,
            padding: '0.0625rem 0.375rem', borderRadius: '999px',
            background: '#f0ecff', color: '#7c5cfc',
            flexShrink: 0
          }}>
            {count}
          </span>
          {/* Status indicator */}
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: employee.status === 'active' ? '#10b981' : '#d1d5db',
            boxShadow: employee.status === 'active' ? '0 0 6px rgba(16,185,129,0.4)' : 'none',
            flexShrink: 0
          }} />
        </div>
      </div>

      {/* Resize handle — right edge */}
      <div
        onMouseDown={handleResizeStart}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', right: -3, top: 0, bottom: 0, width: 7,
          cursor: 'col-resize', zIndex: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Arrastar para redimensionar coluna"
      >
        <div style={{
          width: 2, height: '60%', borderRadius: 1,
          background: 'transparent', transition: 'background 0.15s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#c4b5fd' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        />
      </div>
    </motion.div>
  )
}

/* ── Droppable Slot ───────────────────────────────────── */
function DroppableSlot({ id, children, style, onMouseEnter, onMouseLeave, onClick, onContextMenu }: {
  id: string
  children?: React.ReactNode
  style: React.CSSProperties
  onMouseEnter?: React.MouseEventHandler
  onMouseLeave?: React.MouseEventHandler
  onClick?: React.MouseEventHandler
  onContextMenu?: React.MouseEventHandler
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: isOver ? '#ede9fe' : style.background,
        outline: isOver ? '2px solid #7c5cfc44' : 'none',
        outlineOffset: '-2px',
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onContextMenu={onContextMenu}
    >
      {children}
    </div>
  )
}

import { professionalWorksOnDate } from "@/lib/utils"

/* ── Professional Column ──────────────────────────────── */
function ProfessionalColumn({ employee, appointments, isToday, currentTimePos, onAction, onStatusChange, confirmFn, timeSlots, getCardPosition, getCardHeight, slotHeight, columnWidth, startHour, endHour }: {
  employee: Employee | null
  appointments: Appointment[]
  isToday: boolean
  currentTimePos: number | null
  onAction: (action: string, apt: Appointment) => void
  onStatusChange: (id: string, status: string) => void
  confirmFn: (opts: any) => Promise<boolean>
  timeSlots: string[]
  getCardPosition: (time: string) => number
  getCardHeight: (durationMinutes: number) => number
  slotHeight: number
  columnWidth: number
  startHour?: number
  endHour?: number
}) {
  const store = useAgendaStore()
  const { saasUser } = useTenant()
  const [slotMenu, setSlotMenu] = useState<{ x: number; y: number; time: string } | null>(null)

  const isWorkingDay = employee ? professionalWorksOnDate(employee, store.selectedDate) : true

  /* Extract specific day schedule */
  const [y, mStr, dStr] = store.selectedDate.split('-').map(Number)
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const currentDayName = dayNames[new Date(y, mStr - 1, dStr).getDay()]
  const scheduleForDay = employee?.schedule_by_day?.[currentDayName]

  const lunchStart = scheduleForDay?.lunchStart || null
  const lunchEnd = scheduleForDay?.lunchEnd || null
  const breakStart = scheduleForDay?.breakStart || null
  const breakEnd = scheduleForDay?.breakEnd || null

  const slotMenuRef = useRef<HTMLDivElement>(null)

  // Close slot menu on click outside
  useEffect(() => {
    if (!slotMenu) return
    const handler = (e: MouseEvent) => {
      if (slotMenuRef.current && slotMenuRef.current.contains(e.target as Node)) return
      setSlotMenu(null)
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [slotMenu])

  const handleSlotContextMenu = (e: React.MouseEvent, time: string) => {
    e.preventDefault()
    e.stopPropagation()
    setSlotMenu({ x: e.clientX, y: e.clientY, time })
  }

  const handlePaste = async (time: string) => {
    const cutApt = store.cutAppointment
    if (!cutApt || !employee) {
      console.error('handlePaste: cutApt or employee is null', { cutApt, employee })
      return
    }

    // Validate target employee has schedule enabled
    if (employee.has_schedule === false) {
      toast.error(`${employee.name} não possui agenda ativa`)
      setSlotMenu(null)
      return
    }

    const businessRule = checkBusinessRules(time, cutApt.duration_minutes, cutApt.appointment_date, employee, store.businessHours, store.blockedDates)
    if (businessRule.errorType === 'blocked_date') {
      const msg = `Esta data está bloqueada${businessRule.reason ? `: ${businessRule.reason}` : ''}. Deseja colar o agendamento mesmo assim?`
      const confirmed = await confirmFn({ title: "Data bloqueada", message: msg, confirmText: "Colar mesmo assim", cancelText: "Cancelar" })
      if (!confirmed) { setSlotMenu(null); return }
    } else if (businessRule.errorType === 'closed_day') {
      const msg = "O profissional ou estabelecimento está fechado nesta data. Deseja colar o agendamento mesmo assim?"
      const confirmed = await confirmFn({ title: "Estabelecimento Fechado", message: msg, confirmText: "Colar mesmo assim", cancelText: "Cancelar" })
      if (!confirmed) { setSlotMenu(null); return }
    } else if (businessRule.errorType === 'out_of_hours') {
      if (businessRule.reason === 'Horário de almoço do profissional') {
        const msg = "Este profissional está em horário de almoço neste período. Deseja colar o agendamento mesmo assim?"
        const confirmed = await confirmFn({ title: "Horário de Almoço", message: msg, confirmText: "Colar mesmo assim", cancelText: "Cancelar" })
        if (!confirmed) { setSlotMenu(null); return }
      } else if (businessRule.reason === 'Horário de intervalo do profissional') {
        const msg = "Este profissional está em intervalo neste período. Deseja colar o agendamento mesmo assim?"
        const confirmed = await confirmFn({ title: "Horário de Intervalo", message: msg, confirmText: "Colar mesmo assim", cancelText: "Cancelar" })
        if (!confirmed) { setSlotMenu(null); return }
      } else {
        const msg = `Este agendamento termina às ${businessRule.endTimeStr}, mas o expediente termina às ${businessRule.closingTimeStr}.\nDeseja colar mesmo assim?`
        const confirmed = await confirmFn({ title: "Agendamento fora do expediente", message: msg, confirmText: "Colar mesmo assim", cancelText: "Cancelar" })
        if (!confirmed) { setSlotMenu(null); return }
      }
    }

    try {
      const [h, m] = time.split(':').map(Number)
      const endTotal = h * 60 + m + cutApt.duration_minutes
      const endTime = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`

      console.log('Pasting appointment:', cutApt.id, '→', employee.name, 'at', time)
      await updateAppointment(
        cutApt.id,
        {
          employee_id: employee.id,
          employee_name: employee.name,
          appointment_time: time,
          end_time: endTime,
        },
        "cut_paste_moved",
        "Movido via Recortar e Colar",
        `Agendamento movido para ${time} com ${employee.name}.` +
        (businessRule.errorType === 'out_of_hours' && businessRule.reason === 'Horário de almoço do profissional' ? ` | Exceção: Colado manualmente no horário de almoço de ${employee.name}.` : "") +
        (businessRule.errorType === 'out_of_hours' && businessRule.reason === 'Horário de intervalo do profissional' ? ` | Exceção: Colado manualmente no intervalo de ${employee.name}.` : ""),
        saasUser
      )
      toast.success(`Agendamento colado: ${employee.name} às ${time}`)
      store.setCutAppointment(null)
    } catch (err) {
      console.error('Erro ao colar agendamento:', err)
      toast.error('Erro ao colar agendamento')
    }
    setSlotMenu(null)
  }

  const handleSlotAction = (actionId: string, time: string) => {
    setSlotMenu(null)
    if (!employee) return

    switch (actionId) {
      case 'new':
        store.setPrefillAppointment({
          employee_id: employee.id,
          appointment_time: time,
          appointment_date: store.selectedDate,
          duration_minutes: 30
        } as any)
        store.setShowNewAppointment(true)
        break
      case 'absence':
        store.setShowAbsenceModal({ employee_id: employee.id, time, date: store.selectedDate })
        break
      case 'free':
        store.setShowFreeSlotModal({ employee_id: employee.id, time, date: store.selectedDate })
        break
      case 'block':
        store.setShowBlockModal({ employee_id: employee.id, time, date: store.selectedDate })
        break
      case 'product':
        toast.info("Módulo de venda de produto ainda não configurado")
        break
      case 'pre_product':
        toast.info("Módulo de pré-venda ainda não configurado")
        break
      case 'package':
        toast.info("Módulo de pacote ainda não configurado")
        break
      case 'credit':
        store.setShowCreditModal(true)
        break
      case 'subscription':
        toast.info("Módulo de assinatura ainda não configurado")
        break
      default:
        toast.info("Funcionalidade ainda não implementada")
    }
  }

  const empId = employee?.id || 'unassigned'
  const hasCut = !!store.cutAppointment
  const color = employee?.calendar_color

  const bgEven = '#fefefe'
  const bgOdd = '#fafbfc'
  const hoverBg = '#f8f5ff'
  const cutBgEven = '#faf8ff'
  const cutBgOdd = '#f5f2ff'

  const offDayColor = store.settings?.off_day_color || '#ef4444'

  return (
    <div
      style={{
        flex: `0 0 ${columnWidth}px`,
        minWidth: `${columnWidth}px`,
        maxWidth: `${columnWidth}px`,
        position: 'relative', borderRight: '1px solid #f1f3f9',
        background: !isWorkingDay ? 'rgba(254, 226, 226, 0.2)' : 'transparent',
      }}
    >
      {!isWorkingDay && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: `repeating-linear-gradient(45deg, transparent, transparent 12px, ${offDayColor}15 12px, ${offDayColor}15 24px)`,
          borderLeft: `1px solid ${offDayColor}30`,
          borderRight: `1px solid ${offDayColor}30`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 10, pointerEvents: 'none' // allow clicks to pass through to slots underneath
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)', padding: '0.5rem 1rem', borderRadius: '0.5rem',
            border: `1px solid ${offDayColor}40`, boxShadow: `0 8px 20px ${offDayColor}20`,
            textAlign: 'center'
          }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: offDayColor }}>Folga</p>
            <p style={{ fontSize: '0.6875rem', color: offDayColor, opacity: 0.75 }}>Não atende neste dia</p>
          </div>
        </div>
      )}

      {/* Time grid lines — each is a droppable */}
      {timeSlots.map((time, i) => (
        <DroppableSlot
          key={time}
          id={`slot-${empId}-${time}`}
          onClick={() => {
            if (!isWorkingDay) return
            if (employee) {
              store.setPrefillAppointment({
                employee_id: employee.id,
                appointment_time: time,
                appointment_date: store.selectedDate,
                duration_minutes: 30
              } as any)
              store.setShowNewAppointment(true)
            }
          }}
          onContextMenu={(e) => handleSlotContextMenu(e, time)}
          style={{
            height: `${slotHeight}px`,
            borderBottom: i % 2 === 1 ? '1px solid #e8ecf4' : '1px solid #f5f7fa',
            background: hasCut && employee
              ? (i % 2 === 0 ? cutBgEven : cutBgOdd)
              : (i % 2 === 0 ? bgEven : bgOdd),
            cursor: hasCut ? 'copy' : 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = hasCut ? '#ede9fe' : hoverBg
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = hasCut && employee
              ? (i % 2 === 0 ? cutBgEven : cutBgOdd)
              : (i % 2 === 0 ? bgEven : bgOdd)
          }}
        />
      ))}

      {/* Lunch break overlay */}
      {lunchStart && lunchEnd && (
        <div style={{
          position: 'absolute',
          top: `${getCardPosition(lunchStart)}px`,
          left: '4px', right: '4px',
          height: `${getCardPosition(lunchEnd) - getCardPosition(lunchStart)}px`,
          background: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.02) 5px, rgba(0,0,0,0.02) 10px)',
          borderRadius: '0.375rem',
          border: '1px dashed #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 1,
        }}>
          <span style={{ fontSize: '0.5625rem', color: '#9ca3af', fontWeight: 600 }}>
            🍽️ Almoço
          </span>
        </div>
      )}

      {/* Interval break overlay */}
      {breakStart && breakEnd && (
        <div style={{
          position: 'absolute',
          top: `${getCardPosition(breakStart)}px`,
          left: '4px', right: '4px',
          height: `${getCardPosition(breakEnd) - getCardPosition(breakStart)}px`,
          background: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.02) 5px, rgba(0,0,0,0.02) 10px)',
          borderRadius: '0.375rem',
          border: '1px dashed #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 1,
        }}>
          <span style={{ fontSize: '0.5625rem', color: '#9ca3af', fontWeight: 600 }}>
            ☕ Intervalo
          </span>
        </div>
      )}

      {/* Appointment cards */}
      {appointments.map(apt => (
        <AppointmentCard
          key={apt.id}
          appointment={apt}
          top={getCardPosition(apt.appointment_time)}
          height={getCardHeight(apt.duration_minutes)}
          onClick={() => store.setSelectedAppointment(apt)}
          onContextMenu={(e) => {
            e.preventDefault()
            store.setContextMenu({ appointment: apt, x: e.clientX, y: e.clientY })
          }}
        />
      ))}

      {/* Empty slot context menu */}
      {slotMenu && (
        <div
          ref={slotMenuRef}
          style={{
            position: 'fixed', left: slotMenu.x, top: slotMenu.y, zIndex: 9999,
            background: '#fff', borderRadius: '0.75rem',
            border: '1px solid #e8ecf4',
            boxShadow: '0 12px 36px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
            padding: '0.375rem', minWidth: '240px',
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          {store.cutAppointment && (
            <>
              {/* Paste cut appointment */}
              <div style={{
                padding: '0.375rem 0.5rem 0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem',
                borderBottom: '1px solid #f1f3f9', marginBottom: '0.25rem',
              }}>
                <div style={{
                  width: '1.5rem', height: '1.5rem', borderRadius: '0.375rem',
                  background: 'linear-gradient(135deg, #f0ecff, #e8e0ff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '0.5rem' }}>✂️</span>
                </div>
                <div>
                  <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#1e1e2d' }}>
                    {store.cutAppointment.client_name}
                  </p>
                  <p style={{ fontSize: '0.5rem', color: '#8b8fa7' }}>
                    {store.cutAppointment.service_name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handlePaste(slotMenu.time)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4375rem 0.5rem', borderRadius: '0.5rem', border: 'none',
                  cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                  color: '#7c5cfc', background: '#f0ecff',
                  transition: 'background 0.1s', textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e8e0ff' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f0ecff' }}
              >
                📋 Colar aqui — {employee?.name} às {slotMenu.time}
              </button>

              <button
                onClick={() => {
                  store.setCutAppointment(null)
                  setSlotMenu(null)
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.375rem 0.5rem', borderRadius: '0.5rem', border: 'none',
                  cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600,
                  color: '#8b8fa7', background: 'transparent',
                  transition: 'background 0.1s', textAlign: 'left',
                  marginTop: '0.125rem'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f1f3f9' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                ❌ Cancelar recorte
              </button>
              
              <div style={{ height: '1px', background: '#f1f3f9', margin: '0.375rem 0' }} />
            </>
          )}

          {/* Regular menu items */}
          {[
            { id: "new", label: "Novo Agendamento", icon: "➕" },
            { id: "absence", label: "Registrar Ausência", icon: "🚫" },
            { id: "free", label: "Registrar Liberação de Horário", icon: "🔓" },
            { id: "block", label: "Bloquear Horário", icon: "🔒" },
            { id: "product", label: "Venda de Produto", icon: "🛍️" },
            { id: "pre_product", label: "Pré-Venda de Produto", icon: "🏷️" },
            { id: "package", label: "Venda e Consumo de Pacote", icon: "📦" },
            { id: "credit", label: "Registro de Crédito de Cliente", icon: "💰" },
            { id: "subscription", label: "Venda de Assinatura", icon: "⭐" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleSlotAction(item.id, slotMenu.time)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4375rem 0.5rem', borderRadius: '0.375rem', border: 'none',
                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                color: '#374151', background: 'transparent',
                transition: 'background 0.1s, color 0.1s', textAlign: 'left',
              }}
              onMouseEnter={e => { 
                e.currentTarget.style.background = '#f5f3ff'
                e.currentTarget.style.color = '#7c5cfc'
              }}
              onMouseLeave={e => { 
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#374151'
              }}
            >
              <span style={{ fontSize: '0.8125rem' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
