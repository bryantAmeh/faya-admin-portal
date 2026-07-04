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
import {
  hashPassword,
  verifyPassword,
  issueToken,
} from "@/lib/auth-helpers";

/**
 * POST /api/auth/login
 *
 * Custom password login for Faya Pay (consumers) and Faya Business / Faya POS
 * (merchants). Passwords are verified against a bcrypt hash stored on the
 * Firestore profile doc — NOT Firebase Auth. This lets the same email have
 * independent consumer + merchant accounts with different passwords.
 *
 * On first login after the migration, if a profile has no `passwordHash` yet,
 * the route returns a clear error telling the user to reset their password
 * (admin sets one via /api/auth/set-password).
 *
 * Body:
 *   {
 *     "email": string,
 *     "password": string,
 *     "role": "consumer" | "merchant"
 *   }
 *
 * Returns:
 *   200 { success, token, profile }   — credentials valid
 *   401 { success:false, error, needsPasswordReset } — wrong password OR no hash yet
 *   404 { success:false, error }      — no profile for this email+role
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
      role?: string;
    };

    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const role: "consumer" | "merchant" =
      body.role === "merchant" ? "merchant" : "consumer";

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 },
      );
    }

    // Resolve the profile doc. Consumer: lookup by `email`; Merchant: by
    // `ownerEmail` then `contactEmail`.
    const colName = role === "merchant" ? "merchants" : "users";
    const emailField = role === "merchant" ? "ownerEmail" : "email";

    let docId: string | null = null;
    let profile: Record<string, unknown> | null = null;

    const q = query(collection(db, colName), where(emailField, "==", email));
    const snap = await getDocs(q);
    if (!snap.empty) {
      docId = snap.docs[0].id;
      profile = snap.docs[0].data() as Record<string, unknown>;
    } else if (role === "merchant") {
      // Fallback: contactEmail for merchants.
      const q2 = query(
        collection(db, colName),
        where("contactEmail", "==", email),
      );
      const snap2 = await getDocs(q2);
      if (!snap2.empty) {
        docId = snap2.docs[0].id;
        profile = snap2.docs[0].data() as Record<string, unknown>;
      }
    }

    if (!docId || !profile) {
      return NextResponse.json(
        {
          success: false,
          error: `No ${role} account found for ${email}.`,
        },
        { status: 404 },
      );
    }

    const passwordHash = profile.passwordHash as string | undefined;

    // Migration case: profile exists but has no custom-auth hash yet.
    if (!passwordHash) {
      return NextResponse.json(
        {
          success: false,
          needsPasswordReset: true,
          error:
            "Your password hasn't been set for the new auth system. Please use the 'Forgot password' flow or contact support to set a new password.",
        },
        { status: 401 },
      );
    }

    if (!verifyPassword(password, passwordHash)) {
      return NextResponse.json(
        { success: false, error: "Incorrect email or password." },
        { status: 401 },
      );
    }

    // Issue a session token the app stores and sends on subsequent requests.
    const token = issueToken(docId, role);

    // Strip the hash before returning the profile.
    const { passwordHash: _omit, ...safeProfile } = profile;
    return NextResponse.json({
      success: true,
      token,
      uid: docId,
      role,
      profile: { ...safeProfile, id: docId },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
