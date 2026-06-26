"use client";

/**
 * Faya Admin Portal — Support Tickets View (§11.6)
 *
 * Tabs:
 *   - All Tickets      : every ticket in the staff's country scope
 *   - Customer         : pre-filtered to type="customer"
 *   - Merchant         : pre-filtered to type="merchant"
 *   - Terminal         : pre-filtered to type="terminal"
 *   - Payment          : pre-filtered to type="payment"
 *   - Escalations      : pre-filtered to status="in_progress"
 *   - SLA Dashboard    : SLA stats grid + breached-SLA ticket list
 *
 * Country scoping: Super Admin sees all countries; other staff see only the
 * country codes listed on their `staff.countries` access record.
 *
 * Every mutation is mirrored to the audit log via `logAudit(...)` with the
 * action keys: support.respond / support.assign / support.escalate /
 * support.close / support.note (note is toast-only per spec).
 */
import { useMemo, useState } from "react";
import {
  Headphones,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  MessageSquare,
  Send,
  UserPlus,
  ArrowUpCircle,
  XCircle,
  StickyNote,
  MoreHorizontal,
  User,
  Building2,
  Smartphone,
  CreditCard,
  Inbox,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  ViewHeader,
  ViewContainer,
  EmptyState,
  StatCard,
} from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
import { formatDateTime, slaStatus, timeAgo } from "@/lib/formatters";
import type { SupportTicket, CountryConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SupportViewProps {
  tickets: SupportTicket[];
  countries: CountryConfig[];
}

const SUPER_ADMIN_DEPT = "dept_super_admin";

const PRIORITY_OPTIONS = [
  { value: "all", label: "All priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "customer", label: "Customer" },
  { value: "merchant", label: "Merchant" },
  { value: "terminal", label: "Terminal" },
  { value: "payment", label: "Payment" },
] as const;

const TICKET_STATUS_STYLES: Record<
  SupportTicket["status"],
  { label: string; className: string }
> = {
  open: {
    label: "Open",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  },
  waiting: {
    label: "Waiting",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  },
  resolved: {
    label: "Resolved",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  closed: {
    label: "Closed",
    className: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

const PRIORITY_STYLES: Record<
  SupportTicket["priority"],
  { label: string; className: string }
> = {
  urgent: {
    label: "Urgent",
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
  high: {
    label: "High",
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
  medium: {
    label: "Medium",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  low: {
    label: "Low",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

const TYPE_META: Record<
  SupportTicket["type"],
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  customer: {
    label: "Customer",
    icon: User,
    className:
      "text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  },
  merchant: {
    label: "Merchant",
    icon: Building2,
    className:
      "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
  terminal: {
    label: "Terminal",
    icon: Smartphone,
    className:
      "text-sky-700 border-sky-300 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
  },
  payment: {
    label: "Payment",
    icon: CreditCard,
    className:
      "text-purple-700 border-purple-300 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  },
};

type SupportTab =
  | "all"
  | "customer"
  | "merchant"
  | "terminal"
  | "payment"
  | "escalations"
  | "sla";

export function SupportView({ tickets, countries }: SupportViewProps) {
  const { staff: currentStaff } = useAuth();
  const [activeTab, setActiveTab] = useState<SupportTab>("all");

  /* ----------------------- Country scoping ----------------------- */
  const visibleCountryCodes = useMemo(() => {
    if (!currentStaff) return new Set<string>();
    if (currentStaff.departmentId === SUPER_ADMIN_DEPT) {
      return new Set(countries.map((c) => c.countryCode));
    }
    return new Set(currentStaff.countries.map((c) => c.countryCode));
  }, [currentStaff, countries]);

  const isSuperAdmin = currentStaff?.departmentId === SUPER_ADMIN_DEPT;

  const visibleTickets = useMemo(
    () => tickets.filter((t) => visibleCountryCodes.has(t.countryCode)),
    [tickets, visibleCountryCodes],
  );

  const filterableCountries = useMemo(
    () =>
      isSuperAdmin
        ? countries
        : countries.filter((c) => visibleCountryCodes.has(c.countryCode)),
    [countries, isSuperAdmin, visibleCountryCodes],
  );

  /* --------------------------- Filters --------------------------- */
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  /**
   * Apply tab-level pre-filter + user-level filters on top of the
   * country-scoped ticket list.
   */
  const filtered = useMemo(() => {
    let list = visibleTickets;

    // Tab pre-filter
    if (activeTab === "customer" || activeTab === "merchant" || activeTab === "terminal" || activeTab === "payment") {
      list = list.filter((t) => t.type === activeTab);
    } else if (activeTab === "escalations") {
      list = list.filter((t) => t.status === "in_progress");
    } else if (activeTab === "sla") {
      list = list.filter((t) => slaStatus(t.slaDeadline).variant === "danger");
    }

    // User filters
    if (countryFilter !== "all") list = list.filter((t) => t.countryCode === countryFilter);
    if (typeFilter !== "all") list = list.filter((t) => t.type === typeFilter);
    if (priorityFilter !== "all") list = list.filter((t) => t.priority === priorityFilter);
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.subject.toLowerCase().includes(q) ||
          t.requesterName.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q),
      );
    }

    // Sort: urgent priority first, then by SLA deadline (closest first)
    const priorityWeight: Record<SupportTicket["priority"], number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return [...list].sort((a, b) => {
      const pw = priorityWeight[a.priority] - priorityWeight[b.priority];
      if (pw !== 0) return pw;
      return a.slaDeadline - b.slaDeadline;
    });
  }, [visibleTickets, activeTab, countryFilter, typeFilter, priorityFilter, statusFilter, search]);

  /* --------------------- Derived KPI buckets --------------------- */
  const stats = useMemo(() => {
    const openStatuses = new Set(["open", "in_progress", "waiting"]);
    const openCount = visibleTickets.filter((t) => openStatuses.has(t.status)).length;
    const urgentCount = visibleTickets.filter(
      (t) => t.priority === "urgent" && t.status !== "closed",
    ).length;
    const slaAtRisk = visibleTickets.filter((t) => {
      const v = slaStatus(t.slaDeadline).variant;
      return (v === "warning" || v === "danger") && t.status !== "closed";
    }).length;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const resolvedToday = visibleTickets.filter(
      (t) =>
        t.status === "resolved" &&
        t.updatedAt >= startOfToday.getTime(),
    ).length;
    const breached = visibleTickets.filter(
      (t) => slaStatus(t.slaDeadline).variant === "danger" && t.status !== "closed",
    ).length;
    return { openCount, urgentCount, slaAtRisk, resolvedToday, breached };
  }, [visibleTickets]);

  /* --------------------- Detail sheet + dialog ------------------- */
  const [replyTarget, setReplyTarget] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [closeTarget, setCloseTarget] = useState<SupportTicket | null>(null);

  /* --------------------------- Audit actor ----------------------- */
  const actor = useMemo(() => {
    if (!currentStaff) return null;
    return {
      staffId: currentStaff.id,
      staffName: `${currentStaff.firstName} ${currentStaff.lastName}`,
      department: currentStaff.departmentId,
      role: currentStaff.roleId,
    };
  }, [currentStaff]);

  function countryName(code: string): string {
    return countries.find((c) => c.countryCode === code)?.countryName ?? code;
  }

  function assignedToLabel(t: SupportTicket): string {
    if (!t.assignedTo) return "Unassigned";
    if (currentStaff && t.assignedTo === currentStaff.id) return "You";
    return t.assignedTo;
  }

  /* ----------------------- Ticket mutations ---------------------- */
  function openReply(t: SupportTicket) {
    setReplyTarget(t);
    setReplyText("");
  }

  function sendReply() {
    if (!replyTarget) return;
    if (!replyText.trim()) {
      toast.error("Reply is empty", { description: "Enter a message before sending." });
      return;
    }
    if (!actor) return;
    const now = Date.now();
    adminData.updateTicket(replyTarget.id, { updatedAt: now });
    logAudit(actor, "support.respond", "support_ticket", replyTarget.id, {
      countryCode: replyTarget.countryCode,
      afterValue: replyText.slice(0, 240),
    });
    toast.success("Reply sent", {
      description: `Ticket ${replyTarget.id} · ${replyTarget.requesterName}`,
    });
    setReplyTarget(null);
    setReplyText("");
  }

  function assignTicket(t: SupportTicket) {
    if (!actor || !currentStaff) return;
    adminData.updateTicket(t.id, { assignedTo: currentStaff.id, updatedAt: Date.now() });
    logAudit(actor, "support.assign", "support_ticket", t.id, {
      countryCode: t.countryCode,
      beforeValue: t.assignedTo ?? "unassigned",
      afterValue: `${currentStaff.firstName} ${currentStaff.lastName}`,
    });
    toast.success("Ticket assigned to you", {
      description: `${t.id} · ${t.subject}`,
    });
  }

  function escalateTicket(t: SupportTicket) {
    if (!actor) return;
    adminData.updateTicket(t.id, { status: "in_progress", updatedAt: Date.now() });
    logAudit(actor, "support.escalate", "support_ticket", t.id, {
      countryCode: t.countryCode,
      beforeValue: t.status,
      afterValue: "in_progress",
    });
    toast.warning("Ticket escalated", {
      description: `${t.id} moved to in-progress for senior review.`,
    });
  }

  function closeTicket(t: SupportTicket) {
    if (!actor) return;
    adminData.updateTicket(t.id, { status: "closed", updatedAt: Date.now() });
    logAudit(actor, "support.close", "support_ticket", t.id, {
      countryCode: t.countryCode,
      beforeValue: t.status,
      afterValue: "closed",
    });
    toast.success("Ticket closed", {
      description: `${t.id} · ${t.subject}`,
    });
    setCloseTarget(null);
  }

  function addInternalNote(t: SupportTicket) {
    if (!actor) return;
    toast.info("Internal note saved", {
      description: `Note attached to ${t.id} (visible to staff only).`,
    });
  }

  /* ------------------------- Badge helpers ----------------------- */
  function priorityBadge(p: SupportTicket["priority"]): React.ReactNode {
    const s = PRIORITY_STYLES[p];
    return (
      <Badge
        variant="secondary"
        className={cn("text-[10px] font-semibold uppercase tracking-wide gap-1", s.className)}
      >
        {(p === "urgent" || p === "high") && <AlertTriangle className="size-2.5" />}
        {s.label}
      </Badge>
    );
  }

  function statusBadgeNode(s: SupportTicket["status"]): React.ReactNode {
    const b = TICKET_STATUS_STYLES[s];
    return (
      <Badge variant="secondary" className={cn("text-[10px] font-medium", b.className)}>
        {b.label}
      </Badge>
    );
  }

  function typeBadge(type: SupportTicket["type"]): React.ReactNode {
    const m = TYPE_META[type];
    const Icon = m.icon;
    return (
      <Badge
        variant="outline"
        className={cn("text-[10px] font-medium gap-1", m.className)}
      >
        <Icon className="size-2.5" />
        {m.label}
      </Badge>
    );
  }

  function slaBadge(deadline: number, status: SupportTicket["status"]): React.ReactNode {
    if (status === "closed" || status === "resolved") {
      return (
        <Badge
          variant="secondary"
          className="text-[10px] gap-1 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        >
          <CheckCircle2 className="size-2.5" />
          Done
        </Badge>
      );
    }
    const s = slaStatus(deadline);
    const cls =
      s.variant === "danger"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
        : s.variant === "warning"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    return (
      <Badge variant="secondary" className={cn("text-[10px] gap-1 font-medium", cls)}>
        <Clock className="size-2.5" />
        {s.label}
      </Badge>
    );
  }

  function clearFilters() {
    setCountryFilter("all");
    setTypeFilter("all");
    setPriorityFilter("all");
    setStatusFilter("all");
    setSearch("");
  }

  const hasActiveFilters =
    countryFilter !== "all" ||
    typeFilter !== "all" ||
    priorityFilter !== "all" ||
    statusFilter !== "all" ||
    search.trim() !== "";

  /* ----------------------------- Render -------------------------- */
  return (
    <>
      <ViewHeader
        title="Support Tickets"
        description={
          isSuperAdmin
            ? "Triage, assign, escalate and resolve customer / merchant / terminal / payment support tickets across all countries."
            : `Scoped to your countries: ${[...visibleCountryCodes].join(", ") || "—"}`
        }
        icon={Headphones}
      />
      <ViewContainer>
        {/* KPI strip */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard
            label="Open Tickets"
            value={stats.openCount}
            hint="open + in progress + waiting"
            icon={Inbox}
            tone="warning"
          />
          <StatCard
            label="Urgent Priority"
            value={stats.urgentCount}
            hint="non-closed urgent"
            icon={AlertOctagon}
            tone="danger"
          />
          <StatCard
            label="SLA At Risk"
            value={stats.slaAtRisk}
            hint="warning + breached"
            icon={Clock}
            tone="danger"
          />
          <StatCard
            label="Resolved Today"
            value={stats.resolvedToday}
            hint="since midnight"
            icon={CheckCircle2}
            tone="success"
          />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as SupportTab)}
          className="w-full"
        >
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="all" className="text-xs">
              <Headphones className="size-3.5" /> All Tickets
            </TabsTrigger>
            <TabsTrigger value="customer" className="text-xs">
              <User className="size-3.5" /> Customer
            </TabsTrigger>
            <TabsTrigger value="merchant" className="text-xs">
              <Building2 className="size-3.5" /> Merchant
            </TabsTrigger>
            <TabsTrigger value="terminal" className="text-xs">
              <Smartphone className="size-3.5" /> Terminal
            </TabsTrigger>
            <TabsTrigger value="payment" className="text-xs">
              <CreditCard className="size-3.5" /> Payment
            </TabsTrigger>
            <TabsTrigger value="escalations" className="text-xs">
              <ArrowUpCircle className="size-3.5" /> Escalations
            </TabsTrigger>
            <TabsTrigger value="sla" className="text-xs">
              <Clock className="size-3.5" /> SLA Dashboard
            </TabsTrigger>
          </TabsList>

          {/* SLA Dashboard tab — bespoke layout (stats grid + breached list) */}
          <TabsContent value="sla">
            <SlaDashboard
              tickets={visibleTickets}
              breachedCount={stats.breached}
              atRiskCount={stats.slaAtRisk}
              openCount={stats.openCount}
              resolvedToday={stats.resolvedToday}
              priorityBadge={priorityBadge}
              statusBadgeNode={statusBadgeNode}
              typeBadge={typeBadge}
              slaBadge={slaBadge}
              assignedToLabel={assignedToLabel}
              countryName={countryName}
            />
          </TabsContent>

          {/* All other tabs — shared table layout */}
          {(["all", "customer", "merchant", "terminal", "payment", "escalations"] as const).map(
            (tab) => (
              <TabsContent key={tab} value={tab}>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Headphones className="size-4 text-emerald-600" />
                        {tab === "all"
                          ? "All Tickets"
                          : tab === "escalations"
                            ? "Escalations (In Progress)"
                            : `${tab.charAt(0).toUpperCase() + tab.slice(1)} Tickets`}
                        <Badge variant="secondary" className="text-[10px]">
                          {filtered.length}
                        </Badge>
                      </CardTitle>
                      {hasActiveFilters && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFilters}
                          className="h-7 text-xs text-emerald-700"
                        >
                          Clear filters
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="Search subject / requester / ID..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-7 h-8 w-56 text-xs"
                        />
                      </div>
                      <Select value={countryFilter} onValueChange={setCountryFilter}>
                        <SelectTrigger size="sm" className="w-44 text-xs h-8">
                          <Filter className="size-3 mr-1 text-muted-foreground" />
                          <SelectValue placeholder="Country" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All countries</SelectItem>
                          {filterableCountries.map((c) => (
                            <SelectItem key={c.countryCode} value={c.countryCode}>
                              {c.countryCode} · {c.countryName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger size="sm" className="w-36 text-xs h-8">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger size="sm" className="w-36 text-xs h-8">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger size="sm" className="w-36 text-xs h-8">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {filtered.length === 0 ? (
                      <EmptyState
                        icon={Headphones}
                        title="No tickets match"
                        description="Adjust the filters above or switch tabs to see other queues."
                      />
                    ) : (
                      <ScrollTable>
                        <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                          <TableRow>
                            <TableHead className="pl-4">Ticket ID</TableHead>
                            <TableHead className="hidden md:table-cell">Country</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead className="hidden lg:table-cell">Requester</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="hidden xl:table-cell">Assigned</TableHead>
                            <TableHead className="hidden md:table-cell">Created</TableHead>
                            <TableHead>SLA</TableHead>
                            <TableHead className="text-right pr-4">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((t) => {
                            return (
                              <TableRow key={t.id}>
                                <TableCell className="pl-4 font-mono text-xs">
                                  {t.id}
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-xs">
                                  <span className="font-mono">{t.countryCode}</span>
                                  <span className="block text-[10px] text-muted-foreground">
                                    {countryName(t.countryCode)}
                                  </span>
                                </TableCell>
                                <TableCell>{typeBadge(t.type)}</TableCell>
                                <TableCell className="max-w-[280px]">
                                  <div className="text-sm font-medium truncate">
                                    {t.subject}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground lg:hidden">
                                    {t.requesterName}
                                  </div>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-xs">
                                  {t.requesterName}
                                </TableCell>
                                <TableCell>{priorityBadge(t.priority)}</TableCell>
                                <TableCell>{statusBadgeNode(t.status)}</TableCell>
                                <TableCell className="hidden xl:table-cell text-xs">
                                  {assignedToLabel(t) === "Unassigned" ? (
                                    <span className="text-muted-foreground italic">Unassigned</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1">
                                      <User className="size-3 text-emerald-600" />
                                      {assignedToLabel(t)}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                  {timeAgo(t.createdAt)}
                                </TableCell>
                                <TableCell>{slaBadge(t.slaDeadline, t.status)}</TableCell>
                                <TableCell className="text-right pr-4">
                                  <TicketActions
                                    ticket={t}
                                    onReply={() => openReply(t)}
                                    onAssign={() => assignTicket(t)}
                                    onEscalate={() => escalateTicket(t)}
                                    onClose={() => setCloseTarget(t)}
                                    onNote={() => addInternalNote(t)}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </ScrollTable>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ),
          )}
        </Tabs>
      </ViewContainer>

      {/* ------------------- Reply Sheet ------------------- */}
      <Sheet open={!!replyTarget} onOpenChange={(o) => !o && setReplyTarget(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
          {replyTarget && (
            <>
              <SheetHeader>
                <SheetDescription className="text-[11px] font-mono">
                  {replyTarget.id} · {replyTarget.countryCode} · {countryName(replyTarget.countryCode)}
                </SheetDescription>
                <SheetTitle className="text-lg flex items-start gap-2">
                  <MessageSquare className="size-5 text-emerald-600 mt-0.5" />
                  <span className="min-w-0">
                    <span className="block">{replyTarget.subject}</span>
                    <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                      from {replyTarget.requesterName}
                    </span>
                  </span>
                </SheetTitle>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {typeBadge(replyTarget.type)}
                  {priorityBadge(replyTarget.priority)}
                  {statusBadgeNode(replyTarget.status)}
                  {slaBadge(replyTarget.slaDeadline, replyTarget.status)}
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-4 space-y-4 text-sm">
                <div className="rounded-md border divide-y">
                  <DetailRow label="Requester" value={replyTarget.requesterName} />
                  <DetailRow label="Country" value={`${replyTarget.countryCode} · ${countryName(replyTarget.countryCode)}`} />
                  <DetailRow label="Created" value={formatDateTime(replyTarget.createdAt)} />
                  <DetailRow label="Last update" value={formatDateTime(replyTarget.updatedAt)} />
                  <DetailRow label="SLA deadline" value={formatDateTime(replyTarget.slaDeadline)} />
                  <DetailRow
                    label="Assigned to"
                    value={
                      replyTarget.assignedTo
                        ? assignedToLabel(replyTarget)
                        : "Unassigned"
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reply-text" className="text-xs font-medium text-muted-foreground uppercase">
                    Your reply
                  </Label>
                  <Textarea
                    id="reply-text"
                    placeholder="Type your response to the requester..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={8}
                    className="resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Sending updates the ticket&apos;s last-activity timestamp and is recorded in the audit log.
                  </p>
                </div>
              </div>

              <SheetFooter className="flex flex-col gap-2 items-stretch">
                <Button
                  onClick={sendReply}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Send className="size-4" /> Send reply
                </Button>
                <Button variant="ghost" onClick={() => setReplyTarget(null)}>
                  Cancel
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ----------------- Close confirmation ----------------- */}
      <AlertDialog open={!!closeTarget} onOpenChange={(o) => !o && setCloseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to close <strong>{closeTarget?.id}</strong> — &ldquo;{closeTarget?.subject}&rdquo;.
              The requester will be notified and the ticket will no longer appear in open queues.
              This action is recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-slate-700 hover:bg-slate-800 text-white"
              onClick={() => closeTarget && closeTicket(closeTarget)}
            >
              <XCircle className="size-4" /> Close ticket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}

/* ============================ Sub-components ============================ */

/**
 * Scrollable table wrapper with sticky-header support and custom scrollbar.
 * Uses a raw <table> (not the Table primitive) so the <thead> can stick
 * inside this vertical-scroll viewport.
 */
function ScrollTable({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={
        "max-h-[60vh] overflow-auto " +
        "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent " +
        "[&::-webkit-scrollbar-thumb]:rounded-full " +
        "[&::-webkit-scrollbar-thumb]:bg-slate-300 " +
        "dark:[&::-webkit-scrollbar-thumb]:bg-slate-700"
      }
    >
      <table className="w-full caption-bottom text-sm">{children}</table>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm text-right min-w-0">{value}</span>
    </div>
  );
}

function TicketActions({
  ticket,
  onReply,
  onAssign,
  onEscalate,
  onClose,
  onNote,
}: {
  ticket: SupportTicket;
  onReply: () => void;
  onAssign: () => void;
  onEscalate: () => void;
  onClose: () => void;
  onNote: () => void;
}) {
  const isClosed = ticket.status === "closed";
  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Open ticket actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase tracking-wide">
            {ticket.id}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onReply} disabled={isClosed}>
            <MessageSquare className="size-4" /> Reply
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAssign}>
            <UserPlus className="size-4" /> Assign to me
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEscalate} disabled={isClosed}>
            <ArrowUpCircle className="size-4" /> Escalate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onNote}>
            <StickyNote className="size-4" /> Add internal note
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onClose}
            disabled={isClosed}
            variant="destructive"
          >
            <XCircle className="size-4" /> Close ticket
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SlaDashboard({
  tickets,
  breachedCount,
  atRiskCount,
  openCount,
  resolvedToday,
  priorityBadge,
  statusBadgeNode,
  typeBadge,
  slaBadge,
  assignedToLabel,
  countryName,
}: {
  tickets: SupportTicket[];
  breachedCount: number;
  atRiskCount: number;
  openCount: number;
  resolvedToday: number;
  priorityBadge: (p: SupportTicket["priority"]) => React.ReactNode;
  statusBadgeNode: (s: SupportTicket["status"]) => React.ReactNode;
  typeBadge: (t: SupportTicket["type"]) => React.ReactNode;
  slaBadge: (d: number, s: SupportTicket["status"]) => React.ReactNode;
  assignedToLabel: (t: SupportTicket) => string;
  countryName: (code: string) => string;
}) {
  const breached = tickets.filter(
    (t) => slaStatus(t.slaDeadline).variant === "danger" && t.status !== "closed",
  );
  const atRisk = tickets.filter(
    (t) => slaStatus(t.slaDeadline).variant === "warning" && t.status !== "closed",
  );
  const onTrack = tickets.filter(
    (t) => slaStatus(t.slaDeadline).variant === "default" && t.status !== "closed",
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard
          label="SLA Breached"
          value={breachedCount}
          hint="past deadline, not closed"
          icon={AlertOctagon}
          tone="danger"
        />
        <StatCard
          label="SLA At Risk"
          value={atRiskCount}
          hint="&lt; 4h remaining"
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="On Track"
          value={onTrack.length}
          hint="healthy SLA window"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Open Tickets"
          value={openCount}
          hint={`${resolvedToday} resolved today`}
          icon={Inbox}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="size-4 text-red-600" />
            Breached SLA — Immediate Action Required
            <Badge
              variant="secondary"
              className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
            >
              {breached.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {breached.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No SLA breaches"
              description="All open tickets are within their SLA window. Well done!"
            />
          ) : (
            <ScrollTable>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                <TableRow>
                  <TableHead className="pl-4">Ticket ID</TableHead>
                  <TableHead className="hidden md:table-cell">Country</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="hidden lg:table-cell">Requester</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden xl:table-cell">Assigned</TableHead>
                  <TableHead>SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breached.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="pl-4 font-mono text-xs">{t.id}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      <span className="font-mono">{t.countryCode}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {countryName(t.countryCode)}
                      </span>
                    </TableCell>
                    <TableCell>{typeBadge(t.type)}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="text-sm font-medium truncate">{t.subject}</div>
                      <div className="text-[11px] text-muted-foreground lg:hidden">
                        {t.requesterName}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">
                      {t.requesterName}
                    </TableCell>
                    <TableCell>{priorityBadge(t.priority)}</TableCell>
                    <TableCell>{statusBadgeNode(t.status)}</TableCell>
                    <TableCell className="hidden xl:table-cell text-xs">
                      {assignedToLabel(t) === "Unassigned" ? (
                        <span className="text-muted-foreground italic">Unassigned</span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <User className="size-3 text-emerald-600" />
                          {assignedToLabel(t)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{slaBadge(t.slaDeadline, t.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </ScrollTable>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="size-4 text-amber-600" />
            Approaching SLA Deadline
            <Badge
              variant="secondary"
              className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            >
              {atRisk.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {atRisk.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No tickets at risk"
              description="No tickets are within 4 hours of their SLA deadline."
            />
          ) : (
            <ScrollTable>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                <TableRow>
                  <TableHead className="pl-4">Ticket ID</TableHead>
                  <TableHead className="hidden md:table-cell">Country</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="hidden lg:table-cell">Requester</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atRisk.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="pl-4 font-mono text-xs">{t.id}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      <span className="font-mono">{t.countryCode}</span>
                    </TableCell>
                    <TableCell className="max-w-[280px] text-sm font-medium truncate">
                      {t.subject}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">
                      {t.requesterName}
                    </TableCell>
                    <TableCell>{priorityBadge(t.priority)}</TableCell>
                    <TableCell>{statusBadgeNode(t.status)}</TableCell>
                    <TableCell>{slaBadge(t.slaDeadline, t.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </ScrollTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
