"use client"

import { useEffect, useState } from "react"
import { fetchCollection, createDocument, updateDocument, deleteDocument } from "@/lib/firebase/client-utils"
import type { SaaSPlan } from "@/lib/types/database"
import { formatCurrency } from "@/lib/utils"
import { Loader2, Plus, Pencil, Trash2, X, CreditCard, Check, Star } from "lucide-react"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
  border: '2px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
  fontSize: '0.875rem', fontWeight: 500, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '0.375rem'
}

const planGradients = [
  'linear-gradient(135deg, #6b7280, #9ca3af)',
  'linear-gradient(135deg, #5b8def, #93b5f5)',
  'linear-gradient(135deg, #7c5cfc, #a78bfa)',
  'linear-gradient(135deg, #f59e0b, #f97316)',
]

export default function PlanosPage() {
  const [plans, setPlans] = useState<SaaSPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SaaSPlan | null>(null)
  const [form, setForm] = useState({
    name: "", price: "", billing_cycle: "monthly" as "monthly" | "yearly",
    max_professionals: "3", max_appointments_month: "300",
    features: "", display_order: "0", is_active: true,
  })
  const { ConfirmationDialog, confirm } = useConfirm()

  const load = async () => {
    setLoading(true)
    const data = await fetchCollection<SaaSPlan>("saas_plans")
    data.sort((a, b) => a.display_order - b.display_order)
    setPlans(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ name: "", price: "", billing_cycle: "monthly", max_professionals: "3", max_appointments_month: "300", features: "", display_order: "0", is_active: true })
    setShowForm(true)
  }

  const openEdit = (p: SaaSPlan) => {
    setEditing(p)
    setForm({
      name: p.name, price: String(p.price), billing_cycle: p.billing_cycle,
      max_professionals: String(p.max_professionals), max_appointments_month: String(p.max_appointments_month),
      features: p.features.join("\n"), display_order: String(p.display_order), is_active: p.is_active,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name) return toast.error("Nome é obrigatório")
    const data = {
      name: form.name, price: parseFloat(form.price) || 0,
      billing_cycle: form.billing_cycle,
      max_professionals: parseInt(form.max_professionals) || 3,
      max_appointments_month: parseInt(form.max_appointments_month) || 300,
      features: form.features.split("\n").map(f => f.trim()).filter(Boolean),
      display_order: parseInt(form.display_order) || 0,
      is_active: form.is_active,
    }
    if (editing) {
      await updateDocument("saas_plans", editing.id, data)
      toast.success("Plano atualizado!")
    } else {
      await createDocument("saas_plans", data)
      toast.success("Plano criado!")
    }
    setShowForm(false)
    load()
  }

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: "Excluir plano",
      message: `Tem certeza que deseja excluir o plano "${name}"?\n\nEssa ação não poderá ser desfeita.`,
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    await deleteDocument("saas_plans", id)
    toast.success("Plano excluído")
    load()
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', fontFamily: "var(--font-heading)" }}>Planos de Assinatura</h2>
          <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.4)' }}>Configure os planos oferecidos na plataforma</p>
        </div>
        <button onClick={openNew}
          style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #f59e0b, #f97316)', boxShadow: '0 4px 14px rgba(245,158,11,0.3)' }}>
          <Plus style={{ width: '1rem', height: '1rem' }} /> Novo Plano
        </button>
      </div>

      {/* Plans Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {plans.map((plan, i) => (
          <div key={plan.id} style={{ background: '#1a1035', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ height: '4px', background: planGradients[i % planGradients.length] }} />
            {!plan.is_active && (
              <div style={{ position: 'absolute', top: '1rem', right: '1rem', fontSize: '0.5625rem', fontWeight: 700, padding: '0.125rem 0.5rem', borderRadius: '999px', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Inativo</div>
            )}
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: planGradients[i % planGradients.length] }}>
                  {i === plans.length - 1 ? <Star style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} /> : <CreditCard style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} />}
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, color: '#fff', fontSize: '1.125rem', fontFamily: "var(--font-heading)" }}>{plan.name}</h3>
                  <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)' }}>{plan.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}</p>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#fff' }}>{formatCurrency(plan.price)}</span>
                <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.4)' }}>/mês</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.5625rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>Profissionais</p>
                  <p style={{ fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>{plan.max_professionals >= 999 ? '∞' : plan.max_professionals}</p>
                </div>
                <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.5625rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>Agendamentos</p>
                  <p style={{ fontSize: '1rem', fontWeight: 800, color: '#a78bfa' }}>{plan.max_appointments_month >= 9999 ? '∞' : plan.max_appointments_month}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' }}>
                {plan.features.map((f, fi) => (
                  <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Check style={{ width: '0.75rem', height: '0.75rem', color: '#22c997', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>{f}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => openEdit(plan)}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                  <Pencil style={{ width: '0.75rem', height: '0.75rem' }} /> Editar
                </button>
                <button onClick={() => handleDelete(plan.id, plan.name)}
                  style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer' }}>
                  <Trash2 style={{ width: '0.75rem', height: '0.75rem' }} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={() => setShowForm(false)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#1a1035', borderRadius: '1rem', width: '100%', maxWidth: '28rem', padding: '2rem', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', fontFamily: "var(--font-heading)" }}>{editing ? "Editar" : "Novo"} Plano</h3>
              <button onClick={() => setShowForm(false)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Nome *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="Ex: Profissional" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Preço (R$)</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={inputStyle} placeholder="99.90" />
                </div>
                <div>
                  <label style={labelStyle}>Ciclo</label>
                  <select value={form.billing_cycle} onChange={e => setForm({ ...form, billing_cycle: e.target.value as any })} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Máx. Profissionais</label>
                  <input type="number" value={form.max_professionals} onChange={e => setForm({ ...form, max_professionals: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Máx. Agendamentos/mês</label>
                  <input type="number" value={form.max_appointments_month} onChange={e => setForm({ ...form, max_appointments_month: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Features (uma por linha)</label>
                <textarea value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} rows={5}
                  style={{ ...inputStyle, resize: 'none' as const }} placeholder="Agendamento online&#10;Dashboard&#10;Relatórios" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Ativo</span>
                </label>
              </div>
              <button onClick={handleSave}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
                {editing ? "Salvar" : "Criar Plano"}
              </button>
            </div>
          </div>
        </>
      )}
      <ConfirmationDialog />
    </div>
  )
}
