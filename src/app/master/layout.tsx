"use client"

import { useEffect, useState, type ReactNode } from "react"
import { getAuthInstance } from "@/lib/firebase/config"
import { onAuthStateChanged, signOut, type User } from "firebase/auth"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"
import { seedSaaSPlans, ensureMasterAdmin } from "@/lib/firebase/saas-init"
import { isSuperAdmin } from "@/lib/auth/super-admin"
import type { SaaSUser } from "@/lib/types/database"
import {
  LayoutDashboard, Building2, CreditCard, FileText, LogOut,
  Menu, X, Loader2, ChevronRight, Crown, Shield
} from "lucide-react"

const navItems = [
  { href: "/master", label: "Dashboard", icon: LayoutDashboard, desc: "Visão geral SaaS" },
  { href: "/master/empresas", label: "Empresas", icon: Building2, desc: "Gerenciar empresas" },
  { href: "/master/planos", label: "Planos", icon: CreditCard, desc: "Planos de assinatura" },
  { href: "/master/cobrancas", label: "Cobranças", icon: FileText, desc: "Pagamentos e faturas" },
]

export default function MasterLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuthInstance(), async (u) => {
      if (!u) {
        router.push("/admin/login")
        return
      }
      setUser(u)

      // Seed plans
      await seedSaaSPlans()

      if (!isSuperAdmin(u.email)) {
        router.push("/admin")
        setLoading(false)
        return
      }

      // Check/create master admin
      const role = await ensureMasterAdmin(u.uid, u.email || "", u.displayName || "")

      // Verify master admin
      const users = await fetchCollectionWhere<SaaSUser>("saas_users", "firebase_uid", "==", u.uid)
      if (role === "master_admin" || (users.length > 0 && users[0].role === "master_admin")) {
        setAuthorized(true)
      } else {
        router.push("/admin")
      }
      setLoading(false)
    })
    return () => unsub()
  }, [router])

  const handleLogout = async () => {
    await signOut(getAuthInstance())
    router.push("/admin/login")
  }

  const currentPage = navItems.find(n => pathname === n.href || (n.href !== "/master" && pathname.startsWith(n.href)))

  if (loading || !authorized) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
            <Crown className="w-7 h-7 text-white" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#0f0a1e', display: 'flex' }}>
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 40 }}
          className="lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ width: '16.5rem', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #1a1035 0%, #0f0a1e 100%)', borderRight: '1px solid rgba(245,158,11,0.15)' }}
      >
        {/* Logo */}
        <div style={{ height: '4.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0 1.25rem', flexShrink: 0 }}>
          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'linear-gradient(135deg, #f59e0b, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}>
            <Crown style={{ width: '1.125rem', height: '1.125rem', color: '#fff' }} />
          </div>
          <div>
            <span style={{ fontFamily: "var(--font-heading)", color: '#fff', fontWeight: 700, fontSize: '1rem' }}>Master Admin</span>
            <p style={{ fontSize: '0.6875rem', color: '#f59e0b' }}>SaaS Control</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden" style={{ padding: '0.375rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: '#fff' }}>
            <X style={{ width: '1rem', height: '1rem' }} />
          </button>
        </div>

        {/* User */}
        <div style={{ margin: '0 0.75rem 1rem', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8125rem', fontWeight: 700, background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
              {user.displayName?.charAt(0) || "M"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName || "Master"}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Shield style={{ width: '0.625rem', height: '0.625rem', color: '#f59e0b' }} />
                <span style={{ fontSize: '0.625rem', color: '#f59e0b', fontWeight: 700 }}>MASTER ADMIN</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0 0.5rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
            {navItems.map(item => {
              const isActive = pathname === item.href || (item.href !== "/master" && pathname.startsWith(item.href))
              return (
                <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem',
                    borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 600,
                    textDecoration: 'none', transition: 'all 0.2s',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                    background: isActive ? 'rgba(245,158,11,0.15)' : 'transparent',
                    borderLeft: isActive ? '3px solid #f59e0b' : '3px solid transparent',
                  }}>
                  <item.icon style={{ width: '1rem', height: '1rem', flexShrink: 0, color: isActive ? '#f59e0b' : 'rgba(255,255,255,0.4)' }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <ChevronRight style={{ width: '0.75rem', height: '0.75rem', opacity: isActive ? 0.8 : 0.3 }} />
                </Link>
              )
            })}
          </div>

          {/* Quick link to company admin */}
          <div style={{ margin: '1.5rem 0.25rem 0', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(124,92,252,0.08)', border: '1px solid rgba(124,92,252,0.15)' }}>
            <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}>
              <LayoutDashboard style={{ width: '0.875rem', height: '0.875rem' }} />
              Ir para Admin de Empresa
              <ChevronRight style={{ width: '0.75rem', height: '0.75rem', marginLeft: 'auto' }} />
            </Link>
          </div>
        </nav>

        {/* Logout */}
        <div style={{ padding: '0.75rem', flexShrink: 0 }}>
          <button onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', borderRadius: '0.625rem', fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <LogOut style={{ width: '1.125rem', height: '1.125rem' }} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', minWidth: 0 }}>
        <header style={{
          height: '4rem', background: '#1a1035', borderBottom: '1px solid rgba(245,158,11,0.1)',
          display: 'flex', alignItems: 'center', padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 30,
        }}>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden"
            style={{ padding: '0.5rem', borderRadius: '0.625rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', marginRight: '1rem', cursor: 'pointer', color: '#fff' }}>
            <Menu style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: '1.125rem', fontWeight: 700, color: '#fff' }}>
              {currentPage?.label || "Dashboard"}
            </h1>
            <p className="hidden sm:block" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{currentPage?.desc || "Painel de controle SaaS"}</p>
          </div>
        </header>

        <main style={{ flex: 1, padding: '1.5rem' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
