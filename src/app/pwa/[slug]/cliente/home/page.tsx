"use client"

import { useEffect, useState } from "react"
import { usePWATenant } from "@/components/pwa/pwa-tenant-context"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"
import { CalendarPlus, CalendarDays, Clock, User, ArrowRight, Scissors } from "lucide-react"
import Link from "next/link"
import { format, isAfter, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore"

import { PwaHeader } from "@/components/pwa/ui/pwa-header"
import { PwaCard } from "@/components/pwa/ui/pwa-card"
import { PwaEmptyState } from "@/components/pwa/ui/pwa-empty-state"

export default function ClientHome() {
  const { companyId, user, slug, companyName, companyLogo } = usePWATenant()
  const [client, setClient] = useState<any>(null)
  const [nextAppt, setNextAppt] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!companyId || !user?.uid) return
      
      try {
        const clients = await fetchCollectionWhere("clients", "auth_uid", "==", user.uid)
        const myClient = clients.find((c: any) => c.company_id === companyId)
        
        if (!myClient) {
          const emailClients = await fetchCollectionWhere("clients", "google_email", "==", user.email?.toLowerCase())
          const myEmailClient = emailClients.find((c: any) => c.company_id === companyId)
          if (myEmailClient) {
             setClient(myEmailClient)
          }
        } else {
          setClient(myClient)
        }

        const resolvedClient = myClient || null

        if (resolvedClient) {
          const db = getDb()
          const apptsRef = collection(db, "appointments")
          
          const q = query(
            apptsRef,
            where("company_id", "==", companyId),
            where("client_id", "==", resolvedClient.id),
            where("status", "==", "scheduled")
          )
          
          const snap = await getDocs(q)
          const appts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          
          const futureAppts = appts.filter((a: any) => {
            const dt = parseISO(`${a.date?.split('T')[0] || a.appointment_date}T${a.start_time || a.appointment_time}:00`)
            return isAfter(dt, new Date())
          })
          
          futureAppts.sort((a: any, b: any) => {
            const dtA = parseISO(`${a.date?.split('T')[0] || a.appointment_date}T${a.start_time || a.appointment_time}:00`).getTime()
            const dtB = parseISO(`${b.date?.split('T')[0] || b.appointment_date}T${b.start_time || b.appointment_time}:00`).getTime()
            return dtA - dtB
          })

          if (futureAppts.length > 0) {
            setNextAppt(futureAppts[0])
          }
        }
        
      } catch (err) {
        console.error("Failed to load client home:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [companyId, user])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 mt-20">
        <div className="w-8 h-8 rounded-full border-4 border-[#7C5CFC] border-t-transparent animate-spin" />
      </div>
    )
  }

  const firstName = client?.name?.split(' ')[0] || user?.displayName?.split(' ')[0] || "Cliente"

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <PwaHeader 
        title={<>Olá, {firstName}! <span className="text-purple-300">💜</span></>}
        subtitle="Que bom te ver por aqui!"
        avatarUrl={user?.photoURL}
      />

      <div className="px-6 pt-6 pb-6 flex-1 flex flex-col gap-8 -mt-6 z-20">
        {/* Banner */}
        <div className="bg-[#7C5CFC] rounded-[28px] p-6 shadow-[0_12px_30px_rgba(124,92,252,0.3)] text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#1F1744]/20 rounded-full blur-2xl -ml-10 -mb-10" />
          
          <div className="relative z-10 flex flex-col gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <Scissors className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-[22px] font-bold leading-tight mb-1">Cuidar de você nunca foi tão fácil</h2>
              <p className="text-[14px] text-white/80 font-medium mb-4 max-w-[240px]">Escolha seu serviço favorito e agende em poucos cliques.</p>
            </div>
            <Link href={`/pwa/${slug}/cliente/agendar`} className="h-12 w-[180px] bg-white text-[#7C5CFC] font-bold rounded-[20px] flex items-center justify-center shadow-lg hover:bg-gray-50 active:scale-[0.98] transition-all">
              Agendar Agora
            </Link>
          </div>
        </div>

        {/* Próximo Agendamento */}
        <div>
          <h2 className="text-[18px] font-bold text-[#111827] mb-4 flex items-center justify-between px-1">
            Próximo agendamento
            <Link href={`/pwa/${slug}/cliente/horarios`} className="text-[13px] font-bold text-[#7C5CFC] flex items-center gap-1 hover:underline">
              Ver Todos <ArrowRight className="w-3 h-3" />
            </Link>
          </h2>

          {nextAppt ? (
            <PwaCard className="border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[13px] font-semibold text-[#6B7280]">
                  {format(parseISO(nextAppt.date || nextAppt.appointment_date), "EEEE • d 'de' MMMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
                </span>
              </div>
              
              <div className="flex justify-between items-start mb-5">
                <div>
                  <p className="font-bold text-[32px] text-[#111827] leading-none mb-2">
                    {nextAppt.start_time || nextAppt.appointment_time}
                  </p>
                  <p className="font-bold text-[16px] text-[#111827]">{nextAppt.service_name}</p>
                  <p className="text-[14px] text-[#6B7280]">com {nextAppt.employee_name}</p>
                </div>
                <div className="w-14 h-14 rounded-full bg-[#EDE9FE] overflow-hidden flex-shrink-0 flex items-center justify-center">
                   <User className="w-6 h-6 text-[#7C5CFC]" />
                </div>
              </div>
              
              <Link href={`/pwa/${slug}/cliente/horarios`} className="w-full h-12 bg-[#7C5CFC] text-white rounded-[16px] flex items-center justify-center font-bold text-[15px] active:scale-[0.98] transition-transform">
                Ver detalhes
              </Link>
            </PwaCard>
          ) : (
            <PwaCard className="bg-transparent shadow-none border-dashed border-2 border-gray-200">
              <PwaEmptyState 
                icon={CalendarDays}
                title="Nenhum agendamento"
                description="Você ainda não tem horários futuros marcados no salão."
              />
            </PwaCard>
          )}
        </div>
      </div>
    </div>
  )
}
