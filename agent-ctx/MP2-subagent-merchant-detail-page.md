# Task MP2 — Full-Page Merchant Profile (no Sheet)

## Task
Create `/home/z/my-project/src/components/portal/views/merchant-detail-view.tsx` — `MerchantDetailView` — as a proper full-page merchant profile (NOT a sliding Sheet). The user said "make a proper profile page I don't like the slide thing."

Props: `{ merchants: Merchant[]; countries: CountryConfig[] }`

## Work Log
1. Read worklog.md (incl. MP1 + COMPREHENSIVE-PROFILES + UP1 entries), types.ts (Merchant, PosStaff, Terminal, Settlement, Dispute, Transaction, UserDocument, KybCase, SupportTicket, FraudAlert, AuditLog, PosDeviceRequest, CountryConfig, etc.), admin-data.ts (subscribe*/update* helpers + logAudit), access-scope.ts (getVisibleCountries, getScopeLabel), formatters.ts (formatCurrency, formatNumber, formatDateTime, formatDate, timeAgo, slaStatus, statusBadge), view-helpers.tsx (ViewHeader, StatCard, EmptyState, ViewContainer), use-auth.ts, use-portal-store.ts (selectedMerchantId, selectMerchant, setView, merchant_detail view), portal-app.tsx (router), and the existing merchants-view.tsx (for the 12-tab Sheet pattern, status style maps, POS device approval workflow, audit action keys, and the `nameMatchesMerchant` filter rule).
2. Confirmed `merchant_detail` is already in the `PortalView` union type and `usePortalStore` exposes `selectedMerchantId` + `selectMerchant` + `setView`. (Router wiring in `portal-app.tsx` and the list navigation in `MerchantsView` will be done by a follow-up task — the file itself is self-contained and ready.)
3. Created `src/components/portal/views/merchant-detail-view.tsx` — a standalone `MerchantDetailView` with props `{ merchants: Merchant[]; countries: CountryConfig[] }`:
   - Reads `selectedMerchantId` + `setView` from `usePortalStore` and `staff` from `useAuth`.
   - If merchant not found: shows EmptyState (Building2 icon) + an "← Back to Merchants" button (both top and centered).
   - If found, renders a FULL PAGE (no Sheet) with three regions:
     **A. Back button bar** at the top — emerald-tinted ghost button calling `setView("merchants")` + a small merchant code hint on the right.
     **B. Profile header card** (full-width, emerald gradient): top row has avatar + trading name + legal name + merchant code + country + business type (left), KYB/status/risk badges + platform chips (center), action buttons Approve KYB / Reject KYB / Restrict / Suspend / Reactivate that appear conditionally based on current state (right). Bottom row: 6-cell quick-stats grid — POS Staff, Terminals (active/total), Phone POS, Monthly Volume, Open Disputes, Open Tickets — each with icon and tone color. Confirmations via `AlertDialog` (green for approve/reactivate, red for reject/restrict/suspend).
     **C. Tabs section** (shadcn `Tabs`, full width, count badge on each tab label, `max-h-96 overflow-y-auto` scroll table per tab since full-page has more room):
       1. Overview — 6-card grid: business profile, owner details, KYB summary, platforms, terminal & tx stats, settlement info & notes
       2. POS Staff — table + dropdown actions: Suspend / Reactivate (`updatePosStaff`), Reset PIN + Force logout (`logAudit` only)
       3. Terminals — table + Activate / Block (`updateTerminal`)
       4. POS Requests — KEY device approval workflow: card layout with Request Code, Type, Device Model, OS/app version, NFC/Card/Swipe capability badges, integrity & screen-lock indicators, "Can approve" / "No payment method" badge, amber warnings for failed integrity / no screen lock. Approve button DISABLED when `canBeApproved === false`; Auto-decline button shown when no payment method; manual Decline opens Dialog with reason textarea. Approve → status="approved" + `logAudit "pos_device.approve"`; Decline → status="declined" + `logAudit "pos_device.decline"`; Auto-decline → status="auto_declined" + `logAudit "pos_device.auto_decline"`.
       5. Transactions — table + dropdown: View details, Open dispute, Escalate (`logAudit "transaction.open_dispute"` / `"transaction.escalate"`)
       6. Settlements — table + Retry (if failed, `updateSettlement` status=processing + `logAudit "settlement.retry"`) + View details
       7. Disputes — table + Request evidence / Advance status (`updateDispute` + `logAudit "dispute.request_evidence"` / `"dispute.update_status"`)
       8. Documents — table + Approve / Reject / Request replacement (`updateDocument` + `logAudit`)
       9. KYB Cases — table + Approve (lifts merchant to KYB approved + active) / Reject (sets restricted) / Escalate (`updateKyb` + `updateMerchant` + `logAudit`); SLA pill column
       10. Support — table + Reply / Assign / Close (`updateTicket` + `logAudit`); priority + status + SLA columns
       11. Risk & Alerts — table of fraud alerts filtered by `entityName` matching merchant legal/trading name; severity + status badges
       12. Activity & Audit — read-only audit logs filtered by `entityId === merchant.id`
   - Single `useEffect` at page level subscribes to all 11 collections (PosStaff, Terminals, PosDeviceRequests, Transactions, Settlements, Disputes, Documents, KybCases, Tickets, FraudAlerts, AuditLogs) and `useMemo`-filters each to this merchant. This guarantees the count badges in tab labels are accurate even before a tab is opened (avoids the lazy-mount count gap).
   - Filtering rules per spec:
     * POS Staff: `merchantId === merchant.id`
     * Terminals: `merchantName === legalName || tradingName`
     * POS Requests: `merchantId === merchant.id`
     * Transactions: `merchantId === merchant.id || merchantName matches`
     * Settlements / Disputes: `merchantName matches legal/trading`
     * Documents: `entityId === merchant.id`
     * KYB Cases: `id === merchant.kybCaseId || merchantName matches`
     * Support Tickets: `requesterName matches legal/trading`
     * Fraud Alerts: `entityName matches legal/trading`
     * Audit Logs: `entityId === merchant.id`
   - All mutations funnel through `adminData.update*` + `logAudit` with proper action keys (merchant.approve_kyb / reject_kyb / restrict / suspend / reactivate, pos_staff.*, terminal.*, pos_device.*, settlement.retry, dispute.*, document.*, kyb.*, ticket.*, transaction.*).
   - Emerald accent throughout (avatar, header gradient, badge tones, action button borders); NO indigo/blue primary.
   - Imports: `usePortalStore` from `@/hooks/use-portal-store`, `adminData + logAudit` from `@/lib/admin-data`, `useAuth` from `@/hooks/use-auth`, `toast` from `sonner`.
4. Ran `bun run lint` — clean (0 errors, 0 warnings). Dev server compiled successfully.

## Stage Summary
A proper full-page merchant profile (`MerchantDetailView`) replaces the previous sliding Sheet pattern. The page has a back button to return to the list, a wide emerald-tinted profile header (avatar, identity, status badges, action buttons, 6-cell quick stats), and 12 tabs covering everything connected to the merchant — overview, POS staff, terminals, POS device requests (with the `canBeApproved` approval rule), transactions, settlements, disputes, documents, KYB cases, support tickets, risk alerts, and the audit trail. Each tab shows a count badge, uses max-h-96 scrollable tables (taller since full page), and an EmptyState when 0 items. All mutations flow through `adminData.update*` + `logAudit` + sonner toasts; confirmations use `AlertDialog` or `Dialog`. The file is self-contained and ready for the router (`portal-app.tsx`) to wire up the `merchant_detail` case + `MerchantsView` to navigate via `selectMerchant(id) + setView("merchant_detail")` instead of opening a Sheet.
