# Task ID 8 — Compliance (KYC/KYB) View

**Agent**: subagent-compliance-view
**File produced**: `src/components/portal/views/compliance-view.tsx`
**Exports**: `ComplianceView({ kycCases, kybCases, staff, countries })`

## What was built

A single self-contained client component implementing §11.1 Compliance Admin Pages with 6 tabs:

1. **KYC Queue** — searchable, filterable table of `KycCase` rows (Customer, Country, Nationality, Risk score badge, Submitted, Required document chips, Status, Reviewer, SLA). Row click opens a right-side Sheet with full case details + 5 action buttons (Approve, Reject, Request Documents, Escalate, Assign to me). Reject triggers an `AlertDialog` confirmation.
2. **KYB Queue** — same structure for `KybCase` (Merchant, Country, Business type, Risk category, Submitted, Missing documents chips, Status, Reviewer, SLA) with the same 5 actions.
3. **Sanctions/PEP** — escalated KYC cases table (with notes column) + always-on 5-step workflow overview panel + 3 reference cards. `EmptyState` shown when no escalated cases.
4. **Manual Review** — combined KYC + KYB cases where `status === "in_review"` with a type indicator badge (KYC emerald / KYB amber).
5. **Approved** — combined approved KYC + KYB cases.
6. **Rejected** — combined rejected KYC + KYB cases with a reason/notes column.

## Key implementation notes

- **Country scoping**: `visibleCountryCodes` is computed from `useAuth().staff`. Super Admin (`dept_super_admin`) sees all countries; other staff see only the codes in `staff.countries`. All tabs and the filter dropdowns respect this scope.
- **Audit logging**: every action calls `adminData.updateKyc` / `updateKyb` and `logAudit(actor, "kyc.approve" | "kyc.reject" | "kyc.escalate" | "kyc.request_documents" | "kyb.*", entityType, entityId, opts)`. The actor is built from the current staff (`staffId`, `staffName`, `department` = departmentId, `role` = roleId).
- **Toasts**: uses `import { toast } from "sonner"` as instructed. A `<SonnerToaster richColors closeButton position="bottom-right" />` is mounted at the end of the view because the root layout only mounts the shadcn `useToast` Toaster (sonner toasts would otherwise be silent).
- **Risk score badge**: `<30` emerald, `<60` amber, `<80` orange, `>=80` red.
- **SLA badge**: uses `slaStatus()`; `danger` → red, `warning` → amber, `default` → slate.
- **Sticky table headers**: `ScrollTable` sub-component uses a raw `<table>` instead of the `Table` primitive, because the Table primitive's built-in `overflow-x-auto` wrapper becomes a separate scroll container that prevents `<thead className="sticky top-0">` from sticking to the outer vertical-scroll viewport. The wrapper has `max-h-[60vh] overflow-auto` and custom webkit-scrollbar styling.
- **Visual style**: emerald accent throughout (matching `dashboard-view.tsx`); no indigo/blue primary colors.
- **Icons used** (all from `lucide-react`): `ShieldCheck`, `Search`, `Filter`, `Check`, `X`, `FileText`, `AlertTriangle`, `Clock`, `UserCheck`, `ArrowUpCircle`, `Eye`.

## Verification

- `npx eslint src/components/portal/views/compliance-view.tsx` → 0 errors / 0 warnings.
- `npx tsc --noEmit --skipLibCheck` → 0 errors in this file (only unrelated errors in `examples/` and `skills/`).
- `bun run lint` → 1 pre-existing error in `src/hooks/use-auth.ts` (not in scope).

## Integration point

The view is not yet wired into the shell. To integrate, in `src/components/portal/portal-shell.tsx` (or wherever views are switched), render:

```tsx
{view === "compliance" && (
  <ComplianceView
    kycCases={kycCases}
    kybCases={kybCases}
    staff={staff}
    countries={countries}
  />
)}
```

The data props must be sourced from `adminData.subscribeKyc`, `adminData.subscribeKyb`, `adminData.subscribeStaff`, `adminData.subscribeCountries` (already wired in the parent that feeds `DashboardView`).

## Sub-components defined in the same file

- `ScrollTable` — sticky-header scroll container with custom scrollbar.
- `DetailRow` — label/value row used in Sheet detail panels.
- `ActionButtons` — Approve/Reject/Request docs/Escalate/Assign-to-me button grid; renders a "no further actions" notice when the case is already approved/rejected.
- `KycDetailSheet` / `KybDetailSheet` — Sheet body for KYC / KYB case review.
- `SANCTIONS_WORKFLOW` — constant describing the 5-step sanctions/PEP workflow.
- `STATUS_OPTIONS` — constant feeding the status filter `Select`.
