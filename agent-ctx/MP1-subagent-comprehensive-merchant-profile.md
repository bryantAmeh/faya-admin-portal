# Task MP1 — Comprehensive Merchant Profile

## Task
Completely rewrite `/home/z/my-project/src/components/portal/views/merchants-view.tsx` so that EVERYTHING connected to a merchant lives under their profile Sheet — Overview, POS Staff, Terminals, POS Requests, Transactions, Settlements, Disputes, Documents, KYB Cases, Support Tickets, Risk & Alerts, Activity & Audit (12 tabs).

## Work Log
1. Read worklog.md, types.ts, admin-data.ts, access-scope.ts, formatters.ts, view-helpers.tsx, use-auth.ts, and the existing merchants-view.tsx (for project conventions and to confirm the subscribe/update method names).
2. Confirmed available data layer methods:
   - `subscribePosStaff / subscribeTerminals / subscribePosDeviceRequests / subscribeTransactions / subscribeSettlements / subscribeDisputes / subscribeDocuments / subscribeKyb / subscribeTickets / subscribeFraud / subscribeAudit`
   - `updatePosStaff / updateTerminal / updatePosDeviceRequest / updateSettlement / updateDispute / updateDocument / updateKyb / updateTicket / updateMerchant`
   - `logAudit(actor, action, entityType, entityId, opts)`
3. Completely rewrote `src/components/portal/views/merchants-view.tsx`:
   - MAIN VIEW: stat cards (Total Merchants / Active / Onboarding / Restricted+Suspended), filters (search, country, KYB status, account status, risk category), merchant table with all required columns (Merchant Code, Trading Name, Country, Business Type, KYB, Risk, Account Status, Terminals, Phone POS, Monthly Volume, Actions), row click → detail Sheet, row dropdown actions (View profile / Approve KYB / Reject KYB / Restrict / Suspend / Reactivate) via `updateMerchant` + `logAudit`, with AlertDialog confirmation.
   - DETAIL SHEET (`sm:max-w-4xl`):
     - **Profile Summary Header** (always visible above tabs, with emerald gradient): business name, merchant code, country, KYB badge, account status badge, risk badge, platform chips; merchant actions dropdown (Approve/Reject KYB, Restrict/Suspend/Reactivate); 6-cell quick stats row (POS Staff, Terminals, Phone POS, Monthly Volume, Open Disputes, Open Tickets) each with icon.
     - **12 tabs** (compact `text-[11px]`, each with count badge, EmptyState if 0, `max-h-60 overflow-y-auto` scroll table with sticky header):
       1. Overview — business profile / owner details / KYB summary / platforms / terminal & transaction stats / settlement info / notes
       2. POS Staff — table + Suspend/Reactivate (`updatePosStaff`), Reset PIN (toast + `logAudit`), Force logout (toast + `logAudit`)
       3. Terminals — table + Activate/Block (`updateTerminal`)
       4. POS Requests — KEY device approval workflow: card layout with NFC/Card/Swipe capability badges, device integrity & screen-lock indicators, Approve DISABLED if `canBeApproved === false`, Auto-decline button for devices with no payment methods, manual Decline dialog with reason; approve → status="approved" + `logAudit "pos_device.approve"`; decline → status="declined" + `logAudit "pos_device.decline"`; auto-decline → status="auto_declined" + `logAudit "pos_device.auto_decline"`; amber warnings for failed device integrity or no screen lock.
       5. Transactions — table + View details / Open dispute / Escalate (`logAudit "transaction.open_dispute" / "transaction.escalate"`)
       6. Settlements — table + Retry if failed (`updateSettlement` + `logAudit "settlement.retry"`), View details
       7. Disputes — table + Request evidence (`updateDispute`), Advance status (`logAudit "dispute.request_evidence" / "dispute.update_status"`)
       8. Documents — table + Approve / Reject / Request replacement (`updateDocument` + `logAudit`)
       9. KYB Cases — table + Approve (`updateKyb` status="approved" + `updateMerchant` kybStatus="approved" status="active") / Reject / Escalate; SLA pill column
       10. Support Tickets — table + Reply / Assign / Close (`updateTicket` + `logAudit`); priority + status + SLA columns
       11. Risk & Alerts — table of fraud alerts (`subscribeFraud` filtered by `entityName` matching merchant name); severity + status badges
       12. Activity & Audit — read-only table of `auditLogs` filtered by `entityId === merchant.id`
   - Filtering rules per spec:
     - POS Staff: `posStaff.merchantId === merchant.id`
     - Terminals: `terminal.merchantName === merchant.tradingName || merchant.legalName`
     - POS Requests: `posDeviceRequest.merchantId === merchant.id`
     - Transactions: `transaction.merchantId === merchant.id || merchantName matches legal/trading`
     - Settlements / Disputes: `merchantName matches legal/trading`
     - Documents: `entityId === merchant.id`
     - KYB Cases: `id === merchant.kybCaseId || merchantName matches`
     - Support Tickets: `requesterName matches legal/trading`
     - Fraud Alerts: `entityName matches legal/trading`
     - Audit Logs: `entityId === merchant.id`
   - Single shared `useEffect` in `MerchantProfileSheet` subscribes to all 11 collections once and passes filtered items down to each tab (one subscription per collection, not 11 per tab). `MerchantProfileSheet` is `key`ed by `merchant.id` in the parent so a fresh mount resets the active tab to Overview.
   - Emerald accent throughout, NO indigo/blue primary.
4. Lint fix: replaced an in-effect `setTab("overview")` call with a `key={merchant.id}` remount pattern (parent passes the key) to satisfy the `react-hooks/set-state-in-effect` rule.
5. `bun run lint` passes clean (0 errors, 0 warnings). Dev server compiles successfully (multiple `✓ Compiled in …ms` lines after edits).

## Stage Summary
A truly comprehensive merchant profile view where EVERYTHING connected to a merchant — POS staff, terminals, POS device requests, transactions, settlements, disputes, documents, KYB cases, support tickets, fraud alerts, and audit logs — lives under their profile Sheet in 12 tabs, all driven by live Firestore subscriptions. POS device approval workflow enforces the spec rule (cannot approve if device has no NFC, card reader, or swipe). Replaces the prior narrower merchants-view.tsx entirely. The companion Faya Business merchant app reads the same Firestore collections through the same `adminData` patch helpers.
