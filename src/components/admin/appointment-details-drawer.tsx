"use client"
import { useState, useEffect, useRef } from "react"
import { X, Phone, Scissors, User, Calendar, Clock, DollarSign, FileText, Tag, Plus, Check, Trash2, Loader2, AlertTriangle } from "lucide-react"
import type { Appointment, Employee, AppointmentLabel, AppointmentLog } from "@/lib/types/database"
import { formatCurrency, formatPhone } from "@/lib/utils"
import { updateAppointment, fetchCollectionWhere, deleteDocument, deleteAppointment } from "@/lib/firebase/client-utils"
import { useTenant } from "@/lib/auth/tenant-context"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"
import { CloseAccountModal } from "./close-account-modal"
import { ClientHistorySummary } from "./agenda/client-history-summary"
import { useAgendaStore } from "./agenda/agenda-store"

const getSafeDisplayName = (log: any) => {
  const isMaster = log.user_email === 'carbeto34@gmail.com' || log.user_email === 'alphaeventosbsb@gmail.com';
  const nameLower = (log.user_name || "").toLowerCase();

  if (nameLower.includes('katia')) {
    if (log.user_email === 'alphaeventosbsb@gmail.com') return 'Alpha / Admin';
    return 'Carbeto / Admin';
  }

  if (isMaster) {
     return log.user_email === 'carbeto34@gmail.com' ? 'Carbeto / Admin' : 'Alpha / Admin';
  }

  return log.user_name || log.user_email || 'Sistema';
}

const statusCfg: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: "Pendente", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  confirmed: { label: "Marcado", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  waiting: { label: "Em espera", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  in_progress: { label: "Em atendimento", color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  completed: { label: "Concluído", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  payment_pending: { label: "Aguard. pagamento", color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
  closed: { label: "Fechado", color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
  cancelled: { label: "Cancelado", color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
  no_show: { label: "Não compareceu", color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
}

const actionButtons = [
  { status: "confirmed", label: "Marcar como Esperando", targetStatus: "waiting", gradient: "linear-gradient(135deg,#ea580c,#f97316)", shadow: "rgba(234,88,12,0.25)" },
  { status: "pending", label: "Marcar como Esperando", targetStatus: "waiting", gradient: "linear-gradient(135deg,#ea580c,#f97316)", shadow: "rgba(234,88,12,0.25)" },
  { status: "waiting", label: "Iniciar Atendimento", targetStatus: "in_progress", gradient: "linear-gradient(135deg,#0891b2,#22d3ee)", shadow: "rgba(8,145,178,0.25)" },
  { status: "in_progress", label: "Concluir e Fechar Pagamento", targetStatus: "completed", gradient: "linear-gradient(135deg,#059669,#34d399)", shadow: "rgba(5,150,105,0.25)" },
]

interface Props {
  appointment: Appointment
  employees: Employee[]
  labels: AppointmentLabel[]
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
  onAction: (action: string, apt: Appointment) => void
  onLabelsChange: () => void
}

export function AppointmentDetailsDrawer({ appointment, employees, labels, onClose, onStatusChange, onAction, onLabelsChange }: Props) {
  const sc = statusCfg[appointment.status] || statusCfg.pending
  const emp = employees.find(e => e.id === appointment.employee_id)
  const quickAction = actionButtons.find(a => a.status === appointment.status)
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [activeTab, setActiveTab] = useState<"details" | "history">("details")
  const store = useAgendaStore()
  const { saasUser } = useTenant()
  const { ConfirmationDialog, confirm } = useConfirm()
  
  const client = store.clients.find(c => c.id === appointment.client_id)
  const isFinished = ["closed", "completed", "payment_pending"].includes(appointment.status)
  const isSpecial = appointment.type === 'absence' || appointment.type === 'free' || appointment.type === 'block'

  const [logs, setLogs] = useState<AppointmentLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  useEffect(() => {
    if (activeTab === "history" && !isSpecial) {
      setLoadingLogs(true)
      Promise.all([
        fetchCollectionWhere<AppointmentLog>("appointment_logs", "appointment_id", "==", appointment.id),
        import("@/lib/firebase/history-service").then(m => m.getAppointmentHistory(appointment.id))
      ]).then(([legacyLogs, newLogs]) => {
        const formattedNewLogs: AppointmentLog[] = newLogs.map((l: any) => ({
          id: l.id,
          appointment_id: l.appointment_id || "",
          action_type: l.action_type,
          action_label: l.action_title,
          description: l.action_description,
          user_id: l.performed_by_user_id,
          user_name: l.performed_by_name,
          user_email: l.performed_by_email,
          user_role: l.performed_by_role || "system",
          created_at: l.created_at
        }))
        const merged = [...legacyLogs, ...formattedNewLogs]
        // Remove duplicates if any (just in case)
        const unique = Array.from(new Map(merged.map(item => [item.id, item])).values())
        setLogs(unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
        setLoadingLogs(false)
      }).catch(err => {
        console.error(err)
        setLoadingLogs(false)
      })
    }
  }, [activeTab, appointment.id, isSpecial])

  const currentLabelIds = appointment.label_ids || []
  const appliedLabels = labels.filter(l => currentLabelIds.includes(l.id))

  let isBirthdayMonth = false
  let birthDateFormatted = ''
  
  if (!isSpecial && client?.birth_date && appointment.appointment_date) {
    const birthParts = client.birth_date.split('-')
    const aptParts = appointment.appointment_date.split('-')
    if (birthParts.length >= 3 && aptParts.length >= 3) {
      const birthMonth = birthParts[1]
      const aptMonth = aptParts[1]
      if (birthMonth === aptMonth) {
        isBirthdayMonth = true
        birthDateFormatted = `${birthParts[2]}/${birthParts[1]}`
      }
    }
  }

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const toggleLabel = async (labelId: string) => {
    const current = appointment.label_ids || []
    const newIds = current.includes(labelId) ? current.filter(id => id !== labelId) : [...current, labelId]
    try {
      await updateAppointment(
        appointment.id,
        { label_ids: newIds },
        newIds.includes(labelId) ? "tag_added" : "tag_removed",
        "Etiqueta alterada",
        newIds.includes(labelId) ? `Etiqueta adicionada.` : `Etiqueta removida.`,
        saasUser
      )
      appointment.label_ids = newIds
      onLabelsChange()
    } catch {
      toast.error("Erro ao atualizar etiquetas")
    }
  }

  const handleRemoveExtraService = async (index: number) => {
    if (!appointment.additional_services) return

    const confirmed = await confirm({
      title: "Remover Serviço Adicional?",
      message: "Tem certeza que deseja remover este serviço adicional do agendamento?",
      confirmText: "Sim, remover",
      cancelText: "Cancelar"
    })
    if (!confirmed) return

    try {
      const services = [...appointment.additional_services]
      const removedSvc = services.splice(index, 1)[0]
      
      const newTotalPrice = Math.max(0, appointment.service_price - removedSvc.price)
      const newTotalDuration = Math.max(0, appointment.duration_minutes - removedSvc.duration_minutes)
      
      let newEndTime = appointment.end_time
      if (appointment.end_time && appointment.appointment_time) {
        const [h, m] = appointment.appointment_time.split(":").map(Number)
        const totalMin = h * 60 + m + newTotalDuration
        const newH = Math.floor(totalMin / 60)
        const newM = totalMin % 60
        newEndTime = `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`
      }

      await updateAppointment(
        appointment.id,
        {
          additional_services: services,
          service_price: newTotalPrice,
          duration_minutes: newTotalDuration,
          end_time: newEndTime,
        },
        "service_removed",
        "Serviço removido",
        `Serviço adicional removido: ${removedSvc.service_name}`,
        saasUser
      )
      
      store.setSelectedAppointment({
        ...appointment,
        additional_services: services,
        service_price: newTotalPrice,
        duration_minutes: newTotalDuration,
        end_time: newEndTime
      })
      
      toast.success("Serviço removido com sucesso")
    } catch {
      toast.error("Erro ao remover serviço")
    }
  }

  const sharedAppointments = appointment.is_shared_service && appointment.shared_group_id
    ? store.appointments.filter(a => a.shared_group_id === appointment.shared_group_id && a.id !== appointment.id)
    : []

  const handleRemoveSharedAppointment = async (sharedApt: Appointment) => {
    const confirmed = await confirm({
      title: "Remover Profissional Extra?",
      message: `Tem certeza que deseja remover o(a) profissional ${sharedApt.employee_name} e seu respectivo serviço do agendamento?`,
      confirmText: "Sim, remover",
      cancelText: "Cancelar"
    })
    if (!confirmed) return

    try {
      await deleteAppointment(sharedApt.id, saasUser, {
        client_id: sharedApt.client_id || undefined,
        client_name: sharedApt.client_name || undefined,
        service_id: sharedApt.service_id || undefined,
        service_name: sharedApt.service_name || undefined,
        professional_id: sharedApt.employee_id || undefined,
        professional_name: sharedApt.employee_name || undefined
      })
      
      const remainingApts = store.appointments.filter(a => a.shared_group_id === sharedApt.shared_group_id && a.id !== sharedApt.id)
      
      if (remainingApts.length === 1) {
        const remaining = remainingApts[0]
        const originalTotal = (sharedApt.service_total_value || 0) + (remaining.service_price || 0)
        await updateAppointment(
          remaining.id,
          {
            is_shared_service: false,
            shared_group_id: null,
            service_total_value: null,
            professional_service_value: null,
            service_price: originalTotal
          },
          "updated",
          "Agendamento individualizado",
          "O serviço compartilhado foi removido.",
          saasUser
        )
        if (remaining.id === appointment.id) {
          store.setSelectedAppointment({
            ...remaining,
            is_shared_service: false,
            shared_group_id: null,
            service_total_value: null,
            professional_service_value: null,
            service_price: originalTotal
          })
        }
      } else if (remainingApts.length > 1) {
        const newPrice = (sharedApt.service_total_value || 0) / remainingApts.length
        for (const rApt of remainingApts) {
          const newProfessionalValue = (rApt.service_price || 0) + newPrice
          await updateAppointment(
            rApt.id,
            {
              service_price: newProfessionalValue,
              professional_service_value: newProfessionalValue
            },
            "updated",
            "Valor reajustado",
            `O valor do serviço foi reajustado após exclusão de parte compartilhada.`,
            saasUser
          )
        }
        const updatedCurrent = remainingApts.find(a => a.id === appointment.id)
        if (updatedCurrent) {
          const newProfessionalValue = (updatedCurrent.service_price || 0) + newPrice
          store.setSelectedAppointment({
            ...updatedCurrent,
            service_price: newProfessionalValue,
            professional_service_value: newProfessionalValue
          })
        }
      }

      toast.success("Profissional removido com sucesso")
    } catch (err) {
      toast.error("Erro ao remover profissional")
    }
  }

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
        zIndex: 9998, animation: 'modalFadeIn 0.2s ease-out',
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem', pointerEvents: 'none',
      }}>
        <div ref={modalRef} style={{
          background: '#fff', borderRadius: '1.5rem', width: '100%', maxWidth: '680px', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column', pointerEvents: 'auto',
          boxShadow: '0 25px 80px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.1)',
          animation: 'modalScaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          overflow: 'hidden',
        }}>
          {/* ─── Header ──────────────────────────────────────── */}
          <div style={{
            padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f3f9', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(180deg, #faf8ff 0%, #fff 100%)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: 1, minWidth: 0 }}>
              <div style={{
                width: '3rem', height: '3rem', borderRadius: '1rem',
                background: 'linear-gradient(135deg,#7c5cfc,#a78bfa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '1.125rem', fontWeight: 800, flexShrink: 0,
                boxShadow: '0 4px 12px rgba(124,92,252,0.3)',
              }}>
                {appointment.client_name.charAt(0)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 700, color: '#1e1e2d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {appointment.client_name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  <span style={{
                    fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.5rem', borderRadius: '999px',
                    background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                  }}>
                    {sc.label}
                  </span>
                  {appointment.source === 'online' && (
                    <span style={{
                      fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.5rem', borderRadius: '999px',
                      background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                      display: 'flex', alignItems: 'center', gap: '0.25rem'
                    }}>
                      <span style={{ fontSize: '0.75rem' }}>🌐</span> Agendamento Online
                    </span>
                  )}
                  {appointment.is_shared_service && (
                    <span style={{
                      fontSize: '0.625rem', fontWeight: 800, padding: '0.125rem 0.5rem', borderRadius: '999px',
                      background: '#f5f3ff', color: '#7c5cfc', border: '1px solid #e0d4ff', whiteSpace: 'nowrap'
                    }}>
                      MULTI-PROFISSIONAL
                    </span>
                  )}
                  {appliedLabels.slice(0, 3).map(l => (
                    <span key={l.id} style={{
                      fontSize: '0.5625rem', fontWeight: 700, padding: '0.125rem 0.375rem', borderRadius: '999px',
                      background: l.color + '18', color: l.color, border: `1px solid ${l.color}33`,
                    }}>
                      {l.name}
                    </span>
                  ))}
                  {appliedLabels.length > 3 && (
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7' }}>+{appliedLabels.length - 3}</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{
              padding: '0.5rem', borderRadius: '0.625rem', border: 'none', background: '#f1f3f9',
              cursor: 'pointer', display: 'flex', flexShrink: 0, transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#e8ecf4' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f1f3f9' }}
            >
              <X style={{ width: '18px', height: '18px', color: '#8b8fa7' }} />
            </button>
          </div>

          {/* Tabs */}
          {!isSpecial && (
            <div style={{ display: 'flex', borderBottom: '1px solid #eef0f6', padding: '0 1.5rem' }}>
              <button onClick={() => setActiveTab("details")} style={{
                padding: '0.875rem 1rem', background: 'transparent', border: 'none', borderBottom: activeTab === "details" ? '2px solid #7c5cfc' : '2px solid transparent',
                color: activeTab === "details" ? '#7c5cfc' : '#8b8fa7', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>Detalhes</button>
              <button onClick={() => setActiveTab("history")} style={{
                padding: '0.875rem 1rem', background: 'transparent', border: 'none', borderBottom: activeTab === "history" ? '2px solid #7c5cfc' : '2px solid transparent',
                color: activeTab === "history" ? '#7c5cfc' : '#8b8fa7', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>Histórico</button>
            </div>
          )}

          {/* ─── Body ────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {activeTab === "history" ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1e1e2d' }}>Log de Atividades</h4>
                
                {loadingLogs ? (
                  <div style={{ padding: '2rem', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                    <Loader2 style={{ width: '1.5rem', height: '1.5rem', color: '#7c5cfc', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : logs.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: '#8b8fa7', textAlign: 'center', padding: '2rem' }}>Nenhum log encontrado para este agendamento.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {logs.map(log => (
                      <div key={log.id} style={{
                        background: '#fafbfc', borderRadius: '0.75rem', padding: '0.875rem', border: '1px solid #e8ecf4',
                        display: 'flex', flexDirection: 'column', gap: '0.375rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#4c1d95', background: '#f5f3ff', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>
                            {log.action_label}
                          </span>
                          <span style={{ fontSize: '0.625rem', color: '#8b8fa7', fontWeight: 600 }}>
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#1e1e2d', fontWeight: 500, lineHeight: 1.4 }}>{log.description}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}>
                          <User style={{ width: '12px', height: '12px', color: '#8b8fa7' }} />
                          <span style={{ fontSize: '0.625rem', color: '#8b8fa7', fontWeight: 600 }}>
                            {getSafeDisplayName(log)} {log.user_role ? `(${log.user_role})` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (<>
              {isBirthdayMonth && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.625rem 0.875rem', borderRadius: '0.75rem',
                background: '#fdf4ff', border: '1px solid #fbcfe8',
              }}>
                <span style={{ fontSize: '1.125rem' }}>🎂</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#be185d' }}>
                  Aniversariante do mês
                </span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#9d174d', marginLeft: 'auto' }}>
                  {birthDateFormatted}
                </span>
              </div>
            )}

            {isSpecial ? (
              // ── ABSENCE / FREE SLOT VISUALIZATION ──
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: '#fafbfc', borderRadius: '0.875rem', padding: '1rem', border: '1px solid #e8ecf4' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e1e2d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <AlertTriangle style={{ width: '14px', height: '14px', color: '#7c5cfc' }} /> Detalhes do Evento
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Tipo</p>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>
                        {appointment.type === 'block' ? 'Horário Bloqueado' : appointment.type === 'absence' ? 'Ausência' : 'Liberação de Horário'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Motivo</p>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{appointment.client_name}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Profissional</p>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{emp?.name || appointment.employee_name}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Data / Horário</p>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>
                        {appointment.appointment_date.split("-").reverse().join("/")} às {appointment.appointment_time}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Duração</p>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{appointment.duration_minutes} minutos</p>
                    </div>
                    {appointment.created_at && (
                      <div>
                        <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Criado em</p>
                        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{new Date(appointment.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                    )}
                  </div>
                  {appointment.notes && (
                    <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                      <p style={{ fontSize: '0.5625rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Observações</p>
                      <p style={{ fontSize: '0.75rem', color: '#334155' }}>{appointment.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : isFinished ? (
              // ── COMPLETED/PAID APPOINTMENT VISUALIZATION ──
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Client Data */}
                <div style={{ background: '#fafbfc', borderRadius: '0.875rem', padding: '1rem', border: '1px solid #e8ecf4' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e1e2d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <User style={{ width: '14px', height: '14px', color: '#7c5cfc' }} /> Dados do Cliente
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Nome</p>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{appointment.client_name}</p>
                    </div>
                    {client?.cpf && (
                      <div>
                        <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>CPF</p>
                        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>
                          ***.{client.cpf.slice(4, 7)}.{client.cpf.slice(8, 11)}-**
                        </p>
                      </div>
                    )}
                    <div>
                      <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Telefone</p>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>
                        {appointment.client_phone ? `(***) *****-${appointment.client_phone.slice(-4)}` : 'Não informado'}
                      </p>
                    </div>
                    {appointment.client_email && (
                      <div>
                        <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>E-mail</p>
                        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>
                          {appointment.client_email.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => {
                            return gp2 + gp3.replace(/./g, '*')
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                  {client?.notes && (
                    <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#fffbeb', borderRadius: '0.5rem', border: '1px solid #fde68a' }}>
                      <p style={{ fontSize: '0.5625rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Observações do Cliente</p>
                      <p style={{ fontSize: '0.75rem', color: '#92400e' }}>{client.notes}</p>
                    </div>
                  )}
                </div>

                {/* Appointment Data */}
                <div style={{ background: '#fafbfc', borderRadius: '0.875rem', padding: '1rem', border: '1px solid #e8ecf4' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e1e2d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Calendar style={{ width: '14px', height: '14px', color: '#7c5cfc' }} /> Dados do Agendamento
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Profissional Principal</p>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{emp?.name || appointment.employee_name || "Não definido"}</p>
                    </div>
                    {sharedAppointments.length > 0 && sharedAppointments.map(sApt => (
                      <div key={sApt.id}>
                        <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Profissional Extra</p>
                        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{sApt.employee_name} ({sApt.service_name})</p>
                      </div>
                    ))}
                    <div>
                      <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Serviço</p>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{appointment.service_name}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Data / Hora</p>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>
                        {appointment.appointment_date.split("-").reverse().join("/")} às {appointment.appointment_time}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Duração</p>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{appointment.duration_minutes} minutos</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Forma Pagamento</p>
                      {(() => {
                        const dict: Record<string, string> = {
                          cash: 'Dinheiro', pix: 'PIX', credit_card: 'Crédito', debit_card: 'Débito', transfer: 'Transferência', courtesy: 'Cortesia', client_credit: 'Crédito do Cliente', multiple: 'Pagamento misto', mixed: 'Pagamento misto', other: 'Outro'
                        }
                        
                        const splits = (appointment.payment_splits || []).filter((s: any) => Number(String(s.amount || "").replace(",", ".")) > 0 || s.method === "courtesy")
                        
                        if (splits.length > 1) {
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                              <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>Pagamento misto</p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', paddingLeft: '0.25rem', borderLeft: '2px solid #e8ecf4' }}>
                                {splits.map((s: any, idx: number) => (
                                  <p key={idx} style={{ fontSize: '0.6875rem', color: '#4b5563', display: 'flex', justifyContent: 'space-between', paddingLeft: '0.375rem' }}>
                                    <span>{dict[s.method] || s.method}:</span>
                                    <span style={{ fontWeight: 600 }}>{formatCurrency(Number(String(s.amount || "").replace(",", ".")) || 0)}</span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          )
                        } else if (splits.length === 1) {
                          return <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{dict[splits[0].method] || splits[0].method}</p>
                        } else if (appointment.payment_method) {
                          return <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{dict[appointment.payment_method] || appointment.payment_method}</p>
                        } else {
                          return <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>Não informado</p>
                        }
                      })()}
                    </div>
                    <div>
                      <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Status Pagamento</p>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>
                        {appointment.payment_status === 'paid' ? 'Pago' :
                         appointment.payment_status === 'partial' ? 'Parcial' :
                         appointment.payment_status === 'refunded' ? 'Estornado' : 'Pendente'}
                      </p>
                    </div>
                  </div>
                  {appointment.notes && (
                    <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#f5f3ff', borderRadius: '0.5rem', border: '1px solid #ddd6fe' }}>
                      <p style={{ fontSize: '0.5625rem', color: '#6d28d9', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Observações do Agendamento</p>
                      <p style={{ fontSize: '0.75rem', color: '#6d28d9' }}>{appointment.notes}</p>
                    </div>
                  )}
                </div>

                {/* Financial & History */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                  <div style={{ background: '#fafbfc', borderRadius: '0.875rem', padding: '1rem', border: '1px solid #e8ecf4' }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e1e2d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <DollarSign style={{ width: '14px', height: '14px', color: '#059669' }} /> Dados Financeiros
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', color: '#8b8fa7' }}>Valor do Serviço</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e1e2d' }}>{formatCurrency(appointment.service_price)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f3f9', paddingTop: '0.375rem', marginTop: '0.125rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#8b8fa7', fontWeight: 700 }}>Total Pago</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669' }}>{formatCurrency(appointment.service_price)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ background: '#fafbfc', borderRadius: '0.875rem', padding: '1rem', border: '1px solid #e8ecf4' }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e1e2d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Clock style={{ width: '14px', height: '14px', color: '#3b82f6' }} /> Histórico
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div>
                        <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Criação</p>
                        <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#1e1e2d' }}>
                          {new Date(appointment.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 700, textTransform: 'uppercase' }}>Última Atualização / Finalização</p>
                        <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#1e1e2d' }}>
                          {new Date(appointment.updated_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // ── ONGOING APPOINTMENT VISUALIZATION ──
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', minHeight: 0 }}>
                {/* Left Column: Flow */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: '1px solid #f1f3f9', paddingRight: '1rem' }}>
                  {!isSpecial && quickAction && (
                    <button onClick={() => onStatusChange(appointment.id, quickAction.targetStatus)} style={{
                      width: '100%', padding: '0.875rem', borderRadius: '0.75rem', border: 'none', color: '#fff', fontWeight: 700,
                      fontSize: '0.875rem', cursor: 'pointer', background: quickAction.gradient,
                      boxShadow: `0 4px 14px ${quickAction.shadow}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      transition: 'transform 0.15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.01)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
                    >
                      {quickAction.label}
                    </button>
                  )}

                  {!isSpecial && (
                    <div style={{ background: '#fafbfc', borderRadius: '0.875rem', padding: '1rem', border: '1px solid #e8ecf4' }}>
                      {[
                        { icon: Phone, label: "Telefone", value: formatPhone(appointment.client_phone) },
                        { icon: Scissors, label: "Serviço", value: appointment.service_name, isClickable: true, clickTooltip: "Clique para editar o serviço" },
                        ...(appointment.additional_services || []).map((svc, i) => ({
                          icon: Plus, label: `Serviço Extra`, value: svc.service_name, isExtra: true, svcIndex: i, isRepeated: svc.is_repeated
                        })),
                        { icon: User, label: "Profissional Principal", value: emp?.name || appointment.employee_name || "Não definido", isClickable: true, clickTooltip: "Clique para editar o profissional" },
                        ...sharedAppointments.map((sApt) => ({
                          icon: User, label: `Profissional Extra`, value: `${sApt.employee_name} (${sApt.service_name})`, isShared: true, sharedApt: sApt
                        })),
                        { icon: Calendar, label: "Data", value: appointment.appointment_date.split("-").reverse().join("/") },
                        { icon: Clock, label: "Horário", value: `${appointment.appointment_time}${appointment.end_time ? ` → ${appointment.end_time}` : ""}` },
                        { icon: Clock, label: "Duração", value: `${appointment.duration_minutes} min` },
                        { icon: DollarSign, label: "Valor Total", value: formatCurrency(appointment.service_price) },
                      ].map((item, i, arr) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0', borderBottom: i < arr.length - 1 ? '1px solid #eef0f6' : 'none' }}>
                          <div style={{ width: '1.625rem', height: '1.625rem', borderRadius: '0.375rem', background: '#f0ecff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <item.icon style={{ width: '0.8125rem', height: '0.8125rem', color: '#7c5cfc' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</p>
                              {(item as any).isClickable ? (
                                <p
                                  title={(item as any).clickTooltip}
                                  onClick={() => { onClose(); onAction("edit_appointment", appointment) }}
                                  style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#7c5cfc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                                  onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
                                  onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
                                >
                                  {item.value}
                                </p>
                              ) : (
                                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                                  {item.value}
                                  {(item as any).isRepeated && (
                                    <span style={{ marginLeft: '0.375rem', fontSize: '0.5625rem', background: '#e0e7ff', color: '#4338ca', padding: '0.125rem 0.25rem', borderRadius: '4px', fontWeight: 700 }}>
                                      Repetido
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                            {((item as any).isExtra) && !isFinished && (
                              <button onClick={() => handleRemoveExtraService((item as any).svcIndex)} style={{
                                background: '#fee2e2', border: 'none', width: '24px', height: '24px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                              }}>
                                <Trash2 style={{ width: '12px', height: '12px', color: '#ef4444' }} />
                              </button>
                            )}
                            {((item as any).isShared) && !isFinished && (
                              <button onClick={() => handleRemoveSharedAppointment((item as any).sharedApt)} style={{
                                background: '#fee2e2', border: 'none', width: '24px', height: '24px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                              }}>
                                <Trash2 style={{ width: '12px', height: '12px', color: '#ef4444' }} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Labels + Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Labels */}
                  <div style={{ background: '#fafbfc', borderRadius: '0.75rem', padding: '0.75rem', border: '1px solid #e8ecf4' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Tag style={{ width: '0.75rem', height: '0.75rem', color: '#7c5cfc' }} />
                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#1e1e2d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Etiquetas</span>
                      </div>
                      <button onClick={() => setShowLabelPicker(!showLabelPicker)} style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.4rem', borderRadius: '0.375rem',
                        border: 'none', background: showLabelPicker ? '#f0ecff' : 'transparent', color: '#7c5cfc', fontSize: '0.5625rem',
                        fontWeight: 700, cursor: 'pointer',
                      }}>
                        <Plus style={{ width: '10px', height: '10px' }} /> {showLabelPicker ? 'Fechar' : 'Adicionar'}
                      </button>
                    </div>

                    {appliedLabels.length > 0 ? (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: showLabelPicker ? '0.5rem' : 0 }}>
                        {appliedLabels.map(l => (
                          <span key={l.id} onClick={() => toggleLabel(l.id)} style={{
                            fontSize: '0.625rem', fontWeight: 600, padding: '0.2rem 0.4rem', borderRadius: '999px',
                            background: l.color + '18', color: l.color, border: `1px solid ${l.color}33`, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.2rem',
                          }}>
                            {l.name} <X style={{ width: '9px', height: '9px', opacity: 0.6 }} />
                          </span>
                        ))}
                      </div>
                    ) : !showLabelPicker && (
                      <p style={{ fontSize: '0.625rem', color: '#9ca3af' }}>Nenhuma etiqueta</p>
                    )}

                    {showLabelPicker && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '130px', overflowY: 'auto' }}>
                        {labels.length === 0 ? (
                          <p style={{ fontSize: '0.625rem', color: '#9ca3af', padding: '0.25rem 0' }}>Nenhuma etiqueta criada.</p>
                        ) : labels.map(l => {
                          const isApplied = currentLabelIds.includes(l.id)
                          return (
                            <button key={l.id} onClick={() => toggleLabel(l.id)} style={{
                              display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.4rem', borderRadius: '0.375rem',
                              border: isApplied ? `1px solid ${l.color}55` : '1px solid transparent',
                              background: isApplied ? l.color + '10' : 'transparent',
                              cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600, color: '#1e1e2d', textAlign: 'left', width: '100%',
                            }}
                              onMouseEnter={e => { if (!isApplied) e.currentTarget.style.background = '#f5f3ff' }}
                              onMouseLeave={e => { if (!isApplied) e.currentTarget.style.background = 'transparent' }}
                            >
                              <div style={{ width: '0.625rem', height: '0.625rem', borderRadius: '0.2rem', background: l.color, flexShrink: 0 }} />
                              <span style={{ flex: 1 }}>{l.name}</span>
                              {isApplied && <Check style={{ width: '12px', height: '12px', color: l.color }} />}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* History */}
                  {appointment.client_id && (
                    <ClientHistorySummary clientId={appointment.client_id} clientName={appointment.client_name || ""} />
                  )}

                  {/* Notes */}
                  {appointment.notes && (
                    <div style={{ background: '#fffbeb', borderRadius: '0.75rem', padding: '0.75rem', border: '1px solid #fde68a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                        <FileText style={{ width: '0.6875rem', height: '0.6875rem', color: '#d97706' }} />
                        <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Observações</span>
                      </div>
                      <p style={{ fontSize: '0.8125rem', color: '#92400e', lineHeight: 1.5 }}>{appointment.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            </>)}
          </div>

          {/* ─── Footer ──────────────────────────────────────── */}
          <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f3f9', display: 'flex', gap: '0.75rem' }}>
            {isSpecial ? (
              <button onClick={() => {
                if (appointment.type === 'block') {
                  confirm({
                    title: "Liberar horário?",
                    message: "Deseja liberar este horário bloqueado? Após liberar, ele ficará disponível para novos agendamentos.",
                    confirmText: "Sim, liberar horário",
                    cancelText: "Cancelar"
                  }).then(res => {
                    if (res) onAction('delete', appointment)
                  })
                } else {
                  setShowDeleteConfirm(true)
                }
              }} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.625rem', border: '1px solid #fecaca', background: '#fff', color: '#ef4444', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                {appointment.type === 'block' ? 'Liberar Horário' : 'Excluir'}
              </button>
            ) : isFinished ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={async () => {
                  const confirmed = await confirm({
                    title: "Editar Agendamento Finalizado",
                    message: "Este agendamento já está finalizado. Deseja editar mesmo assim?",
                    confirmText: "Editar mesmo assim",
                    cancelText: "Cancelar"
                  })
                  if (confirmed) {
                    onClose()
                    onAction('reschedule', appointment)
                  }
                }} style={{
                  flex: '1 1 auto', padding: '0.5rem 0.625rem', borderRadius: '0.5rem', border: '1px solid #e8ecf4',
                  fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer',
                  background: '#fff', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                }}>
                  <Clock style={{ width: '14px', height: '14px' }} /> Editar Agendamento
                </button>
                <button onClick={() => setShowDeleteConfirm(true)} style={{
                  padding: '0.5rem 0.625rem', borderRadius: '0.5rem', border: 'none',
                  fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', background: '#fef2f2', color: '#ef4444',
                }}>
                  Excluir
                </button>
              </div>
            ) : (
              <>
                {/* Status action grid */}
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {[
                    { id: "waiting", label: "Em Espera", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
                    { id: "in_progress", label: "Em Atendimento", color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
                    { id: "completed", label: "Concluir / Fechar Pgto", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
                    { id: "cancelled", label: "Cancelar", color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
                  ].filter(s => s.id !== appointment.status).map(s => (
                    <button key={s.id} onClick={() => onStatusChange(appointment.id, s.id)} style={{
                      flex: '1 1 auto', padding: '0.5rem 0.5rem', borderRadius: '0.5rem', fontSize: '0.625rem', fontWeight: 700,
                      color: s.color, background: s.bg, border: `1px solid ${s.border}`, cursor: 'pointer', transition: 'all 0.15s',
                      whiteSpace: 'nowrap', minWidth: '80px', textAlign: 'center',
                    }}>
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Extra actions row */}
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  <button onClick={() => onAction("close_account", appointment)} style={{
                    flex: '1 1 auto', padding: '0.5rem 0.625rem', borderRadius: '0.5rem', border: 'none',
                    fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer',
                    background: 'linear-gradient(135deg,#f0ecff,#e8e0ff)', color: '#7c5cfc',
                  }}>
                    💰 Fechar Pagamento
                  </button>
                  <button onClick={() => { onClose(); onAction("reschedule", appointment) }} style={{
                    padding: '0.5rem 0.625rem', borderRadius: '0.5rem', border: 'none',
                    fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', background: '#f8fafc', color: '#64748b',
                  }}>
                    Reagendar
                  </button>
                  <button onClick={() => onStatusChange(appointment.id, "no_show")} style={{
                    padding: '0.5rem 0.625rem', borderRadius: '0.5rem', border: 'none',
                    fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', background: '#f3f4f6', color: '#6b7280',
                  }}>
                    Faltou
                  </button>
                  <button onClick={() => { onClose(); onAction("add_service", appointment) }} style={{
                    padding: '0.5rem 0.625rem', borderRadius: '0.5rem', border: '1px solid #e8ecf4',
                    fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer', background: '#fff', color: '#7c5cfc',
                    display: 'flex', alignItems: 'center', gap: '0.25rem'
                  }}>
                    <Plus style={{width: '12px', height: '12px'}} /> Serviço
                  </button>
                  <button onClick={() => { onClose(); onAction("add_service", appointment) }} style={{
                    padding: '0.5rem 0.625rem', borderRadius: '0.5rem', border: '1px solid #bae6fd',
                    fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer', background: '#e0f2fe', color: '#0284c7',
                    display: 'flex', alignItems: 'center', gap: '0.25rem'
                  }}>
                    <Plus style={{width: '12px', height: '12px'}} /> Profissional de apoio
                  </button>
                  <button onClick={() => onAction("client", appointment)} style={{
                    padding: '0.5rem 0.625rem', borderRadius: '0.5rem', border: 'none',
                    fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', background: '#f1f3f9', color: '#374151',
                  }}>
                    Cliente
                  </button>
                  <button onClick={() => setShowDeleteConfirm(true)} style={{
                    padding: '0.5rem 0.625rem', borderRadius: '0.5rem', border: 'none',
                    fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', background: '#fef2f2', color: '#ef4444',
                  }}>
                    Excluir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Delete Confirmation Modal ──────────────── */}
      {showDeleteConfirm && (
        <>
          <div onClick={() => setShowDeleteConfirm(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
            zIndex: 10010, animation: 'modalFadeIn 0.15s ease-out',
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 10011, background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '400px',
            padding: '0', boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
            animation: 'modalScaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            overflow: 'hidden',
          }}>
            {/* Red top accent */}
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #ef4444, #f87171)' }} />

            <div style={{ padding: '1.75rem 1.5rem 1.5rem', textAlign: 'center' }}>
              {/* Icon */}
              <div style={{
                width: '3.5rem', height: '3.5rem', borderRadius: '1rem',
                background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', border: '1px solid #fecaca',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <AlertTriangle style={{ width: '1.5rem', height: '1.5rem', color: '#ef4444' }} />
              </div>

              <h3 style={{
                fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 800,
                color: '#1e1e2d', marginBottom: '0.375rem',
              }}>
                Excluir Agendamento?
              </h3>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                Esta ação é <strong style={{ color: '#ef4444' }}>irreversível</strong>. O agendamento será permanentemente removido do sistema.
              </p>

              {/* Appointment summary */}
              <div style={{
                background: '#fafbfc', borderRadius: '0.75rem', padding: '0.75rem 1rem',
                border: '1px solid #e8ecf4', marginBottom: '1.5rem', textAlign: 'left',
              }}>
                {[
                  ['👤 Cliente', appointment.client_name],
                  ['✂️ Serviço', appointment.service_name],
                  ['📅 Data', appointment.appointment_date.split('-').reverse().join('/')],
                  ['🕐 Horário', appointment.appointment_time],
                ].map(([label, value], i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0',
                    borderBottom: i < 3 ? '1px solid #f1f3f9' : 'none',
                  }}>
                    <span style={{ fontSize: '0.75rem', color: '#8b8fa7' }}>{label}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e1e2d' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: '0.75rem',
                    border: '2px solid #e8ecf4', background: '#fff', color: '#374151',
                    fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', minHeight: '48px',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    setDeleting(true)
                    onAction('delete', appointment)
                  }}
                  disabled={deleting}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none',
                    background: deleting ? '#fca5a5' : 'linear-gradient(135deg, #ef4444, #f87171)',
                    color: '#fff', fontWeight: 700, fontSize: '0.875rem',
                    cursor: deleting ? 'wait' : 'pointer', minHeight: '48px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                    boxShadow: '0 4px 14px rgba(239,68,68,0.3)',
                    opacity: deleting ? 0.7 : 1, transition: 'all 0.15s',
                  }}
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 style={{ width: '15px', height: '15px' }} />
                  )}
                  {deleting ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalScaleIn {
          from { transform: scale(0.92); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <ConfirmationDialog />
    </>
  )
}
