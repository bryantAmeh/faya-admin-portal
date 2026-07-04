import { NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";

/**
 * GET /api/legal-content?type=consumer_terms&country=NG
 * GET /api/legal-content?type=privacy_policy
 * GET /api/legal-content (returns all published policies)
 * 
 * Used by Faya Pay, Faya Merchant, and Faya POS apps to fetch the current
 * published terms, privacy policy, and other legal documents.
 * 
 * Admin manages all legal content from the admin portal — apps just read.
 */
const firebaseConfig = {
  apiKey: "AIzaSyAuHmu4z06EPZJ6L4p0a_r-lrbGYo_RyPM",
  authDomain: "fayapay-ece98.firebaseapp.com",
  projectId: "fayapay-ece98",
  appId: "1:401350981808:web:127488fb53c6e534736375",
};

function getDb() {
  if (!getApps().length) initializeApp(firebaseConfig);
  return getFirestore();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const country = searchParams.get("country");

  try {
    const db = getDb();
    const snap = await getDocs(collection(db, "faya_admin_policies"));
    let policies = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p: Record<string, unknown>) => p.status === "published");

    // Filter by type if specified
    if (type) {
      policies = policies.filter((p: Record<string, unknown>) => p.policyType === type);
    }

    // Filter by country if specified — prefer country-specific, fall back to global (null)
    if (country) {
      const countrySpecific = policies.filter(
        (p: Record<string, unknown>) => p.countryCode === country
      );
      const global = policies.filter(
        (p: Record<string, unknown>) => p.countryCode === null || p.countryCode === undefined
      );
      // Merge: country-specific overrides global for same policyType
      const merged = new Map<string, Record<string, unknown>>();
      for (const p of global) merged.set(p.policyType as string, p);
      for (const p of countrySpecific) merged.set(p.policyType as string, p);
      policies = Array.from(merged.values());
    }

    // If type is specified, return the single matching policy
    if (type && policies.length > 0) {
      return NextResponse.json({
        found: true,
        policy: policies[0],
      });
    }

    return NextResponse.json({
      found: policies.length > 0,
      policies: policies.map((p: Record<string, unknown>) => ({
        id: p.id,
        title: p.title,
        policyType: p.policyType,
        version: p.version,
        effectiveDate: p.effectiveDate,
        contentBody: p.contentBody,
        summaryOfChanges: p.summaryOfChanges,
        appAffected: p.appAffected,
        countryCode: p.countryCode,
        publishedAt: p.publishedAt,
      })),
    });
  } catch (e) {
    return NextResponse.json({
      found: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
