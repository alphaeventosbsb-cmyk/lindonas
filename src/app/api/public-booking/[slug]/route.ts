import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase/admin"
import type { Appointment, BlockedDate, BusinessHour, Category, Client, Company, Employee, Service } from "@/lib/types/database"
import { addMinutesToTime } from "@/lib/utils"

type PublicBookingData = {
  company: Pick<Company, "id" | "name" | "slug" | "primary_color" | "whatsapp" | "phone" | "logo_url" | "address">
  categories: Partial<Category>[]
  services: Partial<Service>[]
  employees: Partial<Employee>[]
  businessHours: Partial<BusinessHour>[]
  blockedDates: Partial<BlockedDate>[]
  appointments: Partial<Appointment>[]
}

const DEFAULT_PUBLIC_SLUGS = new Set(["default", "lindonas"])

function belongsToCompany(data: { company_id?: string | null }, companyId: string, allowLegacy: boolean) {
  return data.company_id === companyId || (allowLegacy && !data.company_id)
}

function byDisplayOrder<T extends { display_order?: number | null; name?: string | null }>(a: T, b: T) {
  const orderA = a.display_order ?? 0
  const orderB = b.display_order ?? 0
  if (orderA !== orderB) return orderA - orderB
  return (a.name || "").localeCompare(b.name || "", "pt-BR")
}

async function listCollection<T>(collectionName: string): Promise<T[]> {
  const snapshot = await adminDb.collection(collectionName).get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as T)
}

async function loadCompany(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase()
  const snapshot = await adminDb
    .collection("companies")
    .where("slug", "==", normalizedSlug)
    .limit(1)
    .get()

  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return { id: doc.id, ...doc.data() } as Company
}

async function loadLegacyDefaultCompany() {
  const settings = await adminDb.collection("settings").get()
  const settingDocs = settings.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Record<string, any>)
  const salonSettings =
    settingDocs.find(item => String(item.business_name || "").toLowerCase().includes("lindonas")) ||
    settingDocs[0]

  return {
    id: "default",
    name: salonSettings?.business_name || "Salão Lindonas",
    slug: "lindonas",
    logo_url: salonSettings?.logo_url || null,
    cover_image_url: null,
    phone: salonSettings?.phone || null,
    whatsapp: salonSettings?.whatsapp || null,
    email: null,
    document: salonSettings?.cnpj || null,
    address: salonSettings?.address || null,
    instagram: salonSettings?.instagram || null,
    about_text: null,
    primary_color: salonSettings?.primary_color || null,
    owner_id: "system",
    owner_name: "Sistema",
    owner_email: "",
    plan_id: null,
    subscription_status: "active",
    trial_ends_at: null,
    payment_due_date: null,
    is_blocked: false,
    gallery_images: [],
    youtube_videos: [],
    created_at: salonSettings?.created_at || new Date(0).toISOString(),
    updated_at: salonSettings?.updated_at || new Date(0).toISOString(),
  } as Company
}

async function loadDefaultCompany(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase()
  const company = await loadCompany(normalizedSlug)
  if (company) return company
  if (!DEFAULT_PUBLIC_SLUGS.has(normalizedSlug)) return null

  const snapshot = await adminDb.collection("companies").limit(10).get()
  const activeCompanies = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }) as Company)
    .filter(item => !item.is_blocked)

  if (activeCompanies.length === 1) return activeCompanies[0]
  if (activeCompanies.length === 0) return loadLegacyDefaultCompany()
  return null
}

async function shouldAllowLegacyCompanylessDocs() {
  const companies = await adminDb.collection("companies").limit(2).get()
  return companies.size <= 1
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const company = await loadDefaultCompany(slug)

    if (!company || company.is_blocked) {
      return NextResponse.json({ error: "Empresa nao encontrada." }, { status: 404 })
    }

    const allowLegacy = await shouldAllowLegacyCompanylessDocs()
    const [allCategories, allServices, allEmployees, allHours, allBlockedDates, allAppointments] = await Promise.all([
      listCollection<Category>("categories"),
      listCollection<Service>("services"),
      listCollection<Employee>("employees"),
      listCollection<BusinessHour>("business_hours"),
      listCollection<BlockedDate>("blocked_dates"),
      listCollection<Appointment>("appointments"),
    ])

    const categories = allCategories
      .filter(category => belongsToCompany(category, company.id, allowLegacy) && category.is_active !== false)
      .sort(byDisplayOrder)
      .map(category => ({
        id: category.id,
        company_id: category.company_id || company.id,
        name: category.name,
        display_order: category.display_order || 0,
        is_active: category.is_active !== false,
      }))

    const services = allServices
      .filter(service => belongsToCompany(service, company.id, allowLegacy))
      .filter(service => service.is_active !== false && service.hide_from_online_booking !== true)
      .sort(byDisplayOrder)
      .map(service => ({
        id: service.id,
        company_id: service.company_id || company.id,
        category_id: service.category_id || null,
        name: service.name,
        description: service.description || null,
        price: Number(service.price || 0),
        promotional_price: service.promotional_price ?? null,
        duration_minutes: Number(service.duration_minutes || 30),
        image_url: service.image_url || null,
        featured: service.featured || false,
        is_active: service.is_active !== false,
        display_order: service.display_order || 0,
        hide_from_online_booking: service.hide_from_online_booking === true,
      }))

    const employees = allEmployees
      .filter(employee => belongsToCompany(employee, company.id, allowLegacy))
      .filter(employee => employee.is_active !== false && employee.has_schedule !== false)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"))
      .map(employee => ({
        id: employee.id,
        company_id: employee.company_id || company.id,
        name: employee.name,
        photo_url: employee.photo_url || null,
        specialty: employee.specialty || null,
        service_ids: employee.service_ids || [],
        workdays: employee.workdays || [1, 2, 3, 4, 5],
        working_hours_start: employee.working_hours_start || "08:00",
        working_hours_end: employee.working_hours_end || "18:00",
        schedule_by_day: employee.schedule_by_day || null,
        has_schedule: employee.has_schedule !== false,
        is_active: employee.is_active !== false,
      }))

    const businessHours = allHours
      .filter(hour => belongsToCompany(hour, company.id, allowLegacy))
      .map(hour => ({
        id: hour.id,
        company_id: hour.company_id || company.id,
        day_of_week: hour.day_of_week,
        start_time: hour.start_time,
        end_time: hour.end_time,
        is_active: hour.is_active !== false,
      }))

    const blockedDates = allBlockedDates
      .filter(blockedDate => belongsToCompany(blockedDate, company.id, allowLegacy))
      .map(blockedDate => ({
        id: blockedDate.id,
        company_id: blockedDate.company_id || company.id,
        date: blockedDate.date,
        reason: blockedDate.reason || null,
      }))

    const appointments = allAppointments
      .filter(appointment => belongsToCompany(appointment, company.id, allowLegacy))
      .filter(appointment => ["pending", "confirmed"].includes(appointment.status))
      .map(appointment => ({
        id: appointment.id,
        company_id: appointment.company_id || company.id,
        employee_id: appointment.employee_id || null,
        appointment_date: appointment.appointment_date,
        appointment_time: appointment.appointment_time,
        end_time: appointment.end_time || null,
        duration_minutes: appointment.duration_minutes || 30,
        status: appointment.status,
      }))

    const payload: PublicBookingData = {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        primary_color: company.primary_color,
        whatsapp: company.whatsapp,
        phone: company.phone,
        logo_url: company.logo_url,
        address: company.address,
      },
      categories,
      services,
      employees,
      businessHours,
      blockedDates,
      appointments,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error("Erro ao carregar dados publicos de agendamento:", error)
    return NextResponse.json({ error: "Erro ao carregar dados de agendamento." }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const company = await loadDefaultCompany(slug)

    if (!company || company.is_blocked) {
      return NextResponse.json({ error: "Empresa nao encontrada." }, { status: 404 })
    }

    const body = await request.json()
    const serviceId = String(body.service_id || "")
    const employeeId = body.employee_id ? String(body.employee_id) : null
    const clientName = String(body.client_name || "").trim()
    const clientPhone = String(body.client_phone || "").replace(/\D/g, "")
    const clientEmail = body.client_email ? String(body.client_email).trim() : null
    const appointmentDate = String(body.appointment_date || "")
    const appointmentTime = String(body.appointment_time || "")
    const notes = body.notes ? String(body.notes).trim() : null

    if (!serviceId || clientName.length < 3 || clientPhone.length < 10 || !appointmentDate || !appointmentTime) {
      return NextResponse.json({ error: "Dados do agendamento incompletos." }, { status: 400 })
    }

    const allowLegacy = await shouldAllowLegacyCompanylessDocs()
    const serviceDoc = await adminDb.collection("services").doc(serviceId).get()
    if (!serviceDoc.exists) {
      return NextResponse.json({ error: "Servico nao encontrado." }, { status: 404 })
    }

    const service = { id: serviceDoc.id, ...serviceDoc.data() } as Service
    if (!belongsToCompany(service, company.id, allowLegacy) || service.is_active === false || service.hide_from_online_booking === true) {
      return NextResponse.json({ error: "Servico indisponivel para agendamento online." }, { status: 403 })
    }

    let employee: Employee | null = null
    if (employeeId) {
      const employeeDoc = await adminDb.collection("employees").doc(employeeId).get()
      if (!employeeDoc.exists) {
        return NextResponse.json({ error: "Profissional nao encontrado." }, { status: 404 })
      }
      employee = { id: employeeDoc.id, ...employeeDoc.data() } as Employee
      if (!belongsToCompany(employee, company.id, allowLegacy) || employee.is_active === false || employee.has_schedule === false) {
        return NextResponse.json({ error: "Profissional indisponivel." }, { status: 403 })
      }
      if (employee.service_ids?.length && !employee.service_ids.includes(service.id)) {
        return NextResponse.json({ error: "Profissional nao atende este servico." }, { status: 403 })
      }
      
      const { professionalWorksOnDate, checkBusinessRules, timesOverlap, addMinutesToTime } = await import("@/lib/utils")
      
      const [hoursSnapshot, blockedSnapshot, apptsSnapshot] = await Promise.all([
        adminDb.collection("business_hours").where("company_id", "in", [company.id, "default"]).get(),
        adminDb.collection("blocked_dates").where("company_id", "in", [company.id, "default"]).get(),
        adminDb.collection("appointments")
          .where("company_id", "in", [company.id, "default"])
          .where("employee_id", "==", employee.id)
          .where("appointment_date", "==", appointmentDate)
          .get()
      ])
      
      const allHours = hoursSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any))
      const allBlockedDates = blockedSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any))
      const allAppointments = apptsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any))

      const durationMins = Number(service.duration_minutes || 30)
      const businessRule = checkBusinessRules(appointmentTime, durationMins, appointmentDate, employee, allHours, allBlockedDates)

      if (businessRule.errorType === 'blocked_date') {
        return NextResponse.json({ error: `Não é possível agendar: Data bloqueada${businessRule.reason ? ` - ${businessRule.reason}` : ''}.` }, { status: 403 })
      } else if (businessRule.errorType === 'closed_day') {
        return NextResponse.json({ error: "Não é possível agendar: o profissional não atende neste dia." }, { status: 403 })
      } else if (businessRule.errorType === 'out_of_hours') {
        if (businessRule.reason === 'Horário de almoço do profissional' || businessRule.reason === 'Horário de intervalo do profissional') {
          const [h, m] = appointmentTime.split(':').map(Number)
          const aptStart = h * 60 + m
          const aptEndStr = `${String(Math.floor((aptStart + durationMins) / 60)).padStart(2, "0")}:${String((aptStart + durationMins) % 60).padStart(2, "0")}`
          
          const isFreed = allAppointments.some((a: any) => 
            a.type === 'free' && 
            a.appointment_date === appointmentDate && 
            a.employee_id === employee?.id && 
            timesOverlap(appointmentTime, aptEndStr, a.appointment_time, a.end_time || addMinutesToTime(a.appointment_time, a.duration_minutes || 0))
          )
          
          if (!isFreed) {
             return NextResponse.json({ error: `Não é possível agendar: o profissional está em ${businessRule.reason === 'Horário de almoço do profissional' ? 'horário de almoço' : 'intervalo'}.` }, { status: 403 })
          }
        } else {
           return NextResponse.json({ error: `Não é possível agendar: o agendamento termina fora do horário de expediente.` }, { status: 403 })
        }
      }

      // Check for overlapping appointments
      const [h, m] = appointmentTime.split(':').map(Number)
      const aptStart = h * 60 + m
      const aptEnd = aptStart + durationMins
      
      const appointmentsSnapshot = await adminDb.collection("appointments")
        .where("company_id", "==", company.id)
        .where("employee_id", "==", employee.id)
        .where("appointment_date", "==", appointmentDate)
        .get()

      const blockingStatuses = ["pending", "confirmed", "waiting", "in_progress", "completed", "payment_pending"]
      const hasConflict = allAppointments.some((a: any) => {
        if (a.status === 'cancelled') return false
        if (a.type === 'absence' || a.type === 'free') return false
        if (a.type !== 'block' && (!a.status || !blockingStatuses.includes(a.status))) return false

        const [ah, am] = (a.appointment_time || "00:00").split(':').map(Number)
        const aStart = ah * 60 + am
        const aEnd = aStart + (a.duration_minutes || 0)

        return (aptStart < aEnd && aptEnd > aStart)
      })

      if (hasConflict) {
        return NextResponse.json({ error: "Horário indisponível. Já existe um agendamento para este profissional neste período." }, { status: 409 })
      }
    }

    const durationMinutes = Number(service.duration_minutes || 30)
    const now = new Date().toISOString()
    const allCompanyClients = (await listCollection<Client>("clients"))
      .filter(client => belongsToCompany(client, company.id, allowLegacy))
      
    const existingClient = allCompanyClients.find(client => 
      client.phone?.replace(/\D/g, "") === clientPhone || 
      (clientEmail && client.email?.toLowerCase() === clientEmail.toLowerCase())
    )

    if (existingClient?.online_booking_blocked) {
      return NextResponse.json({ error: "Seu agendamento online está indisponível no momento. Entre em contato com o salão para continuar." }, { status: 403 })
    }

    let clientId = existingClient?.id || null

    if (!existingClient) {
      const clientRef = await adminDb.collection("clients").add({
        company_id: company.id,
        name: clientName,
        phone: clientPhone,
        whatsapp: clientPhone,
        is_whatsapp: true,
        email: clientEmail,
        notes: null,
        total_spent: 0,
        credit_amount: 0,
        debt_amount: 0,
        status: "active",
        appointment_count: 0,
        last_visit: null,
        created_at: now,
        updated_at: now,
      })
      clientId = clientRef.id
    }

    const docRef = await adminDb.collection("appointments").add({
      company_id: company.id,
      service_id: service.id,
      service_name: service.name,
      service_price: Number(service.promotional_price || service.price || 0),
      employee_id: employee?.id || null,
      employee_name: employee?.name || null,
      client_id: clientId,
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      end_time: addMinutesToTime(appointmentTime, durationMinutes),
      duration_minutes: durationMinutes,
      payment_method: null,
      payment_status: "pending",
      notes,
      priority_color: null,
      label_ids: [],
      status: "pending",
      source: "online",
      created_at: now,
      updated_at: now,
    })

    await adminDb.collection("appointment_logs").add({
      appointment_id: docRef.id,
      action_type: "created",
      action_label: "Novo Agendamento (Online)",
      description: `Agendamento criado pelo cliente via Agendamento Online`,
      user_id: clientId,
      user_name: clientName,
      user_role: "client",
      created_at: now,
    })

    return NextResponse.json({ success: true, appointment_id: docRef.id })
  } catch (error) {
    console.error("Erro ao criar agendamento publico:", error)
    return NextResponse.json({ error: "Erro ao criar agendamento." }, { status: 500 })
  }
}
