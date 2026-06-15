import { createDocument } from "@/lib/firebase/client-utils"

interface PermissionChangeLog {
  professional_id: string
  professional_name: string
  changed_by_user_id: string
  changed_by_name: string
  action: "update_permissions" | "update_profile" | "copy_permissions"
  old_profile_id: string | null
  new_profile_id: string | null
  old_permissions: string[]
  new_permissions: string[]
  source?: string // "profile:admin" or "professional:xyz"
}

export async function logPermissionChange(data: PermissionChangeLog) {
  try {
    await createDocument("permission_audit_logs", {
      ...data,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error("Error logging permission change:", err)
  }
}
