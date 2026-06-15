"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Lock, Phone, MessageCircle, Mail, AlertTriangle } from "lucide-react"

function BlockedContent() {
  const searchParams = useSearchParams()
  const reason = searchParams.get("reason") || "subscription"
  const dueDate = searchParams.get("due") || ""
  const companyName = searchParams.get("company") || ""

  const reasons: Record<string, { title: string; desc: string }> = {
    subscription: {
      title: "Assinatura Expirada",
      desc: "Sua assinatura expirou ou o pagamento não foi confirmado."
    },
    trial: {
      title: "Período de Teste Encerrado",
      desc: "Seu período de teste de 7 dias terminou. Assine um plano para continuar usando."
    },
    blocked: {
      title: "Conta Bloqueada",
      desc: "Sua conta foi bloqueada pelo administrador. Entre em contato com o suporte."
    },
    overdue: {
      title: "Pagamento em Atraso",
      desc: "Seu pagamento está em atraso. Regularize para restaurar o acesso."
    },
  }

  const r = reasons[reason] || reasons.subscription

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e1842 0%, #0f0a1e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '28rem', width: '100%', textAlign: 'center' }}>
        {/* Lock Icon */}
        <div style={{ width: '5rem', height: '5rem', borderRadius: '1.5rem', background: 'linear-gradient(135deg, #f25c5c, #ef4444)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', boxShadow: '0 12px 32px rgba(239,68,68,0.3)' }}>
          <Lock style={{ width: '2.5rem', height: '2.5rem', color: '#fff' }} />
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem', fontFamily: "var(--font-heading)" }}>
          Acesso Temporariamente Bloqueado
        </h1>

        {companyName && (
          <p style={{ fontSize: '1rem', color: '#a78bfa', fontWeight: 600, marginBottom: '0.5rem' }}>{companyName}</p>
        )}

        {/* Reason Card */}
        <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid rgba(239,68,68,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <AlertTriangle style={{ width: '1.25rem', height: '1.25rem', color: '#f59e0b' }} />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#f59e0b' }}>{r.title}</h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{r.desc}</p>
        </div>

        {/* Due Date */}
        {dueDate && (
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.25rem' }}>Data de vencimento</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>{dueDate.split("-").reverse().join("/")}</p>
          </div>
        )}

        {/* Contact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <a href="https://wa.me/5561998148986?text=Preciso de ajuda com minha assinatura"
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
              padding: '0.875rem 1.5rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700,
              textDecoration: 'none', color: '#fff', transition: 'all 0.2s',
              background: 'linear-gradient(135deg, #22c997, #128c7e)', boxShadow: '0 4px 14px rgba(34,201,151,0.3)',
            }}>
            <MessageCircle style={{ width: '1.25rem', height: '1.25rem' }} />
            Falar com Suporte via WhatsApp
          </a>

          <a href="mailto:suporte@agendaonline.com"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
              padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 600,
              textDecoration: 'none', color: 'rgba(255,255,255,0.6)', transition: 'all 0.2s',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            }}>
            <Mail style={{ width: '1rem', height: '1rem' }} />
            Contato por Email
          </a>
        </div>

        <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
          Seu acesso será restaurado automaticamente após a confirmação do pagamento.
        </p>
      </div>
    </div>
  )
}

export default function BlockedPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f0a1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Lock style={{ width: '2rem', height: '2rem', color: '#ef4444' }} />
      </div>
    }>
      <BlockedContent />
    </Suspense>
  )
}
