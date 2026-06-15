"use client"
import { useState, useCallback } from "react"
import { AlertCircle } from "lucide-react"

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "danger"
}

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [promise, setPromise] = useState<{ resolve: (value: boolean) => void } | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setOptions(opts)
      setPromise({ resolve })
    })
  }, [])

  const handleClose = useCallback(() => {
    setOptions(null)
    setPromise(null)
  }, [])

  const handleConfirm = useCallback(() => {
    promise?.resolve(true)
    handleClose()
  }, [promise, handleClose])

  const handleCancel = useCallback(() => {
    promise?.resolve(false)
    handleClose()
  }, [promise, handleClose])

  const ConfirmationDialog = () => {
    if (!options) return null

    return (
      <>
        <div onClick={handleCancel} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          zIndex: 99999, animation: 'modalFadeIn 0.15s ease-out',
        }} />
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 100000, background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '400px',
          padding: '1.5rem', boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
          animation: 'modalScaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{
              width: '3.5rem', height: '3.5rem', borderRadius: '1rem',
              background: options.variant === 'danger' ? '#fef2f2' : '#fffbeb',
              border: `1px solid ${options.variant === 'danger' ? '#fecaca' : '#fde68a'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1rem',
            }}>
              <AlertCircle style={{ width: '1.75rem', height: '1.75rem', color: options.variant === 'danger' ? '#dc2626' : '#d97706' }} />
            </div>

            <h3 style={{
              fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 800,
              color: '#1e1e2d', marginBottom: '0.5rem',
            }}>
              {options.title}
            </h3>

            <p style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.5, marginBottom: '1.5rem', whiteSpace: 'pre-wrap' }}>
              {options.message}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button
                onClick={handleCancel}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '0.75rem',
                  border: '2px solid #e8ecf4', background: '#fff', color: '#374151',
                  fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', minHeight: '48px',
                }}
              >
                {options.cancelText || "Cancelar"}
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none',
                  background: options.variant === 'danger' 
                    ? 'linear-gradient(135deg, #dc2626, #ef4444)' 
                    : 'linear-gradient(135deg, #7c5cfc, #a78bfa)',
                  color: '#fff', fontWeight: 700, fontSize: '0.875rem',
                  cursor: 'pointer', minHeight: '48px',
                  boxShadow: options.variant === 'danger' 
                    ? '0 4px 14px rgba(220,38,38,0.3)' 
                    : '0 4px 14px rgba(124,92,252,0.3)',
                }}
              >
                {options.confirmText || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return { ConfirmationDialog, confirm }
}
