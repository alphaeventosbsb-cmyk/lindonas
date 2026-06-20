"use client"

import { usePWATenant } from "@/components/pwa/pwa-tenant-context"
import { User, LogOut, Phone, Mail, FileText, ChevronRight, BellRing } from "lucide-react"
import { getAuthInstance } from "@/lib/firebase/config"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { toast } from "sonner"

export default function ClientProfile() {
  const { user, slug } = usePWATenant()
  const router = useRouter()
  const [soundEnabled, setSoundEnabled] = useState(false)

  useEffect(() => {
    setSoundEnabled(localStorage.getItem("pwa_sound_enabled") === "true")
  }, [])

  const toggleSound = () => {
    const newState = !soundEnabled
    localStorage.setItem("pwa_sound_enabled", newState.toString())
    setSoundEnabled(newState)
    if (newState) {
      // Tentar tocar para testar/habilitar
      const audio = new Audio("/sounds/notification.mp3")
      audio.play().catch(e => console.log(e))
      toast.success("Alertas sonoros ativados!")
    } else {
      toast.info("Alertas sonoros desativados.")
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(getAuthInstance())
      router.replace(`/pwa/${slug}`)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="bg-white px-4 py-6 border-b border-gray-100 flex flex-col items-center justify-center pt-10">
        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-50 shadow-md mb-4 bg-gray-200 flex items-center justify-center">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Foto" className="w-full h-full object-cover" />
          ) : (
            <User className="w-10 h-10 text-gray-400" />
          )}
        </div>
        <h1 className="text-xl font-bold text-gray-900">{user?.displayName || "Cliente"}</h1>
        <p className="text-sm text-gray-500">{user?.email}</p>
      </div>

      <div className="p-4 pb-24 space-y-4">
        
        <div className="bg-[var(--color-primary)] text-white p-4 rounded-2xl shadow-lg flex flex-col gap-2 mt-4 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
          <h3 className="font-bold text-lg flex items-center gap-2"><BellRing className="w-5 h-5" /> Receba alertas de agendamentos</h3>
          <p className="text-sm text-white/80">Permite tocar som e mostrar popup quando o PWA estiver aberto ou em segundo plano permitido pelo navegador.</p>
          <button 
            onClick={toggleSound}
            className={`mt-2 py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center transition-all ${
              soundEnabled ? "bg-white/20 text-white border border-white/30" : "bg-white text-[var(--color-primary)] shadow-md"
            }`}
          >
            {soundEnabled ? "Desativar alertas sonoros" : "Ativar alertas sonoros"}
          </button>
        </div>

        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-2 mt-6 mb-2">Conta</h2>
        
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <button className="w-full flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">Dados Pessoais</p>
                <p className="text-xs text-gray-500">Nome, email, foto</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>

          <button className="w-full flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Phone className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">Telefone e Contato</p>
                <p className="text-xs text-gray-500">Atualizar número</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-2 mt-8 mb-2">Sobre</h2>
        
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <button className="w-full flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">Termos de Uso</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full bg-white mt-8 p-4 rounded-2xl border border-red-100 shadow-sm flex items-center justify-center gap-2 text-red-600 font-bold hover:bg-red-50 active:scale-95 transition-all"
        >
          <LogOut className="w-5 h-5" /> Sair do Aplicativo
        </button>

        <p className="text-center text-xs text-gray-400 mt-8 font-medium">Versão 1.0.0</p>
      </div>
    </div>
  )
}
