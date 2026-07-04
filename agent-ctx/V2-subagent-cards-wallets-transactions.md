# Task V2 — Cards, Wallets, Transactions Views

**Agent:** subagent-cards-wallets-transactions
**Task:** Build `CardsView` (§8), `WalletsView` (§9), and `TransactionsView` (§10) for the Faya Admin Portal.

## Files Produced

All three views replace existing stubs in `/home/z/my-project/src/components/portal/views/`. They follow the same self-subscription pattern (no props) so PortalApp's existing `<CardsView />`, `<WalletsView />`, `<TransactionsView />` rendering just works.

### 1. `cards-view.tsx` — `CardsView`

- **Self-subscription:** `adminData.subscribeCards` + `adminData.subscribeCountries` in `useEffect` (with 1.5s safety timeout so loading never hangs).
- **Auth & scoping:** `useAuth()` for current staff → `getVisibleCountryCodes(staff, countries)`. Super Admin sees all; region/country-scoped staff see only their assigned + region countries.
- **Stat cards (5):** Total Cards, Active, Virtual, Physical, Frozen/Blocked.
- **Security:** ViewHeader badge "No PAN / CVV / PIN access" + amber-bordered notice banner in body + reminder inside the details sheet. Admins only ever see `last4`, expiry, scheme, provider metadata.
- **Filters:** search (cardId / last4 / userName), country, type (virtual/physical), status (all 7 CardStatus values), scheme (Visa/Mastercard/Verve). Clear button + count badge.
- **Table columns:** Card ID, User, Country, Type, Scheme, Last 4, Status, Currency, Provider, Frozen, Tokenized, Created, Actions.
- **Row actions (DropdownMenu):**
  - View details → Sheet + `logAudit "card.view_details"`
  - Freeze (when `status="active" && !frozen`) → `updateCard({frozen:true, status:"frozen"})` + `logAudit "card.freeze"`
  - Unfreeze (when `frozen && !terminal`) → `updateCard({frozen:false, status:"active"})` + `logAudit "card.unfreeze"`
  - Terminate… (AlertDialog confirm, red action button) → `updateCard({status:"terminated", frozen:true})` + `logAudit "card.terminate"`
  - Terminal statuses (terminated/replaced/expired) show "no actions available" instead.
- **Details Sheet:** dark-gradient card visual showing masked PAN `•••• •••• •••• {last4}`, status/type/scheme/frozen/tokenized/wallet pills, security reminder, Cardholder / Card metadata / Spend limits / Provider / Lifecycle detail sections.

### 2. `wallets-view.tsx` — `WalletsView`

- **Self-subscription:** `adminData.subscribeWallets` + `adminData.subscribeCards` (for linked-card display) + `adminData.subscribeCountries`.
- **Auth & scoping:** same pattern.
- **Stat cards (5):** Total Wallets, Active, Frozen, Total Balance (single-currency shows full amount, multi-currency shows compact + currency-count hint), Held Balance.
- **Restriction:** ViewHeader badge "Dual approval enforced" + emerald-bordered notice: manual balance adjustments require dual approval via the Approvals workflow. Admins may freeze/unfreeze directly but cannot move funds unilaterally.
- **Filters:** search (walletId / userName), country, status (active/frozen/closed), currency (dynamic from data).
- **Table columns:** Wallet ID, User, Country, Currency, Balance, Available, Held, Status, Linked Cards, Created, Actions.
- **Per-currency totals table** appears below the main table when more than one currency is present.
- **Row actions (DropdownMenu):**
  - View details → Sheet + `logAudit "wallet.view_details"`
  - Freeze (when active) → `updateWallet({status:"frozen"})` + `logAudit "wallet.freeze"`
  - Unfreeze (when frozen) → `updateWallet({status:"active"})` + `logAudit "wallet.unfreeze"`
  - Request adjustment… → toast info explaining dual-approval requirement
  - Closed wallets show "no actions available".
- **Details Sheet:** emerald-gradient balance hero (Total / Available / Held), status pills, dual-approval reminder, Wallet owner / Balance breakdown / Linked cards (with per-card status badges) / Ledger entries placeholder (Phase 4) / Lifecycle detail sections, "Request balance adjustment" CTA at the bottom.

### 3. `transactions-view.tsx` — `TransactionsView`

- **Self-subscription:** `adminData.subscribeTransactions` + `adminData.subscribeCards` (for scheme lookup by last4) + `adminData.subscribeCountries`.
- **Auth & scoping:** same pattern.
- **Stat cards (5):** Transactions (24h), Successful (24h), Failed (24h), Volume (24h successful only), Decline Rate (24h) — colored danger when >10%, warning when >5%.
- **Filters:** search (reference / userName / merchantName), country, type (all 12 TransactionType values), status (all 7 TransactionStatus values), payment method (dynamic from data), date range (24h / 7d / 30d / all). Defaults to last 24h.
- **Table columns:** Reference, User, Merchant, Country, Amount (with currency sub-text), Type, Status, Method, Card (last4 + scheme via lookup), Risk (score + tone badge), Created, Actions.
- **Row actions (DropdownMenu):**
  - View details → Sheet + `logAudit "transaction.view_details"`
  - View receipt → toast success + `logAudit "transaction.view_receipt"`
  - Add note → toast + `logAudit "transaction.add_note"`
  - Open dispute → toast info + `logAudit "transaction.open_dispute"`
  - Escalate to risk → toast warning + `logAudit "transaction.escalate_risk"`
  - Hold settlement (only when `settlementStatus="pending"`) → `updateTransaction({settlementStatus:"held"})` + `logAudit "transaction.hold_settlement"`. Also updates the open sheet's local state.
- **Details Sheet:** dark-gradient amount hero (type + payment method + amount + timestamp), status pills (status/type/method/settlement/dispute/risk), 4-button quick-action row (Receipt / Add note / Open dispute / Escalate) + conditional Hold settlement button, detail sections for Parties (customer/merchant/IDs/country), Card & payment method (last4, scheme via lookup, device serial), Device info, Provider & authorization (provider reference, auth code, response code), Risk (score + tone badge), Settlement & dispute, Lifecycle.
- **`PaymentMethodIcon` static component:** maps card→CreditCard, nfc→Smartphone, wallet→Wallet, bank→ArrowRightLeft, default→Receipt. Uses `React.createElement` instead of `<Icon />` to satisfy the `react-hooks/static-components` lint rule (creating components during render is forbidden).

## Conventions Followed

- Visual style matches `dashboard-view.tsx` + `disputes-view.tsx`: emerald accent throughout, NO indigo/blue primary in chrome (only sky-100 used for semantically-distinct status badges like "frozen" and "authorized" — matches existing formatters).
- `ViewHeader` + `ViewContainer` from `view-helpers.tsx`. `getScopeLabel(currentStaff)` shown in the description so admins know their scope.
- `ScrollTable` wrapper (raw `<table>` inside a `max-h-[60vh] overflow-auto` div with sticky `<thead>` + custom scrollbar) — same trick as `disputes-view.tsx` so the thead sticks to the vertical-scroll viewport.
- `useAuth()` for current staff (`actor.staffId/staffName/department/role` for `logAudit` + country scoping via `getVisibleCountryCodes`).
- All mutations via `adminData.updateCard` / `adminData.updateWallet` / `adminData.updateTransaction` + `logAudit(...)`. Toast feedback via `sonner` on every action.
- `AlertDialog` for destructive Terminate confirmation (red action button). `DropdownMenu` for per-row actions. `Sheet` for the details drawer.
- Responsive: less-critical columns hidden at md/lg/xl breakpoints (Country at md, Merchant/Scheme/Provider/Frozen/Held at lg, Currency/Tokenized/Risk/Method at xl).
- `SonnerToaster` mounted at end of each view (rich colors, close button, top-right).
- Lucide-react icons used throughout.

## Quality

- `bun run lint` → **zero** errors/warnings across all three files.
- `npx tsc --noEmit` → **zero** TS errors in the three new files.
- Dev server: HTTP 200 on `/`, no runtime errors after the lint fix.

## Integration Notes (for the integrator agent)

No integration work needed — PortalApp already renders:

```tsx
case "cards":        return <CardsView />;
case "wallets":      return <WalletsView />;
case "transactions": return <TransactionsView />;
```

The views self-subscribe to their own data, so they don't require any prop wiring. Country scoping is enforced internally based on `useAuth()` staff + `getVisibleCountryCodes`.
