"use client";

/**
 * Faya Admin Portal — Risk & Fraud Operations View (spec §11.2)
 *
 * Tabs:
 *   - Fraud Alerts            : table of FraudAlert + filters + row actions
 *   - Device Risk             : placeholder workflow (future feature)
 *   - Transaction Monitoring  : placeholder workflow (future feature)
 *   - Watchlists              : placeholder workflow (future feature)
 *   - Risk Cases              : placeholder workflow (future feature)
 *
 * Country scoping: Super Admin sees all countries; other staff see only the
 * country codes listed on their `staff.countries` access record.
 *
 * Every action is mirrored to the audit log via `logAudit(...)` with action
 * keys: account.restrict / device.block / settlement.hold / fraud.escalate /
 * fraud.close_false_positive / watchlist.add.
 */
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Search,
  Filter,
  ShieldBan,
  Ban,
  PauseCircle,
  ArrowUpCircle,
  CheckCircle2,
  EyeOff,
  MoreHorizontal,
  ShieldAlert,
  Activity,
  FolderLock,
  Smartphone,
  Clock,
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
import { formatCurrency, formatDateTime, statusBadge, timeAgo } from "@/lib/formatters";
import type { FraudAlert, CountryConfig, RiskLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RiskViewProps {
  fraudAlerts: FraudAlert[];
  countries: CountryConfig[];
}

const SUPER_ADMIN_DEPT = "dept_super_admin";

const SEVERITY_OPTIONS = [
  { value: "all", label: "All severities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "investigating", label: "Investigating" },
  { value: "escalated", label: "Escalated" },
  { value: "closed", label: "Closed" },
] as const;

/** Custom badge styling for FraudAlert.status (not covered by STATUS_BADGE). */
const FRAUD_STATUS_STYLES: Record<FraudAlert["status"], { label: string; className: string }> = {
  open: { label: "Open", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  investigating: { label: "Investigating", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  escalated: { label: "Escalated", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  closed: { label: "Closed", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
};

type ConfirmAction =
  | { kind: "restrict"; alert: FraudAlert }
  | { kind: "block_device"; alert: FraudAlert }
  | { kind: "hold_settlement"; alert: FraudAlert }
  | { kind: "close_false_positive"; alert: FraudAlert };

export function RiskView({ fraudAlerts, countries }: RiskViewProps) {
  const { staff: currentStaff } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("fraud");

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

  const visibleAlerts = useMemo(
    () => fraudAlerts.filter((a) => visibleCountryCodes.has(a.countryCode)),
    [fraudAlerts, visibleCountryCodes],
  );

  /* --------------------------- Filters --------------------------- */
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredAlerts = useMemo(() => {
    let list = visibleAlerts;
    if (countryFilter !== "all") list = list.filter((a) => a.countryCode === countryFilter);
    if (severityFilter !== "all") list = list.filter((a) => a.severity === severityFilter);
    if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.entityName.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.trigger.toLowerCase().includes(q),
      );
    }
    return list;
  }, [visibleAlerts, countryFilter, severityFilter, statusFilter, search]);

  /* --------------------- Detail sheet + dialog ------------------- */
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

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
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();
    return {
      openAlerts: visibleAlerts.filter((a) => a.status === "open" || a.status === "investigating").length,
      critical: visibleAlerts.filter((a) => a.severity === "critical" && a.status !== "closed").length,
      escalated: visibleAlerts.filter((a) => a.status === "escalated").length,
      closedToday: visibleAlerts.filter((a) => a.status === "closed" && a.createdAt >= todayMs).length,
    };
  }, [visibleAlerts]);

  /* ----------------------- Fraud mutations ----------------------- */
  function restrictAccount(a: FraudAlert) {
    if (!actor) return;
    logAudit(actor, "account.restrict", a.entityType, a.entityName, {
      countryCode: a.countryCode,
      reason: `Fraud alert ${a.id} — ${a.trigger}`,
    });
    toast.warning(`Account restricted: ${a.entityName}`, {
      description: `${a.entityType} flagged on alert ${a.id} · ${countryName(a.countryCode)}`,
    });
  }

  function blockDevice(a: FraudAlert) {
    if (!actor) return;
    adminData.updateFraud(a.id, { status: "closed" });
    logAudit(actor, "device.block", "device", a.device, {
      countryCode: a.countryCode,
      beforeValue: a.status,
      afterValue: "closed",
      reason: `Fraud alert ${a.id} — ${a.trigger}`,
    });
    toast.error(`Device blocked: ${a.device}`, {
      description: `Alert ${a.id} closed and device fingerprint added to blocklist.`,
    });
  }

  function holdSettlement(a: FraudAlert) {
    if (!actor) return;
    logAudit(actor, "settlement.hold", a.entityType, a.entityName, {
      countryCode: a.countryCode,
      reason: `Fraud alert ${a.id} — ${a.trigger}`,
    });
    toast.info(`Settlement hold requested: ${a.entityName}`, {
      description: `Finance team notified to hold settlements for ${countryName(a.countryCode)}.`,
    });
  }

  function escalateToCompliance(a: FraudAlert) {
    if (!actor) return;
    adminData.updateFraud(a.id, { status: "escalated" });
    logAudit(actor, "fraud.escalate", "fraud_alert", a.id, {
      countryCode: a.countryCode,
      beforeValue: a.status,
      afterValue: "escalated",
    });
    toast.success(`Escalated to compliance: ${a.entityName}`, {
      description: `Alert ${a.id} moved to the compliance escalation queue.`,
    });
    setSelectedAlert(null);
  }

  function closeFalsePositive(a: FraudAlert) {
    if (!actor) return;
    adminData.updateFraud(a.id, { status: "closed" });
    logAudit(actor, "fraud.close_false_positive", "fraud_alert", a.id, {
      countryCode: a.countryCode,
      beforeValue: a.status,
      afterValue: "closed",
      reason: "False positive — no fraud confirmed",
    });
    toast.success(`Closed as false positive: ${a.entityName}`, {
      description: `Alert ${a.id} resolved without further action.`,
    });
    setSelectedAlert(null);
  }

  function addToWatchlist(a: FraudAlert) {
    if (!actor) return;
    logAudit(actor, "watchlist.add", a.entityType, a.entityName, {
      countryCode: a.countryCode,
      reason: `From fraud alert ${a.id}`,
    });
    toast.success(`Added to watchlist: ${a.entityName}`, {
      description: `${a.entityType} will be monitored on all future transactions.`,
    });
  }

  /* ----------------------- Confirm dispatcher --------------------- */
  function runConfirm() {
    if (!confirmAction) return;
    switch (confirmAction.kind) {
      case "restrict":
        restrictAccount(confirmAction.alert);
        break;
      case "block_device":
        blockDevice(confirmAction.alert);
        break;
      case "hold_settlement":
        holdSettlement(confirmAction.alert);
        break;
      case "close_false_positive":
        closeFalsePositive(confirmAction.alert);
        break;
    }
    setConfirmAction(null);
  }

  /* ------------------------- Badge helpers ----------------------- */
  function severityBadge(level: RiskLevel): React.ReactNode {
    const b = statusBadge("risk", level);
    return (
      <Badge variant="secondary" className={cn("text-[10px] capitalize", b.className)}>
        {b.label}
      </Badge>
    );
  }

  function fraudStatusBadge(s: FraudAlert["status"]): React.ReactNode {
    const b = FRAUD_STATUS_STYLES[s] ?? { label: s, className: "bg-slate-100 text-slate-800" };
    return (
      <Badge variant="secondary" className={cn("text-[10px]", b.className)}>
        {b.label}
      </Badge>
    );
  }

  function entityTypeBadge(t: FraudAlert["entityType"]): React.ReactNode {
    const map: Record<FraudAlert["entityType"], { label: string; cls: string }> = {
      customer: { label: "Customer", cls: "text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
      merchant: { label: "Merchant", cls: "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
      device: { label: "Device", cls: "text-slate-700 border-slate-300 bg-slate-50 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700" },
    };
    const m = map[t];
    return (
      <Badge variant="outline" className={cn("text-[10px]", m.cls)}>
        {m.label}
      </Badge>
    );
  }

  /* ----------------------------- Render -------------------------- */
  return (
    <>
      <ViewHeader
        title="Risk & Fraud Operations"
        description={
          isSuperAdmin
            ? "Triage fraud alerts, restrict accounts, block devices and escalate to compliance across all countries."
            : `Scoped to your countries: ${[...visibleCountryCodes].join(", ") || "—"}`
        }
        icon={AlertTriangle}
      />
      <ViewContainer>
        {/* KPI strip */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard
            label="Open Alerts"
            value={stats.openAlerts}
            hint="open + investigating"
            icon={AlertTriangle}
            tone={stats.openAlerts > 0 ? "danger" : "default"}
          />
          <StatCard
            label="Critical Severity"
            value={stats.critical}
            hint="open critical alerts"
            icon={ShieldAlert}
            tone="danger"
          />
          <StatCard
            label="Escalated"
            value={stats.escalated}
            hint="awaiting compliance"
            icon={ArrowUpCircle}
            tone="warning"
          />
          <StatCard
            label="Closed Today"
            value={stats.closedToday}
            hint="false positives + resolved"
            icon={CheckCircle2}
            tone="success"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="fraud" className="text-xs">
              <AlertTriangle className="size-3.5" /> Fraud Alerts
            </TabsTrigger>
            <TabsTrigger value="device_risk" className="text-xs">
              <Smartphone className="size-3.5" /> Device Risk
            </TabsTrigger>
            <TabsTrigger value="tx_monitoring" className="text-xs">
              <Activity className="size-3.5" /> Transaction Monitoring
            </TabsTrigger>
            <TabsTrigger value="watchlists" className="text-xs">
              <EyeOff className="size-3.5" /> Watchlists
            </TabsTrigger>
            <TabsTrigger value="cases" className="text-xs">
              <FolderLock className="size-3.5" /> Risk Cases
            </TabsTrigger>
          </TabsList>

          {/* ---------------------- FRAUD ALERTS ---------------------- */}
          <TabsContent value="fraud">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="size-4 text-emerald-600" />
                  Fraud Alerts
                  <Badge variant="secondary" className="text-[10px]">
                    {filteredAlerts.length}
                  </Badge>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search entity name, ID, trigger..."
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
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger size="sm" className="w-36 text-xs h-8">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITY_OPTIONS.map((o) => (
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
                {filteredAlerts.length === 0 ? (
                  <EmptyState
                    icon={AlertTriangle}
                    title="No fraud alerts match"
                    description="Adjust the filters above. New fraud alerts from the monitoring engine will appear here in real time."
                  />
                ) : (
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                      <TableRow>
                        <TableHead className="pl-4">Alert ID</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead className="hidden md:table-cell">Entity</TableHead>
                        <TableHead>Entity name</TableHead>
                        <TableHead className="hidden lg:table-cell">Trigger</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead className="hidden sm:table-cell">Amount</TableHead>
                        <TableHead className="hidden xl:table-cell">Device</TableHead>
                        <TableHead className="hidden md:table-cell">Created</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right pr-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAlerts.map((a) => {
                        const canAct = a.status !== "closed";
                        return (
                          <TableRow
                            key={a.id}
                            className="cursor-pointer"
                            onClick={() => setSelectedAlert(a)}
                          >
                            <TableCell className="pl-4 font-mono text-[11px] text-muted-foreground">
                              {a.id}
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="font-mono">{a.countryCode}</span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {entityTypeBadge(a.entityType)}
                            </TableCell>
                            <TableCell className="font-medium">{a.entityName}</TableCell>
                            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[220px] truncate" title={a.trigger}>
                              {a.trigger}
                            </TableCell>
                            <TableCell>{severityBadge(a.severity)}</TableCell>
                            <TableCell className="hidden sm:table-cell text-xs tabular-nums">
                              {formatCurrency(a.transactionAmount, "USD")}
                            </TableCell>
                            <TableCell className="hidden xl:table-cell text-xs font-mono text-muted-foreground max-w-[160px] truncate" title={a.device}>
                              {a.device}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                              <span title={formatDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</span>
                            </TableCell>
                            <TableCell>{fraudStatusBadge(a.status)}</TableCell>
                            <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    aria-label={`Actions for alert ${a.id}`}
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Alert actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setSelectedAlert(a)}
                                  >
                                    <AlertTriangle className="size-4" /> View details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    disabled={!canAct}
                                    onClick={() => setConfirmAction({ kind: "restrict", alert: a })}
                                  >
                                    <ShieldBan className="size-4" /> Restrict account
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!canAct}
                                    variant="destructive"
                                    onClick={() => setConfirmAction({ kind: "block_device", alert: a })}
                                  >
                                    <Ban className="size-4" /> Block device
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!canAct}
                                    onClick={() => setConfirmAction({ kind: "hold_settlement", alert: a })}
                                  >
                                    <PauseCircle className="size-4" /> Hold settlement
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!canAct}
                                    onClick={() => escalateToCompliance(a)}
                                  >
                                    <ArrowUpCircle className="size-4" /> Escalate to compliance
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!canAct}
                                    onClick={() => setConfirmAction({ kind: "close_false_positive", alert: a })}
                                  >
                                    <CheckCircle2 className="size-4" /> Close false positive
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => addToWatchlist(a)}>
                                    <EyeOff className="size-4" /> Add to watchlist
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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

          {/* --------------------- DEVICE RISK ---------------------- */}
          <TabsContent value="device_risk">
            <FutureFeatureCard
              icon={Smartphone}
              title="Device Risk Signals"
              description="Aggregate device-fingerprint risk scores, velocity checks, and emulator/root detection across all active terminals and Phone POS installs. Risky devices will be auto-flagged here for review and possible blocklisting."
              steps={[
                { title: "Ingest device signals", desc: "Fingerprint hash, root/emulator flags, GPS vs IP geo mismatch, SIM country, app tamper signals." },
                { title: "Score & bucket", desc: "Each device gets a 0–100 risk score; high-risk devices are surfaced for analyst review." },
                { title: "Act on risk", desc: "Soft-restrict, hard-block, or whitelist a device directly from this view." },
              ]}
            />
          </TabsContent>

          {/* ----------------- TRANSACTION MONITORING --------------- */}
          <TabsContent value="tx_monitoring">
            <FutureFeatureCard
              icon={Activity}
              title="Real-Time Transaction Monitoring"
              description="Live feed of transactions scored by the fraud rules engine. Spike detection, velocity rules, and ML model decisions will be visible here with the ability to intervene mid-flight."
              steps={[
                { title: "Live stream", desc: "Every transaction across all countries flows through the rules engine and lands here in real time." },
                { title: "Rule hits", desc: "Each row shows which rules fired (velocity, geo-velocity, card testing, BIN attack, etc.)." },
                { title: "Intervene", desc: "Approve, decline, challenge (3DS), or hold for manual review without leaving the feed." },
              ]}
            />
          </TabsContent>

          {/* ----------------------- WATCHLISTS --------------------- */}
          <TabsContent value="watchlists">
            <FutureFeatureCard
              icon={EyeOff}
              title="Watchlists"
              description="Curated lists of customers, merchants, devices, cards and IPs under enhanced monitoring. Add entries manually or from a fraud alert; remove them once cleared by an analyst."
              steps={[
                { title: "Manage lists", desc: "Create lists per type (customer / merchant / device / card / IP) with TTL and reason." },
                { title: "Bulk import", desc: "Upload CSV/STIX feeds from regulators, partners, or your own investigations." },
                { title: "Match & alert", desc: "Transactions touching a watched entity are auto-flagged for analyst review." },
              ]}
            />
          </TabsContent>

          {/* ----------------------- RISK CASES --------------------- */}
          <TabsContent value="cases">
            <FutureFeatureCard
              icon={FolderLock}
              title="Risk Cases"
              description="Long-form investigations that group related fraud alerts, transactions, and entities into a single case file. Used by the AML investigator and senior compliance team for SAR/STR preparation."
              steps={[
                { title: "Open a case", desc: "From one or many fraud alerts, create a case with a lead investigator and SLA." },
                { title: "Build the file", desc: "Attach transactions, devices, documents, and analyst notes as evidence." },
                { title: "Decide & report", desc: "Close as no-action, restrict entities, or escalate to SAR/STR filing." },
              ]}
            />
          </TabsContent>
        </Tabs>
      </ViewContainer>

      {/* -------------------- Detail sheet -------------------- */}
      <Sheet open={!!selectedAlert} onOpenChange={(o) => !o && setSelectedAlert(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          {selectedAlert && (
            <FraudDetailSheet
              alert={selectedAlert}
              countryName={countryName}
              severityBadge={severityBadge}
              fraudStatusBadge={fraudStatusBadge}
              entityTypeBadge={entityTypeBadge}
              onClose={() => setSelectedAlert(null)}
              onRestrict={() => setConfirmAction({ kind: "restrict", alert: selectedAlert })}
              onBlockDevice={() => setConfirmAction({ kind: "block_device", alert: selectedAlert })}
              onHoldSettlement={() => setConfirmAction({ kind: "hold_settlement", alert: selectedAlert })}
              onEscalate={() => escalateToCompliance(selectedAlert)}
              onCloseFalsePositive={() => setConfirmAction({ kind: "close_false_positive", alert: selectedAlert })}
              onWatchlist={() => addToWatchlist(selectedAlert)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ----------------- Confirmation dialog ----------------- */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle(confirmAction)}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription(confirmAction)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                "text-white",
                confirmAction?.kind === "block_device" || confirmAction?.kind === "restrict"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700",
              )}
              onClick={runConfirm}
            >
              <CheckCircle2 className="size-4" /> Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );

  function confirmTitle(c: ConfirmAction | null): string {
    if (!c) return "";
    switch (c.kind) {
      case "restrict":
        return "Restrict this account?";
      case "block_device":
        return "Block this device?";
      case "hold_settlement":
        return "Request settlement hold?";
      case "close_false_positive":
        return "Close as false positive?";
    }
  }

  function confirmDescription(c: ConfirmAction | null): string {
    if (!c) return "";
    const a = c.alert;
    const base = `Entity: ${a.entityName} · Alert ${a.id} · ${countryName(a.countryCode)}.`;
    switch (c.kind) {
      case "restrict":
        return `${base} The account will be frozen from withdrawals and new transactions. The action is recorded in the audit log.`;
      case "block_device":
        return `${base} The device fingerprint ${a.device} will be added to the blocklist and the alert will be closed. This cannot be undone from this view.`;
      case "hold_settlement":
        return `${base} A settlement-hold request will be sent to the Finance team. The alert itself remains open for further investigation.`;
      case "close_false_positive":
        return `${base} The alert will be closed with reason "false positive". No further action will be taken on the entity.`;
    }
  }
}

/* ============================ Sub-components ============================ */

/**
 * Scrollable table wrapper with sticky-header support and custom scrollbar.
 *
 * NOTE: we use a raw <table> here (not the Table primitive) because the
 * Table primitive wraps the table in its own `overflow-x-auto` div, which
 * becomes a separate scroll container and prevents the <thead> from sticking
 * to this outer vertical-scroll viewport.
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

function FraudDetailSheet({
  alert,
  countryName,
  severityBadge,
  fraudStatusBadge,
  entityTypeBadge,
  onClose,
  onRestrict,
  onBlockDevice,
  onHoldSettlement,
  onEscalate,
  onCloseFalsePositive,
  onWatchlist,
}: {
  alert: FraudAlert;
  countryName: (code: string) => string;
  severityBadge: (l: RiskLevel) => React.ReactNode;
  fraudStatusBadge: (s: FraudAlert["status"]) => React.ReactNode;
  entityTypeBadge: (t: FraudAlert["entityType"]) => React.ReactNode;
  onClose: () => void;
  onRestrict: () => void;
  onBlockDevice: () => void;
  onHoldSettlement: () => void;
  onEscalate: () => void;
  onCloseFalsePositive: () => void;
  onWatchlist: () => void;
}) {
  const canAct = alert.status !== "closed";
  return (
    <>
      <SheetHeader>
        <SheetDescription className="text-[11px] font-mono">{alert.id}</SheetDescription>
        <SheetTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="size-5 text-emerald-600" />
          {alert.entityName}
        </SheetTitle>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {fraudStatusBadge(alert.status)}
          {severityBadge(alert.severity)}
          {entityTypeBadge(alert.entityType)}
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 space-y-4 text-sm">
        <div className="rounded-md border divide-y">
          <DetailRow label="Country" value={`${alert.countryCode} · ${countryName(alert.countryCode)}`} />
          <DetailRow label="Trigger" value={<span className="text-amber-800 dark:text-amber-300">{alert.trigger}</span>} />
          <DetailRow label="Transaction" value={formatCurrency(alert.transactionAmount, "USD")} />
          <DetailRow label="Device" value={<span className="font-mono text-xs">{alert.device}</span>} />
          <DetailRow label="Created" value={formatDateTime(alert.createdAt)} />
        </div>

        {alert.status === "closed" ? (
          <div className="text-center text-xs text-muted-foreground py-3 border rounded-md bg-muted/30">
            Alert is <span className="font-medium">closed</span> — no further actions available.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={onRestrict}
                variant="outline"
                className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900/20"
              >
                <ShieldBan className="size-4" /> Restrict
              </Button>
              <Button onClick={onBlockDevice} variant="destructive">
                <Ban className="size-4" /> Block device
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={onHoldSettlement} variant="outline">
                <PauseCircle className="size-4" /> Hold settlement
              </Button>
              <Button
                onClick={onEscalate}
                variant="outline"
                className="text-purple-700 border-purple-300 hover:bg-purple-50 dark:text-purple-300 dark:border-purple-800 dark:hover:bg-purple-900/20"
              >
                <ArrowUpCircle className="size-4" /> Escalate
              </Button>
            </div>
            <Button onClick={onCloseFalsePositive} variant="secondary" className="w-full">
              <CheckCircle2 className="size-4" /> Close as false positive
            </Button>
            <Button onClick={onWatchlist} variant="ghost" className="w-full">
              <EyeOff className="size-4" /> Add to watchlist
            </Button>
          </div>
        )}
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
          This module is on the Phase 4/5 roadmap. Use the Fraud Alerts tab in the meantime.
        </div>
      </CardContent>
    </Card>
  );
}
