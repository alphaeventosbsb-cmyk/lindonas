"use client"

import type { Employee } from "@/lib/types/database"
import { User, ArrowRight, ArrowLeft, ChevronRight, Star, MessageCircle } from "lucide-react"
import { ExpandableImage } from "@/components/ui/expandable-image"

interface Props {
  employees: Employee[]
  selectedEmployee: Employee | null
  companyWhatsapp?: string
  onSelect: (employee: Employee | null) => void
  onNext: () => void
  onPrev: () => void
}

export function EmployeeSelection({ employees, selectedEmployee, companyWhatsapp, onSelect, onNext, onPrev }: Props) {
  const cardStyle = (sel: boolean, dashed = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem',
    borderRadius: '0.75rem', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s ease', width: '100%',
    minHeight: '64px',
    border: sel ? '2px solid #7c5cfc' : dashed ? '2px dashed #e8ecf4' : '2px solid #e8ecf4',
    background: sel ? '#f0ecff' : '#fff',
    boxShadow: sel ? '0 4px 16px rgba(124,92,252,0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
  })

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.125rem, 3vw, 1.375rem)', fontWeight: 700, textAlign: 'center', color: '#1e1e2d', marginBottom: '0.25rem' }}>
        Escolha o Profissional
      </h2>
      <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: '#8b8fa7', marginBottom: '1.5rem' }}>
        Selecione quem vai atender você
      </p>

      {employees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', background: '#fff', borderRadius: '1rem', border: '1px solid #e8ecf4', maxWidth: '500px', margin: '0 auto' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <User style={{ width: '24px', height: '24px' }} />
          </div>
          <p style={{ fontWeight: 700, color: '#1e1e2d', marginBottom: '0.5rem' }}>Nenhum profissional disponível</p>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>Desculpe, não encontramos profissionais disponíveis para este serviço no momento.</p>
          {companyWhatsapp && (
            <a 
              href={`https://wa.me/55${companyWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Gostaria de saber mais sobre a disponibilidade de profissionais.')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', background: '#25D366', color: '#fff', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none', boxShadow: '0 4px 14px rgba(37,211,102,0.3)' }}
            >
              <MessageCircle style={{ width: '18px', height: '18px' }} /> Falar com Atendente
            </a>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '0.75rem', maxWidth: '700px', margin: '0 auto' }}>
          {employees.map(emp => {
            const sel = selectedEmployee?.id === emp.id
            return (
              <button key={emp.id} onClick={() => onSelect(emp)} style={cardStyle(sel)}>
                {emp.photo_url ? (
                  <ExpandableImage src={emp.photo_url} alt={emp.name} style={{ width: '48px', height: '48px', borderRadius: '0.625rem', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '48px', height: '48px', borderRadius: '0.625rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7c5cfc, #22c997)', color: '#fff', fontSize: '1rem', fontWeight: 700 }}>
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, color: '#1e1e2d', fontSize: '0.875rem' }}>{emp.name}</p>
                  {emp.specialty && <p style={{ fontSize: '0.6875rem', color: '#8b8fa7', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Star style={{ width: '10px', height: '10px', color: '#ffb547' }} />{emp.specialty}</p>}
                </div>
                <ChevronRight style={{ width: '16px', height: '16px', color: '#d1d5db', flexShrink: 0 }} />
              </button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1.75rem', flexWrap: 'wrap', padding: '0 0.5rem' }}>
        <button onClick={onPrev} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', border: '2px solid #e8ecf4', background: '#fff', color: '#1e1e2d', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', minHeight: '48px' }}>
          <ArrowLeft style={{ width: '14px', height: '14px' }} /> Voltar
        </button>
        {employees.length > 0 && (
          <button 
            onClick={onNext} 
            disabled={!selectedEmployee}
            style={{ padding: '0.75rem 2.5rem', borderRadius: '0.75rem', border: 'none', background: !selectedEmployee ? '#e5e7eb' : '#7c5cfc', color: !selectedEmployee ? '#9ca3af' : '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: !selectedEmployee ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', boxShadow: !selectedEmployee ? 'none' : '0 4px 14px rgba(124,92,252,0.25)', minHeight: '48px', transition: 'all 0.2s' }}
          >
            Continuar <ArrowRight style={{ width: '14px', height: '14px' }} />
          </button>
        )}
      </div>
    </div>
  )
}
