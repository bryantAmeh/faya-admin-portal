import { NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";

/**
 * POST /api/create-consumer-account
 *
 * Creates a Faya Pay CONSUMER profile. Called by the Faya Pay app during
 * registration.
 *
 * DUAL-ROLE SUPPORT (consumer + merchant under one email):
 *   Firebase Auth uses ONE account per email. If a user already registered
 *   with Faya Merchant (same email), this route REUSES the existing Auth
 *   account instead of erroring with "email-already-in-use". It then creates
 *   a consumer profile in the `users` collection keyed by the same UID.
 *
 *   The ONLY blocking condition is: a CONSUMER profile already exists for
 *   this email in the `users` collection. A merchant profile existing is NOT
 *   a blocker — that's the dual-role case the user explicitly wants.
 *
 * Flow:
 *   1. If NO Auth account exists for the email → createUserWithEmailAndPassword
 *   2. If an Auth account DOES exist → signInWithEmailAndPassword to obtain
 *      the UID (reuses the merchant's account). If the password is wrong,
 *      returns a clear error.
 *   3. If a consumer doc already exists in `users` (by UID or email) → 409
 *   4. Create consumer doc in `users` keyed by the UID.
 *
 * Body:
 *   {
 *     "email": string,
 *     "password": string,
 *     "firstName"?: string,
 *     "lastName"?: string,
 *     "fullName"?: string,
 *     "phone"?: string,
 *     "countryCode"?: string,
 *     "countryOfResidence"?: string,
 *     "nationality"?: string,
 *     "dateOfBirth"?: string
 *   }
 */
const firebaseConfig = {
  apiKey: "AIzaSyAuHmu4z06EPZJ6L4p0a_r-lrbGYo_RyPM",
  authDomain: "fayapay-ece98.firebaseapp.com",
  projectId: "fayapay-ece98",
  appId: "1:401350981808:web:127488fb53c6e534736375",
};

function getClientApp() {
  if (!getApps().length) initializeApp(firebaseConfig);
  return getApp();
}

export async function POST(request: Request) {
  try {
    const app = getClientApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    const body = (await request.json()) as {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      fullName?: string;
      phone?: string;
      countryCode?: string;
      countryOfResidence?: string;
      nationality?: string;
      dateOfBirth?: string;
    };

    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid email is required." },
        { status: 400 },
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters." },
        { status: 400 },
      );
    }

    const firstName = (body.firstName ?? "").trim();
    const lastName = (body.lastName ?? "").trim();
    const fullName =
      (body.fullName ?? "").trim() ||
      [firstName, lastName].filter(Boolean).join(" ").trim();
    const phone = (body.phone ?? "").trim();
    const countryCode = (body.countryCode ?? "").trim().toUpperCase();
    const countryOfResidence = (body.countryOfResidence ?? "").trim();
    const nationality = (body.nationality ?? "").trim();
    const dateOfBirth = (body.dateOfBirth ?? "").trim();

    /* ---------- 1. Resolve or create the Firebase Auth account ---------- */
    let uid: string;
    let authExisted = false;

    // Try to create a new Auth account first. If the email is already in use
    // (e.g. the user registered with Faya Merchant), fall back to signing in
    // with the provided password to REUSE the existing account — this is the
    // dual-role path (one email, both consumer + merchant profiles).
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      uid = cred.user.uid;
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      if (code === "auth/email-already-in-use") {
        // Account exists — reuse it by signing in (dual-role).
        authExisted = true;
        try {
          const cred = await signInWithEmailAndPassword(auth, email, password);
          uid = cred.user.uid;
        } catch {
          return NextResponse.json(
            {
              success: false,
              error:
                "An account already exists with this email (likely from Faya Merchant). Please use the same password to link your consumer profile, or sign in with that account.",
              email,
            },
            { status: 401 },
          );
        }
      } else {
        throw e;
      }
    }

    /* ---------- 2. Block only if a CONSUMER profile already exists ---------- */
    // Check by UID first (fast path).
    const byUidSnap = await getDoc(doc(db, "users", uid));
    if (byUidSnap.exists()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A consumer account with this email already exists. Please sign in to Faya Pay instead.",
          uid,
          email,
        },
        { status: 409 },
      );
    }

    // Email scan: a consumer doc might exist under a different doc id but with
    // the same email. This is the authoritative duplicate-consumer check.
    const emailQuery = await getDocs(
      query(collection(db, "users"), where("email", "==", email), ),
    );
    if (!emailQuery.empty) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A consumer account with this email already exists. Please sign in to Faya Pay instead.",
          uid: emailQuery.docs[0].id,
          email,
        },
        { status: 409 },
      );
    }

    /* ---------- 3. Check whether a merchant profile also exists (dual-role) ---------- */
    const merchantSnap = await getDoc(doc(db, "merchants", uid));
    let merchantByEmail = false;
    if (!merchantSnap.exists()) {
      const mEmailQ = await getDocs(
        query(collection(db, "merchants"), where("ownerEmail", "==", email)),
      );
      merchantByEmail = !mEmailQ.empty;
    }
    const dualRole = merchantSnap.exists() || merchantByEmail;

    /* ---------- 4. Create the consumer profile in `users` ---------- */
    const now = Date.now();
    const consumerCode = `FAY-NG-C-${now.toString().slice(-6)}`;

    const consumerDoc = {
      id: uid,
      consumerCode,
      email,
      firstName,
      lastName,
      fullName: fullName || email,
      phone,
      countryCode,
      countryOfResidence: countryOfResidence || countryCode,
      nationality,
      dateOfBirth,
      kycStatus: "pending",
      kycTier: "tier_1",
      kycCaseId: null,
      riskScore: 0,
      status: "pending_kyc",
      platforms: ["consumerApp"],
      lifetimeVolume: 0,
      monthlyVolume: 0,
      transactionCount: 0,
      walletBalance: 0,
      currency: "NGN",
      emailVerified: authExisted,
      phoneVerified: false,
      acceptedTerms: false,
      createdAt: now,
      updatedAt: now,
      notes: "",
      // Provenance: marks that this consumer shares an Auth account with a merchant
      dualRoleWithMerchant: dualRole,
      source: "faya_pay_app",
    };

    await setDoc(doc(db, "users", uid), consumerDoc);

    return NextResponse.json({
      success: true,
      uid,
      email,
      dualRole,
      created: authExisted ? "consumer_profile" : "auth_and_consumer",
      message: dualRole
        ? "Consumer profile created. This account is also linked to a merchant profile."
        : "Consumer account created successfully.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = (e as { code?: string })?.code ?? "";
    return NextResponse.json(
      { success: false, error: msg, code },
      { status: 500 },
    );
  }
}
