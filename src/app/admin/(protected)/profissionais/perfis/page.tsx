"use client"

import { useState } from "react"
import { Shield, Plus, Search, Pencil, Trash2, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useCustomProfiles, type CombinedProfile } from "@/lib/rbac/useCustomProfiles"
import { RBACProfileFormModal } from "@/components/admin/rbac-profile-form-modal"
import { createDocument, updateDocument, deleteDocument, fetchCollectionWhere, setDocument, createAuditLog } from "@/lib/firebase/client-utils"
import type { CustomRBACProfile, Employee } from "@/lib/types/database"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useConfirm } from "@/components/ui/confirm-modal"
import { ALL_PERMISSION_KEYS, RBAC_PROFILES } from "@/lib/rbac/rbac-types"
import { useTenant } from "@/lib/auth/tenant-context"

export default function PerfisProfissionaisPage() {
  const { customProfiles, loading, combinedProfiles } = useCustomProfiles()
  const { saasUser } = useTenant()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all")
  
  const [showForm, setShowForm] = useState(false)
  const [editingProfile, setEditingProfile] = useState<CombinedProfile | null>(null)
  
  const { ConfirmationDialog, confirm } = useConfirm()

  const openNew = () => {
    setEditingProfile(null)
    setShowForm(true)
  }

  const openEdit = (profile: CombinedProfile) => {
    setEditingProfile(profile)
    setShowForm(true)
  }

  const handleDuplicate = (profile: CombinedProfile) => {
    const duplicatedProfile: CombinedProfile = {
      id: "",
      company_id: "",
      name: `Cópia de ${profile.name}`,
      description: profile.description,
      permissions: [...profile.permissions],
      isSystem: false,
      is_active: true,
      created_at: "",
      updated_at: "",
      hasOverride: false,
    }
    setEditingProfile(duplicatedProfile)
    setShowForm(true)
  }

  const handleSave = async (data: { name: string; description: string; is_active: boolean; permissions: string[] }) => {
    try {
      const user = saasUser || null

      if (editingProfile && editingProfile.id) {
        // ── EDITING EXISTING PROFILE ──
        const isSystem = editingProfile.isSystem
        
        const oldPermissions = editingProfile.permissions || []
        const newPermissions = data.permissions || []

        // Check employees using this profile
        const employeesUsingProfile = await fetchCollectionWhere<Employee>("employees", "rbac_profile_id", "==", editingProfile.id)
        
        let applyToUsers = false
        if (employeesUsingProfile.length > 0) {
          applyToUsers = await confirm({
            title: "Atualizar Profissionais Vinculados?",
            message: `Este perfil está sendo usado por ${employeesUsingProfile.length} profissionais.\n\nDeseja aplicar as novas permissões para todos os profissionais que usam este perfil agora?`,
            confirmText: "Sim, atualizar profissionais",
            cancelText: "Não, atualizar apenas o perfil",
            variant: "default",
          })
        }
        
        if (isSystem) {
          // System profiles: always use setDocument (upsert/merge)
          await setDocument("rbac_profiles", editingProfile.id, {
            name: data.name,
            description: data.description,
            is_active: data.is_active,
            permissions: data.permissions,
            is_system: true,
            company_id: editingProfile.company_id || "default",
          })
        } else {
          // Custom profiles: use updateDocument
          await updateDocument("rbac_profiles", editingProfile.id, {
            name: data.name,
            description: data.description,
            is_active: data.is_active,
            permissions: data.permissions,
          })
        }
        
        if (applyToUsers) {
          for (const emp of employeesUsingProfile) {
            await updateDocument("employees", emp.id, {
              rbac_permissions: data.permissions,
              rbac_profile_custom: false,
              rbac_updated_at: new Date().toISOString(),
            })
          }
          toast.success(`Perfil e ${employeesUsingProfile.length} profissionais atualizados!`)
        } else {
          toast.success("Perfil atualizado com sucesso!")
        }

        await createAuditLog("rbac_profiles", "update", `Perfil "${data.name}" alterado`, user, {
          profileId: editingProfile.id,
          profileName: data.name,
          isSystem,
          oldPermissions,
          newPermissions,
          appliedToUsers: applyToUsers,
          employeesCount: employeesUsingProfile.length,
        })

      } else {
        // ── CREATING NEW PROFILE ──
        const newDoc = await createDocument("rbac_profiles", {
          name: data.name,
          description: data.description,
          is_active: data.is_active,
          permissions: data.permissions,
          is_system: false,
          company_id: "default",
        })

        await createAuditLog("rbac_profiles", "create", `Perfil "${data.name}" criado`, user, {
          profileId: (newDoc as any)?.id || "",
          profileName: data.name,
          permissions: data.permissions,
        })

        toast.success("Perfil criado com sucesso!")
      }

      setShowForm(false)
      setEditingProfile(null)
    } catch (err: any) {
      console.error("Erro ao salvar perfil:", err)
      const message = err?.message || err?.code || "Erro desconhecido"
      toast.error(`Erro ao salvar perfil: ${message}`)
    }
  }

  const handleDelete = async (profile: CombinedProfile) => {
    const user = saasUser || null

    if (profile.isSystem && !profile.hasOverride) {
      toast.info("Este perfil do sistema não possui edições e já está no padrão de fábrica.")
      return
    }

    try {
      // Check if profile is in use
      const employeesUsingProfile = await fetchCollectionWhere<Employee>("employees", "rbac_profile_id", "==", profile.id)
      
      if (employeesUsingProfile.length > 0) {
        const action = await confirm({
          title: "Perfil em Uso",
          message: `Este perfil está sendo usado por ${employeesUsingProfile.length} profissional(is).\n\nAntes de excluir ou restaurar, altere o perfil desses profissionais ou inative este perfil.`,
          confirmText: "Inativar perfil",
          cancelText: "Cancelar",
          variant: "danger",
        })

        if (action) {
          // Inactivate instead
          if (profile.isSystem && !profile.hasOverride) {
            await setDocument("rbac_profiles", profile.id, { 
              name: profile.name,
              description: profile.description,
              is_active: false, 
              permissions: profile.permissions,
              is_system: true,
              company_id: profile.company_id || "default"
            })
          } else {
            await updateDocument("rbac_profiles", profile.id, { is_active: false })
          }
          toast.success("Perfil inativado com sucesso!")
          await createAuditLog("rbac_profiles", "inactivate", `Perfil "${profile.name}" inativado (estava em uso por ${employeesUsingProfile.length} profissionais)`, user, {
            profileId: profile.id,
            profileName: profile.name,
            employeesCount: employeesUsingProfile.length,
          })
        }
        return
      }

      // Profile not in use — confirm deletion
      const title = profile.isSystem ? "Restaurar Perfil Padrão" : "Excluir Perfil"
      const msg = profile.isSystem 
        ? `Deseja restaurar o perfil do sistema "${profile.name}" para o padrão de fábrica?\n\nTodas as suas edições personalizadas serão removidas e ele voltará ao estado original.`
        : `Deseja realmente excluir o perfil "${profile.name}"?\n\nEsta ação não poderá ser desfeita.`
      const confirmBtnText = profile.isSystem ? "Restaurar perfil" : "Excluir perfil"

      const confirmed = await confirm({
        title,
        message: msg,
        confirmText: confirmBtnText,
        cancelText: "Cancelar",
        variant: "danger",
      })

      if (!confirmed) return

      await deleteDocument("rbac_profiles", profile.id)

      await createAuditLog("rbac_profiles", "delete", `Perfil "${profile.name}" ${profile.isSystem ? 'restaurado para padrão' : 'excluído'}`, user, {
        profileId: profile.id,
        profileName: profile.name,
        permissions: profile.permissions,
        isSystem: profile.isSystem
      })

      toast.success(profile.isSystem ? "Perfil restaurado com sucesso!" : "Perfil excluído com sucesso!")
    } catch (err: any) {
      console.error("Erro ao excluir perfil:", err)
      toast.error(`Erro ao excluir perfil: ${err?.message || "Erro desconhecido"}`)
    }
  }

  const filteredProfiles = combinedProfiles.filter(p => {
    if (p.id === "custom") return false

    if (filter === "active" && !p.is_active) return false
    if (filter === "inactive" && p.is_active) return false
    
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.description?.toLowerCase() || "").includes(q)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #2a2150, #7c5cfc)', borderRadius: '1rem', padding: '2rem', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-2rem', right: '-2rem', width: '8rem', height: '8rem', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Shield style={{ width: '1.5rem', height: '1.5rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: "var(--font-heading)" }}>Perfis de Profissionais</h2>
          </div>
          <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>Crie e gerencie perfis de acesso para profissionais do sistema</p>
        </div>
      </div>

      <PermissionGate permission={["rbac.profiles.manage", "rbac.manage"]} mode="any">
        {/* Actions & Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#9ca3af' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', fontSize: '0.875rem', outline: 'none' }}
              placeholder="Buscar perfil..." />
          </div>
          
          <select value={filter} onChange={e => setFilter(e.target.value as any)} style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', fontSize: '0.875rem', outline: 'none', background: '#fff' }}>
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>

          <button onClick={openNew}
            style={{ padding: '0.75rem 1.25rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 4px 14px rgba(124,92,252,0.3)', whiteSpace: 'nowrap' }}>
            <Plus style={{ width: '1rem', height: '1rem' }} /> Novo Perfil
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Desktop header */}
            <div className="hidden md:flex" style={{ padding: '0.625rem 1.25rem', gap: '0.75rem', alignItems: 'center', background: '#fafbfc', borderRadius: '0.5rem', border: '1px solid #f1f3f9' }}>
              <span style={{ flex: 2, fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Perfil</span>
              <span style={{ width: '6rem', fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Permissões</span>
              <span style={{ width: '5rem', fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Tipo</span>
              <span style={{ width: '5rem', fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Status</span>
              <span style={{ width: '8rem', fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Ações</span>
            </div>

            {filteredProfiles.length > 0 ? filteredProfiles.map(profile => {
              const activePermsCount = profile.permissions?.filter(p => ALL_PERMISSION_KEYS.includes(p)).length || 0

              return (
                <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', background: '#fff', borderRadius: '0.75rem', border: '1px solid #e8ecf4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.15s' }}>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e1e2d' }}>{profile.name}</p>
                    {profile.description && <p style={{ fontSize: '0.75rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.125rem' }}>{profile.description}</p>}
                  </div>
                  
                  <div className="hidden md:flex" style={{ width: '6rem', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '999px', background: '#f5f3ff', color: '#7c5cfc', border: '1px solid #e0d4ff' }}>
                      {activePermsCount} ativas
                    </span>
                  </div>

                  <div className="hidden md:flex" style={{ width: '5rem', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: profile.isSystem ? '#8b8fa7' : '#1e1e2d' }}>
                      {profile.isSystem ? 'Sistema' : 'Personalizado'}
                    </span>
                  </div>

                  <div className="hidden md:flex" style={{ width: '5rem', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '999px', background: profile.is_active ? '#ecfdf5' : '#fef2f2', color: profile.is_active ? '#059669' : '#ef4444' }}>
                      {profile.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <div style={{ width: '8rem', display: 'flex', justifyContent: 'center', gap: '0.375rem', flexShrink: 0 }}>
                    <button onClick={() => handleDuplicate(profile)} title="Duplicar perfil" style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: '#f3f4f6', cursor: 'pointer', display: 'flex', transition: 'all 0.15s' }}>
                      <Copy style={{ width: '14px', height: '14px', color: '#4b5563' }} />
                    </button>
                    <button onClick={() => openEdit(profile)} title="Editar perfil" style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: '#f5f3ff', cursor: 'pointer', display: 'flex', transition: 'all 0.15s' }}>
                      <Pencil style={{ width: '14px', height: '14px', color: '#7c5cfc' }} />
                    </button>
                    {profile.isSystem && !profile.hasOverride ? (
                      <button title="Perfil no padrão de fábrica (sem edições)" disabled style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: '#f9fafb', cursor: 'not-allowed', display: 'flex', transition: 'all 0.15s', opacity: 0.4 }}>
                        <Trash2 style={{ width: '14px', height: '14px', color: '#d1d5db' }} />
                      </button>
                    ) : (
                      <button onClick={() => handleDelete(profile)} title={profile.isSystem ? "Restaurar padrão de fábrica" : "Excluir perfil"} style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: '#fef2f2', cursor: 'pointer', display: 'flex', transition: 'all 0.15s' }}>
                        <Trash2 style={{ width: '14px', height: '14px', color: '#ef4444' }} />
                      </button>
                    )}
                  </div>
                </div>
              )
            }) : (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', background: '#fff', borderRadius: '0.75rem', border: '1px solid #e8ecf4' }}>
                <Shield style={{ width: '2rem', height: '2rem', color: '#d1d5db', margin: '0 auto 0.75rem' }} />
                <p style={{ fontWeight: 600, color: '#1e1e2d' }}>Nenhum perfil encontrado</p>
                <p style={{ fontSize: '0.8125rem', color: '#8b8fa7' }}>Tente alterar a busca ou crie um novo perfil.</p>
              </div>
            )}
          </div>
        )}

        {showForm && (
          <RBACProfileFormModal
            profile={editingProfile}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditingProfile(null) }}
          />
        )}
        <ConfirmationDialog />
      </PermissionGate>
    </div>
  )
}
