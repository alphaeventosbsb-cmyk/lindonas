"use client"

import { useRef, useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAgendaStore } from "./agenda-store"
import { statusCfg } from "./status-config"
import type { Appointment } from "@/lib/types/database"
import {
  Edit3, User, RefreshCw, Clock, Copy, XCircle, Trash2, CheckCircle, DollarSign,
  MessageSquare, Tag, Send, CalendarPlus, FileText, Phone, Scissors, Eye,
  ArrowRightLeft, Clipboard, ChevronRight, ScissorsLineDashed, Wallet, AlertCircle, Plus
} from "lucide-react"
import { usePermission } from "@/lib/rbac/usePermission"

const menuSections = [
  {
    items: [
      { id: "edit", label: "Ver / Editar Agendamento", icon: Edit3 },
      { id: "client", label: "Editar Cliente", icon: User },
      { id: "status", label: "Alterar Status", icon: RefreshCw, hasSubmenu: true },
      { id: "complete", label: "Concluir Atendimento", icon: CheckCircle, color: "#059669" },
      { id: "close_account", label: "Fechar Pagamento", icon: DollarSign, highlight: true },
      { id: "add_service", label: "Adicionar Serviço", icon: Plus, color: "#7c5cfc" },
    ]
  },
  {
    items: [
      { id: "add_credit", label: "Adicionar Crédito", icon: Wallet, color: "#16a34a" },
      { id: "add_debit", label: "Adicionar Débito", icon: AlertCircle, color: "#dc2626" },
    ]
  },
  {
    items: [
      { id: "reschedule", label: "Reagendar", icon: Clock },
      { id: "duplicate", label: "Duplicar", icon: Copy },
      { id: "cut", label: "Recortar", icon: ScissorsLineDashed },
      { id: "add_note", label: "Adicionar Observação", icon: MessageSquare },
      { id: "add_label", label: "Adicionar Etiqueta", icon: Tag },
    ]
  },
  {
    items: [
      { id: "whatsapp", label: "Enviar WhatsApp", icon: Phone, color: "#25D366" },
      { id: "reminder", label: "Enviar Lembrete", icon: Send },
    ]
  },
  {
    items: [
      { id: "cancel", label: "Cancelar", icon: XCircle, danger: true },
      { id: "no_show", label: "Não Compareceu", icon: User, danger: true },
      { id: "delete", label: "Excluir", icon: Trash2, danger: true },
    ]
  },
]

const statusOptions = [
  { id: "pending", label: "Pendente", color: "#d97706" },
  { id: "confirmed", label: "Marcado", color: "#2563eb" },
  { id: "waiting", label: "Em Espera", color: "#ea580c" },
  { id: "in_progress", label: "Em Atendimento", color: "#0891b2" },
  { id: "completed", label: "Concluir / Pgto", color: "#059669" },
  { id: "cancelled", label: "Cancelado", color: "#ef4444" },
  { id: "no_show", label: "Não Compareceu", color: "#6b7280" },
]

interface Props {
  onStatusChange: (id: string, status: string) => void
  onAction: (action: string, apt: Appointment) => void
}

export function AgendaContextMenu({ onStatusChange, onAction }: Props) {
  const store = useAgendaStore()
  const { can } = usePermission()
  const ctx = store.contextMenu
  const ref = useRef<HTMLDivElement>(null)
  const [showStatusSub, setShowStatusSub] = useState(false)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        store.setContextMenu(null)
        setShowStatusSub(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        store.setContextMenu(null)
        setShowStatusSub(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Reset submenu on context menu change
  useEffect(() => {
    setShowStatusSub(false)
  }, [ctx])

  if (!ctx) return null

  const apt = ctx.appointment
  const sc = statusCfg[apt.status] || statusCfg.pending

  // Adjust position
  let x = ctx.x
  let y = ctx.y
  if (typeof window !== 'undefined') {
    if (x + 260 > window.innerWidth) x = ctx.x - 260
    
    // Instead of hardcoding 450, let's keep it in view but also allow CSS max-height to kick in
    const maxMenuHeight = 500 
    if (y + maxMenuHeight > window.innerHeight) {
      y = Math.max(10, window.innerHeight - maxMenuHeight)
      // If it's too high up, align it upwards from the click point
      if (y < 10) {
        y = 10
      }
    }
  }

  const handleClick = (itemId: string) => {
    switch (itemId) {
      case 'edit':
        store.setSelectedAppointment(apt)
        break
      case 'complete':
        onStatusChange(apt.id, 'completed')
        break
      case 'close_account':
        onAction('close_account', apt)
        break
      case 'cancel':
        onStatusChange(apt.id, 'cancelled')
        break
      case 'no_show':
        onStatusChange(apt.id, 'no_show')
        break
      case 'add_label':
        store.setSelectedAppointment(apt)
        break
      case 'add_note':
        onAction('add_note', apt)
        break
      case 'status':
        setShowStatusSub(!showStatusSub)
        return // Don't close menu
      case 'cut':
        store.setCutAppointment(apt)
        break
      case 'reschedule':
        onAction('reschedule', apt)
        break
      case 'duplicate':
        onAction('duplicate', apt)
        break
      case 'add_service':
        onAction('add_service', apt)
        break
      case 'add_credit':
        onAction('add_credit', apt)
        break
      case 'add_debit':
        onAction('add_debit', apt)
        break
      default:
        onAction(itemId, apt)
    }
    if (itemId !== 'status') {
      store.setContextMenu(null)
      setShowStatusSub(false)
    }
  }

  const hasCut = store.cutAppointment !== null

  const isFinished = ['closed', 'completed'].includes(apt.status)

  const visibleSections = menuSections.map(section => ({
    ...section,
    items: section.items.map(item => {
      // Change label for edit if finished
      if (item.id === 'edit' && isFinished) return { ...item, label: 'Ver Detalhes' }
      return item
    }).filter(item => {
      if (item.id === 'complete' && isFinished) return false
      if (item.id === 'cancel' && isFinished) return false
      if (item.id === 'close_account' && isFinished) return false
      if (item.id === 'reschedule' && isFinished) return false
      if (item.id === 'status' && isFinished) return false
      if (item.id === 'cut' && isFinished) return false
      if (item.id === 'add_service' && isFinished) return false
      
      // Show "Recortar" only if not already cutting this one
      if (item.id === 'cut' && store.cutAppointment?.id === apt.id) return false
      // RBAC Permission filtering
      if (item.id === 'edit' && !can('agenda.edit') && !can('agenda.view')) return false
      if (item.id === 'client' && !can('clients.edit')) return false
      if (item.id === 'status' && !can('agenda.edit')) return false
      if (item.id === 'complete' && !can('agenda.edit')) return false
      if (item.id === 'close_account' && !can('cash.open')) return false
      if (item.id === 'add_credit' && !can('cash.open')) return false
      if (item.id === 'add_debit' && !can('cash.open')) return false
      if (item.id === 'reschedule' && !can('agenda.edit')) return false
      if (item.id === 'duplicate' && !can('agenda.create')) return false
      if (item.id === 'cut' && !can('agenda.edit')) return false
      if (item.id === 'cancel' && !can('agenda.cancel')) return false
      if (item.id === 'no_show' && !can('agenda.cancel')) return false
      if (item.id === 'delete' && !can('agenda.delete')) return false

      return true
    })
  })).filter(s => s.items.length > 0)

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.12 }}
        style={{
          position: 'fixed', left: x, top: y, zIndex: 9999,
          background: '#fff', borderRadius: '0.875rem',
          border: '1px solid #e8ecf4',
          boxShadow: '0 16px 48px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06)',
          minWidth: '240px', maxWidth: '280px',
          padding: '0.375rem', overflow: 'hidden',
        }}
      >
        {/* Mini header */}
        <div style={{
          padding: '0.5rem 0.625rem 0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
          borderBottom: '1px solid #f1f3f9', marginBottom: '0.25rem',
        }}>
          <div style={{
            width: '1.75rem', height: '1.75rem', borderRadius: '0.5rem',
            background: `linear-gradient(135deg, ${sc.dot}22, ${sc.dot}11)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${sc.dot}33`,
          }}>
            <span style={{ fontSize: '0.625rem', fontWeight: 800, color: sc.dot }}>
              {apt.client_name.charAt(0)}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: '0.6875rem', fontWeight: 700, color: '#1e1e2d',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {apt.client_name}
            </p>
            <p style={{ fontSize: '0.5625rem', color: '#8b8fa7' }}>
              {apt.appointment_time} • {apt.service_name}
            </p>
          </div>
        </div>

        <div style={{
          maxHeight: 'calc(100vh - 100px)',
          overflowY: 'auto',
          // custom scrollbar styling can be tricky inline, so we just use auto.
          paddingRight: '0.25rem'
        }}>
          {/* Cut indicator */}
          {hasCut && store.cutAppointment?.id !== apt.id && (
            <>
              <div style={{ height: '1px', background: '#f1f3f9', margin: '0.25rem 0' }} />
              <button
                onClick={() => {
                  onAction('paste', apt)
                  store.setContextMenu(null)
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4375rem 0.625rem', borderRadius: '0.5rem', border: 'none',
                  cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                  color: '#7c5cfc', background: '#f0ecff',
                  transition: 'background 0.12s', textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e8e0ff' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f0ecff' }}
              >
                <Clipboard style={{ width: '14px', height: '14px', opacity: 0.7, flexShrink: 0 }} />
                Colar agendamento aqui
              </button>
            </>
          )}

          {/* Menu items */}
          {visibleSections.map((section, si) => (
            <div key={si}>
              {si > 0 && <div style={{ height: '1px', background: '#f1f3f9', margin: '0.25rem 0' }} />}
              {section.items.map(item => {
                const Icon = item.icon
                const isDanger = (item as any).danger
                const isHighlight = (item as any).highlight
                const customColor = (item as any).color
                const hasSubmenu = (item as any).hasSubmenu

                return (
                  <div key={item.id} style={{ position: 'relative' }}>
                    <button
                      onClick={() => handleClick(item.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.4375rem 0.625rem', borderRadius: '0.5rem', border: 'none',
                        cursor: 'pointer', fontSize: '0.75rem',
                        fontWeight: isHighlight ? 700 : 500,
                        color: isDanger ? '#ef4444' : customColor || (isHighlight ? '#7c5cfc' : '#374151'),
                        background: isHighlight ? '#f0ecff' : (item.id === 'status' && showStatusSub ? '#f5f3ff' : 'transparent'),
                        transition: 'background 0.12s', textAlign: 'left',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = isDanger ? '#fef2f2' : isHighlight ? '#e8e0ff' : '#f5f3ff'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = isHighlight ? '#f0ecff' : (item.id === 'status' && showStatusSub ? '#f5f3ff' : 'transparent')
                      }}
                    >
                      <Icon style={{ width: '14px', height: '14px', opacity: 0.7, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {hasSubmenu && (
                        <ChevronRight style={{
                          width: '12px', height: '12px', opacity: 0.4, flexShrink: 0,
                          transition: 'transform 0.15s',
                          transform: showStatusSub ? 'rotate(90deg)' : 'rotate(0deg)',
                        }} />
                      )}
                    </button>

                    {/* Status submenu (inline) */}
                    {item.id === 'status' && showStatusSub && (
                      <div style={{
                        padding: '0.25rem 0 0.25rem 1.5rem',
                        display: 'flex', flexDirection: 'column', gap: '0.125rem',
                      }}>
                        {statusOptions
                          .filter(s => s.id !== apt.status)
                          .map(s => (
                            <button
                              key={s.id}
                              onClick={() => {
                                onStatusChange(apt.id, s.id)
                                store.setContextMenu(null)
                                setShowStatusSub(false)
                              }}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '0.375rem',
                                padding: '0.3125rem 0.5rem', borderRadius: '0.375rem', border: 'none',
                                cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600,
                                color: s.color, background: 'transparent',
                                transition: 'background 0.1s', textAlign: 'left',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#f5f3ff' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                            >
                              <div style={{
                                width: '7px', height: '7px', borderRadius: '50%', background: s.color, flexShrink: 0,
                              }} />
                              {s.label}
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {/* Cancel cut option */}
          {hasCut && (
            <>
              <div style={{ height: '1px', background: '#f1f3f9', margin: '0.25rem 0' }} />
              <button
                onClick={() => {
                  store.setCutAppointment(null)
                  store.setContextMenu(null)
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4375rem 0.625rem', borderRadius: '0.5rem', border: 'none',
                  cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600,
                  color: '#8b8fa7', background: 'transparent',
                  transition: 'background 0.12s', textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f5fa' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <XCircle style={{ width: '13px', height: '13px', opacity: 0.5, flexShrink: 0 }} />
                Cancelar recorte
              </button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
