import { NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";

/**
 * POST /api/create-consumer-account
 *
 * Creates a Faya Pay CONSUMER account as a FULLY INDEPENDENT registration —
 * the user enters their email, password, and profile/KYC data like a normal
 * person, even if that email is already registered as a merchant. The two
 * accounts (consumer + merchant) have DIFFERENT passwords and are separate
 * Firebase Auth accounts.
 *
 * HOW THIS IS POSSIBLE (Firebase Auth requires one password per email):
 *   Firebase Auth enforces a unique email/password credential per email. To
 *   allow the same person to have an independent consumer account alongside
 *   their merchant account (with a different password), the consumer account's
 *   AUTH email uses plus-addressing: `amehbryant+consumer@gmail.com`. Firebase
 *   treats `+consumer` as a distinct account with its own password, while
 *   Gmail (and most providers) deliver any verification email to the base
 *   address. The REAL email (`amehbryant@gmail.com`) is stored in the
 *   Firestore `users` profile and is what the admin portal displays and uses
 *   to link the consumer ↔ merchant profiles.
 *
 *   The user NEVER sees or types the `+consumer` suffix. The Faya Pay app
 *   calls this endpoint with the real email + password + profile fields; this
 *   route derives the suffixed auth email internally.
 *
 * BLOCKING RULE (only one):
 *   A consumer profile must not already exist for the real email in `users`.
 *   A merchant profile existing is NOT a blocker — that's the whole point.
 *
 * FAYA PAY APP LOGIN (how the consumer signs in afterward):
 *   The Faya Pay app signs in via the Firebase Auth client SDK using the
 *   plus-addressed email: `signInWithEmailAndPassword(auth, "<local>+consumer@<domain>", password)`.
 *   The app derives the `+consumer` suffix the same way this route does (see
 *   deriveAuthEmail below). The password never leaves the device at login.
 *
 * Body:
 *   {
 *     "email": string,            // real email, e.g. amehbryant@gmail.com
 *     "password": string,         // consumer account password (independent)
 *     "firstName"?: string,
 *     "lastName"?: string,
 *     "fullName"?: string,
 *     "phone"?: string,
 *     "countryCode"?: string,     // e.g. "NG"
 *     "countryOfResidence"?: string,
 *     "nationality"?: string,
 *     "dateOfBirth"?: string
 *   }
 *
 * Returns:
 *   200 { success: true, uid, email, authEmail }
 *   409 { success: false, error: "A consumer account with this email already exists..." }
 *   400 / 500 { success: false, error }
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

/**
 * Derive the Firebase Auth email for a consumer account from the real email.
 * Strips any existing plus-suffix, then appends `+consumer` before the `@`.
 *   amehbryant@gmail.com        → amehbryant+consumer@gmail.com
 *   amehbryant+old@gmail.com    → amehbryant+consumer@gmail.com
 *   Jane.Doe@Example.co.uk      → Jane.Doe+consumer@Example.co.uk
 *
 * The Faya Pay app MUST use the exact same derivation at login time.
 */
export function deriveAuthEmail(realEmail: string, role = "consumer"): string {
  const at = realEmail.lastIndexOf("@");
  if (at < 1) return realEmail; // malformed; let Firebase reject it
  const domain = realEmail.slice(at + 1);
  const local = realEmail.slice(0, at);
  const baseLocal = local.split("+")[0];
  return `${baseLocal}+${role}@${domain}`;
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

    /* ---------- 1. Block if a CONSUMER profile already exists (real email) ---------- */
    // The `users` collection stores the REAL email. Querying by it is the
    // authoritative duplicate-consumer check, regardless of Auth email suffix.
    const emailQuery = await getDocs(
      query(collection(db, "users"), where("email", "==", email)),
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

    /* ---------- 2. Create an INDEPENDENT Firebase Auth account ---------- */
    // Auth email uses plus-addressing so it's a distinct account with its own
    // password — even if a merchant account exists for the same real email.
    const authEmail = deriveAuthEmail(email);

    let uid: string;
    try {
      const cred = await createUserWithEmailAndPassword(auth, authEmail, password);
      uid = cred.user.uid;
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      if (code === "auth/email-already-in-use") {
        // The plus-addressed auth account already exists but no `users` doc
        // was found in step 1 → orphaned auth from a failed prior attempt.
        // Tell the user to sign in (they already have a consumer account).
        return NextResponse.json(
          {
            success: false,
            error:
              "A consumer account with this email already exists. Please sign in to Faya Pay instead.",
            email,
            authEmail,
          },
          { status: 409 },
        );
      }
      if (code === "auth/invalid-email") {
        return NextResponse.json(
          { success: false, error: "The email address is not valid.", email },
          { status: 400 },
        );
      }
      if (code === "auth/weak-password") {
        return NextResponse.json(
          { success: false, error: "Password is too weak. Use at least 6 characters." },
          { status: 400 },
        );
      }
      throw e;
    }

    /* ---------- 3. Create the consumer profile in `users` ---------- */
    // NOTE: we do NOT auto-detect or link the merchant here. The consumer
    // account is a normal, standalone registration. The admin portal links
    // consumer ↔ merchant profiles by real email for display purposes only.
    const now = Date.now();
    const consumerCode = `FAY-NG-C-${now.toString().slice(-6)}`;

    const consumerDoc = {
      id: uid,
      consumerCode,
      email,            // REAL email — used for display, search, dual-role linking
      authEmail,        // plus-addressed Firebase Auth email (reference only)
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
      emailVerified: false,
      phoneVerified: false,
      acceptedTerms: false,
      createdAt: now,
      updatedAt: now,
      notes: "",
      source: "faya_pay_app",
    };

    await setDoc(doc(db, "users", uid), consumerDoc);

    return NextResponse.json({
      success: true,
      uid,
      email,
      authEmail,
      message:
        "Consumer account created successfully. The user can now sign in to Faya Pay with this email and password.",
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
