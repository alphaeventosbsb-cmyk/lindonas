"use client"

import { useEffect, useState, useMemo } from "react"
import { fetchCollection, createDocument, deleteDocument } from "@/lib/firebase/client-utils"
import type { FinancialEntry } from "@/lib/types/database"
import { formatCurrency, toLocalDateStr } from "@/lib/utils"
import { Loader2, Plus, Trash2, X, Search, TrendingUp, TrendingDown, DollarSign, ArrowUpCircle, ArrowDownCircle, Landmark } from "lucide-react"
import { toast } from "sonner"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts"
import { useConfirm } from "@/components/ui/confirm-modal"
import { usePermission } from "@/lib/rbac/usePermission"
import { PermissionGate } from "@/components/ui/permission-gate"
import { ExportButtons } from "@/components/ui/export-buttons"
import { formatCurrencyForExport, formatDateForExport, type ColumnDef } from "@/lib/export-utils"
import { CashMovementDetailsModal } from "@/components/admin/caixa/cash-movement-details-modal"

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
  border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d',
  fontSize: '0.875rem', fontWeight: 500, outline: 'none',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem'
}
const paymentLabels: Record<string, string> = {
  cash: "Dinheiro", pix: "PIX", credit_card: "Crédito", debit_card: "Débito", transfer: "Transf.", courtesy: "Cortesia", client_credit: "Crédito Cli.", other: "Outro"
}
const expenseCategories = ["Aluguel","Água/Luz","Internet","Material","Produtos","Equipamentos","Salários","Marketing","Impostos","Manutenção","Outros"]
const incomeCategories = ["Serviço","Produto","Pacote","Assinatura","Outros"]
const PIE_COLORS = ["#7c5cfc","#22c997","#5b8def","#ffb547","#f25c5c","#a78bfa"]

const ptMonths = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]

export default function FinanceiroPage() {
  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<"income" | "expense">("income")
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [form, setForm] = useState({ description: "", amount: "", category: "", payment_method: "pix", date: toLocalDateStr() })
  const [saving, setSaving] = useState(false)
  const { ConfirmationDialog, confirm } = useConfirm()
  const { can } = usePermission()
  const canCreate = can("finance.create")
  const canCreateExpense = can("finance.expenses")
  const canDelete = can("finance.delete")
  const [selectedEntry, setSelectedEntry] = useState<FinancialEntry | null>(null)

  const load = async () => {
    setLoading(true)
    const data = await fetchCollection<FinancialEntry>("financial_entries")
    data.sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    setEntries(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openForm = (type: "income" | "expense") => {
    setFormType(type)
    setForm({ description: "", amount: "", category: "", payment_method: "pix", date: toLocalDateStr() })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.description || !form.amount || !form.category) return toast.error("Preencha todos os campos obrigatórios")
    setSaving(true)
    try {
      await createDocument("financial_entries", {
        type: formType, description: form.description,
        amount: parseFloat(form.amount), category: form.category,
        payment_method: form.payment_method, date: form.date,
        reference_id: null, reference_type: null,
      })
      toast.success(formType === "income" ? "Entrada registrada!" : "Saída registrada!")
      setShowForm(false)
      load()
    } catch (err) {
      console.error("Erro ao salvar lançamento:", err)
      toast.error("Erro ao salvar lançamento")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, description: string) => {
    const confirmed = await confirm({
      title: "Excluir lançamento",
      message: `Tem certeza que deseja excluir o lançamento "${description}"?\n\nEssa ação não poderá ser desfeita.`,
      confirmText: "Excluir lançamento",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    try {
      await deleteDocument("financial_entries", id)
      toast.success("Lançamento excluído")
      load()
    } catch (err) {
      console.error("Erro ao excluir lançamento:", err)
      toast.error("Erro ao excluir lançamento")
    }
  }

  const monthEntries = entries.filter(e => (e.date || "").startsWith(monthFilter))
  const filtered = monthEntries.filter(e => {
    const matchSearch = (e.description || "").toLowerCase().includes(search.toLowerCase()) || (e.category || "").toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === "all" || e.type === typeFilter
    return matchSearch && matchType
  })

  const exportColumns: ColumnDef<FinancialEntry>[] = useMemo(() => [
    { header: "Data", key: "date", format: (v) => formatDateForExport(v) },
    { header: "Tipo", key: "type", format: (v) => v === "income" ? "Entrada" : "Saída" },
    { header: "Descrição", key: "description" },
    { header: "Categoria", key: "category" },
    { header: "Valor", key: "amount", format: (v) => formatCurrencyForExport(v) },
    { header: "Pgto", key: "payment_method", format: (v) => paymentLabels[v as string] || v || "—" }
  ], [])

  const totalIncome = monthEntries.filter(e => e.type === "income").reduce((s, e) => s + (e.amount || 0), 0)
  const totalExpense = monthEntries.filter(e => e.type === "expense").reduce((s, e) => s + (e.amount || 0), 0)
  const balance = totalIncome - totalExpense

  // 6-month bar chart data
  const barData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const inc = entries.filter(e => (e.date || "").startsWith(key) && e.type === "income").reduce((s, e) => s + (e.amount || 0), 0)
      const exp = entries.filter(e => (e.date || "").startsWith(key) && e.type === "expense").reduce((s, e) => s + (e.amount || 0), 0)
      return { name: ptMonths[d.getMonth()], Entradas: inc, Saídas: exp }
    })
  }, [entries])

  // Pie chart by category
  const pieData = useMemo(() => {
    const cats: Record<string, number> = {}
    monthEntries.filter(e => e.type === "income").forEach(e => {
      const cat = e.category || "Outros"
      cats[cat] = (cats[cat] || 0) + (e.amount || 0)
    })
    return Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 6)
  }, [monthEntries])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {[
          { label: "Entradas", value: formatCurrency(totalIncome), color: '#059669', gradient: 'linear-gradient(135deg,#22c997,#5ee0b8)', icon: TrendingUp, shadow: 'rgba(34,201,151,0.25)' },
          { label: "Saídas", value: formatCurrency(totalExpense), color: '#ef4444', gradient: 'linear-gradient(135deg,#f25c5c,#f78888)', icon: TrendingDown, shadow: 'rgba(242,92,92,0.25)' },
          { label: "Saldo do Mês", value: formatCurrency(balance), color: balance >= 0 ? '#059669' : '#ef4444', gradient: balance >= 0 ? 'linear-gradient(135deg,#7c5cfc,#a78bfa)' : 'linear-gradient(135deg,#f25c5c,#f78888)', icon: DollarSign, shadow: 'rgba(124,92,252,0.25)' },
        ].map((c, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e5e7eb', boxShadow: `0 4px 20px ${c.shadow}`, transition: 'transform 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.gradient, boxShadow: `0 4px 14px ${c.shadow}` }}>
                <c.icon style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>{c.label}</span>
            </div>
            <p style={{ fontSize: '1.625rem', fontWeight: 800, color: c.color, fontFamily: "var(--font-heading)" }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        {/* 6-month Bar Chart */}
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1e1e2d', fontFamily: "var(--font-heading)", marginBottom: '1rem' }}>Entradas vs Saídas (6 meses)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: '0.8125rem' }} />
              <Bar dataKey="Entradas" fill="#22c997" radius={[4,4,0,0]} />
              <Bar dataKey="Saídas" fill="#f25c5c" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart — Income by category */}
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1e1e2d', fontFamily: "var(--font-heading)", marginBottom: '1rem' }}>Entradas por Categoria</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: '0.8125rem' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.75rem' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px' }}>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Sem entradas neste mês</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions + Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <PermissionGate permission="finance.create">
          <button onClick={() => openForm("income")} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#22c997,#5ee0b8)', boxShadow: '0 4px 14px rgba(34,201,151,0.3)' }}>
            <ArrowUpCircle style={{ width: '1rem', height: '1rem' }} /> Nova Entrada
          </button>
        </PermissionGate>
        <PermissionGate permission="finance.expenses">
          <button onClick={() => openForm("expense")} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#f25c5c,#f78888)', boxShadow: '0 4px 14px rgba(242,92,92,0.3)' }}>
            <ArrowDownCircle style={{ width: '1rem', height: '1rem' }} /> Nova Saída
          </button>
        </PermissionGate>

        <PermissionGate permission="finance.export">
          <div style={{ marginLeft: '0.5rem', display: 'flex' }}>
            <ExportButtons 
              data={filtered}
              columns={exportColumns}
              fileName={`financeiro_${monthFilter}`}
              title={`Relatório Financeiro - ${monthFilter}`}
              exportPermissionKey="finance.export"
              moduleName="financeiro"
            />
          </div>
        </PermissionGate>

        <div style={{ flex: 1 }} />
        <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }} />
      </div>

      {/* Search */}
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', border: '1px solid #e5e7eb', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#9ca3af' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: '2.5rem' }} placeholder="Buscar lançamentos..." />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: '130px', cursor: 'pointer' }}>
          <option value="all">Todos</option>
          <option value="income">Entradas</option>
          <option value="expense">Saídas</option>
        </select>
      </div>

      {/* Modal */}
      {showForm && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999 }} onClick={() => setShowForm(false)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10000, background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '28rem', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: formType === "income" ? 'linear-gradient(135deg,#22c997,#5ee0b8)' : 'linear-gradient(135deg,#f25c5c,#f78888)' }}>
                  {formType === "income" ? <ArrowUpCircle style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} /> : <ArrowDownCircle style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} />}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>{formType === "income" ? "Nova Entrada" : "Nova Saída"}</h3>
              </div>
              <button onClick={() => setShowForm(false)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}><X style={{ width: '1.25rem', height: '1.25rem', color: '#9ca3af' }} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><label style={labelStyle}>Descrição *</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={inputStyle} placeholder="Descrição do lançamento" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div><label style={labelStyle}>Valor (R$) *</label><input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle} placeholder="0.00" /></div>
                <div><label style={labelStyle}>Data *</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} /></div>
              </div>
              <div><label style={labelStyle}>Categoria *</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Selecione...</option>
                  {(formType === "income" ? incomeCategories : expenseCategories).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Método de Pagamento</label>
                <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="cash">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="debit_card">Cartão de Débito</option>
                </select>
              </div>
              <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: saving ? 'wait' : 'pointer', marginTop: '0.5rem', background: formType === "income" ? 'linear-gradient(135deg,#22c997,#5ee0b8)' : 'linear-gradient(135deg,#f25c5c,#f78888)', boxShadow: formType === "income" ? '0 4px 14px rgba(34,201,151,0.3)' : '0 4px 14px rgba(242,92,92,0.3)', opacity: saving ? 0.7 : 1 }}>
                {saving ? "Salvando..." : `Registrar ${formType === "income" ? "Entrada" : "Saída"}`}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Entries List */}
      <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f3f4f6', background: '#fafbfc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>Lançamentos ({filtered.length})</h3>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{monthFilter.split('-').reverse().join('/')}</span>
        </div>
        {filtered.length > 0 ? (
          <div>
            {filtered.map((entry) => (
              <div key={entry.id} onClick={() => entry.cash_register_id ? setSelectedEntry(entry) : undefined} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.5rem', borderBottom: '1px solid #f8f9fa', transition: 'background 0.15s', cursor: entry.cash_register_id ? 'pointer' : 'default' }}>
                <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: entry.type === "income" ? '#ecfdf5' : '#fef2f2' }}>
                  {entry.type === "income" ? <ArrowUpCircle style={{ width: '1rem', height: '1rem', color: '#059669' }} /> : <ArrowDownCircle style={{ width: '1rem', height: '1rem', color: '#ef4444' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: '#1e1e2d', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description || "Sem descrição"}</p>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {entry.category || "Sem categoria"} • {paymentLabels[entry.payment_method] || entry.payment_method || "N/A"} • {(entry.date || "").split("-").reverse().join("/")}
                    {entry.client_name ? ` • ${entry.client_name}` : ""}
                    {entry.employee_name ? ` • ${entry.employee_name}` : ""}
                  </p>
                  {entry.cash_operator_name && (
                    <p style={{ fontSize: '0.625rem', color: '#7c5cfc', fontWeight: 600, marginTop: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Landmark style={{ width: '0.5rem', height: '0.5rem' }} /> Caixa: {entry.cash_operator_name}
                    </p>
                  )}
                </div>
                <p style={{ fontWeight: 800, fontSize: '0.9375rem', color: entry.type === "income" ? '#059669' : '#ef4444', whiteSpace: 'nowrap' }}>
                  {entry.type === "income" ? "+" : "-"}{formatCurrency(entry.paid_amount || entry.amount)}
                </p>
                <PermissionGate permission="finance.delete">
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(entry.id, entry.description) }} style={{ padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}>
                    <Trash2 style={{ width: '0.875rem', height: '0.875rem', color: '#d1d5db' }} />
                  </button>
                </PermissionGate>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <DollarSign style={{ width: '2rem', height: '2rem', color: '#d1d5db', margin: '0 auto 0.75rem' }} />
            <p style={{ color: '#6b7280', fontWeight: 600 }}>Nenhum lançamento encontrado</p>
          </div>
        )}
      </div>
      <ConfirmationDialog />
      {selectedEntry && (
        <CashMovementDetailsModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onUpdated={() => { load(); setSelectedEntry(null) }}
        />
      )}
    </div>
  )
}
