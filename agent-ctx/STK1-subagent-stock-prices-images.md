# Task ID: STK1 — Rebuild Stock view with prices, images, availability-based ordering, delivery fee

**Agent:** subagent-stock-prices-images
**Task:** Completely rewrite `/home/z/my-project/src/components/portal/views/stock-view.tsx`

## Context files read
- `/home/z/my-project/worklog.md` — prior agents' work (esp. FIX2 which built the original stock view)
- `/home/z/my-project/src/lib/types.ts` — StockItem (price, currency, imageUrl, description), StockOrder (unitPrice, deliveryFee, totalAmount), StockItemType, StockItemStatus, StockOrderStatus
- `/home/z/my-project/src/lib/admin-data.ts` — adminData.subscribeStock, subscribeStockOrders, createStockItem, createStockOrder, updateStockItem, updateStockOrder, logAudit
- `/home/z/my-project/src/lib/access-scope.ts` — getVisibleCountryCodes, isGlobalScope
- `/home/z/my-project/src/lib/formatters.ts` — formatCurrency, formatDateTime, formatNumber, timeAgo
- `/home/z/my-project/src/components/portal/view-helpers.tsx` — ViewHeader, StatCard, EmptyState, ViewContainer
- `/home/z/my-project/src/components/ui/*` — shadcn/ui primitives (Card, Badge, Button, Input, Label, Textarea, Table, Tabs, DropdownMenu, Dialog, Select, RadioGroup, SonnerToaster)
- `/home/z/my-project/src/hooks/use-auth.ts` — useAuth()
- `/home/z/my-project/src/lib/seed-data.ts` — SEED_STOCK_ITEMS (already includes price/currency/imageUrl/description) and SEED_STOCK_ORDERS (already includes deliveryFee)
- `/home/z/my-project/src/components/portal/portal-shell.tsx` + `portal-app.tsx` — confirmed `case "stock": return <StockView />;` already wired

## What was produced

A single-file rebuild of `stock-view.tsx` (~2300 lines) exporting `StockView` with:

### Top-level structure
- `ViewHeader` with `Boxes` icon, "New Order" (emerald outline) + "Add to Stock" (Super Admin only, emerald solid) buttons
- `<Tabs>` with two tabs: **Inventory** | **Orders**

### Inventory tab
- 5 StatCards: Total Items, In Stock, Allocated, Damaged, Total Stock Value (grouped by currency)
- Availability banner showing live per-type in-stock counts (red when 0)
- Filter bar: search, country, type, status, clear-filters
- Product-card grid (1/2/3/4 cols responsive) — each card has:
  - 120px product image (object-cover) with `onError` fallback to `ImageOff`
  - Type badge (top-left), Status badge (top-right)
  - Model name (bold), serial (mono)
  - Description (2-line truncated)
  - **Prominent emerald price box** (formatCurrency with per-item currency)
  - "Allocated to: {merchant name}" when allocated
  - Country flag/code + notes
  - Actions: Details button + dropdown (View details, Mark damaged, Mark in stock)

### Orders tab
- 5 StatCards: Total Orders, Pending, Shipped, Delivered, Total Revenue (delivered only, grouped by currency)
- Filter bar: search, country, status, clear-filters
- Table with: Order Code, User (name + type badge), Item, **Unit Price**, **Delivery Fee** (separate column), **Total** (emerald bold), Status, Delivery Address, Created, Actions
- Row actions: View details, Mark shipped (if pending), Mark delivered (if shipped), Cancel (if pending — releases item back to in_stock)

### Dialogs
- **StockDetailDialog** — large product image (180px), type+status badges, model+description, prominent unit-price box, full detail rows, notes. Keyed by `item.id` from parent.
- **OrderDetailDialog** — status+type+user-type badges, cost-summary card (Unit Price + Delivery Fee = Total), detail rows, notes.
- **AddToStockDialog** (Super Admin only) — type radio, serial (duplicate-check), model, description, price+currency, country (auto-derives currency), **image URL with live preview** (green "Live preview" badge when OK, red error card when load fails), notes.
- **CreateOrderDialog** — user-type radio (Merchant/Consumer), user name+ID, country select, item-type radio (**DISABLED when 0 of that type in stock**), item dropdown (shows serial + model + price), delivery address, **delivery fee** (pre-filled with country default from `DEFAULT_DELIVERY_FEE`: NG=2000, GH=20, KE=300, ZA=100), **cost summary card** (Unit Price → + Delivery Fee → Total), notes. On submit: creates StockOrder (status="pending"), allocates the StockItem (status="allocated"), logs audit `stock_order.create`, toast success.

### Availability-based ordering enforcement
1. The Inventory tab availability banner shows live counts: "Terminals in stock: N", "Cards in stock: N" (red when 0)
2. In CreateOrderDialog, the Terminal radio is `disabled` when `inStockByType.physical_terminal.length === 0` (and same for Card) — with a "None in stock — disabled" hint
3. The item dropdown is empty with a warning when no items of the chosen type are in stock
4. A blocking EmptyState is shown if NOTHING is in stock at all

### Audit action keys
- `stock.create` (Super Admin adds an item)
- `stock.mark_damaged` / `stock.mark_in_stock` (status changes)
- `stock_order.create` (admin creates an order; afterValue includes full cost breakdown)
- `stock_order.ship` / `stock_order.deliver` / `stock_order.cancel` (status transitions)

### Country scoping
- `getVisibleCountryCodes(staff, countries)` — Super Admin sees all warehouses; others see only their assigned countries
- `filterableCountries` for the filter dropdowns is also scoped

### Design
- Emerald accent throughout (NO indigo/blue)
- Product cards look like an e-commerce catalog
- Images: 120px in cards, 180px in detail dialog, 100px live-preview in Add-to-Stock dialog
- All cards use `object-cover` for images
- `SonnerToaster richColors closeButton position="bottom-right"` mounted at end of view

## Lint & TypeScript
- Initial `bun run lint`: 3 errors (`react-hooks/set-state-in-effect` × 3) + 3 warnings (unused `@next/next/no-img-element` eslint-disable directives)
- Fixes applied:
  - StockDetailDialog: removed `useEffect(() => setImgError(false), [item?.id])`; parent now passes `key={detailItem.id}` so the dialog remounts per item, naturally resetting `imgError`
  - CreateOrderDialog: moved "clear stockItemId on type change" + "set default deliveryFee on country change" inline into the RadioGroup/Select `onValueChange` handlers; used a lazy `useState` initializer for `deliveryFee` based on initial `countryCode`
  - Removed 3 unused `eslint-disable-next-line @next/next/no-img-element` comments (rule isn't enabled)
  - Removed `shippedAt`/`deliveredAt` from `updateStockOrder` patches (StockOrder type doesn't have those fields; kept them on `updateStockItem` since StockItem does)
- Final state: `bun run lint` → 0 errors, 0 warnings. `npx tsc --noEmit` → 0 errors in stock-view.tsx. Dev server compiles cleanly.

## Integration
- The view is already wired into the portal shell: `case "stock": return <StockView />;` in `portal-app.tsx`
- No changes needed to `portal-app.tsx`, `portal-shell.tsx`, or any other file
- The view self-subscribes to `adminData.subscribeStock`, `subscribeStockOrders`, `subscribeCountries` — no props required from the parent
EOF