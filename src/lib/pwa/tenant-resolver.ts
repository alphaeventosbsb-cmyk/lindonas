import { getDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs, limit } from "firebase/firestore"

export async function resolvePWATenantBySlug(slug: string) {
  try {
    const normalizedSlug = slug.trim().toLowerCase()
    const db = getDb()
    const companiesRef = collection(db, "companies")

    // 1. Buscar por slug == "lindonas"
    let q = query(companiesRef, where("slug", "==", normalizedSlug), limit(1))
    let snap = await getDocs(q)
    if (!snap.empty) {
      const doc = snap.docs[0]
      return { id: doc.id, ...doc.data() }
    }

    // 2. Buscar por pwa_slug == "lindonas"
    q = query(companiesRef, where("pwa_slug", "==", normalizedSlug), limit(1))
    snap = await getDocs(q)
    if (!snap.empty) {
      const doc = snap.docs[0]
      return { id: doc.id, ...doc.data() }
    }

    // 3. Buscar por business_slug == "lindonas"
    q = query(companiesRef, where("business_slug", "==", normalizedSlug), limit(1))
    snap = await getDocs(q)
    if (!snap.empty) {
      const doc = snap.docs[0]
      return { id: doc.id, ...doc.data() }
    }

    // 4. Buscar por nome normalizado (business_name / name) ou Fallback para único estabelecimento
    q = query(companiesRef, limit(10))
    snap = await getDocs(q)
    const activeCompanies = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
    
    const byName = activeCompanies.find(c => 
      c.name?.toLowerCase().includes(normalizedSlug) || 
      c.business_name?.toLowerCase().includes(normalizedSlug)
    )
    if (byName) return byName

    // Se tiver só um salão cadastrado, assume que é ele
    if (activeCompanies.length === 1) return activeCompanies[0]

    // 5. Fallback final: Tentar collection "settings" (Legado)
    const settingsRef = collection(db, "settings")
    const settingsSnap = await getDocs(query(settingsRef, limit(10)))
    const settingsDocs = settingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))

    const salonSettings =
      settingsDocs.find(item => String(item.business_name || "").toLowerCase().includes(normalizedSlug)) ||
      settingsDocs[0]

    if (salonSettings) {
      return {
        id: salonSettings.company_id || "default", // usa o company_id se existir, senao default
        name: salonSettings.business_name || "Salão Lindonas",
        logo_url: salonSettings.logo_url || null,
        ...salonSettings
      }
    }

    return null
  } catch (error) {
    console.error("Erro ao resolver PWATenant:", error)
    return null
  }
}
