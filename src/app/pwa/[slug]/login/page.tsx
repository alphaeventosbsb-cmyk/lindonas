"use client"

import { useState, useEffect, Suspense, use } from "react"
import { getAuthInstance, googleProvider } from "@/lib/firebase/config"
import { signInWithPopup, signInWithEmailAndPassword } from "firebase/auth"
import { fetchCollectionWhere, createDocument, updateDocument } from "@/lib/firebase/client-utils"
import { resolvePWATenantBySlug } from "@/lib/pwa/tenant-resolver"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"

function LoginForm({ slug }: { slug: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userType = searchParams.get("type") || "cliente" // "cliente" ou "profissional"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    async function loadCompany() {
      try {
        const company = await resolvePWATenantBySlug(slug)
        if (company) {
          setCompanyId(company.id)
        } else {
          setError(`Slug recebido: ${slug}\nNenhum estabelecimento encontrado com esse slug\nVerifique se existe pwa_slug ou slug no documento settings/company`)
        }
      } catch (err) {
        setError("Erro ao carregar dados do salão.")
      }
    }
    loadCompany()
  }, [slug])

  const handleAuthResult = async (user: any) => {
    if (!companyId) return

    try {
      if (userType === "profissional") {
        // Profissionais: procurar na tabela employees do company_id atual
        const employees = await fetchCollectionWhere("employees", "auth_uid", "==", user.uid)
        const myEmployee = employees.find((e: any) => e.company_id === companyId)

        if (myEmployee) {
          router.replace(`/pwa/${slug}/profissional/home`)
          return
        } else {
          setError("Profissional não cadastrado neste estabelecimento.")
          setLoading(false)
          return
        }
      }

      // Cliente (Padrão)
      const normalizedEmail = user.email.trim().toLowerCase()
      
      // Buscar cliente existente pelo email e company_id
      const clients = await fetchCollectionWhere("clients", "email", "==", normalizedEmail)
      const existingClient: any = clients.find((c: any) => c.company_id === companyId)

      if (existingClient) {
        // Se existe, atualiza com auth_uid se faltar
        if (!existingClient.auth_uid || !existingClient.google_email || !existingClient.email_normalized) {
          await updateDocument("clients", existingClient.id, {
            auth_uid: user.uid,
            google_email: normalizedEmail,
            email_normalized: normalizedEmail
          })
        }
      } else {
        // Criar novo cliente
        await createDocument("clients", {
          company_id: companyId,
          name: user.displayName || "Cliente",
          email: normalizedEmail,
          email_normalized: normalizedEmail,
          auth_uid: user.uid,
          google_email: normalizedEmail,
          phone: user.phoneNumber || "",
          photo_url: user.photoURL || null,
          total_spent: 0,
          credit_amount: 0,
          debt_amount: 0,
          status: "active",
          appointment_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }

      router.replace(`/pwa/${slug}/cliente/home`)
    } catch (err) {
      console.error(err)
      setError("Erro ao processar login. Tente novamente.")
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    if (!companyId) return
    setLoading(true)
    setError("")
    try {
      const result = await signInWithPopup(getAuthInstance(), googleProvider)
      if (result?.user) {
        await handleAuthResult(result.user)
      }
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        setError("Não foi possível fazer login com o Google.")
      }
      setLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    setLoading(true)
    setError("")
    try {
      const result = await signInWithEmailAndPassword(getAuthInstance(), email, password)
      if (result?.user) {
        await handleAuthResult(result.user)
      }
    } catch (err: any) {
      setError("Email ou senha inválidos.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col p-6 bg-[var(--color-background)] w-full max-w-[430px] mx-auto overflow-x-hidden">
      {/* Header com voltar */}
      <div className="pt-8 pb-6 flex items-center">
        <Link href={`/pwa/${slug}`} className="p-2 -ml-2 rounded-xl text-[#1e1e2d] hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6" />
        </Link>
      </div>

      <div className="flex-1 flex flex-col pt-4">
        <h1 className="text-3xl font-[var(--font-heading)] font-bold text-[var(--color-foreground)] mb-2 flex items-center gap-2">
          Olá! <span className="text-2xl">👋</span>
        </h1>
        <p className="text-gray-500 mb-8 font-medium">Faça seu login para continuar</p>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <input 
              type="email" 
              placeholder="E-mail" 
              className="w-full h-14 px-4 bg-white border border-[#e8ecf4] rounded-2xl focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 outline-none transition-all font-medium text-gray-700 placeholder:text-gray-400 placeholder:font-normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <input 
              type="password" 
              placeholder="Senha" 
              className="w-full h-14 px-4 bg-white border border-[#e8ecf4] rounded-2xl focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 outline-none transition-all font-medium text-gray-700 placeholder:text-gray-400 placeholder:font-normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="flex justify-start">
            <button type="button" className="text-sm font-bold text-[var(--color-primary)] mt-1 mb-4">
              Esqueceu sua senha?
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 mb-4">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading || !companyId}
            className="w-full h-14 rounded-2xl bg-[var(--color-primary)] text-white font-bold flex items-center justify-center shadow-[0_8px_20px_rgba(124,92,252,0.3)] hover:scale-[0.98] transition-transform disabled:opacity-70 disabled:scale-100"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Entrar"}
          </button>
        </form>

        <div className="mt-8 flex items-center gap-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium tracking-wide">ou continue com</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <button 
          onClick={handleGoogleLogin}
          disabled={loading || !companyId}
          className="w-full h-14 rounded-2xl bg-white border border-gray-200 text-gray-700 font-bold flex items-center justify-center gap-3 mt-6 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Entrar com Google
        </button>
      </div>
    </div>
  )
}

export default function PWALoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center bg-[var(--color-background)]"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" /></div>}>
      <LoginForm slug={slug} />
    </Suspense>
  )
}
