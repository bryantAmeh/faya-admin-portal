# Task 9b — Support & Disputes Views

**Agent:** subagent-support-disputes
**Task:** Build `SupportView` (§11.6) and `DisputesView` (§11.7) for the Faya Admin Portal.

## Files Produced

1. `/home/z/my-project/src/components/portal/views/support-view.tsx`
   - Exports `SupportView({ tickets, countries }: { tickets: SupportTicket[]; countries: CountryConfig[] })`
   - 7 tabs: All Tickets / Customer / Merchant / Terminal / Payment / Escalations / SLA Dashboard
   - KPI strip: Open Tickets, Urgent Priority, SLA At Risk, Resolved Today
   - Row actions: Reply (Sheet+Textarea → `support.respond`), Assign (`support.assign`), Escalate (`support.escalate`), Add internal note (toast only), Close (AlertDialog → `support.close`)
   - SLA Dashboard tab: bespoke layout with Breached / At Risk / On Track stat cards + two ScrollTables (breached + approaching)
   - Custom priority badges (urgent/high=red, medium=amber, low=slate), type badges (User/Building2/Smartphone/CreditCard with emerald/amber/sky/purple tints), status badges (open=amber, in_progress=sky, waiting=purple, resolved=emerald, closed=slate), SLA badges (slaStatus-based, "Done" for closed/resolved)
   - Country scoping: Super Admin sees all; others see only `staff.countries` codes

2. `/home/z/my-project/src/components/portal/views/disputes-view.tsx`
   - Exports `DisputesView({ disputes, countries }: { disputes: Dispute[]; countries: CountryConfig[] })`
   - 7 tabs: New Disputes / Awaiting Evidence / Evidence Submitted / Under Review / Won-Lost / Expired / All (each pre-filters `Dispute.status`)
   - KPI strip: Total Disputes, Awaiting Evidence, Win Rate % (won/(won+lost)), Disputed Amount (formatCompact sum + "across N currencies" hint — honest about multi-currency)
   - Row actions: Request evidence (`dispute.request_evidence`), Upload evidence (`dispute.upload_evidence`), Update status… (Dialog with Select → `dispute.update_status`), Escalate fraud (`dispute.escalate_fraud` — toast only, no status mutation), Add note (toast only)
   - Terminal statuses (won/lost/expired) disable lifecycle actions
   - Deadline badges: "Overdue" (red) / "Xd left" (amber if <2d, slate otherwise) / formatDate for terminal statuses
   - Country scoping identical pattern

## Conventions Followed

- Visual style matches `dashboard-view.tsx` + `compliance-view.tsx`: emerald accent throughout, NO indigo/blue primary in chrome (only used once for the `under_review` dispute status badge which is semantically distinct from action colors).
- `ViewHeader` + `ViewContainer` from `view-helpers.tsx`.
- Tables in `Card`s with `max-h-[60vh] overflow-auto`, sticky `<thead>` (raw `<table>` inside a `ScrollTable` wrapper, NOT the Table primitive, so thead sticks to the vertical-scroll viewport — same trick as `compliance-view.tsx`).
- Custom scrollbar: `[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300`.
- `useAuth()` for current staff (`actor.staffId/staffName/department/role` for `logAudit` + country scoping via `departmentId === "dept_super_admin"`).
- All mutations via `adminData.updateTicket` / `adminData.updateDispute` + `logAudit(...)`. Toast feedback via `sonner` on every action.
- `AlertDialog` for destructive confirmations (Close ticket). `Dialog` for the Update-status flow. `Sheet` for the Reply composer. `DropdownMenu` for per-row actions.
- Responsive: less-critical columns hidden at md/lg/xl breakpoints.
- `SonnerToaster` mounted at end of each view (root layout only mounts the shadcn `Toaster`).
- Lucide-react icons: Headphones, Scale, MessageSquare, Send, UserPlus, ArrowUpCircle, XCircle, StickyNote, AlertOctagon, ShieldAlert, Trophy, Gavel, FileText, Upload, RefreshCw, MoreHorizontal, Search, Filter, Clock, AlertTriangle, CheckCircle2, Inbox, Wallet, User, Building2, Smartphone, CreditCard.

## Quality

- `bun run lint` → **zero** errors/warnings in either file.
- `npx tsc --noEmit` → **zero** TS errors in the two new files (only unrelated errors in `examples/` and `skills/`).
- Dev server log: clean, no runtime errors after the new files were added.

## Integration Notes (for the integrator agent)

Render from the Firestore subscriptions when the corresponding nav `view` is active:

```tsx
{view === "support" && <SupportView tickets={tickets} countries={countries} />}
{view === "disputes" && <DisputesView disputes={disputes} countries={countries} />}
```

Both views already subscribe to nothing themselves — they take their data as props (consistent with the other portal views). The portal shell's nav already references both `support` and `disputes` items.
