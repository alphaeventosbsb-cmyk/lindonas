"use client"

import { usePWATenant } from "@/components/pwa/pwa-tenant-context"
import { User, LogOut, Phone, Mail, FileText, ChevronRight, BellRing } from "lucide-react"
import { getAuthInstance } from "@/lib/firebase/config"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { toast } from "sonner"

import { PwaCard } from "@/components/pwa/ui/pwa-card"
import { PwaButton } from "@/components/pwa/ui/pwa-button"

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
    <div className="flex flex-col h-full bg-[#F7F8FC]">
      <div className="bg-white px-4 py-8 border-b border-gray-100 flex flex-col items-center justify-center pt-12 shadow-sm rounded-b-[32px] relative z-10">
        <div className="w-[100px] h-[100px] rounded-full overflow-hidden border-4 border-white shadow-md mb-4 bg-[#EDE9FE] flex items-center justify-center">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Foto" className="w-full h-full object-cover" />
          ) : (
            <User className="w-12 h-12 text-[#7C5CFC]" />
          )}
        </div>
        <h1 className="text-[22px] font-bold text-[#111827]">{user?.displayName || "Cliente"}</h1>
        <p className="text-[15px] text-[#6B7280]">{user?.email}</p>
      </div>

      <div className="p-5 pb-32 space-y-6">
        
        <div className="bg-gradient-to-r from-[#7C5CFC] to-[#5d3fd3] text-white p-5 rounded-[24px] shadow-[0_8px_25px_rgba(124,92,252,0.3)] flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <h3 className="font-bold text-[18px] flex items-center gap-2"><BellRing className="w-5 h-5" /> Receba alertas de agendamentos</h3>
          <p className="text-[14px] text-white/90 leading-relaxed">Permite tocar som e mostrar popup quando o PWA estiver aberto ou em segundo plano permitido pelo navegador.</p>
          <button 
            onClick={toggleSound}
            className={`mt-2 py-3 px-4 rounded-[16px] font-bold text-[15px] flex items-center justify-center transition-all active:scale-[0.98] ${
              soundEnabled ? "bg-white/20 text-white border border-white/30" : "bg-white text-[#7C5CFC] shadow-md"
            }`}
          >
            {soundEnabled ? "Desativar alertas sonoros" : "Ativar alertas sonoros"}
          </button>
        </div>

        <div>
          <h2 className="text-[15px] font-bold text-[#111827] ml-2 mb-3">Conta</h2>
          
          <div className="bg-white rounded-[24px] overflow-hidden shadow-sm border border-gray-100">
            <button className="w-full flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 active:bg-gray-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-[#111827] text-[15px]">Dados Pessoais</p>
                  <p className="text-[13px] text-[#6B7280]">Nome, email, foto</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#EDE9FE] text-[#7C5CFC] flex items-center justify-center">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-[#111827] text-[15px]">Telefone e Contato</p>
                  <p className="text-[13px] text-[#6B7280]">Atualizar número</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-[15px] font-bold text-[#111827] ml-2 mb-3">Sobre</h2>
          
          <div className="bg-white rounded-[24px] overflow-hidden shadow-sm border border-gray-100">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#F3F4F6] text-[#6B7280] flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-[#111827] text-[15px]">Termos de Uso</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full bg-white mt-4 h-[56px] rounded-[20px] border border-red-100 shadow-[0_2px_10px_rgba(239,68,68,0.05)] flex items-center justify-center gap-2 text-[#EF4444] font-bold hover:bg-red-50 active:scale-[0.98] transition-all"
        >
          <LogOut className="w-5 h-5" /> Sair do Aplicativo
        </button>

        <p className="text-center text-[13px] text-gray-400 font-medium pb-4">Versão 1.0.0</p>
      </div>
    </div>
  )
}
