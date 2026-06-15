import { create } from 'zustand'

// ── Size Presets ────────────────────────────────────────────
export type SizePreset = 'PP' | 'P' | 'M' | 'G'

export const ROW_SIZE_MAP: Record<SizePreset, number> = {
  PP: 36,
  P: 48,
  M: 60,
  G: 80,
}

export const COL_SIZE_MAP: Record<SizePreset, number> = {
  PP: 90,
  P: 120,
  M: 150,
  G: 190,
}

const MIN_COLUMN_WIDTH = 90
const MAX_COLUMN_WIDTH = 260

// ── localStorage Keys ──────────────────────────────────────
const LS_KEY_ROW = 'agenda_row_size'
const LS_KEY_COL = 'agenda_col_size'
const LS_KEY_CUSTOM_WIDTHS = 'agenda_custom_col_widths'

// ── Helpers ────────────────────────────────────────────────
function loadFromLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function saveToLS(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* ignore quota errors */ }
}

// ── Store ──────────────────────────────────────────────────
interface AgendaSizeState {
  rowSize: SizePreset
  colSize: SizePreset
  customColumnWidths: Record<string, number> // professionalId → width

  // Derived
  getSlotHeight: () => number
  getDefaultColumnWidth: () => number
  getColumnWidth: (professionalId: string) => number
  getMinColumnWidth: () => number
  getMaxColumnWidth: () => number

  // Actions
  setRowSize: (size: SizePreset) => void
  setColSize: (size: SizePreset) => void
  setCustomColumnWidth: (professionalId: string, width: number) => void
  resetAll: () => void
}

export const useAgendaSizeStore = create<AgendaSizeState>((set, get) => ({
  rowSize: loadFromLS<SizePreset>(LS_KEY_ROW, 'M'),
  colSize: loadFromLS<SizePreset>(LS_KEY_COL, 'P'),
  customColumnWidths: loadFromLS<Record<string, number>>(LS_KEY_CUSTOM_WIDTHS, {}),

  // Derived
  getSlotHeight: () => ROW_SIZE_MAP[get().rowSize],
  getDefaultColumnWidth: () => COL_SIZE_MAP[get().colSize],
  getColumnWidth: (professionalId: string) => {
    const custom = get().customColumnWidths[professionalId]
    if (custom !== undefined) return custom
    return COL_SIZE_MAP[get().colSize]
  },
  getMinColumnWidth: () => MIN_COLUMN_WIDTH,
  getMaxColumnWidth: () => MAX_COLUMN_WIDTH,

  // Actions
  setRowSize: (size) => {
    set({ rowSize: size })
    saveToLS(LS_KEY_ROW, size)
  },
  setColSize: (size) => {
    // Clear all custom widths when changing global column size
    set({ colSize: size, customColumnWidths: {} })
    saveToLS(LS_KEY_COL, size)
    saveToLS(LS_KEY_CUSTOM_WIDTHS, {})
  },
  setCustomColumnWidth: (professionalId, width) => {
    const clamped = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, width))
    const updated = { ...get().customColumnWidths, [professionalId]: clamped }
    set({ customColumnWidths: updated })
    saveToLS(LS_KEY_CUSTOM_WIDTHS, updated)
  },
  resetAll: () => {
    set({ rowSize: 'M', colSize: 'P', customColumnWidths: {} })
    saveToLS(LS_KEY_ROW, 'M')
    saveToLS(LS_KEY_COL, 'P')
    saveToLS(LS_KEY_CUSTOM_WIDTHS, {})
  },
}))
