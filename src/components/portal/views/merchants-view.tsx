"use client";

/**
 * Faya Admin Portal — Merchants View
 *
 * Tabbed merchant profiles — POS Staff / Terminals / Settlements / Disputes
 * / POS Device Requests are rendered as TABS inside the merchant detail
 * Sheet (not as separate nav items). Per the architecture spec, the admin
 * manages merchant data here; the separate Faya Business merchant app reads
 * from the same Firestore collections via the same `adminData` patch helpers.
 *
 * Country scoping: Super Admin sees all merchants; other staff see only
 * the country codes listed on their `staff.countries` access record
 * (resolved via `getVisibleMerchants`).
 *
 * POS Device Requests implement the spec's device capability approval rule:
 *   - The Faya POS app reports device capabilities (NFC, card reader, swipe)
 *     when the merchant requests a terminal or activates phone POS.
 *   - If at least one of NFC / card reader / swipe is supported → canBeApproved = true
 *   - If NONE are supported → canBeApproved = false → the Approve button is
 *     disabled and an "Auto-decline" action sets status to "auto_declined".
 *   - Device integrity and screen lock warnings surface as amber banners.
 *
 * Audit action keys: merchant.approve_kyb / merchant.reject_kyb /
 * merchant.restrict / merchant.suspend / merchant.reactivate /
 * pos_staff.suspend / pos_staff.reactivate / pos_staff.reset_pin /
 * pos_staff.force_logout / terminal.activate / terminal.block /
 * settlement.retry / dispute.request_evidence / dispute.update_status /
 * pos_device.approve / pos_device.decline / pos_device.auto_decline.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Search,
  Filter,
  Eye,
  MoreHorizontal,
  Ban,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Users as UsersIcon,
  Smartphone,
  CreditCard,
  Wallet,
  Receipt,
  Scale,
  Package,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  Clock,
  UserCheck,
  UserX,
  KeyRound,
  LogOut,
  PlayCircle,
  Lock,
  Snowflake,
  Cpu,
  Battery,
  MonitorSmartphone,
  RefreshCw,
  Lock as LockIcon,
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
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
import { getVisibleMerchants, getScopeLabel } from "@/lib/access-scope";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  timeAgo,
  statusBadge,
} from "@/lib/formatters";
import type {
  Merchant,
  CountryConfig,
  PosStaff,
  Terminal,
  Settlement,
  Dispute,
  PosDeviceRequest,
  MerchantStatus,
  KybStatus,
  PlatformKey,
  RiskLevel,
} from "@/lib/types";
import { PLATFORM_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MerchantsViewProps {
  merchants: Merchant[];
  countries: CountryConfig[];
}

/* ----------------------------- Status styling ---------------------------- */

const MERCHANT_STATUS_STYLES: Record<
  MerchantStatus,
  { label: string; className: string }
> = {
  onboarding: {
    label: "Onboarding",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  restricted: {
    label: "Restricted",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  },
  suspended: {
    label: "Suspended",
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
  closed: {
    label: "Closed",
    className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  },
};

const POS_STAFF_STATUS_STYLES: Record<
  PosStaff["status"],
  { label: string; className: string }
> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  removed: { label: "Removed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const TERMINAL_STATUS_STYLES: Record<
  Terminal["status"],
  { label: string; className: string }
> = {
  inventory: { label: "Inventory", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  shipped: { label: "Shipped", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  delivered: { label: "Delivered", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  blocked: { label: "Blocked", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  damaged: { label: "Damaged", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
};

const SETTLEMENT_STATUS_STYLES: Record<
  Settlement["status"],
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  processing: { label: "Processing", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  held: { label: "Held", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
};

const DISPUTE_STATUS_STYLES: Record<
  Dispute["status"],
  { label: string; className: string }
> = {
  new: { label: "New", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  awaiting_evidence: { label: "Awaiting Evidence", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  evidence_submitted: { label: "Evidence Submitted", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  under_review: { label: "Under Review", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  won: { label: "Won", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  lost: { label: "Lost", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  expired: { label: "Expired", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const POS_DEVICE_REQUEST_STATUS_STYLES: Record<
  PosDeviceRequest["status"],
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  declined: { label: "Declined", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  auto_declined: { label: "Auto-Declined", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const RISK_TONE = (level: RiskLevel) => statusBadge("risk", level);

/* ------------------------------ Main view -------------------------------- */

export function MerchantsView({ merchants, countries }: MerchantsViewProps) {
  const { staff } = useAuth();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [kybFilter, setKybFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    merchant: Merchant;
    action: "restrict" | "suspend" | "reactivate" | "approve_kyb" | "reject_kyb";
  } | null>(null);

  const visibleMerchants = useMemo(
    () => getVisibleMerchants(staff, countries, merchants),
    [staff, countries, merchants],
  );

  const filterableCountries = useMemo(() => {
    const codes = new Set(visibleMerchants.map((m) => m.countryCode));
    return countries.filter((c) => codes.has(c.countryCode));
  }, [countries, visibleMerchants]);

  const filtered = useMemo(() => {
    let list = visibleMerchants;
    if (countryFilter !== "all")
      list = list.filter((m) => m.countryCode === countryFilter);
    if (kybFilter !== "all") list = list.filter((m) => m.kybStatus === kybFilter);
    if (statusFilter !== "all") list = list.filter((m) => m.status === statusFilter);
    if (riskFilter !== "all") list = list.filter((m) => m.riskCategory === riskFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.tradingName.toLowerCase().includes(q) ||
          m.legalName.toLowerCase().includes(q) ||
          m.merchantCode.toLowerCase().includes(q) ||
          m.contactEmail.toLowerCase().includes(q) ||
          m.ownerName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [visibleMerchants, countryFilter, kybFilter, statusFilter, riskFilter, search]);

  const stats = useMemo(() => {
    const total = visibleMerchants.length;
    const active = visibleMerchants.filter((m) => m.status === "active").length;
    const onboarding = visibleMerchants.filter((m) => m.status === "onboarding").length;
    const restricted = visibleMerchants.filter(
      (m) => m.status === "restricted" || m.status === "suspended",
    ).length;
    return { total, active, onboarding, restricted };
  }, [visibleMerchants]);

  function countryName(code: string): string {
    return countries.find((c) => c.countryCode === code)?.countryName ?? code;
  }

  function merchantStatusBadge(s: MerchantStatus) {
    const v = MERCHANT_STATUS_STYLES[s];
    return (
      <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
        {v.label}
      </Badge>
    );
  }

  function kybBadge(s: KybStatus) {
    const v = statusBadge("kyb", s);
    return (
      <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
        {v.label}
      </Badge>
    );
  }

  function riskBadge(level: RiskLevel) {
    const v = RISK_TONE(level);
    return (
      <Badge variant="secondary" className={cn("text-[10px] capitalize", v.className)}>
        {v.label}
      </Badge>
    );
  }

  function platformChips(platforms: PlatformKey[]) {
    if (!platforms.length)
      return <span className="text-xs text-muted-foreground italic">No platforms</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {platforms.map((p) => (
          <Badge
            key={p}
            variant="outline"
            className="text-[9px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
          >
            {PLATFORM_LABELS[p].label}
          </Badge>
        ))}
      </div>
    );
  }

  /* --------------------------- Mutations --------------------------- */

  function applyMerchantAction(
    merchant: Merchant,
    action: "restrict" | "suspend" | "reactivate" | "approve_kyb" | "reject_kyb",
  ) {
    if (!staff) return;
    const before = `${merchant.kybStatus} / ${merchant.status}`;
    let patch: Partial<Merchant> = {};
    let after = "";

    if (action === "restrict") {
      patch = { status: "restricted", updatedAt: Date.now() };
      after = `${merchant.kybStatus} / restricted`;
    } else if (action === "suspend") {
      patch = { status: "suspended", updatedAt: Date.now() };
      after = `${merchant.kybStatus} / suspended`;
    } else if (action === "reactivate") {
      patch = { status: "active", updatedAt: Date.now() };
      after = `${merchant.kybStatus} / active`;
    } else if (action === "approve_kyb") {
      patch = { kybStatus: "approved", status: "active", updatedAt: Date.now() };
      after = `approved / active`;
    } else if (action === "reject_kyb") {
      patch = { kybStatus: "rejected", status: "restricted", updatedAt: Date.now() };
      after = `rejected / restricted`;
    }

    adminData.updateMerchant(merchant.id, patch);
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      `merchant.${action}`,
      "merchant",
      merchant.id,
      {
        countryCode: merchant.countryCode,
        beforeValue: before,
        afterValue: after,
      },
    );
    toast.success(
      `${action.replace(/_/g, " ")} — ${merchant.tradingName}`,
      {
        description: `${merchant.merchantCode} · ${before} → ${after}`,
      },
    );
    setConfirmAction(null);
    setSelectedMerchant(null);
  }

  function confirmTitle(action: string): string {
    if (action === "approve_kyb") return "Approve KYB?";
    if (action === "reject_kyb") return "Reject KYB?";
    if (action === "restrict") return "Restrict merchant?";
    if (action === "suspend") return "Suspend merchant?";
    return "Reactivate merchant?";
  }

  function confirmDescription(action: string, merchant: Merchant): string {
    if (action === "approve_kyb") {
      return `Approving KYB for ${merchant.tradingName} will set the merchant to KYB approved and status active. The merchant app reads from the same database — they will see the change on next login. This is recorded in the audit log.`;
    }
    if (action === "reject_kyb") {
      return `Rejecting KYB for ${merchant.tradingName} will set the merchant to KYB rejected and status restricted. This is recorded in the audit log and cannot be undone.`;
    }
    const newStatus =
      action === "restrict" ? "restricted" : action === "suspend" ? "suspended" : "active";
    return `You are about to set ${merchant.tradingName} (${merchant.merchantCode}) to status "${newStatus}". The merchant app reads from the same database — they will see the change on next login. This is recorded in the audit log.`;
  }

  return (
    <>
      <ViewHeader
        title="Merchants"
        description="Manage Faya Business merchants — KYB, POS staff, terminals, settlements, disputes, and POS device requests."
        icon={Building2}
        actions={
          <Badge variant="outline" className="hidden sm:inline-flex text-[11px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
            Scope: {getScopeLabel(staff)}
          </Badge>
        }
      />
      <ViewContainer>
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Merchants"
            value={formatNumber(stats.total)}
            hint="Visible in scope"
            icon={Building2}
            tone="default"
          />
          <StatCard
            label="Active"
            value={formatNumber(stats.active)}
            hint="Status: active"
            icon={UserCheck}
            tone="success"
          />
          <StatCard
            label="Onboarding"
            value={formatNumber(stats.onboarding)}
            hint="Awaiting KYB"
            icon={Clock}
            tone="warning"
          />
          <StatCard
            label="Restricted / Suspended"
            value={formatNumber(stats.restricted)}
            hint="Actioned merchants"
            icon={UserX}
            tone="danger"
          />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter className="size-3.5" /> Filters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Trading/legal name, code…"
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Country</Label>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All countries</SelectItem>
                    {filterableCountries.map((c) => (
                      <SelectItem key={c.countryCode} value={c.countryCode}>
                        {c.countryName} ({c.countryCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">KYB status</Label>
                <Select value={kybFilter} onValueChange={setKybFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All KYB" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All KYB</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Account status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Risk</Label>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All risk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All risk</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
                {visibleMerchants.length} visible merchants
              </span>
              {(search ||
                countryFilter !== "all" ||
                kybFilter !== "all" ||
                statusFilter !== "all" ||
                riskFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setSearch("");
                    setCountryFilter("all");
                    setKybFilter("all");
                    setStatusFilter("all");
                    setRiskFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Merchants table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="size-4 text-emerald-600" /> Merchants
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No merchants found"
                description="Adjust the filters above or wait for new merchant signups."
              />
            ) : (
              <ScrollTable>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                  <TableRow>
                    <TableHead className="pl-4">Merchant Code</TableHead>
                    <TableHead>Trading Name</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead className="hidden md:table-cell">Business Type</TableHead>
                    <TableHead>KYB</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Terminals</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Monthly Vol</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow key={m.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedMerchant(m)}>
                      <TableCell className="pl-4 font-mono text-xs">{m.merchantCode}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{m.tradingName}</div>
                        <div className="text-[11px] text-muted-foreground">{m.legalName}</div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{m.countryCode}</span>
                        <div className="text-[10px] text-muted-foreground">
                          {countryName(m.countryCode)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs capitalize">
                        {m.businessType.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>{kybBadge(m.kybStatus)}</TableCell>
                      <TableCell>{riskBadge(m.riskCategory)}</TableCell>
                      <TableCell>{merchantStatusBadge(m.status)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatNumber(m.terminalCount + m.phonePosCount)}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell font-mono text-xs tabular-nums">
                        {formatCurrency(m.monthlyVolume, m.settlementCurrency)}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setSelectedMerchant(m)}>
                              <Eye className="size-4 mr-2" /> View profile
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {(m.kybStatus === "pending" ||
                              m.kybStatus === "in_review" ||
                              m.kybStatus === "escalated") && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmAction({ merchant: m, action: "approve_kyb" })
                                }
                              >
                                <CheckCircle2 className="size-4 mr-2 text-emerald-600" /> Approve KYB
                              </DropdownMenuItem>
                            )}
                            {(m.kybStatus === "pending" ||
                              m.kybStatus === "in_review" ||
                              m.kybStatus === "escalated") && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmAction({ merchant: m, action: "reject_kyb" })
                                }
                              >
                                <XCircle className="size-4 mr-2 text-red-600" /> Reject KYB
                              </DropdownMenuItem>
                            )}
                            {m.status !== "restricted" &&
                              m.status !== "suspended" &&
                              m.status !== "closed" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirmAction({ merchant: m, action: "restrict" })
                                  }
                                >
                                  <Ban className="size-4 mr-2 text-orange-600" /> Restrict
                                </DropdownMenuItem>
                              )}
                            {m.status !== "suspended" && m.status !== "closed" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmAction({ merchant: m, action: "suspend" })
                                }
                              >
                                <Pause className="size-4 mr-2 text-red-600" /> Suspend
                              </DropdownMenuItem>
                            )}
                            {(m.status === "restricted" || m.status === "suspended") && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmAction({ merchant: m, action: "reactivate" })
                                }
                              >
                                <RotateCcw className="size-4 mr-2 text-emerald-600" /> Reactivate
                              </DropdownMenuItem>
                            )}
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
      </ViewContainer>

      {/* --------------------- Merchant detail sheet (tabbed) -------------------- */}
      <Sheet open={!!selectedMerchant} onOpenChange={(o) => !o && setSelectedMerchant(null)}>
        <SheetContent side="right" className="w-full sm:max-w-3xl flex flex-col p-0">
          {selectedMerchant && (
            <MerchantDetailSheet
              merchant={selectedMerchant}
              countryName={countryName}
              merchantStatusBadge={merchantStatusBadge}
              kybBadge={kybBadge}
              riskBadge={riskBadge}
              platformChips={platformChips}
              onClose={() => setSelectedMerchant(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ----------------------- Confirmation dialog ---------------------- */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction && confirmTitle(confirmAction.action)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction && confirmDescription(confirmAction.action, confirmAction.merchant)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                confirmAction?.action === "reactivate" ||
                  confirmAction?.action === "approve_kyb"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white",
              )}
              onClick={() =>
                confirmAction && applyMerchantAction(confirmAction.merchant, confirmAction.action)
              }
            >
              {confirmAction?.action === "approve_kyb" && (
                <CheckCircle2 className="size-4 mr-1" />
              )}
              {confirmAction?.action === "reject_kyb" && <XCircle className="size-4 mr-1" />}
              {confirmAction?.action === "restrict" && <Ban className="size-4 mr-1" />}
              {confirmAction?.action === "suspend" && <Pause className="size-4 mr-1" />}
              {confirmAction?.action === "reactivate" && <RotateCcw className="size-4 mr-1" />}
              {confirmAction
                ? confirmAction.action === "approve_kyb"
                  ? "Approve KYB"
                  : confirmAction.action === "reject_kyb"
                    ? "Reject KYB"
                    : confirmAction.action === "restrict"
                      ? "Restrict"
                      : confirmAction.action === "suspend"
                        ? "Suspend"
                        : "Reactivate"
                : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}

/* --------------------------- Merchant detail sheet ----------------------- */

function MerchantDetailSheet({
  merchant,
  countryName,
  merchantStatusBadge,
  kybBadge,
  riskBadge,
  platformChips,
  onClose,
}: {
  merchant: Merchant;
  countryName: (code: string) => string;
  merchantStatusBadge: (s: MerchantStatus) => React.ReactNode;
  kybBadge: (s: KybStatus) => React.ReactNode;
  riskBadge: (level: RiskLevel) => React.ReactNode;
  platformChips: (p: PlatformKey[]) => React.ReactNode;
  onClose: () => void;
}) {
  const { staff } = useAuth();
  const [tab, setTab] = useState("profile");

  // Live subscriptions — open while sheet is mounted.
  const [posStaff, setPosStaff] = useState<PosStaff[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [posRequests, setPosRequests] = useState<PosDeviceRequest[]>([]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    try {
      unsubs.push(
        adminData.subscribePosStaff((items) =>
          setPosStaff(items.filter((s) => s.merchantId === merchant.id)),
        ),
      );
      unsubs.push(
        adminData.subscribeTerminals((items) =>
          setTerminals(
            items.filter(
              (t) =>
                t.merchantName === merchant.tradingName ||
                t.merchantName === merchant.legalName,
            ),
          ),
        ),
      );
      unsubs.push(
        adminData.subscribeSettlements((items) =>
          setSettlements(
            items.filter(
              (s) =>
                s.merchantName === merchant.legalName ||
                s.merchantName === merchant.tradingName,
            ),
          ),
        ),
      );
      unsubs.push(
        adminData.subscribeDisputes((items) =>
          setDisputes(
            items.filter(
              (d) =>
                d.merchantName === merchant.legalName ||
                d.merchantName === merchant.tradingName,
            ),
          ),
        ),
      );
      unsubs.push(
        adminData.subscribePosDeviceRequests((items) =>
          setPosRequests(items.filter((r) => r.merchantId === merchant.id)),
        ),
      );
    } catch (e) {
      console.error("[MerchantDetailSheet] subscription error:", e);
    }
    return () => unsubs.forEach((u) => u());
  }, [merchant.id, merchant.tradingName, merchant.legalName]);

  /* --------------------------- POS staff actions --------------------------- */
  function suspendStaff(s: PosStaff) {
    if (!staff) return;
    adminData.updatePosStaff(s.id, { status: "suspended", updatedAt: Date.now() });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "pos_staff.suspend",
      "pos_staff",
      s.id,
      {
        countryCode: s.countryCode,
        beforeValue: s.status,
        afterValue: "suspended",
      },
    );
    toast.success(`Suspended POS staff: ${s.firstName} ${s.lastName}`, {
      description: `${s.staffCode} · ${s.branchName}`,
    });
  }

  function reactivateStaff(s: PosStaff) {
    if (!staff) return;
    adminData.updatePosStaff(s.id, { status: "active", updatedAt: Date.now() });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "pos_staff.reactivate",
      "pos_staff",
      s.id,
      {
        countryCode: s.countryCode,
        beforeValue: s.status,
        afterValue: "active",
      },
    );
    toast.success(`Reactivated POS staff: ${s.firstName} ${s.lastName}`, {
      description: `${s.staffCode} · ${s.branchName}`,
    });
  }

  function resetStaffPin(s: PosStaff) {
    if (!staff) return;
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "pos_staff.reset_pin",
      "pos_staff",
      s.id,
      {
        countryCode: s.countryCode,
        reason: `PIN reset requested for ${s.staffCode}`,
      },
    );
    toast.success(`PIN reset email sent: ${s.firstName} ${s.lastName}`, {
      description: `${s.staffCode} · they will set a new PIN on next POS app login`,
    });
  }

  function forceStaffLogout(s: PosStaff) {
    if (!staff) return;
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "pos_staff.force_logout",
      "pos_staff",
      s.id,
      {
        countryCode: s.countryCode,
        reason: `Force logout for ${s.staffCode}`,
      },
    );
    toast.success(`Force logout issued: ${s.firstName} ${s.lastName}`, {
      description: `${s.staffCode} · their POS session will be terminated on next sync`,
    });
  }

  /* --------------------------- Terminal actions --------------------------- */
  function activateTerminal(t: Terminal) {
    if (!staff) return;
    adminData.updateTerminal(t.id, {
      status: "active",
      activatedAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "terminal.activate",
      "terminal",
      t.id,
      {
        countryCode: t.countryCode,
        beforeValue: t.status,
        afterValue: "active",
      },
    );
    toast.success(`Terminal activated: ${t.serialNumber}`, {
      description: `${t.model} · ${t.merchantName}`,
    });
  }

  function blockTerminal(t: Terminal) {
    if (!staff) return;
    adminData.updateTerminal(t.id, { status: "blocked", lastSeenAt: Date.now() });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "terminal.block",
      "terminal",
      t.id,
      {
        countryCode: t.countryCode,
        beforeValue: t.status,
        afterValue: "blocked",
      },
    );
    toast.error(`Terminal blocked: ${t.serialNumber}`, {
      description: `${t.model} · ${t.merchantName}`,
    });
  }

  /* --------------------------- Settlement actions --------------------------- */
  function retrySettlement(s: Settlement) {
    if (!staff) return;
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "settlement.retry",
      "settlement",
      s.id,
      {
        countryCode: s.countryCode,
        beforeValue: s.status,
        afterValue: "processing",
        reason: `Retry requested for failed settlement ${s.batchId}`,
      },
    );
    toast.success(`Settlement retry queued: ${s.batchId}`, {
      description: `${formatCurrency(s.amount, s.currency)} · ${s.merchantName}`,
    });
  }

  function viewSettlementDetails(s: Settlement) {
    toast.info(`Settlement: ${s.batchId}`, {
      description: `${formatCurrency(s.amount, s.currency)} · ${s.status} · scheduled ${formatDateTime(s.scheduledAt)}${s.failureReason ? ` · reason: ${s.failureReason}` : ""}`,
    });
  }

  /* --------------------------- Dispute actions --------------------------- */
  function requestEvidence(d: Dispute) {
    if (!staff) return;
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "dispute.request_evidence",
      "dispute",
      d.id,
      {
        countryCode: d.countryCode,
        beforeValue: d.status,
        afterValue: "awaiting_evidence",
        reason: `Evidence requested from ${d.merchantName}`,
      },
    );
    toast.success(`Evidence requested: ${d.id}`, {
      description: `${formatCurrency(d.amount, d.currency)} · ${d.merchantName}`,
    });
  }

  function updateDisputeStatus(d: Dispute, status: Dispute["status"]) {
    if (!staff) return;
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "dispute.update_status",
      "dispute",
      d.id,
      {
        countryCode: d.countryCode,
        beforeValue: d.status,
        afterValue: status,
      },
    );
    toast.success(`Dispute updated: ${d.id}`, {
      description: `${d.status} → ${status}`,
    });
  }

  /* --------------------------- POS device request actions --------------------------- */
  function approvePosRequest(r: PosDeviceRequest) {
    if (!staff) return;
    adminData.updatePosDeviceRequest(r.id, {
      status: "approved",
      reviewedBy: staff.id,
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "pos_device.approve",
      "pos_device_request",
      r.id,
      {
        countryCode: r.countryCode,
        beforeValue: r.status,
        afterValue: "approved",
        reason: `Device ${r.deviceInfo.deviceModel} supports payment method`,
      },
    );
    toast.success(`POS device approved: ${r.requestCode}`, {
      description: `${r.deviceInfo.deviceModel} · ${r.type.replace(/_/g, " ")}`,
    });
  }

  function autoDeclinePosRequest(r: PosDeviceRequest) {
    if (!staff) return;
    adminData.updatePosDeviceRequest(r.id, {
      status: "auto_declined",
      reviewedAt: Date.now(),
      declineReason: "Device does not support NFC, card reader, or swipe.",
      updatedAt: Date.now(),
    });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "pos_device.auto_decline",
      "pos_device_request",
      r.id,
      {
        countryCode: r.countryCode,
        beforeValue: r.status,
        afterValue: "auto_declined",
        reason: "Device does not support NFC, card reader, or swipe.",
      },
    );
    toast.error(`POS device auto-declined: ${r.requestCode}`, {
      description: `No payment method (NFC/card reader/swipe) supported on ${r.deviceInfo.deviceModel}`,
    });
  }

  /* --------------------------- Decline dialog --------------------------- */
  const [declineTarget, setDeclineTarget] = useState<PosDeviceRequest | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  function submitDecline() {
    if (!staff || !declineTarget) return;
    const reason =
      declineReason.trim() || "Declined by reviewer — see audit log for details.";
    adminData.updatePosDeviceRequest(declineTarget.id, {
      status: "declined",
      reviewedBy: staff.id,
      reviewedAt: Date.now(),
      declineReason: reason,
      updatedAt: Date.now(),
    });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "pos_device.decline",
      "pos_device_request",
      declineTarget.id,
      {
        countryCode: declineTarget.countryCode,
        beforeValue: declineTarget.status,
        afterValue: "declined",
        reason,
      },
    );
    toast.error(`POS device declined: ${declineTarget.requestCode}`, {
      description: reason,
    });
    setDeclineTarget(null);
    setDeclineReason("");
  }

  /* --------------------------- Badge helpers --------------------------- */
  function posStaffStatusBadge(s: PosStaff["status"]) {
    const v = POS_STAFF_STATUS_STYLES[s];
    return (
      <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
        {v.label}
      </Badge>
    );
  }
  function terminalStatusBadge(s: Terminal["status"]) {
    const v = TERMINAL_STATUS_STYLES[s];
    return (
      <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
        {v.label}
      </Badge>
    );
  }
  function settlementStatusBadge(s: Settlement["status"]) {
    const v = SETTLEMENT_STATUS_STYLES[s];
    return (
      <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
        {v.label}
      </Badge>
    );
  }
  function disputeStatusBadge(s: Dispute["status"]) {
    const v = DISPUTE_STATUS_STYLES[s];
    return (
      <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
        {v.label}
      </Badge>
    );
  }
  function posRequestStatusBadge(s: PosDeviceRequest["status"]) {
    const v = POS_DEVICE_REQUEST_STATUS_STYLES[s];
    return (
      <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
        {v.label}
      </Badge>
    );
  }

  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-3 border-b">
        <SheetDescription className="text-[11px] font-mono">{merchant.merchantCode}</SheetDescription>
        <SheetTitle className="text-lg flex items-center gap-2">
          <Building2 className="size-5 text-emerald-600" />
          {merchant.tradingName}
        </SheetTitle>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {merchantStatusBadge(merchant.status)}
          {kybBadge(merchant.kybStatus)}
          {riskBadge(merchant.riskCategory)}
          <Badge variant="outline" className="text-[10px] font-mono">
            {merchant.countryCode} · {countryName(merchant.countryCode)}
          </Badge>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="px-6 pt-3 border-b bg-muted/30">
            <TabsList className="bg-transparent h-auto p-0 flex flex-wrap gap-1">
              <TabsTrigger value="profile" className="text-xs">
                <Building2 className="size-3.5 mr-1" /> Profile
              </TabsTrigger>
              <TabsTrigger value="pos_staff" className="text-xs">
                <UsersIcon className="size-3.5 mr-1" /> POS Staff
                <CountBadge n={posStaff.length} />
              </TabsTrigger>
              <TabsTrigger value="terminals" className="text-xs">
                <Smartphone className="size-3.5 mr-1" /> Terminals
                <CountBadge n={terminals.length} />
              </TabsTrigger>
              <TabsTrigger value="settlements" className="text-xs">
                <Wallet className="size-3.5 mr-1" /> Settlements
                <CountBadge n={settlements.length} />
              </TabsTrigger>
              <TabsTrigger value="disputes" className="text-xs">
                <Scale className="size-3.5 mr-1" /> Disputes
                <CountBadge n={disputes.length} />
              </TabsTrigger>
              <TabsTrigger value="pos_requests" className="text-xs">
                <Package className="size-3.5 mr-1" /> POS Requests
                <CountBadge n={posRequests.length} />
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Profile tab */}
          <TabsContent value="profile" className="p-6 pt-4 m-0 space-y-4 text-sm">
            <div>
              <SectionLabel icon={Building2}>Business profile</SectionLabel>
              <div className="rounded-md border divide-y">
                <DetailRow label="Trading name" value={merchant.tradingName} />
                <DetailRow label="Legal name" value={merchant.legalName} />
                <DetailRow label="Merchant code" value={<span className="font-mono text-xs">{merchant.merchantCode}</span>} />
                <DetailRow label="Business type" value={<span className="capitalize">{merchant.businessType.replace(/_/g, " ")}</span>} />
                <DetailRow label="Industry" value={merchant.industry} />
                <DetailRow label="City" value={merchant.city} />
                <DetailRow label="Address" value={merchant.address} />
              </div>
            </div>

            <div>
              <SectionLabel icon={UsersIcon}>Owner details</SectionLabel>
              <div className="rounded-md border divide-y">
                <DetailRow label="Owner" value={merchant.ownerName} />
                <DetailRow label="Owner email" value={merchant.ownerEmail} />
                <DetailRow label="Owner phone" value={merchant.ownerPhone} />
                <DetailRow label="Contact email" value={merchant.contactEmail} />
                <DetailRow label="Contact phone" value={merchant.contactPhone} />
              </div>
            </div>

            <div>
              <SectionLabel icon={ShieldCheck}>KYB</SectionLabel>
              <div className="rounded-md border divide-y">
                <DetailRow label="KYB status" value={kybBadge(merchant.kybStatus)} />
                <DetailRow label="KYB case" value={merchant.kybCaseId ? <span className="font-mono text-xs">{merchant.kybCaseId}</span> : "—"} />
                <DetailRow label="Risk category" value={riskBadge(merchant.riskCategory)} />
                <DetailRow label="Account status" value={merchantStatusBadge(merchant.status)} />
                <DetailRow label="Chargeback rate" value={<span className="tabular-nums">{merchant.chargebackRate.toFixed(1)}%</span>} />
              </div>
            </div>

            <div>
              <SectionLabel icon={Info}>Platforms</SectionLabel>
              <div className="rounded-md border p-3">
                {platformChips(merchant.platforms)}
              </div>
            </div>

            <div>
              <SectionLabel icon={Smartphone}>Terminal stats</SectionLabel>
              <div className="grid grid-cols-3 gap-3">
                <MiniStat
                  label="Physical terminals"
                  value={formatNumber(merchant.terminalCount)}
                  tone="default"
                />
                <MiniStat
                  label="Phone POS"
                  value={formatNumber(merchant.phonePosCount)}
                  tone="info"
                />
                <MiniStat
                  label="Total devices"
                  value={formatNumber(merchant.terminalCount + merchant.phonePosCount)}
                  tone="success"
                />
              </div>
            </div>

            <div>
              <SectionLabel icon={Receipt}>Transaction stats</SectionLabel>
              <div className="grid grid-cols-3 gap-3">
                <MiniStat
                  label="Lifetime volume"
                  value={formatCurrency(merchant.lifetimeVolume, merchant.settlementCurrency)}
                  tone="success"
                />
                <MiniStat
                  label="Monthly volume"
                  value={formatCurrency(merchant.monthlyVolume, merchant.settlementCurrency)}
                  tone="info"
                />
                <MiniStat
                  label="Transactions"
                  value={formatNumber(merchant.transactionCount)}
                  tone="default"
                />
              </div>
            </div>

            <div>
              <SectionLabel icon={Wallet}>Settlement info</SectionLabel>
              <div className="rounded-md border divide-y">
                <DetailRow label="Settlement currency" value={<span className="font-mono text-xs">{merchant.settlementCurrency}</span>} />
                <DetailRow label="Member since" value={formatDateTime(merchant.createdAt)} />
                <DetailRow label="Last updated" value={timeAgo(merchant.updatedAt)} />
              </div>
            </div>

            {merchant.notes && (
              <div>
                <SectionLabel icon={Info}>Notes</SectionLabel>
                <p className="text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-md p-3 text-amber-900 dark:text-amber-200">
                  {merchant.notes}
                </p>
              </div>
            )}

            <div className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-900/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
              <Info className="size-3.5 inline mr-1 -mt-0.5" />
              The Faya Business merchant app reads this record from the same
              Firestore collection — status changes appear on the merchant&apos;s
              next login.
            </div>

            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={onClose} className="w-full">
                Close profile
              </Button>
            </div>
          </TabsContent>

          {/* POS Staff tab */}
          <TabsContent value="pos_staff" className="p-6 pt-4 m-0 space-y-3 text-sm">
            {posStaff.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                title="No POS staff"
                description="This merchant has not provisioned any Faya POS app users (cashiers, supervisors, branch managers)."
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="pl-4">Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="hidden md:table-cell">Branch</TableHead>
                        <TableHead className="hidden lg:table-cell">Device</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right pr-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {posStaff.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="pl-4 font-mono text-xs">{s.staffCode}</TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">
                              {s.firstName} {s.lastName}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {s.email}
                            </div>
                          </TableCell>
                          <TableCell className="capitalize text-xs">
                            {s.role.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs">
                            {s.branchName}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell font-mono text-xs">
                            {s.deviceAssigned ?? "—"}
                          </TableCell>
                          <TableCell>{posStaffStatusBadge(s.status)}</TableCell>
                          <TableCell className="text-right pr-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel className="text-xs">Staff actions</DropdownMenuLabel>
                                {s.status === "active" && (
                                  <DropdownMenuItem onClick={() => suspendStaff(s)}>
                                    <Pause className="size-4 mr-2 text-red-600" /> Suspend
                                  </DropdownMenuItem>
                                )}
                                {s.status === "suspended" && (
                                  <DropdownMenuItem onClick={() => reactivateStaff(s)}>
                                    <RotateCcw className="size-4 mr-2 text-emerald-600" /> Reactivate
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => resetStaffPin(s)}>
                                  <KeyRound className="size-4 mr-2 text-amber-600" /> Reset PIN
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => forceStaffLogout(s)}>
                                  <LogOut className="size-4 mr-2 text-orange-600" /> Force logout
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </ScrollTable>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Terminals tab */}
          <TabsContent value="terminals" className="p-6 pt-4 m-0 space-y-3 text-sm">
            {terminals.length === 0 ? (
              <EmptyState
                icon={Smartphone}
                title="No terminals"
                description="This merchant has no physical terminals or phone POS devices registered. Terminals are matched by merchant name (trading or legal)."
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="pl-4">Serial</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">Activated</TableHead>
                        <TableHead className="hidden lg:table-cell">Last seen</TableHead>
                        <TableHead className="text-right pr-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {terminals.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="pl-4 font-mono text-xs">{t.serialNumber}</TableCell>
                          <TableCell className="capitalize text-xs">
                            {t.type === "phone_pos" ? "Phone POS" : t.type}
                          </TableCell>
                          <TableCell className="text-xs">{t.model}</TableCell>
                          <TableCell>{terminalStatusBadge(t.status)}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {t.activatedAt ? formatDateTime(t.activatedAt) : "Not activated"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {timeAgo(t.lastSeenAt)}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-emerald-700 dark:text-emerald-400"
                                disabled={t.status === "active" || t.status === "blocked" || t.status === "damaged"}
                                onClick={() => activateTerminal(t)}
                              >
                                <CheckCircle2 className="size-3.5 mr-1" /> Activate
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-red-700 dark:text-red-400"
                                disabled={t.status === "blocked" || t.status === "damaged"}
                                onClick={() => blockTerminal(t)}
                              >
                                <Ban className="size-3.5 mr-1" /> Block
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </ScrollTable>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Settlements tab */}
          <TabsContent value="settlements" className="p-6 pt-4 m-0 space-y-3 text-sm">
            {settlements.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No settlements"
                description="This merchant has no scheduled or processed settlements. Settlements are matched by merchant legal/trading name."
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="pl-4">Batch ID</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead className="hidden md:table-cell">Scheduled</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right pr-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {settlements.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="pl-4 font-mono text-xs">{s.batchId}</TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatCurrency(s.amount, s.currency)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{s.currency}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {formatDateTime(s.scheduledAt)}
                          </TableCell>
                          <TableCell>
                            <div>{settlementStatusBadge(s.status)}</div>
                            {s.failureReason && (
                              <div className="text-[10px] text-red-700 dark:text-red-400 mt-0.5">
                                {s.failureReason}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <div className="flex justify-end gap-1">
                              {s.status === "failed" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-amber-700 dark:text-amber-400"
                                  onClick={() => retrySettlement(s)}
                                >
                                  <RefreshCw className="size-3.5 mr-1" /> Retry
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8"
                                onClick={() => viewSettlementDetails(s)}
                              >
                                <Eye className="size-3.5 mr-1" /> Details
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </ScrollTable>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Disputes tab */}
          <TabsContent value="disputes" className="p-6 pt-4 m-0 space-y-3 text-sm">
            {disputes.length === 0 ? (
              <EmptyState
                icon={Scale}
                title="No disputes"
                description="This merchant has no disputes. Disputes are matched by merchant legal/trading name."
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="pl-4">Dispute ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="hidden lg:table-cell">Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right pr-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disputes.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="pl-4 font-mono text-xs">{d.id}</TableCell>
                          <TableCell className="text-xs">{d.customerName}</TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatCurrency(d.amount, d.currency)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs">
                            {d.reason}
                          </TableCell>
                          <TableCell>{disputeStatusBadge(d.status)}</TableCell>
                          <TableCell className="text-right pr-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel className="text-xs">Dispute actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => requestEvidence(d)}
                                  disabled={d.status !== "new"}
                                >
                                  <ShieldAlert className="size-4 mr-2" /> Request evidence
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateDisputeStatus(d, "under_review")}
                                  disabled={d.status === "under_review" || d.status === "won" || d.status === "lost"}
                                >
                                  <Clock className="size-4 mr-2 text-sky-600" /> Mark under review
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateDisputeStatus(d, "won")}
                                  disabled={d.status === "won" || d.status === "lost"}
                                >
                                  <CheckCircle2 className="size-4 mr-2 text-emerald-600" /> Mark won
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateDisputeStatus(d, "lost")}
                                  disabled={d.status === "won" || d.status === "lost"}
                                >
                                  <XCircle className="size-4 mr-2 text-red-600" /> Mark lost
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </ScrollTable>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* POS Requests tab — KEY FEATURE */}
          <TabsContent value="pos_requests" className="p-6 pt-4 m-0 space-y-3 text-sm">
            <div className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-900/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="size-3.5 inline mr-1 -mt-0.5" />
              <strong>Approval rule:</strong> A device MUST support at least one
              of NFC, card reader, or swipe. If none are available, the request
              is auto-declined. Device integrity and screen lock failures are
              surfaced as warnings but do not block approval.
            </div>
            {posRequests.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No POS device requests"
                description="This merchant has not requested any physical terminals or phone POS activations."
              />
            ) : (
              <div className="space-y-3">
                {posRequests.map((r) => (
                  <PosRequestCard
                    key={r.id}
                    request={r}
                    statusBadge={posRequestStatusBadge(r.status)}
                    onApprove={() => approvePosRequest(r)}
                    onAutoDecline={() => autoDeclinePosRequest(r)}
                    onDecline={() => setDeclineTarget(r)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ----------------------- POS device decline dialog ---------------------- */}
      <Dialog open={!!declineTarget} onOpenChange={(o) => !o && setDeclineTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline POS device request?</DialogTitle>
            <DialogDescription>
              {declineTarget && (
                <>
                  <span className="font-mono">{declineTarget.requestCode}</span> ·{" "}
                  {declineTarget.deviceInfo.deviceModel} ·{" "}
                  {declineTarget.type.replace(/_/g, " ")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Reason (optional)</Label>
            <Textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Merchant must update the Faya POS app to the latest version first."
              className="text-sm min-h-[80px]"
            />
            <p className="text-[11px] text-muted-foreground">
              If left blank, a default reason will be recorded in the audit log.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={submitDecline}
            >
              <XCircle className="size-4 mr-1" /> Decline request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* --------------------------- POS device request card --------------------- */

function PosRequestCard({
  request,
  statusBadge,
  onApprove,
  onAutoDecline,
  onDecline,
}: {
  request: PosDeviceRequest;
  statusBadge: React.ReactNode;
  onApprove: () => void;
  onAutoDecline: () => void;
  onDecline: () => void;
}) {
  const d = request.deviceInfo;
  const isPending = request.status === "pending";
  const showWarnings = isPending && (d.deviceIntegrityPassed === false || d.screenLockEnabled === false);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {request.requestCode}
              </span>
              <Badge variant="outline" className="text-[10px] capitalize">
                {request.type === "physical_terminal" ? "Physical Terminal" : "Phone POS"}
              </Badge>
              {statusBadge}
            </div>
            <div className="font-medium text-sm mt-1 flex items-center gap-1.5">
              <MonitorSmartphone className="size-4 text-emerald-600" />
              {d.deviceModel}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              OS {d.osVersion} · Faya POS v{d.appVersion} · battery {d.batteryLevel}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground">Requested</div>
            <div className="text-xs">{timeAgo(request.requestedAt)}</div>
          </div>
        </div>

        {/* Device capability checks */}
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
            <Cpu className="size-3 text-emerald-600" /> Device capability check
          </div>
          <div className="flex flex-wrap gap-1.5">
            <CapabilityBadge label="NFC" supported={d.nfcSupported} />
            <CapabilityBadge label="Card Reader" supported={d.cardReaderSupported} />
            <CapabilityBadge label="Swipe" supported={d.swipeSupported} />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] text-muted-foreground">Approval eligibility:</span>
            {request.canBeApproved ? (
              <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="size-3 mr-1" /> Can approve — payment method available
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-red-700 border-red-300 bg-red-50 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                <XCircle className="size-3 mr-1" /> Cannot approve — no payment method
              </Badge>
            )}
          </div>
        </div>

        {/* Security warnings */}
        {showWarnings && (
          <div className="space-y-1.5">
            {d.deviceIntegrityPassed === false && (
              <div className="rounded-md border border-amber-300 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                <span>
                  <strong>WARNING:</strong> Device integrity check failed —
                  device may be rooted or jailbroken. Approval is technically
                  possible (a payment method is supported), but a real reviewer
                  should consider this a hard block.
                </span>
              </div>
            )}
            {d.screenLockEnabled === false && (
              <div className="rounded-md border border-amber-300 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                <LockIcon className="size-3.5 mt-0.5 shrink-0" />
                <span>
                  <strong>WARNING:</strong> Screen lock is disabled on the
                  device. Encourage the merchant to enable PIN/biometric
                  screen lock before approval.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Decline reason for already-declined requests */}
        {request.declineReason && !isPending && (
          <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-900/10 p-2.5 text-xs text-red-800 dark:text-red-300">
            <strong>Decline reason:</strong> {request.declineReason}
          </div>
        )}

        {/* Notes */}
        {request.notes && (
          <div className="text-xs text-muted-foreground italic">
            “{request.notes}”
          </div>
        )}

        {/* Action buttons */}
        {isPending && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      size="sm"
                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={!request.canBeApproved}
                      onClick={onApprove}
                    >
                      <CheckCircle2 className="size-3.5 mr-1" /> Approve
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {request.canBeApproved
                    ? "Approve this POS device request"
                    : "Cannot approve — device doesn't support any payment method (NFC, card reader, or swipe)"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {!request.canBeApproved ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                onClick={onAutoDecline}
              >
                <XCircle className="size-3.5 mr-1" /> Auto-decline
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={onDecline}
            >
              <XCircle className="size-3.5 mr-1" /> Decline
            </Button>
          </div>
        )}

        {/* Reviewed-by info for closed requests */}
        {!isPending && request.reviewedBy && (
          <div className="text-[11px] text-muted-foreground pt-1 border-t">
            Reviewed by{" "}
            <span className="font-mono">{request.reviewedBy}</span>
            {request.reviewedAt && ` · ${formatDateTime(request.reviewedAt)}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CapabilityBadge({ label, supported }: { label: string; supported: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] gap-1",
        supported
          ? "text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
          : "text-red-700 border-red-300 bg-red-50 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
      )}
    >
      {supported ? (
        <CheckCircle2 className="size-3" />
      ) : (
        <XCircle className="size-3" />
      )}
      {label}
    </Badge>
  );
}

/* --------------------------- Small UI helpers --------------------------- */

function CountBadge({ n }: { n: number }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "ml-1.5 text-[9px] h-4 px-1.5 tabular-nums",
        n > 0
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      {n}
    </Badge>
  );
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
      <Icon className="size-3.5 text-emerald-600" />
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "success" | "info" | "warning" | "danger";
}) {
  const toneClass = {
    default: "text-slate-900 dark:text-slate-100",
    success: "text-emerald-700 dark:text-emerald-400",
    info: "text-sky-700 dark:text-sky-400",
    warning: "text-amber-700 dark:text-amber-400",
    danger: "text-red-700 dark:text-red-400",
  }[tone];
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("text-base font-semibold tabular-nums mt-1", toneClass)}>
        {value}
      </div>
    </div>
  );
}

function ScrollTable({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={
        "max-h-60 overflow-auto " +
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
