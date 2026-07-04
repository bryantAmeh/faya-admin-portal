# Task P2 — Merchants Profile Tabs (POS Staff / Terminals / Settlements / Disputes)

**Agent:** subagent-merchants-profile-tabs
**Task:** Consolidate POS Staff, Terminals, Settlements, and Disputes under the Merchant profile Sheet with a tabbed interface — POS Staff is no longer a separate nav item.

## What I produced

Enhanced `/home/z/my-project/src/components/portal/views/merchants-view.tsx` (now 1847 lines, +811 lines added):

1. **Live subscriptions** to four related collections via `useEffect`:
   - `adminData.subscribePosStaff`, `subscribeTerminals`, `subscribeSettlements`, `subscribeDisputes`
   - Cleanup function unsubscribes all four on unmount

2. **Eleven new mutation handlers** in `MerchantsView` (all guard on `actor` non-null, all route through `adminData.update*` + `logAudit`, all surface a sonner toast):
   - `suspendPosStaff`, `reactivatePosStaff`, `resetPosStaffPin`, `forceLogoutPosStaff` (action keys: `pos_staff.suspend`, `pos_staff.reactivate`, `pos_staff.reset_pin`, `pos_staff.force_logout`)
   - `activateTerminal`, `blockTerminal` (`terminal.activate`, `terminal.block`)
   - `retrySettlement`, `viewSettlementDetails` (`settlement.retry`, `settlement.view`)
   - `requestDisputeEvidence`, `updateDisputeStatus` (`dispute.request_evidence`, `dispute.update_status`)

3. **Refactored `MerchantDetailSheet`** to use shadcn `Tabs`:
   - 5 compact (text-[11px]) tabs in `grid grid-cols-5 h-auto p-1` so all fit in `sm:max-w-lg` Sheet
   - Each tab shows a count badge in parens (e.g. `Staff (3)`)
   - Tabs: Profile (default) · Staff · Terms · Settle · Disputes
   - Each non-profile tab has its own `flex-1 overflow-y-auto` scroll container

4. **Four new tab sub-components** + `MiniScrollTable` helper:
   - `PosStaffTab` — filters `posStaff.merchantId === merchant.id`. Columns: Code, Name, Role, Branch, Device, Status, Last login, Txns today, Actions. Row actions: Suspend / Reactivate / Reset PIN / Force logout
   - `TerminalsTab` — filters `terminal.merchantName === tradingName || legalName`. Columns: Serial, Type, Model, Status, Activated, Last seen, Actions. Row actions: Activate / Block / Reactivate
   - `SettlementsTab` — filters `settlement.merchantName === legalName || tradingName`. Columns: Batch ID, Amount, Currency, Scheduled, Status, Actions. Row actions: View details / Retry (only if failed)
   - `DisputesTab` — filters `dispute.merchantName === legalName || tradingName`. Columns: Dispute ID, Customer, Amount, Reason, Status, Deadline, Actions. Row actions: Request evidence + Update status (any of 6 non-current statuses)
   - `MiniScrollTable` — `max-h-60 overflow-auto` + custom scrollbar styling, with sticky `<TableHeader>`. Mirrors the main list's `ScrollTable` pattern but scaled for the Sheet viewport

5. **EmptyState fallbacks** in each tab when 0 items — copy explains where data comes from and how it syncs.

## What I left unchanged

- Main list view, filters, stat cards, row actions, suspend AlertDialog
- The existing Profile tab content (business profile / owner / contact / KYB / platforms / terminal stats / tx stats / settlement / notes / created-updated) — moved verbatim into `TabsContent value="profile"`
- The SheetFooter (KYB Approve/Reject, Restrict/Suspend/Reactivate, Add note, Close)
- All existing imports and styling decisions (emerald accent, no indigo/blue primary)

## Lint status

- `bun run lint` passes with exit code 0. No warnings, no errors in `merchants-view.tsx`.
- `npx tsc --noEmit` shows zero errors in `merchants-view.tsx`. Pre-existing errors in unrelated files (portal-app.tsx, countries-view.tsx, seed-data.ts, examples/, skills/) remain — not in scope for this task.

## Files read for context

- `/home/z/my-project/worklog.md` (prior agents' work, especially V1 which built the original MerchantsView)
- `/home/z/my-project/src/lib/types.ts` (Merchant, PosStaff, Terminal, Settlement, Dispute, CountryConfig, PlatformKey, etc.)
- `/home/z/my-project/src/lib/admin-data.ts` (subscribe* and update* signatures, logAudit signature at line 675)
- `/home/z/my-project/src/lib/access-scope.ts` (getVisibleCountries, getVisibleCountryCodes, getVisibleRegions, getScopeLabel)
- `/home/z/my-project/src/lib/formatters.ts` (formatCurrency, formatNumber, formatDateTime, timeAgo, statusBadge)
- `/home/z/my-project/src/components/portal/view-helpers.tsx` (ViewHeader, StatCard, EmptyState, ViewContainer)
- `/home/z/my-project/src/components/portal/views/merchants-view.tsx` (the file I enhanced — 1036 lines before, 1847 after)
- `/home/z/my-project/src/components/portal/views/country-detail-view.tsx` (reference pattern for shadcn Tabs in a view)
- `/home/z/my-project/src/components/ui/tabs.tsx` (Tabs primitives — Tabs has `flex flex-col gap-2`, TabsContent has `flex-1`)
- `/home/z/my-project/src/hooks/use-auth.ts` (useAuth() for current staff + actor pattern)

## Notes for downstream agents

- The four new sub-components (`PosStaffTab`, `TerminalsTab`, `SettlementsTab`, `DisputesTab`) are self-contained and could be extracted into separate files under `src/components/portal/views/merchants/` if the merchants-view.tsx file becomes unwieldy.
- The `MiniScrollTable` helper duplicates the pattern from `ScrollTable` (the main-list variant). A future refactor could parametrize `ScrollTable` to accept a `maxHeight` prop and consolidate.
- Status style tables (`POS_STAFF_STATUS_STYLES`, `TERMINAL_STATUS_STYLES`, `SETTLEMENT_STATUS_STYLES`, `DISPUTE_STATUS_STYLES`) are defined locally in this file. They could be hoisted into `@/lib/formatters.ts` alongside the existing `STATUS_BADGE` table for reuse by other views.
- The "Fast Refresh had to perform a full reload" warnings in dev.log are caused by the addition of a new `useEffect` hook to `MerchantsView` (changing the hook count triggers Fast Refresh's full-reload safety check). This is expected behavior on first edit and resolves on subsequent renders — not a bug.
- The previous task hint said "POS Staff is NO LONGER a separate nav item" — that nav-item removal happens in the portal shell/nav config, not in this view. This task only adds POS Staff management inside the merchant profile Sheet. A future task should remove the POS Staff nav entry from the portal sidebar.
