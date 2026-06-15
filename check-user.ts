import { config } from "dotenv"
config({ path: ".env.local" })

import { getDb } from "./src/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"

async function run() {
  const db = getDb();
  
  const q = query(collection(db, "saas_users"), where("email", "==", "nicksantosdf704@gmail.com"));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    console.log("No user found with email nicksantosdf704@gmail.com in saas_users");
  } else {
    snapshot.forEach(doc => {
      console.log("SAAS USER:", doc.id, "=>", doc.data());
    });
  }
  
  const q2 = query(collection(db, "settings"));
  const snap2 = await getDocs(q2);
  snap2.forEach(doc => {
    console.log("Settings authorized_admin_emails:", doc.data().authorized_admin_emails);
  });

  const q3 = query(collection(db, "employees"), where("email", "==", "nicksantosdf704@gmail.com"));
  const snap3 = await getDocs(q3);
  snap3.forEach(doc => {
    console.log("EMPLOYEE:", doc.id, "=>", doc.data());
  });
  
  process.exit(0);
}

run().catch(console.error);
