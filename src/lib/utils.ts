import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Employee, Appointment, BusinessHour, BlockedDate } from "./types/database"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0m"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${m}m`
}

export function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "")
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`
  }
  return phone
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

export function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && s2 < e1
}

/**
 * Returns a YYYY-MM-DD string using LOCAL date parts (not UTC).
 * Avoids the common toISOString() bug where dates shift in negative
 * timezone offsets (e.g. 2026-05-12 22:00 in UTC-3 → 2026-05-13 in UTC).
 */
export function toLocalDateStr(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function formatCPF(cpf: string): string {
  const clean = cpf.replace(/\D/g, "").slice(0, 11)
  if (clean.length <= 3) return clean
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`
  if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`
}

export function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "")
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i)) * (10 - i)
  let rest = (sum * 10) % 11
  if (rest === 10) rest = 0
  if (rest !== parseInt(clean.charAt(9))) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i)) * (11 - i)
  rest = (sum * 10) % 11
  if (rest === 10) rest = 0
  return rest === parseInt(clean.charAt(10))
}

export function maskCEP(cep: string): string {
  const clean = cep.replace(/\D/g, "").slice(0, 8)
  if (clean.length <= 5) return clean
  return `${clean.slice(0, 5)}-${clean.slice(5)}`
}

export function validateScheduleOvertime(time: string, durationMinutes: number, date: string, employee: Employee | null): { isOvertime: boolean, endTimeStr: string, closingTimeStr: string } {
  const [h, m] = time.split(":").map(Number)
  const totalMins = h * 60 + m + durationMinutes
  const endH = Math.floor(totalMins / 60)
  const endM = totalMins % 60
  const endTimeStr = `${String(endH % 24).padStart(2, "0")}:${String(endM).padStart(2, "0")}`

  let closingTimeStr = "18:00"

  if (employee) {
    if (employee.schedule_by_day) {
      const [y, mStr, dStr] = date.split('-').map(Number)
      const d = new Date(y, mStr - 1, dStr)
      const dayOfWeek = d.getDay()
      const schedule = employee.schedule_by_day[dayOfWeek.toString()]
      
      if (schedule && schedule.enabled && schedule.end) {
        closingTimeStr = schedule.end
      } else if (employee.working_hours_end) {
        closingTimeStr = employee.working_hours_end
      }
    } else if (employee.working_hours_end) {
      closingTimeStr = employee.working_hours_end
    }
  }

  const [cH, cM] = closingTimeStr.split(":").map(Number)
  const closingTotalMins = cH * 60 + cM

  const isOvertime = totalMins > closingTotalMins

  return { isOvertime, endTimeStr, closingTimeStr }
}

export function professionalWorksOnDate(employee: Employee | null, date: string): boolean {
  if (!employee) return true

  const [y, mStr, dStr] = date.split('-').map(Number)
  const d = new Date(y, mStr - 1, dStr)
  const dayOfWeek = d.getDay() // 0 to 6

  // 1. First check schedule_by_day if it exists and has the specific day
  if (employee.schedule_by_day && Object.keys(employee.schedule_by_day).length > 0) {
    const schedule = employee.schedule_by_day[dayOfWeek.toString()]
    if (schedule !== undefined) {
      return schedule.enabled
    }
  }

  // 2. Fallback to workdays array
  if (employee.workdays && Array.isArray(employee.workdays)) {
    return employee.workdays.includes(dayOfWeek)
  }

  return true
}

export function checkBusinessRules(
  timeStr: string,
  durationMins: number,
  date: string,
  employee: Employee | null,
  businessHours: BusinessHour[],
  blockedDates: BlockedDate[]
): { errorType: 'blocked_date' | 'closed_day' | 'out_of_hours' | null, reason?: string, endTimeStr?: string, closingTimeStr?: string } {
  // 1. Check Blocked Dates
  const isBlocked = blockedDates.find(b => b.date === date)
  if (isBlocked) {
    return { errorType: 'blocked_date', reason: isBlocked.reason || "" }
  }

  // 2. Determine Business Day
  const [y, mStr, dStr] = date.split('-').map(Number)
  const d = new Date(y, mStr - 1, dStr)
  const dayOfWeek = d.getDay() // 0 (Sun) to 6 (Sat)
  
  let openingTimeStr = "08:00"
  let closingTimeStr = "18:00"
  let isClosed = false
  let lunchStartStr: string | null = null
  let lunchEndStr: string | null = null
  let breakStartStr: string | null = null
  let breakEndStr: string | null = null

  // Global settings
  const globalHour = businessHours.find(h => h.day_of_week === dayOfWeek)
  if (globalHour && !globalHour.is_active) {
    isClosed = true
  } else if (globalHour) {
    openingTimeStr = globalHour.start_time
    closingTimeStr = globalHour.end_time
  }

  // Employee override
  if (employee) {
    // Strict check: if the professional does not work on this date, immediately return closed_day
    if (!professionalWorksOnDate(employee, date)) {
      return { errorType: 'closed_day', reason: 'Profissional não atende neste dia.' }
    }
    
    // If we reach here, the employee works today. We ensure isClosed is false.
    isClosed = false

    if (employee.schedule_by_day && Object.keys(employee.schedule_by_day).length > 0) {
      const schedule = employee.schedule_by_day[dayOfWeek.toString()]
      if (schedule && schedule.enabled) {
        openingTimeStr = schedule.start || openingTimeStr
        closingTimeStr = schedule.end || closingTimeStr
        lunchStartStr = schedule.lunchStart || null
        lunchEndStr = schedule.lunchEnd || null
        breakStartStr = schedule.breakStart || null
        breakEndStr = schedule.breakEnd || null
      }
    } else if (employee.working_hours_start && employee.working_hours_end) {
      openingTimeStr = employee.working_hours_start
      closingTimeStr = employee.working_hours_end
    }
  }

  if (isClosed) {
    return { errorType: 'closed_day' }
  }

  // 3. Time Validation
  if (!timeStr) return { errorType: null }
  
  const [h, m] = timeStr.split(":").map(Number)
  const totalMins = h * 60 + m
  const aptEndMins = totalMins + durationMins

  const [oH, oM] = openingTimeStr.split(":").map(Number)
  const openMins = oH * 60 + oM

  const [cH, cM] = closingTimeStr.split(":").map(Number)
  const closeMins = cH * 60 + cM

  if (totalMins < openMins || aptEndMins > closeMins) {
    const endH = Math.floor(aptEndMins / 60)
    const endM = aptEndMins % 60
    const endTimeStr = `${String(endH % 24).padStart(2, "0")}:${String(endM).padStart(2, "0")}`
    return { errorType: 'out_of_hours', endTimeStr, closingTimeStr }
  }

  if (lunchStartStr && lunchEndStr) {
    const [lsH, lsM] = lunchStartStr.split(":").map(Number)
    const [leH, leM] = lunchEndStr.split(":").map(Number)
    const lunchStartMins = lsH * 60 + lsM
    const lunchEndMins = leH * 60 + leM
    if (totalMins < lunchEndMins && aptEndMins > lunchStartMins) {
      return { errorType: 'out_of_hours', reason: 'Horário de almoço do profissional', endTimeStr: lunchEndStr, closingTimeStr: lunchStartStr }
    }
  }

  if (breakStartStr && breakEndStr) {
    const [bsH, bsM] = breakStartStr.split(":").map(Number)
    const [beH, beM] = breakEndStr.split(":").map(Number)
    const breakStartMins = bsH * 60 + bsM
    const breakEndMins = beH * 60 + beM
    if (totalMins < breakEndMins && aptEndMins > breakStartMins) {
      return { errorType: 'out_of_hours', reason: 'Horário de intervalo do profissional', endTimeStr: breakEndStr, closingTimeStr: breakStartStr }
    }
  }

  return { errorType: null }
}

export function checkBlockConflict(
  timeStr: string,
  durationMins: number,
  date: string,
  employeeId: string,
  appointments: Appointment[]
): Appointment | null {
  const [h, m] = timeStr.split(':').map(Number)
  const aptStart = h * 60 + m
  const aptEnd = aptStart + durationMins
  
  const blocks = appointments.filter(a => 
    a.type === 'block' && 
    a.appointment_date === date && 
    a.employee_id === employeeId && 
    a.status !== 'cancelled'
  )
  
  for (const block of blocks) {
    const [bh, bm] = block.appointment_time.split(':').map(Number)
    const blockStart = bh * 60 + bm
    const blockEnd = blockStart + (block.duration_minutes || 0)
    
    if (aptStart < blockEnd && aptEnd > blockStart) {
      return block
    }
  }
  return null
}

export function calculateSharedServiceSplits(sharedAppointments: Appointment[]): Record<string, number> {
  const vals: Record<string, number> = {}
  const serviceGroups = new Map<string, Appointment[]>()
  
  sharedAppointments.forEach(apt => {
    const key = apt.service_id || apt.service_name || apt.id
    if (!serviceGroups.has(key)) serviceGroups.set(key, [])
    serviceGroups.get(key)!.push(apt)
  })

  serviceGroups.forEach((apts, key) => {
    const count = apts.length
    const explicitTotal = apts.find(a => a.service_total_value != null)?.service_total_value
    const maxServicePrice = Math.max(...apts.map(a => a.service_price || 0))

    const baseValue = explicitTotal != null ? explicitTotal : maxServicePrice

    if (count === 1) {
      const apt = apts[0]
      vals[apt.id] = apt.professional_service_value != null ? apt.professional_service_value : baseValue
    } else {
      const splitValue = Math.floor((baseValue / count) * 100) / 100
      const remainder = Math.round((baseValue - (splitValue * count)) * 100) / 100

      const currentSum = apts.reduce((sum, apt) => sum + (apt.professional_service_value || 0), 0)
      const hasAllValues = apts.every(apt => apt.professional_service_value != null)
      const isManualOverride = hasAllValues && Math.abs(currentSum - baseValue) < 0.01

      apts.forEach((apt, index) => {
        if (isManualOverride && apt.professional_service_value != null) {
          vals[apt.id] = apt.professional_service_value
        } else {
          vals[apt.id] = splitValue + (index === 0 ? remainder : 0)
        }
      })
    }
  })
  return vals
}

export function checkAppointmentConflict(
  timeStr: string,
  durationMins: number,
  date: string,
  employeeId: string,
  appointments: Appointment[],
  excludeAppointmentId?: string
): { hasConflict: boolean; type: 'block' | 'appointment' | null; conflict: Appointment | null } {
  const [h, m] = timeStr.split(':').map(Number)
  const aptStart = h * 60 + m
  const aptEnd = aptStart + durationMins
  
  const blockingStatuses = ["pending", "confirmed", "waiting", "in_progress", "completed", "payment_pending"]
  
  const relevantApts = appointments.filter(a => 
    a.appointment_date === date && 
    a.employee_id === employeeId && 
    a.id !== excludeAppointmentId &&
    a.status !== 'cancelled' &&
    a.type !== 'absence' &&
    a.type !== 'free'
  )

  for (const a of relevantApts) {
    if (a.type !== 'block' && (!a.status || !blockingStatuses.includes(a.status))) {
      continue
    }

    const [ah, am] = (a.appointment_time || "00:00").split(':').map(Number)
    const aStart = ah * 60 + am
    const aEnd = aStart + (a.duration_minutes || 0)

    if (aptStart < aEnd && aptEnd > aStart) {
      return { 
        hasConflict: true, 
        type: a.type === 'block' ? 'block' : 'appointment', 
        conflict: a 
      }
    }
  }

  return { hasConflict: false, type: null, conflict: null }
}

export function isPhoneNumberOnly(text: string | null | undefined): boolean {
  if (!text) return false;
  const digits = text.replace(/\D/g, "");
  const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  // Se tiver pelo menos 8 dígitos e menos que 3 letras, provavelmente é telefone
  if (digits.length >= 8 && letters.length < 3) return true;
  return false;
}

export function resolveClientForAppointment(appointment: any, clients: any[]): any {
  if (!clients || !Array.isArray(clients)) return null;

  // 1. Tentar por client_id
  let client = null;
  if (appointment.client_id) {
    client = clients.find(c => c.id === appointment.client_id);
    if (client) return client;
  }

  // Se o agendamento já tiver o client resolvido e for o objeto inteiro:
  if (appointment.client && typeof appointment.client === 'object' && appointment.client.id) {
    return appointment.client;
  }

  // 2. Tentar por telefone normalizado
  if (!client && appointment.client_phone) {
    const aptPhone = appointment.client_phone.replace(/\D/g, "");
    if (aptPhone.length >= 10) {
      const matches = clients.filter(c => c.phone && c.phone.replace(/\D/g, "") === aptPhone);
      if (matches.length === 1) return matches[0];
    }
  }

  // 2.1 Tentar por telefone no campo de nome, caso tenha sido salvo errado
  if (!client && appointment.client_name && isPhoneNumberOnly(appointment.client_name)) {
    const aptPhone = appointment.client_name.replace(/\D/g, "");
    if (aptPhone.length >= 10) {
      const matches = clients.filter(c => c.phone && c.phone.replace(/\D/g, "") === aptPhone);
      if (matches.length === 1) return matches[0];
    }
  }

  // 3. Tentar por email
  if (!client && appointment.client_email) {
    const matches = clients.filter(c => c.email && c.email.trim().toLowerCase() === appointment.client_email.trim().toLowerCase());
    if (matches.length === 1) return matches[0];
  }

  // 4. Tentar por nome exato (último recurso)
  if (!client && appointment.client_name && !isPhoneNumberOnly(appointment.client_name)) {
    const matches = clients.filter(c => c.name && c.name.trim().toLowerCase() === appointment.client_name.trim().toLowerCase());
    if (matches.length === 1) return matches[0];
  }

  return null;
}

export function getAppointmentClientDisplayName(appointment: any, client: any): string {
  // 1. Se existe cliente e tem nome válido, usar.
  if (client && client.name && !isPhoneNumberOnly(client.name)) {
    return client.name;
  }

  // 2. Se não tem cliente ou o nome do cliente é telefone, checar o nome no agendamento.
  if (appointment && appointment.client_name) {
    if (isPhoneNumberOnly(appointment.client_name)) {
      return client?.name || "Cliente sem nome";
    }
    return appointment.client_name;
  }

  // Fallback extremo
  if (client && client.name) return client.name;
  if (appointment && appointment.client_phone) return appointment.client_phone;
  if (client && client.phone) return client.phone;

  return "Cliente não informado";
}
