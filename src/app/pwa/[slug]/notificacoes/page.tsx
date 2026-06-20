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
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl text-gray-700 hover:bg-gray-100">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 ml-2">Notificações</h1>
        </div>
        {notifications.some(n => !n.read) && (
          <button onClick={markAllAsRead} className="text-xs font-bold text-[var(--color-primary)] bg-purple-50 px-3 py-1.5 rounded-lg">
            Marcar todas lidas
          </button>
        )}
      </div>

      <div className="p-4 pb-24 space-y-3">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin" />
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
              <div 
                key={notif.id} 
                onClick={() => {
                  if (isUnread) markAsRead(notif.id)
                  if (actionUrl) router.push(actionUrl)
                }}
                className={`bg-white rounded-2xl p-4 shadow-sm border relative transition-all cursor-pointer ${
                  isUnread ? "border-[var(--color-primary)]/40 bg-purple-50/30" : "border-gray-100 opacity-80"
                }`}
              >
                {isUnread && (
                  <div className="absolute top-4 right-4 w-2 h-2 bg-[var(--color-primary)] rounded-full animate-pulse" />
                )}
                
                <div className="flex gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isUnread ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {isUnread ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 pr-6">
                    <p className={`text-sm ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>{notif.title}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notif.body}</p>
                    <p className="text-[10px] text-gray-400 mt-2 font-medium">
                      {format(new Date(notif.createdAt), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                  {actionUrl ? (
                    <span className="text-xs font-bold text-[var(--color-primary)]">Ver Detalhes</span>
                  ) : <span />}
                  
                  {isUnread && (
                    <button 
                      onClick={(e) => markAsRead(notif.id, e)}
                      className="text-[10px] font-bold text-gray-400 flex items-center gap-1 hover:text-gray-600"
                    >
                      <Check className="w-3 h-3" /> Marcar lida
                    </button>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-200 mt-10">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-900 font-bold mb-2">Sem notificações</h3>
            <p className="text-sm text-gray-500">Você está em dia com seus avisos.</p>
          </div>
        )}
      </div>
    </div>
  )
}
