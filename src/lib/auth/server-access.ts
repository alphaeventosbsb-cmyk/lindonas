import { NextResponse } from "next/server"
import { adminAuth, adminDb } from "@/lib/firebase/admin"
import { isSuperAdmin, normalizeAuthEmail } from "@/lib/auth/super-admin"
import { ALL_PERMISSION_KEYS } from "@/lib/rbac/rbac-types"
import { normalizeRBACPermissions, resolveEmployeeRBACPermissions } from "@/lib/rbac/rbac-utils"
import type { Employee } from "@/lib/types/database"

export interface RequestAccess {
  authenticated: boolean
  uid: string | null
  email: string | null
  isSuperAdmin: boolean
  isOwner: boolean
  isProfessional: boolean
  employee: Employee | null
  permissions: string[]
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || ""
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || null
}

async function getEmployeeById(id?: string | null): Promise<Employee | null> {
  if (!id) return null
  const snap = await adminDb.collection("employees").doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...snap.data() } as Employee
}

async function findEmployeeForUser(uid: string, email: string | null): Promise<Employee | null> {
  const byUid = await adminDb.collection("employees").where("auth_uid", "==", uid).limit(1).get()
  if (!byUid.empty) {
    const doc = byUid.docs[0]
    return { id: doc.id, ...doc.data() } as Employee
  }

  if (!email) return null

  const byGoogleEmail = await adminDb.collection("employees").where("google_email", "==", email).limit(1).get()
  if (!byGoogleEmail.empty) {
    const doc = byGoogleEmail.docs[0]
    return { id: doc.id, ...doc.data() } as Employee
  }

  const byEmployeeEmail = await adminDb.collection("employees").where("email", "==", email).limit(1).get()
  if (!byEmployeeEmail.empty) {
    const doc = byEmployeeEmail.docs[0]
    return { id: doc.id, ...doc.data() } as Employee
  }

  return null
}

export async function getRequestAccess(request: Request): Promise<RequestAccess> {
  const token = getBearerToken(request)
  if (!token) {
    return {
      authenticated: false,
      uid: null,
      email: null,
      isSuperAdmin: false,
      isOwner: false,
      isProfessional: false,
      employee: null,
      permissions: [],
    }
  }

  const decoded = await adminAuth.verifyIdToken(token)
  const uid = decoded.uid
  const email = normalizeAuthEmail(decoded.email)
  const superAdmin = isSuperAdmin(email)

  if (superAdmin) {
    return {
      authenticated: true,
      uid,
      email,
      isSuperAdmin: true,
      isOwner: false,
      isProfessional: false,
      employee: null,
      permissions: ALL_PERMISSION_KEYS,
    }
  }

  const saasSnap = await adminDb.collection("saas_users").where("firebase_uid", "==", uid).limit(1).get()
  const saasUser = saasSnap.empty ? null : saasSnap.docs[0].data()
  const employee = await getEmployeeById(saasUser?.professional_id || null) || await findEmployeeForUser(uid, email)
  const isProfessional = !!employee || saasUser?.role === "professional"

  if (employee) {
    return {
      authenticated: true,
      uid,
      email,
      isSuperAdmin: false,
      isOwner: false,
      isProfessional: true,
      employee,
      permissions: employee.access_enabled === false ? [] : resolveEmployeeRBACPermissions(employee),
    }
  }

  const isOwner = saasUser?.role === "business_owner"
  return {
    authenticated: true,
    uid,
    email,
    isSuperAdmin: false,
    isOwner,
    isProfessional,
    employee: null,
    permissions: isOwner ? ALL_PERMISSION_KEYS : normalizeRBACPermissions(saasUser?.permissions || []),
  }
}

export function hasAnyApiPermission(access: RequestAccess, permissions: string[]): boolean {
  if (access.isSuperAdmin || access.isOwner) return true
  return permissions.some(permission => access.permissions.includes(permission))
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "UNAUTHORIZED", message: "Autenticacao obrigatoria." },
    { status: 401 }
  )
}

export function forbiddenResponse() {
  return NextResponse.json(
    { error: "FORBIDDEN", message: "Voce nao tem permissao para executar esta acao." },
    { status: 403 }
  )
}
