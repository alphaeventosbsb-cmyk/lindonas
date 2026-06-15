"use client"

import { useState, useEffect } from "react"
import { X, ZoomIn } from "lucide-react"

interface ExpandableImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  // Option to disable preview explicitly if needed
  disablePreview?: boolean
}

export function ExpandableImage({ src, alt, style, className, disablePreview, ...props }: ExpandableImageProps) {
  const [open, setOpen] = useState(false)
  const isEnabled = !disablePreview && !!src

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handleKeyDown)
    // Prevent scrolling behind modal
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [open])

  if (!src) return null

  return (
    <>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <img
          src={src}
          alt={alt}
          className={className}
          style={{ 
            ...style, 
            cursor: isEnabled ? 'pointer' : (style?.cursor || 'default') 
          }}
          onClick={(e) => {
            if (isEnabled) {
              e.stopPropagation()
              setOpen(true)
            }
            props.onClick?.(e)
          }}
          {...props}
        />
        {isEnabled && (
          <div 
            style={{
              position: 'absolute',
              bottom: '4px',
              right: '4px',
              background: 'rgba(0,0,0,0.5)',
              borderRadius: '50%',
              padding: '4px',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ZoomIn size={12} color="#fff" />
          </div>
        )}
      </div>

      {open && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 999999, // Ensure it's above sidebars and other modals
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
            style={{
              position: 'absolute',
              top: '1.5rem',
              right: '1.5rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              padding: '0.5rem',
            }}
            title="Fechar (ESC)"
            aria-label="Fechar ampliação de imagem"
          >
            <X size={32} />
          </button>
          
          <img
            src={src}
            alt={alt}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '0.5rem',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()} // Clicking the image itself shouldn't close it
          />
        </div>
      )}
    </>
  )
}
