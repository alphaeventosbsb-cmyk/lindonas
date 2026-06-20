"use client"

import { useEffect, useState } from "react"
import { usePWATenant } from "@/components/pwa/pwa-tenant-context"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"
import { DollarSign, ArrowLeft, CalendarDays, Wallet } from "lucide-react"
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"
import { useRouter } from "next/navigation"

export default function ProfessionalCommissions() {
  const { companyId, user, slug } = usePWATenant()
  const [employee, setEmployee] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()))
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
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
        const startStr = startOfMonth(selectedMonth).toISOString()
        const endStr = endOfMonth(selectedMonth).toISOString()

        const apptsRef = collection(db, "appointments")
        const q = query(
          apptsRef,
          where("company_id", "==", companyId),
          where("employee_id", "==", currentEmp.id),
          where("status", "==", "completed")
        )
        const snap = await getDocs(q)
        let appts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        
        // Filter by month
        appts = appts.filter((a: any) => {
          const dt = parseISO(a.date || a.appointment_date)
          return dt >= startOfMonth(selectedMonth) && dt <= endOfMonth(selectedMonth)
        })

        // Sort descending
        appts.sort((a: any, b: any) => {
          const dtA = parseISO(`${a.date?.split('T')[0] || a.appointment_date}T${a.start_time || a.appointment_time || "00:00"}:00`).getTime()
          const dtB = parseISO(`${b.date?.split('T')[0] || b.appointment_date}T${b.start_time || b.appointment_time || "00:00"}:00`).getTime()
          return dtB - dtA
        })

        setAppointments(appts)
      } catch (err) {
        console.error("Failed to load commissions:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [companyId, user?.uid, selectedMonth])

  const totalCommissions = appointments.reduce((acc, curr) => acc + (curr.commission_amount || 0), 0)
  const totalServicesValue = appointments.reduce((acc, curr) => acc + (curr.service_price || 0), 0)

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl text-gray-700 hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 ml-2">Comissões</h1>
      </div>

      <div className="p-4 pb-24 space-y-6">
        
        {/* Filtro Mês - Simplificado para o mês atual por enquanto, pode ser expandido */}
        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
          <span className="font-bold text-gray-700 capitalize">{format(selectedMonth, "MMMM, yyyy", { locale: ptBR })}</span>
          <CalendarDays className="w-5 h-5 text-[var(--color-primary)]" />
        </div>

        {/* Resumo */}
        <div className="bg-[var(--color-primary)] rounded-3xl p-6 shadow-[0_15px_40px_rgba(124,92,252,0.3)] text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 opacity-90">
              <Wallet className="w-5 h-5" />
              <span className="text-sm font-medium">Total em Comissões</span>
            </div>
            <h2 className="text-4xl font-bold mb-6">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCommissions)}
            </h2>
            
            <div className="flex justify-between items-center border-t border-white/20 pt-4">
              <div>
                <p className="text-xs text-white/70">Total de Serviços</p>
                <p className="font-bold">{appointments.length}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/70">Valor Bruto Gerado</p>
                <p className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalServicesValue)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Extrato */}
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-2">Extrato do Mês</h3>

        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin" />
          </div>
        ) : appointments.length > 0 ? (
          <div className="space-y-3">
            {appointments.map((appt) => (
              <div key={appt.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 text-sm">{appt.service_name}</p>
                  <p className="text-xs text-gray-500 mt-1 capitalize">
                    {format(parseISO(appt.appointment_date || appt.date), "dd/MM", { locale: ptBR })} às {appt.appointment_time || appt.start_time}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600">
                    +{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(appt.commission_amount || 0)}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 line-through">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(appt.service_price || 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-200">
            <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-900 font-bold mb-2">Sem comissões</h3>
            <p className="text-sm text-gray-500">Nenhum serviço concluído neste período.</p>
          </div>
        )}
      </div>
    </div>
  )
}
