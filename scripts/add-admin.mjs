// Script to add an email to the authorized_admin_emails array of a company
import { initializeApp } from "firebase/app"
import { getFirestore, collection, getDocs, updateDoc, doc, arrayUnion } from "firebase/firestore"
import { readFileSync } from "fs"

// Read env vars from .env.local
const envContent = readFileSync(".env.local", "utf-8")
const env = {}
envContent.split("\n").forEach(line => {
  const [key, ...vals] = line.split("=")
  if (key && vals.length) env[key.trim()] = vals.join("=").trim()
})

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const EMAIL_TO_ADD = "carbeto34@gmail.com"

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function main() {
  console.log(`\nAdding "${EMAIL_TO_ADD}" as authorized admin...\n`)
  
  const companiesSnap = await getDocs(collection(db, "companies"))
  
  if (companiesSnap.empty) {
    console.log("No companies found!")
    process.exit(1)
  }
  
  for (const companyDoc of companiesSnap.docs) {
    const data = companyDoc.data()
    const currentEmails = data.authorized_admin_emails || []
    
    console.log(`Company: ${data.company_name || data.name || companyDoc.id}`)
    console.log(`  Current authorized emails: ${JSON.stringify(currentEmails)}`)
    
    if (currentEmails.map(e => e.toLowerCase()).includes(EMAIL_TO_ADD.toLowerCase())) {
      console.log(`  ✅ Email "${EMAIL_TO_ADD}" already authorized!`)
    } else {
      await updateDoc(doc(db, "companies", companyDoc.id), {
        authorized_admin_emails: arrayUnion(EMAIL_TO_ADD)
      })
      console.log(`  ✅ Added "${EMAIL_TO_ADD}" to authorized_admin_emails`)
    }
  }
  
  console.log("\nDone! The user can now login at /admin/login with Google Auth.")
  process.exit(0)
}

main().catch(err => {
  console.error("Error:", err)
  process.exit(1)
})
