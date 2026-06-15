"use client"

import { useState, useEffect } from "react"
import { Search, X, Filter } from "lucide-react"
import { motion } from "framer-motion"
import { useAgendaStore } from "./agenda-store"
import { statusCfg } from "./status-config"
import { SpecialtyFilter } from "./specialty-filter"

interface Props {
  stats: { label: string; count: number; color: string }[]
}

export function AgendaFiltersBar({ stats }: Props) {
  const store = useAgendaStore()
  const { filters } = store
  const [localSearch, setLocalSearch] = useState(filters.search || "")

  useEffect(() => {
    setLocalSearch(filters.search || "")
  }, [filters.search])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (store.filters.search !== localSearch) {
        store.updateFilter('search', localSearch)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [localSearch])

  const hasActiveFilters = filters.search || filters.statusFilter !== 'all' || 
    filters.employeeFilter.length > 0 || filters.serviceFilter !== 'all' || 
    filters.labelFilter !== 'all' || filters.specialtyFilter.length > 0

  const clearFilters = () => {
    store.updateFilter('search', '')
    store.updateFilter('statusFilter', 'all')
    store.updateFilter('employeeFilter', [])
    store.updateFilter('serviceFilter', 'all')
    store.updateFilter('labelFilter', 'all')
    store.updateFilter('specialtyFilter', [])
  }

  const selectStyle: React.CSSProperties = {
    padding: '0.4rem 0.625rem', borderRadius: '0.5rem', border: '1px solid #e8ecf4',
    background: '#fff', fontSize: '0.75rem', fontWeight: 600, color: '#374151',
    cursor: 'pointer', outline: 'none', minHeight: '32px',
  }

  return (
    <div style={{
      display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem', flexWrap: 'wrap',
      alignItems: 'center', background: '#fafbfc', borderBottom: '1px solid #e8ecf4',
      flexShrink: 0,
    }}>
      {/* Stats Block */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {stats.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.25rem 0.5rem', borderRadius: '2rem',
              background: '#fff', border: '1px solid #e8ecf4',
              fontSize: '0.6875rem', fontWeight: 600, color: s.color,
            }}
          >
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%', background: s.color,
            }} />
            {s.label}: <strong>{s.count}</strong>
          </motion.div>
        ))}
      </div>

      <div style={{ width: '1px', height: '24px', background: '#e8ecf4', margin: '0 0.25rem' }} className="hidden sm:block" />

      {/* Search & Filters Block */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: '150px', maxWidth: '300px' }}>
          <Search style={{
            position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)',
            width: '13px', height: '13px', color: '#8b8fa7',
          }} />
          <input
            type="text"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            style={{
              width: '100%', paddingLeft: '2rem', paddingRight: '0.625rem',
              paddingTop: '0.4rem', paddingBottom: '0.4rem',
              borderRadius: '0.5rem', border: '1px solid #e8ecf4',
              background: '#fff', fontSize: '0.75rem', color: '#1e1e2d',
              outline: 'none', minHeight: '32px',
            }}
            placeholder="Buscar cliente ou serviço..."
          />
        </div>

        {/* Filters */}
        <select
          value={filters.statusFilter}
          onChange={e => store.updateFilter('statusFilter', e.target.value)}
          style={selectStyle}
        >
          <option value="all">Status: Todos</option>
          {Object.entries(statusCfg).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        {store.employees.length > 0 && (
          <select
            value={filters.employeeFilter.length === 1 ? filters.employeeFilter[0] : 'all'}
            onChange={e => {
              const val = e.target.value
              store.updateFilter('employeeFilter', val === 'all' ? [] : [val])
            }}
            style={selectStyle}
          >
            <option value="all">Profissional: Todos</option>
            {store.employees.filter(e => e.is_active && e.has_schedule !== false).map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        )}

        {store.services.length > 0 && (
          <select
            value={filters.serviceFilter}
            onChange={e => store.updateFilter('serviceFilter', e.target.value)}
            style={selectStyle}
          >
            <option value="all">Serviço: Todos</option>
            {store.services.filter(s => s.is_active).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        {store.labels.length > 0 && (
          <select
            value={filters.labelFilter}
            onChange={e => store.updateFilter('labelFilter', e.target.value)}
            style={selectStyle}
          >
            <option value="all">Etiqueta: Todas</option>
            {store.labels.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}

        <SpecialtyFilter />

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.375rem 0.625rem', borderRadius: '0.5rem',
              border: '1px solid #fecaca', background: '#fef2f2',
              fontSize: '0.6875rem', fontWeight: 600, color: '#ef4444',
              cursor: 'pointer',
            }}
          >
            <X style={{ width: '12px', height: '12px' }} />
            Limpar
          </button>
        )}
      </div>
    </div>
  )
}

