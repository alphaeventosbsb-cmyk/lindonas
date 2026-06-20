"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, CalendarPlus, CalendarDays, Clock, User, Bell, DollarSign, ListOrdered } from "lucide-react"
import { usePWATenant } from "@/components/pwa/pwa-tenant-context"
import { useRealtimeNotifications } from "@/components/pwa/use-realtime-notifications"

interface NavItem {
  label: string
  href: string
  icon: any
}

const getClientNav = (unreadCount: number, slug: string): (NavItem & { badge?: number })[] => [
  { label: "Início", href: `/pwa/${slug}/cliente/home`, icon: Home },
  { label: "Agendar", href: `/pwa/${slug}/cliente/agendar`, icon: CalendarPlus },
  { label: "Horários", href: `/pwa/${slug}/cliente/horarios`, icon: CalendarDays },
  { label: "Avisos", href: `/pwa/${slug}/notificacoes`, icon: Bell, badge: unreadCount },
  { label: "Perfil", href: `/pwa/${slug}/cliente/perfil`, icon: User },
]

const getProfessionalNav = (unreadCount: number, slug: string): (NavItem & { badge?: number })[] => [
  { label: "Início", href: `/pwa/${slug}/profissional/home`, icon: Home },
  { label: "Agenda", href: `/pwa/${slug}/profissional/agenda`, icon: CalendarDays },
  { label: "Comissões", href: `/pwa/${slug}/profissional/comissoes`, icon: DollarSign },
  { label: "Avisos", href: `/pwa/${slug}/notificacoes`, icon: Bell, badge: unreadCount },
  { label: "Perfil", href: `/pwa/${slug}/profissional/perfil`, icon: User },
]

export function PWABottomNav({ type }: { type: "cliente" | "profissional" }) {
  const pathname = usePathname()
  const { slug } = usePWATenant()
  const { unreadCount } = useRealtimeNotifications()
  
  const items = type === "cliente" ? getClientNav(unreadCount, slug || "") : getProfessionalNav(unreadCount, slug || "")

  if (!slug) return null

  return (
    <nav className="fixed bottom-0 w-full max-w-[430px] bg-white border-t border-gray-100 px-2 py-2 flex items-center justify-around z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] pb-[env(safe-area-inset-bottom,16px)]">
      {items.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon
        
        return (
          <Link 
            key={item.href} 
            href={item.href}
            className="flex flex-col items-center justify-center w-16 gap-1 relative py-1"
          >
            {isActive && (
              <span className="absolute -top-3 w-8 h-1 bg-[#7C5CFC] rounded-b-full transition-all duration-300" />
            )}
            <div className="relative">
              <Icon 
                strokeWidth={isActive ? 2.5 : 2} 
                className={`w-[22px] h-[22px] transition-all duration-300 ${isActive ? 'text-[#7C5CFC] scale-110' : 'text-gray-400'}`} 
              />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] font-medium transition-colors mt-0.5 ${isActive ? 'text-[#7C5CFC]' : 'text-gray-400'}`}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
