"use client"

import { useState, useEffect, Suspense, use } from "react"
import { getAuthInstance, googleProvider } from "@/lib/firebase/config"
import { signInWithPopup, signInWithEmailAndPassword } from "firebase/auth"
import { fetchCollectionWhere, createDocument, updateDocument } from "@/lib/firebase/client-utils"
import { resolvePWATenantBySlug } from "@/lib/pwa/tenant-resolver"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"

import { PwaButton } from "@/components/pwa/ui/pwa-button"

import { Mail, Lock, Eye, EyeOff } from "lucide-react"

function LoginForm({ slug }: { slug: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userType = searchParams.get("type") || "cliente"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyData, setCompanyData] = useState<any>(null)

  useEffect(() => {
    async function loadCompany() {
      try {
        const company = await resolvePWATenantBySlug(slug)
        if (company) {
          setCompanyId(company.id)
          setCompanyData(company)
        } else {
          setError(`Nenhum estabelecimento encontrado com este link. Verifique se o endereço está correto.`)
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

      const normalizedEmail = user.email.trim().toLowerCase()
      const clients = await fetchCollectionWhere("clients", "email", "==", normalizedEmail)
      const existingClient: any = clients.find((c: any) => c.company_id === companyId)

      if (existingClient) {
        if (!existingClient.auth_uid || !existingClient.google_email || !existingClient.email_normalized) {
          await updateDocument("clients", existingClient.id, {
            auth_uid: user.uid,
            google_email: normalizedEmail,
            email_normalized: normalizedEmail
          })
        }
      } else {
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
    <div className="flex flex-col min-h-[100dvh] bg-gradient-to-b from-[#4A148C] to-[#311B92] relative">
      {/* Imagem de Fundo (Simulada com CSS) */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-20" />
      
      {/* Top Section - Logo */}
      <div className="relative z-10 flex flex-col items-center justify-center pt-20 pb-16 h-[35vh]">
        {companyData?.logo_url ? (
          <img src={companyData.logo_url} alt="Logo" className="h-24 w-auto drop-shadow-xl" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="text-white">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C8 6 4 10 4 15a8 8 0 0 0 16 0c0-5-4-9-8-13z"/>
                <path d="M12 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-wide font-serif text-center drop-shadow-lg">
              {companyData?.name || "Lindonas"}
            </h1>
            <p className="text-white/80 text-xs font-bold tracking-[0.2em] uppercase mt-1">
              Salão de Beleza
            </p>
          </div>
        )}
      </div>

      {/* Bottom Section - Login Form */}
      <div className="relative z-20 flex-1 bg-white rounded-t-[32px] px-8 pt-10 pb-8 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.15)]">
        <h2 className="text-[28px] font-bold text-[#111827] mb-1 flex items-center gap-2">
          Olá! <span className="text-2xl">👋</span>
        </h2>
        <p className="text-[#6B7280] text-[15px] mb-8 font-medium">Faça seu login para continuar</p>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-[#7C5CFC]">
              <Mail className="h-[22px] w-[22px]" />
            </div>
            <input 
              type="email" 
              placeholder="E-mail ou telefone" 
              className="w-full h-14 pl-14 pr-5 bg-white border border-gray-200 rounded-[20px] focus:border-[#7C5CFC] focus:ring-4 focus:ring-[#7C5CFC]/10 outline-none transition-all font-medium text-[#111827] placeholder:text-gray-400 placeholder:font-normal shadow-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-[#7C5CFC]">
              <Lock className="h-[22px] w-[22px]" />
            </div>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Senha" 
              className="w-full h-14 pl-14 pr-12 bg-white border border-gray-200 rounded-[20px] focus:border-[#7C5CFC] focus:ring-4 focus:ring-[#7C5CFC]/10 outline-none transition-all font-medium text-[#111827] placeholder:text-gray-400 placeholder:font-normal shadow-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button 
              type="button" 
              className="absolute inset-y-0 right-0 pr-5 flex items-center text-[#7C5CFC] hover:text-[#5d3fd3] transition-colors"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          
          <div className="flex justify-start">
            <button type="button" className="text-[14px] font-bold text-[#7C5CFC] mt-2 mb-2 hover:underline">
              Esqueceu sua senha?
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-[16px] text-[14px] font-medium border border-red-100 mb-2 shadow-sm">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={!companyId || loading}
            className="w-full h-14 rounded-[20px] bg-gradient-to-r from-[#7C5CFC] to-[#5d3fd3] text-white font-bold text-[16px] shadow-[0_8px_20px_rgba(124,92,252,0.3)] active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Entrar"}
          </button>
        </form>

        <div className="mt-8 mb-6 flex items-center gap-4">
          <div className="flex-1 h-[1px] bg-gray-200" />
          <span className="text-[13px] text-gray-400 font-medium">ou continue com</span>
          <div className="flex-1 h-[1px] bg-gray-200" />
        </div>

        <button 
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || !companyId}
          className="w-full h-14 rounded-[20px] bg-white border border-gray-200 text-[#111827] font-bold text-[16px] shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:active:scale-100"
        >
          <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Entrar com Google
        </button>
        
        <p className="text-center mt-auto pt-8 text-[14px] text-gray-500 font-medium pb-2">
          Não tem uma conta? <Link href={`/pwa/${slug}`} className="text-[#7C5CFC] font-bold hover:underline">Fale com o salão</Link>
        </p>
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
