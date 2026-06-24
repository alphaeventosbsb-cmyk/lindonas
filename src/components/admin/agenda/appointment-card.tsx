"use client"

import { motion } from "framer-motion"
import { useAgendaStore } from "./agenda-store"
import { statusCfg } from "./status-config"
import { formatCurrency } from "@/lib/utils"
import type { Appointment } from "@/lib/types/database"
import { useDraggable } from "@dnd-kit/core"
import { Clock, DollarSign, MessageSquare, Tag, CheckCircle, AlertCircle } from "lucide-react"

interface Props {
  appointment: Appointment
  top: number
  height: number
  leftPercent?: number
  widthPercent?: number
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

export function AppointmentCard({ appointment, top, height, leftPercent, widthPercent, onClick, onContextMenu }: Props) {
  const store = useAgendaStore()
  const sc = statusCfg[appointment.status] || statusCfg.pending
  const labels = store.labels.filter(l => (appointment.label_ids || []).includes(l.id))
  const emp = store.employees.find(e => e.id === appointment.employee_id)
  const isCut = store.cutAppointment?.id === appointment.id

  const isAbsence = appointment.type === 'absence'
  const isFree = appointment.type === 'free'
  const isBlock = appointment.type === 'block'
  const isSpecial = isAbsence || isFree || isBlock

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: appointment.id,
    disabled: ["closed", "completed", "payment_pending"].includes(appointment.status) || isAbsence || isFree || isBlock,
  })

  let bg = sc.bg
  let border = sc.border
  let dot = sc.dot
  
  let borderStyle = 'solid'
  let borderWidth = '1px'
  
  const service = store.services.find(s => s.id === appointment.service_id)
  
  if (isAbsence) {
    bg = '#fffaf5'
    border = '#fdba74'
    dot = '#ea580c'
  } else if (isFree) {
    bg = '#f0fdf4'
    border = '#86efac'
    dot = '#16a34a'
  } else if (isBlock) {
    bg = '#fef2f2'
    border = '#ef4444'
    dot = '#dc2626'
    borderStyle = 'solid'
    borderWidth = '2px'
  }

  const isHovered = store.hoveredAppointment?.id === appointment.id
  const isCompact = height < 55 && !isHovered
  const isOverlapped = leftPercent !== undefined && widthPercent !== undefined && widthPercent < 1

  const baseLeft = leftPercent !== undefined ? `calc(${leftPercent * 100}% + 4px)` : '4px'
  const baseWidth = widthPercent !== undefined ? `calc(${widthPercent * 100}% - 8px)` : 'calc(100% - 8px)'

  // O left nunca muda no hover para evitar expandir para a esquerda
  const activeLeft = baseLeft
  // O width aumenta para a direita no hover
  const activeWidth = isHovered && isOverlapped ? 'calc(100% - 8px)' : baseWidth

  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: isDragging ? 0.4 : isCut ? 0.55 : 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => store.setHoveredAppointment(appointment)}
      onMouseLeave={() => store.setHoveredAppointment(null)}
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: activeLeft,
        width: activeWidth,
        height: isHovered && height < 110 ? 'auto' : `${height - 2}px`,
        minHeight: `${height - 2}px`,
        borderRadius: '0.5rem',
        overflow: 'hidden',
        cursor: 'pointer',
        zIndex: isDragging ? 50 : (isHovered ? 9999 : 3),
        transition: 'box-shadow 0.2s, transform 0.2s, width 0.2s, background 0.2s, border 0.2s',
        background: isCut ? `${bg}88` : bg,
        border: isCut ? `2px dashed ${dot}88` : `${borderWidth} ${borderStyle} ${border}`,
        boxShadow: isHovered ? `0 12px 30px rgba(0,0,0,0.18), 0 0 0 1px ${dot}40` : '0 1px 4px rgba(0,0,0,0.06)',
      }}
      whileHover={{
        scale: 1.02,
      }}
    >
      {/* Status accent bar */}
      {!isBlock && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: '3.5px',
          background: dot, borderRadius: '0.5rem 0 0 0.5rem',
        }} />
      )}

      {isBlock && (
        <div style={{
          background: '#ef4444', color: '#fff', fontSize: '0.5rem', fontWeight: 800,
          textTransform: 'uppercase', padding: '0.1875rem 0.5rem',
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          letterSpacing: '0.05em'
        }}>
          <span style={{ fontSize: '0.5625rem' }}>🔒</span> BLOQUEADO
        </div>
      )}

      {/* Card content */}
      <div style={{
        padding: isBlock 
          ? (isCompact ? '0.125rem 0.375rem 0.25rem 0.375rem' : '0.25rem 0.5rem 0.375rem 0.5rem')
          : (isCompact ? '0.25rem 0.375rem 0.25rem 0.625rem' : '0.375rem 0.5rem 0.375rem 0.75rem'),
        height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: isCompact ? 'center' : 'flex-start',
        gap: '0.125rem',
        overflow: 'hidden', width: '100%', boxSizing: 'border-box'
      }}>
        {/* Row 1: Client name or Event title (HEADER) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', minWidth: 0, overflow: 'hidden' }}>
          {(isAbsence || isFree) && (
            <span style={{
              fontSize: '0.5rem', fontWeight: 800, padding: '0.0625rem 0.25rem',
              borderRadius: '0.25rem',
              background: isAbsence ? '#ffedd5' : '#dcfce7',
              color: isAbsence ? '#c2410c' : '#15803d',
              textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.125rem'
            }}>
              {isAbsence ? 'Ausência' : 'Liberado'}
            </span>
          )}
          <p style={{
            fontSize: isCompact ? '0.6875rem' : '0.75rem',
            fontWeight: 800, color: '#1e1e2d',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            lineHeight: 1.2, flex: 1
          }}>
            {isSpecial ? appointment.client_name : (
              (() => {
                const { resolveClientForAppointment, getAppointmentClientDisplayName } = require('@/lib/utils');
                const client = resolveClientForAppointment(appointment, store.clients);
                return getAppointmentClientDisplayName(appointment, client);
              })()
            )}
          </p>
        </div>

        {/* Row 2: Status & Multi-professional badge */}
        {!isSpecial && (
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '0.25rem', 
            flexWrap: 'nowrap', overflow: 'hidden', 
            marginTop: isCompact ? 0 : '0.125rem',
            minWidth: 0
          }}>
            <span style={{
              fontSize: '0.5rem', fontWeight: 700, padding: '0.0625rem 0.375rem',
              borderRadius: '999px', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
              whiteSpace: 'nowrap', flexShrink: 0
            }}>
              {sc.label}
            </span>
            {appointment.source === 'online' && (
              <span style={{
                fontSize: '0.5rem', fontWeight: 700, padding: '0.0625rem 0.375rem',
                borderRadius: '999px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.125rem', flexShrink: 0
              }}>
                {isCompact ? "Online" : "Online"}
              </span>
            )}
            {appointment.is_shared_service && (
              <span style={{
                fontSize: '0.5rem', fontWeight: 800, padding: '0.0625rem 0.375rem',
                borderRadius: '999px', background: '#f5f3ff', color: '#7c5cfc',
                border: '1px solid #e0d4ff', whiteSpace: 'nowrap', flexShrink: 0
              }}>
                MULTI
              </span>
            )}
          </div>
        )}

        {/* Row 3: Time + Price */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem', marginTop: '0.25rem', minWidth: 0, overflow: 'hidden' }}>
          <span style={{
            fontSize: isCompact ? '0.625rem' : '0.6875rem', fontWeight: 800,
            color: dot, fontFamily: 'var(--font-heading)',
            flexShrink: 0
          }}>
            {appointment.appointment_time}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 1, minWidth: 0, overflow: 'hidden' }}>
            {/* Payment icon */}
            {!isSpecial && appointment.status !== 'closed' && appointment.payment_status === 'paid' ? (
              <CheckCircle style={{ width: '10px', height: '10px', color: '#10b981' }} />
            ) : null}
            {appointment.notes && (
              <MessageSquare style={{ width: '9px', height: '9px', color: '#f59e0b' }} />
            )}
            {!isSpecial && (
              <span style={{
                fontSize: '0.5625rem', fontWeight: 800, color: '#7c5cfc',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {formatCurrency(appointment.service_price)}
              </span>
            )}
          </div>
        </div>

        {/* Row 4 & 5: Service & Duration */}
        {!isCompact && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', marginTop: '0.125rem', minWidth: 0, overflow: 'hidden' }}>
            <p style={{
              fontSize: '0.5625rem', color: service?.color_hex || '#4b5563', fontWeight: service?.color_hex ? 700 : 500,
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              display: '-webkit-box',
              WebkitLineClamp: isHovered ? 3 : 1,
              WebkitBoxOrient: 'vertical',
              whiteSpace: 'normal',
              lineHeight: 1.2,
            }}>
              {isSpecial ? (
                `Duração: ${appointment.duration_minutes} min`
              ) : (
                <>
                  {appointment.service_name}
                  {appointment.additional_services && appointment.additional_services.length > 0 && (
                    <span style={{ fontWeight: 600 }}> + {appointment.additional_services.length} {appointment.additional_services.length === 1 ? 'serviço' : 'serviços'}</span>
                  )}
                </>
              )}
            </p>
            
            {!isSpecial && appointment.end_time && (
              <p style={{ fontSize: '0.5625rem', color: '#6b7280', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {appointment.appointment_time} → {appointment.end_time} • {appointment.duration_minutes}min
              </p>
            )}
          </div>
        )}

        {/* Row 6: Labels (if space) */}
        {!isCompact && labels.length > 0 && height > 110 && (
          <div style={{ display: 'flex', gap: '0.125rem', flexWrap: 'nowrap', marginTop: '0.125rem', overflow: 'hidden', minWidth: 0 }}>
            {labels.slice(0, 2).map(l => (
              <span key={l.id} style={{
                fontSize: '0.5rem', fontWeight: 700,
                padding: '0.0625rem 0.25rem', borderRadius: '999px',
                background: l.color + '18', color: l.color,
                border: `1px solid ${l.color}33`, lineHeight: 1.3,
              }}>
                {l.name}
              </span>
            ))}
            {labels.length > 2 && (
              <span style={{ fontSize: '0.5rem', fontWeight: 700, color: '#8b8fa7' }}>
                +{labels.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
