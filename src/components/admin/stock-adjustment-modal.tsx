"use client"

import { useState } from "react"
import { X, ArrowRightLeft, Loader2, ArrowUpRight, ArrowDownRight, RefreshCcw } from "lucide-react"
import type { Product } from "@/lib/types/database"

interface StockAdjustmentModalProps {
  product: Product
  onClose: () => void
  onSave: (data: { type: "in" | "out" | "adjustment", quantity: number, reason: string }) => Promise<void>
}

export function StockAdjustmentModal({ product, onClose, onSave }: StockAdjustmentModalProps) {
  const [type, setType] = useState<"in" | "out" | "adjustment">("in")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    const q = parseFloat(quantity)
    if (!q || q <= 0) return
    if (!reason.trim()) return

    setSaving(true)
    try {
      await onSave({ type, quantity: q, reason })
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontSize: '0.875rem', outline: 'none' }
  const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.375rem' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '1.25rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowRightLeft style={{ width: '1.25rem', height: '1.25rem', color: '#64748b' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>Ajuste de Estoque</h2>
              <p style={{ fontSize: '0.8125rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{product.name}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', width: '2rem', height: '2rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X style={{ width: '1rem', height: '1rem' }} /></button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4b5563' }}>Estoque Atual:</span>
            <span style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1e293b' }}>{product.stock_quantity} <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>{product.unit}</span></span>
          </div>

          <div>
            <label style={labelStyle}>Tipo de Movimento</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <button onClick={() => setType('in')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', padding: '0.75rem 0.5rem', borderRadius: '0.5rem', border: type === 'in' ? '2px solid #10b981' : '1px solid #e2e8f0', background: type === 'in' ? '#ecfdf5' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                <ArrowUpRight style={{ width: '1.25rem', height: '1.25rem', color: type === 'in' ? '#10b981' : '#94a3b8' }} />
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: type === 'in' ? '#10b981' : '#64748b' }}>Entrada</span>
              </button>
              <button onClick={() => setType('out')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', padding: '0.75rem 0.5rem', borderRadius: '0.5rem', border: type === 'out' ? '2px solid #ef4444' : '1px solid #e2e8f0', background: type === 'out' ? '#fef2f2' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                <ArrowDownRight style={{ width: '1.25rem', height: '1.25rem', color: type === 'out' ? '#ef4444' : '#94a3b8' }} />
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: type === 'out' ? '#ef4444' : '#64748b' }}>Saída</span>
              </button>
              <button onClick={() => setType('adjustment')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', padding: '0.75rem 0.5rem', borderRadius: '0.5rem', border: type === 'adjustment' ? '2px solid #f59e0b' : '1px solid #e2e8f0', background: type === 'adjustment' ? '#fffbeb' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                <RefreshCcw style={{ width: '1.25rem', height: '1.25rem', color: type === 'adjustment' ? '#f59e0b' : '#94a3b8' }} />
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: type === 'adjustment' ? '#f59e0b' : '#64748b' }}>Balanço</span>
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Quantidade</label>
            <div style={{ position: 'relative' }}>
              <input type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} style={{ ...inputStyle, paddingRight: '3rem', fontSize: '1.125rem', fontWeight: 600 }} placeholder="0" />
              <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 600 }}>{product.unit}</span>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Motivo / Observação *</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} style={inputStyle} placeholder={type === 'in' ? "Ex: Compra fornecedor X" : (type === 'out' ? "Ex: Uso interno / Descarte" : "Ex: Contagem de inventário")} />
          </div>

          {/* Preview */}
          {quantity && parseFloat(quantity) > 0 && (
            <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Novo Saldo:</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: type === 'in' ? '#059669' : (type === 'out' ? '#dc2626' : '#d97706') }}>
                {type === 'in' 
                  ? product.stock_quantity + parseFloat(quantity)
                  : (type === 'out' 
                    ? Math.max(0, product.stock_quantity - parseFloat(quantity))
                    : parseFloat(quantity) // adjustment overrides stock
                  )} {product.unit}
              </span>
            </div>
          )}
        </div>

        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#fff' }}>
          <button onClick={onClose} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || !quantity || parseFloat(quantity) <= 0 || !reason.trim()} style={{ padding: '0.625rem 1.5rem', borderRadius: '0.75rem', border: 'none', background: '#1e293b', color: '#fff', fontWeight: 700, cursor: saving || !quantity || parseFloat(quantity) <= 0 || !reason.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 10px rgba(30,41,59,0.2)' }}>
            {saving && <Loader2 style={{ width: '1rem', height: '1rem' }} className="animate-spin" />}
            Confirmar
          </button>
        </div>

      </div>
    </div>
  )
}
