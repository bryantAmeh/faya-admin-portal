"use client";

/**
 * Faya Admin Portal — Merchants View
 *
 * Lists all merchants visible to the signed-in staff member (scoped by
 * `getVisibleMerchants`). Row click / "View profile" navigates to the
 * full-page `MerchantDetailView` (route `merchant_detail`) — no sliding sheet.
 *
 * Audit action keys (from list actions):
 *   merchant.restrict / merchant.suspend / merchant.reactivate
 *   merchant.kyb_approve / merchant.kyb_reject
 */
import { useMemo, useState } from "react";
import {
  Store,
  Search,
  Eye,
  MoreHorizontal,
  Ban,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Globe2,
} from "lucide-react";
import { toast } from "sonner";
import {
  ViewHeader,
  ViewContainer,
  EmptyState,
  StatCard,
} from "@/components/portal/view-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { usePortalStore } from "@/hooks/use-portal-store";
import { adminData, logAudit } from "@/lib/admin-data";
import { getVisibleMerchants, getScopeLabel } from "@/lib/access-scope";
import {
  formatCurrency,
  formatNumber,
  formatCompact,
  timeAgo,
  statusBadge,
} from "@/lib/formatters";
import type {
  Merchant,
  CountryConfig,
  MerchantStatus,
  RiskLevel,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface MerchantsViewProps {
  merchants: Merchant[];
  countries: CountryConfig[];
}

/* ----------------------------- Status styling ---------------------------- */

const MERCHANT_STATUS_STYLES: Record<MerchantStatus, { label: string; className: string }> = {
  onboarding: { label: "Onboarding", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  restricted: { label: "Restricted", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  closed: { label: "Closed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

function merchantStatusBadge(s: MerchantStatus) {
  const v = MERCHANT_STATUS_STYLES[s];
  return (
    <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
      {v.label}
    </Badge>
  );
}

function kybBadge(s: string) {
  const v = statusBadge("kyb", s);
  return (
    <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
      {v.label}
    </Badge>
  );
}

function riskBadge(r: RiskLevel) {
  const v = statusBadge("risk", r);
  return (
    <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
      {v.label}
    </Badge>
  );
}

/* ------------------------------- Main view ------------------------------- */

export function MerchantsView({ merchants, countries }: MerchantsViewProps) {
  const { staff } = useAuth();
  const { selectMerchant, setView } = usePortalStore();

  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [kybFilter, setKybFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [confirmAction, setConfirmAction] = useState<{
    merchant: Merchant;
    action: "restrict" | "suspend" | "reactivate" | "approve_kyb" | "reject_kyb";
  } | null>(null);

  const visibleMerchants = useMemo(
    () => getVisibleMerchants(staff, countries, merchants),
    [staff, countries, merchants],
  );

  const stats = useMemo(() => {
    const total = visibleMerchants.length;
    const active = visibleMerchants.filter((m) => m.status === "active").length;
    const onboarding = visibleMerchants.filter((m) => m.status === "onboarding").length;
    const restricted = visibleMerchants.filter(
      (m) => m.status === "restricted" || m.status === "suspended",
    ).length;
    return { total, active, onboarding, restricted };
  }, [visibleMerchants]);

  const filtered = useMemo(() => {
    let list = visibleMerchants;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.legalName.toLowerCase().includes(q) ||
          m.tradingName.toLowerCase().includes(q) ||
          m.merchantCode.toLowerCase().includes(q) ||
          m.ownerName.toLowerCase().includes(q),
      );
    }
    if (countryFilter !== "all") list = list.filter((m) => m.countryCode === countryFilter);
    if (kybFilter !== "all") list = list.filter((m) => m.kybStatus === kybFilter);
    if (statusFilter !== "all") list = list.filter((m) => m.status === statusFilter);
    if (riskFilter !== "all") list = list.filter((m) => m.riskCategory === riskFilter);
    return list;
  }, [visibleMerchants, search, countryFilter, kybFilter, statusFilter, riskFilter]);

  function openProfile(m: Merchant) {
    selectMerchant(m.id);
    setView("merchant_detail");
  }

  async function applyAction(merchant: Merchant, action: string) {
    if (!staff) return;
    const actor = {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      department: staff.departmentId,
      role: staff.roleId,
    };
    const before = merchant.status;

    if (action === "restrict") {
      await adminData.updateMerchant(merchant.id, { status: "restricted", updatedAt: Date.now() });
      logAudit(actor, "merchant.restrict", "merchant", merchant.id, {
        countryCode: merchant.countryCode, beforeValue: before, afterValue: "restricted",
      });
      toast.success(`${merchant.tradingName} restricted`);
    } else if (action === "suspend") {
      await adminData.updateMerchant(merchant.id, { status: "suspended", updatedAt: Date.now() });
      logAudit(actor, "merchant.suspend", "merchant", merchant.id, {
        countryCode: merchant.countryCode, beforeValue: before, afterValue: "suspended",
      });
      toast.success(`${merchant.tradingName} suspended`);
    } else if (action === "reactivate") {
      await adminData.updateMerchant(merchant.id, { status: "active", updatedAt: Date.now() });
      logAudit(actor, "merchant.reactivate", "merchant", merchant.id, {
        countryCode: merchant.countryCode, beforeValue: before, afterValue: "active",
      });
      toast.success(`${merchant.tradingName} reactivated`);
    } else if (action === "approve_kyb") {
      await adminData.updateMerchant(merchant.id, { kybStatus: "approved", status: "active", updatedAt: Date.now() });
      logAudit(actor, "merchant.kyb_approve", "merchant", merchant.id, {
        countryCode: merchant.countryCode, beforeValue: merchant.kybStatus, afterValue: "approved",
      });
      toast.success(`KYB approved for ${merchant.tradingName}`);
    } else if (action === "reject_kyb") {
      await adminData.updateMerchant(merchant.id, { kybStatus: "rejected", status: "restricted", updatedAt: Date.now() });
      logAudit(actor, "merchant.kyb_reject", "merchant", merchant.id, {
        countryCode: merchant.countryCode, beforeValue: merchant.kybStatus, afterValue: "rejected",
      });
      toast.success(`KYB rejected for ${merchant.tradingName}`);
    }
    setConfirmAction(null);
  }

  const visibleCountryOptions = useMemo(() => {
    const codes = new Set(visibleMerchants.map((m) => m.countryCode));
    return countries.filter((c) => codes.has(c.countryCode));
  }, [visibleMerchants, countries]);

  return (
    <>
      <ViewHeader
        title="Merchants"
        description={`Merchants using Faya Business · Scope: ${getScopeLabel(staff)}`}
        icon={Store}
      />
      <ViewContainer>
        {/* Stat cards */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard label="Total Merchants" value={stats.total} icon={Store} />
          <StatCard label="Active" value={stats.active} icon={CheckCircle2} tone="success" />
          <StatCard label="Onboarding" value={stats.onboarding} icon={Eye} tone="info" />
          <StatCard label="Restricted/Suspended" value={stats.restricted} icon={Ban} tone="danger" />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, code, owner…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Country" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All countries</SelectItem>
                  {visibleCountryOptions.map((c) => (
                    <SelectItem key={c.countryCode} value={c.countryCode}>{c.countryCode} — {c.countryName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={kybFilter} onValueChange={setKybFilter}>
                <SelectTrigger className="w-[120px] h-9 text-xs"><SelectValue placeholder="KYB" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All KYB</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="restricted">Restricted</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-[110px] h-9 text-xs"><SelectValue placeholder="Risk" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All risk</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              {(search || countryFilter !== "all" || kybFilter !== "all" || statusFilter !== "all" || riskFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => { setSearch(""); setCountryFilter("all"); setKybFilter("all"); setStatusFilter("all"); setRiskFilter("all"); }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <EmptyState icon={Store} title="No merchants found" description="Try adjusting your filters." />
            ) : (
              <div className="max-h-[70vh] overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">
                    <TableRow>
                      <TableHead className="pl-4 text-xs uppercase tracking-wide text-muted-foreground">Code</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Name</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground hidden md:table-cell">Country</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Type</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">KYB</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground hidden xl:table-cell">Risk</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Terminals</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground hidden xl:table-cell">Monthly Vol</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground pr-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((m) => (
                      <TableRow
                        key={m.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => openProfile(m)}
                      >
                        <TableCell className="pl-4 font-mono text-xs">{m.merchantCode}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{m.tradingName}</div>
                          <div className="text-[11px] text-muted-foreground">{m.legalName}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{m.countryCode}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{m.businessType}</TableCell>
                        <TableCell>{kybBadge(m.kybStatus)}</TableCell>
                        <TableCell className="hidden xl:table-cell">{riskBadge(m.riskCategory)}</TableCell>
                        <TableCell>{merchantStatusBadge(m.status)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm tabular-nums">
                          {m.terminalCount > 0 ? `${m.terminalCount}T / ${m.phonePosCount}P` : "—"}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-sm tabular-nums">
                          {m.monthlyVolume > 0 ? formatCompact(m.monthlyVolume) : "—"}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openProfile(m)}>
                                <Eye className="size-3.5 mr-2" /> View profile
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {(m.kybStatus === "pending" || m.kybStatus === "in_review") && (
                                <>
                                  <DropdownMenuItem onClick={() => setConfirmAction({ merchant: m, action: "approve_kyb" })}>
                                    <CheckCircle2 className="size-3.5 mr-2 text-emerald-600" /> Approve KYB
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setConfirmAction({ merchant: m, action: "reject_kyb" })}>
                                    <XCircle className="size-3.5 mr-2 text-red-600" /> Reject KYB
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {m.status !== "restricted" && m.status !== "suspended" && (
                                <DropdownMenuItem onClick={() => setConfirmAction({ merchant: m, action: "restrict" })}>
                                  <Ban className="size-3.5 mr-2 text-orange-600" /> Restrict
                                </DropdownMenuItem>
                              )}
                              {m.status !== "suspended" && (
                                <DropdownMenuItem onClick={() => setConfirmAction({ merchant: m, action: "suspend" })}>
                                  <Pause className="size-3.5 mr-2 text-red-600" /> Suspend
                                </DropdownMenuItem>
                              )}
                              {(m.status === "restricted" || m.status === "suspended") && (
                                <DropdownMenuItem onClick={() => setConfirmAction({ merchant: m, action: "reactivate" })}>
                                  <RotateCcw className="size-3.5 mr-2 text-emerald-600" /> Reactivate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </ViewContainer>

      {/* Confirmation dialog */}
      {confirmAction && (
        <AlertDialog open onOpenChange={(o) => !o && setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction.action === "approve_kyb" ? "Approve KYB" :
                 confirmAction.action === "reject_kyb" ? "Reject KYB" :
                 confirmAction.action === "restrict" ? "Restrict merchant" :
                 confirmAction.action === "suspend" ? "Suspend merchant" :
                 "Reactivate merchant"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction.action === "approve_kyb"
                  ? `Approve KYB for ${confirmAction.merchant.tradingName}? The merchant will be activated.`
                  : confirmAction.action === "reject_kyb"
                  ? `Reject KYB for ${confirmAction.merchant.tradingName}? The merchant will be restricted.`
                  : confirmAction.action === "restrict"
                  ? `Restrict ${confirmAction.merchant.tradingName}? They won't be able to process payments.`
                  : confirmAction.action === "suspend"
                  ? `Suspend ${confirmAction.merchant.tradingName}? All operations will be blocked.`
                  : `Reactivate ${confirmAction.merchant.tradingName}? Normal operations will resume.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={cn(
                  confirmAction.action === "reactivate" || confirmAction.action === "approve_kyb"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700",
                )}
                onClick={() => applyAction(confirmAction.merchant, confirmAction.action)}
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}
