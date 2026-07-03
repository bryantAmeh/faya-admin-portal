import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, writeBatch } from "firebase/firestore";
import {
  SEED_DEPARTMENTS, SEED_ROLES, SEED_PERMISSIONS, SEED_COUNTRIES,
  SEED_FEES, SEED_LIMITS, SEED_POLICIES, SEED_APP_CONTENT,
  SEED_STOCK_ITEMS, SEED_PROVIDER_LOGS,
} from "./src/lib/seed-data";

const app = initializeApp({
  apiKey: "AIzaSyAuHmu4z06EPZJ6L4p0a_r-lrbGYo_RyPM",
  projectId: "fayapay-ece98",
  appId: "1:401350981808:web:127488fb53c6e534736375",
});
const db = getFirestore(app);

async function seed(name: string, items: { id: string }[]) {
  if (!items.length) return;
  for (let i = 0; i < items.length; i += 400) {
    const batch = writeBatch(db);
    for (const item of items.slice(i, i + 400)) {
      batch.set(doc(db, name, item.id), { ...item });
    }
    await batch.commit();
  }
  console.log(`  ${name}: ${items.length} items`);
}

async function main() {
  console.log("=== Seeding infrastructure for 3 apps + admin ===\n");

  // 1. Admin infrastructure (departments, roles, permissions)
  console.log("Admin infrastructure:");
  await seed("faya_admin_departments", SEED_DEPARTMENTS);
  await seed("faya_admin_roles", SEED_ROLES);
  await seed("faya_admin_permissions", SEED_PERMISSIONS);

  // 2. Countries — apps need these to know which countries are supported
  console.log("\nCountries (needed by all 3 apps):");
  await seed("faya_admin_countries", SEED_COUNTRIES);

  // 3. Fees — apps need to show fee structure to users/merchants
  console.log("\nFees (needed by Consumer + Merchant apps):");
  await seed("faya_admin_fees", SEED_FEES);

  // 4. Limits — apps need to enforce spending limits
  console.log("\nLimits (needed by Consumer + Merchant apps):");
  await seed("faya_admin_limits", SEED_LIMITS);

  // 5. Policies/Terms — apps need to show current terms to users
  console.log("\nPolicies/Terms (needed by all 3 apps for consent screens):");
  await seed("faya_admin_policies", SEED_POLICIES);

  // 6. App content — onboarding text, KYC instructions, FAQs
  console.log("\nApp content (needed by all 3 apps for in-app text):");
  await seed("faya_admin_app_content", SEED_APP_CONTENT);

  // 7. Stock — physical terminals and cards available for ordering
  console.log("\nStock (admin manages, Merchant app orders terminals, Consumer app orders cards):");
  await seed("faya_admin_stock", SEED_STOCK_ITEMS);

  // 8. Provider logs — system health monitoring
  console.log("\nProvider logs (admin monitoring):");
  await seed("faya_admin_provider_logs", SEED_PROVIDER_LOGS);

  // Mark as seeded
  await setDoc(doc(db, "faya_admin_meta", "seed_status"), {
    seeded: true,
    seededAt: new Date().toISOString(),
  });

  console.log("\n=== DONE ===");
  console.log("\nWhat each app reads from Firestore:");
  console.log("  Faya Pay (Consumer):");
  console.log("    - faya_admin_countries → supported countries, KYC rules");
  console.log("    - faya_admin_fees → card fees, transaction fees");
  console.log("    - faya_admin_limits → spending limits by KYC tier");
  console.log("    - faya_admin_policies → terms & conditions, privacy policy");
  console.log("    - faya_admin_app_content → onboarding text, KYC instructions");
  console.log("    - faya_admin_stock → physical cards available to order");
  console.log("    - users → consumer profiles (written by app)");
  console.log("    - cards → consumer cards (written by app)");
  console.log("    - kyc → KYC records (written by app, read by admin)");
  console.log("    - devices → consumer devices (written by app)");
  console.log("    - limits → per-user spending limits (written by app)");
  console.log("");
  console.log("  Faya Merchant:");
  console.log("    - faya_admin_countries → supported countries, KYB rules");
  console.log("    - faya_admin_fees → merchant acceptance fees");
  console.log("    - faya_admin_policies → merchant terms");
  console.log("    - faya_admin_app_content → merchant onboarding text");
  console.log("    - faya_admin_stock → terminals available to order");
  console.log("    - merchants → merchant profiles (written by app)");
  console.log("    - staff → merchant POS staff (written by app)");
  console.log("    - terminals → merchant terminals (written by app)");
  console.log("    - settlements → merchant settlements (written by app)");
  console.log("    - disputes → merchant disputes (written by app)");
  console.log("    - documents → merchant KYB documents (written by app)");
  console.log("");
  console.log("  Faya POS:");
  console.log("    - pos_device_requests → device binding requests (written by POS app on login)");
  console.log("    - staff → POS staff PINs (written by Merchant app, read by POS)");
  console.log("    - terminals → terminal info (written by Merchant app)");
  console.log("    - transactions → payment records (written by POS app)");
  console.log("");
  console.log("  Admin Portal (this app):");
  console.log("    - Reads ALL of the above");
  console.log("    - Manages: countries, fees, limits, policies, stock, staff");
  console.log("    - Approves: KYC, KYB, POS device binding, stock orders");
}
main().catch(e => console.error("FATAL:", e));
