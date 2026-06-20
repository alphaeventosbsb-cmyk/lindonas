"use client"

import { useEffect, useState } from "react"
import { usePWATenant } from "@/components/pwa/pwa-tenant-context"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"
import { CalendarDays, Bell, MapPin, CheckCircle2, Wallet, ReceiptText, Award, ChevronRight, Calendar, User } from "lucide-react"
import Link from "next/link"
import { format, isAfter, isBefore, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"

import { PwaCard } from "@/components/pwa/ui/pwa-card"
import { PwaEmptyState } from "@/components/pwa/ui/pwa-empty-state"

export default function ClientHome() {
  const { companyId, user, slug, companyName } = usePWATenant()
  const [client, setClient] = useState<any>(null)
  const [nextAppt, setNextAppt] = useState<any>(null)
  const [pastAppts, setPastAppts] = useState<any[]>([])
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!companyId || !user?.uid) return
      
      try {
        const clients = await fetchCollectionWhere("clients", "auth_uid", "==", user.uid)
        const myClient = clients.find((c: any) => c.company_id === companyId)
        
        let resolvedClient = myClient
        if (!myClient) {
          const emailClients = await fetchCollectionWhere("clients", "google_email", "==", user.email?.toLowerCase())
          const myEmailClient = emailClients.find((c: any) => c.company_id === companyId)
          if (myEmailClient) resolvedClient = myEmailClient
        }

        setClient(resolvedClient || null)

        if (resolvedClient) {
          const db = getDb()
          
          // Load Appointments
          const apptsRef = collection(db, "appointments")
          const qAppts = query(
            apptsRef,
            where("company_id", "==", companyId),
            where("client_id", "==", resolvedClient.id)
          )
          const snapAppts = await getDocs(qAppts)
          const allAppts = snapAppts.docs.map(d => ({ id: d.id, ...d.data() }))
          
          const future = allAppts.filter((a: any) => {
            if (a.status === "cancelled") return false
            const dtStr = `${a.date?.split('T')[0] || a.appointment_date}T${a.start_time || a.appointment_time}:00`
            return isAfter(parseISO(dtStr), new Date())
          })
          
          future.sort((a: any, b: any) => {
            const dtA = parseISO(`${a.date?.split('T')[0] || a.appointment_date}T${a.start_time || a.appointment_time}:00`).getTime()
            const dtB = parseISO(`${b.date?.split('T')[0] || b.appointment_date}T${b.start_time || b.appointment_time}:00`).getTime()
            return dtA - dtB
          })

          if (future.length > 0) setNextAppt(future[0])

          const past = allAppts.filter((a: any) => {
            if (a.status === "cancelled") return false
            const dtStr = `${a.date?.split('T')[0] || a.appointment_date}T${a.start_time || a.appointment_time}:00`
            return isBefore(parseISO(dtStr), new Date())
          })

          past.sort((a: any, b: any) => {
            const dtA = parseISO(`${a.date?.split('T')[0] || a.appointment_date}T${a.start_time || a.appointment_time}:00`).getTime()
            const dtB = parseISO(`${b.date?.split('T')[0] || b.appointment_date}T${b.start_time || b.appointment_time}:00`).getTime()
            return dtB - dtA // Descending
          })

          setPastAppts(past.slice(0, 3))

          // Load Notifications
          const notifsRef = collection(db, "notifications")
          const qNotifs = query(notifsRef, where("company_id", "==", companyId), where("recipientUserId", "==", user.uid))
          const snapNotifs = await getDocs(qNotifs)
          const unreadCount = snapNotifs.docs.filter(d => !d.data().read).length
          setUnreadNotifs(unreadCount)
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
      <div className="flex-1 flex items-center justify-center p-8 min-h-[100dvh] bg-[#F7F8FC]">
        <div className="w-8 h-8 rounded-full border-4 border-[#7C5CFC] border-t-transparent animate-spin" />
      </div>
    )
  }

  const firstName = client?.name?.split(' ')[0] || user?.displayName?.split(' ')[0] || "Cliente"
  
  // Parse Next Appointment Date
  let nextDateObj = null
  if (nextAppt) {
    const dtStr = `${nextAppt.date?.split('T')[0] || nextAppt.appointment_date}T00:00:00`
    nextDateObj = parseISO(dtStr)
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#F7F8FC] pb-24 relative">
      
      {/* Top Header Background */}
      <div className="absolute top-0 left-0 right-0 h-[320px] bg-gradient-to-b from-[#2A0E63] to-[#421b9b] rounded-b-[40px] z-0" />
      
      <div className="relative z-10 px-6 pt-12">
        {/* Header Content */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full border-2 border-white/20 overflow-hidden shadow-lg bg-white/10">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-xl">
                  {firstName.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-white tracking-wide">
                Olá, {firstName}! <span className="text-purple-300">💜</span>
              </h1>
              <p className="text-[14px] text-white/80 font-medium mt-0.5">Que bom te ver por aqui!</p>
            </div>
          </div>
          
          <Link href={`/pwa/${slug}/notificacoes`} className="relative p-2 text-white hover:bg-white/10 rounded-full transition-colors">
            <Bell className="w-6 h-6" />
            {unreadNotifs > 0 && (
              <span className="absolute top-1 right-2 w-[18px] h-[18px] bg-[#FF4747] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#361681]">
                {unreadNotifs}
              </span>
            )}
          </Link>
        </div>

        {/* Hero Card */}
        <div className="bg-gradient-to-br from-[#F5F3FF] to-white rounded-[28px] p-6 shadow-[0_15px_30px_rgba(0,0,0,0.08)] relative overflow-hidden mb-8 border border-white">
          <div className="absolute right-0 top-0 bottom-0 w-1/2 overflow-hidden rounded-r-[28px]">
            <img 
              src="https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?q=80&w=600&auto=format&fit=crop" 
              alt="Model" 
              className="w-full h-full object-cover object-left opacity-90 mask-image-gradient"
              style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black 40%)' }}
            />
          </div>
          
          <div className="relative z-10 w-[60%]">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C5CFC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C8 6 4 10 4 15a8 8 0 0 0 16 0c0-5-4-9-8-13z"/>
              </svg>
            </div>
            <h2 className="text-[22px] font-bold text-[#111827] leading-[1.1] mb-2 drop-shadow-sm">
              Cuidar de você nunca foi tão fácil
            </h2>
            <p className="text-[12px] text-[#6B7280] font-medium mb-5 leading-tight">
              Agende seus serviços favoritos com praticidade e segurança.
            </p>
            <Link href={`/pwa/${slug}/cliente/agendar`} className="h-11 px-5 bg-[#5D3FD3] hover:bg-[#4A2CA8] text-white font-bold rounded-[14px] flex items-center w-max gap-2 shadow-[0_8px_16px_rgba(93,63,211,0.25)] active:scale-95 transition-all">
              <Calendar className="w-[18px] h-[18px]" />
              Agendar Agora
            </Link>
          </div>
        </div>

        {/* Próximo agendamento */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[17px] font-bold text-white">Próximo agendamento</h3>
            <Link href={`/pwa/${slug}/cliente/horarios`} className="text-[13px] font-bold text-white/90 hover:text-white flex items-center gap-1">
              Ver todos
            </Link>
          </div>

          {nextAppt && nextDateObj ? (
            <PwaCard className="p-4">
              <div className="flex gap-4">
                {/* Date Box */}
                <div className="w-[85px] bg-[#F5F3FF] rounded-[20px] flex flex-col items-center justify-center py-3 border border-[#EDE9FE] shadow-sm">
                  <span className="text-[11px] font-bold text-[#7C5CFC] uppercase tracking-wider mb-1">
                    {format(nextDateObj, "EEEE", { locale: ptBR }).split('-')[0]}
                  </span>
                  <span className="text-[32px] font-bold text-[#111827] leading-none mb-1">
                    {format(nextDateObj, "dd")}
                  </span>
                  <span className="text-[13px] font-bold text-[#6B7280] uppercase">
                    {format(nextDateObj, "MMM", { locale: ptBR })}
                  </span>
                </div>
                
                {/* Info Box */}
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[20px] font-bold text-[#5D3FD3] leading-none mb-1.5">
                        {nextAppt.start_time || nextAppt.appointment_time}
                      </p>
                      <p className="font-bold text-[#111827] text-[15px] leading-tight">
                        {nextAppt.service_name}
                      </p>
                      <p className="text-[13px] text-[#6B7280] mt-0.5">
                        com {nextAppt.employee_name}
                      </p>
                    </div>
                    
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 shadow-sm">
                        <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=100&auto=format&fit=crop" alt="Profissional" className="w-full h-full object-cover" />
                      </div>
                      <div className="bg-[#F5F3FF] px-2 py-1 rounded-full flex items-center gap-1 border border-[#EDE9FE]">
                        <span className="text-[10px] font-bold text-[#5D3FD3]">Confirmado</span>
                        <CheckCircle2 className="w-3 h-3 text-[#5D3FD3]" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-[#6B7280]">
                    <MapPin className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    {companyName || "Salão de Beleza"}
                  </div>
                </div>
              </div>
            </PwaCard>
          ) : (
            <PwaCard className="p-6 bg-white shadow-sm border border-gray-100">
              <PwaEmptyState 
                icon={CalendarDays}
                title="Sem horários futuros"
                description="Seu próximo momento de cuidado está a um clique de distância."
              />
            </PwaCard>
          )}
        </div>

        {/* Stats Row */}
        <div className="flex gap-2 mb-8">
          <PwaCard className="flex-1 p-2.5 flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-[#6B7280]">Créditos</p>
              <div className="w-6 h-6 rounded-full bg-[#ECFDF5] flex items-center justify-center flex-shrink-0">
                <Wallet className="w-3 h-3 text-[#10B981]" />
              </div>
            </div>
            <p className="text-[14px] font-bold text-[#10B981] whitespace-nowrap">R$ {(client?.credit_amount || 0).toFixed(2).replace('.', ',')}</p>
          </PwaCard>
          
          <PwaCard className="flex-1 p-2.5 flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-[#6B7280]">Débitos</p>
              <div className="w-6 h-6 rounded-full bg-[#FEF2F2] flex items-center justify-center flex-shrink-0">
                <ReceiptText className="w-3 h-3 text-[#EF4444]" />
              </div>
            </div>
            <p className="text-[14px] font-bold text-[#EF4444] whitespace-nowrap">R$ {(client?.debt_amount || 0).toFixed(2).replace('.', ',')}</p>
          </PwaCard>

          <PwaCard className="flex-1 p-2.5 flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-[#6B7280]">Visitas</p>
              <div className="w-6 h-6 rounded-full bg-[#F5F3FF] flex items-center justify-center flex-shrink-0">
                <Award className="w-3 h-3 text-[#7C5CFC]" />
              </div>
            </div>
            <p className="text-[15px] font-bold text-[#5D3FD3] whitespace-nowrap">{client?.appointment_count || 0}</p>
          </PwaCard>
        </div>

        {/* Últimos Atendimentos */}
        {pastAppts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-[17px] font-bold text-[#111827]">Últimos atendimentos</h3>
              <Link href={`/pwa/${slug}/cliente/historico`} className="text-[13px] font-bold text-[#7C5CFC] hover:underline">
                Ver todos
              </Link>
            </div>
            
            <PwaCard className="divide-y divide-gray-100">
              {pastAppts.map((appt) => {
                const dt = parseISO(`${appt.date?.split('T')[0] || appt.appointment_date}T12:00:00`)
                
                return (
                  <div key={appt.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                        <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=100&auto=format&fit=crop" alt="Prof" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-bold text-[#111827] text-[14px]">{appt.service_name}</p>
                        <p className="text-[12px] text-[#6B7280]">com {appt.employee_name}</p>
                        <p className="text-[11px] font-medium text-[#9CA3AF] mt-0.5">
                          {format(dt, "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#111827] text-[14px]">
                        R$ {((appt.price || appt.total_price) || 0).toFixed(2).replace('.', ',')}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                )
              })}
            </PwaCard>
          </div>
        )}

      </div>
    </div>
  )
}
