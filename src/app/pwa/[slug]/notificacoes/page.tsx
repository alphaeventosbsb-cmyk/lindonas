"use client"

import { useEffect, useState } from "react"
import { usePWATenant } from "@/components/pwa/pwa-tenant-context"
import { ArrowLeft, Bell, BellRing, Check, Circle } from "lucide-react"
import { getDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs, updateDoc, doc, orderBy } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import Link from "next/link"

import { PwaCard } from "@/components/pwa/ui/pwa-card"
import { PwaEmptyState } from "@/components/pwa/ui/pwa-empty-state"

export default function NotificationsPage() {
  const { companyId, user, slug } = usePWATenant()
  const router = useRouter()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    if (!companyId || !user?.uid) return
    setLoading(true)
    try {
      const db = getDb()
      const notificationsRef = collection(db, "notifications")
      const q = query(
        notificationsRef,
        where("company_id", "==", companyId),
        where("recipientUserId", "==", user.uid)
      )
      const snap = await getDocs(q)
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      notifs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      
      setNotifications(notifs)
    } catch (err) {
      console.error("Failed to load notifications:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [companyId, user?.uid])

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    try {
      const db = getDb()
      await updateDoc(doc(db, "notifications", id), { read: true, openedAt: new Date().toISOString() })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch (err) {
      toast.error("Erro ao atualizar notificação")
    }
  }

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read)
      if (unread.length === 0) return
      
      const db = getDb()
      await Promise.all(unread.map(n => updateDoc(doc(db, "notifications", n.id), { read: true, openedAt: new Date().toISOString() })))
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      toast.success("Todas marcadas como lidas")
    } catch (err) {
      toast.error("Erro ao atualizar notificações")
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#F7F8FC]">
      <div className="bg-white px-4 py-5 flex items-center justify-between border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl text-[#111827] hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-[18px] font-bold text-[#111827] ml-2">Notificações</h1>
        </div>
        {notifications.some(n => !n.read) && (
          <button onClick={markAllAsRead} className="text-[12px] font-bold text-[#7C5CFC] bg-[#EDE9FE] px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
            Marcar todas lidas
          </button>
        )}
      </div>

      <div className="p-5 pb-32 space-y-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 rounded-full border-4 border-[#7C5CFC] border-t-transparent animate-spin" />
          </div>
        ) : notifications.length > 0 ? (
          notifications.map((notif) => {
            const isUnread = !notif.read
            
            let actionUrl = notif.actionUrl
            if (!actionUrl && notif.appointmentId) {
              if (notif.recipientRole === "profissional") {
                actionUrl = `/pwa/${slug}/profissional/agenda` 
              } else {
                actionUrl = `/pwa/${slug}/cliente/horarios`
              }
            }

            return (
              <PwaCard 
                key={notif.id} 
                onClick={() => {
                  if (isUnread) markAsRead(notif.id)
                  if (actionUrl) router.push(actionUrl)
                }}
                className={`p-5 relative transition-all cursor-pointer hover:border-[#7C5CFC]/50 ${
                  isUnread ? "border-[#7C5CFC]/40 bg-[#EDE9FE]/50" : "border-gray-100 opacity-80"
                }`}
              >
                {isUnread && (
                  <div className="absolute top-5 right-5 w-2.5 h-2.5 bg-[#7C5CFC] rounded-full animate-pulse" />
                )}
                
                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center flex-shrink-0 ${isUnread ? 'bg-[#7C5CFC] text-white shadow-md' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                    {isUnread ? <BellRing className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 pr-4">
                    <p className={`text-[15px] ${isUnread ? 'font-bold text-[#111827]' : 'font-semibold text-[#6B7280]'}`}>{notif.title}</p>
                    <p className="text-[13px] text-[#6B7280] mt-1.5 line-clamp-2 leading-relaxed">{notif.body}</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-2.5 font-medium flex items-center gap-1">
                      {format(new Date(notif.createdAt), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  {actionUrl ? (
                    <span className="text-[13px] font-bold text-[#7C5CFC]">Ver Detalhes</span>
                  ) : <span />}
                  
                  {isUnread && (
                    <button 
                      onClick={(e) => markAsRead(notif.id, e)}
                      className="text-[12px] font-bold text-[#6B7280] flex items-center gap-1.5 hover:text-[#111827] transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Marcar lida
                    </button>
                  )}
                </div>
              </PwaCard>
            )
          })
        ) : (
          <PwaCard className="bg-transparent shadow-none border-dashed border-2 border-gray-200 mt-4">
            <PwaEmptyState 
              icon={Bell}
              title="Sem notificações"
              description="Você está em dia com seus avisos."
            />
          </PwaCard>
        )}
      </div>
    </div>
  )
}
