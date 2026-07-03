# Faya Merchant

The business management app for merchants who accept NFC and card payments through **Faya**.

Faya Merchant is for the **business owner, merchant admin, manager, accountant, and operations team**. It controls the business, compliance, devices, terminals, users, settlements, reports, and disputes.

> **Not the payment-taking app.** The payment-taking app is separate and called **Faya POS**. The consumer app is separate and called **Faya Consumer**. All three apps share one database.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Demo Account](#demo-account)
- [Features](#features)
  - [Authentication & Onboarding](#authentication--onboarding)
  - [Home Dashboard](#home-dashboard)
  - [Transactions](#transactions)
  - [Settlements](#settlements)
  - [Your POS Devices](#your-pos-devices)
  - [More (Admin)](#more-admin)
  - [Staff & PIN Management](#staff--pin-management)
  - [Payment Method Validation](#payment-method-validation)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)

---

## Overview

Faya Merchant lets a merchant:

- Register and complete **Know Your Business (KYB)** verification
- Manage their **business profile, owners, branches, and staff**
- View **transactions, settlements, disputes, and reports**
- Manage **POS devices** (terminals and phone POS) provided by Faya
- Set **staff PINs** for POS login and view **staff activity logs**
- Monitor **compliance** status and upload documents

### What Faya Merchant does NOT do

- Read bank cards directly
- Process raw NFC card data
- Store full card number, CVV, or PIN
- Accept QR payments, bank transfer proof, or cash recording
- Act as the card-present terminal (that's Faya POS)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 + shadcn/ui (New York) |
| **Database** | Prisma ORM + SQLite |
| **State** | Zustand (client) + TanStack Query (server) |
| **Icons** | lucide-react |
| **Charts** | Recharts |
| **Toasts** | Sonner |
| **Runtime** | Bun |

---

## Getting Started

```bash
# Install dependencies
bun install

# Set up the database
bun run db:push

# Seed demo data
bun run scripts/seed.ts

# Start the dev server (port 3000)
bun run dev
```

The app runs at `http://localhost:3000`.

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start dev server on port 3000 |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Push schema changes to database |
| `bun run db:generate` | Regenerate Prisma Client |
| `bun run db:reset` | Reset database (destructive) |

---

## Demo Account

The app comes pre-seeded with a demo merchant:

| Field | Value |
|-------|-------|
| **Merchant** | Brightwave Retail Ltd (trading as "Brightwave Store") |
| **Login email** | `owner@brightwave.co.uk` |
| **Password** | any (demo accepts all) |
| **Status** | Active, KYB Approved |

On the login screen, click **"Use demo account"** to auto-fill credentials.

### Demo Staff (with POS PINs)

| Staff | Role | PIN | Refund |
|-------|------|-----|--------|
| James Carter | Branch Manager | `1234` | ✅ |
| Aisha Bello | Cashier | `5678` | ❌ |
| Marco Rossi | Cashier | `4321` | ❌ |
| Priya Sharma | Cashier | `9999` | ❌ |
| Tom Whitfield | Accountant | `8765` | ❌ |

### Demo Data

- 3 branches (Camden, Shoreditch, Manchester)
- 5 staff members
- 6 POS devices (3 terminals + 3 phone POS)
- ~100 transactions over 14 days
- 5 settlement batches
- 5 disputes
- 7 business documents
- 2 owners/directors

---

## Features

### Authentication & Onboarding

The app uses a 4-state auth flow managed by Zustand with localStorage persistence:

```
unauthenticated → registering → onboarding → authenticated
```

**Login Screen**
- Email + password sign-in
- "Use demo account" quick-fill button
- "Create merchant account" link

**Register Screen (Step 1 of 8)**
- Business/trading name, email, phone, country, business type
- Password with validation (min 8 chars, confirmation)
- 5 mandatory consents: Terms, Privacy, KYB, Sanctions/PEP screening, Device monitoring

**KYB Onboarding Wizard (Steps 2–8)**

| Step | Title | Collects |
|------|-------|----------|
| 2 | Business Profile | Legal name, trading name, registration/tax numbers, industry, MCC, address |
| 3 | Risk Profile | Expected volume, avg/max transaction, product, customer type, risk declarations |
| 4 | Owners & Directors | Add multiple owners with full KYC fields, DOB, nationality, ownership %, PEP status |
| 5 | Beneficial Owners | Auto-detects ≥25% ownership, control type declaration |
| 6 | Business Documents | 11 document types (registration cert, tax, proof of address, bank proof, owner ID) |
| 7 | Settlement Account | Bank country, name, account number, name, currency, frequency |
| 8 | Acceptance Type | Choose: Physical Terminal / Phone POS / Both |

After submission, a success screen shows review timeline, then the user enters the dashboard.

### Home Dashboard

- **Today's sales hero** — gross/net sales, approval rate, next settlement countdown
- **Stats grid** — successful/declined today, pending/held settlement
- **7-day sales trend** — area chart (gross vs net)
- **Quick actions** — Open Faya POS, Request terminal, Add phone POS, Add branch, Add staff, View settlements, Contact support
- **Alerts** — compliance, device, dispute alerts (only if count > 0)
- **Devices summary** — active terminals and phone POS counts
- **Recent transactions** — latest 6 transactions

### Transactions

- **Summary bar** — total count, gross, net, fees for current filter
- **Filters** — status chips (All/Approved/Declined/Refunded), branch, payment method via filter sheet
- **Date-grouped list** — Today, Yesterday, etc.
- **Transaction detail** — all 20+ fields: references (Faya/acquirer/processor/scheme), merchant info, payment details, financial breakdown, timestamps, receipt/refund actions

### Settlements

- **Summary cards** — available, pending, paid today, held, failed, next payout
- **Settlement batches** — net amount, status, gross/fees/refunds/chargebacks/reserve breakdown, bank details, transaction count
- **Settlement detail** — full financial breakdown, bank info, timeline, transactions in batch, PDF/CSV export

### Your POS Devices

> Merchants are **sellers and restaurant owners**. Faya **provides** the POS devices — merchants don't supply them.

Four tabs:

1. **Terminals** — physical card terminals provided by Faya
2. **Phone POS** — approved Android phones running Faya POS app
3. **Requests** — terminal requests sent to Faya (no purchase/rental fees)
4. **Alerts** — inactive, pending approval, blocked, or integrity-failed devices

**Device cards show:**
- Device name, manufacturer, model, serial/terminal ID
- NFC, integrity, risk indicators
- Supported payment methods badges (Contactless / Chip & PIN / Magstripe)
- Branch and cashier assignment
- Last active and transaction time

**Device detail shows:**
- Device information, assignment, phone POS checks (NFC, integrity, risk, lock screen)
- **Supported Payment Methods** — capability profile with test buttons
- Activity, recent transactions
- Actions: Block, Request Replacement, View Transactions, Device Health, Request Another Device, Report Issue

### More (Admin)

Menu page with sections:

- **Business** — Business Profile, KYB/Compliance, Owners & Directors, Beneficial Owners, Branches, Staff
- **Operations** — Receipts, Fees, Reports, Disputes
- **Support** — Support, Settings, Legal, Logout

**Sub-pages:**
- **Compliance Center** — verification checklist, risk level, restrictions, required actions
- **Business Profile** — full read-only business info
- **Fees** — card acceptance (1.5%), phone POS (1.2%), terminal provision (no cost from Faya), chargeback, refund, same-day settlement, rolling reserve
- **Reports** — 9 report types, date ranges (7/30/90 days), charts (by branch, method, scheme, cashier), CSV/PDF/XLSX export
- **Branches** — list + detail with stats, location, manager
- **Staff** — list + detail with permissions, PIN, activity logs
- **Disputes** — list + detail with evidence upload, deadline countdown

### Staff & PIN Management

> The **PIN is stored on the staff profile** in the Merchant app. Staff enter it on the **Faya POS app** (separate app) to log in and process payments. The Merchant app does NOT do PIN entry.

**Staff Detail sections:**
1. Contact Information
2. Assignment (branch, device)
3. Permissions (POS access, refund, settlement view)
4. **POS PIN** — masked display (••••), reveal toggle, Set/Reset PIN dialog (4-6 digits)
5. Activity (date invited, last login, status)
6. **Staff Activity Logs** — login/switch/logout history with stats (total logins, switches, logouts)
7. Actions (suspend, assign, remove)

**Staff Activity Logs:**
- Summary stats: logins, switches, logouts counts
- Timeline of events with action icon, device name, note, timestamp
- Color-coded: green=login, sky=switch, amber=logout

### Payment Method Validation

A central validation rule shared across all 3 apps (Consumer, Merchant, POS) via the same database:

| Device Type | Contactless NFC | Chip & PIN Insert | Magnetic Stripe |
|-------------|:---:|:---:|:---:|
| **Phone POS** | ✅ Supported | ❌ Instant rejection | ❌ Instant rejection |
| **Physical Terminal** | ✅ Supported | ✅ Supported | ✅ If configured |
| **Neither supported** | ❌ | ❌ | ❌ All rejected |

**API:** `POST /api/devices/{id}/validate-payment`
- Returns `{ accepted: true/false, reason, message, supportedMethods }`
- Rejection reasons: `PHONE_POS_NO_CHIP_INSERT`, `METHOD_NOT_SUPPORTED`, `DEVICE_NO_CARD_SUPPORT`

The device detail has a "Supported Payment Methods" section with **Test accept** / **Test rejection** buttons that demonstrate the validation live.

---

## Architecture

### Three Apps, One Database

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Faya Consumer  │     │  Faya Merchant  │     │    Faya POS     │
│   (customer)    │     │   (this app)    │     │  (payment-taker)│
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                          ┌──────▼──────┐
                          │  Shared DB  │
                          │  (Prisma)   │
                          └─────────────┘
```

- **Faya Consumer** — customer app with Faya NFC wallet
- **Faya Merchant** — this app; business management, staff, devices, settlements
- **Faya POS** — the payment-taking app on the phone/terminal; validates staff PIN, processes card payments

### Mobile-First Design

- Phone-like container (max-width 480px on desktop)
- Sticky header with merchant name + verification badge
- Bottom navigation (5 tabs): Home, Transactions, Settlements, Devices, More
- Emerald/green fintech color palette (light + dark mode)
- Smooth slide-in animations for detail panels

### State Management

- **Zustand** — UI navigation state (active tab, selected items, auth state) with localStorage persistence
- **TanStack Query** — server state (all API data fetching, caching, invalidation)

### Routing

Single-page app with client-side view routing (no Next.js route segments). The `AppRouter` in `page.tsx` switches views based on `authState` and navigation state:

```
authState === 'unauthenticated' → LoginScreen
authState === 'registering'     → RegisterScreen
authState === 'onboarding'      → OnboardingFlow
authState === 'authenticated'   → AppShell (bottom nav + view router)
```

---

## API Reference

All API routes are under `/api` and return JSON.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create merchant account |
| POST | `/api/auth/login` | Login (returns token + needsOnboarding flag) |
| GET | `/api/auth/session` | Validate token |
| POST | `/api/auth/onboarding` | Save KYB step (business_profile, risk_profile, owners, documents, settlement_account, complete) |

### Merchant

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/merchant` | Merchant profile + settlement account |
| GET | `/api/owners` | Owners and beneficial owners |
| GET | `/api/documents` | Business documents |
| GET | `/api/dashboard` | Dashboard summary (today's stats, 7-day trend, recent transactions) |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List (filters: status, branchId, paymentMethod) |
| GET | `/api/transactions/{id}` | Transaction detail |

### Settlements

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settlements` | List + summary (available, pending, paid, held, failed) |
| GET | `/api/settlements/{id}` | Settlement detail + transactions in batch |

### Devices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | List (terminals, phonePos, requests, alerts) |
| GET | `/api/devices/{id}` | Device detail + transactions + session history |
| PATCH | `/api/devices/{id}` | Update device status (block/unblock) |
| POST | `/api/devices/{id}/validate-payment` | Validate payment method against device capabilities |
| GET | `/api/devices/{id}/validate-payment` | Get device capability profile |

### Staff

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/staff` | List all staff |
| PATCH | `/api/staff/{id}/pin` | Set/reset staff POS PIN |
| GET | `/api/staff/{id}/logs` | Staff activity logs (login/switch/logout history) |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/branches` | Branches with staff/device/txn counts |
| GET | `/api/disputes` | List disputes |
| GET | `/api/disputes/{id}` | Dispute detail |
| GET | `/api/terminal-requests` | Terminal requests |
| GET | `/api/fees` | Fee structure |
| GET | `/api/reports?days=30` | Aggregated report data |
| GET | `/api/audit-logs` | Activity audit log |

---

## Database Schema

12 Prisma models backed by SQLite:

```
Merchant
├── MerchantOwner          (directors + beneficial owners)
├── MerchantDocument        (KYB documents)
├── SettlementAccount       (bank account for payouts)
├── MerchantBranch          (physical locations)
│   ├── MerchantStaff       (employees with PIN + permissions)
│   └── MerchantDevice      (terminals + phone POS)
├── TerminalRequest         (requests to Faya for new hardware)
├── MerchantTransaction     (payment records)
├── MerchantSettlement      (payout batches)
├── MerchantDispute         (chargebacks + disputes)
└── MerchantAuditLog        (activity trail)
```

### Key Fields

**MerchantStaff**
- `pin` — unique 4-6 digit PIN for POS login (stored here, used on Faya POS)
- `posPermission`, `refundPermission`, `settlementViewPermission` — granular permissions

**MerchantDevice**
- `deviceType` — `terminal` or `phone_pos`
- `nfcAvailable`, `nfcEnabled` — contactless capability
- `chipInsertSupported` — terminal=true, phone_pos=false
- `magneticStripeSupported` — only some terminals
- `status` — active, inactive, blocked, pending_owner_approval

**MerchantTransaction**
- `fayaReference`, `acquirerReference`, `processorReference`, `schemeReference`
- `paymentMethod` — terminal_contactless, terminal_chip_pin, phone_pos_contactless, faya_nfc_wallet
- `status` — approved, declined, refunded, disputed, settled, etc.

Run `bun run db:push` to sync the schema, then `bun run scripts/seed.ts` to populate demo data.

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (fonts, toaster)
│   ├── page.tsx                # Main page (auth routing + view router)
│   ├── globals.css             # Tailwind + theme + animations
│   └── api/                    # 19 API route handlers
│       ├── auth/               # register, login, session, onboarding
│       ├── dashboard/
│       ├── merchant/
│       ├── transactions/
│       ├── settlements/
│       ├── devices/            # + validate-payment, switch-staff
│       ├── staff/              # + pin, logs
│       ├── branches/
│       ├── disputes/
│       ├── documents/
│       ├── owners/
│       ├── fees/
│       ├── reports/
│       ├── terminal-requests/
│       └── audit-logs/
├── components/
│   ├── app/
│   │   ├── app-shell.tsx       # Header + bottom nav + notifications
│   │   ├── shared.tsx          # PageContainer, SectionCard, InfoRow, etc.
│   │   └── status-badge.tsx    # StatusBadge + paymentMethodLabel
│   ├── auth/                   # login, register, onboarding flow
│   ├── views/                  # 18 view components
│   │   ├── home-view.tsx
│   │   ├── transactions-view.tsx + transaction-detail.tsx
│   │   ├── settlements-view.tsx + settlement-detail.tsx
│   │   ├── devices-view.tsx + device-detail.tsx
│   │   ├── more-view.tsx
│   │   ├── compliance-view.tsx
│   │   ├── branches-view.tsx + branch-detail.tsx
│   │   ├── staff-view.tsx + staff-detail.tsx
│   │   ├── disputes-view.tsx + dispute-detail.tsx
│   │   ├── reports-view.tsx
│   │   ├── fees-view.tsx
│   │   └── business-profile-view.tsx
│   └── ui/                     # 50 shadcn/ui components
├── lib/
│   ├── db.ts                   # Prisma client
│   ├── store.ts                # Zustand store (auth + navigation)
│   ├── api.ts                  # Typed API client functions
│   ├── types.ts                # TypeScript interfaces
│   ├── format.ts               # Currency, date, timeAgo formatters
│   ├── merchant-context.ts     # Merchant ID helper
│   └── utils.ts                # cn() class merger
├── hooks/
│   ├── use-mobile.ts
│   └── use-toast.ts
prisma/
└── schema.prisma               # 12 models
scripts/
└── seed.ts                     # Demo data seeder
```

---

## Design Conventions

- **Color palette**: Emerald/teal primary (no blue/indigo)
- **Mobile-first**: 480px max-width container, bottom navigation
- **Cards**: `p-4` padding, `gap-3` spacing, rounded-xl
- **Status colors**: emerald=approved/active, red=declined/blocked, amber=pending, orange=refunded/held, sky=processing, purple=disputed
- **Detail panels**: slide-in-right animation
- **Loading**: skeleton lists
- **Empty states**: icon + title + description
- **Toasts**: Sonner for user feedback
- **Icons**: lucide-react throughout

---

## License

Proprietary — Faya. All rights reserved.
