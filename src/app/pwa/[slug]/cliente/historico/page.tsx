"use client"

import { useEffect, useState } from "react"
import { usePWATenant } from "@/components/pwa/pwa-tenant-context"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"
import { CalendarDays, Clock, User, Scissors, ArrowLeft } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"
import { useRouter } from "next/navigation"

export default function ClientHistory() {
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
          where("status", "in", ["completed", "cancelled", "no_show"])
        )
        const snap = await getDocs(q)
        const appts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        
        // Sort by date/time descending
        appts.sort((a: any, b: any) => {
          const dtA = parseISO(`${a.date?.split('T')[0] || a.appointment_date}T${a.start_time || a.appointment_time}:00`).getTime()
          const dtB = parseISO(`${b.date?.split('T')[0] || b.appointment_date}T${b.start_time || b.appointment_time}:00`).getTime()
          return dtB - dtA
        })
        
        setAppointments(appts)
      } catch (err) {
        console.error("Failed to load history:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [companyId, user?.uid])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-emerald-100 text-emerald-700"
      case "cancelled": return "bg-red-100 text-red-700"
      case "no_show": return "bg-orange-100 text-orange-700"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed": return "Concluído"
      case "cancelled": return "Cancelado"
      case "no_show": return "Faltou"
      default: return status
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl text-gray-700 hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 ml-2">Histórico</h1>
      </div>

      <div className="p-4 pb-24 space-y-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin" />
          </div>
        ) : appointments.length > 0 ? (
          appointments.map((appt) => (
            <div key={appt.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden opacity-90">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-gray-900 text-lg capitalize">
                    {format(parseISO(appt.appointment_date || appt.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-sm text-gray-500 font-medium flex items-center gap-1 mt-1">
                    <Clock className="w-4 h-4" /> {appt.appointment_time || appt.start_time}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${getStatusColor(appt.status)}`}>
                  {getStatusText(appt.status)}
                </span>
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
            <h3 className="text-gray-900 font-bold mb-2">Nenhum histórico</h3>
            <p className="text-sm text-gray-500">Seus agendamentos anteriores aparecerão aqui.</p>
          </div>
        )}
      </div>
    </div>
  )
}
