"use client"

import { useEffect, useState, useMemo } from "react"
import { usePWATenant } from "@/components/pwa/pwa-tenant-context"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, ArrowLeft, CalendarDays, Clock, User, Scissors, CheckCircle } from "lucide-react"
import Link from "next/link"
import { format, addDays, startOfToday } from "date-fns"
import { ptBR } from "date-fns/locale"

// Reuse existing utils from the main app
import { professionalWorksOnDate, timesOverlap, addMinutesToTime } from "@/lib/utils"
import { createSystemNotification } from "@/lib/pwa/notifications-helper"

export default function PWAClientBooking() {
  const { slug, companyId, companyName, user } = usePWATenant()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [data, setData] = useState<any>(null)
  
  const [step, setStep] = useState<"service" | "professional" | "datetime" | "confirm" | "success">("service")
  
  const [selectedService, setSelectedService] = useState<any>(null)
  const [selectedProfessional, setSelectedProfessional] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday())
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  useEffect(() => {
    async function loadPublicData() {
      if (!slug) return
      try {
        const res = await fetch(`/api/public-booking/${slug}`)
        if (!res.ok) throw new Error("Erro ao carregar dados do salão")
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error(err)
        toast.error("Erro ao carregar dados. Tente novamente.")
      } finally {
        setLoading(false)
      }
    }
    loadPublicData()
  }, [slug])

  // Computed Available Professionals for the Service
  const availableProfessionals = useMemo(() => {
    if (!data || !selectedService) return []
    return data.employees.filter((emp: any) => 
      !emp.service_ids?.length || emp.service_ids.includes(selectedService.id)
    )
  }, [data, selectedService])

  // Computed Available Times for Date & Professional
  const availableTimes = useMemo(() => {
    if (!data || !selectedService || !selectedProfessional || !selectedDate) return []
    
    const dateStr = format(selectedDate, "yyyy-MM-dd")
    const emp = selectedProfessional
    const duration = selectedService.duration_minutes || 30
    
    // Check if works on date
    if (!professionalWorksOnDate(emp, dateStr, data.blockedDates)) {
      return []
    }

    // Determine working hours
    let startH = "08:00"
    let endH = "18:00"
    if (emp.schedule_by_day) {
      const dow = selectedDate.getDay()
      const dayMap: Record<number, string> = { 0: "domingo", 1: "segunda", 2: "terca", 3: "quarta", 4: "quinta", 5: "sexta", 6: "sabado" }
      const dayConf = emp.schedule_by_day[dayMap[dow]]
      if (dayConf && dayConf.isActive) {
        startH = dayConf.start || "08:00"
        endH = dayConf.end || "18:00"
      }
    } else {
      startH = emp.working_hours_start || "08:00"
      endH = emp.working_hours_end || "18:00"
    }

    // Generate slots
    const slots: string[] = []
    let currentMins = parseInt(startH.split(':')[0]) * 60 + parseInt(startH.split(':')[1])
    const endMins = parseInt(endH.split(':')[0]) * 60 + parseInt(endH.split(':')[1])
    
    // Get existing appointments
    const dayAppts = data.appointments.filter((a: any) => 
      a.employee_id === emp.id && a.appointment_date === dateStr && ["pending", "confirmed", "waiting"].includes(a.status)
    )

    while (currentMins + duration <= endMins) {
      const h = Math.floor(currentMins / 60)
      const m = currentMins % 60
      const slotTimeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const slotEndStr = `${String(Math.floor((currentMins + duration)/60)).padStart(2, '0')}:${String((currentMins + duration)%60).padStart(2, '0')}`

      const hasConflict = dayAppts.some((a: any) => {
        const [ah, am] = a.appointment_time.split(':').map(Number)
        const aStart = ah * 60 + am
        const aEnd = aStart + a.duration_minutes
        
        return (currentMins < aEnd && currentMins + duration > aStart)
      })

      if (!hasConflict) {
        // Skip past times if today
        if (dateStr === format(new Date(), "yyyy-MM-dd")) {
          const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
          if (currentMins > nowMins + 30) {
            slots.push(slotTimeStr)
          }
        } else {
          slots.push(slotTimeStr)
        }
      }
      
      currentMins += 15 // 15 min interval
    }

    return slots
  }, [data, selectedService, selectedProfessional, selectedDate])

  const handleBooking = async () => {
    if (!companyId || !user || !selectedService || !selectedProfessional || !selectedDate || !selectedTime) return
    setSubmitting(true)
    
    try {
      // Create via public-booking API to reuse standard validations
      const res = await fetch(`/api/public-booking/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: selectedService.id,
          employee_id: selectedProfessional.id,
          client_name: user.displayName || "Cliente PWA",
          client_phone: "00000000000", // Need actual phone, using a bypass or prompt later if required
          client_email: user.email,
          appointment_date: format(selectedDate, "yyyy-MM-dd"),
          appointment_time: selectedTime,
          notes: "Agendado via PWA",
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Erro ao agendar")
      }

      const result = await res.json()

      // Disparar notificação PWA
      await createSystemNotification({
        company_id: companyId,
        recipientUserId: selectedProfessional.auth_uid || selectedProfessional.id, // Fallback
        recipientRole: "profissional",
        type: "new_appointment",
        title: "Novo Agendamento (PWA)",
        body: `${user.displayName || "Cliente"} agendou ${selectedService.name} para dia ${format(selectedDate, "dd/MM")} às ${selectedTime}.`,
        appointmentId: result.appointment_id
      })

      setStep("success")
      
    } catch (err: any) {
      toast.error(err.message || "Falha ao concluir o agendamento.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 mt-20">
        <div className="w-8 h-8 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (step === "success") {
    return (
      <div className="p-6 pb-24 flex flex-col items-center justify-center min-h-[80vh] text-center">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Agendamento Confirmado!</h2>
        <p className="text-gray-500 mb-8 max-w-[250px] mx-auto">
          Te esperamos no dia {format(selectedDate, "dd/MM")} às {selectedTime} com {selectedProfessional.name}.
        </p>
        <button 
          onClick={() => router.push(`/pwa/${slug}/cliente/home`)}
          className="w-full h-14 bg-[var(--color-primary)] text-white font-bold rounded-2xl shadow-lg"
        >
          Voltar ao Início
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Header com voltar */}
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-10">
        <button 
          onClick={() => {
            if (step === "confirm") setStep("datetime")
            else if (step === "datetime") setStep("professional")
            else if (step === "professional") setStep("service")
            else router.push(`/pwa/${slug}/cliente/home`)
          }} 
          className="p-2 -ml-2 rounded-xl text-gray-700 hover:bg-gray-100"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 ml-2">Novo Agendamento</h1>
      </div>

      <div className="p-4 overflow-y-auto pb-24">
        {step === "service" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Escolha o Serviço</h2>
            {data?.services?.map((svc: any) => (
              <button
                key={svc.id}
                onClick={() => { setSelectedService(svc); setStep("professional") }}
                className="w-full bg-white p-4 rounded-2xl flex items-center justify-between border border-gray-100 shadow-sm active:scale-95 transition-all"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-[var(--color-primary)] flex items-center justify-center">
                    <Scissors className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-[15px]">{svc.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{svc.duration_minutes} min</p>
                  </div>
                </div>
                <div className="font-bold text-[var(--color-primary)]">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(svc.promotional_price || svc.price)}
                </div>
              </button>
            ))}
          </div>
        )}

        {step === "professional" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Escolha o Profissional</h2>
            <div className="grid grid-cols-2 gap-3">
              {availableProfessionals.map((emp: any) => (
                <button
                  key={emp.id}
                  onClick={() => { setSelectedProfessional(emp); setStep("datetime") }}
                  className="bg-white p-4 rounded-2xl flex flex-col items-center text-center border border-gray-100 shadow-sm active:scale-95 transition-all"
                >
                  <div className="w-16 h-16 rounded-full bg-gray-100 mb-3 flex items-center justify-center overflow-hidden">
                    {emp.photo_url ? (
                      <img src={emp.photo_url} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">{emp.name?.split(' ')[0]}</h3>
                  <p className="text-xs text-gray-500 truncate max-w-[100px]">{emp.specialty || "Profissional"}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "datetime" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Escolha Data e Hora</h2>
            
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {[...Array(14)].map((_, i) => {
                  const d = addDays(startOfToday(), i)
                  const isSelected = format(d, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
                  return (
                    <button
                      key={i}
                      onClick={() => { setSelectedDate(d); setSelectedTime(null) }}
                      className={`flex-shrink-0 w-16 h-20 rounded-xl flex flex-col items-center justify-center border transition-all ${
                        isSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-md' : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      <span className={`text-[10px] uppercase font-bold ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                        {format(d, "EEE", { locale: ptBR })}
                      </span>
                      <span className={`text-xl font-bold mt-1 ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                        {format(d, "dd")}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {availableTimes.length > 0 ? (
                availableTimes.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setSelectedTime(t); setStep("confirm") }}
                    className="py-3 px-2 bg-white rounded-xl border border-gray-100 text-[13px] font-bold text-gray-700 shadow-sm active:scale-95 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all text-center"
                  >
                    {t}
                  </button>
                ))
              ) : (
                <div className="col-span-4 text-center py-8 text-gray-500 font-medium text-sm">
                  Nenhum horário disponível nesta data.
                </div>
              )}
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Confirmar Agendamento</h2>
            
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <span className="text-sm font-medium text-gray-500">Serviço</span>
                <span className="font-bold text-gray-900">{selectedService.name}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <span className="text-sm font-medium text-gray-500">Profissional</span>
                <span className="font-bold text-gray-900">{selectedProfessional.name}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <span className="text-sm font-medium text-gray-500">Data</span>
                <span className="font-bold text-gray-900 capitalize">{format(selectedDate, "EEEE, dd/MM", { locale: ptBR })}</span>
              </div>
              <div className="flex justify-between items-center pb-2">
                <span className="text-sm font-medium text-gray-500">Horário</span>
                <span className="font-bold text-[var(--color-primary)] text-lg">{selectedTime}</span>
              </div>
            </div>

            <button 
              onClick={handleBooking}
              disabled={submitting}
              className="w-full h-14 bg-[var(--color-primary)] text-white font-bold rounded-2xl shadow-lg flex items-center justify-center disabled:opacity-70"
            >
              {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Confirmar e Agendar"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
