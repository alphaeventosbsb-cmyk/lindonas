import { getDb } from "./config"
import {
  collection, getDocs, query, where, orderBy,
  doc, updateDoc, deleteDoc, addDoc, getDoc,
} from "firebase/firestore"

const db = () => getDb()

/**
 * Fetch all documents in a collection scoped to a specific company.
 * Enforces multi-tenant isolation at the query level.
 */
export async function fetchTenantCollection<T>(
  collectionName: string,
  companyId: string,
  orderByField?: string,
  direction: "asc" | "desc" = "asc"
): Promise<T[]> {
  if (!companyId) return []
  try {
    let q
    if (orderByField) {
      q = query(
        collection(db(), collectionName),
        where("company_id", "==", companyId),
        orderBy(orderByField, direction)
      )
    } else {
      q = query(
        collection(db(), collectionName),
        where("company_id", "==", companyId)
      )
    }
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as T)
  } catch (error) {
    console.error(`Error fetching ${collectionName} for company ${companyId}:`, error)
    return []
  }
}

/**
 * Create a document with company_id automatically injected.
 */
export async function createTenantDocument(
  collectionName: string,
  companyId: string,
  data: any
) {
  if (!companyId) throw new Error("companyId is required")
  const colRef = collection(db(), collectionName)
  const docRef = await addDoc(colRef, {
    ...data,
    company_id: companyId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  const newDoc = await getDoc(docRef)
  return { id: newDoc.id, ...newDoc.data() }
}

/**
 * Update a document only if it belongs to the specified company.
 */
export async function updateTenantDocument(
  collectionName: string,
  companyId: string,
  docId: string,
  data: any
) {
  if (!companyId) throw new Error("companyId is required")
  const docRef = doc(db(), collectionName, docId)
  const snap = await getDoc(docRef)
  if (!snap.exists()) throw new Error("Document not found")
  const docData = snap.data()
  if (docData.company_id && docData.company_id !== companyId) {
    throw new Error("Access denied: cross-tenant operation")
  }
  await updateDoc(docRef, { ...data, updated_at: new Date().toISOString() })
  const updated = await getDoc(docRef)
  return { id: updated.id, ...updated.data() }
}

/**
 * Delete a document only if it belongs to the specified company.
 */
export async function deleteTenantDocument(
  collectionName: string,
  companyId: string,
  docId: string
) {
  if (!companyId) throw new Error("companyId is required")
  const docRef = doc(db(), collectionName, docId)
  const snap = await getDoc(docRef)
  if (!snap.exists()) throw new Error("Document not found")
  const docData = snap.data()
  if (docData.company_id && docData.company_id !== companyId) {
    throw new Error("Access denied: cross-tenant operation")
  }
  await deleteDoc(docRef)
}
