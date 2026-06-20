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

import { PwaButton } from "@/components/pwa/ui/pwa-button"
import { PwaCard } from "@/components/pwa/ui/pwa-card"
import { PwaServiceCard } from "@/components/pwa/ui/pwa-service-card"

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

  const availableProfessionals = useMemo(() => {
    if (!data || !selectedService) return []
    return data.employees.filter((emp: any) => 
      !emp.service_ids?.length || emp.service_ids.includes(selectedService.id)
    )
  }, [data, selectedService])

  const availableTimes = useMemo(() => {
    if (!data || !selectedService || !selectedProfessional || !selectedDate) return []
    
    const dateStr = format(selectedDate, "yyyy-MM-dd")
    const emp = selectedProfessional
    const duration = selectedService.duration_minutes || 30
    
    if (!professionalWorksOnDate(emp, dateStr, data.blockedDates)) {
      return []
    }

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

    const slots: string[] = []
    let currentMins = parseInt(startH.split(':')[0]) * 60 + parseInt(startH.split(':')[1])
    const endMins = parseInt(endH.split(':')[0]) * 60 + parseInt(endH.split(':')[1])
    
    const dayAppts = data.appointments.filter((a: any) => 
      a.employee_id === emp.id && a.appointment_date === dateStr && ["pending", "confirmed", "waiting"].includes(a.status)
    )

    while (currentMins + duration <= endMins) {
      const h = Math.floor(currentMins / 60)
      const m = currentMins % 60
      const slotTimeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

      const hasConflict = dayAppts.some((a: any) => {
        const [ah, am] = a.appointment_time.split(':').map(Number)
        const aStart = ah * 60 + am
        const aEnd = aStart + a.duration_minutes
        
        return (currentMins < aEnd && currentMins + duration > aStart)
      })

      if (!hasConflict) {
        if (dateStr === format(new Date(), "yyyy-MM-dd")) {
          const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
          if (currentMins > nowMins + 30) {
            slots.push(slotTimeStr)
          }
        } else {
          slots.push(slotTimeStr)
        }
      }
      currentMins += 15
    }

    return slots
  }, [data, selectedService, selectedProfessional, selectedDate])

  const handleBooking = async () => {
    if (!companyId || !user || !selectedService || !selectedProfessional || !selectedDate || !selectedTime) return
    setSubmitting(true)
    
    try {
      const res = await fetch(`/api/public-booking/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: selectedService.id,
          employee_id: selectedProfessional.id,
          client_name: user.displayName || "Cliente PWA",
          client_phone: "00000000000",
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

      await createSystemNotification({
        company_id: companyId,
        recipientUserId: selectedProfessional.auth_uid || selectedProfessional.id,
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
        <div className="w-8 h-8 rounded-full border-4 border-[#7C5CFC] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (step === "success") {
    return (
      <div className="p-6 pb-24 flex flex-col items-center justify-center min-h-[80vh] text-center">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-[#111827] mb-2">Agendamento Confirmado!</h2>
        <p className="text-[#6B7280] mb-8 max-w-[250px] mx-auto">
          Te esperamos no dia {format(selectedDate, "dd/MM")} às {selectedTime} com {selectedProfessional.name}.
        </p>
        <PwaButton onClick={() => router.push(`/pwa/${slug}/cliente/home`)}>
          Voltar ao Início
        </PwaButton>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#F7F8FC]">
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <button 
          onClick={() => {
            if (step === "confirm") setStep("datetime")
            else if (step === "datetime") setStep("professional")
            else if (step === "professional") setStep("service")
            else router.push(`/pwa/${slug}/cliente/home`)
          }} 
          className="p-2 -ml-2 rounded-xl text-[#111827] hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[18px] font-bold text-[#111827] ml-2">Novo Agendamento</h1>
      </div>

      <div className="p-5 pb-32">
        {step === "service" && (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#111827]">Escolha o serviço</h2>
              <p className="text-[#6B7280] text-sm">Selecione o serviço que deseja realizar.</p>
            </div>
            {data?.services?.map((svc: any) => (
              <PwaServiceCard
                key={svc.id}
                name={svc.name}
                duration={svc.duration_minutes}
                price={svc.promotional_price || svc.price}
                icon={Scissors}
                onClick={() => { setSelectedService(svc); setStep("professional") }}
              />
            ))}
          </div>
        )}

        {step === "professional" && (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#111827]">Com quem?</h2>
              <p className="text-[#6B7280] text-sm">Escolha o profissional de sua preferência.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {availableProfessionals.map((emp: any) => (
                <PwaCard
                  key={emp.id}
                  onClick={() => { setSelectedProfessional(emp); setStep("datetime") }}
                  className="flex flex-col items-center justify-center py-6 hover:border-[#7C5CFC]"
                >
                  <div className="w-16 h-16 rounded-full bg-[#EDE9FE] mb-3 flex items-center justify-center overflow-hidden border border-gray-100 shadow-inner">
                    {emp.photo_url ? (
                      <img src={emp.photo_url} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-7 h-7 text-[#7C5CFC]" />
                    )}
                  </div>
                  <h3 className="font-bold text-[#111827] text-sm text-center">{emp.name?.split(' ')[0]}</h3>
                  <p className="text-xs text-[#6B7280] truncate max-w-[100px] mt-0.5">{emp.specialty || "Especialista"}</p>
                </PwaCard>
              ))}
            </div>
          </div>
        )}

        {step === "datetime" && (
          <div className="space-y-6">
            <div className="mb-2">
              <h2 className="text-xl font-bold text-[#111827]">Quando?</h2>
              <p className="text-[#6B7280] text-sm">Selecione o melhor dia e horário.</p>
            </div>
            
            <div className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {[...Array(14)].map((_, i) => {
                  const d = addDays(startOfToday(), i)
                  const isSelected = format(d, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
                  return (
                    <button
                      key={i}
                      onClick={() => { setSelectedDate(d); setSelectedTime(null) }}
                      className={`flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center border transition-all ${
                        isSelected ? 'bg-[#7C5CFC] border-[#7C5CFC] shadow-[0_8px_15px_rgba(124,92,252,0.3)]' : 'bg-white border-gray-100'
                      }`}
                    >
                      <span className={`text-[11px] uppercase font-bold mb-0.5 ${isSelected ? 'text-white/90' : 'text-gray-400'}`}>
                        {format(d, "EEE", { locale: ptBR })}
                      </span>
                      <span className={`text-[22px] font-bold ${isSelected ? 'text-white' : 'text-[#111827]'}`}>
                        {format(d, "dd")}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {availableTimes.length > 0 ? (
                availableTimes.map((t) => {
                  const isSelected = selectedTime === t
                  return (
                    <button
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      className={`h-12 rounded-[16px] text-[15px] font-bold transition-all text-center border ${
                        isSelected 
                          ? 'bg-[#EDE9FE] border-[#7C5CFC] text-[#7C5CFC]' 
                          : 'bg-white border-gray-100 text-[#111827] shadow-[0_2px_10px_rgba(0,0,0,0.02)]'
                      }`}
                    >
                      {t}
                    </button>
                  )
                })
              ) : (
                <div className="col-span-4 text-center py-8 text-gray-500 font-medium text-sm">
                  Nenhum horário disponível nesta data.
                </div>
              )}
            </div>

            {selectedTime && (
              <div className="fixed bottom-[80px] left-0 w-full max-w-[430px] p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 flex items-center justify-center shadow-[0_-10px_20px_rgba(0,0,0,0.05)] ml-auto mr-auto" style={{ left: '50%', transform: 'translateX(-50%)' }}>
                <PwaButton onClick={() => setStep("confirm")} className="w-full">
                  Continuar
                </PwaButton>
              </div>
            )}
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-[#111827]">Revisar Agendamento</h2>
            
            <PwaCard className="space-y-5">
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <span className="text-[14px] font-medium text-[#6B7280]">Serviço</span>
                <span className="font-bold text-[#111827] text-right">{selectedService.name}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <span className="text-[14px] font-medium text-[#6B7280]">Profissional</span>
                <span className="font-bold text-[#111827] text-right">{selectedProfessional.name}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <span className="text-[14px] font-medium text-[#6B7280]">Data</span>
                <span className="font-bold text-[#111827] capitalize text-right">{format(selectedDate, "EEEE, dd/MM", { locale: ptBR })}</span>
              </div>
              <div className="flex justify-between items-center pb-1">
                <span className="text-[14px] font-medium text-[#6B7280]">Horário</span>
                <span className="font-bold text-[#7C5CFC] text-[20px]">{selectedTime}</span>
              </div>
            </PwaCard>

            <PwaButton onClick={handleBooking} loading={submitting}>
              Confirmar e Agendar
            </PwaButton>
          </div>
        )}
      </div>
    </div>
  )
}
