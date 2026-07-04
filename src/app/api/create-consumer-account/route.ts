import { NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { hashPassword } from "@/lib/auth-helpers";

/**
 * POST /api/create-consumer-account
 *
 * Creates a Faya Pay CONSUMER account. The password is bcrypt-hashed and
 * stored on the `users` profile doc (`passwordHash`). Authentication is
 * handled by /api/auth/login verifying that hash — NOT Firebase Auth.
 *
 * DUAL-ROLE (consumer + merchant under one email):
 *   Because auth is Firestore-based (one doc per role, each with its own
 *   passwordHash), the same email can have an independent consumer account
 *   AND an independent merchant account with DIFFERENT passwords. No
 *   plus-addressing, no Firebase Auth email collision.
 *
 * BLOCKING RULE:
 *   A consumer profile must not already exist for the email in `users`.
 *   A merchant profile existing is NOT a blocker.
 *
 * Body:
 *   {
 *     "email": string,
 *     "password": string,
 *     "firstName"?: string, "lastName"?: string, "fullName"?: string,
 *     "phone"?: string, "countryCode"?: string,
 *     "countryOfResidence"?: string, "nationality"?: string, "dateOfBirth"?: string
 *   }
 *
 * Returns:
 *   200 { success, uid, email }
 *   409 { success:false, error: "A consumer account with this email already exists..." }
 *   400 / 500 { success:false, error }
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

export async function POST(request: Request) {
  try {
    const db = getDb();
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

    /* ---------- 1. Block if a CONSUMER profile already exists ---------- */
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

    /* ---------- 2. Create the consumer profile with a bcrypt passwordHash ---------- */
    const uid = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const now = Date.now();
    const consumerCode = `FAY-NG-C-${now.toString().slice(-6)}`;

    const consumerDoc = {
      id: uid,
      consumerCode,
      email,
      passwordHash: hashPassword(password),
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
      authProvider: "faya_custom", // marks this account uses Firestore bcrypt auth
      source: "faya_pay_app",
    };

    await setDoc(doc(db, "users", uid), consumerDoc);

    return NextResponse.json({
      success: true,
      uid,
      email,
      message:
        "Consumer account created successfully. The user can now sign in to Faya Pay with this email and password.",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
