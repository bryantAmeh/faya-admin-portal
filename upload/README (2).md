# Faya POS — Secure Payment Collection

> A mobile-first Point of Sale application for collecting NFC, chip, and swipe card payments. Built for merchants who need a secure, compliant, and simple way to accept card payments on phones and physical terminals.

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Device Types & Capabilities](#device-types--capabilities)
- [App Flow](#app-flow)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [State Management](#state-management)
- [Screens](#screens)
- [Demo Credentials](#demo-credentials)
- [Business Rules](#business-rules)
- [Security Model](#security-model)

---

## Overview

Faya POS is the payment-taking app for the Faya ecosystem. It is **strictly a mobile application** — designed for phones and physical POS terminals. Merchants bind the app to their business account, admins approve devices, and staff use unique PIN codes to process payments.

Key principles:

- **No lock screen** — The POS is always visible. Staff enter their PIN only when they need to do something (collect payment, refund, switch staff).
- **Auto-detect payment method** — No manual method selection. The system detects NFC, chip, or swipe automatically based on device capabilities.
- **Every transaction is tied to staff** — All payments and refunds are logged with the staff member who processed them, and sent to the merchant.
- **Device binding requires admin approval** — A merchant can bind a device, but it only becomes active after an admin approves it from the Merchant App.
- **Device check is mandatory** — If the device fails capability checks (no NFC, no network), the merchant cannot log in at all.

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                     FAYA POS APP                        │
│                                                         │
│  1. Install & Open                                      │
│     └─► Device Check (NFC, network, integrity)          │
│         ├─ FAIL → Blocked (cannot login)                │
│         └─ PASS → Merchant Login                        │
│                                                         │
│  2. Merchant Login                                      │
│     └─► Email/Phone + Password                         │
│         └─► Device Binding Confirmation                  │
│             └─► Awaiting Admin Approval                  │
│                 ├─ PENDING → Wait (auto-polls 10s)       │
│                 ├─ APPROVED → POS Home                   │
│                 └─ REJECTED → Cannot proceed             │
│                                                         │
│  3. POS Home (always visible)                           │
│     └─► Enter amount on numpad                          │
│         └─► Tap "Pay"                                   │
│             ├─ Staff logged in? → Create txn → Card tap │
│             └─ No staff? → PIN modal → Verify → Card tap│
│                                                         │
│  4. Card Tap / NFC                                      │
│     └─► Auto-detects method (contactless/chip/swipe)    │
│         └─► Approved / Declined / Failed                │
│             └─► Receipt                                 │
│                                                         │
│  5. Staff Switching                                     │
│     └─► Tap staff name in header → Enter new PIN        │
│         └─► Overrides current staff (no disruption)     │
│     └─► Tap logout icon → Clears current staff          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Device Types & Capabilities

The app performs **real system checks** to determine what the device can do:

| Device Type | NFC | Chip Reader | Swipe Reader | How Determined |
|---|---|---|---|---|
| **Phone POS** | ✅ | ❌ | ❌ | Mobile device with NFC (phone's built-in NFC) |
| **Physical Terminal** | ✅ | ✅ | ✅ | Has 2+ of (NFC, chip, swipe) — typically via UA detection or capability count |
| **Faya NFC** | ✅ | ❌ | ❌ | Dedicated Faya NFC device |

### Detection Logic

1. Check for physical terminal User-Agent patterns (Ingenico, Verifone, PAX, etc.)
2. Check Web NFC API (`NDEFReader` in window)
3. Count available payment methods:
   - Only NFC + mobile → **Phone POS**
   - 2+ methods → **Physical Terminal**
   - Desktop browser demo → Simulates **Phone POS** with NFC
4. If no payment method available → **Device check fails** → Login blocked

---

## App Flow

### Screen Navigation Map

```
Splash
  │
  ▼
Device Check ─── FAIL ──► Device Check Failed (blocked)
  │
  PASS
  │
  ├── Device already bound & approved ──► Home (POS)
  ├── Device bound but not approved ──► Awaiting Approval
  └── New device ──► Merchant Login
                        │
                        ▼
                   Device Binding
                        │
                        ├── Already approved ──► Home (POS)
                        └── Needs approval ──► Awaiting Approval
                                                 │
                                                 ├── Approved ──► Home (POS)
                                                 └── Rejected ──► Cannot proceed

Home (POS Terminal)
  ├── Pay (with staff) ──► Awaiting Card ──► Approved/Declined/Failed
  ├── Pay (no staff) ──► PIN Modal ──► Awaiting Card ──► ...
  ├── Tap staff name ──► PIN Modal (switch)
  ├── History ──► Transaction History ──► Transaction Detail ──► Refund
  ├── Device ──► Device Settings
  └── Help ──► Support

Approved/Declined/Failed ──► Receipt ──► Home
```

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  Frontend (Next.js)               │
│                                                   │
│  ┌─────────────┐  ┌──────────┐  ┌─────────────┐ │
│  │   Screens    │  │  Zustand  │  │   Framer    │ │
│  │  (14 views)  │◄─┤  Store   │─►│   Motion    │ │
│  └──────┬──────┘  └────┬─────┘  └─────────────┘ │
│         │              │                          │
│         │    ┌─────────┴──────────┐              │
│         │    │  Device Detection  │              │
│         │    │  (NFC/Chip/Swipe)  │              │
│         │    └────────────────────┘              │
│         │                                        │
└─────────┼────────────────────────────────────────┘
          │
          ▼  REST API Calls
┌──────────────────────────────────────────────────┐
│                  API Routes                       │
│                                                   │
│  /api/pos/merchant/login    (POST)                │
│  /api/pos/auth/login        (POST)                │
│  /api/pos/auth/logout       (POST)                │
│  /api/pos/device/bind       (POST)                │
│  /api/pos/device/approve    (POST)                │
│  /api/pos/device/approval-status (GET)            │
│  /api/pos/transactions      (GET, POST)           │
│  /api/pos/transactions/:id  (GET)                 │
│  /api/pos/transactions/:id/finalize  (POST)       │
│  /api/pos/transactions/:id/cancel     (POST)      │
│  /api/pos/transactions/:id/refund-request (POST)  │
│  /api/pos/transactions/:id/receipt    (GET)       │
│  /api/pos/dashboard          (GET)                │
│  /api/pos/devices/:id/heartbeat   (POST)          │
│  /api/pos/devices/:id/status      (GET)           │
│  /api/pos/devices/:id/config      (GET)           │
│  /api/pos/shifts/*               (GET, POST)      │
│                                                   │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼  Prisma Client
┌──────────────────────────────────────────────────┐
│               SQLite Database                     │
│                                                   │
│  Merchant ─┬─ Branch ─┬─ Staff                   │
│            │          ├─ PosDevice                │
│            │          ├─ Shift                    │
│            │          └─ Transaction ── Receipt   │
│            └─ PosDeviceEvent                      │
│                                                   │
└──────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Full-stack React framework with API routes |
| **Language** | TypeScript 5 | Strict typing throughout |
| **Styling** | Tailwind CSS 4 | Utility-first CSS with mobile-first approach |
| **UI Components** | shadcn/ui (New York) | Pre-built accessible components |
| **Icons** | Lucide React | Consistent icon library |
| **Animations** | Framer Motion | Smooth screen transitions and micro-interactions |
| **State** | Zustand | Lightweight client-side state management |
| **Database** | Prisma ORM + SQLite | Type-safe database access |
| **Fonts** | Geist Sans / Geist Mono | Clean, modern typography |

---

## Getting Started

### Prerequisites

- Node.js 20.9+ or Bun runtime
- npm or bun package manager

### Installation

```bash
# Install dependencies
bun install

# Set up the database
bun run db:push

# Seed with demo data
bunx prisma db seed

# Start the development server
bun run dev
```

The app runs on **http://localhost:3000**.

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=file:./db/custom.db
```

### Useful Commands

| Command | Description |
|---|---|
| `bun run dev` | Start development server on port 3000 |
| `bun run lint` | Run ESLint to check code quality |
| `bun run db:push` | Push Prisma schema to database |
| `bun run db:generate` | Generate Prisma client |
| `bun run db:migrate` | Run database migrations |
| `bun run db:reset` | Reset database and re-seed |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (mobile shell, fonts, toaster)
│   ├── page.tsx                # Main entry — screen router
│   ├── globals.css             # Global styles, mobile CSS, safe areas
│   └── api/
│       └── pos/
│           ├── merchant/login/     # Merchant auth + device binding
│           ├── auth/login/         # Staff PIN verification
│           ├── auth/logout/        # Staff session end
│           ├── device/
│           │   ├── bind/           # Confirm device binding
│           │   ├── approve/        # Admin approves device
│           │   └── approval-status/# Check approval status (polling)
│           ├── transactions/
│           │   ├── route.ts        # List / Create transactions
│           │   └── [transactionId]/
│           │       ├── route.ts            # Get transaction detail
│           │       ├── finalize/           # Mark txn approved/declined/failed
│           │       ├── cancel/             # Cancel pending transaction
│           │       ├── refund-request/     # Submit refund request
│           │       └── receipt/            # Get receipt data
│           ├── dashboard/          # Today's stats
│           ├── devices/[deviceId]/
│           │   ├── heartbeat/      # Device heartbeat ping
│           │   ├── status/         # Device status check
│           │   └── config/         # Device configuration
│           └── shifts/             # Shift management
├── components/
│   ├── pos/                        # All POS screen components
│   │   ├── splash-screen.tsx
│   │   ├── device-check-screen.tsx
│   │   ├── merchant-login-screen.tsx
│   │   ├── device-binding-screen.tsx
│   │   ├── awaiting-approval-screen.tsx
│   │   ├── home-screen.tsx         # Main POS terminal
│   │   ├── awaiting-card-screen.tsx
│   │   ├── result-screens.tsx      # Approved/Declined/Failed/Pending
│   │   ├── receipt-screen.tsx
│   │   ├── transaction-history-screen.tsx
│   │   ├── transaction-detail-screen.tsx
│   │   ├── refund-request-screen.tsx
│   │   ├── device-settings-screen.tsx
│   │   └── support-screen.tsx
│   └── ui/                         # shadcn/ui components
├── hooks/
│   ├── use-mobile.ts               # Mobile breakpoint hook
│   └── use-toast.ts                # Toast notification hook
├── lib/
│   ├── pos-store.ts                # Zustand store + utility functions
│   ├── device-detection.ts         # NFC/chip/swipe capability detection
│   ├── db.ts                       # Prisma client singleton
│   └── utils.ts                    # General utilities (cn helper)
prisma/
├── schema.prisma                   # Database schema (8 models)
└── seed.ts                         # Demo data seeder
```

---

## Database Schema

### Entity Relationship Diagram

```
Merchant (1) ──── (N) Branch
    │                   │
    │                   ├── (N) Staff
    │                   ├── (N) PosDevice
    │                   ├── (N) Shift
    │                   └── (N) Transaction
    │
    ├── (N) PosDevice
    │       └── (N) PosDeviceEvent
    │
    └── (N) PosSession

Staff (1) ──── (N) Transaction
       ──── (N) Shift
       ──── (N) PosSession
       ──── (N) PosDeviceEvent

Transaction (1) ──── (0..1) Receipt
```

### Models

| Model | Key Fields | Description |
|---|---|---|
| **Merchant** | `tradingName`, `merchantCode`, `email`, `phone`, `status` | Business account that owns POS devices |
| **Branch** | `name`, `address`, `merchantId` | Physical location of the POS |
| **Staff** | `name`, `phone`, `pin`, `role` (cashier/manager/admin), `posPermission` | Employee who operates the POS |
| **PosDevice** | `deviceType`, `nfcAvailable`, `chipAvailable`, `swipeAvailable`, `approvalStatus`, `status`, `integrityStatus` | Bound device with capabilities |
| **PosSession** | `staffId`, `deviceId`, `token`, `startedAt`, `endedAt` | Active staff session on a device |
| **Transaction** | `amount` (kobo), `currency`, `paymentMethod`, `status`, `reference`, `authCode`, `cardScheme`, `maskedPan` | Payment record with full card details |
| **Receipt** | `receiptNumber`, `deliveryMethod`, `receiptUrl` | Printable receipt linked to transaction |
| **Shift** | `startedAt`, `endedAt`, `totalApprovedAmount`, `approvedCount` | Staff shift with daily totals |
| **PosDeviceEvent** | `eventType`, `metadata` (JSON) | Audit trail for all device actions |

### Transaction Status Lifecycle

```
created ──► awaiting_card ──► card_detected ──► reading_card ──► authenticating
                                                                     │
                                              ┌────────────────────┼────────────────────┐
                                              ▼                    ▼                    ▼
                                          approved             declined              failed
                                              │                                         │
                                              ▼                                         ▼
                                           settled                              cancelled/timeout
                                              │
                                              ▼
                                          refunded ──► disputed ──► chargeback
```

### Payment Methods

| Method Code | Label | Device Type |
|---|---|---|
| `phone_pos_contactless` | Contactless (Phone NFC) | Phone POS |
| `terminal_contactless` | Contactless Card | Physical Terminal |
| `terminal_chip` | Chip & PIN | Physical Terminal |
| `terminal_swipe` | Magnetic Stripe | Physical Terminal |
| `faya_nfc` | Faya Wallet | Faya NFC Device |

---

## API Reference

### Merchant Login
```
POST /api/pos/merchant/login
Body: { email, password, deviceCapabilities, systemInfo }
Response: { merchant, branch, device }
```
Authenticates the merchant, creates/updates the device record with detected capabilities, and returns the device's current approval status. Device starts as `pending` unless already approved.

### Staff PIN Login
```
POST /api/pos/auth/login
Body: { pin }
Response: { staff, merchant, branch, device, session }
```
Verifies staff by their unique PIN. Creates a new `PosSession`, ends any previous active session on the device (allows seamless staff switching). Returns staff details with role permissions.

### Device Binding
```
POST /api/pos/device/bind
Body: { deviceId, merchantId, branchId }
Response: { approvalStatus, message }
```
Confirms the device binding after merchant login. Records the binding event with all device capabilities. Device remains pending until admin approves.

### Device Approval
```
POST /api/pos/device/approve
Body: { deviceId }
Response: { approvalStatus, status, message }
```
Approves a pending device. Updates `approvalStatus` to `approved` and `status` to `active`. Creates an audit event. In production, this requires admin authentication.

### Check Approval Status
```
GET /api/pos/device/approval-status?deviceId=xxx
Response: { approvalStatus, status }
```
Polled by the Awaiting Approval screen every 10 seconds.

### Create Transaction
```
POST /api/pos/transactions
Body: { merchantId, branchId, staffId, deviceId, amount, currency, description, paymentMethod }
Response: Transaction object with reference
```
Creates a new transaction with `created` status. Generates a unique reference (`FAYA-2026-XXXXXX`) and idempotency key. Validates staff and device are active.

### Finalize Transaction
```
POST /api/pos/transactions/:id/finalize
Body: { status, authCode, responseCode, cardScheme, maskedPan, ... }
Response: Updated transaction
```
Updates the transaction with the final payment result (approved/declined/failed) and card details.

### Cancel Transaction
```
POST /api/pos/transactions/:id/cancel
Body: { reason }
```
Cancels a pending transaction.

### Request Refund
```
POST /api/pos/transactions/:id/refund-request
Body: { amount?, reason, staffId }
```
Submits a refund request. Can be full or partial. Requires a reason. Sent to the merchant for review.

### Dashboard Stats
```
GET /api/pos/dashboard?staffId=xxx&branchId=xxx
Response: { totalApprovedAmount, approvedCount, declinedCount, paymentMethodBreakdown }
```

---

## State Management

The app uses a single Zustand store (`pos-store.ts`) that manages:

| State | Type | Description |
|---|---|---|
| `currentScreen` | `Screen` (18 screen types) | Active screen for the router |
| `previousScreen` | `Screen \| null` | For back navigation |
| `merchant` | `MerchantInfo \| null` | Bound merchant account |
| `branch` | `BranchInfo \| null` | Merchant's branch |
| `device` | `DeviceInfo \| null` | This POS device with capabilities |
| `staff` | `StaffInfo \| null` | Currently authenticated staff (null = no staff) |
| `pinPurpose` | `'collect-payment' \| 'refund' \| 'override'` | Why the PIN is being entered |
| `paymentFlow` | `PaymentFlowState` | Amount, currency, method, current transaction |
| `deviceBound` | `boolean` | Whether merchant has bound this device |
| `deviceApproved` | `boolean` | Whether admin has approved this device |
| `dashboardStats` | `DashboardStats \| null` | Today's payment stats |
| `selectedTransaction` | `TransactionInfo \| null` | For detail/refund views |

### Key Actions

- **`navigate(screen)`** — Change the active screen with history
- **`goBack()`** — Navigate to previous screen
- **`setStaff(staff)`** — Set or clear the current staff member
- **`merchantLogout()`** — Full reset: unbinds device, clears all state, goes to merchant login
- **`resetPaymentFlow()`** — Clears amount, transaction, and payment state

### Utility Functions

- **`formatAmount(kobo, currency)`** — Converts kobo to formatted currency string (e.g., `₦1,500.00`)
- **`formatDate(iso)`** — Human-readable date/time
- **`getPaymentMethodLabel(code)`** — Maps method codes to readable labels
- **`getStatusColor(status)`** — Returns Tailwind classes for transaction status badges
- **`getRoleLabel(role)`** / **`getRoleColor(role)`** — Staff role display helpers

---

## Screens

### 1. Splash Screen
Branded loading screen with Faya POS logo. Auto-navigates to Device Check after 2.5 seconds.

### 2. Device Check Screen
Runs real system checks in sequence:
- App version compatibility
- Network connectivity (online/offline)
- NFC hardware availability
- NFC enabled state
- Chip reader (physical terminals only)
- Swipe reader (physical terminals only)
- Device integrity
- Payment capability summary

**On failure**: Shows a blocked state with "Retry Device Check" button. Merchant **cannot** login.

### 3. Merchant Login Screen
Email/phone + password form. Detects device capabilities and sends them with the login request. Displays the detected device type and supported payment methods.

### 4. Device Binding Screen
Shows a summary of:
- Merchant account (name, MID)
- Device info (name, type, approval status)
- Device capabilities (NFC, chip, swipe, network, integrity)
- Supported payment methods as badges

Two paths:
- **Already approved** → "Bind Device & Start POS" → goes to Home
- **Needs approval** → "Bind Device & Request Approval" → goes to Awaiting Approval

### 5. Awaiting Approval Screen
Shows a waiting state with:
- Approval status badge
- Auto-polling indicator (checks every 10 seconds)
- All device capabilities that were sent to admin
- Manual "Check Now" button
- Demo "Approve This Device" button (simulates admin action)
- "Unbind & Logout" option

Three states:
- **Pending** — Waiting, auto-checking
- **Approved** — Celebration animation, auto-redirect to Home
- **Rejected** — Error state, can only go back to login

### 6. Home Screen (POS Terminal)
The main POS interface:
- **Top bar**: Merchant name, branch, staff indicator (tappable), WiFi/NFC status
- **Stats strip**: Today's approved amount, count, declined count
- **Amount display**: Large ₦ amount with optional description
- **Numpad**: 3-column grid with 0-9, decimal, delete
- **Pay button**: Creates transaction, goes to Awaiting Card
- **Bottom nav**: History, Device, Help

### 7. Staff PIN Modal
Slides up from bottom when:
- Staff taps "Pay" without being logged in (purpose: `collect-payment`)
- Staff taps the staff name in the header (purpose: `switch`)
- Refund requires manager permission (purpose: `refund`)

Features:
- 6-dot PIN indicator
- Mini numpad (0-9 + Del)
- Contextual title and subtitle based on purpose
- Override mode: entering a new PIN replaces the current staff

### 8. Awaiting Card Screen
Dark themed full-screen with NFC animation rings:
- **Waiting**: Pulsing NFC rings, "Tap Card or Phone"
- **Detected**: Card detected animation
- **Reading**: Processing spinner
- 60-second countdown timer
- Cancel button

Auto-simulates card detection after 3 seconds (demo mode).

### 9. Result Screens
- **Approved**: Green success screen with transaction details, "View Receipt" and "New Payment" buttons
- **Declined**: Red screen with decline reason, "Try Again" button
- **Failed**: Amber screen with error details, "Retry" and "Contact Support" buttons
- **Pending**: Clock spinner with "Refresh Status" and "Cancel" buttons

### 10. Receipt Screen
Full receipt card showing:
- Merchant header (name, branch, MID)
- Status badge and amount
- Transaction reference, date, payment method
- Card details (scheme, masked PAN, auth code)
- Cashier and terminal info
- Receipt number
- Action buttons: Print, Share, Email, Download, Copy Reference

### 11. Transaction History Screen
Searchable, filterable list of transactions:
- Search by reference, card number, description
- Filter tabs: All, Approved, Declined, Failed, Refunded
- Each row shows: status icon, amount, reference, time, payment method
- Pull-to-refresh

### 12. Transaction Detail Screen
Full transaction breakdown in cards:
- Status with amount
- Transaction info (ID, reference, dates)
- Payment info (method, card scheme, PAN, auth codes)
- Financial info (gross, fee, net)
- Receipt info
- Actions: View Receipt, Request Refund

### 13. Refund Request Screen
Form to submit a refund:
- Full or partial refund toggle
- Partial amount input
- Required reason field
- Submit with loading state
- Success confirmation

### 14. Device Settings Screen
Device management view:
- Device info (name, type, status, IDs)
- Approval status badge with explanation
- System info (manufacturer, model, OS, app version)
- Device capabilities checklist
- Actions: Sync Config, Run Device Check, Test NFC, Contact Support, Unbind Merchant

### 15. Support Screen
Help and support:
- Contact options (Call, Email, Live Chat)
- FAQ / Quick Help cards
- Faya POS Rules summary
- Device and merchant info footer

---

## Demo Credentials

### Merchant Account
| Field | Value |
|---|---|
| Email | `merchant@faya.pay` |
| Password | `faya2024` |

### Staff PINs
| Name | PIN | Role | Branch |
|---|---|---|---|
| Adebayo Okonkwo | `1234` | Cashier | Victoria Island |
| Chioma Nwosu | `5678` | Cashier | Ikeja |
| Emeka Okafor | `9012` | Manager | Victoria Island |
| Fatima Bello | `3456` | Admin | Victoria Island |
| Ngozi Adeyemi | `7890` | Cashier | Wuse (Abuja) |

### Pre-loaded Devices
| Name | Type | Approval | NFC | Chip | Swipe |
|---|---|---|---|---|---|
| Terminal-VI-01 | Physical Terminal | Approved | ✅ | ✅ | ✅ |
| PhonePOS-IK-01 | Phone POS | Approved | ✅ | ❌ | ❌ |
| FayaNFC-VI-02 | Faya NFC | Approved | ✅ | ❌ | ❌ |
| Terminal-Wuse-01 | Physical Terminal | Approved | ✅ | ✅ | ✅ |
| PhonePOS-Pending | Phone POS | **Pending** | ✅ | ❌ | ❌ |

---

## Business Rules

### Payment Rules
1. **All card payments require online authorization** — No offline mode
2. **No QR, bank transfer, or cash payments** — Card/NFC only
3. **No manual card entry** — Must be tapped, inserted, or swiped
4. **No screenshot proof** — All transactions verified by processor
5. **Full PAN, CVV, and PIN are never stored** — PCI-DSS compliance

### Staff Permission Levels
| Action | Cashier | Manager | Admin |
|---|---|---|---|
| Process payments | ✅ | ✅ | ✅ |
| View transaction history | ✅ | ✅ | ✅ |
| Request refund | ❌ | ✅ | ✅ |
| Override current staff | ❌ | ✅ | ✅ |
| Device settings | ✅ (view) | ✅ | ✅ |
| Unbind merchant | ❌ | ❌ | ✅ |

### Device Rules
1. A phone POS only has NFC — no chip or swipe capability
2. A physical terminal has at least 2 of (NFC, chip, swipe)
3. Device check must pass before merchant can log in
4. A device is only fully bound after admin approves it
5. When binding, all device information and capabilities are sent to the admin
6. A merchant can have multiple approved devices

### Transaction Rules
1. Amounts are stored in **kobo** (smallest currency unit) — ₦1 = 100 kobo
2. Every transaction is tied to a specific staff member
3. All transactions and refunds are reported to the merchant
4. Transaction references follow format: `FAYA-2026-XXXXXX`
5. Refunds can be full or partial, but always require a reason

---

## Security Model

### Authentication Layers
```
Layer 1: Device Check
  └─► Hardware capabilities verified (NFC, network, integrity)

Layer 2: Merchant Login
  └─► Email/phone + password authentication
  └─► Device bound to merchant account
  └─► Admin must approve the device

Layer 3: Staff PIN
  └─► Unique PIN per staff member
  └─► PIN only required for actions (payment, refund, switch)
  └─► POS always visible — no lock screen
  └─► Staff sessions tracked in PosSession table
```

### Audit Trail
Every significant action creates a `PosDeviceEvent`:
- Device activated, approved, blocked
- Staff login, logout
- Transaction created, approved, declined, failed
- Receipt printed, shared
- Refund requested
- Device integrity failed
- NFC disabled
- Config sync failed
- App version blocked

### Data Protection
- Card numbers are stored as masked PAN only (`**** **** **** 1234`)
- CVV is never stored
- PIN is stored in plain text (demo only — production must hash)
- Staff sessions use UUID tokens
- Idempotency keys prevent duplicate transactions
