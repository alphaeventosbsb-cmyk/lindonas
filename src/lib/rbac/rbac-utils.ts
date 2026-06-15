import type { Employee, EmployeePermissions } from "@/lib/types/database"
import { RBAC_MODULES, RBAC_PROFILES, ALL_PERMISSION_KEYS } from "./rbac-types"

// ===================== PERMISSION CHECKS =====================

export function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key)
}

export function hasAnyPermission(permissions: string[], keys: string[]): boolean {
  return keys.some(k => permissions.includes(k))
}

export function hasAllPermissions(permissions: string[], keys: string[]): boolean {
  return keys.every(k => permissions.includes(k))
}

export function getProfilePermissions(profileId: string): string[] {
  return RBAC_PROFILES[profileId]?.permissions || []
}

export function getProfileById(profileId: string) {
  return RBAC_PROFILES[profileId] || null
}

export function getPermissionLabel(key: string): string {
  for (const mod of RBAC_MODULES) {
    const perm = mod.permissions.find(p => p.key === key)
    if (perm) return perm.label
  }
  return key
}

export function countActivePermissions(permissions: string[]): number {
  return permissions.filter(p => ALL_PERMISSION_KEYS.includes(p)).length
}

export function normalizeRBACPermissions(permissions: string[] | null | undefined): string[] {
  if (!Array.isArray(permissions)) return []
  return Array.from(new Set(permissions.filter(p => ALL_PERMISSION_KEYS.includes(p))))
}

export function resolveEmployeeRBACPermissions(
  employee: Pick<Employee, "rbac_permissions" | "rbac_profile_id" | "permissions"> | null | undefined
): string[] {
  if (!employee) return []

  if (Array.isArray(employee.rbac_permissions)) {
    return normalizeRBACPermissions(employee.rbac_permissions)
  }

  if (employee.rbac_profile_id) {
    return normalizeRBACPermissions(getProfilePermissions(employee.rbac_profile_id))
  }

  if (employee.permissions) {
    return normalizeRBACPermissions(migrateOldPermissions(employee.permissions))
  }

  return []
}

// ===================== MIGRATION =====================

const OLD_TO_NEW_MAP: Record<keyof EmployeePermissions, string[]> = {
  canAccessDashboard: ["agenda.view", "clients.view", "services.view"],
  canViewSchedule: ["agenda.view"],
  canCreateAppointments: ["agenda.create"],
  canEditAppointments: ["agenda.edit", "agenda.reschedule", "agenda.drag"],
  canCancelAppointments: ["agenda.cancel"],
  canViewClients: ["clients.view", "clients.history", "clients.ranking"],
  canEditClients: ["clients.create", "clients.edit"],
  canViewFinancial: ["finance.view", "cash.view", "commissions.view", "reports.view"],
  canManageInventory: ["products.view", "products.create", "products.edit", "products.delete", "inventory.view", "inventory.movement.in", "inventory.movement.out"],
  canReceiveNotifications: [],
  showOnPublicBooking: [],
}

export function migrateOldPermissions(old: EmployeePermissions): string[] {
  const perms = new Set<string>()
  for (const key of Object.keys(OLD_TO_NEW_MAP) as (keyof EmployeePermissions)[]) {
    const newKeys = OLD_TO_NEW_MAP[key]
    if (old[key]) {
      newKeys.forEach(k => perms.add(k))
    }
  }
  return Array.from(perms)
}

// ===================== DATA MASKING =====================

export function maskCPF(cpf: string | null | undefined): string {
  if (!cpf) return "—"
  return "***.***.***-**"
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—"
  const clean = phone.replace(/\D/g, "")
  if (clean.length >= 4) {
    return `(${clean.slice(0, 2)}) *****-${clean.slice(-4)}`
  }
  return "***"
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—"
  const [local, domain] = email.split("@")
  if (!domain) return "***"
  return `${local.charAt(0)}***@${domain}`
}
