"use client";

/**
 * Faya Admin Portal — User Detail View (full-page consumer profile)
 *
 * Replaces the previous sliding Sheet with a proper full-page profile: back
 * button at the top, a wide profile header card (avatar, identity, status
 * badges, action buttons, quick stats grid) and 10 tabs covering everything
 * connected to the consumer — overview, cards, wallets, transactions,
 * documents, KYC cases, support tickets, disputes, risk alerts, and audit
 * trail. Each tab subscribes live to its Firestore collection via
 * `adminData.subscribe*`, filters by the selected consumer, and surfaces an
 * EmptyState when there is nothing to show.
 *
 * Selected consumer comes from `usePortalStore.selectedUserId`. The back
 * button calls `setView("users")` to return to the consumer list.
 *
 * Audit action keys:
 *   consumer.restrict / consumer.suspend / consumer.reactivate
 *   card.freeze / card.unfreeze
 *   wallet.freeze / wallet.unfreeze
 *   document.approve / document.reject / document.request_replacement
 *   kyc.approve / kyc.reject / kyc.escalate
 *   ticket.reply / ticket.assign / ticket.close
 *   dispute.update_status
 *   fraud.close / fraud.escalate
 *   transaction.dispute / transaction.escalate
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Users as UsersIcon,
  CreditCard,
  Wallet as WalletIcon,
  Receipt,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Snowflake,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Info,
  Lock,
  ScrollText,
  LifeBuoy,
  Scale,
  Activity,
  UserCheck,
  MapPin,
  Mail,
  Phone,
  Globe2,
  BadgeCheck,
  Ban,
  Pause,
  RotateCcw,
  Eye,
  MoreHorizontal,
  ShoppingCart,
  Truck,
  Smartphone,
  Package,
  Store,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import { ViewContainer, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

import { usePortalStore } from "@/hooks/use-portal-store";
import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
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
  ConsumerStatus,
  KycTier,
  PlatformKey,
  Card as CardRecord,
  Wallet as WalletRecord,
  Transaction as TransactionRecord,
  UserDocument as DocumentRecord,
  KycCase as KycCaseRecord,
  SupportTicket as TicketRecord,
  Dispute as DisputeRecord,
  FraudAlert as FraudRecord,
  AuditLog as AuditRecord,
  CardStatus,
  WalletStatus,
  TransactionStatus,
  DocumentType,
  RiskLevel,
  StockOrder,
  StockOrderStatus,
  StockItemType,
} from "@/lib/types";
import { PLATFORM_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

interface UserDetailViewProps {
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

const KYC_TIER_STYLES: Record<KycTier, { label: string; className: string }> = {
  tier_1: { label: "Tier 1", className: "text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  tier_2: { label: "Tier 2", className: "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  tier_3: { label: "Tier 3", className: "text-orange-700 border-orange-300 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800" },
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

const DOC_STATUS_STYLES: Record<DocumentRecord["status"], { label: string; className: string }> = {
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

const FRAUD_STATUS_STYLES: Record<FraudRecord["status"], { label: string; className: string }> = {
  open: { label: "Open", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  investigating: { label: "Investigating", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  closed: { label: "Closed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  escalated: { label: "Escalated", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
};

const TICKET_STATUS_STYLES: Record<TicketRecord["status"], { label: string; className: string }> = {
  open: { label: "Open", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  in_progress: { label: "In Progress", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  waiting: { label: "Waiting", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  resolved: { label: "Resolved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  closed: { label: "Closed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const DISPUTE_STATUS_STYLES: Record<DisputeRecord["status"], { label: string; className: string }> = {
  new: { label: "New", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  awaiting_evidence: { label: "Awaiting Evidence", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  evidence_submitted: { label: "Evidence Submitted", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  under_review: { label: "Under Review", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  won: { label: "Won", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  lost: { label: "Lost", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  expired: { label: "Expired", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const PRIORITY_STYLES: Record<TicketRecord["priority"], { label: string; className: string }> = {
  low: { label: "Low", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  medium: { label: "Medium", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  high: { label: "High", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const SEVERITY_STYLES: Record<RiskLevel, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  medium: { label: "Medium", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  high: { label: "High", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  critical: { label: "Critical", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const RISK_TONE = (score: number) =>
  score >= 80
    ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
    : score >= 50
      ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";

/* Stock order styling — shared between the consumer Orders tab and the
 * merchant Orders tab. Mirrors the styles used in stock-view.tsx. */
const STOCK_ORDER_STATUS_STYLES: Record<
  StockOrderStatus,
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  fulfilled: { label: "Fulfilled", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  shipped: { label: "Shipped", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  delivered: { label: "Delivered", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const STOCK_TYPE_META: Record<
  StockItemType,
  { label: string; icon: typeof Smartphone }
> = {
  physical_terminal: { label: "Terminal", icon: Smartphone },
  physical_card: { label: "Card", icon: CreditCard },
};

function consumerStatusBadge(s: ConsumerStatus) {
  const v = CONSUMER_STATUS_STYLES[s];
  return (
    <Badge variant="secondary" className={cn("text-[11px]", v.className)}>
      {v.label}
    </Badge>
  );
}

function kycBadge(s: string) {
  const v = statusBadge("kyc", s);
  return (
    <Badge variant="secondary" className={cn("text-[11px]", v.className)}>
      {v.label}
    </Badge>
  );
}

/* =============================== Main view =============================== */

export function UserDetailView({ consumers, countries }: UserDetailViewProps) {
  const { staff } = useAuth();
  const { selectedUserId, setView, selectMerchant } = usePortalStore();
  const [confirmAction, setConfirmAction] = useState<{
    consumer: Consumer;
    action: "restrict" | "suspend" | "reactivate";
  } | null>(null);
  const [allMerchants, setAllMerchants] = useState<any[]>([]);

  useEffect(() => {
    const unsub = adminData.subscribeMerchants(setAllMerchants);
    return () => unsub();
  }, []);

  const consumer = useMemo(
    () => consumers.find((c) => c.id === selectedUserId) ?? null,
    [consumers, selectedUserId],
  );

  // Check if this consumer is also a merchant (same UID in merchants collection)
  const linkedMerchant = allMerchants.find((m) => m.id === selectedUserId);

  function countryName(code: string): string {
    return countries.find((c) => c.countryCode === code)?.countryName ?? code;
  }

  async function applyConsumerAction(
    c: Consumer,
    action: "restrict" | "suspend" | "reactivate",
  ) {
    if (!staff) return;
    const newStatus: ConsumerStatus =
      action === "restrict"
        ? "restricted"
        : action === "suspend"
          ? "suspended"
          : "active";
    const before = c.status;
    await adminData.updateConsumer(c.id, {
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
      c.id,
      {
        countryCode: c.countryCode,
        beforeValue: before,
        afterValue: newStatus,
        reason: `${action} consumer ${c.consumerCode}`,
      },
    );
    toast.success(
      `${c.firstName} ${c.lastName} ${action === "reactivate" ? "reactivated" : action + "ed"} successfully`,
    );
  }

  // Not-found fallback
  if (!consumer) {
    return (
      <ViewContainer>
        <SonnerToaster richColors position="top-right" />
        <Button variant="outline" size="sm" onClick={() => setView("users")}>
          <ArrowLeft className="size-4 mr-1" /> Back to Users
        </Button>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={UsersIcon}
              title="Consumer not found"
              description="The selected consumer no longer exists. Pick another from the users list."
            />
          </CardContent>
        </Card>
      </ViewContainer>
    );
  }

  return (
    <ViewContainer className="space-y-4">
      <SonnerToaster richColors position="top-right" />

      {/* A. Back button bar */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setView("users")}>
          <ArrowLeft className="size-4 mr-1" /> Back to Users
        </Button>
        <Badge variant="outline" className="text-[11px] text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700">
          Full Profile View
        </Badge>
      </div>

      {/* Dual account banner — if this consumer is also a merchant */}
      {linkedMerchant && (
        <Card className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Store className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                This consumer is also a Merchant
              </div>
              <div className="text-xs text-emerald-700 dark:text-emerald-400 truncate">
                {linkedMerchant.tradingName || linkedMerchant.legalName || linkedMerchant.email} · Status: {linkedMerchant.status || "—"} · KYB: {linkedMerchant.kybStatus || "—"}
              </div>
            </div>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
              onClick={() => {
                selectMerchant(linkedMerchant.id);
                setView("merchant_detail");
              }}
            >
              View Merchant Profile <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* B. Profile header — keyed by id so all subscriptions/tabs reset on switch */}
      <ProfileHeader
        key={consumer.id}
        consumer={consumer}
        countries={countries}
        countryName={countryName}
        staff={staff}
        onAction={(action) => setConfirmAction({ consumer, action })}
      />

      {/* C. Tabs */}
      <ProfileTabs
        key={`tabs-${consumer.id}`}
        consumer={consumer}
        countries={countries}
        countryName={countryName}
        staff={staff}
      />

      {/* Confirm action dialog */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(o) => !o && setConfirmAction(null)}
      >
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
                  You are about to{" "}
                  <span className="font-medium">{confirmAction.action}</span>{" "}
                  <span className="font-medium">
                    {confirmAction.consumer.firstName}{" "}
                    {confirmAction.consumer.lastName}
                  </span>{" "}
                  ({confirmAction.consumer.consumerCode}). This action will be
                  recorded in the audit log.
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
                if (confirmAction)
                  applyConsumerAction(confirmAction.consumer, confirmAction.action);
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

/* =================== Profile header (full-width card) =================== */

function ProfileHeader({
  consumer,
  countries,
  countryName,
  staff,
  onAction,
}: {
  consumer: Consumer;
  countries: CountryConfig[];
  countryName: (code: string) => string;
  staff: ReturnType<typeof useAuth>["staff"];
  onAction: (action: "restrict" | "suspend" | "reactivate") => void;
}) {
  // Quick-stat counters — live subscriptions so the header reflects reality
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);

  useEffect(() => adminData.subscribeCards(setCards), []);
  useEffect(() => adminData.subscribeWallets(setWallets), []);
  useEffect(() => adminData.subscribeTransactions(setTransactions), []);
  useEffect(() => adminData.subscribeTickets(setTickets), []);
  useEffect(() => adminData.subscribeDisputes(setDisputes), []);
  useEffect(() => adminData.subscribeMerchants(setMerchants), []);

  // Check if this consumer is also a merchant (same UID in merchants collection)
  const linkedMerchant = merchants.find((m) => m.id === consumer.id);

  const fullName = consumer.fullName || `${consumer.firstName || ""} ${consumer.lastName || ""}`.trim() || consumer.email;
  const consumerCards = cards.filter((c) => c.userId === consumer.id);
  const consumerWallets = wallets.filter((w) => w.userId === consumer.id);
  const consumerTxns = transactions.filter((t) => t.userId === consumer.id);
  const consumerTickets = tickets.filter((t) => t.requesterName === fullName);
  const consumerDisputes = disputes.filter((d) => d.customerName === fullName);

  const totalBalance = consumerWallets.reduce((s, w) => s + w.balance, 0);
  const walletCurrency = consumerWallets[0]?.currency ?? consumer.currency;
  const openTickets = consumerTickets.filter(
    (t) => t.status === "open" || t.status === "in_progress" || t.status === "waiting",
  ).length;
  const openDisputes = consumerDisputes.filter(
    (d) => d.status !== "won" && d.status !== "lost" && d.status !== "expired",
  ).length;

  const initials =
    (consumer.firstName?.[0] ?? "") + (consumer.lastName?.[0] ?? "") || (consumer.email?.[0] ?? "U").toUpperCase();
  const country = countries.find((c) => c.countryCode === consumer.countryCode);

  return (
    <Card className="overflow-hidden border-emerald-200 dark:border-emerald-900/50">
      <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 dark:from-emerald-900/15 dark:via-slate-900 dark:to-emerald-900/10 px-6 py-5">
        {/* Top row: identity + actions */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          {/* Left: avatar + identity */}
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="size-16 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xl font-semibold shrink-0 shadow-sm shadow-emerald-600/30">
              {initials.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight truncate">
                  {fullName}
                </h2>
                {kycBadge(consumer.kycStatus || "pending")}
                {consumerStatusBadge((consumer.status as string) as ConsumerStatus)}
                <Badge
                  variant="outline"
                  className={cn("text-[11px]", (KYC_TIER_STYLES[consumer.kycTier as KycTier] || { className: "", label: consumer.kycTier || "N/A" }).className)}
                >
                  {(KYC_TIER_STYLES[consumer.kycTier as KycTier] || { className: "", label: consumer.kycTier || "N/A" }).label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11px] font-semibold",
                    RISK_TONE(consumer.riskScore ?? 0),
                  )}
                >
                  <ShieldAlert className="size-3 mr-1" />
                  Risk {consumer.riskScore ?? 0}/100
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono text-emerald-700 dark:text-emerald-400">
                  {consumer.consumerCode || "—"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3" />
                  {consumer.email}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3" />
                  {consumer.phone || "—"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Globe2 className="size-3" />
                  {consumer.countryCode || consumer.countryOfResidence || "—"}
                </span>
                {country && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" />
                    {country.timezone} · {consumer.currency || "NGN"}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  Joined {formatDateTime(consumer.createdAt ?? null)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/30"
              onClick={() => onAction("restrict")}
              disabled={
                (consumer.status as string) === "restricted" ||
                (consumer.status as string) === "suspended" ||
                !staff
              }
            >
              <Pause className="size-3.5 mr-1" /> Restrict
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
              onClick={() => onAction("suspend")}
              disabled={(consumer.status as string) === "suspended" || !staff}
            >
              <Ban className="size-3.5 mr-1" /> Suspend
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
              onClick={() => onAction("reactivate")}
              disabled={(consumer.status as string) === "active" || !staff}
            >
              <RotateCcw className="size-3.5 mr-1" /> Reactivate
            </Button>
          </div>
        </div>

        {/* Bottom row: quick stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-5">
          <QuickStat icon={CreditCard} label="Cards" value={consumerCards.length} />
          <QuickStat icon={WalletIcon} label="Wallets" value={consumerWallets.length} />
          <QuickStat
            icon={WalletIcon}
            label="Total Balance"
            value={formatCurrency(totalBalance, walletCurrency)}
            textSize="sm"
          />
          <QuickStat icon={Receipt} label="Transactions" value={consumerTxns.length} />
          <QuickStat
            icon={LifeBuoy}
            label="Open Tickets"
            value={openTickets}
            tone="warning"
          />
          <QuickStat
            icon={Scale}
            label="Open Disputes"
            value={openDisputes}
            tone="danger"
          />
        </div>
      </div>
    </Card>
  );
}

/* ============================ Tabs + 10 panels =========================== */

function ProfileTabs({
  consumer,
  countries,
  countryName,
  staff,
}: {
  consumer: Consumer;
  countries: CountryConfig[];
  countryName: (code: string) => string;
  staff: ReturnType<typeof useAuth>["staff"];
}) {
  // Live subscriptions — single subscription per collection, filtered in render.
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [kycCases, setKycCases] = useState<KycCaseRecord[]>([]);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [stockOrders, setStockOrders] = useState<StockOrder[]>([]);

  useEffect(() => adminData.subscribeCards(setCards), []);
  useEffect(() => adminData.subscribeWallets(setWallets), []);
  useEffect(() => adminData.subscribeTransactions(setTransactions), []);
  useEffect(() => adminData.subscribeDocuments(setDocuments), []);
  useEffect(() => adminData.subscribeKyc(setKycCases), []);
  useEffect(() => adminData.subscribeTickets(setTickets), []);
  useEffect(() => adminData.subscribeDisputes(setDisputes), []);
  useEffect(() => adminData.subscribeFraud(setFraudAlerts), []);
  useEffect(() => adminData.subscribeAudit(setAuditLogs), []);
  useEffect(() => adminData.subscribeStockOrders(setStockOrders), []);

  const fullName = consumer.fullName || `${consumer.firstName || ""} ${consumer.lastName || ""}`.trim() || consumer.email;
  const consumerCards = cards.filter((c) => c.userId === consumer.id);
  const consumerWallets = wallets.filter((w) => w.userId === consumer.id);
  const consumerTxns = transactions.filter((t) => t.userId === consumer.id);
  const consumerDocs = documents.filter((d) => d.entityId === consumer.id);
  const consumerKyc = kycCases.filter(
    (k) => k.id === consumer.kycCaseId || k.customerName === fullName,
  );
  const consumerTickets = tickets.filter((t) => t.requesterName === fullName);
  const consumerDisputes = disputes.filter((d) => d.customerName === fullName);
  const consumerFraud = fraudAlerts.filter(
    (f) => f.entityName === fullName || f.entityName === consumer.consumerCode,
  );
  const consumerAudit = auditLogs.filter(
    (a) => a.entityId === consumer.id || a.entityId === consumer.consumerCode,
  );
  const consumerOrders = stockOrders.filter(
    (o) => o.userId === consumer.id && o.userType === "consumer",
  );

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="h-auto flex-wrap justify-start rounded-none border-b bg-transparent p-0 mb-4">
        <ProfileTab value="overview" label="Overview" />
        <ProfileTab value="cards" label="Cards" count={consumerCards.length} />
        <ProfileTab value="wallets" label="Wallets" count={consumerWallets.length} />
        <ProfileTab value="transactions" label="Transactions" count={consumerTxns.length} />
        <ProfileTab value="documents" label="Documents" count={consumerDocs.length} />
        <ProfileTab value="kyc" label="KYC Cases" count={consumerKyc.length} />
        <ProfileTab value="tickets" label="Support" count={consumerTickets.length} />
        <ProfileTab value="disputes" label="Disputes" count={consumerDisputes.length} />
        <ProfileTab value="risk" label="Risk & Alerts" count={consumerFraud.length} />
        <ProfileTab value="audit" label="Activity" count={consumerAudit.length} />
        <ProfileTab value="orders" label="Orders" count={consumerOrders.length} />
      </TabsList>

      <TabsContent value="overview" className="mt-0">
        <OverviewTab
          consumer={consumer}
          countryName={countryName}
          countries={countries}
        />
      </TabsContent>

      <TabsContent value="cards" className="mt-0">
        <CardsTab
          cards={consumerCards}
          staff={staff}
          consumerCode={consumer.consumerCode || "—"}
        />
      </TabsContent>

      <TabsContent value="wallets" className="mt-0">
        <WalletsTab
          wallets={consumerWallets}
          staff={staff}
          consumerCode={consumer.consumerCode || "—"}
        />
      </TabsContent>

      <TabsContent value="transactions" className="mt-0">
        <TransactionsTab txns={consumerTxns} staff={staff} consumer={consumer} />
      </TabsContent>

      <TabsContent value="documents" className="mt-0">
        <DocumentsTab docs={consumerDocs} staff={staff} consumer={consumer} />
      </TabsContent>

      <TabsContent value="kyc" className="mt-0">
        <KycTab cases={consumerKyc} staff={staff} consumer={consumer} />
      </TabsContent>

      <TabsContent value="tickets" className="mt-0">
        <TicketsTab tickets={consumerTickets} staff={staff} consumer={consumer} />
      </TabsContent>

      <TabsContent value="disputes" className="mt-0">
        <DisputesTab disputes={consumerDisputes} staff={staff} consumer={consumer} />
      </TabsContent>

      <TabsContent value="risk" className="mt-0">
        <RiskTab alerts={consumerFraud} staff={staff} consumer={consumer} />
      </TabsContent>

      <TabsContent value="audit" className="mt-0">
        <AuditTab logs={consumerAudit} />
      </TabsContent>

      <TabsContent value="orders" className="mt-0">
        <OrdersTab orders={consumerOrders} staff={staff} consumer={consumer} />
      </TabsContent>
    </Tabs>
  );
}

/* ----------------------------- Shared bits ------------------------------ */

function ProfileTab({
  value,
  label,
  count,
}: {
  value: string;
  label: string;
  count?: number;
}) {
  return (
    <TabsTrigger
      value={value}
      className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 text-xs font-medium"
    >
      {label}
      {count !== undefined && (
        <Badge
          variant="secondary"
          className={cn(
            "ml-1.5 text-[10px] h-5 px-1.5 tabular-nums",
            count > 0
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </Badge>
      )}
    </TabsTrigger>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
  tone,
  textSize = "base",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: "warning" | "danger" | "default";
  textSize?: "sm" | "base";
}) {
  const toneClass =
    tone === "warning"
      ? "text-amber-700 dark:text-amber-400"
      : tone === "danger"
        ? "text-red-700 dark:text-red-400"
        : "text-slate-900 dark:text-slate-100";
  return (
    <div className="rounded-md border bg-white dark:bg-slate-900 p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3 text-emerald-600" />
        {label}
      </div>
      <div
        className={cn(
          "font-semibold tabular-nums mt-1",
          textSize === "sm" ? "text-sm" : "text-lg",
          toneClass,
        )}
      >
        {value}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
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

function ScrollTable({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={
        "max-h-96 overflow-auto rounded-md border " +
        "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent " +
        "[&::-webkit-scrollbar-thumb]:rounded-full " +
        "[&::-webkit-scrollbar-thumb]:bg-slate-300 " +
        "dark:[&::-webkit-scrollbar-thumb]:bg-slate-700"
      }
    >
      <Table className="text-sm">{children}</Table>
    </div>
  );
}

function RowActionsCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-end gap-1">{children}</div>
    </TableCell>
  );
}

function IconBtn({
  icon: Icon,
  label,
  tone = "default",
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  onClick: () => void;
  disabled?: boolean;
}) {
  const toneClass = {
    default: "text-muted-foreground hover:bg-muted",
    success: "text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
    warning: "text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40",
    danger: "text-red-700 hover:bg-red-100 dark:hover:bg-red-900/40",
    info: "text-sky-700 hover:bg-sky-100 dark:hover:bg-sky-900/40",
  }[tone];
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-7", toneClass)}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      <Icon className="size-3.5" />
    </Button>
  );
}

/* -------------------------------- Tab 1: Overview ------------------------ */

function OverviewTab({
  consumer,
  countryName,
  countries,
}: {
  consumer: Consumer;
  countryName: (code: string) => string;
  countries: CountryConfig[];
}) {
  const country = countries.find((c) => c.countryCode === consumer.countryCode);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4">
          <SectionLabel icon={UsersIcon}>Personal Details</SectionLabel>
          <DetailRow label="Full name" value={`${consumer.firstName} ${consumer.lastName}`} />
          <DetailRow label="Date of birth" value={consumer.dateOfBirth} />
          <DetailRow label="Nationality" value={consumer.nationality} />
          <DetailRow
            label="Consumer code"
            value={
              <span className="font-mono text-emerald-700 dark:text-emerald-400">
                {consumer.consumerCode || "—"}
              </span>
            }
          />
          <DetailRow
            label="Firebase UID"
            value={
              <span className="font-mono text-[11px] text-muted-foreground">
                fb_uid_{consumer.id.slice(0, 12)}
              </span>
            }
          />
          <DetailRow label="Member since" value={formatDateTime(consumer.createdAt ?? null)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <SectionLabel icon={Mail}>Contact</SectionLabel>
          <DetailRow
            label="Email"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3 text-muted-foreground" />
                {consumer.email}
              </span>
            }
          />
          <DetailRow
            label="Phone"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3 text-muted-foreground" />
                {consumer.phone || "—"}
              </span>
            }
          />
          <DetailRow
            label="Country"
            value={
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3 text-muted-foreground" />
                {consumer.countryCode || consumer.countryOfResidence || "—"}
              </span>
            }
          />
          <DetailRow label="Timezone" value={country?.timezone ?? "—"} />
          <DetailRow label="Currency" value={consumer.currency || "NGN"} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <SectionLabel icon={ShieldCheck}>KYC Summary</SectionLabel>
          <DetailRow label="KYC status" value={kycBadge(consumer.kycStatus || "pending")} />
          <DetailRow
            label="KYC tier"
            value={
              <Badge
                variant="outline"
                className={(KYC_TIER_STYLES[consumer.kycTier as KycTier] || { className: "", label: consumer.kycTier || "N/A" }).className}
              >
                {(KYC_TIER_STYLES[consumer.kycTier as KycTier] || { className: "", label: consumer.kycTier || "N/A" }).label}
              </Badge>
            }
          />
          <DetailRow
            label="Risk score"
            value={
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                  RISK_TONE(consumer.riskScore ?? 0),
                )}
              >
                <ShieldAlert className="size-3" />
                {consumer.riskScore ?? 0}/100
              </span>
            }
          />
          <DetailRow
            label="KYC Case ID"
            value={
              consumer.kycCaseId ?? <span className="text-muted-foreground">—</span>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <SectionLabel icon={Globe2}>Platforms Used</SectionLabel>
          {(consumer.platforms || []).length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">No platforms linked.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 px-3 py-2">
              {(consumer.platforms || []).map((p) => (
                <Badge
                  key={p}
                  variant="outline"
                  className="text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
                >
                  {PLATFORM_LABELS[p].label}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <SectionLabel icon={WalletIcon}>Wallet Summary</SectionLabel>
          <DetailRow
            label="Wallet balance"
            value={
              <span className="font-semibold tabular-nums">
                {formatCurrency(consumer.walletBalance ?? 0, consumer.currency ?? "NGN")}
              </span>
            }
          />
          <DetailRow label="Currency" value={consumer.currency || "NGN"} />
          <DetailRow label="Last updated" value={timeAgo(consumer.updatedAt ?? null)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <SectionLabel icon={Receipt}>Transaction Stats</SectionLabel>
          <DetailRow
            label="Lifetime volume"
            value={
              <span className="font-semibold tabular-nums">
                {formatCurrency(consumer.lifetimeVolume ?? 0, consumer.currency ?? "NGN")}
              </span>
            }
          />
          <DetailRow
            label="Monthly volume"
            value={
              <span className="font-semibold tabular-nums">
                {formatCurrency(consumer.monthlyVolume ?? 0, consumer.currency ?? "NGN")}
              </span>
            }
          />
          <DetailRow label="Transaction count" value={formatNumber(consumer.transactionCount ?? 0)} />
        </CardContent>
      </Card>

      <Card className="md:col-span-2 lg:col-span-3">
        <CardContent className="p-4">
          <SectionLabel icon={Info}>Explore the profile</SectionLabel>
          <p className="text-xs text-muted-foreground px-3 py-2">
            Click the tabs above to see full details for cards, wallets, transactions, documents,
            KYC cases, support tickets, disputes, risk alerts and the complete activity audit trail —
            everything connected to this consumer lives here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* --------------------------------- Tab 2: Cards ------------------------- */

function CardsTab({
  cards,
  staff,
  consumerCode,
}: {
  cards: CardRecord[];
  staff: ReturnType<typeof useAuth>["staff"];
  consumerCode: string;
}) {
  async function toggleFreeze(card: CardRecord) {
    if (!staff) return;
    const next = !card.frozen;
    await adminData.updateCard(card.id, {
      frozen: next,
      status: next ? "frozen" : "active",
      updatedAt: Date.now(),
    });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      next ? "card.freeze" : "card.unfreeze",
      "card",
      card.id,
      {
        countryCode: card.countryCode,
        beforeValue: card.frozen ? "frozen" : "active",
        afterValue: next ? "frozen" : "active",
        reason: `${next ? "Freeze" : "Unfreeze"} card •••• ${card.last4} (${consumerCode})`,
      },
    );
    toast.success(`${next ? "Frozen" : "Unfrozen"} card •••• ${card.last4}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel icon={CreditCard}>Issued Cards ({cards.length})</SectionLabel>
        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
          <Lock className="size-3 mr-1" /> Admin never sees full PAN, CVV or PIN
        </Badge>
      </div>
      {cards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No cards issued"
          description="This consumer has not been issued any cards yet."
        />
      ) : (
        <ScrollTable>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Card ID</TableHead>
              <TableHead className="text-[11px]">Type</TableHead>
              <TableHead className="text-[11px]">Scheme</TableHead>
              <TableHead className="text-[11px]">Last 4</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px]">Currency</TableHead>
              <TableHead className="text-[11px] text-center">Frozen</TableHead>
              <TableHead className="text-[11px] text-center">Tokenized</TableHead>
              <TableHead className="text-[11px]">Created</TableHead>
              <TableHead className="text-[11px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                  {c.cardId}
                </TableCell>
                <TableCell className="text-[11px] capitalize">{c.type}</TableCell>
                <TableCell className="text-[11px] uppercase">{c.scheme}</TableCell>
                <TableCell className="font-mono text-[11px]">•••• {c.last4}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px]", CARD_STATUS_STYLES[c.status].className)}
                  >
                    {CARD_STATUS_STYLES[c.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-[11px]">{c.currency}</TableCell>
                <TableCell className="text-center">
                  {c.frozen ? (
                    <Snowflake className="size-3.5 text-sky-600 mx-auto" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {c.tokenized ? (
                    <BadgeCheck className="size-3.5 text-emerald-600 mx-auto" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-[11px] text-muted-foreground">
                  {formatDateTime(c.createdAt)}
                </TableCell>
                <RowActionsCell>
                  <IconBtn
                    icon={c.frozen ? PlayCircle : Snowflake}
                    label={c.frozen ? "Unfreeze" : "Freeze"}
                    tone={c.frozen ? "success" : "info"}
                    onClick={() => toggleFreeze(c)}
                  />
                  <IconBtn
                    icon={Eye}
                    label="View details"
                    onClick={() =>
                      toast.info(
                        `Card •••• ${c.last4} • ${c.scheme.toUpperCase()} • ${c.provider}`,
                      )
                    }
                  />
                </RowActionsCell>
              </TableRow>
            ))}
          </TableBody>
        </ScrollTable>
      )}
    </div>
  );
}

/* -------------------------------- Tab 3: Wallets ------------------------ */

function WalletsTab({
  wallets,
  staff,
  consumerCode,
}: {
  wallets: WalletRecord[];
  staff: ReturnType<typeof useAuth>["staff"];
  consumerCode: string;
}) {
  async function toggleFreeze(w: WalletRecord) {
    if (!staff) return;
    const next = w.status === "frozen" ? "active" : "frozen";
    await adminData.updateWallet(w.id, { status: next, updatedAt: Date.now() });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      next === "frozen" ? "wallet.freeze" : "wallet.unfreeze",
      "wallet",
      w.id,
      {
        countryCode: w.countryCode,
        beforeValue: w.status,
        afterValue: next,
        reason: `${next === "frozen" ? "Freeze" : "Unfreeze"} wallet ${w.walletId} (${consumerCode})`,
      },
    );
    toast.success(`${next === "frozen" ? "Frozen" : "Unfrozen"} wallet ${w.walletId}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel icon={WalletIcon}>Wallets ({wallets.length})</SectionLabel>
        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
          <Info className="size-3 mr-1" /> Manual balance adjustment requires dual approval
        </Badge>
      </div>
      {wallets.length === 0 ? (
        <EmptyState
          icon={WalletIcon}
          title="No wallets"
          description="This consumer has no wallets provisioned."
        />
      ) : (
        <ScrollTable>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Wallet ID</TableHead>
              <TableHead className="text-[11px]">Currency</TableHead>
              <TableHead className="text-[11px] text-right">Balance</TableHead>
              <TableHead className="text-[11px] text-right">Available</TableHead>
              <TableHead className="text-[11px] text-right">Held</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px] text-center">Linked Cards</TableHead>
              <TableHead className="text-[11px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wallets.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                  {w.walletId}
                </TableCell>
                <TableCell className="text-[11px]">{w.currency}</TableCell>
                <TableCell className="text-right text-[11px] tabular-nums font-medium">
                  {formatCurrency(w.balance, w.currency)}
                </TableCell>
                <TableCell className="text-right text-[11px] tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(w.availableBalance, w.currency)}
                </TableCell>
                <TableCell className="text-right text-[11px] tabular-nums text-amber-700 dark:text-amber-400">
                  {formatCurrency(w.heldBalance, w.currency)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px]", WALLET_STATUS_STYLES[w.status].className)}
                  >
                    {WALLET_STATUS_STYLES[w.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-[11px]">
                  <Badge variant="secondary" className="text-[10px]">
                    {w.linkedCardIds.length}
                  </Badge>
                </TableCell>
                <RowActionsCell>
                  <IconBtn
                    icon={w.status === "frozen" ? PlayCircle : Snowflake}
                    label={w.status === "frozen" ? "Unfreeze" : "Freeze"}
                    tone={w.status === "frozen" ? "success" : "info"}
                    onClick={() => toggleFreeze(w)}
                  />
                </RowActionsCell>
              </TableRow>
            ))}
          </TableBody>
        </ScrollTable>
      )}
    </div>
  );
}

/* ------------------------------ Tab 4: Transactions --------------------- */

function TransactionsTab({
  txns,
  staff,
  consumer,
}: {
  txns: TransactionRecord[];
  staff: ReturnType<typeof useAuth>["staff"];
  consumer: Consumer;
}) {
  function openDispute(t: TransactionRecord) {
    if (!staff) return;
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "transaction.dispute",
      "transaction",
      t.id,
      {
        countryCode: t.countryCode,
        afterValue: "dispute_opened",
        reason: `Open dispute on ${t.reference} for ${consumer.consumerCode || "—"}`,
      },
    );
    toast.success(`Dispute opened for ${t.reference}`);
  }

  function escalate(t: TransactionRecord) {
    if (!staff) return;
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "transaction.escalate",
      "transaction",
      t.id,
      {
        countryCode: t.countryCode,
        afterValue: "escalated",
        reason: `Escalate ${t.reference} for ${consumer.consumerCode || "—"}`,
      },
    );
    toast.success(`Transaction ${t.reference} escalated`);
  }

  return (
    <div className="space-y-3">
      <SectionLabel icon={Receipt}>Transactions ({txns.length})</SectionLabel>
      {txns.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions"
          description="This consumer has no transactions yet."
        />
      ) : (
        <ScrollTable>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Reference</TableHead>
              <TableHead className="text-[11px] text-right">Amount</TableHead>
              <TableHead className="text-[11px]">Type</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px]">Method</TableHead>
              <TableHead className="text-[11px]">Card</TableHead>
              <TableHead className="text-[11px] text-center">Risk</TableHead>
              <TableHead className="text-[11px]">Created</TableHead>
              <TableHead className="text-[11px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {txns.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                  {t.reference}
                </TableCell>
                <TableCell className="text-right text-[11px] tabular-nums font-medium">
                  {formatCurrency(t.amount, t.currency)}
                </TableCell>
                <TableCell className="text-[11px] capitalize">{t.type.replace(/_/g, " ")}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px]", TX_STATUS_STYLES[t.status].className)}
                  >
                    {TX_STATUS_STYLES[t.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-[11px]">{t.paymentMethod}</TableCell>
                <TableCell className="font-mono text-[10px]">
                  {t.cardLast4 ? `•••• ${t.cardLast4}` : "—"}
                </TableCell>
                <TableCell className="text-center">
                  <span
                    className={cn(
                      "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold",
                      RISK_TONE(t.riskScore),
                    )}
                  >
                    {t.riskScore}
                  </span>
                </TableCell>
                <TableCell className="text-[11px] text-muted-foreground">
                  {formatDateTime(t.createdAt)}
                </TableCell>
                <RowActionsCell>
                  <IconBtn
                    icon={Receipt}
                    label="View receipt"
                    onClick={() =>
                      toast.info(
                        `Receipt ${t.reference} — ${formatCurrency(t.amount, t.currency)}`,
                      )
                    }
                  />
                  <IconBtn
                    icon={Scale}
                    label="Open dispute"
                    tone="warning"
                    onClick={() => openDispute(t)}
                  />
                  <IconBtn
                    icon={AlertTriangle}
                    label="Escalate"
                    tone="danger"
                    onClick={() => escalate(t)}
                  />
                  <IconBtn
                    icon={FileText}
                    label="Add note"
                    onClick={() => toast.success(`Note added to ${t.reference}`)}
                  />
                </RowActionsCell>
              </TableRow>
            ))}
          </TableBody>
        </ScrollTable>
      )}
    </div>
  );
}

/* ------------------------------- Tab 5: Documents ----------------------- */

function DocumentsTab({
  docs,
  staff,
  consumer,
}: {
  docs: DocumentRecord[];
  staff: ReturnType<typeof useAuth>["staff"];
  consumer: Consumer;
}) {
  async function setStatus(
    d: DocumentRecord,
    status: DocumentRecord["status"],
    action: string,
    label: string,
  ) {
    if (!staff) return;
    await adminData.updateDocument(d.id, {
      status,
      reviewedBy: `${staff.firstName} ${staff.lastName}`,
      reviewedAt: Date.now(),
    });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      action,
      "document",
      d.id,
      {
        countryCode: d.countryCode,
        beforeValue: d.status,
        afterValue: status,
        reason: `${label} document ${d.fileName} for ${consumer.consumerCode || "—"}`,
      },
    );
    toast.success(`${label} document ${d.fileName}`);
  }

  return (
    <div className="space-y-3">
      <SectionLabel icon={FileText}>Documents ({docs.length})</SectionLabel>
      {docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents"
          description="This consumer has not uploaded any documents."
        />
      ) : (
        <ScrollTable>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Type</TableHead>
              <TableHead className="text-[11px]">File Name</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px]">Uploaded</TableHead>
              <TableHead className="text-[11px]">Reviewed By</TableHead>
              <TableHead className="text-[11px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="text-[11px]">{DOC_TYPE_LABELS[d.documentType]}</TableCell>
                <TableCell className="font-mono text-[10px]">{d.fileName}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px]", DOC_STATUS_STYLES[d.status].className)}
                  >
                    {DOC_STATUS_STYLES[d.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-[11px] text-muted-foreground">
                  {formatDateTime(d.uploadedAt)}
                </TableCell>
                <TableCell className="text-[11px]">{d.reviewedBy ?? "—"}</TableCell>
                <RowActionsCell>
                  <IconBtn
                    icon={CheckCircle2}
                    label="Approve"
                    tone="success"
                    onClick={() => setStatus(d, "approved", "document.approve", "Approved")}
                    disabled={d.status === "approved"}
                  />
                  <IconBtn
                    icon={XCircle}
                    label="Reject"
                    tone="danger"
                    onClick={() => setStatus(d, "rejected", "document.reject", "Rejected")}
                    disabled={d.status === "rejected"}
                  />
                  <IconBtn
                    icon={RotateCcw}
                    label="Request replacement"
                    tone="warning"
                    onClick={() =>
                      setStatus(
                        d,
                        "replacement_requested",
                        "document.request_replacement",
                        "Requested replacement for",
                      )
                    }
                    disabled={d.status === "replacement_requested"}
                  />
                </RowActionsCell>
              </TableRow>
            ))}
          </TableBody>
        </ScrollTable>
      )}
    </div>
  );
}

/* -------------------------------- Tab 6: KYC Cases ---------------------- */

function KycTab({
  cases,
  staff,
  consumer,
}: {
  cases: KycCaseRecord[];
  staff: ReturnType<typeof useAuth>["staff"];
  consumer: Consumer;
}) {
  async function approve(k: KycCaseRecord) {
    if (!staff) return;
    await adminData.updateKyc(k.id, {
      status: "approved",
      assignedReviewer: `${staff.firstName} ${staff.lastName}`,
    });
    await adminData.updateConsumer(consumer.id, {
      kycStatus: "approved",
      status: "active",
      updatedAt: Date.now(),
    });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "kyc.approve",
      "kyc_case",
      k.id,
      {
        countryCode: k.countryCode,
        beforeValue: k.status,
        afterValue: "approved",
        reason: `Approve KYC case ${k.id} for ${consumer.consumerCode || "—"}`,
      },
    );
    toast.success(`KYC case ${k.id} approved — consumer activated`);
  }

  async function reject(k: KycCaseRecord) {
    if (!staff) return;
    await adminData.updateKyc(k.id, {
      status: "rejected",
      assignedReviewer: `${staff.firstName} ${staff.lastName}`,
    });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "kyc.reject",
      "kyc_case",
      k.id,
      {
        countryCode: k.countryCode,
        beforeValue: k.status,
        afterValue: "rejected",
        reason: `Reject KYC case ${k.id} for ${consumer.consumerCode || "—"}`,
      },
    );
    toast.success(`KYC case ${k.id} rejected`);
  }

  async function escalate(k: KycCaseRecord) {
    if (!staff) return;
    await adminData.updateKyc(k.id, { status: "escalated" });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "kyc.escalate",
      "kyc_case",
      k.id,
      {
        countryCode: k.countryCode,
        beforeValue: k.status,
        afterValue: "escalated",
        reason: `Escalate KYC case ${k.id} for ${consumer.consumerCode || "—"}`,
      },
    );
    toast.success(`KYC case ${k.id} escalated`);
  }

  return (
    <div className="space-y-3">
      <SectionLabel icon={ShieldCheck}>KYC Cases ({cases.length})</SectionLabel>
      {cases.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No KYC cases"
          description="No KYC cases are linked to this consumer."
        />
      ) : (
        <ScrollTable>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Case ID</TableHead>
              <TableHead className="text-[11px]">Country</TableHead>
              <TableHead className="text-[11px]">Nationality</TableHead>
              <TableHead className="text-[11px] text-center">Risk</TableHead>
              <TableHead className="text-[11px]">Submitted</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px]">Reviewer</TableHead>
              <TableHead className="text-[11px]">SLA</TableHead>
              <TableHead className="text-[11px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((k) => {
              const sla = slaLabel(k.slaDeadline);
              return (
                <TableRow key={k.id}>
                  <TableCell className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                    {k.id}
                  </TableCell>
                  <TableCell className="text-[11px]">{k.countryCode}</TableCell>
                  <TableCell className="text-[11px]">{k.nationality}</TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        RISK_TONE(k.riskScore),
                      )}
                    >
                      {k.riskScore}
                    </span>
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {formatDateTime(k.submittedAt)}
                  </TableCell>
                  <TableCell>{kycBadge(k.status)}</TableCell>
                  <TableCell className="text-[11px]">{k.assignedReviewer ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", sla.className)}
                    >
                      {sla.label}
                    </Badge>
                  </TableCell>
                  <RowActionsCell>
                    <IconBtn
                      icon={CheckCircle2}
                      label="Approve"
                      tone="success"
                      onClick={() => approve(k)}
                      disabled={k.status === "approved"}
                    />
                    <IconBtn
                      icon={XCircle}
                      label="Reject"
                      tone="danger"
                      onClick={() => reject(k)}
                      disabled={k.status === "rejected"}
                    />
                    <IconBtn
                      icon={AlertTriangle}
                      label="Escalate"
                      tone="warning"
                      onClick={() => escalate(k)}
                      disabled={k.status === "escalated"}
                    />
                  </RowActionsCell>
                </TableRow>
              );
            })}
          </TableBody>
        </ScrollTable>
      )}
    </div>
  );
}

/* ------------------------------ Tab 7: Support Tickets ------------------ */

function TicketsTab({
  tickets,
  staff,
  consumer,
}: {
  tickets: TicketRecord[];
  staff: ReturnType<typeof useAuth>["staff"];
  consumer: Consumer;
}) {
  async function update(
    t: TicketRecord,
    patch: Partial<TicketRecord>,
    action: string,
    label: string,
  ) {
    if (!staff) return;
    await adminData.updateTicket(t.id, { ...patch, updatedAt: Date.now() });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      action,
      "ticket",
      t.id,
      {
        countryCode: t.countryCode,
        reason: `${label} on ticket ${t.id} for ${consumer.consumerCode || "—"}`,
      },
    );
    toast.success(`${label} — ticket ${t.id}`);
  }

  return (
    <div className="space-y-3">
      <SectionLabel icon={LifeBuoy}>Support Tickets ({tickets.length})</SectionLabel>
      {tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No support tickets"
          description="This consumer has not raised any support tickets."
        />
      ) : (
        <ScrollTable>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Ticket ID</TableHead>
              <TableHead className="text-[11px]">Country</TableHead>
              <TableHead className="text-[11px]">Type</TableHead>
              <TableHead className="text-[11px]">Subject</TableHead>
              <TableHead className="text-[11px]">Priority</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px]">Created</TableHead>
              <TableHead className="text-[11px]">SLA</TableHead>
              <TableHead className="text-[11px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((t) => {
              const sla = slaLabel(t.slaDeadline);
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                    {t.id}
                  </TableCell>
                  <TableCell className="text-[11px]">{t.countryCode}</TableCell>
                  <TableCell className="text-[11px] capitalize">{t.type}</TableCell>
                  <TableCell className="text-[11px] max-w-[220px] truncate" title={t.subject}>
                    {t.subject}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px]", PRIORITY_STYLES[t.priority].className)}
                    >
                      {PRIORITY_STYLES[t.priority].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px]", TICKET_STATUS_STYLES[t.status].className)}
                    >
                      {TICKET_STATUS_STYLES[t.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {formatDateTime(t.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[10px]", sla.className)}>
                      {sla.label}
                    </Badge>
                  </TableCell>
                  <RowActionsCell>
                    <IconBtn
                      icon={ReplyIcon}
                      label="Reply"
                      tone="info"
                      onClick={() => toast.success(`Reply sent on ticket ${t.id}`)}
                    />
                    <IconBtn
                      icon={UserCheck}
                      label="Assign to me"
                      tone="success"
                      onClick={() =>
                        staff &&
                        update(
                          t,
                          {
                            assignedTo: `${staff.firstName} ${staff.lastName}`,
                            status: "in_progress",
                          },
                          "ticket.assign",
                          "Assigned to you",
                        )
                      }
                    />
                    <IconBtn
                      icon={XCircle}
                      label="Close"
                      tone="danger"
                      onClick={() => update(t, { status: "closed" }, "ticket.close", "Closed")}
                      disabled={t.status === "closed"}
                    />
                  </RowActionsCell>
                </TableRow>
              );
            })}
          </TableBody>
        </ScrollTable>
      )}
    </div>
  );
}

/* -------------------------------- Tab 8: Disputes ----------------------- */

function DisputesTab({
  disputes,
  staff,
  consumer,
}: {
  disputes: DisputeRecord[];
  staff: ReturnType<typeof useAuth>["staff"];
  consumer: Consumer;
}) {
  async function updateStatus(d: DisputeRecord, status: DisputeRecord["status"]) {
    if (!staff) return;
    await adminData.updateDispute(d.id, { status });
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
        reason: `Update dispute ${d.id} status to ${status} for ${consumer.consumerCode || "—"}`,
      },
    );
    toast.success(`Dispute ${d.id} status updated to ${DISPUTE_STATUS_STYLES[status].label}`);
  }

  return (
    <div className="space-y-3">
      <SectionLabel icon={Scale}>Disputes ({disputes.length})</SectionLabel>
      {disputes.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No disputes"
          description="No disputes have been raised against this consumer."
        />
      ) : (
        <ScrollTable>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Dispute ID</TableHead>
              <TableHead className="text-[11px]">Merchant</TableHead>
              <TableHead className="text-[11px] text-right">Amount</TableHead>
              <TableHead className="text-[11px]">Reason</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px]">Deadline</TableHead>
              <TableHead className="text-[11px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {disputes.map((d) => {
              const sla = slaLabel(d.deadline);
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                    {d.id}
                  </TableCell>
                  <TableCell className="text-[11px]">{d.merchantName}</TableCell>
                  <TableCell className="text-right text-[11px] tabular-nums font-medium">
                    {formatCurrency(d.amount, d.currency)}
                  </TableCell>
                  <TableCell className="text-[11px] max-w-[220px] truncate" title={d.reason}>
                    {d.reason}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px]", DISPUTE_STATUS_STYLES[d.status].className)}
                    >
                      {DISPUTE_STATUS_STYLES[d.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[10px]", sla.className)}>
                      {formatDateTime(d.deadline)}
                    </Badge>
                  </TableCell>
                  <RowActionsCell>
                    <IconBtn
                      icon={Eye}
                      label="View details"
                      onClick={() => toast.info(`Dispute ${d.id} • ${d.reason}`)}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Update status</DropdownMenuLabel>
                        {(
                          [
                            "new",
                            "awaiting_evidence",
                            "evidence_submitted",
                            "under_review",
                            "won",
                            "lost",
                            "expired",
                          ] as DisputeRecord["status"][]
                        ).map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() => updateStatus(d, s)}
                            disabled={d.status === s}
                          >
                            {DISPUTE_STATUS_STYLES[s].label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </RowActionsCell>
                </TableRow>
              );
            })}
          </TableBody>
        </ScrollTable>
      )}
    </div>
  );
}

/* ------------------------------- Tab 9: Risk & Alerts ------------------- */

function RiskTab({
  alerts,
  staff,
  consumer,
}: {
  alerts: FraudRecord[];
  staff: ReturnType<typeof useAuth>["staff"];
  consumer: Consumer;
}) {
  async function closeFalsePositive(f: FraudRecord) {
    if (!staff) return;
    await adminData.updateFraud(f.id, { status: "closed" });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "fraud.close",
      "fraud_alert",
      f.id,
      {
        countryCode: f.countryCode,
        beforeValue: f.status,
        afterValue: "closed",
        reason: `Close false-positive alert ${f.id} for ${consumer.consumerCode || "—"}`,
      },
    );
    toast.success(`Alert ${f.id} closed (false positive)`);
  }

  async function escalate(f: FraudRecord) {
    if (!staff) return;
    await adminData.updateFraud(f.id, { status: "escalated" });
    logAudit(
      {
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.departmentId,
        role: staff.roleId,
      },
      "fraud.escalate",
      "fraud_alert",
      f.id,
      {
        countryCode: f.countryCode,
        beforeValue: f.status,
        afterValue: "escalated",
        reason: `Escalate alert ${f.id} for ${consumer.consumerCode || "—"}`,
      },
    );
    toast.success(`Alert ${f.id} escalated`);
  }

  return (
    <div className="space-y-3">
      <SectionLabel icon={ShieldAlert}>Risk & Fraud Alerts ({alerts.length})</SectionLabel>
      {alerts.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No risk alerts"
          description="This consumer has no open risk or fraud alerts. Clean record."
        />
      ) : (
        <ScrollTable>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Alert ID</TableHead>
              <TableHead className="text-[11px]">Trigger</TableHead>
              <TableHead className="text-[11px]">Severity</TableHead>
              <TableHead className="text-[11px] text-right">Amount</TableHead>
              <TableHead className="text-[11px]">Device</TableHead>
              <TableHead className="text-[11px]">Created</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                  {f.id}
                </TableCell>
                <TableCell className="text-[11px] max-w-[200px] truncate" title={f.trigger}>
                  {f.trigger}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px]", SEVERITY_STYLES[f.severity].className)}
                  >
                    {SEVERITY_STYLES[f.severity].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-[11px] tabular-nums">
                  {formatCurrency(f.transactionAmount, "USD")}
                </TableCell>
                <TableCell className="text-[11px]">{f.device}</TableCell>
                <TableCell className="text-[11px] text-muted-foreground">
                  {formatDateTime(f.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px]", FRAUD_STATUS_STYLES[f.status].className)}
                  >
                    {FRAUD_STATUS_STYLES[f.status].label}
                  </Badge>
                </TableCell>
                <RowActionsCell>
                  <IconBtn
                    icon={CheckCircle2}
                    label="Close (false positive)"
                    tone="success"
                    onClick={() => closeFalsePositive(f)}
                    disabled={f.status === "closed"}
                  />
                  <IconBtn
                    icon={AlertTriangle}
                    label="Escalate"
                    tone="danger"
                    onClick={() => escalate(f)}
                    disabled={f.status === "escalated"}
                  />
                </RowActionsCell>
              </TableRow>
            ))}
          </TableBody>
        </ScrollTable>
      )}
    </div>
  );
}

/* ------------------------------ Tab 10: Activity & Audit ---------------- */

function AuditTab({ logs }: { logs: AuditRecord[] }) {
  return (
    <div className="space-y-3">
      <SectionLabel icon={Activity}>Activity & Audit Trail ({logs.length})</SectionLabel>
      {logs.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity recorded"
          description="No audit log entries reference this consumer yet."
        />
      ) : (
        <ScrollTable>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Timestamp</TableHead>
              <TableHead className="text-[11px]">Action</TableHead>
              <TableHead className="text-[11px]">Entity</TableHead>
              <TableHead className="text-[11px]">Reason</TableHead>
              <TableHead className="text-[11px]">IP</TableHead>
              <TableHead className="text-[11px]">Actor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs
              .slice()
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDateTime(l.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
                    >
                      {l.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px]">
                    <span className="font-mono text-[10px]">
                      {l.entityType}:{l.entityId}
                    </span>
                  </TableCell>
                  <TableCell className="text-[11px] max-w-[240px] truncate" title={l.reason ?? ""}>
                    {l.reason ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground">
                    {l.ipAddress}
                  </TableCell>
                  <TableCell className="text-[11px]">{l.staffName}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </ScrollTable>
      )}
      <p className="text-[10px] text-muted-foreground px-1">
        <Lock className="inline size-3 mr-1" />
        Audit logs are immutable — entries cannot be edited or deleted.
      </p>
    </div>
  );
}

/* ------------------------------ Tab 11: Orders ----------------------------- */
//
// Stock orders placed by this consumer from the Faya Pay app. When a consumer
// pays for a physical card, the order shows up here in real time, the stock
// item is allocated to them on the Stock page, and the admin fulfils it
// (mark shipped → delivered).

function OrdersTab({
  orders,
  staff,
  consumer,
}: {
  orders: StockOrder[];
  staff: ReturnType<typeof useAuth>["staff"];
  consumer: Consumer;
}) {
  function actor() {
    if (!staff) return null;
    return {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      department: staff.departmentId,
      role: staff.roleId,
    };
  }

  function markShipped(order: StockOrder) {
    const a = actor();
    if (!a) return;
    adminData.updateStockOrder(order.id, {
      status: "shipped",
      updatedAt: Date.now(),
    });
    if (order.stockItemId) {
      adminData.updateStockItem(order.stockItemId, {
        status: "shipped",
        shippedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    logAudit(a, "stock_order.ship", "stock_order", order.id, {
      countryCode: order.countryCode,
      beforeValue: order.status,
      afterValue: "shipped",
      reason: `Ship order ${order.orderCode} for ${consumer.consumerCode || "—"}`,
    });
    toast.success(`Order shipped: ${order.orderCode}`, {
      description: `${order.model} · ${order.userName}`,
    });
  }

  function markDelivered(order: StockOrder) {
    const a = actor();
    if (!a) return;
    adminData.updateStockOrder(order.id, {
      status: "delivered",
      updatedAt: Date.now(),
    });
    if (order.stockItemId) {
      adminData.updateStockItem(order.stockItemId, {
        status: "delivered",
        deliveredAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    logAudit(a, "stock_order.deliver", "stock_order", order.id, {
      countryCode: order.countryCode,
      beforeValue: order.status,
      afterValue: "delivered",
      reason: `Deliver order ${order.orderCode} for ${consumer.consumerCode || "—"}`,
    });
    toast.success(`Order delivered: ${order.orderCode}`, {
      description: `${order.model} · ${order.userName}`,
    });
  }

  function cancelOrder(order: StockOrder) {
    const a = actor();
    if (!a) return;
    adminData.updateStockOrder(order.id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
    if (order.stockItemId) {
      adminData.updateStockItem(order.stockItemId, {
        status: "in_stock",
        allocatedToId: null,
        allocatedToName: null,
        allocatedAt: null,
        shippedAt: null,
        deliveredAt: null,
        updatedAt: Date.now(),
      });
    }
    logAudit(a, "stock_order.cancel", "stock_order", order.id, {
      countryCode: order.countryCode,
      beforeValue: order.status,
      afterValue: "cancelled",
      reason: `Cancel order ${order.orderCode} for ${consumer.consumerCode || "—"}`,
    });
    toast.success(`Order cancelled: ${order.orderCode}`, {
      description: "Stock item returned to inventory.",
    });
  }

  const sortedOrders = orders.slice().sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel icon={ShoppingCart}>
          Physical Card Orders ({orders.length})
        </SectionLabel>
        <Badge
          variant="outline"
          className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
        >
          <Package className="size-3 mr-1" /> From Faya Pay app
        </Badge>
      </div>

      {/* Emerald info banner */}
      <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20 p-3 flex items-start gap-2 text-xs">
        <Info className="size-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
        <div className="text-emerald-900 dark:text-emerald-200 leading-relaxed">
          When this consumer orders and pays for a physical card from the{" "}
          <span className="font-medium">Faya Pay app</span>, the order appears
          here automatically and the card is allocated from stock. Fulfil by
          marking it shipped → delivered.
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders yet"
          description="No orders yet. When this consumer orders a physical card from the Faya Pay app, it will appear here."
        />
      ) : (
        <ScrollTable>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="text-[11px] pl-3">Order Code</TableHead>
              <TableHead className="text-[11px]">Item</TableHead>
              <TableHead className="text-[11px] text-right">Unit Price</TableHead>
              <TableHead className="text-[11px] text-right">Delivery Fee</TableHead>
              <TableHead className="text-[11px] text-right">Total</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px] hidden lg:table-cell">Delivery Address</TableHead>
              <TableHead className="text-[11px] hidden md:table-cell">Ordered</TableHead>
              <TableHead className="text-[11px] text-right pr-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedOrders.map((o) => {
              const statusStyle = STOCK_ORDER_STATUS_STYLES[o.status];
              const typeMeta = STOCK_TYPE_META[o.itemType];
              const TypeIcon = typeMeta.icon;
              return (
                <TableRow key={o.id}>
                  <TableCell className="pl-3 font-mono text-[10px] text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    {o.orderCode}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-medium inline-flex items-center gap-1">
                        <TypeIcon className="size-3 text-emerald-600" />
                        {o.model}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] w-fit mt-0.5",
                          o.itemType === "physical_terminal"
                            ? "text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                            : "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
                        )}
                      >
                        {typeMeta.label}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-[11px] font-mono">
                    {formatCurrency(o.unitPrice, o.currency)}
                  </TableCell>
                  <TableCell className="text-right text-[11px] font-mono text-muted-foreground">
                    {formatCurrency(o.deliveryFee, o.currency)}
                  </TableCell>
                  <TableCell className="text-right text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(o.totalAmount, o.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px]", statusStyle.className)}
                    >
                      {statusStyle.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell max-w-[200px] text-[11px] text-muted-foreground line-clamp-2">
                    {o.deliveryAddress || "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDateTime(o.createdAt)}
                  </TableCell>
                  <RowActionsCell>
                    <IconBtn
                      icon={Eye}
                      label="View details"
                      onClick={() =>
                        toast.info(`Order ${o.orderCode}`, {
                          description: `${o.model} · ${formatCurrency(o.totalAmount, o.currency)} · ${o.deliveryAddress || "no address"}`,
                        })
                      }
                    />
                    {o.status === "pending" && (
                      <IconBtn
                        icon={Truck}
                        label="Mark shipped"
                        tone="info"
                        onClick={() => markShipped(o)}
                      />
                    )}
                    {o.status === "shipped" && (
                      <IconBtn
                        icon={CheckCircle2}
                        label="Mark delivered"
                        tone="success"
                        onClick={() => markDelivered(o)}
                      />
                    )}
                    {(o.status === "pending" || o.status === "fulfilled") && (
                      <IconBtn
                        icon={Ban}
                        label="Cancel order"
                        tone="danger"
                        onClick={() => cancelOrder(o)}
                      />
                    )}
                  </RowActionsCell>
                </TableRow>
              );
            })}
          </TableBody>
        </ScrollTable>
      )}
    </div>
  );
}

/* ------------------------------- Utilities ------------------------------ */

// Local Reply icon (lucide has `Reply` but keep this self-contained to match
// the rest of the portal's icon usage pattern).
function ReplyIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function slaLabel(deadline: number): { label: string; className: string } {
  const diff = deadline - Date.now();
  if (diff < 0)
    return {
      label: "SLA breached",
      className: "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400",
    };
  if (diff < 4 * 60 * 60 * 1000)
    return {
      label: "SLA at risk",
      className: "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400",
    };
  const hr = Math.floor(diff / (60 * 60 * 1000));
  if (hr < 24)
    return {
      label: `${hr}h left`,
      className: "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300",
    };
  return {
    label: `${Math.floor(hr / 24)}d left`,
    className: "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300",
  };
}
