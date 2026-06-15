"use client"

import { useState, useMemo } from "react"
import { useAgendaStore } from "./agenda-store"
import { Search, Scissors, Sparkles, Hand, Eye, Tag, Grid } from "lucide-react"

function getCategoryIcon(name: string) {
  const n = name.toLowerCase()
  if (n.includes("cabelo") || n.includes("hair") || n.includes("barba") || n.includes("corte")) return Scissors
  if (n.includes("depil") || n.includes("estetica") || n.includes("estética") || n.includes("pele")) return Sparkles
  if (n.includes("manicure") || n.includes("pedicure") || n.includes("unha") || n.includes("nail")) return Hand
  if (n.includes("sobrancelha") || n.includes("cilio") || n.includes("cílio") || n.includes("lash") || n.includes("brow")) return Eye
  return Tag
}

export function ServiceCategoryFilter() {
  const store = useAgendaStore()
  const categories = store.categories
  const selectedCategory = store.filters.serviceCategoryFilter
  const [search, setSearch] = useState("")

  const filteredCategories = useMemo(() => {
    if (!search) return categories
    const term = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return categories.filter(c => 
      c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term)
    )
  }, [categories, search])

  return (
    <div style={{
      padding: '0.75rem 1rem', borderTop: '1px solid #e8ecf4',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem'
      }}>
        <p style={{
          fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          Categoria de Serviço
        </p>
      </div>

      <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
        <Search style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: '#9ca3af' }} />
        <input 
          type="text" 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar categoria..." 
          style={{ 
            width: '100%', padding: '0.375rem 0.5rem 0.375rem 1.75rem', 
            borderRadius: '0.375rem', border: '1px solid #e8ecf4', background: '#fff', 
            fontSize: '0.6875rem', color: '#374151', outline: 'none'
          }} 
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxHeight: '160px', overflowY: 'auto' }} className="scrollbar-hide">
        <button
          onClick={() => store.updateFilter('serviceCategoryFilter', 'all')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.25rem',
            padding: '0.25rem 0.5rem', borderRadius: '0.375rem',
            border: selectedCategory === 'all' ? '1.5px solid #7c5cfc' : '1.5px solid #e8ecf4',
            background: selectedCategory === 'all' ? 'linear-gradient(135deg, #f5f3ff, #ede9fe)' : '#fff',
            color: selectedCategory === 'all' ? '#7c5cfc' : '#8b8fa7',
            fontSize: '0.625rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
          }}
        >
          <Grid style={{ width: '10px', height: '10px' }} />
          Todas
        </button>
        
        {filteredCategories.map(cat => {
          const Icon = getCategoryIcon(cat.name)
          const isSelected = selectedCategory === cat.id
          
          return (
            <button
              key={cat.id}
              onClick={() => store.updateFilter('serviceCategoryFilter', cat.id)}
              title={cat.name}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.25rem 0.5rem', borderRadius: '0.375rem',
                border: isSelected ? '1.5px solid #7c5cfc' : '1.5px solid #e8ecf4',
                background: isSelected ? 'linear-gradient(135deg, #f5f3ff, #ede9fe)' : '#fff',
                color: isSelected ? '#7c5cfc' : '#8b8fa7',
                fontSize: '0.625rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon style={{ width: '10px', height: '10px' }} />
              {cat.name.length > 15 ? cat.name.substring(0, 12) + '...' : cat.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
