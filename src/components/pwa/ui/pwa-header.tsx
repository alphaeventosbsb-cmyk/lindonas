import React from "react"

export function PwaHeader({ 
  title, 
  subtitle, 
  avatarUrl, 
  rightAction 
}: { 
  title: React.ReactNode, 
  subtitle?: string, 
  avatarUrl?: string | null,
  rightAction?: React.ReactNode
}) {
  return (
    <div className="bg-gradient-to-b from-[#1F1744] to-[#2B1B54] pt-safe px-6 pb-8 rounded-b-[32px] text-white relative z-10 shadow-md">
      <div className="pt-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-14 h-14 rounded-full border-2 border-white/20 object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center border-2 border-white/20">
              <span className="text-xl font-bold text-[#EDE9FE]">👤</span>
            </div>
          )}
          <div>
            <h1 className="text-[22px] font-bold text-white leading-tight">{title}</h1>
            {subtitle && <p className="text-[#c4bce8] text-[15px] font-medium mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {rightAction && (
          <div>{rightAction}</div>
        )}
      </div>
    </div>
  )
}
