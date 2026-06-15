import { createDocument } from "@/lib/firebase/client-utils"
import { serverTimestamp } from "firebase/firestore"

export interface DataAuditLogParams {
  company_id: string
  user_id: string
  user_name: string
  user_email?: string
  action: "EXPORT" | "IMPORT"
  module: string
  format?: "Excel" | "PDF" | string
  file_name?: string
  records_count?: number
  total_lines?: number
  created?: number
  ignored?: number
  duplicated?: number
  errors?: number
  status: "success" | "partial" | "error"
  metadata?: Record<string, unknown>
}

export async function logDataAudit(params: DataAuditLogParams) {
  try {
    await createDocument("data_audit_logs", {
      ...params,
      timestamp: serverTimestamp()
    })
  } catch (error) {
    console.error("Failed to log data audit event:", error)
  }
}
