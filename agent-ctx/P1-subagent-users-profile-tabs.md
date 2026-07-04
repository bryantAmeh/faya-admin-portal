# Task P1 — Consolidate Cards / Wallets / Transactions / Documents under User Profile

**Agent:** subagent-users-profile-tabs
**Task ID:** P1
**File modified:** `/home/z/my-project/src/components/portal/views/users-view.tsx`

## Context

Per user instruction: *"create a profile instead of separate operations — wallet, card, transaction should be under the user's profile."*

Cards, Wallets, and Transactions are NO LONGER separate nav items — they live INSIDE the User profile Sheet. This consolidates the back-office around the entity (consumer) rather than the operation type.

Prior agents' work is recorded in `/home/z/my-project/worklog.md` and `/home/z/my-project/agent-ctx/` (notably `V2-subagent-cards-wallets-transactions.md` for badge styling conventions).

## Approach

1. **Read all referenced context files** (worklog, types, admin-data, access-scope, formatters, view-helpers, use-auth, existing users-view, tabs.tsx, cards-view for status-style reference) before writing any code.
2. **Add live subscriptions** to `cards`, `wallets`, `transactions`, `documents` via a single `useEffect` with cleanup. State stored in `useState` arrays.
3. **Compute per-consumer slices** with `useMemo` keyed on `selectedConsumer.id` so each open Sheet shows only the related entities.
4. **Add mutation handlers** that wrap `adminData.update*` + `logAudit` + `toast`:
   - `toggleFreezeCard`, `viewCardDetails`
   - `toggleFreezeWallet`
   - `viewTransactionReceipt`, `openDispute`, `escalateTransaction`
   - `reviewDocument` (approved/rejected with reviewer stamp)
5. **Restructure `ConsumerDetailSheet`** to render a 5-tab layout via shadcn `Tabs`:
   - **Profile** (default) — preserves the existing personal/contact/KYC/platforms/wallet-summary/tx-stats/notes/created-updated content verbatim
   - **Cards** — table with security note
   - **Wallets** — table with dual-approval note
   - **Transactions** — table with row actions (receipt/dispute/escalate)
   - **Documents** — table with approve/reject actions
6. **Each tab shows a `CountPill`** (emerald when count>0, muted when 0) next to its label so the admin sees totals at a glance.
7. **Each tab with 0 items** shows an `EmptyState` with helpful copy.
8. **`ProfileTabTable` helper** — `max-h-60 overflow-auto` + custom scrollbar + sticky `<thead>` (raw `<table>` so the thead sticks to the scroll viewport, same trick as the main `ScrollTable`).
9. **Sheet widened** from `sm:max-w-lg` to `sm:max-w-3xl` to fit the per-tab tables with 6-10 columns.
10. **TypeScript collision fix**: aliased the domain-type imports `Card as CardT` / `Wallet as WalletT` to avoid clashing with the `Card` shadcn UI component and `Wallet` lucide icon (both already imported as values).

## Conventions Followed

- Emerald accent throughout, NO indigo/blue primary in chrome (sky-100 only used for semantically distinct status badges like "frozen" / "authorized" — matches existing formatters and cards-view).
- Status badge style tables (`CARD_STATUS_STYLES`, `SCHEME_STYLES`, `WALLET_STATUS_STYLES`, `TX_STATUS_STYLES`, `DOC_STATUS_STYLES`) defined locally — mirror the patterns from `cards-view.tsx` / `wallets-view.tsx` / `transactions-view.tsx`.
- All mutations via `adminData.update*` + `logAudit(...)` with action keys, before/after values, countryCode, and reason. Toast feedback via sonner on every action.
- `DropdownMenu` for per-row actions. `EmptyState` for empty tabs. `SonnerToaster` already mounted by parent.
- Existing list view, filters, stat cards, suspend `AlertDialog`, and audit-logging logic kept 1:1 — only the detail Sheet changed.
- Documented the consolidation in the file's top-level JSDoc.

## Quality

- `bun run lint` → **0 errors, 0 warnings**.
- `npx tsc --noEmit` → **0 errors in users-view.tsx** (after the `Card as CardT` / `Wallet as WalletT` alias fix).
- Dev server: HTTP 200 on `/` after every edit; no runtime errors in dev.log.

## Integration Notes

No integration changes needed — `PortalApp` already renders `<UsersView consumers={...} countries={...} />`. The detail Sheet is internal to UsersView and self-subscribes to its own related data, so no prop wiring is required.
