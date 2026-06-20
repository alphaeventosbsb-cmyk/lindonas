import { createDocument } from "@/lib/firebase/client-utils"

export type NotificationType = 
  | "new_appointment"
  | "appointment_changed"
  | "appointment_cancelled"
  | "reminder"
  | "commission_paid"
  | "credit_added"
  | "debit_added"
  | "system_alert"

export interface SystemNotificationPayload {
  company_id: string
  recipientUserId: string // O ID do usuário (auth_uid do Professional ou Client)
  recipientEmployeeId?: string // O ID do profissional (opcional)
  recipientClientId?: string // O ID do cliente (opcional)
  recipientRole: "cliente" | "profissional"
  type: NotificationType
  title: string
  body: string
  actionUrl?: string // Ex: /pwa/[slug]/cliente/horarios
  appointmentId?: string
}

/**
 * Cria uma notificação no Firestore para ser consumida em tempo real pelo PWA.
 * Sempre requer company_id (multi-tenant safe).
 */
export async function createSystemNotification(payload: SystemNotificationPayload) {
  if (!payload.company_id || !payload.recipientUserId) {
    console.error("Tentativa de criar notificação sem company_id ou recipientUserId", payload)
    return false
  }

  try {
    await createDocument("notifications", {
      ...payload,
      read: false,
      createdAt: new Date().toISOString(),
      deliveredAt: null,
      openedAt: null,
      source: "system"
    })
    return true
  } catch (err) {
    console.error("Erro ao criar notificação:", err)
    return false
  }
}
