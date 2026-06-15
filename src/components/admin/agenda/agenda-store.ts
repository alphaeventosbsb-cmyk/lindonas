import { create } from 'zustand'
import type { Appointment, Employee, AppointmentLabel, Service, Client, Category } from '@/lib/types/database'
import { toLocalDateStr, professionalWorksOnDate } from '@/lib/utils'
import type { BusinessHour, BlockedDate } from '@/lib/types/database'



const normalizeSearch = (value: string) => {
  if (!value) return ''
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim()
}

const onlyNumbers = (value: string) => {
  if (!value) return ''
  return value.replace(/\D/g, "")
}

export type ViewMode = 'day' | 'week' | 'month'

interface AgendaFilters {
  search: string
  statusFilter: string
  employeeFilter: string[]
  serviceFilter: string
  labelFilter: string
  specialtyFilter: string[]
  serviceCategoryFilter: string
}

interface AgendaState {
  // View
  viewMode: ViewMode
  selectedDate: string
  
  // Data
  appointments: Appointment[]
  employees: Employee[]
  labels: AppointmentLabel[]
  services: Service[]
  categories: Category[]
  clients: Client[]
  businessHours: BusinessHour[]
  blockedDates: BlockedDate[]
  settings: any | null
  
  // Filters
  filters: AgendaFilters
  
  // UI State
  loading: boolean
  sidebarOpen: boolean
  expanded: boolean
  selectedAppointment: Appointment | null
  contextMenu: { appointment: Appointment; x: number; y: number } | null
  hoveredAppointment: Appointment | null
  
  // Modals
  showNewAppointment: boolean
  showLabelManager: boolean
  closeAccountAppointment: Appointment | null
  
  // Cut/Paste
  cutAppointment: Appointment | null
  
  // Pre-fill for duplicate
  prefillAppointment: Appointment | null

  // Edit mode (reuse NewAppointmentModal for editing)
  editMode: boolean

  // Slot Modals
  showAbsenceModal: { employee_id: string, time: string, date: string } | null
  showFreeSlotModal: { employee_id: string, time: string, date: string } | null
  showBlockModal: { employee_id: string, time: string, date: string } | null
  showGlobalBlockModal: boolean
  showCreditModal: boolean
  
  // Professional editing
  editingEmployeeId: string | null
  
  // View preferences
  hideOffDutyProfessionals: boolean
  
  // Actions
  setViewMode: (mode: ViewMode) => void
  setSelectedDate: (date: string) => void
  setAppointments: (appointments: Appointment[]) => void
  setEmployees: (employees: Employee[]) => void
  setLabels: (labels: AppointmentLabel[]) => void
  setServices: (services: Service[]) => void
  setCategories: (categories: Category[]) => void
  setClients: (clients: Client[]) => void
  setBusinessHours: (hours: BusinessHour[]) => void
  setBlockedDates: (dates: BlockedDate[]) => void
  setSettings: (settings: any | null) => void
  setLoading: (loading: boolean) => void
  setSidebarOpen: (open: boolean) => void
  setSelectedAppointment: (apt: Appointment | null) => void
  setContextMenu: (ctx: { appointment: Appointment; x: number; y: number } | null) => void
  setHoveredAppointment: (apt: Appointment | null) => void
  setShowNewAppointment: (show: boolean) => void
  setShowLabelManager: (show: boolean) => void
  setCloseAccountAppointment: (apt: Appointment | null) => void
  setCutAppointment: (apt: Appointment | null) => void
  setPrefillAppointment: (apt: Appointment | null) => void
  setEditMode: (mode: boolean) => void
  setExpanded: (expanded: boolean) => void
  toggleExpanded: () => void
  updateFilter: <K extends keyof AgendaFilters>(key: K, value: AgendaFilters[K]) => void
  navigateDate: (direction: 'prev' | 'next' | 'today') => void
  setShowAbsenceModal: (opts: { employee_id: string, time: string, date: string } | null) => void
  setShowFreeSlotModal: (opts: { employee_id: string, time: string, date: string } | null) => void
  setShowBlockModal: (opts: { employee_id: string, time: string, date: string } | null) => void
  setShowGlobalBlockModal: (show: boolean) => void
  setShowCreditModal: (show: boolean) => void
  setEditingEmployeeId: (id: string | null) => void
  setHideOffDutyProfessionals: (hide: boolean) => void
  
  // Computed helpers
  getFilteredAppointments: () => Appointment[]
  getAppointmentsForDate: (date: string) => Appointment[]
  getUniqueSpecialties: () => string[]
  getActiveEmployees: () => Employee[]
}

export const useAgendaStore = create<AgendaState>((set, get) => ({
  // View
  viewMode: 'day',
  selectedDate: toLocalDateStr(),
  
  // Data
  appointments: [],
  employees: [],
  labels: [],
  services: [],
  categories: [],
  clients: [],
  businessHours: [],
  blockedDates: [],
  settings: null,
  
  // Filters
  filters: {
    search: '',
    statusFilter: 'all',
    employeeFilter: [],
    serviceFilter: 'all',
    labelFilter: 'all',
    specialtyFilter: [],
    serviceCategoryFilter: 'all',
  },
  
  // UI State
  loading: true,
  sidebarOpen: true,
  expanded: false,
  selectedAppointment: null,
  contextMenu: null,
  hoveredAppointment: null,
  
  // Modals
  showNewAppointment: false,
  showLabelManager: false,
  closeAccountAppointment: null,
  
  // Cut/Paste
  cutAppointment: null,
  
  // Pre-fill
  prefillAppointment: null,
  editMode: false,
  
  // Slot Modals
  showAbsenceModal: null,
  showFreeSlotModal: null,
  showBlockModal: null,
  showGlobalBlockModal: false,
  showCreditModal: false,
  
  editingEmployeeId: null,
  
  hideOffDutyProfessionals: typeof window !== 'undefined' ? localStorage.getItem('agenda.hideOffDutyProfessionals') === 'true' : false,
  
  // Actions
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setAppointments: (appointments) => set({ appointments }),
  setEmployees: (employees) => set({ employees }),
  setLabels: (labels) => set({ labels }),
  setServices: (services) => set({ services }),
  setCategories: (categories) => set({ categories }),
  setClients: (clients) => set({ clients }),
  setBusinessHours: (businessHours) => set({ businessHours }),
  setBlockedDates: (blockedDates) => set({ blockedDates }),
  setSettings: (settings) => set({ settings }),
  setLoading: (loading) => set({ loading }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSelectedAppointment: (apt) => set({ selectedAppointment: apt }),
  setContextMenu: (ctx) => set({ contextMenu: ctx }),
  setHoveredAppointment: (apt) => set({ hoveredAppointment: apt }),
  setShowNewAppointment: (show) => set({ showNewAppointment: show }),
  setShowLabelManager: (show) => set({ showLabelManager: show }),
  setCloseAccountAppointment: (apt) => set({ closeAccountAppointment: apt }),
  setCutAppointment: (apt) => set({ cutAppointment: apt }),
  setPrefillAppointment: (apt) => set({ prefillAppointment: apt }),
  setEditMode: (mode) => set({ editMode: mode }),
  setExpanded: (expanded) => set({ expanded }),
  toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),
  setShowAbsenceModal: (opts) => set({ showAbsenceModal: opts }),
  setShowFreeSlotModal: (opts) => set({ showFreeSlotModal: opts }),
  setShowBlockModal: (opts) => set({ showBlockModal: opts }),
  setShowGlobalBlockModal: (show) => set({ showGlobalBlockModal: show }),
  setShowCreditModal: (show) => set({ showCreditModal: show }),
  setEditingEmployeeId: (id) => set({ editingEmployeeId: id }),
  setHideOffDutyProfessionals: (hide) => {
    if (typeof window !== 'undefined') localStorage.setItem('agenda.hideOffDutyProfessionals', String(hide))
    set({ hideOffDutyProfessionals: hide })
  },
  
  updateFilter: (key, value) => set((state) => ({
    filters: { ...state.filters, [key]: value }
  })),
  
  navigateDate: (direction) => set((state) => {
    const current = new Date(state.selectedDate + 'T12:00:00')
    if (direction === 'today') return { selectedDate: toLocalDateStr() }
    
    const offset = state.viewMode === 'month' ? 30 : state.viewMode === 'week' ? 7 : 1
    const mult = direction === 'prev' ? -1 : 1
    current.setDate(current.getDate() + (offset * mult))
    return { selectedDate: toLocalDateStr(current) }
  }),
  
  // Computed helpers
  getFilteredAppointments: () => {
    const { appointments, employees, filters, clients, services } = get()
    // Pre-compute employee IDs that match the specialty filter
    let specialtyEmployeeIds: Set<string> | null = null
    if (filters.specialtyFilter.length > 0) {
      specialtyEmployeeIds = new Set(
        employees
          .filter(e => e.specialty && filters.specialtyFilter.includes(e.specialty))
          .map(e => e.id)
      )
    }

    const searchTerms = normalizeSearch(filters.search)
    const searchNumbers = onlyNumbers(filters.search)

    return appointments.filter(a => {
      let matchSearch = true
      if (filters.search) {
        let cPhone = a.client_phone || ''
        let cEmail = a.client_email || ''
        let cCpf = ''
        let cNickname = ''

        if (a.client_id) {
          const clientObj = clients.find(c => c.id === a.client_id)
          if (clientObj) {
            if (clientObj.phone) cPhone = clientObj.phone
            if (clientObj.email) cEmail = clientObj.email
            if (clientObj.cpf) cCpf = clientObj.cpf
            if (clientObj.nickname) cNickname = clientObj.nickname
          }
        }
        
        const serviceObj = services.find(s => s.id === a.service_id)
        const sDescription = serviceObj?.description || ''

        const fullText = normalizeSearch(`
          ${a.client_name} ${cNickname} ${cEmail}
          ${a.service_name} ${sDescription}
          ${a.employee_name || ''}
        `)

        const fullNumbers = onlyNumbers(`${cPhone} ${cCpf}`)

        if (searchNumbers.length > 0 && fullNumbers.includes(searchNumbers)) {
          matchSearch = true
        } else {
          const searchWords = searchTerms.split(' ').filter(Boolean)
          matchSearch = searchWords.length > 0 && searchWords.every(word => fullText.includes(word))
        }
      }

      const matchStatus = filters.statusFilter === 'all' || a.status === filters.statusFilter
      const matchEmployee = filters.employeeFilter.length === 0 || 
        (a.employee_id && filters.employeeFilter.includes(a.employee_id))
      const matchService = filters.serviceFilter === 'all' || a.service_id === filters.serviceFilter
      const matchLabel = filters.labelFilter === 'all' || 
        (a.label_ids && a.label_ids.includes(filters.labelFilter))
      const matchSpecialty = !specialtyEmployeeIds || 
        (a.employee_id != null && specialtyEmployeeIds.has(a.employee_id))

      let matchCategory = true
      if (filters.serviceCategoryFilter !== 'all') {
        const s = services.find(srv => srv.id === a.service_id)
        if (s && s.category_id !== filters.serviceCategoryFilter) {
          matchCategory = false
        }
      }

      return matchSearch && matchStatus && matchEmployee && matchService && matchLabel && matchSpecialty && matchCategory
    })
  },
  
  getAppointmentsForDate: (date) => {
    const filtered = get().getFilteredAppointments()
    return filtered.filter(a => a.appointment_date === date)
  },
  
  getActiveEmployees: () => {
    const { employees, filters, services } = get()
    let active = employees.filter(e => e.is_active && e.has_schedule !== false)
    
    // Filter by Service Category
    if (filters.serviceCategoryFilter !== 'all') {
      const catId = filters.serviceCategoryFilter
      active = active.filter(e => {
        let empServiceIds: string[] = []
        if (e.professional_services && e.professional_services.length > 0) {
          empServiceIds = e.professional_services.filter(ps => ps.enabled).map(ps => ps.serviceId)
        } else if (e.service_ids && e.service_ids.length > 0) {
          empServiceIds = e.service_ids
        }
        
        return empServiceIds.some(sid => {
          const srv = services.find(s => s.id === sid)
          return srv && srv.is_active !== false && srv.category_id === catId
        })
      })
    }

    // Filter by specialty
    if (filters.specialtyFilter.length > 0) {
      active = active.filter(e => e.specialty && filters.specialtyFilter.includes(e.specialty))
    }
    // Filter by individual employee
    if (filters.employeeFilter.length > 0) {
      active = active.filter(e => filters.employeeFilter.includes(e.id))
    }
    
    // Filter off-duty professionals if the toggle is active
    if (get().hideOffDutyProfessionals) {
      const dateStr = get().selectedDate
      active = active.filter(e => professionalWorksOnDate(e, dateStr))
    }
    
    // Sort active employees alphabetically
    return active.sort((a, b) => {
      const nameA = a.name || ''
      const nameB = b.name || ''
      const nameCmp = nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' })
      if (nameCmp !== 0) return nameCmp
      
      const nickA = a.nickname || ''
      const nickB = b.nickname || ''
      const nickCmp = nickA.localeCompare(nickB, 'pt-BR', { sensitivity: 'base' })
      if (nickCmp !== 0) return nickCmp
      
      return a.id.localeCompare(b.id)
    })
  },

  getUniqueSpecialties: () => {
    const { employees } = get()
    const specialties = new Set<string>()
    employees.forEach(e => {
      if (e.is_active && e.has_schedule !== false && e.specialty) {
        specialties.add(e.specialty)
      }
    })
    return Array.from(specialties).sort()
  },
}))
