import React from "react"
import { PwaCard } from "./pwa-card"

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
  return (
    <PwaCard 
      onClick={onClick}
      className={`relative overflow-hidden transition-all duration-300 ${
        selected 
          ? "border-[#7C5CFC] ring-1 ring-[#7C5CFC] bg-[#7C5CFC]/[0.02]" 
          : "border-transparent hover:border-gray-200"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          selected ? "bg-[#7C5CFC] text-white" : "bg-[#EDE9FE] text-[#7C5CFC]"
        }`}>
          <Icon className="w-6 h-6" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <h3 className="text-[17px] font-bold text-[#111827] leading-tight">{name}</h3>
          <p className="text-[14px] text-[#6B7280] mt-1">{duration} min</p>
        </div>
        <div className="text-right">
          <p className="text-[16px] font-bold text-[#7C5CFC]">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price)}
          </p>
          {selected && (
            <div className="w-6 h-6 rounded-full bg-[#7C5CFC] text-white flex items-center justify-center ml-auto mt-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
          )}
        </div>
      </div>
    </PwaCard>
  )
}
