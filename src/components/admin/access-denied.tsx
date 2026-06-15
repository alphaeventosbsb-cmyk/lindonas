"use client"

import { ShieldOff, ArrowLeft, Home } from "lucide-react"
import { useRouter } from "next/navigation"

interface Props {
  title?: string
  description?: string
}

export function AccessDenied({
  title = "Acesso negado",
  description = "Voce nao tem permissao para acessar esta area. Fale com um administrador para solicitar acesso.",
}: Props) {
  const router = useRouter()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1.5rem', padding: '2rem' }}>
      <div style={{ width: '5rem', height: '5rem', borderRadius: '1.25rem', background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ShieldOff style={{ width: '2.5rem', height: '2.5rem', color: '#ef4444' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>{title}</h2>
        <p style={{ fontSize: '0.9375rem', color: '#6b7280', maxWidth: '24rem' }}>{description}</p>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', background: '#fff', color: '#4b5563', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
          <ArrowLeft style={{ width: '1rem', height: '1rem' }} /> Voltar
        </button>
        <button onClick={() => router.push('/admin')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '0.75rem', border: 'none', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.25)' }}>
          <Home style={{ width: '1rem', height: '1rem' }} /> Ir para inicio
        </button>
      </div>
    </div>
  )
}
