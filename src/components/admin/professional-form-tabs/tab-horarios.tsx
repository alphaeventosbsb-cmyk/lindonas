"use client"
import { useState } from "react"
import type { EmployeeScheduleDay } from "@/lib/types/database"

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.625rem', borderRadius: '0.5rem', border: '2px solid #e2e8f0',
  backgroundColor: '#fff', color: '#1e1e2d', fontSize: '0.75rem', fontWeight: 500, outline: 'none', width: '100%',
}

const weekDays = [
  { key: '0', label: 'Domingo', short: 'Dom' },
  { key: '1', label: 'Segunda-feira', short: 'Seg' },
  { key: '2', label: 'Terça-feira', short: 'Ter' },
  { key: '3', label: 'Quarta-feira', short: 'Qua' },
  { key: '4', label: 'Quinta-feira', short: 'Qui' },
  { key: '5', label: 'Sexta-feira', short: 'Sex' },
  { key: '6', label: 'Sábado', short: 'Sáb' },
]

interface Props {
  workdays: number[]
  start: string
  end: string
  scheduleByDay: Record<string, EmployeeScheduleDay> | null
  onChangeWorkdays: (w: number[]) => void
  onChangeStart: (s: string) => void
  onChangeEnd: (e: string) => void
  onChangeScheduleByDay: (s: Record<string, EmployeeScheduleDay>) => void
}

export function TabHorarios({ workdays, start, end, scheduleByDay, onChangeWorkdays, onChangeStart, onChangeEnd, onChangeScheduleByDay }: Props) {
  const [advanced, setAdvanced] = useState(!!scheduleByDay && Object.keys(scheduleByDay).length > 0)

  const toggleDay = (d: number) => {
    const next = workdays.includes(d) ? workdays.filter(x => x !== d) : [...workdays, d].sort()
    onChangeWorkdays(next)
    if (advanced && scheduleByDay) {
      const nextSched = { ...scheduleByDay }
      if (next.includes(d)) {
        nextSched[String(d)] = { enabled: true, start: start || '08:00', end: end || '18:00' }
      } else {
        nextSched[String(d)] = { ...nextSched[String(d)], enabled: false }
      }
      onChangeScheduleByDay(nextSched)
    }
  }

  const initAdvanced = () => {
    const sched: Record<string, EmployeeScheduleDay> = {}
    weekDays.forEach(d => {
      const enabled = workdays.includes(parseInt(d.key))
      sched[d.key] = scheduleByDay?.[d.key] || { enabled, start: start || '08:00', end: end || '18:00' }
    })
    onChangeScheduleByDay(sched)
    setAdvanced(true)
  }

  const updateDaySched = (key: string, field: string, val: any) => {
    const sched = { ...scheduleByDay }
    sched[key] = { ...sched[key]!, [field]: val }
    if (field === 'enabled') {
      const next = Object.entries(sched).filter(([, v]) => v.enabled).map(([k]) => parseInt(k)).sort()
      onChangeWorkdays(next)
    }
    onChangeScheduleByDay(sched)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d' }}>Horários de Trabalho</p>
          <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>Configure os dias e horários de atendimento</p>
        </div>
        <button type="button" onClick={() => advanced ? setAdvanced(false) : initAdvanced()} style={{
          fontSize: '0.6875rem', fontWeight: 600, padding: '0.375rem 0.75rem', borderRadius: '0.5rem',
          border: '1px solid #e2e8f0', background: advanced ? '#fef2f2' : '#f0ecff',
          color: advanced ? '#ef4444' : '#7c5cfc', cursor: 'pointer',
        }}>
          {advanced ? 'Modo Simples' : 'Modo Avançado'}
        </button>
      </div>

      {!advanced ? (
        <>
          {/* Simple mode */}
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Dias de Trabalho</p>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {weekDays.map(d => {
                const active = workdays.includes(parseInt(d.key))
                return (
                  <button key={d.key} type="button" onClick={() => toggleDay(parseInt(d.key))} style={{
                    flex: 1, padding: '0.5rem 0', borderRadius: '0.5rem', fontSize: '0.6875rem', fontWeight: 700,
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                    background: active ? 'linear-gradient(135deg, #7c5cfc, #a78bfa)' : '#f3f4f6',
                    color: active ? '#fff' : '#6b7280',
                    boxShadow: active ? '0 2px 8px rgba(124,92,252,0.3)' : 'none',
                  }}>
                    {d.short}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Início</label>
              <input type="time" value={start} onChange={e => onChangeStart(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Fim</label>
              <input type="time" value={end} onChange={e => onChangeEnd(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Advanced mode - per day */}
          <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.6875rem', color: '#6b7280', borderBottom: '1px solid #e8ecf4' }}>Atende</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.6875rem', color: '#6b7280', borderBottom: '1px solid #e8ecf4' }}>Dia da semana</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.6875rem', color: '#6b7280', borderBottom: '1px solid #e8ecf4' }}>Entrada</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.6875rem', color: '#6b7280', borderBottom: '1px solid #e8ecf4' }}>Saída</th>
                  <th colSpan={2} style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.6875rem', color: '#6b7280', borderBottom: '1px solid #e8ecf4', borderLeft: '1px dashed #e8ecf4' }}>Almoço (Opcional)</th>
                  <th colSpan={2} style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.6875rem', color: '#6b7280', borderBottom: '1px solid #e8ecf4', borderLeft: '1px dashed #e8ecf4' }}>Intervalo (Opcional)</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.6875rem', color: '#6b7280', borderBottom: '1px solid #e8ecf4', borderLeft: '1px dashed #e8ecf4' }}>Repetir</th>
                </tr>
                <tr>
                  <th></th><th></th><th></th><th></th>
                  <th style={{ padding: '0.25rem', textAlign: 'center', fontSize: '0.625rem', color: '#9ca3af', fontWeight: 500, borderLeft: '1px dashed #e8ecf4' }}>Início</th>
                  <th style={{ padding: '0.25rem', textAlign: 'center', fontSize: '0.625rem', color: '#9ca3af', fontWeight: 500 }}>Fim</th>
                  <th style={{ padding: '0.25rem', textAlign: 'center', fontSize: '0.625rem', color: '#9ca3af', fontWeight: 500, borderLeft: '1px dashed #e8ecf4' }}>Início</th>
                  <th style={{ padding: '0.25rem', textAlign: 'center', fontSize: '0.625rem', color: '#9ca3af', fontWeight: 500 }}>Fim</th>
                  <th style={{ borderLeft: '1px dashed #e8ecf4' }}></th>
                </tr>
              </thead>
              <tbody>
                {weekDays.map((d, index) => {
                  const day = scheduleByDay?.[d.key] || { enabled: false, start: '08:00', end: '18:00' }
                  const trStyle = { borderBottom: index < 6 ? '1px solid #f1f3f9' : 'none', background: day.enabled ? 'transparent' : '#fafbfc', transition: 'background 0.2s' }
                  const smInput = { ...inputStyle, padding: '0.375rem 0.25rem', fontSize: '0.6875rem', textAlign: 'center' as const }
                  return (
                    <tr key={d.key} style={trStyle}>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <input type="checkbox" checked={day.enabled} onChange={e => updateDaySched(d.key, 'enabled', e.target.checked)} style={{ cursor: 'pointer', width: '1rem', height: '1rem', accentColor: '#7c5cfc' }} />
                      </td>
                      <td style={{ padding: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: day.enabled ? '#1e1e2d' : '#9ca3af' }}>{d.label}</td>
                      <td style={{ padding: '0.5rem', width: '80px' }}>
                        <input type="time" value={day.start} onChange={e => updateDaySched(d.key, 'start', e.target.value)} style={smInput} disabled={!day.enabled} />
                      </td>
                      <td style={{ padding: '0.5rem', width: '80px' }}>
                        <input type="time" value={day.end} onChange={e => updateDaySched(d.key, 'end', e.target.value)} style={smInput} disabled={!day.enabled} />
                      </td>
                      <td style={{ padding: '0.5rem', width: '70px', borderLeft: '1px dashed #e8ecf4' }}>
                        <input type="time" value={day.lunchStart || ''} onChange={e => updateDaySched(d.key, 'lunchStart', e.target.value || null)} style={smInput} disabled={!day.enabled} />
                      </td>
                      <td style={{ padding: '0.5rem', width: '70px' }}>
                        <input type="time" value={day.lunchEnd || ''} onChange={e => updateDaySched(d.key, 'lunchEnd', e.target.value || null)} style={smInput} disabled={!day.enabled} />
                      </td>
                      <td style={{ padding: '0.5rem', width: '70px', borderLeft: '1px dashed #e8ecf4' }}>
                        <input type="time" value={day.breakStart || ''} onChange={e => updateDaySched(d.key, 'breakStart', e.target.value || null)} style={smInput} disabled={!day.enabled} />
                      </td>
                      <td style={{ padding: '0.5rem', width: '70px' }}>
                        <input type="time" value={day.breakEnd || ''} onChange={e => updateDaySched(d.key, 'breakEnd', e.target.value || null)} style={smInput} disabled={!day.enabled} />
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', borderLeft: '1px dashed #e8ecf4' }}>
                        <button type="button" onClick={() => {
                          const sched = { ...scheduleByDay }
                          Object.keys(sched).forEach(k => {
                            if (sched[k].enabled && k !== d.key) {
                              sched[k] = { ...sched[k], start: day.start, end: day.end, lunchStart: day.lunchStart, lunchEnd: day.lunchEnd, breakStart: day.breakStart, breakEnd: day.breakEnd }
                            }
                          })
                          onChangeScheduleByDay(sched)
                        }} disabled={!day.enabled} style={{ padding: '0.375rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', background: day.enabled ? '#f8fafc' : '#f1f5f9', color: day.enabled ? '#334155' : '#9ca3af', fontSize: '0.625rem', fontWeight: 600, cursor: day.enabled ? 'pointer' : 'not-allowed', width: '100%', whiteSpace: 'nowrap' }}>
                          Aplicar em Todas
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: '0.625rem', color: '#9ca3af', marginTop: '0.5rem', lineHeight: 1.5 }}>
            <p>* A Entrada e Saída devem ser preenchidas para os dias em que "Atende" estiver marcado.</p>
            <p>** O Almoço e Intervalo devem estar dentro do horário de trabalho.</p>
          </div>
        </>
      )}
    </div>
  )
}
