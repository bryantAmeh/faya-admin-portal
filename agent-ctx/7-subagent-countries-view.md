# Task 7 — Countries management view + country detail view

Agent: subagent-countries-view
Date: (auto)

## Files produced
- `/home/z/my-project/src/components/portal/views/countries-view.tsx` — `CountriesView`
- `/home/z/my-project/src/components/portal/views/country-detail-view.tsx` — `CountryDetailView`

## Key decisions
- Re-used shared helpers `ViewHeader`, `StatCard`, `EmptyState`, `ViewContainer` from `view-helpers.tsx` so the new views match the dashboard's emerald-accent visual style.
- Region filter is derived from the country's timezone prefix (`Africa/Lagos` → `Africa`) so we don't need a new field on `CountryConfig`.
- Add-Country dialog creates a new `CountryConfig` with `EMPTY_RULES` objects and zero counters; the new country's id is `country_<CODE>` and `launchStatus` is derived from the chosen `status` (capitalized).
- Edit-Rules dialog edits one rule set at a time. The save path validates the JSON parses to a plain object (rejects arrays/null/scalars), then calls `adminData.updateCountry(country.id, { [ruleKey]: parsed, updatedAt: Date.now() })` and logs audit `country.change_<ruleKey>` with before/after JSON.
- Status changer uses an `AlertDialog` confirmation, then `adminData.updateCountry` + audit `country.change_status`.
- Super Admin gate is `staff?.departmentId === "dept_super_admin"` (per task spec).

## Verification
- `bunx eslint <new files>` — passes with no errors/warnings.
- `bun run lint` — the only remaining project-wide lint error is in pre-existing `src/hooks/use-auth.ts` (not touched by this task).
