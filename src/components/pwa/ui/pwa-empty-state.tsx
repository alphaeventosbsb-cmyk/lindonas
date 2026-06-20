import React from "react"

export function PwaEmptyState({ 
  icon: Icon, 
  title, 
  description,
  action
}: { 
  icon: React.ElementType, 
  title: string, 
  description?: string,
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-[#EDE9FE] flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-[#7C5CFC]" strokeWidth={1.5} />
      </div>
      <h3 className="text-xl font-bold text-[#111827] mb-2">{title}</h3>
      {description && <p className="text-[#6B7280] text-[15px] leading-relaxed max-w-[280px]">{description}</p>}
      {action && <div className="mt-8 w-full max-w-[200px]">{action}</div>}
    </div>
  )
}
