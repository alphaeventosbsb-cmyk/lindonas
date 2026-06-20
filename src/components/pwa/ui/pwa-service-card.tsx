import React from "react"
import { PwaCard } from "./pwa-card"
import { Check } from "lucide-react"

export function PwaServiceCard({
  name,
  duration,
  price,
  selected,
  onClick,
  icon: Icon
}: {
  name: string
  duration: number
  price: number
  selected?: boolean
  onClick?: () => void
  icon: React.ElementType
}) {
  // Format duration
  const hours = Math.floor(duration / 60)
  const mins = duration % 60
  const durationStr = hours > 0 
    ? `${hours}h ${mins > 0 ? `${mins}min` : '00min'}`
    : `${mins}min`

  return (
    <div 
      onClick={onClick}
      className={`relative overflow-hidden transition-all duration-300 rounded-[20px] p-4 cursor-pointer flex items-center gap-4 ${
        selected 
          ? "border-2 border-[#5D3FD3] bg-[#F5F3FF]" 
          : "border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
      }`}
    >
      <div className="w-[52px] h-[52px] rounded-full bg-[#EDE9FE] text-[#5D3FD3] flex items-center justify-center flex-shrink-0">
        <Icon className="w-6 h-6" strokeWidth={1.5} />
      </div>
      
      <div className="flex-1">
        <h3 className="text-[15px] font-bold text-[#111827] leading-tight mb-0.5">{name}</h3>
        <p className="text-[13px] text-[#9CA3AF] mb-1 font-medium">{durationStr}</p>
        <p className="text-[14px] font-bold text-[#5D3FD3]">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price)}
        </p>
      </div>

      <div className="flex-shrink-0 flex items-center justify-center ml-2">
        <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center transition-colors ${
          selected ? "bg-[#5D3FD3] border border-[#5D3FD3]" : "border-[1.5px] border-gray-300 bg-transparent"
        }`}>
          {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
        </div>
      </div>
    </div>
  )
}
