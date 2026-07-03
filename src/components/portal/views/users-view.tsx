"use client";

/**
 * Faya Admin Portal — Users (Consumers) View (CP1)
 *
 * Lists all consumers visible to the signed-in staff member (scoped by
 * `getVisibleConsumers`). Row click / "View profile" / "Full profile"
 * navigate to the full-page `UserDetailView` (route `user_detail`) — no
 * sliding sheet.
 *
 * Audit action keys (from list actions):
 *   consumer.restrict / consumer.suspend / consumer.reactivate
 */
import { useMemo, useState } from "react";
import {
  Users as UsersIcon,
  Search,
  Eye,
  MoreHorizontal,
  Ban,
  Pause,
  RotateCcw,
  Clock,
  UserCheck,
  UserX,
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
import { getVisibleConsumers, getScopeLabel } from "@/lib/access-scope";
import {
  formatCurrency,
  formatNumber,
  timeAgo,
  statusBadge,
} from "@/lib/formatters";
import type {
  Consumer,
  CountryConfig,
  ConsumerStatus,
  KycStatus,
} from "@/lib/types";
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
  pending_kyc: { label: "Pending KYC", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  restricted: { label: "Restricted", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  closed: { label: "Closed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

function consumerStatusBadge(s: ConsumerStatus) {
  const v = CONSUMER_STATUS_STYLES[s];
  return (
    <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
      {v.label}
    </Badge>
  );
}

function kycBadge(s: KycStatus) {
  const v = statusBadge("kyc", s);
  return (
    <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
      {v.label}
    </Badge>
  );
}

/* ------------------------------ Main view -------------------------------- */

export function UsersView({ consumers, countries }: UsersViewProps) {
  const { staff } = useAuth();
  const { selectUser, setView } = usePortalStore();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [kycFilter, setKycFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
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

  function openProfile(c: Consumer) {
    selectUser(c.id);
    setView("user_detail");
  }

  async function applyConsumerAction(
    consumer: Consumer,
    action: "restrict" | "suspend" | "reactivate",
  ) {
    if (!staff) return;
    const newStatus: ConsumerStatus =
      action === "restrict"
        ? "restricted"
        : action === "suspend"
          ? "suspended"
          : "active";
    const before = consumer.status;
    await adminData.updateConsumer(consumer.id, { status: newStatus, updatedAt: Date.now() });
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
        reason: `${action} consumer ${consumer.consumerCode}`,
      },
    );
    toast.success(
      `${consumer.firstName} ${consumer.lastName} ${action === "reactivate" ? "reactivated" : action + "ed"} successfully`,
    );
  }

  return (
    <ViewContainer>
      <SonnerToaster richColors position="top-right" />
      <ViewHeader
        title="Users — Consumers"
        description="Comprehensive consumer profiles. Click any row to open the full-page profile — cards, wallets, transactions, documents, KYC, tickets, disputes, risk and audit all live there."
        icon={UsersIcon}
        actions={
          <Badge variant="outline" className="text-[11px]">
            Scope: {getScopeLabel(staff)}
          </Badge>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Consumers" value={stats.total} icon={UsersIcon} />
        <StatCard label="Active" value={stats.active} tone="success" icon={UserCheck} />
        <StatCard label="Pending KYC" value={stats.pending} tone="warning" icon={Clock} />
        <StatCard label="Restricted / Suspended" value={stats.restricted} tone="danger" icon={UserX} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, phone, code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {filterableCountries.map((c) => (
                  <SelectItem key={c.countryCode} value={c.countryCode}>
                    {c.countryName} ({c.countryCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kycFilter} onValueChange={setKycFilter}>
              <SelectTrigger>
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending_kyc">Pending KYC</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="restricted">Restricted</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Consumers table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="No consumers found"
              description="Try adjusting the filters or search query."
            />
          ) : (
            <div className="max-h-[calc(100vh-22rem)] overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="text-[11px]">Code</TableHead>
                    <TableHead className="text-[11px]">Name</TableHead>
                    <TableHead className="text-[11px]">Email</TableHead>
                    <TableHead className="text-[11px]">Phone</TableHead>
                    <TableHead className="text-[11px]">Country</TableHead>
                    <TableHead className="text-[11px]">KYC</TableHead>
                    <TableHead className="text-[11px]">Status</TableHead>
                    <TableHead className="text-[11px] text-right">Balance</TableHead>
                    <TableHead className="text-[11px] text-center">Txns</TableHead>
                    <TableHead className="text-[11px]">Updated</TableHead>
                    <TableHead className="text-[11px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openProfile(c)}
                    >
                      <TableCell className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                        {c.consumerCode}
                      </TableCell>
                      <TableCell className="font-medium text-[12px]">
                        {c.firstName} {c.lastName}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{c.email}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{c.phone}</TableCell>
                      <TableCell className="text-[11px]">
                        <span className="inline-flex items-center gap-1">
                          <Globe2 className="size-3 text-muted-foreground" />
                          {c.countryCode}
                        </span>
                      </TableCell>
                      <TableCell>{kycBadge(c.kycStatus)}</TableCell>
                      <TableCell>{consumerStatusBadge(c.status)}</TableCell>
                      <TableCell className="text-right text-[11px] tabular-nums">
                        {formatCurrency(c.walletBalance, c.currency)}
                      </TableCell>
                      <TableCell className="text-center text-[11px] tabular-nums">
                        <Badge variant="secondary" className="text-[10px]">
                          {formatNumber(c.transactionCount)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {timeAgo(c.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openProfile(c)}>
                              <Eye className="size-4 mr-2" /> View profile
                            </DropdownMenuItem>
                            {c.status !== "restricted" && c.status !== "suspended" && (
                              <DropdownMenuItem onClick={() => setConfirmAction({ consumer: c, action: "restrict" })}>
                                <Pause className="size-4 mr-2" /> Restrict
                              </DropdownMenuItem>
                            )}
                            {c.status !== "suspended" && (
                              <DropdownMenuItem onClick={() => setConfirmAction({ consumer: c, action: "suspend" })}>
                                <Ban className="size-4 mr-2" /> Suspend
                              </DropdownMenuItem>
                            )}
                            {(c.status === "restricted" || c.status === "suspended") && (
                              <DropdownMenuItem onClick={() => setConfirmAction({ consumer: c, action: "reactivate" })}>
                                <RotateCcw className="size-4 mr-2" /> Reactivate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openProfile(c)}>
                              <Eye className="size-4 mr-2" /> Open full profile
                            </DropdownMenuItem>
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

      {/* Confirm action dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === "restrict" && "Restrict consumer"}
              {confirmAction?.action === "suspend" && "Suspend consumer"}
              {confirmAction?.action === "reactivate" && "Reactivate consumer"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction && (
                <>
                  You are about to <span className="font-medium">{confirmAction.action}</span>{" "}
                  <span className="font-medium">
                    {confirmAction.consumer.firstName} {confirmAction.consumer.lastName}
                  </span>{" "}
                  ({confirmAction.consumer.consumerCode}). This action will be recorded in the audit log.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                confirmAction?.action === "suspend"
                  ? "bg-red-600 hover:bg-red-700"
                  : confirmAction?.action === "restrict"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-emerald-600 hover:bg-emerald-700",
              )}
              onClick={() => {
                if (confirmAction) applyConsumerAction(confirmAction.consumer, confirmAction.action);
                setConfirmAction(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ViewContainer>
  );
}
