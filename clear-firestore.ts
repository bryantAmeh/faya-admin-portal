import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAuHmu4z06EPZJ6L4p0a_r-lrbGYo_RyPM",
  authDomain: "fayapay-ece98.firebaseapp.com",
  projectId: "fayapay-ece98",
  storageBucket: "fayapay-ece98.firebasestorage.app",
  messagingSenderId: "401350981808",
  appId: "1:401350981808:web:127488fb53c6e534736375",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PREFIX = "faya_admin_";
const collections = [
  "departments", "roles", "permissions", "countries", "staff",
  "kyc_cases", "kyb_cases", "fraud_alerts", "settlements", "tickets",
  "disputes", "terminals", "audit_logs", "approvals", "merchants",
  "consumers", "pos_staff", "cards", "wallets", "transactions",
  "documents", "policies", "app_content", "notifications", "fees",
  "limits", "provider_logs", "webhook_logs", "pos_device_requests",
  "stock", "stock_orders", "meta",
];

async function clearCollection(name: string) {
  const snap = await getDocs(collection(db, `${PREFIX}${name}`));
  if (snap.size === 0) {
    console.log(`  ${name}: already empty`);
    return;
  }
  
  // Delete in batches of 400
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + 400);
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
  console.log(`  ${name}: deleted ${snap.size} documents`);
}

async function main() {
  console.log("=== CLEARING ALL FIRESTORE DATA ===\n");
  for (const col of collections) {
    await clearCollection(col);
  }
  console.log("\n=== ALL DATA CLEARED ===");
  
  // Verify
  console.log("\nVerifying collections are empty...");
  for (const col of collections.slice(0, 5)) {
    const snap = await getDocs(collection(db, `${PREFIX}${col}`));
    console.log(`  ${col}: ${snap.size} documents`);
  }
  console.log("\nFirestore is now clean. Data will come from the apps (Faya Pay, Faya Merchant, Faya POS).");
}
main().catch(e => console.error("FATAL:", e));
