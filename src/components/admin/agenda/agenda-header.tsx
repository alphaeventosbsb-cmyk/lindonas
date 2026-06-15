"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ChevronLeft, ChevronRight, Plus, Tag, Columns3, CalendarDays, 
  Grid3X3, Search, PanelLeftClose, PanelLeft, Maximize2, Minimize2, Ban,
  SlidersHorizontal, X, Filter
} from "lucide-react"
import { useAgendaStore, type ViewMode } from "./agenda-store"
import { SpecialtyFilter } from "./specialty-filter"
import { FiltersModal } from "./filters-modal"
import { statusCfg } from "./status-config"
import { PermissionGate } from "@/components/ui/permission-gate"
import { ClientSearchPopup } from "./client-search-popup"
import * as Popover from '@radix-ui/react-popover'

interface Props {
  stats: { label: string; count: number; color: string }[]
  isProfessional: boolean
}

const viewModes: { id: ViewMode; label: string; icon: any }[] = [
  { id: 'day', label: 'Dia', icon: Columns3 },
  { id: 'week', label: 'Semana', icon: CalendarDays },
  { id: 'month', label: 'Mês', icon: Grid3X3 },
]

export function AgendaHeader({ stats, isProfessional }: Props) {
  const store = useAgendaStore()
  const [showFilters, setShowFilters] = useState(false)
  const [showSearchPopup, setShowSearchPopup] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Date Logic
  const dateObj = new Date(store.selectedDate + 'T12:00:00')
  const formattedDate = dateObj.toLocaleDateString('pt-BR', {
    weekday: 'short', day: 'numeric', month: 'short'
  }).replace('.', '')

  const isToday = store.selectedDate === new Date().toISOString().split('T')[0]
  const blockedDate = store.blockedDates.find(b => b.date === store.selectedDate)

  // Filters Logic
  const { filters } = store
  const [localSearch, setLocalSearch] = useState(filters.search || "")

  useEffect(() => { setLocalSearch(filters.search || "") }, [filters.search])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (store.filters.search !== localSearch) store.updateFilter('search', localSearch)
    }, 400)
    return () => clearTimeout(timer)
  }, [localSearch, store])

  const hasActiveAdvancedFilters = filters.statusFilter !== 'all' || 
    filters.employeeFilter.length > 0 || filters.serviceFilter !== 'all' || 
    filters.labelFilter !== 'all' || filters.specialtyFilter.length > 0

  const clearFilters = () => {
    store.updateFilter('statusFilter', 'all')
    store.updateFilter('employeeFilter', [])
    store.updateFilter('serviceFilter', 'all')
    store.updateFilter('labelFilter', 'all')
    store.updateFilter('specialtyFilter', [])
  }

  // Close popover when clicking outside logic removed since we use a modal now

  // Expanded Mode -> Tiny floating button to restore
  if (store.expanded) {
    if (store.viewMode === 'day') return null // Day view handles its own floating/minimize button now

    return (
      <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', zIndex: 100 }}>
        <button
          onClick={() => store.toggleExpanded()}
          title="Sair do modo expandido"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0.5rem', borderRadius: '0.625rem', border: '1px solid #c4b5fd',
            background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(124,92,252,0.3)',
          }}
        >
          <Minimize2 style={{ width: '16px', height: '16px', color: '#7c5cfc' }} />
        </button>
      </div>
    )
  }

  return (
    <>
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', flexShrink: 0, zIndex: 100 }}>
      <div className="scrollbar-hide" style={{
        display: 'flex', flexWrap: 'nowrap', gap: '0.5rem', padding: '0.375rem 0.5rem',
        alignItems: 'center', background: '#fff', borderBottom: '1px solid #e8ecf4', 
        flexShrink: 0, overflowX: 'auto', width: '100%'
      }}>
        {/* 1. Navegação */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
          <button onClick={() => store.setSidebarOpen(!store.sidebarOpen)}
            className="hidden lg:flex" style={{ padding: '0.375rem', borderRadius: '0.375rem', border: '1px solid #e8ecf4', background: '#fafbfc', cursor: 'pointer' }}>
            {store.sidebarOpen ? <PanelLeftClose style={{ width: '14px', height: '14px', color: '#555' }} /> : <PanelLeft style={{ width: '14px', height: '14px', color: '#555' }} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', background: '#f8f9fc', borderRadius: '0.5rem', padding: '0.125rem', border: '1px solid #e8ecf4' }}>
            <button onClick={() => store.navigateDate('prev')} style={{ padding: '0.25rem', borderRadius: '0.375rem', border: 'none', background: 'transparent', cursor: 'pointer' }}><ChevronLeft style={{ width: '14px', height: '14px', color: '#555' }} /></button>
            <button onClick={() => store.navigateDate('today')} style={{ padding: '0.25rem 0.625rem', borderRadius: '0.375rem', border: 'none', background: isToday ? '#7c5cfc' : 'transparent', color: isToday ? '#fff' : '#374151', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}>Hoje</button>
            <button onClick={() => store.navigateDate('next')} style={{ padding: '0.25rem', borderRadius: '0.375rem', border: 'none', background: 'transparent', cursor: 'pointer' }}><ChevronRight style={{ width: '14px', height: '14px', color: '#555' }} /></button>
          </div>
          <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{formattedDate}</p>
          {blockedDate && <Ban style={{ width: '14px', height: '14px', color: '#ef4444' }} />}
        </div>

        <div style={{ width: '1px', height: '20px', background: '#e8ecf4' }} className="hidden sm:block" />

        {/* 2. Visualização */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#f8f9fc', borderRadius: '0.5rem', padding: '0.125rem', border: '1px solid #e8ecf4', flexShrink: 0 }}>
          {viewModes.map(mode => {
            const isActive = store.viewMode === mode.id
            const Icon = mode.icon
            return (
              <button key={mode.id} onClick={() => store.setViewMode(mode.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: 'none', background: isActive ? '#fff' : 'transparent', color: isActive ? '#7c5cfc' : '#8b8fa7', fontSize: '0.6875rem', fontWeight: isActive ? 700 : 500, cursor: 'pointer', boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
                <Icon style={{ width: '12px', height: '12px' }} />
                <span className="hidden sm:inline">{mode.label}</span>
              </button>
            )
          })}
        </div>

        <div style={{ width: '1px', height: '20px', background: '#e8ecf4' }} className="hidden xl:block" />

        {/* 2.5 Ocultar Folgas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0, padding: '0 0.25rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600, color: '#64748b' }}>
            <input 
              type="checkbox" 
              checked={store.hideOffDutyProfessionals} 
              onChange={(e) => store.setHideOffDutyProfessionals(e.target.checked)} 
              style={{ accentColor: '#7c5cfc', cursor: 'pointer', width: '14px', height: '14px' }}
            />
            <span className="hidden sm:inline">Ocultar folgas</span>
          </label>
        </div>

        <div style={{ width: '1px', height: '20px', background: '#e8ecf4' }} className="hidden xl:block" />

        {/* 3. Caixa Única de Busca e Filtros */}
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexShrink: 0, flex: 1 }}>
        
        <Popover.Root open={showSearchPopup && localSearch.trim().length >= 1} onOpenChange={setShowSearchPopup}>
          <Popover.Anchor asChild>
            <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '300px' }}>
              <Search style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#8b8fa7' }} />
              <input 
                type="text" 
                value={localSearch} 
                onChange={e => {
                  setLocalSearch(e.target.value)
                  if (e.target.value.trim().length >= 1) setShowSearchPopup(true)
                }}
                onFocus={() => {
                  if (localSearch.trim().length >= 1) setShowSearchPopup(true)
                }}
                placeholder="Buscar cliente, serviço..." 
                style={{ 
                  width: '100%', paddingLeft: '2rem', paddingRight: '2.5rem', paddingTop: '0.375rem', paddingBottom: '0.375rem', 
                  borderRadius: '0.5rem', border: hasActiveAdvancedFilters ? '1px solid #c4b5fd' : '1px solid #e8ecf4', 
                  background: '#fafbfc', fontSize: '0.75rem', outline: 'none', minHeight: '32px',
                  transition: 'border 0.2s',
                  boxShadow: hasActiveAdvancedFilters ? '0 0 0 2px rgba(124,92,252,0.1)' : 'none'
                }} 
              />
              <button 
                ref={btnRef}
                onClick={() => setShowFilters(!showFilters)}
                title="Filtros avançados e resumo"
                style={{ 
                  position: 'absolute', right: '0.25rem', top: '50%', transform: 'translateY(-50%)', 
                  padding: '0.25rem', borderRadius: '0.375rem', border: 'none', 
                  background: hasActiveAdvancedFilters ? '#f0ecff' : 'transparent', 
                  color: hasActiveAdvancedFilters ? '#7c5cfc' : '#8b8fa7', 
                  cursor: 'pointer', transition: 'all 0.15s' 
                }}
              >
                <SlidersHorizontal style={{ width: '14px', height: '14px' }} />
                {hasActiveAdvancedFilters && (
                  <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                )}
              </button>
            </div>
          </Popover.Anchor>

          <Popover.Portal>
            <Popover.Content 
              sideOffset={8} 
              align="start" 
              style={{ zIndex: 99999, width: '420px', maxWidth: '90vw' }}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                style={{ position: 'relative', width: '100%' }}
              >
                <ClientSearchPopup 
                  searchStr={localSearch}
                  onClose={() => setShowSearchPopup(false)}
                  onSelectDate={(date) => {
                    store.setSelectedDate(date)
                    store.setViewMode('day')
                  }}
                />
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

      </div>

      {/* 4. Ações (Tags e Novo Agendamento) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: 'auto', flexShrink: 0 }}>
        {store.viewMode !== 'day' && (
          <button onClick={() => store.toggleExpanded()} title="Expandir agenda" style={{ display: 'inline-flex', alignItems: 'center', padding: '0.375rem', borderRadius: '0.375rem', border: '1px solid #e8ecf4', background: '#fafbfc', cursor: 'pointer' }}>
            <Maximize2 style={{ width: '14px', height: '14px', color: '#555' }} />
          </button>
        )}
        <button onClick={() => store.setShowLabelManager(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.625rem', borderRadius: '0.375rem', border: '1px solid #e8ecf4', background: '#fafbfc', fontSize: '0.6875rem', fontWeight: 600, color: '#7c5cfc', cursor: 'pointer' }}>
          <Tag style={{ width: '12px', height: '12px' }} />
          <span className="hidden sm:inline">Tags</span>
        </button>
        <PermissionGate permission="agenda.create">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => store.setShowNewAppointment(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: 'none', background: '#7c5cfc', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}>
            <Plus style={{ width: '14px', height: '14px' }} />
            <span className="hidden sm:inline">Novo</span>
          </motion.button>
        </PermissionGate>
      </div>
    </div>

    </div>

    <FiltersModal 
      open={showFilters} 
      onClose={() => setShowFilters(false)} 
      stats={stats} 
    />
    </>
  )
}
