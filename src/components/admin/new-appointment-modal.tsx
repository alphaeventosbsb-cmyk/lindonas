"use client"
import { useState, useEffect, useMemo } from "react"
import { X, Search, Plus, Calendar, Clock, DollarSign, FileText, User, Scissors, Loader2, Trash2, Edit3 } from "lucide-react"
import { fetchCollection, createDocument, updateDocument, createAppointmentLog, updateAppointment } from "@/lib/firebase/client-utils"
import { uploadToCloudinary } from "@/lib/cloudinary"
import type { Service, Employee, Client } from "@/lib/types/database"
import { formatCurrency, toLocalDateStr, validateScheduleOvertime, checkBlockConflict, checkBusinessRules, checkAppointmentConflict } from "@/lib/utils"
import { toast } from "sonner"
import { ClientFormModal } from "@/components/admin/client-form-modal"
import { useConfirm } from "@/components/ui/confirm-modal"
import { useAgendaStore } from "@/components/admin/agenda/agenda-store"
import { ClientHistoryModal } from "@/components/admin/agenda/client-history-modal"
import { AddServiceBlockModal } from "@/components/admin/agenda/add-service-block-modal"
import { useTenant } from "@/lib/auth/tenant-context"

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

interface Props { onClose: () => void; onDone: () => void; prefill?: import('@/lib/types/database').Appointment; editMode?: boolean }

export function NewAppointmentModal({ onClose, onDone, prefill, editMode }: Props) {
  const store = useAgendaStore()
  const { saasUser } = useTenant()
  const [services, setServices] = useState<Service[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { ConfirmationDialog, confirm } = useConfirm()

  // Form
  const [clientSearch, setClientSearch] = useState("")
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showNewClient, setShowNewClient] = useState(false)
  const [showClientHistory, setShowClientHistory] = useState(false)
  const [selectedService, setSelectedService] = useState("")
  const [serviceSearch, setServiceSearch] = useState("")
  const [showServiceDropdown, setShowServiceDropdown] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState("")
  const [date, setDate] = useState(toLocalDateStr())
  const [time, setTime] = useState("")
  const [duration, setDuration] = useState(30)
  const [price, setPrice] = useState(0)
  const [notes, setNotes] = useState("")

  const [blocks, setBlocks] = useState<ServiceBlock[]>([])
  const [addingBlockMode, setAddingBlockMode] = useState<"same" | "other" | null>(null)
  
  // Array of employee IDs representing assistant professionals
  const [assistants, setAssistants] = useState<string[]>([])

  const applyServiceDetailsToBlock = (serviceId: string, empId: string) => {
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

  useEffect(() => {
    setBlocks(prevBlocks => {
      let changed = false
      const newBlocks = [...prevBlocks]
      
      let lastEndTimeStr = time && duration ? addMinutes(time, duration) : time
      
      for (let i = 0; i < newBlocks.length; i++) {
        const b = newBlocks[i]
        
        if (b.waitPrevious && b.time !== lastEndTimeStr) {
          b.time = lastEndTimeStr
          changed = true
        }

        if (b.time && typeof b.duration === 'number') {
          const [h, m] = b.time.split(':').map(Number)
          const endTotal = h * 60 + m + b.duration
          lastEndTimeStr = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`
        }
      }
      
      return changed ? newBlocks : prevBlocks
    })
  }, [blocks, time, duration])

  const handleAddBlock = (keepEmployee: boolean) => {
    setAddingBlockMode(keepEmployee ? "same" : "other")
  }

  const handleSaveNewBlock = (block: any) => {
    setBlocks([...blocks, block])
    setAddingBlockMode(null)
  }

  const updateBlock = (index: number, field: keyof ServiceBlock, value: any) => {
    const newBlocks = [...blocks]
    newBlocks[index] = { ...newBlocks[index], [field]: value }
    
    if ((field === 'serviceId' || field === 'employeeId') && newBlocks[index].serviceId) {
      const details = applyServiceDetailsToBlock(newBlocks[index].serviceId, newBlocks[index].employeeId)
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

  useEffect(() => {
    async function load() {
      try {
        const [svc, emp, cli] = await Promise.all([
          fetchCollection<Service>("services"),
          fetchCollection<Employee>("employees"),
          fetchCollection<Client>("clients"),
        ])
        console.log(`[NewAppointment] Loaded: ${svc.length} services, ${emp.length} employees, ${cli.length} clients`)
        setServices(svc.filter(s => s.is_active))
        setEmployees(emp.filter(e => e.is_active && e.has_schedule !== false))
        setClients(cli)
      } catch (err) {
        console.error("[NewAppointment] Failed to load data:", err)
        toast.error("Erro ao carregar dados")
      }
      setLoading(false)

      // Pre-fill from duplicate (wait for state to be set)
    }
    load()
  }, [])

  // Pre-fill when data loads
  useEffect(() => {
    if (loading || !prefill) return
    if (prefill.service_id) {
      setSelectedService(prefill.service_id)
      setPrice(prefill.service_price)
    }
    if (prefill.employee_id) setSelectedEmployee(prefill.employee_id)
    setDuration(prefill.duration_minutes)
    setDate(prefill.appointment_date)
    setTime(prefill.appointment_time)
    setNotes(prefill.notes || '')
    const matchedClient = clients.find(c => c.phone === prefill.client_phone || c.id === prefill.client_id)
    if (matchedClient) {
      setSelectedClient(matchedClient)
    } else {
      setClientSearch(prefill.client_name || prefill.client_phone || "")
    }
  }, [loading, prefill])

  // ── Client search (local filtering with normalization) ──
  const normalizePhone = (p: string) => p.replace(/\D/g, "")

  const filteredClients = useMemo(() => {
    if (clientSearch.length < 2) return []
    const q = clientSearch.toLowerCase().trim()
    const qPhone = normalizePhone(clientSearch)

    return clients.filter(c => {
      // Name match
      if (c.name?.toLowerCase().includes(q)) return true
      // Nickname match
      if ((c as any).nickname?.toLowerCase().includes(q)) return true
      // Phone match (normalized)
      if (c.phone && normalizePhone(c.phone).includes(qPhone) && qPhone.length >= 2) return true
      // WhatsApp match
      if ((c as any).whatsapp && normalizePhone((c as any).whatsapp).includes(qPhone) && qPhone.length >= 2) return true
      // Email match
      if (c.email?.toLowerCase().includes(q)) return true
      // CPF match
      if ((c as any).cpf && qPhone.length >= 3 && (c as any).cpf.includes(qPhone)) return true
      return false
    }).slice(0, 8)
  }, [clientSearch, clients])

  // ── Service search (local filtering based on selected employee) ──
  const activeEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmployee) || null
  }, [employees, selectedEmployee])

  const availableServices = useMemo(() => {
    if (!selectedEmployee || !activeEmployee) return services // if 'Qualquer' is selected, show all
    if (!activeEmployee.service_ids) return [] // no services for this professional
    return services.filter(s => activeEmployee.service_ids.includes(s.id))
  }, [services, selectedEmployee, activeEmployee])

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return availableServices
    const q = serviceSearch.toLowerCase().trim()
    return availableServices.filter(s => s.name.toLowerCase().includes(q))
  }, [serviceSearch, availableServices])

  const applyServiceDetails = (serviceId: string, empId: string | null) => {
    const svc = services.find(s => s.id === serviceId)
    if (!svc) return

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

    setDuration(finalDuration)
    setPrice(finalPrice)
  }

  const selectedServiceObj = services.find(s => s.id === selectedService) || null

  const handleServiceSelect = (id: string) => {
    setSelectedService(id)
    setShowServiceDropdown(false)
    setServiceSearch("")
    applyServiceDetails(id, selectedEmployee)
  }

  const handleEmployeeSelect = (empId: string) => {
    setSelectedEmployee(empId)
    
    // If a service is currently selected, verify if the new employee can perform it
    if (selectedService && empId) {
      const emp = employees.find(e => e.id === empId)
      const canPerform = emp?.service_ids?.includes(selectedService)
      
      if (!canPerform) {
        // Clear invalid service
        setSelectedService("")
        setDuration(30)
        setPrice(0)
      } else {
        // Update price and duration for the new employee
        applyServiceDetails(selectedService, empId)
      }
    } else if (selectedService && !empId) {
       // Reset to standard price/duration if changing back to 'Qualquer'
       applyServiceDetails(selectedService, null)
    }
  }

  const formatPhoneInput = (v: string) => {
    const c = v.replace(/\D/g, "").slice(0, 11)
    if (c.length <= 2) return c
    if (c.length <= 7) return `(${c.slice(0, 2)}) ${c.slice(2)}`
    return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`
  }

  const addMinutes = (t: string, m: number) => {
    const [h, min] = t.split(":").map(Number)
    const total = h * 60 + min + m
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
  }

  const handleSaveClient = async (data: any, photoFile: File | null, oldPhotoUrl: string | null) => {
    try {
      let photoUrl = data.photo_url || null

      if (photoFile) {
        photoUrl = await uploadToCloudinary(photoFile, "salao/clientes")
      }

      const saveData = { ...data, photo_url: photoUrl }
      const newClient = await createDocument("clients", saveData) as Client
      
      setClients(prev => [...prev, newClient])
      setSelectedClient(newClient)
      setClientSearch("")
      setShowNewClient(false)
      toast.success("Cliente cadastrado com sucesso!")
    } catch (err) {
      console.error("Erro ao salvar cliente:", err)
      toast.error(err instanceof Error ? err.message : "Erro ao salvar cliente")
      throw err
    }
  }

  const handleSubmit = async () => {
    const clientName = selectedClient?.name
    const clientPhone = selectedClient?.phone
    const svc = services.find(s => s.id === selectedService)

    if (!clientName || !clientName.trim()) { toast.error("Selecione ou cadastre o cliente"); return }
    if (!clientPhone || clientPhone.length < 10) { toast.error("Telefone inválido"); return }
    if (!selectedService) { toast.error("Selecione o serviço"); return }
    if (!time) { toast.error("Informe o horário"); return }

    const emp = employees.find(e => e.id === selectedEmployee) || null
    
    if (selectedEmployee) {
      const conflict = checkAppointmentConflict(time, duration, date, selectedEmployee, store.appointments, prefill?.id)
      if (conflict.hasConflict) {
        if (conflict.type === 'appointment') {
          toast.error("Horário indisponível. Já existe um agendamento para este profissional neste período.")
          return
        } else if (conflict.type === 'block') {
          const msg = `Este horário está bloqueado para este profissional. Deseja agendar mesmo assim?\n\nMotivo: ${conflict.conflict?.client_name || 'Bloqueio'}\nHorário do bloqueio: ${conflict.conflict?.appointment_time} → ${conflict.conflict?.end_time || '-'}\nHorário do agendamento: ${time}`
          const confirmed = await confirm({
            title: "Horário bloqueado",
            message: msg,
            confirmText: "Agendar mesmo assim",
            cancelText: "Cancelar"
          })
          if (!confirmed) return
        }
      }
    }

    // Check conflict for assistant professionals
    for (const assistantId of assistants) {
      if (!assistantId) continue;
      const conflict = checkAppointmentConflict(time, duration, date, assistantId, store.appointments, prefill?.id)
      if (conflict.hasConflict) {
        const profName = employees.find(e => e.id === assistantId)?.name || "Profissional"
        if (conflict.type === 'appointment') {
          toast.error(`Horário indisponível para o profissional de apoio ${profName}. Já existe um agendamento neste período.`)
          return
        } else if (conflict.type === 'block') {
          const msg = `Este horário está bloqueado para o profissional de apoio ${profName}. Deseja agendar mesmo assim?`
          const confirmed = await confirm({
            title: "Horário bloqueado (Apoio)",
            message: msg,
            confirmText: "Agendar mesmo assim",
            cancelText: "Cancelar"
          })
          if (!confirmed) return
        }
      }
    }

    // Check conflicts for additional blocks
    for (const block of blocks) {
      const bDuration = Number(block.duration) || 0;
      const conflict = checkAppointmentConflict(block.time, bDuration, block.date, block.employeeId, store.appointments, prefill?.id)
      if (conflict.hasConflict) {
        const profName = employees.find(e => e.id === block.employeeId)?.name || "Profissional"
        if (conflict.type === 'appointment') {
          toast.error(`Horário indisponível para ${profName} às ${block.time}. Já existe um agendamento.`)
          return
        } else if (conflict.type === 'block') {
          const msg = `O horário de ${block.time} está bloqueado para ${profName}. Deseja agendar mesmo assim?`
          const confirmed = await confirm({
            title: "Horário bloqueado (Adicional)",
            message: msg,
            confirmText: "Agendar mesmo assim",
            cancelText: "Cancelar"
          })
          if (!confirmed) return
        }
      }
    }

    const businessRule = checkBusinessRules(time, duration, date, emp, store.businessHours, store.blockedDates)
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

    setSubmitting(true)
    try {
      // ── EDIT MODE: update existing appointment ──
      if (editMode && prefill?.id) {
        const updateData: any = {}
        const logParts: string[] = []

        // Detect what changed
        if (selectedService !== prefill.service_id) {
          updateData.service_id = selectedService
          updateData.service_name = svc?.name || ""
          logParts.push(`Serviço alterado de "${prefill.service_name}" para "${svc?.name || ''}"`)
        }
        if (selectedEmployee !== (prefill.employee_id || "")) {
          updateData.employee_id = selectedEmployee || null
          updateData.employee_name = emp?.name || null
          logParts.push(`Profissional alterado de "${prefill.employee_name || 'Não definido'}" para "${emp?.name || 'Não definido'}"`)
        }
        if (price !== prefill.service_price) {
          updateData.service_price = price
          logParts.push(`Valor alterado de R$${prefill.service_price?.toFixed(2)} para R$${(price || 0).toFixed(2)}`)
        }
        if (duration !== prefill.duration_minutes) {
          updateData.duration_minutes = duration
          logParts.push(`Duração alterada de ${prefill.duration_minutes}min para ${duration}min`)
        }
        if (date !== prefill.appointment_date) {
          updateData.appointment_date = date
          logParts.push(`Data alterada de ${prefill.appointment_date.split('-').reverse().join('/')} para ${date.split('-').reverse().join('/')}`)
        }
        if (time !== prefill.appointment_time) {
          updateData.appointment_time = time
          logParts.push(`Horário alterado de ${prefill.appointment_time} para ${time}`)
        }
        if ((notes || '') !== (prefill.notes || '')) {
          updateData.notes = notes || null
        }
        if (selectedClient?.id && selectedClient.id !== prefill.client_id) {
          updateData.client_id = selectedClient.id
          updateData.client_name = selectedClient.name
          updateData.client_phone = selectedClient.phone
          logParts.push(`Cliente alterado de "${prefill.client_name}" para "${selectedClient.name}"`)
        }

        // Recalculate end_time
        if (updateData.appointment_time || updateData.duration_minutes) {
          const finalTime = updateData.appointment_time || prefill.appointment_time
          const finalDuration = updateData.duration_minutes || prefill.duration_minutes
          updateData.end_time = addMinutes(finalTime, finalDuration)
        }

        if (Object.keys(updateData).length === 0 && logParts.length === 0) {
          toast.info("Nenhuma alteração detectada")
          setSubmitting(false)
          return
        }

        await updateAppointment(
          prefill.id,
          updateData,
          "edited",
          "Agendamento editado",
          logParts.length > 0 ? logParts.join(" | ") : "Agendamento atualizado",
          saasUser
        )

        toast.success("Agendamento atualizado com sucesso!")
        onDone()
        setSubmitting(false)
        return
      }

      // ── CREATE MODE: existing flow below ──
      const isSharedDuplication = Boolean(
        prefill &&
        prefill.id &&
        selectedEmployee &&
        selectedEmployee !== prefill.employee_id &&
        date === prefill.appointment_date &&
        time === prefill.appointment_time &&
        selectedService === prefill.service_id
      )

      let sharedGroupId: string | null = null;
      let finalServicePrice = price || 0;
      let serviceTotalValue: number | null = null;
      let professionalServiceValue: number | null = null;
      let isSharedService: boolean | null = null;

      const validAssistants = assistants.filter(a => a !== "")
      
      if (validAssistants.length > 0) {
        const totalProfessionals = 1 + validAssistants.length;
        sharedGroupId = crypto.randomUUID();
        finalServicePrice = (price || 0) / totalProfessionals;
        serviceTotalValue = price || 0;
        professionalServiceValue = (price || 0) / totalProfessionals;
        isSharedService = true;
      } else if (isSharedDuplication && prefill?.id) {
        sharedGroupId = prefill.shared_group_id || prefill.id;
        
        // Find all existing appointments in this shared group
        const existingShared = prefill.shared_group_id 
          ? store.appointments.filter(a => a.shared_group_id === prefill.shared_group_id)
          : [prefill]; // if it's the first split, the group has 1 existing appointment
          
        const totalProfessionals = existingShared.length + 1;
        
        finalServicePrice = (price || 0) / totalProfessionals;
        serviceTotalValue = price || 0;
        professionalServiceValue = (price || 0) / totalProfessionals;
        isSharedService = true;

        try {
          // Update all original appointments in the group
          for (const apt of existingShared) {
            await updateDocument("appointments", apt.id, {
              is_shared_service: true,
              shared_group_id: sharedGroupId || "shared-error",
              service_total_value: serviceTotalValue,
              professional_service_value: professionalServiceValue,
              service_price: finalServicePrice,
              updated_at: new Date().toISOString()
            })
          }
        } catch (updateErr: any) {
          console.error("Erro ao atualizar agendamentos do grupo:", updateErr);
          toast.error("Erro ao atualizar o agendamento original. " + (updateErr?.message || ""));
          setSubmitting(false);
          return;
        }
      }

      const newApt = await createDocument("appointments", {
        company_id: "default",
        service_id: selectedService,
        service_name: svc?.name || "",
        service_price: finalServicePrice,
        is_shared_service: isSharedService || null,
        shared_group_id: sharedGroupId,
        service_total_value: serviceTotalValue || null,
        professional_service_value: professionalServiceValue || null,
        employee_id: selectedEmployee || null,
        employee_name: employees.find(e => e.id === selectedEmployee)?.name || null,
        client_id: selectedClient?.id || null,
        client_name: clientName,
        client_phone: clientPhone,
        client_email: null,
        appointment_date: date,
        appointment_time: time,
        end_time: addMinutes(time, duration),
        duration_minutes: duration,
        status: "confirmed",
        payment_method: null,
        payment_status: "pending",
        notes: notes || null,
        priority_color: null,
        source: "admin",
        created_by_user_id: saasUser?.id || null,
        created_by_name: saasUser?.name || null,
      })

      const profName = employees.find(e => e.id === selectedEmployee)?.name || 'Não definido'
      let logDesc = `Cliente: ${clientName} | Serviço: ${svc?.name} | Profissional: ${profName}`
      if (businessRule.errorType === 'closed_day' && businessRule.reason === 'Profissional não atende neste dia.') {
        logDesc += ` | Exceção: O usuário ${saasUser?.name || "Sistema"} criou excepcionalmente um agendamento na folga do profissional ${profName}.`
      } else if (businessRule.errorType === 'out_of_hours' && businessRule.reason === 'Horário de almoço do profissional') {
        logDesc += ` | Exceção: Agendamento criado manualmente durante horário de almoço do profissional ${profName}.`
      } else if (businessRule.errorType === 'out_of_hours' && businessRule.reason === 'Horário de intervalo do profissional') {
        logDesc += ` | Exceção: Agendamento criado manualmente durante intervalo do profissional ${profName}.`
      }

      await createAppointmentLog(
        newApt.id,
        "created",
        "Agendamento criado",
        logDesc,
        saasUser
      )

      import("@/lib/firebase/history-service").then(({ createHistoryEvent }) => {
        createHistoryEvent({
          client_id: selectedClient?.id || null,
          client_name: clientName,
          appointment_id: newApt.id,
          action_type: "created",
          action_title: "Agendamento criado",
          action_description: logDesc,
          service_id: selectedService,
          service_name: svc?.name || "",
          professional_id: selectedEmployee || null,
          professional_name: profName,
          performed_by_user_id: saasUser?.id || "system",
          performed_by_name: saasUser?.name || "Sistema",
          performed_by_email: saasUser?.email,
          performed_by_role: saasUser?.role
        }).catch(console.error)
      })

      if (validAssistants.length > 0 && sharedGroupId) {
        for (const assistantId of validAssistants) {
          const asstProfName = employees.find(e => e.id === assistantId)?.name || 'Não definido'
          const asstApt = await createDocument("appointments", {
            company_id: "default",
            service_id: selectedService,
            service_name: svc?.name || "",
            service_price: finalServicePrice,
            is_shared_service: true,
            shared_group_id: sharedGroupId,
            service_total_value: serviceTotalValue,
            professional_service_value: professionalServiceValue,
            employee_id: assistantId,
            employee_name: asstProfName,
            client_id: selectedClient?.id || null,
            client_name: clientName,
            client_phone: clientPhone,
            client_email: null,
            appointment_date: date,
            appointment_time: time,
            end_time: addMinutes(time, duration),
            duration_minutes: duration,
            status: "confirmed",
            payment_method: null,
            payment_status: "pending",
            notes: notes || null,
            priority_color: null,
            source: "admin",
            created_by_user_id: saasUser?.id || null,
            created_by_name: saasUser?.name || null,
          })

          const asstLogDesc = `Cliente: ${clientName} | Serviço: ${svc?.name} | Profissional de apoio: ${asstProfName}`
          await createAppointmentLog(
            asstApt.id,
            "created",
            "Agendamento criado (Apoio)",
            asstLogDesc,
            saasUser
          )

          import("@/lib/firebase/history-service").then(({ createHistoryEvent }) => {
            createHistoryEvent({
              client_id: selectedClient?.id || null,
              client_name: clientName,
              appointment_id: asstApt.id,
              action_type: "created",
              action_title: "Agendamento criado (Apoio)",
              action_description: asstLogDesc,
              service_id: selectedService,
              service_name: svc?.name || "",
              professional_id: assistantId,
              professional_name: asstProfName,
              performed_by_user_id: saasUser?.id || "system",
              performed_by_name: saasUser?.name || "Sistema",
              performed_by_email: saasUser?.email,
              performed_by_role: saasUser?.role
            }).catch(console.error)
          })
        }
      }

      if (blocks.length > 0) {
        let currentSharedGroupId = newApt.shared_group_id
        let isShared = newApt.is_shared_service || false

        const hasMultipleProfessionals = blocks.some(b => b.employeeId !== selectedEmployee)
        if (hasMultipleProfessionals && !currentSharedGroupId) {
          currentSharedGroupId = crypto.randomUUID()
          isShared = true
        }

        const groups = new Map<string, ServiceBlock[]>()
        for (const b of blocks) {
          if (!groups.has(b.employeeId)) groups.set(b.employeeId, [])
          groups.get(b.employeeId)!.push(b)
        }

        let addedBlocksTotal = 0
        blocks.forEach(b => { addedBlocksTotal += Number(b.price) })
        const newGrandTotal = finalServicePrice + addedBlocksTotal

        for (const [empId, empBlocks] of groups.entries()) {
          if (empId === selectedEmployee) {
            const addedPrice = empBlocks.reduce((acc, b) => acc + Number(b.price), 0)
            const addedDuration = empBlocks.reduce((acc, b) => acc + Number(b.duration), 0)

            const newAdditionalServices = empBlocks.map(b => {
              const s = services.find(sv => sv.id === b.serviceId)
              const e = employees.find(em => em.id === b.employeeId)
              return {
                service_id: b.serviceId,
                service_name: s?.name || "",
                price: Number(b.price),
                duration_minutes: Number(b.duration),
                employee_id: b.employeeId,
                employee_name: e?.name || null
              }
            })

            const newTotalPrice = finalServicePrice + addedPrice
            const newTotalDuration = duration + addedDuration

            let newEndTime = newApt.end_time
            if (newApt.end_time && newApt.appointment_time) {
              const [h, m] = newApt.appointment_time.split(":").map(Number)
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
              end_time: newEndTime || null
            }

            if (isShared) {
              updateData.is_shared_service = true
              updateData.shared_group_id = currentSharedGroupId
            }

            await updateAppointment(
              newApt.id,
              updateData,
              "service_added",
              "Serviços adicionados",
              `Foram adicionados ${empBlocks.length} serviços para este profissional na criação.`,
              saasUser
            )
          } else {
            const firstBlock = empBlocks[0]
            const otherBlocks = empBlocks.slice(1)
            
            const sName = services.find(sv => sv.id === firstBlock.serviceId)?.name || ""
            const eName = employees.find(em => em.id === firstBlock.employeeId)?.name || ""

            const addedPrice = empBlocks.reduce((acc, b) => acc + Number(b.price), 0)
            const addedDuration = empBlocks.reduce((acc, b) => acc + Number(b.duration), 0)

            const [h, m] = firstBlock.time.split(":").map(Number)
            const totalMin = h * 60 + m + addedDuration
            const newEndTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`

            const newAdditionalServices = otherBlocks.map(b => {
              const s = services.find(sv => sv.id === b.serviceId)
              const e = employees.find(em => em.id === b.employeeId)
              return {
                service_id: b.serviceId,
                service_name: s?.name || "",
                price: Number(b.price),
                duration_minutes: Number(b.duration),
                employee_id: b.employeeId,
                employee_name: e?.name || null
              }
            })

            const newAptData = {
              company_id: "default",
              client_id: selectedClient?.id || null,
              client_name: clientName,
              client_phone: clientPhone,
              client_email: null,
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
              status: "confirmed",
              payment_method: null,
              payment_status: "pending",
              notes: notes || null,
              priority_color: null,
              is_shared_service: true,
              shared_group_id: currentSharedGroupId,
              additional_services: newAdditionalServices,
              created_by_user_id: saasUser?.id || null,
              created_by_name: saasUser?.name || null,
            }

            await createDocument("appointments", newAptData)
          }
        }

        if (isShared && !groups.has(selectedEmployee)) {
           await updateAppointment(
             newApt.id,
             { 
               service_total_value: newGrandTotal,
               is_shared_service: true,
               shared_group_id: currentSharedGroupId
             },
             "updated",
             "Valor total atualizado",
             "Valor total do grupo atualizado devido a adição de serviços.",
             saasUser
           )
        }
      }

      toast.success("Agendamento criado com sucesso!")
      onDone()
    } catch (err: any) {
      console.error("ERRO DETALHADO AO CRIAR AGENDAMENTO:", err)
      toast.error("Erro ao criar agendamento: " + (err?.message || "Erro desconhecido"))
    }
    setSubmitting(false)
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', border: '2px solid #e8ecf4', fontSize: '0.8125rem', color: '#1e1e2d', outline: 'none', background: '#fafbfc', minHeight: '42px' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f3f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(124,92,252,0.25)' }}>
              {editMode ? <Edit3 style={{ width: '18px', height: '18px', color: '#fff' }} /> : <Plus style={{ width: '18px', height: '18px', color: '#fff' }} />}
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', fontWeight: 700, color: '#1e1e2d' }}>{editMode ? 'Editar Agendamento' : 'Cadastrar Agendamento'}</h3>
              <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>{editMode ? 'Altere os dados do atendimento' : 'Preencha os dados do atendimento'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f1f3f9', borderRadius: '0.5rem', padding: '0.375rem', cursor: 'pointer', display: 'flex' }}>
            <X style={{ width: '16px', height: '16px', color: '#8b8fa7' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <Loader2 style={{ width: '1.5rem', height: '1.5rem', color: '#7c5cfc', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#8b8fa7', fontSize: '0.8125rem' }}>Carregando dados...</p>
            </div>
          ) : (<>
            {/* ── CLIENT SECTION ── */}
            <div style={{ background: '#fafbfc', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #e8ecf4' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <User style={{ width: '14px', height: '14px', color: '#7c5cfc' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e1e2d' }}>Cliente</span>
                <span style={{ fontSize: '0.5625rem', color: '#8b8fa7', marginLeft: 'auto' }}>{clients.length} cadastrados</span>
              </div>
              {selectedClient ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: '#f0ecff', borderRadius: '0.5rem', border: '1px solid #e0d4ff' }}>
                    <div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#7c5cfc' }}>{selectedClient.name}</p>
                      <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>{selectedClient.phone}{selectedClient.email ? ` • ${selectedClient.email}` : ''}</p>
                    </div>
                    <button onClick={() => { setSelectedClient(null); setClientSearch("") }} style={{ fontSize: '0.6875rem', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Trocar</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{selectedClient.appointment_count || 0}</span> atendimentos realizados
                    </div>
                    {selectedClient.appointment_count > 0 ? (
                      <button onClick={() => setShowClientHistory(true)} style={{ fontSize: '0.6875rem', color: '#7c5cfc', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Ver histórico</button>
                    ) : (
                      <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Nenhum histórico</span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#8b8fa7' }} />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      placeholder="Buscar por nome, telefone ou email..."
                      style={{ ...inputStyle, paddingLeft: '2.25rem' }}
                      autoComplete="off"
                      name="client-search-nope"
                      autoFocus
                    />
                  </div>

                  {/* Search results dropdown */}
                  {clientSearch.length >= 2 && (
                    <div style={{ marginTop: '0.375rem', maxHeight: '160px', overflowY: 'auto', border: '1px solid #e8ecf4', borderRadius: '0.5rem', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                      {filteredClients.length > 0 ? (
                        filteredClients.map(c => (
                          <button key={c.id} onClick={() => { setSelectedClient(c); setClientSearch("") }}
                            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8125rem', textAlign: 'left', borderBottom: '1px solid #f5f5fa', transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f5f3ff')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <div>
                              <span style={{ fontWeight: 600, color: '#1e1e2d', display: 'block' }}>{c.name}</span>
                              {c.email && <span style={{ fontSize: '0.625rem', color: '#8b8fa7' }}>{c.email}</span>}
                            </div>
                            <span style={{ color: '#8b8fa7', fontSize: '0.6875rem', flexShrink: 0, marginLeft: '0.5rem' }}>{c.phone}</span>
                          </button>
                        ))
                      ) : (
                        <div style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '0.75rem', color: '#8b8fa7' }}>Nenhum cliente encontrado para "{clientSearch}"</p>
                        </div>
                      )}
                    </div>
                  )}

                  <button onClick={() => setShowNewClient(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem', fontSize: '0.6875rem', fontWeight: 600, color: '#7c5cfc', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <Plus style={{ width: '12px', height: '12px' }} /> Novo Cliente
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '-0.25rem', flexWrap: 'wrap' }}>
              <button onClick={() => handleAddBlock(true)} style={{ background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Plus style={{ width: '14px', height: '14px' }}/> Serviço
              </button>
              <button onClick={() => handleAddBlock(false)} style={{ background: '#f0ecff', color: '#7c5cfc', border: '1px solid #e0d4ff', borderRadius: '6px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Plus style={{ width: '14px', height: '14px' }}/> Serviço com outro profissional
              </button>
              <button onClick={() => setAssistants([...assistants, ""])} style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '6px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Plus style={{ width: '14px', height: '14px' }}/> Profissional de apoio
              </button>
            </div>

            {assistants.length > 0 && assistants.map((assistantId, index) => (
              <div key={index} style={{ marginTop: '0.5rem' }}>
                <label style={labelStyle}>Profissional de Apoio {index + 1}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                    {employees.filter(e => e.id !== selectedEmployee).map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <button onClick={() => setAssistants(assistants.filter((_, i) => i !== index))} style={{ padding: '0.5rem', border: '1px solid #fee2e2', background: '#fef2f2', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>
            ))}

            {/* ── SERVICE + PROFESSIONAL ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {/* Service with search */}
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}><Scissors style={{ width: '10px', height: '10px', display: 'inline', marginRight: '4px' }} />Serviço</label>
                {selectedServiceObj ? (
                  <div
                    onClick={() => { setSelectedService(""); setShowServiceDropdown(true); setServiceSearch("") }}
                    style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0ecff', border: '2px solid #e0d4ff' }}>
                    <span style={{ fontWeight: 600, color: '#7c5cfc', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedServiceObj.name}</span>
                    <span style={{ fontSize: '0.625rem', color: '#8b8fa7', flexShrink: 0 }}>{formatCurrency(selectedServiceObj.promotional_price || selectedServiceObj.price)}</span>
                  </div>
                ) : (
                  <>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={serviceSearch}
                        onChange={e => { setServiceSearch(e.target.value); setShowServiceDropdown(true) }}
                        onFocus={() => setShowServiceDropdown(true)}
                        placeholder={
                          selectedEmployee && availableServices.length === 0 
                            ? "Nenhum serviço cadastrado..." 
                            : selectedEmployee 
                              ? `${availableServices.length} serviços de ${activeEmployee?.name.split(' ')[0]}...` 
                              : services.length > 0 ? `${services.length} serviços gerais...` : "Carregando..."
                        }
                        disabled={selectedEmployee !== "" && availableServices.length === 0}
                        style={{...inputStyle, background: selectedEmployee !== "" && availableServices.length === 0 ? '#f1f5f9' : '#fafbfc'}}
                        autoComplete="off"
                        name="service-search-nope"
                      />
                    </div>
                    {showServiceDropdown && availableServices.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '0.25rem', maxHeight: '160px', overflowY: 'auto', border: '1px solid #e8ecf4', borderRadius: '0.5rem', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                        {filteredServices.length > 0 ? (
                          filteredServices.map(s => {
                            // Determine actual price considering employee custom price
                            let displayPrice = s.promotional_price || s.price
                            if (activeEmployee?.professional_services) {
                              const custom = activeEmployee.professional_services.find(ps => ps.serviceId === s.id)
                              if (custom?.customPrice !== undefined && custom?.customPrice !== null) {
                                displayPrice = custom.customPrice
                              }
                            }

                            return (
                              <button key={s.id} onClick={() => handleServiceSelect(s.id)}
                                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem', textAlign: 'left', borderBottom: '1px solid #f5f5fa', transition: 'background 0.1s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#f5f3ff')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <span style={{ fontWeight: 600, color: '#1e1e2d' }}>{s.name}</span>
                                <span style={{ color: '#7c5cfc', fontWeight: 700, fontSize: '0.6875rem', flexShrink: 0 }}>{formatCurrency(displayPrice)}</span>
                              </button>
                            )
                          })
                        ) : (
                          <p style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: '#8b8fa7' }}>Nenhum serviço encontrado</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Professional */}
              <div>
                <label style={labelStyle}><User style={{ width: '10px', height: '10px', display: 'inline', marginRight: '4px' }} />Profissional</label>
                <select value={selectedEmployee} onChange={e => handleEmployeeSelect(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Qualquer</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                {selectedEmployee !== "" && availableServices.length === 0 && (
                  <p style={{ fontSize: '0.625rem', color: '#ef4444', marginTop: '0.25rem', fontWeight: 600 }}>
                    Este profissional não possui serviços.
                  </p>
                )}
              </div>
            </div>

            {/* Date + Time + Duration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}><Calendar style={{ width: '10px', height: '10px', display: 'inline', marginRight: '4px' }} />Data</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}><Clock style={{ width: '10px', height: '10px', display: 'inline', marginRight: '4px' }} />Hora</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Duração (min)</label>
                <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} min={5} style={inputStyle} />
              </div>
            </div>

            {/* Price */}
            <div>
              <label style={labelStyle}><DollarSign style={{ width: '10px', height: '10px', display: 'inline', marginRight: '4px' }} />Valor (R$)</label>
              <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} min={0} step={0.01} style={{ ...inputStyle, maxWidth: '180px' }} />
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}><FileText style={{ width: '10px', height: '10px', display: 'inline', marginRight: '4px' }} />Observações (opcional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observações sobre o atendimento..." style={{ ...inputStyle, resize: 'none', minHeight: '60px' }} />
            </div>

            {/* ── ADDITIONAL SERVICES BLOCKS ── */}
            {blocks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', margin: 0 }}>Serviços Adicionais</h4>
                {blocks.map((block, index) => {
                  const sName = services.find(s => s.id === block.serviceId)?.name || "Serviço"
                  const eName = employees.find(e => e.id === block.employeeId)?.name || "Profissional"
                  return (
                    <div key={block.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, color: '#1e1e2d', fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sName}</p>
                        <p style={{ fontSize: '0.6875rem', color: '#64748b' }}>{eName} • {block.time} • {formatCurrency(Number(block.price) || 0)}</p>
                      </div>
                      <button onClick={() => removeBlock(index)} style={{ padding: '0.375rem', background: '#fef2f2', border: 'none', color: '#ef4444', borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#fecaca'} onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}>
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>)}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f3f9', display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.625rem', border: '2px solid #e8ecf4', background: '#fff', color: '#555', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', minHeight: '44px' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={submitting || loading}
            style={{ flex: 2, padding: '0.75rem', borderRadius: '0.625rem', border: 'none', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1, minHeight: '44px', boxShadow: '0 4px 14px rgba(124,92,252,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
            {submitting ? "Salvando..." : editMode ? "✅ Salvar Alterações" : "✅ Salvar Agendamento"}
          </button>
        </div>
      </div>

      {/* Close service dropdown on click outside */}
      {showServiceDropdown && (
        <div style={{ position: 'fixed', inset: 0, zIndex: -1 }} onClick={() => setShowServiceDropdown(false)} />
      )}

      {/* New Client Modal */}
      {showNewClient && (
        <ClientFormModal
          client={null}
          onClose={() => setShowNewClient(false)}
          onSave={handleSaveClient}
        />
      )}
      
      {/* Client History Modal */}
      {showClientHistory && selectedClient && (
        <ClientHistoryModal
          client={selectedClient}
          onClose={() => setShowClientHistory(false)}
        />
      )}
      
      {addingBlockMode && (
        <AddServiceBlockModal
          onClose={() => setAddingBlockMode(null)}
          onSave={handleSaveNewBlock}
          employees={employees}
          services={services}
          isOtherProfessional={addingBlockMode === "other"}
          defaultEmployeeId={blocks.length > 0 ? blocks[blocks.length - 1].employeeId : (selectedEmployee || "")}
          defaultDate={blocks.length > 0 ? blocks[blocks.length - 1].date : date}
          defaultTime={blocks.length > 0 ? (blocks[blocks.length - 1].time && typeof blocks[blocks.length - 1].duration === 'number' ? addMinutes(blocks[blocks.length - 1].time, blocks[blocks.length - 1].duration as number) : blocks[blocks.length - 1].time) : (time && duration ? addMinutes(time, duration) : time)}
        />
      )}
      
      <ConfirmationDialog />
    </div>
  )
}
