"use client"

import { useState, useMemo } from "react"
import type { Category, Service } from "@/lib/types/database"
import { formatCurrency } from "@/lib/utils"
import { Clock, ArrowRight, Search, Sparkles, ChevronDown } from "lucide-react"

interface Props {
  categories: Category[]
  services: Service[]
  selectedService: Service | null
  selectedCategory: Category | null
  onSelect: (service: Service, category: Category | null) => void
  onNext: () => void
}

const PAGE_SIZE = 9

export function ServiceSelection({ categories, services, selectedService, selectedCategory, onSelect, onNext }: Props) {
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("todos")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const servicesByCategory = useMemo(() => {
    const m = new Map<string, Service[]>()
    services.forEach(s => { const c = s.category_id || "geral"; if (!m.has(c)) m.set(c, []); m.get(c)!.push(s) })
    return m
  }, [services])

  const getCatName = (id: string) => id === "geral" ? "Geral" : categories.find(c => c.id === id)?.name || "Outros"

  const filtered = useMemo(() => {
    let l = services
    if (search) l = l.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    else if (activeTab !== "todos") l = l.filter(s => (s.category_id || "geral") === activeTab)
    return l
  }, [services, search, activeTab])

  const tabs = [{ id: "todos", label: "Todos" }, ...Array.from(servicesByCategory.keys()).map(k => ({ id: k, label: getCatName(k) }))]
  const visible = search ? filtered : filtered.slice(0, visibleCount)
  const hasMore = !search && filtered.length > visibleCount

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.125rem, 3vw, 1.375rem)', fontWeight: 700, textAlign: 'center', color: '#1e1e2d', marginBottom: '0.25rem' }}>
        Escolha o Serviço
      </h2>
      <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: '#8b8fa7', marginBottom: '1.25rem' }}>
        Selecione o serviço que deseja agendar
      </p>

      {/* Search + Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#8b8fa7' }} />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE) }}
            placeholder="Buscar serviço..."
            style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: '1rem', paddingTop: '0.6875rem', paddingBottom: '0.6875rem', borderRadius: '0.75rem', border: '2px solid #e8ecf4', background: '#fafbfc', fontSize: '0.875rem', fontWeight: 500, color: '#1e1e2d', outline: 'none', minHeight: '44px' }} />
        </div>
        {servicesByCategory.size > 1 && (
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch(""); setVisibleCount(PAGE_SIZE) }}
                style={{ padding: '0.4375rem 0.875rem', borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap', minHeight: '36px', background: activeTab === tab.id ? '#7c5cfc' : '#f1f3f9', color: activeTab === tab.id ? '#fff' : '#8b8fa7', boxShadow: activeTab === tab.id ? '0 2px 8px rgba(124,92,252,0.25)' : 'none' }}>
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid — 1col mobile, 2col tablet, 3col desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '0.75rem' }}>
        {visible.map(service => {
          const sel = selectedService?.id === service.id
          const promo = service.promotional_price && service.promotional_price < service.price
          return (
            <button key={service.id} onClick={() => { const cat = categories.find(c => c.id === service.category_id) || null; onSelect(service, cat) }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s ease', width: '100%', minHeight: '80px', border: sel ? '2px solid #7c5cfc' : '2px solid #e8ecf4', background: sel ? '#f0ecff' : '#fff', boxShadow: sel ? '0 4px 16px rgba(124,92,252,0.12)' : '0 1px 3px rgba(0,0,0,0.03)' }}>
              {service.image_url ? (
                <img src={service.image_url} alt={service.name} style={{ width: '64px', height: '64px', borderRadius: '0.5rem', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '64px', height: '64px', borderRadius: '0.5rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff', fontSize: '1.375rem', fontWeight: 700 }}>
                  {service.name.charAt(0)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <p style={{ fontWeight: 700, color: '#1e1e2d', fontSize: '0.875rem', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{service.name}</p>
                {service.description && <p style={{ fontSize: '0.6875rem', color: '#8b8fa7', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '0.125rem' }}>{service.description}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  {promo ? (<>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#22c997' }}>{formatCurrency(service.promotional_price!)}</span>
                    <span style={{ fontSize: '0.6875rem', color: '#8b8fa7', textDecoration: 'line-through' }}>{formatCurrency(service.price)}</span>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#22c997', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Sparkles style={{ width: '10px', height: '10px' }} />Promoção</span>
                  </>) : (
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#7c5cfc' }}>{formatCurrency(service.price)}</span>
                  )}
                  <span style={{ fontSize: '0.6875rem', color: '#8b8fa7', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Clock style={{ width: '11px', height: '11px' }} />{service.duration_minutes}min</span>
                </div>
              </div>
              {sel && <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#7c5cfc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} /></div>}
            </button>
          )
        })}
      </div>

      {!visible.length && <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#8b8fa7' }}><Search style={{ width: '1.5rem', height: '1.5rem', margin: '0 auto 0.5rem', opacity: 0.4 }} /><p style={{ fontWeight: 600, fontSize: '0.875rem' }}>Nenhum serviço encontrado</p></div>}

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          <button onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1.25rem', borderRadius: '2rem', border: '2px solid #e8ecf4', background: '#fff', color: '#6b7280', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px' }}>
            <ChevronDown style={{ width: '14px', height: '14px' }} /> Ver mais ({filtered.length - visibleCount})
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.75rem' }}>
        <button onClick={onNext} disabled={!selectedService}
          style={{ padding: '0.875rem 2.5rem', borderRadius: '0.75rem', fontSize: '0.9375rem', fontWeight: 700, border: 'none', cursor: selectedService ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: selectedService ? '#7c5cfc' : '#d1d5db', color: '#fff', boxShadow: selectedService ? '0 4px 14px rgba(124,92,252,0.25)' : 'none', transition: 'all 0.2s', minHeight: '48px', minWidth: '200px', justifyContent: 'center' }}>
          Continuar <ArrowRight style={{ width: '16px', height: '16px' }} />
        </button>
      </div>
    </div>
  )
}
