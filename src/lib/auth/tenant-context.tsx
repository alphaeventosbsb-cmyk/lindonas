"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { getAuthInstance } from "@/lib/firebase/config"
import { onAuthStateChanged, type User } from "firebase/auth"
import { createDocument, fetchCollectionWhere, getDocument, updateDocument } from "@/lib/firebase/client-utils"
import { doc, onSnapshot } from "firebase/firestore"
import { getDb } from "@/lib/firebase/config"
import type { SaaSUser, Company, Employee, EmployeePermissions } from "@/lib/types/database"
import { ALL_PERMISSION_KEYS } from "@/lib/rbac/rbac-types"
import { normalizeRBACPermissions, resolveEmployeeRBACPermissions } from "@/lib/rbac/rbac-utils"
import { isSuperAdmin, normalizeAuthEmail } from "@/lib/auth/super-admin"

type SaaSUserWithProfessional = SaaSUser & { professional_id?: string | null }
type AdminEmailContainer = { authorized_admin_emails?: string[]; company_id?: string | null }

const fullPermissions: EmployeePermissions = {
  canAccessDashboard: true,
  canViewSchedule: true,
  canCreateAppointments: true,
  canEditAppointments: true,
  canCancelAppointments: true,
  canViewClients: true,
  canEditClients: true,
  canViewFinancial: true,
  canManageInventory: true,
  canReceiveNotifications: true,
  showOnPublicBooking: true,
}

const emptyPermissions: EmployeePermissions = {
  canAccessDashboard: false,
  canViewSchedule: false,
  canCreateAppointments: false,
  canEditAppointments: false,
  canCancelAppointments: false,
  canViewClients: false,
  canEditClients: false,
  canViewFinancial: false,
  canManageInventory: false,
  canReceiveNotifications: false,
  showOnPublicBooking: false,
}

function legacyPermissionsFromRBAC(rbacPermissions: string[], employee?: Employee | null): EmployeePermissions {
  const has = (key: string) => rbacPermissions.includes(key)
  const hasAny = (keys: string[]) => keys.some(has)

  return {
    canAccessDashboard: rbacPermissions.length > 0,
    canViewSchedule: hasAny(["agenda.view", "agenda.view_own"]),
    canCreateAppointments: has("agenda.create"),
    canEditAppointments: hasAny(["agenda.edit", "agenda.reschedule", "agenda.drag"]),
    canCancelAppointments: has("agenda.cancel"),
    canViewClients: has("clients.view"),
    canEditClients: hasAny(["clients.create", "clients.edit"]),
    canViewFinancial: hasAny(["finance.view", "cash.view", "commissions.view", "commissions.view_own", "reports.view"]),
    canManageInventory: hasAny(["products.view", "inventory.view"]),
    canReceiveNotifications: employee?.permissions?.canReceiveNotifications ?? true,
    showOnPublicBooking: employee?.permissions?.showOnPublicBooking ?? true,
  }
}

function virtualSuperAdminUser(firebaseUser: User): SaaSUser {
  return {
    id: "__super_admin__",
    company_id: "__master__",
    firebase_uid: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email || "Super Admin",
    email: firebaseUser.email || "",
    phone: null,
    role: "master_admin",
    permissions: ALL_PERMISSION_KEYS,
    is_active: true,
    updated_at: new Date().toISOString(),
  }
}

async function findLinkedEmployee(firebaseUser: User): Promise<Employee | null> {
  const byUid = await fetchCollectionWhere<Employee>("employees", "auth_uid", "==", firebaseUser.uid)
  if (byUid.length > 0) return byUid[0]

  const email = normalizeAuthEmail(firebaseUser.email)
  if (!email) return null

  const byGoogleEmail = await fetchCollectionWhere<Employee>("employees", "google_email", "==", email)
  if (byGoogleEmail.length > 0) return byGoogleEmail[0]

  const byEmployeeEmail = await fetchCollectionWhere<Employee>("employees", "email", "==", email)
  return byEmployeeEmail[0] || null
}

async function upsertProfessionalSaasUser(firebaseUser: User, employee: Employee, existingUser?: SaaSUser | null): Promise<SaaSUser> {
  const now = new Date().toISOString()
  const data = {
    company_id: employee.company_id || null,
    firebase_uid: firebaseUser.uid,
    name: employee.name || firebaseUser.displayName || firebaseUser.email || "Profissional",
    email: normalizeAuthEmail(firebaseUser.email) || employee.google_email || employee.email || null,
    phone: employee.phone || null,
    role: "professional" as const,
    professional_id: employee.id,
    permissions: resolveEmployeeRBACPermissions(employee),
    is_active: employee.access_enabled !== false,
    updated_at: now,
  }

  if (existingUser?.id && !existingUser.id.startsWith("__")) {
    try {
      await updateDocument("saas_users", existingUser.id, data)
    } catch (error) {
      console.warn("Could not update SaaS user role locally:", error)
    }
    return { ...existingUser, ...data } as SaaSUser
  }

  try {
    const created = await createDocument("saas_users", {
      ...data,
      created_at: now,
    })
    return created as SaaSUser
  } catch (error) {
    console.warn("Could not create SaaS user locally:", error)
    return { id: "__professional__", ...data, created_at: now } as SaaSUser
  }
}

interface TenantContextType {
  user: User | null
  saasUser: SaaSUser | null
  company: Company | null
  companyId: string | null
  role: string | null
  loading: boolean
  isSuperAdmin: boolean
  isMasterAdmin: boolean
  isProfessional: boolean
  isOwner: boolean
  employee: Employee | null
  permissions: EmployeePermissions
  rbacPermissions: string[]
  isBlocked: boolean
  isTrialExpired: boolean
  refreshContext: () => Promise<void>
}

const TenantContext = createContext<TenantContextType>({
  user: null,
  saasUser: null,
  company: null,
  companyId: null,
  role: null,
  loading: true,
  isSuperAdmin: false,
  isMasterAdmin: false,
  isProfessional: false,
  isOwner: false,
  employee: null,
  permissions: emptyPermissions,
  rbacPermissions: [],
  isBlocked: false,
  isTrialExpired: false,
  refreshContext: async () => {},
})

export const useTenant = () => useContext(TenantContext)

export function TenantProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [saasUser, setSaasUser] = useState<SaaSUser | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)

  const resetTenantState = useCallback(() => {
    setSaasUser(null)
    setCompany(null)
    setEmployee(null)
  }, [])

  const loadUserData = useCallback(async (firebaseUser: User) => {
    resetTenantState()

    try {
      const superAdmin = isSuperAdmin(firebaseUser.email)
      let users = await fetchCollectionWhere<SaaSUser>("saas_users", "firebase_uid", "==", firebaseUser.uid)
      let currentUser = users[0] || null
      let linkedEmployee: Employee | null = null

      if (!superAdmin) {
        const professionalId = (currentUser as SaaSUserWithProfessional | null)?.professional_id
        if (professionalId) {
          linkedEmployee = await getDocument<Employee>("employees", professionalId)
        }

        if (!linkedEmployee) {
          linkedEmployee = await findLinkedEmployee(firebaseUser)
        }

        if (linkedEmployee) {
          currentUser = await upsertProfessionalSaasUser(firebaseUser, linkedEmployee, currentUser)
          users = [currentUser]
          setEmployee(linkedEmployee)
        }
      }

      if (superAdmin) {
        let defaultName = firebaseUser.displayName || firebaseUser.email || "Super Admin"
        if (firebaseUser.email?.toLowerCase() === 'carbeto34@gmail.com') {
          defaultName = "Carbeto / Admin"
        } else if (firebaseUser.email?.toLowerCase() === 'alphaeventosbsb@gmail.com') {
          defaultName = "Alpha / Admin"
        }

        if (!currentUser) {
          currentUser = virtualSuperAdminUser(firebaseUser)
          currentUser.name = defaultName
          try {
            const created = await createDocument("saas_users", {
              company_id: "__master__",
              firebase_uid: firebaseUser.uid,
              name: defaultName,
              email: normalizeAuthEmail(firebaseUser.email),
              phone: null,
              role: "master_admin",
              permissions: ALL_PERMISSION_KEYS,
              is_active: true,
            })
            currentUser = created as SaaSUser
          } catch (error) {
            console.warn("Could not persist super admin user locally:", error)
          }
          users = [currentUser]
        } else {
          const updates: any = {}
          if (currentUser.role !== "master_admin") {
            updates.role = "master_admin"
            updates.permissions = ALL_PERMISSION_KEYS
          }
          if (!currentUser.is_active) {
            updates.is_active = true
          }
          
          const lowerName = (currentUser.name || "").toLowerCase()
          if (lowerName.includes("katia") || lowerName === "profissional") {
            updates.name = defaultName
          }

          if (Object.keys(updates).length > 0) {
            try {
              await updateDocument("saas_users", currentUser.id, updates)
            } catch (error) {
              console.warn("Could not persist super admin role locally:", error)
            }
            currentUser = { ...currentUser, ...updates }
          }
          users = [currentUser]
        }
      }

      // Legacy company co-admin support. Professional links above always win.
      if (users.length === 0 && firebaseUser.email) {
        const { collection, getDocs } = await import("firebase/firestore")
        const { getDb } = await import("@/lib/firebase/config")

        let matchedCompanyId: string | null = null
        const normalizedEmail = normalizeAuthEmail(firebaseUser.email)

        try {
          const settingsSnap = await getDocs(collection(getDb(), "settings"))
          settingsSnap.forEach((doc) => {
            const data = doc.data() as AdminEmailContainer
            const emails: string[] = data.authorized_admin_emails || []
            if (emails.map(normalizeAuthEmail).includes(normalizedEmail) && data.company_id) {
              matchedCompanyId = data.company_id
            }
          })
        } catch {
          // Ignore permission errors from optional legacy checks.
        }

        if (!matchedCompanyId) {
          try {
            const companiesSnap = await getDocs(collection(getDb(), "companies"))
            companiesSnap.forEach((doc) => {
              const data = doc.data() as AdminEmailContainer
              const emails: string[] = data.authorized_admin_emails || []
              if (emails.map(normalizeAuthEmail).includes(normalizedEmail)) {
                matchedCompanyId = doc.id
              }
            })
          } catch {
            // Ignore permission errors from optional legacy checks.
          }
        }

        if (matchedCompanyId) {
          const created = await createDocument("saas_users", {
            company_id: matchedCompanyId,
            firebase_uid: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email,
            email: normalizedEmail,
            phone: null,
            role: "business_owner",
            permissions: [],
            is_active: true,
          })
          users = [created as SaaSUser]
        }
      }

      if (users.length > 0) {
        const su = users[0]
        setSaasUser(su)

        if (su.company_id && su.company_id !== "__master__" && su.role !== "master_admin") {
          const comp = await getDocument<Company>("companies", su.company_id)
          if (comp) setCompany(comp)
        }

        const professionalId = (su as SaaSUserWithProfessional).professional_id
        if (!superAdmin && professionalId && !linkedEmployee) {
          try {
            const emp = await getDocument<Employee>("employees", professionalId)
            if (emp) setEmployee(emp)
          } catch (err) {
            console.error("Error loading employee record:", err)
          }
        }
      } else if (superAdmin) {
        setSaasUser(virtualSuperAdminUser(firebaseUser))
      }
    } catch (err) {
      console.error("Error loading tenant context:", err)
    }
  }, [resetTenantState])

  const refreshContext = async () => {
    if (user) {
      setLoading(true)
      await loadUserData(user)
      setLoading(false)
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuthInstance(), async (u) => {
      setLoading(true)
      setUser(u)
      resetTenantState()

      if (u) {
        await loadUserData(u)
      }

      setLoading(false)
    })
    return () => unsub()
  }, [loadUserData, resetTenantState])

  useEffect(() => {
    const professionalId = (saasUser as SaaSUserWithProfessional | null)?.professional_id
    if (!isSuperAdmin(user?.email) && professionalId) {
      const unsub = onSnapshot(doc(getDb(), "employees", professionalId), (docSnap) => {
        if (docSnap.exists()) {
          setEmployee({ id: docSnap.id, ...docSnap.data() } as Employee)
        }
      })
      return () => unsub()
    }
  }, [saasUser, user?.email])

  const isSuperAdminUser = isSuperAdmin(user?.email)
  const companyId = saasUser?.company_id && saasUser.company_id !== "__master__" ? saasUser.company_id : null
  const role = isSuperAdminUser ? "master_admin" : (saasUser?.role || null)
  const professionalId = !isSuperAdminUser ? (saasUser as SaaSUserWithProfessional | null)?.professional_id : null
  const isMasterAdmin = isSuperAdminUser
  const isProfessional = !isSuperAdminUser && (role === "professional" || !!professionalId || !!employee)
  const isOwner = !isSuperAdminUser && role === "business_owner" && !professionalId

  const rbacPermissions: string[] = (() => {
    if (isSuperAdminUser || isOwner) return ALL_PERMISSION_KEYS
    if (isProfessional) {
      if (!employee || employee.access_enabled === false) return []
      return resolveEmployeeRBACPermissions(employee)
    }
    return normalizeRBACPermissions(saasUser?.permissions || [])
  })()

  const permissions: EmployeePermissions = (() => {
    if (isSuperAdminUser || isOwner) return fullPermissions
    if (isProfessional) return legacyPermissionsFromRBAC(rbacPermissions, employee)
    return rbacPermissions.length > 0 ? legacyPermissionsFromRBAC(rbacPermissions) : emptyPermissions
  })()

  const isBlocked = company?.is_blocked === true
  const isTrialExpired = (() => {
    if (!company) return false
    if (company.subscription_status === "trial" && company.trial_ends_at) {
      return new Date(company.trial_ends_at) < new Date()
    }
    return company.subscription_status === "blocked"
  })()

  return (
    <TenantContext.Provider value={{
      user,
      saasUser,
      company,
      companyId,
      role,
      loading,
      isSuperAdmin: isSuperAdminUser,
      isMasterAdmin,
      isProfessional,
      isOwner,
      employee,
      permissions,
      rbacPermissions,
      isBlocked,
      isTrialExpired,
      refreshContext,
    }}>
      {children}
    </TenantContext.Provider>
  )
}
