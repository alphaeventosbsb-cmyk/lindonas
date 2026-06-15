"use client"

import { usePermission } from "@/lib/rbac/usePermission"
import type { ReactNode } from "react"

interface Props {
  permission: string | string[]
  mode?: "any" | "all"
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGate({ permission, mode = "any", children, fallback = null }: Props) {
  const { can, canAny, canAll } = usePermission()

  const keys = Array.isArray(permission) ? permission : [permission]
  const allowed = mode === "all" ? canAll(keys) : canAny(keys)

  if (!allowed) return <>{fallback}</>
  return <>{children}</>
}
