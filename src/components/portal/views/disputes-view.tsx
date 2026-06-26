"use client";

/**
 * Faya Admin Portal — Disputes & Chargebacks View (§11.7)
 *
 * Tabs (each pre-filters Dispute.status):
 *   - New Disputes         : status="new"
 *   - Awaiting Evidence    : status="awaiting_evidence"
 *   - Evidence Submitted   : status="evidence_submitted"
 *   - Under Review         : status="under_review"
 *   - Won/Lost             : status in ["won","lost"]
 *   - Expired              : status="expired"
 *   - All                  : no status filter
 *
 * Country scoping: Super Admin sees all countries; other staff see only the
 * country codes listed on their `staff.countries` access record.
 *
 * Every mutation is mirrored to the audit log via `logAudit(...)` with the
 * action keys: dispute.request_evidence / dispute.upload_evidence /
 * dispute.update_status / dispute.escalate_fraud. dispute.add_note is
 * toast-only per spec.
 */
import { useMemo, useState } from "react";
import {
  Scale,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  Trophy,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  FileText,
  Upload,
  MoreHorizontal,
  StickyNote,
  RefreshCw,
  Wallet,
  Gavel,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatCurrency, formatDate, formatCompact, timeAgo } from "@/lib/formatters";
import type { Dispute, CountryConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DisputesViewProps {
  disputes: Dispute[];
  countries: CountryConfig[];
}

const SUPER_ADMIN_DEPT = "dept_super_admin";

const DISPUTE_STATUS_STYLES: Record<
  Dispute["status"],
  { label: string; className: string }
> = {
  new: {
    label: "New",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  awaiting_evidence: {
    label: "Awaiting Evidence",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  },
  evidence_submitted: {
    label: "Evidence Submitted",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  },
  under_review: {
    label: "Under Review",
    className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  },
  won: {
    label: "Won",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  lost: {
    label: "Lost",
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
  expired: {
    label: "Expired",
    className: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

const STATUS_LABELS: { value: Dispute["status"]; label: string }[] = [
  { value: "new", label: "New" },
  { value: "awaiting_evidence", label: "Awaiting Evidence" },
  { value: "evidence_submitted", label: "Evidence Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "expired", label: "Expired" },
];

type DisputeTab =
  | "new"
  | "awaiting_evidence"
  | "evidence_submitted"
  | "under_review"
  | "won_lost"
  | "expired"
  | "all";

export function DisputesView({ disputes, countries }: DisputesViewProps) {
  const { staff: currentStaff } = useAuth();
  const [activeTab, setActiveTab] = useState<DisputeTab>("new");

  /* ----------------------- Country scoping ----------------------- */
  const visibleCountryCodes = useMemo(() => {
    if (!currentStaff) return new Set<string>();
    if (currentStaff.departmentId === SUPER_ADMIN_DEPT) {
      return new Set(countries.map((c) => c.countryCode));
    }
    return new Set(currentStaff.countries.map((c) => c.countryCode));
  }, [currentStaff, countries]);

  const isSuperAdmin = currentStaff?.departmentId === SUPER_ADMIN_DEPT;

  const visibleDisputes = useMemo(
    () => disputes.filter((d) => visibleCountryCodes.has(d.countryCode)),
    [disputes, visibleCountryCodes],
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
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = visibleDisputes;

    // Tab pre-filter
    if (activeTab === "won_lost") {
      list = list.filter((d) => d.status === "won" || d.status === "lost");
    } else if (activeTab !== "all") {
      list = list.filter((d) => d.status === activeTab);
    }

    if (countryFilter !== "all") list = list.filter((d) => d.countryCode === countryFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.merchantName.toLowerCase().includes(q) ||
          d.customerName.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q) ||
          d.reason.toLowerCase().includes(q),
      );
    }

    // Sort: deadline closest first (most urgent on top)
    return [...list].sort((a, b) => a.deadline - b.deadline);
  }, [visibleDisputes, activeTab, countryFilter, search]);

  /* --------------------- Derived KPI buckets --------------------- */
  const stats = useMemo(() => {
    const total = visibleDisputes.length;
    const awaiting = visibleDisputes.filter(
      (d) => d.status === "awaiting_evidence",
    ).length;
    const won = visibleDisputes.filter((d) => d.status === "won").length;
    const lost = visibleDisputes.filter((d) => d.status === "lost").length;
    const decided = won + lost;
    const wonRate = decided > 0 ? (won / decided) * 100 : null;
    // Total disputed amount — disputes use multiple currencies, so we report a
    // currency-neutral sum and the count of distinct currencies in the hint.
    const totalAmount = visibleDisputes.reduce((s, d) => s + d.amount, 0);
    const currencies = new Set(visibleDisputes.map((d) => d.currency));
    return {
      total,
      awaiting,
      won,
      lost,
      wonRate,
      totalAmount,
      currencyCount: currencies.size,
    };
  }, [visibleDisputes]);

  /* --------------------- Update-status dialog -------------------- */
  const [statusTarget, setStatusTarget] = useState<Dispute | null>(null);
  const [pendingStatus, setPendingStatus] = useState<Dispute["status"] | "">("");

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

  /* ----------------------- Dispute mutations --------------------- */
  function requestEvidence(d: Dispute) {
    if (!actor) return;
    adminData.updateDispute(d.id, { status: "awaiting_evidence" });
    logAudit(actor, "dispute.request_evidence", "dispute", d.id, {
      countryCode: d.countryCode,
      beforeValue: d.status,
      afterValue: "awaiting_evidence",
    });
    toast.info("Evidence requested", {
      description: `${d.id} · ${d.merchantName} notified to submit evidence.`,
    });
  }

  function uploadEvidence(d: Dispute) {
    if (!actor) return;
    adminData.updateDispute(d.id, { status: "evidence_submitted" });
    logAudit(actor, "dispute.upload_evidence", "dispute", d.id, {
      countryCode: d.countryCode,
      beforeValue: d.status,
      afterValue: "evidence_submitted",
    });
    toast.success("Evidence uploaded", {
      description: `${d.id} · Marked as evidence_submitted for card scheme review.`,
    });
  }

  function openUpdateStatus(d: Dispute) {
    setStatusTarget(d);
    setPendingStatus(d.status);
  }

  function confirmUpdateStatus() {
    if (!statusTarget || !actor || !pendingStatus) return;
    if (pendingStatus === statusTarget.status) {
      toast.message("No change", { description: "Status is already set to that value." });
      setStatusTarget(null);
      return;
    }
    adminData.updateDispute(statusTarget.id, { status: pendingStatus });
    logAudit(actor, "dispute.update_status", "dispute", statusTarget.id, {
      countryCode: statusTarget.countryCode,
      beforeValue: statusTarget.status,
      afterValue: pendingStatus,
    });
    toast.success("Dispute status updated", {
      description: `${statusTarget.id} → ${DISPUTE_STATUS_STYLES[pendingStatus].label}`,
    });
    setStatusTarget(null);
  }

  function escalateFraud(d: Dispute) {
    if (!actor) return;
    logAudit(actor, "dispute.escalate_fraud", "dispute", d.id, {
      countryCode: d.countryCode,
      beforeValue: d.status,
      afterValue: "fraud_team_review",
      reason: d.reason,
    });
    toast.warning("Escalated to fraud team", {
      description: `${d.id} · ${d.merchantName} — fraud team will investigate.`,
    });
  }

  function addNote(d: Dispute) {
    if (!actor) return;
    toast.info("Internal note saved", {
      description: `Note attached to ${d.id} (visible to staff only).`,
    });
  }

  /* ------------------------- Badge helpers ----------------------- */
  function statusBadgeNode(s: Dispute["status"]): React.ReactNode {
    const b = DISPUTE_STATUS_STYLES[s];
    return (
      <Badge variant="secondary" className={cn("text-[10px] font-medium", b.className)}>
        {b.label}
      </Badge>
    );
  }

  function deadlineBadge(d: Dispute): React.ReactNode {
    if (d.status === "won" || d.status === "lost" || d.status === "expired") {
      return (
        <span className="text-xs text-muted-foreground">{formatDate(d.deadline)}</span>
      );
    }
    const diff = d.deadline - Date.now();
    if (diff < 0) {
      return (
        <Badge
          variant="secondary"
          className="text-[10px] gap-1 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
        >
          <AlertTriangle className="size-2.5" />
          Overdue
        </Badge>
      );
    }
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hrs = Math.floor(diff / (60 * 60 * 1000));
    const isUrgent = days < 2;
    return (
      <Badge
        variant="secondary"
        className={cn(
          "text-[10px] gap-1",
          isUrgent
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        )}
      >
        <Clock className="size-2.5" />
        {days >= 1 ? `${days}d left` : `${hrs}h left`}
      </Badge>
    );
  }

  function clearFilters() {
    setCountryFilter("all");
    setSearch("");
  }

  const hasActiveFilters = countryFilter !== "all" || search.trim() !== "";

  /* ----------------------------- Render -------------------------- */
  return (
    <>
      <ViewHeader
        title="Disputes & Chargebacks"
        description={
          isSuperAdmin
            ? "Manage chargeback disputes, evidence cycles, card-scheme timelines and win/loss outcomes across all countries."
            : `Scoped to your countries: ${[...visibleCountryCodes].join(", ") || "—"}`
        }
        icon={Scale}
      />
      <ViewContainer>
        {/* KPI strip */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard
            label="Total Disputes"
            value={stats.total}
            hint="across visible countries"
            icon={Scale}
            tone="warning"
          />
          <StatCard
            label="Awaiting Evidence"
            value={stats.awaiting}
            hint="merchant action required"
            icon={FileText}
            tone="warning"
          />
          <StatCard
            label="Win Rate"
            value={stats.wonRate === null ? "—" : `${stats.wonRate.toFixed(1)}%`}
            hint={`${stats.won} won · ${stats.lost} lost`}
            icon={Trophy}
            tone={stats.wonRate === null ? "default" : stats.wonRate >= 50 ? "success" : "danger"}
          />
          <StatCard
            label="Disputed Amount"
            value={formatCompact(stats.totalAmount)}
            hint={`across ${stats.currencyCount} ${stats.currencyCount === 1 ? "currency" : "currencies"}`}
            icon={Wallet}
            tone="danger"
          />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as DisputeTab)}
          className="w-full"
        >
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="new" className="text-xs">
              <AlertTriangle className="size-3.5" /> New
            </TabsTrigger>
            <TabsTrigger value="awaiting_evidence" className="text-xs">
              <FileText className="size-3.5" /> Awaiting Evidence
            </TabsTrigger>
            <TabsTrigger value="evidence_submitted" className="text-xs">
              <Upload className="size-3.5" /> Evidence Submitted
            </TabsTrigger>
            <TabsTrigger value="under_review" className="text-xs">
              <Gavel className="size-3.5" /> Under Review
            </TabsTrigger>
            <TabsTrigger value="won_lost" className="text-xs">
              <Trophy className="size-3.5" /> Won/Lost
            </TabsTrigger>
            <TabsTrigger value="expired" className="text-xs">
              <Clock className="size-3.5" /> Expired
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              <Scale className="size-3.5" /> All
            </TabsTrigger>
          </TabsList>

          {(
            [
              "new",
              "awaiting_evidence",
              "evidence_submitted",
              "under_review",
              "won_lost",
              "expired",
              "all",
            ] as const
          ).map((tab) => (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Scale className="size-4 text-emerald-600" />
                      {TAB_LABELS[tab]}
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
                        placeholder="Search merchant / customer / reason / ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-7 h-8 w-64 text-xs"
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
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {filtered.length === 0 ? (
                    <EmptyState
                      icon={Scale}
                      title="No disputes match"
                      description="Adjust the filters above or switch tabs to see other dispute stages."
                    />
                  ) : (
                    <ScrollTable>
                      <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                        <TableRow>
                          <TableHead className="pl-4">Dispute ID</TableHead>
                          <TableHead className="hidden md:table-cell">Country</TableHead>
                          <TableHead>Merchant</TableHead>
                          <TableHead className="hidden lg:table-cell">Customer</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead className="hidden xl:table-cell">Reason</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead className="hidden md:table-cell">Created</TableHead>
                          <TableHead className="text-right pr-4">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="pl-4 font-mono text-xs">
                              {d.id}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs">
                              <span className="font-mono">{d.countryCode}</span>
                              <span className="block text-[10px] text-muted-foreground">
                                {countryName(d.countryCode)}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {d.merchantName}
                              <span className="block text-[11px] text-muted-foreground lg:hidden">
                                {d.customerName}
                              </span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-xs">
                              {d.customerName}
                            </TableCell>
                            <TableCell className="text-xs font-semibold tabular-nums">
                              {formatCurrency(d.amount, d.currency)}
                              <span className="block text-[10px] font-normal text-muted-foreground">
                                {d.currency}
                              </span>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell max-w-[220px] text-xs text-muted-foreground line-clamp-2">
                              {d.reason}
                            </TableCell>
                            <TableCell>{statusBadgeNode(d.status)}</TableCell>
                            <TableCell>{deadlineBadge(d)}</TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                              {timeAgo(d.createdAt)}
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              <DisputeActions
                                dispute={d}
                                onRequestEvidence={() => requestEvidence(d)}
                                onUploadEvidence={() => uploadEvidence(d)}
                                onUpdateStatus={() => openUpdateStatus(d)}
                                onEscalateFraud={() => escalateFraud(d)}
                                onNote={() => addNote(d)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </ScrollTable>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </ViewContainer>

      {/* ---------------- Update Status Dialog ---------------- */}
      <Dialog open={!!statusTarget} onOpenChange={(o) => !o && setStatusTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update dispute status</DialogTitle>
            <DialogDescription>
              {statusTarget && (
                <>
                  <span className="font-mono">{statusTarget.id}</span> ·{" "}
                  {statusTarget.merchantName} ·{" "}
                  {formatCurrency(statusTarget.amount, statusTarget.currency)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label
              htmlFor="dispute-status"
              className="text-xs font-medium text-muted-foreground uppercase"
            >
              New status
            </Label>
            <Select
              value={pendingStatus || undefined}
              onValueChange={(v) => setPendingStatus(v as Dispute["status"])}
            >
              <SelectTrigger id="dispute-status" className="w-full">
                <SelectValue placeholder="Select a status..." />
              </SelectTrigger>
              <SelectContent>
                {STATUS_LABELS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              The card scheme timeline and any open SLAs may be affected by this change.
              This action is recorded in the audit log.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmUpdateStatus}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!pendingStatus}
            >
              <RefreshCw className="size-4" /> Update status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}

/* ============================ Sub-components ============================ */

const TAB_LABELS: Record<DisputeTab, string> = {
  new: "New Disputes",
  awaiting_evidence: "Awaiting Evidence",
  evidence_submitted: "Evidence Submitted",
  under_review: "Under Review",
  won_lost: "Won / Lost",
  expired: "Expired",
  all: "All Disputes",
};

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

function DisputeActions({
  dispute,
  onRequestEvidence,
  onUploadEvidence,
  onUpdateStatus,
  onEscalateFraud,
  onNote,
}: {
  dispute: Dispute;
  onRequestEvidence: () => void;
  onUploadEvidence: () => void;
  onUpdateStatus: () => void;
  onEscalateFraud: () => void;
  onNote: () => void;
}) {
  const isTerminal =
    dispute.status === "won" || dispute.status === "lost" || dispute.status === "expired";
  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Open dispute actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase tracking-wide">
            {dispute.id}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onRequestEvidence}
            disabled={dispute.status === "awaiting_evidence" || isTerminal}
          >
            <FileText className="size-4" /> Request evidence
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onUploadEvidence}
            disabled={dispute.status === "evidence_submitted" || isTerminal}
          >
            <Upload className="size-4" /> Upload evidence
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onUpdateStatus}>
            <RefreshCw className="size-4" /> Update status…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEscalateFraud} disabled={isTerminal}>
            <ShieldAlert className="size-4" /> Escalate fraud
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onNote}>
            <StickyNote className="size-4" /> Add note
          </DropdownMenuItem>
          {isTerminal && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-[11px] text-muted-foreground">
                Terminal status — limited actions available.
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
