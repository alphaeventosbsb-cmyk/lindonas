"use client"

import { useEffect, useState } from "react"
import { fetchCollection } from "@/lib/firebase/client-utils"
import type { Company, SaaSPlan, SaaSPayment } from "@/lib/types/database"
import { formatCurrency } from "@/lib/utils"
import { Loader2, Building2, Crown, TrendingUp, AlertTriangle, CreditCard, Users, Ban, CheckCircle, Clock } from "lucide-react"

export default function MasterDashboardPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [plans, setPlans] = useState<SaaSPlan[]>([])
  const [payments, setPayments] = useState<SaaSPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [c, p, pay] = await Promise.all([
        fetchCollection<Company>("companies"),
        fetchCollection<SaaSPlan>("saas_plans"),
        fetchCollection<SaaSPayment>("saas_payments"),
      ])
      setCompanies(c)
      setPlans(p)
      setPayments(pay)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const activeCompanies = companies.filter(c => c.subscription_status === "active")
  const trialCompanies = companies.filter(c => c.subscription_status === "trial")
  const blockedCompanies = companies.filter(c => c.is_blocked)
  const newThisMonth = companies.filter(c => c.created_at.startsWith(thisMonth))

  const mrr = companies.reduce((sum, c) => {
    if (c.subscription_status === "active" && c.plan_id) {
      const plan = plans.find(p => p.id === c.plan_id)
      return sum + (plan?.price || 0)
    }
    return sum
  }, 0)

  const pendingPayments = payments.filter(p => p.status === "pending")
  const overduePayments = payments.filter(p => p.status === "overdue")

  const stats = [
    { label: "Total Empresas", value: companies.length, icon: Building2, gradient: "linear-gradient(135deg, #f59e0b, #f97316)", shadow: "rgba(245,158,11,0.25)" },
    { label: "Ativas", value: activeCompanies.length, icon: CheckCircle, gradient: "linear-gradient(135deg, #22c997, #5ee0b8)", shadow: "rgba(34,201,151,0.25)" },
    { label: "Trial", value: trialCompanies.length, icon: Clock, gradient: "linear-gradient(135deg, #5b8def, #93b5f5)", shadow: "rgba(91,141,239,0.25)" },
    { label: "Bloqueadas", value: blockedCompanies.length, icon: Ban, gradient: "linear-gradient(135deg, #f25c5c, #f78888)", shadow: "rgba(242,92,92,0.25)" },
    { label: "MRR", value: formatCurrency(mrr), icon: TrendingUp, gradient: "linear-gradient(135deg, #22c997, #059669)", shadow: "rgba(34,201,151,0.25)" },
    { label: "Pgtos Pendentes", value: pendingPayments.length, icon: CreditCard, gradient: "linear-gradient(135deg, #ffb547, #ffd08a)", shadow: "rgba(255,181,71,0.25)" },
    { label: "Pgtos Atrasados", value: overduePayments.length, icon: AlertTriangle, gradient: "linear-gradient(135deg, #f25c5c, #ef4444)", shadow: "rgba(242,92,92,0.25)" },
    { label: "Novas (mês)", value: newThisMonth.length, icon: Users, gradient: "linear-gradient(135deg, #a78bfa, #7c5cfc)", shadow: "rgba(124,92,252,0.25)" },
  ]

  const statusColors: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: '#ecfdf5', color: '#059669', label: 'Ativa' },
    trial: { bg: '#eff6ff', color: '#2563eb', label: 'Trial' },
    pending: { bg: '#fffbeb', color: '#d97706', label: 'Pendente' },
    overdue: { bg: '#fef2f2', color: '#ef4444', label: 'Atrasado' },
    cancelled: { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelado' },
    blocked: { bg: '#fef2f2', color: '#ef4444', label: 'Bloqueado' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1a1035 0%, #2d1f5e 50%, #f59e0b 200%)', borderRadius: '1rem', padding: '2rem', position: 'relative', overflow: 'hidden', border: '1px solid rgba(245,158,11,0.15)' }}>
        <div style={{ position: 'absolute', top: '-2rem', right: '-2rem', width: '8rem', height: '8rem', borderRadius: '50%', background: 'rgba(245,158,11,0.08)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Crown style={{ width: '1.5rem', height: '1.5rem', color: '#f59e0b' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', fontFamily: "var(--font-heading)" }}>Painel Master SaaS</h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>Gerencie todas as empresas, assinaturas e cobranças da plataforma</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1rem' }}>
        {stats.map((stat, i) => (
          <div key={i} style={{ background: '#1a1035', borderRadius: '1rem', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: stat.gradient, boxShadow: `0 4px 14px ${stat.shadow}` }}>
                <stat.icon style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{stat.label}</span>
            </div>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', fontFamily: "var(--font-heading)" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Companies */}
      <div style={{ background: '#1a1035', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', fontFamily: "var(--font-heading)" }}>Empresas Recentes</h3>
          <a href="/master/empresas" style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600, textDecoration: 'none' }}>Ver todas →</a>
        </div>
        {companies.length > 0 ? (
          <div>
            {companies.slice(0, 8).map(company => {
              const plan = plans.find(p => p.id === company.plan_id)
              const sc = statusColors[company.is_blocked ? 'blocked' : company.subscription_status] || statusColors.pending
              return (
                <div key={company.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: '0.9375rem', fontWeight: 700, flexShrink: 0 }}>
                    {company.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, color: '#fff', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company.name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                      {company.owner_name} • {plan?.name || "Sem plano"}
                    </p>
                  </div>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.5rem', borderRadius: '999px', background: sc.bg, color: sc.color }}>
                    {sc.label}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <Building2 style={{ width: '2rem', height: '2rem', color: 'rgba(255,255,255,0.2)', margin: '0 auto 0.75rem' }} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Nenhuma empresa cadastrada</p>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>As empresas aparecerão aqui após o onboarding</p>
          </div>
        )}
      </div>
    </div>
  )
}
