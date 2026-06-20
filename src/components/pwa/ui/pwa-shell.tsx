import React from "react"

export function PwaShell({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`w-full max-w-[430px] mx-auto min-h-[100dvh] bg-[#F7F8FC] overflow-x-hidden relative flex flex-col ${className}`}>
      {children}
    </div>
  )
}
