# Task ID: FIX2 — Stock page + remove Order POS button + rebuild compliance

**Agent:** subagent-stock-compliance-fix
**Task:** Add stock page, remove Order POS button, rebuild compliance with inline documents

## Work Log

1. Read context files (READMEs, types.ts, admin-data.ts, use-portal-store.ts,
   merchant-detail-view.tsx, compliance-view.tsx, view-helpers.tsx,
   access-scope.ts, use-auth.ts) to understand the existing architecture.
2. Created `/src/components/portal/views/stock-view.tsx` — `StockView`:
   - Subscribes to `adminData.subscribeStock` and `adminData.subscribeCountries`
   - Country scoping via `getVisibleCountryCodes` + `isGlobalScope`
   - 4 stat cards: Total Items, In Stock, Allocated, Damaged
   - 4 tabs: All, In Stock, Allocated, Damaged
   - Table with Serial, Type, Model, Country, Status, Allocated To,
     Allocated At, Notes, Actions
   - Row actions dropdown: View details (Dialog), Mark damaged, Mark in stock
   - "Add to Stock" button (Super Admin only) → Dialog with serial, type,
     model, country, notes; validates duplicate serial numbers
   - Pricing info banner: terminals free, cards have issuance fee,
     POS app and Phone POS are free downloads (no stock needed)
   - Audit actions: `stock.create`, `stock.mark_damaged`, `stock.mark_in_stock`
3. Modified `/src/components/portal/views/merchant-detail-view.tsx`:
   - Removed "Order POS Device" button + `OrderPosDeviceDialog` component +
     `CapabilityToggle` helper (≈300 lines deleted)
   - Removed unused imports: `Plus`, `Checkbox`, `RadioGroup`, `RadioGroupItem`
   - Removed unused `merchant` and `allPosRequests` props from `PosRequestsTab`
   - Added `Info` icon import
   - Added `PosRequestsInfoBanner` component explaining the device binding flow
     (POS app sends capability checks on login; admin only approves/declines;
     POS app is free; terminals free; cards have issuance fee)
4. Rebuilt `/src/components/portal/views/compliance-view.tsx`:
   - NO `Sheet`/`SheetContent` — full-page card layout
   - Subscribes to documents via `adminData.subscribeDocuments`
   - Each KYC/KYB case is a full card with inline document grid
   - Each document is a card with type, file name, status, uploaded date,
     View/Approve/Reject buttons
   - Document viewer Dialog shows metadata only (NO download button):
     type, file name, MIME, entity, country, uploaded date, status,
     reviewed by, notes + placeholder "Document preview available in
     production — file stored in Firebase Storage"
   - "View Profile" button on each case navigates:
     KYC → `selectUser(consumer.id); setView("user_detail")`
     KYB → `selectMerchant(merchant.id); setView("merchant_detail")`
   - Kept Approve/Reject/Escalate actions that also update the linked
     consumer/merchant (real-time sync)
   - Per-document Approve/Reject actions (`document.approve` / `document.reject`)
   - Tabs: KYC Queue, KYB Queue, Sanctions/PEP, Manual Review, Approved, Rejected
   - Removed unused imports: `Sheet*`, `Table*`, `typeBadge`, `reviewerCell`
   - Imported `usePortalStore` for navigation, `Dialog` for document viewer,
     `UserDocument`/`DocumentType` types
5. Wired `StockView` into `portal-app.tsx`:
   - Added import
   - Added `case "stock": return <StockView />;` to the view switch
6. Ran `bun run lint` — initially 1 error (`react-hooks/set-state-in-effect` in
   `AddToStockDialog` useEffect that reset the form on open). Fixed by:
   - Lifting the reset responsibility to the parent via a `key` prop
     (`addKey` counter that increments on each open → forces remount →
     useState defaults are used fresh each time)
   - Replaced useEffect-based reset with lazy useState initializer for
     `countryCode` (`countries[0]?.countryCode ?? ""`)
7. Ran `bun run lint` again — 0 errors, 0 warnings.
8. Verified dev server (`dev.log`) compiles cleanly and serves 200 OK.

## Stage Summary

Three issues from the user's feedback are now resolved:

1. **Stock / Inventory page** — New `StockView` lists physical terminals and
   cards in Faya's warehouse. Admin can add to stock (Super Admin only),
   view item details, mark damaged/in stock. Country-scoped. Pricing model
   clearly stated in a banner: terminals free, cards have fee, POS app +
   Phone POS are free downloads needing no stock.

2. **No more "Order POS Device" button** — The `PosRequestsTab` in the
   merchant profile no longer lets admin order devices on the merchant's
   behalf. The tab now ONLY shows device binding requests that come from
   the POS app when a merchant logs in on a new device. A clear info banner
   explains the flow.

3. **Rebuilt compliance view** — No more sliding sheets. Each KYC/KYB case
   is a full card with linked documents shown INLINE (no downloads).
   Clicking "View" on a document opens a metadata-only Dialog. Clicking
   "View Profile" navigates to the full-page consumer/merchant profile.
   Approve/Reject/Escalate actions still flow through to the linked entity
   in real-time.

The work is wired up: `case "stock": return <StockView />;` in portal-app.tsx.
All changes use the emerald accent color and avoid indigo/blue. Lint is clean.
