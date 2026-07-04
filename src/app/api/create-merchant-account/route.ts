import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export async function POST(request: Request) {
  const { email, password, name } = await request.json();

  try {
    if (!getApps().length) {
      initializeApp({ projectId: "fayapay-ece98" });
    }
    const app = getApps()[0];
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Delete existing user if any
    try {
      const existing = await auth.getUserByEmail(email);
      await auth.deleteUser(existing.uid);
    } catch {}

    // Create new user
    const user = await auth.createUser({ email, password, displayName: name });

    // Create merchant doc
    const now = Date.now();
    await db.collection("merchants").doc(user.uid).set({
      id: user.uid, email,
      legalName: name + " Trading", tradingName: name + " Store",
      merchantCode: `FAY-NG-M-${now.toString().slice(-5)}`,
      businessType: "sole_proprietor", industry: "General Retail",
      countryCode: "NG", contactEmail: email,
      ownerName: name, ownerEmail: email,
      kybStatus: "pending", riskCategory: "low",
      status: "onboarding", platforms: ["merchantApp"],
      terminalCount: 0, phonePosCount: 0,
      lifetimeVolume: 0, monthlyVolume: 0,
      transactionCount: 0, chargebackRate: 0,
      settlementCurrency: "NGN",
      createdAt: now, updatedAt: now,
    });

    return NextResponse.json({ success: true, uid: user.uid, email });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
