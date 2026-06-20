"use client"

import { useRealtimeNotifications } from "./use-realtime-notifications"
import { usePWATenant } from "./pwa-tenant-context"

export function PWAWrapper({ children }: { children: React.ReactNode }) {
  // This calls the hook and keeps the listener alive as long as PWAWrapper is mounted
  const { unreadCount } = useRealtimeNotifications()
  const { loading } = usePWATenant()

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="w-8 h-8 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <>
      {children}
      
      {/* We could pass unreadCount to a Context or global state if BottomNav needs it, 
          or BottomNav can just call the hook itself. For simplicity, we just mount the hook here. */}
    </>
  )
}
