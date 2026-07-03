/**
 * Faya Admin Portal — Access scope helpers
 *
 * Resolves which countries / merchants / consumers / staff a staff member can
 * see, based on the spec's scope ladder:
 *   own → branch → country → region → global
 */
import type {
  AdminStaff,
  CountryConfig,
  Merchant,
  Consumer,
} from "./types";

export function isGlobalScope(staff: AdminStaff | null): boolean {
  if (!staff) return false;
  return staff.departmentId === "dept_super_admin";
}

export function getVisibleRegions(
  staff: AdminStaff | null,
  countries: CountryConfig[],
): string[] {
  if (!staff) return [];
  if (isGlobalScope(staff)) {
    return Array.from(new Set(countries.map((c) => c.region)));
  }
  return Array.from(new Set(staff.regionAccess));
}

export function getVisibleCountries(
  staff: AdminStaff | null,
  countries: CountryConfig[],
): CountryConfig[] {
  if (!staff) return [];
  if (isGlobalScope(staff)) return countries;

  const visibleCodes = new Set<string>();
  staff.countries.forEach((c) => visibleCodes.add(c.countryCode));
  const regionSet = new Set(staff.regionAccess);
  countries.forEach((c) => {
    if (regionSet.has(c.region)) visibleCodes.add(c.countryCode);
  });

  return countries.filter((c) => visibleCodes.has(c.countryCode));
}

export function getVisibleCountryCodes(
  staff: AdminStaff | null,
  countries: CountryConfig[],
): Set<string> {
  return new Set(getVisibleCountries(staff, countries).map((c) => c.countryCode));
}

export function getVisibleMerchants(
  staff: AdminStaff | null,
  countries: CountryConfig[],
  merchants: Merchant[],
): Merchant[] {
  const codes = getVisibleCountryCodes(staff, countries);
  return merchants.filter((m) => codes.has(m.countryCode));
}

export function getVisibleConsumers(
  staff: AdminStaff | null,
  countries: CountryConfig[],
  consumers: Consumer[],
): Consumer[] {
  if (isGlobalScope(staff)) return consumers;
  const codes = getVisibleCountryCodes(staff, countries);
  // Also build a set of country names for matching (apps may store full names)
  const names = new Set(
    getVisibleCountries(staff, countries).map(c => c.countryName.toLowerCase())
  );
  return consumers.filter((c) => {
    const code = (c.countryCode || c.countryOfResidence || "").toString();
    return codes.has(code) || names.has(code.toLowerCase());
  });
}

export function getVisibleStaff(
  staff: AdminStaff | null,
  countries: CountryConfig[],
  allStaff: AdminStaff[],
): AdminStaff[] {
  if (!staff) return [];
  if (isGlobalScope(staff)) return allStaff;

  const visibleCodes = getVisibleCountryCodes(staff, countries);
  return allStaff.filter((s) => {
    if (s.id === staff.id) return true;
    return s.countries.some((c) => visibleCodes.has(c.countryCode));
  });
}

export function getScopeLabel(staff: AdminStaff | null): string {
  if (!staff) return "—";
  if (isGlobalScope(staff)) return "Global";
  if (staff.regionAccess.length > 0) {
    return `Region: ${staff.regionAccess.join(", ")}`;
  }
  if (staff.countries.length > 0) {
    return `Country: ${staff.countries.map((c) => c.countryCode).join(", ")}`;
  }
  return "No access";
}
