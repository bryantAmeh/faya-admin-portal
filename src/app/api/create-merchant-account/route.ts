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
 * POST /api/create-merchant-account
 *
 * Creates a Faya Business / Faya POS MERCHANT account. The password is
 * bcrypt-hashed and stored on the `merchants` profile doc (`passwordHash`).
 * Authentication is handled by /api/auth/login verifying that hash — NOT
 * Firebase Admin SDK (which had no credentials in this environment).
 *
 * DUAL-ROLE: the same email can have an independent consumer account
 * (in `users`) and merchant account (in `merchants`) with different
 * passwords. No collision.
 *
 * BLOCKING RULE:
 *   A merchant profile must not already exist for the email in `merchants`.
 *
 * Body:
 *   {
 *     "email": string,
 *     "password": string,
 *     "name": string,            // owner / trading name
 *     "tradingName"?: string,
 *     "legalName"?: string,
 *     "businessType"?: string,
 *     "industry"?: string,
 *     "countryCode"?: string,
 *     "phone"?: string,
 *     "address"?: string,
 *     "city"?: string
 *   }
 *
 * Returns:
 *   200 { success, uid, email }
 *   409 { success:false, error: "A merchant account with this email already exists..." }
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
      name?: string;
      tradingName?: string;
      legalName?: string;
      businessType?: string;
      industry?: string;
      countryCode?: string;
      phone?: string;
      address?: string;
      city?: string;
    };

    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const name = (body.name ?? "").trim();

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
    if (!name) {
      return NextResponse.json(
        { success: false, error: "A name is required." },
        { status: 400 },
      );
    }

    const tradingName = (body.tradingName ?? `${name} Store`).trim();
    const legalName = (body.legalName ?? `${name} Trading`).trim();
    const businessType = (body.businessType ?? "sole_proprietor").trim();
    const industry = (body.industry ?? "General Retail").trim();
    const countryCode = (body.countryCode ?? "NG").trim().toUpperCase();
    const phone = (body.phone ?? "").trim();
    const address = (body.address ?? "").trim();
    const city = (body.city ?? "").trim();

    /* ---------- 1. Block if a MERCHANT profile already exists ---------- */
    const emailQuery = await getDocs(
      query(collection(db, "merchants"), where("ownerEmail", "==", email)),
    );
    if (!emailQuery.empty) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A merchant account with this email already exists. Please sign in to Faya Business instead.",
          uid: emailQuery.docs[0].id,
          email,
        },
        { status: 409 },
      );
    }

    /* ---------- 2. Create the merchant profile with a bcrypt passwordHash ---------- */
    const uid = `mch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const now = Date.now();
    const merchantCode = `FAY-${countryCode}-M-${now.toString().slice(-5)}`;

    const merchantDoc = {
      id: uid,
      merchantCode,
      legalName,
      tradingName,
      businessType,
      industry,
      countryCode,
      contactEmail: email,
      contactPhone: phone,
      address,
      city,
      ownerName: name,
      ownerEmail: email,
      ownerPhone: phone,
      passwordHash: hashPassword(password),
      kybStatus: "pending",
      kybCaseId: null,
      riskCategory: "low",
      status: "onboarding",
      platforms: ["merchantApp"],
      terminalCount: 0,
      phonePosCount: 0,
      lifetimeVolume: 0,
      monthlyVolume: 0,
      transactionCount: 0,
      chargebackRate: 0,
      settlementCurrency: countryCode === "NG" ? "NGN" : "NGN",
      createdAt: now,
      updatedAt: now,
      notes: "",
      authProvider: "faya_custom",
      source: "faya_business_app",
    };

    await setDoc(doc(db, "merchants", uid), merchantDoc);

    return NextResponse.json({
      success: true,
      uid,
      email,
      merchantCode,
      message:
        "Merchant account created successfully. The user can now sign in to Faya Business with this email and password.",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
