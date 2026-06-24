"use client"

import { useEffect, useRef, useCallback, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { fetchCollection, fetchCollectionWhere, subscribeCollection, updateDocument, deleteDocument, createDocument, updateAppointment, deleteAppointment } from "@/lib/firebase/client-utils"
import { normalizeSearchText } from "@/lib/search"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { ClientFormModal } from "@/components/admin/client-form-modal"
import type { Appointment, Employee, AppointmentLabel, Service, Client, Category } from "@/lib/types/database"
import { useTenant } from "@/lib/auth/tenant-context"
import { toast } from "sonner"
import { checkBlockConflict, checkBusinessRules, checkAppointmentConflict } from "@/lib/utils"
import { useAgendaStore } from "./agenda-store"
import { AgendaHeader } from "./agenda-header"
import { AgendaDayView } from "./agenda-day-view"
import { AgendaWeekView } from "./agenda-week-view"
import { usePermission } from "@/lib/rbac/usePermission"
import { AgendaMonthView } from "./agenda-month-view"
import { MiniCalendar } from "./mini-calendar"

import { AppointmentTooltip } from "./appointment-tooltip"
import { AgendaContextMenu } from "./agenda-context-menu"
import { SkeletonLoader } from "./skeleton-loader"
import { statusCfg } from "./status-config"
import { useConfirm } from "@/components/ui/confirm-modal"

// Existing modals reused
import { CloseAccountModal } from "@/components/admin/close-account-modal"
import { NewAppointmentModal } from "@/components/admin/new-appointment-modal"
import { LabelManagerModal } from "@/components/admin/label-manager-modal"
import { AppointmentDetailsDrawer } from "@/components/admin/appointment-details-drawer"
import { ClientTransactionModal } from "@/components/admin/client-transaction-modal"
import { AbsenceModal } from "./absence-modal"
import { FreeSlotModal } from "./free-slot-modal"
import { BlockModal } from "./block-modal"
import { AgendaCreditModal } from "./agenda-credit-modal"
import { ProfessionalFormModal } from "@/components/admin/professional-form-modal"
import { AddServiceModal } from "./add-service-modal"
import { GlobalBlockModal } from "./global-block-modal"

// Helper: busca cliente em lista local por telefone, email ou nome
// Retorna { client, strongMatch } — strongMatch indica se encontrou por dado forte (telefone/email)
function findClientInList(apt: Appointment, clients: Client[]): { client: Client; strongMatch: boolean } | null {
  const aptPhone = (apt.client_phone || "").replace(/\D/g, "")
  const aptEmail = (apt.client_email || "").trim().toLowerCase()
  const aptNameNorm = normalizeSearchText(apt.client_name)

  // 1) Busca forte: telefone ou email
  if (aptPhone && aptPhone.length >= 8) {
    const phoneMatches = clients.filter(c => {
      const cPhone = (c.phone || "").replace(/\D/g, "")
      const cWhatsapp = (c.whatsapp || "").replace(/\D/g, "")
      return (cPhone && cPhone === aptPhone) || (cWhatsapp && cWhatsapp === aptPhone)
    })
    if (phoneMatches.length === 1) return { client: phoneMatches[0], strongMatch: true }
  }
  if (aptEmail) {
    const emailMatches = clients.filter(c => c.email && c.email.trim().toLowerCase() === aptEmail)
    if (emailMatches.length === 1) return { client: emailMatches[0], strongMatch: true }
  }

  // 2) Busca fraca: nome normalizado (somente se único)
  if (aptNameNorm) {
    const nameMatches = clients.filter(c => normalizeSearchText(c.name) === aptNameNorm)
    if (nameMatches.length === 1) return { client: nameMatches[0], strongMatch: false }
  }

  return null
}

// Helper: busca direta no Firestore quando store.clients não tem o cliente
async function findClientFromFirestore(apt: Appointment): Promise<{ client: Client; strongMatch: boolean } | null> {
  const aptPhone = (apt.client_phone || "").replace(/\D/g, "")
  const aptEmail = (apt.client_email || "").trim().toLowerCase()

  try {
    // Busca por telefone (dado forte)
    if (aptPhone && aptPhone.length >= 8) {
      const byPhone = await fetchCollectionWhere<Client>("clients", "phone", "==", aptPhone)
      if (byPhone.length === 1) return { client: byPhone[0], strongMatch: true }
    }

    // Busca por email (dado forte)
    if (aptEmail) {
      const byEmail = await fetchCollectionWhere<Client>("clients", "email", "==", aptEmail)
      if (byEmail.length === 1) return { client: byEmail[0], strongMatch: true }
    }

    // Busca por nome (dado fraco) — retorna como strongMatch=false
    if (apt.client_name) {
      const allClients = await fetchCollection<Client>("clients")
      const aptNameNorm = normalizeSearchText(apt.client_name)
      const nameMatches = allClients.filter(c => normalizeSearchText(c.name) === aptNameNorm)
      if (nameMatches.length === 1) return { client: nameMatches[0], strongMatch: false }
    }
  } catch (err) {
    console.error("Erro ao buscar cliente no Firestore:", err)
  }

  return null
}

export default function AgendaPage() {
  const store = useAgendaStore()
  const { isProfessional, saasUser } = useTenant()
  const { can } = usePermission()
  const prevCountRef = useRef<number>(-1)
  const expanded = useAgendaStore(s => s.expanded)
  
  // Local modal states
  const [noteModal, setNoteModal] = useState<{ apt: Appointment; text: string } | null>(null)
  const [rescheduleModal, setRescheduleModal] = useState<{ apt: Appointment; date: string; time: string; employeeId: string } | null>(null)
  const [transactionModal, setTransactionModal] = useState<{ client: Client; type: 'credit' | 'debit' } | null>(null)
  const [addServiceAppointment, setAddServiceAppointment] = useState<Appointment | null>(null)
  const [sharedDeleteModal, setSharedDeleteModal] = useState<{ apt: Appointment } | null>(null)
  const [editingClientFromAgenda, setEditingClientFromAgenda] = useState<Client | null>(null)
  const [businessName, setBusinessName] = useState('Estabelecimento')
  const { ConfirmationDialog, confirm } = useConfirm()

  /* ─── Expanded mode: body class + ESC key ───────── */
  useEffect(() => {
    if (expanded) {
      document.body.classList.add('agenda-expanded')
    } else {
      document.body.classList.remove('agenda-expanded')
    }
    return () => {
      document.body.classList.remove('agenda-expanded')
    }
  }, [expanded])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expanded) {
        store.setExpanded(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [expanded, store])

  /* ─── Load support data ─────────────────────────── */
  const loadSupport = useCallback(async () => {
    const [emp, lbl, svc, cli, bh, bd, cat] = await Promise.all([
      fetchCollection<Employee>("employees"),
      fetchCollection<AppointmentLabel>("labels"),
      fetchCollection<Service>("services"),
      fetchCollection<Client>("clients"),
      fetchCollection<any>("business_hours"),
      fetchCollection<any>("blocked_dates"),
      fetchCollection<Category>("categories", "display_order"),
    ])
    store.setEmployees(emp)
    store.setLabels(lbl)
    store.setServices(svc)
    store.setCategories(cat)
    store.setClients(cli)
    store.setBusinessHours(bh)
    store.setBlockedDates(bd)
  }, [])

  /* ─── Realtime subscription ─────────────────────── */
  useEffect(() => {
    loadSupport().then(() => store.setLoading(false))

    const unsubscribe = subscribeCollection<Appointment>("appointments", (items) => {
      items.sort((a, b) => 
        b.appointment_date.localeCompare(a.appointment_date) || 
        a.appointment_time.localeCompare(b.appointment_time)
      )
      store.setAppointments(items)
      store.setLoading(false)

      if (prevCountRef.current >= 0 && items.length > prevCountRef.current) {
        toast.success("Novo agendamento recebido!", { duration: 3000 })
      }
      prevCountRef.current = items.length
    })

    fetchCollection<any>('settings').then(s => {
      if (s.length > 0) {
        store.setSettings(s[0])
        if (s[0].business_name) setBusinessName(s[0].business_name)
      }
    })

    return () => unsubscribe()
  }, [loadSupport])

  const handleSaveProfessional = async (data: any, photoFile: File | null, oldPhotoUrl: string | null) => {
    const editing = store.employees.find(e => e.id === store.editingEmployeeId)
    if (!editing) return

    try {
      let photoUrl = data.photo_url || null

      if (photoFile) {
        photoUrl = await uploadToCloudinary(photoFile, "salao/profissionais")
      }

      const saveData = { ...data, photo_url: photoUrl }
      await updateDocument("employees", editing.id, saveData)
      toast.success("Profissional atualizado!")
      
      store.setEmployees(store.employees.map(e => e.id === editing.id ? { ...e, ...saveData } : e))
      store.setEditingEmployeeId(null)
    } catch (err) {
      console.error("Erro ao salvar profissional:", err)
      toast.error(err instanceof Error ? err.message : "Erro ao salvar profissional")
      throw err
    }
  }

  /* ─── Handlers ──────────────────────────────────── */
  const handleStatus = async (id: string, status: string) => {
    if (isProfessional) {
      const isCancel = status === 'cancelled' || status === 'no_show'
      if (isCancel && !can('agenda.cancel')) { toast.error('Sem permissão para cancelar'); return }
      if (!isCancel && !can('agenda.edit')) { toast.error('Sem permissão para editar'); return }
    }
    if (status === "completed" || status === "payment_pending") {
      const apt = store.appointments.find(a => a.id === id)
      if (apt) {
        store.setSelectedAppointment(null)
        store.setCloseAccountAppointment(apt)
        return
      }
    }
    try {
      const aptName = store.appointments.find(a => a.id === id)?.client_name || ""
      await updateAppointment(
        id,
        { status },
        "status_changed",
        "Status alterado",
        `O status do agendamento de ${aptName} foi alterado para ${statusCfg[status]?.label || status}.`,
        saasUser
      )
      toast.success(`Status → ${statusCfg[status]?.label || status}`)
      store.setSelectedAppointment(null)
    } catch (err) {
      console.error("Erro ao atualizar status:", err)
      toast.error("Erro ao atualizar status")
    }
  }

  const handleDelete = async (id: string) => {
    if (isProfessional && !can('agenda.delete')) { toast.error('Sem permissão para excluir'); return }
    
    const apt = store.appointments.find(a => a.id === id)
    if (apt?.is_shared_service && apt?.shared_group_id) {
      setSharedDeleteModal({ apt })
      return
    }

    try {
      if (apt?.type === 'block') {
        await deleteAppointment(id, saasUser, {
          professional_id: apt.employee_id || undefined,
          professional_name: apt.employee_name || undefined,
          action_type: "unblock",
          action_title: "Liberação de Horário",
          action_description: `${saasUser?.name || 'Sistema'} removeu o bloqueio do horário ${apt.appointment_time} às ${apt.end_time || '-'} para a profissional ${apt.employee_name} no dia ${new Date(apt.appointment_date + "T12:00:00").toLocaleDateString('pt-BR')}.`,
        })
        toast.success("Bloqueio removido com sucesso")
      } else {
        await deleteAppointment(id, saasUser, {
          client_id: apt?.client_id || undefined,
          client_name: apt?.client_name || undefined,
          service_id: apt?.service_id || undefined,
          service_name: apt?.service_name || undefined,
          professional_id: apt?.employee_id || undefined,
          professional_name: apt?.employee_name || undefined
        })
        toast.success("Agendamento excluído com sucesso")
      }
      store.setSelectedAppointment(null)
    } catch (err) {
      console.error("Erro ao excluir agendamento:", err)
      toast.error("Erro ao excluir agendamento")
    }
  }

  const handleAction = async (action: string, apt: Appointment) => {
    switch (action) {
      case "delete": handleDelete(apt.id); break
      case "close_account":
        store.setSelectedAppointment(null)
        store.setCloseAccountAppointment(apt)
        break
      case "edit_appointment":
        store.setSelectedAppointment(null)
        store.setPrefillAppointment(apt)
        store.setEditMode(true)
        store.setShowNewAppointment(true)
        break
      case "client": {
        // 1) Busca primária pelo client_id no store
        let clientObj = apt.client_id ? store.clients.find(c => c.id === apt.client_id) : null
        let isStrong = false
        // 2) Fallback: busca normalizada na lista local (store.clients)
        if (!clientObj) {
          const localResult = findClientInList(apt, store.clients)
          if (localResult) {
            clientObj = localResult.client
            isStrong = localResult.strongMatch
          }
        }
        // 3) Fallback: busca direta no Firestore (caso store não tenha todos os clientes)
        if (!clientObj) {
          const dbResult = await findClientFromFirestore(apt)
          if (dbResult) {
            clientObj = dbResult.client
            isStrong = dbResult.strongMatch
          }
        }
        // Auto-corrige client_id somente se match for forte (telefone/email)
        if (clientObj && apt.id && clientObj.id !== apt.client_id && isStrong) {
          updateDocument("appointments", apt.id, { client_id: clientObj.id }).catch(() => {})
        }
        if (!clientObj) {
          toast.error("Cliente não encontrado na base de dados.")
          break
        }
        store.setSelectedAppointment(null)
        setEditingClientFromAgenda(clientObj)
        break
      }
      case "add_credit":
      case "add_debit": {
        const type = action === "add_credit" ? "credit" : "debit"
        let client = apt.client_id ? store.clients.find(c => c.id === apt.client_id) : null
        let isStrongCredit = false
        if (!client) {
          const localResult = findClientInList(apt, store.clients)
          if (localResult) { client = localResult.client; isStrongCredit = localResult.strongMatch }
        }
        if (!client) {
          const dbResult = await findClientFromFirestore(apt)
          if (dbResult) { client = dbResult.client; isStrongCredit = dbResult.strongMatch }
        }
        if (client && apt.id && client.id !== apt.client_id && isStrongCredit) {
          updateDocument("appointments", apt.id, { client_id: client.id }).catch(() => {})
        }
        if (client) {
          store.setSelectedAppointment(null)
          setTransactionModal({ client, type })
        } else {
          toast.error("Cliente não encontrado na base de dados.")
        }
        break
      }
      case "whatsapp":
        if (apt.client_phone) {
          const phone = apt.client_phone.replace(/\D/g, '')
          window.open(`https://wa.me/55${phone}`, '_blank')
        } else {
          toast.error("Cliente sem telefone")
        }
        break
      case "reminder":
        if (apt.client_phone) {
          const phone = apt.client_phone.replace(/\D/g, '')
          const dateFormatted = apt.appointment_date.split('-').reverse().join('/')
          const msg = encodeURIComponent(
            `Olá ${apt.client_name}! 😊\n\nLembramos do seu agendamento:\n📅 ${dateFormatted}\n🕐 ${apt.appointment_time}\n✂️ ${apt.service_name}\n\nContamos com sua presença! 💜`
          )
          window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank')
        } else {
          toast.error("Cliente sem telefone para enviar lembrete")
        }
        break
      case "duplicate":
        store.setSelectedAppointment(null)
        store.setPrefillAppointment(apt)
        store.setShowNewAppointment(true)
        break
      case "add_service":
        store.setSelectedAppointment(null)
        setAddServiceAppointment(apt)
        break
      case "reschedule":
        setRescheduleModal({
          apt,
          date: apt.appointment_date,
          time: apt.appointment_time,
          employeeId: apt.employee_id || '',
        })
        break
      case "add_note":
        setNoteModal({ apt, text: apt.notes || '' })
        break
      case "cut":
        store.setCutAppointment(apt)
        toast.success(`Agendamento de ${apt.client_name} recortado. Clique com botão direito em outro local para colar.`)
        break
      case "paste": {
        // apt is the target context (where to paste)
        const cutApt = store.cutAppointment
        if (!cutApt) break
        // Move the cut appointment to the target employee's column
        const targetEmpId = apt.employee_id
        if (targetEmpId && targetEmpId !== cutApt.employee_id) {
          handleMoveAppointment(cutApt.id, targetEmpId)
          store.setCutAppointment(null)
        } else {
          toast.info("Selecione um profissional diferente para colar")
        }
        break
      }
    }
  }

  const handleMoveAppointment = async (appointmentId: string, newEmployeeId: string, newTime?: string) => {
    try {
      // Validate target employee has schedule enabled
      const targetEmp = store.employees.find(e => e.id === newEmployeeId)
      if (targetEmp && targetEmp.has_schedule === false) {
        toast.error(`${targetEmp.name} não possui agenda ativa`)
        return
      }
      const apt = store.appointments.find(a => a.id === appointmentId)
      
      const bypassFlags: any = {}

      if (apt) {
        const timeToCheck = newTime || apt.appointment_time
        
        const conflict = checkAppointmentConflict(timeToCheck, apt.duration_minutes, apt.appointment_date, newEmployeeId, store.appointments, apt.id)
        if (conflict.hasConflict) {
          if (conflict.type === 'appointment') {
            const msg = `Já existe um agendamento para este profissional neste período.\n\nDeseja mover o agendamento mesmo assim?`
            const confirmed = await confirm({
              title: "Horário já ocupado",
              message: msg,
              confirmText: "Mover mesmo assim",
              cancelText: "Cancelar"
            })
            if (!confirmed) return
            bypassFlags._bypass_appointment_overlap = true
          } else if (conflict.type === 'block') {
            const msg = `Este horário está bloqueado para este profissional. Deseja agendar mesmo assim?\n\nMotivo: ${conflict.conflict?.client_name || 'Bloqueio'}\nHorário do bloqueio: ${conflict.conflict?.appointment_time} → ${conflict.conflict?.end_time || '-'}\nHorário do agendamento: ${timeToCheck}`
            const confirmed = await confirm({
              title: "Horário bloqueado",
              message: msg,
              confirmText: "Agendar mesmo assim",
              cancelText: "Cancelar"
            })
            if (!confirmed) return
            bypassFlags._bypass_block = true
          }
        }

        let isDayOffOverride = false
        const businessRule = checkBusinessRules(timeToCheck, apt.duration_minutes, apt.appointment_date, targetEmp || null, store.businessHours, store.blockedDates)
        if (businessRule.errorType === 'blocked_date') {
          const msg = `Esta data está bloqueada${businessRule.reason ? `: ${businessRule.reason}` : ''}. Deseja mover o agendamento mesmo assim?`
          const confirmed = await confirm({ title: "Data bloqueada", message: msg, confirmText: "Mover mesmo assim", cancelText: "Cancelar" })
          if (!confirmed) return
        } else if (businessRule.errorType === 'closed_day') {
          if (businessRule.reason === 'Profissional não atende neste dia.') {
            const msg = "Este profissional está de folga nesta data. Deseja mover o agendamento mesmo assim?"
            const confirmed = await confirm({ title: "Profissional de Folga", message: msg, confirmText: "Mover mesmo assim", cancelText: "Cancelar" })
            if (!confirmed) return
            isDayOffOverride = true
          } else {
            const msg = "O estabelecimento está fechado nesta data. Deseja mover o agendamento mesmo assim?"
            const confirmed = await confirm({ title: "Estabelecimento Fechado", message: msg, confirmText: "Mover mesmo assim", cancelText: "Cancelar" })
            if (!confirmed) return
          }
        } else if (businessRule.errorType === 'out_of_hours') {
          if (businessRule.reason === 'Horário de almoço do profissional') {
            const msg = "Este profissional está em horário de almoço neste período. Deseja mover o agendamento mesmo assim?"
            const confirmed = await confirm({ title: "Horário de Almoço", message: msg, confirmText: "Mover mesmo assim", cancelText: "Cancelar" })
            if (!confirmed) return
          } else if (businessRule.reason === 'Horário de intervalo do profissional') {
            const msg = "Este profissional está em intervalo neste período. Deseja mover o agendamento mesmo assim?"
            const confirmed = await confirm({ title: "Horário de Intervalo", message: msg, confirmText: "Mover mesmo assim", cancelText: "Cancelar" })
            if (!confirmed) return
          } else {
            const msg = `Este agendamento termina às ${businessRule.endTimeStr}, mas o expediente termina às ${businessRule.closingTimeStr}.\nDeseja mover mesmo assim?`
            const confirmed = await confirm({ title: "Agendamento fora do expediente", message: msg, confirmText: "Mover mesmo assim", cancelText: "Cancelar" })
            if (!confirmed) return
          }
        }
      }

      const updateData: any = { ...bypassFlags, employee_id: newEmployeeId, updated_at: new Date().toISOString() }
      if (targetEmp) updateData.employee_name = targetEmp.name
      if (newTime && apt) {
        updateData.appointment_time = newTime
        // Calculate end_time based on appointment duration
        const [h, m] = newTime.split(':').map(Number)
        const endTotal = h * 60 + m + apt.duration_minutes
        updateData.end_time = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`
      }
      let logDesc = `Arrastado para ${updateData.appointment_date || apt?.appointment_date} às ${updateData.appointment_time || apt?.appointment_time} com o profissional ${updateData.employee_name || apt?.employee_name || "indefinido"}.`
      
      if (apt) {
        // Recalculate if it was day off to be able to use it here in outer block
        const targetEmpForRule = store.employees.find(e => e.id === (updateData.employee_id || apt.employee_id)) || null
        const rule = checkBusinessRules(updateData.appointment_time || apt.appointment_time, apt.duration_minutes, updateData.appointment_date || apt.appointment_date, targetEmpForRule, store.businessHours, store.blockedDates)
        if (rule.errorType === 'closed_day' && rule.reason === 'Profissional não atende neste dia.') {
          logDesc += ` | Exceção: O usuário ${saasUser?.name || "Sistema"} moveu excepcionalmente este agendamento para a folga do profissional ${updateData.employee_name || apt?.employee_name || "indefinido"}.`
        } else if (rule.errorType === 'out_of_hours' && rule.reason === 'Horário de almoço do profissional') {
          logDesc += ` | Exceção: O usuário ${saasUser?.name || "Sistema"} moveu excepcionalmente para o horário de almoço do profissional ${updateData.employee_name || apt?.employee_name || "indefinido"}.`
        } else if (rule.errorType === 'out_of_hours' && rule.reason === 'Horário de intervalo do profissional') {
          logDesc += ` | Exceção: O usuário ${saasUser?.name || "Sistema"} moveu excepcionalmente para o intervalo do profissional ${updateData.employee_name || apt?.employee_name || "indefinido"}.`
        }
      }

      const isBlock = apt?.type === 'block'
      await updateAppointment(
        appointmentId,
        updateData,
        isBlock ? "block_update" : "drag_moved",
        isBlock ? "Bloqueio Alterado" : "Movido na agenda",
        isBlock ? `${saasUser?.name || 'Sistema'} moveu o bloqueio para ${updateData.appointment_date || apt?.appointment_date} às ${updateData.appointment_time || apt?.appointment_time} (Profissional: ${updateData.employee_name || apt?.employee_name || "indefinido"}).` : logDesc,
        saasUser
      )
      toast.success(isBlock ? "Bloqueio movido com sucesso" : "Agendamento movido com sucesso")
    } catch (err) {
      console.error("Erro ao mover agendamento:", err)
      toast.error("Erro ao mover agendamento")
    }
  }

  const reloadAll = async () => {
    const [lbl] = await Promise.all([
      fetchCollection<AppointmentLabel>("labels"),
    ])
    store.setLabels(lbl)
  }

  /* ─── Stats ─────────────────────────────────────── */
  const dayAppointments = store.getAppointmentsForDate(store.selectedDate)
  const stats = useMemo(() => {
    const todayClosed = store.appointments.filter(a => 
      a.status === "closed" && a.appointment_date === store.selectedDate
    ).length
    return [
      { label: "Total", count: dayAppointments.length, color: "#7c5cfc" },
      { label: "Confirmados", count: dayAppointments.filter(a => ["pending", "confirmed"].includes(a.status)).length, color: "#3b82f6" },
      { label: "Atendendo", count: dayAppointments.filter(a => a.status === "in_progress").length, color: "#0891b2" },
      { label: "Aguard. Pgto", count: dayAppointments.filter(a => ["completed", "payment_pending"].includes(a.status)).length, color: "#8b5cf6" },
      { label: "Fechados", count: todayClosed, color: "#059669" },
      { label: "Cancelados", count: dayAppointments.filter(a => ["cancelled", "no_show"].includes(a.status)).length, color: "#ef4444" },
    ]
  }, [dayAppointments, store.selectedDate, store.appointments])

  /* ─── Loading ───────────────────────────────────── */
  if (store.loading) return <SkeletonLoader />

  return (
    <>
    {/* Expanded mode global styles — injected once */}
    <style>{`
      body.agenda-expanded > div > aside {
        transform: translateX(-100%) !important;
        opacity: 0 !important;
        pointer-events: none !important;
        width: 0 !important;
        overflow: hidden !important;
      }
      body.agenda-expanded > div > div {
        margin-left: 0 !important;
      }
      body.agenda-expanded > div > div > header {
        height: 0 !important;
        min-height: 0 !important;
        padding: 0 !important;
        border: none !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      body.agenda-expanded > div > div > main {
        padding: 0 !important;
      }
      body.agenda-expanded aside,
      body.agenda-expanded > div > div > header,
      body.agenda-expanded > div > div > main {
        transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
    `}</style>
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0',
      height: expanded ? '100vh' : 'calc(100vh - 7rem)',
      overflow: 'hidden',
      transition: 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <AgendaHeader
        stats={stats}
        isProfessional={isProfessional}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: '0', minHeight: 0 }}>
        {/* Mini Calendar Sidebar */}
        <AnimatePresence>
          {store.sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="hidden lg:block"
              style={{ flexShrink: 0, overflow: 'hidden', borderRight: '1px solid #e8ecf4' }}
            >
              <MiniCalendar />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Agenda View */}
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <AnimatePresence mode="wait">
            {store.viewMode === 'day' && (
              <motion.div
                key="day"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                style={{ height: '100%' }}
              >
                <AgendaDayView
                  onStatusChange={handleStatus}
                  onAction={handleAction}
                  onMove={handleMoveAppointment}
                />
              </motion.div>
            )}
            {store.viewMode === 'week' && (
              <motion.div
                key="week"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                style={{ height: '100%' }}
              >
                <AgendaWeekView onAction={handleAction} onStatusChange={handleStatus} />
              </motion.div>
            )}
            {store.viewMode === 'month' && (
              <motion.div
                key="month"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                style={{ height: '100%' }}
              >
                <AgendaMonthView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Tooltip */}
      <AppointmentTooltip />

      {/* Context Menu */}
      <AgendaContextMenu
        onStatusChange={handleStatus}
        onAction={handleAction}
      />

      {/* Details Drawer — existing */}
      {store.selectedAppointment && (
        <AppointmentDetailsDrawer
          appointment={store.selectedAppointment}
          employees={store.employees}
          labels={store.labels}
          onClose={() => store.setSelectedAppointment(null)}
          onStatusChange={handleStatus}
          onAction={handleAction}
          onLabelsChange={reloadAll}
        />
      )}

      {/* Label Manager — existing */}
      {store.showLabelManager && (
        <LabelManagerModal
          labels={store.labels}
          onClose={() => store.setShowLabelManager(false)}
          onRefresh={reloadAll}
        />
      )}

      {/* Close Account Modal — existing */}
      {store.closeAccountAppointment && (
        <CloseAccountModal
          appointment={store.closeAccountAppointment}
          onClose={() => store.setCloseAccountAppointment(null)}
          onDone={() => store.setCloseAccountAppointment(null)}
        />
      )}

      {/* New Appointment Modal — existing */}
      {store.showNewAppointment && (
        <NewAppointmentModal
          onClose={() => { store.setShowNewAppointment(false); store.setPrefillAppointment(null); store.setEditMode(false) }}
          onDone={() => { store.setShowNewAppointment(false); store.setPrefillAppointment(null); store.setEditMode(false) }}
          prefill={store.prefillAppointment || undefined}
          editMode={store.editMode}
        />
      )}

      {/* Transaction Modal */}
      {transactionModal && (
        <ClientTransactionModal
          client={transactionModal.client}
          type={transactionModal.type}
          onClose={() => setTransactionModal(null)}
          onSuccess={() => {
            loadSupport()
          }}
        />
      )}

      {/* Add Service Modal */}
      {addServiceAppointment && (
        <AddServiceModal
          appointment={addServiceAppointment}
          onClose={() => setAddServiceAppointment(null)}
          onSuccess={() => {
            setAddServiceAppointment(null)
          }}
        />
      )}

      {/* Client Edit Modal (from agenda context menu) */}
      {editingClientFromAgenda && (
        <ClientFormModal
          client={editingClientFromAgenda}
          onClose={() => setEditingClientFromAgenda(null)}
          onSave={async (data, photoFile, oldPhotoUrl) => {
            try {
              let photoUrl = data.photo_url || null
              if (photoFile) {
                photoUrl = await uploadToCloudinary(photoFile, "salao/clientes")
              }
              const saveData = { ...data, photo_url: photoUrl }
              await updateDocument("clients", editingClientFromAgenda.id, saveData)
              toast.success("Cliente atualizado!")
              setEditingClientFromAgenda(null)
              loadSupport()
            } catch (err) {
              console.error("Erro ao salvar cliente:", err)
              toast.error(err instanceof Error ? err.message : "Erro ao salvar cliente")
              throw err
            }
          }}
        />
      )}

      {/* ─── Note Modal ─────────────────────────────── */}
      {noteModal && (
        <>
          <div onClick={() => setNoteModal(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 10000,
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 10001, background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '420px',
            padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 700, color: '#1e1e2d', marginBottom: '0.75rem' }}>
              📝 Observação — {noteModal.apt.client_name}
            </h3>
            <textarea
              value={noteModal.text}
              onChange={e => setNoteModal({ ...noteModal, text: e.target.value })}
              rows={4}
              placeholder="Digite a observação..."
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '0.625rem', border: '2px solid #e8ecf4',
                fontSize: '0.8125rem', color: '#1e1e2d', outline: 'none', background: '#fafbfc',
                resize: 'none', minHeight: '100px', fontFamily: 'inherit',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#c4b5fd' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e8ecf4' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button onClick={() => setNoteModal(null)} style={{
                flex: 1, padding: '0.625rem', borderRadius: '0.625rem', border: '2px solid #e8ecf4',
                background: '#fff', color: '#555', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
              }}>Cancelar</button>
              <button onClick={async () => {
                try {
                  await updateAppointment(
                    noteModal.apt.id,
                    { notes: noteModal.text || null },
                    "note_added",
                    "Observação atualizada",
                    noteModal.text ? "Observação alterada/adicionada." : "Observação removida.",
                    saasUser
                  )
                  toast.success('Observação salva!')
                  setNoteModal(null)
                } catch { toast.error('Erro ao salvar observação') }
              }} style={{
                flex: 2, padding: '0.625rem', borderRadius: '0.625rem', border: 'none',
                background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff',
                fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(124,92,252,0.25)',
              }}>Salvar Observação</button>
            </div>
          </div>
        </>
      )}

      {/* ─── Reschedule Modal ────────────────────────── */}
      {rescheduleModal && (
        <>
          <div onClick={() => setRescheduleModal(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 10000,
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 10001, background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '420px',
            padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 700, color: '#1e1e2d', marginBottom: '0.75rem' }}>
              🗓️ Reagendar — {rescheduleModal.apt.client_name}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Data</label>
                <input type="date" value={rescheduleModal.date}
                  onChange={e => setRescheduleModal({ ...rescheduleModal, date: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '0.625rem', border: '2px solid #e8ecf4', fontSize: '0.8125rem', outline: 'none', background: '#fafbfc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Horário</label>
                <input type="time" value={rescheduleModal.time}
                  onChange={e => setRescheduleModal({ ...rescheduleModal, time: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '0.625rem', border: '2px solid #e8ecf4', fontSize: '0.8125rem', outline: 'none', background: '#fafbfc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Profissional</label>
                <select value={rescheduleModal.employeeId}
                  onChange={e => setRescheduleModal({ ...rescheduleModal, employeeId: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '0.625rem', border: '2px solid #e8ecf4', fontSize: '0.8125rem', outline: 'none', background: '#fafbfc', cursor: 'pointer' }}
                >
                  <option value="">Manter atual</option>
                  {store.employees.filter(e => e.is_active && e.has_schedule !== false).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button onClick={() => setRescheduleModal(null)} style={{
                flex: 1, padding: '0.625rem', borderRadius: '0.625rem', border: '2px solid #e8ecf4',
                background: '#fff', color: '#555', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
              }}>Cancelar</button>
              <button onClick={async () => {
                try {
                  const targetEmpId = rescheduleModal.employeeId || rescheduleModal.apt.employee_id || ""
                  const targetEmp = store.employees.find(e => e.id === targetEmpId) || null
                  
                  const conflict = checkAppointmentConflict(rescheduleModal.time, rescheduleModal.apt.duration_minutes, rescheduleModal.date, targetEmpId, store.appointments, rescheduleModal.apt.id)
                  if (conflict.hasConflict) {
                    if (conflict.type === 'appointment') {
                      toast.error("Horário indisponível. Já existe um agendamento para este profissional neste período.")
                      return
                    } else if (conflict.type === 'block') {
                      const msg = `Este horário está bloqueado para este profissional. Deseja agendar mesmo assim?\n\nMotivo: ${conflict.conflict?.client_name || 'Bloqueio'}\nHorário do bloqueio: ${conflict.conflict?.appointment_time} → ${conflict.conflict?.end_time || '-'}\nHorário do agendamento: ${rescheduleModal.time}`
                      const confirmed = await confirm({
                        title: "Horário bloqueado",
                        message: msg,
                        confirmText: "Agendar mesmo assim",
                        cancelText: "Cancelar"
                      })
                      if (!confirmed) return
                    }
                  }

                  const businessRule = checkBusinessRules(rescheduleModal.time, rescheduleModal.apt.duration_minutes, rescheduleModal.date, targetEmp, store.businessHours, store.blockedDates)
                  if (businessRule.errorType === 'blocked_date') {
                    const msg = `Esta data está bloqueada${businessRule.reason ? `: ${businessRule.reason}` : ''}. Deseja reagendar mesmo assim?`
                    const confirmed = await confirm({ title: "Data bloqueada", message: msg, confirmText: "Reagendar mesmo assim", cancelText: "Cancelar" })
                    if (!confirmed) return
                  } else if (businessRule.errorType === 'closed_day') {
                    if (businessRule.reason === 'Profissional não atende neste dia.') {
                      const msg = "Este profissional está de folga nesta data. Deseja reagendar mesmo assim?"
                      const confirmed = await confirm({ title: "Profissional de Folga", message: msg, confirmText: "Reagendar mesmo assim", cancelText: "Cancelar" })
                      if (!confirmed) return
                    } else {
                      const msg = "O estabelecimento está fechado nesta data. Deseja reagendar mesmo assim?"
                      const confirmed = await confirm({ title: "Estabelecimento Fechado", message: msg, confirmText: "Reagendar mesmo assim", cancelText: "Cancelar" })
                      if (!confirmed) return
                    }
                  } else if (businessRule.errorType === 'out_of_hours') {
                    if (businessRule.reason === 'Horário de almoço do profissional') {
                      const msg = "Este profissional está em horário de almoço neste período. Deseja reagendar mesmo assim?"
                      const confirmed = await confirm({ title: "Horário de Almoço", message: msg, confirmText: "Reagendar mesmo assim", cancelText: "Cancelar" })
                      if (!confirmed) return
                    } else if (businessRule.reason === 'Horário de intervalo do profissional') {
                      const msg = "Este profissional está em intervalo neste período. Deseja reagendar mesmo assim?"
                      const confirmed = await confirm({ title: "Horário de Intervalo", message: msg, confirmText: "Reagendar mesmo assim", cancelText: "Cancelar" })
                      if (!confirmed) return
                    } else {
                      const msg = `Este agendamento termina às ${businessRule.endTimeStr}, mas o expediente termina às ${businessRule.closingTimeStr}.\nDeseja reagendar mesmo assim?`
                      const confirmed = await confirm({ title: "Agendamento fora do expediente", message: msg, confirmText: "Reagendar mesmo assim", cancelText: "Cancelar" })
                      if (!confirmed) return
                    }
                  }

                  const updateData: any = {
                    appointment_date: rescheduleModal.date,
                    appointment_time: rescheduleModal.time,
                    updated_at: new Date().toISOString(),
                  }
                  // Calculate end_time
                  const [h, m] = rescheduleModal.time.split(':').map(Number)
                  const endTotal = h * 60 + m + rescheduleModal.apt.duration_minutes
                  updateData.end_time = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`
                  if (rescheduleModal.employeeId && rescheduleModal.employeeId !== rescheduleModal.apt.employee_id) {
                    updateData.employee_id = rescheduleModal.employeeId
                    if (targetEmp) updateData.employee_name = targetEmp.name
                  }
                  const isBlock = rescheduleModal.apt.type === 'block'
                  await updateAppointment(
                    rescheduleModal.apt.id,
                    updateData,
                    isBlock ? "block_update" : "rescheduled",
                    isBlock ? "Bloqueio Reagendado" : "Reagendado",
                    isBlock ? `${saasUser?.name || 'Sistema'} reagendou o bloqueio para ${updateData.appointment_date} às ${updateData.appointment_time} (Profissional: ${updateData.employee_name || targetEmp?.name || "mesmo"}).` :
                    (`Reagendado para ${updateData.appointment_date} às ${updateData.appointment_time} com ${updateData.employee_name || 'mesmo profissional'}.` + 
                    (businessRule.errorType === 'closed_day' && businessRule.reason === 'Profissional não atende neste dia.' ? ` | Exceção: O usuário ${saasUser?.name || "Sistema"} reagendou excepcionalmente para a folga do profissional ${updateData.employee_name || targetEmp?.name || "indefinido"}.` : "") +
                    (businessRule.errorType === 'out_of_hours' && businessRule.reason === 'Horário de almoço do profissional' ? ` | Exceção: Reagendado manualmente para o horário de almoço do profissional ${updateData.employee_name || targetEmp?.name || "indefinido"}.` : "") +
                    (businessRule.errorType === 'out_of_hours' && businessRule.reason === 'Horário de intervalo do profissional' ? ` | Exceção: Reagendado manualmente para o intervalo do profissional ${updateData.employee_name || targetEmp?.name || "indefinido"}.` : "")),
                    saasUser
                  )
                  toast.success(isBlock ? 'Bloqueio reagendado com sucesso!' : 'Agendamento reagendado com sucesso!')
                  setRescheduleModal(null)
                } catch { toast.error('Erro ao reagendar') }
              }} style={{
                flex: 2, padding: '0.625rem', borderRadius: '0.625rem', border: 'none',
                background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff',
                fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(124,92,252,0.25)',
              }}>Reagendar</button>
            </div>
          </div>
        </>
      )}

      {/* ─── Shared Delete Modal ────────────────────────── */}
      {sharedDeleteModal && (
        <>
          <div onClick={() => setSharedDeleteModal(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100000,
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 100001, background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '400px',
            padding: '1.5rem', boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 800, color: '#1e1e2d', marginBottom: '0.5rem' }}>
                Atendimento Compartilhado
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Este atendimento está dividido entre profissionais. Deseja remover apenas este profissional ou cancelar o atendimento completo?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                <button onClick={async () => {
                  try {
                    const sharedApts = store.appointments.filter(a => a.shared_group_id === sharedDeleteModal.apt.shared_group_id)
                    for (const sApt of sharedApts) {
                      if (sApt.type === 'block') {
                        await deleteAppointment(sApt.id, saasUser, {
                          professional_id: sApt.employee_id || undefined,
                          professional_name: sApt.employee_name || undefined,
                          action_type: "unblock",
                          action_title: "Liberação de Horário",
                          action_description: `${saasUser?.name || 'Sistema'} removeu o bloqueio do horário ${sApt.appointment_time} às ${sApt.end_time || '-'} para a profissional ${sApt.employee_name} no dia ${new Date(sApt.appointment_date + "T12:00:00").toLocaleDateString('pt-BR')}.`,
                        })
                      } else {
                        await deleteAppointment(sApt.id, saasUser, {
                          client_id: sApt.client_id || undefined,
                          client_name: sApt.client_name || undefined,
                          service_id: sApt.service_id || undefined,
                          service_name: sApt.service_name || undefined,
                          professional_id: sApt.employee_id || undefined,
                          professional_name: sApt.employee_name || undefined
                        })
                      }
                    }
                    toast.success("Atendimento completo excluído")
                    setSharedDeleteModal(null)
                    store.setSelectedAppointment(null)
                  } catch { toast.error("Erro ao excluir") }
                }} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#fee2e2', color: '#ef4444', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                  Cancelar atendimento completo
                </button>
                <button onClick={async () => {
                  try {
                    const apt = sharedDeleteModal.apt
                    await deleteAppointment(apt.id, saasUser, {
                      client_name: apt.client_name || undefined,
                      service_id: apt.service_id || undefined,
                      service_name: apt.service_name || undefined,
                      professional_id: apt.employee_id || undefined,
                      professional_name: apt.employee_name || undefined
                    })
                    
                    const remainingApts = store.appointments.filter(a => a.shared_group_id === apt.shared_group_id && a.id !== apt.id)
                    if (remainingApts.length === 1) {
                      const originalTotal = (apt.service_total_value || 0) + (remainingApts[0].service_price || 0)
                      await updateAppointment(
                        remainingApts[0].id,
                        {
                          is_shared_service: false,
                          shared_group_id: null,
                          service_total_value: null,
                          professional_service_value: null,
                          service_price: originalTotal
                        },
                        "updated",
                        "Agendamento individualizado",
                        "O serviço compartilhado foi removido, tornando este agendamento único novamente.",
                        saasUser
                      )
                    } else if (remainingApts.length > 1) {
                      const newPrice = (apt.service_total_value || 0) / remainingApts.length
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
                    }
                    toast.success("Profissional removido do atendimento")
                    setSharedDeleteModal(null)
                    store.setSelectedAppointment(null)
                  } catch { toast.error("Erro ao remover") }
                }} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                  Remover apenas este profissional
                </button>
                <button onClick={() => setSharedDeleteModal(null)} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', color: '#6b7280', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', marginTop: '0.25rem' }}>
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmationDialog />

      {store.showAbsenceModal && (
        <AbsenceModal
          employeeId={store.showAbsenceModal.employee_id}
          date={store.showAbsenceModal.date}
          time={store.showAbsenceModal.time}
          onClose={() => store.setShowAbsenceModal(null)}
        />
      )}
      
      {store.showFreeSlotModal && (
        <FreeSlotModal
          employeeId={store.showFreeSlotModal.employee_id}
          date={store.showFreeSlotModal.date}
          time={store.showFreeSlotModal.time}
          onClose={() => store.setShowFreeSlotModal(null)}
        />
      )}

      {store.showCreditModal && (
        <AgendaCreditModal onClose={() => store.setShowCreditModal(false)} />
      )}

      {store.showGlobalBlockModal && (
        <GlobalBlockModal onClose={() => store.setShowGlobalBlockModal(false)} />
      )}

      {store.showBlockModal && (
        <BlockModal
          employeeId={store.showBlockModal.employee_id}
          date={store.showBlockModal.date}
          time={store.showBlockModal.time}
          onClose={() => store.setShowBlockModal(null)}
        />
      )}

      {store.editingEmployeeId && (
        <ProfessionalFormModal
          employee={store.employees.find(e => e.id === store.editingEmployeeId) || null}
          onClose={() => store.setEditingEmployeeId(null)}
          onSave={handleSaveProfessional}
          businessName={businessName}
        />
      )}
    </div>
    </>
  )
}
