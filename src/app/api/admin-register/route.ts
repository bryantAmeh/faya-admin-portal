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
  getDocs,
  query,
  where,
} from "firebase/firestore";

/**
 * POST /api/admin-register
 *
 * The invitee completes their admin registration. They open the invite link
 * (?invite=TOKEN), the form loads the invite details (email, name, department,
 * role, country access), they set a password + phone, and submit.
 *
 * This route:
 *   1. Verifies the invite token (valid, pending, not expired).
 *   2. Creates a Firebase Auth account with the invite email + chosen password.
 *   3. Creates an `faya_admin_staff` doc keyed by the new Auth UID.
 *   4. Marks the invite as "used".
 *
 * Body:
 *   { token, password, phone }
 *
 * Returns:
 *   200 { success, uid, email, message }
 *   404 { success:false, error: "Invalid/expired/used invite" }
 *   409 { success:false, error: "Auth account already exists for this email" }
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
    const auth = getAuth(getApp());

    const body = (await request.json()) as {
      token?: string;
      password?: string;
      phone?: string;
    };

    const token = (body.token ?? "").trim();
    const password = body.password ?? "";
    const phone = (body.phone ?? "").trim();

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing invite token." },
        { status: 400 },
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters." },
        { status: 400 },
      );
    }

    /* ---------- 1. Verify the invite token ---------- */
    const inviteQ = query(
      collection(db, "faya_admin_staff_invites"),
      where("token", "==", token),
    );
    const inviteSnap = await getDocs(inviteQ);
    if (inviteSnap.empty) {
      return NextResponse.json(
        { success: false, error: "Invalid invite token. Please request a new invite link." },
        { status: 404 },
      );
    }

    const inviteDoc = inviteSnap.docs[0];
    const invite = inviteDoc.data() as Record<string, unknown>;
    const status = invite.status as string;
    const expiresAt = (invite.expiresAt as number) ?? 0;

    if (status === "used") {
      return NextResponse.json(
        { success: false, error: "This invite link has already been used. Please sign in." },
        { status: 404 },
      );
    }
    if (status === "revoked") {
      return NextResponse.json(
        { success: false, error: "This invite link has been revoked." },
        { status: 404 },
      );
    }
    if (expiresAt && expiresAt < Date.now()) {
      return NextResponse.json(
        { success: false, error: "This invite link has expired. Please request a new invite." },
        { status: 404 },
      );
    }

    const email = invite.email as string;
    const firstName = invite.firstName as string;
    const lastName = invite.lastName as string;

    /* ---------- 2. Create the Firebase Auth account ---------- */
    let uid: string;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      uid = cred.user.uid;
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      if (code === "auth/email-already-in-use") {
        return NextResponse.json(
          {
            success: false,
            error:
              "A Firebase Auth account already exists for this email. Please sign in instead, or contact the super admin to reset your password.",
          },
          { status: 409 },
        );
      }
      throw e;
    }

    /* ---------- 3. Create the admin staff doc ---------- */
    const now = Date.now();
    const staffId = uid;
    const staffCode = `ADM-${now.toString().slice(-6)}`;

    const staffDoc = {
      id: staffId,
      staffCode,
      firstName,
      lastName,
      email,
      phone,
      departmentId: (invite.departmentId as string) ?? "",
      roleId: (invite.roleId as string) ?? "",
      managerId: null,
      status: "active",
      mfaEnabled: false,
      countries: (invite.countryAccess as { countryCode: string; accessLevel: string }[]) ?? [],
      regionAccess: (invite.regionAccess as string[]) ?? [],
      // Default to all view.* permissions so the new admin can see the portal
      // read-only. A super admin edits them afterward to add action perms or
      // restrict view access.
      permissions: [
        "view.dashboard", "view.users", "view.merchants", "view.stock",
        "view.compliance", "view.risk", "view.devices", "view.finance",
        "view.support", "view.disputes", "view.countries", "view.staff",
        "view.audit", "view.approvals",
      ],
      lastLoginAt: null,
      failedLoginCount: 0,
      createdBy: (invite.createdBy as string) ?? "invite",
      createdAt: now,
      updatedAt: now,
      notes: `Self-registered via invite link. Invited by ${(invite.createdBy as string) ?? "super admin"}.`,
      invitedVia: "admin_invite_link",
      inviteId: inviteDoc.id,
    };

    await setDoc(doc(db, "faya_admin_staff", staffId), staffDoc);

    /* ---------- 4. Mark the invite as used ---------- */
    await setDoc(
      inviteDoc.ref,
      {
        status: "used",
        usedAt: now,
        usedByUid: uid,
      },
      { merge: true },
    );

    return NextResponse.json({
      success: true,
      uid,
      email,
      message:
        "Admin account created successfully. You can now sign in to the Faya Admin Portal with your email and password.",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
