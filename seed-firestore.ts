import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, writeBatch, getDocs } from "firebase/firestore";
import { SEED_DEPARTMENTS, SEED_ROLES, SEED_PERMISSIONS, SEED_COUNTRIES, SEED_STAFF, SEED_KYC_CASES, SEED_KYB_CASES, SEED_FRAUD_ALERTS, SEED_SETTLEMENTS, SEED_TICKETS, SEED_DISPUTES, SEED_TERMINALS, SEED_AUDIT_LOGS, SEED_APPROVALS, SEED_MERCHANTS, SEED_CONSUMERS, SEED_POS_STAFF, SEED_CARDS, SEED_WALLETS, SEED_TRANSACTIONS, SEED_DOCUMENTS, SEED_POLICIES, SEED_APP_CONTENT, SEED_NOTIFICATIONS, SEED_FEES, SEED_LIMITS, SEED_PROVIDER_LOGS, SEED_WEBHOOK_LOGS, SEED_POS_DEVICE_REQUESTS, SEED_STOCK_ITEMS, SEED_STOCK_ORDERS } from "./src/lib/seed-data";

const firebaseConfig = {
  apiKey: "AIzaSyAuHmu4z06EPZJ6L4p0a_r-lrbGYo_RyPM",
  authDomain: "fayapay-ece98.firebaseapp.com",
  projectId: "fayapay-ece98",
  storageBucket: "fayapay-ece98.firebasestorage.app",
  messagingSenderId: "401350981808",
  appId: "1:401350981808:web:127488fb53c6e534736375",
  measurementId: "G-4ZMVXN0XNV",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PREFIX = "faya_admin_";

async function seedCollection(name: string, items: { id: string }[]) {
  if (items.length === 0) return;
  console.log(`Seeding ${name}: ${items.length} items...`);
  for (let i = 0; i < items.length; i += 400) {
    const batch = writeBatch(db);
    const chunk = items.slice(i, i + 400);
    for (const item of chunk) {
      const ref = doc(db, `${PREFIX}${name}`, item.id);
      batch.set(ref, { ...item }, { merge: false });
    }
    await batch.commit();
  }
  console.log(`  Done`);
}

async function main() {
  console.log("=== Seeding Firebase Firestore (fayapay-ece98) ===\n");
  await seedCollection("departments", SEED_DEPARTMENTS);
  await seedCollection("roles", SEED_ROLES);
  await seedCollection("permissions", SEED_PERMISSIONS);
  await seedCollection("countries", SEED_COUNTRIES);
  await seedCollection("staff", SEED_STAFF);
  await seedCollection("kyc_cases", SEED_KYC_CASES);
  await seedCollection("kyb_cases", SEED_KYB_CASES);
  await seedCollection("fraud_alerts", SEED_FRAUD_ALERTS);
  await seedCollection("settlements", SEED_SETTLEMENTS);
  await seedCollection("tickets", SEED_TICKETS);
  await seedCollection("disputes", SEED_DISPUTES);
  await seedCollection("terminals", SEED_TERMINALS);
  await seedCollection("audit_logs", SEED_AUDIT_LOGS);
  await seedCollection("approvals", SEED_APPROVALS);
  await seedCollection("merchants", SEED_MERCHANTS);
  await seedCollection("consumers", SEED_CONSUMERS);
  await seedCollection("pos_staff", SEED_POS_STAFF);
  await seedCollection("cards", SEED_CARDS);
  await seedCollection("wallets", SEED_WALLETS);
  await seedCollection("transactions", SEED_TRANSACTIONS);
  await seedCollection("documents", SEED_DOCUMENTS);
  await seedCollection("policies", SEED_POLICIES);
  await seedCollection("app_content", SEED_APP_CONTENT);
  await seedCollection("notifications", SEED_NOTIFICATIONS);
  await seedCollection("fees", SEED_FEES);
  await seedCollection("limits", SEED_LIMITS);
  await seedCollection("provider_logs", SEED_PROVIDER_LOGS);
  await seedCollection("webhook_logs", SEED_WEBHOOK_LOGS);
  await seedCollection("pos_device_requests", SEED_POS_DEVICE_REQUESTS);
  await seedCollection("stock", SEED_STOCK_ITEMS);
  await seedCollection("stock_orders", SEED_STOCK_ORDERS);
  await setDoc(doc(db, `${PREFIX}meta`, "seed_status"), { seeded: true, seededAt: new Date().toISOString() });
  console.log("\n=== ALL DATA SEEDED ===");
  console.log("\nVerifying...");
  const depts = await getDocs(collection(db, `${PREFIX}departments`));
  console.log(`  Departments: ${depts.size}`);
  const countries = await getDocs(collection(db, `${PREFIX}countries`));
  console.log(`  Countries: ${countries.size}`);
  const staff = await getDocs(collection(db, `${PREFIX}staff`));
  console.log(`  Staff: ${staff.size}`);
  const consumers = await getDocs(collection(db, `${PREFIX}consumers`));
  console.log(`  Consumers: ${consumers.size}`);
  const merchants = await getDocs(collection(db, `${PREFIX}merchants`));
  console.log(`  Merchants: ${merchants.size}`);
  const cards = await getDocs(collection(db, `${PREFIX}cards`));
  console.log(`  Cards: ${cards.size}`);
  const transactions = await getDocs(collection(db, `${PREFIX}transactions`));
  console.log(`  Transactions: ${transactions.size}`);
  const stock = await getDocs(collection(db, `${PREFIX}stock`));
  console.log(`  Stock Items: ${stock.size}`);
  console.log("\nDone! Admin portal now uses real Firebase data.");
}
main().catch(e => console.error("FATAL:", e));
