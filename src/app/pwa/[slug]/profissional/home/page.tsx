"use client"

import { useEffect, useState } from "react"
import { usePWATenant } from "@/components/pwa/pwa-tenant-context"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"
import { CalendarDays, DollarSign, Clock, User, ArrowRight } from "lucide-react"
import Link from "next/link"
import { format, startOfDay, endOfDay, isAfter, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getAuthInstance } from "@/lib/firebase/config"
import { getDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"

import { PwaHeader } from "@/components/pwa/ui/pwa-header"
import { PwaCard } from "@/components/pwa/ui/pwa-card"
import { PwaStatCard } from "@/components/pwa/ui/pwa-stat-card"
import { PwaEmptyState } from "@/components/pwa/ui/pwa-empty-state"

export default function ProfessionalHome() {
  const { companyId, user, slug, companyName, companyLogo } = usePWATenant()
  const [employee, setEmployee] = useState<any>(null)
  const [todayAppointments, setTodayAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!companyId || !user?.uid) return
      
      try {
        const emps = await fetchCollectionWhere("employees", "auth_uid", "==", user.uid)
        const myEmp = emps.find((e: any) => e.company_id === companyId)
        if (!myEmp) return
        
        setEmployee(myEmp)

        const db = getDb()
        const todayStart = startOfDay(new Date()).toISOString()
        const todayEnd = endOfDay(new Date()).toISOString()

        const apptsRef = collection(db, "appointments")
        const q = query(
          apptsRef,
          where("company_id", "==", companyId),
          where("employee_id", "==", myEmp.id),
          where("date", ">=", todayStart),
          where("date", "<=", todayEnd)
        )
        const snap = await getDocs(q)
        const appts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        
        appts.sort((a: any, b: any) => (a.start_time || a.appointment_time || "").localeCompare(b.start_time || b.appointment_time || ""))
        setTodayAppointments(appts)
        
      } catch (err) {
        console.error("Failed to load professional home:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [companyId, user?.uid])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 mt-20">
        <div className="w-8 h-8 rounded-full border-4 border-[#7C5CFC] border-t-transparent animate-spin" />
      </div>
    )
  }

  const nextAppt = todayAppointments.find(a => 
    (a.status === "scheduled" || a.status === "pending" || a.status === "confirmed") && isAfter(parseISO(`${a.date?.split('T')[0] || a.appointment_date}T${a.start_time || a.appointment_time}:00`), new Date())
  )

  const completedAppts = todayAppointments.filter(a => a.status === "completed")
  const totalCommissions = completedAppts.reduce((acc, curr) => acc + (curr.commission_amount || 0), 0)

  const firstName = employee?.name?.split(' ')[0] || user?.displayName?.split(' ')[0] || "Profissional"

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#F7F8FC]">
      <PwaHeader 
        title={<>Olá, {firstName}! <span className="text-purple-300">👋</span></>}
        subtitle={format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
        avatarUrl={user?.photoURL}
      />

      <div className="px-6 pt-6 pb-24 flex-1 flex flex-col gap-8 -mt-6 z-20">
        <div className="grid grid-cols-2 gap-4">
          <PwaStatCard 
            title="Atendimentos hoje"
            value={todayAppointments.length}
            icon={CalendarDays}
            colorClass="text-[#7C5CFC]"
            bgClass="bg-[#EDE9FE]"
          />
          <PwaStatCard 
            title="Em comissões hoje"
            value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCommissions)}
            icon={DollarSign}
            colorClass="text-[#10B981]"
            bgClass="bg-[#10B981]/10"
          />
        </div>

        <div>
          <h2 className="text-[18px] font-bold text-[#111827] mb-4 flex items-center justify-between px-1">
            Próximo Atendimento
            <Link href={`/pwa/${slug}/profissional/agenda`} className="text-[13px] font-bold text-[#7C5CFC] flex items-center gap-1 hover:underline">
              Ver Agenda <ArrowRight className="w-3 h-3" />
            </Link>
          </h2>

          {nextAppt ? (
            <div className="bg-[#7C5CFC] rounded-[24px] p-6 shadow-[0_12px_30px_rgba(124,92,252,0.3)] text-white relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              
              <div className="flex justify-between items-start mb-5 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-[14px] text-white/80 font-medium mb-0.5">Horário</p>
                    <p className="font-bold text-[22px] leading-none">{nextAppt.start_time || nextAppt.appointment_time}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/10 rounded-[16px] p-3.5 flex items-center gap-3.5 relative z-10 backdrop-blur-md border border-white/10">
                <div className="bg-white/20 p-2.5 rounded-full flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[15px] truncate">{nextAppt.client_name || "Cliente"}</p>
                  <p className="text-[13px] text-white/80 truncate mt-0.5">{nextAppt.service_name}</p>
                </div>
              </div>
            </div>
          ) : (
            <PwaCard className="bg-transparent shadow-none border-dashed border-2 border-gray-200">
              <PwaEmptyState 
                icon={CalendarDays}
                title="Agenda livre"
                description="Nenhum atendimento agendado para as próximas horas hoje."
              />
            </PwaCard>
          )}
        </div>

        <div>
          <h2 className="text-[18px] font-bold text-[#111827] mb-4 px-1">Ações Rápidas</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link href={`/pwa/${slug}/profissional/agenda`} className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center gap-3 hover:border-[#7C5CFC] active:scale-[0.98] transition-all">
              <div className="w-12 h-12 rounded-full bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center">
                <CalendarDays className="w-6 h-6" />
              </div>
              <span className="text-[14px] font-bold text-[#111827]">Ver Agenda</span>
            </Link>
            <Link href={`/pwa/${slug}/profissional/comissoes`} className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center gap-3 hover:border-[#7C5CFC] active:scale-[0.98] transition-all">
              <div className="w-12 h-12 rounded-full bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
              <span className="text-[14px] font-bold text-[#111827]">Comissões</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
