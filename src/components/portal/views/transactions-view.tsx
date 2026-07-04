"use client";

/**
 * Faya Admin Portal — Transactions View (§10 Transaction Monitoring)
 *
 * Lists every transaction across every Faya product (card payments, NFC,
 * wallet debits/credits, refunds, chargebacks, settlements, fees, top-ups).
 * Admins can:
 *   - Search by reference, user name, or merchant name
 *   - Filter by country, type, status, payment method, date range
 *   - Open a details Sheet showing full transaction metadata, customer &
 *     merchant info, card metadata, device info, provider references,
 *     risk score, settlement + dispute status
 *   - Row actions: View receipt (toast), Open dispute (toast + audit),
 *     Add note (toast), Escalate to risk (toast + audit), Hold settlement
 *     (mutation + audit — only when settlementStatus="pending")
 *
 * Country scoping: Super Admin → all; region/country-scoped staff → only
 * `getVisibleCountryCodes(staff, countries)`. The view self-subscribes to
 * `transactions`, `cards` (for scheme lookup via last4), and `countries`
 * via `adminData.subscribeX` because the stub takes no props.
 *
 * All mutations are mirrored to the audit log via `logAudit(...)` with the
 * action keys: transaction.view_details / transaction.open_dispute /
 * transaction.escalate_risk / transaction.hold_settlement /
 * transaction.add_note (toast-only) / transaction.view_receipt (toast-only).
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Receipt,
  Search,
  Filter,
  Eye,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Gavel,
  StickyNote,
  PauseCircle,
  FileText,
  Smartphone,
  CreditCard,
  Wallet,
  ArrowRightLeft,
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
import {
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
import {
  getVisibleCountryCodes,
  getScopeLabel,
} from "@/lib/access-scope";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatCompact,
  timeAgo,
} from "@/lib/formatters";
import type {
  Transaction as TransactionType,
  TransactionType as TxType,
  TransactionStatus,
  Card as CardType,
  CardScheme,
  CountryConfig,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------- Badges --------------------------------- */

const TX_STATUS_STYLES: Record<TransactionStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  authorized: { label: "Authorized", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  successful: { label: "Successful", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  reversed: { label: "Reversed", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  refunded: { label: "Refunded", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  held: { label: "Held", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
};

const TX_TYPE_STYLES: Record<TxType, { label: string; className: string }> = {
  card_payment: { label: "Card Payment", className: "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800" },
  nfc_payment: { label: "NFC Payment", className: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  wallet_debit: { label: "Wallet Debit", className: "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800" },
  wallet_credit: { label: "Wallet Credit", className: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  refund: { label: "Refund", className: "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800" },
  reversal: { label: "Reversal", className: "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800" },
  merchant_payment: { label: "Merchant Payment", className: "bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
  settlement: { label: "Settlement", className: "bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
  fee: { label: "Fee", className: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  chargeback: { label: "Chargeback", className: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
  adjustment: { label: "Adjustment", className: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  topup: { label: "Top-up", className: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
};

const SETTLEMENT_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  settled: { label: "Settled", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  held: { label: "Held", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const DISPUTE_STYLES: Record<string, { label: string; className: string }> = {
  none: { label: "None", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  open: { label: "Open", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  won: { label: "Won", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  lost: { label: "Lost", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const TYPE_FILTER_VALUES: { value: TxType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "card_payment", label: "Card Payment" },
  { value: "nfc_payment", label: "NFC Payment" },
  { value: "wallet_debit", label: "Wallet Debit" },
  { value: "wallet_credit", label: "Wallet Credit" },
  { value: "refund", label: "Refund" },
  { value: "reversal", label: "Reversal" },
  { value: "merchant_payment", label: "Merchant Payment" },
  { value: "settlement", label: "Settlement" },
  { value: "fee", label: "Fee" },
  { value: "chargeback", label: "Chargeback" },
  { value: "adjustment", label: "Adjustment" },
  { value: "topup", label: "Top-up" },
];

const STATUS_FILTER_VALUES: { value: TransactionStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "authorized", label: "Authorized" },
  { value: "successful", label: "Successful" },
  { value: "failed", label: "Failed" },
  { value: "reversed", label: "Reversed" },
  { value: "refunded", label: "Refunded" },
  { value: "held", label: "Held" },
];

const DATE_RANGE_VALUES = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
] as const;

type DateRangeValue = (typeof DATE_RANGE_VALUES)[number]["value"];

/* ------------------------------- Helpers ------------------------------- */

function riskTone(score: number): { label: string; className: string } {
  if (score >= 75) return { label: "Critical", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" };
  if (score >= 50) return { label: "High", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" };
  if (score >= 25) return { label: "Medium", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" };
  return { label: "Low", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" };
}

const PAYMENT_METHOD_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  card: CreditCard,
  nfc: Smartphone,
  wallet: Wallet,
  bank: ArrowRightLeft,
  default: Receipt,
};

function resolvePaymentMethodIcon(method: string): React.ComponentType<{ className?: string }> {
  const m = method.toLowerCase();
  if (m.includes("card")) return PAYMENT_METHOD_ICON_MAP.card;
  if (m.includes("nfc")) return PAYMENT_METHOD_ICON_MAP.nfc;
  if (m.includes("wallet")) return PAYMENT_METHOD_ICON_MAP.wallet;
  if (m.includes("bank")) return PAYMENT_METHOD_ICON_MAP.bank;
  return PAYMENT_METHOD_ICON_MAP.default;
}

function PaymentMethodIcon({ method, className }: { method: string; className?: string }) {
  const Icon = resolvePaymentMethodIcon(method);
  return React.createElement(Icon, { className });
}

/* ------------------------------- View ----------------------------------- */

export function TransactionsView() {
  const { staff: currentStaff } = useAuth();

  /* Self-subscribe — the stub takes no props. */
  const [transactions, setTransactions] = useState<TransactionType[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubTx: (() => void) | null = null;
    let unsubCards: (() => void) | null = null;
    let unsubCountries: (() => void) | null = null;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setLoading(false);
      }
    };
    unsubTx = adminData.subscribeTransactions((items) => {
      setTransactions(items);
      finish();
    });
    unsubCards = adminData.subscribeCards((items) => {
      setCards(items);
      finish();
    });
    unsubCountries = adminData.subscribeCountries((items) => {
      setCountries(items);
      finish();
    });
    const t = setTimeout(finish, 1500);
    return () => {
      clearTimeout(t);
      unsubTx?.();
      unsubCards?.();
      unsubCountries?.();
    };
  }, []);

  /* Country scoping. */
  const visibleCountryCodes = useMemo(
    () => getVisibleCountryCodes(currentStaff, countries),
    [currentStaff, countries],
  );

  const scopedTx = useMemo(
    () => transactions.filter((t) => visibleCountryCodes.has(t.countryCode)),
    [transactions, visibleCountryCodes],
  );

  const filterableCountries = useMemo(() => {
    const codes = new Set(scopedTx.map((t) => t.countryCode));
    return countries
      .filter((c) => codes.has(c.countryCode))
      .sort((a, b) => a.countryCode.localeCompare(b.countryCode));
  }, [countries, scopedTx]);

  const filterableMethods = useMemo(() => {
    const set = new Set<string>();
    scopedTx.forEach((t) => set.add(t.paymentMethod));
    return Array.from(set).sort();
  }, [scopedTx]);

  /* Card scheme lookup: for each tx that has a cardLast4, find a matching
     card to surface its scheme (visa/mastercard/verve). */
  const schemeByLast4 = useMemo(() => {
    const m = new Map<string, CardScheme>();
    cards.forEach((c) => m.set(c.last4, c.scheme));
    return m;
  }, [cards]);

  /* ----------------------------- Filters ----------------------------- */
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<TxType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | "all">("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>("24h");

  const dateRangeMs = useMemo(() => {
    switch (dateRange) {
      case "24h": return 24 * 60 * 60 * 1000;
      case "7d": return 7 * 24 * 60 * 60 * 1000;
      case "30d": return 30 * 24 * 60 * 60 * 1000;
      case "all": return Number.POSITIVE_INFINITY;
    }
  }, [dateRange]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = Date.now() - dateRangeMs;
    return scopedTx.filter((t) => {
      if (t.createdAt < cutoff) return false;
      if (q) {
        const hay = `${t.reference} ${t.userName} ${t.merchantName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (countryFilter !== "all" && t.countryCode !== countryFilter) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (methodFilter !== "all" && t.paymentMethod !== methodFilter) return false;
      return true;
    });
  }, [scopedTx, search, countryFilter, typeFilter, statusFilter, methodFilter, dateRangeMs]);

  /* ------------------------------ Stats ------------------------------ */
  const stats = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const last24 = scopedTx.filter((t) => t.createdAt >= cutoff);
    const total = last24.length;
    const successful = last24.filter((t) => t.status === "successful").length;
    const failed = last24.filter((t) => t.status === "failed").length;
    const totalVolume = last24
      .filter((t) => t.status === "successful")
      .reduce((s, t) => s + t.amount, 0);
    const declineRate = total > 0 ? (failed / total) * 100 : 0;
    return { total, successful, failed, totalVolume, declineRate };
  }, [scopedTx]);

  /* ------------------------------ Sheet ------------------------------ */
  const [selected, setSelected] = useState<TransactionType | null>(null);

  const countryName = (code: string) =>
    countries.find((c) => c.countryCode === code)?.countryName ?? code;

  /* ----------------------------- Actor ------------------------------- */
  function actor() {
    return {
      staffId: currentStaff?.id ?? "unknown",
      staffName: currentStaff
        ? `${currentStaff.firstName} ${currentStaff.lastName}`
        : "Unknown",
      department: currentStaff?.departmentId ?? "unknown",
      role: currentStaff?.roleId ?? "unknown",
    };
  }

  /* ----------------------------- Actions ----------------------------- */
  function handleViewDetails(tx: TransactionType) {
    setSelected(tx);
    logAudit(actor(), "transaction.view_details", "transaction", tx.id, {
      countryCode: tx.countryCode,
      reason: "Admin opened transaction details sheet",
    });
  }

  function handleViewReceipt(tx: TransactionType) {
    toast.success("Receipt generation queued", {
      description: `Receipt for ${tx.reference} will be sent to ${tx.userName || "the customer"} via email/SMS.`,
    });
    logAudit(actor(), "transaction.view_receipt", "transaction", tx.id, {
      countryCode: tx.countryCode,
      reason: "Admin requested receipt",
    });
  }

  function handleOpenDispute(tx: TransactionType) {
    toast.info("Dispute workflow started", {
      description: `Dispute case opened for ${tx.reference}. A Disputes team member will follow up.`,
    });
    logAudit(actor(), "transaction.open_dispute", "transaction", tx.id, {
      countryCode: tx.countryCode,
      reason: "Admin opened dispute from transaction view",
    });
  }

  function handleAddNote(tx: TransactionType) {
    toast.success("Note added", {
      description: `Internal note recorded on transaction ${tx.reference}.`,
    });
    logAudit(actor(), "transaction.add_note", "transaction", tx.id, {
      countryCode: tx.countryCode,
      reason: "Admin added internal note",
    });
  }

  function handleEscalateRisk(tx: TransactionType) {
    toast.warning("Escalated to risk team", {
      description: `Transaction ${tx.reference} (risk score ${tx.riskScore}) escalated to Risk Operations.`,
    });
    logAudit(actor(), "transaction.escalate_risk", "transaction", tx.id, {
      countryCode: tx.countryCode,
      beforeValue: `riskScore=${tx.riskScore}`,
      afterValue: "escalated",
      reason: "Admin escalated transaction to risk team",
    });
  }

  async function handleHoldSettlement(tx: TransactionType) {
    await adminData.updateTransaction(tx.id, {
      settlementStatus: "held",
    });
    logAudit(actor(), "transaction.hold_settlement", "transaction", tx.id, {
      countryCode: tx.countryCode,
      beforeValue: "settlementStatus=pending",
      afterValue: "settlementStatus=held",
      reason: "Admin held settlement pending review",
    });
    toast.success("Settlement held", {
      description: `Settlement for ${tx.reference} held pending review.`,
    });
    // Refresh selected if open
    setSelected((prev) => (prev && prev.id === tx.id ? { ...prev, settlementStatus: "held" } : prev));
  }

  const hasActiveFilters =
    search.trim() !== "" ||
    countryFilter !== "all" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    methodFilter !== "all" ||
    dateRange !== "24h";

  function clearFilters() {
    setSearch("");
    setCountryFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setMethodFilter("all");
    setDateRange("24h");
  }

  return (
    <>
      <ViewHeader
        title="Transactions"
        description={`All transactions across all products · ${getScopeLabel(currentStaff)}`}
        icon={Receipt}
        actions={
          <Badge variant="outline" className="text-emerald-800 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-900/30">
            <TrendingUp className="size-3 mr-1" />
            Real-time monitoring
          </Badge>
        }
      />
      <ViewContainer>
        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Transactions (24h)"
            value={formatNumber(stats.total)}
            icon={Receipt}
            loading={loading}
          />
          <StatCard
            label="Successful (24h)"
            value={formatNumber(stats.successful)}
            icon={CheckCircle2}
            tone="success"
            loading={loading}
          />
          <StatCard
            label="Failed (24h)"
            value={formatNumber(stats.failed)}
            icon={XCircle}
            tone="danger"
            loading={loading}
          />
          <StatCard
            label="Volume (24h)"
            value={formatCompact(stats.totalVolume)}
            hint="successful only"
            icon={Wallet}
            tone="info"
            loading={loading}
          />
          <StatCard
            label="Decline Rate (24h)"
            value={`${stats.declineRate.toFixed(1)}%`}
            icon={AlertTriangle}
            tone={stats.declineRate > 10 ? "danger" : stats.declineRate > 5 ? "warning" : "default"}
            loading={loading}
          />
        </div>

        {/* Filter + table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="size-4 text-emerald-600" />
              Transaction Feed
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search reference, user, or merchant…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger size="sm" className="w-[170px] h-9 text-xs">
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
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TxType | "all")}>
                <SelectTrigger size="sm" className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_FILTER_VALUES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TransactionStatus | "all")}>
                <SelectTrigger size="sm" className="w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_VALUES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger size="sm" className="w-[150px] h-9 text-xs">
                  <SelectValue placeholder="Payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  {filterableMethods.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeValue)}>
                <SelectTrigger size="sm" className="w-[150px] h-9 text-xs">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_VALUES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs text-emerald-700">
                  Clear
                </Button>
              )}
              <Badge variant="secondary" className="ml-auto text-[11px]">
                {filtered.length} shown
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading transactions…</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={hasActiveFilters ? "No transactions match these filters" : "No transactions in your scope"}
                description={hasActiveFilters ? "Adjust the filters or clear them to see all transactions." : "Transactions in your countries will appear here."}
              />
            ) : (
              <ScrollTable>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                  <TableRow>
                    <TableHead className="pl-4">Reference</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="hidden lg:table-cell">Merchant</TableHead>
                    <TableHead className="hidden md:table-cell">Country</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden xl:table-cell">Method</TableHead>
                    <TableHead className="hidden lg:table-cell">Card</TableHead>
                    <TableHead className="hidden xl:table-cell">Risk</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((tx) => {
                    const sb = TX_STATUS_STYLES[tx.status];
                    const tb = TX_TYPE_STYLES[tx.type];
                    const risk = riskTone(tx.riskScore);
                    const scheme = tx.cardLast4 ? schemeByLast4.get(tx.cardLast4) : undefined;
                    return (
                      <TableRow key={tx.id} className="cursor-pointer" onClick={() => handleViewDetails(tx)}>
                        <TableCell className="pl-4 font-mono text-xs">{tx.reference}</TableCell>
                        <TableCell className="text-sm font-medium">
                          {tx.userName || "—"}
                          <span className="block text-[10px] text-muted-foreground">
                            {tx.userId ?? "system"}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">
                          {tx.merchantName || <span className="text-muted-foreground italic">—</span>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs">
                          <span className="font-mono">{tx.countryCode}</span>
                          <span className="block text-[10px] text-muted-foreground">{countryName(tx.countryCode)}</span>
                        </TableCell>
                        <TableCell className="text-sm font-semibold tabular-nums">
                          {formatCurrency(tx.amount, tx.currency)}
                          <span className="block text-[10px] font-normal text-muted-foreground">{tx.currency}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("text-[10px]", tb.className)}>
                            {tb.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("text-[10px]", sb.className)}>
                            {sb.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <PaymentMethodIcon method={tx.paymentMethod} className="size-3" /> {tx.paymentMethod}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {tx.cardLast4 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono">
                              <CreditCard className="size-3 text-muted-foreground" />
                              •••• {tx.cardLast4}
                              {scheme && (
                                <span className="ml-1 text-[9px] uppercase text-muted-foreground">{scheme}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <Badge variant="secondary" className={cn("text-[10px]", risk.className)}>
                            {tx.riskScore} · {risk.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                          {timeAgo(tx.createdAt)}
                        </TableCell>
                        <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                          <TxActions
                            tx={tx}
                            onView={() => handleViewDetails(tx)}
                            onReceipt={() => handleViewReceipt(tx)}
                            onDispute={() => handleOpenDispute(tx)}
                            onNote={() => handleAddNote(tx)}
                            onEscalate={() => handleEscalateRisk(tx)}
                            onHoldSettlement={() => handleHoldSettlement(tx)}
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
      </ViewContainer>

      {/* Details Sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <TxDetailsSheet
              tx={selected}
              countryName={countryName}
              scheme={selected.cardLast4 ? schemeByLast4.get(selected.cardLast4) : undefined}
              onReceipt={() => handleViewReceipt(selected)}
              onDispute={() => handleOpenDispute(selected)}
              onNote={() => handleAddNote(selected)}
              onEscalate={() => handleEscalateRisk(selected)}
              onHoldSettlement={() => handleHoldSettlement(selected)}
            />
          )}
        </SheetContent>
      </Sheet>

      <SonnerToaster richColors closeButton position="top-right" />
    </>
  );
}

/* --------------------------- Tx actions menu --------------------------- */

function TxActions({
  tx,
  onView,
  onReceipt,
  onDispute,
  onNote,
  onEscalate,
  onHoldSettlement,
}: {
  tx: TransactionType;
  onView: () => void;
  onReceipt: () => void;
  onDispute: () => void;
  onNote: () => void;
  onEscalate: () => void;
  onHoldSettlement: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Open transaction actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground">
          Transaction actions
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}>
          <Eye className="size-4 mr-2" /> View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onReceipt}>
          <FileText className="size-4 mr-2" /> View receipt
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onNote}>
          <StickyNote className="size-4 mr-2" /> Add note
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDispute}>
          <Gavel className="size-4 mr-2 text-amber-600" /> Open dispute
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEscalate}>
          <ShieldAlert className="size-4 mr-2 text-red-600" /> Escalate to risk
        </DropdownMenuItem>
        {tx.settlementStatus === "pending" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onHoldSettlement} className="text-amber-700 dark:text-amber-400 focus:bg-amber-50 dark:focus:bg-amber-900/30">
              <PauseCircle className="size-4 mr-2" /> Hold settlement
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* --------------------------- Details sheet body --------------------------- */

function TxDetailsSheet({
  tx,
  countryName,
  scheme,
  onReceipt,
  onDispute,
  onNote,
  onEscalate,
  onHoldSettlement,
}: {
  tx: TransactionType;
  countryName: (code: string) => string;
  scheme?: CardScheme;
  onReceipt: () => void;
  onDispute: () => void;
  onNote: () => void;
  onEscalate: () => void;
  onHoldSettlement: () => void;
}) {
  const sb = TX_STATUS_STYLES[tx.status];
  const tb = TX_TYPE_STYLES[tx.type];
  const risk = riskTone(tx.riskScore);
  const settlementBadge = tx.settlementStatus ? SETTLEMENT_STYLES[tx.settlementStatus] : null;
  const disputeBadge = tx.disputeStatus ? DISPUTE_STYLES[tx.disputeStatus] : null;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Receipt className="size-5 text-emerald-600" />
          <span className="font-mono text-base">{tx.reference}</span>
        </SheetTitle>
        <SheetDescription>
          {tx.userName || "System"} · {countryName(tx.countryCode)} ({tx.countryCode})
        </SheetDescription>
      </SheetHeader>

      <div className="px-4 pb-6 space-y-4">
        {/* Amount hero */}
        <div className="rounded-xl border bg-gradient-to-br from-slate-900 to-slate-700 dark:from-slate-800 dark:to-slate-900 text-white p-4 shadow-md">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-slate-300">
            <span>{tb.label}</span>
            <span>{tx.paymentMethod}</span>
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            {formatCurrency(tx.amount, tx.currency)}
          </div>
          <div className="text-[11px] text-slate-300 mt-1">
            {formatDateTime(tx.createdAt)}
          </div>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className={cn("text-[10px]", sb.className)}>
            {sb.label}
          </Badge>
          <Badge variant="secondary" className={cn("text-[10px]", tb.className)}>
            {tb.label}
          </Badge>
          <Badge variant="outline" className="text-[10px] inline-flex items-center gap-1">
            <PaymentMethodIcon method={tx.paymentMethod} className="size-3" /> {tx.paymentMethod}
          </Badge>
          {settlementBadge && (
            <Badge variant="outline" className={cn("text-[10px]", settlementBadge.className)}>
              Settlement: {settlementBadge.label}
            </Badge>
          )}
          {disputeBadge && tx.disputeStatus !== "none" && (
            <Badge variant="outline" className={cn("text-[10px]", disputeBadge.className)}>
              Dispute: {disputeBadge.label}
            </Badge>
          )}
          <Badge variant="secondary" className={cn("text-[10px]", risk.className)}>
            Risk: {tx.riskScore} · {risk.label}
          </Badge>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onReceipt}>
            <FileText className="size-4 mr-1" /> Receipt
          </Button>
          <Button variant="outline" size="sm" onClick={onNote}>
            <StickyNote className="size-4 mr-1" /> Add note
          </Button>
          <Button variant="outline" size="sm" onClick={onDispute}>
            <Gavel className="size-4 mr-1 text-amber-600" /> Open dispute
          </Button>
          <Button variant="outline" size="sm" onClick={onEscalate}>
            <ShieldAlert className="size-4 mr-1 text-red-600" /> Escalate
          </Button>
          {tx.settlementStatus === "pending" && (
            <Button variant="outline" size="sm" className="col-span-2" onClick={onHoldSettlement}>
              <PauseCircle className="size-4 mr-1 text-amber-600" /> Hold settlement
            </Button>
          )}
        </div>

        <Separator />

        {/* Customer & merchant */}
        <DetailSection title="Parties">
          <DetailRow label="Customer" value={tx.userName || "—"} />
          <DetailRow label="Customer ID" value={<span className="font-mono text-xs">{tx.userId ?? "—"}</span>} />
          <DetailRow
            label="Merchant"
            value={tx.merchantName || <span className="text-muted-foreground italic">—</span>}
          />
          <DetailRow
            label="Merchant ID"
            value={<span className="font-mono text-xs">{tx.merchantId ?? "—"}</span>}
          />
          <DetailRow label="Country" value={`${tx.countryCode} · ${countryName(tx.countryCode)}`} />
        </DetailSection>

        {/* Card metadata */}
        <DetailSection title="Card & payment method">
          <DetailRow label="Payment method" value={tx.paymentMethod} />
          <DetailRow
            label="Card last4"
            value={tx.cardLast4 ? <span className="font-mono">•••• {tx.cardLast4}</span> : <span className="text-muted-foreground italic">—</span>}
          />
          <DetailRow
            label="Scheme"
            value={scheme ? scheme.toUpperCase() : <span className="text-muted-foreground italic">unknown</span>}
          />
          <DetailRow
            label="Device serial"
            value={tx.deviceSerial ? <span className="font-mono text-xs">{tx.deviceSerial}</span> : <span className="text-muted-foreground italic">—</span>}
          />
        </DetailSection>

        {/* Device info */}
        <DetailSection title="Device">
          <DetailRow
            label="Device serial"
            value={tx.deviceSerial ? <span className="font-mono text-xs">{tx.deviceSerial}</span> : <span className="text-muted-foreground italic">No device (online)</span>}
          />
        </DetailSection>

        {/* Provider info */}
        <DetailSection title="Provider & authorization">
          <DetailRow
            label="Provider reference"
            value={tx.providerReference ? <span className="font-mono text-xs">{tx.providerReference}</span> : <span className="text-muted-foreground italic">—</span>}
          />
          <DetailRow
            label="Authorization code"
            value={tx.authorizationCode ? <span className="font-mono text-xs">{tx.authorizationCode}</span> : <span className="text-muted-foreground italic">—</span>}
          />
          <DetailRow
            label="Response code"
            value={tx.responseCode ? <span className="font-mono text-xs">{tx.responseCode}</span> : <span className="text-muted-foreground italic">—</span>}
          />
        </DetailSection>

        {/* Risk */}
        <DetailSection title="Risk">
          <DetailRow
            label="Risk score"
            value={
              <span className="inline-flex items-center gap-2">
                <span className="font-mono tabular-nums">{tx.riskScore}</span>
                <Badge variant="secondary" className={cn("text-[10px]", risk.className)}>{risk.label}</Badge>
              </span>
            }
          />
        </DetailSection>

        {/* Settlement & dispute */}
        <DetailSection title="Settlement & dispute">
          <DetailRow
            label="Settlement status"
            value={
              settlementBadge ? (
                <Badge variant="secondary" className={cn("text-[10px]", settlementBadge.className)}>
                  {settlementBadge.label}
                </Badge>
              ) : <span className="text-muted-foreground italic">Not applicable</span>
            }
          />
          <DetailRow
            label="Dispute status"
            value={
              disputeBadge ? (
                <Badge variant="secondary" className={cn("text-[10px]", disputeBadge.className)}>
                  {disputeBadge.label}
                </Badge>
              ) : <span className="text-muted-foreground italic">—</span>
            }
          />
        </DetailSection>

        {/* Lifecycle */}
        <DetailSection title="Lifecycle">
          <DetailRow label="Created" value={formatDateTime(tx.createdAt)} />
        </DetailSection>
      </div>
    </>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      <div className="rounded-lg border bg-card divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}

/* --------------------------- Scroll table wrapper --------------------------- */

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
