"use client"
import { useState } from "react"
import { X, Plus, Edit3, Trash2, Check, Tag, Eye, EyeOff } from "lucide-react"
import { createDocument, updateDocument, deleteDocument } from "@/lib/firebase/client-utils"
import type { Category, Service } from "@/lib/types/database"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"
import { useTenant } from "@/lib/auth/tenant-context"

interface Props {
  categories: Category[]
  services: Service[]
  onClose: () => void
  onRefresh: () => void
}

export function CategoryManagerModal({ categories, services, onClose, onRefresh }: Props) {
  const { company } = useTenant()
  const [name, setName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [saving, setSaving] = useState(false)
  const { ConfirmationDialog, confirm } = useConfirm()

  const generateSlug = (text: string) => {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return toast.error("Digite o nome da categoria")
    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) return toast.error("Categoria já existe")
    
    setSaving(true)
    try {
      await createDocument("categories", {
        company_id: company?.id || "default",
        name: trimmed,
        slug: generateSlug(trimmed),
        description: "",
        icon: "",
        display_order: categories.length,
        is_active: true
      })
      toast.success("Categoria criada!")
      setName("")
      onRefresh()
    } catch { 
      toast.error("Erro ao criar categoria") 
    }
    setSaving(false)
  }

  const handleUpdate = async (id: string) => {
    const trimmed = editName.trim()
    if (!trimmed) return toast.error("Nome não pode ser vazio")
    if (categories.some(c => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) return toast.error("Nome já existe")
    
    try {
      await updateDocument("categories", id, { 
        name: trimmed,
        slug: generateSlug(trimmed)
      })
      toast.success("Categoria atualizada!")
      setEditingId(null)
      onRefresh()
    } catch { 
      toast.error("Erro ao atualizar") 
    }
  }

  const handleToggleActive = async (category: Category) => {
    try {
      await updateDocument("categories", category.id, { is_active: !category.is_active })
      toast.success(category.is_active ? "Categoria inativada" : "Categoria ativada")
      onRefresh()
    } catch {
      toast.error("Erro ao alterar status")
    }
  }

  const handleDelete = async (category: Category) => {
    const isUsed = services.some(s => s.category_id === category.id)
    if (isUsed) {
      return toast.error("Não é possível excluir: existem serviços vinculados a esta categoria.")
    }

    const confirmed = await confirm({
      title: "Excluir categoria",
      message: `Tem certeza que deseja excluir a categoria "${category.name}"?\n\nEssa ação não poderá ser desfeita.`,
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    
    try {
      await deleteDocument("categories", category.id)
      toast.success("Categoria excluída!")
      onRefresh()
    } catch { 
      toast.error("Erro ao excluir") 
    }
  }

  const startEdit = (category: Category) => {
    setEditingId(category.id)
    setEditName(category.name)
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10000, background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '440px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f3f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'linear-gradient(135deg,#7c5cfc,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tag style={{ width: '1rem', height: '1rem', color: '#fff' }} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', fontWeight: 700, color: '#1e1e2d' }}>Gerenciar Categorias</h3>
              <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>{categories.length} categoria{categories.length !== 1 ? 's' : ''} cadastrada{categories.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: '#f1f3f9', cursor: 'pointer', display: 'flex' }}>
            <X style={{ width: '16px', height: '16px', color: '#8b8fa7' }} />
          </button>
        </div>

        {/* Create new */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f3f9', flexShrink: 0 }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Nova Categoria</p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Cabelo, Barba, Unhas..."
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '2px solid #e8ecf4', fontSize: '0.8125rem', color: '#1e1e2d', outline: 'none', background: '#fafbfc' }} />
            <button onClick={handleCreate} disabled={saving} style={{
              padding: '0.5rem 0.875rem', borderRadius: '0.5rem', border: 'none', background: 'linear-gradient(135deg,#7c5cfc,#a78bfa)',
              color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap',
              opacity: saving ? 0.7 : 1,
            }}>
              <Plus style={{ width: '14px', height: '14px' }} /> Criar
            </button>
          </div>
        </div>

        {/* Categories list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.5rem' }}>
          {categories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <Tag style={{ width: '2rem', height: '2rem', color: '#d1d5db', margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>Nenhuma categoria criada</p>
              <p style={{ fontSize: '0.6875rem', color: '#d1d5db' }}>Crie categorias para organizar seus serviços</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {categories.map(category => (
                <div key={category.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.625rem', borderRadius: '0.5rem', background: '#fafbfc', border: '1px solid #eef0f6', opacity: category.is_active ? 1 : 0.6 }}>
                  {editingId === category.id ? (
                    <>
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleUpdate(category.id)}
                        style={{ flex: 1, padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e8ecf4', fontSize: '0.75rem', outline: 'none', minWidth: 0 }} />
                      <button onClick={() => handleUpdate(category.id)} style={{ padding: '0.25rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#059669' }}>
                        <Check style={{ width: '14px', height: '14px' }} />
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ padding: '0.25rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                        <X style={{ width: '14px', height: '14px' }} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{category.name}</span>
                      <button onClick={() => handleToggleActive(category)} title={category.is_active ? "Inativar" : "Ativar"} style={{ padding: '0.25rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#8b8fa7' }}>
                        {category.is_active ? <Eye style={{ width: '13px', height: '13px' }} /> : <EyeOff style={{ width: '13px', height: '13px' }} />}
                      </button>
                      <button onClick={() => startEdit(category)} style={{ padding: '0.25rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#8b8fa7' }}>
                        <Edit3 style={{ width: '13px', height: '13px' }} />
                      </button>
                      <button onClick={() => handleDelete(category)} style={{ padding: '0.25rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}>
                        <Trash2 style={{ width: '13px', height: '13px' }} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ConfirmationDialog />
    </>
  )
}
