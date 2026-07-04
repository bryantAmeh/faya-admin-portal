# Task V1 — Users (Consumers) and Merchants Views

**Agent:** subagent-users-merchants
**Task:** Build UsersView and MerchantsView for the Faya Admin Portal (spec §2 and §3)

## What I produced

Two full feature views replacing the existing stubs:

1. `src/components/portal/views/users-view.tsx` — `UsersView` (consumers / Faya Pay app users)
2. `src/components/portal/views/merchants-view.tsx` — `MerchantsView` (merchants / Faya Business app users)

## Key design decisions

- **Scope**: Both views honor the staff's country/region access ladder via `getVisibleConsumers` / `getVisibleMerchants` from `@/lib/access-scope`, plus an optional Region filter dropdown shown when the staff has more than one visible region.
- **Accent**: Emerald throughout (per spec). No indigo/blue primary anywhere.
- **Mutations**: All status changes flow through `adminData.updateConsumer` / `adminData.updateMerchant` and are mirrored to the audit log via `logAudit` with the spec'd action keys:
  - Consumer: `consumer.restrict`, `consumer.suspend`, `consumer.reactivate`, `consumer.note`
  - Merchant: `merchant.kyb_approve`, `merchant.kyb_reject`, `merchant.restrict`, `merchant.suspend`, `merchant.reactivate`, `merchant.note`
- **Toasts**: Every action surfaces a sonner toast (`toast.success` / `warning` / `error` / `info`) explaining what changed and that it mirrors to the Faya Pay / Faya Business app in real-time.
- **Sheet pattern**: Right-side detail Sheet with grouped sections (Personal details, Contact, KYC/KYB details, Platforms used, Wallet/Settlement, Transaction stats, Notes). Status-aware action buttons in the SheetFooter.
- **Suspend confirmation**: Uses `AlertDialog` for the destructive suspend action (both views).
- **Table**: Sticky-header scrollable table with custom-scrollbar styling. Columns progressively hide on smaller viewports (`hidden md:table-cell`, `hidden lg:table-cell`, `hidden xl:table-cell`) so the most important fields remain visible.
- **Risk score handling**: Consumers expose a numeric `riskScore` (0-100) which I map to RiskLevel bands (`<30 low`, `<60 medium`, `<80 high`, `>=80 critical`) for the Risk-level filter — consistent with the `riskScoreBadge` pattern in `compliance-view.tsx`.
- **Live-sync banners**: Both views lead with an emerald info banner explaining the real-time Firestore sync to the Faya Pay / Faya Business apps, mirroring the pattern from `compliance-view.tsx`.

## Files read for context

- `/home/z/my-project/worklog.md` (prior agents' work)
- `/home/z/my-project/src/lib/types.ts` (Consumer, Merchant, CountryConfig, KycStatus, KybStatus, KycTier, RiskLevel, PlatformKey, PLATFORM_LABELS)
- `/home/z/my-project/src/lib/admin-data.ts` (adminData.updateConsumer/updateMerchant, logAudit)
- `/home/z/my-project/src/lib/access-scope.ts` (getVisibleConsumers, getVisibleMerchants, getVisibleCountries, getVisibleRegions, getScopeLabel)
- `/home/z/my-project/src/lib/formatters.ts` (formatCurrency, formatNumber, formatCompact, formatDateTime, timeAgo, statusBadge)
- `/home/z/my-project/src/components/portal/view-helpers.tsx` (ViewHeader, StatCard, EmptyState, ViewContainer)
- `/home/z/my-project/src/components/portal/views/dashboard-view.tsx` (emerald accent example, region filter pattern)
- `/home/z/my-project/src/components/portal/views/compliance-view.tsx` (Sheet + AlertDialog + DropdownMenu patterns, status style tables)
- `/home/z/my-project/src/components/portal/views/staff-view.tsx` (dropdown row-actions + audit pattern)
- `/home/z/my-project/src/hooks/use-auth.ts` (useAuth() for current staff)
- `/home/z/my-project/src/components/ui/*` (table, card, badge, sheet, dialog, alert-dialog, button, input, label, select, dropdown-menu, tabs, separator, scroll-area, sonner)

## Lint status

`bun run lint` passes with exit code 0. No TypeScript errors in either file (`npx tsc --noEmit` clean).

## Notes for downstream agents

- The shared `CONSUMER_STATUS_STYLES` / `MERCHANT_STATUS_STYLES` / `KYC_TIER_STYLES` tables are duplicated locally in each view (they're also in `compliance-view.tsx`). A future refactor could hoist these into `@/lib/formatters.ts` alongside `STATUS_BADGE`.
- The `ScrollTable` helper (raw `<table>` wrapped in a max-height scroll container) is also duplicated. Could be extracted into `@/components/portal/view-helpers.tsx`.
- The "Add note" action currently logs to the audit trail and shows a toast (per spec). A future enhancement could open a small dialog with a textarea to actually persist the note via `updateConsumer({ notes })` / `updateMerchant({ notes })`.
