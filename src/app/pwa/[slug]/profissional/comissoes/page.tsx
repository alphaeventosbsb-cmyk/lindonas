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
import { isCommissionableAppointment } from "@/lib/commission-utils"

import { PwaCard } from "@/components/pwa/ui/pwa-card"
import { PwaEmptyState } from "@/components/pwa/ui/pwa-empty-state"

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
          where("employee_id", "==", currentEmp.id)
        )
        const snap = await getDocs(q)
        let appts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        
        appts = appts.filter((a: any) => {
          if (!isCommissionableAppointment(a.status)) return false;
          const dt = parseISO(a.date || a.appointment_date)
          return dt >= startOfMonth(selectedMonth) && dt <= endOfMonth(selectedMonth)
        })

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
    <div className="flex flex-col h-full bg-[#F7F8FC]">
      <div className="bg-white px-4 py-5 border-b border-gray-100 sticky top-0 z-20 shadow-sm flex items-center">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl text-[#111827] hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[18px] font-bold text-[#111827] ml-2">Comissões</h1>
      </div>

      <div className="p-5 pb-32 space-y-6">
        
        {/* Filtro Mês - Simplificado para o mês atual por enquanto, pode ser expandido */}
        <div className="flex items-center justify-between bg-white p-4 rounded-[16px] border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <span className="font-bold text-[#111827] text-[15px] capitalize">{format(selectedMonth, "MMMM, yyyy", { locale: ptBR })}</span>
          <div className="bg-[#EDE9FE] p-2 rounded-[10px]">
            <CalendarDays className="w-5 h-5 text-[#7C5CFC]" />
          </div>
        </div>

        {/* Resumo */}
        <div className="bg-gradient-to-br from-[#7C5CFC] to-[#5d3fd3] rounded-[32px] p-7 shadow-[0_15px_40px_rgba(124,92,252,0.3)] text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3 opacity-90">
              <Wallet className="w-5 h-5" />
              <span className="text-[15px] font-medium">Total em Comissões</span>
            </div>
            <h2 className="text-4xl font-bold mb-6 tracking-tight">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCommissions)}
            </h2>
            
            <div className="flex justify-between items-center border-t border-white/20 pt-5 mt-2">
              <div>
                <p className="text-[13px] text-white/70 mb-1">Total de Serviços</p>
                <p className="font-bold text-[16px]">{appointments.length}</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] text-white/70 mb-1">Valor Bruto Gerado</p>
                <p className="font-bold text-[16px]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalServicesValue)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Extrato */}
        <div className="pt-2">
          <h3 className="text-[15px] font-bold text-[#111827] ml-1 mb-4">Extrato do Mês</h3>

          {loading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 rounded-full border-4 border-[#7C5CFC] border-t-transparent animate-spin" />
            </div>
          ) : appointments.length > 0 ? (
            <div className="space-y-3">
              {appointments.map((appt) => (
                <PwaCard key={appt.id} className="p-4 flex items-center justify-between hover:border-[#7C5CFC] transition-colors">
                  <div>
                    <p className="font-bold text-[#111827] text-[15px] line-clamp-1">{appt.service_name}</p>
                    <p className="text-[13px] text-[#6B7280] mt-1 capitalize">
                      {format(parseISO(appt.appointment_date || appt.date), "dd/MM", { locale: ptBR })} às {appt.appointment_time || appt.start_time}
                    </p>
                  </div>
                  <div className="text-right pl-3 flex-shrink-0">
                    <p className="font-bold text-[#10B981] text-[15px]">
                      +{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(appt.commission_amount || 0)}
                    </p>
                    <p className="text-[12px] text-[#9CA3AF] mt-0.5 line-through">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(appt.service_price || 0)}
                    </p>
                  </div>
                </PwaCard>
              ))}
            </div>
          ) : (
            <PwaCard className="bg-transparent shadow-none border-dashed border-2 border-gray-200">
              <PwaEmptyState 
                icon={DollarSign}
                title="Sem comissões"
                description="Nenhum serviço concluído neste período."
              />
            </PwaCard>
          )}
        </div>
      </div>
    </div>
  )
}
