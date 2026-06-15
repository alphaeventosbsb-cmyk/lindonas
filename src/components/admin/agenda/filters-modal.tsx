"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Filter, X, Check } from "lucide-react"
import { useAgendaStore } from "./agenda-store"
import { SpecialtyFilter } from "./specialty-filter"
import { statusCfg } from "./status-config"

interface Props {
  open: boolean
  onClose: () => void
  stats: { label: string; count: number; color: string }[]
}

export function FiltersModal({ open, onClose, stats }: Props) {
  const store = useAgendaStore()
  const { filters } = store
  
  // Local state initialized from store filters
  const [localFilters, setLocalFilters] = useState({
    statusFilter: filters.statusFilter,
    employeeFilter: filters.employeeFilter,
    serviceFilter: filters.serviceFilter,
    labelFilter: filters.labelFilter,
    specialtyFilter: filters.specialtyFilter,
  })

  // Reset local state when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters({
        statusFilter: filters.statusFilter,
        employeeFilter: filters.employeeFilter,
        serviceFilter: filters.serviceFilter,
        labelFilter: filters.labelFilter,
        specialtyFilter: filters.specialtyFilter,
      })
    }
  }, [open, filters])

  const handleApply = () => {
    store.updateFilter('statusFilter', localFilters.statusFilter)
    store.updateFilter('employeeFilter', localFilters.employeeFilter)
    store.updateFilter('serviceFilter', localFilters.serviceFilter)
    store.updateFilter('labelFilter', localFilters.labelFilter)
    store.updateFilter('specialtyFilter', localFilters.specialtyFilter)
    onClose()
  }

  const handleClear = () => {
    store.updateFilter('statusFilter', 'all')
    store.updateFilter('employeeFilter', [])
    store.updateFilter('serviceFilter', 'all')
    store.updateFilter('labelFilter', 'all')
    store.updateFilter('specialtyFilter', [])
    store.updateFilter('serviceCategoryFilter', 'all')
    onClose()
  }

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    if (open) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const hasLocalActiveFilters = localFilters.statusFilter !== 'all' || 
    localFilters.employeeFilter.length > 0 || localFilters.serviceFilter !== 'all' || 
    localFilters.labelFilter !== 'all' || localFilters.specialtyFilter.length > 0

  return (
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          style={{
            background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: 'min(760px, 90vw)',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e8ecf4' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1e1e2d', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Filter style={{ width: '18px', height: '18px', color: '#7c5cfc' }} />
              Filtros e Resumo
            </h2>
            <button onClick={onClose} style={{ padding: '0.375rem', background: '#f8f9fc', border: '1px solid #e8ecf4', borderRadius: '0.375rem', cursor: 'pointer', color: '#8b8fa7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: '18px', height: '18px' }} />
            </button>
          </div>

          {/* Body */}
          <div className="scrollbar-hide" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Resumo Section */}
            <div>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#8b8fa7', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 1rem 0' }}>Resumo de Hoje</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                {stats.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#fafbfc', borderRadius: '0.5rem', border: '1px solid #f1f3f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                      <span style={{ fontSize: '0.8125rem', color: '#555', fontWeight: 600 }}>{s.label}</span>
                    </div>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1e1e2d' }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: '1px', background: '#e8ecf4' }} />

            {/* Filtros Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Filtros Avançados</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#555' }}>Status</span>
                  <select 
                    value={localFilters.statusFilter} 
                    onChange={e => setLocalFilters(prev => ({ ...prev, statusFilter: e.target.value }))} 
                    style={{ padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #e8ecf4', background: '#fafbfc', fontSize: '0.875rem', fontWeight: 500, color: '#374151', cursor: 'pointer', outline: 'none', width: '100%' }}
                  >
                    <option value="all">Todos os status</option>
                    {Object.entries(statusCfg).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </label>
                
                {store.employees.length > 0 && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#555' }}>Profissional</span>
                    <select 
                      value={localFilters.employeeFilter.length === 1 ? localFilters.employeeFilter[0] : 'all'} 
                      onChange={e => { const val = e.target.value; setLocalFilters(prev => ({ ...prev, employeeFilter: val === 'all' ? [] : [val] })) }} 
                      style={{ padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #e8ecf4', background: '#fafbfc', fontSize: '0.875rem', fontWeight: 500, color: '#374151', cursor: 'pointer', outline: 'none', width: '100%' }}
                    >
                      <option value="all">Todos os profissionais</option>
                      {store.employees.filter(e => e.is_active && e.has_schedule !== false).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </label>
                )}

                {store.services.length > 0 && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#555' }}>Serviço</span>
                    <select 
                      value={localFilters.serviceFilter} 
                      onChange={e => setLocalFilters(prev => ({ ...prev, serviceFilter: e.target.value }))} 
                      style={{ padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #e8ecf4', background: '#fafbfc', fontSize: '0.875rem', fontWeight: 500, color: '#374151', cursor: 'pointer', outline: 'none', width: '100%' }}
                    >
                      <option value="all">Todos os serviços</option>
                      {store.services.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </label>
                )}

                {store.labels.length > 0 && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#555' }}>Etiqueta</span>
                    <select 
                      value={localFilters.labelFilter} 
                      onChange={e => setLocalFilters(prev => ({ ...prev, labelFilter: e.target.value }))} 
                      style={{ padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #e8ecf4', background: '#fafbfc', fontSize: '0.875rem', fontWeight: 500, color: '#374151', cursor: 'pointer', outline: 'none', width: '100%' }}
                    >
                      <option value="all">Todas as etiquetas</option>
                      {store.labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </label>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#555' }}>Especialidade</span>
                  {/* Container to ensure the popover appears correctly */}
                  <div style={{ width: '100%' }}>
                    <SpecialtyFilter 
                      value={localFilters.specialtyFilter} 
                      onChange={val => setLocalFilters(prev => ({ ...prev, specialtyFilter: val }))} 
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', background: '#fafbfc', borderTop: '1px solid #e8ecf4' }}>
            <button 
              onClick={handleClear}
              style={{ 
                padding: '0.625rem 1rem', background: 'transparent', border: '1px solid #fecaca', borderRadius: '0.5rem', 
                color: '#ef4444', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s', opacity: hasLocalActiveFilters ? 1 : 0.5, pointerEvents: hasLocalActiveFilters ? 'auto' : 'none'
              }}
            >
              Limpar filtros
            </button>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={onClose}
                style={{ padding: '0.625rem 1rem', background: '#fff', border: '1px solid #e8ecf4', borderRadius: '0.5rem', color: '#555', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleApply}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.625rem 1.25rem', background: '#7c5cfc', border: 'none', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}
              >
                <Check style={{ width: '16px', height: '16px' }} />
                Aplicar filtros
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
