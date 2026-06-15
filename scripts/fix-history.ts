import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// We need to parse the service account from an env var, or just use the default credentials if set.
// But since this is run locally by the user, we will expect FIREBASE_SERVICE_ACCOUNT_KEY or just rely on standard app init if possible.
// Actually, I can use the same firebase configuration as the frontend if it's not restricted, but firestore rules might prevent bulk updates.
// Since it's a one-off script, I'll provide instructions.

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountJson) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT_KEY in .env.local");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(serviceAccountJson))
  });
}

const db = getFirestore();

async function fixHistory() {
  console.log("Starting history cleanup...");

  const admins = [
    { email: 'carbeto34@gmail.com', name: 'Carbeto / Admin' },
    { email: 'alphaeventosbsb@gmail.com', name: 'Alpha / Admin' }
  ];

  for (const admin of admins) {
    console.log(`\nFixing for ${admin.email}...`);
    
    const historyRef = db.collection('appointment_history');
    const snapshot = await historyRef.where('performed_by_email', '==', admin.email).get();

    let count = 0;
    const batch = db.batch();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const currentName = (data.performed_by_name || '').toLowerCase();
      
      // If the name is "katia alves" or "katia", we fix it
      if (currentName.includes('katia')) {
        batch.update(doc.ref, {
          performed_by_name: admin.name,
          performed_by_role: 'admin' // ensure role is admin
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Updated ${count} history records for ${admin.email}`);
    } else {
      console.log(`No records needed fixing for ${admin.email}`);
    }

    // Also fix saas_users if any
    const saasUsersRef = db.collection('saas_users');
    const saasSnap = await saasUsersRef.where('email', '==', admin.email).get();
    
    let saasCount = 0;
    const saasBatch = db.batch();
    
    saasSnap.forEach((doc) => {
      const data = doc.data();
      const currentName = (data.name || '').toLowerCase();
      if (currentName.includes('katia')) {
        saasBatch.update(doc.ref, {
          name: admin.name,
          role: 'master_admin'
        });
        saasCount++;
      }
    });

    if (saasCount > 0) {
      await saasBatch.commit();
      console.log(`Updated ${saasCount} saas_users records for ${admin.email}`);
    }
  }

  console.log("\nDone!");
}

fixHistory().catch(console.error);
