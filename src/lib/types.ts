/**
 * Faya Admin Portal — Domain types
 * Mirrors §15 (Admin Database Tables) of the spec.
 */

export type StaffStatus =
  | "invited"
  | "active"
  | "suspended"
  | "locked"
  | "removed";

export type CountryStatus =
  | "draft"
  | "internal_testing"
  | "pilot"
  | "live"
  | "restricted"
  | "suspended"
  | "closed";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type KycStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "escalated";

export type KybStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "escalated";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface Department {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive";
  createdAt: number;
  updatedAt: number;
}

export interface Role {
  id: string;
  departmentId: string;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  status: "active" | "inactive";
  createdAt: number;
  updatedAt: number;
}

export interface Permission {
  id: string;
  key: string; // resource.action.scope
  resource: string;
  action: string;
  scope: "own" | "branch" | "country" | "region" | "global";
  description: string;
  status: "active" | "inactive";
}

export interface StaffCountryAccess {
  countryCode: string;
  accessLevel: "view" | "operate" | "manage";
}

export interface AdminStaff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  roleId: string;
  managerId: string | null;
  status: StaffStatus;
  mfaEnabled: boolean;
  countries: StaffCountryAccess[];
  permissions: string[]; // permission keys
  lastLoginAt: number | null;
  failedLoginCount: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  notes?: string;
}

export interface CountryConfig {
  id: string;
  countryCode: string;
  countryName: string;
  currency: string;
  timezone: string;
  regulator: string;
  status: CountryStatus;
  launchStatus: string;
  kycRules: Record<string, unknown>;
  kybRules: Record<string, unknown>;
  deviceRules: Record<string, unknown>;
  settlementRules: Record<string, unknown>;
  riskRules: Record<string, unknown>;
  // dashboard counters
  activeCustomers: number;
  activeMerchants: number;
  pendingKyc: number;
  pendingKyb: number;
  highRiskAlerts: number;
  activeTerminals: number;
  activePhonePos: number;
  todayTxVolume: number;
  todayApproved: number;
  todayDeclined: number;
  pendingSettlements: number;
  heldSettlements: number;
  openDisputes: number;
  openTickets: number;
  complianceAlerts: number;
  createdAt: number;
  updatedAt: number;
}

export interface KycCase {
  id: string;
  customerName: string;
  countryCode: string;
  nationality: string;
  riskScore: number;
  submittedAt: number;
  requiredDocuments: string[];
  status: KycStatus;
  assignedReviewer: string | null;
  slaDeadline: number;
  notes: string;
}

export interface KybCase {
  id: string;
  merchantName: string;
  countryCode: string;
  businessType: string;
  riskCategory: RiskLevel;
  submittedAt: number;
  missingDocuments: string[];
  status: KybStatus;
  assignedReviewer: string | null;
  slaDeadline: number;
  notes: string;
}

export interface FraudAlert {
  id: string;
  countryCode: string;
  entityType: "customer" | "merchant" | "device";
  entityName: string;
  trigger: string;
  severity: RiskLevel;
  transactionAmount: number;
  device: string;
  createdAt: number;
  status: "open" | "investigating" | "closed" | "escalated";
}

export interface Settlement {
  id: string;
  countryCode: string;
  merchantName: string;
  batchId: string;
  amount: number;
  currency: string;
  scheduledAt: number;
  status: "pending" | "processing" | "completed" | "failed" | "held";
  failureReason?: string;
}

export interface SupportTicket {
  id: string;
  countryCode: string;
  type: "customer" | "merchant" | "terminal" | "payment";
  subject: string;
  requesterName: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  assignedTo: string | null;
  createdAt: number;
  updatedAt: number;
  slaDeadline: number;
}

export interface Dispute {
  id: string;
  countryCode: string;
  merchantName: string;
  customerName: string;
  amount: number;
  currency: string;
  reason: string;
  status: "new" | "awaiting_evidence" | "evidence_submitted" | "under_review" | "won" | "lost" | "expired";
  deadline: number;
  createdAt: number;
}

export interface Terminal {
  id: string;
  serialNumber: string;
  countryCode: string;
  merchantName: string;
  model: string;
  type: "physical" | "phone_pos";
  status: "inventory" | "shipped" | "delivered" | "active" | "blocked" | "damaged";
  activatedAt: number | null;
  lastSeenAt: number | null;
}

export interface AuditLog {
  id: string;
  staffId: string;
  staffName: string;
  department: string;
  role: string;
  countryCode: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeValue?: string;
  afterValue?: string;
  reason?: string;
  ipAddress: string;
  deviceFingerprint: string;
  createdAt: number;
}

export interface ApprovalRequest {
  id: string;
  requestedBy: string;
  requestedByName: string;
  countryCode: string | null;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  requiredApprovals: number;
  currentApprovals: number;
  reason: string;
  createdAt: number;
  updatedAt: number;
  decisions: {
    approvedBy: string;
    approvedByName: string;
    decision: "approve" | "reject";
    note: string;
    createdAt: number;
  }[];
}
