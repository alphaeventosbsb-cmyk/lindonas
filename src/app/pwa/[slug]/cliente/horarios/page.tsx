"use client"

import { useEffect, useState } from "react"
import { usePWATenant } from "@/components/pwa/pwa-tenant-context"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"
import { CalendarDays, Clock, MapPin, User, Scissors, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"
import { useRouter } from "next/navigation"

export default function ClientAppointments() {
  const { companyId, user, slug } = usePWATenant()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      if (!companyId || !user?.uid) return
      
      try {
        const clients = await fetchCollectionWhere("clients", "auth_uid", "==", user.uid)
        const myClient = clients.find((c: any) => c.company_id === companyId)
        if (!myClient) return

        const db = getDb()
        const apptsRef = collection(db, "appointments")
        const q = query(
          apptsRef,
          where("company_id", "==", companyId),
          where("client_id", "==", myClient.id),
          where("status", "in", ["scheduled", "pending", "confirmed"])
        )
        const snap = await getDocs(q)
        const appts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        
        // Sort by date/time ascending
        appts.sort((a: any, b: any) => {
          const dtA = parseISO(`${a.date?.split('T')[0] || a.appointment_date}T${a.start_time || a.appointment_time}:00`).getTime()
          const dtB = parseISO(`${b.date?.split('T')[0] || b.appointment_date}T${b.start_time || b.appointment_time}:00`).getTime()
          return dtA - dtB
        })
        
        setAppointments(appts)
      } catch (err) {
        console.error("Failed to load appointments:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [companyId, user?.uid])

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl text-gray-700 hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 ml-2">Meus Horários</h1>
      </div>

      <div className="p-4 pb-24 space-y-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin" />
          </div>
        ) : appointments.length > 0 ? (
          appointments.map((appt) => (
            <div key={appt.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-primary)]" />
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-gray-900 text-lg capitalize">
                    {format(parseISO(appt.appointment_date || appt.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className="text-sm text-[var(--color-primary)] font-bold flex items-center gap-1 mt-1">
                    <Clock className="w-4 h-4" /> {appt.appointment_time || appt.start_time} - {appt.end_time}
                  </p>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-gray-500" />
                  <span className="font-bold text-sm text-gray-900">{appt.service_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-xs text-gray-600">Com {appt.employee_name}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-200">
            <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-900 font-bold mb-2">Sem horários marcados</h3>
            <p className="text-sm text-gray-500 mb-6">Você ainda não tem nenhum agendamento futuro.</p>
            <Link href={`/pwa/${slug}/cliente/agendar`} className="inline-flex h-10 px-6 bg-[var(--color-primary)] text-white font-bold rounded-xl items-center justify-center">
              Agendar Agora
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
