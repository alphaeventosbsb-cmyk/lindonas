import { getDb } from "./config"
import { collection, addDoc, getDocs, query, where, orderBy } from "firebase/firestore"

export interface CreateHistoryEventParams {
  client_id?: string | null
  client_name?: string | null
  appointment_id?: string | null
  action_type: string
  action_title: string
  action_description: string
  old_value?: any | null
  new_value?: any | null
  service_id?: string | null
  service_name?: string | null
  professional_id?: string | null
  professional_name?: string | null
  performed_by_user_id: string
  performed_by_name: string
  performed_by_email?: string | null
  performed_by_role?: string | null
  metadata?: Record<string, any>
}

export interface HistoryEvent extends CreateHistoryEventParams {
  id: string
  created_at: string
}

export async function createHistoryEvent(params: CreateHistoryEventParams) {
  try {
    const colRef = collection(getDb(), "appointment_history")
    await addDoc(colRef, {
      client_id: params.client_id || null,
      client_name: params.client_name || null,
      appointment_id: params.appointment_id || null,
      action_type: params.action_type,
      action_title: params.action_title,
      action_description: params.action_description,
      old_value: params.old_value !== undefined ? params.old_value : null,
      new_value: params.new_value !== undefined ? params.new_value : null,
      service_id: params.service_id || null,
      service_name: params.service_name || null,
      professional_id: params.professional_id || null,
      professional_name: params.professional_name || null,
      performed_by_user_id: params.performed_by_user_id,
      performed_by_name: params.performed_by_name,
      performed_by_email: params.performed_by_email || null,
      performed_by_role: params.performed_by_role || null,
      metadata: params.metadata || {},
      created_at: new Date().toISOString()
    })
  } catch (err) {
    console.error("Error creating history event:", err)
  }
}

export async function getClientHistory(clientId: string): Promise<HistoryEvent[]> {
  try {
    const q = query(
      collection(getDb(), "appointment_history"),
      where("client_id", "==", clientId),
      // To use orderBy on a different field than equality, a composite index might be needed in Firestore.
      // But we can fetch and sort locally if there are not thousands per client.
      orderBy("created_at", "desc")
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as HistoryEvent)
  } catch (err) {
    console.error("Error fetching client history:", err)
    // Fallback if index is missing (often happens in Firestore without manual index creation)
    if ((err as any)?.code === 'failed-precondition') {
       const qFallback = query(collection(getDb(), "appointment_history"), where("client_id", "==", clientId))
       const fallbackSnap = await getDocs(qFallback)
       const docs = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }) as HistoryEvent)
       return docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return []
  }
}

export async function getAppointmentHistory(appointmentId: string): Promise<HistoryEvent[]> {
  try {
    const q = query(
      collection(getDb(), "appointment_history"),
      where("appointment_id", "==", appointmentId),
      orderBy("created_at", "desc")
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as HistoryEvent)
  } catch (err) {
    console.error("Error fetching appointment history:", err)
    if ((err as any)?.code === 'failed-precondition') {
       const qFallback = query(collection(getDb(), "appointment_history"), where("appointment_id", "==", appointmentId))
       const fallbackSnap = await getDocs(qFallback)
       const docs = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }) as HistoryEvent)
       return docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return []
  }
}
