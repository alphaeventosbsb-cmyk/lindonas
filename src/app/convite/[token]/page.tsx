"use client"

import { useEffect, useState, use } from "react"
import { getAuthInstance, googleProvider } from "@/lib/firebase/config"
import { signInWithPopup } from "firebase/auth"
import { Calendar, Loader2, CheckCircle, XCircle, Clock, ArrowRight, Shield } from "lucide-react"

type InviteState = "loading" | "valid" | "expired" | "revoked" | "used" | "success" | "error" | "not_found" | "unauthorized"

interface InviteData {
  employee_id: string
  employee_name: string
  employee_email: string | null
  company_id: string
  company_name: string
  status: string
}

export default function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [state, setState] = useState<InviteState>("loading")
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    validateToken()
  }, [token])

  const validateToken = async () => {
    setState("loading")
    try {
      const response = await fetch(`/api/invites/${token}`)
      const data = await response.json()

      if (!response.ok) {
        setErrorMsg(data.error || "Erro ao validar convite.")
        if (response.status === 404) setState("not_found")
        else if (data.used) setState("used")
        else if (data.error?.includes("expirou")) setState("expired")
        else if (data.error?.includes("revogado")) setState("revoked")
        else if (data.error?.includes("desativado")) setState("unauthorized")
        else setState("error")
        return
      }

      setInviteData(data)
      setState("valid")
    } catch (err) {
      console.error("Error validating token:", err)
      setState("error")
      setErrorMsg("Erro de comunicação com o servidor.")
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setErrorMsg("")

    try {
      // 1. Fazer login no Firebase Client
      const result = await signInWithPopup(getAuthInstance(), googleProvider)
      const googleUser = result.user

      // 2. Pegar o ID Token
      const idToken = await googleUser.getIdToken()

      // 3. Enviar para a API de aceite
      const acceptResponse = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      })

      const data = await acceptResponse.json()

      if (!acceptResponse.ok) {
        setErrorMsg(data.error || "Erro ao aceitar convite.")
        setState("error")
        return
      }

      setState("success")
      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = "/admin"
      }, 2500)
    } catch (err: any) {
      console.error("Login error:", err)
      if (err.code === "auth/popup-closed-by-user") {
        setErrorMsg("Login cancelado.")
      } else {
        setErrorMsg("Erro ao fazer login. Tente novamente.")
      }
      setState("valid") // Allow retry
    } finally {
      setLoading(false)
    }
  }

  const renderContent = () => {
    switch (state) {
      case "loading":
        return (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#7c5cfc', margin: '0 auto 1rem' }} />
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#6b7280' }}>Validando convite...</p>
          </div>
        )

      case "valid":
        return (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '4rem', height: '4rem', borderRadius: '1.25rem', margin: '0 auto 1rem',
                background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(124,92,252,0.3)',
              }}>
                <Shield style={{ width: '1.75rem', height: '1.75rem', color: '#fff' }} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d', marginBottom: '0.5rem' }}>
                Convite de Acesso
              </h2>
              <p style={{ fontSize: '0.9375rem', color: '#6b7280', lineHeight: 1.6 }}>
                Você foi convidado para acessar o painel administrativo do{' '}
                <strong style={{ color: '#1e1e2d' }}>{inviteData?.company_name || 'estabelecimento'}</strong>.
              </p>
              {inviteData && (
                <div style={{ background: '#f8f6ff', border: '1px solid #e0d4ff', borderRadius: '0.75rem', padding: '0.75rem', marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.8125rem', color: '#8b8fa7' }}>
                    Convidado como: <strong style={{ color: '#7c5cfc' }}>{inviteData.employee_name}</strong>
                  </p>
                  {inviteData.employee_email && (
                    <p style={{ fontSize: '0.75rem', color: '#8b8fa7', marginTop: '0.25rem' }}>
                      ({inviteData.employee_email})
                    </p>
                  )}
                </div>
              )}
            </div>

            {errorMsg && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem',
                padding: '0.75rem 1rem', textAlign: 'center', marginBottom: '1rem',
                fontSize: '0.8125rem', color: '#ef4444',
              }}>
                {errorMsg}
              </div>
            )}

            <button onClick={handleGoogleLogin} disabled={loading} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              padding: '1rem', borderRadius: '1rem', border: '2px solid #e8ecf4', background: '#fff',
              fontWeight: 700, fontSize: '1rem', color: '#1e1e2d', cursor: loading ? 'wait' : 'pointer',
              transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}>
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#7c5cfc' }} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {loading ? 'Autenticando...' : 'Entrar com Google'}
              {!loading && <ArrowRight style={{ width: '16px', height: '16px', color: '#9ca3af', marginLeft: 'auto' }} />}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', marginTop: '1rem', lineHeight: 1.6 }}>
              Após entrar, você será vinculado como profissional e terá acesso às funções liberadas.
            </p>
          </>
        )

      case "success":
        return (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{
              width: '4rem', height: '4rem', borderRadius: '50%', margin: '0 auto 1rem',
              background: '#f0fdf4', border: '2px solid #bbf7d0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle style={{ width: '2rem', height: '2rem', color: '#22c55e' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.375rem', fontWeight: 800, color: '#1e1e2d', marginBottom: '0.5rem' }}>
              Conta vinculada com sucesso!
            </h2>
            <p style={{ fontSize: '0.9375rem', color: '#6b7280' }}>Você já pode acessar o painel. Redirecionando...</p>
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#7c5cfc', margin: '1rem auto 0' }} />
          </div>
        )

      case "expired":
        return renderError(
          <Clock style={{ width: '2rem', height: '2rem', color: '#f59e0b' }} />,
          '#fffbeb', '#fde68a',
          'Convite expirado',
          'Este convite expirou. Solicite um novo acesso ao administrador.'
        )

      case "revoked":
        return renderError(
          <XCircle style={{ width: '2rem', height: '2rem', color: '#ef4444' }} />,
          '#fef2f2', '#fecaca',
          'Convite revogado',
          'Este convite foi revogado. Contate o responsável do salão.'
        )

      case "used":
        return renderError(
          <CheckCircle style={{ width: '2rem', height: '2rem', color: '#3b82f6' }} />,
          '#eff6ff', '#bfdbfe',
          'Convite já utilizado',
          'Este convite já foi aceito. Você já pode fazer login normalmente no painel.'
        )

      case "unauthorized":
        return renderError(
          <Shield style={{ width: '2rem', height: '2rem', color: '#6b7280' }} />,
          '#f9fafb', '#e5e7eb',
          'Acesso não autorizado',
          'Seu acesso ao painel está desativado. Contate o estabelecimento.'
        )

      case "not_found":
        return renderError(
          <XCircle style={{ width: '2rem', height: '2rem', color: '#ef4444' }} />,
          '#fef2f2', '#fecaca',
          'Convite inválido ou não encontrado.',
          'Verifique se o link está correto ou peça um novo convite.'
        )

      case "error":
        return (
          <>
            {renderError(
              <XCircle style={{ width: '2rem', height: '2rem', color: '#ef4444' }} />,
              '#fef2f2', '#fecaca',
              'Erro ao acessar convite',
              errorMsg || 'Ocorreu um erro inesperado. Tente novamente.'
            )}
            <button onClick={() => setState("valid")} style={{
              width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #e8ecf4',
              background: '#fff', color: '#374151', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', marginTop: '1rem',
            }}>Tentar Novamente</button>
          </>
        )
    }
  }

  const renderError = (icon: React.ReactNode, bg: string, border: string, title: string, desc: string) => (
    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
      <div style={{
        width: '4rem', height: '4rem', borderRadius: '50%', margin: '0 auto 1rem',
        background: bg, border: `2px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.375rem', fontWeight: 800, color: '#1e1e2d', marginBottom: '0.5rem' }}>{title}</h2>
      <p style={{ fontSize: '0.9375rem', color: '#6b7280', lineHeight: 1.6 }}>{desc}</p>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #f4f6fb 0%, #e8ecf4 100%)', padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: '1.5rem', width: '100%', maxWidth: '440px',
        overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
      }}>
        {/* Header gradient */}
        <div style={{
          height: '6px', background: 'linear-gradient(90deg, #7c5cfc, #a78bfa, #22c997)',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem', padding: '1.5rem 1.5rem 0' }}>
          <div style={{
            width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem',
            background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Calendar style={{ width: '1rem', height: '1rem', color: '#fff' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 700, color: '#1e1e2d' }}>
            Agenda Online
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {renderContent()}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #f1f3f9', textAlign: 'center' }}>
          <p style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
            © {new Date().getFullYear()} Salão Lindonas · Acesso protegido
          </p>
        </div>
      </div>
    </div>
  )
}
