"use client"
import { useState, useMemo, useEffect } from "react"
import { X, Plus, Trash2, Clock, User, FileText, Tag, Calendar, MessageSquare, Briefcase, Users } from "lucide-react"
import type { Appointment, Service } from "@/lib/types/database"
import { updateAppointment, createDocument, fetchCollectionWhere } from "@/lib/firebase/client-utils"
import { formatCurrency, formatPhone, checkAppointmentConflict, checkBusinessRules } from "@/lib/utils"
import { toast } from "sonner"
import { useAgendaStore } from "./agenda-store"
import { useConfirm } from "@/components/ui/confirm-modal"
import { useTenant } from "@/lib/auth/tenant-context"

// Child Modals
import { ClientHistoryModal } from "./client-history-modal"
import { ClientFormModal } from "../client-form-modal"

interface Props {
  appointment: Appointment
  onClose: () => void
  onSuccess: (updatedApt: Appointment) => void
  onAction?: (action: string, apt: Appointment) => void
}

interface ServiceBlock {
  id: string
  employeeId: string
  serviceId: string
  date: string
  time: string
  duration: number | ""
  price: number | ""
  waitPrevious: boolean
}

export function AddServiceModal({ appointment, onClose, onSuccess, onAction }: Props) {
  const store = useAgendaStore()
  const { saasUser } = useTenant()
  const { ConfirmationDialog, confirm } = useConfirm()

  const { services, employees, clients, labels } = store
  
  const client = clients.find(c => c.id === appointment.client_id) || null

  // State for Service Blocks
  const [blocks, setBlocks] = useState<ServiceBlock[]>([])
  
  // State for Assistant Professionals
  const [assistants, setAssistants] = useState<string[]>([])
  
  const [notes, setNotes] = useState(appointment.notes || "")
  const [notifyClient, setNotifyClient] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Modal states
  const [showHistory, setShowHistory] = useState(false)
  const [showFicha, setShowFicha] = useState(false)
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [localLabelIds, setLocalLabelIds] = useState<string[]>(appointment.label_ids || [])

  // Block Helpers
  const applyServiceDetails = (serviceId: string, empId: string) => {
    const svc = services.find(s => s.id === serviceId)
    if (!svc) return null

    let finalPrice = svc.promotional_price || svc.price
    let finalDuration = svc.duration_minutes

    if (empId) {
      const emp = employees.find(e => e.id === empId)
      if (emp?.professional_services) {
        const custom = emp.professional_services.find(ps => ps.serviceId === serviceId)
        if (custom) {
          if (custom.customPrice !== undefined && custom.customPrice !== null) finalPrice = custom.customPrice
          if (custom.customDuration !== undefined && custom.customDuration !== null) finalDuration = custom.customDuration
        }
      }
    }
    return { ...svc, price: finalPrice, duration_minutes: finalDuration }
  }

  // Calculate times for blocks dynamically when they change or when waitPrevious changes
  useEffect(() => {
    setBlocks(prevBlocks => {
      let changed = false
      const newBlocks = [...prevBlocks]
      
      let lastEndTimeStr = appointment.end_time || appointment.appointment_time
      
      for (let i = 0; i < newBlocks.length; i++) {
        const b = newBlocks[i]
        
        // Auto-compute time if waitPrevious is true
        if (b.waitPrevious && b.time !== lastEndTimeStr) {
          b.time = lastEndTimeStr
          changed = true
        }

        // Calculate end time for this block to pass to the next
        if (b.time && typeof b.duration === 'number') {
          const [h, m] = b.time.split(':').map(Number)
          const endTotal = h * 60 + m + b.duration
          lastEndTimeStr = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`
        }
      }
      
      return changed ? newBlocks : prevBlocks
    })
  }, [blocks, appointment.end_time, appointment.appointment_time])

  const handleAddBlock = (keepEmployee: boolean) => {
    let lastEmpId = appointment.employee_id || ""
    let lastDate = appointment.appointment_date
    let lastTime = appointment.appointment_time

    if (blocks.length > 0) {
      const lastBlock = blocks[blocks.length - 1]
      lastEmpId = lastBlock.employeeId
      lastDate = lastBlock.date
      lastTime = lastBlock.time
    }

    const newBlock: ServiceBlock = {
      id: crypto.randomUUID(),
      employeeId: keepEmployee ? lastEmpId : "",
      serviceId: "",
      date: lastDate,
      time: lastTime,
      duration: "",
      price: "",
      waitPrevious: false
    }
    setBlocks([...blocks, newBlock])
  }

  const updateBlock = (index: number, field: keyof ServiceBlock, value: any) => {
    const newBlocks = [...blocks]
    newBlocks[index] = { ...newBlocks[index], [field]: value }
    
    // Auto fill duration and price when service or employee changes
    if ((field === 'serviceId' || field === 'employeeId') && newBlocks[index].serviceId) {
      const details = applyServiceDetails(newBlocks[index].serviceId, newBlocks[index].employeeId)
      if (details) {
        newBlocks[index].duration = details.duration_minutes
        newBlocks[index].price = details.price
      }
    }
    setBlocks(newBlocks)
  }

  const removeBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index))
  }

  const handleSave = async (closeAccount: boolean = false) => {
    // Validations
    if (blocks.length === 0 && assistants.filter(a => a !== "").length === 0) {
      toast.error("Adicione pelo menos um serviço ou profissional de apoio.")
      return
    }
    for (let i = 0; i < blocks.length; i++) {
      if (!blocks[i].employeeId || !blocks[i].serviceId || !blocks[i].time || blocks[i].duration === "" || blocks[i].price === "") {
        toast.error(`Preencha todos os campos do serviço ${i + 1}`)
        return
      }
    }

    // Validações de conflitos e regras de negócio
    for (const assistantId of assistants) {
      if (!assistantId) continue;
      const conflict = checkAppointmentConflict(appointment.appointment_time, appointment.duration_minutes, appointment.appointment_date, assistantId, store.appointments, appointment.id)
      if (conflict.hasConflict) {
        const profName = employees.find(e => e.id === assistantId)?.name || "Profissional"
        if (conflict.type === 'appointment') {
          const msg = `Já existe um agendamento para o profissional de apoio ${profName} neste período.\n\nDeseja criar outro agendamento no mesmo horário?`
          const confirmed = await confirm({ title: "Horário já ocupado (Apoio)", message: msg, confirmText: "Agendar mesmo assim", cancelText: "Cancelar" })
          if (!confirmed) return
        } else if (conflict.type === 'block') {
          const msg = `Este horário está bloqueado para o profissional de apoio ${profName}. Deseja agendar mesmo assim?`
          const confirmed = await confirm({ title: "Horário bloqueado (Apoio)", message: msg, confirmText: "Agendar mesmo assim", cancelText: "Cancelar" })
          if (!confirmed) return
        }
      }
    }

    const parseNumber = (val: string | number) => {
      if (val === "" || val === null || val === undefined) return 0;
      if (typeof val === 'number') return isNaN(val) ? 0 : val;
      const str = val.toString().trim();
      if (str.includes('.') && str.includes(',')) return Number(str.replace(/\./g, '').replace(',', '.')) || 0;
      if (str.includes(',')) return Number(str.replace(',', '.')) || 0;
      return Number(str) || 0;
    }

    for (const block of blocks) {
      const bDuration = parseNumber(block.duration);
      const conflict = checkAppointmentConflict(block.time, bDuration, block.date, block.employeeId, store.appointments, appointment.id)
      if (conflict.hasConflict) {
        const profName = employees.find(e => e.id === block.employeeId)?.name || "Profissional"
        if (conflict.type === 'appointment') {
          const msg = `Já existe um agendamento para ${profName} às ${block.time}.\n\nDeseja criar outro agendamento no mesmo horário?`
          const confirmed = await confirm({ title: "Horário já ocupado (Adicional)", message: msg, confirmText: "Agendar mesmo assim", cancelText: "Cancelar" })
          if (!confirmed) return
        } else if (conflict.type === 'block') {
          const msg = `O horário de ${block.time} está bloqueado para ${profName}. Deseja agendar mesmo assim?`
          const confirmed = await confirm({ title: "Horário bloqueado (Adicional)", message: msg, confirmText: "Agendar mesmo assim", cancelText: "Cancelar" })
          if (!confirmed) return
        }
      }

      const emp = employees.find(e => e.id === block.employeeId) || null
      const businessRule = checkBusinessRules(block.time, bDuration, block.date, emp, store.businessHours, store.blockedDates)
      if (businessRule.errorType === 'blocked_date') {
        const msg = `Esta data está bloqueada${businessRule.reason ? `: ${businessRule.reason}` : ''}. Deseja criar o agendamento mesmo assim?`
        const confirmed = await confirm({ title: "Data bloqueada", message: msg, confirmText: "Criar mesmo assim", cancelText: "Cancelar" })
        if (!confirmed) return
      } else if (businessRule.errorType === 'closed_day') {
        if (businessRule.reason === 'Profissional não atende neste dia.') {
          const msg = "Este profissional está de folga nesta data. Deseja criar o agendamento mesmo assim?"
          const confirmed = await confirm({ title: "Profissional de Folga", message: msg, confirmText: "Confirmar agendamento", cancelText: "Cancelar" })
          if (!confirmed) return
        } else {
          const msg = "O estabelecimento está fechado nesta data. Deseja criar o agendamento mesmo assim?"
          const confirmed = await confirm({ title: "Estabelecimento Fechado", message: msg, confirmText: "Criar mesmo assim", cancelText: "Cancelar" })
          if (!confirmed) return
        }
      } else if (businessRule.errorType === 'out_of_hours') {
        if (businessRule.reason === 'Horário de almoço do profissional') {
          const msg = "Este profissional está em horário de almoço neste período. Deseja criar este agendamento mesmo assim?"
          const confirmed = await confirm({ title: "Horário de Almoço", message: msg, confirmText: "Confirmar agendamento", cancelText: "Cancelar" })
          if (!confirmed) return
        } else if (businessRule.reason === 'Horário de intervalo do profissional') {
          const msg = "Este profissional está em intervalo neste período. Deseja criar este agendamento mesmo assim?"
          const confirmed = await confirm({ title: "Horário de Intervalo", message: msg, confirmText: "Confirmar agendamento", cancelText: "Cancelar" })
          if (!confirmed) return
        } else {
          const msg = `Este agendamento termina às ${businessRule.endTimeStr}, mas o expediente termina às ${businessRule.closingTimeStr}.\nDeseja criar mesmo assim?`
          const confirmed = await confirm({ title: "Agendamento fora do expediente", message: msg, confirmText: "Criar mesmo assim", cancelText: "Cancelar" })
          if (!confirmed) return
        }
      }
    }

    setLoading(true)
    try {
      const validAssistants = assistants.filter(a => a !== "")
      
      // 1. Get or generate shared_group_id
      const hasMultipleProfessionals = blocks.some(b => b.employeeId !== appointment.employee_id) || validAssistants.length > 0
      let sharedGroupId = appointment.shared_group_id
      let isShared = appointment.is_shared_service || false

      if (hasMultipleProfessionals && !sharedGroupId) {
        sharedGroupId = crypto.randomUUID()
        isShared = true
      }

      // We need to fetch existing shared appointments to update their grand total
      let sharedApts: Appointment[] = []
      if (sharedGroupId) {
        sharedApts = await fetchCollectionWhere<Appointment>("appointments", "shared_group_id", "==", sharedGroupId)
        if (sharedApts.length === 0) sharedApts = [appointment] // Fallback
      } else {
        sharedApts = [appointment]
      }
      
      // Handle validAssistants logic first!
      if (validAssistants.length > 0) {
        const svc = services.find(s => s.id === appointment.service_id)
        const basePrice = svc?.promotional_price || svc?.price || 0
        const totalProfessionals = sharedApts.length + validAssistants.length
        const newBaseShare = basePrice / totalProfessionals
        
        // Update existing sharedApts
        for (const apt of sharedApts) {
          const additionalPrice = apt.additional_services?.reduce((acc, b) => acc + (parseNumber(b.price)), 0) || 0
          const newServicePrice = newBaseShare + additionalPrice
          
          await updateAppointment(
            apt.id,
            { service_price: newServicePrice, professional_service_value: newServicePrice, is_shared_service: true, shared_group_id: sharedGroupId },
            "updated",
            "Rateio atualizado",
            "O valor foi dividido com novos profissionais de apoio.",
            saasUser
          )
          
          apt.service_price = newServicePrice
          apt.professional_service_value = newServicePrice
          apt.is_shared_service = true
          apt.shared_group_id = sharedGroupId
        }
        
        // Create new Assistant Appointments
        for (const assistantId of validAssistants) {
          const asstProfName = employees.find(e => e.id === assistantId)?.name || 'Não definido'
          const asstApt = await createDocument("appointments", {
            company_id: appointment.company_id,
            client_id: appointment.client_id || null,
            client_name: appointment.client_name || "",
            client_phone: appointment.client_phone || "",
            client_email: appointment.client_email || null,
            service_id: appointment.service_id,
            service_name: appointment.service_name,
            service_price: newBaseShare,
            professional_service_value: newBaseShare,
            service_total_value: appointment.service_total_value || basePrice,
            employee_id: assistantId,
            employee_name: asstProfName,
            appointment_date: appointment.appointment_date,
            appointment_time: appointment.appointment_time,
            end_time: appointment.end_time || null,
            duration_minutes: appointment.duration_minutes,
            status: appointment.status || "pending",
            payment_method: null,
            payment_status: appointment.payment_status || "pending",
            notes: notes || null,
            label_ids: localLabelIds,
            priority_color: appointment.priority_color || null,
            is_shared_service: true,
            shared_group_id: sharedGroupId || null,
            additional_services: [],
            created_by_user_id: saasUser?.id || null,
            created_by_name: saasUser?.name || null,
          })
          
          const asstLogDesc = `Cliente: ${appointment.client_name} | Serviço: ${appointment.service_name} | Profissional de apoio: ${asstProfName}`
          
          import("@/lib/firebase/history-service").then(({ createHistoryEvent }) => {
            createHistoryEvent({
              client_id: appointment.client_id || null,
              client_name: appointment.client_name,
              appointment_id: asstApt.id,
              action_type: "created",
              action_title: "Agendamento criado (Apoio)",
              action_description: asstLogDesc,
              service_id: appointment.service_id,
              service_name: appointment.service_name || "",
              professional_id: assistantId,
              professional_name: asstProfName,
              performed_by_user_id: saasUser?.id || "system",
              performed_by_name: saasUser?.name || "Sistema",
              performed_by_email: saasUser?.email,
              performed_by_role: saasUser?.role
            }).catch(console.error)
          })
          
          sharedApts.push({ ...asstApt, id: asstApt.id } as Appointment)
        }
      }

      // Group blocks by Employee
      const groups = new Map<string, ServiceBlock[]>()
      for (const b of blocks) {
        if (!groups.has(b.employeeId)) groups.set(b.employeeId, [])
        groups.get(b.employeeId)!.push(b)
      }

      // Calculate new Grand Total for the entire shared group
      let originalGroupTotal = 0
      sharedApts.forEach(a => { originalGroupTotal += (a.service_price || 0) })
      
      let addedBlocksTotal = 0
      blocks.forEach(b => { addedBlocksTotal += parseNumber(b.price) })
      
      const newGrandTotal = originalGroupTotal + addedBlocksTotal

      // Process Groups
      for (const [empId, empBlocks] of groups.entries()) {
        const existingApt = sharedApts.find(a => a.employee_id === empId)

        if (existingApt) {
          // Update existing appointment
          const addedPrice = empBlocks.reduce((acc, b) => acc + parseNumber(b.price), 0)
          const addedDuration = empBlocks.reduce((acc, b) => acc + parseNumber(b.duration), 0)

          const newAdditionalServices = [
            ...(existingApt.additional_services || []),
            ...empBlocks.map(b => {
              const s = services.find(svc => svc.id === b.serviceId)
              const e = employees.find(emp => emp.id === b.employeeId)
              return {
                service_id: b.serviceId,
                service_name: s?.name || "",
                price: parseNumber(b.price),
                duration_minutes: parseNumber(b.duration),
                employee_id: b.employeeId,
                employee_name: e?.name || null
              }
            })
          ]

          const newTotalPrice = (existingApt.service_price || 0) + addedPrice
          const newTotalDuration = (existingApt.duration_minutes || 0) + addedDuration

          let newEndTime = existingApt.end_time
          if (existingApt.end_time && existingApt.appointment_time) {
            const [h, m] = existingApt.appointment_time.split(":").map(Number)
            const totalMin = h * 60 + m + newTotalDuration
            const newH = Math.floor(totalMin / 60)
            const newM = totalMin % 60
            newEndTime = `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`
          }

          const updateData: any = {
            additional_services: newAdditionalServices,
            service_price: newTotalPrice,
            professional_service_value: newTotalPrice,
            service_total_value: newGrandTotal,
            duration_minutes: newTotalDuration,
            end_time: newEndTime || null,
            notes: notes || null
          }

          if (isShared) {
            updateData.is_shared_service = true
            updateData.shared_group_id = sharedGroupId || null
          }

          await updateAppointment(
            existingApt.id,
            updateData,
            "service_added",
            "Serviços adicionados",
            `Foram adicionados ${empBlocks.length} serviços para este profissional.`,
            saasUser
          )

        } else {
          // Create NEW appointment for this employee
          const firstBlock = empBlocks[0]
          const otherBlocks = empBlocks.slice(1)
          
          const sName = services.find(svc => svc.id === firstBlock.serviceId)?.name || ""
          const eName = employees.find(emp => emp.id === firstBlock.employeeId)?.name || ""

          const addedPrice = empBlocks.reduce((acc, b) => acc + parseNumber(b.price), 0)
          const addedDuration = empBlocks.reduce((acc, b) => acc + parseNumber(b.duration), 0)

          const [h, m] = firstBlock.time.split(":").map(Number)
          const totalMin = h * 60 + m + addedDuration
          const newEndTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`

          const newAdditionalServices = otherBlocks.map(b => {
            const s = services.find(svc => svc.id === b.serviceId)
            const e = employees.find(emp => emp.id === b.employeeId)
            return {
              service_id: b.serviceId,
              service_name: s?.name || "",
              price: parseNumber(b.price),
              duration_minutes: parseNumber(b.duration),
              employee_id: b.employeeId,
              employee_name: e?.name || null
            }
          })

          const newAptData = {
            company_id: appointment.company_id || "",
            client_id: appointment.client_id || null,
            client_name: appointment.client_name || "",
            client_phone: appointment.client_phone || "",
            client_email: appointment.client_email || null,
            service_id: firstBlock.serviceId,
            service_name: sName,
            service_price: addedPrice,
            professional_service_value: addedPrice,
            service_total_value: newGrandTotal,
            employee_id: firstBlock.employeeId,
            employee_name: eName,
            appointment_date: firstBlock.date,
            appointment_time: firstBlock.time,
            end_time: newEndTime || null,
            duration_minutes: addedDuration,
            status: appointment.status || "pending",
            payment_method: null,
            payment_status: appointment.payment_status || "pending",
            notes: notes || null,
            label_ids: localLabelIds,
            priority_color: appointment.priority_color || null,
            is_shared_service: true,
            shared_group_id: sharedGroupId || null,
            additional_services: newAdditionalServices,
            created_by_user_id: saasUser?.id || null,
            created_by_name: saasUser?.name || null,
          }

          await createDocument("appointments", newAptData)
        }
      }

      // Make sure ALL other existing appointments in the shared group get the new Grand Total
      if (sharedGroupId) {
        for (const apt of sharedApts) {
          // If we didn't just update it above (i.e. it wasn't in our blocks map), we still need to update its grand total
          if (!groups.has(apt.employee_id || "")) {
            await updateAppointment(
              apt.id,
              { 
                service_total_value: newGrandTotal,
                is_shared_service: true,
                shared_group_id: sharedGroupId,
                notes: notes || null
              },
              "updated",
              "Valor total atualizado",
              "Valor total do grupo atualizado devido a adição de serviços.",
              saasUser
            )
          }
        }
      }

      toast.success("Serviços adicionados com sucesso")
      
      // Simulate an updated main appointment for onSuccess
      const updatedApt = {
        ...appointment,
        label_ids: localLabelIds,
        is_shared_service: isShared,
        shared_group_id: sharedGroupId,
        service_total_value: newGrandTotal,
      } as Appointment
      
      onSuccess(updatedApt)
      
      if (closeAccount && onAction) {
        onAction("close_account", updatedApt)
      }
      
      if (!closeAccount) {
        onClose()
      }
    } catch (error) {
      console.error("Erro ao adicionar serviço ao agendamento:", error)
      toast.error("Não foi possível adicionar o serviço. Verifique os dados e tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const toggleLabel = async (labelId: string) => {
    const current = localLabelIds
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
      setLocalLabelIds(newIds)
    } catch {
      toast.error("Erro ao atualizar etiquetas")
    }
  }

  // Common Styles
  const inputStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', color: '#1e293b', outline: 'none', background: '#fff', width: '100%' }
  const labelColStyle: React.CSSProperties = { width: '120px', textAlign: 'right', fontSize: '0.875rem', fontWeight: 700, color: '#334155', flexShrink: 0 }
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.625rem' }
  const dashedLine = <hr style={{ border: 'none', borderTop: '1px dashed #cbd5e1', margin: '1.25rem 0' }} />
  
  const currentLabelIds = localLabelIds
  const appliedLabels = labels.filter(l => currentLabelIds.includes(l.id))
  
  const actionIconBtn = { background: 'transparent', border: 'none', cursor: 'pointer', color: '#b45309', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }

  return (
    <>
      <ConfirmationDialog />
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
        zIndex: 10100, animation: 'modalFadeIn 0.2s ease-out'
      }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10101,
        background: '#f8fafc', borderRadius: '0.75rem', width: '100%', maxWidth: '800px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', animation: 'modalScaleIn 0.2s ease-out',
        display: 'flex', flexDirection: 'column', maxHeight: '95vh', overflow: 'hidden'
      }}>
        
        {/* Header */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users style={{ width: '18px', height: '18px', color: '#7c5cfc' }} />
            Adicionar Serviços ao Agendamento
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X style={{ width: '20px', height: '20px', color: '#64748b' }}/></button>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
          
          {/* ===================== TOP BLOCK: CLIENT DATA ===================== */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={rowStyle}>
                <div style={labelColStyle}>Cliente:</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                  <input type="text" readOnly value={appointment.client_name || ""} style={{...inputStyle, maxWidth: '300px', background: '#f1f5f9'}} />
                  <button onClick={() => setShowLabelPicker(!showLabelPicker)} style={actionIconBtn} title="Etiquetas"><Tag style={{ width: '18px', height: '18px' }}/></button>
                  <button onClick={() => toast.info("Chat/Mensagem (Em breve)")} style={{...actionIconBtn, color: '#991b1b'}} title="Mensagem"><MessageSquare style={{ width: '18px', height: '18px' }}/></button>
                  <button onClick={() => setShowHistory(true)} style={{...actionIconBtn, color: '#eab308'}} title="Histórico"><Briefcase style={{ width: '18px', height: '18px' }}/></button>
                  <button onClick={() => setShowFicha(true)} style={{...actionIconBtn, color: '#f97316'}} title="Ficha Completa"><FileText style={{ width: '18px', height: '18px' }}/></button>
                </div>
              </div>
              
              <div style={rowStyle}>
                <div style={labelColStyle}>CPF:</div>
                <div style={{ fontSize: '0.875rem', color: '#475569' }}>
                  {client?.cpf ? `***.${client.cpf.slice(4, 7)}.${client.cpf.slice(8, 11)}-**` : '***.***.***-**'}
                </div>
              </div>
              
              <div style={rowStyle}>
                <div style={labelColStyle}>Email:</div>
                <div style={{ fontSize: '0.875rem', color: '#475569' }}>
                  {appointment.client_email || client?.email || 'Não informado'}
                </div>
              </div>
              
              <div style={rowStyle}>
                <div style={labelColStyle}>Telefone:</div>
                <div style={{ fontSize: '0.875rem', color: '#475569' }}>
                  {appointment.client_phone ? formatPhone(appointment.client_phone) : '(**) *****-****'}
                </div>
              </div>
              
              <div style={rowStyle}>
                <div style={labelColStyle}>Observações:</div>
                <div style={{ fontSize: '0.875rem', color: '#475569' }}>
                  {client?.notes || 'Nenhuma'}
                </div>
              </div>
              
              <div style={rowStyle}>
                <div style={labelColStyle}>Etiquetas:</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button onClick={() => setShowLabelPicker(!showLabelPicker)} style={{ border: '1px dashed #cbd5e1', background: 'transparent', padding: '0.125rem 0.375rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus style={{ width: '14px', height: '14px', color: '#64748b' }} />
                  </button>
                  {appliedLabels.map(l => (
                    <span key={l.id} style={{ fontSize: '0.6875rem', padding: '0.125rem 0.375rem', borderRadius: '4px', background: l.color + '20', color: l.color, border: `1px solid ${l.color}40`, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      {l.name} <X onClick={() => toggleLabel(l.id)} style={{ width: '10px', height: '10px', cursor: 'pointer' }}/>
                    </span>
                  ))}
                </div>
              </div>
              
              {showLabelPicker && (
                <div style={{ marginLeft: '120px', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '0.5rem', maxWidth: '300px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {labels.map(l => {
                      const isApplied = currentLabelIds.includes(l.id)
                      return (
                        <span key={l.id} onClick={() => toggleLabel(l.id)} style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', background: isApplied ? l.color + '20' : '#fff', color: isApplied ? l.color : '#475569', border: `1px solid ${isApplied ? l.color : '#cbd5e1'}` }}>
                          {l.name}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            
            {/* Avatar */}
            <div style={{ width: '80px', height: '80px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '2rem', borderRadius: '8px' }}>
              <User style={{ width: '40px', height: '40px' }}/>
            </div>
          </div>

          {dashedLine}

          {/* ===================== BLOCKS OF SERVICES ===================== */}
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>Serviços Adicionais</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => handleAddBlock(true)} style={{ background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Plus style={{ width: '14px', height: '14px' }}/> Serviço
              </button>
              <button onClick={() => handleAddBlock(false)} style={{ background: '#f0ecff', color: '#7c5cfc', border: '1px solid #e0d4ff', borderRadius: '6px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Plus style={{ width: '14px', height: '14px' }}/> Adicionar outro profissional
              </button>
              <button onClick={() => setAssistants([...assistants, ""])} style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '6px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Plus style={{ width: '14px', height: '14px' }}/> Profissional de apoio
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {assistants.length > 0 && assistants.map((assistantId, index) => (
              <div key={`asst-${index}`} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '1rem', position: 'relative' }}>
                <button onClick={() => setAssistants(assistants.filter((_, i) => i !== index))} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                  <Trash2 style={{ width: '16px', height: '16px' }} />
                </button>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', marginBottom: '0.5rem' }}>Profissional de Apoio {index + 1} (Dividir serviço atual)</label>
                <div style={{ display: 'flex', gap: '0.5rem', paddingRight: '2rem' }}>
                  <select
                    value={assistantId}
                    onChange={e => {
                      const newAssistants = [...assistants]
                      newAssistants[index] = e.target.value
                      setAssistants(newAssistants)
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    <option value="" disabled>Selecione um profissional de apoio</option>
                    {employees.filter(e => e.id !== appointment.employee_id).map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {blocks.map((block, index) => {
              const activeEmp = employees.find(e => e.id === block.employeeId)
              const availableSvcs = activeEmp?.service_ids 
                ? services.filter(s => s.is_active && activeEmp.service_ids.includes(s.id))
                : services.filter(s => s.is_active)

              return (
                <div key={block.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', position: 'relative' }}>
                  
                  <button onClick={() => removeBlock(index)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                    <Trash2 style={{ width: '16px', height: '16px' }} />
                  </button>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingRight: '2rem' }}>
                    
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem' }}>Profissional</label>
                      <select value={block.employeeId} onChange={e => updateBlock(index, 'employeeId', e.target.value)} style={inputStyle}>
                        <option value="">Selecione o profissional</option>
                        {employees.filter(e => e.is_active && e.has_schedule !== false).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem' }}>Serviço</label>
                      <select value={block.serviceId} onChange={e => updateBlock(index, 'serviceId', e.target.value)} style={inputStyle} disabled={!block.employeeId}>
                        <option value="">Selecione o serviço</option>
                        {availableSvcs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem' }}>Data</label>
                        <input type="date" value={block.date} onChange={e => updateBlock(index, 'date', e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem' }}>Início</label>
                        <input type="time" value={block.time} onChange={e => updateBlock(index, 'time', e.target.value)} style={{ ...inputStyle, background: block.waitPrevious ? '#f1f5f9' : '#fff' }} readOnly={block.waitPrevious} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem' }}>Duração (min)</label>
                        <input type="number" min={0} value={block.duration} onChange={e => updateBlock(index, 'duration', Number(e.target.value))} style={inputStyle} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem' }}>Valor (R$)</label>
                        <input type="text" value={block.price} onChange={e => updateBlock(index, 'price', e.target.value)} style={inputStyle} />
                      </div>
                    </div>

                  </div>

                  <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#475569', cursor: 'pointer', fontWeight: 500 }}>
                      <input type="checkbox" checked={block.waitPrevious} onChange={e => updateBlock(index, 'waitPrevious', e.target.checked)} style={{ width: '14px', height: '14px' }} />
                      Aguardar término do serviço anterior (Sequencial)
                    </label>
                  </div>
                </div>
              )
            })}
            
            {blocks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#94a3b8' }}>
                Clique em um dos botões acima para adicionar serviços
              </div>
            )}
          </div>

          {dashedLine}

          {/* ===================== BOTTOM BLOCK: NOTES & SAVE ===================== */}
          
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div style={{ ...labelColStyle, paddingTop: '0.5rem' }}>Observações<br/><span style={{fontWeight: 400, fontSize: '0.75rem'}}>(opcional):</span></div>
            <div style={{ flex: 1 }}>
              <textarea 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                maxLength={400}
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} 
              />
            </div>
          </div>
          
          <div style={{ marginLeft: '120px', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              <input type="checkbox" checked={notifyClient} onChange={e => setNotifyClient(e.target.checked)} style={{ width: '16px', height: '16px' }} />
              Notificar cliente sobre alterações
            </label>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Valor Total Previsto</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
              {formatCurrency((appointment.service_price || 0) + blocks.reduce((acc, b) => acc + (Number(b.price) || 0), 0))}
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => handleSave(true)} disabled={loading} style={{
              padding: '0.625rem 1.25rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0',
              background: '#fff', color: '#334155', fontWeight: 700, fontSize: '0.875rem', cursor: loading ? 'not-allowed' : 'pointer'
            }}>
              Salvar e fechar conta
            </button>
            
            <button onClick={() => handleSave(false)} disabled={loading} style={{
              padding: '0.625rem 2rem', borderRadius: '0.375rem', border: 'none',
              background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(124,92,252,0.25)'
            }}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      {/* Child Modals */}
      {showHistory && client && <ClientHistoryModal client={client} onClose={() => setShowHistory(false)} />}
      {showFicha && client && <ClientFormModal client={client} onClose={() => setShowFicha(false)} onSave={async () => { setShowFicha(false); toast.success("Ficha atualizada"); }} />}
    </>
  )
}
