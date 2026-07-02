"use client";

/**
 * Faya Admin Portal — Users (Consumers) View
 *
 * Tabbed consumer profiles — Cards / Wallets / Transactions / Documents are
 * rendered as TABS inside the consumer detail Sheet (not as separate nav
 * items). Per the architecture spec, the admin manages consumer data here;
 * the separate Faya Pay consumer app reads from the same Firestore
 * collections via the same `adminData` patch helpers.
 *
 * Country scoping: Super Admin sees all consumers; other staff see only
 * the country codes listed on their `staff.countries` access record
 * (resolved via `getVisibleConsumers`).
 *
 * Every mutation is mirrored to the audit log via `logAudit(...)` with the
 * action keys: consumer.restrict / consumer.suspend / consumer.reactivate /
 * card.freeze / card.unfreeze / wallet.freeze / wallet.unfreeze /
 * document.approve / document.reject / dispute.open.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Users as UsersIcon,
  Search,
  Filter,
  Eye,
  MoreHorizontal,
  Ban,
  Pause,
  RotateCcw,
  CreditCard,
  Wallet,
  Receipt,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Snowflake,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Info,
  UserCheck,
  UserX,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
import { getVisibleConsumers, getScopeLabel } from "@/lib/access-scope";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  timeAgo,
  statusBadge,
} from "@/lib/formatters";
import type {
  Consumer,
  CountryConfig,
  Card as CardRecord,
  Wallet as WalletRecord,
  Transaction,
  UserDocument,
  ConsumerStatus,
  KycTier,
  PlatformKey,
  CardStatus,
  WalletStatus,
  TransactionStatus,
  DocumentType,
} from "@/lib/types";
import { PLATFORM_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

interface UsersViewProps {
  consumers: Consumer[];
  countries: CountryConfig[];
}

/* ----------------------------- Status styling ---------------------------- */

const CONSUMER_STATUS_STYLES: Record<
  ConsumerStatus,
  { label: string; className: string }
> = {
  pending_kyc: {
    label: "Pending KYC",
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

const KYC_TIER_STYLES: Record<KycTier, { label: string; className: string }> = {
  tier_1: {
    label: "Tier 1",
    className: "text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  },
  tier_2: {
    label: "Tier 2",
    className: "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
  tier_3: {
    label: "Tier 3",
    className: "text-orange-700 border-orange-300 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  },
};

const CARD_STATUS_STYLES: Record<CardStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  frozen: { label: "Frozen", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  blocked: { label: "Blocked", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  expired: { label: "Expired", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  terminated: { label: "Terminated", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  replaced: { label: "Replaced", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
};

const WALLET_STATUS_STYLES: Record<WalletStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  frozen: { label: "Frozen", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  closed: { label: "Closed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const TX_STATUS_STYLES: Record<TransactionStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  authorized: { label: "Authorized", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  successful: { label: "Successful", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  reversed: { label: "Reversed", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  refunded: { label: "Refunded", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  held: { label: "Held", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
};

const DOC_STATUS_STYLES: Record<
  UserDocument["status"],
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  expired: { label: "Expired", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  replacement_requested: { label: "Replacement Requested", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
};

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  user_id: "User ID",
  selfie_liveness: "Selfie / Liveness",
  proof_of_address: "Proof of Address",
  bvn_nin_verification: "BVN / NIN Verification",
  business_registration: "Business Registration",
  tax_certificate: "Tax Certificate",
  merchant_licence: "Merchant Licence",
  beneficial_owner: "Beneficial Owner",
  settlement_bank_proof: "Settlement Bank Proof",
  dispute_evidence: "Dispute Evidence",
};

const RISK_TONE = (score: number) =>
  score >= 80
    ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
    : score >= 50
      ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";

/* ------------------------------ Main view -------------------------------- */

export function UsersView({ consumers, countries }: UsersViewProps) {
  const { staff } = useAuth();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [kycFilter, setKycFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    consumer: Consumer;
    action: "restrict" | "suspend" | "reactivate";
  } | null>(null);

  const visibleConsumers = useMemo(
    () => getVisibleConsumers(staff, countries, consumers),
    [staff, countries, consumers],
  );

  const filterableCountries = useMemo(() => {
    const codes = new Set(visibleConsumers.map((c) => c.countryCode));
    return countries.filter((c) => codes.has(c.countryCode));
  }, [countries, visibleConsumers]);

  const filtered = useMemo(() => {
    let list = visibleConsumers;
    if (countryFilter !== "all")
      list = list.filter((c) => c.countryCode === countryFilter);
    if (kycFilter !== "all") list = list.filter((c) => c.kycStatus === kycFilter);
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.consumerCode.toLowerCase().includes(q),
      );
    }
    return list;
  }, [visibleConsumers, countryFilter, kycFilter, statusFilter, search]);

  const stats = useMemo(() => {
    const total = visibleConsumers.length;
    const active = visibleConsumers.filter((c) => c.status === "active").length;
    const pending = visibleConsumers.filter(
      (c) => c.status === "pending_kyc" || c.kycStatus === "pending" || c.kycStatus === "in_review",
    ).length;
    const restricted = visibleConsumers.filter(
      (c) => c.status === "restricted" || c.status === "suspended",
    ).length;
    return { total, active, pending, restricted };
  }, [visibleConsumers]);

  function countryName(code: string): string {
    return countries.find((c) => c.countryCode === code)?.countryName ?? code;
  }

  function consumerStatusBadge(s: ConsumerStatus) {
    const v = CONSUMER_STATUS_STYLES[s];
    return (
      <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
        {v.label}
      </Badge>
    );
  }

  function kycBadge(s: string) {
    const v = statusBadge("kyc", s);
    return (
      <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
        {v.label}
      </Badge>
    );
  }

  function tierBadge(t: KycTier) {
    const v = KYC_TIER_STYLES[t];
    return (
      <Badge variant="outline" className={cn("text-[10px] font-medium", v.className)}>
        {v.label}
      </Badge>
    );
  }

  function riskBadge(score: number) {
    return (
      <Badge variant="secondary" className={cn("text-[10px] tabular-nums", RISK_TONE(score))}>
        Risk {score}
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

  function applyConsumerStatus(consumer: Consumer, action: "restrict" | "suspend" | "reactivate") {
    if (!staff) return;
    const newStatus: ConsumerStatus =
      action === "restrict" ? "restricted" : action === "suspend" ? "suspended" : "active";
    const before = consumer.status;
    adminData.updateConsumer(consumer.id, {
      status: newStatus,
      updatedAt: Date.now(),
    });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      `consumer.${action}`,
      "consumer",
      consumer.id,
      {
        countryCode: consumer.countryCode,
        beforeValue: before,
        afterValue: newStatus,
      },
    );
    toast.success(`Consumer ${action}ed: ${consumer.firstName} ${consumer.lastName}`, {
      description: `${consumer.consumerCode} · ${before} → ${newStatus}`,
    });
    setConfirmAction(null);
    setSelectedConsumer(null);
  }

  function confirmTitle(action: string): string {
    if (action === "restrict") return "Restrict consumer account?";
    if (action === "suspend") return "Suspend consumer account?";
    return "Reactivate consumer account?";
  }

  function confirmDescription(action: string, consumer: Consumer): string {
    const newStatus = action === "restrict" ? "restricted" : action === "suspend" ? "suspended" : "active";
    return `You are about to set ${consumer.firstName} ${consumer.lastName} (${consumer.consumerCode}) to status "${newStatus}". The consumer app reads from the same database — they will see the change on their next login. This action is recorded in the audit log and cannot be undone.`;
  }

  return (
    <>
      <ViewHeader
        title="Users (Consumers)"
        description="Manage Faya Pay consumer accounts — KYC, cards, wallets, transactions, documents."
        icon={UsersIcon}
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
            label="Total Consumers"
            value={formatNumber(stats.total)}
            hint="Visible in scope"
            icon={UsersIcon}
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
            label="Pending KYC"
            value={formatNumber(stats.pending)}
            hint="Awaiting verification"
            icon={Clock}
            tone="warning"
          />
          <StatCard
            label="Restricted / Suspended"
            value={formatNumber(stats.restricted)}
            hint="Actioned accounts"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, email, phone, code…"
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
                <Label className="text-xs">KYC status</Label>
                <Select value={kycFilter} onValueChange={setKycFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All KYC" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All KYC</SelectItem>
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
                    <SelectItem value="pending_kyc">Pending KYC</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
                {visibleConsumers.length} visible consumers
              </span>
              {(search || countryFilter !== "all" || kycFilter !== "all" || statusFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setSearch("");
                    setCountryFilter("all");
                    setKycFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Consumers table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <UsersIcon className="size-4 text-emerald-600" /> Consumers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                title="No consumers found"
                description="Adjust the filters above or wait for new consumer signups to appear."
              />
            ) : (
              <ScrollTable>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                  <TableRow>
                    <TableHead className="pl-4">Consumer Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Phone</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>KYC</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Wallet</TableHead>
                    <TableHead className="hidden xl:table-cell">Last Login</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedConsumer(c)}>
                      <TableCell className="pl-4 font-mono text-xs">{c.consumerCode}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {c.firstName} {c.lastName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {tierBadge(c.kycTier)} {riskBadge(c.riskScore)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{c.email}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">{c.phone}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{c.countryCode}</span>
                        <div className="text-[10px] text-muted-foreground">
                          {countryName(c.countryCode)}
                        </div>
                      </TableCell>
                      <TableCell>{kycBadge(c.kycStatus)}</TableCell>
                      <TableCell>{consumerStatusBadge(c.status)}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {formatCurrency(c.walletBalance, c.currency)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                        {timeAgo(c.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setSelectedConsumer(c)}>
                              <Eye className="size-4 mr-2" /> View profile
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {c.status !== "restricted" && c.status !== "suspended" && c.status !== "closed" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmAction({ consumer: c, action: "restrict" })
                                }
                              >
                                <Ban className="size-4 mr-2 text-orange-600" /> Restrict
                              </DropdownMenuItem>
                            )}
                            {c.status !== "suspended" && c.status !== "closed" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmAction({ consumer: c, action: "suspend" })
                                }
                              >
                                <Pause className="size-4 mr-2 text-red-600" /> Suspend
                              </DropdownMenuItem>
                            )}
                            {(c.status === "restricted" || c.status === "suspended") && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmAction({ consumer: c, action: "reactivate" })
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

      {/* --------------------- Consumer detail sheet (tabbed) -------------------- */}
      <Sheet open={!!selectedConsumer} onOpenChange={(o) => !o && setSelectedConsumer(null)}>
        <SheetContent side="right" className="w-full sm:max-w-3xl flex flex-col p-0">
          {selectedConsumer && (
            <ConsumerDetailSheet
              consumer={selectedConsumer}
              countryName={countryName}
              consumerStatusBadge={consumerStatusBadge}
              kycBadge={kycBadge}
              tierBadge={tierBadge}
              riskBadge={riskBadge}
              platformChips={platformChips}
              onClose={() => setSelectedConsumer(null)}
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
              {confirmAction && confirmDescription(confirmAction.action, confirmAction.consumer)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                confirmAction?.action === "reactivate"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : confirmAction?.action === "suspend"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-orange-600 hover:bg-orange-700 text-white",
              )}
              onClick={() =>
                confirmAction && applyConsumerStatus(confirmAction.consumer, confirmAction.action)
              }
            >
              {confirmAction?.action === "restrict" && <Ban className="size-4 mr-1" />}
              {confirmAction?.action === "suspend" && <Pause className="size-4 mr-1" />}
              {confirmAction?.action === "reactivate" && <RotateCcw className="size-4 mr-1" />}
              {confirmAction?.action === "restrict"
                ? "Restrict"
                : confirmAction?.action === "suspend"
                  ? "Suspend"
                  : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}

/* --------------------------- Consumer detail sheet ----------------------- */

function ConsumerDetailSheet({
  consumer,
  countryName,
  consumerStatusBadge,
  kycBadge,
  tierBadge,
  riskBadge,
  platformChips,
  onClose,
}: {
  consumer: Consumer;
  countryName: (code: string) => string;
  consumerStatusBadge: (s: ConsumerStatus) => React.ReactNode;
  kycBadge: (s: string) => React.ReactNode;
  tierBadge: (t: KycTier) => React.ReactNode;
  riskBadge: (score: number) => React.ReactNode;
  platformChips: (p: PlatformKey[]) => React.ReactNode;
  onClose: () => void;
}) {
  const { staff } = useAuth();
  const [tab, setTab] = useState("profile");

  // Live subscriptions — only when the sheet is open (component mounts/unmounts
  // with the Sheet content).
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [documents, setDocuments] = useState<UserDocument[]>([]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    try {
      unsubs.push(
        adminData.subscribeCards((items) =>
          setCards(items.filter((c) => c.userId === consumer.id)),
        ),
      );
      unsubs.push(
        adminData.subscribeWallets((items) =>
          setWallets(items.filter((w) => w.userId === consumer.id)),
        ),
      );
      unsubs.push(
        adminData.subscribeTransactions((items) =>
          setTransactions(items.filter((t) => t.userId === consumer.id)),
        ),
      );
      unsubs.push(
        adminData.subscribeDocuments((items) =>
          setDocuments(items.filter((d) => d.entityId === consumer.id)),
        ),
      );
    } catch (e) {
      console.error("[ConsumerDetailSheet] subscription error:", e);
    }
    return () => unsubs.forEach((u) => u());
  }, [consumer.id]);

  function toggleCardFreeze(card: CardRecord) {
    if (!staff) return;
    const newFrozen = !card.frozen;
    adminData.updateCard(card.id, {
      frozen: newFrozen,
      status: newFrozen ? "frozen" : "active",
      updatedAt: Date.now(),
    });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      newFrozen ? "card.freeze" : "card.unfreeze",
      "card",
      card.id,
      {
        countryCode: card.countryCode,
        beforeValue: `frozen=${card.frozen} status=${card.status}`,
        afterValue: `frozen=${newFrozen} status=${newFrozen ? "frozen" : "active"}`,
      },
    );
    toast.success(`${newFrozen ? "Frozen" : "Unfrozen"} card ${card.cardId}`, {
      description: `•••• ${card.last4} · ${card.scheme.toUpperCase()}`,
    });
  }

  function toggleWalletFreeze(wallet: WalletRecord) {
    if (!staff) return;
    const newStatus: WalletStatus = wallet.status === "active" ? "frozen" : "active";
    adminData.updateWallet(wallet.id, {
      status: newStatus,
      updatedAt: Date.now(),
    });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      newStatus === "frozen" ? "wallet.freeze" : "wallet.unfreeze",
      "wallet",
      wallet.id,
      {
        countryCode: wallet.countryCode,
        beforeValue: wallet.status,
        afterValue: newStatus,
      },
    );
    toast.success(`${newStatus === "frozen" ? "Frozen" : "Unfrozen"} wallet ${wallet.walletId}`, {
      description: `${wallet.currency} · balance ${formatCurrency(wallet.balance, wallet.currency)}`,
    });
  }

  function approveDocument(doc: UserDocument) {
    if (!staff) return;
    adminData.updateDocument(doc.id, {
      status: "approved",
      reviewedBy: staff.id,
      reviewedAt: Date.now(),
    });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "document.approve",
      "document",
      doc.id,
      {
        countryCode: doc.countryCode,
        beforeValue: doc.status,
        afterValue: "approved",
      },
    );
    toast.success(`Document approved: ${doc.fileName}`, {
      description: `${DOC_TYPE_LABELS[doc.documentType]} · ${doc.entityName}`,
    });
  }

  function rejectDocument(doc: UserDocument) {
    if (!staff) return;
    adminData.updateDocument(doc.id, {
      status: "rejected",
      reviewedBy: staff.id,
      reviewedAt: Date.now(),
    });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "document.reject",
      "document",
      doc.id,
      {
        countryCode: doc.countryCode,
        beforeValue: doc.status,
        afterValue: "rejected",
      },
    );
    toast.error(`Document rejected: ${doc.fileName}`, {
      description: `${DOC_TYPE_LABELS[doc.documentType]} · ${doc.entityName}`,
    });
  }

  function viewReceipt(tx: Transaction) {
    toast.info(`Receipt: ${tx.reference}`, {
      description: `${formatCurrency(tx.amount, tx.currency)} · ${tx.type.replace(/_/g, " ")} · ${formatDateTime(tx.createdAt)}`,
    });
  }

  function openDispute(tx: Transaction) {
    if (!staff) return;
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "dispute.open",
      "transaction",
      tx.id,
      {
        countryCode: tx.countryCode,
        beforeValue: tx.disputeStatus ?? "none",
        afterValue: "open",
        reason: `Opened from consumer profile ${consumer.consumerCode}`,
      },
    );
    toast.success(`Dispute opened for ${tx.reference}`, {
      description: `Amount: ${formatCurrency(tx.amount, tx.currency)} · routed to Disputes view`,
    });
  }

  function cardStatusBadge(s: CardStatus) {
    const v = CARD_STATUS_STYLES[s];
    return (
      <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
        {v.label}
      </Badge>
    );
  }

  function walletStatusBadge(s: WalletStatus) {
    const v = WALLET_STATUS_STYLES[s];
    return (
      <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
        {v.label}
      </Badge>
    );
  }

  function txStatusBadge(s: TransactionStatus) {
    const v = TX_STATUS_STYLES[s];
    return (
      <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
        {v.label}
      </Badge>
    );
  }

  function docStatusBadge(s: UserDocument["status"]) {
    const v = DOC_STATUS_STYLES[s];
    return (
      <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
        {v.label}
      </Badge>
    );
  }

  function txRiskBadge(score: number) {
    return (
      <Badge variant="secondary" className={cn("text-[10px] tabular-nums", RISK_TONE(score))}>
        {score}
      </Badge>
    );
  }

  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-3 border-b">
        <SheetDescription className="text-[11px] font-mono">{consumer.consumerCode}</SheetDescription>
        <SheetTitle className="text-lg flex items-center gap-2">
          <UsersIcon className="size-5 text-emerald-600" />
          {consumer.firstName} {consumer.lastName}
        </SheetTitle>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {consumerStatusBadge(consumer.status)}
          {kycBadge(consumer.kycStatus)}
          {tierBadge(consumer.kycTier)}
          {riskBadge(consumer.riskScore)}
          <Badge variant="outline" className="text-[10px] font-mono">
            {consumer.countryCode} · {countryName(consumer.countryCode)}
          </Badge>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="px-6 pt-3 border-b bg-muted/30">
            <TabsList className="bg-transparent h-auto p-0 flex flex-wrap gap-1">
              <TabsTrigger value="profile" className="text-xs">
                <UsersIcon className="size-3.5 mr-1" /> Profile
              </TabsTrigger>
              <TabsTrigger value="cards" className="text-xs">
                <CreditCard className="size-3.5 mr-1" /> Cards
                <CountBadge n={cards.length} />
              </TabsTrigger>
              <TabsTrigger value="wallets" className="text-xs">
                <Wallet className="size-3.5 mr-1" /> Wallets
                <CountBadge n={wallets.length} />
              </TabsTrigger>
              <TabsTrigger value="transactions" className="text-xs">
                <Receipt className="size-3.5 mr-1" /> Transactions
                <CountBadge n={transactions.length} />
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-xs">
                <FileText className="size-3.5 mr-1" /> Documents
                <CountBadge n={documents.length} />
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Profile tab */}
          <TabsContent value="profile" className="p-6 pt-4 m-0 space-y-4 text-sm">
            <div>
              <SectionLabel icon={UsersIcon}>Personal details</SectionLabel>
              <div className="rounded-md border divide-y">
                <DetailRow label="Full name" value={`${consumer.firstName} ${consumer.lastName}`} />
                <DetailRow label="Email" value={consumer.email} />
                <DetailRow label="Phone" value={consumer.phone} />
                <DetailRow label="Date of birth" value={consumer.dateOfBirth} />
                <DetailRow label="Nationality" value={consumer.nationality} />
                <DetailRow label="Consumer code" value={<span className="font-mono text-xs">{consumer.consumerCode}</span>} />
              </div>
            </div>

            <div>
              <SectionLabel icon={ShieldCheck}>KYC</SectionLabel>
              <div className="rounded-md border divide-y">
                <DetailRow label="KYC status" value={kycBadge(consumer.kycStatus)} />
                <DetailRow label="KYC tier" value={tierBadge(consumer.kycTier)} />
                <DetailRow label="KYC case" value={consumer.kycCaseId ? <span className="font-mono text-xs">{consumer.kycCaseId}</span> : "—"} />
                <DetailRow label="Risk score" value={riskBadge(consumer.riskScore)} />
                <DetailRow label="Account status" value={consumerStatusBadge(consumer.status)} />
              </div>
            </div>

            <div>
              <SectionLabel icon={UsersIcon}>Contact &amp; country</SectionLabel>
              <div className="rounded-md border divide-y">
                <DetailRow label="Country" value={`${countryName(consumer.countryCode)} (${consumer.countryCode})`} />
                <DetailRow label="Currency" value={<span className="font-mono text-xs">{consumer.currency}</span>} />
                <DetailRow label="Member since" value={formatDateTime(consumer.createdAt)} />
                <DetailRow label="Last updated" value={timeAgo(consumer.updatedAt)} />
              </div>
            </div>

            <div>
              <SectionLabel icon={Info}>Platforms</SectionLabel>
              <div className="rounded-md border p-3">
                {platformChips(consumer.platforms)}
              </div>
            </div>

            <div>
              <SectionLabel icon={Wallet}>Wallet summary</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  label="Wallet balance"
                  value={formatCurrency(consumer.walletBalance, consumer.currency)}
                  tone="default"
                />
                <MiniStat
                  label="Monthly volume"
                  value={formatCurrency(consumer.monthlyVolume, consumer.currency)}
                  tone="info"
                />
              </div>
            </div>

            <div>
              <SectionLabel icon={Receipt}>Transaction stats</SectionLabel>
              <div className="grid grid-cols-3 gap-3">
                <MiniStat
                  label="Lifetime volume"
                  value={formatCurrency(consumer.lifetimeVolume, consumer.currency)}
                  tone="success"
                />
                <MiniStat
                  label="Transactions"
                  value={formatNumber(consumer.transactionCount)}
                  tone="default"
                />
                <MiniStat
                  label="Monthly volume"
                  value={formatCurrency(consumer.monthlyVolume, consumer.currency)}
                  tone="info"
                />
              </div>
            </div>

            {consumer.notes && (
              <div>
                <SectionLabel icon={FileText}>Notes</SectionLabel>
                <p className="text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-md p-3 text-amber-900 dark:text-amber-200">
                  {consumer.notes}
                </p>
              </div>
            )}

            <div className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-900/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
              <Info className="size-3.5 inline mr-1 -mt-0.5" />
              The Faya Pay consumer app reads this record from the same Firestore
              collection — status changes appear on the consumer&apos;s next login.
            </div>

            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={onClose} className="w-full">
                Close profile
              </Button>
            </div>
          </TabsContent>

          {/* Cards tab */}
          <TabsContent value="cards" className="p-6 pt-4 m-0 space-y-3 text-sm">
            <SecurityNote />
            {cards.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No cards"
                description="This consumer has not been issued any cards (virtual or physical)."
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="pl-4">Card ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Scheme</TableHead>
                        <TableHead>Last 4</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Frozen</TableHead>
                        <TableHead className="text-right pr-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cards.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="pl-4 font-mono text-xs">{c.cardId}</TableCell>
                          <TableCell className="text-xs capitalize">{c.type}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {c.scheme}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">•••• {c.last4}</TableCell>
                          <TableCell>{cardStatusBadge(c.status)}</TableCell>
                          <TableCell className="font-mono text-xs">{c.currency}</TableCell>
                          <TableCell>
                            {c.frozen ? (
                              <Badge variant="secondary" className="text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                                Frozen
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                Active
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8"
                                    disabled={c.status === "blocked" || c.status === "terminated" || c.status === "expired"}
                                    onClick={() => toggleCardFreeze(c)}
                                  >
                                    {c.frozen ? (
                                      <>
                                        <PlayCircle className="size-3.5 mr-1 text-emerald-600" /> Unfreeze
                                      </>
                                    ) : (
                                      <>
                                        <Snowflake className="size-3.5 mr-1 text-sky-600" /> Freeze
                                      </>
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {c.frozen ? "Unfreeze card" : "Freeze card"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </ScrollTable>
                </CardContent>
              </Card>
            )}
            <p className="text-[11px] text-muted-foreground">
              Tokenized: {cards.filter((c) => c.tokenized).length}/{cards.length} · Wallet
              provisioned: {cards.filter((c) => c.walletProvisioned).length}/{cards.length}
            </p>
          </TabsContent>

          {/* Wallets tab */}
          <TabsContent value="wallets" className="p-6 pt-4 m-0 space-y-3 text-sm">
            <div className="rounded-md border border-amber-200 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-900/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="size-3.5 inline mr-1 -mt-0.5" />
              Manual balance adjustment requires dual approval (handled via the
              Approvals view). Here you can only freeze / unfreeze wallets.
            </div>
            {wallets.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No wallets"
                description="This consumer has no wallets provisioned."
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="pl-4">Wallet ID</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="text-right">Held</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right pr-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wallets.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="pl-4 font-mono text-xs">{w.walletId}</TableCell>
                          <TableCell className="font-mono text-xs">{w.currency}</TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatCurrency(w.balance, w.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatCurrency(w.availableBalance, w.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatCurrency(w.heldBalance, w.currency)}
                          </TableCell>
                          <TableCell>{walletStatusBadge(w.status)}</TableCell>
                          <TableCell className="text-right pr-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              disabled={w.status === "closed"}
                              onClick={() => toggleWalletFreeze(w)}
                            >
                              {w.status === "frozen" ? (
                                <>
                                  <PlayCircle className="size-3.5 mr-1 text-emerald-600" /> Unfreeze
                                </>
                              ) : (
                                <>
                                  <Snowflake className="size-3.5 mr-1 text-sky-600" /> Freeze
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </ScrollTable>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Transactions tab */}
          <TabsContent value="transactions" className="p-6 pt-4 m-0 space-y-3 text-sm">
            {transactions.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No transactions"
                description="This consumer has not made any transactions yet."
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="pl-4">Reference</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Method</TableHead>
                        <TableHead className="hidden md:table-cell">Card</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead className="hidden xl:table-cell">Created</TableHead>
                        <TableHead className="text-right pr-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="pl-4 font-mono text-xs">{tx.reference}</TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatCurrency(tx.amount, tx.currency)}
                          </TableCell>
                          <TableCell className="text-xs capitalize">
                            {tx.type.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell>{txStatusBadge(tx.status)}</TableCell>
                          <TableCell className="hidden lg:table-cell text-xs capitalize">
                            {tx.paymentMethod.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="hidden md:table-cell font-mono text-xs">
                            {tx.cardLast4 ? `•••• ${tx.cardLast4}` : "—"}
                          </TableCell>
                          <TableCell>{txRiskBadge(tx.riskScore)}</TableCell>
                          <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                            {timeAgo(tx.createdAt)}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => viewReceipt(tx)}>
                                  <Receipt className="size-4 mr-2" /> View receipt
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openDispute(tx)}
                                  disabled={tx.disputeStatus === "open" || tx.status === "failed"}
                                >
                                  <ShieldAlert className="size-4 mr-2" /> Open dispute
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

          {/* Documents tab */}
          <TabsContent value="documents" className="p-6 pt-4 m-0 space-y-3 text-sm">
            {documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No documents"
                description="This consumer has not uploaded any KYC documents."
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="pl-4">Type</TableHead>
                        <TableHead>File Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">Uploaded</TableHead>
                        <TableHead className="hidden lg:table-cell">Reviewer</TableHead>
                        <TableHead className="text-right pr-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="pl-4 text-xs">
                            {DOC_TYPE_LABELS[doc.documentType]}
                          </TableCell>
                          <TableCell className="text-xs">{doc.fileName}</TableCell>
                          <TableCell>{docStatusBadge(doc.status)}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {timeAgo(doc.uploadedAt)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell font-mono text-xs">
                            {doc.reviewedBy ?? "—"}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-emerald-700 dark:text-emerald-400"
                                disabled={doc.status === "approved"}
                                onClick={() => approveDocument(doc)}
                              >
                                <CheckCircle2 className="size-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-red-700 dark:text-red-400"
                                disabled={doc.status === "rejected"}
                                onClick={() => rejectDocument(doc)}
                              >
                                <XCircle className="size-3.5 mr-1" /> Reject
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
        </Tabs>
      </div>
    </>
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

function SecurityNote() {
  return (
    <div className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-900/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
      <Lock className="size-3.5 inline mr-1 -mt-0.5" />
      Admin never sees full PAN, CVV, or PIN. Only the last 4 digits and card
      metadata are accessible from this portal.
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
