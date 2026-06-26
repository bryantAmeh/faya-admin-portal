# Task 10 — subagent-governance-views

## Task
Build three views for the Faya Admin Portal:
- `audit-view.tsx` — Audit Logs (spec §13)
- `approvals-view.tsx` — Approval Requests (spec §12)
- `departments-view.tsx` — Departments & Roles (spec §4)

## Work Log
1. Read context: `worklog.md`, `src/lib/types.ts`, `src/lib/admin-data.ts`, `src/lib/formatters.ts`, `src/hooks/use-auth.ts`, `src/components/portal/view-helpers.tsx`, `src/components/portal/views/dashboard-view.tsx`, plus shadcn/ui components (sheet, dialog, alert-dialog, tabs, table, select, badge, button, input, card, separator, progress, tooltip, label, textarea).
2. Reviewed existing views (`staff-view.tsx`, `compliance-view.tsx`, `countries-view.tsx`) and seed-data to align conventions.
3. Created `src/components/portal/views/audit-view.tsx` exporting `AuditView`:
   - ViewHeader with `ScrollText` icon + "Immutable" badge.
   - KPI strip: Logs Today, Unique Actors Today, Failed Logins (24h), Sensitive Actions (24h).
   - Filters card: free-text search (action/entityId/staffName/reason/IP), country select (derived from scoped logs), department select (matches by department name), time-range select (24h/7d/30d/all), action text filter.
   - Audit table inside `max-h-[70vh] overflow-y-auto` with sticky `<thead>` and custom webkit scrollbar styling. Columns: Timestamp (sortable asc/desc, default desc), Staff (name + ID), Department, Role, Country, Action (font-mono + sensitive/failed icons), Entity type, Entity ID, Reason, IP, Device — responsive column hiding on smaller breakpoints.
   - Row click opens right-side Sheet with full detail: meta grid, reason, before/after JSON pretty-printed in `<pre>` blocks (red/emerald-tinted), raw record JSON, "Copy JSON" button.
   - Country scoping: Super Admin sees all; others see logs whose `countryCode === null` (system actions) or matches their `staff.countries` set.
4. Created `src/components/portal/views/approvals-view.tsx` exporting `ApprovalsView`:
   - ViewHeader with `CheckSquare` icon.
   - KPI strip: Pending, Approved (7d), Rejected (7d), My Pending Requests.
   - Tabs: Pending | Approved | Rejected | All (with count badge on Pending).
   - Pending tab renders `ApprovalCard`s showing action (font-mono bold), entity type/ID, country, requested-by + timeAgo, reason, payload (JSON pretty-printed), progress bar (`currentApprovals/requiredApprovals`), and a scrollable decisions list (approver name, decision badge, note, timeAgo).
   - Approve (emerald) / Reject (red outline) buttons open a Dialog requiring a note (≥3 chars). On submit: appends a new decision, increments `currentApprovals` on approve, sets `status="approved"` when threshold reached, sets `status="rejected"` on reject; persists via `adminData.updateApproval`, then `logAudit("approval.approve" | "approval.reject")` with before/after JSON snapshot.
   - Cannot approve own request: buttons rendered inside a disabled group with a Tooltip explaining why.
   - Country scoping: Super Admin sees all; others see approvals matching their assigned countries (or `countryCode === null`).
   - Toasts (sonner) on every action.
5. Created `src/components/portal/views/departments-view.tsx` exporting `DepartmentsView`:
   - ViewHeader with `Building2` icon.
   - KPI strip: Total Departments, Total Roles, Critical-Risk Roles, Total Permissions.
   - Two-column layout (`lg:grid-cols-[1fr_1.5fr]`, stacks on mobile): left = Department cards list with search; right = Role cards list for the selected department with search.
   - Department cards show name, description, status badge, role count, dept id; click selects → emerald highlight ring + filters right column.
   - Role cards show name, description, risk-level badge (`statusBadge("risk", …)` with icon Shield→ShieldX by severity), status badge, permission count (best-effort keyword match), role id, and a "View Permissions" button.
   - "View Permissions" opens a Dialog with a sticky-header Table listing all matching Permission entries: key (font-mono), resource, action, scope, description, status — read-only.
   - Both columns use `max-h-[70vh] overflow-y-auto` with custom scrollbar styling.
6. Visual style matches dashboard-view.tsx — emerald accent throughout, no indigo/blue primary.
7. All three files use `useAuth()` for current-staff context and `adminData.*` + `logAudit` for mutations (audit + approvals; departments view is read-only).
8. Appended entry to `worklog.md` per the task template.

## Stage Summary
- Produced three production-quality views totalling ~1,400 lines:
  - `audit-view.tsx` — searchable/sortable immutable audit trail with detail Sheet and JSON diff.
  - `approvals-view.tsx` — dual-approval workflow with progress bars, decisions history, self-approval guard, and note-required dialogs.
  - `departments-view.tsx` — two-pane department/role browser with read-only permissions dialog.
- All three are ready to be wired into the portal shell by the integrator agent.
- Lint: `bun run lint` reports zero errors in the three new files. The only pre-existing project-wide lint warning is in `src/hooks/use-auth.ts` (react-hooks/set-state-in-effect) — owned by an earlier agent, untouched.
