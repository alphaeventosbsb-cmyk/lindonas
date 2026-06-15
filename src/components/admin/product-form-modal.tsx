"use client"

import { useState, useEffect } from "react"
import { X, Package, Truck, Activity, Loader2, ArrowRightLeft, Calendar } from "lucide-react"
import type { Product, InventoryMovement } from "@/lib/types/database"
import { useTenant } from "@/lib/auth/tenant-context"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"
import { formatCurrency } from "@/lib/utils"

interface ProductFormModalProps {
  product: Product | null
  onClose: () => void
  onSave: (data: any) => Promise<void>
}

export function ProductFormModal({ product, onClose, onSave }: ProductFormModalProps) {
  const { saasUser } = useTenant()
  const [activeTab, setActiveTab] = useState<'geral' | 'fornecedor' | 'historico'>('geral')
  const [saving, setSaving] = useState(false)
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [form, setForm] = useState({
    name: product?.name || "",
    unit: product?.unit || "un",
    cost_price: product?.cost_price ? String(product.cost_price) : "",
    sell_price: product?.sell_price ? String(product.sell_price) : "",
    stock_quantity: product?.stock_quantity ? String(product.stock_quantity) : "0",
    min_stock: product?.min_stock ? String(product.min_stock) : "1",
    is_active: product ? product.is_active : true,
    supplier: product?.supplier || "",
    manufacturer: product?.manufacturer || "",
  })

  useEffect(() => {
    if (activeTab === 'historico' && product?.id) {
      setLoadingHistory(true)
      fetchCollectionWhere<InventoryMovement>("inventory_movements", "product_id", "==", product.id)
        .then(res => setMovements(res.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())))
        .catch(err => console.error(err))
        .finally(() => setLoadingHistory(false))
    }
  }, [activeTab, product?.id])

  // Automatically inactive if stock is 0 and it is currently active. 
  // We apply this on form submission or when stock_quantity changes.
  // Actually, let's just enforce it on save to avoid annoying the user while typing.

  const handleSubmit = async () => {
    if (!form.name.trim()) return
    
    setSaving(true)
    try {
      const stockStr = form.stock_quantity.replace(',', '.')
      const stockVal = parseFloat(stockStr) || 0
      const isAutoInactive = stockVal <= 0

      await onSave({
        name: form.name,
        unit: form.unit,
        cost_price: parseFloat(form.cost_price.replace(',', '.')) || 0,
        sell_price: form.sell_price ? parseFloat(form.sell_price.replace(',', '.')) : null,
        stock_quantity: stockVal, // only really used on creation, or if we want to allow direct edit here (we probably shouldn't allow direct edit of stock for existing products without a movement log, but let's allow it as a fallback, or we just ignore it if `product` exists, usually you adjust via the adjustment modal. Let's pass it anyway and let the parent decide).
        min_stock: parseInt(form.min_stock) || 1,
        is_active: isAutoInactive ? false : form.is_active,
        supplier: form.supplier || null,
        manufacturer: form.manufacturer || null,
      })
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontSize: '0.875rem', outline: 'none' }
  const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.375rem' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', width: '100%', maxWidth: '600px', borderRadius: '1.25rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #0891b2, #22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(8,145,178,0.25)' }}>
              <Package style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>{product ? 'Editar Produto' : 'Novo Produto'}</h2>
              <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>Gerencie os dados do estoque</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', width: '2rem', height: '2rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X style={{ width: '1rem', height: '1rem' }} /></button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 1.5rem' }}>
          <button onClick={() => setActiveTab('geral')} style={{ padding: '1rem 0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', borderBottom: activeTab === 'geral' ? '2px solid #0891b2' : '2px solid transparent', color: activeTab === 'geral' ? '#0891b2' : '#64748b', fontWeight: 600, fontSize: '0.875rem', marginRight: '1.5rem', transition: 'all 0.2s' }}>
            <Package style={{ width: '1rem', height: '1rem' }} /> Geral
          </button>
          <button onClick={() => setActiveTab('fornecedor')} style={{ padding: '1rem 0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', borderBottom: activeTab === 'fornecedor' ? '2px solid #0891b2' : '2px solid transparent', color: activeTab === 'fornecedor' ? '#0891b2' : '#64748b', fontWeight: 600, fontSize: '0.875rem', marginRight: '1.5rem', transition: 'all 0.2s' }}>
            <Truck style={{ width: '1rem', height: '1rem' }} /> Fornecedor
          </button>
          {product && (
            <button onClick={() => setActiveTab('historico')} style={{ padding: '1rem 0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', borderBottom: activeTab === 'historico' ? '2px solid #0891b2' : '2px solid transparent', color: activeTab === 'historico' ? '#0891b2' : '#64748b', fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.2s' }}>
              <Activity style={{ width: '1rem', height: '1rem' }} /> Movimentação
            </button>
          )}
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'geral' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Nome do Produto *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="Ex: Shampoo Anti-Resíduo 1L" />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Unidade de Medida</label>
                  <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={inputStyle}>
                    <option value="un">Unidade (un)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="l">Litros (L)</option>
                    <option value="g">Gramas (g)</option>
                    <option value="kg">Quilogramas (kg)</option>
                    <option value="caixa">Caixa</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.is_active ? "active" : "inactive"} onChange={e => setForm({ ...form, is_active: e.target.value === "active" })} style={inputStyle} disabled={parseFloat(form.stock_quantity) <= 0}>
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                  {parseFloat(form.stock_quantity) <= 0 && <p style={{ fontSize: '0.625rem', color: '#ef4444', marginTop: '0.25rem' }}>Fica inativo automaticamente quando o estoque é zero.</p>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={labelStyle}>Preço de Custo (R$) *</label>
                  <input type="number" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} style={inputStyle} placeholder="0.00" />
                </div>
                <div>
                  <label style={labelStyle}>Preço de Venda (R$)</label>
                  <input type="number" step="0.01" value={form.sell_price} onChange={e => setForm({ ...form, sell_price: e.target.value })} style={inputStyle} placeholder="0.00 (Opcional)" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', background: '#f0fdf4', borderRadius: '0.75rem', border: '1px solid #bbf7d0' }}>
                <div>
                  <label style={labelStyle}>Estoque Inicial</label>
                  <input type="number" step="0.01" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: e.target.value })} style={inputStyle} disabled={!!product} title={product ? "Use o Ajuste de Estoque para alterar a quantidade de um produto existente" : ""} />
                  {product && <p style={{ fontSize: '0.625rem', color: '#16a34a', marginTop: '0.25rem' }}>Para alterar, use o Ajuste de Estoque na listagem.</p>}
                </div>
                <div>
                  <label style={labelStyle}>Estoque Mínimo (Alerta)</label>
                  <input type="number" step="1" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} style={inputStyle} placeholder="1" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'fornecedor' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Fornecedor</label>
                <input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} style={inputStyle} placeholder="Nome do fornecedor ou distribuidor" />
              </div>
              <div>
                <label style={labelStyle}>Fabricante / Marca</label>
                <input type="text" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} style={inputStyle} placeholder="Marca do produto" />
              </div>
            </div>
          )}

          {activeTab === 'historico' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {loadingHistory ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <Loader2 className="w-6 h-6 animate-spin text-[#0891b2]" />
                </div>
              ) : movements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
                  <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Nenhuma movimentação registrada.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {movements.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: m.type === 'in' ? '#ecfdf5' : (m.type === 'out' ? '#fef2f2' : '#f8fafc'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ArrowRightLeft style={{ width: '14px', height: '14px', color: m.type === 'in' ? '#059669' : (m.type === 'out' ? '#ef4444' : '#64748b') }} />
                        </div>
                        <div>
                          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b' }}>
                            {m.type === 'in' ? 'Entrada' : (m.type === 'out' ? 'Saída' : 'Ajuste')} 
                            <span style={{ color: m.type === 'in' ? '#059669' : (m.type === 'out' ? '#ef4444' : '#64748b'), marginLeft: '0.25rem' }}>
                              {m.type === 'out' ? '-' : '+'}{m.quantity} {m.unit}
                            </span>
                          </p>
                          <p style={{ fontSize: '0.6875rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.125rem' }}>
                            <Calendar style={{ width: '10px', height: '10px' }} />
                            {new Date(m.created_at).toLocaleString('pt-BR')}
                            {m.created_by_name && ` • Por: ${m.created_by_name}`}
                          </p>
                          <p style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '0.125rem' }}>
                            <span style={{ fontWeight: 600 }}>Motivo:</span> {m.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#fff' }}>
          <button onClick={onClose} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || (!form.name.trim() && activeTab !== 'historico')} style={{ padding: '0.625rem 1.5rem', borderRadius: '0.75rem', border: 'none', background: 'linear-gradient(135deg, #0891b2, #22d3ee)', color: '#fff', fontWeight: 700, cursor: saving || (!form.name.trim() && activeTab !== 'historico') ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(8,145,178,0.3)' }}>
            {saving && <Loader2 style={{ width: '1rem', height: '1rem' }} className="animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar Produto'}
          </button>
        </div>

      </div>
    </div>
  )
}
