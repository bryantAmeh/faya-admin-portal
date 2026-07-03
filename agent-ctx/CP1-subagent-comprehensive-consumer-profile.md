# Task CP1 — Comprehensive Consumer Profile

## Task
Rebuild `/home/z/my-project/src/components/portal/views/users-view.tsx` so that EVERYTHING connected to a consumer lives under their profile Sheet — overview, cards, wallets, transactions, documents, KYC cases, support tickets, disputes, risk alerts, and audit logs.

## Work Log
1. Read worklog.md, types.ts, admin-data.ts, access-scope.ts, formatters.ts, view-helpers.tsx, use-auth.ts, and merchants-view.tsx (for project conventions).
2. Completely rewrote `src/components/portal/views/users-view.tsx`:
   - MAIN VIEW: stat cards (Total / Active / Pending KYC / Restricted+Suspended), filters (search, country, KYC status, account status), consumer table with all required columns + cards count + txns count, row click → detail Sheet, row dropdown actions (View profile / Restrict / Suspend / Reactivate) via `updateConsumer` + `logAudit`, with AlertDialog confirmation.
   - DETAIL SHEET (`sm:max-w-4xl`):
     - **Profile Summary Header** (always visible above tabs): avatar with initials, full name, consumer code, country, KYC badge, account status badge, KYC tier badge; quick action buttons (Restrict / Suspend / Reactivate); 6-cell quick stats row (Cards, Wallets, Total Balance, Txns, Open Tickets, Open Disputes) each with icon.
     - **10 tabs** (compact `text-[11px]`, each with count badge):
       1. Overview — personal details / contact / KYC summary / platforms / wallet summary / transaction stats / quick-links note
       2. Cards — table + Freeze/Unfreeze (`updateCard`), View details, security note "Admin never sees full PAN, CVV or PIN"
       3. Wallets — table + Freeze/Unfreeze (`updateWallet`), note "Manual balance adjustment requires dual approval"
       4. Transactions — table + View receipt / Open dispute / Escalate / Add note (toasts + `logAudit`)
       5. Documents — table + Approve / Reject / Request replacement (`updateDocument` + `logAudit`)
       6. KYC Cases — table + Approve (`updateKyc` + `updateConsumer` kycStatus=approved status=active) / Reject / Escalate (+ `logAudit`)
       7. Support Tickets — table + Reply / Assign / Close (`updateTicket` + `logAudit`)
       8. Disputes — table + View details / Update status dropdown (`updateDispute` + `logAudit`)
       9. Risk & Alerts — table + Close false positive / Escalate (`updateFraud` + `logAudit`)
       10. Activity & Audit — table, read-only, immutable note
   - Each tab subscribes live via `useEffect(() => adminData.subscribe*(setItems), [])`, filters by the selected consumer per the task's matching rules, shows `EmptyState` if 0 items, uses `max-h-60 overflow-y-auto` scroll table with sticky header.
   - Aliased type imports (`Card as CardRecord`, `Wallet as WalletRecord`, etc.) to avoid collision with the `Card` UI component.
   - Emerald accent throughout, NO indigo/blue primary.
3. Lint fix: replaced an in-effect `setTab` call with a lazy-render pattern to satisfy `react-hooks/set-state-in-effect` rule.
4. Appended worklog entry under "Task ID: CP1".
5. `bun run lint` passes clean (0 errors, 0 warnings).

## Stage Summary
A truly comprehensive consumer profile view where EVERYTHING connected to a consumer — cards, wallets, transactions, documents, KYC cases, support tickets, disputes, risk alerts, audit logs — lives under their profile in 10 tabs, all driven by live Firestore subscriptions. Replaces the prior narrower users-view.tsx entirely. The companion Faya Pay consumer app reads the same Firestore collections through the same `adminData` patch helpers.
