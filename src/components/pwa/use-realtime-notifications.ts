"use client"

import { useEffect, useState, useRef } from "react"
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore"
import { getDb } from "@/lib/firebase/config"
import { usePWATenant } from "./pwa-tenant-context"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function useRealtimeNotifications() {
  const { companyId, user, slug } = usePWATenant()
  const [unreadCount, setUnreadCount] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const router = useRouter()
  
  // Track already notified IDs to prevent duplicate toasts on re-renders
  const notifiedIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Only init audio client side
    audioRef.current = new Audio("/sounds/notification.mp3")
  }, [])

  useEffect(() => {
    if (!companyId || !user?.uid) return

    const db = getDb()
    const notificationsRef = collection(db, "notifications")
    
    // Listen for unread notifications for this exact tenant and user
    const q = query(
      notificationsRef,
      where("company_id", "==", companyId),
      where("recipientUserId", "==", user.uid),
      where("read", "==", false)
      // Note: Needs composite index if ordered by createdAt. 
      // We will skip orderBy here and handle sorting in memory if needed to avoid forcing index creation initially.
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.docs.length)

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data()
          const id = change.doc.id

          if (!notifiedIds.current.has(id)) {
            notifiedIds.current.add(id)

            // Tocar som se a preferência estiver ativa e for possível (interação com DOM)
            const soundEnabled = localStorage.getItem("pwa_sound_enabled") === "true"
            if (soundEnabled && audioRef.current) {
              audioRef.current.play().catch(e => console.log("Autoplay blocked for notification sound", e))
            }

            // Exibir Toast (Popup)
            let actionUrl = data.actionUrl
            if (!actionUrl && data.appointmentId) {
              if (data.recipientRole === "profissional") {
                actionUrl = `/pwa/${slug}/profissional/agenda` // Temporário: poderia ser /agenda/[id] futuramente
              } else {
                actionUrl = `/pwa/${slug}/cliente/horarios`
              }
            }

            toast.message(data.title, {
              description: data.body,
              duration: 8000,
              action: actionUrl ? {
                label: data.recipientRole === "profissional" ? "Ver agendamento" : "Meus Horários",
                onClick: () => router.push(actionUrl)
              } : undefined,
              icon: "🔔"
            })
          }
        }
      })
    }, (error) => {
      console.error("Erro no listener de notificações:", error)
    })

    return () => unsubscribe()
  }, [companyId, user?.uid, router])

  return { unreadCount }
}
