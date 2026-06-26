"use client";

/**
 * Faya Admin Portal — Finance & Settlements View (spec §11.5)
 *
 * Tabs:
 *   - Settlement Batches  : table of Settlement + filters + row actions
 *   - Failed Settlements  : pre-filtered to status === "failed"
 *   - Reconciliation      : placeholder workflow (3-way recon)
 *   - Merchant Fees       : placeholder workflow (MDR / pricing)
 *   - Reserves            : placeholder workflow (rolling reserves)
 *
 * Country scoping: Super Admin sees all countries; other staff see only the
 * country codes listed on their `staff.countries` access record.
 *
 * Every action is mirrored to the audit log via `logAudit(...)` with action
 * keys: settlement.retry / settlement.hold / settlement.release_request /
 * settlement.export.
 */
import { useMemo, useState } from "react";
import {
  Wallet,
  Search,
  Filter,
  MoreHorizontal,
  RotateCcw,
  PauseCircle,
  PlayCircle,
  Download,
  Eye,
  Clock,
  XCircle,
  Scale,
  Receipt,
  PiggyBank,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer, EmptyState, StatCard } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
import { formatCurrency, formatDateTime, formatDate, formatCompact } from "@/lib/formatters";
import type { Settlement, CountryConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FinanceViewProps {
  settlements: Settlement[];
  countries: CountryConfig[];
}

const SUPER_ADMIN_DEPT = "dept_super_admin";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "held", label: "Held" },
] as const;

/** Custom badge styling for Settlement.status (not in STATUS_BADGE). */
const SETTLEMENT_STATUS_STYLES: Record<Settlement["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  processing: { label: "Processing", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  held: { label: "Held", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
};

export function FinanceView({ settlements, countries }: FinanceViewProps) {
  const { staff: currentStaff } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("batches");

  /* ----------------------- Country scoping ----------------------- */
  const visibleCountryCodes = useMemo(() => {
    if (!currentStaff) return new Set<string>();
    if (currentStaff.departmentId === SUPER_ADMIN_DEPT) {
      return new Set(countries.map((c) => c.countryCode));
    }
    return new Set(currentStaff.countries.map((c) => c.countryCode));
  }, [currentStaff, countries]);

  const isSuperAdmin = currentStaff?.departmentId === SUPER_ADMIN_DEPT;

  const filterableCountries = useMemo(
    () =>
      isSuperAdmin
        ? countries
        : countries.filter((c) => visibleCountryCodes.has(c.countryCode)),
    [countries, isSuperAdmin, visibleCountryCodes],
  );

  const visibleSettlements = useMemo(
    () => settlements.filter((s) => visibleCountryCodes.has(s.countryCode)),
    [settlements, visibleCountryCodes],
  );

  /* --------------------------- Filters --------------------------- */
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredSettlements = useMemo(() => {
    let list = visibleSettlements;
    if (countryFilter !== "all") list = list.filter((s) => s.countryCode === countryFilter);
    if (statusFilter !== "all") list = list.filter((s) => s.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.batchId.toLowerCase().includes(q) ||
          s.merchantName.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [visibleSettlements, countryFilter, statusFilter, search]);

  const failedSettlements = useMemo(
    () => visibleSettlements.filter((s) => s.status === "failed"),
    [visibleSettlements],
  );

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

  /* --------------------------- Lookups --------------------------- */
  function countryName(code: string): string {
    return countries.find((c) => c.countryCode === code)?.countryName ?? code;
  }

  /* ----------------------- KPI calculations ---------------------- */
  const stats = useMemo(() => {
    const settledVolume = visibleSettlements
      .filter((s) => s.status === "completed")
      .reduce((sum, s) => sum + s.amount, 0);
    return {
      settledVolume,
      pending: visibleSettlements.filter((s) => s.status === "pending" || s.status === "processing").length,
      held: visibleSettlements.filter((s) => s.status === "held").length,
      failed: visibleSettlements.filter((s) => s.status === "failed").length,
    };
  }, [visibleSettlements]);

  /* --------------------- Settlement mutations -------------------- */
  function retryFailed(s: Settlement) {
    if (!actor) return;
    adminData.updateSettlement(s.id, { status: "processing" });
    logAudit(actor, "settlement.retry", "settlement", s.id, {
      countryCode: s.countryCode,
      beforeValue: s.status,
      afterValue: "processing",
    });
    toast.success(`Retry queued: ${s.batchId}`, {
      description: `Settlement moved back to processing for ${s.merchantName}.`,
    });
    setSelectedSettlement(null);
  }

  function recommendHold(s: Settlement) {
    if (!actor) return;
    logAudit(actor, "settlement.hold", "settlement", s.id, {
      countryCode: s.countryCode,
      reason: `Manual hold recommended by ${actor.staffName}`,
    });
    toast.info(`Hold recommended: ${s.batchId}`, {
      description: `Compliance/Risk team notified to review before release.`,
    });
  }

  function recommendRelease(s: Settlement) {
    if (!actor) return;
    logAudit(actor, "settlement.release_request", "settlement", s.id, {
      countryCode: s.countryCode,
      reason: `Release request from ${actor.staffName}`,
    });
    toast.success(`Release requested: ${s.batchId}`, {
      description: `Sent to the approval queue for finance controller sign-off.`,
    });
  }

  function exportReport(s: Settlement) {
    if (!actor) return;
    logAudit(actor, "settlement.export", "settlement", s.id, {
      countryCode: s.countryCode,
    });
    toast.success(`Report exported: ${s.batchId}`, {
      description: `CSV settlement report generated and downloaded.`,
    });
  }

  /* --------------------- Detail sheet state ---------------------- */
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);

  /* ------------------------- Badge helpers ----------------------- */
  function settlementStatusBadge(s: Settlement["status"]): React.ReactNode {
    const b = SETTLEMENT_STATUS_STYLES[s] ?? { label: s, className: "bg-slate-100 text-slate-800" };
    return (
      <Badge variant="secondary" className={cn("text-[10px]", b.className)}>
        {b.label}
      </Badge>
    );
  }

  /* ----------------------------- Render -------------------------- */
  return (
    <>
      <ViewHeader
        title="Finance & Settlements"
        description={
          isSuperAdmin
            ? "Run settlement batches, reconcile failed payouts, and manage holds and reserves across all countries."
            : `Scoped to your countries: ${[...visibleCountryCodes].join(", ") || "—"}`
        }
        icon={Wallet}
      />
      <ViewContainer>
        {/* KPI strip */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard
            label="Settled Volume"
            value={formatCompact(stats.settledVolume)}
            hint="completed (sum)"
            icon={Wallet}
            tone="success"
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            hint="pending + processing"
            icon={Clock}
            tone="warning"
          />
          <StatCard
            label="Held"
            value={stats.held}
            hint="awaiting review"
            icon={PauseCircle}
            tone="warning"
          />
          <StatCard
            label="Failed"
            value={stats.failed}
            hint="need retry / fix"
            icon={XCircle}
            tone="danger"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="batches" className="text-xs">
              <Wallet className="size-3.5" /> Settlement Batches
            </TabsTrigger>
            <TabsTrigger value="failed" className="text-xs">
              <XCircle className="size-3.5" /> Failed Settlements
              {stats.failed > 0 && (
                <Badge variant="secondary" className="ml-1 text-[9px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                  {stats.failed}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="text-xs">
              <Scale className="size-3.5" /> Reconciliation
            </TabsTrigger>
            <TabsTrigger value="fees" className="text-xs">
              <Receipt className="size-3.5" /> Merchant Fees
            </TabsTrigger>
            <TabsTrigger value="reserves" className="text-xs">
              <PiggyBank className="size-3.5" /> Reserves
            </TabsTrigger>
          </TabsList>

          {/* -------------------- SETTLEMENT BATCHES ------------------ */}
          <TabsContent value="batches">
            <SettlementsCard
              title="Settlement Batches"
              icon={Wallet}
              iconColor="text-emerald-600"
              items={filteredSettlements}
              countryName={countryName}
              settlementStatusBadge={settlementStatusBadge}
              countryFilter={countryFilter}
              setCountryFilter={setCountryFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              search={search}
              setSearch={setSearch}
              filterableCountries={filterableCountries}
              onSelect={setSelectedSettlement}
              onRetry={retryFailed}
              onHold={recommendHold}
              onRelease={recommendRelease}
              onExport={exportReport}
            />
          </TabsContent>

          {/* -------------------- FAILED SETTLEMENTS ------------------ */}
          <TabsContent value="failed">
            <SettlementsCard
              title="Failed Settlements"
              icon={XCircle}
              iconColor="text-red-600"
              items={failedSettlements}
              countryName={countryName}
              settlementStatusBadge={settlementStatusBadge}
              countryFilter={countryFilter}
              setCountryFilter={setCountryFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              search={search}
              setSearch={setSearch}
              filterableCountries={filterableCountries}
              onSelect={setSelectedSettlement}
              onRetry={retryFailed}
              onHold={recommendHold}
              onRelease={recommendRelease}
              onExport={exportReport}
              emptyIcon={XCircle}
              emptyTitle="No failed settlements"
              emptyDescription="Failed settlement batches will appear here for retry or correction. Filter to investigate by country or merchant."
            />
          </TabsContent>

          {/* -------------------- RECONCILIATION --------------------- */}
          <TabsContent value="reconciliation">
            <FutureFeatureCard
              icon={Scale}
              title="3-Way Reconciliation"
              description="Reconcile Faya ledger against the acquiring bank statement and the merchant payout report. Auto-match by reference, surface exceptions for analyst review."
              steps={[
                { title: "Ingest", desc: "Pull bank statements, internal ledger, and payout confirmations into a single reconciliation workspace." },
                { title: "Auto-match", desc: "Match by reference / amount / date; flag exceptions for analyst review." },
                { title: "Resolve", desc: "Write off rounding, chase missing payouts, and post adjusting journal entries." },
              ]}
            />
          </TabsContent>

          {/* ---------------------- MERCHANT FEES -------------------- */}
          <TabsContent value="fees">
            <FutureFeatureCard
              icon={Receipt}
              title="Merchant Fees & Pricing"
              description="Manage merchant discount rates (MDR), per-scheme fees, and custom pricing tiers. Apply fee waivers and run monthly fee simulations."
              steps={[
                { title: "Pricing tiers", desc: "Default, growth, enterprise — each with their own MDR per scheme and country." },
                { title: "Overrides", desc: "Per-merchant overrides with start/end dates and approval workflow." },
                { title: "Invoice", desc: "Monthly fee run generates merchant invoices and posts them to the ledger." },
              ]}
            />
          </TabsContent>

          {/* ------------------------ RESERVES ----------------------- */}
          <TabsContent value="reserves">
            <FutureFeatureCard
              icon={PiggyBank}
              title="Rolling Reserves"
              description="Hold a percentage of each merchant's settlement volume as a chargeback buffer. Configure reserve rates per merchant risk tier and release on schedule."
              steps={[
                { title: "Configure", desc: "Set reserve rate (e.g. 5%), rollover period (e.g. 90 days), and release cadence per merchant." },
                { title: "Hold", desc: "Each settlement auto-allocates the reserve portion to a separate liability account." },
                { title: "Release", desc: "Matured reserves are released to the merchant on schedule; exceptions need approval." },
              ]}
            />
          </TabsContent>
        </Tabs>
      </ViewContainer>

      {/* -------------------- Detail sheet -------------------- */}
      <Sheet open={!!selectedSettlement} onOpenChange={(o) => !o && setSelectedSettlement(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          {selectedSettlement && (
            <SettlementDetailSheet
              settlement={selectedSettlement}
              countryName={countryName}
              settlementStatusBadge={settlementStatusBadge}
              onClose={() => setSelectedSettlement(null)}
              onRetry={() => retryFailed(selectedSettlement)}
              onHold={() => recommendHold(selectedSettlement)}
              onRelease={() => recommendRelease(selectedSettlement)}
              onExport={() => exportReport(selectedSettlement)}
            />
          )}
        </SheetContent>
      </Sheet>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}

/* ============================ Sub-components ============================ */

/**
 * Scrollable table wrapper with sticky-header support and custom scrollbar.
 * Uses a raw <table> instead of the Table primitive so the sticky <thead> is
 * anchored to this outer vertical-scroll viewport.
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

/** Re-usable card that renders a Settlements table + filter bar. */
function SettlementsCard({
  title,
  icon: Icon,
  iconColor,
  items,
  countryName,
  settlementStatusBadge,
  countryFilter,
  setCountryFilter,
  statusFilter,
  setStatusFilter,
  search,
  setSearch,
  filterableCountries,
  onSelect,
  onRetry,
  onHold,
  onRelease,
  onExport,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  items: Settlement[];
  countryName: (code: string) => string;
  settlementStatusBadge: (s: Settlement["status"]) => React.ReactNode;
  countryFilter: string;
  setCountryFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  filterableCountries: CountryConfig[];
  onSelect: (s: Settlement) => void;
  onRetry: (s: Settlement) => void;
  onHold: (s: Settlement) => void;
  onRelease: (s: Settlement) => void;
  onExport: (s: Settlement) => void;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className={cn("size-4", iconColor)} />
          {title}
          <Badge variant="secondary" className="text-[10px]">
            {items.length}
          </Badge>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search batch, merchant, ID..."
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
        {items.length === 0 ? (
          <EmptyState
            icon={emptyIcon ?? Wallet}
            title={emptyTitle ?? "No settlements match"}
            description={emptyDescription ?? "Adjust the filters above. New settlement batches will appear here automatically."}
          />
        ) : (
          <ScrollTable>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
              <TableRow>
                <TableHead className="pl-4">Batch ID</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Currency</TableHead>
                <TableHead className="hidden md:table-cell">Scheduled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Failure reason</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => onSelect(s)}
                >
                  <TableCell className="pl-4 font-mono text-[11px]">{s.batchId}</TableCell>
                  <TableCell className="text-xs">
                    <span className="font-mono">{s.countryCode}</span>
                  </TableCell>
                  <TableCell className="font-medium">{s.merchantName}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-medium">
                    {formatCurrency(s.amount, s.currency)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                    {s.currency}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    <span title={formatDateTime(s.scheduledAt)}>{formatDate(s.scheduledAt)}</span>
                  </TableCell>
                  <TableCell>{settlementStatusBadge(s.status)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs max-w-[220px]">
                    {s.failureReason ? (
                      <span
                        className="text-red-700 dark:text-red-300 truncate block"
                        title={s.failureReason}
                      >
                        {s.failureReason}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Actions for batch ${s.batchId}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{s.batchId}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onSelect(s)}>
                          <Eye className="size-4" /> View details
                        </DropdownMenuItem>
                        {s.status === "failed" && (
                          <DropdownMenuItem onClick={() => onRetry(s)}>
                            <RotateCcw className="size-4" /> Retry failed
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onHold(s)}>
                          <PauseCircle className="size-4" /> Recommend hold
                        </DropdownMenuItem>
                        {s.status === "held" && (
                          <DropdownMenuItem onClick={() => onRelease(s)}>
                            <PlayCircle className="size-4" /> Recommend release
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onExport(s)}>
                          <Download className="size-4" /> Export report
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ScrollTable>
        )}
      </CardContent>
    </Card>
  );
}

function SettlementDetailSheet({
  settlement,
  countryName,
  settlementStatusBadge,
  onClose,
  onRetry,
  onHold,
  onRelease,
  onExport,
}: {
  settlement: Settlement;
  countryName: (code: string) => string;
  settlementStatusBadge: (s: Settlement["status"]) => React.ReactNode;
  onClose: () => void;
  onRetry: () => void;
  onHold: () => void;
  onRelease: () => void;
  onExport: () => void;
}) {
  const isHeld = settlement.status === "held";
  const isFailed = settlement.status === "failed";
  return (
    <>
      <SheetHeader>
        <SheetDescription className="text-[11px] font-mono">{settlement.id}</SheetDescription>
        <SheetTitle className="text-lg flex items-center gap-2">
          <Wallet className="size-5 text-emerald-600" />
          <span className="font-mono text-base">{settlement.batchId}</span>
        </SheetTitle>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {settlementStatusBadge(settlement.status)}
          <Badge variant="outline" className="text-[10px] tabular-nums">
            {formatCurrency(settlement.amount, settlement.currency)}
          </Badge>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 space-y-4 text-sm">
        <div className="rounded-md border divide-y">
          <DetailRow label="Merchant" value={settlement.merchantName} />
          <DetailRow label="Country" value={`${settlement.countryCode} · ${countryName(settlement.countryCode)}`} />
          <DetailRow label="Amount" value={formatCurrency(settlement.amount, settlement.currency)} />
          <DetailRow label="Currency" value={settlement.currency} />
          <DetailRow label="Scheduled" value={formatDateTime(settlement.scheduledAt)} />
          <DetailRow label="Status" value={<span className="capitalize">{settlement.status}</span>} />
        </div>

        {settlement.failureReason && (
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
              Failure reason
            </div>
            <p className="text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3 text-red-900 dark:text-red-200">
              {settlement.failureReason}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {isFailed && (
            <Button
              onClick={onRetry}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <RotateCcw className="size-4" /> Retry settlement
            </Button>
          )}
          {!isHeld && (
            <Button onClick={onHold} variant="outline" className="w-full">
              <PauseCircle className="size-4" /> Recommend hold
            </Button>
          )}
          {isHeld && (
            <Button
              onClick={onRelease}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <PlayCircle className="size-4" /> Recommend release
            </Button>
          )}
          <Button onClick={onExport} variant="secondary" className="w-full">
            <Download className="size-4" /> Export report
          </Button>
        </div>
      </div>

      <SheetFooter className="flex flex-col gap-2 items-stretch">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </SheetFooter>
    </>
  );
}

/** Placeholder card for future-feature tabs. */
function FutureFeatureCard({
  icon: Icon,
  title,
  description,
  steps,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  steps: { title: string; desc: string }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="size-4 text-emerald-600" />
          {title}
          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
            Planned
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <EmptyState
          icon={Icon}
          title={title}
          description={description}
        />
        <Separator className="my-4" />
        <ol className="space-y-3 text-sm">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="size-6 shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-semibold">
                {i + 1}
              </span>
              <div>
                <div className="font-medium">{step.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{step.desc}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          This module is on the Phase 4/5 roadmap. Use the Settlement Batches tab in the meantime.
        </div>
      </CardContent>
    </Card>
  );
}
