import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase/admin"
import { getRequestAccess, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/server-access"
import { SUPER_ADMIN_EMAILS } from "@/lib/auth/super-admin"

// ===================== TYPES =====================

interface CleanupPayload {
  selectedModules: string[]
  confirmationText?: string
  masterPassword?: string
  preview?: boolean
}

interface CleanupResult {
  module: string
  label: string
  deletedCount: number
  details: string[]
}

interface DependencyError {
  module: string
  moduleLabel: string
  requiredModules: { key: string; label: string }[]
  message: string
}

interface ModuleCount {
  total: number
  collections: Record<string, number>
}

// ===================== CONSTANTS =====================

const VALID_MODULES = [
  "appointments", "clients", "cash", "reports", "invoices",
  "inventory", "professionals", "services", "commissions", "history",
] as const

type ModuleKey = (typeof VALID_MODULES)[number]

const MODULE_LABELS: Record<ModuleKey, string> = {
  appointments: "Agendamentos",
  clients: "Clientes",
  cash: "Caixa / Financeiro",
  reports: "Relatórios",
  invoices: "Notas Fiscais",
  inventory: "Estoque / Produtos",
  professionals: "Profissionais",
  services: "Serviços",
  commissions: "Comissões",
  history: "Histórico / Auditoria",
}

/**
 * Dependency map: if you want to delete module X,
 * you must also select module Y (if Y has any data).
 * This prevents orphaned references.
 */
const DEPENDENCY_MAP: Partial<Record<ModuleKey, { requiredModule: ModuleKey; collection: string; label: string }[]>> = {
  professionals: [
    { requiredModule: "appointments", collection: "appointments", label: "Agendamentos" },
    { requiredModule: "commissions", collection: "commissions", label: "Comissões" },
  ],
  clients: [
    { requiredModule: "appointments", collection: "appointments", label: "Agendamentos" },
  ],
  services: [
    { requiredModule: "appointments", collection: "appointments", label: "Agendamentos" },
    { requiredModule: "commissions", collection: "commissions", label: "Comissões" },
  ],
}

/**
 * Maps each module to its Firestore collections.
 * Collections with company_id field are marked for tenant filtering.
 */
const MODULE_COLLECTIONS: Record<ModuleKey, { name: string; hasCompanyId: boolean }[]> = {
  appointments: [
    { name: "appointment_logs", hasCompanyId: false },
    { name: "appointment_history", hasCompanyId: false },
    { name: "appointment_labels", hasCompanyId: true },
    { name: "appointments", hasCompanyId: true },
  ],
  clients: [
    { name: "client_transactions", hasCompanyId: true },
    { name: "clients", hasCompanyId: true },
  ],
  cash: [
    { name: "financial_entries", hasCompanyId: true },
    { name: "cash_registers", hasCompanyId: true },
  ],
  reports: [],
  invoices: [
    { name: "invoices", hasCompanyId: true },
  ],
  inventory: [
    { name: "inventory_movements", hasCompanyId: true },
    { name: "service_products", hasCompanyId: true },
    { name: "products", hasCompanyId: true },
  ],
  professionals: [
    { name: "employees", hasCompanyId: true },
  ],
  services: [
    { name: "service_products", hasCompanyId: true },
    { name: "categories", hasCompanyId: true },
    { name: "services", hasCompanyId: true },
  ],
  commissions: [
    { name: "professional_payments", hasCompanyId: true },
    { name: "commissions", hasCompanyId: true },
  ],
  history: [
    { name: "audit_logs", hasCompanyId: false },
    { name: "appointment_logs", hasCompanyId: false },
    { name: "appointment_history", hasCompanyId: false },
    { name: "data_audit_logs", hasCompanyId: true },
  ],
}

// ===================== HELPERS =====================

function normalizeForComparison(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/**
 * Count documents in a collection, optionally filtered by company_id.
 */
async function countDocs(
  collectionName: string,
  companyId: string | null,
  hasCompanyId: boolean
): Promise<number> {
  try {
    let queryRef: FirebaseFirestore.Query = adminDb.collection(collectionName)
    if (hasCompanyId && companyId) {
      queryRef = queryRef.where("company_id", "==", companyId)
    }
    const snapshot = await queryRef.count().get()
    return snapshot.data().count
  } catch {
    // Fallback: count manually if .count() isn't available
    try {
      let queryRef: FirebaseFirestore.Query = adminDb.collection(collectionName)
      if (hasCompanyId && companyId) {
        queryRef = queryRef.where("company_id", "==", companyId)
      }
      const snapshot = await queryRef.select().get()
      return snapshot.size
    } catch {
      return 0
    }
  }
}

/**
 * Delete documents in batches of 450 (under Firestore 500 limit).
 * Paginates through all matching documents.
 * Returns total number deleted.
 */
async function deleteCollectionDocsBatched(
  collectionName: string,
  companyId: string | null,
  hasCompanyId: boolean,
  excludeFilter?: (doc: FirebaseFirestore.DocumentData, docId: string) => boolean
): Promise<number> {
  const BATCH_SIZE = 450
  let totalDeleted = 0

  while (true) {
    let queryRef: FirebaseFirestore.Query = adminDb.collection(collectionName)
    if (hasCompanyId && companyId) {
      queryRef = queryRef.where("company_id", "==", companyId)
    }
    const snapshot = await queryRef.limit(BATCH_SIZE).get()

    if (snapshot.empty) break

    const batch = adminDb.batch()
    let batchCount = 0

    for (const doc of snapshot.docs) {
      if (excludeFilter && excludeFilter(doc.data(), doc.id)) {
        continue // Skip protected documents
      }
      batch.delete(doc.ref)
      batchCount++
    }

    if (batchCount > 0) {
      await batch.commit()
      totalDeleted += batchCount
    }

    // If we filtered out all docs in this batch, we might loop forever
    // Break if no deletes happened and we got a full batch
    if (batchCount === 0) break

    if (snapshot.size < BATCH_SIZE) break
  }

  return totalDeleted
}

/**
 * Check if a collection has any documents (filtered by company_id).
 */
async function collectionHasData(
  collectionName: string,
  companyId: string | null
): Promise<boolean> {
  try {
    let queryRef: FirebaseFirestore.Query = adminDb.collection(collectionName)
    if (companyId) {
      queryRef = queryRef.where("company_id", "==", companyId)
    }
    const snapshot = await queryRef.limit(1).get()
    return !snapshot.empty
  } catch {
    return false
  }
}

/**
 * Resolve the company_id for the current request.
 */
async function resolveCompanyId(
  access: { uid: string | null; isSuperAdmin: boolean; isOwner: boolean },
  settingsData: FirebaseFirestore.DocumentData
): Promise<string | null> {
  // Try settings first
  let companyId: string | null = settingsData.company_id || null

  if (!companyId && access.uid) {
    // Try from saas_users
    const saasSnap = await adminDb
      .collection("saas_users")
      .where("firebase_uid", "==", access.uid)
      .limit(1)
      .get()
    if (!saasSnap.empty) {
      const sid = saasSnap.docs[0].data().company_id
      if (sid && sid !== "__master__") companyId = sid
    }
  }

  if (!companyId) {
    // Fallback to first company
    const companiesSnap = await adminDb.collection("companies").limit(1).get()
    if (!companiesSnap.empty) companyId = companiesSnap.docs[0].id
  }

  return companyId
}

// ===================== DEPENDENCY CHECKING =====================

async function checkDependencies(
  selectedModules: Set<ModuleKey>,
  companyId: string | null
): Promise<DependencyError[]> {
  const errors: DependencyError[] = []

  for (const selected of selectedModules) {
    const deps = DEPENDENCY_MAP[selected]
    if (!deps) continue

    const missingModules: { key: string; label: string }[] = []

    for (const dep of deps) {
      if (selectedModules.has(dep.requiredModule)) continue // Already selected

      // Check if the dependent collection actually has data
      const hasData = await collectionHasData(dep.collection, companyId)
      if (hasData) {
        // Check if we already added this required module
        if (!missingModules.find((m) => m.key === dep.requiredModule)) {
          missingModules.push({ key: dep.requiredModule, label: dep.label })
        }
      }
    }

    if (missingModules.length > 0) {
      const moduleLabel = MODULE_LABELS[selected]
      const requiredLabels = missingModules.map((m) => m.label).join(", ")
      errors.push({
        module: selected,
        moduleLabel,
        requiredModules: missingModules,
        message: `Para limpar ${moduleLabel}, selecione também: ${requiredLabels}. Existem dados vinculados que podem causar inconsistência.`,
      })
    }
  }

  return errors
}

// ===================== PREVIEW =====================

async function getModuleCounts(
  selectedModules: Set<ModuleKey>,
  companyId: string | null
): Promise<Record<string, ModuleCount>> {
  const counts: Record<string, ModuleCount> = {}

  for (const mod of selectedModules) {
    const collections = MODULE_COLLECTIONS[mod]
    const collectionCounts: Record<string, number> = {}
    let total = 0

    for (const col of collections) {
      const count = await countDocs(col.name, companyId, col.hasCompanyId)
      collectionCounts[col.name] = count
      total += count
    }

    counts[mod] = { total, collections: collectionCounts }
  }

  return counts
}

// ===================== MODULE CLEANUP =====================

async function cleanModule(
  moduleKey: ModuleKey,
  companyId: string | null,
  selectedSet: Set<ModuleKey>
): Promise<CleanupResult> {
  const details: string[] = []
  let deletedCount = 0

  if (moduleKey === "reports") {
    return {
      module: "reports",
      label: MODULE_LABELS.reports,
      deletedCount: 0,
      details: ["Relatórios são gerados dinamicamente — nenhum dado próprio para apagar"],
    }
  }

  if (moduleKey === "professionals") {
    return await cleanProfessionals(companyId)
  }

  // Generic cleanup for other modules
  const collections = MODULE_COLLECTIONS[moduleKey]

  for (const col of collections) {
    // Skip service_products if already cleaned by another module
    if (col.name === "service_products" && moduleKey === "services" && selectedSet.has("inventory")) {
      continue // Already deleted by inventory module
    }
    // Skip appointment_logs / appointment_history if already cleaned by appointments module
    if (
      (col.name === "appointment_logs" || col.name === "appointment_history") &&
      moduleKey === "history" &&
      selectedSet.has("appointments")
    ) {
      continue
    }

    const count = await deleteCollectionDocsBatched(col.name, companyId, col.hasCompanyId)
    if (count > 0) {
      details.push(`${count} registros de ${col.name}`)
    }
    deletedCount += count
  }

  return {
    module: moduleKey,
    label: MODULE_LABELS[moduleKey],
    deletedCount,
    details,
  }
}

async function cleanProfessionals(companyId: string | null): Promise<CleanupResult> {
  const details: string[] = []

  // Build set of protected emails/uids
  const protectedEmails = new Set(SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase()))

  // Also protect business owners
  const ownersSnap = await adminDb
    .collection("saas_users")
    .where("role", "==", "business_owner")
    .get()
  const ownerUids = new Set<string>()
  ownersSnap.docs.forEach((doc) => {
    const data = doc.data()
    if (data.firebase_uid) ownerUids.add(data.firebase_uid)
    if (data.email) protectedEmails.add(data.email.toLowerCase())
  })

  // Also protect master_admin users
  const masterSnap = await adminDb
    .collection("saas_users")
    .where("role", "==", "master_admin")
    .get()
  masterSnap.docs.forEach((doc) => {
    const data = doc.data()
    if (data.firebase_uid) ownerUids.add(data.firebase_uid)
    if (data.email) protectedEmails.add(data.email.toLowerCase())
  })

  const excludeFilter = (data: FirebaseFirestore.DocumentData, _docId: string): boolean => {
    const email = (data.google_email || data.email || "").toLowerCase()
    const authUid = data.auth_uid || ""
    return (
      protectedEmails.has(email) ||
      ownerUids.has(authUid) ||
      data.role === "owner"
    )
  }

  const deletedCount = await deleteCollectionDocsBatched(
    "employees",
    companyId,
    true,
    excludeFilter
  )

  if (deletedCount > 0) details.push(`${deletedCount} profissionais apagados`)

  // Count how many were preserved
  let queryRef: FirebaseFirestore.Query = adminDb.collection("employees")
  if (companyId) {
    queryRef = queryRef.where("company_id", "==", companyId)
  }
  const remainingSnap = await queryRef.get()
  const preserved = remainingSnap.size
  if (preserved > 0) {
    details.push(`${preserved} profissionais preservados (vinculados a contas administrativas)`)
  }

  return {
    module: "professionals",
    label: MODULE_LABELS.professionals,
    deletedCount,
    details,
  }
}

// ===================== AUDIT LOGGING (PROTECTED) =====================

async function logCleanupAudit(
  access: { uid: string | null; email: string | null; isSuperAdmin: boolean },
  selectedModules: string[],
  results: CleanupResult[],
  totalDeleted: number,
  companyId: string | null,
  businessName: string,
  request: Request
): Promise<void> {
  const userAgent = request.headers.get("user-agent") || "unknown"

  const logEntry = {
    action: "system_cleanup",
    user_id: access.uid || "unknown",
    user_email: access.email || "unknown",
    user_role: access.isSuperAdmin ? "super_admin" : "business_owner",
    company_id: companyId || "unknown",
    business_name: businessName,
    modules_cleaned: selectedModules,
    module_labels: selectedModules.map((m) => MODULE_LABELS[m as ModuleKey] || m),
    results,
    total_deleted: totalDeleted,
    status: "success",
    user_agent: userAgent,
    created_at: new Date().toISOString(),
  }

  // Write to PROTECTED collection (never deletable by cleanup modal)
  try {
    await adminDb.collection("system_cleanup_logs").add(logEntry)
  } catch (error) {
    console.error("Failed to write system_cleanup_logs:", error)
  }

  // Also write to audit_logs for visibility in history tab
  try {
    await adminDb.collection("audit_logs").add({
      module: "system_cleanup",
      action_type: "system_cleanup",
      description: `Limpeza do sistema executada. Módulos: ${selectedModules.map((m) => MODULE_LABELS[m as ModuleKey]).join(", ")}. Total de ${totalDeleted} registros apagados.`,
      user_id: access.uid || "unknown",
      user_name: access.email || "unknown",
      user_role: access.isSuperAdmin ? "super_admin" : "business_owner",
      details: { modules_cleaned: selectedModules, total_deleted: totalDeleted },
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Failed to write audit_logs:", error)
  }
}

// ===================== MAIN HANDLER =====================

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const access = await getRequestAccess(request)
    if (!access.authenticated) {
      return unauthorizedResponse()
    }

    // 2. Check admin/owner permission
    if (!access.isSuperAdmin && !access.isOwner) {
      return forbiddenResponse()
    }

    // 3. Parse payload
    let body: CleanupPayload
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "Payload inválido." },
        { status: 400 }
      )
    }

    const { selectedModules, confirmationText, masterPassword, preview } = body

    // 4. Validate modules
    if (!Array.isArray(selectedModules) || selectedModules.length === 0) {
      return NextResponse.json(
        { error: "NO_MODULES", message: "Selecione pelo menos uma área para limpar." },
        { status: 400 }
      )
    }

    const invalidModules = selectedModules.filter(
      (m) => !VALID_MODULES.includes(m as ModuleKey)
    )
    if (invalidModules.length > 0) {
      return NextResponse.json(
        { error: "INVALID_MODULES", message: `Módulos inválidos: ${invalidModules.join(", ")}` },
        { status: 400 }
      )
    }

    const selectedSet = new Set(selectedModules as ModuleKey[])

    // 5. Fetch settings (needed for both preview and execute)
    const settingsSnap = await adminDb.collection("settings").limit(1).get()
    if (settingsSnap.empty) {
      return NextResponse.json(
        { error: "NO_SETTINGS", message: "Configurações do sistema não encontradas." },
        { status: 500 }
      )
    }
    const settingsData = settingsSnap.docs[0].data()
    const businessName = settingsData.business_name || ""

    // 6. Resolve company_id for tenant filtering
    const companyId = await resolveCompanyId(access, settingsData)

    // 7. Check dependencies (both preview and execute)
    const dependencyErrors = await checkDependencies(selectedSet, companyId)
    if (dependencyErrors.length > 0) {
      return NextResponse.json(
        {
          error: "DEPENDENCY_BLOCK",
          message: "Existem dependências que impedem a limpeza. Selecione os módulos relacionados.",
          dependencyErrors,
        },
        { status: 422 }
      )
    }

    // ===================== PREVIEW MODE =====================
    if (preview) {
      const counts = await getModuleCounts(selectedSet, companyId)
      return NextResponse.json({
        preview: true,
        counts,
        selectedModules,
        moduleLabels: selectedModules.map((m) => MODULE_LABELS[m as ModuleKey] || m),
      })
    }

    // ===================== EXECUTE MODE =====================

    // 8. Validate confirmation text
    if (confirmationText !== "APAGAR") {
      return NextResponse.json(
        { error: "INVALID_CONFIRMATION", message: "Texto de confirmação inválido. Digite APAGAR." },
        { status: 400 }
      )
    }

    // 9. Validate master password
    if (!masterPassword || typeof masterPassword !== "string" || masterPassword.trim().length === 0) {
      return NextResponse.json(
        { error: "MISSING_PASSWORD", message: "Senha master obrigatória." },
        { status: 400 }
      )
    }

    if (!businessName) {
      return NextResponse.json(
        { error: "NO_BUSINESS_NAME", message: "Nome do estabelecimento não configurado." },
        { status: 500 }
      )
    }

    const normalizedInput = normalizeForComparison(masterPassword)
    const normalizedBizName = normalizeForComparison(businessName)

    if (normalizedInput !== normalizedBizName) {
      return NextResponse.json(
        { error: "INVALID_PASSWORD", message: "Senha master incorreta." },
        { status: 403 }
      )
    }

    // 10. Execute cleanup in dependency-safe order
    // Order: children/leaves first, then parents
    const executionOrder: ModuleKey[] = [
      "history",
      "commissions",
      "cash",
      "invoices",
      "reports",
      "appointments",
      "clients",
      "inventory",
      "services",
      "professionals",
    ]

    const results: CleanupResult[] = []

    for (const moduleKey of executionOrder) {
      if (!selectedSet.has(moduleKey)) continue

      try {
        const result = await cleanModule(moduleKey, companyId, selectedSet)
        results.push(result)
      } catch (error: any) {
        console.error(`Error cleaning module ${moduleKey}:`, error)
        results.push({
          module: moduleKey,
          label: MODULE_LABELS[moduleKey],
          deletedCount: 0,
          details: [`Erro ao limpar: ${error.message || String(error)}`],
        })
      }
    }

    // 11. Log audit (protected collection)
    const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0)
    await logCleanupAudit(
      access,
      selectedModules,
      results,
      totalDeleted,
      companyId,
      businessName,
      request
    )

    // 12. Return success
    return NextResponse.json({
      success: true,
      message: "Limpeza concluída com sucesso. Os módulos selecionados foram zerados.",
      results,
      totalDeleted,
    })
  } catch (error: any) {
    console.error("System cleanup error:", error)
    return NextResponse.json(
      {
        error: "CLEANUP_ERROR",
        message: "Não foi possível concluir a limpeza. Verifique a senha master ou tente novamente.",
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}
