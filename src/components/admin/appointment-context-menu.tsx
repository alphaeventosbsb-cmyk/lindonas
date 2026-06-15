"use client"
import { useState, useRef, useEffect } from "react"
import { Edit3, User, RefreshCw, Receipt, Clock, Copy, XCircle, Trash2, MoreVertical, CheckCircle, DollarSign } from "lucide-react"

interface Props {
  x: number; y: number; status: string
  onClose: () => void
  onAction: (action: string) => void
}

const menuItems = [
  { id: "edit", label: "Ver / Editar Agendamento", icon: Edit3 },
  { id: "client", label: "Ver / Editar Cliente", icon: User },
  { id: "status", label: "Alterar Status", icon: RefreshCw },
  { id: "divider1", label: "", icon: null },
  { id: "complete", label: "Concluir", icon: CheckCircle },
  { id: "close_account", label: "Fechar Conta", icon: DollarSign, highlight: true },
  { id: "divider2", label: "", icon: null },
  { id: "reschedule", label: "Reagendar", icon: Clock },
  { id: "copy", label: "Copiar / Duplicar", icon: Copy },
  { id: "cancel", label: "Cancelar", icon: XCircle, danger: true },
  { id: "delete", label: "Excluir", icon: Trash2, danger: true },
]

export function ContextMenu({ x, y, onClose, onAction, status }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  // Adjust position to stay in viewport
  const adjustedY = typeof window !== 'undefined' && y + 380 > window.innerHeight ? Math.max(10, y - 300) : y
  const adjustedX = typeof window !== 'undefined' && x + 240 > window.innerWidth ? x - 240 : x

  const visibleItems = menuItems.filter(item => {
    if (item.id === "complete" && ["completed", "cancelled"].includes(status)) return false
    if (item.id === "cancel" && ["cancelled", "completed"].includes(status)) return false
    return true
  })

  return (
    <div ref={ref} style={{ position: 'fixed', left: adjustedX, top: adjustedY, zIndex: 9999, background: '#fff', borderRadius: '0.75rem', border: '1px solid #e8ecf4', boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)', minWidth: '220px', padding: '0.375rem', overflow: 'hidden' }}>
      {visibleItems.map(item => {
        if (item.id.startsWith("divider")) return <div key={item.id} style={{ height: '1px', background: '#f1f3f9', margin: '0.25rem 0' }} />
        const Icon = item.icon!
        const isDanger = (item as any).danger
        const isHighlight = (item as any).highlight
        return (
          <button key={item.id} onClick={() => { onAction(item.id); onClose() }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: isHighlight ? 700 : 500, color: isDanger ? '#ef4444' : isHighlight ? '#7c5cfc' : '#374151', background: isHighlight ? '#f0ecff' : 'transparent', transition: 'background 0.15s', textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget.style.background = isDanger ? '#fef2f2' : '#f5f3ff')}
            onMouseLeave={e => (e.currentTarget.style.background = isHighlight ? '#f0ecff' : 'transparent')}>
            <Icon style={{ width: '15px', height: '15px', opacity: 0.7 }} />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export function ActionButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#8b8fa7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f1f3f9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <MoreVertical style={{ width: '16px', height: '16px' }} />
    </button>
  )
}
