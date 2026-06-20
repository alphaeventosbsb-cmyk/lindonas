"use client"

import { useEffect, useState } from "react"
import { usePWATenant } from "@/components/pwa/pwa-tenant-context"
import { fetchCollectionWhere, updateDocument } from "@/lib/firebase/client-utils"
import { CalendarDays, Clock, User, Scissors, Check, Play, Ban } from "lucide-react"
import { format, addDays, startOfToday, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"
import { toast } from "sonner"

export default function ProfessionalAgenda() {
  const { companyId, user } = usePWATenant()
  const [employee, setEmployee] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday())

  const loadData = async () => {
    if (!companyId || !user?.uid) return
    setLoading(true)
    try {
      let currentEmp = employee
      if (!currentEmp) {
        const emps = await fetchCollectionWhere("employees", "auth_uid", "==", user.uid)
        currentEmp = emps.find((e: any) => e.company_id === companyId)
        if (currentEmp) setEmployee(currentEmp)
      }

      if (!currentEmp) return

      const db = getDb()
      const dateStr = format(selectedDate, "yyyy-MM-dd")
      const apptsRef = collection(db, "appointments")
      const q = query(
        apptsRef,
        where("company_id", "==", companyId),
        where("employee_id", "==", currentEmp.id),
        where("appointment_date", "==", dateStr)
      )
      const snap = await getDocs(q)
      const appts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      appts.sort((a: any, b: any) => (a.appointment_time || a.start_time || "").localeCompare(b.appointment_time || b.start_time || ""))
      setAppointments(appts)
    } catch (err) {
      console.error("Failed to load professional agenda:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [companyId, user?.uid, selectedDate])

  const changeStatus = async (id: string, newStatus: string) => {
    try {
      await updateDocument("appointments", id, { status: newStatus })
      toast.success("Status atualizado!")
      loadData()
    } catch (err) {
      toast.error("Erro ao atualizar status.")
    }
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "pending": return <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-bold">Pendente</span>
      case "confirmed": return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">Confirmado</span>
      case "in_progress": return <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold">Em Atendimento</span>
      case "completed": return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">Concluído</span>
      case "cancelled": return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">Cancelado</span>
      case "no_show": return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold">Faltou</span>
      default: return <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold">{status}</span>
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="bg-white px-4 py-4 border-b border-gray-100 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-900">Agenda Diária</h1>
      </div>

      <div className="bg-white p-4 border-b border-gray-100 shadow-sm sticky top-[60px] z-10">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[...Array(14)].map((_, i) => {
            const d = addDays(startOfToday(), i - 3) // 3 days ago to 10 days ahead
            const isSelected = format(d, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(d)}
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

      <div className="p-4 pb-24 space-y-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin" />
          </div>
        ) : appointments.length > 0 ? (
          appointments.map((appt) => (
            <div key={appt.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-3 border-b border-gray-50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-gray-100 p-2 rounded-lg text-gray-700">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-gray-900">{appt.appointment_time || appt.start_time} - {appt.end_time}</span>
                  </div>
                </div>
                {getStatusBadge(appt.status)}
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-bold text-sm text-gray-800">{appt.client_name || "Cliente sem nome"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-600">{appt.service_name}</span>
                </div>
              </div>

              {/* Actions depending on status */}
              <div className="flex gap-2">
                {["pending", "confirmed"].includes(appt.status) && (
                  <>
                    <button onClick={() => changeStatus(appt.id, "in_progress")} className="flex-1 bg-purple-50 text-purple-700 text-xs font-bold py-2 rounded-xl border border-purple-100 flex items-center justify-center gap-1">
                      <Play className="w-3 h-3" /> Iniciar
                    </button>
                    <button onClick={() => changeStatus(appt.id, "no_show")} className="bg-orange-50 text-orange-700 text-xs font-bold px-3 rounded-xl border border-orange-100 flex items-center justify-center gap-1">
                      <Ban className="w-3 h-3" /> Faltou
                    </button>
                  </>
                )}
                {appt.status === "in_progress" && (
                  <button onClick={() => changeStatus(appt.id, "completed")} className="flex-1 bg-emerald-50 text-emerald-700 text-xs font-bold py-2 rounded-xl border border-emerald-100 flex items-center justify-center gap-1">
                    <Check className="w-3 h-3" /> Concluir
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-200 mt-4">
            <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-900 font-bold mb-2">Nenhum atendimento</h3>
            <p className="text-sm text-gray-500">Você não tem agendamentos para este dia.</p>
          </div>
        )}
      </div>
    </div>
  )
}
