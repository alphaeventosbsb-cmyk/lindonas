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

export default function ProfessionalHome() {
  const { companyId, user, slug, companyName, companyLogo } = usePWATenant()
  const [employee, setEmployee] = useState<any>(null)
  const [todayAppointments, setTodayAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!companyId || !user?.uid) return
      
      try {
        // Find employee ID
        const emps = await fetchCollectionWhere("employees", "auth_uid", "==", user.uid)
        const myEmp = emps.find((e: any) => e.company_id === companyId)
        if (!myEmp) return
        
        setEmployee(myEmp)

        // Query today's appointments for this employee
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
        
        // Sort by time
        appts.sort((a: any, b: any) => a.start_time.localeCompare(b.start_time))
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
        <div className="w-8 h-8 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin" />
      </div>
    )
  }

  const nextAppt = todayAppointments.find(a => 
    a.status === "scheduled" && isAfter(parseISO(`${a.date.split('T')[0]}T${a.start_time}:00`), new Date())
  )

  const completedAppts = todayAppointments.filter(a => a.status === "completed")
  const totalCommissions = completedAppts.reduce((acc, curr) => acc + (curr.commission_amount || 0), 0)

  return (
    <div className="p-6 pb-24">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Olá, {employee?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-gray-500 font-medium">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
        </div>
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm">
          {companyLogo ? (
            <img src={companyLogo} alt={companyName || "Logo"} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[var(--color-primary)] flex items-center justify-center text-white font-bold">
              {companyName?.charAt(0) || "P"}
            </div>
          )}
        </div>
      </div>

      {/* Resumo do Dia */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-4 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-50">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-[var(--color-primary)] flex items-center justify-center mb-3">
            <CalendarDays className="w-5 h-5" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{todayAppointments.length}</h3>
          <p className="text-xs text-gray-500 font-medium mt-1">Atendimentos hoje</p>
        </div>
        
        <div className="bg-white p-4 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-50">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <DollarSign className="w-5 h-5" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCommissions)}
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-1">Em comissões hoje</p>
        </div>
      </div>

      {/* Próximo Atendimento */}
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-between">
        Próximo Atendimento
        <Link href={`/pwa/${slug}/profissional/agenda`} className="text-xs font-bold text-[var(--color-primary)] flex items-center gap-1">
          Ver Agenda <ArrowRight className="w-3 h-3" />
        </Link>
      </h2>

      {nextAppt ? (
        <div className="bg-[var(--color-primary)] rounded-2xl p-5 shadow-[0_10px_30px_rgba(124,92,252,0.25)] text-white relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-white/80 font-medium">Horário</p>
                <p className="font-bold text-lg">{nextAppt.start_time} - {nextAppt.end_time}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 rounded-xl p-3 flex items-center gap-3 relative z-10 backdrop-blur-sm border border-white/10">
            <div className="bg-white/20 p-2 rounded-full">
              <User className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-sm">{nextAppt.client_name}</p>
              <p className="text-xs text-white/70 truncate max-w-[200px]">{nextAppt.service_name}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-6 text-center border border-dashed border-gray-200">
          <p className="text-gray-500 font-medium text-sm">Nenhum atendimento agendado para as próximas horas hoje.</p>
        </div>
      )}

      {/* Ações Rápidas */}
      <h2 className="text-lg font-bold text-gray-900 mb-4 mt-8">Ações Rápidas</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link href={`/pwa/${slug}/profissional/agenda`} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center gap-2 hover:bg-gray-50 active:scale-95 transition-all">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-gray-700">Ver Agenda</span>
        </Link>
        <Link href={`/pwa/${slug}/profissional/comissoes`} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center gap-2 hover:bg-gray-50 active:scale-95 transition-all">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-gray-700">Comissões</span>
        </Link>
      </div>
    </div>
  )
}
