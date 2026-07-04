# Task V3 — Build 11 remaining views

**Agent:** subagent-remaining-views
**Task ID:** V3
**Task:** Replace existing stub files with full implementations for: POS Staff, Documents, Terms & Policies, App Content, Notifications, Fees, Limits, Reports, Provider Logs, Webhook Logs, System Settings.

## Context reviewed
- `/home/z/my-project/worklog.md` (previous agents — country scoping, access-scope helpers, local-store fallback, etc.)
- `/home/z/my-project/src/lib/types.ts` — domain types (PosStaff, UserDocument, LegalPolicy, AppContent, NotificationCampaign, Fee, Limit, ProviderLog, WebhookLog, SystemSettings)
- `/home/z/my-project/src/lib/admin-data.ts` — subscribe/mutate helpers + `upsert`/`COLLECTIONS`/`subscribe`/`logAudit` exports
- `/home/z/my-project/src/lib/access-scope.ts` — getVisibleCountries, getVisibleCountryCodes, getScopeLabel, isGlobalScope
- `/home/z/my-project/src/lib/formatters.ts` — formatCurrency, formatDateTime, formatDate, timeAgo, formatNumber, formatCompact
- `/home/z/my-project/src/lib/seed-data.ts` — SEED_POS_STAFF, SEED_DOCUMENTS, SEED_POLICIES, SEED_APP_CONTENT, SEED_NOTIFICATIONS, SEED_FEES, SEED_LIMITS, SEED_PROVIDER_LOGS, SEED_WEBHOOK_LOGS, SEED_SYSTEM_SETTINGS
- `/home/z/my-project/src/components/portal/view-helpers.tsx` — ViewHeader, StatCard, EmptyState, ViewContainer
- `/home/z/my-project/src/components/portal/views/dashboard-view.tsx` — emerald-accent style reference, scroll-table pattern, KPI grid
- `/home/z/my-project/src/components/portal/views/compliance-view.tsx` — Sheet detail pattern, DropdownMenu row actions, sonner toaster mount, ScrollTable sticky header
- `/home/z/my-project/src/components/portal/portal-app.tsx` — confirmed all 11 views are wired in `renderView()` switch with zero props

## Files produced (11 view replacements + 1 lib edit)

1. `src/components/portal/views/pos_staff-view.tsx`
2. `src/components/portal/views/documents-view.tsx`
3. `src/components/portal/views/terms-view.tsx`
4. `src/components/portal/views/app_content-view.tsx`
5. `src/components/portal/views/notifications-view.tsx`
6. `src/components/portal/views/fees-view.tsx`
7. `src/components/portal/views/limits-view.tsx`
8. `src/components/portal/views/reports-view.tsx`
9. `src/components/portal/views/provider_logs-view.tsx`
10. `src/components/portal/views/webhook_logs-view.tsx`
11. `src/components/portal/views/system_settings-view.tsx`

Plus a small extension to `src/lib/local-store.ts` to register the `system_settings` collection (was missing from `LOCAL_COLLECTION_MAP` + `SEED_MAP`, which would have prevented `SystemSettingsView` from subscribing via the local fallback).

## Per-view highlights

### pos_staff-view.tsx (§4)
- KPI strip: total / active / suspended / devices assigned / tx today (across scoped staff)
- Filters: search (name/code/email/merchant/branch), country, role, status
- Sticky-header table: staff (name + staffCode), merchant/branch, country, role badge, device (mono terminal serial), status badge, tx today, last login (xl+), dropdown actions
- Row actions (dropdown): View profile, Reset PIN (toast + audit `pos_staff.reset_pin`), Force logout (toast + audit `pos_staff.force_logout`), Remove device (updatePosStaff deviceAssigned=null + audit `pos_staff.remove_device`), Suspend/Reactivate (AlertDialog confirm → updatePosStaff status + audit `pos_staff.suspend` / `pos_staff.reactivate`)
- Detail Sheet: identity grid, merchant card, PIN-hash warning, action buttons
- Country scoping via getVisibleCountryCodes

### documents-view.tsx (§21)
- KPI strip: total / pending / approved / rejected+expired
- Tabs: Pending, Approved, Rejected, All
- Filters: search, country, document type (all 10 DocumentType values)
- Sticky-header table: file/entity, type, country, status, reviewer, uploaded, dropdown
- Row actions: View (masked, audit `document.view`), Approve (Dialog w/ note → updateDocument status=approved + audit `document.approve`), Reject (Dialog w/ required reason → status=rejected + audit `document.reject`), Request replacement (Dialog w/ reason → status=replacement_requested + audit `document.request_replacement`)
- Approve-flow info card explains KYC/KYB feedback to apps

### terms-view.tsx (§5)
- KPI strip: total / published / pending / drafts
- Tabs: Published, Drafts, Pending Approval, Archived, All
- Filters: search, policy type (15 values), app affected (4 values)
- Sticky-header table: title (+country scope badge), type, app, version badge, status badge, effective, updated, dropdown
- Row actions: View content (Sheet), Publish (status=published + audit `policy.publish`), Archive (status=archived + audit `policy.archive`)
- Create Policy dialog (Super Admin only): title, policyType, appAffected, version, country scope, contentBody (textarea, char count), summaryOfChanges; creates as draft + audit `policy.create`
- View Sheet shows full body, summary card, meta, and quick publish/archive actions

### app_content-view.tsx (§6)
- KPI strip: total / published / drafts / languages count
- Filters: search, app, country (global + 6 countries), language (en/fr/ar/sw)
- Sticky-header table: content key (mono emerald) + title, app, country, language, version, status, updated, dropdown
- Row actions: View (Sheet with body preview + meta), Edit (Dialog), Publish (status=published + audit `app_content.publish`)
- Create/Edit Dialog: contentKey, title, app, country, language, version, body — Super Admin only

### notifications-view.tsx (§13)
- KPI strip: total campaigns / sent / scheduled / recipients reached (lifetime)
- Filters: search, channel (5), status (5)
- Sticky-header table: title/body, channel badge (icon), audience, country, status, sent/failed (xl+), created, dropdown
- Row actions: View details (Sheet), Send now (draft/scheduled → sent + simulated delivery counts + audit `notification.send`), Cancel (audit `notification.cancel`)
- Create Campaign dialog (Super Admin only): title, body, channel, audience, country scope, scheduledAt (datetime-local); saves as draft or scheduled
- View Sheet shows body, meta, delivery stats (sent/failed), action buttons

### fees-view.tsx (§14)
- KPI strip: total / active / inactive / countries configured
- Filters: search, country, product (9 products)
- Sticky-header table: country, product, fee type, fee (formatted "X% + CUR N"), effective date, status, dropdown
- Row actions: Edit (Dialog), Activate/Deactivate (audit `fee.activate`/`fee.deactivate`)
- Create/Edit Dialog: country, currency, product, fee type, percentage (number), fixed amount (number), effective date; Super Admin only
- `formatFee` helper renders percentage + fixed amount additively

### limits-view.tsx (§14)
- KPI strip: total / active / inactive / countries
- Filters: search, country, product, KYC tier
- Sticky-header table: country, product, limit type, KYC tier, risk level, max amount (currency-formatted), status, dropdown
- Row actions: Edit, Activate/Deactivate (audit `limit.activate`/`limit.deactivate`)
- Create/Edit Dialog: country, currency, product, limit type, KYC tier, risk level, max amount; Super Admin only
- Info card explaining how limits resolve (most restrictive match wins, `all` tier = fallback)

### reports-view.tsx (§17)
- 13 report cards: user, merchant, kyc, kyb, transaction, settlement, card, wallet, device, dispute, support, audit, regulatory
- Each card has icon, sensitive badge (Lock), category badge, description, "Generate" button
- Audit + Regulatory cards gated to Super Admin (filtered out for non-super)
- Filter by category (Operations/Finance/Compliance/Risk/Audit)
- Generate dialog: format (CSV/Excel/PDF), country scope (limited to visible codes), reason textarea (required for sensitive)
- Submit: `logAudit("report.export", ...)` + success toast; sensitive reason logged
- Read-only info banner about audit/regulatory Super Admin requirement

### provider_logs-view.tsx (§22)
- KPI strip: total providers / operational / degraded / outage / avg uptime / retry queue
- Filters: search (provider/notes), status
- Card grid (md:2 / lg:3): provider name, status badge with pulsing dot (emerald/amber/red), notes, 2x2 metric grid (uptime, error rate, API latency, retry queue), webhook failures, last success, last error (with tooltip showing exact timestamp)
- `Metric` sub-component color-codes by tone (success/warning/danger thresholds)
- Refresh button (toast only — local mode auto-updates)
- Read-only notice: provider management not exposed in portal

### webhook_logs-view.tsx (§23)
- KPI strip: total / processed / received / failed / replayed
- Filters: search (provider/event/entity/error), provider (derived from data), status
- Sticky-header table: provider/event, entity, status badge, received, processed, retries (amber badge if >0), error (truncated, title=full), dropdown
- Row actions: View payload (masked, audit `webhook.view_payload`), Replay (status=replayed + audit `webhook.replay`), Mark resolved (status=processed + audit `webhook.resolve`)
- Info card explaining difference between Replay (re-invoke handler) and Mark resolved (clear alert without re-processing)

### system_settings-view.tsx (§24)
- Read-only gate for non-Super Admins (shows lock screen with explanation)
- Two-column responsive grid of cards: Platform Identity (name, contact email, SLA hours), Maintenance & App Versions (switch + 3 min version inputs), Countries & Currencies (toggle grids), Enabled Products (switch list), Risk Thresholds (high/critical with live preview), Provider Wiring (card/KYC/settlement providers), Legal Versions (terms/privacy)
- Sticky save bar at bottom showing last-saved info + Save button
- Save flow: validation (countries/currencies/products non-empty, valid email, SLA 1-240, thresholds 0-100, critical > high) → AlertDialog confirm (extra warning if maintenance mode on) → `upsert(COLLECTIONS.systemSettings, settings)` + `logAudit("system_settings.update", ...)` with before/after JSON
- "Adjust state during render" pattern (per React docs) used to sync `form` with `settings` subscription without violating `react-hooks/set-state-in-effect` lint rule
- Maintenance-mode red banner when active

### local-store.ts edit
Added `system_settings` collection to `LOCAL_COLLECTION_MAP` and `SEED_MAP` (seeded with `[SEED_SYSTEM_SETTINGS]`). Without this, `subscribe<SystemSettings>(COLLECTIONS.systemSettings, ...)` would have returned an empty array in local mode, leaving SystemSettingsView permanently on defaults.

## Style consistency
All 11 views follow the conventions established by dashboard-view/compliance-view:
- Emerald accent throughout (no indigo/blue primary)
- ViewHeader with emerald-tinted icon tile + dynamic description `… · Your scope: ${getScopeLabel(currentStaff)}`
- KPI StatCard grid (2/3/4/5 columns responsive)
- Filter Card with grid of Select + Search + Clear button (shown only when filters active)
- Sticky-header ScrollTable pattern: `<div className="max-h-[70vh] overflow-auto [&::-webkit-scrollbar]:w-2 …">` wrapping `<table>` with `sticky top-0 z-10 bg-slate-50 …` `<thead>`
- Per-row `DropdownMenu` for actions, with `DropdownMenuLabel` header + `DropdownMenuSeparator` between groups
- Detail `Sheet` for read-only views, `Dialog` for forms, `AlertDialog` for confirmations
- Sonner toaster mounted at end of each view (`<SonnerToaster richColors closeButton position="bottom-right" />`)
- Country scoping via `getVisibleCountryCodes(currentStaff, countries)` for all country-aware views
- Super-Admin gating via `isGlobalScope(currentStaff)` for create/edit/publish actions

## Verification
- `cd /home/z/my-project && bun run lint 2>&1 | tail -30` → 0 errors, 0 warnings (eslint clean across the whole project)
- `cd /home/z/my-project && npx tsc --noEmit 2>&1 | grep -E "(system_settings|pos_staff|documents|terms|app_content|notifications|fees|limits|reports|provider_logs|webhook_logs)-view"` → no output (zero TypeScript errors in any of the 11 new files)
- `cd /home/z/my-project && npx tsc --noEmit 2>&1 | grep -E "(local-store|admin-data)"` → no output (zero TypeScript errors in the touched lib files)
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200; dev.log shows `✓ Compiled in …` / `GET / 200 in …` after every edit; no runtime errors

## Stage summary
All 11 remaining views are now fully implemented and lint-clean. They subscribe to their respective collections via `adminData.subscribe*` (or the generic `subscribe<SystemSettings>(COLLECTIONS.systemSettings, …)` for the singleton settings doc) and to `adminData.subscribeCountries` for country scoping. Every mutation flows through `adminData.update*`/`create*`/`upsert` + `logAudit` with appropriate action keys, before/after values, countryCode, and reason. Super-Admin-only actions are gated via `isGlobalScope(currentStaff)`. Non-Super-Admins see read-only dropdowns ("Read-only — Super Admin only") or a lock screen (System Settings). All views are wired into `portal-app.tsx`'s `renderView()` switch with zero props, so no integrator changes are needed.

The only lib edit was adding `system_settings` to the local-store's `LOCAL_COLLECTION_MAP` + `SEED_MAP` — necessary because the singleton settings doc was missing from the local fallback, which would have prevented `SystemSettingsView` from ever loading persisted settings in local mode.
