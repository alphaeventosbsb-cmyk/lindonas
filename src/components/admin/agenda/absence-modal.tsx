"use client"

import { useState } from "react"
import { X, Clock, FileText, AlertCircle, Loader2 } from "lucide-react"
import { createDocument } from "@/lib/firebase/client-utils"
import { useAgendaStore } from "./agenda-store"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"
import type { Appointment } from "@/lib/types/database"

interface Props {
  employeeId: string
  date: string
  time: string
  onClose: () => void
}

const PRESETS = [
  { id: "lunch_30", label: "Almoço 30 min", duration: 30, title: "Almoço" },
  { id: "lunch_60", label: "Almoço 1 hora", duration: 60, title: "Almoço" },
  { id: "pause_15", label: "Pausa 15 min", duration: 15, title: "Pausa" },
  { id: "pause_30", label: "Pausa 30 min", duration: 30, title: "Pausa" },
  { id: "quick_exit", label: "Saída rápida", duration: 30, title: "Saída rápida" },
  { id: "meeting", label: "Reunião", duration: 60, title: "Reunião" },
  { id: "other", label: "Outros", duration: 0, title: "" },
]

export function AbsenceModal({ employeeId, date, time, onClose }: Props) {
  const store = useAgendaStore()
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  
  // Custom form
  const [customTitle, setCustomTitle] = useState("")
  const [customDuration, setCustomDuration] = useState(30)
  const [notes, setNotes] = useState("")
  
  const [submitting, setSubmitting] = useState(false)
  const { ConfirmationDialog, confirm } = useConfirm()

  const employee = store.employees.find(e => e.id === employeeId)

  const handleSave = async () => {
    if (!selectedPreset) {
      toast.error("Selecione um tipo de ausência")
      return
    }

    const preset = PRESETS.find(p => p.id === selectedPreset)!
    
    const finalTitle = preset.id === "other" ? customTitle : preset.title
    const finalDuration = preset.id === "other" ? customDuration : preset.duration

    if (!finalTitle.trim()) {
      toast.error("Informe o motivo da ausência")
      return
    }
    
    if (finalDuration <= 0) {
      toast.error("A duração deve ser maior que zero")
      return
    }

    // Check for conflicts
    const [h, m] = time.split(":").map(Number)
    const startMins = h * 60 + m
    const endMins = startMins + finalDuration
    
    const dayAppointments = store.getAppointmentsForDate(date).filter(a => a.employee_id === employeeId)
    
    let hasConflict = false
    for (const apt of dayAppointments) {
      const [ah, am] = apt.appointment_time.split(":").map(Number)
      const aptStart = ah * 60 + am
      const aptEnd = aptStart + (apt.duration_minutes || 0)
      
      if (startMins < aptEnd && endMins > aptStart) {
        hasConflict = true
        break
      }
    }

    if (hasConflict) {
      const confirmed = await confirm({
        title: "Conflito de Horário",
        message: "Já existe um evento nesse horário. Deseja continuar mesmo assim?",
        confirmText: "Continuar mesmo assim",
        cancelText: "Cancelar"
      })
      if (!confirmed) return
    }

    const endHour = Math.floor(endMins / 60)
    const endMin = endMins % 60
    const endTimeStr = `${String(endHour % 24).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`

    setSubmitting(true)
    try {
      await createDocument("appointments", {
        company_id: "default",
        type: "absence",
        status: "confirmed", // Use confirmed to ensure it renders normally
        employee_id: employeeId,
        employee_name: employee?.name || "Desconhecido",
        client_name: finalTitle, // We reuse client_name for the block title
        service_name: "Ausência",
        service_price: 0,
        appointment_date: date,
        appointment_time: time,
        end_time: endTimeStr,
        duration_minutes: finalDuration,
        notes: notes || null,
        client_id: null,
        client_phone: "",
        client_email: null,
        payment_method: null,
        payment_status: "pending",
        priority_color: "#f97316", // Laranja para ausência
      } as any)
      
      toast.success("Ausência registrada com sucesso!")
      onClose()
    } catch (err) {
      console.error(err)
      toast.error("Erro ao registrar ausência")
    }
    setSubmitting(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f3f9', background: '#fffaf5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle style={{ width: '20px', height: '20px', color: '#ea580c' }} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', fontWeight: 700, color: '#1e1e2d' }}>Registrar Ausência</h3>
              <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>
                {employee?.name} • {time}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', padding: '0.375rem', cursor: 'pointer' }}>
            <X style={{ width: '20px', height: '20px', color: '#94a3b8' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: '70vh' }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem' }}>Selecione o tipo de ausência:</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => setSelectedPreset(preset.id)}
                style={{
                  padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid',
                  borderColor: selectedPreset === preset.id ? '#f97316' : '#e2e8f0',
                  background: selectedPreset === preset.id ? '#fffaf5' : '#fff',
                  color: selectedPreset === preset.id ? '#ea580c' : '#475569',
                  fontWeight: selectedPreset === preset.id ? 700 : 500,
                  fontSize: '0.8125rem', cursor: 'pointer', transition: 'all 0.2s',
                  textAlign: 'center'
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {selectedPreset === "other" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.375rem' }}>Motivo / Título</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  placeholder="Ex: Ida ao médico"
                  style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.375rem' }}>Duração (minutos)</label>
                <input
                  type="number"
                  value={customDuration}
                  onChange={e => setCustomDuration(Number(e.target.value))}
                  min={5}
                  step={5}
                  style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem', outline: 'none' }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.375rem' }}>
              <FileText style={{ width: '12px', height: '12px' }} /> Observação (opcional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem', outline: 'none', resize: 'none' }}
              placeholder="Detalhes sobre a ausência..."
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f3f9', display: 'flex', gap: '0.75rem', background: '#fafbfc' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.625rem', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button 
            onClick={handleSave} 
            disabled={submitting || !selectedPreset}
            style={{ flex: 2, padding: '0.75rem', borderRadius: '0.625rem', border: 'none', background: '#f97316', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: submitting ? 'wait' : 'pointer', opacity: (submitting || !selectedPreset) ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(249,115,22,0.25)' }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Ausência"}
          </button>
        </div>
      </div>
      <ConfirmationDialog />
    </div>
  )
}
