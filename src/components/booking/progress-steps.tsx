"use client"

import { Check, Scissors, User, Calendar, ClipboardCheck } from "lucide-react"

const steps = [
  { num: 1, label: "Serviço", icon: Scissors },
  { num: 2, label: "Profissional", icon: User },
  { num: 3, label: "Data / Hora", icon: Calendar },
  { num: 4, label: "Seus Dados", icon: ClipboardCheck },
  { num: 5, label: "Confirmação", icon: Check },
]

export function ProgressSteps({ currentStep }: { currentStep: number }) {
  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '480px' }}>
        {steps.map((s, i) => {
          const done = currentStep > s.num
          const active = currentStep === s.num
          const Icon = s.icon
          return (
            <div key={s.num} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '3rem' }}>
                <div style={{
                  width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8125rem', fontWeight: 700,
                  transition: 'all 0.3s',
                  ...(done ? { background: 'linear-gradient(135deg, #22c997, #5ee0b8)', color: '#fff' }
                    : active ? { background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff', boxShadow: '0 4px 14px rgba(124,92,252,0.3)' }
                    : { background: '#f1f3f9', color: '#8b8fa7' })
                }}>
                  {done ? <Check style={{ width: '0.875rem', height: '0.875rem' }} /> : <Icon style={{ width: '0.875rem', height: '0.875rem' }} />}
                </div>
                <span style={{
                  fontSize: '0.625rem', marginTop: '0.375rem', fontWeight: 700,
                  textAlign: 'center', letterSpacing: '0.02em',
                  color: done ? '#22c997' : active ? '#7c5cfc' : '#8b8fa7',
                }}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: '3px', margin: '0 0.375rem', borderRadius: '2px', background: '#e8ecf4', overflow: 'hidden', minWidth: '1rem' }}>
                  <div style={{
                    height: '100%', borderRadius: '2px',
                    width: done ? '100%' : '0%',
                    background: 'linear-gradient(90deg, #22c997, #7c5cfc)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
