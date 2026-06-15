"use client"
import { X } from "lucide-react"

const statuses = [
  { id: "pending", label: "Pendente", color: "#d97706", bg: "#fffbeb" },
  { id: "confirmed", label: "Confirmado", color: "#2563eb", bg: "#eff6ff" },
  { id: "waiting", label: "Em espera", color: "#ea580c", bg: "#fff7ed" },
  { id: "in_progress", label: "Em atendimento", color: "#0891b2", bg: "#ecfeff" },
  { id: "completed", label: "Concluído", color: "#059669", bg: "#ecfdf5" },
  { id: "payment_pending", label: "Aguardando pagamento", color: "#8b5cf6", bg: "#f5f3ff" },
  { id: "closed", label: "Fechado", color: "#64748b", bg: "#f8fafc" },
  { id: "cancelled", label: "Cancelado", color: "#ef4444", bg: "#fef2f2" },
  { id: "no_show", label: "Não compareceu", color: "#6b7280", bg: "#f3f4f6" },
]

interface Props { current: string; onSelect: (status: string) => void; onClose: () => void }

export function StatusModal({ current, onSelect, onClose }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #f1f3f9' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 700, color: '#1e1e2d' }}>Alterar Status</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X style={{ width: '16px', height: '16px', color: '#8b8fa7' }} /></button>
        </div>
        <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {statuses.map(s => (
            <button key={s.id} onClick={() => { onSelect(s.id); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.625rem', border: current === s.id ? '2px solid ' + s.color : '2px solid transparent', background: current === s.id ? s.bg : 'transparent', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (current !== s.id) e.currentTarget.style.background = '#fafbfc' }}
              onMouseLeave={e => { if (current !== s.id) e.currentTarget.style.background = 'transparent' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.875rem', fontWeight: current === s.id ? 700 : 500, color: current === s.id ? s.color : '#374151' }}>{s.label}</span>
              {current === s.id && <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: s.color, fontWeight: 600 }}>Atual</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
