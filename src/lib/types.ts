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
  regionAccess: string[];
  permissions: string[]; // permission keys
  lastLoginAt: number | null;
  failedLoginCount: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  notes?: string;
}

export const AFRICAN_REGIONS = [
  "West Africa",
  "East Africa",
  "North Africa",
  "Southern Africa",
  "Central Africa",
] as const;

export interface CountryConfig {
  id: string;
  countryCode: string;
  countryName: string;
  currency: string;
  timezone: string;
  regulator: string;
  region: string;
  status: CountryStatus;
  launchStatus: string;
  kycRules: Record<string, unknown>;
  kybRules: Record<string, unknown>;
  deviceRules: Record<string, unknown>;
  settlementRules: Record<string, unknown>;
  riskRules: Record<string, unknown>;
  // Platforms enabled for this country. Rules (KYC/KYB/device/settlement/risk)
  // cut across ALL enabled platforms — set here, enforced everywhere.
  platforms: PlatformConfig;
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

/**
 * Per-country platform enablement. When a platform is enabled, ALL country rules
 * (KYC for consumers, KYB for merchants, device, settlement, risk) apply to it.
 * This is the "cut across all platforms" enforcement point.
 */
export interface PlatformConfig {
  consumerApp: boolean; // Customer-facing mobile app
  merchantApp: boolean; // Merchant-facing mobile app
  physicalTerminal: boolean; // Card POS devices
  phonePos: boolean; // SoftPOS — merchant phone as terminal
  nfcClosedLoop: boolean; // Faya's own NFC payment system
  onlineCheckout: boolean; // E-commerce / web checkout
}

export type PlatformKey = keyof PlatformConfig;

export const PLATFORM_LABELS: Record<PlatformKey, { label: string; description: string }> = {
  consumerApp: { label: "Consumer App", description: "Customer-facing mobile app — KYC, payments, wallet" },
  merchantApp: { label: "Merchant App", description: "Merchant-facing mobile app — sales, settlements, reports" },
  physicalTerminal: { label: "Physical Terminals", description: "Card POS devices — tap, insert, swipe" },
  phonePos: { label: "Phone POS (SoftPOS)", description: "Merchant phone as terminal via NFC" },
  nfcClosedLoop: { label: "NFC Closed-Loop", description: "Faya's own NFC payment system" },
  onlineCheckout: { label: "Online Checkout", description: "E-commerce / web payment gateway" },
};

export type MerchantStatus =
  | "onboarding"
  | "active"
  | "restricted"
  | "suspended"
  | "closed";

export type ConsumerStatus =
  | "pending_kyc"
  | "active"
  | "restricted"
  | "suspended"
  | "closed";

export type KycTier = "tier_1" | "tier_2" | "tier_3";

export interface Merchant {
  id: string;
  merchantCode: string; // human-readable e.g. FAY-NG-M-00123
  legalName: string;
  tradingName: string;
  businessType: string;
  industry: string;
  countryCode: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  kybStatus: KybStatus;
  kybCaseId: string | null;
  riskCategory: RiskLevel;
  status: MerchantStatus;
  platforms: PlatformKey[]; // which platforms this merchant uses
  terminalCount: number;
  phonePosCount: number;
  lifetimeVolume: number;
  monthlyVolume: number;
  transactionCount: number;
  chargebackRate: number; // percentage
  settlementCurrency: string;
  createdAt: number;
  updatedAt: number;
  notes: string;
}

export interface Consumer {
  id: string;
  consumerCode?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  middleName?: string;
  email: string;
  phone?: string;
  countryCode?: string;
  countryOfResidence?: string;
  nationality?: string;
  dateOfBirth?: string;
  kycStatus?: KycStatus;
  kycTier?: KycTier;
  kycCaseId?: string | null;
  riskScore?: number;
  status?: ConsumerStatus | string;
  platforms?: PlatformKey[];
  lifetimeVolume?: number;
  monthlyVolume?: number;
  transactionCount?: number;
  walletBalance?: number;
  currency?: string;
  createdAt?: number;
  updatedAt?: number;
  notes?: string;
  gender?: string;
  referralCode?: string;
  acceptedTerms?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  residencyStatus?: string;
  [key: string]: unknown; // Allow extra fields from the app
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

/* ============================================================ */
/* Full back-office types (per Faya Admin Portal Requirements)  */
/* ============================================================ */

/** POS Staff — merchant cashiers operating terminals/SoftPOS (Faya POS app users) */
export interface PosStaff {
  id: string;
  staffCode: string;
  merchantId: string;
  merchantName: string;
  branchName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  pinHash: string;
  role: "cashier" | "supervisor" | "branch_manager";
  deviceAssigned: string | null;
  countryCode: string;
  status: "active" | "suspended" | "removed";
  lastLoginAt: number | null;
  transactionsToday: number;
  createdAt: number;
  updatedAt: number;
}

export type CardType = "virtual" | "physical";
export type CardStatus = "pending" | "active" | "frozen" | "blocked" | "expired" | "terminated" | "replaced";
export type CardScheme = "visa" | "mastercard" | "verve";

export interface Card {
  id: string;
  cardId: string;
  userId: string;
  userName: string;
  countryCode: string;
  type: CardType;
  scheme: CardScheme;
  last4: string;
  status: CardStatus;
  currency: string;
  provider: string;
  providerCardId: string;
  spendLimitDaily: number;
  spendLimitMonthly: number;
  frozen: boolean;
  tokenized: boolean;
  walletProvisioned: boolean;
  expiryMonth: string;
  expiryYear: string;
  createdAt: number;
  updatedAt: number;
}

export type WalletStatus = "active" | "frozen" | "closed";

export interface Wallet {
  id: string;
  walletId: string;
  userId: string;
  userName: string;
  countryCode: string;
  currency: string;
  balance: number;
  availableBalance: number;
  heldBalance: number;
  status: WalletStatus;
  linkedCardIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type TransactionType =
  | "card_payment" | "nfc_payment" | "wallet_debit" | "wallet_credit"
  | "refund" | "reversal" | "merchant_payment" | "settlement"
  | "fee" | "chargeback" | "adjustment" | "topup";

export type TransactionStatus =
  | "pending" | "authorized" | "successful" | "failed"
  | "reversed" | "refunded" | "held";

export interface Transaction {
  id: string;
  reference: string;
  userId: string | null;
  userName: string;
  merchantId: string | null;
  merchantName: string | null;
  countryCode: string;
  amount: number;
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  paymentMethod: string;
  cardLast4: string | null;
  deviceSerial: string | null;
  riskScore: number;
  authorizationCode: string | null;
  responseCode: string | null;
  providerReference: string | null;
  settlementStatus: "pending" | "settled" | "held" | "failed" | null;
  disputeStatus: "none" | "open" | "won" | "lost" | null;
  createdAt: number;
}

export type DocumentType =
  | "user_id" | "selfie_liveness" | "proof_of_address" | "bvn_nin_verification"
  | "business_registration" | "tax_certificate" | "merchant_licence"
  | "beneficial_owner" | "settlement_bank_proof" | "dispute_evidence";

export interface UserDocument {
  id: string;
  documentType: DocumentType;
  entityType: "consumer" | "merchant";
  entityId: string;
  entityName: string;
  countryCode: string;
  fileName: string;
  mimeType: string;
  uploadedAt: number;
  status: "pending" | "approved" | "rejected" | "expired" | "replacement_requested";
  reviewedBy: string | null;
  reviewedAt: number | null;
  notes: string;
}

export type PolicyType =
  | "consumer_terms" | "merchant_terms" | "pos_terms" | "privacy_policy"
  | "cardholder_agreement" | "virtual_card_terms" | "physical_card_terms"
  | "nfc_payment_terms" | "merchant_acquiring_agreement" | "settlement_terms"
  | "refund_policy" | "chargeback_policy" | "cookie_policy"
  | "data_processing_agreement" | "country_legal_notice";

export type PolicyStatus = "draft" | "pending_approval" | "published" | "scheduled" | "archived";

export interface LegalPolicy {
  id: string;
  title: string;
  policyType: PolicyType;
  countryCode: string | null;
  appAffected: "faya_pay" | "faya_business" | "faya_pos" | "all";
  version: string;
  status: PolicyStatus;
  effectiveDate: number;
  expiryDate: number | null;
  contentBody: string;
  summaryOfChanges: string;
  createdBy: string;
  approvedBy: string | null;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface AppContent {
  id: string;
  contentKey: string;
  title: string;
  body: string;
  app: "faya_pay" | "faya_business" | "faya_pos" | "admin";
  countryCode: string | null;
  language: string;
  version: string;
  status: "draft" | "pending_approval" | "published" | "archived";
  createdBy: string;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export type NotificationChannel = "push" | "email" | "sms" | "in_app" | "security_alert";
export type NotificationAudience =
  | "all_consumers" | "consumers_by_country" | "merchants_by_country"
  | "pos_staff" | "admin_staff" | "kyc_pending" | "card_users"
  | "suspended_accounts" | "high_risk_accounts";

export interface NotificationCampaign {
  id: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  audience: NotificationAudience;
  countryCode: string | null;
  scheduledAt: number | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
  sentCount: number;
  failedCount: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface Fee {
  id: string;
  countryCode: string;
  product: string;
  feeType: string;
  percentage: number | null;
  fixedAmount: number | null;
  currency: string;
  effectiveDate: number;
  status: "active" | "inactive";
  createdAt: number;
  updatedAt: number;
}

export interface Limit {
  id: string;
  countryCode: string;
  product: string;
  limitType: string;
  kycTier: KycTier | "all";
  riskLevel: RiskLevel | "all";
  maxAmount: number;
  currency: string;
  status: "active" | "inactive";
  createdAt: number;
  updatedAt: number;
}

export interface ProviderLog {
  id: string;
  provider: string;
  status: "operational" | "degraded" | "outage";
  uptime: number;
  errorRate: number;
  lastSuccessAt: number;
  lastErrorAt: number | null;
  apiLatencyMs: number;
  webhookFailures: number;
  retryQueue: number;
  notes: string;
  updatedAt: number;
}

export interface WebhookLog {
  id: string;
  provider: string;
  eventType: string;
  entityId: string;
  payloadStatus: "received" | "processed" | "failed" | "replayed";
  receivedAt: number;
  processedAt: number | null;
  retryCount: number;
  errorMessage: string | null;
}

export interface SystemSettings {
  id: string;
  platformName: string;
  supportedCountries: string[];
  supportedCurrencies: string[];
  enabledProducts: string[];
  maintenanceMode: boolean;
  minAppVersionFayaPay: string;
  minAppVersionFayaBusiness: string;
  minAppVersionFayaPos: string;
  contactEmail: string;
  supportSlaHours: number;
  termsVersion: string;
  privacyVersion: string;
  riskThresholdHigh: number;
  riskThresholdCritical: number;
  cardProvider: string;
  kycProvider: string;
  settlementProvider: string;
  updatedAt: number;
  updatedBy: string;
}

/* ============================================================ */
/* POS Device Request — terminal/phone POS approval workflow    */
/* ============================================================ */

/**
 * A POS device request submitted when a merchant orders a terminal or
 * activates phone POS. The Faya POS app sends device capability info
 * to the admin portal for approval.
 *
 * Approval rule: the device MUST support at least one of:
 *   - NFC (nfcSupported)
 *   - Card reader / chip (cardReaderSupported)
 *   - Swipe / magnetic stripe (swipeSupported)
 *
 * If NONE of these are available, the request is AUTOMATICALLY DECLINED.
 */
export interface PosDeviceRequest {
  id: string;
  requestCode: string; // e.g. POS-REQ-NG-00001
  merchantId: string;
  merchantName: string;
  merchantCode?: string; // e.g. FAY-NG-M-31946 (optional — POS app may omit)
  countryCode: string;
  type: "physical_terminal" | "phone_pos";
  requestedAt: number;

  // Device capabilities reported by the Faya POS app
  deviceInfo: {
    deviceModel: string; // e.g. "Ingenico Move 2500" or "Samsung Galaxy A14"
    osVersion: string; // e.g. "Android 13"
    appVersion: string; // Faya POS app version
    // Capability checks — the POS app runs these on first login
    nfcSupported: boolean;
    cardReaderSupported: boolean; // chip/EMR reader
    swipeSupported: boolean; // magnetic stripe
    deviceIntegrityPassed: boolean; // rooted/jailbroken check
    screenLockEnabled: boolean;
    batteryLevel: number; // percentage
  };

  // Derived: at least one payment method must be available
  canBeApproved: boolean;

  status: "pending" | "approved" | "declined" | "auto_declined";
  reviewedBy: string | null;
  reviewedAt: number | null;
  declineReason: string | null;
  notes: string;
  // Provenance: "faya_pos_app" (via API route) | "pos_app_direct" (POS app
  // wrote directly to Firestore in its own schema) | undefined (legacy)
  source?: string;
  createdAt: number;
  updatedAt: number;
}

/* ============================================================ */
/* Stock / Inventory — physical items Faya provides to users    */
/* ============================================================ */

/**
 * Physical items in Faya's inventory. Merchants request terminals
 * (free provision — no purchase/rental). Physical cards cost money.
 * The POS app and phone POS are free downloads — no stock needed.
 */
export type StockItemType = "physical_terminal" | "physical_card";
export type StockItemStatus = "in_stock" | "allocated" | "shipped" | "delivered" | "damaged" | "lost";

export interface StockItem {
  id: string;
  serialNumber: string;
  type: StockItemType;
  model: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  countryCode: string;
  status: StockItemStatus;
  allocatedToId: string | null;
  allocatedToName: string | null;
  allocatedAt: number | null;
  shippedAt: number | null;
  deliveredAt: number | null;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export type StockOrderStatus = "pending" | "fulfilled" | "shipped" | "delivered" | "cancelled";

export interface StockOrder {
  id: string;
  orderCode: string;
  userType: "consumer" | "merchant";
  userId: string;
  userName: string;
  countryCode: string;
  itemType: StockItemType;
  model: string;
  unitPrice: number;
  deliveryFee: number;
  totalAmount: number;
  currency: string;
  status: StockOrderStatus;
  deliveryAddress: string;
  stockItemId: string | null;
  notes: string;
  createdAt: number;
  updatedAt: number;
}
