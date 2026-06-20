import React from "react"
import { PwaCard } from "./pwa-card"

export function PwaStatCard({
  title,
  value,
  icon: Icon,
  trend,
  colorClass = "text-[#7C5CFC]",
  bgClass = "bg-[#EDE9FE]"
}: {
  title: string
  value: string | number
  icon: React.ElementType
  trend?: { value: string; isPositive: boolean }
  colorClass?: string
  bgClass?: string
}) {
  return (
    <PwaCard className="flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bgClass}`}>
          <Icon className={`w-5 h-5 ${colorClass}`} strokeWidth={2} />
        </div>
        {trend && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend.isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {trend.isPositive ? '+' : '-'}{trend.value}
          </span>
        )}
      </div>
      <p className="text-[13px] text-[#6B7280] font-medium mb-1">{title}</p>
      <h4 className="text-[22px] font-bold text-[#111827]">{value}</h4>
    </PwaCard>
  )
}
