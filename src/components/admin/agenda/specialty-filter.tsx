"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Search, X, ChevronDown, Sparkles } from "lucide-react"
import { useAgendaStore } from "./agenda-store"

interface SpecialtyFilterProps {
  value?: string[]
  onChange?: (value: string[]) => void
}

export function SpecialtyFilter({ value, onChange }: SpecialtyFilterProps) {
  const store = useAgendaStore()
  const specialties = store.getUniqueSpecialties()
  const selected = value ?? store.filters.specialtyFilter
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick)
      return () => document.removeEventListener("mousedown", handleClick)
    }
  }, [open])

  // Focus search when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!search) return specialties
    const lower = search.toLowerCase()
    return specialties.filter(s => s.toLowerCase().includes(lower))
  }, [specialties, search])

  const toggle = useCallback((specialty: string) => {
    const next = selected.includes(specialty)
      ? selected.filter(s => s !== specialty)
      : [...selected, specialty]
    if (onChange) {
      onChange(next)
    } else {
      store.updateFilter("specialtyFilter", next)
    }
  }, [selected, store, onChange])

  const clearAll = useCallback(() => {
    if (onChange) {
      onChange([])
    } else {
      store.updateFilter("specialtyFilter", [])
    }
    setSearch("")
  }, [store, onChange])

  const employeeCount = useCallback((specialty: string) => {
    return store.employees.filter(e => e.is_active && e.has_schedule !== false && e.specialty === specialty).length
  }, [store.employees])

  if (specialties.length === 0) return null

  const hasSelection = selected.length > 0

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger Button */}
      <button
        id="specialty-filter-trigger"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          border: hasSelection ? "1px solid #c4b5fd" : "1px solid #e8ecf4",
          background: hasSelection
            ? "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)"
            : "#fafbfc",
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: hasSelection ? "#6d28d9" : "#374151",
          cursor: "pointer",
          outline: "none",
          minHeight: "28px",
          transition: "all 0.2s ease",
          boxShadow: hasSelection
            ? "0 1px 4px rgba(124,92,252,0.15)"
            : "none",
        }}
        onMouseEnter={e => {
          if (!hasSelection) {
            e.currentTarget.style.borderColor = "#c4b5fd"
            e.currentTarget.style.background = "#faf8ff"
          }
        }}
        onMouseLeave={e => {
          if (!hasSelection) {
            e.currentTarget.style.borderColor = "#e8ecf4"
            e.currentTarget.style.background = "#fff"
          }
        }}
      >
        <Sparkles style={{ width: "12px", height: "12px", opacity: 0.7 }} />
        <span>Especialidade</span>
        {hasSelection && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "18px",
              height: "18px",
              borderRadius: "999px",
              background: "linear-gradient(135deg, #7c5cfc, #a78bfa)",
              color: "#fff",
              fontSize: "0.625rem",
              fontWeight: 800,
              padding: "0 0.25rem",
              boxShadow: "0 1px 3px rgba(124,92,252,0.3)",
            }}
          >
            {selected.length}
          </span>
        )}
        <ChevronDown
          style={{
            width: "12px",
            height: "12px",
            opacity: 0.5,
            transition: "transform 0.2s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 999,
            minWidth: "260px",
            maxWidth: "320px",
            background: "#fff",
            borderRadius: "0.75rem",
            border: "1px solid #e8ecf4",
            boxShadow:
              "0 12px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(124,92,252,0.06)",
            overflow: "hidden",
            animation: "specialtyDropIn 0.18s ease-out",
          }}
        >
          {/* Search input */}
          <div
            style={{
              padding: "0.625rem",
              borderBottom: "1px solid #f1f3f9",
              position: "relative",
            }}
          >
            <Search
              style={{
                position: "absolute",
                left: "1.125rem",
                top: "50%",
                transform: "translateY(-50%)",
                width: "13px",
                height: "13px",
                color: "#8b8fa7",
                pointerEvents: "none",
              }}
            />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar especialidade..."
              style={{
                width: "100%",
                paddingLeft: "2rem",
                paddingRight: "0.625rem",
                paddingTop: "0.4rem",
                paddingBottom: "0.4rem",
                borderRadius: "0.5rem",
                border: "1px solid #e8ecf4",
                background: "#fafbfc",
                fontSize: "0.75rem",
                color: "#1e1e2d",
                outline: "none",
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = "#c4b5fd"
                e.currentTarget.style.background = "#fff"
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = "#e8ecf4"
                e.currentTarget.style.background = "#fafbfc"
              }}
            />
          </div>

          {/* Selected badges */}
          {selected.length > 0 && (
            <div
              style={{
                padding: "0.375rem 0.625rem",
                borderBottom: "1px solid #f1f3f9",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.25rem",
                alignItems: "center",
              }}
            >
              {selected.map(s => (
                <span
                  key={s}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.125rem 0.5rem",
                    borderRadius: "999px",
                    background: "linear-gradient(135deg, #f0ecff, #ede9fe)",
                    color: "#6d28d9",
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    border: "1px solid #ddd6fe",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onClick={() => toggle(s)}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "#fce7f3"
                    e.currentTarget.style.borderColor = "#f9a8d4"
                    e.currentTarget.style.color = "#be185d"
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "linear-gradient(135deg, #f0ecff, #ede9fe)"
                    e.currentTarget.style.borderColor = "#ddd6fe"
                    e.currentTarget.style.color = "#6d28d9"
                  }}
                >
                  {s}
                  <X style={{ width: "10px", height: "10px" }} />
                </span>
              ))}
              <button
                onClick={clearAll}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.125rem",
                  padding: "0.125rem 0.375rem",
                  borderRadius: "999px",
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#ef4444",
                  fontSize: "0.5625rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "#fee2e2"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "#fef2f2"
                }}
              >
                <X style={{ width: "9px", height: "9px" }} />
                Limpar
              </button>
            </div>
          )}

          {/* Options list */}
          <div
            style={{
              maxHeight: "220px",
              overflowY: "auto",
              padding: "0.25rem 0",
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: "1.25rem",
                  textAlign: "center",
                  color: "#8b8fa7",
                  fontSize: "0.75rem",
                }}
              >
                <p style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>🔍</p>
                <p>Nenhuma especialidade encontrada</p>
              </div>
            ) : (
              filtered.map(specialty => {
                const isSelected = selected.includes(specialty)
                const count = employeeCount(specialty)
                return (
                  <button
                    key={specialty}
                    onClick={() => toggle(specialty)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem 0.75rem",
                      border: "none",
                      background: isSelected ? "#f5f3ff" : "transparent",
                      cursor: "pointer",
                      transition: "all 0.12s ease",
                      textAlign: "left",
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = "#fafbfc"
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = "transparent"
                    }}
                  >
                    {/* Checkbox indicator */}
                    <span
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "4px",
                        border: isSelected
                          ? "2px solid #7c5cfc"
                          : "2px solid #d1d5db",
                        background: isSelected
                          ? "linear-gradient(135deg, #7c5cfc, #a78bfa)"
                          : "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all 0.15s ease",
                        boxShadow: isSelected
                          ? "0 1px 3px rgba(124,92,252,0.3)"
                          : "none",
                      }}
                    >
                      {isSelected && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                        >
                          <path
                            d="M2 5L4 7L8 3"
                            stroke="#fff"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>

                    {/* Label */}
                    <span
                      style={{
                        flex: 1,
                        fontSize: "0.75rem",
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? "#4c1d95" : "#374151",
                        transition: "color 0.12s ease",
                      }}
                    >
                      {specialty}
                    </span>

                    {/* Employee count badge */}
                    <span
                      style={{
                        fontSize: "0.5625rem",
                        fontWeight: 700,
                        padding: "0.0625rem 0.375rem",
                        borderRadius: "999px",
                        background: isSelected ? "#ede9fe" : "#f3f4f6",
                        color: isSelected ? "#7c5cfc" : "#8b8fa7",
                        transition: "all 0.12s ease",
                      }}
                    >
                      {count} {count === 1 ? "prof" : "profs"}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "0.5rem 0.75rem",
              borderTop: "1px solid #f1f3f9",
              background: "#fafbfc",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: "0.5625rem",
                color: "#8b8fa7",
                fontWeight: 600,
              }}
            >
              {specialties.length} {specialties.length === 1 ? "especialidade" : "especialidades"}
            </span>
            {selected.length > 0 && (
              <button
                onClick={clearAll}
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  color: "#7c5cfc",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.125rem 0.25rem",
                  borderRadius: "0.25rem",
                  transition: "all 0.12s ease",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "#f0ecff"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "none"
                }}
              >
                Limpar seleção
              </button>
            )}
          </div>
        </div>
      )}

      {/* Keyframe injection */}
      <style>{`
        @keyframes specialtyDropIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
