import { config } from "dotenv"
config({ path: ".env.local" })

import { adminDb } from "./src/lib/firebase/admin"

const ALLOWED_ADMINS = ["alphaeventos.bsb@gmail.com", "carbeto34@gmail.com"]

async function fixRoles() {
  console.log("Starting roles and permissions fix...")

  // 1. Update settings collection
  const settingsSnap = await adminDb.collection("settings").get()
  for (const doc of settingsSnap.docs) {
    await doc.ref.update({
      authorized_admin_emails: ALLOWED_ADMINS
    })
    console.log(`Updated settings doc ${doc.id} with allowed admins.`)
  }

  // 2. Update companies collection (legacy fallback)
  const companiesSnap = await adminDb.collection("companies").get()
  for (const doc of companiesSnap.docs) {
    await doc.ref.update({
      authorized_admin_emails: ALLOWED_ADMINS
    })
    console.log(`Updated company doc ${doc.id} with allowed admins.`)
  }

  // 3. Update saas_users collection
  const usersSnap = await adminDb.collection("saas_users").get()
  for (const doc of usersSnap.docs) {
    const data = doc.data()
    const email = data.email?.toLowerCase()

    if (email && ALLOWED_ADMINS.includes(email)) {
      if (data.role !== "business_owner") {
        await doc.ref.update({ role: "business_owner" })
        console.log(`Set ${email} (${doc.id}) to business_owner`)
      } else {
        console.log(`Kept ${email} (${doc.id}) as business_owner`)
      }
    } else {
      if (data.role === "business_owner" || data.role === "master_admin") {
        await doc.ref.update({ role: "professional" })
        console.log(`Demoted ${email || 'unknown'} (${doc.id}) from ${data.role} to professional`)
      } else {
        console.log(`Kept ${email || 'unknown'} (${doc.id}) as ${data.role}`)
      }
    }
  }

  console.log("Done fixing roles!")
  process.exit(0)
}

fixRoles().catch(err => {
  console.error("Error:", err)
  process.exit(1)
})
