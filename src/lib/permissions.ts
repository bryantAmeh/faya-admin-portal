/**
 * Faya Admin Portal — Permission catalog + helpers
 *
 * Super admins bypass all permission checks (they see + do everything). For
 * every other admin, the `permissions: string[]` field on their AdminStaff
 * profile determines which nav views they can see and which actions they can
 * perform. This module is the single source of truth for:
 *   - which permission keys exist (PERMISSION_CATALOG)
 *   - which permission a nav view requires (VIEW_PERMISSIONS)
 *   - how to check access (isSuperAdmin, hasPermission, canAccessView)
 */

import type { AdminStaff } from "./types";
import type { PortalView } from "@/hooks/use-portal-store";

export const SUPER_ADMIN_DEPT_ID = "dept_super_admin";

/* ============================================================ */
/* Permission catalog — the source of truth for all permissions */
/* ============================================================ */

export interface PermissionDef {
  key: string;
  label: string;
  description: string;
  category: string;
}

/**
 * Every permission key the portal understands. Grouped by category for the
 * permissions UI in the Staff dialog. Keys follow `resource.action.scope`
 * convention. Nav-view permissions use `view.<name>` so they're easy to spot.
 */
export const PERMISSION_CATALOG: PermissionDef[] = [
  // ---- Navigation / view access ----
  {
    key: "view.dashboard",
    label: "Dashboard",
    description: "View the operations dashboard (overview, KPIs, alerts).",
    category: "View Access",
  },
  {
    key: "view.users",
    label: "Users (Consumers)",
    description: "View consumer profiles, cards, wallets, transactions.",
    category: "View Access",
  },
  {
    key: "view.merchants",
    label: "Merchants",
    description: "View merchant profiles, POS staff, terminals, settlements.",
    category: "View Access",
  },
  {
    key: "view.stock",
    label: "Stock & Inventory",
    description: "View physical terminals and cards in inventory + orders.",
    category: "View Access",
  },
  {
    key: "view.compliance",
    label: "Compliance · KYC/KYB",
    description: "View and review KYC/KYB cases and uploaded documents.",
    category: "View Access",
  },
  {
    key: "view.risk",
    label: "Risk & Fraud",
    description: "View fraud alerts and risk-scoring dashboards.",
    category: "View Access",
  },
  {
    key: "view.devices",
    label: "Devices & Terminals",
    description: "View terminals and POS device binding requests.",
    category: "View Access",
  },
  {
    key: "view.finance",
    label: "Finance & Settlements",
    description: "View settlements, fees, limits, provider logs.",
    category: "View Access",
  },
  {
    key: "view.support",
    label: "Support Tickets",
    description: "View and respond to support tickets.",
    category: "View Access",
  },
  {
    key: "view.disputes",
    label: "Disputes & Chargebacks",
    description: "View and manage disputes and chargebacks.",
    category: "View Access",
  },
  {
    key: "view.countries",
    label: "Country Management",
    description: "View and configure country rules, KYC/KYB, platforms.",
    category: "View Access",
  },
  {
    key: "view.staff",
    label: "Staff & Roles",
    description: "View admin staff, departments, and roles.",
    category: "View Access",
  },
  {
    key: "view.audit",
    label: "Audit Logs",
    description: "View the audit trail of all admin actions.",
    category: "View Access",
  },
  {
    key: "view.approvals",
    label: "Approvals",
    description: "View and act on approval requests (dual-control workflows).",
    category: "View Access",
  },

  // ---- Consumer actions ----
  {
    key: "consumer.restrict.global",
    label: "Restrict / Suspend consumers",
    description: "Restrict, suspend, or reactivate consumer accounts.",
    category: "Consumer Actions",
  },
  {
    key: "consumer.delete.global",
    label: "Delete consumer accounts",
    description: "Permanently delete a consumer profile + cards + wallets.",
    category: "Consumer Actions",
  },
  {
    key: "consumer.password_reset.global",
    label: "Reset consumer passwords",
    description: "Generate temp passwords or send reset links for consumers.",
    category: "Consumer Actions",
  },

  // ---- Merchant actions ----
  {
    key: "merchant.restrict.global",
    label: "Restrict / Suspend merchants",
    description: "Restrict, suspend, or reactivate merchant accounts.",
    category: "Merchant Actions",
  },
  {
    key: "merchant.approve_kyb.global",
    label: "Approve / Reject KYB",
    description: "Approve or reject merchant KYB verification.",
    category: "Merchant Actions",
  },
  {
    key: "merchant.password_reset.global",
    label: "Reset merchant passwords",
    description: "Generate temp passwords or send reset links for merchants.",
    category: "Merchant Actions",
  },
  {
    key: "pos_device.approve.global",
    label: "Approve / Decline POS devices",
    description: "Approve or decline POS device binding requests.",
    category: "Merchant Actions",
  },

  // ---- Staff / admin actions ----
  {
    key: "staff.invite.global",
    label: "Invite new admins",
    description: "Generate invite links for prospective admins.",
    category: "Admin Actions",
  },
  {
    key: "staff.manage.global",
    label: "Create / Edit / Suspend staff",
    description: "Create, edit, suspend, or unlock admin staff accounts.",
    category: "Admin Actions",
  },
  {
    key: "staff.permissions.global",
    label: "Assign permissions",
    description: "Change which permissions another admin has. Super-admin only by default.",
    category: "Admin Actions",
  },

  // ---- Country config ----
  {
    key: "country.configure.global",
    label: "Configure country rules",
    description: "Edit KYC/KYB/device/settlement/risk rules per country.",
    category: "Admin Actions",
  },
];

/** All category names (in display order) for the permissions UI. */
export const PERMISSION_CATEGORIES = [
  "View Access",
  "Consumer Actions",
  "Merchant Actions",
  "Admin Actions",
];

/** Quick lookup: key → PermissionDef. */
const PERMISSION_MAP: Record<string, PermissionDef> = Object.fromEntries(
  PERMISSION_CATALOG.map((p) => [p.key, p]),
);

/* ============================================================ */
/* View → required permission mapping                            */
/* ============================================================ */

/**
 * Maps each PortalView to the permission key required to see it. If a view
 * isn't listed here, it has no permission gate (rare — every nav view should
 * have one). Detail views (user_detail, merchant_detail, country_detail)
 * inherit the permission of their parent list view.
 */
export const VIEW_PERMISSIONS: Partial<Record<PortalView, string>> = {
  dashboard: "view.dashboard",
  users: "view.users",
  user_detail: "view.users",
  merchants: "view.merchants",
  merchant_detail: "view.merchants",
  stock: "view.stock",
  compliance: "view.compliance",
  risk: "view.risk",
  devices: "view.devices",
  finance: "view.finance",
  support: "view.support",
  disputes: "view.disputes",
  countries: "view.countries",
  country_detail: "view.countries",
  staff: "view.staff",
  departments: "view.staff",
  audit: "view.audit",
  approvals: "view.approvals",
};

/* ============================================================ */
/* Helpers                                                       */
/* ============================================================ */

/** Returns true if the staff member is a super admin (sees + does everything). */
export function isSuperAdmin(staff: AdminStaff | null | undefined): boolean {
  return !!staff && staff.departmentId === SUPER_ADMIN_DEPT_ID;
}

/**
 * Returns true if the staff member has the given permission. Super admins
 * always pass. Otherwise the key must be in `staff.permissions[]`.
 */
export function hasPermission(
  staff: AdminStaff | null | undefined,
  permissionKey: string,
): boolean {
  if (!staff) return false;
  if (isSuperAdmin(staff)) return true;
  return staff.permissions?.includes(permissionKey) ?? false;
}

/**
 * Returns true if the staff member can access the given PortalView. Detail
 * views inherit their parent list view's permission. Super admins always pass.
 * Views with no entry in VIEW_PERMISSIONS default to accessible (so nothing
 * is accidentally locked out).
 */
export function canAccessView(
  staff: AdminStaff | null | undefined,
  view: PortalView,
): boolean {
  if (!staff) return false;
  if (isSuperAdmin(staff)) return true;
  const required = VIEW_PERMISSIONS[view];
  if (!required) return true; // no gate defined → allow
  return hasPermission(staff, required);
}

/** Returns the list of nav views the staff member can see. */
export function getAccessibleViews(staff: AdminStaff | null | undefined): PortalView[] {
  const allViews = Object.keys(VIEW_PERMISSIONS) as PortalView[];
  return allViews.filter((v) => canAccessView(staff, v));
}

/** Returns permission definitions grouped by category (for the UI). */
export function getPermissionsByCategory(): Record<string, PermissionDef[]> {
  const grouped: Record<string, PermissionDef[]> = {};
  for (const cat of PERMISSION_CATEGORIES) grouped[cat] = [];
  for (const p of PERMISSION_CATALOG) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }
  return grouped;
}
