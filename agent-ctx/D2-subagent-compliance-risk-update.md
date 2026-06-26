# Task D2 — subagent-compliance-risk-update

## Task
Update Compliance + Risk views to link KYC/KYB cases and fraud alerts to real merchant/consumer records.

## Files Touched
- `/home/z/my-project/src/components/portal/views/risk-view.tsx` — patched (4 atomic edits)
- `/home/z/my-project/src/components/portal/views/compliance-view.tsx` — verified already-complete, no edits needed
- `/home/z/my-project/worklog.md` — appended D2 stage summary

## What Was Already Done (prior pass)
Both views already had the bulk of the integration:
- `consumers` + `merchants` props wired from `portal-app.tsx`
- `findConsumerForKyc` / `findMerchantForKyb` lookups (compliance) and `findLinkedEntity` (risk)
- KYC approve/reject → `updateConsumer` with `kycStatus` + `status`
- KYB approve/reject → `updateMerchant` with `kybStatus` + `status`
- Restrict action → `updateConsumer` / `updateMerchant` with `status:"restricted"`
- Tier chip in KYC queue, merchant-risk chip in KYB queue, linked-entity status column in fraud table
- Live-sync info banners in both views
- Linked consumer/merchant panels in KycDetailSheet / KybDetailSheet
- Suspend + Reactivate functions and dropdown items

## What I Fixed in `risk-view.tsx`
1. **TS2366 errors** — `confirmTitle` and `confirmDescription` switch statements were missing `case "suspend"` and `case "reactivate"` branches, causing "Function lacks ending return statement" TS errors. Added both branches with descriptive copy. The description now also reports the linked consumer/merchant code (or "no linked record — audit only").
2. **FraudDetailSheet gap** — previously only received alert fields and rendered a single Restrict button. Now receives `linked`, `consumerStatusBadge`, `merchantStatusBadge`, `platformChips`, `onSuspend`, `onReactivate` and:
   - Renders the linked entity's current status badge in the header next to the alert status.
   - Renders an emerald-tinted "Linked consumer/merchant record" panel with all required fields (name, code, email, phone, nationality, KYC tier, risk score, status, platforms for consumers; trading/legal name, code, contact, owner, business type, risk category, status, platforms for merchants) and a "Live sync" badge plus an explanatory note about the separate Consumer/Merchant App.
   - Renders an amber-dashed fallback panel when no linked record is found.
   - Exposes a 5-row action grid: Restrict (amber outline) | Suspend (destructive red) | Reactivate (emerald outline) | Block device (destructive) | Hold settlement (outline) | Escalate (purple outline) | Close as false positive (secondary) | Add to watchlist (ghost). Restrict/Suspend/Reactivate are disabled when there's no linked record or the alert is closed.
3. **AlertDialog button color logic** — extended the red (`bg-red-600`) case to include `suspend`, so destructive actions are visually consistent. `reactivate`, `hold_settlement`, and `close_false_positive` use emerald (`bg-emerald-600`).

## Verification
- `bun run lint` → 0 errors, 0 warnings
- `npx tsc --noEmit 2>&1 | grep -E "(risk-view|compliance-view)"` → "NO ERRORS IN TARGET FILES"
- `curl http://localhost:3000/` → 200; dev.log shows clean compile after edits

## Status
Complete. Both views satisfy their task specs end-to-end.
