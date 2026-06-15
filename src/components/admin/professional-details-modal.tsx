"use client"
import { useState, useEffect } from "react"
import { X, Phone, Mail, Clock, Calendar, Pencil, Trash2, AlertTriangle, Loader2, Percent, Briefcase, User, MapPin, AtSign, Globe } from "lucide-react"
import type { Employee } from "@/lib/types/database"
import { formatPhone } from "@/lib/utils"

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const gradients = [
  "linear-gradient(135deg, #7c5cfc, #a78bfa)", "linear-gradient(135deg, #22c997, #5ee0b8)",
  "linear-gradient(135deg, #5b8def, #93b5f5)", "linear-gradient(135deg, #ffb547, #ffd08a)",
  "linear-gradient(135deg, #f25c5c, #f78888)", "linear-gradient(135deg, #e879a0, #f0a5bd)",
]

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: 'Ativo', color: '#22c55e' },
  inactive: { label: 'Inativo', color: '#9ca3af' },
  blocked: { label: 'Bloqueado', color: '#ef4444' },
  vacation: { label: 'Férias', color: '#f59e0b' },
  away: { label: 'Afastado', color: '#8b5cf6' },
}

interface Props {
  employee: Employee
  index: number
  onClose: () => void
  onEdit: (e: Employee) => void
  onDelete: (id: string) => void
}

export function ProfessionalDetailsModal({ employee, index, onClose, onEdit, onDelete }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const gradient = gradients[index % gradients.length]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const activeDays = weekDays.filter((_, i) => employee.workdays?.includes(i))
  const st = statusLabels[employee.status || (employee.is_active ? 'active' : 'inactive')] || statusLabels.active

  const infoRow = (icon: React.ReactNode, label: string, value: string | null | undefined) => {
    if (!value) return null
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0', borderBottom: '1px solid #f1f3f9' }}>
        <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
        zIndex: 9998, animation: 'proModalFade 0.2s ease-out',
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem', pointerEvents: 'none',
      }}>
        <div style={{
          background: '#fff', borderRadius: '1.5rem', width: '100%', maxWidth: '620px', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column', pointerEvents: 'auto', overflow: 'hidden',
          boxShadow: '0 25px 80px rgba(0,0,0,0.2)', animation: 'proModalScale 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {/* Header with gradient */}
          <div style={{ position: 'relative', background: gradient, padding: '1.5rem 1.5rem 2.5rem', flexShrink: 0 }}>
            <button onClick={onClose} style={{
              position: 'absolute', top: '0.75rem', right: '0.75rem', border: 'none', background: 'rgba(255,255,255,0.2)',
              borderRadius: '0.5rem', padding: '0.375rem', cursor: 'pointer', backdropFilter: 'blur(4px)',
            }}>
              <X style={{ width: '18px', height: '18px', color: '#fff' }} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {employee.photo_url ? (
                <img src={employee.photo_url} alt={employee.name} style={{
                  width: '3.5rem', height: '3.5rem', borderRadius: '1rem', objectFit: 'cover',
                  border: '3px solid rgba(255,255,255,0.3)',
                }} />
              ) : (
                <div style={{
                  width: '3.5rem', height: '3.5rem', borderRadius: '1rem', border: '3px solid rgba(255,255,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '1.375rem', fontWeight: 800, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)',
                }}>
                  {employee.name.charAt(0)}
                </div>
              )}
              <div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                  {employee.name}
                  {employee.nickname && <span style={{ fontWeight: 500, fontSize: '0.875rem', opacity: 0.8, marginLeft: '0.5rem' }}>({employee.nickname})</span>}
                </h2>
                {employee.specialty && <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.8)', marginTop: '0.125rem' }}>{employee.specialty}</p>}
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
            {/* Status + Commission badges */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.375rem 0.875rem', borderRadius: '2rem',
                background: `${st.color}15`, border: `1px solid ${st.color}30`,
                fontSize: '0.75rem', fontWeight: 700, color: st.color,
              }}>
                ● {st.label}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.375rem 0.875rem', borderRadius: '2rem',
                background: '#f5f3ff', border: '1px solid #e0d4ff',
              }}>
                <Percent style={{ width: '12px', height: '12px', color: '#7c5cfc' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c5cfc' }}>Comissão: {employee.commission_percent || 0}%</span>
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.375rem 0.875rem', borderRadius: '2rem',
                background: employee.has_schedule !== false ? '#ecfdf5' : '#f3f4f6',
                border: employee.has_schedule !== false ? '1px solid #a7f3d0' : '1px solid #e5e7eb',
              }}>
                <Calendar style={{ width: '12px', height: '12px', color: employee.has_schedule !== false ? '#059669' : '#9ca3af' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: employee.has_schedule !== false ? '#059669' : '#9ca3af' }}>
                  {employee.has_schedule !== false ? 'Possui agenda' : 'Sem agenda'}
                </span>
              </span>
            </div>

            {/* Info rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {infoRow(<Phone style={{ width: '14px', height: '14px', color: '#7c5cfc' }} />, "Telefone", employee.phone ? formatPhone(employee.phone) : null)}
              {infoRow(<Mail style={{ width: '14px', height: '14px', color: '#7c5cfc' }} />, "E-mail", employee.email)}
              {infoRow(<Briefcase style={{ width: '14px', height: '14px', color: '#7c5cfc' }} />, "Especialidade", employee.specialty)}
              {infoRow(<Clock style={{ width: '14px', height: '14px', color: '#7c5cfc' }} />, "Horário", `${employee.working_hours_start} — ${employee.working_hours_end}`)}
              {employee.cpf && infoRow(<User style={{ width: '14px', height: '14px', color: '#7c5cfc' }} />, "CPF", employee.cpf)}
              {employee.social_links?.instagram && infoRow(<AtSign style={{ width: '14px', height: '14px', color: '#E1306C' }} />, "Instagram", employee.social_links.instagram)}
              {employee.additional_info?.city && infoRow(<MapPin style={{ width: '14px', height: '14px', color: '#7c5cfc' }} />, "Cidade", `${employee.additional_info.city}${employee.additional_info.state ? ` - ${employee.additional_info.state}` : ''}`)}
            </div>

            {/* Workdays */}
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Dias de Atendimento</p>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                {weekDays.map((d, j) => {
                  const active = employee.workdays?.includes(j)
                  return (
                    <span key={j} style={{
                      flex: 1, textAlign: 'center', fontSize: '0.6875rem', padding: '0.5rem 0', borderRadius: '0.5rem', fontWeight: 700,
                      background: active ? gradient : '#f3f4f6', color: active ? '#fff' : '#9ca3af',
                      boxShadow: active ? '0 2px 6px rgba(124,92,252,0.25)' : 'none',
                    }}>
                      {d}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            {employee.notes && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fffbeb', borderRadius: '0.625rem', border: '1px solid #fde68a' }}>
                <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Observações</p>
                <p style={{ fontSize: '0.75rem', color: '#78350f', lineHeight: 1.5 }}>{employee.notes}</p>
              </div>
            )}

            {/* Metadata */}
            {employee.created_at && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fafbfc', borderRadius: '0.625rem', border: '1px solid #f1f3f9' }}>
                <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>
                  Cadastrado em {new Date(employee.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {employee.updated_at && employee.updated_at !== employee.created_at && ` · Atualizado em ${new Date(employee.updated_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f3f9', background: '#fafbfc', display: 'flex', gap: '0.625rem', flexShrink: 0 }}>
            <button onClick={() => { onEdit(employee); onClose() }} style={{
              flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none',
              background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff',
              fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
              boxShadow: '0 4px 14px rgba(124,92,252,0.25)', minHeight: '44px',
            }}>
              <Pencil style={{ width: '14px', height: '14px' }} /> Editar
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} style={{
              flex: 1, padding: '0.75rem', borderRadius: '0.75rem',
              border: '2px solid #fecaca', background: '#fef2f2', color: '#ef4444',
              fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', minHeight: '44px',
            }}>
              <Trash2 style={{ width: '14px', height: '14px' }} /> Excluir
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <>
          <div onClick={() => setShowDeleteConfirm(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
            zIndex: 10010, animation: 'proModalFade 0.15s ease-out',
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 10011, background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '400px',
            overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
            animation: 'proModalScale 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #ef4444, #f87171)' }} />
            <div style={{ padding: '1.75rem 1.5rem 1.5rem', textAlign: 'center' }}>
              <div style={{
                width: '3.5rem', height: '3.5rem', borderRadius: '1rem',
                background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', border: '1px solid #fecaca',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
              }}>
                <AlertTriangle style={{ width: '1.5rem', height: '1.5rem', color: '#ef4444' }} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 800, color: '#1e1e2d', marginBottom: '0.375rem' }}>
                Excluir Profissional?
              </h3>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                <strong style={{ color: '#1e1e2d' }}>{employee.name}</strong> será permanentemente removido. Esta ação é <strong style={{ color: '#ef4444' }}>irreversível</strong>.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} style={{
                  flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '2px solid #e8ecf4',
                  background: '#fff', color: '#374151', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', minHeight: '48px',
                }}>Cancelar</button>
                <button onClick={async () => { setDeleting(true); await onDelete(employee.id) }} disabled={deleting} style={{
                  flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none',
                  background: deleting ? '#fca5a5' : 'linear-gradient(135deg, #ef4444, #f87171)',
                  color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: deleting ? 'wait' : 'pointer', minHeight: '48px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                  boxShadow: '0 4px 14px rgba(239,68,68,0.3)', opacity: deleting ? 0.7 : 1,
                }}>
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 style={{ width: '15px', height: '15px' }} />}
                  {deleting ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes proModalFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes proModalScale { from { transform: scale(0.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </>
  )
}
