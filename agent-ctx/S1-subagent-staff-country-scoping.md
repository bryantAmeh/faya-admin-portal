# Task S1 — subagent-staff-country-scoping

## Task
Update Staff Management view (`src/components/portal/views/staff-view.tsx`) to enforce country-based staff categorization:
1. Filter staff by current admin's country scope using `getVisibleStaff(staff, countries, allStaff)` from access-scope
2. Add List / By Country toggle (segmented control) — By Country uses `groupStaffByCountry` to render staff grouped by country with per-country Cards
3. Update ViewHeader description to show scope: `Staff categorized by country · Your scope: ${getScopeLabel(currentStaff)}`
4. Update stat cards: "Visible Staff", "Active", "Suspended", new "Countries with Staff", "MFA Coverage"
5. Country filter dropdown only shows countries the admin can see (`getVisibleCountries`)
6. Create Staff dialog country checkboxes only show visible countries (Super Admin sees all)
7. Detail Sheet: prominent "Country Access" section at the top with country badges + access levels (view/operate/manage)

## Files Touched
- `/home/z/my-project/src/components/portal/views/staff-view.tsx` — patched via 10 atomic edits
- `/home/z/my-project/worklog.md` — appended S1 stage summary

## What I Changed in `staff-view.tsx`

### Imports
- Added `LayoutGrid` and `List` to lucide-react icon imports (used in List/By Country toggle).
- Added `ToggleGroup, ToggleGroupItem` from `@/components/ui/toggle-group`.
- Expanded access-scope import to: `getAccessSummary, getScopeLabel, getVisibleCountries, getVisibleStaff, groupStaffByCountry`.

### State + memos (after `canCreate`)
- `viewMode: "list" | "country"` state (default `"list"`).
- `visibleStaff = getVisibleStaff(currentStaff, countries, staff)` — runs BEFORE search/filter; Super Admin sees all, region-scoped sees union of regions + assigned countries, country-scoped sees only assigned countries.
- `visibleCountries = getVisibleCountries(currentStaff, countries)` — for filter dropdown + Create dialog.
- `filteredStaff` now derived from `visibleStaff` (was `staff`).
- `groupedStaffByCountry = groupStaffByCountry(filteredStaff)` — Map<countryCode, AdminStaff[]>.
- `countryGroups = Array.from(map.entries()).sort(by countryCode)` — stable alphabetical display order.
- `distinctCountryCount` — Set of unique country codes across visibleStaff (for the new stat card).

### Stats
- Replaced `staff.*` with `visibleStaff.*` everywhere.
- Added `countriesWithStaff: distinctCountryCount` field.

### ViewHeader
- Description: `` `Staff categorized by country · Your scope: ${getScopeLabel(currentStaff)}` ``

### Stat row (5 cards)
- "Visible Staff" (was "Total Staff"), Active, Suspended, **"Countries with Staff"** (new, Globe2 icon, tone="info", hint "in your scope"), MFA Coverage (hint "of visible staff").
- Grid changed from `md:grid-cols-4` → `md:grid-cols-3 lg:grid-cols-5` so 5 cards fit cleanly on desktop and stack 2-up on mobile.

### Country filter dropdown
- Iterates `visibleCountries` (was `countries`) — country-scoped admins only see their own countries as filter options.

### "Showing X of Y" footer
- Now `visibleStaff.length` (with parenthetical `(N total)` when scope hides some staff).

### Staff directory CardTitle
- Wrapped title and right-side controls in `flex-wrap` so the new toggle doesn't break on small screens.
- Added `<ToggleGroup type="single" variant="outline" size="sm">` with two items: "List" (`List` icon) and "By Country" (`LayoutGrid` icon).
- "X records" label is `hidden sm:inline` so the toggle stays prominent on mobile.

### By Country view (new rendering path)
- Added as a third ternary branch in `CardContent`: `viewMode === "country" ? <ByCountryView> : <ListView>`.
- For each `[countryCode, staffList]` in `countryGroups`, renders a `Card`:
  - `CardHeader` with emerald-tinted background (`bg-emerald-50/60 dark:bg-emerald-900/20`): `<Globe2>` icon + mono Badge with country code + country name + count Badge ("N staff").
  - `CardContent` (`p-2 space-y-1`): compact staff rows — avatar, name + "Dept · Role" subtitle, status/scope/MFA badges (hidden on mobile via `hidden sm:flex`), and the same actions DropdownMenu (View/Edit/Suspend/Unlock/Reset MFA/Force logout) reused verbatim from the table row.
- Clicking any row opens the detail Sheet (same `setDetailStaff(s)` handler).
- All filters (search, dept, role, country, status, MFA) layer on top of the grouping — `filteredStaff` is computed first, then `groupStaffByCountry` partitions the result.

### Create/Edit dialog country access section
- Now iterates `visibleCountries` (was `countries`) — non-Super-Admin creators only see their own countries as checkboxes.
- Added an amber-tinted hint paragraph that renders when `visibleCountries.length < countries.length && form.departmentId !== SUPER_ADMIN_DEPT_ID`:
  > You can only assign countries within your scope (Region: West Africa / Country: NG, GH). N additional countries are hidden.
- Count label changed from "N selected" → "N of M selected" where M = visibleCountries.length.
- Empty-state text: "No countries configured in your scope."

### Detail Sheet (StaffDetail)
- Inserted a **prominent "Country Access" panel** right after `</SheetHeader>`, before the body `<div className="px-4 pb-4 space-y-4">`.
  - Emerald-tinted bordered section: `border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20 p-3`.
  - Eyebrow header: `<Globe2> Country Access` + count ("N countries").
  - When staff have countries, each renders as a composite `Badge` containing:
    - mono country code (font-semibold)
    - country name (hidden on mobile)
    - nested access-level Badge (view/operate/manage, color-coded via `ACCESS_LEVEL_BADGE`)
  - Empty state: Super Admin → "Global access — all countries (Super Admin)." / region-only → "No explicit countries — access via region selection." / no-access → "No country or region access."
  - Has a max-h-32 with custom emerald scrollbar.
- Removed the lower "Country access (N)" DetailSection that was below Identity — redundant with the prominent panel at the top.
- Region access DetailSection, Permissions, Notes, and the Edit/Audit-history buttons remain in the body unchanged.

## Verification
- `cd /home/z/my-project && bun run lint 2>&1 | tail -30` → 0 errors, 0 warnings (eslint clean).
- `cd /home/z/my-project && npx tsc --noEmit 2>&1 | grep staff-view` → no output (zero TypeScript errors in staff-view.tsx).
- Dev server log: `✓ Compiled in 174ms` / `GET / 200` after edits — no compile or runtime errors.

## Design Decisions
- **Emerald accent throughout** — project rule bans indigo/blue primary colors; all new emerald styling matches the existing accent system (`bg-emerald-600` button, `bg-emerald-50/60` panel, emerald-tinted badges).
- **ToggleGroup vs Tabs vs simple buttons** — chose shadcn ToggleGroup (segmented control) because it gives a clear visual "two-state" affordance with a single active item, matches the spec's "segmented control" suggestion, and uses the same `variant="outline" size="sm"` styling as other compact controls in the portal.
- **By Country view reuses the same actions DropdownMenu** — the View/Edit/Suspend/Unlock/Reset MFA/Force logout menu is duplicated verbatim from the table row. Extracting a `StaffActionsMenu` component would have been DRYer but would have required refactoring the table row too (larger diff, more risk). The dropdown is ~30 lines and identical in both places, so duplication is acceptable.
- **`staffList.length === 1 ? "staff" : "staff"`** — slightly awkward ternary, but kept as-is in case the count label is later changed to "person"/"people". Right now it always renders "staff" (matching the existing heading convention).
- **`countryGroups` sorted by country code** — stable alphabetical order (NG, KE, GH, ZA, EG, MA) makes the list predictable. Sorting by region-then-name would be nicer but requires extra lookup; code-sort is simpler and good enough.
- **`visibleCountries.length < countries.length` check** — used as the "is the scope restricted?" signal in the Create dialog hint. This is true for any non-Super-Admin (since `getVisibleCountries` returns all countries only for Super Admin). The hint is hidden when Super Admin is creating/editing (since they see all countries anyway).
- **Prominent Country Access panel at top of detail sheet, lower section removed** — the task asked for a prominent panel at the top. The existing lower "Country access (N)" DetailSection was a detailed list with the same data; keeping both would have been redundant. Removed the lower one and made the top one show all the info (code + name + access level) in a more visually dense badge layout.
- **`sm:inline` for country name in prominent panel badges** — country names can be long ("Nigeria", "Ghana", "South Africa"); hiding them on mobile keeps the badge row from wrapping excessively on small screens. The country code (e.g., "NG") is always shown so the panel is still useful on mobile.

## Status
Complete. All seven task requirements satisfied end-to-end. Lint clean, TS clean for target file. Dev server returns 200.
