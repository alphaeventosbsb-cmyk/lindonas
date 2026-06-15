"use client"

import { useEffect, useState } from "react"
import { fetchCollection, createDocument, updateDocument, deleteDocument } from "@/lib/firebase/client-utils"
import { uploadToCloudinary } from "@/lib/cloudinary"
import type { Employee, EmployeeStatus, BusinessSettings, Category, Service } from "@/lib/types/database"
import { Loader2, Plus, Pencil, Trash2, Search, Users, ChevronRight, CheckSquare, LayoutGrid, List, Filter } from "lucide-react"
import { ExpandableImage } from "@/components/ui/expandable-image"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"
import { ProfessionalDetailsModal } from "@/components/admin/professional-details-modal"
import { ProfessionalFormModal } from "@/components/admin/professional-form-modal"
import { normalizeSearchText } from "@/lib/search"
import { usePermission } from "@/lib/rbac/usePermission"
import { PermissionGate } from "@/components/ui/permission-gate"
import { maskPhone, maskEmail } from "@/lib/rbac/rbac-utils"
import { logPermissionChange } from "@/lib/audit-logger"
import { useTenant } from "@/lib/auth/tenant-context"
import { ExportButtons } from "@/components/ui/export-buttons"
import { type ColumnDef, formatDateForExport } from "@/lib/export-utils"

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const gradients = [
  "linear-gradient(135deg, #7c5cfc, #a78bfa)", "linear-gradient(135deg, #22c997, #5ee0b8)",
  "linear-gradient(135deg, #5b8def, #93b5f5)", "linear-gradient(135deg, #ffb547, #ffd08a)",
  "linear-gradient(135deg, #f25c5c, #f78888)", "linear-gradient(135deg, #e879a0, #f0a5bd)",
]

const statusColors: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: '#ecfdf5', color: '#059669', label: 'Ativo' },
  inactive: { bg: '#f3f4f6', color: '#6b7280', label: 'Inativo' },
  blocked: { bg: '#fef2f2', color: '#ef4444', label: 'Bloqueado' },
  vacation: { bg: '#fffbeb', color: '#d97706', label: 'Férias' },
  away: { bg: '#f5f3ff', color: '#7c3aed', label: 'Afastado' },
}

export default function ProfissionaisPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "inactive">("all")
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [selectedEmp, setSelectedEmp] = useState<{ emp: Employee; idx: number } | null>(null)
  const [search, setSearch] = useState("")
  const [businessName, setBusinessName] = useState('Estabelecimento')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "cards">("list")
  const { ConfirmationDialog, confirm } = useConfirm()
  const { saasUser } = useTenant()
  const { can } = usePermission()
  const canCreate = can("professionals.create")
  const canEdit = can("professionals.edit")
  const canDelete = can("professionals.delete")
  const canViewPhone = can("security.phone.view")
  const canViewEmail = can("security.email.view")

  const load = async () => {
    setLoading(true)
    const [empData, catData, svcData] = await Promise.all([
      fetchCollection<Employee>("employees", "name"),
      fetchCollection<Category>("categories", "name"),
      fetchCollection<Service>("services")
    ])
    setEmployees(empData)
    setCategories(catData)
    setServices(svcData)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    fetchCollection<BusinessSettings>('settings').then(s => {
      if (s.length > 0 && s[0].business_name) setBusinessName(s[0].business_name)
    })
  }, [])

  const openNew = () => { setEditing(null); setShowForm(true) }
  const openEdit = (e: Employee) => { setEditing(e); setShowForm(true); setSelectedEmp(null) }

  const handleSave = async (data: any, photoFile: File | null, oldPhotoUrl: string | null) => {
    try {
      let photoUrl = data.photo_url || null

      // Handle photo upload via Cloudinary
      if (photoFile) {
        photoUrl = await uploadToCloudinary(photoFile, "salao/profissionais")
      }

      const saveData = { ...data, photo_url: photoUrl }

      if (editing) {
        const oldPerms = editing.rbac_permissions || []
        const newPerms = data.rbac_permissions || []
        
        await updateDocument("employees", editing.id, saveData)
        
        if (JSON.stringify(oldPerms) !== JSON.stringify(newPerms) || editing.rbac_profile_id !== data.rbac_profile_id) {
          await logPermissionChange(
            editing.id,
            editing.name,
            editing.rbac_profile_id || '',
            data.rbac_profile_id || '',
            oldPerms,
            newPerms,
            saasUser?.id || '',
            saasUser?.name || 'Sistema'
          )
        }
        
        toast.success("Profissional atualizado!")
      } else {
        const newDoc = await createDocument("employees", saveData) as any
        
        await logPermissionChange(
            newDoc.id,
            saveData.name,
            '',
            data.rbac_profile_id || '',
            [],
            data.rbac_permissions || [],
            saasUser?.id || '',
            saasUser?.name || 'Sistema'
        )
        
        toast.success("Profissional criado!")
      }
      setShowForm(false)
      load()
    } catch (err) {
      console.error("Erro ao salvar profissional:", err)
      toast.error(err instanceof Error ? err.message : "Erro ao salvar profissional")
      throw err
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument("employees", id)
      toast.success("Profissional excluído com sucesso")
      setSelectedEmp(null)
      setShowForm(false)
      load()
    } catch (err) {
      console.error("Erro ao excluir profissional:", err)
      toast.error("Erro ao excluir profissional")
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    const names = ids.map(id => employees.find(e => e.id === id)?.name || id)
    const listText = names.length <= 5
      ? names.map(n => `• ${n}`).join('\n')
      : names.slice(0, 5).map(n => `• ${n}`).join('\n') + `\n...e mais ${names.length - 5} profissional(is)`

    const confirmed = await confirm({
      title: "Excluir profissionais selecionados",
      message: `Tem certeza que deseja excluir os profissionais selecionados?\n\nQuantidade: ${ids.length}\n\n${listText}\n\nEssa ação não poderá ser desfeita.`,
      confirmText: "Excluir profissionais",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return

    let successCount = 0
    let failCount = 0
    for (const id of ids) {
      try {
        await deleteDocument("employees", id)
        successCount++
      } catch {
        failCount++
      }
    }
    setSelectedIds(new Set())
    setSelectionMode(false)
    if (successCount > 0) toast.success(`${successCount} profissional(is) excluído(s) com sucesso`)
    if (failCount > 0) toast.error(`${failCount} profissional(is) não puderam ser excluídos`)
    load()
  }

  const filtered = employees.filter(e => {
    // Status Filter
    if (selectedStatus !== "all") {
      const s = e.status || (e.is_active ? 'active' : 'inactive')
      const isActive = s === 'active'
      if (selectedStatus === "active" && !isActive) return false
      if (selectedStatus === "inactive" && isActive) return false
    }

    // Category Filter
    if (selectedCategoryId) {
      const employeeServices = services.filter(s => (e.service_ids || []).includes(s.id))
      const hasCategory = employeeServices.some(s => s.category_id === selectedCategoryId)
      if (!hasCategory) return false
    }

    if (!search) return true
    const q = normalizeSearchText(search)
    return normalizeSearchText(e.name).includes(q) || normalizeSearchText(e.nickname).includes(q) ||
      normalizeSearchText(e.specialty).includes(q) || (e.phone || "").includes(q) || normalizeSearchText(e.email).includes(q)
  })

  const getActiveDaysShort = (workdays: number[] | undefined) => {
    if (!workdays || !workdays.length) return "—"
    const sorted = [...workdays].sort()
    if (sorted.length >= 3) {
      const labels = sorted.map(d => weekDays[d])
      return `${labels[0]}-${labels[labels.length - 1]}`
    }
    return sorted.map(d => weekDays[d]).join(", ")
  }

  const getStatus = (emp: Employee) => {
    const s = emp.status || (emp.is_active ? 'active' : 'inactive')
    return statusColors[s] || statusColors.active
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#7c5cfc' }} /></div>

  const exportColumns: ColumnDef<Employee>[] = [
    { header: "Nome", key: "name" },
    { header: "Telefone", key: "phone" },
    { header: "Email", key: "email" },
    { header: "Especialidade", key: "specialty", format: (v) => v || "—" },
    { header: "Comissão (%)", key: "commission_percent", format: (v) => v != null ? `${v}%` : "0%" },
    { header: "Status", key: "status", format: (v, row) => {
        const s = v || (row.is_active ? 'active' : 'inactive')
        return statusColors[s]?.label || "Ativo"
    }},
    { header: "Data Cadastro", key: "created_at", format: formatDateForExport },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(124,92,252,0.25)' }}>
            <Users style={{ width: '16px', height: '16px', color: '#fff' }} />
          </div>
          <div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d' }}>{filtered.length} profission{filtered.length === 1 ? 'al' : 'ais'}</span>
            {search && <span style={{ fontSize: '0.6875rem', color: '#8b8fa7', marginLeft: '0.375rem' }}>de {employees.length}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => {
              if (selectionMode) { setSelectedIds(new Set()); setSelectionMode(false) }
              else setSelectionMode(true)
            }}
            style={{
              padding: '0.625rem 1rem', borderRadius: '0.75rem', fontWeight: 600, fontSize: '0.8125rem',
              display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', minHeight: '44px',
              border: selectionMode ? '2px solid #ef4444' : '2px solid #e8ecf4',
              background: selectionMode ? '#fef2f2' : '#fff',
              color: selectionMode ? '#ef4444' : '#4b5563',
              transition: 'all 0.15s',
            }}
          >
            <CheckSquare style={{ width: '15px', height: '15px' }} />
            {selectionMode ? 'Cancelar' : 'Selecionar'}
          </button>
          <PermissionGate permission="professionals.create">
            <button onClick={openNew} style={{
              padding: '0.625rem 1.25rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.8125rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 4px 14px rgba(124,92,252,0.25)', minHeight: '44px',
            }}>
              <Plus style={{ width: '16px', height: '16px' }} /> Novo Profissional
            </button>
          </PermissionGate>
          <ExportButtons
            data={filtered}
            columns={exportColumns}
            fileName={`profissionais-${new Date().toISOString().split('T')[0]}`}
            title="Relatório de Profissionais"
          />
        </div>
      </div>

      {/* Search and Filters */}
      <div style={{ background: '#fff', borderRadius: '0.875rem', padding: '0.75rem 1rem', border: '1px solid #e8ecf4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#8b8fa7' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '0.75rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', borderRadius: '0.5rem', border: '2px solid #e8ecf4', background: '#fafbfc', fontSize: '0.8125rem', color: '#1e1e2d', outline: 'none', minHeight: '40px' }}
            placeholder="Buscar por nome, apelido, especialidade, telefone ou e-mail..." />
        </div>

        {/* Status Filter */}
        <div style={{ position: 'relative', minWidth: '150px', maxWidth: '180px', flex: '1 1 150px' }}>
          <Filter style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: selectedStatus !== 'all' ? '#7c5cfc' : '#8b8fa7', transition: 'color 0.15s' }} />
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value as "all" | "active" | "inactive")}
            style={{
              width: '100%',
              paddingLeft: '2.25rem',
              paddingRight: '1.5rem',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              outline: 'none',
              minHeight: '40px',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.75rem center',
              cursor: 'pointer',
              border: selectedStatus !== 'all' ? '2px solid #c4b5fd' : '2px solid #e8ecf4',
              backgroundColor: selectedStatus !== 'all' ? '#faf8ff' : '#fafbfc',
              color: selectedStatus !== 'all' ? '#7c5cfc' : '#1e1e2d',
              transition: 'all 0.15s',
            }}
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
        
        {/* Category Filter */}
        <div style={{ position: 'relative', minWidth: '180px', maxWidth: '240px', flex: '1 1 180px' }}>
          <Filter style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: selectedCategoryId ? '#7c5cfc' : '#8b8fa7', transition: 'color 0.15s' }} />
          <select
            value={selectedCategoryId}
            onChange={e => setSelectedCategoryId(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '2.25rem',
              paddingRight: '1.5rem',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              outline: 'none',
              minHeight: '40px',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.75rem center',
              cursor: 'pointer',
              border: selectedCategoryId ? '2px solid #c4b5fd' : '2px solid #e8ecf4',
              backgroundColor: selectedCategoryId ? '#faf8ff' : '#fafbfc',
              color: selectedCategoryId ? '#7c5cfc' : '#1e1e2d',
              transition: 'all 0.15s',
            }}
          >
            <option value="">Todas as categorias</option>
            {categories.filter(c => c.is_active !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.375rem', background: '#f8fafc', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
          <button 
            onClick={() => setViewMode("cards")}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
              border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.15s',
              background: viewMode === "cards" ? '#fff' : 'transparent',
              color: viewMode === "cards" ? '#7c5cfc' : '#64748b',
              boxShadow: viewMode === "cards" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <LayoutGrid style={{ width: '14px', height: '14px' }} /> Cards
          </button>
          <button 
            onClick={() => setViewMode("list")}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
              border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.15s',
              background: viewMode === "list" ? '#fff' : 'transparent',
              color: viewMode === "list" ? '#7c5cfc' : '#64748b',
              boxShadow: viewMode === "list" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <List style={{ width: '14px', height: '14px' }} /> Lista
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem',
          padding: '0.625rem 1rem',
        }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#991b1b' }}>
            {selectedIds.size} profissional{selectedIds.size > 1 ? 'is' : ''} selecionado{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => { setSelectedIds(new Set()); setSelectionMode(false) }}
              style={{
                padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e8ecf4',
                background: '#fff', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              Limpar seleção
            </button>
            <PermissionGate permission="professionals.delete">
              <button
                onClick={handleBulkDelete}
                style={{
                  padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: 'none',
                  background: '#ef4444', color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem',
                  transition: 'all 0.15s', boxShadow: '0 2px 8px rgba(239,68,68,0.25)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
              >
                <Trash2 style={{ width: '13px', height: '13px' }} />
                Excluir selecionados
              </button>
            </PermissionGate>
          </div>
        </div>
      )}

      {/* List / Cards */}
      {viewMode === "list" ? (
        <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e8ecf4', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {/* Desktop header */}
          <div className="hidden md:flex" style={{ padding: '0.625rem 1.25rem', gap: '0.75rem', alignItems: 'center', background: '#fafbfc', borderBottom: '1px solid #f1f3f9' }}>
            <span style={{ width: '1.25rem', display: selectionMode ? 'block' : 'none' }} />
            <span style={{ width: '2.25rem' }} />
            <span style={{ flex: 2, fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Profissional</span>
            <span style={{ flex: 1, fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Telefone</span>
            <span style={{ width: '4rem', fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Status</span>
            <span style={{ width: '4.5rem', fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Comissão</span>
            <span style={{ width: '5.5rem', fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Agenda</span>
            <span style={{ width: '6rem', fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Horário</span>
            <span style={{ width: '4.5rem', fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Ações</span>
          </div>

          {filtered.length > 0 ? filtered.map((emp, i) => {
            const gradient = gradients[i % gradients.length]
            const st = getStatus(emp)
            return (
              <div key={emp.id}
                onClick={() => setSelectedEmp({ emp, idx: i })}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1.25rem',
                  borderBottom: '1px solid #f5f5fa', cursor: 'pointer', transition: 'all 0.15s',
                  background: selectedIds.has(emp.id) ? '#faf5ff' : 'transparent',
                }}
                onMouseEnter={e => { if (!selectedIds.has(emp.id)) e.currentTarget.style.background = '#faf8ff'; e.currentTarget.style.transform = 'translateX(2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = selectedIds.has(emp.id) ? '#faf5ff' : 'transparent'; e.currentTarget.style.transform = 'none' }}
              >
                {/* Checkbox */}
                {selectionMode && (
                  <div style={{ width: '1.25rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(emp.id)}
                      onChange={() => toggleSelection(emp.id)}
                      onClick={e => e.stopPropagation()}
                      style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#7c5cfc' }}
                    />
                  </div>
                )}

                {/* Avatar */}
                {emp.photo_url ? (
                  <ExpandableImage src={emp.photo_url} alt={emp.name} style={{
                    width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', objectFit: 'cover', flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  }} />
                ) : (
                  <div style={{
                    width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: gradient, color: '#fff', fontSize: '0.875rem', fontWeight: 800,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  }}>
                    {emp.name.charAt(0)}
                  </div>
                )}

                {/* Name + specialty */}
                <div style={{ flex: 2, minWidth: 0 }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emp.name}
                    {emp.nickname && <span style={{ fontWeight: 500, color: '#8b8fa7', marginLeft: '0.375rem', fontSize: '0.6875rem' }}>({emp.nickname})</span>}
                  </p>
                  <p style={{ fontSize: '0.6875rem', color: '#8b8fa7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.specialty || '—'}</p>
                </div>

                {/* Phone - desktop */}
                <div className="hidden md:block" style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{canViewPhone ? (emp.phone || '—') : maskPhone(emp.phone)}</p>
                </div>

                {/* Status - desktop */}
                <div className="hidden md:flex" style={{ width: '4rem', justifyContent: 'center' }}>
                  <span style={{
                    fontSize: '0.5625rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '999px',
                    background: st.bg, color: st.color, textTransform: 'uppercase', letterSpacing: '0.03em',
                  }}>
                    {st.label}
                  </span>
                </div>

                {/* Commission - desktop */}
                <div className="hidden md:flex" style={{ width: '4.5rem', justifyContent: 'center' }}>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '999px',
                    background: '#f5f3ff', color: '#7c5cfc', border: '1px solid #e0d4ff',
                  }}>
                    {emp.commission_percent || 0}%
                  </span>
                </div>

                {/* Days - desktop */}
                <div className="hidden md:block" style={{ width: '5.5rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#374151' }}>{getActiveDaysShort(emp.workdays)}</span>
                </div>

                {/* Hours - desktop */}
                <div className="hidden md:block" style={{ width: '6rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#374151' }}>{emp.working_hours_start}–{emp.working_hours_end}</span>
                </div>

                {/* Actions */}
                <div style={{ width: '4.5rem', display: 'flex', justifyContent: 'center', gap: '0.25rem', flexShrink: 0 }}>
                  <PermissionGate permission="professionals.edit">
                    <button onClick={e => { e.stopPropagation(); openEdit(emp) }} style={{
                      padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: '#f5f3ff',
                      cursor: 'pointer', display: 'flex', transition: 'all 0.15s',
                    }} onMouseEnter={e => e.currentTarget.style.background = '#e0d4ff'} onMouseLeave={e => e.currentTarget.style.background = '#f5f3ff'}>
                      <Pencil style={{ width: '13px', height: '13px', color: '#7c5cfc' }} />
                    </button>
                  </PermissionGate>
                  <PermissionGate permission="professionals.delete">
                    <button onClick={e => { 
                      e.stopPropagation(); 
                      confirm({
                        title: "Excluir profissional",
                        message: `Tem certeza que deseja excluir este profissional?\n\nProfissional: ${emp.name}\n\nEssa ação não poderá ser desfeita.`,
                        confirmText: "Excluir profissional",
                        cancelText: "Cancelar",
                        variant: "danger",
                      }).then(res => { if (res) handleDelete(emp.id) }) 
                    }} style={{
                      padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: '#fef2f2',
                      cursor: 'pointer', display: 'flex', transition: 'all 0.15s',
                    }} onMouseEnter={e => e.currentTarget.style.background = '#fecaca'} onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}>
                      <Trash2 style={{ width: '13px', height: '13px', color: '#ef4444' }} />
                    </button>
                  </PermissionGate>
                  <ChevronRight className="hidden md:block" style={{ width: '14px', height: '14px', color: '#d1d5db', alignSelf: 'center' }} />
                </div>
              </div>
            )
          }) : (
            <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <div style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', background: '#f1f3f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                <Users style={{ width: '1.25rem', height: '1.25rem', color: '#8b8fa7' }} />
              </div>
              <p style={{ fontWeight: 600, color: '#1e1e2d', marginBottom: '0.25rem' }}>
                {search ? 'Nenhum profissional encontrado' : 'Nenhum profissional cadastrado'}
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#8b8fa7' }}>
                {search ? 'Tente alterar os termos de busca' : 'Comece adicionando seu primeiro profissional'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {filtered.length > 0 ? filtered.map((emp, i) => {
            const gradient = gradients[i % gradients.length]
            const st = getStatus(emp)
            return (
              <div key={emp.id}
                onClick={() => setSelectedEmp({ emp, idx: i })}
                style={{
                  background: '#fff', borderRadius: '1rem', border: '1px solid #e8ecf4', overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.15s',
                  position: 'relative', opacity: emp.is_active ? 1 : 0.6,
                }}
                onMouseEnter={ev => { ev.currentTarget.style.transform = 'translateY(-2px)'; ev.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)' }}
                onMouseLeave={ev => { ev.currentTarget.style.transform = 'none'; ev.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                {selectionMode && (
                  <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 10 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(emp.id)}
                      onChange={() => toggleSelection(emp.id)}
                      onClick={ev => ev.stopPropagation()}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#7c5cfc' }}
                    />
                  </div>
                )}
                <div style={{ height: '4px', background: gradient }} />
                <div style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    {emp.photo_url ? (
                      <ExpandableImage src={emp.photo_url} alt={emp.name} style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', objectFit: 'cover', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }} />
                    ) : (
                      <div style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradient, color: '#fff', fontSize: '1.125rem', fontWeight: 800, boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
                        {emp.name.charAt(0)}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: '#1e1e2d', fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</p>
                      <p style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.specialty || "Sem especialidade"}</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={{ background: '#fafbfc', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #f1f3f9' }}>
                      <span style={{ display: 'block', fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase' }}>Status</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ background: '#fafbfc', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #f1f3f9' }}>
                      <span style={{ display: 'block', fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase' }}>Comissão</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e1e2d' }}>{emp.commission_percent || 0}%</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#4b5563', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8b8fa7' }}>Dias de trab.:</span>
                      <span style={{ fontWeight: 500 }}>{getActiveDaysShort(emp.workdays)}</span>
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#4b5563', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8b8fa7' }}>Contato:</span>
                      <span style={{ fontWeight: 500 }}>{canViewPhone ? (emp.phone || "Não informado") : maskPhone(emp.phone)}</span>
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid #f1f3f9', paddingTop: '1rem' }}>
                    <PermissionGate permission="professionals.edit">
                      <button
                        onClick={(ev) => { ev.stopPropagation(); openEdit(emp) }}
                        style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', background: '#f5f3ff', color: '#7c5cfc', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}
                      >
                        <Pencil style={{ width: '13px', height: '13px' }} /> Editar
                      </button>
                    </PermissionGate>
                    <PermissionGate permission="professionals.delete">
                      <button
                        onClick={(ev) => { 
                          ev.stopPropagation(); 
                          confirm({
                            title: "Excluir profissional",
                            message: `Tem certeza que deseja excluir este profissional?\n\nProfissional: ${emp.name}\n\nEssa ação não poderá ser desfeita.`,
                            confirmText: "Excluir profissional",
                            cancelText: "Cancelar",
                            variant: "danger",
                          }).then(res => { if (res) handleDelete(emp.id) }) 
                        }}
                        style={{ padding: '0.5rem', borderRadius: '0.5rem', background: '#fef2f2', color: '#ef4444', border: 'none', cursor: 'pointer' }}
                      >
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    </PermissionGate>
                  </div>
                </div>
              </div>
            )
          }) : (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', gridColumn: '1 / -1', background: '#fff', borderRadius: '1rem', border: '1px solid #e8ecf4' }}>
              <div style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', background: '#f1f3f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                <Users style={{ width: '1.25rem', height: '1.25rem', color: '#8b8fa7' }} />
              </div>
              <p style={{ color: '#1e1e2d', fontSize: '0.875rem', fontWeight: 600 }}>Nenhum profissional encontrado.</p>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {selectedEmp && (
        <ProfessionalDetailsModal
          employee={selectedEmp.emp}
          index={selectedEmp.idx}
          onClose={() => setSelectedEmp(null)}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <ProfessionalFormModal
          employee={editing}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
          onDelete={handleDelete}
          businessName={businessName}
        />
      )}
      <ConfirmationDialog />
    </div>
  )
}
