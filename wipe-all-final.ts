import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc, getDoc } from "firebase/firestore";

const app = initializeApp({
  apiKey: "AIzaSyAuHmu4z06EPZJ6L4p0a_r-lrbGYo_RyPM",
  projectId: "fayapay-ece98",
  appId: "1:401350981808:web:127488fb53c6e534736375",
});
const db = getFirestore(app);

// Every collection we know about — admin + app
const allCols = [
  "faya_admin_departments","faya_admin_roles","faya_admin_permissions",
  "faya_admin_countries","faya_admin_staff","faya_admin_kyc_cases",
  "faya_admin_kyb_cases","faya_admin_fraud_alerts","faya_admin_settlements",
  "faya_admin_tickets","faya_admin_disputes","faya_admin_terminals",
  "faya_admin_audit_logs","faya_admin_approvals","faya_admin_merchants",
  "faya_admin_consumers","faya_admin_pos_staff","faya_admin_cards",
  "faya_admin_wallets","faya_admin_transactions","faya_admin_documents",
  "faya_admin_policies","faya_admin_app_content","faya_admin_notifications",
  "faya_admin_fees","faya_admin_limits","faya_admin_provider_logs",
  "faya_admin_webhook_logs","faya_admin_pos_device_requests",
  "faya_admin_stock","faya_admin_stock_orders","faya_admin_meta",
  // App collections
  "users","cards","devices","kyc","limits",
  "merchants","terminals","pos_device_requests",
  "wallets","transactions","settlements","disputes",
  "support_tickets","documents","staff","kyb","fraud_alerts",
  "faya_admin_system_settings",
];

async function wipe() {
  console.log("=== WIPING EVERYTHING FROM FIRESTORE ===\n");
  for (const col of allCols) {
    try {
      const snap = await getDocs(collection(db, col));
      if (snap.size > 0) {
        for (let i = 0; i < snap.docs.length; i += 400) {
          const batch = writeBatch(db);
          for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
          await batch.commit();
        }
        console.log(`  Wiped ${col}: ${snap.size} docs`);
      }
    } catch {}
  }
  
  // Verify it's all gone
  console.log("\nVerifying...");
  let totalRemaining = 0;
  for (const col of allCols) {
    try {
      const snap = await getDocs(collection(db, col));
      if (snap.size > 0) {
        console.log(`  STILL HAS DATA: ${col}: ${snap.size} docs`);
        totalRemaining += snap.size;
      }
    } catch {}
  }
  
  if (totalRemaining === 0) {
    console.log("\nFirestore is COMPLETELY EMPTY. Clean slate.");
  } else {
    console.log(`\nWARNING: ${totalRemaining} docs still remaining`);
  }
}
wipe().catch(e => console.error("FATAL:", e));
