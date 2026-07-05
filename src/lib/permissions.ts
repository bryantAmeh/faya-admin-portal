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

/* ============================================================ */
/* Role → permission templates                                   */
/*                                                              */
/* Each role grants a FIXED baseline of permissions. Roles within */
/* the same department are designed NOT to overlap — a compliance */
/* reviewer gets compliance + read-only ops views, a risk analyst */
/* gets risk + read-only ops views, etc. Super admin bypasses all */
/* checks so its template is empty (meaning "everything").        */
/* ============================================================ */

/**
 * Maps role IDs to the list of permission keys that role grants by default.
 * When a staff member's role is set/changed, the Staff dialog auto-populates
 * their permissions to this baseline (union with any already-toggled items
 * so fine-tuning is preserved). A "Reset to role defaults" button restores
 * exactly this list.
 *
 * Design rules (no overlap within a department):
 *   - Super Admin: empty (bypasses all checks).
 *   - Country Admin: view-all + country config + staff manage (scoped by their
 *     country access, not by permission overlap).
 *   - Compliance roles: compliance + audit + read-only ops views + their
 *     specific action (KYC/KYB approve, escalate). No merchant/consumer
 *     restrict, no staff manage, no finance.
 *   - Risk roles: risk + audit + read-only ops views + restrict/suspend
 *     actions. No compliance approve, no staff manage.
 *   - Merchant ops: merchants + support + disputes + read-only ops views +
 *     POS device approve. No compliance, no staff manage, no risk.
 *   - Finance: finance + audit + read-only ops views. No action perms on
 *     consumers/merchants.
 *   - Support: support + disputes + users/merchants view. No action perms.
 */
export const ROLE_PERMISSION_TEMPLATES: Record<string, string[]> = {
  // Super Admin — bypasses all checks; empty = "everything".
  role_super_admin: [],

  // Country Admin — view everything + configure country + manage staff in their country.
  role_country_admin: [
    "view.dashboard", "view.users", "view.merchants", "view.stock",
    "view.compliance", "view.risk", "view.devices", "view.finance",
    "view.support", "view.disputes", "view.countries", "view.staff",
    "view.audit", "view.approvals",
    "country.configure.global",
    "staff.manage.global",
    "consumer.restrict.global",
    "merchant.restrict.global",
    "merchant.approve_kyb.global",
  ],

  // Compliance — KYC/KYB review + audit + read-only ops.
  role_kyc_reviewer: [
    "view.dashboard", "view.users", "view.compliance", "view.audit",
  ],
  role_kyb_reviewer: [
    "view.dashboard", "view.merchants", "view.compliance", "view.audit",
    "merchant.approve_kyb.global",
  ],
  role_senior_compliance: [
    "view.dashboard", "view.users", "view.merchants", "view.compliance",
    "view.audit", "view.approvals",
    "merchant.approve_kyb.global",
    "consumer.restrict.global",
  ],
  role_compliance_manager: [
    "view.dashboard", "view.users", "view.merchants", "view.compliance",
    "view.audit", "view.approvals",
    "merchant.approve_kyb.global",
    "consumer.restrict.global",
    "staff.manage.global",
  ],
  role_aml_investigator: [
    "view.dashboard", "view.users", "view.merchants", "view.compliance",
    "view.risk", "view.audit",
    "consumer.restrict.global",
    "merchant.restrict.global",
  ],
  role_sanctions_pep: [
    "view.dashboard", "view.users", "view.merchants", "view.compliance",
    "view.audit",
  ],
  role_reg_reporting: [
    "view.dashboard", "view.compliance", "view.audit",
  ],

  // Risk & Fraud — risk + restrict/suspend + audit + read-only ops.
  role_fraud_analyst: [
    "view.dashboard", "view.users", "view.merchants", "view.risk",
    "view.devices", "view.audit",
    "consumer.restrict.global",
    "merchant.restrict.global",
  ],
  role_risk_analyst: [
    "view.dashboard", "view.users", "view.merchants", "view.risk",
    "view.audit",
    "consumer.restrict.global",
    "merchant.restrict.global",
  ],
  role_fraud_manager: [
    "view.dashboard", "view.users", "view.merchants", "view.risk",
    "view.devices", "view.audit", "view.approvals",
    "consumer.restrict.global",
    "merchant.restrict.global",
    "consumer.delete.global",
  ],
  role_device_risk: [
    "view.dashboard", "view.devices", "view.risk", "view.audit",
    "pos_device.approve.global",
  ],

  // Merchant Ops — merchants + support + disputes + POS device approve.
  role_merchant_support: [
    "view.dashboard", "view.merchants", "view.support", "view.disputes",
    "view.devices",
  ],
  role_merchant_ops: [
    "view.dashboard", "view.merchants", "view.support", "view.disputes",
    "view.devices", "view.stock",
    "pos_device.approve.global",
  ],
  role_pos_deploy: [
    "view.dashboard", "view.merchants", "view.devices", "view.stock",
    "pos_device.approve.global",
  ],

  // Finance — finance + audit + read-only ops.
  role_finance_analyst: [
    "view.dashboard", "view.finance", "view.audit",
  ],
  role_settlements: [
    "view.dashboard", "view.finance", "view.merchants", "view.audit",
  ],

  // Support — support + disputes + users/merchants view (no action perms).
  role_support_agent: [
    "view.dashboard", "view.users", "view.merchants", "view.support",
    "view.disputes",
  ],
  role_support_lead: [
    "view.dashboard", "view.users", "view.merchants", "view.support",
    "view.disputes", "view.audit",
  ],

  // Audit / governance — read-only audit + approvals.
  role_audit_viewer: [
    "view.dashboard", "view.audit", "view.approvals",
  ],
};

/**
 * Returns the permission baseline for a role. If the role isn't in the
 * template map (e.g. a custom role), returns a safe read-only dashboard set.
 */
export function getRolePermissions(roleId: string | undefined | null): string[] {
  if (!roleId) return ["view.dashboard"];
  return ROLE_PERMISSION_TEMPLATES[roleId] ?? ["view.dashboard"];
}

/**
 * Returns the human-readable label for a role's permission baseline, shown in
 * the Staff dialog so the admin understands what the role grants.
 */
export function getRolePermissionSummary(roleId: string | undefined | null): string {
  const perms = getRolePermissions(roleId);
  if (perms.length === 0) return "Full access (super admin)";
  const viewCount = perms.filter((p) => p.startsWith("view.")).length;
  const actionCount = perms.length - viewCount;
  return `${viewCount} views${actionCount > 0 ? ` · ${actionCount} actions` : ""}`;
}
