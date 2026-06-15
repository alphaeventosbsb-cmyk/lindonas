"use client"

import { useState, useMemo } from "react"
import { X, Search, ChevronDown, ChevronRight, Shield, Check, Minus } from "lucide-react"
import { RBAC_MODULES, ALL_PERMISSION_KEYS, RBACProfile } from "@/lib/rbac/rbac-types"
import type { Employee } from "@/lib/types/database"

interface Props {
  employeeName: string
  currentProfileId: string
  currentPermissions: string[]
  employees: Employee[]
  profiles: RBACProfile[]
  onSave: (profileId: string, permissions: string[], isCustom: boolean) => void
  onClose: () => void
}

export function RBACModal({ employeeName, currentProfileId, currentPermissions, employees, profiles, onSave, onClose }: Props) {
  const [profileId, setProfileId] = useState(currentProfileId || "custom")
  const [permissions, setPermissions] = useState<Set<string>>(new Set(currentPermissions))
  const [search, setSearch] = useState("")
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(RBAC_MODULES.map(m => m.id)))
  const [showCopy, setShowCopy] = useState(false)
  const [copyTab, setCopyTab] = useState<"profile" | "professional">("profile")

  const getProfilePerms = (id: string) => profiles.find(p => p.id === id)?.permissions || []

  const baseProfilePerms = useMemo(() => new Set(getProfilePerms(profileId)), [profileId, profiles])
  const isCustom = profileId === "custom" || (() => {
    const base = getProfilePerms(profileId)
    if (base.length !== permissions.size) return true
    return base.some(k => !permissions.has(k)) || Array.from(permissions).some(k => !base.includes(k))
  })()

  const handleProfileChange = (id: string) => {
    setProfileId(id)
    setPermissions(new Set(getProfilePerms(id)))
  }

  const togglePermission = (key: string) => {
    const next = new Set(permissions)
    if (next.has(key)) next.delete(key); else next.add(key)
    setPermissions(next)
  }

  const toggleModule = (moduleId: string) => {
    const mod = RBAC_MODULES.find(m => m.id === moduleId)
    if (!mod) return
    const keys = mod.permissions.map(p => p.key)
    const allChecked = keys.every(k => permissions.has(k))
    const next = new Set(permissions)
    if (allChecked) keys.forEach(k => next.delete(k))
    else keys.forEach(k => next.add(k))
    setPermissions(next)
  }

  const toggleExpand = (moduleId: string) => {
    const next = new Set(expandedModules)
    if (next.has(moduleId)) next.delete(moduleId); else next.add(moduleId)
    setExpandedModules(next)
  }

  const filteredModules = useMemo(() => {
    if (!search.trim()) return RBAC_MODULES
    const q = search.toLowerCase()
    return RBAC_MODULES.map(m => ({
      ...m,
      permissions: m.permissions.filter(p =>
        p.label.toLowerCase().includes(q) || p.key.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) || m.label.toLowerCase().includes(q)
      ),
    })).filter(m => m.permissions.length > 0)
  }, [search])

  const handleCopyFrom = (perms: string[], source: string) => {
    setPermissions(new Set(perms))
    setShowCopy(false)
  }

  const handleSave = () => {
    const effectiveProfile = isCustom ? "custom" : profileId
    onSave(effectiveProfile, Array.from(permissions), isCustom)
  }

  const activeCount = Array.from(permissions).filter(p => ALL_PERMISSION_KEYS.includes(p)).length
  const totalCount = ALL_PERMISSION_KEYS.length

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 10000 }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10001, background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: '48rem', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e8ecf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield style={{ width: '1rem', height: '1rem', color: '#fff' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e1e2d' }}>Permissões Individuais</h3>
              <p style={{ fontSize: '0.75rem', color: '#8b8fa7' }}>{employeeName}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: '#f1f3f9', cursor: 'pointer' }}>
            <X style={{ width: '1rem', height: '1rem', color: '#6b7280' }} />
          </button>
        </div>

        {/* Profile selector + search */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f3f9', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem', display: 'block' }}>Perfil Base</label>
            <select value={isCustom && profileId !== "custom" ? profileId : profileId} onChange={e => handleProfileChange(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '2px solid #e2e8f0', fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d', outline: 'none', background: '#fff' }}>
              {profiles.filter(p => {
                // Show active profiles, and always show the currently selected one
                const isActive = (p as any).is_active !== false
                return isActive || p.id === profileId
              }).map(p => {
                const isActive = (p as any).is_active !== false
                return <option key={p.id} value={p.id}>{p.name}{!isActive ? ' (Inativo)' : ''}</option>
              })}
              {isCustom && <option value="custom">Personalizado</option>}
            </select>
          </div>
          <div style={{ flex: '1 1 200px', position: 'relative' }}>
            <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem', display: 'block' }}>Buscar permissão</label>
            <Search style={{ position: 'absolute', left: '0.625rem', bottom: '0.625rem', width: '14px', height: '14px', color: '#9ca3af' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: '0.5rem', border: '2px solid #e2e8f0', fontSize: '0.8125rem', color: '#1e1e2d', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-end' }}>
            <button onClick={() => setShowCopy(!showCopy)} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e0d4ff', background: '#faf8ff', color: '#7c5cfc', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
              Copiar Permissões
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div style={{ padding: '0.5rem 1.5rem', background: '#fafbfc', borderBottom: '1px solid #f1f3f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontWeight: 600, color: '#374151' }}>{activeCount} de {totalCount} permissões ativas</span>
            {isCustom && profileId !== "custom" && (
              <span style={{ padding: '0.125rem 0.5rem', borderRadius: '999px', background: '#fffbeb', color: '#d97706', fontWeight: 600, fontSize: '0.625rem' }}>
                Personalizado (baseado em {profiles.find(p => p.id === profileId)?.name})
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <button onClick={() => setPermissions(new Set(ALL_PERMISSION_KEYS))} style={{ padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.6875rem', fontWeight: 600, color: '#4b5563', cursor: 'pointer' }}>Marcar tudo</button>
            <button onClick={() => setPermissions(new Set())} style={{ padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #fecaca', background: '#fef2f2', fontSize: '0.6875rem', fontWeight: 600, color: '#ef4444', cursor: 'pointer' }}>Desmarcar tudo</button>
          </div>
        </div>

        {/* Copy panel */}
        {showCopy && (
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#faf8ff' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button onClick={() => setCopyTab("profile")} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: 'none', background: copyTab === "profile" ? '#7c5cfc' : '#e2e8f0', color: copyTab === "profile" ? '#fff' : '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>De Perfil</button>
              <button onClick={() => setCopyTab("professional")} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: 'none', background: copyTab === "professional" ? '#7c5cfc' : '#e2e8f0', color: copyTab === "professional" ? '#fff' : '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>De Profissional</button>
            </div>
            <div style={{ maxHeight: '10rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {copyTab === "profile" ? (
                profiles.filter(p => p.id !== "no_access").map(p => (
                  <button key={p.id} onClick={() => handleCopyFrom(p.permissions, `profile:${p.id}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <div>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{p.name}</span>
                      <span style={{ fontSize: '0.6875rem', color: '#8b8fa7', marginLeft: '0.5rem' }}>{p.permissions.length} permissões</span>
                    </div>
                  </button>
                ))
              ) : (
                employees.filter(e => e.rbac_permissions?.length).map(e => (
                  <button key={e.id} onClick={() => handleCopyFrom(e.rbac_permissions || [], `professional:${e.id}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <div>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{e.name}</span>
                      <span style={{ fontSize: '0.6875rem', color: '#8b8fa7', marginLeft: '0.5rem' }}>{e.rbac_permissions?.length || 0} permissões</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Modules/Permissions list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.5rem' }}>
          {filteredModules.map(mod => {
            const isExpanded = expandedModules.has(mod.id)
            const modKeys = mod.permissions.map(p => p.key)
            const checkedCount = modKeys.filter(k => permissions.has(k)).length
            const allChecked = checkedCount === modKeys.length
            const someChecked = checkedCount > 0 && !allChecked

            return (
              <div key={mod.id} style={{ borderRadius: '0.625rem', border: '1px solid #e8ecf4', marginBottom: '0.5rem', overflow: 'hidden' }}>
                {/* Module header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.75rem', background: '#fafbfc', cursor: 'pointer', userSelect: 'none' }}>
                  <button onClick={() => toggleModule(mod.id)} style={{ width: '1.25rem', height: '1.25rem', borderRadius: '0.25rem', border: `2px solid ${allChecked ? '#7c5cfc' : someChecked ? '#7c5cfc' : '#d1d5db'}`, background: allChecked ? '#7c5cfc' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
                    {allChecked && <Check style={{ width: '12px', height: '12px', color: '#fff' }} />}
                    {someChecked && <Minus style={{ width: '12px', height: '12px', color: '#7c5cfc' }} />}
                  </button>
                  <div onClick={() => toggleExpand(mod.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>{mod.icon}</span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d' }}>{mod.label}</span>
                    <span style={{ fontSize: '0.625rem', color: '#8b8fa7', fontWeight: 600 }}>{checkedCount}/{modKeys.length}</span>
                  </div>
                  <button onClick={() => toggleExpand(mod.id)} style={{ padding: '0.25rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                    {isExpanded ? <ChevronDown style={{ width: '14px', height: '14px', color: '#9ca3af' }} /> : <ChevronRight style={{ width: '14px', height: '14px', color: '#9ca3af' }} />}
                  </button>
                </div>

                {/* Permissions */}
                {isExpanded && (
                  <div style={{ padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {mod.permissions.map(perm => {
                      const checked = permissions.has(perm.key)
                      return (
                        <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.375rem 0.5rem', borderRadius: '0.375rem', cursor: 'pointer', transition: 'background 0.1s', background: checked ? '#f5f3ff' : 'transparent' }}>
                          <input type="checkbox" checked={checked} onChange={() => togglePermission(perm.key)} style={{ accentColor: '#7c5cfc', width: '1rem', height: '1rem', cursor: 'pointer' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: checked ? '#1e1e2d' : '#6b7280' }}>{perm.label}</span>
                            <span style={{ fontSize: '0.625rem', color: '#9ca3af', marginLeft: '0.5rem' }}>{perm.description}</span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e8ecf4', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', background: '#fff', color: '#4b5563', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSave} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', border: 'none', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.25)' }}>
            Salvar Permissões
          </button>
        </div>
      </div>
    </>
  )
}
