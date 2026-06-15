"use client"

import { useState, useEffect } from "react"
import { subscribeCollection } from "@/lib/firebase/client-utils"
import type { CustomRBACProfile } from "@/lib/types/database"
import { PROFILE_OPTIONS, RBACProfile } from "./rbac-types"

export interface CombinedProfile {
  id: string
  name: string
  description: string
  permissions: string[]
  isSystem: boolean
  is_active: boolean
  company_id: string
  created_at: string
  updated_at: string
  /** True if this system profile has a Firestore override document */
  hasOverride: boolean
}

export function useCustomProfiles() {
  const [customProfiles, setCustomProfiles] = useState<CustomRBACProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = subscribeCollection<CustomRBACProfile>(
      "rbac_profiles",
      (items) => {
        setCustomProfiles(items)
        setLoading(false)
      },
      (err) => {
        console.error("Error subscribing to custom profiles:", err)
        setLoading(false)
      }
    )

    return () => unsub()
  }, [])

  // Combina os perfis estáticos do sistema com os customizados
  const systemProfilesMapped: CombinedProfile[] = PROFILE_OPTIONS.map(p => {
    const override = customProfiles.find(custom => custom.id === p.id)
    if (override) {
      return {
        id: override.id,
        name: override.name || p.name,
        description: override.description || p.description,
        permissions: override.permissions || p.permissions,
        isSystem: true,
        is_active: override.is_active !== false,
        company_id: override.company_id || "",
        created_at: override.created_at || "",
        updated_at: override.updated_at || "",
        hasOverride: true,
      }
    }
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      permissions: p.permissions,
      isSystem: true,
      is_active: true,
      company_id: "",
      created_at: "",
      updated_at: "",
      hasOverride: false,
    }
  })

  // Apenas perfis puramente customizados que não sobrescrevem um do sistema
  const purelyCustomProfiles = customProfiles.filter(p => !PROFILE_OPTIONS.some(sys => sys.id === p.id))

  const customProfilesMapped: CombinedProfile[] = purelyCustomProfiles.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    permissions: p.permissions || [],
    isSystem: false,
    is_active: p.is_active !== false,
    company_id: p.company_id || "",
    created_at: p.created_at || "",
    updated_at: p.updated_at || "",
    hasOverride: false,
  }))

  const combinedProfiles = [...systemProfilesMapped, ...customProfilesMapped]

  return {
    customProfiles,
    combinedProfiles,
    loading
  }
}
