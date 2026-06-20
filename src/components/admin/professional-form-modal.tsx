"use client"
import { useState, useEffect } from "react"
import { X, Loader2, Save, Trash2, AlertTriangle, User, Shield, Clock, Scissors, FileText, UserPlus, KeyRound } from "lucide-react"
import { fetchCollection, updateDocument } from "@/lib/firebase/client-utils"
import type { Employee, Service, Category, EmployeePermissions, EmployeeScheduleDay, EmployeeProfessionalService, EmployeeAdditionalInfo, EmployeePartnerInfo, EmployeeStatus, EmployeeGender, EmployeeSocialLinks } from "@/lib/types/database"
import { TabDadosGerais } from "./professional-form-tabs/tab-dados-gerais"
import { TabPermissoes } from "./professional-form-tabs/tab-permissoes"
import { TabHorarios } from "./professional-form-tabs/tab-horarios"
import { TabServicos } from "./professional-form-tabs/tab-servicos"
import { TabInfoAdicional } from "./professional-form-tabs/tab-info-adicional"
import { TabParceiro } from "./professional-form-tabs/tab-parceiro"

const tabs = [
  { id: 'dados', label: 'Dados Gerais', icon: User },
  { id: 'permissoes', label: 'Permissões e Acesso', icon: Shield },
  { id: 'horarios', label: 'Horários', icon: Clock },
  { id: 'servicos', label: 'Serviços', icon: Scissors },
  { id: 'info', label: 'Info Adicional', icon: FileText },
  { id: 'parceiro', label: 'Parceiro', icon: UserPlus },
]

interface Props {
  employee: Employee | null
  onClose: () => void
  onSave: (data: any, photoFile: File | null, oldPhotoUrl: string | null) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  businessName?: string
}

function generateToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

export function ProfessionalFormModal({ employee, onClose, onSave, onDelete, businessName = 'Estabelecimento' }: Props) {
  const [activeTab, setActiveTab] = useState('dados')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  // Form state
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [cpf, setCpf] = useState('')
  const [gender, setGender] = useState<EmployeeGender>('not_informed')
  const [birthDate, setBirthDate] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [isWhatsapp, setIsWhatsapp] = useState(false)
  const [email, setEmail] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [commission, setCommission] = useState('30')
  const [status, setStatus] = useState<EmployeeStatus>('active')
  const [notes, setNotes] = useState('')
  const [calendarColor, setCalendarColor] = useState('')
  const [socialLinks, setSocialLinks] = useState<EmployeeSocialLinks>({})
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [hasSchedule, setHasSchedule] = useState(true)

  const [permissions, setPermissions] = useState<EmployeePermissions>({
    canAccessDashboard: false, canViewSchedule: true, canCreateAppointments: true,
    canEditAppointments: false, canCancelAppointments: false, canViewClients: false,
    canEditClients: false, canViewFinancial: false, canReceiveNotifications: true, showOnPublicBooking: true,
  })

  // RBAC State
  const [rbacProfileId, setRbacProfileId] = useState<string>('no_access')
  const [rbacPermissions, setRbacPermissions] = useState<string[]>([])
  const [rbacProfileCustom, setRbacProfileCustom] = useState<boolean>(false)

  const [workdays, setWorkdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('18:00')
  const [scheduleByDay, setScheduleByDay] = useState<Record<string, EmployeeScheduleDay> | null>(null)

  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [professionalServices, setProfessionalServices] = useState<EmployeeProfessionalService[]>([])

  const [additionalInfo, setAdditionalInfo] = useState<EmployeeAdditionalInfo>({})
  const [partnerInfo, setPartnerInfo] = useState<EmployeePartnerInfo>({ isPartner: false })
  const [employeePatch, setEmployeePatch] = useState<{ employeeId: string | null; data: Partial<Employee> }>({ employeeId: null, data: {} })

  // Load services and categories
  useEffect(() => {
    fetchCollection<Service>('services', 'name').then(setServices)
    fetchCollection<Category>('categories', 'display_order').then(setCategories)
  }, [])

  // Populate form when editing
  useEffect(() => {
    if (!employee) return
    setName(employee.name || '')
    setNickname(employee.nickname || '')
    setCpf(employee.cpf || '')
    setGender(employee.gender || 'not_informed')
    setBirthDate(employee.birth_date || '')
    setPhone(employee.phone || '')
    setWhatsapp(employee.whatsapp || '')
    setIsWhatsapp(employee.is_whatsapp || false)
    setEmail(employee.email || '')
    setSpecialty(employee.specialty || '')
    setCommission(String(employee.commission_percent ?? 30))
    setStatus(employee.status || (employee.is_active ? 'active' : 'inactive'))
    setNotes(employee.notes || '')
    setCalendarColor(employee.calendar_color || '')
    setSocialLinks(employee.social_links || {})
    setPhotoUrl(employee.photo_url || null)
    setHasSchedule(employee.has_schedule !== false)
    setPermissions(employee.permissions || {
      canAccessDashboard: false, canViewSchedule: true, canCreateAppointments: true,
      canEditAppointments: false, canCancelAppointments: false, canViewClients: false,
      canEditClients: false, canViewFinancial: false, canReceiveNotifications: true, showOnPublicBooking: true,
    })
    setRbacProfileId(employee.rbac_profile_id || 'no_access')
    setRbacPermissions(employee.rbac_permissions || [])
    setRbacProfileCustom(employee.rbac_profile_custom || false)
    setWorkdays(employee.workdays || [1, 2, 3, 4, 5])
    setStart(employee.working_hours_start || '08:00')
    setEnd(employee.working_hours_end || '18:00')
    setScheduleByDay(employee.schedule_by_day || null)
    setServiceIds(employee.service_ids || [])
    setProfessionalServices(employee.professional_services || [])
    setAdditionalInfo(employee.additional_info || {})
    setPartnerInfo(employee.partner_info || { isPartner: false })
  }, [employee])

  // ESC key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const handleSave = async () => {
    if (!name.trim()) { setActiveTab('dados'); return alert('Nome é obrigatório') }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setActiveTab('dados'); return alert('E-mail inválido') }
    if (start && end && start >= end) { setActiveTab('horarios'); return alert('Horário final deve ser maior que o inicial') }
    const c = parseInt(commission)
    if (isNaN(c) || c < 0 || c > 100) { setActiveTab('dados'); return alert('Comissão deve ser entre 0 e 100') }

    setSaving(true)
    try {
      const data: any = {
        name: name.trim(),
        nickname: nickname.trim() || null,
        cpf: cpf || null,
        gender,
        birth_date: birthDate || null,
        phone: phone || null,
        whatsapp: isWhatsapp ? phone : (whatsapp || null),
        is_whatsapp: isWhatsapp,
        email: email || null,
        social_links: socialLinks,
        specialty: specialty || null,
        bio: employee?.bio || null,
        commission_percent: parseInt(commission) || 30,
        status,
        is_active: status === 'active',
        notes: notes || null,
        calendar_color: calendarColor || null,
        permissions,
        service_ids: serviceIds,
        professional_services: professionalServices.length > 0 ? professionalServices : null,
        workdays,
        working_hours_start: start,
        working_hours_end: end,
        schedule_by_day: scheduleByDay,
        additional_info: Object.keys(additionalInfo).length > 0 ? additionalInfo : null,
        partner_info: partnerInfo,
        has_schedule: hasSchedule,
        rbac_profile_id: rbacProfileId,
        rbac_permissions: rbacPermissions,
        rbac_profile_custom: rbacProfileCustom,
      }
      const oldUrl = (photoFile || !photoUrl) ? (employee?.photo_url || null) : null
      
      const cleanUndefined = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (Array.isArray(obj)) return obj.map(cleanUndefined).filter(v => v !== undefined);
        if (typeof obj === 'object') {
          return Object.fromEntries(
            Object.entries(obj)
              .map(([k, v]) => [k, cleanUndefined(v)])
              .filter(([_, v]) => v !== undefined)
          );
        }
        return obj;
      };
      
      const cleanData = cleanUndefined(data);
      await onSave(cleanData, photoFile, oldUrl)
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert('Erro ao salvar profissional')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!employee || !onDelete) return
    setDeleting(true)
    try { await onDelete(employee.id) } finally { setDeleting(false) }
  }

  const dadosGeraisForm = {
    name, nickname, cpf, gender, birthDate, phone, whatsapp, isWhatsapp,
    email, specialty, commission, status, notes, calendarColor, socialLinks,
    photoFile, photoPreview, photoUrl, hasSchedule,
  }

  const permissionsEmployee = employee
    ? ({ ...employee, ...(employeePatch.employeeId === employee.id ? employeePatch.data : {}) } as Employee)
    : null

  const handleDadosChange = (partial: any) => {
    if ('name' in partial) setName(partial.name)
    if ('nickname' in partial) setNickname(partial.nickname)
    if ('cpf' in partial) setCpf(partial.cpf)
    if ('gender' in partial) setGender(partial.gender)
    if ('birthDate' in partial) setBirthDate(partial.birthDate)
    if ('phone' in partial) setPhone(partial.phone)
    if ('whatsapp' in partial) setWhatsapp(partial.whatsapp)
    if ('isWhatsapp' in partial) setIsWhatsapp(partial.isWhatsapp)
    if ('email' in partial) setEmail(partial.email)
    if ('specialty' in partial) setSpecialty(partial.specialty)
    if ('commission' in partial) setCommission(partial.commission)
    if ('status' in partial) setStatus(partial.status)
    if ('notes' in partial) setNotes(partial.notes)
    if ('calendarColor' in partial) setCalendarColor(partial.calendarColor)
    if ('socialLinks' in partial) setSocialLinks(partial.socialLinks)
    if ('photoFile' in partial) setPhotoFile(partial.photoFile)
    if ('photoPreview' in partial) setPhotoPreview(partial.photoPreview)
    if ('photoUrl' in partial) setPhotoUrl(partial.photoUrl)
    if ('hasSchedule' in partial) setHasSchedule(partial.hasSchedule)
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
        zIndex: 9998, animation: 'pfmFade 0.2s ease-out',
      }} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0.75rem', pointerEvents: 'none',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '720px', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', pointerEvents: 'auto', overflow: 'hidden',
          boxShadow: '0 25px 80px rgba(0,0,0,0.2)', animation: 'pfmScale 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem 1.5rem', borderBottom: '1px solid #f1f3f9',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{
                width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem',
                background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(124,92,252,0.25)',
              }}>
                <User style={{ width: '16px', height: '16px', color: '#fff' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e1e2d', fontFamily: 'var(--font-heading)' }}>
                  {employee ? 'Editar Profissional' : 'Novo Profissional'}
                </h3>
                {employee && <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>{employee.name}</p>}
              </div>
            </div>
            <button onClick={onClose} style={{
              padding: '0.375rem', borderRadius: '0.5rem', border: 'none', background: '#f1f3f9', cursor: 'pointer',
            }}>
              <X style={{ width: '16px', height: '16px', color: '#8b8fa7' }} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: '0.125rem', padding: '0 1rem', borderBottom: '1px solid #f1f3f9',
            overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none',
          }}>
            {tabs.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.625rem 0.75rem', fontSize: '0.6875rem', fontWeight: 600,
                  border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                  borderBottom: active ? '2px solid #7c5cfc' : '2px solid transparent',
                  color: active ? '#7c5cfc' : '#8b8fa7',
                  background: active ? '#faf8ff' : 'transparent',
                  borderRadius: '0.5rem 0.5rem 0 0',
                }}>
                  <Icon style={{ width: '13px', height: '13px' }} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
            {activeTab === 'dados' && <TabDadosGerais form={dadosGeraisForm} onChange={handleDadosChange} />}
            {activeTab === 'permissoes' && (
              <TabPermissoes
                employee={permissionsEmployee}
                businessName={businessName}
                rbacProfileId={rbacProfileId}
                rbacPermissions={rbacPermissions}
                rbacProfileCustom={rbacProfileCustom}
                onRBACChange={(profileId, perms, isCustom) => {
                  setRbacProfileId(profileId)
                  setRbacPermissions(perms)
                  setRbacProfileCustom(isCustom)
                }}
                onGenerateInvite={async () => {
                  if (!employee) throw new Error('Salve o profissional primeiro')
                  const token = generateToken()
                  const now = new Date().toISOString()
                  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                  const invite = {
                    token_hash: token,
                    status: 'awaiting_login' as const,
                    expires_at: expires,
                    created_at: now,
                  }
                  await updateDocument('employees', employee.id, {
                    invite,
                    access_enabled: true,
                    role: 'professional',
                    rbac_profile_id: rbacProfileId,
                    rbac_permissions: rbacPermissions,
                    rbac_profile_custom: rbacProfileCustom,
                    rbac_updated_at: now,
                  })
                  setEmployeePatch(prev => ({
                    employeeId: employee.id,
                    data: {
                      ...(prev.employeeId === employee.id ? prev.data : {}),
                      invite,
                      access_enabled: true,
                      role: 'professional',
                      rbac_profile_id: rbacProfileId,
                      rbac_permissions: rbacPermissions,
                      rbac_profile_custom: rbacProfileCustom,
                      rbac_updated_at: now,
                    },
                  }))
                  return token
                }}
                onRevokeAccess={async () => {
                  if (!employee) return
                  const now = new Date().toISOString()
                  const currentInvite = permissionsEmployee?.invite || employee.invite
                  const invite = currentInvite ? { ...currentInvite, status: 'revoked' as const, revoked_at: now } : null
                  await updateDocument('employees', employee.id, { access_enabled: false, invite })
                  setEmployeePatch(prev => ({
                    employeeId: employee.id,
                    data: { ...(prev.employeeId === employee.id ? prev.data : {}), access_enabled: false, invite },
                  }))
                }}
                onToggleAccess={async (enabled) => {
                  if (!employee) return
                  await updateDocument('employees', employee.id, { access_enabled: enabled })
                  setEmployeePatch(prev => ({
                    employeeId: employee.id,
                    data: { ...(prev.employeeId === employee.id ? prev.data : {}), access_enabled: enabled },
                  }))
                }}
              />
            )}
            {activeTab === 'horarios' && (
              <TabHorarios workdays={workdays} start={start} end={end} scheduleByDay={scheduleByDay}
                onChangeWorkdays={setWorkdays} onChangeStart={setStart} onChangeEnd={setEnd} onChangeScheduleByDay={setScheduleByDay} />
            )}
            {activeTab === 'servicos' && (
              <TabServicos services={services} categories={categories} serviceIds={serviceIds} professionalServices={professionalServices}
                onChangeServiceIds={setServiceIds} onChangeProfessionalServices={setProfessionalServices} />
            )}
            {activeTab === 'info' && <TabInfoAdicional info={additionalInfo} onChange={setAdditionalInfo} />}
            {activeTab === 'parceiro' && <TabParceiro info={partnerInfo} onChange={setPartnerInfo} />}
          </div>

          {/* Footer */}
          <div style={{
            padding: '0.875rem 1.5rem', borderTop: '1px solid #f1f3f9', background: '#fafbfc',
            display: 'flex', gap: '0.625rem', flexShrink: 0, flexWrap: 'wrap',
          }}>
            {employee && onDelete && (
              <button type="button" onClick={() => setShowDeleteConfirm(true)} style={{
                padding: '0.625rem 1rem', borderRadius: '0.625rem', border: '2px solid #fecaca',
                background: '#fef2f2', color: '#ef4444', fontWeight: 600, fontSize: '0.8125rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', minHeight: '42px',
              }}>
                <Trash2 style={{ width: '14px', height: '14px' }} /> Excluir
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" onClick={onClose} style={{
              padding: '0.625rem 1.25rem', borderRadius: '0.625rem', border: '2px solid #e8ecf4',
              background: '#fff', color: '#555', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', minHeight: '42px',
            }}>
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving} style={{
              padding: '0.625rem 1.75rem', borderRadius: '0.625rem', border: 'none',
              background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff',
              fontWeight: 700, fontSize: '0.8125rem', cursor: saving ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(124,92,252,0.3)', opacity: saving ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: '0.375rem', minHeight: '42px',
            }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save style={{ width: '14px', height: '14px' }} />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <>
          <div onClick={() => setShowDeleteConfirm(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
            zIndex: 10010, animation: 'pfmFade 0.15s ease-out',
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 10011, background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '400px',
            overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
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
                <strong style={{ color: '#1e1e2d' }}>{employee?.name}</strong> será permanentemente removido.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} style={{
                  flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '2px solid #e8ecf4',
                  background: '#fff', color: '#374151', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', minHeight: '48px',
                }}>Cancelar</button>
                <button onClick={handleDelete} disabled={deleting} style={{
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
        @keyframes pfmFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pfmScale { from { transform: scale(0.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </>
  )
}
