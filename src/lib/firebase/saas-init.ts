import { getDb } from "./config"
import { collection, getDocs, addDoc, query, where, doc, setDoc } from "firebase/firestore"
import { ALL_PERMISSION_KEYS } from "@/lib/rbac/rbac-types"
import { isSuperAdmin, normalizeAuthEmail } from "@/lib/auth/super-admin"

const db = () => getDb()

/**
 * Seed default SaaS plans if they don't exist.
 */
export async function seedSaaSPlans() {
  const existing = await getDocs(collection(db(), "saas_plans"))
  if (existing.size > 0) return // Already seeded

  const plans = [
    {
      name: "Teste Grátis",
      price: 0,
      billing_cycle: "monthly",
      max_professionals: 2,
      max_appointments_month: 50,
      features: [
        "Agendamento online",
        "Até 2 profissionais",
        "Até 50 agendamentos/mês",
        "Dashboard básico",
        "7 dias grátis",
      ],
      is_active: true,
      display_order: 0,
    },
    {
      name: "Básico",
      price: 49.90,
      billing_cycle: "monthly",
      max_professionals: 3,
      max_appointments_month: 300,
      features: [
        "Agendamento online",
        "Até 3 profissionais",
        "Até 300 agendamentos/mês",
        "Gestão de clientes",
        "Relatórios básicos",
        "Link de agendamento personalizado",
      ],
      is_active: true,
      display_order: 1,
    },
    {
      name: "Profissional",
      price: 99.90,
      billing_cycle: "monthly",
      max_professionals: 10,
      max_appointments_month: 9999,
      features: [
        "Agendamento online ilimitado",
        "Até 10 profissionais",
        "Módulo financeiro completo",
        "Comissões e pagamentos",
        "Relatórios avançados",
        "Notas fiscais",
        "Página da empresa editável",
        "Lembretes WhatsApp",
      ],
      is_active: true,
      display_order: 2,
    },
    {
      name: "Premium",
      price: 199.90,
      billing_cycle: "monthly",
      max_professionals: 999,
      max_appointments_month: 99999,
      features: [
        "Tudo do Profissional",
        "Profissionais ilimitados",
        "Multi-unidades",
        "Branding customizado",
        "Suporte prioritário",
        "Automação avançada",
        "API de integração",
      ],
      is_active: true,
      display_order: 3,
    },
  ]

  for (const plan of plans) {
    await addDoc(collection(db(), "saas_plans"), {
      ...plan,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
}

/**
 * Ensure Master Admin user exists. Called on first login.
 */
export async function ensureMasterAdmin(firebaseUid: string, email: string, name: string) {
  if (!isSuperAdmin(email)) {
    return null
  }

  const normalizedEmail = normalizeAuthEmail(email)
  const existing = await getDocs(query(
    collection(db(), "saas_users"),
    where("firebase_uid", "==", firebaseUid)
  ))

  if (existing.size === 0) {
    await addDoc(collection(db(), "saas_users"), {
      company_id: "__master__",
      firebase_uid: firebaseUid,
      name: name || "Admin Master",
      email: normalizedEmail,
      phone: null,
      role: "master_admin",
      permissions: ALL_PERMISSION_KEYS,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    return "master_admin"
  }

  const userDoc = existing.docs[0]
  const user = userDoc.data()

  if (user.role !== "master_admin") {
    await setDoc(doc(db(), "saas_users", userDoc.id), {
      role: "master_admin",
      permissions: ALL_PERMISSION_KEYS,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { merge: true })
  }

  return "master_admin"
}
