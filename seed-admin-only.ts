import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, writeBatch } from "firebase/firestore";
import { SEED_DEPARTMENTS, SEED_ROLES, SEED_PERMISSIONS, SEED_COUNTRIES, SEED_STAFF } from "./src/lib/seed-data";

const app = initializeApp({
  apiKey: "AIzaSyAuHmu4z06EPZJ6L4p0a_r-lrbGYo_RyPM",
  projectId: "fayapay-ece98",
  appId: "1:401350981808:web:127488fb53c6e534736375",
});
const db = getFirestore(app);
const PREFIX = "faya_admin_";

async function seed(name: string, items: { id: string }[]) {
  if (!items.length) return;
  for (let i = 0; i < items.length; i += 400) {
    const batch = writeBatch(db);
    for (const item of items.slice(i, i + 400)) {
      batch.set(doc(db, `${PREFIX}${name}`, item.id), { ...item });
    }
    await batch.commit();
  }
  console.log(`  ${name}: ${items.length} items`);
}

async function main() {
  console.log("=== Seeding ADMIN-ONLY infrastructure ===");
  console.log("(Departments, Roles, Permissions, Countries, Admin Staff)");
  console.log("(NO consumers, merchants, cards, wallets, transactions — those come from the apps)\n");
  
  await seed("departments", SEED_DEPARTMENTS);
  await seed("roles", SEED_ROLES);
  await seed("permissions", SEED_PERMISSIONS);
  await seed("countries", SEED_COUNTRIES);
  await seed("staff", SEED_STAFF);
  
  await setDoc(doc(db, `${PREFIX}meta`, "seed_status"), { seeded: true, seededAt: new Date().toISOString() });
  
  console.log("\nDone! Admin can log in. All other data will come from the apps.");
}
main().catch(e => console.error("FATAL:", e));
