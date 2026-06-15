"use client"

import type { BookingData } from "./booking-wizard"
import { ArrowRight, ArrowLeft } from "lucide-react"
import { useState } from "react"

interface Props {
  bookingData: BookingData
  onUpdate: (data: Partial<BookingData>) => void
  onNext: () => void
  onPrev: () => void
}

export function ClientForm({ bookingData, onUpdate, onNext, onPrev }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!bookingData.clientName.trim() || bookingData.clientName.trim().length < 3) e.clientName = "Informe seu nome completo"
    const phone = bookingData.clientPhone.replace(/\D/g, "")
    if (phone.length < 10) e.clientPhone = "Informe um telefone válido"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => { if (validate()) onNext() }

  const formatPhoneInput = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 11)
    if (clean.length <= 2) return clean
    if (clean.length <= 7) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`
  }

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
    border: `2px solid ${hasError ? '#ef4444' : '#e8ecf4'}`, background: '#fafbfc',
    fontSize: '0.875rem', color: '#1e1e2d', outline: 'none', minHeight: '48px',
  })

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.125rem, 3vw, 1.375rem)', fontWeight: 700, textAlign: 'center', color: '#1e1e2d', marginBottom: '0.25rem' }}>
        Seus Dados
      </h2>
      <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: '#8b8fa7', marginBottom: '1.5rem' }}>
        Informe seus dados para confirmar
      </p>

      <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d', marginBottom: '0.375rem' }}>Nome completo *</label>
          <input type="text" value={bookingData.clientName} onChange={e => onUpdate({ clientName: e.target.value })}
            style={inputStyle(!!errors.clientName)} placeholder="Ex: Ana Carolina" />
          {errors.clientName && <p style={{ fontSize: '0.6875rem', color: '#ef4444', marginTop: '0.25rem' }}>{errors.clientName}</p>}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d', marginBottom: '0.375rem' }}>WhatsApp *</label>
          <input type="tel" value={bookingData.clientPhone} onChange={e => onUpdate({ clientPhone: formatPhoneInput(e.target.value) })}
            style={inputStyle(!!errors.clientPhone)} placeholder="(00) 00000-0000" />
          {errors.clientPhone && <p style={{ fontSize: '0.6875rem', color: '#ef4444', marginTop: '0.25rem' }}>{errors.clientPhone}</p>}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d', marginBottom: '0.375rem' }}>E-mail (opcional)</label>
          <input type="email" value={bookingData.clientEmail} onChange={e => onUpdate({ clientEmail: e.target.value })}
            style={inputStyle(false)} placeholder="seu@email.com" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d', marginBottom: '0.375rem' }}>Observações (opcional)</label>
          <textarea value={bookingData.notes} onChange={e => onUpdate({ notes: e.target.value })} rows={3}
            style={{ ...inputStyle(false), resize: 'none', minHeight: '80px' }} placeholder="Algum detalhe importante?" />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1.75rem', flexWrap: 'wrap' }}>
        <button onClick={onPrev} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', border: '2px solid #e8ecf4', background: '#fff', color: '#1e1e2d', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', minHeight: '48px' }}>
          <ArrowLeft style={{ width: '14px', height: '14px' }} /> Voltar
        </button>
        <button onClick={handleNext} style={{ padding: '0.75rem 2.5rem', borderRadius: '0.75rem', border: 'none', background: '#7c5cfc', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', boxShadow: '0 4px 14px rgba(124,92,252,0.25)', minHeight: '48px' }}>
          Continuar <ArrowRight style={{ width: '14px', height: '14px' }} />
        </button>
      </div>
    </div>
  )
}
