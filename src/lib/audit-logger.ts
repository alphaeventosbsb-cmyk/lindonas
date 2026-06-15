import { createDocument } from "@/lib/firebase/client-utils"

export async function logPermissionChange(
  employeeId: string,
  employeeName: string,
  oldRbacProfile: string,
  newRbacProfile: string,
  oldPermissions: string[],
  newPermissions: string[],
  changedByUserId: string,
  changedByUserName: string
) {
  try {
    const logEntry = {
      action: "permissions_updated",
      target_employee_id: employeeId,
      target_employee_name: employeeName,
      changed_by_user_id: changedByUserId,
      changed_by_user_name: changedByUserName,
      timestamp: new Date().toISOString(),
      details: {
        old_profile: oldRbacProfile,
        new_profile: newRbacProfile,
        old_permissions: oldPermissions,
        new_permissions: newPermissions,
        added_permissions: newPermissions.filter(p => !oldPermissions.includes(p)),
        removed_permissions: oldPermissions.filter(p => !newPermissions.includes(p))
      }
    }
    await createDocument("audit_logs", logEntry)
  } catch (error) {
    console.error("Failed to log permission change:", error)
  }
}
