"use client"

import { useEffect, useState } from "react"
import { fetchCollection, createDocument, updateDocument, deleteDocument, fetchCollectionWhere } from "@/lib/firebase/client-utils"
import { uploadToCloudinary } from "@/lib/cloudinary"
import type { Service, Category, ServiceProduct } from "@/lib/types/database"
import { formatCurrency, formatDuration } from "@/lib/utils"
import { normalizeSearchText } from "@/lib/search"
import { Loader2, Plus, Pencil, Trash2, X, Clock, Search, Scissors, Filter, ChevronRight, Tag, ChevronDown, ChevronUp, CheckSquare, LayoutGrid, List, EyeOff } from "lucide-react"
import { ExpandableImage } from "@/components/ui/expandable-image"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"
import { ServiceFormModal } from "@/components/admin/service-form-modal"
import { CategoryManagerModal } from "@/components/admin/category-manager-modal"
import { usePermission } from "@/lib/rbac/usePermission"
import { PermissionGate } from "@/components/ui/permission-gate"
import { ExportButtons } from "@/components/ui/export-buttons"
import { type ColumnDef, formatCurrencyForExport } from "@/lib/export-utils"

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
  border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d',
  fontSize: '0.875rem', fontWeight: 500, outline: 'none',
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', padding: '1rem', zIndex: 9999,
}

const statusColors: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: '#ecfdf5', color: '#059669', label: 'Ativo' },
  inactive: { bg: '#f3f4f6', color: '#6b7280', label: 'Inativo' },
}

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: '28rem',
  padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
  maxHeight: '90vh', overflowY: 'auto',
}

export default function ServicosPage() {
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const { ConfirmationDialog, confirm } = useConfirm()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "cards">("list")
  const { can } = usePermission()
  const canEdit = can("services.edit")

  const load = async () => {
    setLoading(true)
    const [svc, cat, prods] = await Promise.all([
      fetchCollection<Service>("services", "display_order"),
      fetchCollection<Category>("categories", "display_order"),
      fetchCollection<any>("products", "name"),
    ])
    setServices(svc)
    setCategories(cat)
    setAllProducts(prods)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setShowForm(true) }
  const openEdit = (s: Service) => { setEditing(s); setShowForm(true) }

  const handleFormSave = async (data: any, photoFile: File | null, oldPhotoUrl: string | null, serviceProducts: any[]) => {
    try {
      let imageUrl = data.image_url
      if (photoFile) {
        imageUrl = await uploadToCloudinary(photoFile, "salao/servicos")
      }

      const saveData = { ...data, image_url: imageUrl, display_order: editing ? (editing.display_order ?? 0) : services.length, featured: editing?.featured ?? false }

      let serviceId: string
      if (editing) {
        await updateDocument("services", editing.id, saveData)
        serviceId = editing.id
        toast.success("Serviço atualizado!")
      } else {
        const newDoc = await createDocument("services", saveData) as any
        serviceId = newDoc.id
        toast.success("Serviço criado!")
      }

      // Save service_products
      if (serviceProducts && serviceProducts.length > 0) {
        // Delete old ones for this service
        if (editing) {
          const oldSps = await fetchCollectionWhere<ServiceProduct>("service_products", "service_id", "==", serviceId)
          for (const old of oldSps) { await deleteDocument("service_products", old.id) }
        }
        for (const sp of serviceProducts) {
          if (sp.product_id) {
            await createDocument("service_products", {
              company_id: saveData.company_id || "default",
              service_id: serviceId,
              product_id: sp.product_id,
              product_name_snapshot: sp.product_name_snapshot || "",
              quantity: sp.quantity || 1,
              unit: sp.unit || "unidade",
              add_to_total_mode: sp.add_to_total_mode || "none",
              cost_snapshot: sp.cost_snapshot || 0,
              is_active: true,
            })
          }
        }
      }

      setShowForm(false)
      load()
    } catch (err) {
      console.error("Erro ao salvar serviço:", err)
      toast.error(`Erro ao salvar serviço: ${(err as any)?.message || 'Erro desconhecido'}`)
      throw err
    }
  }

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: "Excluir serviço",
      message: `Tem certeza que deseja excluir este serviço?\n\nServiço: ${name}\n\nEssa ação não poderá ser desfeita.`,
      confirmText: "Excluir serviço",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    try {
      await deleteDocument("services", id)
      toast.success("Serviço excluído")
      load()
    } catch (err) {
      console.error("Erro ao excluir serviço:", err)
      toast.error("Erro ao excluir serviço")
    }
  }

  const handleImportConfirm = async (payloads: any[]) => {
    let successCount = 0
    let failCount = 0
    let duplicateCount = 0

    const latestCategories = await fetchCollection<Category>("categories", "display_order")

    for (const p of payloads) {
      if (p._status === "duplicate") {
        duplicateCount++
        continue
      }
      
      try {
        let catId = null
        if (p.category) {
          const matchedCat = latestCategories.find(c => c.name.toLowerCase().trim() === String(p.category).toLowerCase().trim())
          if (matchedCat) {
            catId = matchedCat.id
          }
        }
        
        const parseBrazilianNum = (val: string) => {
          if (!val) return 0
          const clean = val.replace(/[R$\s]/g, "")
          if (clean.includes(",") && clean.includes(".")) {
            return parseFloat(clean.replace(/\./g, "").replace(",", "."))
          } else if (clean.includes(",")) {
            return parseFloat(clean.replace(",", "."))
          }
          return parseFloat(clean)
        }

        const parseDuration = (val: string) => {
          if (!val) return 60
          const s = String(val).toLowerCase().trim()
          if (s.includes("h")) {
            const parts = s.split("h")
            const h = parseInt(parts[0]) || 0
            const m = parseInt(parts[1]) || 0
            return h * 60 + m
          }
          if (s.includes(":")) {
            const parts = s.split(":")
            const h = parseInt(parts[0]) || 0
            const m = parseInt(parts[1]) || 0
            return h * 60 + m
          }
          const num = parseInt(s.replace(/\D/g, ""))
          return isNaN(num) ? 60 : num
        }
        
        const parseStatus = (val: string) => {
          if (val === undefined || val === null || val === "") return true
          const s = String(val).toLowerCase().trim()
          if (['ativo', 'sim', 'true', '1', 'ativa'].includes(s)) return true
          if (['inativo', 'nao', 'não', 'false', '0', 'inativa'].includes(s)) return false
          return true
        }

        const parseOnlineVisibility = (val: string) => {
          if (val === undefined || val === null || val === "") return false
          const s = String(val).toLowerCase().trim()
          if (['sim', 'true', '1', 'online', 'visível', 'visivel'].includes(s)) return false
          if (['nao', 'não', 'false', '0', 'invisível', 'invisivel'].includes(s)) return true
          return false
        }

        let finalDescription = p.description ? String(p.description) : ""
        if (p._generatedNotes && typeof p._generatedNotes === 'string' && p._generatedNotes.includes("Comissão informada na importação:")) {
           const match = p._generatedNotes.match(/Comissão informada na importação:[^|]+/)
           if (match) {
             finalDescription = finalDescription ? finalDescription + "\n\n" + match[0].trim() : match[0].trim()
           }
        }

        const saveData = {
          name: p._status === "warning" && p._generatedName ? p._generatedName : p.name,
          description: finalDescription,
          category_id: catId,
          price: p.price ? parseBrazilianNum(String(p.price)) : 0,
          price_type: "fixed",
          duration_minutes: p.duration ? parseDuration(String(p.duration)) : 60,
          is_active: p.status !== undefined ? parseStatus(String(p.status)) : true,
          hide_from_online_booking: p.online !== undefined ? parseOnlineVisibility(String(p.online)) : false,
          color_hex: "",
          promotional_price: null,
          product_average_cost: null,
          professional_product_average_cost: null,
          disposable_expenses: null,
          establishment_operational_cost: null,
          professional_operational_cost: null,
          featured: false,
          display_order: services.length + successCount,
        }

        await createDocument("services", saveData)
        successCount++
      } catch (err) {
        console.error("Failed to import service:", err)
        failCount++
      }
    }

    if (successCount > 0) toast.success(`${successCount} serviço(s) importados!`)
    if (failCount > 0) toast.error(`${failCount} falharam.`)
    if (duplicateCount > 0) toast.info(`${duplicateCount} duplicados ignorados.`)
    load()
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
    const names = ids.map(id => services.find(s => s.id === id)?.name || id)
    const listText = names.length <= 5
      ? names.map(n => `• ${n}`).join('\n')
      : names.slice(0, 5).map(n => `• ${n}`).join('\n') + `\n...e mais ${names.length - 5} serviço(s)`

    const confirmed = await confirm({
      title: "Excluir serviços selecionados",
      message: `Tem certeza que deseja excluir os serviços selecionados?\n\nQuantidade: ${ids.length}\n\n${listText}\n\nEssa ação não poderá ser desfeita.`,
      confirmText: "Excluir serviços",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return

    let successCount = 0
    let failCount = 0
    for (const id of ids) {
      try {
        await deleteDocument("services", id)
        successCount++
      } catch {
        failCount++
      }
    }
    setSelectedIds(new Set())
    setSelectionMode(false)
    if (successCount > 0) toast.success(`${successCount} serviço(s) excluído(s) com sucesso`)
    if (failCount > 0) toast.error(`${failCount} serviço(s) não puderam ser excluídos`)
    load()
  }

  const toggleActive = async (s: Service) => {
    if (!canEdit) { toast.error("Sem permissão para alterar status"); return }
    try {
      await updateDocument("services", s.id, { is_active: !s.is_active })
      toast.success(s.is_active ? "Serviço desativado" : "Serviço ativado")
      load()
    } catch (err) {
      console.error("Erro ao alterar status:", err)
      toast.error("Erro ao alterar status")
    }
  }

  const filtered = services.filter(s => {
    if (statusFilter === 'active' && !s.is_active) return false
    if (statusFilter === 'inactive' && s.is_active) return false
    if (categoryFilter !== 'all' && s.category_id !== categoryFilter) return false
    if (search) {
      const q = normalizeSearchText(search)
      if (!normalizeSearchText(s.name).includes(q) && !normalizeSearchText(s.description).includes(q) && !normalizeSearchText(s.service_code).includes(q)) return false
    }
    return true
  })

  const getCategoryName = (id: string | null) => {
    if (!id) return "Sem Categoria"
    const c = categories.find(c => c.id === id)
    return c ? c.name : "Sem Categoria"
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" /></div>

  const exportColumns: ColumnDef<Service>[] = [
    { header: "Nome", key: "name" },
    { header: "Categoria", key: "category_id", format: (v) => getCategoryName(v) },
    { header: "Duração", key: "duration_minutes", format: (v) => formatDuration(v) },
    { header: "Valor", key: "price", format: formatCurrencyForExport },
    { header: "Valor Promo", key: "promotional_price", format: (v) => v ? formatCurrencyForExport(v) : "—" },
    { header: "Visível Online", key: "hide_from_online_booking", format: (v) => v ? "Não" : "Sim" },
    { header: "Status", key: "is_active", format: (v) => v ? "Ativo" : "Inativo" }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(124,92,252,0.25)' }}>
            <Scissors style={{ width: '16px', height: '16px', color: '#fff' }} />
          </div>
          <div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d' }}>{filtered.length} serviç{filtered.length === 1 ? 'o' : 'os'}</span>
            {search || statusFilter !== 'all' || categoryFilter !== 'all' ? <span style={{ fontSize: '0.6875rem', color: '#8b8fa7', marginLeft: '0.375rem' }}>de {services.length}</span> : null}
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
          <PermissionGate permission="services.create">
            <button
              onClick={() => setShowCategoryManager(true)}
              style={{
                padding: '0.625rem 1rem', borderRadius: '0.75rem', fontWeight: 600, fontSize: '0.8125rem',
                display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', minHeight: '44px',
                border: '2px solid #e8ecf4', background: '#fff', color: '#4b5563', transition: 'all 0.15s',
              }}
            >
              <Tag style={{ width: '15px', height: '15px' }} />
              Categorias
            </button>
            <button onClick={openNew} style={{
              padding: '0.625rem 1.25rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.8125rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 4px 14px rgba(124,92,252,0.25)', minHeight: '44px',
            }}>
              <Plus style={{ width: '16px', height: '16px' }} /> Novo Serviço
            </button>
          </PermissionGate>
          <ExportButtons
            data={filtered}
            columns={exportColumns}
            fileName={`servicos-${new Date().toISOString().split('T')[0]}`}
            title="Relatório de Serviços"
            importModule="servicos"
            fullData={services}
            onImportConfirm={handleImportConfirm}
          />
        </div>
      </div>

      {/* Filters and Search */}
      <div style={{ background: '#fff', borderRadius: '0.875rem', padding: '0.75rem 1rem', border: '1px solid #e8ecf4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#8b8fa7' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '0.75rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', borderRadius: '0.5rem', border: '2px solid #e8ecf4', background: '#fafbfc', fontSize: '0.8125rem', color: '#1e1e2d', outline: 'none', minHeight: '40px' }}
            placeholder="Buscar por nome ou descrição..." />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Filter style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#8b8fa7' }} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ paddingLeft: '2.25rem', paddingRight: '2rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', borderRadius: '0.5rem', border: '2px solid #e8ecf4', background: '#fafbfc', fontSize: '0.8125rem', color: '#4b5563', outline: 'none', minHeight: '40px', appearance: 'none', cursor: 'pointer' }}>
              <option value="all">Todos os Status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
          <div style={{ position: 'relative' }}>
            <Tag style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#8b8fa7' }} />
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              style={{ paddingLeft: '2.25rem', paddingRight: '2rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', borderRadius: '0.5rem', border: '2px solid #e8ecf4', background: '#fafbfc', fontSize: '0.8125rem', color: '#4b5563', outline: 'none', minHeight: '40px', appearance: 'none', cursor: 'pointer' }}>
              <option value="all">Todas Categorias</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.375rem', background: '#f8fafc', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginLeft: 'auto' }}>
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
      </div>

      {/* Modal */}
      {showForm && (
        <ServiceFormModal
          service={editing}
          categories={categories}
          allServices={services}
          allProducts={allProducts}
          onClose={() => setShowForm(false)}
          onSave={handleFormSave}
        />
      )}

      {showCategoryManager && (
        <CategoryManagerModal
          categories={categories}
          services={services}
          onClose={() => setShowCategoryManager(false)}
          onRefresh={load}
        />
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem',
          padding: '0.625rem 1rem',
        }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#991b1b' }}>
            {selectedIds.size} serviço{selectedIds.size > 1 ? 's' : ''} selecionado{selectedIds.size > 1 ? 's' : ''}
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
            <PermissionGate permission="services.delete">
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

      {/* List */}
      {viewMode === "list" ? (
        <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e8ecf4', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {/* Desktop header */}
          <div className="hidden md:flex" style={{ padding: '0.625rem 1.25rem', gap: '0.75rem', alignItems: 'center', background: '#fafbfc', borderBottom: '1px solid #f1f3f9' }}>
            <span style={{ width: '1.25rem', display: selectionMode ? 'block' : 'none' }} />
            <span style={{ width: '2.25rem' }} />
            <span style={{ flex: 2, fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Serviço</span>
            <span style={{ flex: 1, fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Categoria</span>
            <span style={{ width: '5rem', fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Duração</span>
            <span style={{ width: '6rem', fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Valor</span>
            <span style={{ width: '4rem', fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Status</span>
            <span style={{ width: '4.5rem', fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Ações</span>
          </div>

          {filtered.length > 0 ? filtered.map((s, i) => {
            const st = s.is_active ? statusColors.active : statusColors.inactive
            return (
              <div key={s.id}
                onClick={() => openEdit(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1.25rem',
                  borderBottom: '1px solid #f5f5fa', cursor: 'pointer', transition: 'all 0.15s',
                  opacity: s.is_active ? 1 : 0.6,
                  background: selectedIds.has(s.id) ? '#faf5ff' : 'transparent',
                }}
                onMouseEnter={e => { if (!selectedIds.has(s.id)) e.currentTarget.style.background = '#faf8ff'; e.currentTarget.style.transform = 'translateX(2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = selectedIds.has(s.id) ? '#faf5ff' : 'transparent'; e.currentTarget.style.transform = 'none' }}
              >
                {/* Checkbox */}
                {selectionMode && (
                  <div style={{ width: '1.25rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelection(s.id)}
                      onClick={e => e.stopPropagation()}
                      style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#7c5cfc' }}
                    />
                  </div>
                )}
                {/* Icon & Online Visibility */}
                <div style={{
                  width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', flexShrink: 0, position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: s.image_url ? 'transparent' : (s.is_active ? '#f5f3ff' : '#f3f4f6'), color: s.is_active ? '#7c5cfc' : '#9ca3af',
                  overflow: 'hidden'
                }}>
                  {s.image_url ? (
                    <ExpandableImage src={s.image_url} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Scissors style={{ width: '14px', height: '14px' }} />
                  )}
                  {s.hide_from_online_booking && (
                    <div style={{ position: 'absolute', bottom: -2, right: -2, background: '#fff', borderRadius: '50%', padding: '1px' }}>
                      <EyeOff style={{ width: '10px', height: '10px', color: '#94a3b8' }} />
                    </div>
                  )}
                </div>

                {/* Name + description + color */}
                <div style={{ flex: 2, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    {s.color_hex && <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: s.color_hex, flexShrink: 0 }} />}
                    <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </p>
                  </div>
                  {s.description && (
                    <p style={{ fontSize: '0.6875rem', color: '#8b8fa7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.description}
                    </p>
                  )}
                </div>

                {/* Category - desktop */}
                <div className="hidden md:block" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', padding: '0.2rem 0.5rem', borderRadius: '0.375rem', background: '#f8fafc', border: '1px solid #f1f5f9', display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {getCategoryName(s.category_id)}
                  </span>
                </div>

                {/* Duration - desktop */}
                <div className="hidden md:flex" style={{ width: '5rem', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#6b7280' }}>
                    <Clock style={{ width: '12px', height: '12px' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{formatDuration(s.duration_minutes)}</span>
                  </div>
                </div>

                {/* Price - desktop */}
                <div className="hidden md:flex" style={{ width: '6rem', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  {s.price_type === 'starting_at' && (
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', marginBottom: '0.125rem' }}>A partir de</span>
                  )}
                  {s.promotional_price ? (
                    <>
                      <span style={{ fontSize: '0.6875rem', textDecoration: 'line-through', color: '#9ca3af' }}>{formatCurrency(s.price)}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669' }}>{formatCurrency(s.promotional_price)}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#7c5cfc' }}>{formatCurrency(s.price)}</span>
                  )}
                </div>

                {/* Status - desktop */}
                <div className="hidden md:flex" style={{ width: '4rem', justifyContent: 'center' }}>
                  <button onClick={(e) => { e.stopPropagation(); toggleActive(s) }} style={{
                    fontSize: '0.5625rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '999px',
                    background: st.bg, color: st.color, textTransform: 'uppercase', letterSpacing: '0.03em', border: 'none', cursor: 'pointer', transition: 'all 0.15s'
                  }} onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'} onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                    {st.label}
                  </button>
                </div>

                {/* Actions */}
                <div style={{ width: '4.5rem', display: 'flex', justifyContent: 'center', gap: '0.25rem', flexShrink: 0 }}>
                  <PermissionGate permission="services.edit">
                    <button onClick={e => { e.stopPropagation(); openEdit(s) }} style={{
                      padding: '0.375rem', borderRadius: '0.375rem', border: 'none', background: '#f5f3ff',
                      cursor: 'pointer', display: 'flex', transition: 'all 0.15s',
                    }} onMouseEnter={e => e.currentTarget.style.background = '#e0d4ff'} onMouseLeave={e => e.currentTarget.style.background = '#f5f3ff'}>
                      <Pencil style={{ width: '13px', height: '13px', color: '#7c5cfc' }} />
                    </button>
                  </PermissionGate>
                  <PermissionGate permission="services.delete">
                    <button onClick={e => { e.stopPropagation(); handleDelete(s.id, s.name) }} style={{
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
                <Scissors style={{ width: '1.25rem', height: '1.25rem', color: '#8b8fa7' }} />
              </div>
              <p style={{ fontWeight: 600, color: '#1e1e2d', marginBottom: '0.25rem' }}>
                {search || statusFilter !== 'all' || categoryFilter !== 'all' ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#8b8fa7' }}>
                {search || statusFilter !== 'all' || categoryFilter !== 'all' ? 'Tente alterar os termos de busca' : 'Comece adicionando seu primeiro serviço'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {filtered.length > 0 ? filtered.map((s, i) => {
            const st = s.is_active ? statusColors.active : statusColors.inactive
            return (
              <div key={s.id}
                onClick={() => openEdit(s)}
                style={{
                  background: '#fff', borderRadius: '1rem', border: selectedIds.has(s.id) ? '2px solid #7c5cfc' : '1px solid #e8ecf4', overflow: 'hidden',
                  boxShadow: selectedIds.has(s.id) ? '0 4px 14px rgba(124,92,252,0.15)' : '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.15s',
                  position: 'relative', cursor: 'pointer', opacity: s.is_active ? 1 : 0.6,
                  display: 'flex', flexDirection: 'column'
                }}
                onMouseEnter={ev => { ev.currentTarget.style.transform = 'translateY(-2px)'; ev.currentTarget.style.boxShadow = selectedIds.has(s.id) ? '0 6px 20px rgba(124,92,252,0.2)' : '0 10px 25px rgba(0,0,0,0.1)' }}
                onMouseLeave={ev => { ev.currentTarget.style.transform = 'none'; ev.currentTarget.style.boxShadow = selectedIds.has(s.id) ? '0 4px 14px rgba(124,92,252,0.15)' : '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <div style={{ height: '4px', background: s.is_active ? 'linear-gradient(135deg, #7c5cfc, #a78bfa)' : '#e5e7eb' }} />
                <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                      {selectionMode ? (
                        <div style={{ width: '2.5rem', height: '2.5rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(s.id)}
                            onChange={() => toggleSelection(s.id)}
                            onClick={e => e.stopPropagation()}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#7c5cfc' }}
                          />
                        </div>
                      ) : (
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.625rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.is_active ? '#f5f3ff' : '#f3f4f6', color: s.is_active ? '#7c5cfc' : '#9ca3af' }}>
                          <Scissors style={{ width: '16px', height: '16px' }} />
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 700, color: '#1e1e2d', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.name}
                        </p>
                        {s.description && (
                          <p style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); toggleActive(s) }} style={{ flexShrink: 0, fontSize: '0.625rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '999px', background: st.bg, color: st.color, border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}>
                      {st.label}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', padding: '0.75rem', background: '#fafbfc', borderRadius: '0.75rem', border: '1px solid #f1f3f9' }}>
                    <p style={{ fontSize: '0.75rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Tag style={{ width: '12px', height: '12px', color: '#9ca3af' }} />
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCategoryName(s.category_id)}</span>
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Clock style={{ width: '12px', height: '12px', color: '#9ca3af' }} />
                      <span style={{ fontWeight: 500 }}>{formatDuration(s.duration_minutes)}</span>
                    </p>
                  </div>

                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '1rem', borderTop: '1px dashed #e2e8f0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {s.price_type === 'starting_at' && (
                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', marginBottom: '0.125rem' }}>A partir de</span>
                      )}
                      {s.promotional_price ? (
                        <>
                          <span style={{ fontSize: '0.6875rem', textDecoration: 'line-through', color: '#9ca3af' }}>{formatCurrency(s.price)}</span>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>{formatCurrency(s.promotional_price)}</span>
                        </>
                      ) : (
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#7c5cfc' }}>{formatCurrency(s.price)}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <PermissionGate permission="services.edit">
                        <button onClick={e => { e.stopPropagation(); openEdit(s) }} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: '#f5f3ff', cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#e0d4ff'} onMouseLeave={e => e.currentTarget.style.background = '#f5f3ff'}>
                          <Pencil style={{ width: '14px', height: '14px', color: '#7c5cfc' }} />
                        </button>
                      </PermissionGate>
                      <PermissionGate permission="services.delete">
                        <button onClick={e => { e.stopPropagation(); handleDelete(s.id, s.name) }} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: '#fef2f2', cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#fecaca'} onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}>
                          <Trash2 style={{ width: '14px', height: '14px', color: '#ef4444' }} />
                        </button>
                      </PermissionGate>
                    </div>
                  </div>
                </div>
              </div>
            )
          }) : (
            <div style={{ padding: '3rem 2rem', textAlign: 'center', gridColumn: '1 / -1', background: '#fff', borderRadius: '1rem', border: '1px solid #e8ecf4' }}>
              <div style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', background: '#f1f3f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                <Scissors style={{ width: '1.25rem', height: '1.25rem', color: '#8b8fa7' }} />
              </div>
              <p style={{ fontWeight: 600, color: '#1e1e2d', marginBottom: '0.25rem' }}>
                {search || statusFilter !== 'all' || categoryFilter !== 'all' ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#8b8fa7' }}>
                {search || statusFilter !== 'all' || categoryFilter !== 'all' ? 'Tente alterar os termos de busca' : 'Comece adicionando seu primeiro serviço'}
              </p>
            </div>
          )}
        </div>
      )}
      <ConfirmationDialog />
    </div>
  )
}
