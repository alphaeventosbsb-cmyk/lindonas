"use client"

import { useState, useEffect } from "react"
import { useTenant } from "@/lib/auth/tenant-context"
import { fetchCollection, createDocument, updateDocument, deleteDocument } from "@/lib/firebase/client-utils"
import type { Product } from "@/lib/types/database"
import { formatCurrency } from "@/lib/utils"
import { Package, Search, Plus, Loader2, AlertCircle, TrendingDown, Layers, Box, Edit2, ArrowRightLeft, CheckSquare, Trash2 } from "lucide-react"
import { ProductFormModal } from "@/components/admin/product-form-modal"
import { StockAdjustmentModal } from "@/components/admin/stock-adjustment-modal"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"
import { usePermission } from "@/lib/rbac/usePermission"
import { PermissionGate } from "@/components/ui/permission-gate"
import { ExportButtons } from "@/components/ui/export-buttons"
import { type ColumnDef, formatCurrencyForExport } from "@/lib/export-utils"
import { logDataAudit } from "@/lib/firebase/audit-service"
import { createHistoryEvent } from "@/lib/firebase/history-service"

export default function EstoquePage() {
  const { saasUser, companyId } = useTenant()
  const { can } = usePermission()
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const { ConfirmationDialog, confirm } = useConfirm()

  const [showProductModal, setShowProductModal] = useState(false)
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const loadProducts = async () => {
    setLoading(true)
    try {
      const res = await fetchCollection<Product>("products", "name")
      setAllProducts(res)
    } catch (err) {
      console.error("Erro ao carregar produtos:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProducts() }, [])

  const handleSaveProduct = async (data: any) => {
    try {
      if (selectedProduct) {
        await updateDocument("products", selectedProduct.id, data)
        await createHistoryEvent({
          client_id: null,
          client_name: null,
          action_type: "product_updated",
          action_title: "Produto atualizado",
          action_description: `Produto: ${data.name} | Quantidade: ${data.stock_quantity || 0}`,
          performed_by_user_id: (saasUser as any)?.id || "system",
          performed_by_name: saasUser?.name || "Sistema",
          performed_by_email: saasUser?.email || null
        })
        toast.success("Produto atualizado!")
      } else {
        const newProd = await createDocument("products", {
          ...data,
          company_id: companyId
        })
        await createHistoryEvent({
          client_id: null,
          client_name: null,
          action_type: "product_created",
          action_title: "Produto cadastrado",
          action_description: `Produto: ${data.name} | Estoque inicial: ${data.stock_quantity || 0}`,
          performed_by_user_id: (saasUser as any)?.id || "system",
          performed_by_name: saasUser?.name || "Sistema",
          performed_by_email: saasUser?.email || null
        })
        // If it was created with initial stock > 0, we should log the first movement
        if (data.stock_quantity > 0) {
          await createDocument("inventory_movements", {
            company_id: companyId,
            product_id: newProd.id,
            appointment_id: null,
            service_id: null,
            quantity: data.stock_quantity,
            unit: data.unit,
            type: "in",
            reason: "Estoque inicial",
            created_by_id: (saasUser as any)?.id || null,
            created_by_name: saasUser?.name || null,
          })
        }
        toast.success("Produto cadastrado com sucesso!")
      }
      setShowProductModal(false)
      loadProducts()
    } catch (err) {
      console.error(err)
      toast.error(`Erro ao salvar: ${(err as any)?.message || 'Desconhecido'}`)
    }
  }

  const handleSaveAdjustment = async (data: { type: "in" | "out" | "adjustment", quantity: number, reason: string }) => {
    if (!selectedProduct) return
    try {
      let newStock = selectedProduct.stock_quantity
      if (data.type === 'in') newStock += data.quantity
      else if (data.type === 'out') newStock = Math.max(0, newStock - data.quantity)
      else if (data.type === 'adjustment') newStock = data.quantity

      const isAutoInactive = newStock <= 0
      
      await updateDocument("products", selectedProduct.id, {
        stock_quantity: newStock,
        is_active: isAutoInactive ? false : selectedProduct.is_active
      })

      await createDocument("inventory_movements", {
        company_id: companyId,
        product_id: selectedProduct.id,
        appointment_id: null,
        service_id: null,
        quantity: data.quantity,
        unit: selectedProduct.unit,
        type: data.type,
        reason: data.reason,
        created_by_id: (saasUser as any)?.id || null,
        created_by_name: saasUser?.name || null,
      })

      await createHistoryEvent({
        client_id: null,
        client_name: null,
        action_type: "stock_adjusted",
        action_title: "Estoque ajustado",
        action_description: `Produto: ${selectedProduct.name} | Ajuste: ${data.type === 'in' ? '+' : data.type === 'out' ? '-' : ''}${data.quantity} | Novo saldo: ${newStock}`,
        performed_by_user_id: (saasUser as any)?.id || "system",
        performed_by_name: saasUser?.name || "Sistema",
        performed_by_email: saasUser?.email || null
      })

      toast.success("Estoque ajustado com sucesso!")
      setShowAdjustmentModal(false)
      loadProducts()
    } catch (err) {
      console.error(err)
      toast.error(`Erro ao ajustar: ${(err as any)?.message || 'Desconhecido'}`)
    }
  }

  const handleDeleteSingle = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: "Excluir Produto",
      message: `Tem certeza que deseja excluir o produto "${name}"?\nIsso não removerá o histórico de movimentações, mas o produto não aparecerá mais no estoque.`,
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return

    try {
      await deleteDocument("products", id)
      await createHistoryEvent({
        client_id: null,
        client_name: null,
        action_type: "product_deleted",
        action_title: "Produto excluído",
        action_description: `Produto: ${name}`,
        performed_by_user_id: (saasUser as any)?.id || "system",
        performed_by_name: saasUser?.name || "Sistema",
        performed_by_email: saasUser?.email || null
      })
      toast.success("Produto excluído com sucesso!")
      loadProducts()
    } catch (err) {
      console.error(err)
      toast.error("Erro ao excluir produto")
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    const names = ids.map(id => allProducts.find(p => p.id === id)?.name || id)
    const listText = names.length <= 5
      ? names.map(n => `• ${n}`).join('\n')
      : names.slice(0, 5).map(n => `• ${n}`).join('\n') + `\n...e mais ${names.length - 5} produto(s)`

    const confirmed = await confirm({
      title: "Excluir produtos selecionados",
      message: `Tem certeza que deseja excluir os produtos selecionados?\n\nQuantidade: ${ids.length}\n\n${listText}\n\nEssa ação não poderá ser desfeita.`,
      confirmText: "Excluir produtos",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return

    let successCount = 0
    let failCount = 0
    for (const id of ids) {
      try {
        await deleteDocument("products", id)
        const name = allProducts.find(p => p.id === id)?.name || "Produto"
        await createHistoryEvent({
          client_id: null,
          client_name: null,
          action_type: "product_deleted",
          action_title: "Produto excluído",
          action_description: `Produto (Exclusão em massa): ${name}`,
          performed_by_user_id: (saasUser as any)?.id || "system",
          performed_by_name: saasUser?.name || "Sistema",
          performed_by_email: saasUser?.email || null
        })
        successCount++
      } catch {
        failCount++
      }
    }
    setSelectedIds(new Set())
    setSelectionMode(false)
    if (successCount > 0) toast.success(`${successCount} produto(s) excluído(s) com sucesso`)
    if (failCount > 0) toast.error(`${failCount} produto(s) não puderam ser excluídos`)
    loadProducts()
  }

  // Filter products by current company, allowing legacy ones
  const products = allProducts.filter(p => !p.company_id || p.company_id === companyId)

  const handleImportConfirm = async (
    dataToImport: Record<string, unknown>[],
    mappedKeys: string[],
    columnMapping: Record<string, string>
  ) => {
    let successCount = 0
    let failCount = 0

    const validRows = dataToImport.filter(r => r._status === "valid" || r._status === "warning")
    if (validRows.length === 0) return

    for (const row of validRows) {
      try {
        const nameCol = Object.keys(columnMapping).find(k => columnMapping[k] === "name")
        const categoryCol = Object.keys(columnMapping).find(k => columnMapping[k] === "category")
        const skuCol = Object.keys(columnMapping).find(k => columnMapping[k] === "sku")
        const barcodeCol = Object.keys(columnMapping).find(k => columnMapping[k] === "barcode")
        const qtyCol = Object.keys(columnMapping).find(k => columnMapping[k] === "stock_quantity")
        const minStockCol = Object.keys(columnMapping).find(k => columnMapping[k] === "min_stock")
        const unitCol = Object.keys(columnMapping).find(k => columnMapping[k] === "unit")
        const costCol = Object.keys(columnMapping).find(k => columnMapping[k] === "cost_price")
        const sellCol = Object.keys(columnMapping).find(k => columnMapping[k] === "sell_price")
        const supplierCol = Object.keys(columnMapping).find(k => columnMapping[k] === "supplier")
        const manufacturerCol = Object.keys(columnMapping).find(k => columnMapping[k] === "manufacturer")
        const statusCol = Object.keys(columnMapping).find(k => columnMapping[k] === "status")

        const nameVal = nameCol ? String(row[nameCol] || "").trim() : ""
        const categoryVal = categoryCol ? String(row[categoryCol] || "").trim() : null
        const skuVal = skuCol ? String(row[skuCol] || "").trim() : null
        const barcodeVal = barcodeCol ? String(row[barcodeCol] || "").trim() : null
        const unitVal = unitCol ? String(row[unitCol] || "").trim() || "un" : "un"
        const supplierVal = supplierCol ? String(row[supplierCol] || "").trim() : null
        const manufacturerVal = manufacturerCol ? String(row[manufacturerCol] || "").trim() : null

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

        const costVal = costCol ? parseBrazilianNum(String(row[costCol] || "")) : 0
        const sellVal = sellCol ? parseBrazilianNum(String(row[sellCol] || "")) : null
        const qtyVal = qtyCol ? parseBrazilianNum(String(row[qtyCol] || "")) : 0
        const minStockVal = minStockCol ? parseBrazilianNum(String(row[minStockCol] || "")) : 1

        const activeStr = statusCol ? String(row[statusCol] || "").toLowerCase() : ""
        let isActive = true
        if (activeStr === "inativo" || activeStr === "falso" || activeStr === "false" || activeStr === "0" || qtyVal <= 0) {
          isActive = false
        }

        const finalName = nameVal || String(row._generatedName || "Produto sem nome")

        const newProd = await createDocument("products", {
          company_id: companyId,
          name: finalName,
          category: categoryVal,
          sku: skuVal,
          barcode: barcodeVal,
          unit: unitVal,
          cost_price: costVal,
          sell_price: sellVal,
          stock_quantity: qtyVal,
          min_stock: minStockVal,
          supplier: supplierVal,
          manufacturer: manufacturerVal,
          is_active: isActive
        })

        if (qtyVal > 0) {
          await createDocument("inventory_movements", {
            company_id: companyId,
            product_id: newProd.id,
            appointment_id: null,
            service_id: null,
            quantity: qtyVal,
            unit: unitVal,
            type: "in",
            reason: "Estoque inicial (Importação)",
            created_by_id: (saasUser as any)?.id || null,
            created_by_name: saasUser?.name || null,
          })
        }

        successCount++
      } catch (err) {
        console.error("Erro importando linha:", err)
        failCount++
      }
    }

    if (successCount > 0) toast.success(`${successCount} produto(s) importado(s) com sucesso!`)
    if (failCount > 0) toast.error(`${failCount} falharam.`)
    
    if (saasUser) {
      logDataAudit({
        company_id: companyId || saasUser.company_id || "unknown",
        user_id: saasUser.id,
        user_name: saasUser.name,
        user_email: saasUser.email || undefined,
        action: "IMPORT",
        module: "produtos",
        format: "CSV/Excel",
        total_lines: dataToImport.length,
        created: successCount,
        errors: failCount,
        status: failCount === 0 ? "success" : (successCount > 0 ? "partial" : "error")
      })
    }
    
    loadProducts()
  }

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.manufacturer?.toLowerCase().includes(search.toLowerCase()))
  
  const totalValue = products.reduce((acc, p) => acc + (p.cost_price * p.stock_quantity), 0)
  const totalItems = products.length
  const lowStock = products.filter(p => p.stock_quantity <= (p.min_stock || 1)).length

  const exportColumns: ColumnDef<Product>[] = [
    { header: "Nome", key: "name" },
    { header: "Categoria", key: "category", format: (v) => v || "—" },
    { header: "SKU", key: "sku", format: (v) => v || "—" },
    { header: "Cód. Barras", key: "barcode", format: (v) => v || "—" },
    { header: "Estoque", key: "stock_quantity", format: (v, row) => `${v} ${row.unit || ""}`.trim() },
    { header: "Min.", key: "min_stock", format: (v) => v || "1" },
    { header: "Custo", key: "cost_price", format: formatCurrencyForExport },
    { header: "Venda", key: "sell_price", format: formatCurrencyForExport },
    { header: "Fornecedor", key: "supplier", format: (v) => v || "—" },
    { header: "Marca", key: "manufacturer", format: (v) => v || "—" },
    { header: "Status", key: "is_active", format: (v) => v ? "Ativo" : "Inativo" }
  ]

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e8ecf4', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers style={{ width: '1.25rem', height: '1.25rem', color: '#16a34a' }} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor em Estoque</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>{formatCurrency(totalValue)}</p>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e8ecf4', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box style={{ width: '1.25rem', height: '1.25rem', color: '#2563eb' }} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Produtos Cadastrados</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>{totalItems}</p>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e8ecf4', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', background: lowStock > 0 ? '#fef2f2' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingDown style={{ width: '1.25rem', height: '1.25rem', color: lowStock > 0 ? '#ef4444' : '#64748b' }} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estoque Baixo</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: lowStock > 0 ? '#ef4444' : '#1e293b' }}>{lowStock}</p>
          </div>
        </div>
      </div>

      {/* Header Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
          <input 
            type="text" 
            placeholder="Buscar produto ou marca..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '999px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.875rem', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => {
              if (selectionMode) { setSelectedIds(new Set()); setSelectionMode(false) }
              else setSelectionMode(true)
            }}
            style={{
              padding: '0.625rem 1rem', borderRadius: '999px', fontWeight: 600, fontSize: '0.8125rem',
              display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer',
              border: selectionMode ? '2px solid #ef4444' : '2px solid #e8ecf4',
              background: selectionMode ? '#fef2f2' : '#fff',
              color: selectionMode ? '#ef4444' : '#4b5563',
              transition: 'all 0.15s',
            }}
          >
            <CheckSquare style={{ width: '15px', height: '15px' }} />
            {selectionMode ? 'Cancelar' : 'Selecionar'}
          </button>
          <PermissionGate permission="products.create">
            <button onClick={() => { setSelectedProduct(null); setShowProductModal(true) }} style={{ padding: '0.75rem 1.5rem', borderRadius: '999px', background: '#0891b2', color: '#fff', fontSize: '0.875rem', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(8,145,178,0.25)' }}>
              <Plus style={{ width: '1.125rem', height: '1.125rem' }} /> Novo Produto
            </button>
          </PermissionGate>
          <ExportButtons
            data={filtered}
            columns={exportColumns}
            fileName={`estoque-${new Date().toISOString().split('T')[0]}`}
            title="Relatório de Estoque"
            importModule="estoque"
            onImportConfirm={handleImportConfirm}
            exportPermissionKey="products.export"
            importPermissionKey="products.import"
            moduleName="produtos"
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem',
          padding: '0.625rem 1rem', marginBottom: '1rem'
        }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#991b1b' }}>
            {selectedIds.size} produto{selectedIds.size > 1 ? 's' : ''} selecionado{selectedIds.size > 1 ? 's' : ''}
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
            <PermissionGate permission="products.delete">
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
                <Trash2 style={{ width: '14px', height: '14px' }} /> Excluir Selecionados
              </button>
            </PermissionGate>
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e8ecf4', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="hidden md:flex" style={{ padding: '0.875rem 1.25rem', gap: '0.75rem', alignItems: 'center', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          {selectionMode && <div style={{ width: '2rem' }}></div>}
          <span style={{ flex: 2, fontSize: '0.625rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Produto</span>
          <span style={{ width: '6rem', fontSize: '0.625rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Status</span>
          <span style={{ width: '6rem', fontSize: '0.625rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Custo Médio</span>
          <span style={{ width: '7rem', fontSize: '0.625rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Qtd Atual</span>
          <span style={{ width: '6rem', fontSize: '0.625rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Ações</span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
            <Loader2 className="w-6 h-6 animate-spin text-[#0891b2]" />
          </div>
        ) : filtered.length > 0 ? (
          filtered.map(p => {
            const isLow = p.stock_quantity <= (p.min_stock || 1)
            const isZero = p.stock_quantity <= 0
            
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s', background: selectedIds.has(p.id) ? '#f8fafc' : '#fff' }}>
                {selectionMode && (
                  <div style={{ width: '2rem', display: 'flex', justifyContent: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(p.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedIds)
                        if (e.target.checked) newSet.add(p.id)
                        else newSet.delete(p.id)
                        setSelectedIds(newSet)
                      }}
                      style={{ width: '1.125rem', height: '1.125rem', cursor: 'pointer', accentColor: '#0891b2' }}
                    />
                  </div>
                )}
                <div style={{ flex: 2, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                    {isLow && !isZero && <span style={{ padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: '#fffbeb', color: '#d97706', fontSize: '0.625rem', fontWeight: 700, border: '1px solid #fde68a' }}>BAIXO</span>}
                    {isZero && <span style={{ padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: '#fef2f2', color: '#ef4444', fontSize: '0.625rem', fontWeight: 700, border: '1px solid #fecaca' }}>ZERADO</span>}
                  </div>
                  {p.manufacturer && <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.125rem' }}>Marca: {p.manufacturer}</p>}
                </div>

                <div style={{ width: '6rem', display: 'flex', justifyContent: 'center' }}>
                  <span style={{ padding: '0.25rem 0.5rem', borderRadius: '999px', fontSize: '0.625rem', fontWeight: 700, background: p.is_active ? '#ecfdf5' : '#f1f5f9', color: p.is_active ? '#059669' : '#64748b' }}>
                    {p.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div style={{ width: '6rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>{formatCurrency(p.cost_price)}</p>
                </div>

                <div style={{ width: '7rem', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', background: isZero ? '#fef2f2' : (isLow ? '#fffbeb' : '#f8fafc'), border: isZero ? '1px solid #fecaca' : (isLow ? '1px solid #fde68a' : '1px solid #e2e8f0'), display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: isZero ? '#ef4444' : (isLow ? '#d97706' : '#1e293b') }}>{p.stock_quantity}</span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b' }}>{p.unit}</span>
                  </div>
                </div>

                <div style={{ width: '6rem', display: 'flex', justifyContent: 'center', gap: '0.375rem' }}>
                  <PermissionGate permission="inventory.adjustment">
                    <button onClick={() => { setSelectedProduct(p); setShowAdjustmentModal(true) }} title="Ajuste Manual" style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0891b2' }}>
                      <ArrowRightLeft style={{ width: '1rem', height: '1rem' }} />
                    </button>
                  </PermissionGate>
                  <PermissionGate permission="products.edit">
                    <button onClick={() => { setSelectedProduct(p); setShowProductModal(true) }} title="Editar Produto" style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}>
                      <Edit2 style={{ width: '1rem', height: '1rem' }} />
                    </button>
                  </PermissionGate>
                  <PermissionGate permission="products.delete">
                    <button onClick={() => handleDeleteSingle(p.id, p.name)} title="Excluir Produto" style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', border: '1px solid #fee2e2', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}>
                      <Trash2 style={{ width: '1rem', height: '1rem' }} />
                    </button>
                  </PermissionGate>
                </div>
              </div>
            )
          })
        ) : (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ width: '4rem', height: '4rem', borderRadius: '1rem', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', border: '1px solid #e2e8f0' }}>
              <Package style={{ width: '1.5rem', height: '1.5rem', color: '#94a3b8' }} />
            </div>
            <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>{search ? 'Nenhum produto encontrado' : 'Estoque vazio'}</p>
            <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{search ? 'Tente outros termos na busca' : 'Cadastre seu primeiro produto para gerenciar o estoque.'}</p>
          </div>
        )}
      </div>

      {showProductModal && (
        <ProductFormModal 
          product={selectedProduct} 
          onClose={() => setShowProductModal(false)} 
          onSave={handleSaveProduct} 
        />
      )}

      {showAdjustmentModal && selectedProduct && (
        <StockAdjustmentModal 
          product={selectedProduct} 
          onClose={() => setShowAdjustmentModal(false)} 
          onSave={handleSaveAdjustment} 
        />
      )}
      <ConfirmationDialog />
    </div>
  )
}
