"use client"

import { useState, useEffect } from "react"
import { getAuthInstance, googleProvider } from "@/lib/firebase/config"
import { signInWithPopup, getRedirectResult, onAuthStateChanged } from "firebase/auth"
import { useRouter } from "next/navigation"
import { 
  Calendar, Loader2, Shield, ArrowRight, 
  Sparkles, ShieldCheck, TrendingUp, TrendingDown, DollarSign,
  Phone, Scissors, User, Clock
} from "lucide-react"

const SystemMockupCard = () => {
  return (
    <div className="relative w-full max-w-xl xl:max-w-2xl group cursor-default perspective-1000 mt-6 shrink-0">
      {/* Sombra de destaque no hover */}
      <div className="absolute inset-0 bg-[var(--color-primary)]/10 rounded-2xl blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      {/* Mockup Realista do Sistema (estilo Financeiro/Dashboard) */}
      <div className="relative bg-[#f4f6fb] rounded-2xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.15)] border border-white transition-all duration-500 transform group-hover:-translate-y-2 overflow-hidden">
        
        {/* Header do Browser/Sistema */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="hidden sm:flex bg-gray-100 h-6 w-48 rounded-md items-center px-2">
               <div className="w-32 h-2.5 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-100" />
            <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20" />
          </div>
        </div>

        {/* Conteúdo Falso (Financeiro) */}
        <div className="p-5 xl:p-6 flex flex-col gap-4 pointer-events-none">
          
          <div className="flex items-center justify-between mb-2">
             <div className="h-5 w-32 bg-gray-800 rounded-md" />
             <div className="h-6 w-24 bg-white border border-gray-200 rounded-md" />
          </div>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-3 gap-3 xl:gap-4">
            <div className="bg-white p-3 xl:p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[#22c997] flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[10px] xl:text-xs text-gray-500 font-semibold">Entradas</span>
              </div>
              <div className="text-base xl:text-xl font-bold text-[#22c997]">R$ 2.340,00</div>
            </div>

            <div className="bg-white p-3 xl:p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[#f25c5c] flex items-center justify-center">
                  <TrendingDown className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[10px] xl:text-xs text-gray-500 font-semibold">Saídas</span>
              </div>
              <div className="text-base xl:text-xl font-bold text-[#f25c5c]">R$ 586,50</div>
            </div>

            <div className="bg-white p-3 xl:p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[10px] xl:text-xs text-gray-500 font-semibold">Saldo do Mês</span>
              </div>
              <div className="text-base xl:text-xl font-bold text-[var(--color-primary)]">R$ 1.753,50</div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-2 gap-3 xl:gap-4 mt-2">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-32 flex items-end gap-3 justify-center pb-4 relative overflow-hidden">
               <div className="absolute top-3 left-3 text-[10px] text-gray-400 font-medium">Entradas vs Saídas</div>
               <div className="w-6 h-12 bg-[#22c997] rounded-t-sm" />
               <div className="w-6 h-8 bg-[#f25c5c] rounded-t-sm" />
               <div className="w-6 h-16 bg-[#22c997] rounded-t-sm" />
               <div className="w-6 h-6 bg-[#f25c5c] rounded-t-sm" />
               <div className="w-6 h-20 bg-[#22c997] rounded-t-sm" />
               <div className="w-6 h-10 bg-[#f25c5c] rounded-t-sm" />
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-32 flex flex-col items-center justify-center relative overflow-hidden">
               <div className="absolute top-3 left-3 text-[10px] text-gray-400 font-medium">Por Categoria</div>
               <div className="w-16 h-16 rounded-full border-8 border-[var(--color-primary)]/80 border-t-[var(--color-primary-light)]" />
            </div>
          </div>

        </div>

        {/* Card Exato do Agendamento (Hover) */}
        <div className="absolute -right-2 top-8 xl:-right-12 xl:top-16 bg-white rounded-2xl p-5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] border border-gray-100 w-[300px] xl:w-[320px] opacity-0 scale-95 translate-x-8 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-0 transition-all duration-500 delay-100 z-30 pointer-events-none">
          
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-[#9b7bfa] flex items-center justify-center text-white font-black text-2xl shadow-sm">
              C
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 leading-none mb-1.5">carlos3</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100">
                Confirmado
              </span>
            </div>
          </div>

          <div className="space-y-3.5 border border-gray-100 rounded-xl p-4 bg-[#fafafa]">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-gray-400 font-medium">
                <Phone className="w-3.5 h-3.5" />
                <span>Telefone</span>
              </div>
              <span className="font-semibold text-gray-800">(12) 34567-8956</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-gray-400 font-medium">
                <Scissors className="w-3.5 h-3.5" />
                <span>Serviço</span>
              </div>
              <span className="font-semibold text-gray-800">Pé ou Mão...</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-gray-400 font-medium">
                <DollarSign className="w-3.5 h-3.5" />
                <span>Valor</span>
              </div>
              <span className="font-semibold text-gray-800">R$ 25,00</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-gray-400 font-medium">
                <User className="w-3.5 h-3.5" />
                <span>Profissional</span>
              </div>
              <span className="font-bold text-gray-800">♥ KELINE...</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-gray-400 font-medium">
                <Calendar className="w-3.5 h-3.5" />
                <span>Data</span>
              </div>
              <span className="font-semibold text-gray-800">08/06/2026</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-gray-400 font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Horário</span>
              </div>
              <span className="font-semibold text-gray-800">10:30 — 11:00</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-[#f5f0ff] rounded-xl p-3 text-center border border-[#ece4ff]">
              <div className="text-[10px] text-[#8b5cf6] font-bold uppercase mb-1">Visitas</div>
              <div className="text-lg font-black text-[#7c3aed]">5</div>
            </div>
            <div className="bg-[#ecfdf5] rounded-xl p-3 text-center border border-[#d1fae5]">
              <div className="text-[10px] text-[#059669] font-bold uppercase mb-1">Total gasto</div>
              <div className="text-lg font-black text-[#047857]">R$ 320,00</div>
            </div>
          </div>
          
        </div>

      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    const auth = getAuthInstance()
    let active = true

    getRedirectResult(auth).then((result) => {
      if (active && result?.user) {
        router.replace("/admin")
      }
    }).catch((err) => {
      if (active && err?.code && err.code !== "auth/popup-closed-by-user") {
        setError(`Erro no redirect: ${err.code} — ${err.message}`)
      }
    })

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (active && firebaseUser) {
        router.replace("/admin")
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [router])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError("")
    try {
      const result = await signInWithPopup(getAuthInstance(), googleProvider)
      if (result?.user) {
        router.replace("/admin")
      }
    } catch (err: any) {
      const code = err?.code || ""
      if (code === "auth/unauthorized-domain") {
        setError(`Domínio não autorizado. Adicione "${window.location.hostname}" no Firebase Console.`)
      } else if (code !== "auth/popup-closed-by-user") {
        setError(`Erro: ${code || err?.message || "Não foi possível fazer login. Tente novamente."}`)
      }
      setLoading(false)
    }
  }

  return (
    <div className="h-[100dvh] w-full flex bg-white overflow-hidden">
      
      {/* LADO ESQUERDO - Apresentação Soft/Clean */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[55%] relative overflow-y-auto flex-col p-8 xl:p-16 2xl:p-24 scrollbar-hide" style={{
        background: "linear-gradient(135deg, #fdfcff 0%, #f4f0ff 50%, #eae2ff 100%)"
      }}>
        {/* Elementos decorativos sutis */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[var(--color-primary-light)]/10 blur-[100px]" />
          <div className="absolute top-[40%] -right-[10%] w-[60%] h-[60%] rounded-full bg-[var(--color-primary)]/5 blur-[120px]" />
        </div>

        {/* Container Centralizado */}
        <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col justify-center min-h-full">
          
          {/* Logo e Tag */}
          <div className="flex items-center gap-3 mb-6 xl:mb-8">
            <div className="w-10 h-10 xl:w-12 xl:h-12 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] shadow-lg shadow-[var(--color-primary)]/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 xl:w-6 xl:h-6 text-white" />
            </div>
            <span className="font-[var(--font-heading)] text-xl xl:text-2xl font-black text-[#1e1e2d] tracking-tight">Agenda Online</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 border border-white shadow-sm mb-5 xl:mb-6 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-[var(--color-primary)]" />
            <span className="text-xs xl:text-sm font-bold text-[var(--color-primary-dark)]">Plataforma de Gestão Completa</span>
          </div>

          {/* Título e Subtítulo */}
          <h1 className="font-[var(--font-heading)] text-3xl xl:text-4xl 2xl:text-5xl font-extrabold text-[#1e1e2d] leading-[1.15] mb-4 xl:mb-6 tracking-tight">
            Seu salão mais organizado, produtivo e profissional
          </h1>
          <p className="text-gray-600 text-base xl:text-lg leading-relaxed max-w-lg xl:max-w-xl mb-8 xl:mb-10 font-medium">
            Gerencie sua agenda, profissionais, serviços, clientes e financeiro em um só lugar. A experiência premium que o seu negócio merece.
          </p>

          {/* Card Interativo de Referência do Sistema */}
          <SystemMockupCard />
          
        </div>
      </div>

      {/* LADO DIREITO - Área de Login */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative bg-white border-l border-gray-100 shadow-[-10px_0_30px_rgba(0,0,0,0.02)] overflow-y-auto">
        
        {/* Background sutil mobile */}
        <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-b from-[var(--color-primary)]/5 to-transparent lg:hidden -z-10" />

        <div className="w-full max-w-[420px] my-auto">
          
          {/* Logo no Mobile */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] shadow-lg shadow-[var(--color-primary)]/20 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <span className="font-[var(--font-heading)] text-2xl font-bold text-[var(--color-foreground)] tracking-tight">
              Agenda Online
            </span>
          </div>

          {/* Card Central de Login */}
          <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-gray-100 relative overflow-hidden">
            
            {/* Efeito luminoso no canto do card */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[var(--color-primary)]/[0.03] rounded-full blur-3xl pointer-events-none" />

            {/* Ícone de Escudo / Proteção */}
            <div className="mb-8 flex justify-center">
              <div className="w-16 h-16 rounded-[1.25rem] bg-gradient-to-br from-[var(--color-primary-dark)] via-[var(--color-primary)] to-[var(--color-primary-light)] p-[1px] shadow-lg shadow-[var(--color-primary)]/20">
                <div className="w-full h-full rounded-[1.25rem] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>

            {/* Títulos */}
            <div className="text-center mb-10 relative z-10">
              <h2 className="font-[var(--font-heading)] text-2xl sm:text-3xl font-extrabold text-[var(--color-foreground)] tracking-tight mb-2">
                Bem-vindo de volta
              </h2>
              <p className="text-[var(--color-muted-foreground)] text-sm sm:text-base font-medium">
                Acesse o painel administrativo de forma rápida e segura.
              </p>
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-50/80 text-[var(--color-destructive)] text-sm p-4 rounded-2xl mb-8 border border-red-100 flex items-start gap-3 animate-scale-in">
                <Shield className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="text-left font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {/* Botão Premium: Continuar com Google */}
            <button 
              onClick={handleGoogleLogin} 
              disabled={loading}
              className="w-full flex items-center justify-between p-2 pr-5 h-16 bg-white border border-gray-200 rounded-2xl hover:border-[var(--color-primary)]/50 hover:bg-[#fcfbfe] hover:shadow-[0_8px_20px_rgb(124,92,252,0.08)] transition-all duration-300 group disabled:opacity-60 disabled:cursor-not-allowed relative z-10"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white p-2.5 rounded-xl shadow-[0_2px_8px_rgb(0,0,0,0.06)] border border-gray-100 group-hover:scale-105 transition-transform duration-300">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <span className="font-semibold text-gray-700 text-sm sm:text-base">
                  {loading ? "Autenticando..." : "Continuar com Google"}
                </span>
              </div>
              
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-[var(--color-primary)]/10 transition-colors">
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[var(--color-primary)] group-hover:translate-x-0.5 transition-all" />
                </div>
              )}
            </button>

            {/* Separador de Acesso Seguro */}
            <div className="flex items-center gap-4 my-8 relative z-10">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-gray-200" />
              <span className="text-[10px] sm:text-xs font-bold tracking-widest text-gray-400 uppercase">
                Acesso Seguro
              </span>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent via-gray-200 to-gray-200" />
            </div>

            {/* Texto de Segurança */}
            <p className="text-xs sm:text-sm text-center text-gray-500 leading-relaxed relative z-10">
              Apenas administradores autorizados têm acesso. A autenticação é protegida e gerida com os mais altos padrões do Google.
            </p>
          </div>

          {/* Rodapé / Copyright */}
          <div className="mt-8 text-center px-4">
            <p className="text-xs text-gray-400 font-medium">
              &copy; {new Date().getFullYear()} Agenda Online. Todos os direitos reservados.
            </p>
          </div>

        </div>
      </div>
      
    </div>
  )
}
