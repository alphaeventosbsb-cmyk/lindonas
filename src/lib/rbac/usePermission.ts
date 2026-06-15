"use client"

import { useTenant } from "@/lib/auth/tenant-context"
import { useCallback } from "react"

export function usePermission() {
  const { rbacPermissions } = useTenant()

  const can = useCallback((key: string): boolean => {
    return rbacPermissions.includes(key)
  }, [rbacPermissions])

  const canAny = useCallback((keys: string[]): boolean => {
    return keys.some(k => rbacPermissions.includes(k))
  }, [rbacPermissions])

  const canAll = useCallback((keys: string[]): boolean => {
    return keys.every(k => rbacPermissions.includes(k))
  }, [rbacPermissions])

  return { can, canAny, canAll, permissions: rbacPermissions }
}
