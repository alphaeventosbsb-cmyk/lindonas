"use client"

import { useEffect, useState } from "react"
import { fetchCollection, createDocument, updateDocument, deleteDocument } from "@/lib/firebase/client-utils"
import type { UserRole, Permission, Role } from "@/lib/types/database"
import { Loader2, Shield, Plus, X, Pencil, Trash2, Search, UserCheck, Lock, Eye, Edit3, Trash, DollarSign } from "lucide-react"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
  border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d',
  fontSize: '0.875rem', fontWeight: 500, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem'
}

const roleLabels: Record<Role, string> = {
  master_admin: "Admin Master",
  business_owner: "Proprietário",
  manager: "Gerente",
  professional: "Profissional",
  client: "Cliente",
}

const roleColors: Record<Role, { bg: string; color: string; border: string }> = {
  master_admin: { bg: '#f0ecff', color: '#7c5cfc', border: '#e0d4ff' },
  business_owner: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  manager: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  professional: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  client: { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' },
}

const permissionGroups: { label: string; icon: React.ReactNode; permissions: { value: Permission; label: string; type: 'view' | 'edit' | 'delete' | 'other' }[] }[] = [
  {
    label: "Dashboard", icon: "📊",
    permissions: [
      { value: "view_dashboard", label: "Visualizar Dashboard", type: "view" },
    ]
  },
  {
    label: "Agendamentos", icon: "📅",
    permissions: [
      { value: "view_appointments", label: "Visualizar", type: "view" },
      { value: "edit_appointments", label: "Editar", type: "edit" },
      { value: "delete_appointments", label: "Excluir", type: "delete" },
    ]
  },
  {
    label: "Serviços", icon: "✂️",
    permissions: [
      { value: "view_services", label: "Visualizar", type: "view" },
      { value: "edit_services", label: "Editar", type: "edit" },
      { value: "delete_services", label: "Excluir", type: "delete" },
    ]
  },
  {
    label: "Profissionais", icon: "👥",
    permissions: [
      { value: "view_professionals", label: "Visualizar", type: "view" },
      { value: "edit_professionals", label: "Editar", type: "edit" },
      { value: "delete_professionals", label: "Excluir", type: "delete" },
    ]
  },
  {
    label: "Clientes", icon: "👤",
    permissions: [
      { value: "view_clients", label: "Visualizar", type: "view" },
      { value: "edit_clients", label: "Editar", type: "edit" },
      { value: "delete_clients", label: "Excluir", type: "delete" },
    ]
  },
  {
    label: "Financeiro", icon: "💰",
    permissions: [
      { value: "view_financial", label: "Visualizar", type: "view" },
      { value: "edit_financial", label: "Editar", type: "edit" },
      { value: "delete_financial", label: "Excluir", type: "delete" },
    ]
  },
  {
    label: "Caixa", icon: "🏦",
    permissions: [
      { value: "view_cashier", label: "Visualizar", type: "view" },
      { value: "edit_cashier", label: "Operar", type: "edit" },
    ]
  },
  {
    label: "Relatórios", icon: "📈",
    permissions: [
      { value: "view_reports", label: "Visualizar", type: "view" },
    ]
  },
  {
    label: "Notas Fiscais", icon: "📄",
    permissions: [
      { value: "view_invoices", label: "Visualizar", type: "view" },
      { value: "edit_invoices", label: "Emitir/Editar", type: "edit" },
    ]
  },
  {
    label: "Configurações", icon: "⚙️",
    permissions: [
      { value: "view_settings", label: "Visualizar", type: "view" },
      { value: "edit_settings", label: "Editar", type: "edit" },
    ]
  },
  {
    label: "Permissões", icon: "🔒",
    permissions: [
      { value: "manage_permissions", label: "Gerenciar Permissões", type: "other" },
    ]
  },
]

const allPermissions: Permission[] = permissionGroups.flatMap(g => g.permissions.map(p => p.value))

const roleDefaults: Record<Role, Permission[]> = {
  master_admin: allPermissions,
  business_owner: allPermissions,
  manager: allPermissions.filter(p => p !== "manage_permissions" && p !== "delete_financial"),
  professional: ["view_dashboard", "view_appointments", "view_services", "view_professionals"],
  client: ["view_dashboard"],
}

export default function PermissoesPage() {
  const [users, setUsers] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<UserRole | null>(null)
  const [search, setSearch] = useState("")
  const [form, setForm] = useState<{ email: string; name: string; role: Role; permissions: Permission[] }>({
    email: "", name: "", role: "professional", permissions: roleDefaults.professional,
  })
  const { ConfirmationDialog, confirm } = useConfirm()

  const load = async () => {
    setLoading(true)
    const data = await fetchCollection<UserRole>("user_roles")
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ email: "", name: "", role: "professional", permissions: roleDefaults.professional })
    setShowForm(true)
  }

  const openEdit = (u: UserRole) => {
    setEditing(u)
    setForm({ email: u.user_email, name: u.user_name, role: u.role, permissions: u.permissions || [] })
    setShowForm(true)
  }

  const handleRoleChange = (role: Role) => {
    setForm({ ...form, role, permissions: roleDefaults[role] })
  }

  const togglePermission = (p: Permission) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(p)
        ? f.permissions.filter(x => x !== p)
        : [...f.permissions, p]
    }))
  }

  const handleSave = async () => {
    if (!form.email || !form.name) return toast.error("Email e nome são obrigatórios")
    const data = {
      user_email: form.email,
      user_name: form.name,
      role: form.role,
      permissions: form.permissions,
      is_active: true,
    }
    if (editing) {
      await updateDocument("user_roles", editing.id, data)
      toast.success("Permissões atualizadas!")
    } else {
      await createDocument("user_roles", data)
      toast.success("Usuário adicionado!")
    }
    setShowForm(false)
    load()
  }

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: "Remover usuário",
      message: `Tem certeza que deseja remover o usuário "${name}"?\n\nEssa ação não poderá ser desfeita.`,
      confirmText: "Remover usuário",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    await deleteDocument("user_roles", id)
    toast.success("Usuário removido")
    load()
  }

  const filtered = users.filter(u =>
    u.user_name.toLowerCase().includes(search.toLowerCase()) ||
    u.user_email.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #2a2150, #7c5cfc)', borderRadius: '1rem', padding: '2rem', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-2rem', right: '-2rem', width: '8rem', height: '8rem', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Shield style={{ width: '1.5rem', height: '1.5rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: "var(--font-heading)" }}>Controle de Acesso</h2>
          </div>
          <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>Gerencie permissões e papéis de cada usuário do sistema</p>
        </div>
      </div>

      {/* Filters + Add */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#9ca3af' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.5rem' }}
            placeholder="Buscar usuário..." />
        </div>
        <button onClick={openNew}
          style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 4px 14px rgba(124,92,252,0.3)', whiteSpace: 'nowrap' }}>
          <Plus style={{ width: '1rem', height: '1rem' }} /> Adicionar Usuário
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={() => setShowForm(false)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: '32rem', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>{editing ? "Editar" : "Adicionar"} Usuário</h3>
              <button onClick={() => setShowForm(false)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X style={{ width: '1.25rem', height: '1.25rem', color: '#9ca3af' }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Nome *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="Nome do usuário" />
                </div>
                <div>
                  <label style={labelStyle}>Email *</label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} placeholder="email@email.com" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Papel</label>
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {(Object.keys(roleLabels) as Role[]).map(role => (
                    <button key={role} onClick={() => handleRoleChange(role)} type="button"
                      style={{
                        padding: '0.5rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700,
                        border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                        background: form.role === role ? roleColors[role].bg : '#f3f4f6',
                        color: form.role === role ? roleColors[role].color : '#9ca3af',
                        borderWidth: '1px', borderStyle: 'solid',
                        borderColor: form.role === role ? roleColors[role].border : '#e5e7eb',
                      }}>
                      {roleLabels[role]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>Permissões Granulares</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {permissionGroups.map(group => (
                    <div key={group.label} style={{ borderRadius: '0.5rem', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: '#fafbfc', fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>
                        <span>{group.icon}</span>
                        <span>{group.label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', padding: '0.375rem 0.75rem', flexWrap: 'wrap' }}>
                        {group.permissions.map(perm => (
                          <button key={perm.value} onClick={() => togglePermission(perm.value)} type="button"
                            style={{
                              padding: '0.25rem 0.625rem', borderRadius: '0.375rem', fontSize: '0.6875rem', fontWeight: 600,
                              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                              background: form.permissions.includes(perm.value) ?
                                (perm.type === 'view' ? '#ecfdf5' : perm.type === 'edit' ? '#eff6ff' : perm.type === 'delete' ? '#fef2f2' : '#f0ecff') :
                                '#f3f4f6',
                              color: form.permissions.includes(perm.value) ?
                                (perm.type === 'view' ? '#059669' : perm.type === 'edit' ? '#2563eb' : perm.type === 'delete' ? '#ef4444' : '#7c5cfc') :
                                '#9ca3af',
                            }}>
                            {perm.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={handleSave}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', marginTop: '0.5rem', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 4px 14px rgba(124,92,252,0.3)' }}>
                {editing ? "Salvar Alterações" : "Adicionar Usuário"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Users List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {filtered.map((user) => {
          const rc = roleColors[user.role] || roleColors.client
          return (
            <div key={user.id} style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ height: '3px', background: `linear-gradient(90deg, ${rc.color}, ${rc.border})` }} />
              <div style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: rc.bg, color: rc.color, fontSize: '1rem', fontWeight: 700, border: `1px solid ${rc.border}` }}>
                      {user.user_name.charAt(0)}
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, color: '#1e1e2d', fontSize: '0.9375rem' }}>{user.user_name}</p>
                      <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{user.user_email}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => openEdit(user)} style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                      <Pencil style={{ width: '0.875rem', height: '0.875rem', color: '#9ca3af' }} />
                    </button>
                    <button onClick={() => handleDelete(user.id, user.user_name)} style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                      <Trash2 style={{ width: '0.875rem', height: '0.875rem', color: '#f87171' }} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 700, padding: '0.25rem 0.625rem', borderRadius: '999px',
                    background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`,
                  }}>
                    {roleLabels[user.role]}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                    {(user.permissions || []).length} permissões
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {(user.permissions || []).slice(0, 6).map(p => (
                    <span key={p} style={{ fontSize: '0.5625rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: '#f3f4f6', color: '#6b7280', fontWeight: 600 }}>
                      {p.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {(user.permissions || []).length > 6 && (
                    <span style={{ fontSize: '0.5625rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: '#f0ecff', color: '#7c5cfc', fontWeight: 600 }}>
                      +{(user.permissions || []).length - 6} mais
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', padding: '4rem 2rem', textAlign: 'center' }}>
          <Shield style={{ width: '2rem', height: '2rem', color: '#d1d5db', margin: '0 auto 0.75rem' }} />
          <p style={{ color: '#1e1e2d', fontWeight: 600 }}>Nenhum usuário configurado</p>
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Adicione usuários para controlar o acesso ao sistema</p>
        </div>
      )}
      <ConfirmationDialog />
    </div>
  )
}
