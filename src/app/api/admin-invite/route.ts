import { NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";

/**
 * POST /api/admin-invite
 *   Super admin generates an invite link for a prospective admin.
 *   Body: { email, firstName, lastName, departmentId, roleId, countryAccess:[{countryCode,accessLevel}], regionAccess:[], createdBy, createdByUid, createdByEmail }
 *   Stores a doc in `faya_admin_staff_invites` with status "pending" + a random token.
 *   Returns { success, token, inviteUrl, invite }.
 *
 * GET /api/admin-invite?token=<token>
 *   (Public — called by the registration form to load invite details.)
 *   Returns { success, invite } or { success:false, error } if invalid/expired/used.
 *
 * DELETE /api/admin-invite?token=<token>
 *   Super admin revokes an invite. Sets status "revoked".
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

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = (await request.json()) as {
      email?: string;
      firstName?: string;
      lastName?: string;
      departmentId?: string;
      roleId?: string;
      countryAccess?: { countryCode: string; accessLevel: string }[];
      regionAccess?: string[];
      createdBy?: string;
      createdByUid?: string;
      createdByEmail?: string;
    };

    const email = (body.email ?? "").trim().toLowerCase();
    const firstName = (body.firstName ?? "").trim();
    const lastName = (body.lastName ?? "").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid email is required." },
        { status: 400 },
      );
    }
    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: "First name and last name are required." },
        { status: 400 },
      );
    }

    // Check for an existing pending invite for this email (reuse it).
    const existingQ = query(
      collection(db, "faya_admin_staff_invites"),
      where("email", "==", email),
      where("status", "==", "pending"),
    );
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0].data() as Record<string, unknown>;
      return NextResponse.json({
        success: true,
        token: existing.token,
        inviteUrl: `${request.headers.get("origin") ?? ""}/?invite=${existing.token}`,
        invite: existing,
        reused: true,
        message: "An invite for this email is already pending. Resharing the link.",
      });
    }

    const token = generateToken();
    const now = Date.now();
    const inviteId = `invite_${now}_${Math.random().toString(36).slice(2, 8)}`;

    const invite = {
      id: inviteId,
      token,
      email,
      firstName,
      lastName,
      departmentId: body.departmentId ?? "",
      roleId: body.roleId ?? "",
      countryAccess: body.countryAccess ?? [],
      regionAccess: body.regionAccess ?? [],
      status: "pending",
      createdBy: body.createdBy ?? "unknown",
      createdByUid: body.createdByUid ?? "",
      createdByEmail: body.createdByEmail ?? "",
      createdAt: now,
      expiresAt: now + INVITE_TTL_MS,
      usedAt: null,
      usedByUid: null,
    };

    await setDoc(doc(db, "faya_admin_staff_invites", inviteId), invite);

    const origin = request.headers.get("origin") ?? "";
    const inviteUrl = `${origin}/?invite=${token}`;

    return NextResponse.json({
      success: true,
      token,
      inviteUrl,
      invite,
      message: `Invite link generated for ${firstName} ${lastName} (${email}).`,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing token." },
        { status: 400 },
      );
    }

    const q = query(
      collection(db, "faya_admin_staff_invites"),
      where("token", "==", token),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return NextResponse.json(
        { success: false, error: "Invalid invite token. Please request a new invite link." },
        { status: 404 },
      );
    }

    const invite = snap.docs[0].data() as Record<string, unknown>;
    const now = Date.now();
    const expiresAt = (invite.expiresAt as number) ?? 0;
    const status = invite.status as string;

    if (status === "used") {
      return NextResponse.json({
        success: false,
        error: "This invite link has already been used. Please sign in instead.",
        status: "used",
      });
    }
    if (status === "revoked") {
      return NextResponse.json({
        success: false,
        error: "This invite link has been revoked by an administrator.",
        status: "revoked",
      });
    }
    if (expiresAt && expiresAt < now) {
      return NextResponse.json({
        success: false,
        error: "This invite link has expired. Please request a new invite.",
        status: "expired",
      });
    }

    return NextResponse.json({ success: true, invite });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing token." },
        { status: 400 },
      );
    }

    const q = query(
      collection(db, "faya_admin_staff_invites"),
      where("token", "==", token),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return NextResponse.json(
        { success: false, error: "Invite not found." },
        { status: 404 },
      );
    }

    // Mark as revoked (don't hard-delete so there's an audit trail).
    const inviteRef = snap.docs[0].ref;
    await setDoc(
      inviteRef,
      { status: "revoked", revokedAt: Date.now() },
      { merge: true },
    );

    return NextResponse.json({ success: true, message: "Invite revoked." });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
