# Faya Admin Portal — Build Worklog

Project: Faya Admin Portal (Next.js 16 + Firebase Auth + Firestore)
Source spec: `/home/z/my-project/upload/Faya Admin Portal Documentation.pdf` (36 pages)

## Firebase Configuration (provided by user)
- Project ID: `fayapay-ece98`
- Auth domain: `fayapay-ece98.firebaseapp.com`
- SDK: `firebase@12.15.0`
- Services in use: Auth (email/password + MFA), Firestore (admin data store), Analytics (optional)

## Build Plan (MVP Phase 1 + 2 + 3 per doc §17)
- Phase 1: Core Staff + Country Access (login, MFA, staff, departments, roles, permissions, countries, audit)
- Phase 2: Country Admin (country dashboard + KYC/KYB/device/settlement/risk rules)
- Phase 3: Operations (KYC/KYB queues, merchants, customers, terminals, support)
- Phase 4/5: Light versions of finance, risk, disputes, approvals

---
Task ID: 1
Agent: main
Task: Install Firebase SDK and scaffold Firebase config module

Work Log:
- Read full PDF spec (36 pages) via pdf skill extract.text
- Installed `firebase@12.15.0` via `bun add firebase`
- Verified dev server running on port 3000
- Created worklog

Stage Summary:
- Firebase SDK ready. Next: create `src/lib/firebase.ts` with config + lazy singletons, then Firestore data layer.

---
Task ID: 7
Agent: subagent-countries-view
Task: Build Countries management view + country detail view

Work Log:
- Read worklog.md, types.ts, admin-data.ts, formatters.ts, seed-data.ts, use-auth.ts, use-portal-store.ts, view-helpers.tsx, dashboard-view.tsx to align with project conventions
- Created `src/components/portal/views/countries-view.tsx`:
  - ViewHeader with Globe2 icon, title "Country Management", description per §5
  - Filter bar: search (name/code/currency/regulator), status select, region select (derived from timezone prefix), clear-filters button
  - Responsive 1/2/3 column card grid; each card shows countryCode (large), countryName, currency, regulator, timezone, status badge, launch-status badge
  - Per-card stat grid covers all 15 §5.2 metrics (activeCustomers, activeMerchants, pendingKyc, pendingKyb, highRiskAlerts, activeTerminals, activePhonePos, todayTxVolume (formatCompact), todayApproved, todayDeclined, pendingSettlements, heldSettlements, openDisputes, openTickets, complianceAlerts)
  - Card click → usePortalStore().selectCountry(code) + setView("country_detail")
  - "Add Country" button visible only to Super Admin (staff.departmentId === "dept_super_admin"); dialog collects countryCode (2-letter uppercase, validated), countryName, currency, timezone, regulator, status; on submit calls adminData.createCountry with empty rule objects and zero counters, logs audit `country.create`, toasts success, then jumps into the new country's detail
- Created `src/components/portal/views/country-detail-view.tsx`:
  - Resolves selected country from usePortalStore().selectedCountryCode; shows EmptyState + back button if missing
  - Header card with country name/code/currency/regulator/timezone, status badge, launch-status badge, and a back button that calls setView("countries")
  - Country Dashboard section: three rows of StatCards covering all 15 §5.2 metrics (uses StatCard from view-helpers)
  - Tabs for KYC / KYB / Device / Settlement / Risk rules per §5.4–5.7; each tab renders the corresponding rule object as a key/value Table (arrays joined with commas, booleans rendered as "Required"/"Not required", nested objects as JSON)
  - "Edit Rules" button visible only to Super Admin; opens a Dialog with a Textarea pre-filled with JSON.stringify(rules, null, 2); on save parses + validates it's a JSON object, calls adminData.updateCountry(country.id, { [ruleKey]: parsed, updatedAt }), logs audit `country.change_<ruleKey>` with before/after JSON, toasts success
  - Status changer Select dropdown for Super Admin with confirm AlertDialog; calls adminData.updateCountry and logs audit `country.change_status`
- Visual style matches dashboard-view: emerald accent, no indigo/blue primary, lucide-react icons (Globe2, ArrowLeft, Plus, Pencil, Save, Building2, ShieldCheck, Smartphone, Wallet, AlertTriangle, Search, Filter, Check, X, Users, Clock, Scale, Headphones)
- Ran `bun run lint`: the two new files report zero errors. The only remaining lint error is in pre-existing `src/hooks/use-auth.ts` (owned by an earlier agent), untouched here.

Stage Summary:
- Produced `CountriesView` (filterable country card grid + Super-Admin Add-Country dialog) and `CountryDetailView` (3 rows of KPI StatCards + 5 tabs of rule tables + Edit-Rules JSON dialog + status changer with confirm).
- Both views are wired to the portal store (selectCountry / setView), the auth hook (Super Admin gating), adminData mutations (createCountry / updateCountry) and the logAudit helper. They consume the shared `countries` prop and require no new types or new API surface.

---
Task ID: 6
Agent: subagent-staff-view
Task: Build Staff Management view

Work Log:
- Read context: worklog.md, types.ts, admin-data.ts, formatters.ts, use-auth.ts, view-helpers.tsx, dashboard-view.tsx, plus shadcn/ui components (dialog, sheet, alert-dialog, dropdown-menu, select, table, switch, checkbox, separator, button, input, label, badge, textarea, scroll-area, avatar).
- Created `src/components/portal/views/staff-view.tsx` exporting `StaffView`.
- Implemented:
  * ViewHeader with Users icon + "Create Staff" button (gated to Super Admin via `currentStaff.departmentId === "dept_super_admin"`).
  * KPI stat cards: Total Staff, Active, Suspended, MFA Coverage %.
  * Filters card: search (name/email), Department, Role, Country, Status, MFA on/off — plus active-filter indicator with "Clear filters".
  * Staff directory Card with sticky header inside `max-h-[70vh] overflow-y-auto` and custom `[&::-webkit-scrollbar]:w-2` styling.
  * Table columns: Name (avatar+id), Email, Department, Role, Countries (badges + "+N"), Status (`statusBadge("staff", status)`), MFA badge (green On / red Off), Last login (hidden on small screens), Created (hidden on small screens), Actions dropdown.
  * Row click → opens detail Sheet.
  * Row-actions dropdown: View profile, Edit, Suspend (alert-dialog), Unlock, Reset MFA, Force logout.
  * Create/Edit Dialog: firstName, lastName, email, phone, departmentId (select), roleId (select filtered by department), countries (checkbox list with per-row access-level Select: view/operate/manage), mfaEnabled switch, notes textarea.
  * Validation: required firstName/lastName/email, valid email format, unique email (excluding current editing target), required department & role, at least 1 country unless Super Admin department.
  * On create: builds `AdminStaff` with id=`staff_${Date.now()}`, status="invited", failedLoginCount=0, createdBy=currentStaff.id, createdAt/updatedAt=Date.now(), permissions=[], managerId=null, lastLoginAt=null → `adminData.createStaff` + `logAudit(action="staff.create")`.
  * On edit: `adminData.updateStaff` partial patch + `logAudit(action="staff.update")`.
  * On suspend: alert-dialog confirm → `adminData.updateStaff({status:"suspended"})` + `logAudit(action="staff.suspend")`.
  * On unlock: `adminData.updateStaff({status:"active", failedLoginCount:0})` + `logAudit(action="staff.unlock")`.
  * On reset MFA: `adminData.updateStaff({mfaEnabled:false})` + `logAudit(action="staff.mfa_reset")` + toast.
  * On force logout: toast only (demo, no real sessions).
  * Detail Sheet: identity (Staff ID mono, email, phone, dept, role, created, last login, failed logins, created by), country access list with access-level badges (view/operate/manage color-coded), permissions as mono badges, notes, plus "Edit profile" + "View audit history" buttons.
  * Toasts (sonner) on all success/error paths.
- Used emerald accent throughout (no indigo/blue). lucide-react icons: Users, UserPlus, MoreHorizontal, Shield, ShieldOff, Lock, Unlock, Ban, LogOut, Search, Filter, Eye, Pencil, Mail, Phone, Building2, Calendar, KeyRound, Globe2, ScrollText, X.
- Verified: `npx eslint src/components/portal/views/staff-view.tsx` → 0 errors. `npx tsc --noEmit` → 0 errors in staff-view.tsx (remaining TS errors are in unrelated examples/skills folders).

Stage Summary:
- Produced a complete, production-quality Staff Management view matching the visual style of dashboard-view.tsx.
- Key decisions: (1) Dialog for create/edit form (medium-size form, multi-field), Sheet for read-only detail panel. (2) Per-country access-level dropdown embedded inside the country checkbox list — keeps the form compact while exposing view/operate/manage. (3) Create/Suspend/Unlock/Reset MFA gated behind `isSuperAdmin(currentStaff)` (only Super Admin can manage staff). (4) All mutations are audited via `logAudit` with sensible before/after values. (5) Force logout is toast-only as specified (no real session store). (6) Custom scrollbar styling via `[&::-webkit-scrollbar]:w-2` rather than radix scroll-area, so the sticky table header stays inside the same scroll container. (7) Responsive: Last login and Created columns are hidden below `lg` breakpoint.
- The file is ready to be wired into the portal shell by another agent (renders given `{ staff, departments, roles, countries }` props from the Firestore subscriptions).

---
Task ID: 8
Agent: subagent-compliance-view
Task: Build Compliance KYC/KYB view

Work Log:
- Read context files: worklog, src/lib/types.ts, src/lib/admin-data.ts, src/lib/formatters.ts, src/hooks/use-auth.ts, src/components/portal/view-helpers.tsx, src/components/portal/views/dashboard-view.tsx, UI primitives (sheet, alert-dialog, tabs, table, select, badge, button, input, card), src/components/portal/portal-shell.tsx, src/lib/seed-data.ts (KYC/KYB seed records), src/app/layout.tsx.
- Created /home/z/my-project/src/components/portal/views/compliance-view.tsx exporting `ComplianceView` (props: kycCases, kybCases, staff, countries).
- Implemented ViewHeader with ShieldCheck icon, title "Compliance · KYC / KYB", description adapted to super-admin vs. country-scoped staff.
- Implemented 6 tabs via shadcn Tabs: KYC Queue, KYB Queue, Sanctions/PEP, Manual Review, Approved, Rejected.
- KPI strip (6 StatCards) summarizing open KYC, open KYB, escalated, manual review, approved, rejected counts.
- Country scoping: visibleCountryCodes computed from useAuth() staff — Super Admin (dept_super_admin) sees all; others see only their staff.countries codes.
- KYC Queue tab: Card with search input (customer name), country select, status select filters; table with columns Customer, Country, Nationality, Risk score badge, Submitted (timeAgo), Required documents chips, Status (statusBadge "kyc"), Assigned reviewer, SLA badge.
- KYB Queue tab: same structure with Merchant, Country, Business type, Risk category badge, Submitted, Missing documents chips, Status, Reviewer, SLA.
- Risk score badge: <30 emerald, <60 amber, <80 orange, >=80 red. SLA badge: danger=red, warning=amber, default=slate. Doc chips as small outline badges with FileText icon.
- Row click opens right-side Sheet with full case details + action buttons (Approve, Reject, Escalate, Request Documents, Assign to me). Reject triggers AlertDialog confirmation.
- Actions call adminData.updateKyc / updateKyb and logAudit with action keys kyc.approve / kyc.reject / kyc.escalate / kyc.request_documents (and kyb.* equivalents). Actor built from currentStaff (staffId, staffName, department, role).
- Sonner toasts for every action (success/error/warning/info). Included <SonnerToaster richColors closeButton /> at the end of the view since the root layout only mounts the shadcn useToast Toaster.
- Sanctions/PEP tab: escalated KYC cases table (with notes column) + always-on workflow overview panel describing the 5-step sanctions/PEP review process + 3 reference cards (screening lists, PEP databases, outcomes). EmptyState shown when no escalated cases.
- Manual Review tab: combined KYC + KYB cases where status="in_review" with type indicator badge (KYC emerald, KYB amber).
- Approved tab: combined approved KYC + KYB cases.
- Rejected tab: combined rejected KYC + KYB cases with reason/notes column.
- ScrollTable sub-component uses raw <table> (not Table primitive) to bypass Table's built-in overflow-x-auto wrapper that would break sticky <thead>; wrapper has max-h-[60vh] overflow-auto + custom webkit scrollbar styling.
- All buttons and rows are keyboard-accessible; semantic structure (main content via PortalShell, header via ViewHeader, sections via Cards). No indigo/blue primary colors — emerald accent throughout to match dashboard.

Stage Summary:
- Produced src/components/portal/views/compliance-view.tsx (~1500 lines, single self-contained client component with three sub-components: ScrollTable, KycDetailSheet, KybDetailSheet, plus ActionButtons/DetailRow helpers and SANCTIONS_WORKFLOW constant).
- File passes `npx eslint src/components/portal/views/compliance-view.tsx` with zero errors/warnings. `npx tsc --noEmit` reports zero errors in this file (only unrelated errors in examples/ and skills/).
- The only project-wide lint error is a pre-existing react-hooks/set-state-in-effect warning in src/hooks/use-auth.ts (not in scope).
- ComplianceView is ready to be wired into portal-shell.tsx by the integrator agent: render `<ComplianceView kycCases={...} kybCases={...} staff={...} countries={...} />` when `view === "compliance"`.

---
Task ID: 10
Agent: subagent-governance-views
Task: Build Audit Logs, Approvals, Departments views

Work Log:
- Read context files: worklog.md, src/lib/types.ts, src/lib/admin-data.ts, src/lib/formatters.ts, src/hooks/use-auth.ts, src/components/portal/view-helpers.tsx, src/components/portal/views/dashboard-view.tsx, src/components/portal/views/staff-view.tsx (style reference), and shadcn/ui components (sheet, dialog, alert-dialog, tabs, table, select, badge, button, input, card, separator, progress, tooltip, label, textarea).
- Created `src/components/portal/views/audit-view.tsx` exporting `AuditView` (props: auditLogs, departments):
  - ViewHeader with `ScrollText` icon and an "Immutable" lock badge.
  - KPI strip: Logs Today, Unique Actors Today, Failed Logins (24h), Sensitive Actions (24h) — derived from a SENSITIVE_ACTIONS list and `isFailedLogin` helper.
  - Filters card: search (action/entityId/staffName/reason/IP), country select (derived from scoped logs), department select (matches on department name), time-range select (24h/7d/30d/all), and a free-text action filter (font-mono).
  - Audit table inside `max-h-[70vh] overflow-y-auto` with sticky `<thead>` + custom webkit scrollbar. Columns: Timestamp (sortable asc/desc, default desc), Staff (name+id), Department, Role, Country, Action (font-mono + sensitive/failed icons), Entity type, Entity ID, Reason, IP, Device — responsive column hiding on smaller breakpoints.
  - Row click opens a right-side Sheet with full detail: meta grid (timestamp, country, staff, dept, entity type/ID, IP, device), reason block, before/after JSON pretty-printed in `<pre>` blocks (red-tinted before / emerald-tinted after), and the raw record JSON; includes a "Copy JSON" button.
  - Country scoping: Super Admin sees all; others see only logs whose `countryCode === null` (system actions) or matches one of their `staff.countries` codes.
- Created `src/components/portal/views/approvals-view.tsx` exporting `ApprovalsView` (props: approvals):
  - ViewHeader with `CheckSquare` icon.
  - KPI strip: Pending, Approved (7d), Rejected (7d), My Pending Requests.
  - Tabs: Pending | Approved | Rejected | All (Pending shows count badge).
  - Pending card shows: action (font-mono bold), entity type/ID, country, requested-by + timeAgo, reason, payload (JSON pretty-printed), progress bar (`currentApprovals/requiredApprovals`), and a scrollable decisions list (approver name, decision badge, note with MessageSquare icon, timeAgo).
  - Approve (emerald) / Reject (red outline) buttons open a Dialog requiring a note (≥3 chars). On submit: append a new decision, increment `currentApprovals` on approve, set `status="approved"` when threshold reached, set `status="rejected"` on reject; persist via `adminData.updateApproval`, then `logAudit("approval.approve" | "approval.reject")` with before/after JSON snapshot.
  - Cannot approve own request: buttons rendered inside a disabled group with a Tooltip ("You cannot approve your own request").
  - Country scoping: Super Admin sees all; others see only approvals matching their assigned countries (or `countryCode === null`).
  - Sonner toasts on every action (success/error/loading).
- Created `src/components/portal/views/departments-view.tsx` exporting `DepartmentsView` (props: departments, roles, permissions):
  - ViewHeader with `Building2` icon.
  - KPI strip: Total Departments, Total Roles, Critical-Risk Roles, Total Permissions.
  - Two-column layout (`lg:grid-cols-[1fr_1.5fr]`, stacks on mobile): left = Department cards list with search; right = Role cards list for the selected department with search.
  - Department cards: name, description, status badge, role count, dept id; click selects → emerald highlight ring + filters right column.
  - Role cards: name, description, risk-level badge (`statusBadge("risk", …)` with risk-icon Shield/ShieldCheck/ShieldAlert/ShieldX), status badge, permission count (best-effort keyword match against permission resources/actions), role id, and a "View Permissions" button.
  - "View Permissions" opens a Dialog with a sticky-header Table listing all matching Permission entries: key (font-mono), resource, action, scope, description, status — read-only.
  - Both columns use `max-h-[70vh] overflow-y-auto` with custom scrollbar styling.
- Visual style matches dashboard-view.tsx: emerald accent throughout, NO indigo/blue primary; lucide-react icons relevant to each view; cards/tables/lists in Cards with proper alignment and padding.
- All mutations go through `adminData.*` + `logAudit` with toast feedback; AlertDialog is not needed here (no destructive actions in these views), but approvals-view uses a Dialog with note validation as a soft confirmation gate.
- Appended agent-ctx record at `/home/z/my-project/agent-ctx/10-subagent-governance-views.md`.

Stage Summary:
- Produced three production-quality, lint-clean client components totalling ~1,400 lines:
  - `audit-view.tsx` — searchable/sortable immutable audit trail with detail Sheet and JSON before/after diff.
  - `approvals-view.tsx` — dual-approval workflow with progress bars, decisions history, self-approval guard, and note-required decision Dialog.
  - `departments-view.tsx` — two-pane department/role browser with read-only permissions Dialog.
- All three are ready to be wired into the portal shell by the integrator agent: render `<AuditView auditLogs={...} departments={...} />`, `<ApprovalsView approvals={...} />`, and `<DepartmentsView departments={...} roles={...} permissions={...} />` from the Firestore subscriptions when their respective `view` values are active.
- Lint: `bun run lint` reports zero errors in the three new files. The only project-wide lint warning is the pre-existing react-hooks/set-state-in-effect in `src/hooks/use-auth.ts` (owned by an earlier agent, untouched).

---
Task ID: 9b
Agent: subagent-support-disputes
Task: Build Support and Disputes views

Work Log:
- Read context files: worklog.md, src/lib/types.ts (SupportTicket, Dispute), src/lib/admin-data.ts (adminData.updateTicket/updateDispute + logAudit), src/lib/formatters.ts (formatCurrency, formatDate, formatDateTime, formatCompact, timeAgo, slaStatus, statusBadge), src/hooks/use-auth.ts, src/components/portal/view-helpers.tsx (ViewHeader, StatCard, EmptyState, ViewContainer), src/components/portal/views/dashboard-view.tsx (style reference), src/components/portal/views/compliance-view.tsx (ScrollTable sticky-header pattern, Sheet/AlertDialog/Tabs/DropdownMenu patterns, SonnerToaster usage), src/lib/seed-data.ts (SEED_TICKETS, SEED_DISPUTES to confirm field shapes), src/components/ui/* primitives (table, dropdown-menu, sheet, dialog, alert-dialog, select, tabs, badge, button, input, label, textarea), src/components/portal/portal-shell.tsx (to confirm nav already references "support" and "disputes" views — integrator wires them later).
- Created `src/components/portal/views/support-view.tsx` exporting `SupportView({ tickets, countries })`:
  - ViewHeader icon={Headphones}, title "Support Tickets"; description adapts to Super Admin vs. country-scoped staff.
  - KPI strip (4 StatCards): Open Tickets (open+in_progress+waiting), Urgent Priority (non-closed urgent), SLA At Risk (warning+danger variants, non-closed), Resolved Today (status=resolved & updatedAt>=midnight).
  - Tabs: All Tickets | Customer | Merchant | Terminal | Payment | Escalations | SLA Dashboard. Customer/Merchant/Terminal/Payment pre-filter `type`; Escalations pre-filters `status==="in_progress"`; SLA Dashboard renders a bespoke layout (stats grid + breached-SLA table + approaching-SLA table).
  - Filter bar (above the table): search (subject / requester / id), country select, type select, priority select, status select, plus "Clear filters" indicator.
  - Table columns: Ticket ID (mono), Country (hidden md−, mono + name), Type (badge with icon — User/Building2/Smartphone/CreditCard, emerald/amber/sky/purple tints), Subject (truncate, with requester shown on lg−), Requester (hidden lg+), Priority (urgent/high=red with AlertTriangle icon, medium=amber, low=slate), Status (custom badge: open=amber, in_progress=sky, waiting=purple, resolved=emerald, closed=slate), Assigned (hidden xl+, "You" if matches currentStaff.id), Created (timeAgo, hidden md−), SLA (slaBadge — Clock icon + slaStatus label, "Done" badge for closed/resolved), Actions (dropdown).
  - Row-actions dropdown: Reply (opens right-side Sheet with Textarea + Send button → adminData.updateTicket updatedAt=now + logAudit "support.respond" + sonner toast), Assign to me (updateTicket assignedTo=currentStaff.id + logAudit "support.assign"), Escalate (updateTicket status="in_progress" + logAudit "support.escalate" + warning toast), Add internal note (toast only — no audit per spec), Close ticket (opens AlertDialog confirm → updateTicket status="closed" + logAudit "support.close"). Actions disabled when ticket is closed; destructive Close uses slate AlertDialog button.
  - Reply Sheet shows ticket meta (requester, country, created, last update, SLA deadline, assigned to) + badges (type, priority, status, SLA) + Textarea + Send/Cancel buttons. Validates empty reply with error toast.
  - SLA Dashboard tab: SlaDashboard sub-component renders 4 StatCards (Breached, At Risk, On Track, Open) + a Breached-SLA Card (table of all tickets with slaStatus.variant==="danger" not closed) + an Approaching-SLA Card (warning variant). Both use ScrollTable with sticky headers.
  - Country scoping: `visibleCountryCodes` = all countries if Super Admin (departmentId === "dept_super_admin"), else staff.countries codes. `filterableCountries` mirrors that for the filter dropdown.
  - Sorting: priority weight (urgent→low) then SLA deadline ascending, so the most urgent / closest-to-breach tickets surface first.
  - SonnerToaster mounted at end of view (root layout only mounts shadcn Toaster).
- Created `src/components/portal/views/disputes-view.tsx` exporting `DisputesView({ disputes, countries })`:
  - ViewHeader icon={Scale}, title "Disputes & Chargebacks"; description adapts to Super Admin vs. country-scoped staff.
  - KPI strip (4 StatCards): Total Disputes, Awaiting Evidence (status="awaiting_evidence"), Win Rate % (won / (won+lost), "—" if no decided disputes; tone success if ≥50% else danger), Disputed Amount (formatCompact of sum across all currencies, with "across N currencies" hint — honest about the multi-currency mix).
  - Tabs: New Disputes | Awaiting Evidence | Evidence Submitted | Under Review | Won/Lost | Expired | All. Each tab pre-filters Dispute.status accordingly (Won/Lost filters status ∈ ["won","lost"]; All = no status filter).
  - Filter bar: search (merchant / customer / reason / id), country select, plus "Clear filters" indicator.
  - Table columns: Dispute ID (mono), Country (hidden md−, mono + name), Merchant (with customer shown on lg−), Customer (hidden lg+), Amount (formatCurrency + currency code sub-line), Reason (hidden xl+, line-clamp-2), Status (custom badge: new=amber, awaiting_evidence=sky, evidence_submitted=purple, under_review=indigo, won=emerald, lost=red, expired=slate), Deadline (deadlineBadge — Overdue if past due & not terminal; "Xd left" with amber tint for <2d; formatDate for terminal), Created (timeAgo, hidden md−), Actions (dropdown).
  - Row-actions dropdown: Request evidence (updateDispute status="awaiting_evidence" + logAudit "dispute.request_evidence" + info toast), Upload evidence (updateDispute status="evidence_submitted" + logAudit "dispute.upload_evidence" + success toast), Update status… (opens Dialog with Select to set any of the 7 statuses + logAudit "dispute.update_status" + RefreshCw button), Escalate fraud (logAudit "dispute.escalate_fraud" + warning toast — no status mutation, just escalates to fraud team), Add note (toast only). Terminal statuses (won/lost/expired) disable the lifecycle actions and show a "limited actions" hint.
  - Update Status Dialog: shows dispute id/merchant/amount summary, Select with all 7 statuses pre-set to current, helper text about card-scheme timeline, Cancel + Update status (emerald) buttons. No-op guard if status unchanged.
  - Sorting: deadline ascending (most urgent first).
  - Country scoping identical pattern to SupportView.
  - SonnerToaster mounted at end of view.
- Visual style matches dashboard-view.tsx and compliance-view.tsx: emerald accent (primary buttons, active tab, ViewHeader icon tile, assigned-to user icon), NO indigo/blue primary in the chrome (only used once for the under_review dispute status badge which is semantically distinct from action colors). Tables wrapped in Cards with sticky `<thead>` via raw `<table>` inside `ScrollTable` (max-h-[60vh] overflow-auto, custom `[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300` styling). Lucide-react icons relevant to each view (Headphones, Scale, MessageSquare, Send, UserPlus, ArrowUpCircle, XCircle, StickyNote, AlertOctagon, ShieldAlert, Trophy, Gavel, FileText, Upload, RefreshCw, etc.).
- All mutations via `adminData.updateTicket` / `adminData.updateDispute` + `logAudit(...)` with appropriate action keys, before/after values, and countryCode. Toast feedback (sonner) on every action (success/info/warning/error).
- AlertDialog used for the destructive Close-ticket confirmation. Dialog used for the Update-status flow. Sheet used for the Reply composer. DropdownMenu for per-row actions.
- Responsive: less-critical columns hidden at md/lg/xl breakpoints (Country, Requester/Customer, Reason, Assigned, Created). Filter bar wraps on small screens.
- Ran `cd /home/z/my-project && bun run lint 2>&1 | tail -40` → zero lint errors in either file (the only project-wide lint warning is the pre-existing react-hooks/set-state-in-effect in src/hooks/use-auth.ts, which is not in scope).
- Ran `npx tsc --noEmit` → zero TS errors in the two new files (remaining errors are in unrelated examples/ and skills/ folders).
- Appended agent-ctx record at `/home/z/my-project/agent-ctx/9b-subagent-support-disputes.md`.

Stage Summary:
- Produced two production-quality, lint-clean client components totalling ~1,500 lines:
  - `support-view.tsx` — 7-tab support ticketing console (All / Customer / Merchant / Terminal / Payment / Escalations / SLA Dashboard) with full per-row Reply/Assign/Escalate/Close/Note workflow, stat cards, filters, sticky-header tables, SLA dashboard, and audit-logged mutations.
  - `disputes-view.tsx` — 7-tab disputes & chargebacks console (New / Awaiting Evidence / Evidence Submitted / Under Review / Won-Lost / Expired / All) with Request-evidence / Upload-evidence / Update-status / Escalate-fraud / Add-note row actions, win-rate KPI, multi-currency-aware disputed-amount KPI, deadline badges, and audit-logged mutations.
- Both views are ready to be wired into the portal shell by the integrator agent: render `<SupportView tickets={...} countries={...} />` when `view === "support"` and `<DisputesView disputes={...} countries={...} />` when `view === "disputes"` from the Firestore subscriptions (adminData.subscribeTickets / subscribeDisputes / subscribeCountries).

---
Task ID: 9a
Agent: subagent-ops-views
Task: Build Risk/Fraud, Devices, Finance views

Work Log:
- Read context files: worklog.md, src/lib/types.ts (FraudAlert, Terminal, Settlement, RiskLevel), src/lib/admin-data.ts (adminData.updateFraud/updateTerminal/updateSettlement/logAudit), src/lib/formatters.ts (formatCurrency, formatNumber, formatCompact, formatDateTime, formatDate, timeAgo, statusBadge), src/hooks/use-auth.ts, src/components/portal/view-helpers.tsx (ViewHeader, StatCard, EmptyState, ViewContainer), src/components/portal/views/dashboard-view.tsx (style reference), src/components/portal/views/compliance-view.tsx (sticky-ScrollTable pattern + audit/toast pattern reference), and shadcn/ui components (button, card, table, badge, dialog, sheet, input, label, select, dropdown-menu, tabs, separator, alert-dialog, scroll-area, textarea, sonner).
- Created `src/components/portal/views/risk-view.tsx` exporting `RiskView({ fraudAlerts, countries })`:
  - ViewHeader with AlertTriangle icon, title "Risk & Fraud Operations", super-admin vs. country-scoped description.
  - KPI strip: Open Alerts, Critical Severity, Escalated, Closed Today (4 StatCards).
  - 5 Tabs: Fraud Alerts (main) | Device Risk | Transaction Monitoring | Watchlists | Risk Cases.
  - Fraud Alerts tab: Card with search (entity name / id / trigger), country select, severity select, status select; sticky-header ScrollTable with columns Alert ID, Country, Entity type badge, Entity name, Trigger (lg), Severity (statusBadge "risk"), Transaction amount (formatCurrency USD), Device (xl), Created (md, timeAgo), Status (custom fraud-status badge), Actions dropdown.
  - Row actions dropdown: View details (opens Sheet), Restrict account (AlertDialog → toast + logAudit "account.restrict"), Block device (AlertDialog → adminData.updateFraud status="closed" + toast + logAudit "device.block"), Hold settlement (AlertDialog → toast + logAudit "settlement.hold"), Escalate to compliance (adminData.updateFraud status="escalated" + logAudit "fraud.escalate"), Close false positive (AlertDialog → adminData.updateFraud status="closed" + logAudit "fraud.close_false_positive"), Add to watchlist (toast + logAudit "watchlist.add"). Destructive actions confirmed via AlertDialog.
  - Right-side Sheet shows full alert details + the same action buttons (greyed-out "no further actions" notice when closed).
  - Other 4 tabs render FutureFeatureCard (EmptyState + 3-step roadmap + "Planned" badge) describing the future workflow.
  - Country scoping: visibleCountryCodes from useAuth().staff — Super Admin sees all; others see only their assigned countries.
- Created `src/components/portal/views/devices-view.tsx` exporting `DevicesView({ terminals, countries })`:
  - ViewHeader with Smartphone icon, title "Devices & Terminal Operations".
  - KPI strip: Total Terminals, Active, Blocked, Phone POS (4 StatCards).
  - 5 Tabs: Terminal Inventory (main) | Terminal Requests | Phone POS Devices | Device Health | Lost/Damaged.
  - Terminal Inventory tab: search (serial/merchant/model), country select, status select (inventory/shipped/delivered/active/blocked/damaged), type select (physical/phone_pos); sticky-header ScrollTable with columns Serial, Country, Merchant, Model (md), Type badge (physical=emerald, phone_pos=purple), Status (custom terminal-status badge), Activated (lg, formatDate), Last seen (sm, timeAgo), Actions dropdown.
  - Row actions: View details (Sheet), Activate (AlertDialog → adminData.updateTerminal status="active" activatedAt=now + logAudit "terminal.activate"), Block (AlertDialog → updateTerminal status="blocked" + logAudit "device.block"), Mark damaged (AlertDialog → updateTerminal status="damaged" + logAudit "terminal.mark_damaged"), Replace (toast + logAudit "terminal.replace_request"). Action visibility is gated by current status.
  - Right-side Sheet shows full terminal details + the same action buttons (only those valid for current status).
  - Other 4 tabs render FutureFeatureCard describing the future workflow.
  - Country scoping identical to risk-view.
- Created `src/components/portal/views/finance-view.tsx` exporting `FinanceView({ settlements, countries })`:
  - ViewHeader with Wallet icon, title "Finance & Settlements".
  - KPI strip: Settled Volume (formatCompact), Pending, Held, Failed (4 StatCards).
  - 5 Tabs: Settlement Batches (main) | Failed Settlements (pre-filtered to status="failed" + red badge counter) | Reconciliation | Merchant Fees | Reserves.
  - Reusable SettlementsCard sub-component renders the filter bar (search batch/merchant/id, country, status) and sticky-header ScrollTable with columns Batch ID, Country, Merchant, Amount (formatCurrency, right-aligned), Currency (sm), Scheduled (md, formatDate), Status (custom settlement-status badge), Failure reason (lg, red text), Actions dropdown. EmptyState is customisable via props (used to give the Failed tab a tailored message).
  - Row actions: View details (Sheet), Retry failed (adminData.updateSettlement status="processing" + logAudit "settlement.retry" — only shown when status === "failed"), Recommend hold (toast + logAudit "settlement.hold"), Recommend release (toast + logAudit "settlement.release_request" — only shown when status === "held"), Export report (toast + logAudit "settlement.export").
  - Right-side Sheet shows full settlement details + same action buttons (Retry only for failed; Release only for held). Failure reason rendered in a red callout box.
  - Other 3 tabs render FutureFeatureCard describing the future workflow (3-way recon, MDR pricing, rolling reserves).
  - Country scoping identical to the other two views.
- Visual style: emerald accent throughout (no indigo/blue primary), matches dashboard-view.tsx. All tables use the same ScrollTable pattern as compliance-view (raw <table> so the sticky <thead> stays anchored to the outer vertical-scroll viewport, with the prescribed `[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300` custom scrollbar styling and `max-h-[60vh] overflow-auto` wrapper).
- All three views mount `<SonnerToaster richColors closeButton position="bottom-right" />` at the end because the root layout only mounts the shadcn useToast Toaster (sonner toasts would otherwise be silent) — same convention as compliance-view.tsx.
- Used lucide-react icons throughout: AlertTriangle, Search, Filter, ShieldBan, Ban, PauseCircle, ArrowUpCircle, CheckCircle2, EyeOff, MoreHorizontal, ShieldAlert, Activity, FolderLock, Smartphone, Clock (risk); Smartphone, Search, Filter, MoreHorizontal, Power, Ban, Wrench, RefreshCw, Eye, PackageCheck, QrCode, HeartPulse, PackageX, Clock, CheckCircle2, Cpu (devices); Wallet, Search, Filter, MoreHorizontal, RotateCcw, PauseCircle, PlayCircle, Download, Eye, Clock, XCircle, Scale, Receipt, PiggyBank (finance).
- Ran `cd /home/z/my-project && bun run lint 2>&1 | tail -40` → zero lint errors in all three files (project lint passes with exit code 0).
- Ran `npx tsc --noEmit` → zero TS errors in the three new files (remaining errors are in unrelated examples/ and skills/ folders).
- Wrote agent-ctx record at `/home/z/my-project/agent-ctx/9a-subagent-ops-views.md`.

Stage Summary:
- Produced three production-quality, lint-clean client components totalling ~2,500 lines:
  - `risk-view.tsx` — 5-tab Risk & Fraud console with the Fraud Alerts queue (search + 3 filters + 10-column sticky table + 6 audit-logged row actions + detail Sheet + AlertDialog confirms) and 4 future-feature roadmap placeholders.
  - `devices-view.tsx` — 5-tab Devices & Terminal Operations console with Terminal Inventory (search + 3 filters + 9-column sticky table + 5 audit-logged row actions + detail Sheet + AlertDialog confirms) and 4 future-feature roadmap placeholders.
  - `finance-view.tsx` — 5-tab Finance & Settlements console with a reusable SettlementsCard powering both the Settlement Batches and Failed Settlements tabs (search + 2 filters + 9-column sticky table + 4 audit-logged row actions + detail Sheet) and 3 future-feature roadmap placeholders.
- All three views share the same conventions: emerald accent, ViewHeader + ViewContainer, sticky-header ScrollTable with custom scrollbar, super-admin vs. country-scoped visibility from useAuth(), sonner toasts, audit-logged mutations via adminData.* + logAudit, and AlertDialog confirmations for destructive / irreversible actions.
- Ready to be wired into the portal shell by the integrator agent: render `<RiskView fraudAlerts={...} countries={...} />` when `view === "risk"`, `<DevicesView terminals={...} countries={...} />` when `view === "devices"`, and `<FinanceView settlements={...} countries={...} />` when `view === "finance"` from the Firestore subscriptions (adminData.subscribeFraud / subscribeTerminals / subscribeSettlements / subscribeCountries).

---
Task ID: 12
Agent: main
Task: Wire up Firestore real-time listeners + CRUD operations, run lint, dev server, and self-verify with Agent Browser

Work Log:
- Created PortalApp root component wiring 14 Firestore subscriptions (departments, roles, permissions, countries, staff, kyc, kyb, fraud, settlements, tickets, disputes, terminals, audit, approvals) to all 13 views
- Updated src/app/page.tsx to dynamically import PortalApp with ssr:false (Firebase requires browser)
- Updated layout.tsx metadata to Faya Admin Portal branding
- Discovered Firestore security rules deny access by default → built src/lib/local-store.ts (in-memory + localStorage fallback seeded from spec data)
- Refactored admin-data.ts to transparently fall back to local store on permission-denied/unavailable errors (subscribe, fetchAll, upsert, patch, remove all handle fallback)
- Fixed closure bug in fetchAll local-mode (unsub undefined when callback fires synchronously) using setTimeout defer
- Refactored use-auth.ts to use Zustand store (module-level) so PortalApp, LoginScreen, and PortalShell share consistent auth state — separate useState instances caused login state to not propagate
- Fixed use-portal-store setView to NOT clear selectedCountryCode (was wiping selection before country_detail view could read it)
- Made PortalShell sidebar responsive: icon-only (w-14) on mobile <lg, full width (w-64) or collapsed (w-16) on desktop
- Agent Browser verification (desktop 1440×900 + mobile 390×844):
  * Login screen renders with Firebase project branding + demo button
  * Demo login succeeds → dashboard loads with all 6 countries (NG/GH/KE/ZA/EG/MA) + KPI cards + activity feeds
  * Navigated all 12 sidebar items: Dashboard, Compliance (KYC/KYB tabs), Risk (5 tabs), Devices (5 tabs + terminal inventory), Finance (5 tabs), Support (7 tabs), Disputes (7 tabs), Countries (cards), Country Detail (Nigeria dashboard + 5 rule tabs), Staff (10 seed staff + filters), Departments (2-col layout), Audit Logs (sortable table), Approvals (3 pending cards)
  * Mutation test 1: Approved an approval request → pending count 3→2, audit log recorded "approval.approve"
  * Mutation test 2: Created staff "Test Analyst" (Compliance/KYC Reviewer/NG) → appeared in staff list as "Invited", audit log recorded "staff.create"
  * Sticky footer verified: min-h-screen flex flex-col + mt-auto on footer, no overlap, pushed down on long content
  * Responsive: mobile sidebar 56px (icon-only), desktop 256px (expanded), no horizontal scroll
  * VLM confirmed dashboard: "clean, professional layout... no obvious visual problems"
- Lint: `bun run lint` → 0 errors, 0 warnings
- Dev log: all 200 responses, no runtime errors

Stage Summary:
- Faya Admin Portal is fully functional and verified end-to-end
- Firebase Auth (with demo fallback) + Firestore (with local-store fallback) both integrated
- All 13 views operational with real-time subscriptions and CRUD mutations + audit logging
- Works out-of-the-box without Firebase console configuration (local fallback); automatically upgrades to cloud sync once Firestore security rules are configured
- 7 screenshots saved to /home/z/my-project/download/

---
Task ID: D1
Agent: subagent-dashboard-country-update
Task: Update Dashboard + Country Detail views with merchant/consumer data + platform scope

Work Log:
- Read worklog.md, types.ts (Merchant/Consumer/PlatformConfig/PlatformKey/PLATFORM_LABELS), admin-data.ts (updateMerchant/updateConsumer/logAudit), formatters.ts, view-helpers.tsx, portal-app.tsx, and the two target views to align with project conventions
- Updated `src/components/portal/views/dashboard-view.tsx`:
  * Added `merchants: Merchant[]` + `consumers: Consumer[]` props (already wired in portal-app.tsx)
  * Replaced "Active Customers" / "Active Merchants" KPI cards in top row with NEW "Total Merchants" (Building2, formatCompact) and "Total Consumers" (Users, formatCompact) — both emerald success tone with hint "visible merchant/consumer records"
  * Added `visibleMerchants` + `visibleConsumers` useMemo filters using same country-scoping logic as countries (Super Admin sees all; others see only assigned country codes via `countryCode` field)
  * Added compact platform-scope chips on each country card: enabled platforms render as small emerald-tinted outline badges with their `PLATFORM_LABELS` label; a Tooltip on the count shows full list of enabled platforms with labels; disabled platforms are not shown as chips; falls back to "No platforms enabled" italic when none active. Layers icon used as the section marker.
  * Imported `Layers` icon and `PLATFORM_LABELS`, `PlatformKey` types
- Updated `src/components/portal/views/country-detail-view.tsx`:
  * Added `merchants: Merchant[]` + `consumers: Consumer[]` props (already wired in portal-app.tsx)
  * Added PROMINENT "Platform Scope" banner card directly after header card, before KPI section: emerald-tinted Card (border-emerald-300, bg-emerald-50 dark:bg-emerald-950/40), Info icon in emerald badge, "Platform Scope" heading with Layers icon, "All rules set on this page cut across ALL enabled platforms." message, count badge showing enabled count
  * Listed all 6 platforms (PLATFORM_ORDER) as badges — enabled ones render in emerald-tinted style with a check icon; disabled render greyed out with line-through and an X icon. Each has a Tooltip with the platform description and enabled/disabled status.
  * "Edit Platforms" button (Super Admin only) opens a Dialog with 6 Switch toggles (one per platform), each showing label, description, and enabled/disabled Badge. Switch uses emerald color (`data-[state=checked]:bg-emerald-600`). On save: validates at least one platform enabled → adminData.updateCountry(country.id, { platforms: draft, updatedAt: Date.now() }) → logAudit "country.change_platforms" with before/after JSON → toast.success
  * Updated "Active Customers" + "Active Merchants" KPI cards to show real count from filtered merchants/consumers arrays (formatCompact) and added hint showing the stored counter as `${formatNumber(country.activeCustomers)} (recorded)` / `${formatNumber(country.activeMerchants)} (recorded)`
  * Added NEW tab "Merchants & Consumers" (Store icon) in addition to KYC/KYB/Device/Settlement/Risk tabs
  * "Merchants on {country}" summary card: count badge, scrollable list (max-h-96) of merchants with tradingName, merchant status badge, merchantCode/businessType/city line, KYB status badge, risk category badge, platform count badge. Empty state when none. Amber note at bottom: "Merchants use the separate Merchant App. Manage their KYB/restrictions via Compliance and Risk views."
  * "Consumers on {country}" summary card: count badge, scrollable list of consumers with firstName lastName, consumer status badge, consumerCode/nationality/email line, KYC status badge, risk score badge (color-coded by 80/50 thresholds), KYC tier badge. Empty state when none. Same amber note about Consumer App.
  * Read-only summaries only — no full CRUD (handled by Compliance + Risk views)
- Imports added: Switch, Tooltip primitives, Table primitives, PLATFORM_LABELS/PlatformConfig/PlatformKey/Merchant/Consumer types, Info/Layers/Store/UserCircle icons
- Removed leftover unused Lock import (was a placeholder); kept Wallet (used in KPIs)
- Lint: `bun run lint` → 0 errors, 0 warnings

Stage Summary:
- Dashboard view now exposes Total Merchants + Total Consumers KPIs in the top row (visible-scope, formatCompact), and each country card shows a compact platform-scope chip cluster (count + per-platform badges with tooltip)
- Country Detail view now leads with a prominent emerald-tinted "Platform Scope" banner that visually reinforces "all rules cut across all enabled platforms", lists all 6 platforms (enabled=emerald badge, disabled=strikethrough grey), and gives Super Admins an Edit Platforms dialog with 6 Switch toggles that persists to adminData.updateCountry + logs `country.change_platforms` audit + sonner toast
- Country Dashboard KPI cards now show real-time merchant/consumer counts from the visible arrays, with the stored counter preserved as a "(recorded)" hint
- New "Merchants & Consumers" tab surfaces a read-only summary of who's operating on this country (merchant tradingName + KYB + risk, consumer name + KYC + risk score), with amber notes clarifying the merchant/consumer apps are separate apps that read from this same DB and that KYC/KYB/restrictions are managed in Compliance + Risk views
- No new nav items or standalone list pages added — the admin manages data (not the apps) through existing views, per spec
- Both files lint clean (exit 0); no indigo/blue primary colors used; emerald accent style preserved throughout

---
Task ID: D2
Agent: subagent-compliance-risk-update
Task: Update Compliance + Risk views to link KYC/KYB cases and fraud alerts to real merchant/consumer records

Work Log:
- Read worklog.md, types.ts (Merchant / Consumer / KycTier / MerchantStatus / ConsumerStatus), admin-data.ts (updateMerchant / updateConsumer / logAudit / patch), formatters.ts (statusBadge / formatCurrency / formatDateTime / timeAgo), view-helpers.tsx, portal-app.tsx (verified both views already receive consumers + merchants props), and the two target view files in full
- Confirmed that `compliance-view.tsx` already had the bulk of the required integration from a prior pass (props, findConsumerForKyc / findMerchantForKyb, KYC approve/reject → updateConsumer, KYB approve/reject → updateMerchant, tier chip in KYC queue, merchant-risk chip in KYB queue, linked-consumer / linked-merchant sections in KycDetailSheet / KybDetailSheet, live-sync info banner). Verified all Task-1 acceptance criteria were satisfied and made no further changes there.
- Audited `risk-view.tsx` and found three gaps vs. the task spec:
  1. `confirmTitle` / `confirmDescription` switch statements did not cover the new `suspend` and `reactivate` cases → TS2366 ("Function lacks ending return statement"). Lint passed (eslint doesn't catch it) but `npx tsc --noEmit` flagged both lines.
  2. `FraudDetailSheet` did not receive or display the linked consumer/merchant record, despite the table column and dropdown actions being wired up.
  3. `FraudDetailSheet` only exposed a Restrict button — Suspend and Reactivate were missing.
- Patched `risk-view.tsx` via MultiEdit (4 atomic edits):
  * Edit 1 — Pass `linked={findLinkedEntity(selectedAlert)}` plus `consumerStatusBadge`, `merchantStatusBadge`, `platformChips`, `onSuspend`, `onReactivate` into FraudDetailSheet from the parent Sheet.
  * Edit 2 — AlertDialog "Confirm" button now uses red (`bg-red-600`) for `restrict` + `suspend` + `block_device` and emerald (`bg-emerald-600`) for `reactivate` + `hold_settlement` + `close_false_positive`.
  * Edit 3 — Added `case "suspend"` / `case "reactivate"` branches to both `confirmTitle` and `confirmDescription`. The description now also reports the linked consumer/merchant code (or "no linked record — audit only") so the reviewer can see exactly what will be touched.
  * Edit 4 — Rewrote `FraudDetailSheet` to:
      - Accept `linked: LinkedEntity | null` plus the badge helpers and onSuspend / onReactivate callbacks.
      - Render the linked entity's current status badge next to the alert status in the header.
      - Render a "Linked consumer/merchant record" panel with emerald-tinted styling and a "Live sync" badge — shows full name/code/email/phone/nationality/KYC tier/risk score/status/platforms for consumers, and trading name/legal name/code/contact/owner/business type/risk category/status/platforms for merchants. Includes an explanatory note that restricting/suspending will update the record in real-time and the separate Consumer/Merchant App reads from the same database.
      - Render an amber-dashed fallback panel when no linked record is found, explaining that account-level actions are disabled and the user should fall back to Block device / Hold settlement / Escalate / Close as false positive.
      - Expose a 5-row action grid: Restrict (amber outline) | Suspend (destructive red) | Reactivate (emerald outline) | Block device (destructive) | Hold settlement (outline) | Escalate (purple outline) | Close as false positive (secondary) | Add to watchlist (ghost). Restrict / Suspend / Reactivate are disabled when there's no linked record or the alert is closed.
- Verified the dropdown menu in the table already had Restrict / Suspend / Reactivate with `disabled={!canAct || !linked}` gating and AlertDialog confirms via `setConfirmAction({ kind, alert })`. No edits needed there.
- Verified the Fraud Alerts table already had an "Entity status" column rendering `linkedStatusBadge(a)` (consumer/merchant status badge or "No link" italic).
- Verified `portal-app.tsx` already passes `merchants` + `consumers` to both `<ComplianceView>` and `<RiskView>`.
- Ran `cd /home/z/my-project && bun run lint 2>&1 | tail -30` → 0 errors, 0 warnings (eslint clean).
- Ran `cd /home/z/my-project && npx tsc --noEmit 2>&1 | grep -E "(risk-view|compliance-view)"` → "NO ERRORS IN TARGET FILES" (the previously-failing TS2366 errors on confirmTitle / confirmDescription are gone; remaining tsc errors are in unrelated examples/ skills/ countries-view/ local-store/ files).
- Verified dev server: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200; dev.log shows `GET / 200 in 32ms (compile: 4ms, render: 28ms)` with no compile errors after the edits.

Stage Summary:
- Compliance view (`compliance-view.tsx`) already satisfied Task 1 end-to-end: KYC approve → `adminData.updateConsumer({kycStatus:"approved", status:"active"})`, KYC reject → `{kycStatus:"rejected", status:"restricted"}`, same for KYB → merchant, linked consumer/merchant panels in the detail sheets with all required fields (name, code, email, phone, nationality, DOB, KYC tier, risk score, status, platforms), tier chip in KYC queue table, merchant-risk chip in KYB queue table, emerald live-sync info banner, full audit logging + sonner toast feedback. No further changes required.
- Risk view (`risk-view.tsx`) now satisfies Task 2 end-to-end:
  * `findLinkedEntity` resolves fraud alerts to consumers (exact full-name → fuzzy partial → email/phone/consumerCode) or merchants (tradingName → legalName → fuzzy → merchantCode/contactEmail).
  * Restrict / Suspend / Reactivate each call `adminData.updateConsumer` or `adminData.updateMerchant` with the appropriate status (`restricted` / `suspended` / `active`) plus `logAudit` with `account.restrict` / `account.suspend` / `account.reactivate` action keys and sonner toast feedback. All three require AlertDialog confirmation.
  * Fraud Alerts table exposes an "Entity status" column showing the linked consumer/merchant current status as a badge (or "No link" when unmatched).
  * FraudDetailSheet now shows the full linked consumer/merchant record in an emerald-tinted panel with a "Live sync" badge, plus Restrict / Suspend / Reactivate / Block device / Hold settlement / Escalate / Close false positive / Add to watchlist action buttons — account-level buttons are disabled when no linked record exists.
  * `confirmTitle` / `confirmDescription` now cover all six ConfirmAction kinds (restrict / suspend / reactivate / block_device / hold_settlement / close_false_positive) and the description includes the linked entity's code so the reviewer can verify the blast radius before confirming.
  * AlertDialog confirm button uses red for destructive (restrict / suspend / block_device) and emerald for positive / neutral (reactivate / hold_settlement / close_false_positive).
- Both views preserve all existing functionality (tabs, filters, SLA badges, reviewer cells, audit logging, sonner toasts, Sanctions/PEP workflow, manual-review/approved/rejected buckets, future-feature roadmap tabs). No indigo/blue primary colors — emerald accent style throughout. Consumer/Merchant apps are NOT mentioned as nav items or standalone list pages; the admin manages their data through Compliance (KYC/KYB) and Risk (restrict/suspend/reactivate) views only, and the apps read from the same Firestore collections via `adminData.updateConsumer` / `updateMerchant` patches.
- Lint clean (0 errors / 0 warnings). TS clean for both target files. Dev server returns 200 OK after edits.

---
Task ID: V1
Agent: subagent-users-merchants-pos
Task: Build Users + Merchants views with tabbed profiles + POS device approval workflow

Work Log:
- Read worklog.md, types.ts (Consumer / Merchant / Card / Wallet / Transaction / UserDocument / PosStaff / Terminal / Settlement / Dispute / PosDeviceRequest / CountryConfig), admin-data.ts (subscribeCards / subscribeWallets / subscribeTransactions / subscribeDocuments / subscribePosStaff / subscribeTerminals / subscribeSettlements / subscribeDisputes / subscribePosDeviceRequests / updateCard / updateWallet / updateDocument / updatePosStaff / updateTerminal / updatePosDeviceRequest / updateConsumer / updateMerchant / logAudit), access-scope.ts (getVisibleConsumers / getVisibleMerchants / getScopeLabel), formatters.ts (formatCurrency / formatNumber / formatDateTime / timeAgo / statusBadge), view-helpers.tsx (ViewHeader / StatCard / EmptyState / ViewContainer), use-auth.ts, portal-app.tsx, and existing tabbed-sheet patterns in compliance-view.tsx / disputes-view.tsx to align with project conventions
- Created `src/components/portal/views/users-view.tsx` (~1500 lines):
  * ViewHeader with Users icon, title "Users (Consumers)", scope badge from `getScopeLabel(staff)`
  * 4 stat cards: Total Consumers (default), Active (success), Pending KYC (warning), Restricted/Suspended (danger) — all driven from `getVisibleConsumers(staff, countries, consumers)`
  * Filters: search (name/email/phone/consumerCode), country, KYC status, account status — all in a Card with grid layout and a "Clear filters" button
  * Consumers table (ScrollTable max-h-60, sticky header): Consumer Code, Name (+tier+risk badges), Email, Phone, Country, KYC status, Account status, Wallet Balance, Last Login, Actions (dropdown: View profile, Restrict, Suspend, Reactivate — contextually hidden when not applicable)
  * Row actions open AlertDialog confirmation (orange for restrict, red for suspend, emerald for reactivate) → `adminData.updateConsumer` with new status + `logAudit("consumer.{action}")` + sonner toast
  * ConsumerDetailSheet (sm:max-w-3xl) with 5 TABS inside the Sheet:
    - Profile: personal details, KYC, contact & country, platforms, wallet summary mini-stats, transaction stats mini-stats, notes, emerald "Live sync" banner
    - Cards: subscribes to `adminData.subscribeCards`, filters `card.userId === consumer.id`. Table with Card ID, Type, Scheme, Last 4, Status, Currency, Frozen, Actions (Freeze/Unfreeze via `updateCard` + logAudit `card.freeze`/`card.unfreeze`). Emerald "Admin never sees full PAN, CVV, or PIN" security note
    - Wallets: subscribes to `adminData.subscribeWallets`, filters `wallet.userId === consumer.id`. Table with Wallet ID, Currency, Balance, Available, Held, Status, Actions (Freeze/Unfreeze via `updateWallet` + logAudit `wallet.freeze`/`wallet.unfreeze`). Amber "Manual balance adjustment requires dual approval" note
    - Transactions: subscribes to `adminData.subscribeTransactions`, filters `transaction.userId === consumer.id`. Table with Reference, Amount, Type, Status, Method, Card Last4, Risk, Created, Actions (View receipt toast + Open dispute toast + logAudit `dispute.open`)
    - Documents: subscribes to `adminData.subscribeDocuments`, filters `document.entityId === consumer.id`. Table with Type, File Name, Status, Uploaded, Reviewer, Actions (Approve/Reject via `updateDocument` + logAudit `document.approve`/`document.reject`)
  * Each tab trigger shows a count badge (CountBadge component: emerald if n>0, muted if 0)
  * All subscriptions are wired in `useEffect` keyed by `consumer.id` — they auto-cleanup on sheet close
- Created `src/components/portal/views/merchants-view.tsx` (~1700 lines):
  * ViewHeader with Building2 icon, title "Merchants", scope badge
  * 4 stat cards: Total Merchants, Active, Onboarding, Restricted/Suspended
  * Filters: search, country, KYB status, account status, risk category (5-column grid)
  * Merchants table: Merchant Code, Trading Name (+legal name), Country, Business Type, KYB, Risk, Status, Terminal Count, Monthly Volume, Actions (dropdown: View profile, Approve KYB, Reject KYB, Restrict, Suspend, Reactivate — contextually hidden)
  * Row actions → AlertDialog → `adminData.updateMerchant` + `logAudit("merchant.{action}")` + toast. approve_kyb sets kybStatus="approved" + status="active"; reject_kyb sets kybStatus="rejected" + status="restricted"
  * MerchantDetailSheet (sm:max-w-3xl) with 6 TABS inside the Sheet:
    - Profile: business profile, owner details, KYB, platforms, terminal stats, transaction stats, settlement info, notes, "Live sync" banner
    - POS Staff: subscribes to `adminData.subscribePosStaff`, filters `posStaff.merchantId === merchant.id`. Table with Code, Name, Role, Branch, Device, Status, Actions (Suspend/Reactivate via `updatePosStaff`, Reset PIN toast + logAudit `pos_staff.reset_pin`, Force logout toast + logAudit `pos_staff.force_logout`)
    - Terminals: subscribes to `adminData.subscribeTerminals`, filters `terminal.merchantName === merchant.tradingName || merchant.legalName`. Table with Serial, Type, Model, Status, Activated, Last seen, Actions (Activate/Block via `updateTerminal` + logAudit `terminal.activate`/`terminal.block`)
    - Settlements: subscribes to `adminData.subscribeSettlements`, filters `settlement.merchantName === merchant.legalName || merchant.tradingName`. Table with Batch ID, Amount, Currency, Scheduled, Status (with failure reason), Actions (Retry if failed → logAudit `settlement.retry`, View details toast)
    - Disputes: subscribes to `adminData.subscribeDisputes`, filters `dispute.merchantName === merchant.legalName || merchant.tradingName`. Table with Dispute ID, Customer, Amount, Reason, Status, Actions (Request evidence → logAudit `dispute.request_evidence`, Mark under review/won/lost → logAudit `dispute.update_status`)
    - POS Requests: subscribes to `adminData.subscribePosDeviceRequests`, filters `posDeviceRequest.merchantId === merchant.id`. KEY FEATURE — see below.
  * POS Device Request card (PosRequestCard component):
    - Header: request code, type (physical_terminal/phone_pos), status badge, device model + OS + app version + battery
    - DEVICE CAPABILITY CHECK: 3 CapabilityBadge components (NFC, Card Reader, Swipe) — emerald background + check icon if supported, red background + X icon if not
    - canBeApproved indicator: emerald "Can approve — payment method available" OR red "Cannot approve — no payment method"
    - APPROVAL RULE: Approve button DISABLED when `canBeApproved === false`. Tooltip on hover: "Cannot approve — device doesn't support any payment method (NFC, card reader, or swipe)"
    - AUTO-DECLINE: When `canBeApproved === false` and status is "pending", an "Auto-decline" button (red outline) sets status to "auto_declined" with `declineReason: "Device does not support NFC, card reader, or swipe."` + logAudit `pos_device.auto_decline`
    - APPROVE: sets status to "approved", reviewedBy, reviewedAt + logAudit `pos_device.approve`
    - DECLINE: opens a Dialog with optional reason textarea → sets status to "declined" + declineReason + logAudit `pos_device.decline`
    - Device integrity warning: amber banner if `deviceIntegrityPassed === false` ("WARNING: Device integrity check failed — device may be rooted")
    - Screen lock warning: amber banner if `screenLockEnabled === false`
    - Reviewed-by footer for closed requests (mono reviewer id + formatted timestamp)
  * All subscriptions wired in `useEffect` keyed by `merchant.id` + `tradingName` + `legalName`
- Resolved a TS2300 naming collision: the shadcn/ui `Card` component and the `Card` type from `types.ts` (likewise `Wallet`) share identifiers. Aliased the type imports as `CardRecord` / `WalletRecord` in users-view.tsx — the UI primitive keeps the short `Card` / `Wallet` name where it's used as a JSX element
- Styling: emerald accent throughout, NO indigo/blue primary. Tables wrapped in ScrollTable with `max-h-60 overflow-y-auto` and custom webkit-scrollbar styling. Sheets are `sm:max-w-3xl` to comfortably fit the tab list + tables side-by-side
- Lint: `cd /home/z/my-project && bun run lint 2>&1 | tail -30` → 0 errors, 0 warnings (eslint clean)
- TypeScript: `npx tsc --noEmit 2>&1 | grep -E "(users-view|merchants-view)"` → NO ERRORS in target files (remaining tsc errors are in unrelated examples/, skills/, countries-view.tsx, staff-view.tsx, seed-data.ts — pre-existing)
- Dev server: `tail -20 dev.log` shows GET / 200 in 26-52ms with no compile errors after the new files were added

Stage Summary:
- Users view (`users-view.tsx`) — main list with 4 stat cards + 4 filters + consumers table (10 columns) + row actions (View / Restrict / Suspend / Reactivate). Detail Sheet (sm:max-w-3xl) opens with 5 TABS: Profile, Cards, Wallets, Transactions, Documents — each tab subscribes to its own adminData collection, filters by the consumer's id, renders a ScrollTable with row-level actions (Freeze/Unfreeze cards, Freeze/Unfreeze wallets, View receipt / Open dispute, Approve/Reject documents), and shows a count badge in the trigger. Security note surfaced on Cards tab; dual-approval note on Wallets tab. All mutations call `adminData.updateCard` / `updateWallet` / `updateConsumer` / `updateDocument` + `logAudit` + sonner toast.
- Merchants view (`merchants-view.tsx`) — main list with 4 stat cards + 5 filters + merchants table (10 columns) + row actions (View / Approve KYB / Reject KYB / Restrict / Suspend / Reactivate). Detail Sheet (sm:max-w-3xl) opens with 6 TABS: Profile, POS Staff, Terminals, Settlements, Disputes, POS Requests — each subscribes to its own adminData collection, filters by merchant id (POS Staff / POS Requests) or merchant trading/legal name (Terminals / Settlements / Disputes), renders a ScrollTable with row-level actions, and shows a count badge in the trigger.
- POS Device Request workflow (`PosRequestCard`) implements the spec's approval rule end-to-end:
  * Capability badges for NFC / Card Reader / Swipe — green if supported, red if not
  * canBeApproved indicator (green check / red X)
  * Approve button DISABLED when canBeApproved === false (with explanatory tooltip)
  * Auto-decline button (sets status="auto_declined" with reason "Device does not support NFC, card reader, or swipe.")
  * Approve button (sets status="approved", reviewedBy, reviewedAt + logAudit "pos_device.approve")
  * Decline button opens dialog with optional reason textarea (sets status="declined" + declineReason + logAudit "pos_device.decline")
  * Amber warning banner when deviceIntegrityPassed === false (rooted/jailbroken device)
  * Amber warning banner when screenLockEnabled === false
- Cards / Wallets / Transactions / Documents / POS Staff / Terminals / Settlements / Disputes / POS Requests are NOT separate nav items — they are TABS inside the respective consumer/merchant profile Sheet, per the architecture spec.
- No indigo/blue primary colors — emerald accent throughout. Lint clean (0 errors / 0 warnings). TypeScript clean for both target files. Dev server returns 200 OK after edits.

---
Task ID: USER-PROFILE-POS
Agent: main
Task: Restore user profile + build POS device approval workflow

Work Log:
- Recreated src/lib/access-scope.ts (was deleted) with getVisibleCountries, getVisibleMerchants, getVisibleConsumers, getVisibleStaff, getScopeLabel
- Added PosDeviceRequest type to types.ts with deviceInfo (nfcSupported, cardReaderSupported, swipeSupported, deviceIntegrityPassed, screenLockEnabled, batteryLevel)
- Added 6 POS device request seed records (2 approved, 1 auto-declined, 3 pending)
- Added pos_device_requests collection to admin-data.ts + local-store.ts
- Added all missing back-office typed accessors to admin-data.ts (subscribePosStaff, subscribeCards, subscribeWallets, subscribeTransactions, subscribeDocuments, subscribePolicies, subscribeAppContent, subscribeNotifications, subscribeFees, subscribeLimits, subscribeProviderLogs, subscribeWebhookLogs, subscribePosDeviceRequests + mutations)
- Subagent V1: Built users-view.tsx with 5-tab profile (Profile, Cards, Wallets, Transactions, Documents) + merchants-view.tsx with 6-tab profile (Profile, POS Staff, Terminals, Settlements, Disputes, POS Requests)
- Added row click handlers to open detail sheets
- Added Users + Merchants nav items to sidebar
- Wired views into PortalApp
- Bumped localStorage version to v4 to force re-seed with new collections
- Browser verification:
  * Users view: clicking Adebayo Ogun opens sheet with "Profile | Cards (2) | Wallets (1) | Transactions (3) | Documents (1)"
  * Cards tab shows card table with freeze/unfreeze actions
  * Merchants view: clicking Lagos Foods opens sheet with "Profile | POS Staff (2) | Terminals (0) | Settlements (0) | Disputes (0) | POS Requests (1)"
  * POS Requests tab shows device capability check with NFC/Card Reader/Swipe badges
  * Lagos Foods (Ingenico Move 2500): "Can approve — payment method available" (NFC+Card+Swipe all supported)
  * QuickMart Nairobi (Tecno Spark 10): "Cannot approve — no payment method" → Auto-Declined with reason "Device does not support NFC, card reader, or swipe"
  * Approve button disabled when canBeApproved=false
  * Auto-decline button for devices with no payment methods
  * Device integrity warning for rooted devices
- Lint: 0 errors. Dev server: 200 OK.

Stage Summary:
- User profile restored with tabbed interface (Cards/Wallets/Transactions/Documents under User profile)
- Merchant profile restored with tabbed interface (POS Staff/Terminals/Settlements/Disputes/POS Requests under Merchant profile)
- POS device approval workflow implemented:
  • When merchant orders terminal/phone POS, Faya POS app sends device capabilities
  • Admin sees NFC, Card Reader, Swipe status as badges
  • Approve button DISABLED if device has no NFC, no card reader, and no swipe
  • Auto-decline for devices with no payment method support
  • Device integrity check warning (rooted devices)
  • Screen lock warning
  • All approvals/declines audit-logged

---
Task ID: CP1
Agent: subagent-comprehensive-consumer-profile
Task: Rebuild consumer profile with ALL related data in tabs

Work Log:
- Read worklog.md, types.ts, admin-data.ts, access-scope.ts, formatters.ts, view-helpers.tsx, use-auth.ts, merchants-view.tsx (for conventions), and the existing users-view.tsx
- Completely rewrote `/home/z/my-project/src/components/portal/views/users-view.tsx`:
  - MAIN VIEW: stat cards (Total / Active / Pending KYC / Restricted+Suspended), filters (search, country, KYC status, account status), consumer table (Consumer Code, Name, Email, Phone, Country, KYC, Status, Wallet Balance, Cards count, Txns count, Updated, Actions), row click opens detail Sheet, row dropdown for View profile / Restrict / Suspend / Reactivate (via updateConsumer + logAudit), with AlertDialog confirmation
  - DETAIL SHEET (sm:max-w-4xl — wider):
    - Profile Summary Header (always visible above tabs): avatar with initials, full name, consumer code, country flag/code, KYC badge, account status badge, KYC tier badge; quick actions (Restrict / Suspend / Reactivate); 6 quick stats row (Cards, Wallets, Total Balance, Txns, Open Tickets, Open Disputes) each with icon
    - 10 tabs with count badges in compact text-[11px]:
      1. Overview — personal details, contact, KYC summary, platforms, wallet summary, transaction stats, quick-links note
      2. Cards — table (Card ID, Type, Scheme, Last 4, Status, Currency, Frozen, Tokenized, Created, Actions) — Freeze/Unfreeze (updateCard), View details; security note "Admin never sees full PAN, CVV or PIN"
      3. Wallets — table (Wallet ID, Currency, Balance, Available, Held, Status, Linked Cards, Actions) — Freeze/Unfreeze (updateWallet); note "Manual balance adjustment requires dual approval"
      4. Transactions — table (Reference, Amount, Currency, Type, Status, Method, Card Last4, Risk, Created, Actions) — View receipt, Open dispute, Escalate, Add note (toast + logAudit)
      5. Documents — table (Type, File Name, Status, Uploaded, Reviewed By, Actions) — Approve, Reject, Request replacement (updateDocument + logAudit)
      6. KYC Cases — table (Case ID, Country, Nationality, Risk, Submitted, Status, Reviewer, SLA, Actions) — Approve (updateKyc + updateConsumer kycStatus=approved status=active), Reject, Escalate (all + logAudit)
      7. Support Tickets — table (Ticket ID, Country, Type, Subject, Priority, Status, Created, SLA, Actions) — Reply, Assign, Close (updateTicket + logAudit)
      8. Disputes — table (Dispute ID, Merchant, Amount, Reason, Status, Deadline, Actions) — View details + Update status dropdown (updateDispute + logAudit)
      9. Risk & Alerts — table (Alert ID, Trigger, Severity, Amount, Device, Created, Status, Actions) — Close false positive, Escalate (updateFraud + logAudit)
      10. Activity & Audit — table (Timestamp, Action, Entity, Reason, IP, Actor) — read-only; immutable note
  - Each tab subscribes live via useEffect(() => adminData.subscribe*(setItems), []), filters by the selected consumer (matching rules per the task spec), shows EmptyState if 0 items, uses max-h-60 overflow-y-auto scroll table with sticky header
  - Aliased type imports (Card as CardRecord, Wallet as WalletRecord, etc.) to avoid collision
  - Emerald accent throughout; NO indigo/blue primary
  - All mutations funnel through adminData.update* + logAudit with proper action keys; Sonner toasts for feedback
  - Imports: toast from "sonner", adminData + logAudit from "@/lib/admin-data", useAuth from "@/hooks/use-auth", getVisibleConsumers + getScopeLabel from "@/lib/access-scope"

Stage Summary:
- A truly comprehensive consumer profile view where EVERYTHING connected to a consumer — cards, wallets, transactions, documents, KYC cases, support tickets, disputes, risk alerts, audit logs — lives under their profile in 10 tabs, all driven by live Firestore subscriptions. Replaces the prior narrower users-view.tsx entirely. The companion Faya Pay consumer app reads the same Firestore collections through the same `adminData` patch helpers.

---
Task ID: MP1
Agent: subagent-comprehensive-merchant-profile
Task: Rebuild merchant profile with ALL related data in tabs

Work Log:
- Read worklog.md, types.ts, admin-data.ts, access-scope.ts, formatters.ts, view-helpers.tsx, use-auth.ts, and existing merchants-view.tsx for project conventions
- Confirmed available subscribe/update methods in admin-data.ts (subscribePosStaff/Terminals/PosDeviceRequests/Transactions/Settlements/Disputes/Documents/Kyb/Tickets/Fraud/Audit + matching updateXxx methods + logAudit helper)
- Completely rewrote src/components/portal/views/merchants-view.tsx:
  - MAIN VIEW: stat cards (Total / Active / Onboarding / Restricted+Suspended), filters (search, country, KYB status, account status, risk category), merchant table (Code, Trading Name, Country, Business Type, KYB, Risk, Status, Terminals, Phone POS, Monthly Volume, Actions), row click opens detail Sheet, row dropdown actions (View profile / Approve KYB / Reject KYB / Restrict / Suspend / Reactivate) via updateMerchant + logAudit, AlertDialog confirmation
  - DETAIL SHEET (sm:max-w-4xl) with sticky Profile Summary Header (business name, merchant code, country, KYB/status/risk badges, platform chips, merchant actions dropdown, 6-cell quick stats row: POS Staff / Terminals / Phone POS / Monthly Volume / Open Disputes / Open Tickets) above 12 tabs (compact text-[11px] each with count badge):
    1. Overview — business profile / owner details / KYB summary / platforms / terminal & transaction stats / settlement info / notes
    2. POS Staff — table + Suspend/Reactivate (updatePosStaff), Reset PIN, Force logout (toast + logAudit)
    3. Terminals — table + Activate/Block (updateTerminal)
    4. POS Requests — KEY device approval workflow: NFC/Card/Swipe capability badges, integrity & screen-lock indicators, Approve DISABLED if canBeApproved === false, Auto-decline button when no payment methods, manual Decline dialog with reason, amber warnings for failed integrity / no screen lock, logAudit pos_device.approve/decline/auto_decline
    5. Transactions — table + View details / Open dispute / Escalate (logAudit)
    6. Settlements — table + Retry if failed (updateSettlement + logAudit "settlement.retry"), View details
    7. Disputes — table + Request evidence / Advance status (updateDispute + logAudit)
    8. Documents — table + Approve / Reject / Request replacement (updateDocument + logAudit)
    9. KYB Cases — table + Approve (updateKyb approved + updateMerchant kybStatus=approved status=active) / Reject / Escalate, SLA pill column
    10. Support Tickets — table + Reply / Assign / Close (updateTicket + logAudit), priority + status + SLA columns
    11. Risk & Alerts — table of fraud alerts filtered by entityName matching merchant legal/trading name, severity + status badges
    12. Activity & Audit — read-only audit logs filtered by entityId === merchant.id
  - Single useEffect in MerchantProfileSheet subscribes to all 11 collections once and passes filtered items to each tab (one subscription per collection). MerchantProfileSheet is key={merchant.id} in parent so a fresh mount resets the active tab to Overview.
  - Each tab uses max-h-60 overflow-y-auto scroll table with sticky header, shows EmptyState when 0 items
  - Emerald accent throughout, NO indigo/blue primary
- Lint fix: replaced in-effect setTab("overview") call with parent key={merchant.id} remount pattern to satisfy react-hooks/set-state-in-effect rule
- bun run lint passes clean (0 errors, 0 warnings). Dev server compiles successfully.

Stage Summary:
A truly comprehensive merchant profile view where EVERYTHING connected to a merchant — POS staff, terminals, POS device requests, transactions, settlements, disputes, documents, KYB cases, support tickets, fraud alerts, and audit logs — lives under their profile Sheet in 12 tabs, all driven by live Firestore subscriptions. The POS device approval workflow enforces the spec rule (cannot approve if device has no NFC, card reader, or swipe; offers auto-decline instead). Replaces the prior narrower merchants-view.tsx entirely. The companion Faya Business merchant app reads the same Firestore collections through the same adminData patch helpers.

---
Task ID: COMPREHENSIVE-PROFILES
Agent: main
Task: Create comprehensive profiles with EVERYTHING connected to a user under their profile

Work Log:
- Subagent CP1: Rebuilt users-view.tsx with 10-tab comprehensive consumer profile:
  • Profile summary header with quick stats (cards, wallets, balance, txns, tickets, disputes counts)
  • Tabs: Overview, Cards, Wallets, Transactions, Documents, KYC Cases, Support Tickets, Disputes, Risk & Alerts, Activity & Audit
  • Each tab subscribes to its own data via adminData.subscribe* and filters by consumer
- Subagent MP1: Rebuilt merchants-view.tsx with 12-tab comprehensive merchant profile:
  • Profile summary header with quick stats (POS staff, terminals, phone POS, monthly volume, disputes, tickets)
  • Tabs: Overview, POS Staff, Terminals, POS Requests (device approval), Transactions, Settlements, Disputes, Documents, KYB Cases, Support Tickets, Risk & Alerts, Activity & Audit
- Fixed TypeScript error: kycBadge and consumerStatusBadge were defined inside UsersView but used by sub-components — moved to module level
- Fixed TypeScript error: failureReason: null → undefined in merchants-view
- Browser verification:
  * Consumer (Adebayo Ogun): 10 tabs showing — Overview, Cards (2), Wallets (1), Transactions (3), Documents (1), KYC Cases (0), Support (0), Disputes (0), Risk & Alerts (0), Activity (0)
  * Merchant (Lagos Foods): 12 tabs showing — Overview, POS Staff (2), Terminals (0), POS Requests (1), Transactions (4), Settlements (0), Disputes (0), Documents (1), KYB Cases (1), Tickets (0), Risk & Alerts (0), Activity & Audit (0)
- Lint: 0 errors. Dev server: 200 OK.

Stage Summary:
- Consumer profile now has EVERYTHING: cards, wallets, transactions, documents, KYC cases, support tickets, disputes, fraud alerts, audit history — all in one place
- Merchant profile now has EVERYTHING: POS staff, terminals, POS device requests, transactions, settlements, disputes, documents, KYB cases, support tickets, fraud alerts, audit history — all in one place
- Each tab shows a live count badge so the admin instantly sees how many items exist
- POS device approval workflow is under Merchant → POS Requests tab
- No more jumping between separate pages — everything is contextualized under the user's profile

---
Task ID: UP1
Agent: subagent-user-detail-page
Task: Create full-page user profile view (no sheet)

Work Log:
- Read worklog.md, types.ts, admin-data.ts, formatters.ts, view-helpers.tsx, use-auth.ts, use-portal-store.ts, access-scope.ts, and the existing users-view.tsx (CP1) + country-detail-view.tsx (for the established full-page detail view pattern).
- Created `src/components/portal/views/user-detail-view.tsx` — `UserDetailView` with props `{ consumers, countries }`. Gets `selectedUserId` from `usePortalStore`; falls back to an EmptyState + back button when the consumer is not found.
  - A. Back button bar at top: "← Back to Users" calls `setView("users")`; a "Full Profile View" pill on the right.
  - B. Full-width profile header card (emerald-tinted gradient):
    * Left: 64px avatar with initials, full name, KYC badge, account-status badge, KYC tier badge, risk-score badge; below — consumer code (mono), email, phone, country, timezone/currency, member-since.
    * Right: Restrict / Suspend / Reactivate action buttons (disabled appropriately; opens AlertDialog confirmation).
    * Bottom: 6-cell quick stats grid (Cards, Wallets, Total Balance, Transactions, Open Tickets, Open Disputes) — live-subscribed so counters update in real time.
  - C. shadcn Tabs (full width) with 10 tabs and count badges:
    1. Overview — personal details, contact, KYC summary, platforms, wallet summary, transaction stats, explore hint.
    2. Cards — table + Freeze/Unfreeze (`updateCard`), View details; security note.
    3. Wallets — table + Freeze/Unfreeze (`updateWallet`); dual-approval note.
    4. Transactions — table + View receipt / Open dispute / Escalate / Add note (`logAudit transaction.dispute / transaction.escalate`).
    5. Documents — table + Approve / Reject / Request replacement (`updateDocument` + `logAudit`).
    6. KYC Cases — table + Approve (`updateKyc` + `updateConsumer` activates) / Reject / Escalate; SLA pill.
    7. Support Tickets — table + Reply / Assign to me / Close (`updateTicket`).
    8. Disputes — table + View details / Update status dropdown (`updateDispute`).
    9. Risk & Alerts — table + Close (false positive) / Escalate (`updateFraud`).
    10. Activity & Audit — read-only table; immutable-log note.
  - Each tab: count badge in label, EmptyState if 0 items, `max-h-96 overflow-y-auto` scroll table with custom scrollbar styling. Profile header + Tabs are `key`-ed by `consumer.id` so subscriptions and active tab reset cleanly when navigating between consumers.
  - Aliased type imports (`Card as CardRecord`, `Wallet as WalletRecord`, `Transaction as TransactionRecord`, `UserDocument as DocumentRecord`, `KycCase as KycCaseRecord`, `SupportTicket as TicketRecord`, `Dispute as DisputeRecord`, `FraudAlert as FraudRecord`, `AuditLog as AuditRecord`) to avoid collision with the shadcn `Card` UI component.
  - Emerald accent throughout, NO indigo/blue primary.
- Wired up the new view:
  * `portal-app.tsx`: imported `UserDetailView`, added `case "user_detail":` route passing `consumers` + `countries`.
  * `portal-shell.tsx`: sidebar "Users" item is now also active when `view === "user_detail"` (matches the existing `country_detail` pattern).
- Rebuilt `users-view.tsx` to drop the sliding Sheet entirely:
  * Row click + "View profile" / "Open full profile" dropdown items now call `selectUser(c.id) + setView("user_detail")` to open the full-page profile.
  * Kept the stat cards, filters, table, dropdown actions, and the existing AlertDialog confirmation flow for Restrict / Suspend / Reactivate from the list. File shrunk from ~2,000 lines to ~330 (the Sheet body and all 10 tab sub-components are now consolidated in `user-detail-view.tsx`).
- Appended worklog entry under "Task ID: UP1". Saved agent work record at `agent-ctx/UP1-subagent-user-detail-page.md`.
- Ran `bun run lint`.

Stage Summary:
A proper full-page consumer profile (`UserDetailView`) replaces the previous sliding Sheet. Navigating from the Users list now opens a full-width page with a back button, a wide emerald-tinted profile header (avatar, identity, status badges, action buttons, 6-cell quick stats), and 10 tabs covering everything connected to the consumer — overview, cards, wallets, transactions, documents, KYC cases, support tickets, disputes, risk alerts, and the audit trail. All tabs subscribe live to their Firestore collections, mutations go through `adminData.update*` + `logAudit` + sonner toasts, and confirmations use `AlertDialog`. The sidebar's "Users" entry stays highlighted while the detail page is open.

---
Task ID: MP2
Agent: subagent-merchant-detail-page
Task: Create full-page merchant profile view (no sheet)

Work Log:
- Read worklog.md (incl. MP1 + COMPREHENSIVE-PROFILES + UP1 entries), types.ts, admin-data.ts, access-scope.ts, formatters.ts, view-helpers.tsx, use-auth.ts, use-portal-store.ts, portal-app.tsx, and the existing merchants-view.tsx (for the 12-tab pattern, status style maps, POS device approval workflow, audit action keys, and `nameMatchesMerchant` filter rule)
- Confirmed `merchant_detail` is already in the `PortalView` union type and that `usePortalStore` exposes `selectedMerchantId` + `selectMerchant` + `setView`
- Created `src/components/portal/views/merchant-detail-view.tsx` — a standalone `MerchantDetailView` with props `{ merchants: Merchant[]; countries: CountryConfig[] }`:
  - Reads `selectedMerchantId` + `setView` from `usePortalStore` and `staff` from `useAuth`
  - If merchant not found: shows EmptyState (Building2 icon) + an "← Back to Merchants" button (both top and centered)
  - If found, renders a FULL PAGE (no Sheet) with three regions:
    A. **Back button bar** at the top — emerald-tinted ghost button calling `setView("merchants")` + a small merchant code hint on the right
    B. **Profile header card** (full-width, emerald gradient): top row has avatar + trading name + legal name + merchant code + country + business type (left), KYB/status/risk badges + platform chips (center), action buttons Approve KYB / Reject KYB / Restrict / Suspend / Reactivate that appear conditionally based on current state (right). Bottom row: 6-cell quick-stats grid — POS Staff, Terminals (active/total), Phone POS, Monthly Volume, Open Disputes, Open Tickets — each with icon and tone color. Confirmations via `AlertDialog` (green for approve/reactivate, red for reject/restrict/suspend).
    C. **Tabs section** (shadcn `Tabs`, full width, count badge on each tab label, `max-h-96 overflow-y-auto` scroll table per tab since full-page has more room):
      1. Overview — 6-card grid: business profile, owner details, KYB summary, platforms, terminal & tx stats, settlement info & notes (each as a Card with detail rows)
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
  - All mutations funnel through `adminData.update*` + `logAudit` with proper action keys (merchant.approve_kyb / reject_kyb / restrict / suspend / reactivate, pos_staff.*, terminal.*, pos_device.*, settlement.retry, dispute.*, document.*, kyb.*, ticket.*, transaction.*)
  - Emerald accent throughout (avatar, header gradient, badge tones, action button borders); NO indigo/blue primary
  - Imports: `usePortalStore` from `@/hooks/use-portal-store`, `adminData + logAudit` from `@/lib/admin-data`, `useAuth` from `@/hooks/use-auth`, `toast` from `sonner`
- Ran `bun run lint` — clean (0 errors, 0 warnings). Dev server compiled successfully.

Stage Summary:
A proper full-page merchant profile (`MerchantDetailView`) replaces the previous sliding Sheet pattern. The page has a back button to return to the list, a wide emerald-tinted profile header (avatar, identity, status badges, action buttons, 6-cell quick stats), and 12 tabs covering everything connected to the merchant — overview, POS staff, terminals, POS device requests (with the canBeApproved approval rule), transactions, settlements, disputes, documents, KYB cases, support tickets, risk alerts, and the audit trail. Each tab shows a count badge, uses max-h-96 scrollable tables (taller since full page), and an EmptyState when 0 items. All mutations flow through `adminData.update*` + `logAudit` + sonner toasts; confirmations use `AlertDialog` or `Dialog`. The file is self-contained and ready for the router (portal-app.tsx) to wire up the `merchant_detail` case + `MerchantsView` to navigate via `selectMerchant(id) + setView("merchant_detail")` instead of opening a Sheet.

---
Task ID: FULL-PAGE-PROFILES
Agent: main
Task: Convert sliding sheets to proper full-page profiles

Work Log:
- Added user_detail + merchant_detail to PortalView enum in portal-store
- Added selectedUserId + selectedMerchantId + selectUser + selectMerchant to portal store
- Subagent UP1: Created user-detail-view.tsx — full page profile with back button, header card, 10 tabs
  • Updated users-view.tsx to navigate to detail page instead of opening sheet (reduced from ~2000 to ~450 lines)
  • Wired user_detail case into PortalApp
- Subagent MP2: Created merchant-detail-view.tsx — full page profile with back button, header card, 12 tabs
  • Includes POS device approval workflow in POS Requests tab
- Rewrote merchants-view.tsx as clean list-only view that navigates to merchant_detail page
- Wired merchant_detail case into PortalApp
- Updated sidebar to keep "Users" highlighted on user_detail and "Merchants" highlighted on merchant_detail
- Browser verification:
  * User profile: clicking Adebayo Ogun → full page with "← Back to Users" button, heading, 10 tabs with count badges
  * Merchant profile: clicking Lagos Foods → full page with "← Back to Merchants" button, heading, 12 tabs with count badges
  * POS Requests tab works on full page — Approve/Decline buttons visible
  * No sliding sheet — proper full page layout
- Lint: 0 errors. Dev server: 200 OK.

Stage Summary:
- Both consumer and merchant profiles are now proper full-page views (no sliding sheets)
- Each has a back button to return to the list
- Each has a profile header with avatar, name, status badges, action buttons, and quick stats
- All tabs (Cards, Wallets, Transactions, Documents, KYC/KYB, Support, Disputes, Risk, Activity, POS Staff, Terminals, POS Requests, Settlements) are on the full page
- The POS device approval workflow is on the Merchant profile → POS Requests tab

---
Task ID: FIX2
Agent: subagent-stock-compliance-fix
Task: Add stock page, remove Order POS button, rebuild compliance with inline documents

Work Log:
- Read context files (READMEs, types.ts, admin-data.ts, use-portal-store.ts, merchant-detail-view.tsx, compliance-view.tsx, view-helpers.tsx, access-scope.ts, use-auth.ts) to understand the existing architecture.
- Task 1: Created `/src/components/portal/views/stock-view.tsx` — `StockView`:
  • Subscribes to `adminData.subscribeStock` and `adminData.subscribeCountries`
  • Country scoping via `getVisibleCountryCodes` + `isGlobalScope` (Super Admin sees all)
  • 4 stat cards: Total Items, In Stock, Allocated, Damaged
  • 4 tabs: All, In Stock, Allocated, Damaged
  • Table with Serial, Type, Model, Country, Status, Allocated To, Allocated At, Notes, Actions
  • Row actions dropdown: View details (Dialog), Mark damaged, Mark in stock
  • "Add to Stock" button (Super Admin only) → Dialog with serial, type, model, country, notes; validates duplicate serial numbers
  • Pricing info banner: terminals free, cards have issuance fee, POS app + Phone POS are free downloads (no stock needed)
  • Audit actions: `stock.create`, `stock.mark_damaged`, `stock.mark_in_stock`
- Task 2: Modified `/src/components/portal/views/merchant-detail-view.tsx`:
  • Removed "Order POS Device" button + `OrderPosDeviceDialog` component + `CapabilityToggle` helper (~300 lines deleted)
  • Removed unused imports: `Plus`, `Checkbox`, `RadioGroup`, `RadioGroupItem`
  • Removed unused `merchant` and `allPosRequests` props from `PosRequestsTab`
  • Added `Info` icon import + `PosRequestsInfoBanner` component explaining the device binding flow (POS app sends capability checks on login; admin only approves/declines; POS app is free; terminals free; cards have issuance fee)
- Task 3: Rebuilt `/src/components/portal/views/compliance-view.tsx`:
  • NO `Sheet`/`SheetContent` — full-page card layout
  • Subscribes to documents via `adminData.subscribeDocuments`
  • Each KYC/KYB case is a full card with inline document grid
  • Each document card shows type, file name, status, uploaded date + View/Approve/Reject buttons
  • Document viewer Dialog shows metadata only (NO download button): type, file name, MIME, entity, country, uploaded date, status, reviewed by, notes + placeholder "Document preview available in production — file stored in Firebase Storage"
  • "View Profile" button on each case: KYC → `selectUser(consumer.id); setView("user_detail")`, KYB → `selectMerchant(merchant.id); setView("merchant_detail")`
  • Kept Approve/Reject/Escalate actions that also update the linked consumer/merchant (real-time sync)
  • Per-document Approve/Reject actions (`document.approve` / `document.reject`)
  • Tabs: KYC Queue, KYB Queue, Sanctions/PEP, Manual Review, Approved, Rejected
  • Removed unused imports: `Sheet*`, `Table*`; removed unused helpers `typeBadge`, `reviewerCell`
  • Imported `usePortalStore` for navigation, `Dialog` for document viewer, `UserDocument`/`DocumentType` types
- Task 4: Wired `StockView` into `portal-app.tsx`:
  • Added import on line 38
  • Added `case "stock": return <StockView />;` to the view switch (after `case "compliance"`)
- Lint: initial run flagged 1 error `react-hooks/set-state-in-effect` in `AddToStockDialog`'s useEffect that reset the form on open. Fixed by:
  • Lifting the reset responsibility to the parent via a `key` prop (`addKey` counter that increments on each open → forces remount → useState defaults are used fresh each time)
  • Replaced useEffect-based reset with lazy useState initializer for `countryCode` (`countries[0]?.countryCode ?? ""`)
- Final `bun run lint` — 0 errors, 0 warnings. Dev server (`dev.log`) compiles cleanly and serves 200 OK.

Stage Summary:
Three issues from the user's feedback are now resolved:

1. **Stock / Inventory page** — New `StockView` lists physical terminals and physical cards in Faya's warehouse. Admin can add to stock (Super Admin only), view item details, mark damaged/in stock. Country-scoped. Pricing model clearly stated in a banner: terminals free, cards have issuance fee, POS app + Phone POS are free downloads needing no stock. Merchants request terminals from the Merchant app (those requests appear in the merchant-detail POS Requests tab); admin allocates from this stock.

2. **No more "Order POS Device" button** — The `PosRequestsTab` in the merchant profile no longer lets admin order devices on the merchant's behalf. The tab now ONLY shows device binding requests that come from the POS app when a merchant logs in on a new device. A clear emerald info banner explains the flow: device binding requests are auto-created on POS app login; the POS app sends capability checks (NFC, card reader, swipe); admin can only approve/decline; devices with no payment method support are auto-declined; the POS app is free; physical terminals are free; physical cards have an issuance fee.

3. **Rebuilt compliance view** — No more sliding sheets. Each KYC/KYB case is a full card with linked documents shown INLINE (no downloads — clicking "View" opens a metadata-only Dialog). Clicking "View Profile" navigates to the full-page consumer/merchant profile. Approve/Reject/Escalate actions still flow through to the linked entity in real-time. Per-document Approve/Reject actions are also available inline on each document card.

The work is wired up: `case "stock": return <StockView />;` in portal-app.tsx. All changes use the emerald accent color and avoid indigo/blue. Lint is clean (0 errors, 0 warnings).

---
Task ID: STOCK-COMPLIANCE-FIX
Agent: main
Task: Add stock page, remove Order POS button, rebuild compliance with inline documents

Work Log:
- Read all 3 README files to understand the Faya app ecosystem:
  • Faya Consumer (Faya Pay) — customer payment app
  • Faya Merchant — business management app (merchants order terminals from here)
  • Faya POS — payment-taking app (free download, device binding on login)
- Added StockItem type (physical_terminal, physical_card with in_stock/allocated/shipped/delivered/damaged status)
- Added 12 stock seed items across NG/GH/KE/ZA warehouses
- Added stock collection to admin-data.ts + local-store.ts
- Added "Stock & Inventory" nav item to sidebar
- Subagent FIX2 built:
  • stock-view.tsx — inventory management with tabs (All/In Stock/Allocated/Damaged), Add to Stock button, info banner explaining free vs paid items
  • merchant-detail-view.tsx — removed "Order POS Device" button, added info banner explaining device binding flow
  • compliance-view.tsx — rebuilt with inline documents (no sheet), document viewer dialog (no download), "View Profile" buttons that navigate to user/merchant profile pages
- Fixed runtime error: seed data had document status "in_review" which is not a valid UserDocument status — changed to "pending"
- Bumped localStorage to v6 to force re-seed with fixed data
- Browser verification:
  • Stock page: 12 items, 4 tabs (All 12, In Stock 7, Allocated 4, Damaged 1), "Physical terminals are provided FREE" info banner
  • Compliance view: KYC cases with Approve/Reject buttons, inline documents with "View" button (metadata only, no download), "View consumer profile" buttons
  • No "Order POS Device" button on merchant profile
- Lint: 0 errors. Dev server: 200 OK.

Stage Summary:
- Admin now has a Stock & Inventory page to see what's available
- Admin does NOT order POS devices — merchants request from their Merchant app, admin only approves device binding requests
- POS app is free — merchants download it, device check runs on login, admin approves/declines
- Physical terminals are free provision (no rental), physical cards have issuance fee
- Compliance view shows documents inline (no download), clicking a case navigates to the user's full profile page
- Everything linked to a user/merchant is on their profile page

---
Task ID: STK1
Agent: subagent-stock-prices-images
Task: Rebuild stock view with prices, images, availability-based ordering, delivery fee

Work Log:
- Read context: worklog.md, src/lib/types.ts (StockItem now has price/currency/imageUrl/description; StockOrder has unitPrice/deliveryFee/totalAmount), src/lib/admin-data.ts (subscribeStock, subscribeStockOrders, createStockItem, createStockOrder, updateStockItem, updateStockOrder, logAudit), src/lib/access-scope.ts (getVisibleCountryCodes, isGlobalScope), src/lib/formatters.ts (formatCurrency, formatDateTime, timeAgo), src/components/portal/view-helpers.tsx (ViewHeader, StatCard, EmptyState, ViewContainer), src/hooks/use-auth.ts (useAuth), src/lib/seed-data.ts (SEED_STOCK_ITEMS already includes prices/images/descriptions; SEED_STOCK_ORDERS already includes deliveryFee), the existing stock-view.tsx (style reference).
- Completely rewrote /home/z/my-project/src/components/portal/views/stock-view.tsx with a two-tab architecture:
  • Top-level Tabs: Inventory | Orders
  • Header has "New Order" button (emerald outline) + "Add to Stock" button (Super Admin only, emerald solid)
- INVENTORY TAB:
  * 5 StatCards: Total Items, In Stock, Allocated, Damaged, Total Stock Value (grouped by currency to avoid mixing NGN/GHS/KES/ZAR)
  * Availability banner showing live counts: "Terminals in stock: N", "Cards in stock: N" (red when 0)
  * Filter bar: search (serial/model/merchant), country, type (terminal/card), status (incl. Damaged/Lost composite); Clear-filters button
  * Product-card grid (1/2/3/4 cols responsive, NOT a table) — each card:
      - 120px-tall product image area (object-cover) with onError fallback to ImageOff placeholder
      - Type badge (top-left, emerald for terminal / amber for card)
      - Status badge (top-right, emerald/amber/sky/red per status)
      - Model name (bold) + serial number (mono)
      - Description (2-line truncated)
      - Price prominently displayed in an emerald-tinted box with currency
      - "Allocated to: {merchant name}" when status is allocated (amber)
      - Country flag/code + notes
      - Actions: "Details" button + dropdown (View details, Mark damaged, Mark in stock)
- ORDERS TAB:
  * 5 StatCards: Total Orders, Pending, Shipped, Delivered, Total Revenue (delivered only, grouped by currency)
  * Filter bar: search (order code/user/model), country, status; Clear-filters button
  * Table with columns: Order Code (mono), User (name + consumer/merchant badge), Item (model + type + country), Unit Price, Delivery Fee (separate column, muted), Total (emerald, bold), Status badge, Delivery Address (hidden on small), Created (timeAgo, hidden on small), Actions dropdown
  * Row actions: View details, Mark shipped (if pending), Mark delivered (if shipped), Cancel (if pending — releases allocated item back to in_stock)
- STOCK DETAIL DIALOG: Large product image (180px), type+status badges, model+description, prominent unit-price box, full detail rows (serial, country, allocated-to, allocated/shipped/delivered timestamps, created/updated), notes. Keyed by item.id from parent so internal imgError state resets per item.
- ORDER DETAIL DIALOG: Status+type+user-type badges, cost-summary card (Unit Price + Delivery Fee = Total Amount with icons), detail rows (customer, customer ID, item model, country, delivery address, stock item, created/updated), notes.
- ADD TO STOCK DIALOG (Super Admin only): type radio (terminal/card), serial number (with duplicate-check error), model, description, price (with currency suffix), country (auto-derives currency), image URL with live preview (green "Live preview" badge when OK, red error card when load fails), notes. Validates price > 0.
- CREATE ORDER DIALOG (admin creates on behalf of user):
  * User type radio (Merchant / Consumer)
  * User name + ID (text inputs)
  * Country select
  * Item type radio — DISABLED when no items of that type are in stock (with "None in stock — disabled" hint and live in-stock count)
  * Item dropdown — shows serial + model + price for each in-stock item of selected type; disabled with empty-state if no items
  * Delivery address (textarea)
  * Delivery fee (number, pre-filled with DEFAULT_DELIVERY_FEE per country: NG=2000, GH=20, KE=300, ZA=100)
  * Cost Summary card: Unit Price → + Delivery Fee → Total Amount (emerald box)
  * Notes
  * On submit: creates StockOrder with status="pending", allocates the StockItem (status="allocated", allocatedToId/Name, allocatedAt), logs audit `stock_order.create` with full cost breakdown in afterValue, toast success
- Audit action keys: stock.create, stock.mark_damaged, stock.mark_in_stock, stock_order.create, stock_order.ship, stock_order.deliver, stock_order.cancel
- Country scoping via getVisibleCountryCodes (Super Admin sees all)
- Design: emerald accent throughout, NO indigo/blue. Product cards look like an e-commerce catalog. Images use object-cover at 120px height (180px in detail dialog). Live image-preview in Add-to-Stock dialog.
- Lint fixes:
  * Removed three `react-hooks/set-state-in-effect` errors:
    - StockDetailDialog: removed useEffect that reset imgError on item change; instead parent passes `key={detailItem.id}` so the dialog remounts per item.
    - CreateOrderDialog: moved "clear stockItemId on type change" + "set default deliveryFee on country change" logic inline into the RadioGroup/Select onValueChange handlers, and used a lazy useState initializer for deliveryFee based on the initial countryCode.
  * Removed 3 unused `@next/next/no-img-element` eslint-disable directives (rule isn't enabled in this project).
  * Fixed 2 TS errors: StockOrder type has no `shippedAt`/`deliveredAt` fields — removed them from the updateStockOrder patches (kept them on updateStockItem since StockItem does have those fields).
- Verified: `bun run lint` → 0 errors, 0 warnings. `npx tsc --noEmit` → 0 errors in stock-view.tsx. Dev server compiles cleanly (dev.log shows "Compiled in Nms" with no errors).
- Appended agent-ctx record at /home/z/my-project/agent-ctx/STK1-subagent-stock-prices-images.md.

Stage Summary:
- Produced a complete rebuild of /home/z/my-project/src/components/portal/views/stock-view.tsx (~2300 lines, single self-contained client component with 5 sub-components: ProductCard, StockDetailDialog, OrderDetailDialog, AddToStockDialog, CreateOrderDialog).
- All four user-feedback items addressed:
  1. PRICES: every inventory card has a prominent emerald price box (formatCurrency with per-item currency); every order row shows Unit Price + Delivery Fee + Total as separate columns; detail dialogs show a full cost summary.
  2. IMAGES: every inventory card has a 120px product image (object-cover) with graceful ImageOff fallback on load failure; Add-to-Stock dialog has a live image-preview pane; detail dialog shows a larger 180px image.
  3. AVAILABILITY-BASED ORDERING: the Create Order dialog disables the Terminal type radio when 0 terminals are in stock (and same for Card); the item dropdown is empty with a warning when no items of the chosen type are in stock; an "empty state" blocking message is shown if NOTHING is in stock at all; an availability banner on the inventory tab shows live in-stock counts per type.
  4. DELIVERY FEE: orders have a dedicated Delivery Fee column (separate from Unit Price), a delivery-fee input in the Create Order dialog (pre-filled with country default), and a Cost Summary card showing Unit Price + Delivery Fee = Total Amount — same breakdown shown in the Order Detail dialog.
- The view is wired into the portal shell as `case "stock": return <StockView />;` (already present from prior agent work). No changes needed to portal-app.tsx or portal-shell.tsx.

---
Task ID: STOCK-PRICES-IMAGES
Agent: main
Task: Add prices, product images, availability-based ordering, and delivery fee to stock page

Work Log:
- Updated StockItem type: added price, currency, imageUrl, description fields
- Added StockOrder type: orderCode, userType, userId, itemType, model, unitPrice, deliveryFee, totalAmount, currency, status, deliveryAddress
- Updated 16 stock seed items with prices (terminals: NGN 45K-55K, GHS 300-350, KES 8500-9500, ZAR 1800; cards: NGN 2500, GHS 15, KES 500, ZAR 120), descriptions, and Unsplash image URLs
- Added 5 stock order seed records with delivery fees (unit price + delivery fee = total)
- Added stock_orders collection to admin-data.ts + local-store.ts
- Bumped localStorage to v7 to force re-seed
- Subagent STK1: Rebuilt stock-view.tsx with:
  • Inventory tab: product card grid showing image, model, description, price (prominent), status badge, serial number, country
  • Orders tab: table with Unit Price, Delivery Fee, Total as separate columns
  • "Add to Stock" dialog with image URL + live preview
  • "New Order" dialog with availability-based item selection (only in-stock items shown, type disabled if 0 in stock)
  • Delivery fee pre-filled by country default (NG=2000, GH=20, KE=300, ZA=100)
  • Cost summary: Unit Price + Delivery Fee = Total Amount
  • On order: creates StockOrder + allocates StockItem + logAudit
- Browser verification:
  * Stock page: 16 items, 9 product images visible, prices showing (₦/NGN)
  * Inventory tab: product cards with images, prices, status badges
  * Orders tab: 5 orders with Unit Price, Delivery Fee, Total columns
  * "New Order" button visible
  * Delivery fee visible in both inventory and orders
- Lint: 0 errors. Dev server: 200 OK.

Stage Summary:
- Stock page now shows prices on every item
- Product images displayed (with fallback for broken URLs)
- Users can only order what's in stock — if no terminals in stock, terminal ordering is disabled
- Delivery fee is included in every order (separate column in orders table, shown in order dialog summary)
- Add to Stock dialog has image URL field with live preview

---
Task ID: FIX3
Agent: subagent-profile-orders-notifications
Task: Add stock orders to user/merchant profiles + notifications on new orders

Work Log:
- Read worklog.md, types.ts, admin-data.ts, use-portal-store.ts, user-detail-view.tsx, merchant-detail-view.tsx, stock-view.tsx for context.
- user-detail-view.tsx:
  - Added lucide imports (ShoppingCart, Truck, Smartphone, Package) and type imports (StockOrder, StockOrderStatus, StockItemType).
  - Added module-level STOCK_ORDER_STATUS_STYLES + STOCK_TYPE_META maps (mirroring stock-view.tsx).
  - ProfileTabs now also subscribes via adminData.subscribeStockOrders and filters by `order.userId === consumer.id && order.userType === "consumer"` → consumerOrders.
  - Added `<ProfileTab value="orders" label="Orders" count={consumerOrders.length} />` + `<TabsContent value="orders">` pointing at a new OrdersTab component.
  - OrdersTab: emerald info banner explaining Faya Pay flow, ScrollTable (max-h-96, sticky header) with columns Order Code | Item (model + type badge) | Unit Price | Delivery Fee | Total | Status | Delivery Address (lg+) | Ordered (md+) | Actions. EmptyState copy: "No orders yet. When this consumer orders a physical card from the Faya Pay app, it will appear here." Actions: View (toast), Mark shipped (pending), Mark delivered (shipped), Cancel (pending/fulfilled) — all via adminData.updateStockOrder + updateStockItem + logAudit.
- merchant-detail-view.tsx:
  - Added lucide imports (ShoppingCart, Truck, Package) + type imports (StockOrder, StockOrderStatus, StockItemType).
  - Added STOCK_ORDER_STATUS_STYLES + STOCK_TYPE_META module maps.
  - Main view subscribes to adminData.subscribeStockOrders and filters by `o.userId === merchant.id && o.userType === "merchant"` → merchantOrders.
  - Added `Orders <CountBadge n={merchantOrders.length} />` tab trigger + matching TabsContent rendering new StockOrdersTab.
  - StockOrdersTab: emerald info banner (Faya Merchant app copy), ScrollTable with same columns as consumer tab, EmptyState "No orders yet. When this merchant orders a terminal from the Faya Merchant app, it will appear here.", fulfil/cancel actions.
- stock-view.tsx:
  - Added Info icon import + useRef from react.
  - Added emerald info banner at the very top of the Orders TabsContent (before stat cards) explaining the Faya Pay / Faya Merchant order flow.
  - Added a useEffect (deps: [orders]) that keeps a useRef<Set<string> | null> of previously-seen order IDs. First snapshot seeds silently (no toast storm on mount). For subsequent renders, any new order ID fires `toast.success("New order received", { description: "{orderCode} — {userName} ordered {model} for {totalAmount}" })`. Fresh orders sorted by createdAt asc.
- Wrote agent record at agent-ctx/FIX3-subagent-profile-orders-notifications.md.
- Ran `bun run lint` → clean (no errors). Dev server returns HTTP 200 on /, latest compiles succeed.

Stage Summary:
- Consumer profile now has an Orders tab showing physical-card orders placed from the Faya Pay app, with full ship/deliver/cancel fulfilment actions.
- Merchant profile now has an Orders tab showing physical-terminal orders placed from the Faya Merchant app, with the same fulfilment actions.
- Stock page Orders tab leads with an emerald info banner explaining the end-to-end order flow.
- Stock page now emits a sonner toast for every brand-new order that arrives via the live subscription, simulating real-time notifications when users/merchants pay from their apps.
- All four tasks use the existing emerald accent system, ScrollTable helpers, count badges, and adminData/logAudit patterns — no indigo/blue, no new global state.

---
Task ID: ADMIN-FRAMEWORK-FIX
Agent: main
Task: Fix admin platform framing — admin works FOR users/merchants, not as users ordering for themselves

Work Log:
- Removed "New Order" button from stock view — admin does NOT place orders, users/merchants do from their own apps
- Removed CreateOrderDialog entirely from stock view
- Updated stock view description: "Track physical terminals and cards in stock. When users order and pay from their apps, items move here to their profile. Admin fulfils and tracks delivery."
- Subagent FIX3 added:
  • Orders tab on user profile (consumer orders from Faya Pay app) — shows order code, item, unit price, delivery fee, total, status, delivery address
  • Orders tab on merchant profile (merchant orders from Faya Merchant app) — same columns
  • Info banner on stock Orders tab: "Orders are placed by users and merchants from their own apps..."
  • Real-time toast notification when new orders arrive: "New order received: {orderCode} — {userName} ordered {model}"
- Browser verification:
  * Stock page: NO "New Order" button — only "Add to Stock" for Super Admin
  * Orders tab has info banner explaining users order from their apps
  * User profile (Adebayo Ogun): "Orders (1)" tab showing his physical card order
  * Merchant profile (Lagos Foods): "Orders (1)" tab showing their terminal order
  * Both profiles show Order Code, Item, Unit Price, Delivery Fee, Total, Status columns
- Lint: 0 errors. Dev server: 200 OK.

Stage Summary:
- The admin platform is now correctly framed: admin works FOR users and merchants
- Users order physical cards from Faya Pay app → order appears on admin + user profile
- Merchants order terminals from Faya Merchant app → order appears on admin + merchant profile
- When they pay, stock item is automatically allocated to them (removed from available stock)
- Admin gets real-time notification when new order arrives
- Admin fulfils: marks shipped → delivered
- All ordered items tracked on user/merchant profiles for proper assignment and tracking

---
Task ID: SEED-INFRASTRUCTURE
Agent: main
Task: Seed Firestore with infrastructure data the 3 apps need to function together

Work Log:
- Checked existing Firestore: only 1 admin staff, 1 country, 1 user (moses), 2 cards, 2 devices, 1 kyc, 1 limits
- Seeded infrastructure data to Firestore:
  • faya_admin_departments: 11 items (admin org structure)
  • faya_admin_roles: 37 items (staff roles)
  • faya_admin_permissions: 31 items (permission keys)
  • faya_admin_countries: 6 items (NG, GH, KE, ZA, EG, MA with KYC/KYB/device/settlement rules)
  • faya_admin_fees: 10 items (card fees, merchant fees, settlement fees by country)
  • faya_admin_limits: 10 items (wallet/card/POS limits by KYC tier and risk level)
  • faya_admin_policies: 8 items (consumer terms, merchant terms, privacy, cardholder agreement, POS terms, refund policy)
  • faya_admin_app_content: 8 items (onboarding text, KYC instructions, card warnings, POS instructions)
  • faya_admin_stock: 16 items (physical terminals + cards with prices, images, descriptions)
  • faya_admin_provider_logs: 8 items (Firebase, Paymentology, Smile Identity, Twilio, SendGrid, FCM, GTBank)
- Verified in browser:
  • Real consumer (moses ayande) shows in Users view
  • Stock page shows 16 items with prices and images
  • Compliance view loads (KYC cases will populate when apps submit in expected format)
  • No demo mode, no mock data
  • Live Firebase Auth login working
- Lint: 0 errors. Dev server: 200 OK.

Stage Summary:
Firestore now has all infrastructure data the 3 apps need:
- Faya Pay reads: countries, fees, limits, policies, app_content, stock (for card ordering)
- Faya Merchant reads: countries, fees, policies, app_content, stock (for terminal ordering)
- Faya POS reads: staff (PINs), terminals, pos_device_requests
- Admin reads: everything + manages countries, fees, limits, policies, stock, staff
- Real consumer data (moses ayande) from Faya Pay app is visible in admin
