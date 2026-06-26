# Task ID 9a — Risk / Devices / Finance Views

**Agent**: subagent-ops-views
**Files produced**:
- `src/components/portal/views/risk-view.tsx` → exports `RiskView({ fraudAlerts, countries })`
- `src/components/portal/views/devices-view.tsx` → exports `DevicesView({ terminals, countries })`
- `src/components/portal/views/finance-view.tsx` → exports `FinanceView({ settlements, countries })`

## What was built

### Risk & Fraud Operations (`risk-view.tsx`, spec §11.2)
5-tab view; the Fraud Alerts tab is fully implemented, the other four are future-feature roadmap placeholders.

- **Fraud Alerts tab**: search (entity name / alert id / trigger) + 3 filter selects (country, severity, status) + 10-column sticky-header table (Alert ID, Country, Entity type badge, Entity name, Trigger, Severity badge via `statusBadge("risk", …)`, Transaction amount via `formatCurrency`, Device fingerprint, Created via `timeAgo`, custom fraud-status badge, Actions dropdown).
- **Row actions** (each gated on `status !== "closed"`): View details (Sheet) · Restrict account (AlertDialog → toast + `logAudit("account.restrict")`) · Block device (AlertDialog → `adminData.updateFraud(status="closed")` + toast + `logAudit("device.block")`) · Hold settlement (AlertDialog → toast + `logAudit("settlement.hold")`) · Escalate to compliance (`updateFraud(status="escalated")` + `logAudit("fraud.escalate")`) · Close false positive (AlertDialog → `updateFraud(status="closed")` + `logAudit("fraud.close_false_positive")`) · Add to watchlist (toast + `logAudit("watchlist.add")`).
- **KPI strip**: Open Alerts, Critical Severity, Escalated, Closed Today.
- **Future-feature tabs** (Device Risk / Transaction Monitoring / Watchlists / Risk Cases): `FutureFeatureCard` with `EmptyState` + 3-step roadmap + "Planned" badge.

### Devices & Terminal Operations (`devices-view.tsx`, spec §11.4)
5-tab view; Terminal Inventory is fully implemented.

- **Terminal Inventory tab**: search (serial / merchant / model) + 3 filter selects (country, status, type) + 9-column sticky-header table (Serial, Country, Merchant, Model, Type badge, custom terminal-status badge, Activated date, Last seen, Actions dropdown).
- **Row actions** (visibility gated by current status): View details (Sheet) · Activate (AlertDialog → `adminData.updateTerminal(status="active", activatedAt=now)` + `logAudit("terminal.activate")`) · Block (AlertDialog → `updateTerminal(status="blocked")` + `logAudit("device.block")`) · Mark damaged (AlertDialog → `updateTerminal(status="damaged")` + `logAudit("terminal.mark_damaged")`) · Replace (toast + `logAudit("terminal.replace_request")`).
- **KPI strip**: Total Terminals, Active, Blocked, Phone POS count.
- **Future-feature tabs** (Terminal Requests / Phone POS Devices / Device Health / Lost-Damaged): `FutureFeatureCard`.

### Finance & Settlements (`finance-view.tsx`, spec §11.5)
5-tab view; Settlement Batches and Failed Settlements tabs are fully implemented (they share the reusable `SettlementsCard` sub-component). Failed Settlements tab is pre-filtered to `status === "failed"` and shows a red counter on the tab trigger.

- **Settlements table columns**: Batch ID, Country, Merchant, Amount (formatCurrency, right-aligned, tabular-nums), Currency, Scheduled date, custom settlement-status badge, Failure reason (red text, only on `failed`), Actions dropdown.
- **Row actions**: View details (Sheet) · Retry failed (`adminData.updateSettlement(status="processing")` + `logAudit("settlement.retry")` — only shown for `failed`) · Recommend hold (toast + `logAudit("settlement.hold")`) · Recommend release (toast + `logAudit("settlement.release_request")` — only shown for `held`) · Export report (toast + `logAudit("settlement.export")`).
- **KPI strip**: Settled Volume (formatCompact), Pending, Held, Failed.
- **Future-feature tabs** (Reconciliation / Merchant Fees / Reserves): `FutureFeatureCard`.

## Key implementation notes

- **Country scoping** (all 3 views): `visibleCountryCodes` is computed from `useAuth().staff`. Super Admin (`dept_super_admin`) sees all countries; other staff see only the codes in `staff.countries`. The country filter dropdown is also scoped (only shows the staff's countries for non-super-admins).
- **Audit logging**: every mutation calls `adminData.update*` (when persisted) and `logAudit(actor, actionKey, entityType, entityId, opts)`. The actor is built from the current staff (`staffId`, `staffName`, `department` = departmentId, `role` = roleId). Action keys: `account.restrict`, `device.block`, `settlement.hold`, `fraud.escalate`, `fraud.close_false_positive`, `watchlist.add`, `terminal.activate`, `terminal.mark_damaged`, `terminal.replace_request`, `settlement.retry`, `settlement.release_request`, `settlement.export`.
- **Toasts**: `import { toast } from "sonner"`. A `<SonnerToaster richColors closeButton position="bottom-right" />` is mounted at the end of each view because the root layout only mounts the shadcn `useToast` Toaster (sonner toasts would otherwise be silent) — same convention as `compliance-view.tsx`.
- **Sticky table headers**: each view has its own `ScrollTable` sub-component that uses a raw `<table>` instead of the `Table` primitive, because the Table primitive's built-in `overflow-x-auto` wrapper becomes a separate scroll container and prevents `<thead className="sticky top-0">` from sticking to the outer vertical-scroll viewport. The wrapper has `max-h-[60vh] overflow-auto` and the prescribed custom webkit-scrollbar styling: `[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700`.
- **AlertDialog confirmations** are used for destructive / state-changing actions: restrict account, block device, hold settlement, close false positive (risk); activate, block, mark damaged (devices). Replace, Add-to-watchlist, Retry-failed, Recommend-hold, Recommend-release, Export-report are immediate (toast-only) since they are reversible / informational.
- **Visual style**: emerald accent throughout (matching `dashboard-view.tsx`); no indigo/blue primary colors.
- **Responsive**: less-critical table columns are hidden at `sm`/`md`/`lg`/`xl` breakpoints; filter bars wrap on small screens.

## Verification

- `cd /home/z/my-project && bun run lint` → exit code 0, zero errors in all three files.
- `npx tsc --noEmit` → zero TS errors in the three new files (only unrelated errors in `examples/` and `skills/`).

## Integration point

The three views are not yet wired into the shell. To integrate, in `src/components/portal/portal-shell.tsx` (or wherever views are switched), render:

```tsx
{view === "risk" && (
  <RiskView fraudAlerts={fraudAlerts} countries={countries} />
)}
{view === "devices" && (
  <DevicesView terminals={terminals} countries={countries} />
)}
{view === "finance" && (
  <FinanceView settlements={settlements} countries={countries} />
)}
```

The data props must be sourced from `adminData.subscribeFraud`, `adminData.subscribeTerminals`, `adminData.subscribeSettlements`, and `adminData.subscribeCountries` (already wired in the parent that feeds `DashboardView`).

## Sub-components defined per file

### risk-view.tsx
- `ScrollTable` — sticky-header scroll container with custom scrollbar.
- `DetailRow` — label/value row used in Sheet detail panels.
- `FraudDetailSheet` — Sheet body for fraud alert review (with action buttons).
- `FutureFeatureCard` — placeholder card for the 4 future-feature tabs (EmptyState + 3-step roadmap + Planned badge).
- `FRAUD_STATUS_STYLES`, `SEVERITY_OPTIONS`, `STATUS_OPTIONS` — constants feeding badges and filter selects.
- `ConfirmAction` discriminated union + `confirmTitle` / `confirmDescription` helpers driving the AlertDialog.

### devices-view.tsx
- `ScrollTable`, `DetailRow`, `FutureFeatureCard` (same pattern as risk).
- `TerminalDetailSheet` — Sheet body for terminal review (with action buttons gated by current status).
- `TERMINAL_STATUS_STYLES`, `STATUS_OPTIONS`, `TYPE_OPTIONS` — constants.
- `ConfirmAction` discriminated union + helpers.

### finance-view.tsx
- `ScrollTable`, `DetailRow`, `FutureFeatureCard` (same pattern).
- `SettlementsCard` — reusable Card wrapping the filter bar + sticky table + Actions dropdown. Powers both the Settlement Batches tab and the Failed Settlements tab (the latter passes a customised `emptyTitle` / `emptyDescription`).
- `SettlementDetailSheet` — Sheet body for settlement review (with Retry / Hold / Release / Export buttons gated by current status).
- `SETTLEMENT_STATUS_STYLES`, `STATUS_OPTIONS` — constants.
