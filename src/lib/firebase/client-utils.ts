import { getDb } from "./config"
import {
  collection, getDocs, query, where, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc, addDoc, getDoc, setDoc,
  type WhereFilterOp, type Unsubscribe
} from "firebase/firestore"
import type { Appointment } from "@/lib/types/database"

const db = () => getDb()

export async function fetchCollection<T>(
  collectionName: string,
  orderByField?: string,
  direction: "asc" | "desc" = "asc"
): Promise<T[]> {
  try {
    let q = collection(db(), collectionName) as any
    if (orderByField) {
      q = query(q, orderBy(orderByField, direction))
    }
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }) as T)
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn(`Permission denied fetching ${collectionName}.`);
    } else {
      console.error(`Error fetching ${collectionName}:`, error)
    }
    return []
  }
}

export async function fetchCollectionWhere<T>(
  collectionName: string,
  field: string,
  operator: WhereFilterOp,
  value: any
): Promise<T[]> {
  try {
    const q = query(collection(db(), collectionName), where(field, operator, value))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }) as T)
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn(`Permission denied fetching ${collectionName}.`);
    } else {
      console.error(`Error fetching ${collectionName}:`, error)
    }
    return []
  }
}

export async function fetchCollectionWithQueries<T>(
  collectionName: string,
  queries: { field: string; operator: WhereFilterOp; value: any }[]
): Promise<T[]> {
  try {
    let q = collection(db(), collectionName) as any
    for (const item of queries) {
      if (item.value !== undefined) {
        q = query(q, where(item.field, item.operator, item.value))
      }
    }
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }) as T)
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn(`Permission denied fetching ${collectionName}.`);
    } else {
      console.error(`Error fetching ${collectionName} with queries:`, error)
    }
    return []
  }
}

const TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error("A operação excedeu o tempo limite. Verifique sua conexão com a internet ou se o limite de uso do banco de dados (Cota do Firebase) foi atingido.")), TIMEOUT_MS)
    )
  ]);
}

export async function createDocument(collectionName: string, data: any) {
  const bypassAppointmentOverlap = data._bypass_appointment_overlap
  const bypassBlock = data._bypass_block
  if (data._bypass_appointment_overlap !== undefined) delete data._bypass_appointment_overlap
  if (data._bypass_block !== undefined) delete data._bypass_block
  if (data._bypass_conflict !== undefined) delete data._bypass_conflict

  if (collectionName === "appointments" && data.employee_id && data.appointment_date && data.appointment_time && data.duration_minutes) {
    const q = query(collection(db(), "appointments"),
      where("employee_id", "==", data.employee_id),
      where("appointment_date", "==", data.appointment_date)
    )
    const snap = await getDocs(q)
    const [h, m] = data.appointment_time.split(':').map(Number)
    const aptStart = h * 60 + m
    const aptEnd = aptStart + data.duration_minutes
    const blockingStatuses = ["pending", "confirmed", "waiting", "in_progress", "completed", "payment_pending"]
    
    const hasConflict = snap.docs.some(d => {
      const a = d.data() as Appointment
      if (a.status === 'cancelled') return false
      if (a.type === 'absence' || a.type === 'free') return false
      if (a.type !== 'block' && (!a.status || !blockingStatuses.includes(a.status))) return false
      
      const [ah, am] = (a.appointment_time || "00:00").split(':').map(Number)
      const aStart = ah * 60 + am
      const aEnd = aStart + (a.duration_minutes || 0)
      
      const overlaps = aptStart < aEnd && aptEnd > aStart
      if (!overlaps) return false
      
      if (a.type === 'block') {
        if (!bypassBlock) return true
        return false // Bypassed block
      }
      
      if (!bypassAppointmentOverlap) return true
      return false // Bypassed overlap
    })
    
    if (hasConflict) {
      throw new Error("Horário indisponível. Já existe um agendamento para este profissional neste período.")
    }
  }

  const colRef = collection(db(), collectionName)
  const docRef = await withTimeout(addDoc(colRef, {
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))
  const newDoc = await getDoc(docRef)
  return { id: newDoc.id, ...newDoc.data() }
}

export async function updateDocument(collectionName: string, id: string, data: any) {
  const docRef = doc(db(), collectionName, id)
  await withTimeout(updateDoc(docRef, { ...data, updated_at: new Date().toISOString() }))
  const updated = await getDoc(docRef)
  return { id: updated.id, ...updated.data() }
}

export async function setDocument(collectionName: string, id: string, data: any) {
  const docRef = doc(db(), collectionName, id)
  await withTimeout(setDoc(docRef, { 
    ...data, 
    updated_at: new Date().toISOString() 
  }, { merge: true }))
  const updated = await getDoc(docRef)
  return { id: updated.id, ...updated.data() }
}

export async function createAppointmentLog(
  appointmentId: string,
  actionType: string,
  actionLabel: string,
  description: string,
  user: { id: string; name: string; role?: string } | null
) {
  try {
    const colRef = collection(db(), "appointment_logs")
    await withTimeout(addDoc(colRef, {
      appointment_id: appointmentId,
      action_type: actionType,
      action_label: actionLabel,
      description: description,
      user_id: user?.id || "system",
      user_name: user?.name || "Sistema",
      user_role: user?.role || "system",
      created_at: new Date().toISOString()
    }))
  } catch (err) {
    console.error("Error creating appointment log:", err)
  }
}

export async function updateAppointment(
  appointmentId: string,
  updateData: any,
  actionType: string,
  actionLabel: string,
  description: string,
  user: { id: string; name: string; role?: string; email?: string } | null,
  historyData?: {
    client_id?: string
    client_name?: string
    old_value?: any
    new_value?: any
    service_id?: string
    service_name?: string
    professional_id?: string
    professional_name?: string
  }
) {
  const bypassAppointmentOverlap = updateData._bypass_appointment_overlap
  const bypassBlock = updateData._bypass_block
  if (updateData._bypass_appointment_overlap !== undefined) delete updateData._bypass_appointment_overlap
  if (updateData._bypass_block !== undefined) delete updateData._bypass_block
  if (updateData._bypass_conflict !== undefined) delete updateData._bypass_conflict

  if (updateData.appointment_time || updateData.duration_minutes || updateData.appointment_date || updateData.employee_id) {
    const existingDoc = await getDoc(doc(db(), "appointments", appointmentId))
    if (existingDoc.exists()) {
      const existingData = existingDoc.data() as Appointment
      const employeeId = updateData.employee_id !== undefined ? updateData.employee_id : existingData.employee_id
      const date = updateData.appointment_date !== undefined ? updateData.appointment_date : existingData.appointment_date
      const time = updateData.appointment_time !== undefined ? updateData.appointment_time : existingData.appointment_time
      const duration = updateData.duration_minutes !== undefined ? updateData.duration_minutes : existingData.duration_minutes
      
      if (employeeId && date && time && duration) {
        const q = query(collection(db(), "appointments"),
          where("employee_id", "==", employeeId),
          where("appointment_date", "==", date)
        )
        const snap = await getDocs(q)
        const [h, m] = String(time).split(':').map(Number)
        const aptStart = h * 60 + m
        const aptEnd = aptStart + Number(duration)
        const blockingStatuses = ["pending", "confirmed", "waiting", "in_progress", "completed", "payment_pending"]
        
        const hasConflict = snap.docs.some(d => {
          if (d.id === appointmentId) return false
          const a = d.data() as Appointment
          if (a.status === 'cancelled') return false
          if (a.type === 'absence' || a.type === 'free') return false
          if (a.type !== 'block' && (!a.status || !blockingStatuses.includes(a.status))) return false
          
          const [ah, am] = (a.appointment_time || "00:00").split(':').map(Number)
          const aStart = ah * 60 + am
          const aEnd = aStart + (a.duration_minutes || 0)
          
          const overlaps = aptStart < aEnd && aptEnd > aStart
          if (!overlaps) return false
          
          if (a.type === 'block') {
            if (!bypassBlock) return true
            return false // Bypassed block
          }
          
          if (!bypassAppointmentOverlap) return true
          return false // Bypassed overlap
        })
        
        if (hasConflict) {
          throw new Error("Horário indisponível. Já existe um agendamento para este profissional neste período.")
        }
      }
    }
  }

  const enhancedData = {
    ...updateData,
    updated_by_user_id: user?.id || null,
    updated_by_name: user?.name || null,
    last_action_by_user_id: user?.id || null,
    last_action_by_name: user?.name || null,
    last_action_type: actionType
  }
  
  const result = await updateDocument("appointments", appointmentId, enhancedData)
  
  await createAppointmentLog(
    appointmentId,
    actionType,
    actionLabel,
    description,
    user
  )
  
  // New robust history
  import("@/lib/firebase/history-service").then(({ createHistoryEvent }) => {
    createHistoryEvent({
      client_id: historyData?.client_id || (result as any).client_id,
      client_name: historyData?.client_name || (result as any).client_name,
      appointment_id: appointmentId,
      action_type: actionType,
      action_title: actionLabel,
      action_description: description,
      old_value: historyData?.old_value,
      new_value: historyData?.new_value || updateData,
      service_id: historyData?.service_id || (result as any).service_id,
      service_name: historyData?.service_name || (result as any).service_name,
      professional_id: historyData?.professional_id || (result as any).employee_id,
      professional_name: historyData?.professional_name || (result as any).employee_name,
      performed_by_user_id: user?.id || "system",
      performed_by_name: user?.name || "Sistema",
      performed_by_email: user?.email,
      performed_by_role: user?.role
    }).catch(console.error)
  })
  
  return result
}

export async function createAuditLog(
  module: string,
  actionType: string,
  description: string,
  user: { id: string; name: string; role?: string } | null,
  details: any
) {
  try {
    const colRef = collection(db(), "audit_logs")
    await withTimeout(addDoc(colRef, {
      module,
      action_type: actionType,
      description,
      user_id: user?.id || "system",
      user_name: user?.name || "Sistema",
      user_role: user?.role || "system",
      details,
      created_at: new Date().toISOString()
    }))
  } catch (err) {
    console.error("Error creating audit log:", err)
  }
}

export async function deleteAppointment(
  appointmentId: string,
  user: { id: string; name: string; role?: string; email?: string } | null,
  historyData?: {
    client_id?: string
    client_name?: string
    service_id?: string
    service_name?: string
    professional_id?: string
    professional_name?: string
    action_type?: string
    action_title?: string
    action_description?: string
  }
) {
  await createAppointmentLog(
    appointmentId,
    historyData?.action_type || "deleted",
    historyData?.action_title || "Agendamento excluído",
    historyData?.action_description || `Agendamento excluído por ${user?.name || 'Sistema'}.`,
    user
  )

  // New robust history
  import("@/lib/firebase/history-service").then(({ createHistoryEvent }) => {
    createHistoryEvent({
      client_id: historyData?.client_id || null,
      client_name: historyData?.client_name || "Desconhecido",
      appointment_id: appointmentId,
      action_type: historyData?.action_type || "deleted",
      action_title: historyData?.action_title || "Agendamento excluído",
      action_description: historyData?.action_description || `Agendamento excluído por ${user?.name || 'Sistema'}.`,
      service_id: historyData?.service_id || null,
      service_name: historyData?.service_name || null,
      professional_id: historyData?.professional_id || null,
      professional_name: historyData?.professional_name || null,
      performed_by_user_id: user?.id || "system",
      performed_by_name: user?.name || "Sistema",
      performed_by_email: user?.email,
      performed_by_role: user?.role
    }).catch(console.error)
  })

  await deleteDocument("appointments", appointmentId)
}

export async function deleteDocument(collectionName: string, id: string) {
  const docRef = doc(db(), collectionName, id)
  await withTimeout(deleteDoc(docRef))
}

export async function getDocument<T>(collectionName: string, id: string): Promise<T | null> {
  const docRef = doc(db(), collectionName, id)
  const snap = await getDoc(docRef)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as T
}

/**
 * Subscribe to a Firestore collection in real-time.
 * Returns an unsubscribe function — call it on component unmount.
 */
export function subscribeCollection<T>(
  collectionName: string,
  callback: (items: T[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db(), collectionName)
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as T)
      callback(items)
    },
    (error) => {
      console.error(`Realtime error on ${collectionName}:`, error)
      onError?.(error)
    }
  )
}
