"use client";

/**
 * Faya Admin Portal — Merchants View (Comprehensive Merchant Profile)
 *
 * Goal: EVERYTHING connected to a merchant lives under their profile.
 *   - Main list (filtered by staff scope) → opens detail Sheet on row click.
 *   - Detail Sheet (sm:max-w-4xl) renders a sticky Profile Summary Header
 *     (business name, merchant code, country, KYB / status / risk badges, plus
 *     quick-stat chips for POS staff, terminals, phone POS, monthly volume,
 *     open disputes, open tickets) above 12 tabs:
 *         1. Overview         7. Disputes
 *         2. POS Staff        8. Documents
 *         3. Terminals        9. KYB Cases
 *         4. POS Requests    10. Support Tickets
 *         5. Transactions    11. Risk & Alerts
 *         6. Settlements     12. Activity & Audit
 *
 * Each tab shows a count badge in its label, an EmptyState if 0 items,
 * and a max-h-60 scrollable table with a sticky header.
 *
 * Country scoping: `getVisibleMerchants(staff, countries, merchants)` resolves
 * the staff member's country/region access ladder (own → branch → country →
 * region → global). Super Admin sees all.
 *
 * POS Device Request approval rule (per spec):
 *   - canBeApproved = NFC || cardReader || swipe
 *   - If false → Approve button is disabled AND an "Auto-decline" action is
 *     offered which sets status to "auto_declined".
 *   - Amber warnings surface for failed device integrity or no screen lock.
 *
 * Audit action keys emitted via `logAudit`:
 *   merchant.approve_kyb / merchant.reject_kyb / merchant.restrict /
 *   merchant.suspend / merchant.reactivate /
 *   pos_staff.suspend / pos_staff.reactivate / pos_staff.reset_pin /
 *   pos_staff.force_logout /
 *   terminal.activate / terminal.block /
 *   pos_device.approve / pos_device.decline / pos_device.auto_decline /
 *   settlement.retry /
 *   dispute.request_evidence / dispute.update_status /
 *   document.approve / document.reject / document.request_replacement /
 *   kyb.approve / kyb.reject / kyb.escalate /
 *   ticket.reply / ticket.assign / ticket.close /
 *   transaction.escalate.
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
  Cpu,
  MonitorSmartphone,
  RefreshCw,
  Lock as LockIcon,
  FileText,
  FolderOpen,
  MessageSquare,
  Activity,
  Database,
  Coins,
  Banknote,
  Briefcase,
  Mail,
  Phone,
  MapPin,
  User,
  Globe2,
  ChevronRight,
  Send,
  ArrowRightCircle,
  Zap,
  BadgeCheck,
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
import { Separator } from "@/components/ui/separator";
import {
  Table,
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
  formatDate,
  formatNumber,
  timeAgo,
  slaStatus,
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
  Transaction,
  UserDocument,
  KybCase,
  SupportTicket,
  FraudAlert,
  AuditLog,
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
  onboarding: { label: "Onboarding", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  restricted: { label: "Restricted", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  closed: { label: "Closed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
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

const TICKET_STATUS_STYLES: Record<
  SupportTicket["status"],
  { label: string; className: string }
> = {
  open: { label: "Open", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  in_progress: { label: "In Progress", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  waiting: { label: "Waiting", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  resolved: { label: "Resolved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  closed: { label: "Closed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const TICKET_PRIORITY_STYLES: Record<
  SupportTicket["priority"],
  { label: string; className: string }
> = {
  low: { label: "Low", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  medium: { label: "Medium", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  high: { label: "High", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const FRAUD_STATUS_STYLES: Record<
  FraudAlert["status"],
  { label: string; className: string }
> = {
  open: { label: "Open", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  investigating: { label: "Investigating", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  closed: { label: "Closed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  escalated: { label: "Escalated", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const DOCUMENT_STATUS_STYLES: Record<
  UserDocument["status"],
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  expired: { label: "Expired", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  replacement_requested: { label: "Replacement Requested", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
};

const TXN_STATUS_STYLES: Record<
  Transaction["status"],
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  authorized: { label: "Authorized", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  successful: { label: "Successful", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  reversed: { label: "Reversed", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  refunded: { label: "Refunded", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  held: { label: "Held", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
};

const RISK_TONE = (level: RiskLevel) => statusBadge("risk", level);

/* ------------------------------ Small UI helpers ------------------------- */

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

function MiniStat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "info" | "warning" | "danger";
}) {
  const toneClass = {
    default: "text-slate-900 dark:text-slate-100",
    success: "text-emerald-700 dark:text-emerald-400",
    info: "text-sky-700 dark:text-sky-400",
    warning: "text-amber-700 dark:text-amber-400",
    danger: "text-red-700 dark:text-red-400",
  }[tone];
  return (
    <div className="rounded-md border bg-card p-2.5 flex flex-col gap-0.5 min-w-0">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="size-3 text-emerald-600" />}
        {label}
      </div>
      <div className={cn("text-sm font-semibold tabular-nums truncate", toneClass)}>
        {value}
      </div>
      {hint && <div className="text-[9px] text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}

function ScrollTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-h-60 overflow-auto rounded-md border bg-card">
      <Table>{children}</Table>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-right truncate max-w-[60%]">{value}</span>
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
    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
      <Icon className="size-3.5 text-emerald-600" />
      {children}
    </div>
  );
}

function CapabilityBadge({ label, supported }: { label: string; supported: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[9px] gap-0.5 px-1.5",
        supported
          ? "text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
          : "text-red-700 border-red-300 bg-red-50 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
      )}
    >
      {supported ? <CheckCircle2 className="size-2.5" /> : <XCircle className="size-2.5" />}
      {label}
    </Badge>
  );
}

function TabEmptyState({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <EmptyState
      icon={Icon}
      title={`No ${label} for this merchant`}
      description="Items linked to this merchant will appear here when available."
    />
  );
}

function SlaPill({ deadline }: { deadline: number }) {
  const s = slaStatus(deadline);
  const cls =
    s.variant === "danger"
      ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
      : s.variant === "warning"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <Badge variant="secondary" className={cn("text-[10px]", cls)}>
      {s.label}
    </Badge>
  );
}

/** Match a name against the merchant's legal/trading names. */
function nameMatchesMerchant(
  name: string | null | undefined,
  merchant: Merchant,
): boolean {
  if (!name) return false;
  return (
    name === merchant.legalName ||
    name === merchant.tradingName
  );
}

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
      after = "approved / active";
    } else if (action === "reject_kyb") {
      patch = { kybStatus: "rejected", status: "restricted", updatedAt: Date.now() };
      after = "rejected / restricted";
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
    toast.success(`${action.replace(/_/g, " ")} — ${merchant.tradingName}`, {
      description: `${merchant.merchantCode} · ${before} → ${after}`,
    });
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
      return `Approving KYB for ${merchant.tradingName} sets the merchant to KYB approved + status active. Recorded in the audit log.`;
    }
    if (action === "reject_kyb") {
      return `Rejecting KYB for ${merchant.tradingName} sets the merchant to KYB rejected + status restricted. Recorded in the audit log.`;
    }
    const newStatus =
      action === "restrict" ? "restricted" : action === "suspend" ? "suspended" : "active";
    return `You are about to set ${merchant.tradingName} (${merchant.merchantCode}) to status "${newStatus}". Recorded in the audit log.`;
  }

  return (
    <>
      <ViewHeader
        title="Merchants"
        description="Comprehensive merchant profiles — every POS staff, terminal, transaction, settlement, dispute, document, KYB case, ticket, alert, and audit log under one view."
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
              <div className="max-h-[60vh] overflow-auto">
                <Table>
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
                      <TableHead className="text-right hidden lg:table-cell">Phone POS</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Monthly Vol</TableHead>
                      <TableHead className="text-right pr-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((m) => (
                      <TableRow
                        key={m.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedMerchant(m)}
                      >
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
                          {formatNumber(m.terminalCount)}
                        </TableCell>
                        <TableCell className="text-right hidden lg:table-cell tabular-nums text-xs">
                          {formatNumber(m.phonePosCount)}
                        </TableCell>
                        <TableCell className="text-right hidden lg:table-cell font-mono text-xs tabular-nums">
                          {formatCurrency(m.monthlyVolume, m.settlementCurrency)}
                        </TableCell>
                        <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
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
                                  onClick={() => setConfirmAction({ merchant: m, action: "approve_kyb" })}
                                >
                                  <CheckCircle2 className="size-4 mr-2 text-emerald-600" /> Approve KYB
                                </DropdownMenuItem>
                              )}
                              {(m.kybStatus === "pending" ||
                                m.kybStatus === "in_review" ||
                                m.kybStatus === "escalated") && (
                                <DropdownMenuItem
                                  onClick={() => setConfirmAction({ merchant: m, action: "reject_kyb" })}
                                >
                                  <XCircle className="size-4 mr-2 text-red-600" /> Reject KYB
                                </DropdownMenuItem>
                              )}
                              {m.status !== "restricted" &&
                                m.status !== "suspended" &&
                                m.status !== "closed" && (
                                  <DropdownMenuItem
                                    onClick={() => setConfirmAction({ merchant: m, action: "restrict" })}
                                  >
                                    <Ban className="size-4 mr-2 text-orange-600" /> Restrict
                                  </DropdownMenuItem>
                                )}
                              {m.status !== "suspended" && m.status !== "closed" && (
                                <DropdownMenuItem
                                  onClick={() => setConfirmAction({ merchant: m, action: "suspend" })}
                                >
                                  <Pause className="size-4 mr-2 text-red-600" /> Suspend
                                </DropdownMenuItem>
                              )}
                              {(m.status === "restricted" || m.status === "suspended") && (
                                <DropdownMenuItem
                                  onClick={() => setConfirmAction({ merchant: m, action: "reactivate" })}
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
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </ViewContainer>

      {/* --------------------- Merchant profile sheet (12 tabs) -------------------- */}
      <Sheet
        open={!!selectedMerchant}
        onOpenChange={(o) => !o && setSelectedMerchant(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-4xl flex flex-col p-0 overflow-y-auto"
        >
          {selectedMerchant && (
            <MerchantProfileSheet
              key={selectedMerchant.id}
              merchant={selectedMerchant}
              countryName={countryName}
              merchantStatusBadge={merchantStatusBadge}
              kybBadge={kybBadge}
              riskBadge={riskBadge}
              onMerchantAction={(action) =>
                setConfirmAction({ merchant: selectedMerchant, action })
              }
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

/* ====================== Merchant Profile Sheet (12 tabs) ====================== */

type MerchantAction =
  | "restrict"
  | "suspend"
  | "reactivate"
  | "approve_kyb"
  | "reject_kyb";

function MerchantProfileSheet({
  merchant,
  countryName,
  merchantStatusBadge,
  kybBadge,
  riskBadge,
  onMerchantAction,
  onClose,
}: {
  merchant: Merchant;
  countryName: (code: string) => string;
  merchantStatusBadge: (s: MerchantStatus) => React.ReactNode;
  kybBadge: (s: KybStatus) => React.ReactNode;
  riskBadge: (level: RiskLevel) => React.ReactNode;
  onMerchantAction: (action: MerchantAction) => void;
  onClose: () => void;
}) {
  const { staff } = useAuth();
  const [tab, setTab] = useState("overview");

  /* ---------- Live subscriptions (one per collection) ---------- */
  const [posStaff, setPosStaff] = useState<PosStaff[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [posRequests, setPosRequests] = useState<PosDeviceRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [kybCases, setKybCases] = useState<KybCase[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Note: this component is keyed by merchant.id in the parent, so a fresh
  // mount happens every time a different merchant is opened — which naturally
  // resets `tab` back to "overview" via the useState initializer above.

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    try {
      unsubs.push(adminData.subscribePosStaff(setPosStaff));
      unsubs.push(adminData.subscribeTerminals(setTerminals));
      unsubs.push(adminData.subscribePosDeviceRequests(setPosRequests));
      unsubs.push(adminData.subscribeTransactions(setTransactions));
      unsubs.push(adminData.subscribeSettlements(setSettlements));
      unsubs.push(adminData.subscribeDisputes(setDisputes));
      unsubs.push(adminData.subscribeDocuments(setDocuments));
      unsubs.push(adminData.subscribeKyb(setKybCases));
      unsubs.push(adminData.subscribeTickets(setTickets));
      unsubs.push(adminData.subscribeFraud(setFraudAlerts));
      unsubs.push(adminData.subscribeAudit(setAuditLogs));
    } catch (e) {
      console.error("[MerchantProfileSheet] subscription error:", e);
    }
    return () => unsubs.forEach((u) => u && u());
  }, []);

  /* ---------- Filter each collection to this merchant ---------- */
  const merchantPosStaff = useMemo(
    () => posStaff.filter((s) => s.merchantId === merchant.id),
    [posStaff, merchant.id],
  );

  const merchantTerminals = useMemo(
    () => terminals.filter((t) => nameMatchesMerchant(t.merchantName, merchant)),
    [terminals, merchant],
  );

  const merchantPosRequests = useMemo(
    () => posRequests.filter((r) => r.merchantId === merchant.id),
    [posRequests, merchant.id],
  );

  const merchantTransactions = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.merchantId === merchant.id ||
          nameMatchesMerchant(t.merchantName, merchant),
      ),
    [transactions, merchant],
  );

  const merchantSettlements = useMemo(
    () => settlements.filter((s) => nameMatchesMerchant(s.merchantName, merchant)),
    [settlements, merchant],
  );

  const merchantDisputes = useMemo(
    () => disputes.filter((d) => nameMatchesMerchant(d.merchantName, merchant)),
    [disputes, merchant],
  );

  const merchantDocuments = useMemo(
    () => documents.filter((d) => d.entityId === merchant.id),
    [documents, merchant.id],
  );

  const merchantKybCases = useMemo(
    () =>
      kybCases.filter(
        (k) =>
          k.id === merchant.kybCaseId ||
          nameMatchesMerchant(k.merchantName, merchant),
      ),
    [kybCases, merchant],
  );

  const merchantTickets = useMemo(
    () => tickets.filter((t) => nameMatchesMerchant(t.requesterName, merchant)),
    [tickets, merchant],
  );

  const merchantFraudAlerts = useMemo(
    () => fraudAlerts.filter((a) => nameMatchesMerchant(a.entityName, merchant)),
    [fraudAlerts, merchant],
  );

  const merchantAuditLogs = useMemo(
    () => auditLogs.filter((a) => a.entityId === merchant.id),
    [auditLogs, merchant.id],
  );

  /* ---------- Header quick stats ---------- */
  const openDisputes = merchantDisputes.filter(
    (d) => d.status !== "won" && d.status !== "lost" && d.status !== "expired",
  ).length;
  const openTickets = merchantTickets.filter(
    (t) => t.status !== "resolved" && t.status !== "closed",
  ).length;

  const activeTerminals = merchantTerminals.filter((t) => t.status === "active").length;
  const phonePosCount = merchantTerminals.filter((t) => t.type === "phone_pos").length;

  return (
    <>
      <SheetHeader className="px-4 sm:px-6 pt-5 pb-3 border-b bg-gradient-to-b from-emerald-50/60 to-transparent dark:from-emerald-900/10">
        <div className="flex items-start justify-between gap-3 pr-6">
          <div className="min-w-0">
            <SheetTitle className="text-lg flex items-center gap-2">
              <Building2 className="size-5 text-emerald-600 shrink-0" />
              <span className="truncate">{merchant.tradingName}</span>
            </SheetTitle>
            <SheetDescription className="text-xs mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono">{merchant.merchantCode}</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="inline-flex items-center gap-1">
                <Globe2 className="size-3" />
                {merchant.countryCode} — {countryName(merchant.countryCode)}
              </span>
            </SheetDescription>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {kybBadge(merchant.kybStatus)}
              {merchantStatusBadge(merchant.status)}
              {riskBadge(merchant.riskCategory)}
              {merchant.platforms.map((p) => (
                <Badge
                  key={p}
                  variant="outline"
                  className="text-[9px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                >
                  {PLATFORM_LABELS[p].label}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
                  Actions <ChevronRight className="size-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs">Merchant actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(merchant.kybStatus === "pending" ||
                  merchant.kybStatus === "in_review" ||
                  merchant.kybStatus === "escalated") && (
                  <DropdownMenuItem onClick={() => onMerchantAction("approve_kyb")}>
                    <CheckCircle2 className="size-4 mr-2 text-emerald-600" /> Approve KYB
                  </DropdownMenuItem>
                )}
                {(merchant.kybStatus === "pending" ||
                  merchant.kybStatus === "in_review" ||
                  merchant.kybStatus === "escalated") && (
                  <DropdownMenuItem onClick={() => onMerchantAction("reject_kyb")}>
                    <XCircle className="size-4 mr-2 text-red-600" /> Reject KYB
                  </DropdownMenuItem>
                )}
                {merchant.status !== "restricted" &&
                  merchant.status !== "suspended" &&
                  merchant.status !== "closed" && (
                    <DropdownMenuItem onClick={() => onMerchantAction("restrict")}>
                      <Ban className="size-4 mr-2 text-orange-600" /> Restrict
                    </DropdownMenuItem>
                  )}
                {merchant.status !== "suspended" && merchant.status !== "closed" && (
                  <DropdownMenuItem onClick={() => onMerchantAction("suspend")}>
                    <Pause className="size-4 mr-2 text-red-600" /> Suspend
                  </DropdownMenuItem>
                )}
                {(merchant.status === "restricted" || merchant.status === "suspended") && (
                  <DropdownMenuItem onClick={() => onMerchantAction("reactivate")}>
                    <RotateCcw className="size-4 mr-2 text-emerald-600" /> Reactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
          <MiniStat
            label="POS Staff"
            value={formatNumber(merchantPosStaff.length)}
            icon={UsersIcon}
            tone="default"
          />
          <MiniStat
            label="Terminals"
            value={formatNumber(activeTerminals)}
            hint={`${merchantTerminals.length} total`}
            icon={CreditCard}
            tone={activeTerminals > 0 ? "success" : "default"}
          />
          <MiniStat
            label="Phone POS"
            value={formatNumber(phonePosCount)}
            icon={Smartphone}
            tone="info"
          />
          <MiniStat
            label="Monthly Vol"
            value={formatCurrency(merchant.monthlyVolume, merchant.settlementCurrency)}
            icon={Coins}
            tone="default"
          />
          <MiniStat
            label="Open Disputes"
            value={formatNumber(openDisputes)}
            icon={Scale}
            tone={openDisputes > 0 ? "warning" : "default"}
          />
          <MiniStat
            label="Open Tickets"
            value={formatNumber(openTickets)}
            icon={MessageSquare}
            tone={openTickets > 0 ? "warning" : "default"}
          />
        </div>
      </SheetHeader>

      {/* Tabs */}
      <div className="px-4 sm:px-6 py-3 flex-1 min-h-0">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0 justify-start mb-3">
            <TabsTrigger value="overview" className="text-[11px] h-8">
              Overview
            </TabsTrigger>
            <TabsTrigger value="pos_staff" className="text-[11px] h-8">
              POS Staff <CountBadge n={merchantPosStaff.length} />
            </TabsTrigger>
            <TabsTrigger value="terminals" className="text-[11px] h-8">
              Terminals <CountBadge n={merchantTerminals.length} />
            </TabsTrigger>
            <TabsTrigger value="pos_requests" className="text-[11px] h-8">
              POS Requests <CountBadge n={merchantPosRequests.length} />
            </TabsTrigger>
            <TabsTrigger value="transactions" className="text-[11px] h-8">
              Transactions <CountBadge n={merchantTransactions.length} />
            </TabsTrigger>
            <TabsTrigger value="settlements" className="text-[11px] h-8">
              Settlements <CountBadge n={merchantSettlements.length} />
            </TabsTrigger>
            <TabsTrigger value="disputes" className="text-[11px] h-8">
              Disputes <CountBadge n={merchantDisputes.length} />
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-[11px] h-8">
              Documents <CountBadge n={merchantDocuments.length} />
            </TabsTrigger>
            <TabsTrigger value="kyb_cases" className="text-[11px] h-8">
              KYB Cases <CountBadge n={merchantKybCases.length} />
            </TabsTrigger>
            <TabsTrigger value="tickets" className="text-[11px] h-8">
              Tickets <CountBadge n={merchantTickets.length} />
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-[11px] h-8">
              Risk & Alerts <CountBadge n={merchantFraudAlerts.length} />
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-[11px] h-8">
              Activity & Audit <CountBadge n={merchantAuditLogs.length} />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <OverviewTab merchant={merchant} countryName={countryName} kybCases={merchantKybCases} />
          </TabsContent>
          <TabsContent value="pos_staff" className="mt-0">
            <PosStaffTab items={merchantPosStaff} />
          </TabsContent>
          <TabsContent value="terminals" className="mt-0">
            <TerminalsTab items={merchantTerminals} />
          </TabsContent>
          <TabsContent value="pos_requests" className="mt-0">
            <PosRequestsTab items={merchantPosRequests} />
          </TabsContent>
          <TabsContent value="transactions" className="mt-0">
            <TransactionsTab items={merchantTransactions} merchant={merchant} />
          </TabsContent>
          <TabsContent value="settlements" className="mt-0">
            <SettlementsTab items={merchantSettlements} />
          </TabsContent>
          <TabsContent value="disputes" className="mt-0">
            <DisputesTab items={merchantDisputes} />
          </TabsContent>
          <TabsContent value="documents" className="mt-0">
            <DocumentsTab items={merchantDocuments} />
          </TabsContent>
          <TabsContent value="kyb_cases" className="mt-0">
            <KybCasesTab items={merchantKybCases} merchant={merchant} />
          </TabsContent>
          <TabsContent value="tickets" className="mt-0">
            <SupportTicketsTab items={merchantTickets} />
          </TabsContent>
          <TabsContent value="alerts" className="mt-0">
            <RiskAlertsTab items={merchantFraudAlerts} />
          </TabsContent>
          <TabsContent value="audit" className="mt-0">
            <AuditLogsTab items={merchantAuditLogs} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Hidden close handler — sheet's X is auto-rendered by SheetContent */}
      <span className="sr-only">
        <button onClick={onClose}>Close</button>
      </span>
    </>
  );
}

/* ============================ TAB: Overview ============================ */

function OverviewTab({
  merchant,
  countryName,
  kybCases,
}: {
  merchant: Merchant;
  countryName: (code: string) => string;
  kybCases: KybCase[];
}) {
  const primaryKyb = kybCases[0];
  return (
    <div className="space-y-4">
      {/* Business profile */}
      <Card>
        <CardHeader className="pb-2">
          <SectionLabel icon={Briefcase}>Business profile</SectionLabel>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            <DetailRow label="Legal name" value={merchant.legalName} />
            <DetailRow label="Trading name" value={merchant.tradingName} />
            <DetailRow label="Merchant code" value={<span className="font-mono">{merchant.merchantCode}</span>} />
            <DetailRow label="Business type" value={<span className="capitalize">{merchant.businessType.replace(/_/g, " ")}</span>} />
            <DetailRow label="Industry" value={merchant.industry} />
            <DetailRow label="Country" value={`${merchant.countryCode} — ${countryName(merchant.countryCode)}`} />
            <DetailRow label="Address" value={`${merchant.address}, ${merchant.city}`} />
            <DetailRow label="Contact email" value={merchant.contactEmail} />
            <DetailRow label="Contact phone" value={merchant.contactPhone} />
          </div>
        </CardContent>
      </Card>

      {/* Owner details */}
      <Card>
        <CardHeader className="pb-2">
          <SectionLabel icon={User}>Owner details</SectionLabel>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            <DetailRow label="Owner name" value={merchant.ownerName} />
            <DetailRow label="Owner email" value={merchant.ownerEmail} />
            <DetailRow label="Owner phone" value={merchant.ownerPhone} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* KYB summary */}
        <Card>
          <CardHeader className="pb-2">
            <SectionLabel icon={ShieldCheck}>KYB summary</SectionLabel>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              <DetailRow label="KYB status" value={<span className="capitalize">{merchant.kybStatus.replace(/_/g, " ")}</span>} />
              <DetailRow label="Risk category" value={<span className="capitalize">{merchant.riskCategory}</span>} />
              <DetailRow label="KYB case ID" value={merchant.kybCaseId ?? "—"} />
              {primaryKyb && (
                <>
                  <DetailRow label="Reviewer" value={primaryKyb.assignedReviewer ?? "Unassigned"} />
                  <DetailRow
                    label="SLA deadline"
                    value={formatDate(primaryKyb.slaDeadline)}
                  />
                  <DetailRow
                    label="Missing docs"
                    value={
                      primaryKyb.missingDocuments.length > 0
                        ? primaryKyb.missingDocuments.join(", ")
                        : "None"
                    }
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Platforms */}
        <Card>
          <CardHeader className="pb-2">
            <SectionLabel icon={MonitorSmartphone}>Platforms</SectionLabel>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-3 space-y-1.5">
              {merchant.platforms.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No platforms enabled.</p>
              ) : (
                merchant.platforms.map((p) => (
                  <div
                    key={p}
                    className="flex items-start gap-2 text-xs p-2 rounded-md bg-emerald-50/50 dark:bg-emerald-900/10"
                  >
                    <BadgeCheck className="size-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium">{PLATFORM_LABELS[p].label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {PLATFORM_LABELS[p].description}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Terminal / Txn stats */}
        <Card>
          <CardHeader className="pb-2">
            <SectionLabel icon={Database}>Terminal & transaction stats</SectionLabel>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              <DetailRow label="Terminals (active)" value={formatNumber(merchant.terminalCount)} />
              <DetailRow label="Phone POS" value={formatNumber(merchant.phonePosCount)} />
              <DetailRow label="Transaction count" value={formatNumber(merchant.transactionCount)} />
              <DetailRow label="Lifetime volume" value={formatCurrency(merchant.lifetimeVolume, merchant.settlementCurrency)} />
              <DetailRow label="Monthly volume" value={formatCurrency(merchant.monthlyVolume, merchant.settlementCurrency)} />
              <DetailRow label="Chargeback rate" value={`${merchant.chargebackRate.toFixed(2)}%`} />
            </div>
          </CardContent>
        </Card>

        {/* Settlement info */}
        <Card>
          <CardHeader className="pb-2">
            <SectionLabel icon={Banknote}>Settlement info</SectionLabel>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              <DetailRow label="Settlement currency" value={merchant.settlementCurrency} />
              <DetailRow label="Created" value={formatDateTime(merchant.createdAt)} />
              <DetailRow label="Last updated" value={formatDateTime(merchant.updatedAt)} />
              <DetailRow label="Notes" value={merchant.notes || "—"} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ============================ TAB: POS Staff ============================ */

function PosStaffTab({ items }: { items: PosStaff[] }) {
  const { staff } = useAuth();
  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);

  function actor() {
    if (!staff) return null;
    return {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      department: staff.departmentId,
      role: staff.roleId,
    };
  }

  function suspend(s: PosStaff) {
    const a = actor();
    if (!a) return;
    adminData.updatePosStaff(s.id, { status: "suspended", updatedAt: Date.now() });
    logAudit(a, "pos_staff.suspend", "pos_staff", s.id, {
      countryCode: s.countryCode,
      beforeValue: s.status,
      afterValue: "suspended",
    });
    toast.success(`Suspended POS staff: ${s.firstName} ${s.lastName}`, {
      description: `${s.staffCode} · ${s.branchName}`,
    });
    setDropdownOpenId(null);
  }

  function reactivate(s: PosStaff) {
    const a = actor();
    if (!a) return;
    adminData.updatePosStaff(s.id, { status: "active", updatedAt: Date.now() });
    logAudit(a, "pos_staff.reactivate", "pos_staff", s.id, {
      countryCode: s.countryCode,
      beforeValue: s.status,
      afterValue: "active",
    });
    toast.success(`Reactivated POS staff: ${s.firstName} ${s.lastName}`, {
      description: `${s.staffCode} · ${s.branchName}`,
    });
    setDropdownOpenId(null);
  }

  function resetPin(s: PosStaff) {
    const a = actor();
    if (!a) return;
    logAudit(a, "pos_staff.reset_pin", "pos_staff", s.id, {
      countryCode: s.countryCode,
      reason: `PIN reset requested for ${s.staffCode}`,
    });
    toast.success(`PIN reset email sent: ${s.firstName} ${s.lastName}`, {
      description: `${s.staffCode} · they will set a new PIN on next POS app login`,
    });
    setDropdownOpenId(null);
  }

  function forceLogout(s: PosStaff) {
    const a = actor();
    if (!a) return;
    logAudit(a, "pos_staff.force_logout", "pos_staff", s.id, {
      countryCode: s.countryCode,
      reason: `Force logout for ${s.staffCode}`,
    });
    toast.success(`Force logout issued: ${s.firstName} ${s.lastName}`, {
      description: `${s.staffCode} · their POS session will be terminated on next sync`,
    });
    setDropdownOpenId(null);
  }

  if (items.length === 0) return <TabEmptyState icon={UsersIcon} label="POS staff" />;

  return (
    <ScrollTable>
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow>
          <TableHead className="pl-3">Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="hidden md:table-cell">Role</TableHead>
          <TableHead className="hidden md:table-cell">Branch</TableHead>
          <TableHead className="hidden lg:table-cell">Device</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Last Login</TableHead>
          <TableHead className="text-right">Txns Today</TableHead>
          <TableHead className="text-right pr-3">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((s) => {
          const style = POS_STAFF_STATUS_STYLES[s.status];
          return (
            <TableRow key={s.id}>
              <TableCell className="pl-3 font-mono text-[11px]">{s.staffCode}</TableCell>
              <TableCell>
                <div className="text-sm font-medium">{s.firstName} {s.lastName}</div>
                <div className="text-[10px] text-muted-foreground">{s.email}</div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-xs capitalize">
                {s.role.replace(/_/g, " ")}
              </TableCell>
              <TableCell className="hidden md:table-cell text-xs">{s.branchName}</TableCell>
              <TableCell className="hidden lg:table-cell text-xs font-mono">
                {s.deviceAssigned ?? "—"}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("text-[10px]", style.className)}>
                  {style.label}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-[11px] text-muted-foreground">
                {timeAgo(s.lastLoginAt)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-xs">
                {formatNumber(s.transactionsToday)}
              </TableCell>
              <TableCell className="text-right pr-3">
                <DropdownMenu open={dropdownOpenId === s.id} onOpenChange={(o) => setDropdownOpenId(o ? s.id : null)}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel className="text-xs">{s.staffCode}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {s.status === "active" ? (
                      <DropdownMenuItem onClick={() => suspend(s)}>
                        <Pause className="size-3.5 mr-2 text-orange-600" /> Suspend
                      </DropdownMenuItem>
                    ) : s.status === "suspended" ? (
                      <DropdownMenuItem onClick={() => reactivate(s)}>
                        <RotateCcw className="size-3.5 mr-2 text-emerald-600" /> Reactivate
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => resetPin(s)}>
                      <KeyRound className="size-3.5 mr-2 text-amber-600" /> Reset PIN
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => forceLogout(s)}>
                      <LogOut className="size-3.5 mr-2 text-red-600" /> Force logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </ScrollTable>
  );
}

/* ============================ TAB: Terminals ============================ */

function TerminalsTab({ items }: { items: Terminal[] }) {
  const { staff } = useAuth();

  function actor() {
    if (!staff) return null;
    return {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      department: staff.departmentId,
      role: staff.roleId,
    };
  }

  function activate(t: Terminal) {
    const a = actor();
    if (!a) return;
    adminData.updateTerminal(t.id, {
      status: "active",
      activatedAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    logAudit(a, "terminal.activate", "terminal", t.id, {
      countryCode: t.countryCode,
      beforeValue: t.status,
      afterValue: "active",
    });
    toast.success(`Terminal activated: ${t.serialNumber}`, {
      description: `${t.model} · ${t.merchantName}`,
    });
  }

  function block(t: Terminal) {
    const a = actor();
    if (!a) return;
    adminData.updateTerminal(t.id, { status: "blocked", lastSeenAt: Date.now() });
    logAudit(a, "terminal.block", "terminal", t.id, {
      countryCode: t.countryCode,
      beforeValue: t.status,
      afterValue: "blocked",
    });
    toast.success(`Terminal blocked: ${t.serialNumber}`, {
      description: `${t.model} · ${t.merchantName}`,
    });
  }

  if (items.length === 0) return <TabEmptyState icon={CreditCard} label="terminals" />;

  return (
    <ScrollTable>
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow>
          <TableHead className="pl-3">Serial</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Activated</TableHead>
          <TableHead className="hidden md:table-cell">Last Seen</TableHead>
          <TableHead className="text-right pr-3">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((t) => {
          const style = TERMINAL_STATUS_STYLES[t.status];
          return (
            <TableRow key={t.id}>
              <TableCell className="pl-3 font-mono text-[11px]">{t.serialNumber}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {t.type === "phone_pos" ? "Phone POS" : "Physical"}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">{t.model}</TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("text-[10px]", style.className)}>
                  {style.label}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                {formatDate(t.activatedAt)}
              </TableCell>
              <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                {timeAgo(t.lastSeenAt)}
              </TableCell>
              <TableCell className="text-right pr-3">
                {t.status !== "active" && t.status !== "blocked" && t.status !== "damaged" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                    onClick={() => activate(t)}
                  >
                    <CheckCircle2 className="size-3 mr-1" /> Activate
                  </Button>
                ) : t.status === "active" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                    onClick={() => block(t)}
                  >
                    <Ban className="size-3 mr-1" /> Block
                  </Button>
                ) : (
                  <span className="text-[10px] text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </ScrollTable>
  );
}

/* ============================ TAB: POS Requests ============================ */

function PosRequestsTab({ items }: { items: PosDeviceRequest[] }) {
  const { staff } = useAuth();
  const [declineTarget, setDeclineTarget] = useState<PosDeviceRequest | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  function actor() {
    if (!staff) return null;
    return {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      department: staff.departmentId,
      role: staff.roleId,
    };
  }

  function approve(req: PosDeviceRequest) {
    const a = actor();
    if (!a) return;
    if (!req.canBeApproved) {
      toast.error("Cannot approve — device has no supported payment method");
      return;
    }
    adminData.updatePosDeviceRequest(req.id, {
      status: "approved",
      reviewedBy: a.staffId,
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });
    logAudit(a, "pos_device.approve", "pos_device_request", req.id, {
      countryCode: req.countryCode,
      beforeValue: req.status,
      afterValue: "approved",
    });
    toast.success(`POS device request approved: ${req.requestCode}`, {
      description: `${req.deviceInfo.deviceModel} · ${req.type === "physical_terminal" ? "Physical terminal" : "Phone POS"}`,
    });
  }

  function autoDecline(req: PosDeviceRequest) {
    const a = actor();
    if (!a) return;
    const reason = "Auto-declined: device does not support any payment method (NFC, card reader, or swipe).";
    adminData.updatePosDeviceRequest(req.id, {
      status: "auto_declined",
      reviewedBy: a.staffId,
      reviewedAt: Date.now(),
      declineReason: reason,
      updatedAt: Date.now(),
    });
    logAudit(a, "pos_device.auto_decline", "pos_device_request", req.id, {
      countryCode: req.countryCode,
      beforeValue: req.status,
      afterValue: "auto_declined",
      reason,
    });
    toast.success(`Auto-declined: ${req.requestCode}`, {
      description: "No payment method supported on this device.",
    });
  }

  function submitDecline() {
    if (!declineTarget) return;
    const a = actor();
    if (!a) return;
    const reason =
      declineReason.trim() ||
      "Declined by reviewer — see audit log for context.";
    adminData.updatePosDeviceRequest(declineTarget.id, {
      status: "declined",
      reviewedBy: a.staffId,
      reviewedAt: Date.now(),
      declineReason: reason,
      updatedAt: Date.now(),
    });
    logAudit(a, "pos_device.decline", "pos_device_request", declineTarget.id, {
      countryCode: declineTarget.countryCode,
      beforeValue: declineTarget.status,
      afterValue: "declined",
      reason,
    });
    toast.success(`Declined: ${declineTarget.requestCode}`, { description: reason });
    setDeclineTarget(null);
    setDeclineReason("");
  }

  if (items.length === 0) return <TabEmptyState icon={Smartphone} label="POS device requests" />;

  return (
    <>
      <div className="space-y-2">
        {items.map((req) => {
          const d = req.deviceInfo;
          const style = POS_DEVICE_REQUEST_STATUS_STYLES[req.status];
          const isPending = req.status === "pending";
          const showWarnings =
            isPending && (d.deviceIntegrityPassed === false || d.screenLockEnabled === false);
          return (
            <Card key={req.id} className="overflow-hidden">
              <CardContent className="p-3 space-y-2.5">
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {req.requestCode}
                      </span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {req.type === "physical_terminal" ? "Physical Terminal" : "Phone POS"}
                      </Badge>
                      <Badge variant="secondary" className={cn("text-[10px]", style.className)}>
                        {style.label}
                      </Badge>
                    </div>
                    <div className="font-medium text-sm mt-1 flex items-center gap-1.5">
                      <MonitorSmartphone className="size-3.5 text-emerald-600" />
                      {d.deviceModel}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      OS {d.osVersion} · Faya POS v{d.appVersion} · battery {d.batteryLevel}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase text-muted-foreground">Requested</div>
                    <div className="text-[11px]">{timeAgo(req.requestedAt)}</div>
                  </div>
                </div>

                {/* Capability checks */}
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <Cpu className="size-3 text-emerald-600" /> Device capability check
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <CapabilityBadge label="NFC" supported={d.nfcSupported} />
                    <CapabilityBadge label="Card Reader" supported={d.cardReaderSupported} />
                    <CapabilityBadge label="Swipe" supported={d.swipeSupported} />
                    <span className="text-[10px] text-muted-foreground mx-1">·</span>
                    {d.deviceIntegrityPassed ? (
                      <Badge variant="outline" className="text-[9px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
                        <ShieldCheck className="size-2.5 mr-0.5" /> Integrity OK
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] text-red-700 border-red-300 bg-red-50 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                        <ShieldAlert className="size-2.5 mr-0.5" /> Integrity FAILED
                      </Badge>
                    )}
                    {d.screenLockEnabled ? (
                      <Badge variant="outline" className="text-[9px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
                        <LockIcon className="size-2.5 mr-0.5" /> Screen lock ON
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                        <LockIcon className="size-2.5 mr-0.5" /> No screen lock
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground mx-1">·</span>
                    {req.canBeApproved ? (
                      <Badge variant="outline" className="text-[9px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 className="size-2.5 mr-0.5" /> Can approve
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] text-red-700 border-red-300 bg-red-50 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                        <XCircle className="size-2.5 mr-0.5" /> No payment method
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Warnings */}
                {showWarnings && (
                  <div className="space-y-1">
                    {d.deviceIntegrityPassed === false && (
                      <div className="rounded-md border border-amber-300 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-2 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                        <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                        <span>
                          <strong>WARNING:</strong> Device integrity check failed —
                          device may be rooted/jailbroken. Approve with caution.
                        </span>
                      </div>
                    )}
                    {d.screenLockEnabled === false && (
                      <div className="rounded-md border border-amber-300 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-2 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                        <LockIcon className="size-3 mt-0.5 shrink-0" />
                        <span>
                          <strong>WARNING:</strong> Screen lock is disabled. Encourage
                          the merchant to enable PIN/biometric before approval.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Decline reason */}
                {req.declineReason && !isPending && (
                  <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-900/10 p-2 text-[11px] text-red-800 dark:text-red-300">
                    <strong>Decline reason:</strong> {req.declineReason}
                  </div>
                )}

                {/* Reviewed by */}
                {!isPending && req.reviewedBy && (
                  <div className="text-[10px] text-muted-foreground">
                    Reviewed by <span className="font-mono">{req.reviewedBy}</span>
                    {req.reviewedAt && ` · ${formatDateTime(req.reviewedAt)}`}
                  </div>
                )}

                {/* Actions */}
                {isPending && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              size="sm"
                              className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]"
                              disabled={!req.canBeApproved}
                              onClick={() => approve(req)}
                            >
                              <CheckCircle2 className="size-3 mr-1" /> Approve
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {req.canBeApproved
                            ? "Approve this POS device request"
                            : "Cannot approve — device doesn't support any payment method (NFC, card reader, or swipe)"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {!req.canBeApproved && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                        onClick={() => autoDecline(req)}
                      >
                        <XCircle className="size-3 mr-1" /> Auto-decline
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        setDeclineTarget(req);
                        setDeclineReason("");
                      }}
                    >
                      <XCircle className="size-3 mr-1" /> Decline
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Decline dialog */}
      <Dialog open={!!declineTarget} onOpenChange={(o) => !o && setDeclineTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline POS device request?</DialogTitle>
            <DialogDescription>
              {declineTarget && (
                <>
                  {declineTarget.requestCode} — {declineTarget.deviceInfo.deviceModel}.
                  The merchant will be notified and can re-request with an updated device.
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

/* ============================ TAB: Transactions ============================ */

function TransactionsTab({
  items,
  merchant,
}: {
  items: Transaction[];
  merchant: Merchant;
}) {
  const { staff } = useAuth();
  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);

  function actor() {
    if (!staff) return null;
    return {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      department: staff.departmentId,
      role: staff.roleId,
    };
  }

  function viewDetails(t: Transaction) {
    toast.info(`Transaction ${t.reference}`, {
      description: `${formatCurrency(t.amount, t.currency)} · ${t.type.replace(/_/g, " ")} · ${t.paymentMethod}`,
    });
    setDropdownOpenId(null);
  }

  function openDispute(t: Transaction) {
    const a = actor();
    if (!a) return;
    logAudit(a, "transaction.open_dispute", "transaction", t.id, {
      countryCode: t.countryCode,
      reason: `Dispute opened for ${t.reference}`,
    });
    toast.success(`Dispute initiated for ${t.reference}`, {
      description: "A new dispute record will be created against this transaction.",
    });
    setDropdownOpenId(null);
  }

  function escalate(t: Transaction) {
    const a = actor();
    if (!a) return;
    logAudit(a, "transaction.escalate", "transaction", t.id, {
      countryCode: t.countryCode,
      reason: `Escalated ${t.reference} (risk score ${t.riskScore})`,
    });
    toast.success(`Transaction escalated: ${t.reference}`, {
      description: `Risk score ${t.riskScore}/100 — flagged for senior review.`,
    });
    setDropdownOpenId(null);
  }

  if (items.length === 0) return <TabEmptyState icon={Receipt} label="transactions" />;

  return (
    <ScrollTable>
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow>
          <TableHead className="pl-3">Reference</TableHead>
          <TableHead className="hidden md:table-cell">User</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="hidden md:table-cell">Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Method</TableHead>
          <TableHead className="hidden lg:table-cell">Risk</TableHead>
          <TableHead className="hidden md:table-cell">Created</TableHead>
          <TableHead className="text-right pr-3">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((t) => {
          const style = TXN_STATUS_STYLES[t.status];
          const riskStyle = RISK_TONE(
            t.riskScore >= 80
              ? "critical"
              : t.riskScore >= 60
                ? "high"
                : t.riskScore >= 30
                  ? "medium"
                  : "low",
          );
          return (
            <TableRow key={t.id}>
              <TableCell className="pl-3 font-mono text-[11px]">{t.reference}</TableCell>
              <TableCell className="hidden md:table-cell text-xs">{t.userName}</TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                {formatCurrency(t.amount, t.currency)}
              </TableCell>
              <TableCell className="hidden md:table-cell text-[11px] capitalize">
                {t.type.replace(/_/g, " ")}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("text-[10px]", style.className)}>
                  {style.label}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-[11px]">{t.paymentMethod}</TableCell>
              <TableCell className="hidden lg:table-cell">
                <Badge variant="secondary" className={cn("text-[10px]", riskStyle.className)}>
                  {t.riskScore}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                {timeAgo(t.createdAt)}
              </TableCell>
              <TableCell className="text-right pr-3">
                <DropdownMenu open={dropdownOpenId === t.id} onOpenChange={(o) => setDropdownOpenId(o ? t.id : null)}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel className="text-xs">{t.reference}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => viewDetails(t)}>
                      <Eye className="size-3.5 mr-2" /> View details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openDispute(t)}>
                      <Scale className="size-3.5 mr-2 text-amber-600" /> Open dispute
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => escalate(t)}>
                      <ArrowRightCircle className="size-3.5 mr-2 text-orange-600" /> Escalate
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </ScrollTable>
  );
}

/* ============================ TAB: Settlements ============================ */

function SettlementsTab({ items }: { items: Settlement[] }) {
  const { staff } = useAuth();

  function actor() {
    if (!staff) return null;
    return {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      department: staff.departmentId,
      role: staff.roleId,
    };
  }

  function retry(s: Settlement) {
    const a = actor();
    if (!a) return;
    adminData.updateSettlement(s.id, {
      status: "processing",
      failureReason: undefined,
    });
    logAudit(a, "settlement.retry", "settlement", s.id, {
      countryCode: s.countryCode,
      beforeValue: s.status,
      afterValue: "processing",
      reason: `Retry issued for batch ${s.batchId}`,
    });
    toast.success(`Settlement retry queued: ${s.batchId}`, {
      description: formatCurrency(s.amount, s.currency),
    });
  }

  function viewDetails(s: Settlement) {
    toast.info(`Settlement ${s.batchId}`, {
      description: `${formatCurrency(s.amount, s.currency)} · ${s.merchantName} · ${s.status}`,
    });
  }

  if (items.length === 0) return <TabEmptyState icon={Banknote} label="settlements" />;

  return (
    <ScrollTable>
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow>
          <TableHead className="pl-3">Batch ID</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="hidden md:table-cell">Scheduled</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right pr-3">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((s) => {
          const style = SETTLEMENT_STATUS_STYLES[s.status];
          return (
            <TableRow key={s.id}>
              <TableCell className="pl-3 font-mono text-[11px]">{s.batchId}</TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                {formatCurrency(s.amount, s.currency)}
              </TableCell>
              <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                {formatDate(s.scheduledAt)}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("text-[10px]", style.className)}>
                  {style.label}
                </Badge>
                {s.failureReason && (
                  <div className="text-[9px] text-red-600 dark:text-red-400 mt-0.5">
                    {s.failureReason}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right pr-3">
                <div className="inline-flex gap-1">
                  {s.status === "failed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                      onClick={() => retry(s)}
                    >
                      <RefreshCw className="size-3 mr-1" /> Retry
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={() => viewDetails(s)}
                  >
                    <Eye className="size-3 mr-1" /> Details
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </ScrollTable>
  );
}

/* ============================ TAB: Disputes ============================ */

function DisputesTab({ items }: { items: Dispute[] }) {
  const { staff } = useAuth();

  function actor() {
    if (!staff) return null;
    return {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      department: staff.departmentId,
      role: staff.roleId,
    };
  }

  function requestEvidence(d: Dispute) {
    const a = actor();
    if (!a) return;
    adminData.updateDispute(d.id, { status: "awaiting_evidence" });
    logAudit(a, "dispute.request_evidence", "dispute", d.id, {
      countryCode: d.countryCode,
      beforeValue: d.status,
      afterValue: "awaiting_evidence",
    });
    toast.success(`Evidence requested: ${d.id}`, {
      description: `${d.customerName} · ${formatCurrency(d.amount, d.currency)}`,
    });
  }

  function updateStatus(d: Dispute) {
    const a = actor();
    if (!a) return;
    const nextStatus: Dispute["status"] =
      d.status === "new"
        ? "awaiting_evidence"
        : d.status === "awaiting_evidence"
          ? "under_review"
          : d.status === "evidence_submitted"
            ? "under_review"
            : d.status === "under_review"
              ? "won"
              : d.status;
    adminData.updateDispute(d.id, { status: nextStatus });
    logAudit(a, "dispute.update_status", "dispute", d.id, {
      countryCode: d.countryCode,
      beforeValue: d.status,
      afterValue: nextStatus,
    });
    toast.success(`Dispute updated: ${d.id}`, {
      description: `${d.status} → ${nextStatus.replace(/_/g, " ")}`,
    });
  }

  if (items.length === 0) return <TabEmptyState icon={Scale} label="disputes" />;

  return (
    <ScrollTable>
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow>
          <TableHead className="pl-3">Dispute ID</TableHead>
          <TableHead className="hidden md:table-cell">Customer</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="hidden md:table-cell">Reason</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Deadline</TableHead>
          <TableHead className="text-right pr-3">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((d) => {
          const style = DISPUTE_STATUS_STYLES[d.status];
          const breached = d.deadline < Date.now();
          return (
            <TableRow key={d.id}>
              <TableCell className="pl-3 font-mono text-[11px]">{d.id}</TableCell>
              <TableCell className="hidden md:table-cell text-xs">{d.customerName}</TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                {formatCurrency(d.amount, d.currency)}
              </TableCell>
              <TableCell className="hidden md:table-cell text-[11px] max-w-[160px] truncate">
                {d.reason}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("text-[10px]", style.className)}>
                  {style.label}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-[11px]">
                <span className={cn(breached && "text-red-600 dark:text-red-400 font-medium")}>
                  {formatDate(d.deadline)}
                </span>
              </TableCell>
              <TableCell className="text-right pr-3">
                <div className="inline-flex gap-1">
                  {(d.status === "new" || d.status === "under_review") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => requestEvidence(d)}
                    >
                      <FileText className="size-3 mr-1" /> Request evidence
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={() => updateStatus(d)}
                  >
                    <ArrowRightCircle className="size-3 mr-1" /> Advance
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </ScrollTable>
  );
}

/* ============================ TAB: Documents ============================ */

function DocumentsTab({ items }: { items: UserDocument[] }) {
  const { staff } = useAuth();

  function actor() {
    if (!staff) return null;
    return {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      department: staff.departmentId,
      role: staff.roleId,
    };
  }

  function approve(d: UserDocument) {
    const a = actor();
    if (!a) return;
    adminData.updateDocument(d.id, {
      status: "approved",
      reviewedBy: a.staffId,
      reviewedAt: Date.now(),
    });
    logAudit(a, "document.approve", "document", d.id, {
      countryCode: d.countryCode,
      beforeValue: d.status,
      afterValue: "approved",
    });
    toast.success(`Document approved: ${d.fileName}`, {
      description: `${d.documentType.replace(/_/g, " ")}`,
    });
  }

  function reject(d: UserDocument) {
    const a = actor();
    if (!a) return;
    adminData.updateDocument(d.id, {
      status: "rejected",
      reviewedBy: a.staffId,
      reviewedAt: Date.now(),
    });
    logAudit(a, "document.reject", "document", d.id, {
      countryCode: d.countryCode,
      beforeValue: d.status,
      afterValue: "rejected",
    });
    toast.success(`Document rejected: ${d.fileName}`, {
      description: `${d.documentType.replace(/_/g, " ")}`,
    });
  }

  function requestReplacement(d: UserDocument) {
    const a = actor();
    if (!a) return;
    adminData.updateDocument(d.id, {
      status: "replacement_requested",
      reviewedBy: a.staffId,
      reviewedAt: Date.now(),
    });
    logAudit(a, "document.request_replacement", "document", d.id, {
      countryCode: d.countryCode,
      beforeValue: d.status,
      afterValue: "replacement_requested",
    });
    toast.success(`Replacement requested: ${d.fileName}`, {
      description: "Merchant will be asked to upload a new copy.",
    });
  }

  if (items.length === 0) return <TabEmptyState icon={FolderOpen} label="documents" />;

  return (
    <ScrollTable>
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow>
          <TableHead className="pl-3">Type</TableHead>
          <TableHead>File Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Uploaded</TableHead>
          <TableHead className="hidden lg:table-cell">Reviewed By</TableHead>
          <TableHead className="text-right pr-3">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((d) => {
          const style = DOCUMENT_STATUS_STYLES[d.status];
          return (
            <TableRow key={d.id}>
              <TableCell className="pl-3 text-[11px] capitalize">
                {d.documentType.replace(/_/g, " ")}
              </TableCell>
              <TableCell className="text-xs font-mono">{d.fileName}</TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("text-[10px]", style.className)}>
                  {style.label}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                {timeAgo(d.uploadedAt)}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-[11px] font-mono">
                {d.reviewedBy ?? "—"}
              </TableCell>
              <TableCell className="text-right pr-3">
                <div className="inline-flex gap-1">
                  {d.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                        onClick={() => approve(d)}
                      >
                        <CheckCircle2 className="size-3 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                        onClick={() => reject(d)}
                      >
                        <XCircle className="size-3 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                  {d.status !== "replacement_requested" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => requestReplacement(d)}
                    >
                      <RefreshCw className="size-3 mr-1" /> Replace
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </ScrollTable>
  );
}

/* ============================ TAB: KYB Cases ============================ */

function KybCasesTab({
  items,
  merchant,
}: {
  items: KybCase[];
  merchant: Merchant;
}) {
  const { staff } = useAuth();

  function actor() {
    if (!staff) return null;
    return {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      department: staff.departmentId,
      role: staff.roleId,
    };
  }

  function approve(k: KybCase) {
    const a = actor();
    if (!a) return;
    adminData.updateKyb(k.id, {
      status: "approved",
      assignedReviewer: a.staffId,
    });
    // Also lift the merchant into approved/active
    adminData.updateMerchant(merchant.id, {
      kybStatus: "approved",
      status: "active",
      kybCaseId: k.id,
      updatedAt: Date.now(),
    });
    logAudit(a, "kyb.approve", "kyb_case", k.id, {
      countryCode: k.countryCode,
      beforeValue: k.status,
      afterValue: "approved",
    });
    toast.success(`KYB case approved: ${k.id}`, {
      description: `${merchant.tradingName} → KYB approved, status active.`,
    });
  }

  function reject(k: KybCase) {
    const a = actor();
    if (!a) return;
    adminData.updateKyb(k.id, {
      status: "rejected",
      assignedReviewer: a.staffId,
    });
    adminData.updateMerchant(merchant.id, {
      kybStatus: "rejected",
      status: "restricted",
      kybCaseId: k.id,
      updatedAt: Date.now(),
    });
    logAudit(a, "kyb.reject", "kyb_case", k.id, {
      countryCode: k.countryCode,
      beforeValue: k.status,
      afterValue: "rejected",
    });
    toast.success(`KYB case rejected: ${k.id}`, {
      description: `${merchant.tradingName} → KYB rejected, status restricted.`,
    });
  }

  function escalate(k: KybCase) {
    const a = actor();
    if (!a) return;
    adminData.updateKyb(k.id, {
      status: "escalated",
      assignedReviewer: a.staffId,
    });
    adminData.updateMerchant(merchant.id, {
      kybStatus: "escalated",
      updatedAt: Date.now(),
    });
    logAudit(a, "kyb.escalate", "kyb_case", k.id, {
      countryCode: k.countryCode,
      beforeValue: k.status,
      afterValue: "escalated",
    });
    toast.success(`KYB case escalated: ${k.id}`, {
      description: "Senior reviewer will pick this up next.",
    });
  }

  if (items.length === 0) return <TabEmptyState icon={ShieldCheck} label="KYB cases" />;

  return (
    <ScrollTable>
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow>
          <TableHead className="pl-3">Case ID</TableHead>
          <TableHead className="hidden md:table-cell">Country</TableHead>
          <TableHead className="hidden md:table-cell">Business Type</TableHead>
          <TableHead>Risk</TableHead>
          <TableHead className="hidden md:table-cell">Submitted</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Reviewer</TableHead>
          <TableHead className="hidden lg:table-cell">SLA</TableHead>
          <TableHead className="text-right pr-3">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((k) => {
          const v = statusBadge("kyb", k.status);
          const r = RISK_TONE(k.riskCategory);
          return (
            <TableRow key={k.id}>
              <TableCell className="pl-3 font-mono text-[11px]">{k.id}</TableCell>
              <TableCell className="hidden md:table-cell text-[11px] font-mono">
                {k.countryCode}
              </TableCell>
              <TableCell className="hidden md:table-cell text-[11px] capitalize">
                {k.businessType.replace(/_/g, " ")}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("text-[10px] capitalize", r.className)}>
                  {r.label}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                {timeAgo(k.submittedAt)}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("text-[10px]", v.className)}>
                  {v.label}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-[11px] font-mono">
                {k.assignedReviewer ?? "—"}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <SlaPill deadline={k.slaDeadline} />
              </TableCell>
              <TableCell className="text-right pr-3">
                <div className="inline-flex gap-1">
                  {k.status !== "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                      onClick={() => approve(k)}
                    >
                      <CheckCircle2 className="size-3 mr-1" /> Approve
                    </Button>
                  )}
                  {k.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                      onClick={() => reject(k)}
                    >
                      <XCircle className="size-3 mr-1" /> Reject
                    </Button>
                  )}
                  {k.status !== "escalated" && k.status !== "approved" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => escalate(k)}
                    >
                      <ArrowRightCircle className="size-3 mr-1" /> Escalate
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </ScrollTable>
  );
}

/* ============================ TAB: Support Tickets ============================ */

function SupportTicketsTab({ items }: { items: SupportTicket[] }) {
  const { staff } = useAuth();

  function actor() {
    if (!staff) return null;
    return {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      department: staff.departmentId,
      role: staff.roleId,
    };
  }

  function reply(t: SupportTicket) {
    const a = actor();
    if (!a) return;
    adminData.updateTicket(t.id, {
      status: "waiting",
      updatedAt: Date.now(),
    });
    logAudit(a, "ticket.reply", "support_ticket", t.id, {
      countryCode: t.countryCode,
      beforeValue: t.status,
      afterValue: "waiting",
    });
    toast.success(`Reply sent on ticket ${t.id}`, {
      description: `Status → waiting · awaiting customer response.`,
    });
  }

  function assign(t: SupportTicket) {
    const a = actor();
    if (!a) return;
    adminData.updateTicket(t.id, {
      assignedTo: a.staffId,
      status: t.status === "open" ? "in_progress" : t.status,
      updatedAt: Date.now(),
    });
    logAudit(a, "ticket.assign", "support_ticket", t.id, {
      countryCode: t.countryCode,
      beforeValue: t.assignedTo ?? "unassigned",
      afterValue: a.staffId,
    });
    toast.success(`Ticket ${t.id} assigned to you`, {
      description: t.subject,
    });
  }

  function close(t: SupportTicket) {
    const a = actor();
    if (!a) return;
    adminData.updateTicket(t.id, {
      status: "closed",
      updatedAt: Date.now(),
    });
    logAudit(a, "ticket.close", "support_ticket", t.id, {
      countryCode: t.countryCode,
      beforeValue: t.status,
      afterValue: "closed",
    });
    toast.success(`Ticket closed: ${t.id}`, { description: t.subject });
  }

  if (items.length === 0) return <TabEmptyState icon={MessageSquare} label="support tickets" />;

  return (
    <ScrollTable>
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow>
          <TableHead className="pl-3">Ticket ID</TableHead>
          <TableHead className="hidden md:table-cell">Country</TableHead>
          <TableHead className="hidden md:table-cell">Type</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Created</TableHead>
          <TableHead className="hidden lg:table-cell">SLA</TableHead>
          <TableHead className="text-right pr-3">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((t) => {
          const sStyle = TICKET_STATUS_STYLES[t.status];
          const pStyle = TICKET_PRIORITY_STYLES[t.priority];
          return (
            <TableRow key={t.id}>
              <TableCell className="pl-3 font-mono text-[11px]">{t.id}</TableCell>
              <TableCell className="hidden md:table-cell text-[11px] font-mono">{t.countryCode}</TableCell>
              <TableCell className="hidden md:table-cell text-[11px] capitalize">{t.type}</TableCell>
              <TableCell className="text-xs max-w-[180px] truncate">{t.subject}</TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("text-[10px] capitalize", pStyle.className)}>
                  {pStyle.label}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("text-[10px]", sStyle.className)}>
                  {sStyle.label}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                {timeAgo(t.createdAt)}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <SlaPill deadline={t.slaDeadline} />
              </TableCell>
              <TableCell className="text-right pr-3">
                <div className="inline-flex gap-1">
                  {t.status !== "closed" && t.status !== "resolved" && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => reply(t)}>
                        <Send className="size-3 mr-1" /> Reply
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => assign(t)}>
                        <UserCheck className="size-3 mr-1" /> Assign
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
                        onClick={() => close(t)}
                      >
                        <XCircle className="size-3 mr-1" /> Close
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </ScrollTable>
  );
}

/* ============================ TAB: Risk & Alerts ============================ */

function RiskAlertsTab({ items }: { items: FraudAlert[] }) {
  if (items.length === 0) return <TabEmptyState icon={ShieldAlert} label="fraud alerts" />;

  return (
    <ScrollTable>
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow>
          <TableHead className="pl-3">Alert ID</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="hidden md:table-cell">Device</TableHead>
          <TableHead className="hidden md:table-cell">Created</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((a) => {
          const sStyle = FRAUD_STATUS_STYLES[a.status];
          const r = RISK_TONE(a.severity);
          return (
            <TableRow key={a.id}>
              <TableCell className="pl-3 font-mono text-[11px]">{a.id}</TableCell>
              <TableCell className="text-xs">{a.trigger}</TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("text-[10px] capitalize", r.className)}>
                  {r.label}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                {formatCurrency(a.transactionAmount, "USD")}
              </TableCell>
              <TableCell className="hidden md:table-cell text-[11px] font-mono">{a.device}</TableCell>
              <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                {timeAgo(a.createdAt)}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("text-[10px] capitalize", sStyle.className)}>
                  {sStyle.label}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </ScrollTable>
  );
}

/* ============================ TAB: Activity & Audit ============================ */

function AuditLogsTab({ items }: { items: AuditLog[] }) {
  if (items.length === 0) return <TabEmptyState icon={Activity} label="audit logs" />;

  return (
    <ScrollTable>
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow>
          <TableHead className="pl-3">Timestamp</TableHead>
          <TableHead>Action</TableHead>
          <TableHead className="hidden md:table-cell">Entity</TableHead>
          <TableHead className="hidden lg:table-cell">Reason</TableHead>
          <TableHead className="hidden md:table-cell">IP</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((l) => (
          <TableRow key={l.id}>
            <TableCell className="pl-3 text-[11px] text-muted-foreground whitespace-nowrap">
              {formatDateTime(l.createdAt)}
            </TableCell>
            <TableCell>
              <div className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                {l.action}
              </div>
              <div className="text-[10px] text-muted-foreground">
                by {l.staffName}
              </div>
            </TableCell>
            <TableCell className="hidden md:table-cell text-[11px]">
              <span className="font-mono">{l.entityType}</span>
              <div className="text-[10px] text-muted-foreground font-mono">{l.entityId}</div>
            </TableCell>
            <TableCell className="hidden lg:table-cell text-[11px] max-w-[220px] truncate text-muted-foreground">
              {l.reason ?? "—"}
            </TableCell>
            <TableCell className="hidden md:table-cell text-[11px] font-mono text-muted-foreground">
              {l.ipAddress}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </ScrollTable>
  );
}
