import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";

const app = initializeApp({
  apiKey: "AIzaSyAuHmu4z06EPZJ6L4p0a_r-lrbGYo_RyPM",
  projectId: "fayapay-ece98",
  appId: "1:401350981808:web:127488fb53c6e534736375",
});
const db = getFirestore(app);

// Every collection the 3 apps + admin portal need.
// Creating an empty doc in each ensures the collection exists in Firestore.
const collections = {
  // === ADMIN PORTAL (faya_admin_ prefix) ===
  "faya_admin_countries": "Country configs — apps read this to know which countries are supported, KYC/KYB rules, platforms, fees",
  "faya_admin_departments": "Admin org structure — 11 departments (Super Admin, Compliance, Risk, Finance, etc.)",
  "faya_admin_roles": "Staff roles — 37 roles across all departments",
  "faya_admin_permissions": "Permission keys — resource.action.scope format (kyc.approve.country, etc.)",
  "faya_admin_staff": "Admin staff profiles — linked to Firebase Auth UID",
  "faya_admin_audit_logs": "Immutable audit trail — every admin action logged",
  "faya_admin_approvals": "Dual-approval workflow requests — high-risk actions need 2 approvers",
  "faya_admin_policies": "Legal content — terms, privacy, cardholder agreement, etc. (admin manages, apps read)",
  "faya_admin_app_content": "In-app text — onboarding, KYC instructions, FAQs, error messages",
  "faya_admin_notifications": "Notification campaigns — push, email, SMS sent to users/merchants",
  "faya_admin_fees": "Fee structure — card fees, merchant fees, settlement fees by country",
  "faya_admin_limits": "Spending limits — by KYC tier, risk level, product type, country",
  "faya_admin_provider_logs": "Provider health — Firebase, Paymentology, Smile Identity, Twilio, SendGrid, FCM, GTBank",
  "faya_admin_webhook_logs": "Incoming webhooks from providers — events, payload status, retries",
  "faya_admin_stock": "Physical inventory — terminals and cards with prices, images, descriptions",
  "faya_admin_stock_orders": "Orders from apps — when users/merchants order physical items",
  "faya_admin_meta": "System metadata — seed status, config flags",

  // === FAYA PAY (Consumer App) ===
  "users": "Consumer profiles — created by Faya Pay app on registration",
  "cards": "Consumer cards — virtual and physical, created by app, managed by admin",
  "wallets": "Consumer wallets — balance, available, held, linked cards",
  "transactions": "All transactions — card payments, NFC, wallet debit/credit, refunds, settlements",
  "kyc": "KYC records — created by app on submission, reviewed by admin compliance",
  "devices": "Consumer devices — phone info, trusted status, biometric, security checks",
  "limits": "Per-user spending limits — daily, weekly, monthly, ATM, contactless, online",
  "documents": "User documents — ID uploads, selfie/liveness, proof of address, BVN/NIN verification",

  // === FAYA MERCHANT (Business App) ===
  "merchants": "Merchant profiles — created by Faya Merchant app on registration",
  "branches": "Merchant branches — physical locations with staff and devices",
  "staff": "Merchant POS staff — cashiers, supervisors, managers with PINs and permissions",
  "terminals": "Merchant terminals — physical terminals and phone POS devices",
  "settlements": "Merchant settlements — payout batches with fees, reserves, bank details",
  "disputes": "Disputes and chargebacks — merchant evidence, deadlines, status",
  "support_tickets": "Support tickets — from all 3 apps, assigned to admin staff",
  "kyb": "KYB records — business verification, created by merchant app, reviewed by admin",

  // === FAYA POS (Payment-Taking App) ===
  "pos_device_requests": "Device binding requests — created when POS app logs in on new device, admin approves/declines",
};

async function setup() {
  console.log("=== Creating all Firestore collections ===\n");
  
  let count = 0;
  for (const [colName, description] of Object.entries(collections)) {
    try {
      // Create a _schema doc to ensure the collection exists
      await setDoc(doc(db, colName, "_schema"), {
        _type: "collection_schema",
        _description: description,
        _createdAt: new Date().toISOString(),
        _createdBy: "admin_portal_setup",
      });
      console.log(`  ✅ ${colName}`);
      count++;
    } catch (e) {
      console.log(`  ❌ ${colName}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\n${count}/${Object.keys(collections).length} collections created.`);
  console.log("\n=== COLLECTION REFERENCE FOR APPS ===\n");
  
  console.log("FAYA PAY (Consumer App) reads:");
  console.log("  faya_admin_countries → check if country supported, get KYC rules");
  console.log("  faya_admin_policies → fetch terms/privacy for consent screens");
  console.log("  faya_admin_fees → show card fees to user");
  console.log("  faya_admin_limits → enforce spending limits");
  console.log("  faya_admin_app_content → onboarding text, KYC instructions");
  console.log("  faya_admin_stock → show physical cards available to order");
  console.log("  users (WRITE) → create consumer profile on registration");
  console.log("  cards (WRITE) → create virtual/physical cards");
  console.log("  wallets (WRITE) → create wallet, update balance");
  console.log("  kyc (WRITE) → submit KYC for admin review");
  console.log("  devices (WRITE) → register device info");
  console.log("  limits (WRITE) → set per-user limits based on KYC tier");
  console.log("  documents (WRITE) → upload ID, selfie, proof of address");
  console.log("  transactions (READ) → view transaction history");
  console.log("  support_tickets (WRITE) → create support tickets");
  console.log("");
  console.log("FAYA MERCHANT (Business App) reads:");
  console.log("  faya_admin_countries → check if country supported, get KYB rules");
  console.log("  faya_admin_policies → fetch merchant terms for consent");
  console.log("  faya_admin_fees → show merchant acceptance fees");
  console.log("  faya_admin_app_content → merchant onboarding text");
  console.log("  faya_admin_stock → show terminals available to order");
  console.log("  merchants (WRITE) → create merchant profile on registration");
  console.log("  branches (WRITE) → create branches");
  console.log("  staff (WRITE) → create POS staff with PINs");
  console.log("  terminals (WRITE) → register terminals");
  console.log("  settlements (READ) → view settlement batches");
  console.log("  disputes (READ/WRITE) → view/respond to disputes");
  console.log("  kyb (WRITE) → submit KYB for admin review");
  console.log("  documents (WRITE) → upload business docs");
  console.log("  transactions (READ) → view transaction history");
  console.log("  support_tickets (WRITE) → create support tickets");
  console.log("");
  console.log("FAYA POS (Payment App) reads/writes:");
  console.log("  staff (READ) → verify staff PIN on login");
  console.log("  terminals (READ) → get terminal config and capabilities");
  console.log("  pos_device_requests (WRITE) → create binding request on new device");
  console.log("  transactions (WRITE) → create payment records");
  console.log("  merchants (READ) → get merchant info for terminal");
  console.log("  branches (READ) → get branch info for terminal");
  console.log("");
  console.log("ADMIN PORTAL reads ALL, writes to faya_admin_* collections.");
  console.log("Admin approves KYC/KYB, manages stock, creates staff, publishes terms, etc.");
}
setup().catch(e => console.error("FATAL:", e));
