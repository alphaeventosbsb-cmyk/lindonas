"use client"

import { useState, useMemo } from "react"
import type { BusinessHour, Appointment, Employee } from "@/lib/types/database"
import { ArrowRight, ArrowLeft, Clock, ChevronLeft, ChevronRight } from "lucide-react"
import { timesOverlap, addMinutesToTime, professionalWorksOnDate, toLocalDateStr } from "@/lib/utils"

interface Props {
  businessHours: BusinessHour[]
  appointments: Appointment[]
  selectedDate: Date | null
  selectedTime: string | null
  serviceDuration: number
  selectedEmployee: Employee | null
  onSelect: (date: Date, time: string) => void
  onNext: () => void
  onPrev: () => void
}

export function DateTimeSelection({
  businessHours, appointments, selectedDate, selectedTime,
  serviceDuration, selectedEmployee, onSelect, onNext, onPrev
}: Props) {
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewMonth.year, viewMonth.month, 1).getDay()

  const monthLabel = new Date(viewMonth.year, viewMonth.month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })

  const prevMonth = () => {
    setViewMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 })
  }
  const nextMonth = () => {
    setViewMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 })
  }

  const isDayAvailable = (day: number) => {
    const date = new Date(viewMonth.year, viewMonth.month, day)
    if (date < today) return false
    if (selectedEmployee) {
      return professionalWorksOnDate(selectedEmployee, toLocalDateStr(date))
    }
    const dow = date.getDay()
    return businessHours.some(h => h.day_of_week === dow && h.is_active)
  }

  const getAvailableSlots = useMemo(() => {
    if (!selectedDate) return []
    const dateStr = toLocalDateStr(selectedDate)
    const dow = selectedDate.getDay()
    
    if (selectedEmployee && !professionalWorksOnDate(selectedEmployee, dateStr)) {
      return []
    }

    let startTime = "08:00", endTime = "18:00"
    let lunchStart: string | null = null, lunchEnd: string | null = null
    let breakStart: string | null = null, breakEnd: string | null = null

    if (selectedEmployee) {
      startTime = selectedEmployee.working_hours_start
      endTime = selectedEmployee.working_hours_end
      if (selectedEmployee.schedule_by_day) {
        const schedule = selectedEmployee.schedule_by_day[dow.toString()]
        if (schedule && schedule.enabled) {
          startTime = schedule.start || startTime
          endTime = schedule.end || endTime
          lunchStart = schedule.lunchStart || null
          lunchEnd = schedule.lunchEnd || null
          breakStart = schedule.breakStart || null
          breakEnd = schedule.breakEnd || null
        }
      }
    } else { 
      const bh = businessHours.find(h => h.day_of_week === dow)
      if (bh) { 
        startTime = bh.start_time
        endTime = bh.end_time 
      } 
    }

    const dayAppointments = appointments.filter(a => { const match = a.appointment_date === dateStr && ["pending", "confirmed"].includes(a.status); if (selectedEmployee) return match && a.employee_id === selectedEmployee.id; return match })
    const slots: string[] = []
    const [sH, sM] = startTime.split(":").map(Number)
    const [eH, eM] = endTime.split(":").map(Number)
    const startMin = sH * 60 + sM, endMin = eH * 60 + eM
    const now = new Date()
    const isToday = selectedDate.toDateString() === now.toDateString()
    const currentMin = now.getHours() * 60 + now.getMinutes()
    for (let t = startMin; t + serviceDuration <= endMin; t += 30) {
      if (isToday && t <= currentMin) continue
      const slotTime = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
      const slotEnd = addMinutesToTime(slotTime, serviceDuration)

      let inPause = false
      if (lunchStart && lunchEnd && timesOverlap(slotTime, slotEnd, lunchStart, lunchEnd)) inPause = true
      if (breakStart && breakEnd && timesOverlap(slotTime, slotEnd, breakStart, breakEnd)) inPause = true
      
      if (inPause) {
        // Exception: Check if there's a explicit 'free' block (Liberação de Horário) allowing this slot
        const isFreed = appointments.some(a => 
          a.type === 'free' && 
          a.appointment_date === dateStr && 
          (!selectedEmployee || a.employee_id === selectedEmployee.id) && 
          timesOverlap(slotTime, slotEnd, a.appointment_time, a.end_time || addMinutesToTime(a.appointment_time, a.duration_minutes || 0))
        )
        if (isFreed) inPause = false
      }

      if (inPause) continue

      const occupied = dayAppointments.some(a => timesOverlap(slotTime, slotEnd, a.appointment_time, a.end_time || addMinutesToTime(a.appointment_time, a.duration_minutes)))
      if (!occupied) slots.push(slotTime)
    }
    return slots
  }, [selectedDate, selectedEmployee, businessHours, appointments, serviceDuration])

  const handleDayClick = (day: number) => {
    const date = new Date(viewMonth.year, viewMonth.month, day)
    onSelect(date, selectedTime || "")
  }

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  const calendarPanel: React.CSSProperties = { background: '#fff', borderRadius: '0.875rem', padding: 'clamp(0.875rem, 2vw, 1.25rem)', border: '1px solid #e8ecf4', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }
  const navBtn: React.CSSProperties = { padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '36px', minWidth: '36px' }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.125rem, 3vw, 1.375rem)', fontWeight: 700, textAlign: 'center', color: '#1e1e2d', marginBottom: '1.25rem' }}>
        Escolha Data e Horário
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
        {/* Calendar */}
        <div style={calendarPanel}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <button onClick={prevMonth} style={navBtn}><ChevronLeft style={{ width: '16px', height: '16px' }} /></button>
            <span style={{ fontWeight: 600, color: '#1e1e2d', textTransform: 'capitalize', fontSize: '0.875rem' }}>{monthLabel}</span>
            <button onClick={nextMonth} style={navBtn}><ChevronRight style={{ width: '16px', height: '16px' }} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {weekDays.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '0.6875rem', fontWeight: 600, color: '#8b8fa7', padding: '4px 0' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1, date = new Date(viewMonth.year, viewMonth.month, day)
              const available = isDayAvailable(day), isSel = selectedDate?.toDateString() === date.toDateString()
              return (
                <button key={day} onClick={() => available && handleDayClick(day)} disabled={!available}
                  style={{ aspectRatio: '1', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, border: 'none', cursor: available ? 'pointer' : 'not-allowed', transition: 'all 0.15s', background: isSel ? '#7c5cfc' : 'transparent', color: isSel ? '#fff' : available ? '#1e1e2d' : '#d1d5db', boxShadow: isSel ? '0 2px 8px rgba(124,92,252,0.3)' : 'none', minHeight: '36px' }}>
                  {day}
                </button>
              )
            })}
          </div>
        </div>

        {/* Time Slots */}
        <div style={calendarPanel}>
          <h3 style={{ fontWeight: 600, color: '#1e1e2d', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}>
            <Clock style={{ width: '14px', height: '14px', color: '#7c5cfc' }} />
            {selectedDate ? selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) : "Selecione uma data"}
          </h3>
          {selectedDate ? (
            getAvailableSlots.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', maxHeight: '260px', overflowY: 'auto' }}>
                {getAvailableSlots.map(time => (
                  <button key={time} onClick={() => onSelect(selectedDate, time)}
                    style={{ padding: '0.625rem', borderRadius: '0.625rem', fontSize: '0.8125rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s', minHeight: '44px', background: selectedTime === time ? '#7c5cfc' : '#f1f3f9', color: selectedTime === time ? '#fff' : '#1e1e2d', boxShadow: selectedTime === time ? '0 2px 8px rgba(124,92,252,0.3)' : 'none' }}>
                    {time}
                  </button>
                ))}
              </div>
            ) : <p style={{ textAlign: 'center', color: '#8b8fa7', padding: '2rem 0', fontSize: '0.8125rem' }}>Nenhum horário disponível</p>
          ) : <p style={{ textAlign: 'center', color: '#8b8fa7', padding: '2rem 0', fontSize: '0.8125rem' }}>Selecione uma data ao lado</p>}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1.75rem', flexWrap: 'wrap' }}>
        <button onClick={onPrev} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', border: '2px solid #e8ecf4', background: '#fff', color: '#1e1e2d', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', minHeight: '48px' }}>
          <ArrowLeft style={{ width: '14px', height: '14px' }} /> Voltar
        </button>
        <button onClick={onNext} disabled={!selectedDate || !selectedTime}
          style={{ padding: '0.75rem 2.5rem', borderRadius: '0.75rem', border: 'none', background: selectedDate && selectedTime ? '#7c5cfc' : '#d1d5db', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: selectedDate && selectedTime ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', boxShadow: selectedDate && selectedTime ? '0 4px 14px rgba(124,92,252,0.25)' : 'none', minHeight: '48px' }}>
          Continuar <ArrowRight style={{ width: '14px', height: '14px' }} />
        </button>
      </div>
    </div>
  )
}
