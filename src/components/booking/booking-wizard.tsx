"use client"

import { useState, useEffect } from "react"
import { ServiceSelection } from "./service-selection"
import { EmployeeSelection } from "./employee-selection"
import { DateTimeSelection } from "./datetime-selection"
import { ClientForm } from "./client-form"
import { Confirmation } from "./confirmation"
import { ProgressSteps } from "./progress-steps"
import type { Category, Service, BusinessHour, Appointment, Employee } from "@/lib/types/database"
import { Loader2 } from "lucide-react"

export type BookingData = {
  service: Service | null
  category: Category | null
  employee: Employee | null
  date: Date | null
  time: string | null
  clientName: string
  clientPhone: string
  clientEmail: string
  notes: string
}

const initialBookingData: BookingData = {
  service: null,
  category: null,
  employee: null,
  date: null,
  time: null,
  clientName: "",
  clientPhone: "",
  clientEmail: "",
  notes: "",
}

type PublicBookingResponse = {
  company: { id: string }
  categories: Category[]
  services: Service[]
  employees: Employee[]
  businessHours: BusinessHour[]
  appointments: Appointment[]
}

export function BookingWizard({ companySlug = "default" }: { companySlug?: string } = {}) {
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [animKey, setAnimKey] = useState(0)
  const [bookingData, setBookingData] = useState<BookingData>(initialBookingData)
  const [categories, setCategories] = useState<Category[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [company, setCompany] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/public-booking/${encodeURIComponent(companySlug)}`)

        if (!response.ok) {
          setIsLoading(false)
          return
        }

        const data = await response.json() as PublicBookingResponse
        setCompany(data.company)
        setCategories(data.categories)
        setServices(data.services)
        setEmployees(data.employees)
        setBusinessHours(data.businessHours)
        setAppointments(data.appointments)
      } catch (error) {
        console.error("Error loading booking data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [companySlug])

  const updateBookingData = (data: Partial<BookingData>) => {
    setBookingData(prev => ({ ...prev, ...data }))
  }

  const totalSteps = 5
  const nextStep = () => { setDirection('forward'); setAnimKey(k => k + 1); setStep(prev => Math.min(prev + 1, totalSteps)) }
  const prevStep = () => { setDirection('back');    setAnimKey(k => k + 1); setStep(prev => Math.max(prev - 1, 1)) }

  const availableEmployees = employees.filter(emp => {
    if (!bookingData.service) return false
    
    // Check if employee has any services assigned
    if (emp.service_ids && emp.service_ids.length > 0) {
      return emp.service_ids.includes(bookingData.service.id)
    }
    
    // If they have no explicit services assigned, DO NOT show them for the service
    return false
  })

  const handleSubmit = async () => {
    if (!bookingData.service || !bookingData.date || !bookingData.time) return
    setIsSubmitting(true)
    // Use local date to avoid UTC timezone shift (e.g. UTC-3 can shift day)
    const d = bookingData.date
    const appointmentDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    try {
      const response = await fetch(`/api/public-booking/${encodeURIComponent(companySlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: bookingData.service.id,
          employee_id: bookingData.employee?.id || null,
          client_name: bookingData.clientName,
          client_phone: bookingData.clientPhone,
          client_email: bookingData.clientEmail || null,
          appointment_date: appointmentDate,
          appointment_time: bookingData.time,
          notes: bookingData.notes || null,
        }),
      })
      if (!response.ok) throw new Error("Erro ao criar agendamento")
      setIsConfirmed(true)
    } catch (error) {
      console.error("Error creating appointment:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetBooking = () => {
    setBookingData(initialBookingData)
    setStep(1)
    setIsConfirmed(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[var(--color-primary)]" />
          <p className="text-[var(--color-muted-foreground)]">Carregando serviços...</p>
        </div>
      </div>
    )
  }

  if (isConfirmed) {
    return <Confirmation bookingData={bookingData} onNewBooking={resetBooking} />
  }

  const stepClass = direction === 'forward' ? 'step-enter' : 'step-enter-back'

  return (
    <div style={{ width: '100%' }}>
      <ProgressSteps currentStep={step} />
      <div key={animKey} className={stepClass} style={{ marginTop: '1.5rem' }}>
        {step === 1 && (
          <ServiceSelection
            categories={categories}
            services={services}
            selectedService={bookingData.service}
            selectedCategory={bookingData.category}
            onSelect={(service, category) => {
              updateBookingData({ service, category, employee: null, date: null, time: null })
            }}
            onNext={nextStep}
          />
        )}
        {step === 2 && (
          <EmployeeSelection
            employees={availableEmployees}
            selectedEmployee={bookingData.employee}
            companyWhatsapp={company?.whatsapp}
            onSelect={(employee) => updateBookingData({ employee, date: null, time: null })}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        {step === 3 && (
          <DateTimeSelection
            businessHours={businessHours}
            appointments={appointments}
            selectedDate={bookingData.date}
            selectedTime={bookingData.time}
            serviceDuration={bookingData.service?.duration_minutes || 30}
            selectedEmployee={bookingData.employee}
            onSelect={(date, time) => updateBookingData({ date, time })}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        {step === 4 && (
          <ClientForm
            bookingData={bookingData}
            onUpdate={updateBookingData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        {step === 5 && (
          <div style={{ maxWidth: '480px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.125rem, 3vw, 1.375rem)', fontWeight: 700, textAlign: 'center', color: '#1e1e2d', marginBottom: '0.25rem' }}>
              Confirme seu Agendamento
            </h2>
            <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: '#8b8fa7', marginBottom: '1.25rem' }}>
              Verifique os dados e confirme
            </p>
            <div style={{ background: '#fafbfc', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #e8ecf4', marginBottom: '1.5rem' }}>
              {[
                ["📋 Serviço", bookingData.service?.name],
                ["💰 Valor", bookingData.service?.promotional_price
                  ? `R$ ${Number(bookingData.service.promotional_price).toFixed(2).replace(".", ",")}`
                  : `R$ ${Number(bookingData.service?.price || 0).toFixed(2).replace(".", ",")}`],
                ["👤 Profissional", bookingData.employee?.name || "Qualquer disponível"],
                ["📅 Data", bookingData.date?.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })],
                ["🕐 Horário", bookingData.time],
                ["⏱️ Duração", `${bookingData.service?.duration_minutes} min`],
                ["🧑 Nome", bookingData.clientName],
                ["📱 Telefone", bookingData.clientPhone],
              ].map(([label, value], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0', borderBottom: i < 7 ? '1px solid #e8ecf4' : 'none' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#8b8fa7' }}>{label}</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={prevStep}
                style={{ flex: '1 1 100px', padding: '0.75rem', borderRadius: '0.75rem', border: '2px solid #e8ecf4', background: '#fff', color: '#1e1e2d', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', minHeight: '48px' }}>
                Voltar
              </button>
              <button onClick={handleSubmit} disabled={isSubmitting}
                style={{ flex: '2 1 180px', padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: isSubmitting ? '#a78bfa' : '#7c5cfc', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: isSubmitting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', boxShadow: '0 4px 14px rgba(124,92,252,0.25)', minHeight: '48px', opacity: isSubmitting ? 0.7 : 1 }}>
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? "Confirmando..." : "✅ Confirmar Agendamento"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
