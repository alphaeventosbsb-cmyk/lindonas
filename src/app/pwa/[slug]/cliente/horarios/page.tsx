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

import { PwaCard } from "@/components/pwa/ui/pwa-card"
import { PwaEmptyState } from "@/components/pwa/ui/pwa-empty-state"
import { PwaButton } from "@/components/pwa/ui/pwa-button"

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
    <div className="flex flex-col h-full bg-[#F7F8FC]">
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl text-[#111827] hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[18px] font-bold text-[#111827] ml-2">Meus Horários</h1>
      </div>

      <div className="p-5 pb-32 space-y-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 rounded-full border-4 border-[#7C5CFC] border-t-transparent animate-spin" />
          </div>
        ) : appointments.length > 0 ? (
          appointments.map((appt) => (
            <PwaCard key={appt.id} className="relative overflow-hidden border border-gray-100 pl-5">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[#7C5CFC]" />
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-[#111827] text-[16px] capitalize">
                    {format(parseISO(appt.appointment_date || appt.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className="text-[14px] text-[#7C5CFC] font-bold flex items-center gap-1.5 mt-1.5">
                    <Clock className="w-4 h-4" /> {appt.appointment_time || appt.start_time} - {appt.end_time || addMinutesToTime(appt.appointment_time || appt.start_time, appt.duration_minutes || 30)}
                  </p>
                </div>
              </div>
              
              <div className="bg-[#F9FAFB] rounded-[16px] p-3 space-y-2.5 border border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-1.5 rounded-lg shadow-sm">
                    <Scissors className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="font-bold text-[14px] text-[#111827]">{appt.service_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-white p-1.5 rounded-lg shadow-sm">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="text-[13px] text-[#6B7280]">Com {appt.employee_name}</span>
                </div>
              </div>
            </PwaCard>
          ))
        ) : (
          <PwaCard className="bg-transparent shadow-none border-dashed border-2 border-gray-200 mt-4">
            <PwaEmptyState 
              icon={CalendarDays}
              title="Sem horários marcados"
              description="Você ainda não tem nenhum agendamento futuro no salão."
              action={
                <PwaButton onClick={() => router.push(`/pwa/${slug}/cliente/agendar`)}>
                  Agendar Agora
                </PwaButton>
              }
            />
          </PwaCard>
        )}
      </div>
    </div>
  )
}

