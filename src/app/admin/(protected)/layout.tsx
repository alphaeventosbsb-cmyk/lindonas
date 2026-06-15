"use client"

import { useEffect, useState, type ReactNode } from "react"
import { getAuthInstance } from "@/lib/firebase/config"
import { fetchCollection } from "@/lib/firebase/client-utils"
import type { BusinessSettings } from "@/lib/types/database"
import { onAuthStateChanged, signOut, type User } from "firebase/auth"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import {
  Calendar, LayoutDashboard, Scissors, Users, CalendarDays,
  Settings, LogOut, Menu, X, Loader2, ChevronRight, Bell,
  UserCheck, DollarSign, Landmark, CreditCard, BarChart3,
  FileText, Shield, ChevronDown, ChevronsLeft, ChevronsRight,
  Wallet, AlertCircle, Trophy, Package, History
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { TenantProvider, useTenant } from "@/lib/auth/tenant-context"

import { AccessDenied } from "@/components/admin/access-denied"

// Permission key mapping for each route - null means always visible
type NavItem = { href: string; label: string; icon: LucideIcon; desc: string; rbacKeys?: string[]; ownerOnly?: boolean }

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Principal",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, desc: "Visão geral", rbacKeys: ["agenda.view", "clients.view", "finance.view"] },
      { href: "/admin/agendamentos", label: "Agendamentos", icon: CalendarDays, desc: "Gerenciar agenda", rbacKeys: ["agenda.view", "agenda.view_own"] },
      { href: "/admin/agendamentos/historico", label: "Histórico", icon: History, desc: "Auditoria e logs", rbacKeys: ["appointments.history.view", "rbac.manage"] },
    ]
  },
  {
    label: "Cadastros",
    items: [
      { href: "/admin/servicos", label: "Serviços", icon: Scissors, desc: "Catálogo", rbacKeys: ["services.view"] },
      { href: "/admin/profissionais", label: "Profissionais", icon: Users, desc: "Equipe", rbacKeys: ["professionals.view"] },
      { href: "/admin/profissionais/perfis", label: "Perfis de Profissionais", icon: Shield, desc: "Perfis de acesso", rbacKeys: ["rbac.profiles.manage", "rbac.manage"] },
      { href: "/admin/estoque", label: "Estoque", icon: Package, desc: "Produtos e Inventário", rbacKeys: ["inventory.view", "products.view"] },
    ]
  },
  {
    label: "Clientes",
    items: [
      { href: "/admin/clientes", label: "Todos os Clientes", icon: UserCheck, desc: "Base de clientes", rbacKeys: ["clients.view"] },
      { href: "/admin/clientes/credito", label: "Crédito do Cliente", icon: Wallet, desc: "Saldos positivos", rbacKeys: ["clients.view"] },
      { href: "/admin/clientes/debito", label: "Clientes em Débito", icon: AlertCircle, desc: "Saldos devedores", rbacKeys: ["clients.view"] },
      { href: "/admin/clientes/ranking", label: "Ranking de Clientes", icon: Trophy, desc: "Top clientes", rbacKeys: ["reports.clients_ranking", "clients.ranking"] },
    ]
  },
  {
    label: "Financeiro",
    items: [
      { href: "/admin/financeiro", label: "Financeiro", icon: DollarSign, desc: "Fluxo de caixa", rbacKeys: ["finance.view"] },
      { href: "/admin/caixa", label: "Caixa", icon: Landmark, desc: "Abertura e fechamento", rbacKeys: ["cash.view"] },
      { href: "/admin/pagamentos", label: "Comissões", icon: CreditCard, desc: "Pagamento profissionais", rbacKeys: ["commissions.view", "commissions.view_own"] },
    ]
  },
  {
    label: "Relatórios",
    items: [
      { href: "/admin/relatorios", label: "Relatórios", icon: BarChart3, desc: "Análises avançadas", rbacKeys: ["reports.view"] },
      { href: "/admin/notas-fiscais", label: "Notas Fiscais", icon: FileText, desc: "Emissão e controle", rbacKeys: ["invoices.view"] },
    ]
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/configuracoes", label: "Configurações", icon: Settings, desc: "Preferências", rbacKeys: ["settings.view"] },
    ]
  },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <TenantProvider>
      <AdminShell>{children}</AdminShell>
    </TenantProvider>
  )
}

function AdminShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [biz, setBiz] = useState<{ name: string; phone: string; logo: string | null }>({ name: 'Agenda Online', phone: '', logo: null })
  const router = useRouter()
  const pathname = usePathname()
  const {
    loading: tenantLoading,
    isSuperAdmin,
    isProfessional,
    rbacPermissions,
    employee: tenantEmployee,
    isOwner,
  } = useTenant()

  const hasFullAccess = isSuperAdmin || isOwner
  const isAccessDisabled = !hasFullAccess && isProfessional && tenantEmployee && tenantEmployee.access_enabled === false
  const hasNoPanelPermissions = !hasFullAccess && isProfessional && tenantEmployee && tenantEmployee.access_enabled !== false && rbacPermissions.length === 0

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuthInstance(), (u) => {
      if (!u) {
        router.push("/admin/login")
      } else {
        setUser(u)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [router])

  useEffect(() => {
    fetchCollection<BusinessSettings>('settings').then(s => {
      if (s.length > 0) {
        const cfg = s[0]
        setBiz({ name: cfg.business_name || 'Agenda Online', phone: cfg.whatsapp || cfg.phone || '', logo: cfg.logo_url || null })
      }
    })
  }, [])

  const handleLogout = async () => {
    await signOut(getAuthInstance())
    router.push("/admin/login")
  }

  const toggleSection = (label: string) => {
    setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }))
  }

  // RBAC: filter nav items based on professional permissions
  const filterItem = (item: NavItem): boolean => {
    if (hasFullAccess) return true
    if (item.ownerOnly) return false // Explicitly owner only (if still used)
    if (item.rbacKeys && item.rbacKeys.length > 0) {
      return item.rbacKeys.some(k => rbacPermissions.includes(k))
    }
    return true
  }

  const filteredSections = navSections
    .map(s => ({ ...s, items: s.items.filter(filterItem) }))
    .filter(s => s.items.length > 0)

  const allFilteredItems = filteredSections.flatMap(s => s.items)
  const currentPage = allFilteredItems.find(n => pathname === n.href || (n.href !== "/admin" && n.href !== "/admin/clientes" && pathname.startsWith(n.href)))
  const dashboardAllowed = hasFullAccess || allFilteredItems.some(item => item.href === "/admin")
  const firstAllowedHref = allFilteredItems.find(item => item.href !== "/admin")?.href || null
  const shouldRedirectAdminRoot = !hasFullAccess && pathname === "/admin" && !dashboardAllowed && !!firstAllowedHref

  // Block access to unauthorized routes for professionals
  const isRouteAllowed = hasFullAccess || allFilteredItems.some(
    item => pathname === item.href || (item.href !== "/admin" && item.href !== "/admin/clientes" && pathname.startsWith(item.href))
  )

  useEffect(() => {
    if (!loading && !tenantLoading && user && shouldRedirectAdminRoot && firstAllowedHref) {
      router.replace(firstAllowedHref)
    }
  }, [firstAllowedHref, loading, router, shouldRedirectAdminRoot, tenantLoading, user])

  const sidebarWidth = collapsed ? '4.5rem' : '16.5rem'

  if (loading || tenantLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f6fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #573fa4, #a78bfa)' }}>
            <Calendar className="w-7 h-7 text-white" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-[#7c5cfc]" />
        </div>
      </div>
    )
  }

  if (!user) return null

  if (shouldRedirectAdminRoot) {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f6fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="w-6 h-6 animate-spin text-[#7c5cfc]" />
      </div>
    )
  }

  // If access is explicitly disabled
  if (isAccessDisabled) {
    return (
      <div style={{ paddingTop: '2rem', minHeight: '100vh', background: '#f4f6fb' }}>
        <AccessDenied description="Seu acesso ao painel está desativado." />
      </div>
    )
  }

  if (hasNoPanelPermissions) {
    return (
      <div style={{ paddingTop: '2rem', minHeight: '100vh', background: '#f4f6fb' }}>
        <AccessDenied description="Você não possui permissões liberadas para acessar o painel." />
      </div>
    )
  }

  // If route is blocked by RBAC, show AccessDenied instead of children
  const pageContent = isRouteAllowed ? children : (
    <div style={{ paddingTop: '2rem' }}>
      <AccessDenied description="Você não possui permissão para acessar esta área." />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6fb', display: 'flex' }}>
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 40 }}
          className="lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 transform transition-all duration-300 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ width: sidebarWidth, height: '100vh', top: 0, display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #2a2150 0%, #1e1842 100%)', transition: 'width 0.3s ease, transform 0.3s ease' }}
      >
        {/* Business header */}
        {!collapsed ? (
          <div style={{ height: '4.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0 1.25rem', flexShrink: 0 }}>
            {biz.logo ? (
              <img src={biz.logo} alt={biz.name} style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }} />
            ) : (
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9375rem', fontWeight: 700, background: 'linear-gradient(135deg, #7c5cfc, #22c997)', flexShrink: 0, boxShadow: '0 4px 12px rgba(124,92,252,0.3)' }}>
                {biz.name.charAt(0)}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: "var(--font-heading)", fontSize: '0.9375rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{biz.name}</p>
              <p style={{ fontSize: '0.6875rem', color: '#c4bce8' }}>Painel Administrativo</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden" style={{ padding: '0.375rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: '#fff' }}>
              <X style={{ width: '1rem', height: '1rem' }} />
            </button>
          </div>
        ) : (
          <div style={{ height: '4.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {biz.logo ? (
              <img src={biz.logo} alt={biz.name} title={biz.name} style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9375rem', fontWeight: 700, background: 'linear-gradient(135deg, #7c5cfc, #22c997)' }}>
                {biz.name.charAt(0)}
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="sidebar-nav" style={{ flex: 1, padding: collapsed ? '0 0.375rem' : '0 0.5rem', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
          {filteredSections.map((section) => (
            <div key={section.label} style={{ marginBottom: '0.5rem' }}>
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.label)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: '0.6875rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
                    letterSpacing: '0.15em', padding: '0.375rem 0.75rem', marginBottom: '0.25rem',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                  }}
                >
                  <span>{section.label}</span>
                  <ChevronDown style={{
                    width: '0.75rem', height: '0.75rem', transition: 'transform 0.2s',
                    transform: collapsedSections[section.label] ? 'rotate(-90deg)' : 'rotate(0)',
                  }} />
                </button>
              )}
              {(collapsed || !collapsedSections[section.label]) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                  {section.items.map(item => {
                    const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                        title={collapsed ? item.label : undefined}
                        style={{
                          display: 'flex', alignItems: 'center', gap: collapsed ? 0 : '0.75rem',
                          padding: collapsed ? '0.625rem' : '0.5rem 0.75rem',
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 600,
                          textDecoration: 'none', transition: 'all 0.2s',
                          color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                          background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                          borderLeft: collapsed ? 'none' : (isActive ? '3px solid #7c5cfc' : '3px solid transparent'),
                        }}>
                        <item.icon style={{ width: '1.125rem', height: '1.125rem', flexShrink: 0, opacity: isActive ? 1 : 0.6 }} />
                        {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                        {!collapsed && <ChevronRight style={{ width: '0.75rem', height: '0.75rem', opacity: isActive ? 0.8 : 0.3 }} />}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="hidden lg:block" style={{ padding: '0.5rem', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => setCollapsed(c => !c)}
            title={collapsed ? "Expandir menu" : "Retrair menu"}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: collapsed ? 0 : '0.5rem', padding: '0.5rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'all 0.2s' }}>
            {collapsed ? <ChevronsRight style={{ width: '1rem', height: '1rem' }} /> : <><ChevronsLeft style={{ width: '1rem', height: '1rem' }} /><span>Retrair</span></>}
          </button>
        </div>

        {/* Logout */}
        <div style={{ padding: '0.5rem', flexShrink: 0 }}>
          <button onClick={handleLogout}
            title={collapsed ? "Sair" : undefined}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : '0.75rem', padding: '0.625rem 0.75rem', borderRadius: '0.625rem', fontSize: '0.875rem', fontWeight: 500, color: '#c4bce8', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
            <LogOut style={{ width: '1.125rem', height: '1.125rem' }} />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', minWidth: 0, marginLeft: sidebarWidth, transition: 'margin-left 0.3s ease' }} className="max-lg:!ml-0">
        {/* Top Bar */}
        <header 
          className={pathname?.startsWith('/admin/agendamentos') ? "flex lg:hidden" : "flex"}
          style={{
            height: '4rem', background: '#fff', borderBottom: '1px solid #e8ecf4',
            alignItems: 'center', padding: '0 1.5rem',
            position: 'sticky', top: 0, zIndex: 30,
          }}
        >
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden"
              style={{ padding: '0.5rem', borderRadius: '0.625rem', background: '#fff', border: '1px solid #e8ecf4', marginRight: '1rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Menu style={{ width: '1.25rem', height: '1.25rem', color: '#1e1e2d' }} />
            </button>

            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: "var(--font-heading)", fontSize: '1.125rem', fontWeight: 700, color: '#1e1e2d' }}>
                {currentPage?.label || "Dashboard"}
              </h1>
              <p className="hidden sm:block" style={{ fontSize: '0.75rem', color: '#8b8fa7' }}>{currentPage?.desc || "Visão geral do sistema"}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {isProfessional && (
                <span style={{
                  padding: '0.25rem 0.625rem', borderRadius: '999px', fontSize: '0.625rem', fontWeight: 700,
                  background: '#f0ecff', color: '#7c5cfc', border: '1px solid #e0d4ff',
                }}>
                  PROFISSIONAL
                </span>
              )}
              {isOwner && (
                <span style={{
                  padding: '0.25rem 0.625rem', borderRadius: '999px', fontSize: '0.625rem', fontWeight: 700,
                  background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0',
                }}>
                  GESTOR / DONO
                </span>
              )}
              <button style={{ padding: '0.5rem', borderRadius: '0.625rem', background: '#fff', border: '1px solid #e8ecf4', cursor: 'pointer', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <Bell style={{ width: '1.125rem', height: '1.125rem', color: '#8b8fa7' }} />
              </button>
              <div className="hidden sm:flex" style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8125rem', fontWeight: 700, background: 'linear-gradient(135deg, #7c5cfc, #22c997)', boxShadow: '0 2px 8px rgba(124,92,252,0.25)' }}>
                {user.displayName?.charAt(0) || "A"}
              </div>
            </div>
          </header>

        {/* Page Content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: pathname?.startsWith('/admin/agendamentos') ? '0' : '1.5rem' }}>
          {pageContent}
        </main>
      </div>
    </div>
  )
}
