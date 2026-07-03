/**
 * Faya Admin Portal — Seed data
 * Static reference data derived from the spec (departments, roles, permissions, countries).
 * Seeded into Firestore on first run if collections are empty.
 */
import type {
  Department,
  Role,
  Permission,
  CountryConfig,
  AdminStaff,
  KycCase,
  KybCase,
  FraudAlert,
  Settlement,
  SupportTicket,
  Dispute,
  Terminal,
  AuditLog,
  ApprovalRequest,
  Merchant,
  Consumer,
  PosStaff,
  Card,
  Wallet,
  Transaction,
  UserDocument,
  LegalPolicy,
  AppContent,
  NotificationCampaign,
  Fee,
  Limit,
  ProviderLog,
  WebhookLog,
  SystemSettings,
  PosDeviceRequest,
  StockItem,
  StockOrder,
} from "./types";

const now = () => Date.now();
const days = (n: number) => n * 24 * 60 * 60 * 1000;
const hours = (n: number) => n * 60 * 60 * 1000;

export const SEED_DEPARTMENTS: Department[] = [
  { id: "dept_super_admin", name: "Super Admin", description: "Highest internal access — founders, CTO, Head of Ops.", status: "active", createdAt: now(), updatedAt: now() },
  { id: "dept_country_admin", name: "Country Admin", description: "Manages one or more assigned countries.", status: "active", createdAt: now(), updatedAt: now() },
  { id: "dept_compliance", name: "Compliance", description: "KYC, KYB, sanctions, PEP, AML, regulatory review.", status: "active", createdAt: now(), updatedAt: now() },
  { id: "dept_risk_fraud", name: "Risk & Fraud", description: "Transaction risk, fraud patterns, chargebacks, watchlists.", status: "active", createdAt: now(), updatedAt: now() },
  { id: "dept_merchant_ops", name: "Merchant Operations", description: "Merchant onboarding, support, terminal requests.", status: "active", createdAt: now(), updatedAt: now() },
  { id: "dept_device_ops", name: "Terminal & Device Operations", description: "Physical terminals, SoftPOS, logistics, blocking.", status: "active", createdAt: now(), updatedAt: now() },
  { id: "dept_finance", name: "Finance & Settlement", description: "Settlements, reconciliation, fees, reserves.", status: "active", createdAt: now(), updatedAt: now() },
  { id: "dept_support", name: "Customer Support", description: "Customer & merchant tickets, disputes, escalations.", status: "active", createdAt: now(), updatedAt: now() },
  { id: "dept_disputes", name: "Disputes & Chargebacks", description: "Card disputes, chargebacks, evidence handling.", status: "active", createdAt: now(), updatedAt: now() },
  { id: "dept_engineering", name: "Engineering & Tech Ops", description: "System health, logs (masked), integration status.", status: "active", createdAt: now(), updatedAt: now() },
  { id: "dept_legal", name: "Legal & Regulatory", description: "Regulator requests, legal holds, DPO, country reporting.", status: "active", createdAt: now(), updatedAt: now() },
];

export const SEED_ROLES: Role[] = [
  // Super Admin
  { id: "role_super_admin", departmentId: "dept_super_admin", name: "Super Admin", description: "Full global access. Founders / CTO / Head of Ops only.", riskLevel: "critical", status: "active", createdAt: now(), updatedAt: now() },
  // Country Admin
  { id: "role_country_admin", departmentId: "dept_country_admin", name: "Country Admin", description: "Manages assigned country operations.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  // Compliance
  { id: "role_kyc_reviewer", departmentId: "dept_compliance", name: "KYC Reviewer", description: "Reviews customer identity submissions.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_kyb_reviewer", departmentId: "dept_compliance", name: "KYB Reviewer", description: "Reviews merchant business submissions.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_senior_compliance", departmentId: "dept_compliance", name: "Senior Compliance Analyst", description: "High-risk approvals, escalations.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_compliance_manager", departmentId: "dept_compliance", name: "Compliance Manager", description: "Manages compliance team & queues.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_aml_investigator", departmentId: "dept_compliance", name: "AML Investigator", description: "AML cases, SAR/STR escalation.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_sanctions_pep", departmentId: "dept_compliance", name: "Sanctions/PEP Analyst", description: "Sanctions & PEP screening.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_reg_reporting", departmentId: "dept_compliance", name: "Regulatory Reporting Officer", description: "Regulatory reports & submissions.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  // Risk & Fraud
  { id: "role_fraud_analyst", departmentId: "dept_risk_fraud", name: "Fraud Analyst", description: "Fraud alerts, device risk, restrictions.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_risk_analyst", departmentId: "dept_risk_fraud", name: "Risk Analyst", description: "Transaction risk, holds.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_fraud_manager", departmentId: "dept_risk_fraud", name: "Fraud Manager", description: "Manages fraud team.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_device_risk", departmentId: "dept_risk_fraud", name: "Device Risk Analyst", description: "Suspicious device detection.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  // Merchant Ops
  { id: "role_merchant_support", departmentId: "dept_merchant_ops", name: "Merchant Support Agent", description: "Merchant support tickets.", riskLevel: "low", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_merchant_onboarding", departmentId: "dept_merchant_ops", name: "Merchant Onboarding Agent", description: "Merchant onboarding flow.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_terminal_ops", departmentId: "dept_merchant_ops", name: "Terminal Operations Agent", description: "Terminal requests & assignment.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_merchant_ops_manager", departmentId: "dept_merchant_ops", name: "Merchant Operations Manager", description: "Manages merchant ops team.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  // Device Ops
  { id: "role_device_support", departmentId: "dept_device_ops", name: "Device Support Agent", description: "Device inventory & support.", riskLevel: "low", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_terminal_logistics", departmentId: "dept_device_ops", name: "Terminal Logistics Agent", description: "Shipping & delivery.", riskLevel: "low", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_terminal_activation", departmentId: "dept_device_ops", name: "Terminal Activation Agent", description: "Terminal activation.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_device_ops_manager", departmentId: "dept_device_ops", name: "Device Operations Manager", description: "Manages device ops team.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  // Finance
  { id: "role_settlement_analyst", departmentId: "dept_finance", name: "Settlement Analyst", description: "Settlement batches & failures.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_reconciliation", departmentId: "dept_finance", name: "Reconciliation Analyst", description: "Reconciliation reports.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_finance_manager", departmentId: "dept_finance", name: "Finance Manager", description: "Manages finance team.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_fee_ops", departmentId: "dept_finance", name: "Fee Operations Analyst", description: "Fees & reserves.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  // Support
  { id: "role_customer_support", departmentId: "dept_support", name: "Customer Support Agent", description: "Customer tickets.", riskLevel: "low", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_support_supervisor", departmentId: "dept_support", name: "Support Supervisor", description: "Support team supervisor.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_support_manager", departmentId: "dept_support", name: "Support Manager", description: "Manages support team.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_dispute_support", departmentId: "dept_support", name: "Dispute Support Agent", description: "Dispute handling within support.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  // Disputes
  { id: "role_dispute_analyst", departmentId: "dept_disputes", name: "Dispute Analyst", description: "Card disputes & evidence.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_dispute_manager", departmentId: "dept_disputes", name: "Dispute Manager", description: "Manages dispute team.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  // Engineering
  { id: "role_dev_readonly", departmentId: "dept_engineering", name: "Developer Read Only", description: "System health & masked logs.", riskLevel: "low", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_devops", departmentId: "dept_engineering", name: "DevOps Engineer", description: "Deployments & integrations.", riskLevel: "medium", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_security_engineer", departmentId: "dept_engineering", name: "Security Engineer", description: "Security monitoring.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  // Legal
  { id: "role_legal_officer", departmentId: "dept_legal", name: "Legal Officer", description: "Legal holds & requests.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_regulatory_officer", departmentId: "dept_legal", name: "Regulatory Officer", description: "Regulator submissions.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
  { id: "role_dpo", departmentId: "dept_legal", name: "Data Protection Officer", description: "Data protection & privacy.", riskLevel: "high", status: "active", createdAt: now(), updatedAt: now() },
];

export const SEED_PERMISSIONS: Permission[] = [
  // KYC
  { id: "perm_kyc_view_country", key: "kyc.view.country", resource: "kyc", action: "view", scope: "country", description: "View customer KYC cases", status: "active" },
  { id: "perm_kyc_approve_country", key: "kyc.approve.country", resource: "kyc", action: "approve", scope: "country", description: "Approve KYC", status: "active" },
  { id: "perm_kyc_reject_country", key: "kyc.reject.country", resource: "kyc", action: "reject", scope: "country", description: "Reject KYC", status: "active" },
  { id: "perm_kyc_request_docs_country", key: "kyc.request_documents.country", resource: "kyc", action: "request_documents", scope: "country", description: "Request additional KYC documents", status: "active" },
  { id: "perm_kyc_escalate_country", key: "kyc.escalate.country", resource: "kyc", action: "escalate", scope: "country", description: "Escalate KYC case", status: "active" },
  // KYB
  { id: "perm_kyb_view_country", key: "kyb.view.country", resource: "kyb", action: "view", scope: "country", description: "View merchant KYB cases", status: "active" },
  { id: "perm_kyb_approve_country", key: "kyb.approve.country", resource: "kyb", action: "approve", scope: "country", description: "Approve KYB", status: "active" },
  { id: "perm_kyb_reject_country", key: "kyb.reject.country", resource: "kyb", action: "reject", scope: "country", description: "Reject KYB", status: "active" },
  { id: "perm_kyb_request_docs_country", key: "kyb.request_documents.country", resource: "kyb", action: "request_documents", scope: "country", description: "Request additional KYB documents", status: "active" },
  // Sanctions/PEP
  { id: "perm_sanctions_review_country", key: "sanctions.review.country", resource: "sanctions", action: "review", scope: "country", description: "Run sanctions/PEP review", status: "active" },
  // Account
  { id: "perm_account_restrict_country", key: "account.restrict.country", resource: "account", action: "restrict", scope: "country", description: "Freeze/restrict account", status: "active" },
  // Merchant
  { id: "perm_merchant_view_country", key: "merchant.view.country", resource: "merchant", action: "view", scope: "country", description: "View merchants", status: "active" },
  { id: "perm_merchant_restrict_country", key: "merchant.restrict.country", resource: "merchant", action: "restrict", scope: "country", description: "Restrict merchant", status: "active" },
  // Settlement
  { id: "perm_settlement_view_country", key: "settlement.view.country", resource: "settlement", action: "view", scope: "country", description: "View settlements", status: "active" },
  { id: "perm_settlement_hold_country", key: "settlement.hold.country", resource: "settlement", action: "hold", scope: "country", description: "Hold settlement (needs approval)", status: "active" },
  { id: "perm_settlement_export_country", key: "settlement.export.country", resource: "settlement", action: "export", scope: "country", description: "Export settlement reports", status: "active" },
  // Reconciliation
  { id: "perm_recon_view_country", key: "reconciliation.view.country", resource: "reconciliation", action: "view", scope: "country", description: "View reconciliation", status: "active" },
  // Fees
  { id: "perm_fees_view_country", key: "fees.view.country", resource: "fees", action: "view", scope: "country", description: "View fee breakdown", status: "active" },
  // Staff
  { id: "perm_staff_create_country", key: "staff.create.country", resource: "staff", action: "create", scope: "country", description: "Create country staff", status: "active" },
  { id: "perm_staff_manage_global", key: "staff.manage.global", resource: "staff", action: "manage", scope: "global", description: "Manage all staff globally", status: "active" },
  // Country
  { id: "perm_country_configure_global", key: "country.configure.global", resource: "country", action: "configure", scope: "global", description: "Configure country rules", status: "active" },
  // Device
  { id: "perm_device_view_country", key: "device.view.country", resource: "device", action: "view", scope: "country", description: "View devices", status: "active" },
  { id: "perm_device_block_country", key: "device.block.country", resource: "device", action: "block", scope: "country", description: "Block device", status: "active" },
  { id: "perm_terminal_assign_country", key: "terminal.assign.country", resource: "terminal", action: "assign", scope: "country", description: "Assign terminal", status: "active" },
  // Support
  { id: "perm_support_view_country", key: "support.view.country", resource: "support", action: "view", scope: "country", description: "View support tickets", status: "active" },
  { id: "perm_support_respond_country", key: "support.respond.country", resource: "support", action: "respond", scope: "country", description: "Respond to tickets", status: "active" },
  // Risk
  { id: "perm_risk_view_country", key: "risk.view.country", resource: "risk", action: "view", scope: "country", description: "View risk alerts", status: "active" },
  { id: "perm_risk_escalate_country", key: "risk.escalate.country", resource: "risk", action: "escalate", scope: "country", description: "Escalate risk case", status: "active" },
  // Audit
  { id: "perm_audit_view_global", key: "audit.view.global", resource: "audit", action: "view", scope: "global", description: "View audit logs", status: "active" },
  // Approval
  { id: "perm_approval_view_global", key: "approval.view.global", resource: "approval", action: "view", scope: "global", description: "View approval requests", status: "active" },
  { id: "perm_approval_decide_global", key: "approval.decide.global", resource: "approval", action: "decide", scope: "global", description: "Approve/reject requests", status: "active" },
];

export const SEED_COUNTRIES: CountryConfig[] = [
  {
    id: "country_NG", countryCode: "NG", countryName: "Nigeria", currency: "NGN", timezone: "Africa/Lagos", regulator: "CBN", region: "West Africa", status: "live", launchStatus: "Live",
    kycRules: { requiredIdentityNumbers: ["BVN", "NIN"], acceptedDocuments: ["national_id", "passport", "drivers_license", "voters_card", "residence_permit"], livenessRequired: true, proofOfAddress: "risk_based", sanctionsPepRequired: true, minimumAge: 18 },
    kybRules: { businessTypes: ["sole_proprietor", "llc", "public_ltd"], requiredDocs: ["cac_certificate", "memart", "tax_id"], beneficialOwnerRequired: true },
    deviceRules: { physicalTerminal: true, phonePos: true, nfcClosedLoop: true, minAndroidVersion: "8.0", deviceIntegrity: true },
    settlementRules: { cycle: "T+1", currency: "NGN", minAmount: 1000, rollingReserve: "5%" },
    riskRules: { highRiskIndustries: ["gambling", "crypto", "arms"], manualReviewThreshold: 500000 },
    platforms: { consumerApp: true, merchantApp: true, physicalTerminal: true, phonePos: true, nfcClosedLoop: true, onlineCheckout: true },
    activeCustomers: 18420, activeMerchants: 3120, pendingKyc: 240, pendingKyb: 38, highRiskAlerts: 12, activeTerminals: 4280, activePhonePos: 1820, todayTxVolume: 84200000, todayApproved: 14280, todayDeclined: 320, pendingSettlements: 18, heldSettlements: 3, openDisputes: 42, openTickets: 88, complianceAlerts: 7,
    createdAt: now() - days(180), updatedAt: now() - hours(2),
  },
  {
    id: "country_GH", countryCode: "GH", countryName: "Ghana", currency: "GHS", timezone: "Africa/Accra", regulator: "Bank of Ghana", region: "West Africa", status: "live", launchStatus: "Live",
    kycRules: { requiredIdentityNumbers: ["ghana_card_pin"], acceptedDocuments: ["ghana_card", "passport", "drivers_license", "residence_permit"], livenessRequired: true, proofOfAddress: "risk_based", sanctionsPepRequired: true, minimumAge: 18 },
    kybRules: { businessTypes: ["sole_proprietor", "llc"], requiredDocs: ["gra_certificate", "tax_id"], beneficialOwnerRequired: true },
    deviceRules: { physicalTerminal: true, phonePos: true, nfcClosedLoop: true, minAndroidVersion: "8.0", deviceIntegrity: true },
    settlementRules: { cycle: "T+1", currency: "GHS", minAmount: 50, rollingReserve: "5%" },
    riskRules: { highRiskIndustries: ["gambling", "crypto"], manualReviewThreshold: 20000 },
    platforms: { consumerApp: true, merchantApp: true, physicalTerminal: true, phonePos: true, nfcClosedLoop: true, onlineCheckout: true },
    activeCustomers: 6240, activeMerchants: 980, pendingKyc: 88, pendingKyb: 14, highRiskAlerts: 4, activeTerminals: 1240, activePhonePos: 620, todayTxVolume: 1240000, todayApproved: 3120, todayDeclined: 64, pendingSettlements: 6, heldSettlements: 1, openDisputes: 12, openTickets: 28, complianceAlerts: 3,
    createdAt: now() - days(120), updatedAt: now() - hours(5),
  },
  {
    id: "country_KE", countryCode: "KE", countryName: "Kenya", currency: "KES", timezone: "Africa/Nairobi", regulator: "CBK", region: "East Africa", status: "live", launchStatus: "Live",
    kycRules: { requiredIdentityNumbers: ["national_id"], acceptedDocuments: ["national_id", "passport", "drivers_license"], livenessRequired: true, proofOfAddress: "risk_based", sanctionsPepRequired: true, minimumAge: 18 },
    kybRules: { businessTypes: ["sole_proprietor", "llc", "partnership"], requiredDocs: ["kra_pin", "business_permit"], beneficialOwnerRequired: true },
    deviceRules: { physicalTerminal: true, phonePos: true, nfcClosedLoop: false, minAndroidVersion: "8.0", deviceIntegrity: true },
    settlementRules: { cycle: "T+2", currency: "KES", minAmount: 100, rollingReserve: "5%" },
    riskRules: { highRiskIndustries: ["gambling", "crypto"], manualReviewThreshold: 100000 },
    platforms: { consumerApp: true, merchantApp: true, physicalTerminal: true, phonePos: true, nfcClosedLoop: false, onlineCheckout: true },
    activeCustomers: 9820, activeMerchants: 1620, pendingKyc: 140, pendingKyb: 22, highRiskAlerts: 6, activeTerminals: 2100, activePhonePos: 940, todayTxVolume: 24800000, todayApproved: 6240, todayDeclined: 142, pendingSettlements: 9, heldSettlements: 2, openDisputes: 24, openTickets: 52, complianceAlerts: 5,
    createdAt: now() - days(150), updatedAt: now() - hours(3),
  },
  {
    id: "country_ZA", countryCode: "ZA", countryName: "South Africa", currency: "ZAR", timezone: "Africa/Johannesburg", regulator: "SARB", region: "Southern Africa", status: "pilot", launchStatus: "Pilot",
    kycRules: { requiredIdentityNumbers: ["id_number"], acceptedDocuments: ["national_id", "passport", "drivers_license"], livenessRequired: true, proofOfAddress: "required", sanctionsPepRequired: true, minimumAge: 18 },
    kybRules: { businessTypes: ["sole_proprietor", "llc", "public_ltd"], requiredDocs: ["cipro_certificate", "tax_id"], beneficialOwnerRequired: true },
    deviceRules: { physicalTerminal: true, phonePos: true, nfcClosedLoop: false, minAndroidVersion: "8.0", deviceIntegrity: true },
    settlementRules: { cycle: "T+2", currency: "ZAR", minAmount: 100, rollingReserve: "10%" },
    riskRules: { highRiskIndustries: ["gambling", "crypto", "arms"], manualReviewThreshold: 50000 },
    platforms: { consumerApp: true, merchantApp: true, physicalTerminal: true, phonePos: true, nfcClosedLoop: false, onlineCheckout: true },
    activeCustomers: 3120, activeMerchants: 480, pendingKyc: 42, pendingKyb: 8, highRiskAlerts: 2, activeTerminals: 620, activePhonePos: 280, todayTxVolume: 4200000, todayApproved: 1240, todayDeclined: 38, pendingSettlements: 3, heldSettlements: 0, openDisputes: 6, openTickets: 14, complianceAlerts: 1,
    createdAt: now() - days(60), updatedAt: now() - hours(8),
  },
  {
    id: "country_EG", countryCode: "EG", countryName: "Egypt", currency: "EGP", timezone: "Africa/Cairo", regulator: "CBE", region: "North Africa", status: "internal_testing", launchStatus: "Internal Testing",
    kycRules: { requiredIdentityNumbers: ["national_id"], acceptedDocuments: ["national_id", "passport"], livenessRequired: true, proofOfAddress: "risk_based", sanctionsPepRequired: true, minimumAge: 21 },
    kybRules: { businessTypes: ["sole_proprietor", "llc"], requiredDocs: ["commercial_register", "tax_card"], beneficialOwnerRequired: true },
    deviceRules: { physicalTerminal: true, phonePos: false, nfcClosedLoop: false, minAndroidVersion: "8.0", deviceIntegrity: true },
    settlementRules: { cycle: "Manual", currency: "EGP", minAmount: 500, rollingReserve: "10%" },
    riskRules: { highRiskIndustries: ["gambling", "crypto"], manualReviewThreshold: 100000 },
    platforms: { consumerApp: true, merchantApp: true, physicalTerminal: true, phonePos: false, nfcClosedLoop: false, onlineCheckout: false },
    activeCustomers: 480, activeMerchants: 60, pendingKyc: 18, pendingKyb: 4, highRiskAlerts: 0, activeTerminals: 120, activePhonePos: 0, todayTxVolume: 320000, todayApproved: 180, todayDeclined: 12, pendingSettlements: 1, heldSettlements: 0, openDisputes: 2, openTickets: 6, complianceAlerts: 0,
    createdAt: now() - days(20), updatedAt: now() - days(1),
  },
  {
    id: "country_MA", countryCode: "MA", countryName: "Morocco", currency: "MAD", timezone: "Africa/Casablanca", regulator: "Bank Al-Maghrib", region: "North Africa", status: "draft", launchStatus: "Draft",
    kycRules: { requiredIdentityNumbers: ["cin"], acceptedDocuments: ["national_id", "passport"], livenessRequired: true, proofOfAddress: "risk_based", sanctionsPepRequired: true, minimumAge: 18 },
    kybRules: { businessTypes: ["sole_proprietor", "llc"], requiredDocs: ["rc_certificate", "tax_id"], beneficialOwnerRequired: true },
    deviceRules: { physicalTerminal: false, phonePos: true, nfcClosedLoop: false, minAndroidVersion: "8.0", deviceIntegrity: true },
    settlementRules: { cycle: "T+2", currency: "MAD", minAmount: 100, rollingReserve: "5%" },
    riskRules: { highRiskIndustries: ["gambling"], manualReviewThreshold: 30000 },
    platforms: { consumerApp: true, merchantApp: true, physicalTerminal: false, phonePos: true, nfcClosedLoop: false, onlineCheckout: false },
    activeCustomers: 0, activeMerchants: 0, pendingKyc: 0, pendingKyb: 0, highRiskAlerts: 0, activeTerminals: 0, activePhonePos: 0, todayTxVolume: 0, todayApproved: 0, todayDeclined: 0, pendingSettlements: 0, heldSettlements: 0, openDisputes: 0, openTickets: 0, complianceAlerts: 0,
    createdAt: now() - days(5), updatedAt: now() - days(2),
  },
];

// Sample staff (passwordless — they exist as Firestore records; auth handled by Firebase Auth)
// Demo login: superadmin@faya.admin / Admin@123 (created via Firebase console or anonymous fallback)
export const SEED_STAFF: AdminStaff[] = [
  {
    id: "staff_001", firstName: "Amara", lastName: "Okafor", email: "amara.okafor@faya.admin", phone: "+234 801 234 5678",
    departmentId: "dept_super_admin", roleId: "role_super_admin", managerId: null,
    status: "active", mfaEnabled: true, countries: [{ countryCode: "NG", accessLevel: "manage" }, { countryCode: "GH", accessLevel: "manage" }, { countryCode: "KE", accessLevel: "manage" }, { countryCode: "ZA", accessLevel: "manage" }, { countryCode: "EG", accessLevel: "manage" }, { countryCode: "MA", accessLevel: "manage" }],
    regionAccess: ["West Africa", "East Africa", "North Africa", "Southern Africa"],
    permissions: ["staff.manage.global", "country.configure.global", "audit.view.global", "approval.decide.global"],
    lastLoginAt: now() - hours(2), failedLoginCount: 0, createdBy: "system", createdAt: now() - days(180), updatedAt: now() - hours(2),
    notes: "Founders / CTO access",
  },
  {
    id: "staff_002", firstName: "Kwame", lastName: "Mensah", email: "kwame.mensah@faya.admin", phone: "+233 244 556 778",
    departmentId: "dept_country_admin", roleId: "role_country_admin", managerId: "staff_001",
    status: "active", mfaEnabled: true, countries: [{ countryCode: "GH", accessLevel: "manage" }, { countryCode: "NG", accessLevel: "view" }],
    regionAccess: ["West Africa"],
    permissions: ["kyc.view.country", "kyb.view.country", "merchant.view.country", "settlement.view.country", "support.view.country"],
    lastLoginAt: now() - hours(8), failedLoginCount: 0, createdBy: "staff_001", createdAt: now() - days(120), updatedAt: now() - hours(8),
  },
  {
    id: "staff_003", firstName: "Amina", lastName: "Hassan", email: "amina.hassan@faya.admin", phone: "+254 712 345 678",
    departmentId: "dept_compliance", roleId: "role_compliance_manager", managerId: "staff_001",
    status: "active", mfaEnabled: true, countries: [{ countryCode: "KE", accessLevel: "manage" }, { countryCode: "UG", accessLevel: "view" }],
    regionAccess: ["East Africa"],
    permissions: ["kyc.view.country", "kyc.approve.country", "kyc.reject.country", "kyb.view.country", "kyb.approve.country", "kyb.reject.country", "sanctions.review.country", "account.restrict.country"],
    lastLoginAt: now() - hours(4), failedLoginCount: 0, createdBy: "staff_001", createdAt: now() - days(150), updatedAt: now() - hours(4),
  },
  {
    id: "staff_004", firstName: "Thabo", lastName: "Nkosi", email: "thabo.nkosi@faya.admin", phone: "+27 82 123 4567",
    departmentId: "dept_compliance", roleId: "role_kyc_reviewer", managerId: "staff_003",
    status: "active", mfaEnabled: true, countries: [{ countryCode: "ZA", accessLevel: "operate" }],
    regionAccess: [],
    permissions: ["kyc.view.country", "kyc.approve.country", "kyc.reject.country", "kyc.request_documents.country", "kyc.escalate.country"],
    lastLoginAt: now() - hours(1), failedLoginCount: 0, createdBy: "staff_003", createdAt: now() - days(60), updatedAt: now() - hours(1),
  },
  {
    id: "staff_005", firstName: "Chidi", lastName: "Eze", email: "chidi.eze@faya.admin", phone: "+234 803 222 1100",
    departmentId: "dept_risk_fraud", roleId: "role_fraud_analyst", managerId: "staff_001",
    status: "active", mfaEnabled: true, countries: [{ countryCode: "NG", accessLevel: "operate" }],
    regionAccess: ["West Africa"],
    permissions: ["risk.view.country", "risk.escalate.country", "merchant.restrict.country", "account.restrict.country", "device.block.country"],
    lastLoginAt: now() - hours(6), failedLoginCount: 0, createdBy: "staff_001", createdAt: now() - days(90), updatedAt: now() - hours(6),
  },
  {
    id: "staff_006", firstName: "Fatima", lastName: "Bello", email: "fatima.bello@faya.admin", phone: "+234 805 888 9900",
    departmentId: "dept_finance", roleId: "role_settlement_analyst", managerId: "staff_001",
    status: "active", mfaEnabled: true, countries: [{ countryCode: "NG", accessLevel: "operate" }, { countryCode: "GH", accessLevel: "operate" }],
    regionAccess: [],
    permissions: ["settlement.view.country", "settlement.export.country", "reconciliation.view.country", "fees.view.country"],
    lastLoginAt: now() - days(1), failedLoginCount: 0, createdBy: "staff_001", createdAt: now() - days(100), updatedAt: now() - days(1),
  },
  {
    id: "staff_007", firstName: "Grace", lastName: "Adeyemi", email: "grace.adeyemi@faya.admin", phone: "+234 807 444 5566",
    departmentId: "dept_support", roleId: "role_customer_support", managerId: "staff_001",
    status: "active", mfaEnabled: false, countries: [{ countryCode: "NG", accessLevel: "operate" }],
    regionAccess: [],
    permissions: ["support.view.country", "support.respond.country"],
    lastLoginAt: now() - hours(3), failedLoginCount: 0, createdBy: "staff_001", createdAt: now() - days(45), updatedAt: now() - hours(3),
  },
  {
    id: "staff_008", firstName: "Daniel", lastName: "Otieno", email: "daniel.otieno@faya.admin", phone: "+254 722 999 0011",
    departmentId: "dept_merchant_ops", roleId: "role_merchant_onboarding", managerId: "staff_001",
    status: "invited", mfaEnabled: false, countries: [{ countryCode: "KE", accessLevel: "operate" }],
    regionAccess: [],
    permissions: ["merchant.view.country"],
    lastLoginAt: null, failedLoginCount: 0, createdBy: "staff_001", createdAt: now() - days(3), updatedAt: now() - days(3),
  },
  {
    id: "staff_009", firstName: "Zainab", lastName: "Mohammed", email: "zainab.mohammed@faya.admin", phone: "+234 809 333 2244",
    departmentId: "dept_device_ops", roleId: "role_terminal_activation", managerId: "staff_001",
    status: "suspended", mfaEnabled: true, countries: [{ countryCode: "NG", accessLevel: "operate" }],
    regionAccess: [],
    permissions: ["device.view.country", "terminal.assign.country"],
    lastLoginAt: now() - days(14), failedLoginCount: 5, createdBy: "staff_001", createdAt: now() - days(80), updatedAt: now() - days(2),
    notes: "Suspended pending security review — failed logins",
  },
  {
    id: "staff_010", firstName: "Samuel", lastName: "Aboagye", email: "samuel.aboagye@faya.admin", phone: "+233 266 778 990",
    departmentId: "dept_disputes", roleId: "role_dispute_analyst", managerId: "staff_001",
    status: "active", mfaEnabled: true, countries: [{ countryCode: "GH", accessLevel: "operate" }],
    regionAccess: [],
    permissions: ["support.view.country", "support.respond.country"],
    lastLoginAt: now() - hours(12), failedLoginCount: 0, createdBy: "staff_001", createdAt: now() - days(70), updatedAt: now() - hours(12),
  },
];

export const SEED_KYC_CASES: KycCase[] = [
  { id: "kyc_1001", customerName: "Ngozi Eze", countryCode: "NG", nationality: "Nigerian", riskScore: 22, submittedAt: now() - hours(6), requiredDocuments: ["national_id", "selfie_liveness"], status: "pending", assignedReviewer: null, slaDeadline: now() + hours(18), notes: "" },
  { id: "kyc_1002", customerName: "Ibrahim Sani", countryCode: "NG", nationality: "Nigerian", riskScore: 78, submittedAt: now() - hours(12), requiredDocuments: ["passport", "proof_of_address"], status: "in_review", assignedReviewer: "staff_004", slaDeadline: now() + hours(6), notes: "PEP positive — escalate" },
  { id: "kyc_1003", customerName: "Akosua Mensah", countryCode: "GH", nationality: "Ghanaian", riskScore: 15, submittedAt: now() - hours(2), requiredDocuments: ["ghana_card", "selfie_liveness"], status: "pending", assignedReviewer: null, slaDeadline: now() + hours(22), notes: "" },
  { id: "kyc_1004", customerName: "Mwangi Kamau", countryCode: "KE", nationality: "Kenyan", riskScore: 45, submittedAt: now() - hours(24), requiredDocuments: ["national_id", "proof_of_address"], status: "escalated", assignedReviewer: "staff_003", slaDeadline: now() + hours(2), notes: "Sanctions screening triggered — false positive likely" },
  { id: "kyc_1005", customerName: "Lerato Molefe", countryCode: "ZA", nationality: "South African", riskScore: 32, submittedAt: now() - hours(48), requiredDocuments: ["national_id", "selfie_liveness"], status: "approved", assignedReviewer: "staff_004", slaDeadline: now() - hours(24), notes: "Approved — low risk" },
  { id: "kyc_1006", customerName: "Omar Saidi", countryCode: "EG", nationality: "Egyptian", riskScore: 88, submittedAt: now() - hours(36), requiredDocuments: ["national_id", "passport"], status: "rejected", assignedReviewer: "staff_003", slaDeadline: now() - hours(12), notes: "Rejected — invalid ID document" },
];

export const SEED_KYB_CASES: KybCase[] = [
  { id: "kyb_2001", merchantName: "Lagos Foods Ltd", countryCode: "NG", businessType: "Food & Beverage", riskCategory: "low", submittedAt: now() - hours(8), missingDocuments: [], status: "pending", assignedReviewer: null, slaDeadline: now() + hours(40), notes: "" },
  { id: "kyb_2002", merchantName: "Accra Retail Hub", countryCode: "GH", businessType: "Retail", riskCategory: "medium", submittedAt: now() - hours(20), missingDocuments: ["tax_certificate"], status: "in_review", assignedReviewer: "staff_003", slaDeadline: now() + hours(20), notes: "Awaiting tax cert" },
  { id: "kyb_2003", merchantName: "Nairobi Tech Solutions", countryCode: "KE", businessType: "Technology", riskCategory: "high", submittedAt: now() - hours(48), missingDocuments: [], status: "escalated", assignedReviewer: "staff_003", slaDeadline: now() + hours(4), notes: "Crypto-adjacent — senior compliance required" },
  { id: "kyb_2004", merchantName: "Cairo Trade Co", countryCode: "EG", businessType: "Trading", riskCategory: "medium", submittedAt: now() - hours(72), missingDocuments: ["director_id"], status: "pending", assignedReviewer: null, slaDeadline: now() - hours(24), notes: "SLA breached" },
];

export const SEED_FRAUD_ALERTS: FraudAlert[] = [
  { id: "fraud_3001", countryCode: "NG", entityType: "customer", entityName: "Account #NG-88472", trigger: "Velocity rule: 12 tx in 5 min", severity: "high", transactionAmount: 480000, device: "Android / Infinix Hot 12", createdAt: now() - hours(1), status: "open" },
  { id: "fraud_3002", countryCode: "NG", entityType: "device", entityName: "Device IME-9921****", trigger: "Multiple accounts on single device", severity: "critical", transactionAmount: 0, device: "Android / Tecno Spark", createdAt: now() - hours(3), status: "investigating" },
  { id: "fraud_3003", countryCode: "KE", entityType: "merchant", entityName: "QuickMart Nairobi", trigger: "Chargeback rate > 3%", severity: "high", transactionAmount: 124000, device: "Terminal T-3321", createdAt: now() - hours(6), status: "escalated" },
  { id: "fraud_3004", countryCode: "GH", entityType: "customer", entityName: "Account #GH-22109", trigger: "Card testing pattern", severity: "medium", transactionAmount: 2400, device: "iOS / iPhone 11", createdAt: now() - hours(12), status: "closed" },
];

export const SEED_SETTLEMENTS: Settlement[] = [
  { id: "stl_4001", countryCode: "NG", merchantName: "Lagos Foods Ltd", batchId: "BAT-NG-20250626-001", amount: 2840000, currency: "NGN", scheduledAt: now() - hours(2), status: "completed" },
  { id: "stl_4002", countryCode: "NG", merchantName: "Abuja Electronics", batchId: "BAT-NG-20250626-002", amount: 1240000, currency: "NGN", scheduledAt: now() - hours(1), status: "processing" },
  { id: "stl_4003", countryCode: "GH", merchantName: "Accra Retail Hub", batchId: "BAT-GH-20250626-001", amount: 8400, currency: "GHS", scheduledAt: now() + hours(4), status: "pending" },
  { id: "stl_4004", countryCode: "NG", merchantName: "Kano Wholesale", batchId: "BAT-NG-20250625-008", amount: 5600000, currency: "NGN", scheduledAt: now() - hours(26), status: "failed", failureReason: "Bank account name mismatch" },
  { id: "stl_4005", countryCode: "KE", merchantName: "Nairobi Tech Solutions", batchId: "BAT-KE-20250626-003", amount: 480000, currency: "KES", scheduledAt: now() - hours(8), status: "held" },
  { id: "stl_4006", countryCode: "ZA", merchantName: "Cape Mart", batchId: "BAT-ZA-20250626-001", amount: 12400, currency: "ZAR", scheduledAt: now() + hours(8), status: "pending" },
];

export const SEED_TICKETS: SupportTicket[] = [
  { id: "tkt_5001", countryCode: "NG", type: "customer", subject: "Failed transaction — funds debited", requesterName: "Ngozi Eze", priority: "high", status: "open", assignedTo: "staff_007", createdAt: now() - hours(2), updatedAt: now() - hours(1), slaDeadline: now() + hours(2) },
  { id: "tkt_5002", countryCode: "NG", type: "merchant", subject: "Terminal not printing receipts", requesterName: "Lagos Foods Ltd", priority: "medium", status: "in_progress", assignedTo: "staff_007", createdAt: now() - hours(6), updatedAt: now() - hours(2), slaDeadline: now() + hours(6) },
  { id: "tkt_5003", countryCode: "GH", type: "terminal", subject: "Device won't activate", requesterName: "Accra Retail Hub", priority: "urgent", status: "open", assignedTo: null, createdAt: now() - hours(1), updatedAt: now() - hours(1), slaDeadline: now() + hours(1) },
  { id: "tkt_5004", countryCode: "KE", type: "payment", subject: "Refund not received", requesterName: "Mwangi Kamau", priority: "high", status: "waiting", assignedTo: "staff_010", createdAt: now() - hours(18), updatedAt: now() - hours(4), slaDeadline: now() + hours(4) },
  { id: "tkt_5005", countryCode: "ZA", type: "customer", subject: "App crashes on login", requesterName: "Lerato Molefe", priority: "medium", status: "resolved", assignedTo: "staff_007", createdAt: now() - hours(48), updatedAt: now() - hours(24), slaDeadline: now() - hours(24) },
];

export const SEED_DISPUTES: Dispute[] = [
  { id: "dsp_6001", countryCode: "NG", merchantName: "Lagos Foods Ltd", customerName: "Ngozi Eze", amount: 24000, currency: "NGN", reason: "Service not provided", status: "new", deadline: now() + days(7), createdAt: now() - hours(4) },
  { id: "dsp_6002", countryCode: "KE", merchantName: "QuickMart Nairobi", customerName: "Aisha Omar", amount: 8200, currency: "KES", reason: "Fraudulent transaction", status: "awaiting_evidence", deadline: now() + days(3), createdAt: now() - days(4) },
  { id: "dsp_6003", countryCode: "GH", merchantName: "Accra Retail Hub", customerName: "Kofi Asante", amount: 1200, currency: "GHS", reason: "Product not as described", status: "evidence_submitted", deadline: now() + days(10), createdAt: now() - days(6) },
  { id: "dsp_6004", countryCode: "NG", merchantName: "Abuja Electronics", customerName: "Yusuf Bello", amount: 180000, currency: "NGN", reason: "Duplicate charge", status: "won", deadline: now() - days(2), createdAt: now() - days(20) },
];

export const SEED_TERMINALS: Terminal[] = [
  { id: "trm_7001", serialNumber: "FAY-NG-3321-A", countryCode: "NG", merchantName: "Lagos Foods Ltd", model: "Ingenico Move 2500", type: "physical", status: "active", activatedAt: now() - days(120), lastSeenAt: now() - hours(1) },
  { id: "trm_7002", serialNumber: "FAY-NG-3322-B", countryCode: "NG", merchantName: "Abuja Electronics", model: "Ingenico Move 2500", type: "physical", status: "active", activatedAt: now() - days(80), lastSeenAt: now() - hours(2) },
  { id: "trm_7003", serialNumber: "FAY-GH-1101-A", countryCode: "GH", merchantName: "Accra Retail Hub", model: "Verifone V200c", type: "physical", status: "shipped", activatedAt: null, lastSeenAt: null },
  { id: "trm_7004", serialNumber: "FAY-KE-2201-C", countryCode: "KE", merchantName: "Nairobi Tech Solutions", model: "SoftPOS-Android", type: "phone_pos", status: "active", activatedAt: now() - days(30), lastSeenAt: now() - hours(3) },
  { id: "trm_7005", serialNumber: "FAY-NG-3323-D", countryCode: "NG", merchantName: "Kano Wholesale", model: "Ingenico Move 2500", type: "physical", status: "blocked", activatedAt: now() - days(60), lastSeenAt: now() - days(7) },
  { id: "trm_7006", serialNumber: "FAY-ZA-4401-A", countryCode: "ZA", merchantName: "Cape Mart", model: "SoftPOS-Android", type: "phone_pos", status: "delivered", activatedAt: null, lastSeenAt: null },
];

export const SEED_AUDIT_LOGS: AuditLog[] = [
  { id: "log_8001", staffId: "staff_001", staffName: "Amara Okafor", department: "Super Admin", role: "Super Admin", countryCode: null, action: "login", entityType: "auth", entityId: "session_001", ipAddress: "102.89.23.12", deviceFingerprint: "Chrome/Win-9921", createdAt: now() - hours(2) },
  { id: "log_8002", staffId: "staff_003", staffName: "Amina Hassan", department: "Compliance", role: "Compliance Manager", countryCode: "KE", action: "kyc.escalate", entityType: "kyc_case", entityId: "kyc_1004", beforeValue: "in_review", afterValue: "escalated", reason: "Sanctions screening triggered", ipAddress: "41.90.184.22", deviceFingerprint: "Chrome/Mac-7782", createdAt: now() - hours(4) },
  { id: "log_8003", staffId: "staff_004", staffName: "Thabo Nkosi", department: "Compliance", role: "KYC Reviewer", countryCode: "ZA", action: "kyc.approve", entityType: "kyc_case", entityId: "kyc_1005", beforeValue: "in_review", afterValue: "approved", reason: "Low risk — documents valid", ipAddress: "105.27.224.18", deviceFingerprint: "Safari/iOS-6611", createdAt: now() - hours(24) },
  { id: "log_8004", staffId: "staff_005", staffName: "Chidi Eze", department: "Risk & Fraud", role: "Fraud Analyst", countryCode: "NG", action: "account.restrict", entityType: "account", entityId: "NG-88472", beforeValue: "active", afterValue: "restricted", reason: "Velocity rule breach", ipAddress: "102.89.23.44", deviceFingerprint: "Chrome/Win-9921", createdAt: now() - hours(1) },
  { id: "log_8005", staffId: "staff_006", staffName: "Fatima Bello", department: "Finance", role: "Settlement Analyst", countryCode: "NG", action: "settlement.view", entityType: "settlement", entityId: "stl_4001", ipAddress: "102.89.23.55", deviceFingerprint: "Chrome/Win-9921", createdAt: now() - hours(3) },
  { id: "log_8006", staffId: "staff_001", staffName: "Amara Okafor", department: "Super Admin", role: "Super Admin", countryCode: null, action: "staff.suspend", entityType: "staff", entityId: "staff_009", beforeValue: "active", afterValue: "suspended", reason: "Failed login attempts exceeded threshold", ipAddress: "102.89.23.12", deviceFingerprint: "Chrome/Win-9921", createdAt: now() - days(2) },
];

export const SEED_APPROVALS: ApprovalRequest[] = [
  {
    id: "apr_9001", requestedBy: "staff_005", requestedByName: "Chidi Eze", countryCode: "NG",
    action: "settlement.release_hold", entityType: "settlement", entityId: "stl_4005",
    payload: { settlementId: "stl_4005", merchantName: "Nairobi Tech Solutions", amount: 480000, currency: "KES" },
    status: "pending", requiredApprovals: 2, currentApprovals: 1, reason: "Risk review complete — recommend release",
    createdAt: now() - hours(8), updatedAt: now() - hours(4),
    decisions: [{ approvedBy: "staff_003", approvedByName: "Amina Hassan", decision: "approve", note: "Compliance cleared", createdAt: now() - hours(4) }],
  },
  {
    id: "apr_9002", requestedBy: "staff_003", requestedByName: "Amina Hassan", countryCode: "KE",
    action: "kyb.approve.high_risk", entityType: "kyb_case", entityId: "kyb_2003",
    payload: { caseId: "kyb_2003", merchantName: "Nairobi Tech Solutions", riskCategory: "high" },
    status: "pending", requiredApprovals: 2, currentApprovals: 0, reason: "High-risk merchant — crypto-adjacent. Senior approval required.",
    createdAt: now() - hours(12), updatedAt: now() - hours(12),
    decisions: [],
  },
  {
    id: "apr_9003", requestedBy: "staff_002", requestedByName: "Kwame Mensah", countryCode: "GH",
    action: "country.change_kyc_rules", entityType: "country_config", entityId: "country_GH",
    payload: { field: "minimumAge", before: 18, after: 16 },
    status: "pending", requiredApprovals: 2, currentApprovals: 0, reason: "Regulatory update — Bank of Ghana guidance",
    createdAt: now() - hours(24), updatedAt: now() - hours(24),
    decisions: [],
  },
];

/* ------------------------------ Merchants ------------------------------ */
/* Merchants across all countries. Each merchant's platforms align with the
 * country's enabled platforms — country rules cut across all of them. */
export const SEED_MERCHANTS: Merchant[] = [
  // Nigeria
  { id: "mch_NG_001", merchantCode: "FAY-NG-M-00001", legalName: "Lagos Foods Limited", tradingName: "Lagos Foods", businessType: "llc", industry: "Food & Beverage", countryCode: "NG", contactEmail: "ops@lagosfoods.ng", contactPhone: "+234 801 111 0001", address: "12 Marina Road, Victoria Island", city: "Lagos", ownerName: "Chinedu Eze", ownerEmail: "chinedu@lagosfoods.ng", ownerPhone: "+234 801 111 0002", kybStatus: "approved", kybCaseId: "kyb_2001", riskCategory: "low", status: "active", platforms: ["consumerApp", "merchantApp", "physicalTerminal", "phonePos", "nfcClosedLoop", "onlineCheckout"], terminalCount: 4, phonePosCount: 2, lifetimeVolume: 184000000, monthlyVolume: 12400000, transactionCount: 84200, chargebackRate: 0.4, settlementCurrency: "NGN", createdAt: now() - days(180), updatedAt: now() - hours(2), notes: "Flagship merchant — low risk" },
  { id: "mch_NG_002", merchantCode: "FAY-NG-M-00002", legalName: "Abuja Electronics Plc", tradingName: "Abuja Electronics", businessType: "public_ltd", industry: "Electronics Retail", countryCode: "NG", contactEmail: "finance@abujaelectronics.ng", contactPhone: "+234 802 222 0001", address: "45 Wuse 2 Market", city: "Abuja", ownerName: "Aisha Bello", ownerEmail: "aisha@abujaelectronics.ng", ownerPhone: "+234 802 222 0002", kybStatus: "approved", kybCaseId: null, riskCategory: "medium", status: "active", platforms: ["merchantApp", "physicalTerminal", "onlineCheckout"], terminalCount: 6, phonePosCount: 0, lifetimeVolume: 96000000, monthlyVolume: 6800000, transactionCount: 41200, chargebackRate: 1.2, settlementCurrency: "NGN", createdAt: now() - days(150), updatedAt: now() - hours(8), notes: "" },
  { id: "mch_NG_003", merchantCode: "FAY-NG-M-00003", legalName: "Kano Wholesale Trade", tradingName: "Kano Wholesale", businessType: "llc", industry: "Wholesale", countryCode: "NG", contactEmail: "info@kanowholesale.ng", contactPhone: "+234 803 333 0001", address: "78 Sabon Gari Market", city: "Kano", ownerName: "Yusuf Ibrahim", ownerEmail: "yusuf@kanowholesale.ng", ownerPhone: "+234 803 333 0002", kybStatus: "approved", kybCaseId: null, riskCategory: "medium", status: "restricted", platforms: ["merchantApp", "physicalTerminal"], terminalCount: 3, phonePosCount: 0, lifetimeVolume: 220000000, monthlyVolume: 14000000, transactionCount: 38400, chargebackRate: 2.8, settlementCurrency: "NGN", createdAt: now() - days(120), updatedAt: now() - days(3), notes: "Restricted — chargeback rate above threshold" },
  { id: "mch_NG_004", merchantCode: "FAY-NG-M-00004", legalName: "Port Harcourt Pharma", tradingName: "PH Pharma", businessType: "llc", industry: "Pharmacy", countryCode: "NG", contactEmail: "legal@phpharma.ng", contactPhone: "+234 804 444 0001", address: "23 Aba Road", city: "Port Harcourt", ownerName: "Ngozi Obi", ownerEmail: "ngozi@phpharma.ng", ownerPhone: "+234 804 444 0002", kybStatus: "in_review", kybCaseId: "kyb_2001", riskCategory: "high", status: "onboarding", platforms: ["merchantApp", "physicalTerminal", "onlineCheckout"], terminalCount: 0, phonePosCount: 0, lifetimeVolume: 0, monthlyVolume: 0, transactionCount: 0, chargebackRate: 0, settlementCurrency: "NGN", createdAt: now() - days(7), updatedAt: now() - hours(12), notes: "Onboarding — high-risk industry" },
  { id: "mch_NG_005", merchantCode: "FAY-NG-M-00005", legalName: "Ibadan Fashion Hub", tradingName: "Ibadan Fashion", businessType: "sole_proprietor", industry: "Fashion Retail", countryCode: "NG", contactEmail: "sales@ibadanfashion.ng", contactPhone: "+234 805 555 0001", address: "5 Bodija Market", city: "Ibadan", ownerName: "Funke Adeyemi", ownerEmail: "funke@ibadanfashion.ng", ownerPhone: "+234 805 555 0002", kybStatus: "approved", kybCaseId: null, riskCategory: "low", status: "active", platforms: ["merchantApp", "phonePos", "onlineCheckout"], terminalCount: 0, phonePosCount: 3, lifetimeVolume: 12400000, monthlyVolume: 1800000, transactionCount: 8400, chargebackRate: 0.6, settlementCurrency: "NGN", createdAt: now() - days(60), updatedAt: now() - days(1), notes: "" },

  // Ghana
  { id: "mch_GH_001", merchantCode: "FAY-GH-M-00001", legalName: "Accra Retail Hub Ltd", tradingName: "Accra Retail Hub", businessType: "llc", industry: "Retail", countryCode: "GH", contactEmail: "ops@accraretail.gh", contactPhone: "+233 244 111 0001", address: "34 Osu Oxford Street", city: "Accra", ownerName: "Kofi Asante", ownerEmail: "kofi@accraretail.gh", ownerPhone: "+233 244 111 0002", kybStatus: "in_review", kybCaseId: "kyb_2002", riskCategory: "medium", status: "active", platforms: ["consumerApp", "merchantApp", "physicalTerminal", "phonePos", "onlineCheckout"], terminalCount: 3, phonePosCount: 2, lifetimeVolume: 24000000, monthlyVolume: 3200000, transactionCount: 18400, chargebackRate: 1.1, settlementCurrency: "GHS", createdAt: now() - days(110), updatedAt: now() - hours(5), notes: "Awaiting tax certificate" },
  { id: "mch_GH_002", merchantCode: "FAY-GH-M-00002", legalName: "Kumasi Market Traders", tradingName: "Kumasi Market", businessType: "sole_proprietor", industry: "Market Trade", countryCode: "GH", contactEmail: "info@kumasimarket.gh", contactPhone: "+233 245 222 0001", address: "Kejetia Market", city: "Kumasi", ownerName: "Ama Serwaa", ownerEmail: "ama@kumasimarket.gh", ownerPhone: "+233 245 222 0002", kybStatus: "approved", kybCaseId: null, riskCategory: "low", status: "active", platforms: ["merchantApp", "phonePos"], terminalCount: 0, phonePosCount: 8, lifetimeVolume: 8400000, monthlyVolume: 1200000, transactionCount: 14200, chargebackRate: 0.3, settlementCurrency: "GHS", createdAt: now() - days(90), updatedAt: now() - hours(20), notes: "Phone POS only — market traders" },
  { id: "mch_GH_003", merchantCode: "FAY-GH-M-00003", legalName: "Takoradi Logistics Co", tradingName: "Takoradi Logistics", businessType: "llc", industry: "Logistics", countryCode: "GH", contactEmail: "finance@takoradilogistics.gh", contactPhone: "+233 246 333 0001", address: "12 Harbour Road", city: "Takoradi", ownerName: "Yaw Mensah", ownerEmail: "yaw@takoradilogistics.gh", ownerPhone: "+233 246 333 0002", kybStatus: "escalated", kybCaseId: "kyb_2002", riskCategory: "high", status: "restricted", platforms: ["merchantApp", "physicalTerminal", "onlineCheckout"], terminalCount: 2, phonePosCount: 0, lifetimeVolume: 42000000, monthlyVolume: 2800000, transactionCount: 9800, chargebackRate: 3.4, settlementCurrency: "GHS", createdAt: now() - days(75), updatedAt: now() - days(2), notes: "Escalated — sanctions screening" },

  // Kenya
  { id: "mch_KE_001", merchantCode: "FAY-KE-M-00001", legalName: "Nairobi Tech Solutions Ltd", tradingName: "Nairobi Tech", businessType: "llc", industry: "Technology", countryCode: "KE", contactEmail: "finance@nairobitech.ke", contactPhone: "+254 712 111 0001", address: "45 Westlands", city: "Nairobi", ownerName: "Mwangi Kamau", ownerEmail: "mwangi@nairobitech.ke", ownerPhone: "+254 712 111 0002", kybStatus: "escalated", kybCaseId: "kyb_2003", riskCategory: "high", status: "restricted", platforms: ["merchantApp", "physicalTerminal", "phonePos", "onlineCheckout"], terminalCount: 2, phonePosCount: 4, lifetimeVolume: 88000000, monthlyVolume: 6400000, transactionCount: 22400, chargebackRate: 1.8, settlementCurrency: "KES", createdAt: now() - days(100), updatedAt: now() - hours(4), notes: "Escalated — crypto-adjacent business" },
  { id: "mch_KE_002", merchantCode: "FAY-KE-M-00002", legalName: "Mombasa Beach Hotels", tradingName: "Mombasa Hotels", businessType: "public_ltd", industry: "Hospitality", countryCode: "KE", contactEmail: "reservations@mombasahotels.ke", contactPhone: "+254 713 222 0001", address: "78 Nyali Beach", city: "Mombasa", ownerName: "Aisha Omar", ownerEmail: "aisha@mombasahotels.ke", ownerPhone: "+254 713 222 0002", kybStatus: "approved", kybCaseId: null, riskCategory: "medium", status: "active", platforms: ["consumerApp", "merchantApp", "physicalTerminal", "onlineCheckout"], terminalCount: 12, phonePosCount: 0, lifetimeVolume: 156000000, monthlyVolume: 12400000, transactionCount: 38800, chargebackRate: 0.9, settlementCurrency: "KES", createdAt: now() - days(140), updatedAt: now() - hours(6), notes: "Seasonal volume" },
  { id: "mch_KE_003", merchantCode: "FAY-KE-M-00003", legalName: "QuickMart Nairobi", tradingName: "QuickMart", businessType: "llc", industry: "Supermarket", countryCode: "KE", contactEmail: "ops@quickmart.ke", contactPhone: "+254 714 333 0001", address: "23 Thika Road", city: "Nairobi", ownerName: "Daniel Otieno", ownerEmail: "daniel@quickmart.ke", ownerPhone: "+254 714 333 0002", kybStatus: "approved", kybCaseId: null, riskCategory: "medium", status: "active", platforms: ["merchantApp", "physicalTerminal", "phonePos", "onlineCheckout"], terminalCount: 8, phonePosCount: 2, lifetimeVolume: 220000000, monthlyVolume: 18000000, transactionCount: 64200, chargebackRate: 1.4, settlementCurrency: "KES", createdAt: now() - days(160), updatedAt: now() - hours(3), notes: "High-volume merchant" },
  { id: "mch_KE_004", merchantCode: "FAY-KE-M-00004", legalName: "Eldoret Agri Co-op", tradingName: "Eldoret Agri", businessType: "partnership", industry: "Agriculture", countryCode: "KE", contactEmail: "info@eldoretagri.ke", contactPhone: "+254 715 444 0001", address: "67 Uganda Road", city: "Eldoret", ownerName: "Grace Wanjiru", ownerEmail: "grace@eldoretagri.ke", ownerPhone: "+254 715 444 0002", kybStatus: "approved", kybCaseId: null, riskCategory: "low", status: "active", platforms: ["merchantApp", "phonePos"], terminalCount: 0, phonePosCount: 5, lifetimeVolume: 32000000, monthlyVolume: 2800000, transactionCount: 12400, chargebackRate: 0.2, settlementCurrency: "KES", createdAt: now() - days(70), updatedAt: now() - days(1), notes: "" },

  // South Africa
  { id: "mch_ZA_001", merchantCode: "FAY-ZA-M-00001", legalName: "Cape Mart Pty Ltd", tradingName: "Cape Mart", businessType: "llc", industry: "Retail", countryCode: "ZA", contactEmail: "finance@capemart.za", contactPhone: "+27 82 111 0001", address: "89 Long Street", city: "Cape Town", ownerName: "Lerato Molefe", ownerEmail: "lerato@capemart.za", ownerPhone: "+27 82 111 0002", kybStatus: "approved", kybCaseId: null, riskCategory: "low", status: "active", platforms: ["consumerApp", "merchantApp", "physicalTerminal", "phonePos", "onlineCheckout"], terminalCount: 4, phonePosCount: 3, lifetimeVolume: 48000000, monthlyVolume: 4200000, transactionCount: 18400, chargebackRate: 0.7, settlementCurrency: "ZAR", createdAt: now() - days(55), updatedAt: now() - hours(8), notes: "" },
  { id: "mch_ZA_002", merchantCode: "FAY-ZA-M-00002", legalName: "Joburg E-Commerce Ltd", tradingName: "Joburg E-Com", businessType: "llc", industry: "E-commerce", countryCode: "ZA", contactEmail: "ops@joburgecom.za", contactPhone: "+27 83 222 0001", address: "12 Sandton", city: "Johannesburg", ownerName: "Sipho Nkosi", ownerEmail: "sipho@joburgecom.za", ownerPhone: "+27 83 222 0002", kybStatus: "in_review", kybCaseId: null, riskCategory: "medium", status: "onboarding", platforms: ["merchantApp", "onlineCheckout"], terminalCount: 0, phonePosCount: 0, lifetimeVolume: 0, monthlyVolume: 0, transactionCount: 0, chargebackRate: 0, settlementCurrency: "ZAR", createdAt: now() - days(10), updatedAt: now() - hours(20), notes: "Online-only merchant" },

  // Egypt
  { id: "mch_EG_001", merchantCode: "FAY-EG-M-00001", legalName: "Cairo Trade Company", tradingName: "Cairo Trade", businessType: "llc", industry: "Trading", countryCode: "EG", contactEmail: "finance@cairotrade.eg", contactPhone: "+20 100 111 0001", address: "34 Tahrir Square", city: "Cairo", ownerName: "Omar Saidi", ownerEmail: "omar@cairotrade.eg", ownerPhone: "+20 100 111 0002", kybStatus: "pending", kybCaseId: "kyb_2004", riskCategory: "medium", status: "onboarding", platforms: ["merchantApp", "physicalTerminal"], terminalCount: 0, phonePosCount: 0, lifetimeVolume: 0, monthlyVolume: 0, transactionCount: 0, chargebackRate: 0, settlementCurrency: "EGP", createdAt: now() - days(15), updatedAt: now() - days(2), notes: "Awaiting director ID" },
  { id: "mch_EG_002", merchantCode: "FAY-EG-M-00002", legalName: "Alexandria Grocers", tradingName: "Alex Grocers", businessType: "sole_proprietor", industry: "Grocery", countryCode: "EG", contactEmail: "info@alexgrocers.eg", contactPhone: "+20 101 222 0001", address: "67 Corniche", city: "Alexandria", ownerName: "Fatima Zahra", ownerEmail: "fatima@alexgrocers.eg", ownerPhone: "+20 101 222 0002", kybStatus: "approved", kybCaseId: null, riskCategory: "low", status: "active", platforms: ["merchantApp", "physicalTerminal"], terminalCount: 2, phonePosCount: 0, lifetimeVolume: 8400000, monthlyVolume: 1200000, transactionCount: 9800, chargebackRate: 0.4, settlementCurrency: "EGP", createdAt: now() - days(18), updatedAt: now() - days(1), notes: "" },
];

/* ------------------------------ Consumers ------------------------------ */
/* Consumers (customers) across all countries. KYC status reflects the
 * country's KYC rules — admins see and action all consumers. */
export const SEED_CONSUMERS: Consumer[] = [
  // Nigeria
  { id: "csm_NG_001", consumerCode: "FAY-NG-C-00001", firstName: "Ngozi", lastName: "Eze", email: "ngozi.eze@gmail.com", phone: "+234 801 222 3331", countryCode: "NG", nationality: "Nigerian", dateOfBirth: "1990-04-12", kycStatus: "pending", kycTier: "tier_1", kycCaseId: "kyc_1001", riskScore: 22, status: "pending_kyc", platforms: ["consumerApp", "nfcClosedLoop"], lifetimeVolume: 0, monthlyVolume: 0, transactionCount: 0, walletBalance: 0, currency: "NGN", createdAt: now() - hours(6), updatedAt: now() - hours(6), notes: "" },
  { id: "csm_NG_002", consumerCode: "FAY-NG-C-00002", firstName: "Ibrahim", lastName: "Sani", email: "ibrahim.sani@yahoo.com", phone: "+234 802 333 4442", countryCode: "NG", nationality: "Nigerian", dateOfBirth: "1985-08-23", kycStatus: "in_review", kycTier: "tier_2", kycCaseId: "kyc_1002", riskScore: 78, status: "active", platforms: ["consumerApp", "nfcClosedLoop", "onlineCheckout"], lifetimeVolume: 2400000, monthlyVolume: 180000, transactionCount: 142, walletBalance: 12400, currency: "NGN", createdAt: now() - days(60), updatedAt: now() - hours(12), notes: "PEP positive — under review" },
  { id: "csm_NG_003", consumerCode: "FAY-NG-C-00003", firstName: "Adebayo", lastName: "Ogun", email: "adebayo.ogun@gmail.com", phone: "+234 803 444 5553", countryCode: "NG", nationality: "Nigerian", dateOfBirth: "1992-11-05", kycStatus: "approved", kycTier: "tier_3", kycCaseId: null, riskScore: 12, status: "active", platforms: ["consumerApp", "nfcClosedLoop", "onlineCheckout"], lifetimeVolume: 8400000, monthlyVolume: 620000, transactionCount: 380, walletBalance: 45000, currency: "NGN", createdAt: now() - days(120), updatedAt: now() - hours(2), notes: "High-value customer" },
  { id: "csm_NG_004", consumerCode: "FAY-NG-C-00004", firstName: "Chioma", lastName: "Nwosu", email: "chioma.nwosu@gmail.com", phone: "+234 804 555 6664", countryCode: "NG", nationality: "Nigerian", dateOfBirth: "1995-02-18", kycStatus: "approved", kycTier: "tier_2", kycCaseId: null, riskScore: 28, status: "active", platforms: ["consumerApp", "nfcClosedLoop"], lifetimeVolume: 1200000, monthlyVolume: 84000, transactionCount: 96, walletBalance: 8200, currency: "NGN", createdAt: now() - days(45), updatedAt: now() - hours(8), notes: "" },
  { id: "csm_NG_005", consumerCode: "FAY-NG-C-00005", firstName: "Tunde", lastName: "Bakare", email: "tunde.bakare@yahoo.com", phone: "+234 805 666 7775", countryCode: "NG", nationality: "Nigerian", dateOfBirth: "1988-07-30", kycStatus: "rejected", kycTier: "tier_1", kycCaseId: null, riskScore: 92, status: "restricted", platforms: ["consumerApp"], lifetimeVolume: 240000, monthlyVolume: 0, transactionCount: 8, walletBalance: 0, currency: "NGN", createdAt: now() - days(30), updatedAt: now() - days(5), notes: "Rejected — invalid ID document" },

  // Ghana
  { id: "csm_GH_001", consumerCode: "FAY-GH-C-00001", firstName: "Akosua", lastName: "Mensah", email: "akosua.mensah@gmail.com", phone: "+233 244 555 6661", countryCode: "GH", nationality: "Ghanaian", dateOfBirth: "1993-03-14", kycStatus: "pending", kycTier: "tier_1", kycCaseId: "kyc_1003", riskScore: 15, status: "pending_kyc", platforms: ["consumerApp", "nfcClosedLoop"], lifetimeVolume: 0, monthlyVolume: 0, transactionCount: 0, walletBalance: 0, currency: "GHS", createdAt: now() - hours(2), updatedAt: now() - hours(2), notes: "" },
  { id: "csm_GH_002", consumerCode: "FAY-GH-C-00002", firstName: "Kofi", lastName: "Asante", email: "kofi.asante@gmail.com", phone: "+233 245 666 7772", countryCode: "GH", nationality: "Ghanaian", dateOfBirth: "1989-09-22", kycStatus: "approved", kycTier: "tier_3", kycCaseId: null, riskScore: 18, status: "active", platforms: ["consumerApp", "nfcClosedLoop", "onlineCheckout"], lifetimeVolume: 42000, monthlyVolume: 3400, transactionCount: 220, walletBalance: 1200, currency: "GHS", createdAt: now() - days(90), updatedAt: now() - hours(4), notes: "" },
  { id: "csm_GH_003", consumerCode: "FAY-GH-C-00003", firstName: "Ama", lastName: "Serwaa", email: "ama.serwaa@yahoo.com", phone: "+233 246 777 8883", countryCode: "GH", nationality: "Ghanaian", dateOfBirth: "1996-12-08", kycStatus: "approved", kycTier: "tier_2", kycCaseId: null, riskScore: 24, status: "active", platforms: ["consumerApp", "nfcClosedLoop"], lifetimeVolume: 8400, monthlyVolume: 620, transactionCount: 64, walletBalance: 240, currency: "GHS", createdAt: now() - days(20), updatedAt: now() - hours(10), notes: "" },

  // Kenya
  { id: "csm_KE_001", consumerCode: "FAY-KE-C-00001", firstName: "Mwangi", lastName: "Kamau", email: "mwangi.kamau@gmail.com", phone: "+254 712 888 9991", countryCode: "KE", nationality: "Kenyan", dateOfBirth: "1991-05-17", kycStatus: "escalated", kycTier: "tier_2", kycCaseId: "kyc_1004", riskScore: 45, status: "active", platforms: ["consumerApp", "onlineCheckout"], lifetimeVolume: 180000, monthlyVolume: 14000, transactionCount: 88, walletBalance: 3200, currency: "KES", createdAt: now() - days(75), updatedAt: now() - hours(24), notes: "Sanctions screening — false positive likely" },
  { id: "csm_KE_002", consumerCode: "FAY-KE-C-00002", firstName: "Aisha", lastName: "Omar", email: "aisha.omar@gmail.com", phone: "+254 713 999 0002", countryCode: "KE", nationality: "Kenyan", dateOfBirth: "1994-10-03", kycStatus: "approved", kycTier: "tier_3", kycCaseId: null, riskScore: 14, status: "active", platforms: ["consumerApp", "nfcClosedLoop", "onlineCheckout"], lifetimeVolume: 320000, monthlyVolume: 28000, transactionCount: 184, walletBalance: 8400, currency: "KES", createdAt: now() - days(110), updatedAt: now() - hours(3), notes: "" },
  { id: "csm_KE_003", consumerCode: "FAY-KE-C-00003", firstName: "Brian", lastName: "Otieno", email: "brian.otieno@yahoo.com", phone: "+254 714 111 0003", countryCode: "KE", nationality: "Kenyan", dateOfBirth: "1997-01-25", kycStatus: "approved", kycTier: "tier_1", kycCaseId: null, riskScore: 32, status: "active", platforms: ["consumerApp"], lifetimeVolume: 42000, monthlyVolume: 3200, transactionCount: 42, walletBalance: 1200, currency: "KES", createdAt: now() - days(15), updatedAt: now() - hours(6), notes: "" },
  { id: "csm_KE_004", consumerCode: "FAY-KE-C-00004", firstName: "Wanjiru", lastName: "Mbugua", email: "wanjiru.mbugua@gmail.com", phone: "+254 715 222 0004", countryCode: "KE", nationality: "Kenyan", dateOfBirth: "1987-06-19", kycStatus: "approved", kycTier: "tier_3", kycCaseId: null, riskScore: 8, status: "active", platforms: ["consumerApp", "nfcClosedLoop", "onlineCheckout"], lifetimeVolume: 1240000, monthlyVolume: 96000, transactionCount: 620, walletBalance: 24000, currency: "KES", createdAt: now() - days(140), updatedAt: now() - hours(1), notes: "Top customer" },

  // South Africa
  { id: "csm_ZA_001", consumerCode: "FAY-ZA-C-00001", firstName: "Lerato", lastName: "Molefe", email: "lerato.molefe@gmail.com", phone: "+27 82 333 4441", countryCode: "ZA", nationality: "South African", dateOfBirth: "1990-08-11", kycStatus: "approved", kycTier: "tier_3", kycCaseId: "kyc_1005", riskScore: 32, status: "active", platforms: ["consumerApp", "nfcClosedLoop", "onlineCheckout"], lifetimeVolume: 84000, monthlyVolume: 7200, transactionCount: 240, walletBalance: 3200, currency: "ZAR", createdAt: now() - days(50), updatedAt: now() - hours(24), notes: "" },
  { id: "csm_ZA_002", consumerCode: "FAY-ZA-C-00002", firstName: "Thabo", lastName: "Nkosi", email: "thabo.nkosi@yahoo.com", phone: "+27 83 444 5552", countryCode: "ZA", nationality: "South African", dateOfBirth: "1993-04-27", kycStatus: "approved", kycTier: "tier_2", kycCaseId: null, riskScore: 22, status: "active", platforms: ["consumerApp", "onlineCheckout"], lifetimeVolume: 28000, monthlyVolume: 2400, transactionCount: 88, walletBalance: 800, currency: "ZAR", createdAt: now() - days(30), updatedAt: now() - hours(12), notes: "" },
  { id: "csm_ZA_003", consumerCode: "FAY-ZA-C-00003", firstName: "Sipho", lastName: "Dlamini", email: "sipho.dlamini@gmail.com", phone: "+27 84 555 6663", countryCode: "ZA", nationality: "South African", dateOfBirth: "1995-11-14", kycStatus: "pending", kycTier: "tier_1", kycCaseId: null, riskScore: 18, status: "pending_kyc", platforms: ["consumerApp"], lifetimeVolume: 0, monthlyVolume: 0, transactionCount: 0, walletBalance: 0, currency: "ZAR", createdAt: now() - hours(4), updatedAt: now() - hours(4), notes: "New signup" },

  // Egypt
  { id: "csm_EG_001", consumerCode: "FAY-EG-C-00001", firstName: "Omar", lastName: "Saidi", email: "omar.saidi@gmail.com", phone: "+20 100 222 3331", countryCode: "EG", nationality: "Egyptian", dateOfBirth: "1992-03-09", kycStatus: "approved", kycTier: "tier_2", kycCaseId: null, riskScore: 16, status: "active", platforms: ["consumerApp"], lifetimeVolume: 240000, monthlyVolume: 18000, transactionCount: 120, walletBalance: 4200, currency: "EGP", createdAt: now() - days(18), updatedAt: now() - hours(8), notes: "" },
  { id: "csm_EG_002", consumerCode: "FAY-EG-C-00002", firstName: "Mariam", lastName: "Hassan", email: "mariam.hassan@yahoo.com", phone: "+20 101 333 4442", countryCode: "EG", nationality: "Egyptian", dateOfBirth: "1996-07-21", kycStatus: "in_review", kycTier: "tier_1", kycCaseId: null, riskScore: 38, status: "active", platforms: ["consumerApp"], lifetimeVolume: 18000, monthlyVolume: 1400, transactionCount: 24, walletBalance: 600, currency: "EGP", createdAt: now() - days(8), updatedAt: now() - hours(16), notes: "" },

  // Morocco (draft country — few consumers)
  { id: "csm_MA_001", consumerCode: "FAY-MA-C-00001", firstName: "Youssef", lastName: "Alaoui", email: "youssef.alaoui@gmail.com", phone: "+212 600 111 2221", countryCode: "MA", nationality: "Moroccan", dateOfBirth: "1994-02-28", kycStatus: "pending", kycTier: "tier_1", kycCaseId: null, riskScore: 12, status: "pending_kyc", platforms: ["consumerApp", "phonePos"], lifetimeVolume: 0, monthlyVolume: 0, transactionCount: 0, walletBalance: 0, currency: "MAD", createdAt: now() - hours(12), updatedAt: now() - hours(12), notes: "Early access signup" },
];

/* ------------------------------ POS Staff ------------------------------ */
export const SEED_POS_STAFF: PosStaff[] = [
  { id: "pos_001", staffCode: "POS-NG-M-00001-01", merchantId: "mch_NG_001", merchantName: "Lagos Foods Ltd", branchName: "Victoria Island", firstName: "Emeka", lastName: "Okafor", email: "emeka@lagosfoods.ng", phone: "+234 801 111 0033", pinHash: "pin_hash_001", role: "cashier", deviceAssigned: "FAY-NG-3321-A", countryCode: "NG", status: "active", lastLoginAt: now() - hours(1), transactionsToday: 42, createdAt: now() - days(90), updatedAt: now() - hours(1) },
  { id: "pos_002", staffCode: "POS-NG-M-00001-02", merchantId: "mch_NG_001", merchantName: "Lagos Foods Ltd", branchName: "Victoria Island", firstName: "Chinwe", lastName: "Ade", email: "chinwe@lagosfoods.ng", phone: "+234 801 111 0044", pinHash: "pin_hash_002", role: "supervisor", deviceAssigned: "FAY-NG-3322-B", countryCode: "NG", status: "active", lastLoginAt: now() - hours(3), transactionsToday: 28, createdAt: now() - days(80), updatedAt: now() - hours(3) },
  { id: "pos_003", staffCode: "POS-NG-M-00002-01", merchantId: "mch_NG_002", merchantName: "Abuja Electronics", branchName: "Wuse 2", firstName: "Yusuf", lastName: "Bello", email: "yusuf@abujaelectronics.ng", phone: "+234 802 222 0033", pinHash: "pin_hash_003", role: "cashier", deviceAssigned: null, countryCode: "NG", status: "suspended", lastLoginAt: now() - days(5), transactionsToday: 0, createdAt: now() - days(60), updatedAt: now() - days(2) },
  { id: "pos_004", staffCode: "POS-GH-M-00001-01", merchantId: "mch_GH_001", merchantName: "Accra Retail Hub", branchName: "Osu", firstName: "Kwabena", lastName: "Osei", email: "kwabena@accraretail.gh", phone: "+233 244 111 0033", pinHash: "pin_hash_004", role: "cashier", deviceAssigned: null, countryCode: "GH", status: "active", lastLoginAt: now() - hours(2), transactionsToday: 36, createdAt: now() - days(45), updatedAt: now() - hours(2) },
  { id: "pos_005", staffCode: "POS-KE-M-00003-01", merchantId: "mch_KE_003", merchantName: "QuickMart Nairobi", branchName: "Thika Road", firstName: "Wanjiku", lastName: "Maina", email: "wanjiku@quickmart.ke", phone: "+254 714 333 0033", pinHash: "pin_hash_005", role: "branch_manager", deviceAssigned: null, countryCode: "KE", status: "active", lastLoginAt: now() - hours(4), transactionsToday: 124, createdAt: now() - days(120), updatedAt: now() - hours(4) },
  { id: "pos_006", staffCode: "POS-KE-M-00003-02", merchantId: "mch_KE_003", merchantName: "QuickMart Nairobi", branchName: "Thika Road", firstName: "Joshua", lastName: "Kiprop", email: "joshua@quickmart.ke", phone: "+254 714 333 0044", pinHash: "pin_hash_006", role: "cashier", deviceAssigned: null, countryCode: "KE", status: "active", lastLoginAt: now() - hours(1), transactionsToday: 88, createdAt: now() - days(30), updatedAt: now() - hours(1) },
];

/* -------------------------------- Cards -------------------------------- */
export const SEED_CARDS: Card[] = [
  { id: "card_001", cardId: "FAY-NG-C-00003-V01", userId: "csm_NG_003", userName: "Adebayo Ogun", countryCode: "NG", type: "virtual", scheme: "visa", last4: "4242", status: "active", currency: "NGN", provider: "Paymentology", providerCardId: "pay_card_001", spendLimitDaily: 500000, spendLimitMonthly: 5000000, frozen: false, tokenized: true, walletProvisioned: true, expiryMonth: "08", expiryYear: "27", createdAt: now() - days(100), updatedAt: now() - hours(2) },
  { id: "card_002", cardId: "FAY-NG-C-00003-P01", userId: "csm_NG_003", userName: "Adebayo Ogun", countryCode: "NG", type: "physical", scheme: "mastercard", last4: "5555", status: "active", currency: "NGN", provider: "Paymentology", providerCardId: "pay_card_002", spendLimitDaily: 1000000, spendLimitMonthly: 10000000, frozen: false, tokenized: true, walletProvisioned: true, expiryMonth: "11", expiryYear: "28", createdAt: now() - days(80), updatedAt: now() - days(1) },
  { id: "card_003", cardId: "FAY-NG-C-00002-V01", userId: "csm_NG_002", userName: "Ibrahim Sani", countryCode: "NG", type: "virtual", scheme: "visa", last4: "1234", status: "frozen", currency: "NGN", provider: "Paymentology", providerCardId: "pay_card_003", spendLimitDaily: 200000, spendLimitMonthly: 2000000, frozen: true, tokenized: false, walletProvisioned: false, expiryMonth: "03", expiryYear: "27", createdAt: now() - days(45), updatedAt: now() - hours(12) },
  { id: "card_004", cardId: "FAY-NG-C-00004-V01", userId: "csm_NG_004", userName: "Chioma Nwosu", countryCode: "NG", type: "virtual", scheme: "verve", last4: "9876", status: "active", currency: "NGN", provider: "Paymentology", providerCardId: "pay_card_004", spendLimitDaily: 100000, spendLimitMonthly: 1000000, frozen: false, tokenized: true, walletProvisioned: true, expiryMonth: "06", expiryYear: "28", createdAt: now() - days(30), updatedAt: now() - hours(8) },
  { id: "card_005", cardId: "FAY-NG-C-00005-V01", userId: "csm_NG_005", userName: "Tunde Bakare", countryCode: "NG", type: "virtual", scheme: "visa", last4: "4444", status: "blocked", currency: "NGN", provider: "Paymentology", providerCardId: "pay_card_005", spendLimitDaily: 0, spendLimitMonthly: 0, frozen: true, tokenized: false, walletProvisioned: false, expiryMonth: "01", expiryYear: "27", createdAt: now() - days(20), updatedAt: now() - days(5) },
  { id: "card_006", cardId: "FAY-GH-C-00002-V01", userId: "csm_GH_002", userName: "Kofi Asante", countryCode: "GH", type: "virtual", scheme: "mastercard", last4: "7777", status: "active", currency: "GHS", provider: "Paymentology", providerCardId: "pay_card_006", spendLimitDaily: 5000, spendLimitMonthly: 50000, frozen: false, tokenized: true, walletProvisioned: true, expiryMonth: "09", expiryYear: "27", createdAt: now() - days(70), updatedAt: now() - hours(4) },
  { id: "card_007", cardId: "FAY-KE-C-00002-V01", userId: "csm_KE_002", userName: "Aisha Omar", countryCode: "KE", type: "virtual", scheme: "visa", last4: "2222", status: "active", currency: "KES", provider: "Paymentology", providerCardId: "pay_card_007", spendLimitDaily: 50000, spendLimitMonthly: 500000, frozen: false, tokenized: true, walletProvisioned: true, expiryMonth: "12", expiryYear: "28", createdAt: now() - days(90), updatedAt: now() - hours(3) },
  { id: "card_008", cardId: "FAY-KE-C-00004-V01", userId: "csm_KE_004", userName: "Wanjiru Mbugua", countryCode: "KE", type: "physical", scheme: "mastercard", last4: "8888", status: "active", currency: "KES", provider: "Paymentology", providerCardId: "pay_card_008", spendLimitDaily: 200000, spendLimitMonthly: 2000000, frozen: false, tokenized: true, walletProvisioned: true, expiryMonth: "04", expiryYear: "29", createdAt: now() - days(120), updatedAt: now() - hours(1) },
  { id: "card_009", cardId: "FAY-ZA-C-00001-V01", userId: "csm_ZA_001", userName: "Lerato Molefe", countryCode: "ZA", type: "virtual", scheme: "visa", last4: "3333", status: "active", currency: "ZAR", provider: "Paymentology", providerCardId: "pay_card_009", spendLimitDaily: 10000, spendLimitMonthly: 100000, frozen: false, tokenized: true, walletProvisioned: true, expiryMonth: "07", expiryYear: "27", createdAt: now() - days(40), updatedAt: now() - hours(24) },
  { id: "card_010", cardId: "FAY-EG-C-00001-V01", userId: "csm_EG_001", userName: "Omar Saidi", countryCode: "EG", type: "virtual", scheme: "mastercard", last4: "6666", status: "pending", currency: "EGP", provider: "Paymentology", providerCardId: "pay_card_010", spendLimitDaily: 0, spendLimitMonthly: 0, frozen: false, tokenized: false, walletProvisioned: false, expiryMonth: "02", expiryYear: "28", createdAt: now() - hours(8), updatedAt: now() - hours(8) },
];

/* ------------------------------- Wallets ------------------------------- */
export const SEED_WALLETS: Wallet[] = [
  { id: "wlt_001", walletId: "FAY-NG-W-00003", userId: "csm_NG_003", userName: "Adebayo Ogun", countryCode: "NG", currency: "NGN", balance: 45000, availableBalance: 42000, heldBalance: 3000, status: "active", linkedCardIds: ["card_001", "card_002"], createdAt: now() - days(120), updatedAt: now() - hours(2) },
  { id: "wlt_002", walletId: "FAY-NG-W-00002", userId: "csm_NG_002", userName: "Ibrahim Sani", countryCode: "NG", currency: "NGN", balance: 12400, availableBalance: 12400, heldBalance: 0, status: "frozen", linkedCardIds: ["card_003"], createdAt: now() - days(60), updatedAt: now() - hours(12) },
  { id: "wlt_003", walletId: "FAY-NG-W-00004", userId: "csm_NG_004", userName: "Chioma Nwosu", countryCode: "NG", currency: "NGN", balance: 8200, availableBalance: 8000, heldBalance: 200, status: "active", linkedCardIds: ["card_004"], createdAt: now() - days(45), updatedAt: now() - hours(8) },
  { id: "wlt_004", walletId: "FAY-NG-W-00005", userId: "csm_NG_005", userName: "Tunde Bakare", countryCode: "NG", currency: "NGN", balance: 0, availableBalance: 0, heldBalance: 0, status: "closed", linkedCardIds: [], createdAt: now() - days(30), updatedAt: now() - days(5) },
  { id: "wlt_005", walletId: "FAY-GH-W-00002", userId: "csm_GH_002", userName: "Kofi Asante", countryCode: "GH", currency: "GHS", balance: 1200, availableBalance: 1200, heldBalance: 0, status: "active", linkedCardIds: ["card_006"], createdAt: now() - days(90), updatedAt: now() - hours(4) },
  { id: "wlt_006", walletId: "FAY-KE-W-00002", userId: "csm_KE_002", userName: "Aisha Omar", countryCode: "KE", currency: "KES", balance: 8400, availableBalance: 8000, heldBalance: 400, status: "active", linkedCardIds: ["card_007"], createdAt: now() - days(110), updatedAt: now() - hours(3) },
  { id: "wlt_007", walletId: "FAY-KE-W-00004", userId: "csm_KE_004", userName: "Wanjiru Mbugua", countryCode: "KE", currency: "KES", balance: 24000, availableBalance: 24000, heldBalance: 0, status: "active", linkedCardIds: ["card_008"], createdAt: now() - days(140), updatedAt: now() - hours(1) },
  { id: "wlt_008", walletId: "FAY-ZA-W-00001", userId: "csm_ZA_001", userName: "Lerato Molefe", countryCode: "ZA", currency: "ZAR", balance: 3200, availableBalance: 3200, heldBalance: 0, status: "active", linkedCardIds: ["card_009"], createdAt: now() - days(50), updatedAt: now() - hours(24) },
  { id: "wlt_009", walletId: "FAY-EG-W-00001", userId: "csm_EG_001", userName: "Omar Saidi", countryCode: "EG", currency: "EGP", balance: 4200, availableBalance: 4200, heldBalance: 0, status: "active", linkedCardIds: [], createdAt: now() - days(18), updatedAt: now() - hours(8) },
];

/* ---------------------------- Transactions ----------------------------- */
export const SEED_TRANSACTIONS: Transaction[] = [
  { id: "tx_001", reference: "FAY-NG-T-20260627-00001", userId: "csm_NG_003", userName: "Adebayo Ogun", merchantId: "mch_NG_001", merchantName: "Lagos Foods Ltd", countryCode: "NG", amount: 4500, currency: "NGN", type: "card_payment", status: "successful", paymentMethod: "card", cardLast4: "4242", deviceSerial: "FAY-NG-3321-A", riskScore: 12, authorizationCode: "AUTH001", responseCode: "00", providerReference: "prov_001", settlementStatus: "settled", disputeStatus: "none", createdAt: now() - hours(1) },
  { id: "tx_002", reference: "FAY-NG-T-20260627-00002", userId: "csm_NG_004", userName: "Chioma Nwosu", merchantId: "mch_NG_001", merchantName: "Lagos Foods Ltd", countryCode: "NG", amount: 2800, currency: "NGN", type: "nfc_payment", status: "successful", paymentMethod: "nfc", cardLast4: "9876", deviceSerial: "FAY-NG-3322-B", riskScore: 8, authorizationCode: "AUTH002", responseCode: "00", providerReference: "prov_002", settlementStatus: "pending", disputeStatus: "none", createdAt: now() - hours(2) },
  { id: "tx_003", reference: "FAY-NG-T-20260627-00003", userId: "csm_NG_003", userName: "Adebayo Ogun", merchantId: "mch_NG_002", merchantName: "Abuja Electronics", countryCode: "NG", amount: 85000, currency: "NGN", type: "card_payment", status: "successful", paymentMethod: "card", cardLast4: "4242", deviceSerial: null, riskScore: 22, authorizationCode: "AUTH003", responseCode: "00", providerReference: "prov_003", settlementStatus: "pending", disputeStatus: "none", createdAt: now() - hours(3) },
  { id: "tx_004", reference: "FAY-NG-T-20260627-00004", userId: "csm_NG_002", userName: "Ibrahim Sani", merchantId: null, merchantName: null, countryCode: "NG", amount: 50000, currency: "NGN", type: "wallet_credit", status: "successful", paymentMethod: "bank_transfer", cardLast4: null, deviceSerial: null, riskScore: 45, authorizationCode: null, responseCode: "00", providerReference: "prov_004", settlementStatus: null, disputeStatus: "none", createdAt: now() - hours(4) },
  { id: "tx_005", reference: "FAY-NG-T-20260627-00005", userId: "csm_NG_005", userName: "Tunde Bakare", merchantId: null, merchantName: null, countryCode: "NG", amount: 12000, currency: "NGN", type: "card_payment", status: "failed", paymentMethod: "card", cardLast4: "4444", deviceSerial: null, riskScore: 88, authorizationCode: null, responseCode: "05", providerReference: "prov_005", settlementStatus: null, disputeStatus: "none", createdAt: now() - hours(5) },
  { id: "tx_006", reference: "FAY-NG-T-20260627-00006", userId: "csm_NG_003", userName: "Adebayo Ogun", merchantId: "mch_NG_001", merchantName: "Lagos Foods Ltd", countryCode: "NG", amount: 4500, currency: "NGN", type: "refund", status: "successful", paymentMethod: "card", cardLast4: "4242", deviceSerial: null, riskScore: 5, authorizationCode: "AUTH006", responseCode: "00", providerReference: "prov_006", settlementStatus: "settled", disputeStatus: "none", createdAt: now() - hours(6) },
  { id: "tx_007", reference: "FAY-GH-T-20260627-00001", userId: "csm_GH_002", userName: "Kofi Asante", merchantId: "mch_GH_001", merchantName: "Accra Retail Hub", countryCode: "GH", amount: 120, currency: "GHS", type: "card_payment", status: "successful", paymentMethod: "card", cardLast4: "7777", deviceSerial: null, riskScore: 14, authorizationCode: "AUTH007", responseCode: "00", providerReference: "prov_007", settlementStatus: "pending", disputeStatus: "none", createdAt: now() - hours(7) },
  { id: "tx_008", reference: "FAY-KE-T-20260627-00001", userId: "csm_KE_002", userName: "Aisha Omar", merchantId: "mch_KE_003", merchantName: "QuickMart Nairobi", countryCode: "KE", amount: 3400, currency: "KES", type: "card_payment", status: "successful", paymentMethod: "card", cardLast4: "2222", deviceSerial: null, riskScore: 18, authorizationCode: "AUTH008", responseCode: "00", providerReference: "prov_008", settlementStatus: "settled", disputeStatus: "none", createdAt: now() - hours(8) },
  { id: "tx_009", reference: "FAY-KE-T-20260627-00002", userId: "csm_KE_004", userName: "Wanjiru Mbugua", merchantId: "mch_KE_002", merchantName: "Mombasa Beach Hotels", countryCode: "KE", amount: 28000, currency: "KES", type: "card_payment", status: "successful", paymentMethod: "card", cardLast4: "8888", deviceSerial: null, riskScore: 15, authorizationCode: "AUTH009", responseCode: "00", providerReference: "prov_009", settlementStatus: "pending", disputeStatus: "none", createdAt: now() - hours(10) },
  { id: "tx_010", reference: "FAY-NG-T-20260627-00010", userId: "csm_NG_002", userName: "Ibrahim Sani", merchantId: null, merchantName: null, countryCode: "NG", amount: 24000, currency: "NGN", type: "chargeback", status: "successful", paymentMethod: "card", cardLast4: "1234", deviceSerial: null, riskScore: 78, authorizationCode: null, responseCode: "00", providerReference: "prov_010", settlementStatus: null, disputeStatus: "open", createdAt: now() - hours(12) },
  { id: "tx_011", reference: "FAY-NG-T-20260627-00011", userId: null, userName: "Settlement", merchantId: "mch_NG_001", merchantName: "Lagos Foods Ltd", countryCode: "NG", amount: 2840000, currency: "NGN", type: "settlement", status: "successful", paymentMethod: "bank_transfer", cardLast4: null, deviceSerial: null, riskScore: 0, authorizationCode: null, responseCode: "00", providerReference: "prov_011", settlementStatus: "settled", disputeStatus: "none", createdAt: now() - hours(24) },
  { id: "tx_012", reference: "FAY-ZA-T-20260627-00001", userId: "csm_ZA_001", userName: "Lerato Molefe", merchantId: "mch_ZA_001", merchantName: "Cape Mart", countryCode: "ZA", amount: 450, currency: "ZAR", type: "nfc_payment", status: "successful", paymentMethod: "nfc", cardLast4: "3333", deviceSerial: null, riskScore: 10, authorizationCode: "AUTH012", responseCode: "00", providerReference: "prov_012", settlementStatus: "pending", disputeStatus: "none", createdAt: now() - hours(15) },
];

/* ----------------------------- Documents ------------------------------- */
export const SEED_DOCUMENTS: UserDocument[] = [
  { id: "doc_001", documentType: "user_id", entityType: "consumer", entityId: "csm_NG_001", entityName: "Ngozi Eze", countryCode: "NG", fileName: "national_id_ngozi.pdf", mimeType: "application/pdf", uploadedAt: now() - hours(6), status: "pending", reviewedBy: null, reviewedAt: null, notes: "" },
  { id: "doc_002", documentType: "selfie_liveness", entityType: "consumer", entityId: "csm_NG_001", entityName: "Ngozi Eze", countryCode: "NG", fileName: "selfie_ngozi.jpg", mimeType: "image/jpeg", uploadedAt: now() - hours(6), status: "pending", reviewedBy: null, reviewedAt: null, notes: "" },
  { id: "doc_003", documentType: "user_id", entityType: "consumer", entityId: "csm_NG_002", entityName: "Ibrahim Sani", countryCode: "NG", fileName: "passport_ibrahim.pdf", mimeType: "application/pdf", uploadedAt: now() - hours(12), status: "pending", reviewedBy: "staff_004", reviewedAt: null, notes: "PEP check required" },
  { id: "doc_004", documentType: "proof_of_address", entityType: "consumer", entityId: "csm_NG_002", entityName: "Ibrahim Sani", countryCode: "NG", fileName: "utility_bill_ibrahim.pdf", mimeType: "application/pdf", uploadedAt: now() - hours(12), status: "approved", reviewedBy: "staff_004", reviewedAt: now() - hours(6), notes: "Valid" },
  { id: "doc_005", documentType: "user_id", entityType: "consumer", entityId: "csm_NG_003", entityName: "Adebayo Ogun", countryCode: "NG", fileName: "national_id_adebayo.pdf", mimeType: "application/pdf", uploadedAt: now() - days(120), status: "approved", reviewedBy: "staff_003", reviewedAt: now() - days(119), notes: "Approved — valid" },
  { id: "doc_006", documentType: "business_registration", entityType: "merchant", entityId: "mch_NG_001", entityName: "Lagos Foods Ltd", countryCode: "NG", fileName: "cac_certificate_lagosfoods.pdf", mimeType: "application/pdf", uploadedAt: now() - days(180), status: "approved", reviewedBy: "staff_003", reviewedAt: now() - days(179), notes: "CAC verified" },
  { id: "doc_007", documentType: "tax_certificate", entityType: "merchant", entityId: "mch_GH_001", entityName: "Accra Retail Hub", countryCode: "GH", fileName: "gra_certificate_accraretail.pdf", mimeType: "application/pdf", uploadedAt: now() - days(110), status: "pending", reviewedBy: null, reviewedAt: null, notes: "Awaiting tax cert review" },
  { id: "doc_008", documentType: "business_registration", entityType: "merchant", entityId: "mch_KE_001", entityName: "Nairobi Tech Solutions", countryCode: "KE", fileName: "kra_pin_nairobitech.pdf", mimeType: "application/pdf", uploadedAt: now() - days(100), status: "approved", reviewedBy: "staff_003", reviewedAt: now() - days(99), notes: "Verified" },
  { id: "doc_009", documentType: "settlement_bank_proof", entityType: "merchant", entityId: "mch_NG_003", entityName: "Kano Wholesale", countryCode: "NG", fileName: "bank_proof_kano.pdf", mimeType: "application/pdf", uploadedAt: now() - days(120), status: "approved", reviewedBy: "staff_006", reviewedAt: now() - days(119), notes: "Bank account verified" },
  { id: "doc_010", documentType: "user_id", entityType: "consumer", entityId: "csm_NG_005", entityName: "Tunde Bakare", countryCode: "NG", fileName: "national_id_tunde.pdf", mimeType: "application/pdf", uploadedAt: now() - days(30), status: "rejected", reviewedBy: "staff_003", reviewedAt: now() - days(28), notes: "Invalid document — blurred photo" },
];

/* --------------------------- Legal Policies ---------------------------- */
export const SEED_POLICIES: LegalPolicy[] = [
  { id: "pol_001", title: "Consumer Terms and Conditions", policyType: "consumer_terms", countryCode: null, appAffected: "faya_pay", version: "2.0", status: "published", effectiveDate: now() - days(30), expiryDate: null, contentBody: "These terms govern your use of the Faya Pay consumer payment app...", summaryOfChanges: "Updated wallet limits and NFC payment terms. Added virtual card section.", createdBy: "staff_001", approvedBy: "staff_001", publishedAt: now() - days(30), createdAt: now() - days(35), updatedAt: now() - days(30) },
  { id: "pol_002", title: "Merchant Terms and Conditions", policyType: "merchant_terms", countryCode: null, appAffected: "faya_business", version: "1.5", status: "published", effectiveDate: now() - days(60), expiryDate: null, contentBody: "These terms govern merchant use of Faya Business...", summaryOfChanges: "Updated settlement cycle and chargeback policy.", createdBy: "staff_001", approvedBy: "staff_001", publishedAt: now() - days(60), createdAt: now() - days(65), updatedAt: now() - days(60) },
  { id: "pol_003", title: "Privacy Policy", policyType: "privacy_policy", countryCode: null, appAffected: "all", version: "3.0", status: "published", effectiveDate: now() - days(90), expiryDate: null, contentBody: "This privacy policy describes how Faya collects, uses, and protects your data...", summaryOfChanges: "Comprehensive update for NDPA (Nigeria) and POPIA (South Africa) compliance.", createdBy: "staff_001", approvedBy: "staff_001", publishedAt: now() - days(90), createdAt: now() - days(95), updatedAt: now() - days(90) },
  { id: "pol_004", title: "Cardholder Agreement", policyType: "cardholder_agreement", countryCode: null, appAffected: "faya_pay", version: "1.2", status: "published", effectiveDate: now() - days(45), expiryDate: null, contentBody: "This agreement governs the issuance and use of Faya cards...", summaryOfChanges: "Added virtual card replacement fee section.", createdBy: "staff_001", approvedBy: "staff_001", publishedAt: now() - days(45), createdAt: now() - days(50), updatedAt: now() - days(45) },
  { id: "pol_005", title: "POS Terms of Use", policyType: "pos_terms", countryCode: null, appAffected: "faya_pos", version: "1.0", status: "published", effectiveDate: now() - days(120), expiryDate: null, contentBody: "These terms govern use of the Faya POS application on terminals and SoftPOS devices...", summaryOfChanges: "Initial version.", createdBy: "staff_001", approvedBy: "staff_001", publishedAt: now() - days(120), createdAt: now() - days(125), updatedAt: now() - days(120) },
  { id: "pol_006", title: "Nigeria-Specific Legal Notice", policyType: "country_legal_notice", countryCode: "NG", appAffected: "all", version: "1.1", status: "published", effectiveDate: now() - days(20), expiryDate: null, contentBody: "Faya is licensed by the Central Bank of Nigeria...", summaryOfChanges: "Updated CBN reporting requirements.", createdBy: "staff_001", approvedBy: "staff_001", publishedAt: now() - days(20), createdAt: now() - days(25), updatedAt: now() - days(20) },
  { id: "pol_007", title: "Refund Policy", policyType: "refund_policy", countryCode: null, appAffected: "all", version: "2.0", status: "draft", effectiveDate: now() + days(7), expiryDate: null, contentBody: "This policy describes refund eligibility and processing timelines...", summaryOfChanges: "Updated refund window from 7 to 14 days.", createdBy: "staff_001", approvedBy: null, publishedAt: null, createdAt: now() - days(3), updatedAt: now() - days(1) },
  { id: "pol_008", title: "Virtual Card Terms", policyType: "virtual_card_terms", countryCode: null, appAffected: "faya_pay", version: "1.0", status: "pending_approval", effectiveDate: now() + days(14), expiryDate: null, contentBody: "Terms for virtual card issuance and use...", summaryOfChanges: "Initial virtual card terms.", createdBy: "staff_001", approvedBy: null, publishedAt: null, createdAt: now() - days(5), updatedAt: now() - days(2) },
];

/* ----------------------------- App Content ----------------------------- */
export const SEED_APP_CONTENT: AppContent[] = [
  { id: "cnt_001", contentKey: "consumer.onboarding.welcome", title: "Welcome to Faya Pay", body: "Welcome to Faya Pay! Your money, your way. Send, spend, and save with ease.", app: "faya_pay", countryCode: null, language: "en", version: "1.0", status: "published", createdBy: "staff_001", publishedAt: now() - days(90), createdAt: now() - days(90), updatedAt: now() - days(90) },
  { id: "cnt_002", contentKey: "consumer.kyc.nigeria.bvn_help", title: "BVN Help — Nigeria", body: "Your Bank Verification Number (BVN) is an 11-digit number issued by your bank. Find it on your bank app or by dialing *565*0#.", app: "faya_pay", countryCode: "NG", language: "en", version: "1.1", status: "published", createdBy: "staff_001", publishedAt: now() - days(30), createdAt: now() - days(60), updatedAt: now() - days(30) },
  { id: "cnt_003", contentKey: "consumer.card.reveal_warning", title: "Card Reveal Warning", body: "Make sure no one is looking at your screen before revealing your card details.", app: "faya_pay", countryCode: null, language: "en", version: "1.0", status: "published", createdBy: "staff_001", publishedAt: now() - days(45), createdAt: now() - days(45), updatedAt: now() - days(45) },
  { id: "cnt_004", contentKey: "merchant.terminal.request_intro", title: "Request a Terminal", body: "Need a physical terminal? Request one and we'll deliver it to your business address within 3-5 business days.", app: "faya_business", countryCode: null, language: "en", version: "1.0", status: "published", createdBy: "staff_001", publishedAt: now() - days(70), createdAt: now() - days(70), updatedAt: now() - days(70) },
  { id: "cnt_005", contentKey: "pos.tap_card.instruction", title: "Tap Card Instruction", body: "Ask the customer to tap their card on the terminal. Wait for the green light and beep.", app: "faya_pos", countryCode: null, language: "en", version: "1.0", status: "published", createdBy: "staff_001", publishedAt: now() - days(100), createdAt: now() - days(100), updatedAt: now() - days(100) },
  { id: "cnt_006", contentKey: "consumer.kyc.ghana.ghana_card_help", title: "Ghana Card Help", body: "Your Ghana Card PIN is required for KYC verification. Find it on your Ghana Card.", app: "faya_pay", countryCode: "GH", language: "en", version: "1.0", status: "published", createdBy: "staff_001", publishedAt: now() - days(40), createdAt: now() - days(40), updatedAt: now() - days(40) },
  { id: "cnt_007", contentKey: "admin.login.security_notice", title: "Admin Security Notice", body: "All admin actions are logged. MFA is mandatory. Never share your credentials.", app: "admin", countryCode: null, language: "en", version: "1.0", status: "published", createdBy: "staff_001", publishedAt: now() - days(180), createdAt: now() - days(180), updatedAt: now() - days(180) },
  { id: "cnt_008", contentKey: "consumer.onboarding.welcome_fr", title: "Bienvenue sur Faya Pay", body: "Bienvenue sur Faya Pay ! Votre argent, votre façon. Envoyez, dépensez et économisez facilement.", app: "faya_pay", countryCode: null, language: "fr", version: "1.0", status: "draft", createdBy: "staff_001", publishedAt: null, createdAt: now() - days(5), updatedAt: now() - days(5) },
];

/* -------------------------- Notifications ------------------------------ */
export const SEED_NOTIFICATIONS: NotificationCampaign[] = [
  { id: "ntf_001", title: "Scheduled Maintenance", body: "Faya Pay will be under maintenance on Sunday 2-4 AM. Some services may be unavailable.", channel: "in_app", audience: "all_consumers", countryCode: null, scheduledAt: now() + days(2), status: "scheduled", sentCount: 0, failedCount: 0, createdBy: "staff_001", createdAt: now() - days(1), updatedAt: now() - days(1) },
  { id: "ntf_002", title: "New NFC Payment Feature", body: "You can now pay with a tap! Try NFC payments at participating merchants.", channel: "push", audience: "consumers_by_country", countryCode: "NG", scheduledAt: null, status: "sent", sentCount: 18420, failedCount: 42, createdBy: "staff_001", createdAt: now() - days(10), updatedAt: now() - days(10) },
  { id: "ntf_003", title: "KYC Reminder", body: "Complete your KYC to unlock all features including cards and higher limits.", channel: "push", audience: "kyc_pending", countryCode: null, scheduledAt: null, status: "sent", sentCount: 640, failedCount: 8, createdBy: "staff_001", createdAt: now() - days(5), updatedAt: now() - days(5) },
  { id: "ntf_004", title: "Settlement Ready", body: "Your settlement for this week has been processed. Check your Faya Business app.", channel: "email", audience: "merchants_by_country", countryCode: "NG", scheduledAt: null, status: "sent", sentCount: 3120, failedCount: 12, createdBy: "staff_001", createdAt: now() - days(3), updatedAt: now() - days(3) },
  { id: "ntf_005", title: "Security Alert — Suspicious Login", body: "We detected a login from a new device. If this wasn't you, please secure your account.", channel: "security_alert", audience: "all_consumers", countryCode: null, scheduledAt: null, status: "draft", sentCount: 0, failedCount: 0, createdBy: "staff_001", createdAt: now() - hours(2), updatedAt: now() - hours(2) },
];

/* ------------------------------- Fees ---------------------------------- */
export const SEED_FEES: Fee[] = [
  { id: "fee_001", countryCode: "NG", product: "virtual_card", feeType: "issuance", percentage: null, fixedAmount: 500, currency: "NGN", effectiveDate: now() - days(90), status: "active", createdAt: now() - days(90), updatedAt: now() - days(90) },
  { id: "fee_002", countryCode: "NG", product: "physical_card", feeType: "issuance", percentage: null, fixedAmount: 2500, currency: "NGN", effectiveDate: now() - days(90), status: "active", createdAt: now() - days(90), updatedAt: now() - days(90) },
  { id: "fee_003", countryCode: "NG", product: "merchant_card_acceptance", feeType: "per_transaction", percentage: 1.5, fixedAmount: null, currency: "NGN", effectiveDate: now() - days(90), status: "active", createdAt: now() - days(90), updatedAt: now() - days(90) },
  { id: "fee_004", countryCode: "NG", product: "settlement", feeType: "per_settlement", percentage: 0.5, fixedAmount: null, currency: "NGN", effectiveDate: now() - days(90), status: "active", createdAt: now() - days(90), updatedAt: now() - days(90) },
  { id: "fee_005", countryCode: "NG", product: "chargeback", feeType: "per_chargeback", percentage: null, fixedAmount: 1000, currency: "NGN", effectiveDate: now() - days(90), status: "active", createdAt: now() - days(90), updatedAt: now() - days(90) },
  { id: "fee_006", countryCode: "GH", product: "virtual_card", feeType: "issuance", percentage: null, fixedAmount: 3, currency: "GHS", effectiveDate: now() - days(60), status: "active", createdAt: now() - days(60), updatedAt: now() - days(60) },
  { id: "fee_007", countryCode: "GH", product: "merchant_card_acceptance", feeType: "per_transaction", percentage: 2.0, fixedAmount: null, currency: "GHS", effectiveDate: now() - days(60), status: "active", createdAt: now() - days(60), updatedAt: now() - days(60) },
  { id: "fee_008", countryCode: "KE", product: "merchant_card_acceptance", feeType: "per_transaction", percentage: 1.8, fixedAmount: null, currency: "KES", effectiveDate: now() - days(75), status: "active", createdAt: now() - days(75), updatedAt: now() - days(75) },
  { id: "fee_009", countryCode: "NG", product: "card_replacement", feeType: "issuance", percentage: null, fixedAmount: 1500, currency: "NGN", effectiveDate: now() - days(30), status: "active", createdAt: now() - days(30), updatedAt: now() - days(30) },
  { id: "fee_010", countryCode: "NG", product: "refund", feeType: "per_refund", percentage: null, fixedAmount: 100, currency: "NGN", effectiveDate: now() - days(90), status: "active", createdAt: now() - days(90), updatedAt: now() - days(90) },
];

/* ------------------------------- Limits -------------------------------- */
export const SEED_LIMITS: Limit[] = [
  { id: "lmt_001", countryCode: "NG", product: "wallet", limitType: "daily", kycTier: "tier_1", riskLevel: "all", maxAmount: 50000, currency: "NGN", status: "active", createdAt: now() - days(90), updatedAt: now() - days(90) },
  { id: "lmt_002", countryCode: "NG", product: "wallet", limitType: "daily", kycTier: "tier_2", riskLevel: "all", maxAmount: 200000, currency: "NGN", status: "active", createdAt: now() - days(90), updatedAt: now() - days(90) },
  { id: "lmt_003", countryCode: "NG", product: "wallet", limitType: "daily", kycTier: "tier_3", riskLevel: "all", maxAmount: 1000000, currency: "NGN", status: "active", createdAt: now() - days(90), updatedAt: now() - days(90) },
  { id: "lmt_004", countryCode: "NG", product: "card", limitType: "daily", kycTier: "tier_3", riskLevel: "low", maxAmount: 500000, currency: "NGN", status: "active", createdAt: now() - days(90), updatedAt: now() - days(90) },
  { id: "lmt_005", countryCode: "NG", product: "card", limitType: "monthly", kycTier: "tier_3", riskLevel: "low", maxAmount: 5000000, currency: "NGN", status: "active", createdAt: now() - days(90), updatedAt: now() - days(90) },
  { id: "lmt_006", countryCode: "NG", product: "card", limitType: "daily", kycTier: "tier_3", riskLevel: "high", maxAmount: 100000, currency: "NGN", status: "active", createdAt: now() - days(90), updatedAt: now() - days(90) },
  { id: "lmt_007", countryCode: "NG", product: "pos", limitType: "daily", kycTier: "all", riskLevel: "all", maxAmount: 2000000, currency: "NGN", status: "active", createdAt: now() - days(90), updatedAt: now() - days(90) },
  { id: "lmt_008", countryCode: "NG", product: "merchant", limitType: "per_transaction", kycTier: "all", riskLevel: "all", maxAmount: 5000000, currency: "NGN", status: "active", createdAt: now() - days(90), updatedAt: now() - days(90) },
  { id: "lmt_009", countryCode: "GH", product: "wallet", limitType: "daily", kycTier: "tier_3", riskLevel: "all", maxAmount: 10000, currency: "GHS", status: "active", createdAt: now() - days(60), updatedAt: now() - days(60) },
  { id: "lmt_010", countryCode: "KE", product: "wallet", limitType: "daily", kycTier: "tier_3", riskLevel: "all", maxAmount: 100000, currency: "KES", status: "active", createdAt: now() - days(75), updatedAt: now() - days(75) },
];

/* --------------------------- Provider Logs ----------------------------- */
export const SEED_PROVIDER_LOGS: ProviderLog[] = [
  { id: "prv_001", provider: "Firebase (Firestore)", status: "operational", uptime: 99.98, errorRate: 0.02, lastSuccessAt: now() - 1000, lastErrorAt: now() - hours(12), apiLatencyMs: 45, webhookFailures: 0, retryQueue: 0, notes: "All systems operational", updatedAt: now() - 1000 },
  { id: "prv_002", provider: "Firebase (Auth)", status: "operational", uptime: 99.95, errorRate: 0.05, lastSuccessAt: now() - 500, lastErrorAt: now() - hours(6), apiLatencyMs: 120, webhookFailures: 0, retryQueue: 0, notes: "Operational", updatedAt: now() - 500 },
  { id: "prv_003", provider: "Paymentology (Card Issuer)", status: "degraded", uptime: 98.50, errorRate: 1.5, lastSuccessAt: now() - 5000, lastErrorAt: now() - hours(1), apiLatencyMs: 850, webhookFailures: 3, retryQueue: 2, notes: "Elevated latency on card issuance API", updatedAt: now() - 5000 },
  { id: "prv_004", provider: "KYC Provider (Smile Identity)", status: "operational", uptime: 99.80, errorRate: 0.20, lastSuccessAt: now() - 2000, lastErrorAt: now() - hours(3), apiLatencyMs: 1200, webhookFailures: 1, retryQueue: 0, notes: "Operational", updatedAt: now() - 2000 },
  { id: "prv_005", provider: "SMS Provider (Twilio)", status: "operational", uptime: 99.90, errorRate: 0.10, lastSuccessAt: now() - 800, lastErrorAt: now() - hours(8), apiLatencyMs: 200, webhookFailures: 0, retryQueue: 0, notes: "Operational", updatedAt: now() - 800 },
  { id: "prv_006", provider: "Email Provider (SendGrid)", status: "operational", uptime: 99.95, errorRate: 0.05, lastSuccessAt: now() - 600, lastErrorAt: now() - hours(14), apiLatencyMs: 350, webhookFailures: 0, retryQueue: 0, notes: "Operational", updatedAt: now() - 600 },
  { id: "prv_007", provider: "Push Notifications (FCM)", status: "operational", uptime: 99.99, errorRate: 0.01, lastSuccessAt: now() - 300, lastErrorAt: null, apiLatencyMs: 80, webhookFailures: 0, retryQueue: 0, notes: "Operational", updatedAt: now() - 300 },
  { id: "prv_008", provider: "Settlement Bank (GTBank)", status: "operational", uptime: 99.70, errorRate: 0.30, lastSuccessAt: now() - 4000, lastErrorAt: now() - hours(5), apiLatencyMs: 500, webhookFailures: 2, retryQueue: 1, notes: "Operational", updatedAt: now() - 4000 },
];

/* ---------------------------- Webhook Logs ----------------------------- */
export const SEED_WEBHOOK_LOGS: WebhookLog[] = [
  { id: "whk_001", provider: "Paymentology", eventType: "card.issued", entityId: "card_010", payloadStatus: "processed", receivedAt: now() - hours(2), processedAt: now() - hours(2), retryCount: 0, errorMessage: null },
  { id: "whk_002", provider: "Paymentology", eventType: "transaction.authorization", entityId: "tx_005", payloadStatus: "failed", receivedAt: now() - hours(5), processedAt: null, retryCount: 3, errorMessage: "Timeout processing authorization" },
  { id: "whk_003", provider: "Smile Identity", eventType: "kyc.verification_complete", entityId: "kyc_1001", payloadStatus: "processed", receivedAt: now() - hours(4), processedAt: now() - hours(4), retryCount: 0, errorMessage: null },
  { id: "whk_004", provider: "GTBank", eventType: "settlement.transfer_complete", entityId: "stl_4001", payloadStatus: "processed", receivedAt: now() - hours(24), processedAt: now() - hours(24), retryCount: 0, errorMessage: null },
  { id: "whk_005", provider: "Paymentology", eventType: "card.frozen", entityId: "card_003", payloadStatus: "processed", receivedAt: now() - hours(12), processedAt: now() - hours(12), retryCount: 0, errorMessage: null },
  { id: "whk_006", provider: "Twilio", eventType: "sms.delivered", entityId: "sms_001", payloadStatus: "processed", receivedAt: now() - hours(1), processedAt: now() - hours(1), retryCount: 0, errorMessage: null },
  { id: "whk_007", provider: "Paymentology", eventType: "transaction.chargeback", entityId: "tx_010", payloadStatus: "replayed", receivedAt: now() - hours(13), processedAt: now() - hours(10), retryCount: 2, errorMessage: "Initial processing failed, replayed successfully" },
  { id: "whk_008", provider: "Smile Identity", eventType: "kyc.verification_failed", entityId: "kyc_1006", payloadStatus: "failed", receivedAt: now() - hours(36), processedAt: null, retryCount: 3, errorMessage: "Document image too blurry" },
];

/* -------------------------- System Settings ---------------------------- */
export const SEED_SYSTEM_SETTINGS: SystemSettings = {
  id: "settings_global",
  platformName: "Faya",
  supportedCountries: ["NG", "GH", "KE", "ZA", "EG", "MA"],
  supportedCurrencies: ["NGN", "GHS", "KES", "ZAR", "EGP", "MAD"],
  enabledProducts: ["consumer_app", "merchant_app", "pos", "physical_terminal", "phone_pos", "nfc_closed_loop", "online_checkout", "virtual_card", "physical_card"],
  maintenanceMode: false,
  minAppVersionFayaPay: "2.4.0",
  minAppVersionFayaBusiness: "2.2.0",
  minAppVersionFayaPos: "1.8.0",
  contactEmail: "support@faya.africa",
  supportSlaHours: 24,
  termsVersion: "2.0",
  privacyVersion: "3.0",
  riskThresholdHigh: 60,
  riskThresholdCritical: 80,
  cardProvider: "Paymentology",
  kycProvider: "Smile Identity",
  settlementProvider: "GTBank",
  updatedAt: now() - days(2),
  updatedBy: "staff_001",
};

/* ------------------------ POS Device Requests -------------------------- */
/* When a merchant orders a terminal or activates phone POS, the Faya POS
 * app sends device capability info. Admin approves ONLY if the device
 * supports NFC, card reader, or swipe. If none → auto-decline. */
export const SEED_POS_DEVICE_REQUESTS: PosDeviceRequest[] = [
  {
    id: "posreq_001",
    requestCode: "POS-REQ-NG-00001",
    merchantId: "mch_NG_001",
    merchantName: "Lagos Foods Ltd",
    countryCode: "NG",
    type: "physical_terminal",
    requestedAt: now() - hours(2),
    deviceInfo: {
      deviceModel: "Ingenico Move 2500",
      osVersion: "Ingenico OS 1.4",
      appVersion: "1.8.3",
      nfcSupported: true,
      cardReaderSupported: true,
      swipeSupported: true,
      deviceIntegrityPassed: true,
      screenLockEnabled: true,
      batteryLevel: 95,
    },
    canBeApproved: true,
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    declineReason: null,
    notes: "Merchant requested terminal for Victoria Island branch",
    createdAt: now() - hours(2),
    updatedAt: now() - hours(2),
  },
  {
    id: "posreq_002",
    requestCode: "POS-REQ-NG-00002",
    merchantId: "mch_NG_004",
    merchantName: "Port Harcourt Pharma",
    countryCode: "NG",
    type: "phone_pos",
    requestedAt: now() - hours(5),
    deviceInfo: {
      deviceModel: "Samsung Galaxy A14",
      osVersion: "Android 13",
      appVersion: "1.8.3",
      nfcSupported: true,
      cardReaderSupported: false,
      swipeSupported: false,
      deviceIntegrityPassed: true,
      screenLockEnabled: true,
      batteryLevel: 78,
    },
    canBeApproved: true, // NFC is supported → can approve
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    declineReason: null,
    notes: "Phone POS activation — merchant wants SoftPOS on their phone",
    createdAt: now() - hours(5),
    updatedAt: now() - hours(5),
  },
  {
    id: "posreq_003",
    requestCode: "POS-REQ-GH-00001",
    merchantId: "mch_GH_001",
    merchantName: "Accra Retail Hub",
    countryCode: "GH",
    type: "physical_terminal",
    requestedAt: now() - hours(8),
    deviceInfo: {
      deviceModel: "Verifone V200c",
      osVersion: "Verifone OS 2.1",
      appVersion: "1.8.3",
      nfcSupported: true,
      cardReaderSupported: true,
      swipeSupported: false,
      deviceIntegrityPassed: true,
      screenLockEnabled: true,
      batteryLevel: 88,
    },
    canBeApproved: true,
    status: "approved",
    reviewedBy: "staff_001",
    reviewedAt: now() - hours(4),
    declineReason: null,
    notes: "Approved — device supports NFC + card reader",
    createdAt: now() - hours(8),
    updatedAt: now() - hours(4),
  },
  {
    id: "posreq_004",
    requestCode: "POS-REQ-KE-00001",
    merchantId: "mch_KE_003",
    merchantName: "QuickMart Nairobi",
    countryCode: "KE",
    type: "phone_pos",
    requestedAt: now() - hours(12),
    deviceInfo: {
      deviceModel: "Tecno Spark 10",
      osVersion: "Android 12",
      appVersion: "1.8.3",
      nfcSupported: false,
      cardReaderSupported: false,
      swipeSupported: false,
      deviceIntegrityPassed: true,
      screenLockEnabled: false,
      batteryLevel: 45,
    },
    canBeApproved: false, // No NFC, no card reader, no swipe → AUTO-DECLINE
    status: "auto_declined",
    reviewedBy: null,
    reviewedAt: now() - hours(12),
    declineReason: "Device does not support NFC, card reader, or swipe. Cannot process payments.",
    notes: "Auto-declined: no payment method available on device",
    createdAt: now() - hours(12),
    updatedAt: now() - hours(12),
  },
  {
    id: "posreq_005",
    requestCode: "POS-REQ-NG-00003",
    merchantId: "mch_NG_005",
    merchantName: "Ibadan Fashion Hub",
    countryCode: "NG",
    type: "phone_pos",
    requestedAt: now() - hours(1),
    deviceInfo: {
      deviceModel: "Infinix Hot 30",
      osVersion: "Android 13",
      appVersion: "1.8.3",
      nfcSupported: true,
      cardReaderSupported: false,
      swipeSupported: false,
      deviceIntegrityPassed: false, // Rooted device
      screenLockEnabled: true,
      batteryLevel: 62,
    },
    canBeApproved: true, // NFC supported, but device integrity failed
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    declineReason: null,
    notes: "WARNING: Device integrity check failed (rooted). NFC is supported but device is not secure.",
    createdAt: now() - hours(1),
    updatedAt: now() - hours(1),
  },
  {
    id: "posreq_006",
    requestCode: "POS-REQ-ZA-00001",
    merchantId: "mch_ZA_001",
    merchantName: "Cape Mart",
    countryCode: "ZA",
    type: "physical_terminal",
    requestedAt: now() - days(3),
    deviceInfo: {
      deviceModel: "Ingenico Move 2500",
      osVersion: "Ingenico OS 1.4",
      appVersion: "1.8.2",
      nfcSupported: true,
      cardReaderSupported: true,
      swipeSupported: true,
      deviceIntegrityPassed: true,
      screenLockEnabled: true,
      batteryLevel: 100,
    },
    canBeApproved: true,
    status: "approved",
    reviewedBy: "staff_001",
    reviewedAt: now() - days(2),
    declineReason: null,
    notes: "Approved — full capability terminal",
    createdAt: now() - days(3),
    updatedAt: now() - days(2),
  },
];

/* ------------------------------ Stock / Inventory ------------------------------ */
/* Physical terminals and physical cards in Faya's inventory.
 * Each has a price, description, and image. The POS app and Phone POS are
 * free downloads — no stock needed. Delivery fee is added on order. */
export const SEED_STOCK_ITEMS: StockItem[] = [
  // Nigeria warehouse — physical terminals (card machines)
  { id: "stk_001", serialNumber: "FAY-NG-TERM-0001", type: "physical_terminal", model: "Ingenico Move 2500", description: "Compact NFC + chip + swipe card terminal. Battery 8h, receipt printer, WiFi + 4G.", price: 45000, currency: "NGN", imageUrl: "https://images.unsplash.com/photo-1605234844753-1c0d8c8c3a3a?w=400", countryCode: "NG", status: "allocated", allocatedToId: "mch_NG_001", allocatedToName: "Lagos Foods Ltd", allocatedAt: now() - days(120), shippedAt: now() - days(118), deliveredAt: now() - days(115), notes: "", createdAt: now() - days(180), updatedAt: now() - days(115) },
  { id: "stk_002", serialNumber: "FAY-NG-TERM-0002", type: "physical_terminal", model: "Ingenico Move 2500", description: "Compact NFC + chip + swipe card terminal. Battery 8h, receipt printer, WiFi + 4G.", price: 45000, currency: "NGN", imageUrl: "https://images.unsplash.com/photo-1605234844753-1c0d8c8c3a3a?w=400", countryCode: "NG", status: "allocated", allocatedToId: "mch_NG_002", allocatedToName: "Abuja Electronics", allocatedAt: now() - days(80), shippedAt: now() - days(78), deliveredAt: now() - days(75), notes: "", createdAt: now() - days(180), updatedAt: now() - days(75) },
  { id: "stk_003", serialNumber: "FAY-NG-TERM-0003", type: "physical_terminal", model: "Ingenico Move 2500", description: "Compact NFC + chip + swipe card terminal. Battery 8h, receipt printer, WiFi + 4G.", price: 45000, currency: "NGN", imageUrl: "https://images.unsplash.com/photo-1605234844753-1c0d8c8c3a3a?w=400", countryCode: "NG", status: "allocated", allocatedToId: "mch_NG_003", allocatedToName: "Kano Wholesale", allocatedAt: now() - days(60), shippedAt: now() - days(58), deliveredAt: now() - days(55), notes: "", createdAt: now() - days(180), updatedAt: now() - days(55) },
  { id: "stk_004", serialNumber: "FAY-NG-TERM-0004", type: "physical_terminal", model: "Verifone V200c", description: "Countertop terminal with NFC, chip, swipe. Colour touchscreen, Ethernet + WiFi.", price: 55000, currency: "NGN", imageUrl: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=400", countryCode: "NG", status: "in_stock", allocatedToId: null, allocatedToName: null, allocatedAt: null, shippedAt: null, deliveredAt: null, notes: "", createdAt: now() - days(30), updatedAt: now() - days(30) },
  { id: "stk_005", serialNumber: "FAY-NG-TERM-0005", type: "physical_terminal", model: "Verifone V200c", description: "Countertop terminal with NFC, chip, swipe. Colour touchscreen, Ethernet + WiFi.", price: 55000, currency: "NGN", imageUrl: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=400", countryCode: "NG", status: "in_stock", allocatedToId: null, allocatedToName: null, allocatedAt: null, shippedAt: null, deliveredAt: null, notes: "", createdAt: now() - days(30), updatedAt: now() - days(30) },
  { id: "stk_006", serialNumber: "FAY-NG-TERM-0006", type: "physical_terminal", model: "Ingenico Move 2500", description: "Compact NFC + chip + swipe card terminal. Battery 8h, receipt printer, WiFi + 4G.", price: 45000, currency: "NGN", imageUrl: "https://images.unsplash.com/photo-1605234844753-1c0d8c8c3a3a?w=400", countryCode: "NG", status: "in_stock", allocatedToId: null, allocatedToName: null, allocatedAt: null, shippedAt: null, deliveredAt: null, notes: "", createdAt: now() - days(15), updatedAt: now() - days(15) },
  { id: "stk_007", serialNumber: "FAY-NG-TERM-0007", type: "physical_terminal", model: "PAX S920", description: "Wireless portable terminal. NFC + chip + swipe, 4G, battery 10h.", price: 50000, currency: "NGN", imageUrl: "https://images.unsplash.com/photo-1583912267550-d6c2ac3196c0?w=400", countryCode: "NG", status: "damaged", allocatedToId: null, allocatedToName: null, allocatedAt: null, shippedAt: null, deliveredAt: null, notes: "Screen cracked during transit", createdAt: now() - days(60), updatedAt: now() - days(10) },
  // Nigeria — physical cards
  { id: "stk_013", serialNumber: "FAY-NG-CARD-BATCH01", type: "physical_card", model: "Faya Visa Physical Card", description: "Personalised Visa debit card. Contactless, chip & PIN. Delivered in 5-7 business days.", price: 2500, currency: "NGN", imageUrl: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400", countryCode: "NG", status: "in_stock", allocatedToId: null, allocatedToName: null, allocatedAt: null, shippedAt: null, deliveredAt: null, notes: "Batch of 50 available", createdAt: now() - days(10), updatedAt: now() - days(10) },

  // Ghana warehouse
  { id: "stk_008", serialNumber: "FAY-GH-TERM-0001", type: "physical_terminal", model: "Verifone V200c", description: "Countertop terminal with NFC, chip, swipe. Colour touchscreen, Ethernet + WiFi.", price: 350, currency: "GHS", imageUrl: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=400", countryCode: "GH", status: "allocated", allocatedToId: "mch_GH_001", allocatedToName: "Accra Retail Hub", allocatedAt: now() - days(45), shippedAt: now() - days(43), deliveredAt: null, notes: "In transit", createdAt: now() - days(90), updatedAt: now() - days(43) },
  { id: "stk_009", serialNumber: "FAY-GH-TERM-0002", type: "physical_terminal", model: "Ingenico Move 2500", description: "Compact NFC + chip + swipe card terminal. Battery 8h, receipt printer, WiFi + 4G.", price: 300, currency: "GHS", imageUrl: "https://images.unsplash.com/photo-1605234844753-1c0d8c8c3a3a?w=400", countryCode: "GH", status: "in_stock", allocatedToId: null, allocatedToName: null, allocatedAt: null, shippedAt: null, deliveredAt: null, notes: "", createdAt: now() - days(20), updatedAt: now() - days(20) },
  { id: "stk_014", serialNumber: "FAY-GH-CARD-BATCH01", type: "physical_card", model: "Faya Visa Physical Card", description: "Personalised Visa debit card. Contactless, chip & PIN. Delivered in 5-7 business days.", price: 15, currency: "GHS", imageUrl: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400", countryCode: "GH", status: "in_stock", allocatedToId: null, allocatedToName: null, allocatedAt: null, shippedAt: null, deliveredAt: null, notes: "", createdAt: now() - days(5), updatedAt: now() - days(5) },

  // Kenya warehouse
  { id: "stk_010", serialNumber: "FAY-KE-TERM-0001", type: "physical_terminal", model: "Ingenico Move 2500", description: "Compact NFC + chip + swipe card terminal. Battery 8h, receipt printer, WiFi + 4G.", price: 8500, currency: "KES", imageUrl: "https://images.unsplash.com/photo-1605234844753-1c0d8c8c3a3a?w=400", countryCode: "KE", status: "in_stock", allocatedToId: null, allocatedToName: null, allocatedAt: null, shippedAt: null, deliveredAt: null, notes: "", createdAt: now() - days(10), updatedAt: now() - days(10) },
  { id: "stk_011", serialNumber: "FAY-KE-TERM-0002", type: "physical_terminal", model: "PAX S920", description: "Wireless portable terminal. NFC + chip + swipe, 4G, battery 10h.", price: 9500, currency: "KES", imageUrl: "https://images.unsplash.com/photo-1583912267550-d6c2ac3196c0?w=400", countryCode: "KE", status: "in_stock", allocatedToId: null, allocatedToName: null, allocatedAt: null, shippedAt: null, deliveredAt: null, notes: "", createdAt: now() - days(10), updatedAt: now() - days(10) },
  { id: "stk_015", serialNumber: "FAY-KE-CARD-BATCH01", type: "physical_card", model: "Faya Visa Physical Card", description: "Personalised Visa debit card. Contactless, chip & PIN. Delivered in 5-7 business days.", price: 500, currency: "KES", imageUrl: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400", countryCode: "KE", status: "in_stock", allocatedToId: null, allocatedToName: null, allocatedAt: null, shippedAt: null, deliveredAt: null, notes: "", createdAt: now() - days(3), updatedAt: now() - days(3) },

  // South Africa warehouse
  { id: "stk_012", serialNumber: "FAY-ZA-TERM-0001", type: "physical_terminal", model: "Verifone V200c", description: "Countertop terminal with NFC, chip, swipe. Colour touchscreen, Ethernet + WiFi.", price: 1800, currency: "ZAR", imageUrl: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=400", countryCode: "ZA", status: "in_stock", allocatedToId: null, allocatedToName: null, allocatedAt: null, shippedAt: null, deliveredAt: null, notes: "", createdAt: now() - days(5), updatedAt: now() - days(5) },
  { id: "stk_016", serialNumber: "FAY-ZA-CARD-BATCH01", type: "physical_card", model: "Faya Visa Physical Card", description: "Personalised Visa debit card. Contactless, chip & PIN. Delivered in 5-7 business days.", price: 120, currency: "ZAR", imageUrl: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400", countryCode: "ZA", status: "in_stock", allocatedToId: null, allocatedToName: null, allocatedAt: null, shippedAt: null, deliveredAt: null, notes: "", createdAt: now() - days(2), updatedAt: now() - days(2) },
];

/* --------------------------- Stock Orders ----------------------------- */
/* Orders placed by consumers/merchants for physical items (terminals, cards).
 * Users can only order what's IN STOCK. Delivery fee is included. */
export const SEED_STOCK_ORDERS: StockOrder[] = [
  { id: "sord_001", orderCode: "FAY-ORD-NG-00001", userType: "merchant", userId: "mch_NG_001", userName: "Lagos Foods Ltd", countryCode: "NG", itemType: "physical_terminal", model: "Ingenico Move 2500", unitPrice: 45000, deliveryFee: 2000, totalAmount: 47000, currency: "NGN", status: "delivered", deliveryAddress: "12 Marina Road, Victoria Island, Lagos", stockItemId: "stk_001", notes: "", createdAt: now() - days(120), updatedAt: now() - days(115) },
  { id: "sord_002", orderCode: "FAY-ORD-NG-00002", userType: "merchant", userId: "mch_NG_002", userName: "Abuja Electronics", countryCode: "NG", itemType: "physical_terminal", model: "Ingenico Move 2500", unitPrice: 45000, deliveryFee: 2500, totalAmount: 47500, currency: "NGN", status: "delivered", deliveryAddress: "45 Wuse 2 Market, Abuja", stockItemId: "stk_002", notes: "", createdAt: now() - days(80), updatedAt: now() - days(75) },
  { id: "sord_003", orderCode: "FAY-ORD-NG-00003", userType: "consumer", userId: "csm_NG_003", userName: "Adebayo Ogun", countryCode: "NG", itemType: "physical_card", model: "Faya Visa Physical Card", unitPrice: 2500, deliveryFee: 500, totalAmount: 3000, currency: "NGN", status: "delivered", deliveryAddress: "23 Allen Avenue, Ikeja, Lagos", stockItemId: null, notes: "", createdAt: now() - days(80), updatedAt: now() - days(75) },
  { id: "sord_004", orderCode: "FAY-ORD-GH-00001", userType: "merchant", userId: "mch_GH_001", userName: "Accra Retail Hub", countryCode: "GH", itemType: "physical_terminal", model: "Verifone V200c", unitPrice: 350, deliveryFee: 20, totalAmount: 370, currency: "GHS", status: "shipped", deliveryAddress: "34 Osu Oxford Street, Accra", stockItemId: "stk_008", notes: "In transit", createdAt: now() - days(45), updatedAt: now() - days(43) },
  { id: "sord_005", orderCode: "FAY-ORD-NG-00004", userType: "consumer", userId: "csm_NG_004", userName: "Chioma Nwosu", countryCode: "NG", itemType: "physical_card", model: "Faya Visa Physical Card", unitPrice: 2500, deliveryFee: 500, totalAmount: 3000, currency: "NGN", status: "pending", deliveryAddress: "5 Bodija Market, Ibadan", stockItemId: null, notes: "Awaiting fulfilment", createdAt: now() - days(2), updatedAt: now() - days(2) },
];
