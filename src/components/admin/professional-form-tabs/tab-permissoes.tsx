"use client"
import { useState } from "react"
import { Copy, Send, RefreshCw, ShieldOff, ShieldCheck, ExternalLink, CheckCircle, Clock, XCircle, AlertTriangle, Settings, Shield, Mail } from "lucide-react"
import type { Employee, EmployeeInvite, EmployeeInviteStatus } from "@/lib/types/database"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"
import { RBAC_PROFILES } from "@/lib/rbac/rbac-types"
import { countActivePermissions } from "@/lib/rbac/rbac-utils"
import { RBACModal } from "@/components/admin/rbac-modal"
import { fetchCollection } from "@/lib/firebase/client-utils"
import { useCustomProfiles } from "@/lib/rbac/useCustomProfiles"

const statusConfig: Record<EmployeeInviteStatus, { label: string; color: string; bg: string; icon: any }> = {
  not_sent: { label: 'Não enviado', color: '#6b7280', bg: '#f3f4f6', icon: Clock },
  sent: { label: 'Enviado', color: '#3b82f6', bg: '#eff6ff', icon: Send },
  awaiting_login: { label: 'Aguardando login', color: '#f59e0b', bg: '#fffbeb', icon: Clock },
  active: { label: 'Ativo', color: '#22c55e', bg: '#f0fdf4', icon: CheckCircle },
  expired: { label: 'Expirado', color: '#ef4444', bg: '#fef2f2', icon: XCircle },
  revoked: { label: 'Revogado', color: '#6b7280', bg: '#f9fafb', icon: ShieldOff },
}

interface Props {
  employee: Employee | null
  businessName: string
  rbacProfileId: string
  rbacPermissions: string[]
  rbacProfileCustom: boolean
  onRBACChange: (profileId: string, permissions: string[], isCustom: boolean) => void
  onGenerateInvite: () => Promise<string>
  onRevokeAccess: () => Promise<void>
  onToggleAccess: (enabled: boolean) => Promise<void>
}

function generateInviteUrl(token: string) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/convite/${token}`
}

export function TabPermissoes({ employee, businessName, rbacProfileId, rbacPermissions, rbacProfileCustom, onRBACChange, onGenerateInvite, onRevokeAccess, onToggleAccess }: Props) {
  const [generating, setGenerating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [showRBACModal, setShowRBACModal] = useState(false)
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const { ConfirmationDialog, confirm } = useConfirm()

  const invite = employee?.invite
  const inviteStatus = invite?.status || 'not_sent'
  const sc = statusConfig[inviteStatus]
  const StatusIcon = sc.icon
  const isLinked = !!employee?.auth_uid
  const accessEnabled = employee?.access_enabled ?? false

  const { combinedProfiles } = useCustomProfiles()

  const currentProfile = combinedProfiles.find(p => p.id === rbacProfileId)
  
  const profileName = rbacProfileCustom
    ? `Personalizado (baseado em ${currentProfile?.name || '—'})`
    : (currentProfile?.name || 'Sem Acesso')
  const activeCount = countActivePermissions(rbacPermissions)

  const handleOpenRBAC = async () => {
    try {
      const emps = await fetchCollection<Employee>("employees", "name")
      setAllEmployees(emps.filter(e => e.id !== employee?.id))
    } catch { /* ignore */ }
    setShowRBACModal(true)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const token = await onGenerateInvite()
      setInviteToken(token)
      toast.success('Convite gerado com sucesso!')
    } catch (err) {
      toast.error('Erro ao gerar convite')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    const token = inviteToken || invite?.token_hash
    if (!token) return
    const url = generateInviteUrl(token)
    navigator.clipboard.writeText(url)
    toast.success('Link copiado com sucesso!')
  }

  const handleWhatsApp = () => {
    const phone = employee?.whatsapp || employee?.phone
    if (!phone) return toast.error('Cadastre o WhatsApp do profissional para enviar o convite.')
    const token = inviteToken || invite?.token_hash
    if (!token) return toast.error('Gere um convite primeiro.')
    const url = generateInviteUrl(token)
    const cleanPhone = phone.replace(/\D/g, '')
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    const msg = encodeURIComponent(
      `Olá, ${employee?.name}!\n\nVocê recebeu um convite para acessar o painel do sistema de agendamento do ${businessName}.\n\nEntre com sua conta Google pelo link abaixo:\n\n${url}\n\nSuas permissões de acesso já foram configuradas pelo estabelecimento.`
    )
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, '_blank')
  }

  const handleEmail = () => {
    const email = employee?.email
    if (!email) return toast.error('Cadastre o e-mail do profissional para enviar o convite.')
    const token = inviteToken || invite?.token_hash
    if (!token) return toast.error('Gere um convite primeiro.')
    const url = generateInviteUrl(token)
    
    const subject = encodeURIComponent(`Convite de acesso ao painel do ${businessName}`)
    const body = encodeURIComponent(
      `Olá, ${employee?.name}!\n\nVocê recebeu um convite para acessar o painel administrativo do ${businessName}.\n\nAcesse pelo link abaixo:\n${url}\n\nEntre com sua conta Google para concluir o acesso.\n\nAtenciosamente,\n${businessName}`
    )
    
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_self')
    toast.success('Cliente de e-mail aberto!')
  }

  const handleRevoke = async () => {
    const confirmed = await confirm({
      title: "Revogar acesso",
      message: "Tem certeza que deseja revogar o acesso deste profissional?\n\nEle perderá acesso ao painel imediatamente.",
      confirmText: "Revogar acesso",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    setRevoking(true)
    try {
      await onRevokeAccess()
      toast.success('Acesso revogado com sucesso')
    } catch {
      toast.error('Erro ao revogar acesso')
    } finally {
      setRevoking(false)
    }
  }

  const handleToggle = async () => {
    setToggling(true)
    try {
      await onToggleAccess(!accessEnabled)
      toast.success(accessEnabled ? 'Acesso desativado' : 'Acesso ativado')
    } catch {
      toast.error('Erro ao alterar acesso')
    } finally {
      setToggling(false)
    }
  }

  const hasToken = !!(inviteToken || invite?.token_hash)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: '#f0ecff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck style={{ width: '14px', height: '14px', color: '#7c5cfc' }} />
        </div>
        <div>
          <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d' }}>Permissões e Acesso do Profissional</p>
          <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>Configure as permissões e o login de acesso ao painel</p>
        </div>
      </div>

      {/* ===== RBAC SECTION ===== */}
      <div style={{ background: 'linear-gradient(135deg, #faf8ff, #f0ecff)', border: '1px solid #e0d4ff', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield style={{ width: '14px', height: '14px', color: '#7c5cfc' }} />
          <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d' }}>Perfil e Permissões</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Perfil RBAC</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c5cfc', padding: '0.125rem 0.5rem', borderRadius: '999px', background: '#f0ecff' }}>{profileName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Permissões ativas</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e1e2d' }}>{activeCount}</span>
          </div>
          {employee?.rbac_updated_at && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>Última alteração</span>
              <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                {new Date(employee.rbac_updated_at).toLocaleString('pt-BR')}
                {employee.rbac_updated_by ? ` por ${employee.rbac_updated_by}` : ''}
              </span>
            </div>
          )}
        </div>

        <button type="button" onClick={handleOpenRBAC} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
          padding: '0.625rem', borderRadius: '0.625rem', border: 'none',
          background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff',
          fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(124,92,252,0.25)',
        }}>
          <Settings style={{ width: '14px', height: '14px' }} />
          Configurar Permissões
        </button>
      </div>

      {/* Not saved yet */}
      {!employee && (
        <div style={{ background: '#f0ecff', border: '1px solid #e0d4ff', borderRadius: '0.75rem', padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#7c5cfc' }}>Salve o profissional primeiro</p>
          <p style={{ fontSize: '0.6875rem', color: '#8b8fa7', marginTop: '0.25rem' }}>O convite de acesso será gerado após salvar o cadastro.</p>
        </div>
      )}

      {employee && (
        <>
          {/* Status card */}
          <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Status do convite</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 700, background: sc.bg, color: sc.color }}>
                <StatusIcon style={{ width: '12px', height: '12px' }} />
                {sc.label}
              </span>
            </div>

            {isLinked && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Google vinculado</span>
                <span style={{ fontSize: '0.75rem', color: '#1e1e2d', fontWeight: 500 }}>{employee.google_email || '—'}</span>
              </div>
            )}

            {invite?.last_login_at && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Último login</span>
                <span style={{ fontSize: '0.75rem', color: '#1e1e2d' }}>{new Date(invite.last_login_at).toLocaleString('pt-BR')}</span>
              </div>
            )}

            {/* Access toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #f1f3f9' }}>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Acesso ao painel</p>
                <p style={{ fontSize: '0.5625rem', color: '#9ca3af' }}>{accessEnabled ? 'Profissional pode acessar o sistema' : 'Acesso desativado'}</p>
              </div>
              <button type="button" onClick={handleToggle} disabled={toggling} style={{
                width: '2.75rem', height: '1.5rem', borderRadius: '999px', padding: '2px', border: 'none',
                background: accessEnabled ? '#22c55e' : '#d1d5db', cursor: toggling ? 'wait' : 'pointer', transition: 'background 0.2s',
              }}>
                <div style={{
                  width: '1.25rem', height: '1.25rem', borderRadius: '50%', background: '#fff',
                  transition: 'transform 0.2s', transform: accessEnabled ? 'translateX(1.25rem)' : 'translateX(0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }} />
              </button>
            </div>
          </div>

          {/* Invite link section */}
          <div style={{ background: '#faf8ff', border: '1px solid #e0d4ff', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c5cfc' }}>Convite de Acesso</p>

            {hasToken && (
              <div style={{ position: 'relative' }}>
                <input readOnly value={generateInviteUrl(inviteToken || invite?.token_hash || '')}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', paddingRight: '2.5rem', borderRadius: '0.5rem', border: '1px solid #e0d4ff', background: '#fff', fontSize: '0.6875rem', color: '#6b7280', outline: 'none' }} />
                <button type="button" onClick={handleCopy} style={{
                  position: 'absolute', right: '0.375rem', top: '50%', transform: 'translateY(-50%)',
                  padding: '0.25rem', borderRadius: '0.25rem', border: 'none', background: '#f0ecff', cursor: 'pointer',
                }}>
                  <Copy style={{ width: '12px', height: '12px', color: '#7c5cfc' }} />
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleGenerate} disabled={generating} style={{
                flex: 1, minWidth: '120px', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: 'none',
                background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff',
                fontWeight: 600, fontSize: '0.6875rem', cursor: generating ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                opacity: generating ? 0.7 : 1,
              }}>
                <RefreshCw style={{ width: '12px', height: '12px' }} />
                {hasToken ? 'Gerar Novo' : 'Gerar Convite'}
              </button>

              {hasToken && (
                <>
                  <button type="button" onClick={handleCopy} style={{
                    flex: 1, minWidth: '100px', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                    border: '1px solid #e0d4ff', background: '#fff', color: '#7c5cfc',
                    fontWeight: 600, fontSize: '0.6875rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                  }}>
                    <Copy style={{ width: '12px', height: '12px' }} /> Copiar Link
                  </button>

                  <button type="button" onClick={handleWhatsApp} style={{
                    flex: 1, minWidth: '100px', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                    border: 'none', background: '#25D366', color: '#fff',
                    fontWeight: 600, fontSize: '0.6875rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                  }}>
                    <Send style={{ width: '12px', height: '12px' }} /> WhatsApp
                  </button>

                  <button type="button" onClick={handleEmail} style={{
                    flex: 1, minWidth: '100px', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                    border: 'none', background: '#3b82f6', color: '#fff',
                    fontWeight: 600, fontSize: '0.6875rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                  }}>
                    <Mail style={{ width: '12px', height: '12px' }} /> E-mail
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Revoke access button */}
          {(isLinked || accessEnabled) && (
            <button type="button" onClick={handleRevoke} disabled={revoking} style={{
              padding: '0.625rem', borderRadius: '0.625rem', border: '2px solid #fecaca',
              background: '#fef2f2', color: '#ef4444', fontWeight: 600, fontSize: '0.75rem',
              cursor: revoking ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
            }}>
              <ShieldOff style={{ width: '14px', height: '14px' }} />
              {revoking ? 'Revogando...' : 'Revogar Acesso'}
            </button>
          )}
        </>
      )}
      <ConfirmationDialog />

      {/* RBAC Modal */}
      {showRBACModal && (
        <RBACModal
          employeeName={employee?.name || 'Novo Profissional'}
          currentProfileId={rbacProfileId}
          currentPermissions={rbacPermissions}
          employees={allEmployees}
          profiles={combinedProfiles}
          onSave={(profileId, perms, isCustom) => {
            onRBACChange(profileId, perms, isCustom)
            setShowRBACModal(false)
            toast.success('Permissões atualizadas! Salve o profissional para aplicar.')
          }}
          onClose={() => setShowRBACModal(false)}
        />
      )}
    </div>
  )
}
