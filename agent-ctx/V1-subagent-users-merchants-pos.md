# Task V1 — Users & Merchants Views (Tabbed Profiles + POS Device Approval)

## Files Produced

1. `/home/z/my-project/src/components/portal/views/users-view.tsx` — `UsersView`
   - Props: `{ consumers: Consumer[]; countries: CountryConfig[] }`
   - Stat cards: Total / Active / Pending KYC / Restricted-Suspended
   - Filters: search, country, KYC status, account status
   - Consumers table with row actions (View / Restrict / Suspend / Reactivate)
   - Detail Sheet (sm:max-w-3xl) with 5 TABS:
     * Profile — personal / KYC / contact / platforms / wallet summary / tx stats / notes
     * Cards — subscribes `adminData.subscribeCards`, freeze/unfreeze via `updateCard`
     * Wallets — subscribes `adminData.subscribeWallets`, freeze/unfreeze via `updateWallet`
     * Transactions — subscribes `adminData.subscribeTransactions`, view receipt + open dispute
     * Documents — subscribes `adminData.subscribeDocuments`, approve/reject via `updateDocument`
   - Each tab trigger has a count badge

2. `/home/z/my-project/src/components/portal/views/merchants-view.tsx` — `MerchantsView`
   - Props: `{ merchants: Merchant[]; countries: CountryConfig[] }`
   - Stat cards: Total / Active / Onboarding / Restricted-Suspended
   - Filters: search, country, KYB status, account status, risk category
   - Merchants table with row actions (View / Approve KYB / Reject KYB / Restrict / Suspend / Reactivate)
   - Detail Sheet (sm:max-w-3xl) with 6 TABS:
     * Profile — business / owner / KYB / platforms / terminal stats / tx stats / settlement / notes
     * POS Staff — subscribes `adminData.subscribePosStaff`, suspend/reactivate/reset PIN/force logout
     * Terminals — subscribes `adminData.subscribeTerminals`, activate/block via `updateTerminal`
     * Settlements — subscribes `adminData.subscribeSettlements`, retry / view details
     * Disputes — subscribes `adminData.subscribeDisputes`, request evidence / update status
     * POS Requests — subscribes `adminData.subscribePosDeviceRequests` — KEY FEATURE
   - POS Device Request workflow:
     * Capability badges (NFC / Card Reader / Swipe) — green if supported, red if not
     * canBeApproved indicator (green check / red X)
     * Approve button DISABLED when canBeApproved === false (with tooltip)
     * Auto-decline button (sets status="auto_declined" + standard reason)
     * Approve button (sets status="approved" + reviewedBy + reviewedAt + logAudit)
     * Decline button opens Dialog with optional reason textarea
     * Amber warning banners for deviceIntegrityPassed === false and screenLockEnabled === false

## Audit Action Keys Used

- `consumer.restrict`, `consumer.suspend`, `consumer.reactivate`
- `card.freeze`, `card.unfreeze`
- `wallet.freeze`, `wallet.unfreeze`
- `document.approve`, `document.reject`
- `dispute.open` (from consumer profile), `dispute.request_evidence`, `dispute.update_status`
- `merchant.approve_kyb`, `merchant.reject_kyb`, `merchant.restrict`, `merchant.suspend`, `merchant.reactivate`
- `pos_staff.suspend`, `pos_staff.reactivate`, `pos_staff.reset_pin`, `pos_staff.force_logout`
- `terminal.activate`, `terminal.block`
- `settlement.retry`
- `pos_device.approve`, `pos_device.decline`, `pos_device.auto_decline`

## Notes

- Aliased `Card as CardRecord` / `Wallet as WalletRecord` for the type imports in users-view.tsx to avoid collision with the shadcn/ui `Card` / `Wallet` (via lucide-react icon, also a value) — kept the UI primitive name short where used as JSX
- All Sheet subscriptions are wired in `useEffect` keyed by the entity id, auto-cleanup on close
- ScrollTable component: `max-h-60 overflow-y-auto` with custom webkit-scrollbar styling, sticky table header
- No indigo/blue primary colors — emerald accent throughout
- Views are NOT wired into `portal-app.tsx` switch (per task scope); they are exported and ready for the integrator to mount
- Lint clean (0 errors / 0 warnings). TypeScript clean for both target files. Dev server returns 200 OK after edits.
