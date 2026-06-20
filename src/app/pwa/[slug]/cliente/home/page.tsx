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

export default function ClientHome() {
  const { companyId, user, slug, companyName, companyLogo } = usePWATenant()
  const [client, setClient] = useState<any>(null)
  const [nextAppt, setNextAppt] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!companyId || !user?.uid) return
      
      try {
        // Find client record by email and companyId
        const clients = await fetchCollectionWhere("clients", "auth_uid", "==", user.uid)
        const myClient = clients.find((c: any) => c.company_id === companyId)
        
        if (!myClient) {
          // Fallback if auth_uid is not set yet but google_email is
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
          // Query future appointments
          const db = getDb()
          const todayIso = new Date().toISOString()
          const apptsRef = collection(db, "appointments")
          
          // Simple query, filtering in memory for future to avoid complex index requirements initially
          const q = query(
            apptsRef,
            where("company_id", "==", companyId),
            where("client_id", "==", resolvedClient.id),
            where("status", "==", "scheduled")
          )
          
          const snap = await getDocs(q)
          const appts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          
          // Filter for future dates
          const futureAppts = appts.filter((a: any) => {
            const dt = parseISO(`${a.date.split('T')[0]}T${a.start_time}:00`)
            return isAfter(dt, new Date())
          })
          
          // Sort by nearest date
          futureAppts.sort((a: any, b: any) => {
            const dtA = parseISO(`${a.date.split('T')[0]}T${a.start_time}:00`).getTime()
            const dtB = parseISO(`${b.date.split('T')[0]}T${b.start_time}:00`).getTime()
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
        <div className="w-8 h-8 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 pb-24">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Olá, {client?.name?.split(' ')[0] || user?.displayName?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-gray-500 font-medium">Bem-vinda de volta!</p>
        </div>
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Foto" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
              <User className="w-6 h-6" />
            </div>
          )}
        </div>
      </div>

      {/* Hero Banner / Novo Agendamento */}
      <div className="bg-[var(--color-primary)] rounded-3xl p-6 shadow-[0_15px_40px_rgba(124,92,252,0.3)] text-white relative overflow-hidden mb-8">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#5d3fd3]/50 rounded-full blur-2xl -ml-10 -mb-10" />
        
        <div className="relative z-10 flex flex-col gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
            <Scissors className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold leading-tight mb-1">Cuidar de você nunca foi tão fácil</h2>
            <p className="text-sm text-white/80 font-medium mb-4">Escolha seu serviço favorito e agende em poucos cliques.</p>
          </div>
          <Link href={`/pwa/${slug}/cliente/agendar`} className="h-12 w-full bg-white text-[var(--color-primary)] font-bold rounded-xl flex items-center justify-center shadow-lg hover:bg-gray-50 active:scale-95 transition-all">
            Agendar Agora
          </Link>
        </div>
      </div>

      {/* Próximo Agendamento */}
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-between">
        Seu Próximo Horário
        <Link href={`/pwa/${slug}/cliente/horarios`} className="text-xs font-bold text-[var(--color-primary)] flex items-center gap-1">
          Ver Todos <ArrowRight className="w-3 h-3" />
        </Link>
      </h2>

      {nextAppt ? (
        <div className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-50">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 p-3 rounded-2xl">
                <CalendarDays className="w-6 h-6 text-[var(--color-primary)]" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">
                  {format(parseISO(nextAppt.date), "dd 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-sm text-gray-500 font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {nextAppt.start_time} - {nextAppt.end_time}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3 border border-gray-100">
            <div className="bg-white p-2 rounded-lg shadow-sm">
              <Scissors className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <p className="font-bold text-sm text-gray-900">{nextAppt.service_name}</p>
              <p className="text-xs text-gray-500">Com {nextAppt.employee_name}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-6 text-center border border-dashed border-gray-200">
          <p className="text-gray-500 font-medium text-sm">Nenhum agendamento futuro encontrado.</p>
        </div>
      )}
    </div>
  )
}
