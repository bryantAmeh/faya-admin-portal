/**
 * Formatting helpers for the Faya Admin Portal.
 */
import type {
  StaffStatus,
  CountryStatus,
  KycStatus,
  KybStatus,
  RiskLevel,
  ApprovalStatus,
} from "./types";

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function timeAgo(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function formatDateTime(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function slaStatus(deadline: number): {
  label: string;
  variant: "default" | "warning" | "danger";
} {
  const diff = deadline - Date.now();
  if (diff < 0) return { label: "SLA breached", variant: "danger" };
  if (diff < 4 * 60 * 60 * 1000) return { label: "SLA at risk", variant: "warning" };
  const hr = Math.floor(diff / (60 * 60 * 1000));
  if (hr < 24) return { label: `${hr}h left`, variant: "default" };
  return { label: `${Math.floor(hr / 24)}d left`, variant: "default" };
}

/* --------------------------- Status badge styles -------------------------- */

const STAFF_STATUS_STYLES: Record<StaffStatus, { label: string; className: string }> = {
  invited: { label: "Invited", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  locked: { label: "Locked", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  removed: { label: "Removed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const COUNTRY_STATUS_STYLES: Record<CountryStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  internal_testing: { label: "Internal Testing", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  pilot: { label: "Pilot", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  live: { label: "Live", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  restricted: { label: "Restricted", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  closed: { label: "Closed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const KYC_STATUS_STYLES: Record<KycStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  in_review: { label: "In Review", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  escalated: { label: "Escalated", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
};

const KYB_STATUS_STYLES: Record<KybStatus, { label: string; className: string }> = KYC_STATUS_STYLES;

const RISK_STYLES: Record<RiskLevel, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  medium: { label: "Medium", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  high: { label: "High", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  critical: { label: "Critical", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const APPROVAL_STYLES: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  expired: { label: "Expired", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

export const STATUS_BADGE = {
  staff: STAFF_STATUS_STYLES,
  country: COUNTRY_STATUS_STYLES,
  kyc: KYC_STATUS_STYLES,
  kyb: KYB_STATUS_STYLES,
  risk: RISK_STYLES,
  approval: APPROVAL_STYLES,
};

export function statusBadge(
  type: keyof typeof STATUS_BADGE,
  value: string,
): { label: string; className: string } {
  const table = STATUS_BADGE[type] as Record<string, { label: string; className: string }>;
  return table[value] ?? { label: value, className: "bg-gray-100 text-gray-800" };
}
