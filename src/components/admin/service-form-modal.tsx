"use client"

import { useState, useRef, useEffect } from "react"
import { uploadToCloudinary } from "@/lib/cloudinary"
import type { Service, Category, Product, ServiceProduct } from "@/lib/types/database"
import { Loader2, X, Image as ImageIcon, Plus, Trash2, Tag, Percent, Scissors, CircleDollarSign, PackageSearch } from "lucide-react"
import { toast } from "sonner"
import { fetchCollectionWhere, fetchCollection } from "@/lib/firebase/client-utils"
import { useTenant } from "@/lib/auth/tenant-context"

interface ServiceFormModalProps {
  service: Service | null
  categories: Category[]
  allServices: Service[] // For 'standard_service_id' select
  allProducts: any[] // From parent
  onClose: () => void
  onSave: (serviceData: any, photoFile: File | null, oldPhotoUrl: string | null, serviceProducts: any[]) => Promise<void>
}

const PREDEFINED_COLORS = [
  "#7c5cfc", "#a78bfa", "#22c997", "#5ee0b8", "#5b8def", "#93b5f5", 
  "#ffb547", "#ffd08a", "#f25c5c", "#f78888", "#e879a0", "#f0a5bd",
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"
]

export function ServiceFormModal({ service, categories, allServices, allProducts, onClose, onSave }: ServiceFormModalProps) {
  const { saasUser, companyId } = useTenant()
  
  // Basic Fields
  const [form, setForm] = useState({
    name: service?.name || "",
    description: service?.description || "",
    service_code: service?.service_code || "",
    category_id: service?.category_id || "",
    standard_service_id: service?.standard_service_id || "",
    price: service?.price !== undefined ? String(service.price) : "",
    price_type: service?.price_type || "fixed",
    duration_minutes: service?.duration_minutes || 60,
    is_active: service ? service.is_active : true,
    color_hex: service?.color_hex || "",
    hide_from_online_booking: service?.hide_from_online_booking || false,
    
    // Promo
    promotional_price: service?.promotional_price !== null && service?.promotional_price !== undefined ? String(service.promotional_price) : "",
    promotion_start_date: service?.promotion_start_date || "",
    promotion_end_date: service?.promotion_end_date || "",
    promotion_notes: service?.promotion_notes || "",
    
    // Costs
    product_average_cost: service?.product_average_cost !== null && service?.product_average_cost !== undefined ? String(service.product_average_cost) : "",
    professional_product_average_cost: service?.professional_product_average_cost !== null && service?.professional_product_average_cost !== undefined ? String(service.professional_product_average_cost) : "",
    disposable_expenses: service?.disposable_expenses !== null && service?.disposable_expenses !== undefined ? String(service.disposable_expenses) : "",
    establishment_operational_cost: service?.establishment_operational_cost !== null && service?.establishment_operational_cost !== undefined ? String(service.establishment_operational_cost) : "",
    professional_operational_cost: service?.professional_operational_cost !== null && service?.professional_operational_cost !== undefined ? String(service.professional_operational_cost) : "",
  })

  // State for image
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(service?.image_url || null)
  const [oldPhotoUrl, setOldPhotoUrl] = useState<string | null>(service?.image_url || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Use products from props, filtering by company_id if needed, allowing legacy products without company_id
  const products = allProducts?.filter(p => !p.company_id || p.company_id === companyId) || []

  const [serviceProducts, setServiceProducts] = useState<Partial<ServiceProduct>[]>([])
  
  const [saving, setSaving] = useState(false)
  const [showPromo, setShowPromo] = useState(!!service?.promotional_price)
  const [showCosts, setShowCosts] = useState(false)

  useEffect(() => {
    // Load service_products
    if (companyId && service) {
      fetchCollectionWhere<ServiceProduct>("service_products", "service_id", "==", service.id)
        .then(res => setServiceProducts(res.map(sp => ({ ...sp, id: sp.id || Math.random().toString() }))))
        .catch(err => console.error("Error loading service products:", err))
    }
  }, [companyId, service])

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        toast.error("Imagem muito grande. O limite é 4MB.")
        return
      }
      setPhotoFile(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const addServiceProduct = () => {
    setServiceProducts([
      ...serviceProducts, 
      { id: Math.random().toString(), product_id: "", quantity: 1, unit: "unidade", add_to_total_mode: "none", cost_snapshot: 0 }
    ])
  }

  const removeServiceProduct = (idx: number) => {
    const next = [...serviceProducts]
    next.splice(idx, 1)
    setServiceProducts(next)
  }

  const updateServiceProduct = (idx: number, field: keyof ServiceProduct, value: any) => {
    const next = [...serviceProducts]
    next[idx] = { ...next[idx], [field]: value }
    setServiceProducts(next)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("O nome do serviço é obrigatório.")
    if (!form.price) return toast.error("O preço do serviço é obrigatório.")
    
    // Validate products
    for (let i = 0; i < serviceProducts.length; i++) {
      const sp = serviceProducts[i]
      if (!sp.product_id) {
        return toast.error("Por favor, selecione um produto em todas as linhas de estoque, ou remova a linha vazia.")
      }
      if (!sp.quantity || sp.quantity <= 0) {
        return toast.error("A quantidade do produto deve ser maior que zero.")
      }
    }

    setSaving(true)
    try {
      const dataToSave = {
        name: form.name,
        description: form.description || null,
        service_code: form.service_code || null,
        category_id: form.category_id || null,
        standard_service_id: form.standard_service_id || null,
        price: parseFloat(form.price),
        price_type: form.price_type || null,
        duration_minutes: parseInt(String(form.duration_minutes), 10) || 60,
        is_active: form.is_active,
        color_hex: form.color_hex || null,
        hide_from_online_booking: form.hide_from_online_booking,
        
        promotional_price: form.promotional_price && showPromo ? parseFloat(form.promotional_price) : null,
        promotion_start_date: showPromo && form.promotion_start_date ? form.promotion_start_date : null,
        promotion_end_date: showPromo && form.promotion_end_date ? form.promotion_end_date : null,
        promotion_notes: showPromo && form.promotion_notes ? form.promotion_notes : null,
        
        product_average_cost: form.product_average_cost ? parseFloat(form.product_average_cost) : null,
        professional_product_average_cost: form.professional_product_average_cost ? parseFloat(form.professional_product_average_cost) : null,
        disposable_expenses: form.disposable_expenses ? parseFloat(form.disposable_expenses) : null,
        establishment_operational_cost: form.establishment_operational_cost ? parseFloat(form.establishment_operational_cost) : null,
        professional_operational_cost: form.professional_operational_cost ? parseFloat(form.professional_operational_cost) : null,
        image_url: preview, // Note: This will be updated inside onSave if a new photo is uploaded
        company_id: companyId,
      }
      
      await onSave(dataToSave, photoFile, oldPhotoUrl, serviceProducts)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.375rem' }
  const inputStyle = { width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontSize: '0.875rem', outline: 'none' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', width: '100%', maxWidth: '800px', borderRadius: '1.25rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '95vh', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(124,92,252,0.25)' }}>
              <Scissors style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>{service ? 'Editar Serviço' : 'Novo Serviço'}</h2>
              <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>Configure os detalhes e regras do serviço</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', width: '2rem', height: '2rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X style={{ width: '1rem', height: '1rem' }} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            
            {/* Left Column (Main data) */}
            <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Nome do serviço *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="Ex: Escova Progressiva" />
                </div>
                <div>
                  <label style={labelStyle}>Categoria</label>
                  <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} style={inputStyle}>
                    <option value="">Sem categoria</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Serviço Padrão (Agrupamento)</label>
                  <select value={form.standard_service_id} onChange={e => setForm({ ...form, standard_service_id: e.target.value })} style={inputStyle}>
                    <option value="">Sem vínculo</option>
                    {allServices.filter(s => s.id !== service?.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Código de identificação</label>
                  <input type="text" value={form.service_code} onChange={e => setForm({ ...form, service_code: e.target.value })} style={inputStyle} placeholder="Opcional" />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Descrição <span style={{ float: 'right', fontWeight: 400, color: form.description.length > 450 ? '#ef4444' : '#9ca3af' }}>{form.description.length}/450 caracteres</span></label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value.slice(0, 450) })} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} placeholder="Descreva os detalhes deste serviço..." />
              </div>

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Tipo de Preço</label>
                  <select value={form.price_type} onChange={e => setForm({ ...form, price_type: e.target.value as any })} style={inputStyle}>
                    <option value="fixed">Preço Fixo</option>
                    <option value="starting_at">A partir de</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Preço Padrão (R$) *</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={inputStyle} placeholder="0.00" />
                </div>
                <div>
                  <label style={labelStyle}>Duração (min) *</label>
                  <input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} style={inputStyle} placeholder="60" />
                </div>
              </div>

            </div>

            {/* Right Column (Photo & Visibility) */}
            <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Photo Upload */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <label style={labelStyle}>Foto do Serviço</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ width: '4.5rem', height: '4.5rem', borderRadius: '0.5rem', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fff', flexShrink: 0 }}>
                    {preview ? <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon style={{ width: '1.5rem', height: '1.5rem', color: '#94a3b8' }} />}
                  </div>
                  <div>
                    <input type="file" ref={fileInputRef} onChange={handlePhotoSelect} accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} />
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <button onClick={() => fileInputRef.current?.click()} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Trocar Foto</button>
                      {preview && <button onClick={handleRemovePhoto} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #fecaca', background: '#fef2f2', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: '#dc2626' }}>Remover</button>}
                    </div>
                    <p style={{ fontSize: '0.625rem', color: '#94a3b8' }}>Formatos: jpg, png, webp. Máx: 4MB.</p>
                  </div>
                </div>
              </div>

              {/* Status & Online */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Status do Serviço</label>
                  <select value={form.is_active ? "active" : "inactive"} onChange={e => setForm({ ...form, is_active: e.target.value === "active" })} style={inputStyle}>
                    <option value="active">Ativo (visível e agendável)</option>
                    <option value="inactive">Inativo (oculto)</option>
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.hide_from_online_booking} onChange={e => setForm({ ...form, hide_from_online_booking: e.target.checked })} style={{ marginTop: '0.125rem' }} />
                  <span style={{ fontSize: '0.8125rem', color: '#4b5563', lineHeight: 1.4 }}>Não exibir esse serviço no Site, Aplicativo, Reserve ou Autoatendimento</span>
                </label>
              </div>

              {/* Color Picker */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <label style={labelStyle}>Cor do Serviço (Identificação visual)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button onClick={() => setForm({ ...form, color_hex: "" })} style={{ width: '1.5rem', height: '1.5rem', borderRadius: '50%', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {!form.color_hex && <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: '#64748b' }} />}
                  </button>
                  {PREDEFINED_COLORS.map(color => (
                    <button key={color} onClick={() => setForm({ ...form, color_hex: color })} style={{ width: '1.5rem', height: '1.5rem', borderRadius: '50%', border: form.color_hex === color ? `2px solid #1e293b` : 'none', background: color, cursor: 'pointer', transform: form.color_hex === color ? 'scale(1.1)' : 'scale(1)' }} />
                  ))}
                </div>
              </div>

            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '2rem 0' }} />

          {/* STOCK / PRODUCTS */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><PackageSearch style={{ width: '1rem', height: '1rem', color: '#7c5cfc' }} /> Saída automática no estoque</h3>
            <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '1rem' }}>Os produtos vinculados aqui serão baixados do estoque automaticamente quando o agendamento for fechado e pago.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {serviceProducts.map((sp, idx) => (
                <div key={sp.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Produto</label>
                    <select value={sp.product_id} onChange={e => updateServiceProduct(idx, "product_id", e.target.value)} style={{ ...inputStyle, padding: '0.375rem 0.5rem' }}>
                      <option value="">Selecione...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                    </select>
                  </div>
                  <div style={{ width: '4rem' }}>
                    <label style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Qtd</label>
                    <input type="number" step="0.1" value={sp.quantity} onChange={e => updateServiceProduct(idx, "quantity", Number(e.target.value))} style={{ ...inputStyle, padding: '0.375rem 0.5rem' }} />
                  </div>
                  <div style={{ flex: 1.5 }}>
                    <label style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Adicionar ao Total</label>
                    <select value={sp.add_to_total_mode} onChange={e => updateServiceProduct(idx, "add_to_total_mode", e.target.value)} style={{ ...inputStyle, padding: '0.375rem 0.5rem' }}>
                      <option value="none">Não adicionar</option>
                      <option value="add_cost">Add Custo (repassar)</option>
                    </select>
                  </div>
                  <div style={{ width: '2rem', display: 'flex', alignItems: 'flex-end', paddingBottom: '0.375rem' }}>
                    <button onClick={() => removeServiceProduct(idx)} style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.375rem', border: 'none', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash2 style={{ width: '0.875rem', height: '0.875rem' }} /></button>
                  </div>
                </div>
              ))}
              
              <button onClick={addServiceProduct} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px dashed #cbd5e1', background: '#fff', color: '#4b5563', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                <Plus style={{ width: '1rem', height: '1rem' }} /> Adicionar produto associado
              </button>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '2rem 0' }} />

          {/* PROMOTION */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Percent style={{ width: '1rem', height: '1rem', color: '#ea580c' }} /> Promoção</h3>
              {!showPromo && <button onClick={() => setShowPromo(true)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', background: '#ea580c', color: '#fff', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Incluir promoção</button>}
            </div>
            
            {showPromo && (
              <div style={{ background: '#fff7ed', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #fdba74', position: 'relative' }}>
                <button onClick={() => { setShowPromo(false); setForm({ ...form, promotional_price: "", promotion_start_date: "", promotion_end_date: "", promotion_notes: "" }) }} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', width: '1.5rem', height: '1.5rem', borderRadius: '50%', border: 'none', background: 'transparent', color: '#ea580c', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X style={{ width: '1rem', height: '1rem' }} /></button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ ...labelStyle, color: '#c2410c' }}>Preço Promocional (R$)</label>
                    <input type="number" step="0.01" value={form.promotional_price} onChange={e => setForm({ ...form, promotional_price: e.target.value })} style={{ ...inputStyle, borderColor: '#fdba74' }} placeholder="0.00" />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#c2410c' }}>Data Início</label>
                    <input type="date" value={form.promotion_start_date} onChange={e => setForm({ ...form, promotion_start_date: e.target.value })} style={{ ...inputStyle, borderColor: '#fdba74' }} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#c2410c' }}>Data Fim</label>
                    <input type="date" value={form.promotion_end_date} onChange={e => setForm({ ...form, promotion_end_date: e.target.value })} style={{ ...inputStyle, borderColor: '#fdba74' }} />
                  </div>
                </div>
                <div>
                  <label style={{ ...labelStyle, color: '#c2410c' }}>Observação da Promoção</label>
                  <input type="text" value={form.promotion_notes} onChange={e => setForm({ ...form, promotion_notes: e.target.value })} style={{ ...inputStyle, borderColor: '#fdba74' }} placeholder="Ex: Black Friday" />
                </div>
              </div>
            )}
          </div>

          {/* COSTS (Collapsible) */}
          <div style={{ background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <button onClick={() => setShowCosts(!showCosts)} style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#1e293b' }}>
                <CircleDollarSign style={{ width: '1rem', height: '1rem', color: '#64748b' }} /> Custos e Operação (Avançado)
              </div>
              <span style={{ fontSize: '0.8125rem', color: '#7c5cfc', fontWeight: 600 }}>{showCosts ? 'Ocultar' : 'Mostrar'}</span>
            </button>
            {showCosts && (
              <div style={{ padding: '0 1rem 1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div><label style={labelStyle}>Custo Médio Prod. (R$)</label><input type="number" step="0.01" value={form.product_average_cost} onChange={e => setForm({ ...form, product_average_cost: e.target.value })} style={inputStyle} placeholder="0.00" /></div>
                <div><label style={labelStyle}>Custo Médio Prod. Profissional (R$)</label><input type="number" step="0.01" value={form.professional_product_average_cost} onChange={e => setForm({ ...form, professional_product_average_cost: e.target.value })} style={inputStyle} placeholder="0.00" /></div>
                <div><label style={labelStyle}>Descartáveis e Outras Despesas (R$)</label><input type="number" step="0.01" value={form.disposable_expenses} onChange={e => setForm({ ...form, disposable_expenses: e.target.value })} style={inputStyle} placeholder="0.00" /></div>
                <div><label style={labelStyle}>Custo Op. Estabelecimento (R$)</label><input type="number" step="0.01" value={form.establishment_operational_cost} onChange={e => setForm({ ...form, establishment_operational_cost: e.target.value })} style={inputStyle} placeholder="0.00" /></div>
                <div><label style={labelStyle}>Custo Op. Profissional (R$)</label><input type="number" step="0.01" value={form.professional_operational_cost} onChange={e => setForm({ ...form, professional_operational_cost: e.target.value })} style={inputStyle} placeholder="0.00" /></div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#fff' }}>
          <button onClick={onClose} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '0.625rem 1.5rem', borderRadius: '0.75rem', border: 'none', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(124,92,252,0.3)' }}>
            {saving && <Loader2 style={{ width: '1rem', height: '1rem' }} className="animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar Serviço'}
          </button>
        </div>
      </div>
    </div>
  )
}
