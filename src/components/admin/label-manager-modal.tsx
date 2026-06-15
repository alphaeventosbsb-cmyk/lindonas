"use client"
import { useState } from "react"
import { X, Plus, Edit3, Trash2, Check, Tag } from "lucide-react"
import { createDocument, updateDocument, deleteDocument } from "@/lib/firebase/client-utils"
import type { AppointmentLabel } from "@/lib/types/database"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"

const presetColors = [
  "#7c5cfc", "#3b82f6", "#0891b2", "#059669", "#10b981",
  "#f59e0b", "#ea580c", "#ef4444", "#ec4899", "#8b5cf6",
  "#6366f1", "#14b8a6", "#84cc16", "#f97316", "#64748b",
]

interface Props {
  labels: AppointmentLabel[]
  onClose: () => void
  onRefresh: () => void
}

export function LabelManagerModal({ labels, onClose, onRefresh }: Props) {
  const [name, setName] = useState("")
  const [color, setColor] = useState(presetColors[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("")
  const [saving, setSaving] = useState(false)
  const { ConfirmationDialog, confirm } = useConfirm()

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return toast.error("Digite o nome da etiqueta")
    if (labels.some(l => l.name.toLowerCase() === trimmed.toLowerCase())) return toast.error("Etiqueta já existe")
    setSaving(true)
    try {
      await createDocument("labels", { name: trimmed, color })
      toast.success("Etiqueta criada!")
      setName("")
      setColor(presetColors[0])
      onRefresh()
    } catch { toast.error("Erro ao criar etiqueta") }
    setSaving(false)
  }

  const handleUpdate = async (id: string) => {
    const trimmed = editName.trim()
    if (!trimmed) return toast.error("Nome não pode ser vazio")
    if (labels.some(l => l.id !== id && l.name.toLowerCase() === trimmed.toLowerCase())) return toast.error("Nome já existe")
    try {
      await updateDocument("labels", id, { name: trimmed, color: editColor })
      toast.success("Etiqueta atualizada!")
      setEditingId(null)
      onRefresh()
    } catch { toast.error("Erro ao atualizar") }
  }

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: "Excluir etiqueta",
      message: `Tem certeza que deseja excluir a etiqueta "${name}"?\n\nAs referências nos agendamentos serão removidas. Essa ação não poderá ser desfeita.`,
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    try {
      await deleteDocument("labels", id)
      toast.success("Etiqueta excluída!")
      onRefresh()
    } catch { toast.error("Erro ao excluir") }
  }

  const startEdit = (label: AppointmentLabel) => {
    setEditingId(label.id)
    setEditName(label.name)
    setEditColor(label.color)
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
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', fontWeight: 700, color: '#1e1e2d' }}>Gerenciar Etiquetas</h3>
              <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>{labels.length} etiqueta{labels.length !== 1 ? 's' : ''} criada{labels.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: '#f1f3f9', cursor: 'pointer', display: 'flex' }}>
            <X style={{ width: '16px', height: '16px', color: '#8b8fa7' }} />
          </button>
        </div>

        {/* Create new */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f3f9', flexShrink: 0 }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Nova Etiqueta</p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: VIP, Retorno..."
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
          {/* Color picker */}
          <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {presetColors.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: '1.375rem', height: '1.375rem', borderRadius: '0.375rem', background: c, border: color === c ? '2px solid #1e1e2d' : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s', boxShadow: color === c ? '0 0 0 2px #fff, 0 0 0 4px ' + c : 'none',
              }} />
            ))}
          </div>
        </div>

        {/* Labels list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.5rem' }}>
          {labels.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <Tag style={{ width: '2rem', height: '2rem', color: '#d1d5db', margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>Nenhuma etiqueta criada</p>
              <p style={{ fontSize: '0.6875rem', color: '#d1d5db' }}>Crie etiquetas para organizar seus agendamentos</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {labels.map(label => (
                <div key={label.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.625rem', borderRadius: '0.5rem', background: '#fafbfc', border: '1px solid #eef0f6' }}>
                  {editingId === label.id ? (
                    <>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {presetColors.slice(0, 8).map(c => (
                          <button key={c} onClick={() => setEditColor(c)} style={{
                            width: '1rem', height: '1rem', borderRadius: '0.25rem', background: c,
                            border: editColor === c ? '2px solid #1e1e2d' : '1px solid #e5e7eb', cursor: 'pointer',
                          }} />
                        ))}
                      </div>
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleUpdate(label.id)}
                        style={{ flex: 1, padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e8ecf4', fontSize: '0.75rem', outline: 'none', minWidth: 0 }} />
                      <button onClick={() => handleUpdate(label.id)} style={{ padding: '0.25rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#059669' }}>
                        <Check style={{ width: '14px', height: '14px' }} />
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ padding: '0.25rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                        <X style={{ width: '14px', height: '14px' }} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '0.25rem', background: label.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{label.name}</span>
                      <button onClick={() => startEdit(label)} style={{ padding: '0.25rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#8b8fa7' }}>
                        <Edit3 style={{ width: '13px', height: '13px' }} />
                      </button>
                      <button onClick={() => handleDelete(label.id, label.name)} style={{ padding: '0.25rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}>
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
