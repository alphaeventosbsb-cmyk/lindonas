import React from "react"
import { PwaCard } from "./pwa-card"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export function PwaNotificationCard({
  title,
  message,
  timestamp,
  isRead,
  icon: Icon,
  onClick
}: {
  title: string
  message: string
  timestamp: string | Date
  isRead: boolean
  icon: React.ElementType
  onClick?: () => void
}) {
  return (
    <PwaCard onClick={onClick} className={`relative overflow-hidden transition-all duration-300 border-l-4 ${isRead ? 'border-l-transparent' : 'border-l-[#7C5CFC]'}`}>
      <div className="flex gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${isRead ? 'bg-gray-100 text-gray-500' : 'bg-[#EDE9FE] text-[#7C5CFC]'}`}>
          <Icon className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start gap-2">
            <h4 className={`text-[16px] leading-snug ${isRead ? 'font-semibold text-gray-700' : 'font-bold text-[#111827]'}`}>
              {title}
            </h4>
            {!isRead && (
              <span className="w-2.5 h-2.5 rounded-full bg-[#7C5CFC] flex-shrink-0 mt-1.5 shadow-[0_0_8px_rgba(124,92,252,0.5)]" />
            )}
          </div>
          <p className={`text-[14px] mt-1.5 leading-relaxed ${isRead ? 'text-gray-500' : 'text-gray-600'}`}>
            {message}
          </p>
          <p className="text-[12px] text-gray-400 mt-3 font-medium">
            {typeof timestamp === 'string' ? timestamp : format(timestamp, "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>
    </PwaCard>
  )
}
