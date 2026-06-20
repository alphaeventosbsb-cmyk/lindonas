import React from "react"
import { Loader2 } from "lucide-react"

interface PwaButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline"
  loading?: boolean
}

export function PwaButton({ 
  children, 
  variant = "primary", 
  loading = false, 
  className = "", 
  disabled, 
  ...props 
}: PwaButtonProps) {
  
  const baseStyles = "w-full h-14 rounded-2xl font-bold flex items-center justify-center transition-all duration-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
  
  const variants = {
    primary: "bg-[#7C5CFC] text-white hover:bg-[#684be8] active:scale-[0.98] shadow-[0_8px_20px_rgba(124,92,252,0.3)]",
    secondary: "bg-white text-[#111827] border border-gray-200 hover:bg-gray-50 active:scale-[0.98]",
    danger: "bg-[#EF4444] text-white hover:bg-[#DC2626] active:scale-[0.98] shadow-[0_8px_20px_rgba(239,68,68,0.2)]",
    outline: "bg-transparent text-[#7C5CFC] border-2 border-[#7C5CFC] hover:bg-[#7C5CFC]/5 active:scale-[0.98]"
  }

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : children}
    </button>
  )
}
