"use client"

import { Scissors, User, CalendarDays, Clock, UserCheck, ClipboardCheck, Check } from "lucide-react"

const stepsMeta = [
  { icon: Scissors, label: "Serviço" },
  { icon: User, label: "Profissional" },
  { icon: CalendarDays, label: "Data" },
  { icon: Clock, label: "Horário" },
  { icon: UserCheck, label: "Dados" },
  { icon: ClipboardCheck, label: "Confirmar" },
]

export function BookingSteps({ current, total = 6, color = "#7c5cfc" }: { current: number; total?: number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.125rem', padding: '1rem 0' }}>
      {stepsMeta.slice(0, total).map((s, i) => {
        const stepNum = i + 1
        const done = current > stepNum
        const active = current === stepNum
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
            <div style={{
              width: '2.25rem', height: '2.25rem', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: done ? color : active ? color : 'rgba(0,0,0,0.06)',
              color: done || active ? '#fff' : '#9ca3af',
              transition: 'all 0.3s ease',
              boxShadow: active ? `0 4px 14px ${color}40` : 'none',
              fontSize: '0.75rem', fontWeight: 700,
            }}>
              {done ? <Check style={{ width: '0.875rem', height: '0.875rem' }} /> : <s.icon style={{ width: '0.875rem', height: '0.875rem' }} />}
            </div>
            {i < total - 1 && (
              <div style={{ width: '1rem', height: '2px', background: done ? color : 'rgba(0,0,0,0.08)', transition: 'background 0.3s', borderRadius: '1px' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
