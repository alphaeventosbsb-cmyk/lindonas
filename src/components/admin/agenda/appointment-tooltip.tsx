"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import * as Popover from "@radix-ui/react-popover"
import { useAgendaStore } from "./agenda-store"
import { useBusinessSettings } from "@/lib/auth/tenant-context"
import { ExpandableImage } from "@/components/ui/expandable-image"
import { statusCfg } from "./status-config"
import type { Appointment } from "@/lib/types/database"
import { formatCurrency, formatPhone, toLocalDateStr, calculateSharedServiceSplits } from "@/lib/utils"
import { Phone, Scissors, User, Calendar, Clock, DollarSign, FileText, Tag, MapPin } from "lucide-react"

export function AppointmentTooltip() {
  const store = useAgendaStore()
  const apt = store.hoveredAppointment
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [imgErrorClient, setImgErrorClient] = useState<string | null>(null)
  const [activeApt, setActiveApt] = useState<Appointment | null>(null)
  const [isHoveringTooltip, setIsHoveringTooltip] = useState(false)
  const closeTimeout = useRef<NodeJS.Timeout | null>(null)
  const openTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (apt) {
        setMousePos({ x: e.clientX, y: e.clientY })
      }
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [apt])

  useEffect(() => {
    if (apt) {
      if (closeTimeout.current) clearTimeout(closeTimeout.current)
      if (openTimeout.current) clearTimeout(openTimeout.current)
      openTimeout.current = setTimeout(() => {
        setActiveApt(apt)
      }, 2000)
    } else if (!isHoveringTooltip) {
      if (openTimeout.current) clearTimeout(openTimeout.current)
      closeTimeout.current = setTimeout(() => {
        setActiveApt(null)
      }, 250) // 250ms delay keeps it open long enough to move mouse into it
    }
  }, [apt, isHoveringTooltip])

  if (!activeApt) return null

  const currentApt = activeApt
  const sc = statusCfg[currentApt.status] || statusCfg.pending
  const emp = store.employees.find(e => e.id === currentApt.employee_id)
  const client = store.clients.find(c => 
    c.phone === currentApt.client_phone || c.id === currentApt.client_id
  )
  const labels = store.labels.filter(l => (currentApt.label_ids || []).includes(l.id))

  const isSpecial = currentApt.type === 'absence' || currentApt.type === 'free' || currentApt.type === 'block'
  let isBirthdayMonth = false
  let birthDateFormatted = ''
  
  if (!isSpecial && client?.birth_date && currentApt.appointment_date) {
    const birthParts = client.birth_date.split('-')
    const aptParts = currentApt.appointment_date.split('-')
    if (birthParts.length >= 3 && aptParts.length >= 3) {
      const birthMonth = birthParts[1]
      const aptMonth = aptParts[1]
      if (birthMonth === aptMonth) {
        isBirthdayMonth = true
        birthDateFormatted = `${birthParts[2]}/${birthParts[1]}`
      }
    }
  }

  // Render using Radix Popover for robust collision detection and placement
  return (
    <Popover.Root open={true}>
      <Popover.Anchor asChild>
        <div style={{ position: 'fixed', left: mousePos.x, top: mousePos.y, width: 1, height: 1, pointerEvents: 'none' }} />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={12}
          alignOffset={8}
          collisionPadding={16}
          onMouseEnter={() => setIsHoveringTooltip(true)}
          onMouseLeave={() => setIsHoveringTooltip(false)}
          style={{
            width: 320,
            zIndex: 99999,
            background: '#fff',
            borderRadius: '1rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
            border: '1px solid #e8ecf4',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 32px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            style={{ 
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto', flex: 1, borderRadius: '1rem' 
            }}
          >
            {/* Top accent */}
            <div style={{ height: '3px', background: `linear-gradient(90deg, ${sc.dot}, ${sc.dot}88)`, flexShrink: 0 }} />

          <div style={{ padding: '0.875rem' }}>
            {/* Birthday badge */}
            {isBirthdayMonth && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.375rem 0.5rem', borderRadius: '0.5rem',
                background: '#fdf4ff', border: '1px solid #fbcfe8',
                marginBottom: '0.75rem'
              }}>
                <span style={{ fontSize: '0.875rem' }}>🎂</span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#be185d' }}>
                  Aniversariante do mês
                </span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#9d174d', marginLeft: 'auto' }}>
                  {birthDateFormatted}
                </span>
              </div>
            )}

            {/* Client header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
              <div style={{
                width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '1rem', fontWeight: 800, flexShrink: 0,
              }}>
                {currentApt.client_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '1rem', fontWeight: 800, color: '#1e1e2d',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {currentApt.client_name}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.5625rem', fontWeight: 700, padding: '0.0625rem 0.375rem',
                    borderRadius: '999px', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                  }}>
                    {sc.label}
                  </span>
                  {currentApt.is_shared_service && (
                    <span style={{
                      fontSize: '0.5625rem', fontWeight: 800, padding: '0.0625rem 0.375rem',
                      borderRadius: '999px', background: '#f5f3ff', color: '#7c5cfc',
                      border: '1px solid #e0d4ff', whiteSpace: 'nowrap'
                    }}>
                      MULTI-PROFISSIONAL
                    </span>
                  )}
                  {labels.slice(0, 2).map(l => (
                    <span key={l.id} style={{
                      fontSize: '0.5rem', fontWeight: 700, padding: '0.0625rem 0.25rem',
                      borderRadius: '999px', background: l.color + '18', color: l.color,
                      border: `1px solid ${l.color}33`
                    }}>
                      {l.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Info rows */}
            <div style={{
              background: '#fafbfc', borderRadius: '0.625rem', padding: '0.5rem 0.625rem',
              border: '1px solid #eef0f6', marginBottom: '0.5rem',
            }}>
              {[
                { icon: Phone, label: 'Telefone', value: formatPhone(currentApt.client_phone) },
                { icon: Scissors, label: 'Serviço', value: currentApt.service_name },
                { icon: DollarSign, label: 'Valor', value: formatCurrency(currentApt.service_price) },
                { icon: User, label: 'Profissional', value: emp?.name || currentApt.employee_name || 'Não definido' },
                { icon: Calendar, label: 'Data', value: currentApt.appointment_date.split('-').reverse().join('/') },
                { icon: Clock, label: 'Horário', value: `${currentApt.appointment_time}${currentApt.end_time ? ` → ${currentApt.end_time}` : ''} • ${currentApt.duration_minutes}min` },
              ].map((item, i, arr) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.3rem 0',
                  borderBottom: i < arr.length - 1 ? '1px solid #f1f3f9' : 'none',
                }}>
                  <item.icon style={{ width: '0.6875rem', height: '0.6875rem', color: '#7c5cfc', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.5625rem', color: '#8b8fa7', minWidth: '4rem' }}>{item.label}</span>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 600, color: '#1e1e2d',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    textAlign: 'right',
                  }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Client summary card */}
            {client && (() => {
              const genderMap: Record<string, string> = {
                masculino: 'Masculino', feminino: 'Feminino', outro: 'Outro', nao_informado: 'Não informado'
              }
              const genderLabel = client.gender ? (genderMap[client.gender] || client.gender) : 'Não informado'
              const birthFormatted = client.birth_date
                ? client.birth_date.split('-').reverse().join('/')
                : 'Não informado'
              const MONTHS_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
              const fmtShortDate = (dateStr: string | null | undefined) => {
                if (!dateStr) return null
                const parts = dateStr.split('-')
                if (parts.length < 3) return dateStr
                const [y, m, d] = parts
                return `${parseInt(d)} ${MONTHS_SHORT[parseInt(m) - 1]} ${y}`
              }
              const safeToDateStr = (val: any): string | null => {
                if (!val) return null
                if (typeof val === 'string') return val.split('T')[0]
                if (val.toDate && typeof val.toDate === 'function') {
                  const d = val.toDate() as Date
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                }
                if (val instanceof Date) {
                  return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`
                }
                return null
              }
              const clientSinceDate = safeToDateStr(client.first_visit_date) || safeToDateStr(client.created_at)
              const clientSince = fmtShortDate(clientSinceDate) || 'Não informado'

              // Calculate last visit from appointments
              const clientApts = store.appointments
                .filter(a => a.client_id === client.id && ['closed','completed','payment_pending'].includes(a.status))
                .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date))
              const lastVisitStr = client.last_visit
                ? fmtShortDate(client.last_visit)
                : (clientApts.length > 0 ? fmtShortDate(clientApts[0].appointment_date) : null)

              return (
                <div style={{ marginBottom: '0.5rem' }}>
                  {/* Client info card */}
                  <div style={{
                    padding: '0.625rem', borderRadius: '0.625rem',
                    background: '#fafbfc', border: '1px solid #eef0f6', marginBottom: '0.375rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
                      {client.photo_url && imgErrorClient !== client.id ? (
                        <ExpandableImage
                          src={client.photo_url}
                          alt={client.name}
                          onError={() => setImgErrorClient(client.id)}
                          style={{
                            width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem',
                            objectFit: 'cover', flexShrink: 0, border: '2px solid #e8ecf4',
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem',
                          background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: '1rem', fontWeight: 800, flexShrink: 0,
                          border: '2px solid #e8ecf4', textTransform: 'uppercase'
                        }}>
                          {client.name ? client.name.charAt(0) : <User style={{ width: '1.125rem', height: '1.125rem' }} />}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: '0.75rem', fontWeight: 700, color: '#1e1e2d',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {client.name || 'Cliente não informado'}
                        </p>
                        <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', lineHeight: 1.4 }}>
                          Gênero: {genderLabel}
                        </p>
                        <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', lineHeight: 1.4 }}>
                          Nascimento: {birthFormatted}
                        </p>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex', gap: '0.5rem', borderTop: '1px solid #eef0f6', paddingTop: '0.375rem',
                    }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.5rem', color: '#8b8fa7', fontWeight: 600 }}>Cliente desde</p>
                        <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#1e1e2d' }}>{clientSince}</p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.5rem', color: '#8b8fa7', fontWeight: 600 }}>Última visita</p>
                        <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#1e1e2d' }}>{lastVisitStr || 'Sem visitas'}</p>
                      </div>
                    </div>
                  </div>
                  {/* Total gasto + Débito */}
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <div style={{
                      flex: 1, padding: '0.375rem', borderRadius: '0.5rem',
                      background: '#ecfdf5', textAlign: 'center',
                    }}>
                      <p style={{ fontSize: '0.5rem', color: '#059669', fontWeight: 600 }}>Total gasto</p>
                      <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669' }}>
                        {formatCurrency(client.total_spent || 0)}
                      </p>
                    </div>
                    {(client.debt_amount || 0) > 0 && (
                      <div style={{
                        flex: 1, padding: '0.375rem', borderRadius: '0.5rem',
                        background: '#fef2f2', textAlign: 'center',
                      }}>
                        <p style={{ fontSize: '0.5rem', color: '#ef4444', fontWeight: 600 }}>Débito</p>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444' }}>
                          {formatCurrency(client.debt_amount || 0)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Shared Service Details */}
            {currentApt.is_shared_service && currentApt.shared_group_id && (
              <div style={{
                padding: '0.375rem 0.5rem', borderRadius: '0.5rem',
                background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                  <User style={{ width: '0.5625rem', height: '0.5625rem', color: '#6366f1' }} />
                  <span style={{ fontSize: '0.5rem', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase' }}>Equipe (Multi-profissional)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {(() => {
                    const sharedApts = store.appointments.filter(a => a.shared_group_id === currentApt.shared_group_id)
                    const splits = calculateSharedServiceSplits(sharedApts)
                    const totalGroup = sharedApts.reduce((sum, a) => sum + (splits[a.id] || 0), 0)

                    return (
                      <>
                        {sharedApts.map(a => (
                          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.625rem' }}>
                            <span style={{ color: '#334155', fontWeight: a.id === currentApt.id ? 700 : 500 }}>
                              {a.employee_name || 'Desconhecido'}: {a.service_name}
                            </span>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>{formatCurrency(splits[a.id] || 0)}</span>
                          </div>
                        ))}
                        <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: '0.125rem', paddingTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.625rem' }}>
                          <span style={{ color: '#0f172a', fontWeight: 800 }}>Total do Grupo</span>
                          <span style={{ color: '#059669', fontWeight: 800 }}>{formatCurrency(totalGroup)}</span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* Notes */}
            {currentApt.notes && (
              <div style={{
                padding: '0.375rem 0.5rem', borderRadius: '0.5rem',
                background: '#fffbeb', border: '1px solid #fde68a',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.125rem' }}>
                  <FileText style={{ width: '0.5625rem', height: '0.5625rem', color: '#d97706' }} />
                  <span style={{ fontSize: '0.5rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Obs</span>
                </div>
                <p style={{ fontSize: '0.625rem', color: '#92400e', lineHeight: 1.4 }}>
                  {currentApt.notes.length > 100 ? currentApt.notes.slice(0, 100) + '...' : currentApt.notes}
                </p>
              </div>
            )}
          </div>
          </motion.div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
