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
    id: "country_NG", countryCode: "NG", countryName: "Nigeria", currency: "NGN", timezone: "Africa/Lagos", regulator: "CBN", status: "live", launchStatus: "Live",
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
    id: "country_GH", countryCode: "GH", countryName: "Ghana", currency: "GHS", timezone: "Africa/Accra", regulator: "Bank of Ghana", status: "live", launchStatus: "Live",
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
    id: "country_KE", countryCode: "KE", countryName: "Kenya", currency: "KES", timezone: "Africa/Nairobi", regulator: "CBK", status: "live", launchStatus: "Live",
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
    id: "country_ZA", countryCode: "ZA", countryName: "South Africa", currency: "ZAR", timezone: "Africa/Johannesburg", regulator: "SARB", status: "pilot", launchStatus: "Pilot",
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
    id: "country_EG", countryCode: "EG", countryName: "Egypt", currency: "EGP", timezone: "Africa/Cairo", regulator: "CBE", status: "internal_testing", launchStatus: "Internal Testing",
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
    id: "country_MA", countryCode: "MA", countryName: "Morocco", currency: "MAD", timezone: "Africa/Casablanca", regulator: "Bank Al-Maghrib", status: "draft", launchStatus: "Draft",
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
    permissions: ["staff.manage.global", "country.configure.global", "audit.view.global", "approval.decide.global"],
    lastLoginAt: now() - hours(2), failedLoginCount: 0, createdBy: "system", createdAt: now() - days(180), updatedAt: now() - hours(2),
    notes: "Founders / CTO access",
  },
  {
    id: "staff_002", firstName: "Kwame", lastName: "Mensah", email: "kwame.mensah@faya.admin", phone: "+233 244 556 778",
    departmentId: "dept_country_admin", roleId: "role_country_admin", managerId: "staff_001",
    status: "active", mfaEnabled: true, countries: [{ countryCode: "GH", accessLevel: "manage" }, { countryCode: "NG", accessLevel: "view" }],
    permissions: ["kyc.view.country", "kyb.view.country", "merchant.view.country", "settlement.view.country", "support.view.country"],
    lastLoginAt: now() - hours(8), failedLoginCount: 0, createdBy: "staff_001", createdAt: now() - days(120), updatedAt: now() - hours(8),
  },
  {
    id: "staff_003", firstName: "Amina", lastName: "Hassan", email: "amina.hassan@faya.admin", phone: "+254 712 345 678",
    departmentId: "dept_compliance", roleId: "role_compliance_manager", managerId: "staff_001",
    status: "active", mfaEnabled: true, countries: [{ countryCode: "KE", accessLevel: "manage" }, { countryCode: "UG", accessLevel: "view" }],
    permissions: ["kyc.view.country", "kyc.approve.country", "kyc.reject.country", "kyb.view.country", "kyb.approve.country", "kyb.reject.country", "sanctions.review.country", "account.restrict.country"],
    lastLoginAt: now() - hours(4), failedLoginCount: 0, createdBy: "staff_001", createdAt: now() - days(150), updatedAt: now() - hours(4),
  },
  {
    id: "staff_004", firstName: "Thabo", lastName: "Nkosi", email: "thabo.nkosi@faya.admin", phone: "+27 82 123 4567",
    departmentId: "dept_compliance", roleId: "role_kyc_reviewer", managerId: "staff_003",
    status: "active", mfaEnabled: true, countries: [{ countryCode: "ZA", accessLevel: "operate" }],
    permissions: ["kyc.view.country", "kyc.approve.country", "kyc.reject.country", "kyc.request_documents.country", "kyc.escalate.country"],
    lastLoginAt: now() - hours(1), failedLoginCount: 0, createdBy: "staff_003", createdAt: now() - days(60), updatedAt: now() - hours(1),
  },
  {
    id: "staff_005", firstName: "Chidi", lastName: "Eze", email: "chidi.eze@faya.admin", phone: "+234 803 222 1100",
    departmentId: "dept_risk_fraud", roleId: "role_fraud_analyst", managerId: "staff_001",
    status: "active", mfaEnabled: true, countries: [{ countryCode: "NG", accessLevel: "operate" }],
    permissions: ["risk.view.country", "risk.escalate.country", "merchant.restrict.country", "account.restrict.country", "device.block.country"],
    lastLoginAt: now() - hours(6), failedLoginCount: 0, createdBy: "staff_001", createdAt: now() - days(90), updatedAt: now() - hours(6),
  },
  {
    id: "staff_006", firstName: "Fatima", lastName: "Bello", email: "fatima.bello@faya.admin", phone: "+234 805 888 9900",
    departmentId: "dept_finance", roleId: "role_settlement_analyst", managerId: "staff_001",
    status: "active", mfaEnabled: true, countries: [{ countryCode: "NG", accessLevel: "operate" }, { countryCode: "GH", accessLevel: "operate" }],
    permissions: ["settlement.view.country", "settlement.export.country", "reconciliation.view.country", "fees.view.country"],
    lastLoginAt: now() - days(1), failedLoginCount: 0, createdBy: "staff_001", createdAt: now() - days(100), updatedAt: now() - days(1),
  },
  {
    id: "staff_007", firstName: "Grace", lastName: "Adeyemi", email: "grace.adeyemi@faya.admin", phone: "+234 807 444 5566",
    departmentId: "dept_support", roleId: "role_customer_support", managerId: "staff_001",
    status: "active", mfaEnabled: false, countries: [{ countryCode: "NG", accessLevel: "operate" }],
    permissions: ["support.view.country", "support.respond.country"],
    lastLoginAt: now() - hours(3), failedLoginCount: 0, createdBy: "staff_001", createdAt: now() - days(45), updatedAt: now() - hours(3),
  },
  {
    id: "staff_008", firstName: "Daniel", lastName: "Otieno", email: "daniel.otieno@faya.admin", phone: "+254 722 999 0011",
    departmentId: "dept_merchant_ops", roleId: "role_merchant_onboarding", managerId: "staff_001",
    status: "invited", mfaEnabled: false, countries: [{ countryCode: "KE", accessLevel: "operate" }],
    permissions: ["merchant.view.country"],
    lastLoginAt: null, failedLoginCount: 0, createdBy: "staff_001", createdAt: now() - days(3), updatedAt: now() - days(3),
  },
  {
    id: "staff_009", firstName: "Zainab", lastName: "Mohammed", email: "zainab.mohammed@faya.admin", phone: "+234 809 333 2244",
    departmentId: "dept_device_ops", roleId: "role_terminal_activation", managerId: "staff_001",
    status: "suspended", mfaEnabled: true, countries: [{ countryCode: "NG", accessLevel: "operate" }],
    permissions: ["device.view.country", "terminal.assign.country"],
    lastLoginAt: now() - days(14), failedLoginCount: 5, createdBy: "staff_001", createdAt: now() - days(80), updatedAt: now() - days(2),
    notes: "Suspended pending security review — failed logins",
  },
  {
    id: "staff_010", firstName: "Samuel", lastName: "Aboagye", email: "samuel.aboagye@faya.admin", phone: "+233 266 778 990",
    departmentId: "dept_disputes", roleId: "role_dispute_analyst", managerId: "staff_001",
    status: "active", mfaEnabled: true, countries: [{ countryCode: "GH", accessLevel: "operate" }],
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
