# Task FIX3 — Stock orders on profiles + new-order notifications

## Scope
Add an **Orders** tab to both the consumer (user-detail-view) and merchant
(merchant-detail-view) profile pages, surface an emerald info banner at the
top of the existing Orders tab in stock-view, and emit a sonner toast
notification whenever a brand-new stock order arrives in real time.

## Files touched
- `src/components/portal/views/user-detail-view.tsx`
- `src/components/portal/views/merchant-detail-view.tsx`
- `src/components/portal/views/stock-view.tsx`
- `worklog.md` (appended)

## Implementation notes

### user-detail-view.tsx
- Added lucide imports: `ShoppingCart`, `Truck`, `Smartphone`, `Package`.
- Added type imports: `StockOrder`, `StockOrderStatus`, `StockItemType`.
- Added module-level `STOCK_ORDER_STATUS_STYLES` and `STOCK_TYPE_META` maps
  (mirroring stock-view.tsx so colours/badges are consistent across the app).
- `ProfileTabs` now also subscribes to `adminData.subscribeStockOrders` and
  derives `consumerOrders = orders.filter(o => o.userId === consumer.id && o.userType === "consumer")`.
- New `<ProfileTab value="orders" label="Orders" count={consumerOrders.length} />`
  + `<TabsContent value="orders">` pointing at a new `OrdersTab` component.
- `OrdersTab` renders an emerald info banner explaining the Faya Pay app flow,
  then a `ScrollTable` (max-h-96, sticky header) with columns: Order Code,
  Item (model + type badge), Unit Price, Delivery Fee, Total, Status, Delivery
  Address (lg+), Ordered (md+), Actions.
- Empty state: "No orders yet. When this consumer orders a physical card from
  the Faya Pay app, it will appear here."
- Actions per row: View details (toast), Mark shipped (status pending),
  Mark delivered (status shipped), Cancel order (status pending/fulfilled).
  All actions persist via `adminData.updateStockOrder` + `updateStockItem`
  and log via `logAudit`.

### merchant-detail-view.tsx
- Added lucide imports: `ShoppingCart`, `Truck`, `Package`.
- Added type imports: `StockOrder`, `StockOrderStatus`, `StockItemType`.
- Added module-level `STOCK_ORDER_STATUS_STYLES` and `STOCK_TYPE_META`.
- Main view now also subscribes to `adminData.subscribeStockOrders` and
  derives `merchantOrders = orders.filter(o => o.userId === merchant.id && o.userType === "merchant")`.
- New tab trigger `Orders <CountBadge n={merchantOrders.length} />` and
  matching `<TabsContent value="orders">` rendering a new `StockOrdersTab`.
- `StockOrdersTab` mirrors the consumer version (emerald info banner with
  Faya Merchant app copy, ScrollTable, fulfil/cancel actions).

### stock-view.tsx
- Added `Info` icon import, plus `useRef` from react.
- New emerald info banner at the very top of the Orders `TabsContent`:
  "Orders are placed by users and merchants from their own apps (Faya Pay
  for cards, Faya Merchant for terminals). When they pay, the item is
  automatically allocated from stock and appears on their profile. Admin
  fulfils by marking shipped → delivered."
- New `useEffect` (deps `[orders]`) keeps a `useRef<Set<string> | null>`
  of previously-seen order IDs. On the very first snapshot it just seeds
  the set silently (so we don't toast existing orders on mount). For any
  subsequent render, any order whose ID wasn't in the set fires
  `toast.success("New order received", { description: "{orderCode} — {userName} ordered {model} for {totalAmount}" })`
  and is then added to the set. Fresh orders are sorted by createdAt asc
  so older-new orders toast first.

## Conventions followed
- Emerald accent throughout (no indigo/blue).
- Tables use `max-h-96 overflow-auto` via the shared `ScrollTable` helper
  with sticky `bg-card` headers.
- All admin mutations go through `adminData.*` and `logAudit`.
- Count badges in tab labels use the existing `ProfileTab`/`CountBadge`
  helpers so they match the rest of the profile.

## Verification
- `bun run lint` — to be run after writing this log; lint errors fixed.
