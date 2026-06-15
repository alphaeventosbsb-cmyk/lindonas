"use client"
import { useState, useRef } from "react"
import { Camera, X, Upload, AtSign, Globe, Link2, Play, CalendarCheck2 } from "lucide-react"
import { ExpandableImage } from "@/components/ui/expandable-image"
import type { Employee, EmployeeGender, EmployeeStatus, EmployeeSocialLinks } from "@/lib/types/database"

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
  border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d',
  fontSize: '0.8125rem', fontWeight: 500, outline: 'none', transition: 'border-color 0.2s',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem'
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', appearance: 'auto' as any }

function maskCPF(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

interface FormData {
  name: string; nickname: string; cpf: string; gender: EmployeeGender
  birthDate: string; phone: string; whatsapp: string; isWhatsapp: boolean
  email: string; specialty: string; commission: string
  status: EmployeeStatus; notes: string
  calendarColor: string
  socialLinks: EmployeeSocialLinks
  photoFile: File | null; photoPreview: string | null; photoUrl: string | null
  hasSchedule: boolean
}

interface Props {
  form: FormData
  onChange: (f: Partial<FormData>) => void
}

const genderOptions: { value: EmployeeGender; label: string }[] = [
  { value: 'not_informed', label: 'Não informado' },
  { value: 'female', label: 'Feminino' },
  { value: 'male', label: 'Masculino' },
  { value: 'other', label: 'Outro' },
]
const statusOptions: { value: EmployeeStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Ativo', color: '#22c55e' },
  { value: 'inactive', label: 'Inativo', color: '#9ca3af' },
  { value: 'blocked', label: 'Bloqueado', color: '#ef4444' },
  { value: 'vacation', label: 'Férias', color: '#f59e0b' },
  { value: 'away', label: 'Afastado', color: '#8b5cf6' },
]

export function TabDadosGerais({ form, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [showSocial, setShowSocial] = useState(
    !!(form.socialLinks?.instagram || form.socialLinks?.facebook || form.socialLinks?.tiktok || form.socialLinks?.youtube || form.socialLinks?.website || form.socialLinks?.other)
  )

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) return alert('Formato não permitido. Use: jpg, png ou webp')
    if (file.size > 4 * 1024 * 1024) return alert('Arquivo muito grande. Máximo: 4MB')
    const reader = new FileReader()
    reader.onload = () => onChange({ photoFile: file, photoPreview: reader.result as string })
    reader.readAsDataURL(file)
  }

  const removePhoto = () => {
    onChange({ photoFile: null, photoPreview: null, photoUrl: null })
    if (fileRef.current) fileRef.current.value = ''
  }

  const updateSocial = (key: keyof EmployeeSocialLinks, val: string) => {
    onChange({ socialLinks: { ...form.socialLinks, [key]: val || null } })
  }

  const photoSrc = form.photoPreview || form.photoUrl

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Schedule Toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1rem', borderRadius: '0.75rem',
        background: form.hasSchedule ? 'linear-gradient(135deg, #f0ecff, #faf8ff)' : '#fafbfc',
        border: form.hasSchedule ? '2px solid #c4b5fd' : '2px solid #e2e8f0',
        transition: 'all 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: '2rem', height: '2rem', borderRadius: '0.5rem',
            background: form.hasSchedule ? 'linear-gradient(135deg, #7c5cfc, #a78bfa)' : '#e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}>
            <CalendarCheck2 style={{ width: '14px', height: '14px', color: form.hasSchedule ? '#fff' : '#9ca3af' }} />
          </div>
          <div>
            <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d' }}>Este profissional utiliza agenda?</p>
            <p style={{ fontSize: '0.625rem', color: '#8b8fa7', marginTop: '0.125rem' }}>
              {form.hasSchedule
                ? 'Aparecerá na agenda e poderá receber agendamentos'
                : 'Não aparecerá na agenda (ex: gerente, recepcionista, administrativo)'}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.hasSchedule}
          onClick={() => onChange({ hasSchedule: !form.hasSchedule })}
          style={{
            width: '2.75rem', height: '1.5rem', borderRadius: '999px',
            background: form.hasSchedule ? 'linear-gradient(135deg, #7c5cfc, #a78bfa)' : '#d1d5db',
            border: 'none', cursor: 'pointer', position: 'relative',
            transition: 'background 0.2s', flexShrink: 0,
            boxShadow: form.hasSchedule ? '0 2px 6px rgba(124,92,252,0.3)' : 'none',
          }}
        >
          <span style={{
            position: 'absolute', top: '2px',
            left: form.hasSchedule ? '22px' : '2px',
            width: '1.25rem', height: '1.25rem', borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          }} />
        </button>
      </div>

      {/* Photo */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '5.5rem', height: '5.5rem', borderRadius: '1rem', overflow: 'hidden',
            border: '3px solid #e8ecf4', position: 'relative', cursor: 'pointer',
            background: photoSrc ? 'transparent' : 'linear-gradient(135deg, #7c5cfc, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => fileRef.current?.click()}>
            {photoSrc ? (
              <ExpandableImage src={photoSrc} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 800 }}>{form.name?.charAt(0)?.toUpperCase() || '?'}</span>
            )}
            <div style={{
              position: 'absolute', bottom: 0, right: 0, width: '1.75rem', height: '1.75rem',
              borderRadius: '0.5rem', background: '#7c5cfc', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff',
            }}>
              <Camera style={{ width: '12px', height: '12px', color: '#fff' }} />
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
            style={{ display: 'none' }} onChange={handlePhoto} />
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button type="button" onClick={() => fileRef.current?.click()} style={{
              fontSize: '0.625rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem',
              border: '1px solid #e2e8f0', background: '#fafbfc', cursor: 'pointer', color: '#374151', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '0.25rem',
            }}>
              <Upload style={{ width: '10px', height: '10px' }} /> Enviar
            </button>
            {photoSrc && (
              <button type="button" onClick={removePhoto} style={{
                fontSize: '0.625rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem',
                border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#ef4444', fontWeight: 600,
              }}>
                <X style={{ width: '10px', height: '10px' }} />
              </button>
            )}
          </div>
          <p style={{ fontSize: '0.5625rem', color: '#9ca3af', textAlign: 'center', maxWidth: '6rem' }}>jpg, png, webp · até 4MB</p>
        </div>

        <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* CPF */}
          <div>
            <label style={labelStyle}>CPF</label>
            <input value={form.cpf} onChange={e => onChange({ cpf: maskCPF(e.target.value) })}
              style={inputStyle} placeholder="000.000.000-00" maxLength={14} />
          </div>
          {/* Name */}
          <div>
            <label style={labelStyle}>Nome *</label>
            <input value={form.name} onChange={e => onChange({ name: e.target.value })}
              style={inputStyle} placeholder="Nome completo" />
          </div>
          {/* Nickname */}
          <div>
            <label style={labelStyle}>Apelido</label>
            <input value={form.nickname} onChange={e => onChange({ nickname: e.target.value })}
              style={inputStyle} placeholder="Nome exibido na página de agendamento" />
            <p style={{ fontSize: '0.625rem', color: '#9ca3af', marginTop: '0.125rem' }}>Será exibido no site de agendamento</p>
          </div>
        </div>
      </div>

      {/* Gender + Birth */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={labelStyle}>Gênero</label>
          <select value={form.gender} onChange={e => onChange({ gender: e.target.value as EmployeeGender })} style={selectStyle}>
            {genderOptions.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Data de Nascimento</label>
          <input type="date" value={form.birthDate} onChange={e => onChange({ birthDate: e.target.value })} style={inputStyle} />
        </div>
      </div>

      {/* Phone + WhatsApp */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={labelStyle}>Telefone</label>
          <input value={form.phone} onChange={e => onChange({ phone: maskPhone(e.target.value) })}
            style={inputStyle} placeholder="(00) 00000-0000" maxLength={16} />
        </div>
        <div>
          <label style={labelStyle}>WhatsApp</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={form.isWhatsapp} onChange={e => {
                onChange({ isWhatsapp: e.target.checked, whatsapp: e.target.checked ? form.phone : form.whatsapp })
              }} style={{ accentColor: '#7c5cfc' }} />
              <span style={{ color: '#6b7280', fontWeight: 500 }}>Mesmo nº</span>
            </label>
            {!form.isWhatsapp && (
              <input value={form.whatsapp} onChange={e => onChange({ whatsapp: maskPhone(e.target.value) })}
                style={{ ...inputStyle, flex: 1 }} placeholder="(00) 00000-0000" maxLength={16} />
            )}
          </div>
        </div>
      </div>

      {/* Email */}
      <div>
        <label style={labelStyle}>E-mail</label>
        <input type="email" value={form.email} onChange={e => onChange({ email: e.target.value })}
          style={inputStyle} placeholder="profissional@email.com" />
      </div>

      {/* Specialty + Commission */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={labelStyle}>Especialidade</label>
          <input value={form.specialty} onChange={e => onChange({ specialty: e.target.value })}
            style={inputStyle} placeholder="Ex: Cabeleireira" />
        </div>
        <div>
          <label style={labelStyle}>Comissão (%)</label>
          <input type="number" min="0" max="100" value={form.commission}
            onChange={e => { const v = parseInt(e.target.value); if (!e.target.value || (v >= 0 && v <= 100)) onChange({ commission: e.target.value }) }}
            style={inputStyle} placeholder="30" />
        </div>
      </div>

      {/* Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={labelStyle}>Status</label>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {statusOptions.map(s => (
              <button key={s.value} type="button" onClick={() => onChange({ status: s.value })} style={{
                padding: '0.375rem 0.75rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 700,
                border: form.status === s.value ? `2px solid ${s.color}` : '2px solid #e8ecf4',
                background: form.status === s.value ? `${s.color}15` : '#fff',
                color: form.status === s.value ? s.color : '#6b7280', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Cor na Agenda</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="color" value={form.calendarColor || '#7c5cfc'} onChange={e => onChange({ calendarColor: e.target.value })}
              style={{ width: '2.5rem', height: '2.5rem', padding: 0, border: '2px solid #e2e8f0', borderRadius: '0.5rem', cursor: 'pointer' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: '#374151', fontWeight: 600 }}>{form.calendarColor || '#7c5cfc'}</span>
              <span style={{ fontSize: '0.625rem', color: '#9ca3af' }}>Destaque da coluna</span>
            </div>
            {form.calendarColor && (
              <button type="button" onClick={() => onChange({ calendarColor: '' })} style={{
                marginLeft: 'auto', fontSize: '0.625rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem',
                border: '1px solid #e2e8f0', background: '#fafbfc', cursor: 'pointer', color: '#6b7280'
              }}>
                Padrão
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Social links toggle */}
      <div>
        <button type="button" onClick={() => setShowSocial(!showSocial)} style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600,
          color: '#7c5cfc', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>
          <Link2 style={{ width: '14px', height: '14px' }} />
          {showSocial ? 'Ocultar redes sociais' : 'Adicionar redes sociais'}
        </button>
        {showSocial && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
            {([
              { key: 'instagram' as const, icon: <AtSign style={{ width: '12px', height: '12px', color: '#E1306C' }} />, ph: '@perfil' },
              { key: 'facebook' as const, icon: <Globe style={{ width: '12px', height: '12px', color: '#1877F2' }} />, ph: 'facebook.com/perfil' },
              { key: 'tiktok' as const, icon: <span style={{ fontSize: '10px' }}>🎵</span>, ph: '@tiktok' },
              { key: 'youtube' as const, icon: <Play style={{ width: '12px', height: '12px', color: '#FF0000' }} />, ph: 'Canal YouTube' },
              { key: 'website' as const, icon: <Globe style={{ width: '12px', height: '12px', color: '#6b7280' }} />, ph: 'www.site.com' },
              { key: 'other' as const, icon: <Link2 style={{ width: '12px', height: '12px', color: '#6b7280' }} />, ph: 'Outro link' },
            ]).map(s => (
              <div key={s.key} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)' }}>{s.icon}</div>
                <input value={form.socialLinks?.[s.key] || ''} onChange={e => updateSocial(s.key, e.target.value)}
                  style={{ ...inputStyle, paddingLeft: '2rem', fontSize: '0.75rem' }} placeholder={s.ph} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label style={labelStyle}>Observações internas</label>
        <textarea value={form.notes} onChange={e => onChange({ notes: e.target.value })} rows={2}
          style={{ ...inputStyle, resize: 'vertical' as any }} placeholder="Anotações administrativas..." />
      </div>
    </div>
  )
}

export type { FormData as DadosGeraisFormData }
