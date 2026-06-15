"use client"

import { useState } from "react"
import { X, FileText, Lock, Loader2, Users, Unlock } from "lucide-react"
import { createDocument, deleteDocument } from "@/lib/firebase/client-utils"
import { createHistoryEvent } from "@/lib/firebase/history-service"
import { useAgendaStore } from "./agenda-store"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"
import { useTenant } from "@/lib/auth/tenant-context"

interface Props {
  onClose: () => void
}

const PRESETS = [
  { id: "15m", label: "15 minutos", duration: 15 },
  { id: "30m", label: "30 minutos", duration: 30 },
  { id: "45m", label: "45 minutos", duration: 45 },
  { id: "1h", label: "1 hora", duration: 60 },
  { id: "2h", label: "2 horas", duration: 120 },
  { id: "custom", label: "Personalizado", duration: 0 },
]

export function GlobalBlockModal({ onClose }: Props) {
  const store = useAgendaStore()
  const { saasUser } = useTenant()
  const [date, setDate] = useState(store.selectedDate)
  const [time, setTime] = useState("12:00")
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  
  // Custom form
  const [reason, setReason] = useState("")
  const [customHours, setCustomHours] = useState(0)
  const [customMinutes, setCustomMinutes] = useState(30)
  const [notes, setNotes] = useState("")
  
  const [submitting, setSubmitting] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const { ConfirmationDialog, confirm } = useConfirm()

  const handleSave = async () => {
    if (!selectedPreset) return toast.error("Selecione a duração do bloqueio")
    if (!reason.trim()) return toast.error("Informe o motivo do bloqueio")
    if (!date) return toast.error("Selecione a data do bloqueio")
    if (!time) return toast.error("Selecione o horário inicial do bloqueio")

    const preset = PRESETS.find(p => p.id === selectedPreset)!
    const finalDuration = preset.id === "custom" ? (customHours * 60 + customMinutes) : preset.duration
    
    if (finalDuration <= 0) return toast.error("A duração deve ser maior que zero")

    const activeEmployees = store.getActiveEmployees()
    if (activeEmployees.length === 0) return toast.error("Nenhum profissional ativo para bloquear.")

    // Check for conflicts
    const [h, m] = time.split(":").map(Number)
    const startMins = h * 60 + m
    const endMins = startMins + finalDuration
    
    const dayAppointments = store.getAppointmentsForDate(date)
    
    let hasConflict = false
    let conflictCount = 0
    for (const apt of dayAppointments) {
      // only check active employees' appointments
      if (!activeEmployees.some(e => e.id === apt.employee_id)) continue
      
      const [ah, am] = apt.appointment_time.split(":").map(Number)
      const aptStart = ah * 60 + am
      const aptEnd = aptStart + (apt.duration_minutes || 0)
      
      if (startMins < aptEnd && endMins > aptStart) {
        hasConflict = true
        conflictCount++
      }
    }

    if (hasConflict) {
      const confirmed = await confirm({
        title: "Conflito de Horário Geral",
        message: `Existem ${conflictCount} agendamento(s) nesse período. Os agendamentos existentes NÃO serão apagados, mas o horário será bloqueado impedindo novos cadastros.\n\nDeseja continuar com o bloqueio geral?`,
        confirmText: "Bloquear mesmo assim",
        cancelText: "Cancelar",
        variant: "danger"
      })
      if (!confirmed) return
    }

    const endHour = Math.floor(endMins / 60)
    const endMin = endMins % 60
    const endTimeStr = `${String(endHour % 24).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`

    setSubmitting(true)
    try {
      // Create block for each active employee
      for (const emp of activeEmployees) {
        // Prevent duplicate blocks
        const existingBlocks = dayAppointments.filter(a => a.employee_id === emp.id && a.type === "block" && a.appointment_time === time && a.duration_minutes === finalDuration)
        if (existingBlocks.length > 0) continue

        const blockData = {
          company_id: saasUser?.company_id || "default",
          type: "block",
          status: "confirmed",
          employee_id: emp.id,
          employee_name: emp.name,
          client_name: reason, // Reusing client_name for the block reason display
          service_name: "Bloqueio de Horário",
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
          priority_color: "#ef4444", // Red for block
          _bypass_conflict: true, // We already check conflict manually above
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        const newDoc = await createDocument("appointments", blockData) as any
        
        // Log to history
        await createHistoryEvent({
          appointment_id: newDoc.id,
          action_type: "block",
          action_title: "Bloqueio de Horário Geral",
          action_description: `Horário bloqueado para todos os profissionais. Motivo: ${reason}`,
          professional_id: emp.id,
          professional_name: emp.name,
          performed_by_user_id: saasUser?.id || "system",
          performed_by_name: saasUser?.name || "Sistema",
          performed_by_email: saasUser?.email || null,
          performed_by_role: saasUser?.role || "system",
          metadata: {
            start_time: time,
            end_time: endTimeStr,
            date: date,
            reason: reason,
            affected_professionals: activeEmployees.map(e => e.name)
          }
        })
      }
      
      toast.success("Horário bloqueado para todos com sucesso!")
      onClose()
    } catch (err) {
      console.error("Erro ao realizar bloqueio geral:", err)
      toast.error("Erro ao bloquear horário")
    }
    setSubmitting(false)
  }

  const handleUnlockAll = async () => {
    if (!selectedPreset) return toast.error("Selecione a duração do bloqueio para identificar o que será liberado")
    if (!date) return toast.error("Selecione a data")
    if (!time) return toast.error("Selecione o horário inicial")

    const preset = PRESETS.find(p => p.id === selectedPreset)!
    const finalDuration = preset.id === "custom" ? (customHours * 60 + customMinutes) : preset.duration
    
    if (finalDuration <= 0) return toast.error("A duração deve ser maior que zero")

    const dayAppointments = store.getAppointmentsForDate(date)
    
    // Find blocks matching the exact time and duration
    const blocksToDelete = dayAppointments.filter(a => 
      a.type === "block" && 
      a.appointment_time === time && 
      a.duration_minutes === finalDuration
    )

    if (blocksToDelete.length === 0) {
      return toast.error("Nenhum bloqueio encontrado com essas características neste dia/horário.")
    }

    const confirmed = await confirm({
      title: "Liberar Bloqueios",
      message: `Encontramos ${blocksToDelete.length} bloqueio(s) neste horário. Deseja excluir todos eles e liberar a agenda?`,
      confirmText: "Sim, Liberar Todos",
      cancelText: "Cancelar",
    })
    
    if (!confirmed) return

    setUnlocking(true)
    try {
      for (const block of blocksToDelete) {
        await deleteDocument("appointments", block.id)
        
        await createHistoryEvent({
          appointment_id: block.id,
          action_type: "unblock",
          action_title: "Liberação de Horário Geral",
          action_description: "Bloqueio removido pela ação de Liberação Geral.",
          professional_id: block.employee_id,
          professional_name: block.employee_name,
          performed_by_user_id: saasUser?.id || "system",
          performed_by_name: saasUser?.name || "Sistema",
          performed_by_email: saasUser?.email || null,
          performed_by_role: saasUser?.role || "system",
          metadata: {
            start_time: time,
            end_time: block.end_time || '-',
            date: date
          }
        })
      }
      toast.success("Horários liberados com sucesso!")
      onClose()
    } catch (err) {
      console.error("Erro ao liberar bloqueios:", err)
      toast.error("Erro ao liberar a agenda")
    }
    setUnlocking(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f3f9', background: '#fef2f2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock style={{ width: '20px', height: '20px', color: '#ef4444' }} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', fontWeight: 700, color: '#1e1e2d' }}>Bloquear para Todos</h3>
              <p style={{ fontSize: '0.6875rem', color: '#ef4444' }}>
                Todos os profissionais ativos
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', padding: '0.375rem', cursor: 'pointer' }}>
            <X style={{ width: '20px', height: '20px', color: '#94a3b8' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: '70vh' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.375rem' }}>Data</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.375rem' }}>Hora Inicial</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem', outline: 'none' }}
              />
            </div>
          </div>

          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem' }}>Selecione a duração:</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => setSelectedPreset(preset.id)}
                style={{
                  padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid',
                  borderColor: selectedPreset === preset.id ? '#ef4444' : '#e2e8f0',
                  background: selectedPreset === preset.id ? '#fef2f2' : '#fff',
                  color: selectedPreset === preset.id ? '#dc2626' : '#475569',
                  fontWeight: selectedPreset === preset.id ? 700 : 500,
                  fontSize: '0.8125rem', cursor: 'pointer', transition: 'all 0.2s',
                  textAlign: 'center'
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {selectedPreset === "custom" && (
              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.75rem' }}>Duração personalizada</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Horas</label>
                    <input
                      type="number"
                      value={customHours}
                      onChange={e => setCustomHours(Math.max(0, Number(e.target.value)))}
                      min={0}
                      style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Minutos</label>
                    <input
                      type="number"
                      value={customMinutes}
                      onChange={e => setCustomMinutes(Math.max(0, Math.min(59, Number(e.target.value))))}
                      min={0}
                      max={59}
                      style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem', outline: 'none' }}
                    />
                  </div>
                </div>
                {customHours === 0 && customMinutes === 0 && (
                  <p style={{ fontSize: '0.6875rem', color: '#ef4444', marginTop: '0.5rem' }}>A duração total deve ser maior que zero.</p>
                )}
              </div>
            )}
            
            {(() => {
              const currentDuration = selectedPreset === "custom" 
                ? (customHours * 60 + customMinutes) 
                : (PRESETS.find(p => p.id === selectedPreset)?.duration || 0);
              
              if (currentDuration > 0 && time) {
                const [h, m] = time.split(":").map(Number);
                if (!isNaN(h) && !isNaN(m)) {
                  const currentEndMins = (h * 60 + m) + currentDuration;
                  const endHour = Math.floor(currentEndMins / 60);
                  const endMin = currentEndMins % 60;
                  const currentEndTimeStr = `${String(endHour % 24).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;
                  
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #fca5a5' }}>
                      <span style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600 }}>Horário final previsto:</span>
                      <span style={{ fontSize: '0.875rem', color: '#991b1b', fontWeight: 800 }}>{currentEndTimeStr}</span>
                    </div>
                  );
                }
              }
              return null;
            })()}
            
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.375rem' }}>Motivo do Bloqueio Geral</label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Ex: Treinamento, Dedetização, etc."
                style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem', outline: 'none' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.375rem' }}>
                <FileText style={{ width: '12px', height: '12px' }} /> Observação (opcional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem', outline: 'none', resize: 'none' }}
                placeholder="Detalhes adicionais..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f3f9', display: 'flex', gap: '0.75rem', background: '#fafbfc' }}>
          <button 
            onClick={handleUnlockAll} 
            disabled={unlocking || submitting}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '0.625rem', border: '1px solid #10b981', background: '#ecfdf5', color: '#10b981', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#d1fae5'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#ecfdf5'
            }}
          >
            {unlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Unlock className="w-4 h-4" /> Liberar Todos</>}
          </button>
          <button 
            onClick={handleSave} 
            disabled={submitting || unlocking || !selectedPreset || !time || !date}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '0.625rem', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: submitting ? 'wait' : 'pointer', opacity: (submitting || !selectedPreset || !time || !date) ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(239,68,68,0.25)' }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Bloquear Todos"}
          </button>
        </div>
      </div>
      <ConfirmationDialog />
    </div>
  )
}
