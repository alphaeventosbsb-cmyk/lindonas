"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"
import { resolvePWATenantBySlug } from "@/lib/pwa/tenant-resolver"
import { getAuthInstance } from "@/lib/firebase/config"
import { onAuthStateChanged, type User } from "firebase/auth"

interface PWATenantContextProps {
  slug: string
  companyId: string | null
  companyName: string | null
  companyLogo: string | null
  user: User | null
  loading: boolean
}

const PWATenantContext = createContext<PWATenantContextProps>({
  slug: "",
  companyId: null,
  companyName: null,
  companyLogo: null,
  user: null,
  loading: true,
})

export function PWATenantProvider({ slug, children }: { slug: string, children: ReactNode }) {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const company = await resolvePWATenantBySlug(slug)
        if (company) {
          setCompanyId(company.id)
          setCompanyName(company.name || company.business_name)
          setCompanyLogo(company.logo_url || null)
        } else {
          console.error(`Slug recebido: ${slug}\nNenhum estabelecimento encontrado com esse slug\nVerifique se existe pwa_slug ou slug no documento settings/company`)
        }
      } catch (err) {
        console.error("Failed to load PWA tenant:", err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [slug])

  useEffect(() => {
    const auth = getAuthInstance()
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
    })
    return () => unsubscribe()
  }, [])

  return (
    <PWATenantContext.Provider value={{ slug, companyId, companyName, companyLogo, user, loading }}>
      {children}
    </PWATenantContext.Provider>
  )
}

export const usePWATenant = () => useContext(PWATenantContext)
