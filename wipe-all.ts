import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

const app = initializeApp({
  apiKey: "AIzaSyAuHmu4z06EPZJ6L4p0a_r-lrbGYo_RyPM",
  authDomain: "fayapay-ece98.firebaseapp.com",
  projectId: "fayapay-ece98",
  appId: "1:401350981808:web:127488fb53c6e534736375",
});
const db = getFirestore(app);
const auth = getAuth(app);

const PREFIX = "faya_admin_";
const allCollections = [
  "departments", "roles", "permissions", "countries", "staff",
  "kyc_cases", "kyb_cases", "fraud_alerts", "settlements", "tickets",
  "disputes", "terminals", "audit_logs", "approvals", "merchants",
  "consumers", "pos_staff", "cards", "wallets", "transactions",
  "documents", "policies", "app_content", "notifications", "fees",
  "limits", "provider_logs", "webhook_logs", "pos_device_requests",
  "stock", "stock_orders", "meta",
];

async function wipe() {
  console.log("=== WIPING ALL FIRESTORE DATA ===\n");
  for (const col of allCollections) {
    const snap = await getDocs(collection(db, `${PREFIX}${col}`));
    if (snap.size > 0) {
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(db);
        for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
        await batch.commit();
      }
      console.log(`  ${col}: wiped ${snap.size} docs`);
    }
  }
  console.log("\nFirestore is now completely empty.\n");

  // Create the real super admin in Firebase Auth
  console.log("=== CREATING SUPER ADMIN IN FIREBASE AUTH ===");
  try {
    const cred = await createUserWithEmailAndPassword(auth, "angerjude8@gmail.com", "admin");
    console.log(`Auth user created: ${cred.user.uid} (${cred.user.email})`);
  } catch (e: any) {
    if (e.code === "email-already-in-use") {
      console.log("User already exists in Auth — signing in to verify...");
      const cred = await signInWithEmailAndPassword(auth, "angerjude8@gmail.com", "admin");
      console.log(`Verified: ${cred.user.uid} (${cred.user.email})`);
    } else {
      console.log("Auth error:", e.code, e.message);
    }
  }

  console.log("\nDone. Firestore is clean. Super admin auth ready.");
}
wipe().catch(e => console.error("FATAL:", e));
