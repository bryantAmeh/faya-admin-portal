import { NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";

/**
 * GET /api/account-status?uid=<firebaseUid>&role=consumer|merchant
 * GET /api/account-status?email=<email>&role=consumer|merchant
 *
 * Called by the Faya Pay, Faya Business, and Faya POS apps:
 *   1. AFTER Firebase Auth login succeeds — to check whether the account is
 *      allowed to log in. If `canLogin` is false, the app signs the user out
 *      and shows the reason (e.g. "Your account is suspended").
 *   2. BEFORE each transaction — to check `canTransact`. If false, the app
 *      blocks the transaction and shows the reason.
 *
 * WHY THIS IS NEEDED:
 *   Firebase Auth only verifies credentials (email + password). It does NOT
 *   know about the admin portal's `status` field (suspended / restricted /
 *   closed). A suspended user's Firebase Auth login still succeeds — so the
 *   apps MUST check this endpoint (or read their profile doc directly) to
 *   enforce admin suspensions.
 *
 * STATUS → PERMISSIONS MAPPING:
 *
 *   Consumer (Faya Pay):
 *     pending_kyc → canLogin=true,  canTransact=false (KYC not yet approved)
 *     active      → canLogin=true,  canTransact=true
 *     restricted  → canLogin=true,  canTransact=false (under review)
 *     suspended   → canLogin=false, canTransact=false
 *     closed      → canLogin=false, canTransact=false
 *
 *   Merchant (Faya Business / Faya POS):
 *     onboarding  → canLogin=true,  canTransact=false (KYB not yet approved)
 *     active      → canLogin=true,  canTransact=true
 *     restricted  → canLogin=true,  canTransact=false (under review)
 *     suspended   → canLogin=false, canTransact=false
 *     closed      → canLogin=false, canTransact=false
 *
 * APP INTEGRATION (pseudocode):
 *   // After signInWithEmailAndPassword succeeds:
 *   const res = await fetch(`/api/account-status?uid=${user.uid}&role=consumer`);
 *   const { canLogin, canTransact, status, reason } = await res.json();
 *   if (!canLogin) {
 *     await signOut(auth);
 *     showError(reason);  // "Your account is suspended. Contact support."
 *     return;
 *   }
 *   // Store canTransact for transaction gating.
 *
 *   // Before each transaction:
 *   if (!canTransact) {
 *     showError("Account not permitted to transact. Complete KYC or contact support.");
 *     return;
 *   }
 *
 * Returns:
 *   200 { found, uid, role, status, canLogin, canTransact, reason, kycStatus?, kybStatus? }
 *   400 { error: "Missing uid/email and role" }
 */
const firebaseConfig = {
  apiKey: "AIzaSyAuHmu4z06EPZJ6L4p0a_r-lrbGYo_RyPM",
  authDomain: "fayapay-ece98.firebaseapp.com",
  projectId: "fayapay-ece98",
  appId: "1:401350981808:web:127488fb53c6e534736375",
};

function getDb() {
  if (!getApps().length) initializeApp(firebaseConfig);
  return getFirestore(getApp());
}

/**
 * Map a status string to login + transaction permissions.
 * Works for both ConsumerStatus and MerchantStatus.
 */
function permissionsForStatus(
  status: string,
): { canLogin: boolean; canTransact: boolean; reason: string } {
  switch (status) {
    case "active":
      return {
        canLogin: true,
        canTransact: true,
        reason: "Account active.",
      };
    case "pending_kyc":
    case "onboarding":
      return {
        canLogin: true,
        canTransact: false,
        reason:
          "Account is onboarding. Complete KYC/KYB verification to enable transactions.",
      };
    case "restricted":
      return {
        canLogin: true,
        canTransact: false,
        reason:
          "Account is restricted. Some actions are blocked while under review. Contact support.",
      };
    case "suspended":
      return {
        canLogin: false,
        canTransact: false,
        reason:
          "Account is suspended. You cannot log in or transact. Contact Faya support.",
      };
    case "closed":
      return {
        canLogin: false,
        canTransact: false,
        reason:
          "Account is closed. Contact Faya support to reactivate.",
      };
    default:
      // Unknown status — fail safe: allow login but block transactions.
      return {
        canLogin: true,
        canTransact: false,
        reason: `Account status "${status}" — transactions blocked. Contact support.`,
      };
  }
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");
    const email = searchParams.get("email")?.trim().toLowerCase();
    const role = searchParams.get("role") === "merchant" ? "merchant" : "consumer";

    if (!uid && !email) {
      return NextResponse.json(
        {
          found: false,
          error: "Provide either uid or email, and role (consumer|merchant).",
        },
        { status: 400 },
      );
    }

    const colName = role === "merchant" ? "merchants" : "users";

    // Resolve the profile doc by UID first, then by email.
    let docData: Record<string, unknown> | null = null;
    let resolvedUid: string | null = null;

    if (uid) {
      const snap = await getDoc(doc(db, colName, uid));
      if (snap.exists()) {
        docData = snap.data() as Record<string, unknown>;
        resolvedUid = uid;
      }
    }

    if (!docData && email) {
      // Look up by email field (real email for consumers; ownerEmail/contactEmail
      // for merchants). This also catches dual-role lookups.
      const emailField = role === "merchant" ? "ownerEmail" : "email";
      const q = query(collection(db, colName), where(emailField, "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        docData = snap.docs[0].data() as Record<string, unknown>;
        resolvedUid = snap.docs[0].id;
      }
      // For merchants, also check contactEmail.
      if (!docData && role === "merchant") {
        const q2 = query(collection(db, colName), where("contactEmail", "==", email));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          docData = snap2.docs[0].data() as Record<string, unknown>;
          resolvedUid = snap2.docs[0].id;
        }
      }
    }

    if (!docData || !resolvedUid) {
      return NextResponse.json({
        found: false,
        uid: uid ?? null,
        email: email ?? null,
        role,
        canLogin: false,
        canTransact: false,
        reason: `No ${role} profile found. The account may not exist or may have been deleted.`,
      });
    }

    const status = (docData.status as string) ?? "unknown";
    const perms = permissionsForStatus(status);

    return NextResponse.json({
      found: true,
      uid: resolvedUid,
      email: (docData.email as string) ?? (docData.ownerEmail as string) ?? email ?? null,
      role,
      status,
      canLogin: perms.canLogin,
      canTransact: perms.canTransact,
      reason: perms.reason,
      // Include KYC/KYB status so the app can prompt the user to complete it.
      kycStatus: role === "consumer" ? ((docData.kycStatus as string) ?? null) : null,
      kybStatus: role === "merchant" ? ((docData.kybStatus as string) ?? null) : null,
      merchantCode: role === "merchant" ? ((docData.merchantCode as string) ?? null) : null,
      consumerCode: role === "consumer" ? ((docData.consumerCode as string) ?? null) : null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        found: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
