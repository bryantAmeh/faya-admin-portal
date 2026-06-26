"use client";

/**
 * Faya Admin Portal — Devices & Terminal Operations View (spec §11.4)
 *
 * Tabs:
 *   - Terminal Inventory  : table of Terminal + filters + row actions
 *   - Terminal Requests   : placeholder workflow (merchant requests for new terminals)
 *   - Phone POS Devices   : placeholder workflow (SoftPOS / phone-POS app installs)
 *   - Device Health       : placeholder workflow (battery, connectivity, app crashes)
 *   - Lost/Damaged        : placeholder workflow (RMA / replacement flow)
 *
 * Country scoping: Super Admin sees all countries; other staff see only the
 * country codes listed on their `staff.countries` access record.
 *
 * Every action is mirrored to the audit log via `logAudit(...)` with action
 * keys: terminal.activate / device.block / terminal.mark_damaged /
 * terminal.replace_request.
 */
import { useMemo, useState } from "react";
import {
  Smartphone,
  Search,
  Filter,
  MoreHorizontal,
  Power,
  Ban,
  Wrench,
  RefreshCw,
  Eye,
  PackageCheck,
  QrCode,
  HeartPulse,
  PackageX,
  Clock,
  CheckCircle2,
  Cpu,
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
import { formatDateTime, formatDate, timeAgo } from "@/lib/formatters";
import type { Terminal, CountryConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DevicesViewProps {
  terminals: Terminal[];
  countries: CountryConfig[];
}

const SUPER_ADMIN_DEPT = "dept_super_admin";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "inventory", label: "Inventory" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
  { value: "damaged", label: "Damaged" },
] as const;

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "physical", label: "Physical" },
  { value: "phone_pos", label: "Phone POS" },
] as const;

/** Custom badge styling for Terminal.status (not in STATUS_BADGE). */
const TERMINAL_STATUS_STYLES: Record<Terminal["status"], { label: string; className: string }> = {
  inventory: { label: "Inventory", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  shipped: { label: "Shipped", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  delivered: { label: "Delivered", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  blocked: { label: "Blocked", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  damaged: { label: "Damaged", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
};

type ConfirmAction =
  | { kind: "activate"; terminal: Terminal }
  | { kind: "block"; terminal: Terminal }
  | { kind: "mark_damaged"; terminal: Terminal };

export function DevicesView({ terminals, countries }: DevicesViewProps) {
  const { staff: currentStaff } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("inventory");

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

  const visibleTerminals = useMemo(
    () => terminals.filter((t) => visibleCountryCodes.has(t.countryCode)),
    [terminals, visibleCountryCodes],
  );

  /* --------------------------- Filters --------------------------- */
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredTerminals = useMemo(() => {
    let list = visibleTerminals;
    if (countryFilter !== "all") list = list.filter((t) => t.countryCode === countryFilter);
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    if (typeFilter !== "all") list = list.filter((t) => t.type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.serialNumber.toLowerCase().includes(q) ||
          t.merchantName.toLowerCase().includes(q) ||
          t.model.toLowerCase().includes(q),
      );
    }
    return list;
  }, [visibleTerminals, countryFilter, statusFilter, typeFilter, search]);

  /* --------------------- Detail sheet + dialog ------------------- */
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
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
    return {
      total: visibleTerminals.length,
      active: visibleTerminals.filter((t) => t.status === "active").length,
      blocked: visibleTerminals.filter((t) => t.status === "blocked").length,
      phonePos: visibleTerminals.filter((t) => t.type === "phone_pos").length,
    };
  }, [visibleTerminals]);

  /* --------------------- Terminal mutations ---------------------- */
  function activateTerminal(t: Terminal) {
    if (!actor) return;
    const now = Date.now();
    adminData.updateTerminal(t.id, { status: "active", activatedAt: now });
    logAudit(actor, "terminal.activate", "terminal", t.id, {
      countryCode: t.countryCode,
      beforeValue: t.status,
      afterValue: "active",
    });
    toast.success(`Terminal activated: ${t.serialNumber}`, {
      description: `${t.merchantName} · ${countryName(t.countryCode)}`,
    });
    setSelectedTerminal(null);
  }

  function blockTerminal(t: Terminal) {
    if (!actor) return;
    adminData.updateTerminal(t.id, { status: "blocked" });
    logAudit(actor, "device.block", "terminal", t.id, {
      countryCode: t.countryCode,
      beforeValue: t.status,
      afterValue: "blocked",
    });
    toast.error(`Terminal blocked: ${t.serialNumber}`, {
      description: `Card acceptance on this device has been suspended.`,
    });
    setSelectedTerminal(null);
  }

  function markDamaged(t: Terminal) {
    if (!actor) return;
    adminData.updateTerminal(t.id, { status: "damaged" });
    logAudit(actor, "terminal.mark_damaged", "terminal", t.id, {
      countryCode: t.countryCode,
      beforeValue: t.status,
      afterValue: "damaged",
    });
    toast.warning(`Marked as damaged: ${t.serialNumber}`, {
      description: `RMA the device and trigger a replacement request.`,
    });
    setSelectedTerminal(null);
  }

  function replaceTerminal(t: Terminal) {
    if (!actor) return;
    logAudit(actor, "terminal.replace_request", "terminal", t.id, {
      countryCode: t.countryCode,
      reason: `Replacement requested for ${t.serialNumber} (status: ${t.status})`,
    });
    toast.info(`Replacement requested: ${t.serialNumber}`, {
      description: `Logistics team notified to ship a replacement to ${t.merchantName}.`,
    });
  }

  /* ----------------------- Confirm dispatcher --------------------- */
  function runConfirm() {
    if (!confirmAction) return;
    switch (confirmAction.kind) {
      case "activate":
        activateTerminal(confirmAction.terminal);
        break;
      case "block":
        blockTerminal(confirmAction.terminal);
        break;
      case "mark_damaged":
        markDamaged(confirmAction.terminal);
        break;
    }
    setConfirmAction(null);
  }

  /* ------------------------- Badge helpers ----------------------- */
  function terminalStatusBadge(s: Terminal["status"]): React.ReactNode {
    const b = TERMINAL_STATUS_STYLES[s] ?? { label: s, className: "bg-slate-100 text-slate-800" };
    return (
      <Badge variant="secondary" className={cn("text-[10px]", b.className)}>
        {b.label}
      </Badge>
    );
  }

  function typeBadge(t: Terminal["type"]): React.ReactNode {
    if (t === "phone_pos") {
      return (
        <Badge variant="outline" className="text-[10px] text-purple-700 border-purple-300 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800">
          <Smartphone className="size-2.5" /> Phone POS
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
        <Cpu className="size-2.5" /> Physical
      </Badge>
    );
  }

  /* ----------------------------- Render -------------------------- */
  return (
    <>
      <ViewHeader
        title="Devices & Terminal Operations"
        description={
          isSuperAdmin
            ? "Manage terminal inventory, activate or block devices, and process RMAs across all countries."
            : `Scoped to your countries: ${[...visibleCountryCodes].join(", ") || "—"}`
        }
        icon={Smartphone}
      />
      <ViewContainer>
        {/* KPI strip */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard
            label="Total Terminals"
            value={stats.total}
            hint="in scope"
            icon={Smartphone}
          />
          <StatCard
            label="Active"
            value={stats.active}
            hint="accepting transactions"
            icon={CheckCircle2}
            tone="success"
          />
          <StatCard
            label="Blocked"
            value={stats.blocked}
            hint="suspended devices"
            icon={Ban}
            tone="danger"
          />
          <StatCard
            label="Phone POS"
            value={stats.phonePos}
            hint="SoftPOS installs"
            icon={Cpu}
            tone="info"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="inventory" className="text-xs">
              <Smartphone className="size-3.5" /> Terminal Inventory
            </TabsTrigger>
            <TabsTrigger value="requests" className="text-xs">
              <PackageCheck className="size-3.5" /> Terminal Requests
            </TabsTrigger>
            <TabsTrigger value="phone_pos" className="text-xs">
              <QrCode className="size-3.5" /> Phone POS Devices
            </TabsTrigger>
            <TabsTrigger value="health" className="text-xs">
              <HeartPulse className="size-3.5" /> Device Health
            </TabsTrigger>
            <TabsTrigger value="lost_damaged" className="text-xs">
              <PackageX className="size-3.5" /> Lost/Damaged
            </TabsTrigger>
          </TabsList>

          {/* -------------------- TERMINAL INVENTORY ------------------- */}
          <TabsContent value="inventory">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Smartphone className="size-4 text-emerald-600" />
                  Terminal Inventory
                  <Badge variant="secondary" className="text-[10px]">
                    {filteredTerminals.length}
                  </Badge>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search serial, merchant, model..."
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
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger size="sm" className="w-32 text-xs h-8">
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
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredTerminals.length === 0 ? (
                  <EmptyState
                    icon={Smartphone}
                    title="No terminals match"
                    description="Adjust the filters above. New terminals provisioned from logistics will appear here automatically."
                  />
                ) : (
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                      <TableRow>
                        <TableHead className="pl-4">Serial</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Merchant</TableHead>
                        <TableHead className="hidden md:table-cell">Model</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Activated</TableHead>
                        <TableHead className="hidden sm:table-cell">Last seen</TableHead>
                        <TableHead className="text-right pr-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTerminals.map((t) => {
                        const canActivate = t.status !== "active" && t.status !== "blocked";
                        const canBlock = t.status !== "blocked";
                        const canDamage = t.status !== "damaged";
                        return (
                          <TableRow
                            key={t.id}
                            className="cursor-pointer"
                            onClick={() => setSelectedTerminal(t)}
                          >
                            <TableCell className="pl-4 font-mono text-[11px]">
                              {t.serialNumber}
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="font-mono">{t.countryCode}</span>
                            </TableCell>
                            <TableCell className="font-medium">{t.merchantName}</TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                              {t.model}
                            </TableCell>
                            <TableCell>{typeBadge(t.type)}</TableCell>
                            <TableCell>{terminalStatusBadge(t.status)}</TableCell>
                            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                              {t.activatedAt ? (
                                <span title={formatDateTime(t.activatedAt)}>{formatDate(t.activatedAt)}</span>
                              ) : (
                                <span className="italic">—</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                              {t.lastSeenAt ? (
                                <span title={formatDateTime(t.lastSeenAt)}>{timeAgo(t.lastSeenAt)}</span>
                              ) : (
                                <span className="italic">Never</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    aria-label={`Actions for terminal ${t.serialNumber}`}
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>{t.serialNumber}</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setSelectedTerminal(t)}>
                                    <Eye className="size-4" /> View details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    disabled={!canActivate}
                                    onClick={() => setConfirmAction({ kind: "activate", terminal: t })}
                                  >
                                    <Power className="size-4" /> Activate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!canBlock}
                                    variant="destructive"
                                    onClick={() => setConfirmAction({ kind: "block", terminal: t })}
                                  >
                                    <Ban className="size-4" /> Block
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!canDamage}
                                    onClick={() => setConfirmAction({ kind: "mark_damaged", terminal: t })}
                                  >
                                    <Wrench className="size-4" /> Mark damaged
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => replaceTerminal(t)}>
                                    <RefreshCw className="size-4" /> Replace
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

          {/* ------------------- TERMINAL REQUESTS ------------------- */}
          <TabsContent value="requests">
            <FutureFeatureCard
              icon={PackageCheck}
              title="Terminal Requests"
              description="Merchant-initiated requests for new terminals or additional units. Approve, reject, and dispatch with tracking numbers from this queue."
              steps={[
                { title: "Submit & triage", desc: "Merchants request terminals via the merchant portal; requests land here for ops triage." },
                { title: "Approve & allocate", desc: "Allocate a serial number from inventory and approve the dispatch." },
                { title: "Ship & track", desc: "Generate the courier tracking number; the merchant sees live delivery status." },
              ]}
            />
          </TabsContent>

          {/* --------------------- PHONE POS DEVICES ----------------- */}
          <TabsContent value="phone_pos">
            <FutureFeatureCard
              icon={QrCode}
              title="Phone POS Devices"
              description="SoftPOS (tap-to-phone) installations across customer mobile devices. Track activations, certify PIN-on-glass, and revoke credentials remotely."
              steps={[
                { title: "Provision", desc: "Approve SoftPOS app activations and issue device-bound cryptographic keys." },
                { title: "Certify", desc: "Run PIN-on-glass self-certification; block uncertified devices from accepting transactions." },
                { title: "Revoke", desc: "Remotely revoke credentials when a merchant offboards or a phone is reported lost." },
              ]}
            />
          </TabsContent>

          {/* ----------------------- DEVICE HEALTH ------------------- */}
          <TabsContent value="health">
            <FutureFeatureCard
              icon={HeartPulse}
              title="Device Health"
              description="Telemetry from active terminals: battery, connectivity, paper roll, app crashes, and last-heartbeat timestamps. Auto-ticket when a device goes dark."
              steps={[
                { title: "Heartbeats", desc: "Each terminal reports a heartbeat every 5 minutes; missed beats trigger alerts." },
                { title: "Self-diagnosis", desc: "Battery, paper, and connectivity issues are auto-classified by severity." },
                { title: "Auto-ticket", desc: "Critical failures open a support ticket assigned to the on-call ops engineer." },
              ]}
            />
          </TabsContent>

          {/* ---------------------- LOST / DAMAGED ------------------- */}
          <TabsContent value="lost_damaged">
            <FutureFeatureCard
              icon={PackageX}
              title="Lost / Damaged Devices"
              description="RMA workflow for terminals reported lost, stolen or damaged. Block, ship a replacement, and reconcile the returned unit with logistics."
              steps={[
                { title: "Report", desc: "Capture the report (lost / stolen / damaged) with merchant and incident details." },
                { title: "Block & replace", desc: "Block the device fingerprint, then trigger a replacement request to logistics." },
                { title: "Reconcile", desc: "When the broken unit returns, inspect and either refurbish or write it off." },
              ]}
            />
          </TabsContent>
        </Tabs>
      </ViewContainer>

      {/* -------------------- Detail sheet -------------------- */}
      <Sheet open={!!selectedTerminal} onOpenChange={(o) => !o && setSelectedTerminal(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          {selectedTerminal && (
            <TerminalDetailSheet
              terminal={selectedTerminal}
              countryName={countryName}
              terminalStatusBadge={terminalStatusBadge}
              typeBadge={typeBadge}
              onClose={() => setSelectedTerminal(null)}
              onActivate={() => setConfirmAction({ kind: "activate", terminal: selectedTerminal })}
              onBlock={() => setConfirmAction({ kind: "block", terminal: selectedTerminal })}
              onMarkDamaged={() => setConfirmAction({ kind: "mark_damaged", terminal: selectedTerminal })}
              onReplace={() => replaceTerminal(selectedTerminal)}
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
                confirmAction?.kind === "block"
                  ? "bg-red-600 hover:bg-red-700"
                  : confirmAction?.kind === "mark_damaged"
                    ? "bg-orange-600 hover:bg-orange-700"
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
      case "activate":
        return "Activate this terminal?";
      case "block":
        return "Block this terminal?";
      case "mark_damaged":
        return "Mark this terminal as damaged?";
    }
  }

  function confirmDescription(c: ConfirmAction | null): string {
    if (!c) return "";
    const t = c.terminal;
    const base = `Serial ${t.serialNumber} · ${t.merchantName} · ${countryName(t.countryCode)}.`;
    switch (c.kind) {
      case "activate":
        return `${base} The terminal will go live and start accepting card transactions. Activation timestamp will be set to now.`;
      case "block":
        return `${base} The terminal will be blocked from accepting transactions. The merchant will need to contact ops to re-activate.`;
      case "mark_damaged":
        return `${base} The terminal will be marked as damaged and a replacement RMA workflow will be triggered.`;
    }
  }
}

/* ============================ Sub-components ============================ */

/**
 * Scrollable table wrapper with sticky-header support and custom scrollbar.
 * Uses a raw <table> instead of the Table primitive so the sticky <thead> is
 * anchored to this outer vertical-scroll viewport (the Table primitive wraps
 * the table in its own overflow-x-auto div, breaking sticky behaviour).
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

function TerminalDetailSheet({
  terminal,
  countryName,
  terminalStatusBadge,
  typeBadge,
  onClose,
  onActivate,
  onBlock,
  onMarkDamaged,
  onReplace,
}: {
  terminal: Terminal;
  countryName: (code: string) => string;
  terminalStatusBadge: (s: Terminal["status"]) => React.ReactNode;
  typeBadge: (t: Terminal["type"]) => React.ReactNode;
  onClose: () => void;
  onActivate: () => void;
  onBlock: () => void;
  onMarkDamaged: () => void;
  onReplace: () => void;
}) {
  const isBlocked = terminal.status === "blocked";
  const isDamaged = terminal.status === "damaged";
  const isActive = terminal.status === "active";
  return (
    <>
      <SheetHeader>
        <SheetDescription className="text-[11px] font-mono">{terminal.id}</SheetDescription>
        <SheetTitle className="text-lg flex items-center gap-2">
          <Smartphone className="size-5 text-emerald-600" />
          <span className="font-mono text-base">{terminal.serialNumber}</span>
        </SheetTitle>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {terminalStatusBadge(terminal.status)}
          {typeBadge(terminal.type)}
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 space-y-4 text-sm">
        <div className="rounded-md border divide-y">
          <DetailRow label="Merchant" value={terminal.merchantName} />
          <DetailRow label="Country" value={`${terminal.countryCode} · ${countryName(terminal.countryCode)}`} />
          <DetailRow label="Model" value={terminal.model} />
          <DetailRow label="Type" value={terminal.type === "phone_pos" ? "Phone POS (SoftPOS)" : "Physical terminal"} />
          <DetailRow label="Activated" value={terminal.activatedAt ? formatDateTime(terminal.activatedAt) : "Not activated"} />
          <DetailRow label="Last seen" value={terminal.lastSeenAt ? formatDateTime(terminal.lastSeenAt) : "Never"} />
        </div>

        <div className="space-y-2">
          {!isActive && !isBlocked && !isDamaged && (
            <Button
              onClick={onActivate}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Power className="size-4" /> Activate terminal
            </Button>
          )}
          {!isBlocked && (
            <Button onClick={onBlock} variant="destructive" className="w-full">
              <Ban className="size-4" /> Block terminal
            </Button>
          )}
          {!isDamaged && (
            <Button
              onClick={onMarkDamaged}
              variant="outline"
              className="w-full text-orange-700 border-orange-300 hover:bg-orange-50 dark:text-orange-300 dark:border-orange-800 dark:hover:bg-orange-900/20"
            >
              <Wrench className="size-4" /> Mark as damaged
            </Button>
          )}
          <Button onClick={onReplace} variant="secondary" className="w-full">
            <RefreshCw className="size-4" /> Request replacement
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
          This module is on the Phase 4/5 roadmap. Use the Terminal Inventory tab in the meantime.
        </div>
      </CardContent>
    </Card>
  );
}
