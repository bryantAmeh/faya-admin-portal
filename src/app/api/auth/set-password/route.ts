import { NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { hashPassword } from "@/lib/auth-helpers";

/**
 * POST /api/auth/set-password
 *
 * Admin sets a new password for a consumer or merchant. The password is
 * bcrypt-hashed and stored on the profile doc (`passwordHash`). The admin
 * never sees the plaintext after it's set — if a temp password was generated,
 * it's returned ONCE so the admin can share it with the user.
 *
 * This replaces the Firebase `sendPasswordResetEmail` flow for custom-auth
 * accounts (consumers + merchants). The admin portal staff still use Firebase
 * Auth's reset-email flow.
 *
 * Body:
 *   {
 *     "email": string,
 *     "role": "consumer" | "merchant",
 *     "newPassword"?: string,   // if omitted, a random temp password is generated
 *     "actorStaffId"?: string,
 *     "actorStaffName"?: string
 *   }
 *
 * Returns:
 *   200 { success, newPassword, uid }   — the plaintext password (temp or chosen), returned ONCE
 *   404 { success:false, error }        — no profile found
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

function generateTempPassword(length = 12): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = (await request.json()) as {
      email?: string;
      role?: string;
      newPassword?: string;
      actorStaffId?: string;
      actorStaffName?: string;
    };

    const email = (body.email ?? "").trim().toLowerCase();
    const role: "consumer" | "merchant" =
      body.role === "merchant" ? "merchant" : "consumer";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid email is required." },
        { status: 400 },
      );
    }

    // Decide the new plaintext password.
    let newPassword = (body.newPassword ?? "").trim();
    if (!newPassword) {
      newPassword = generateTempPassword(12);
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: "Password must be at least 6 characters.",
        },
        { status: 400 },
      );
    }

    // Resolve the profile doc by email.
    const colName = role === "merchant" ? "merchants" : "users";
    const emailField = role === "merchant" ? "ownerEmail" : "email";

    let docId: string | null = null;
    const q = query(collection(db, colName), where(emailField, "==", email));
    const snap = await getDocs(q);
    if (!snap.empty) {
      docId = snap.docs[0].id;
    } else if (role === "merchant") {
      const q2 = query(
        collection(db, colName),
        where("contactEmail", "==", email),
      );
      const snap2 = await getDocs(q2);
      if (!snap2.empty) docId = snap2.docs[0].id;
    }

    if (!docId) {
      return NextResponse.json(
        {
          success: false,
          error: `No ${role} account found for ${email}.`,
        },
        { status: 404 },
      );
    }

    // Hash + store.
    const passwordHash = hashPassword(newPassword);
    await updateDoc(doc(db, colName, docId), {
      passwordHash,
      authProvider: "faya_custom",
      updatedAt: Date.now(),
      // Clear any lingering reset token fields (future-proofing).
      resetToken: null,
      resetExpires: null,
    });

    // Best-effort audit log.
    try {
      const { db: adb } = await import("@/lib/firebase");
      const { collection: acol, addDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );
      const firestoreDb = adb();
      if (firestoreDb) {
        await addDoc(acol(firestoreDb, "faya_admin_audit_logs"), {
          staffId: body.actorStaffId ?? "unknown",
          staffName: body.actorStaffName ?? "Unknown admin",
          department: "",
          role: "",
          countryCode: null,
          action: `${role}.password_set_by_admin`,
          entityType: role,
          entityId: docId,
          beforeValue: "password_changed",
          afterValue: "password_hash_updated",
          reason: `Admin set a new password for ${role} ${email}.`,
          ipAddress: "0.0.0.0",
          deviceFingerprint: "admin_portal",
          createdAt: Date.now(),
          _serverTime: serverTimestamp(),
        });
      }
    } catch {
      // best-effort
    }

    // Return the plaintext ONCE so the admin can share it with the user.
    return NextResponse.json({
      success: true,
      uid: docId,
      email,
      role,
      newPassword,
      message:
        "Password updated. Share this temporary password with the user — they should change it after signing in.",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
