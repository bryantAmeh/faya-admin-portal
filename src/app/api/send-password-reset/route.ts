import { NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { deriveAuthEmail } from "../create-consumer-account/route";

/**
 * POST /api/send-password-reset
 *
 * Admin-triggered Firebase password reset email. Sends a secure reset link to
 * the user so they can set their OWN new password — the admin never sees or
 * sets the password. Used for both consumers (Faya Pay) and merchants (Faya
 * Business / Faya POS).
 *
 * HOW IT HANDLES DUAL-ROLE ACCOUNTS:
 *   - Merchants: the Firebase Auth email IS the real email (e.g.
 *     amehbryant@gmail.com). The reset email goes there directly.
 *   - Consumers: the Firebase Auth email is plus-addressed
 *     (amehbryant+consumer@gmail.com). The reset email is sent to that
 *     plus-addressed address — Gmail (and most providers) deliver `+consumer`
 *     mail to the base inbox, so the user receives it at their real address.
 *
 * Body:
 *   {
 *     "email": string,       // real email stored in the profile
 *     "role": "consumer" | "merchant",
 *     "actorStaffId"?: string,    // admin who triggered it (for audit)
 *     "actorStaffName"?: string
 *   }
 *
 * Returns:
 *   200 { success: true, sentTo, role }
 *   400 { success: false, error }
 *   500 { success: false, error }
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

    const body = (await request.json()) as {
      email?: string;
      role?: string;
      actorStaffId?: string;
      actorStaffName?: string;
    };

    const email = (body.email ?? "").trim().toLowerCase();
    const role = body.role === "merchant" ? "merchant" : "consumer";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid email is required." },
        { status: 400 },
      );
    }

    // Derive the Firebase Auth email:
    //  - consumer → plus-addressed (amehbryant+consumer@gmail.com)
    //  - merchant → real email as-is
    const authEmail =
      role === "consumer" ? deriveAuthEmail(email, "consumer") : email;

    // Firebase sends the reset email to authEmail. The reset link points to
    // the Firebase Auth action-code handler; the user picks a new password
    // there. The admin never sees the password. Using the default action
    // handler (no custom ActionCodeSettings) avoids invalid-continue-uri errors.
    await sendPasswordResetEmail(auth, authEmail);

    // Audit log entry (best-effort — don't fail the request if logging fails)
    try {
      const { db } = await import("@/lib/firebase");
      const { collection, addDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );
      const firestoreDb = db();
      if (firestoreDb) {
        await addDoc(collection(firestoreDb, "faya_admin_audit_logs"), {
          staffId: body.actorStaffId ?? "unknown",
          staffName: body.actorStaffName ?? "Unknown admin",
          department: "",
          role: "",
          countryCode: null,
          action: `${role}.password_reset_email_sent`,
          entityType: role,
          entityId: authEmail,
          beforeValue: undefined,
          afterValue: "reset_link_sent",
          reason: `Admin triggered password reset email for ${role} ${email} (auth email ${authEmail}).`,
          ipAddress: "0.0.0.0",
          deviceFingerprint: "admin_portal",
          createdAt: Date.now(),
          _serverTime: serverTimestamp(),
        });
      }
    } catch {
      // Audit logging is best-effort.
    }

    return NextResponse.json({
      success: true,
      sentTo: authEmail,
      role,
      message: `Password reset email sent to ${email}. The user will receive a secure link to set a new password.`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = (e as { code?: string })?.code ?? "";
    // Firebase returns auth/user-not-found (7, 8) when the account doesn't
    // exist. By default this leaks account existence — but for an admin tool
    // that's acceptable and helpful. Surface a clear message.
    if (code === "auth/user-not-found" || code === "auth/email-not-found") {
      return NextResponse.json(
        {
          success: false,
          error:
            "No Firebase Auth account found for this email. The user may not have registered yet, or the account was deleted.",
        },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { success: false, error: msg, code },
      { status: 500 },
    );
  }
}
