# Task R2 — subagent-staff-region-access

## Task
Update Staff Management view to support the new `regionAccess: string[]` field on `AdminStaff`:
1. Add "Region Access" section to Create/Edit dialog (2-col checkbox grid for `AFRICAN_REGIONS`)
2. Add "Scope" column to staff list table (color-coded badge via `getScopeLabel`)
3. Add prominent scope label + Region Access section to detail Sheet (using `getAccessSummary`)
4. Super Admin → global access auto (regionAccess defaults to all regions for display)

## Files Touched
- `/home/z/my-project/src/components/portal/views/staff-view.tsx` — patched via MultiEdit (15 atomic edits)
- `/home/z/my-project/worklog.md` — appended R2 stage summary

## What I Changed in `staff-view.tsx`

### Imports
- Added `MapPinned` to lucide-react icon imports (used in dialog section + region badges)
- Added `import { getAccessSummary, getScopeLabel } from "@/lib/access-scope"`
- Added `import { AFRICAN_REGIONS } from "@/lib/types"` (kept as separate value import — `AFRICAN_REGIONS` is a runtime `as const` value, not a type)

### Helpers (added next to `isSuperAdmin`)
- `scopeBadgeClass(s: AdminStaff): string` — returns Tailwind classes per scope:
  - "Global" → emerald
  - "Region:" → teal (avoided sky/blue due to project's no-blue-primary rule)
  - "Country:" → slate
  - "No access" → gray
- `scopeCompactLabel(s: AdminStaff): string` — short label for dense table cells:
  - Single region/country → full label
  - Multi-region → `Region: West Africa +2`
  - Multi-country (>2) → `Country: NG, KE +1`

### Form state
- `StaffFormState` extended with `regionAccess: string[]`
- `emptyStaffForm()` defaults `regionAccess: []`
- `openEdit(s)` pre-populates `regionAccess` from `s.regionAccess` (with `Array.isArray` guard for legacy records)
- New `toggleRegion(region, checked)` handler

### Validation
- Updated `validate()` to accept either a country OR a region for non-Super-Admin departments (previously required a country)

### onSave (both branches)
- `regionAccess` set to `[...AFRICAN_REGIONS]` when `departmentId === SUPER_ADMIN_DEPT_ID`, otherwise `form.regionAccess`
- Included in both `adminData.createStaff(newStaff)` and `adminData.updateStaff(editing.id, { ..., regionAccess })` payloads

### Create/Edit dialog
- New "Region Access" section between Countries and MFA+notes:
  - Header with `<MapPinned className="text-emerald-600" />` icon + dynamic count
  - Required explanatory note (verbatim): "Region access is additive — staff see all countries in selected regions PLUS their assigned countries. Super Admins have global access automatically."
  - 2-column grid of `<Checkbox>` toggles for each `AFRICAN_REGIONS` entry
  - When Super Admin dept is selected: all checkboxes force-checked + disabled (cursor-not-allowed opacity-70)

### Staff list table
- New "Scope" `<TableHead>` after "Countries"
- Countries cell empty state changed from "Global" to "—" (Global is now in Scope column)
- New `<TableCell>` rendering compact Badge with `scopeBadgeClass(s)` + `scopeCompactLabel(s)` + `title={getScopeLabel(s)}` for full hover text

### StaffDetail Sheet
- Added `const summary = getAccessSummary(s, countries)` at top of component
- SheetHeader: added prominent "Scope" row (eyebrow label + colored Badge with `<Globe2>` icon + full `getScopeLabel(s)`) directly above the status/MFA badges row — makes scope the most visually prominent metadata in the header
- Country access section empty state now branches: Super Admin → "Global access (Super Admin)." / regionAccess-only → "No explicit countries — access via region selection." / no-access → "No country or region access."
- New "Region access (N)" DetailSection between Country access and Permissions:
  - Empty state: Super Admin → "Global access — all regions visible (Super Admin)." / otherwise → "None — country-scoped."
  - Non-empty: teal-tinted Badges (`<MapPinned>` + region name) for each region in `s.regionAccess`, plus note using `summary.countryCount` — "Sees N countries in total (assigned countries + all countries in selected regions)."

## Verification
- `cd /home/z/my-project && bun run lint 2>&1 | tail -30` → 0 errors, 0 warnings (eslint clean)
- `cd /home/z/my-project && npx tsc --noEmit 2>&1 | grep staff-view` → no output (zero TypeScript errors in staff-view.tsx; remaining tsc errors are all in pre-existing unrelated files: examples/websocket, skills/*, countries-view.tsx region field, admin-data.ts local-store)

## Design Decisions
- **Teal not sky for Region badges** — task spec offered "sky/teal" but project rule bans blue/indigo primary colors; sky is a blue shade, so teal was chosen.
- **Super Admin region checkboxes disabled + force-checked** — the user can't accidentally uncheck regions for a Super Admin; the data layer still receives `[...AFRICAN_REGIONS]` on save regardless.
- **Compact scope label in table** — `getScopeLabel` returns full lists like "Region: West Africa, East Africa, North Africa" which would blow out the table cell width. The compact form collapses to "Region: West Africa +2" with the full label in the `title` tooltip.
- **`getAccessSummary` consumed in detail Sheet** — used to show "Sees N countries in total" so the import isn't unused; gives the reviewer a concrete count of the staff's effective country visibility (assigned + region-derived).
- **`Array.isArray` guard in `openEdit`** — protects against legacy staff records (created before this field was added) that may have `regionAccess: undefined`. The form falls back to `[]`.

## Status
Complete. All four task requirements satisfied end-to-end. Lint clean, TS clean for target file.
