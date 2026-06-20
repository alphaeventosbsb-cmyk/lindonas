"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"
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
        const companies = await fetchCollectionWhere("companies", "slug", "==", slug)
        if (companies && companies.length > 0) {
          setCompanyId(companies[0].id)
          setCompanyName(companies[0].name)
          setCompanyLogo(companies[0].logo_url || null)
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
