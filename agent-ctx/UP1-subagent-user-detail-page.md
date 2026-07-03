# Task UP1 — Full-page User Profile View (no Sheet)

## Task
User feedback: "make a proper profile page I don't like the slide thing."
Create `/home/z/my-project/src/components/portal/views/user-detail-view.tsx` — a
`UserDetailView` that renders a FULL PAGE consumer profile (NOT a sliding Sheet).
The list view navigates to this page via `selectUser(id) + setView("user_detail")`
and a back button returns to the list.

## Work Log
1. Read worklog.md, types.ts, admin-data.ts (subscribe/update methods), formatters.ts,
   view-helpers.tsx, use-auth.ts, use-portal-store.ts (selectedUserId / selectUser / setView),
   access-scope.ts, and the existing users-view.tsx (CP1) + country-detail-view.tsx (for
   the established full-page detail view pattern).
2. Created `src/components/portal/views/user-detail-view.tsx` — `UserDetailView`:
   - Props `{ consumers, countries }`. Gets `selectedUserId` from `usePortalStore`,
     finds the consumer, falls back to an EmptyState + back button when missing.
   - **A. Back button bar** — top-left "← Back to Users" button calling `setView("users")`
     plus a "Full Profile View" pill on the right.
   - **B. Profile header card** (full-width, emerald-tinted gradient):
     - Left: 64px avatar with initials, full name, KYC badge, account-status badge,
       KYC tier badge, risk-score badge; below — consumer code (mono), email, phone,
       country, timezone/currency, member-since.
     - Right: Restrict / Suspend / Reactivate action buttons (disabled appropriately).
     - Bottom: 6-cell quick stats grid (Cards, Wallets, Total Balance, Transactions,
       Open Tickets, Open Disputes) — live-subscribed so counters update in real time.
   - **C. Tabs** (shadcn Tabs, full width):
     1. Overview — 3-column grid: personal details, contact, KYC summary, platforms,
        wallet summary, transaction stats, explore-the-profile hint.
     2. Cards — table + Freeze/Unfreeze (`updateCard`), View details; security note.
     3. Wallets — table + Freeze/Unfreeze (`updateWallet`); dual-approval note.
     4. Transactions — table + View receipt / Open dispute / Escalate / Add note
        (`logAudit transaction.dispute / transaction.escalate`).
     5. Documents — table + Approve / Reject / Request replacement
        (`updateDocument` + `logAudit`).
     6. KYC Cases — table + Approve (`updateKyc` + `updateConsumer` activates) /
        Reject / Escalate; SLA pill.
     7. Support Tickets — table + Reply / Assign to me / Close (`updateTicket`).
     8. Disputes — table + View details / Update status dropdown (`updateDispute`).
     9. Risk & Alerts — table + Close (false positive) / Escalate (`updateFraud`).
     10. Activity & Audit — read-only table; immutable-log note.
   - Each tab: count badge in label, EmptyState if 0 items, `max-h-96 overflow-y-auto`
     scroll table (taller than the previous Sheet because we now have full-page room),
     custom scrollbar styling, single live `useEffect` subscription per collection.
   - Profile header + Tabs are `key`-ed by `consumer.id` so subscriptions and active
     tab reset cleanly when navigating between consumers.
   - Restrict / Suspend / Reactivate open an `AlertDialog` confirmation before
     `adminData.updateConsumer` + `logAudit` + `toast`.
   - Aliased type imports (`Card as CardRecord`, `Wallet as WalletRecord`,
     `Transaction as TransactionRecord`, `UserDocument as DocumentRecord`,
     `KycCase as KycCaseRecord`, `SupportTicket as TicketRecord`,
     `Dispute as DisputeRecord`, `FraudAlert as FraudRecord`,
     `AuditLog as AuditRecord`) to avoid collision with the shadcn `Card` UI component.
   - Emerald accent throughout, NO indigo/blue primary.
3. Wired up the new view:
   - `portal-app.tsx`: imported `UserDetailView`, added `case "user_detail":` route
     passing `consumers` + `countries`.
   - `portal-shell.tsx`: sidebar "Users" item is now also active when
     `view === "user_detail"` (matches the existing `country_detail` pattern).
4. Rebuilt `users-view.tsx` to drop the sliding Sheet entirely:
   - Row click + "View profile" / "Open full profile" dropdown items now call
     `selectUser(c.id) + setView("user_detail")` to open the full-page profile.
   - Kept the stat cards, filters, table, dropdown actions, and the existing
     AlertDialog confirmation flow for Restrict / Suspend / Reactivate from the
     list. File shrunk from ~2,000 lines to ~330 (the Sheet body and all 10 tab
     sub-components are now consolidated in `user-detail-view.tsx`).
5. Appended worklog entry under "Task ID: UP1".
6. Ran `bun run lint` — see worklog for the final pass.

## Stage Summary
A proper full-page consumer profile (`UserDetailView`) replaces the previous
sliding Sheet. Navigating from the Users list now opens a full-width page with a
back button, a wide emerald-tinted profile header (avatar, identity, status
badges, action buttons, 6-cell quick stats), and 10 tabs covering everything
connected to the consumer — overview, cards, wallets, transactions, documents,
KYC cases, support tickets, disputes, risk alerts, and the audit trail. All tabs
subscribe live to their Firestore collections, mutations go through
`adminData.update*` + `logAudit` + sonner toasts, and confirmations use
`AlertDialog`. The sidebar's "Users" entry stays highlighted while the detail
page is open.
