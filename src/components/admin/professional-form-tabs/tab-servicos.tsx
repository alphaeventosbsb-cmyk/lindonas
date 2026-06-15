"use client"
import type { Service, Category, EmployeeProfessionalService } from "@/lib/types/database"
import { formatCurrency } from "@/lib/utils"
import { normalizeSearchText } from "@/lib/search"
import { Search, Clock, DollarSign, Percent, Filter } from "lucide-react"
import { useState, useMemo } from "react"

const inputStyle: React.CSSProperties = {
  padding: '0.375rem 0.5rem', borderRadius: '0.5rem', border: '2px solid #e2e8f0',
  backgroundColor: '#fff', color: '#1e1e2d', fontSize: '0.75rem', fontWeight: 500, outline: 'none', width: '100%',
}

interface Props {
  services: Service[]
  categories: Category[]
  serviceIds: string[]
  professionalServices: EmployeeProfessionalService[]
  onChangeServiceIds: (ids: string[]) => void
  onChangeProfessionalServices: (ps: EmployeeProfessionalService[]) => void
}

export function TabServicos({ services, categories, serviceIds, professionalServices, onChangeServiceIds, onChangeProfessionalServices }: Props) {
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')

  const searchNormalized = normalizeSearchText(search)

  // Build a map of category_id -> category name for display in empty states
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cat of categories) {
      map.set(cat.id, cat.name)
    }
    return map
  }, [categories])

  // Sort categories alphabetically for the dropdown
  const sortedCategories = useMemo(() => {
    return [...categories]
      .filter(c => c.is_active !== false)
      .sort((a, b) => normalizeSearchText(a.name).localeCompare(normalizeSearchText(b.name)))
  }, [categories])

  // Filter by category first, then by search
  const filtered = useMemo(() => {
    return services.filter(s => {
      // Category filter
      if (selectedCategoryId) {
        if ((s.category_id || '') !== selectedCategoryId) return false
      }

      // Search filter
      if (!searchNormalized) return true

      const searchableFields = [
        s.name,
        s.description,
        s.service_code,
        (s as any).category,
        (s as any).category_name,
        (s as any).category?.name
      ]

      const combinedText = searchableFields
        .filter(Boolean)
        .map(v => normalizeSearchText(String(v)))
        .join(" ")

      return combinedText.includes(searchNormalized)
    })
  }, [services, selectedCategoryId, searchNormalized])

  // Count selected within current visible list
  const selectedInView = filtered.filter(s => serviceIds.includes(s.id)).length

  const isEnabled = (sid: string) => serviceIds.includes(sid)

  const toggleService = (sid: string) => {
    let nextIds: string[]
    let nextPS = [...professionalServices]
    if (isEnabled(sid)) {
      nextIds = serviceIds.filter(id => id !== sid)
      nextPS = nextPS.filter(ps => ps.serviceId !== sid)
    } else {
      nextIds = [...serviceIds, sid]
      if (!nextPS.find(ps => ps.serviceId === sid)) {
        nextPS.push({ serviceId: sid, enabled: true })
      }
    }
    onChangeServiceIds(nextIds)
    onChangeProfessionalServices(nextPS)
  }

  const updatePS = (sid: string, field: string, val: any) => {
    let nextPS = [...professionalServices]
    const idx = nextPS.findIndex(ps => ps.serviceId === sid)
    if (idx >= 0) {
      nextPS[idx] = { ...nextPS[idx], [field]: val }
    } else {
      nextPS.push({ serviceId: sid, enabled: true, [field]: val })
    }
    onChangeProfessionalServices(nextPS)
  }

  const getPS = (sid: string) => professionalServices.find(ps => ps.serviceId === sid)

  // Todos: select all visible (filtered) services, preserving selections from other categories
  const selectAll = () => {
    const visibleIds = new Set(filtered.map(s => s.id))
    // Merge: keep existing selections + add all visible
    const merged = new Set([...serviceIds, ...visibleIds])
    const nextIds = Array.from(merged)
    // Also create professional_services entries for newly added
    const nextPS = [...professionalServices]
    for (const sid of visibleIds) {
      if (!nextPS.find(ps => ps.serviceId === sid)) {
        nextPS.push({ serviceId: sid, enabled: true })
      }
    }
    onChangeServiceIds(nextIds)
    onChangeProfessionalServices(nextPS)
  }

  // Nenhum: deselect only visible (filtered) services, preserving selections from other categories
  const selectNone = () => {
    const visibleIds = new Set(filtered.map(s => s.id))
    const nextIds = serviceIds.filter(id => !visibleIds.has(id))
    const nextPS = professionalServices.filter(ps => !visibleIds.has(ps.serviceId))
    onChangeServiceIds(nextIds)
    onChangeProfessionalServices(nextPS)
  }

  // Build empty state message
  const getEmptyMessage = () => {
    if (selectedCategoryId && searchNormalized) {
      return 'Nenhum serviço encontrado para esta busca.'
    }
    if (selectedCategoryId) {
      return 'Nenhum serviço encontrado nesta categoria.'
    }
    return 'Nenhum serviço encontrado para esta busca.'
  }

  // Counter label
  const counterLabel = (() => {
    if (selectedCategoryId || searchNormalized) {
      return `${selectedInView} de ${filtered.length} selecionados nesta visualização · ${serviceIds.length} total`
    }
    return `${serviceIds.length} de ${services.length} selecionados`
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d' }}>Serviços</p>
          <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>{counterLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <button type="button" onClick={selectAll} style={{ fontSize: '0.625rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', background: '#f0ecff', color: '#7c5cfc', cursor: 'pointer', fontWeight: 600 }}>Todos</button>
          <button type="button" onClick={selectNone} style={{ fontSize: '0.625rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>Nenhum</button>
        </div>
      </div>

      {/* Search + Category Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar serviço..."
            style={{ ...inputStyle, paddingLeft: '2rem' }} />
        </div>

        {/* Category Filter */}
        <div style={{ position: 'relative', minWidth: '180px', maxWidth: '220px' }}>
          <Filter style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: selectedCategoryId ? '#7c5cfc' : '#9ca3af', transition: 'color 0.15s' }} />
          <select
            value={selectedCategoryId}
            onChange={e => setSelectedCategoryId(e.target.value)}
            style={{
              ...inputStyle,
              paddingLeft: '1.625rem',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.5rem center',
              paddingRight: '1.5rem',
              cursor: 'pointer',
              borderColor: selectedCategoryId ? '#c4b5fd' : '#e2e8f0',
              backgroundColor: selectedCategoryId ? '#faf8ff' : '#fff',
              transition: 'all 0.15s',
            }}
          >
            <option value="">Todas as categorias</option>
            {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Active category badge */}
      {selectedCategoryId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{
            fontSize: '0.625rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '999px',
            background: '#f0ecff', color: '#7c5cfc', border: '1px solid #e0d4ff',
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
          }}>
            Categoria: {categoryMap.get(selectedCategoryId) || 'Desconhecida'}
            <button
              type="button"
              onClick={() => setSelectedCategoryId('')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '0 0.125rem',
                color: '#7c5cfc', fontSize: '0.75rem', fontWeight: 800, lineHeight: 1,
                display: 'flex', alignItems: 'center',
              }}
              title="Limpar filtro"
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* Service list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: '20rem', overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', padding: '1.5rem' }}>{getEmptyMessage()}</p>
        )}
        {filtered.map(svc => {
          const enabled = isEnabled(svc.id)
          const expanded = expandedId === svc.id && enabled
          const ps = getPS(svc.id)
          // Show category name subtly on each service when not filtering by category
          const catName = svc.category_id ? categoryMap.get(svc.category_id) : null
          return (
            <div key={svc.id} style={{
              flexShrink: 0,
              borderRadius: '0.625rem', overflow: 'hidden',
              border: enabled ? '1px solid #e0d4ff' : '1px solid #f1f3f9',
              background: enabled ? '#faf8ff' : '#fafbfc', transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', cursor: 'pointer' }}
                onClick={() => toggleService(svc.id)}>
                <div style={{
                  width: '1.25rem', height: '1.25rem', borderRadius: '0.25rem', flexShrink: 0,
                  border: enabled ? '2px solid #7c5cfc' : '2px solid #d1d5db',
                  background: enabled ? '#7c5cfc' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {enabled && <span style={{ color: '#fff', fontSize: '0.625rem', fontWeight: 800 }}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: enabled ? '#1e1e2d' : '#6b7280' }}>{svc.name}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.625rem', color: '#9ca3af', alignItems: 'center' }}>
                    <span>{formatCurrency(svc.price)}</span>
                    <span>·</span>
                    <span>{svc.duration_minutes}min</span>
                    {!selectedCategoryId && catName && (
                      <>
                        <span>·</span>
                        <span style={{ color: '#a78bfa', fontWeight: 500 }}>{catName}</span>
                      </>
                    )}
                  </div>
                </div>
                {enabled && (
                  <button type="button" onClick={e => { e.stopPropagation(); setExpandedId(expanded ? null : svc.id) }}
                    style={{ fontSize: '0.5625rem', padding: '0.25rem 0.375rem', borderRadius: '0.25rem', border: '1px solid #e0d4ff', background: '#f0ecff', color: '#7c5cfc', cursor: 'pointer', fontWeight: 600 }}>
                    {expanded ? 'Fechar' : 'Personalizar'}
                  </button>
                )}
              </div>
              {expanded && (
                <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid #f1f3f9', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.5625rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.125rem' }}>
                      <Clock style={{ width: '10px', height: '10px' }} /> Duração
                    </label>
                    <input type="number" placeholder={String(svc.duration_minutes)} value={ps?.customDuration ?? ''}
                      onChange={e => updatePS(svc.id, 'customDuration', e.target.value ? parseInt(e.target.value) : null)}
                      style={{ ...inputStyle, fontSize: '0.6875rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.5625rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.125rem' }}>
                      <DollarSign style={{ width: '10px', height: '10px' }} /> Preço
                    </label>
                    <input type="number" step="0.01" placeholder={String(svc.price)} value={ps?.customPrice ?? ''}
                      onChange={e => updatePS(svc.id, 'customPrice', e.target.value ? parseFloat(e.target.value) : null)}
                      style={{ ...inputStyle, fontSize: '0.6875rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.5625rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.125rem' }}>
                      <Percent style={{ width: '10px', height: '10px' }} /> Comissão
                    </label>
                    <input type="number" min="0" max="100" placeholder="%" value={ps?.customCommission ?? ''}
                      onChange={e => updatePS(svc.id, 'customCommission', e.target.value ? parseInt(e.target.value) : null)}
                      style={{ ...inputStyle, fontSize: '0.6875rem' }} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
