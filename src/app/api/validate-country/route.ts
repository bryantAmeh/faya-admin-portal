import { NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

/**
 * GET /api/validate-country?country=NG
 * 
 * Used by Faya Pay, Faya Merchant, and Faya POS apps to check if a country
 * is supported before allowing account creation. If a country is not in the
 * admin portal's faya_admin_countries collection, the apps block registration.
 * 
 * Returns:
 *   { valid: true, country: {...} } — country is supported
 *   { valid: false, reason: "Country not supported" } — country not in admin
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
  const country = searchParams.get("country");

  if (!country) {
    return NextResponse.json({ valid: false, reason: "Missing country parameter" }, { status: 400 });
  }

  try {
    const db = getDb();
    const snap = await getDocs(collection(db, "faya_admin_countries"));
    const countries = snap.docs.map((d) => d.data());

    // Match by countryCode (case-insensitive) or countryName
    const match = countries.find(
      (c) =>
        (c.countryCode || "").toLowerCase() === country.toLowerCase() ||
        (c.countryName || "").toLowerCase() === country.toLowerCase()
    );

    if (!match) {
      return NextResponse.json({
        valid: false,
        reason: "Country not supported. Faya is not available in this country yet.",
        supportedCountries: countries
          .filter((c) => c.status === "live" || c.status === "pilot")
          .map((c) => ({ code: c.countryCode, name: c.countryName, status: c.status })),
      });
    }

    // Check if country is live or pilot (allow registration)
    const allowRegistration = match.status === "live" || match.status === "pilot";

    return NextResponse.json({
      valid: true,
      allowRegistration,
      country: {
        countryCode: match.countryCode,
        countryName: match.countryName,
        currency: match.currency,
        status: match.status,
        region: match.region,
        regulator: match.regulator,
        timezone: match.timezone,
        kycRules: match.kycRules,
        kybRules: match.kybRules,
        platforms: match.platforms,
      },
      reason: !allowRegistration
        ? `Country status is "${match.status}". Registration is only allowed for live or pilot countries.`
        : undefined,
    });
  } catch (e) {
    return NextResponse.json({
      valid: false,
      reason: "Unable to verify country. Please try again.",
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
