"use client"

import { useState } from "react"
import { X, Unlock, FileText, Loader2 } from "lucide-react"
import { createDocument, createAppointmentLog } from "@/lib/firebase/client-utils"
import { useAgendaStore } from "./agenda-store"
import { useTenant } from "@/lib/auth/tenant-context"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"

interface Props {
  employeeId: string
  date: string
  time: string
  onClose: () => void
}

export function FreeSlotModal({ employeeId, date, time, onClose }: Props) {
  const store = useAgendaStore()
  const { saasUser } = useTenant()
  const [duration, setDuration] = useState(30)
  const [notes, setNotes] = useState("")
  
  const [submitting, setSubmitting] = useState(false)
  const { ConfirmationDialog, confirm } = useConfirm()

  const employee = store.employees.find(e => e.id === employeeId)

  const handleSave = async () => {
    if (duration <= 0) {
      toast.error("A duração deve ser maior que zero")
      return
    }

    // Check for conflicts
    const [h, m] = time.split(":").map(Number)
    const startMins = h * 60 + m
    const endMins = startMins + duration
    
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
        message: "Já existe um evento nesse horário. Deseja registrar a liberação mesmo assim?",
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
      const newApt: any = await createDocument("appointments", {
        company_id: "default",
        type: "free",
        status: "confirmed",
        employee_id: employeeId,
        employee_name: employee?.name || "Desconhecido",
        client_name: "Horário Liberado",
        service_name: "Liberação Manual",
        service_price: 0,
        appointment_date: date,
        appointment_time: time,
        end_time: endTimeStr,
        duration_minutes: duration,
        notes: notes || null,
        client_id: null,
        client_phone: "",
        client_email: null,
        payment_method: null,
        payment_status: "pending",
        priority_color: "#10b981", // Verde para livre
      } as any)
      
      const logMsg = `Exceção: O usuário ${saasUser?.name || "Sistema"} abriu excepcionalmente a agenda na folga do profissional ${employee?.name || "Desconhecido"}.`

      await createAppointmentLog(
        newApt.id,
        "created",
        "Liberação de Horário",
        logMsg,
        saasUser
      )

      import("@/lib/firebase/history-service").then(({ createHistoryEvent }) => {
        createHistoryEvent({
          client_id: null,
          client_name: "Horário Liberado",
          appointment_id: newApt.id,
          action_type: "created",
          action_title: "Liberação de Horário",
          action_description: logMsg,
          professional_id: employeeId,
          professional_name: employee?.name || "Desconhecido",
          performed_by_user_id: saasUser?.id || "system",
          performed_by_name: saasUser?.name || "Sistema",
          performed_by_email: saasUser?.email,
          performed_by_role: saasUser?.role
        }).catch(console.error)
      })
      
      toast.success("Horário liberado com sucesso!")
      onClose()
    } catch (err) {
      console.error(err)
      toast.error("Erro ao registrar liberação")
    }
    setSubmitting(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f3f9', background: '#f0fdf4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Unlock style={{ width: '20px', height: '20px', color: '#16a34a' }} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', fontWeight: 700, color: '#1e1e2d' }}>Liberar Horário</h3>
              <p style={{ fontSize: '0.6875rem', color: '#16a34a' }}>
                {employee?.name} • {time}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', padding: '0.375rem', cursor: 'pointer' }}>
            <X style={{ width: '20px', height: '20px', color: '#94a3b8' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.375rem' }}>Duração (minutos)</label>
              <input
                type="number"
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                min={5}
                step={5}
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
                placeholder="Detalhes..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f3f9', display: 'flex', gap: '0.75rem', background: '#fafbfc' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.625rem', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button 
            onClick={handleSave} 
            disabled={submitting}
            style={{ flex: 2, padding: '0.75rem', borderRadius: '0.625rem', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(22,163,74,0.25)' }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Liberar Horário"}
          </button>
        </div>
      </div>
      <ConfirmationDialog />
    </div>
  )
}
