"use client"
import { useEffect, useState } from "react"
import { Calendar, Phone } from "lucide-react"
import type { BusinessSettings } from "@/lib/types/database"

export function PublicHeader({ companySlug }: { companySlug?: string }) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null)

  useEffect(() => {
    async function loadSettings() {
      try {
        const slugToFetch = companySlug || "default"
        const response = await fetch(`/api/public-booking/${encodeURIComponent(slugToFetch)}`)
        if (response.ok) {
          const data = await response.json()
          if (data && data.company) {
            setSettings({
              business_name: data.company.name,
              logo_url: data.company.logo_url,
              whatsapp: data.company.whatsapp,
              phone: data.company.phone,
              address: data.company.address,
            } as BusinessSettings)
          }
        }
      } catch (err) {
        console.error("Error loading settings:", err)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [companySlug])

  const normalizeWhatsAppNumber = (value?: string | null) => {
    if (!value) return null
    const digits = value.replace(/\D/g, '')
    if (!digits) return null
    if (digits.startsWith('55')) return digits
    return `55${digits}`
  }

  const getWhatsAppLink = (value?: string | null) => {
    const normalized = normalizeWhatsAppNumber(value)
    if (!normalized) return null
    return `https://wa.me/${normalized}`
  }

  const logoUrl = settings?.logo_url
  const businessName = settings?.business_name || "Agendamento Online"
  const address = settings?.address
  const phoneOrWhatsapp = settings?.whatsapp || settings?.phone
  const email = settings?.email
  const whatsappLink = getWhatsAppLink(settings?.whatsapp || settings?.phone)

  return (
    <header className="glass" style={{ borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, zIndex: 50, paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '0.75rem 16px', minHeight: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Logo or Fallback */}
          {logoUrl ? (
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: '1px solid #e8ecf4', background: '#fff' }}>
              <img src={logoUrl} alt={businessName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 2px 8px rgba(124,92,252,0.25)', flexShrink: 0 }}>
              <Calendar style={{ width: '24px', height: '24px', color: '#fff' }} />
            </div>
          )}
          
          {/* Business Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-foreground)', lineHeight: 1.2 }}>
              {businessName}
            </span>
            {/* Additional details */}
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
              {address && <span>{address}</span>}
              {phoneOrWhatsapp && <span>Telefone/WhatsApp: {phoneOrWhatsapp}</span>}
              {email && <span>E-mail: {email}</span>}
            </div>
          </div>
        </div>

        {/* WhatsApp Button */}
        {whatsappLink && (
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '12px', background: '#25D366', color: '#fff', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none', minHeight: '44px', whiteSpace: 'nowrap' }}>
            <Phone style={{ width: '16px', height: '16px' }} /> <span className="hidden sm:inline">WhatsApp</span>
          </a>
        )}
      </div>
    </header>
  )
}
