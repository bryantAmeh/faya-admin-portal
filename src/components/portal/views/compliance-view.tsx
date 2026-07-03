"use client";

/**
 * Faya Admin Portal — Compliance (KYC / KYB) View (Rebuilt)
 *
 * Replaces the previous sliding-Sheet design with a full-page layout that
 * shows linked documents INLINE — no downloads, no sheet, no slide.
 *
 * Layout per case:
 *   - Case header (entity name, code, country, risk, status, SLA, reviewer)
 *   - Linked entity record (consumer/merchant) with current status
 *   - Inline document grid (click "View" → metadata Dialog, no download)
 *   - Action bar (Approve / Reject / Escalate / Request docs / Assign / View Profile)
 *
 * "View Profile" navigates to the full-page profile:
 *   - KYC case → selectUser(consumer.id); setView("user_detail")
 *   - KYB case → selectMerchant(merchant.id); setView("merchant_detail")
 *
 * Tabs: KYC Queue · KYB Queue · Sanctions/PEP · Manual Review · Approved · Rejected
 *
 * Country scoping: Super Admin sees all countries; other staff see only
 * the country codes listed on their `staff.countries` access record.
 *
 * Audit action keys (via logAudit):
 *   kyc.approve / kyc.reject / kyc.escalate / kyc.request_documents / kyc.assign
 *   kyb.approve / kyb.reject / kyb.escalate / kyb.request_documents / kyb.assign
 *   document.approve / document.reject (per-document inline actions)
 */
import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  Check,
  X,
  FileText,
  AlertTriangle,
  Clock,
  UserCheck,
  ArrowUpCircle,
  Eye,
  Info,
  User,
  Building2,
  Layers,
  ExternalLink,
  ImageIcon,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer, EmptyState, StatCard } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { usePortalStore } from "@/hooks/use-portal-store";
import { adminData, logAudit } from "@/lib/admin-data";
import { formatDateTime, slaStatus, statusBadge, timeAgo } from "@/lib/formatters";
import type {
  KycCase,
  KybCase,
  AdminStaff,
  CountryConfig,
  Consumer,
  Merchant,
  ConsumerStatus,
  MerchantStatus,
  KycTier,
  PlatformKey,
  UserDocument,
  DocumentType,
  KycStatus,
  KybStatus,
} from "@/lib/types";
import { PLATFORM_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ComplianceViewProps {
  kycCases: KycCase[];
  kybCases: KybCase[];
  staff: AdminStaff[];
  countries: CountryConfig[];
  consumers: Consumer[];
  merchants: Merchant[];
}

const SUPER_ADMIN_DEPT = "dept_super_admin";

/* ----------------------------- Status styling ---------------------------- */

const CONSUMER_STATUS_STYLES: Record<ConsumerStatus, { label: string; className: string }> = {
  pending_kyc: { label: "Pending KYC", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  restricted: { label: "Restricted", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  closed: { label: "Closed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const MERCHANT_STATUS_STYLES: Record<MerchantStatus, { label: string; className: string }> = {
  onboarding: { label: "Onboarding", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
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

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
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

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In Review" },
  { value: "escalated", label: "Escalated" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

export function ComplianceView({
  kycCases,
  kybCases,
  staff,
  countries,
  consumers,
  merchants,
}: ComplianceViewProps) {
  const { staff: currentStaff } = useAuth();
  const { selectUser, selectMerchant, setView } = usePortalStore();
  const [activeTab, setActiveTab] = useState<string>("kyc");

  /* ----------------------- Documents subscription ----------------------- */
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  useEffect(() => {
    const unsub = adminData.subscribeDocuments(setDocuments);
    return () => unsub();
  }, []);

  /* ----------------- Linked entity lookups (KYC → Consumer, KYB → Merchant) ----------------- */
  function findConsumerForKyc(k: KycCase): Consumer | null {
    if (!consumers.length) return null;
    const fullName = `${k.customerName}`.trim().toLowerCase();
    const byCaseId = consumers.filter((c) => c.kycCaseId === k.id);
    if (byCaseId.length === 1) return byCaseId[0];
    if (byCaseId.length > 1) {
      const byName = byCaseId.find(
        (c) => `${c.firstName} ${c.lastName}`.trim().toLowerCase() === fullName,
      );
      return byName ?? byCaseId[0];
    }
    return (
      consumers.find(
        (c) => `${c.firstName} ${c.lastName}`.trim().toLowerCase() === fullName,
      ) ?? null
    );
  }

  function findMerchantForKyb(k: KybCase): Merchant | null {
    if (!merchants.length) return null;
    const name = `${k.merchantName}`.trim().toLowerCase();
    const byCaseId = merchants.filter((m) => m.kybCaseId === k.id);
    if (byCaseId.length === 1) return byCaseId[0];
    if (byCaseId.length > 1) {
      const byName =
        byCaseId.find((m) => m.legalName.trim().toLowerCase() === name) ??
        byCaseId.find((m) => m.tradingName.trim().toLowerCase() === name);
      return byName ?? byCaseId[0];
    }
    return (
      merchants.find((m) => m.legalName.trim().toLowerCase() === name) ??
      merchants.find((m) => m.tradingName.trim().toLowerCase() === name) ??
      null
    );
  }

  /* ----------------------- Country scoping ----------------------- */
  const visibleCountryCodes = useMemo(() => {
    if (!currentStaff) return new Set<string>();
    if (currentStaff.departmentId === SUPER_ADMIN_DEPT) {
      return new Set(countries.map((c) => c.countryCode));
    }
    return new Set(currentStaff.countries.map((c) => c.countryCode));
  }, [currentStaff, countries]);

  const isSuperAdmin = currentStaff?.departmentId === SUPER_ADMIN_DEPT;

  const visibleKyc = useMemo(
    () => kycCases.filter((k) => visibleCountryCodes.has(k.countryCode)),
    [kycCases, visibleCountryCodes],
  );
  const visibleKyb = useMemo(
    () => kybCases.filter((k) => visibleCountryCodes.has(k.countryCode)),
    [kybCases, visibleCountryCodes],
  );

  const filterableCountries = useMemo(
    () =>
      isSuperAdmin
        ? countries
        : countries.filter((c) => visibleCountryCodes.has(c.countryCode)),
    [countries, isSuperAdmin, visibleCountryCodes],
  );

  /* --------------------------- Filters --------------------------- */
  const [kycCountry, setKycCountry] = useState<string>("all");
  const [kycStatus, setKycStatus] = useState<string>("all");
  const [kycSearch, setKycSearch] = useState("");

  const [kybCountry, setKybCountry] = useState<string>("all");
  const [kybStatus, setKybStatus] = useState<string>("all");
  const [kybSearch, setKybSearch] = useState("");

  const filteredKyc = useMemo(() => {
    let list = visibleKyc;
    if (kycCountry !== "all") list = list.filter((k) => k.countryCode === kycCountry);
    if (kycStatus !== "all") list = list.filter((k) => k.status === kycStatus);
    if (kycSearch.trim()) {
      const q = kycSearch.trim().toLowerCase();
      list = list.filter((k) => k.customerName.toLowerCase().includes(q));
    }
    return list;
  }, [visibleKyc, kycCountry, kycStatus, kycSearch]);

  const filteredKyb = useMemo(() => {
    let list = visibleKyb;
    if (kybCountry !== "all") list = list.filter((k) => k.countryCode === kybCountry);
    if (kybStatus !== "all") list = list.filter((k) => k.status === kybStatus);
    if (kybSearch.trim()) {
      const q = kybSearch.trim().toLowerCase();
      list = list.filter((k) => k.merchantName.toLowerCase().includes(q));
    }
    return list;
  }, [visibleKyb, kybCountry, kybStatus, kybSearch]);

  /* --------------------- Reject + document viewer dialogs ------------------- */
  const [rejectTarget, setRejectTarget] = useState<{
    type: "kyc" | "kyb";
    id: string;
    name: string;
  } | null>(null);
  const [viewDoc, setViewDoc] = useState<UserDocument | null>(null);

  /* --------------------------- Audit actor ----------------------- */
  const actor = useMemo(() => {
    if (!currentStaff) return null;
    return {
      staffId: currentStaff.id,
      staffName: `${currentStaff.firstName} ${currentStaff.lastName}`,
      department: currentStaff.departmentId,
      role: currentStaff.roleId,
    };
  }, [currentStaff]);

  /* --------------------------- Lookups --------------------------- */
  function staffName(id: string | null): string {
    if (!id) return "Unassigned";
    const s = staff.find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : id;
  }
  function countryName(code: string): string {
    return countries.find((c) => c.countryCode === code)?.countryName ?? code;
  }

  /* ----------------------- KYC mutations ------------------------- */
  function approveKyc(k: KycCase) {
    if (!actor) return;
    const reviewer = k.assignedReviewer ?? currentStaff?.id ?? null;
    adminData.updateKyc(k.id, { status: "approved", assignedReviewer: reviewer });
    logAudit(actor, "kyc.approve", "kyc_case", k.id, {
      countryCode: k.countryCode,
      beforeValue: k.status,
      afterValue: "approved",
    });
    const consumer = findConsumerForKyc(k);
    if (consumer) {
      adminData.updateConsumer(consumer.id, {
        kycStatus: "approved",
        status: "active",
        updatedAt: Date.now(),
      });
      logAudit(actor, "consumer.kyc_approved", "consumer", consumer.id, {
        countryCode: consumer.countryCode,
        beforeValue: `${consumer.kycStatus} / ${consumer.status}`,
        afterValue: "approved / active",
        reason: `KYC case ${k.id} approved`,
      });
      toast.success(`KYC approved: ${k.customerName}`, {
        description: `Case ${k.id} · Consumer ${consumer.consumerCode} activated in real-time.`,
      });
    } else {
      toast.success(`KYC approved: ${k.customerName}`, {
        description: `Case ${k.id} · ${countryName(k.countryCode)} · no linked consumer record.`,
      });
    }
  }
  function rejectKyc(k: KycCase) {
    if (!actor) return;
    const reviewer = k.assignedReviewer ?? currentStaff?.id ?? null;
    adminData.updateKyc(k.id, { status: "rejected", assignedReviewer: reviewer });
    logAudit(actor, "kyc.reject", "kyc_case", k.id, {
      countryCode: k.countryCode,
      beforeValue: k.status,
      afterValue: "rejected",
    });
    const consumer = findConsumerForKyc(k);
    if (consumer) {
      adminData.updateConsumer(consumer.id, {
        kycStatus: "rejected",
        status: "restricted",
        updatedAt: Date.now(),
      });
      logAudit(actor, "consumer.kyc_rejected", "consumer", consumer.id, {
        countryCode: consumer.countryCode,
        beforeValue: `${consumer.kycStatus} / ${consumer.status}`,
        afterValue: "rejected / restricted",
        reason: `KYC case ${k.id} rejected`,
      });
      toast.error(`KYC rejected: ${k.customerName}`, {
        description: `Case ${k.id} · Consumer ${consumer.consumerCode} restricted.`,
      });
    } else {
      toast.error(`KYC rejected: ${k.customerName}`, { description: `Case ${k.id}` });
    }
  }
  function escalateKyc(k: KycCase) {
    if (!actor) return;
    adminData.updateKyc(k.id, { status: "escalated" });
    logAudit(actor, "kyc.escalate", "kyc_case", k.id, {
      countryCode: k.countryCode,
      beforeValue: k.status,
      afterValue: "escalated",
    });
    toast.warning(`KYC escalated: ${k.customerName}`, {
      description: "Moved to Sanctions/PEP review queue",
    });
  }
  function requestDocsKyc(k: KycCase) {
    if (!actor) return;
    logAudit(actor, "kyc.request_documents", "kyc_case", k.id, {
      countryCode: k.countryCode,
    });
    toast.info(`Document request sent: ${k.customerName}`, {
      description: `Notifying customer to upload: ${k.requiredDocuments
        .map((d) => d.replace(/_/g, " "))
        .join(", ")}`,
    });
  }
  function assignReviewerKyc(k: KycCase) {
    if (!actor || !currentStaff) return;
    const newStatus: KycStatus = k.status === "pending" ? "in_review" : k.status;
    adminData.updateKyc(k.id, { assignedReviewer: currentStaff.id, status: newStatus });
    logAudit(actor, "kyc.assign", "kyc_case", k.id, {
      countryCode: k.countryCode,
      afterValue: `${currentStaff.firstName} ${currentStaff.lastName}`,
    });
    toast.success(`Assigned to you: ${k.customerName}`, {
      description: `You are now the reviewer for case ${k.id}`,
    });
  }

  /* ----------------------- KYB mutations ------------------------- */
  function approveKyb(k: KybCase) {
    if (!actor) return;
    const reviewer = k.assignedReviewer ?? currentStaff?.id ?? null;
    adminData.updateKyb(k.id, { status: "approved", assignedReviewer: reviewer });
    logAudit(actor, "kyb.approve", "kyb_case", k.id, {
      countryCode: k.countryCode,
      beforeValue: k.status,
      afterValue: "approved",
    });
    const merchant = findMerchantForKyb(k);
    if (merchant) {
      adminData.updateMerchant(merchant.id, {
        kybStatus: "approved",
        status: "active",
        updatedAt: Date.now(),
      });
      logAudit(actor, "merchant.kyb_approved", "merchant", merchant.id, {
        countryCode: merchant.countryCode,
        beforeValue: `${merchant.kybStatus} / ${merchant.status}`,
        afterValue: "approved / active",
        reason: `KYB case ${k.id} approved`,
      });
      toast.success(`KYB approved: ${k.merchantName}`, {
        description: `Case ${k.id} · Merchant ${merchant.merchantCode} activated in real-time.`,
      });
    } else {
      toast.success(`KYB approved: ${k.merchantName}`, {
        description: `Case ${k.id} · ${countryName(k.countryCode)} · no linked merchant record.`,
      });
    }
  }
  function rejectKyb(k: KybCase) {
    if (!actor) return;
    const reviewer = k.assignedReviewer ?? currentStaff?.id ?? null;
    adminData.updateKyb(k.id, { status: "rejected", assignedReviewer: reviewer });
    logAudit(actor, "kyb.reject", "kyb_case", k.id, {
      countryCode: k.countryCode,
      beforeValue: k.status,
      afterValue: "rejected",
    });
    const merchant = findMerchantForKyb(k);
    if (merchant) {
      adminData.updateMerchant(merchant.id, {
        kybStatus: "rejected",
        status: "restricted",
        updatedAt: Date.now(),
      });
      logAudit(actor, "merchant.kyb_rejected", "merchant", merchant.id, {
        countryCode: merchant.countryCode,
        beforeValue: `${merchant.kybStatus} / ${merchant.status}`,
        afterValue: "rejected / restricted",
        reason: `KYB case ${k.id} rejected`,
      });
      toast.error(`KYB rejected: ${k.merchantName}`, {
        description: `Case ${k.id} · Merchant ${merchant.merchantCode} restricted.`,
      });
    } else {
      toast.error(`KYB rejected: ${k.merchantName}`, { description: `Case ${k.id}` });
    }
  }
  function escalateKyb(k: KybCase) {
    if (!actor) return;
    adminData.updateKyb(k.id, { status: "escalated" });
    logAudit(actor, "kyb.escalate", "kyb_case", k.id, {
      countryCode: k.countryCode,
      beforeValue: k.status,
      afterValue: "escalated",
    });
    toast.warning(`KYB escalated: ${k.merchantName}`, {
      description: "Senior compliance review required",
    });
  }
  function requestDocsKyb(k: KybCase) {
    if (!actor) return;
    logAudit(actor, "kyb.request_documents", "kyb_case", k.id, {
      countryCode: k.countryCode,
    });
    const docs =
      k.missingDocuments.length > 0
        ? k.missingDocuments.map((d) => d.replace(/_/g, " ")).join(", ")
        : "additional documents";
    toast.info(`Document request sent: ${k.merchantName}`, {
      description: `Notifying merchant to upload: ${docs}`,
    });
  }
  function assignReviewerKyb(k: KybCase) {
    if (!actor || !currentStaff) return;
    const newStatus: KybStatus = k.status === "pending" ? "in_review" : k.status;
    adminData.updateKyb(k.id, { assignedReviewer: currentStaff.id, status: newStatus });
    logAudit(actor, "kyb.assign", "kyb_case", k.id, {
      countryCode: k.countryCode,
      afterValue: `${currentStaff.firstName} ${currentStaff.lastName}`,
    });
    toast.success(`Assigned to you: ${k.merchantName}`, {
      description: `You are now the reviewer for case ${k.id}`,
    });
  }

  /* ----------------------- Document mutations --------------------- */
  function approveDocument(doc: UserDocument) {
    if (!actor) return;
    adminData.updateDocument(doc.id, {
      status: "approved",
      reviewedBy: actor.staffId,
      reviewedAt: Date.now(),
    });
    logAudit(actor, "document.approve", "document", doc.id, {
      countryCode: doc.countryCode,
      beforeValue: doc.status,
      afterValue: "approved",
      reason: `${doc.documentType.replace(/_/g, " ")} approved for ${doc.entityName}`,
    });
    toast.success(`Document approved: ${doc.fileName}`, {
      description: `${DOCUMENT_TYPE_LABELS[doc.documentType]} · ${doc.entityName}`,
    });
  }
  function rejectDocument(doc: UserDocument) {
    if (!actor) return;
    adminData.updateDocument(doc.id, {
      status: "rejected",
      reviewedBy: actor.staffId,
      reviewedAt: Date.now(),
    });
    logAudit(actor, "document.reject", "document", doc.id, {
      countryCode: doc.countryCode,
      beforeValue: doc.status,
      afterValue: "rejected",
      reason: `${doc.documentType.replace(/_/g, " ")} rejected for ${doc.entityName}`,
    });
    toast.error(`Document rejected: ${doc.fileName}`, {
      description: `${DOCUMENT_TYPE_LABELS[doc.documentType]} · ${doc.entityName}`,
    });
  }

  /* ------------------------- Reject confirm ---------------------- */
  function confirmReject() {
    if (!rejectTarget) return;
    if (rejectTarget.type === "kyc") {
      const k = kycCases.find((x) => x.id === rejectTarget.id);
      if (k) rejectKyc(k);
    } else {
      const k = kybCases.find((x) => x.id === rejectTarget.id);
      if (k) rejectKyb(k);
    }
    setRejectTarget(null);
  }

  /* ----------------------- Derived buckets ----------------------- */
  const escalatedKyc = useMemo(
    () => visibleKyc.filter((k) => k.status === "escalated"),
    [visibleKyc],
  );
  const escalatedKyb = useMemo(
    () => visibleKyb.filter((k) => k.status === "escalated"),
    [visibleKyb],
  );
  const manualReviewKyc = useMemo(
    () => visibleKyc.filter((k) => k.status === "in_review"),
    [visibleKyc],
  );
  const manualReviewKyb = useMemo(
    () => visibleKyb.filter((k) => k.status === "in_review"),
    [visibleKyb],
  );
  const approvedKyc = useMemo(
    () => visibleKyc.filter((k) => k.status === "approved"),
    [visibleKyc],
  );
  const approvedKyb = useMemo(
    () => visibleKyb.filter((k) => k.status === "approved"),
    [visibleKyb],
  );
  const rejectedKyc = useMemo(
    () => visibleKyc.filter((k) => k.status === "rejected"),
    [visibleKyc],
  );
  const rejectedKyb = useMemo(
    () => visibleKyb.filter((k) => k.status === "rejected"),
    [visibleKyb],
  );

  const openKycQueue = visibleKyc.filter(
    (k) => k.status === "pending" || k.status === "in_review",
  ).length;
  const openKybQueue = visibleKyb.filter(
    (k) => k.status === "pending" || k.status === "in_review",
  ).length;

  /* ----------------------- Document lookup ----------------------- */
  /** Return documents linked to a KYC case (consumer) or KYB case (merchant). */
  function documentsForKyc(k: KycCase, consumer: Consumer | null): UserDocument[] {
    if (consumer) {
      return documents.filter(
        (d) => d.entityType === "consumer" && d.entityId === consumer.id,
      );
    }
    // Fallback: try to match by entity name + country
    return documents.filter(
      (d) =>
        d.entityType === "consumer" &&
        d.entityName.trim().toLowerCase() === k.customerName.trim().toLowerCase() &&
        d.countryCode === k.countryCode,
    );
  }
  function documentsForKyb(k: KybCase, merchant: Merchant | null): UserDocument[] {
    if (merchant) {
      return documents.filter(
        (d) => d.entityType === "merchant" && d.entityId === merchant.id,
      );
    }
    return documents.filter(
      (d) =>
        d.entityType === "merchant" &&
        (d.entityName.trim().toLowerCase() === k.merchantName.trim().toLowerCase()) &&
        d.countryCode === k.countryCode,
    );
  }

  /* ------------------------- Badge helpers ----------------------- */
  function riskScoreBadge(score: number): React.ReactNode {
    let cls =
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    if (score < 30) {
      cls =
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
    } else if (score < 60) {
      cls =
        "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    } else if (score < 80) {
      cls =
        "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
    }
    return (
      <Badge
        variant="secondary"
        className={cn("text-[10px] font-semibold tabular-nums px-1.5", cls)}
      >
        {score}
      </Badge>
    );
  }

  function riskCategoryBadge(cat: KybCase["riskCategory"]): React.ReactNode {
    const b = statusBadge("risk", cat);
    return (
      <Badge variant="secondary" className={cn("text-[10px] capitalize", b.className)}>
        {b.label}
      </Badge>
    );
  }

  function slaBadge(deadline: number): React.ReactNode {
    const s = slaStatus(deadline);
    const cls =
      s.variant === "danger"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
        : s.variant === "warning"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    return (
      <Badge variant="secondary" className={cn("text-[10px] gap-1 font-medium", cls)}>
        <Clock className="size-2.5" />
        {s.label}
      </Badge>
    );
  }

  function tierChip(tier: KycTier): React.ReactNode {
    const t = KYC_TIER_STYLES[tier];
    return (
      <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0", t.className)}>
        <Layers className="size-2.5 mr-0.5" />
        {t.label}
      </Badge>
    );
  }

  function consumerStatusBadge(status: ConsumerStatus): React.ReactNode {
    const s = CONSUMER_STATUS_STYLES[status] ?? { label: status, className: "bg-slate-100 text-slate-700" };
    return (
      <Badge variant="secondary" className={cn("text-[10px]", s.className)}>
        {s.label}
      </Badge>
    );
  }

  function merchantStatusBadge(status: MerchantStatus): React.ReactNode {
    const s = MERCHANT_STATUS_STYLES[status] ?? { label: status, className: "bg-slate-100 text-slate-700" };
    return (
      <Badge variant="secondary" className={cn("text-[10px]", s.className)}>
        {s.label}
      </Badge>
    );
  }

  function platformChips(platforms: PlatformKey[]): React.ReactNode {
    if (!platforms || platforms.length === 0) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    return (
      <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
        {platforms.map((p) => (
          <Badge key={p} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
            {PLATFORM_LABELS[p].label}
          </Badge>
        ))}
      </div>
    );
  }

  /* ----------------------- Navigation handlers ------------------- */
  function viewKycProfile(k: KycCase) {
    const consumer = findConsumerForKyc(k);
    if (consumer) {
      selectUser(consumer.id);
      setView("user_detail");
      toast.info(`Opening consumer profile: ${consumer.firstName} ${consumer.lastName}`, {
        description: `${consumer.consumerCode} · ${countryName(consumer.countryCode)}`,
      });
    } else {
      toast.error("No linked consumer record", {
        description: "Cannot navigate — KYC case has no linked consumer to view.",
      });
    }
  }
  function viewKybProfile(k: KybCase) {
    const merchant = findMerchantForKyb(k);
    if (merchant) {
      selectMerchant(merchant.id);
      setView("merchant_detail");
      toast.info(`Opening merchant profile: ${merchant.tradingName}`, {
        description: `${merchant.merchantCode} · ${countryName(merchant.countryCode)}`,
      });
    } else {
      toast.error("No linked merchant record", {
        description: "Cannot navigate — KYB case has no linked merchant to view.",
      });
    }
  }

  /* ----------------------------- Render -------------------------- */
  return (
    <>
      <ViewHeader
        title="Compliance · KYC / KYB"
        description={
          isSuperAdmin
            ? "Review customer identity (KYC) and merchant business (KYB) submissions, sanctions/PEP screening, and SLA-bound queues across all countries."
            : `Queues scoped to your countries: ${[...visibleCountryCodes].join(", ") || "—"}`
        }
        icon={ShieldCheck}
      />
      <ViewContainer>
        {/* Live-sync info banner */}
        <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20 p-3 flex items-start gap-2 text-xs">
          <Info className="size-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-emerald-900 dark:text-emerald-200 leading-relaxed">
            <span className="font-medium">Inline document review:</span> All
            uploaded documents are shown inline on each case — click{" "}
            <span className="font-medium">View</span> to see metadata. To act on
            a case, click <span className="font-medium">View Profile</span> to
            open the full consumer/merchant profile page. Approvals update the
            linked entity in real-time.
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="KYC Queue"
            value={openKycQueue}
            hint="pending + in review"
            icon={ShieldCheck}
            tone="warning"
          />
          <StatCard
            label="KYB Queue"
            value={openKybQueue}
            hint="pending + in review"
            icon={FileText}
            tone="warning"
          />
          <StatCard
            label="Escalated"
            value={escalatedKyc.length + escalatedKyb.length}
            icon={ArrowUpCircle}
            tone="danger"
          />
          <StatCard
            label="Manual Review"
            value={manualReviewKyc.length + manualReviewKyb.length}
            icon={Eye}
          />
          <StatCard
            label="Approved"
            value={approvedKyc.length + approvedKyb.length}
            icon={Check}
            tone="success"
          />
          <StatCard
            label="Rejected"
            value={rejectedKyc.length + rejectedKyb.length}
            icon={X}
            tone="danger"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="kyc" className="text-xs">
              <ShieldCheck className="size-3.5" /> KYC Queue
            </TabsTrigger>
            <TabsTrigger value="kyb" className="text-xs">
              <FileText className="size-3.5" /> KYB Queue
            </TabsTrigger>
            <TabsTrigger value="sanctions" className="text-xs">
              <AlertTriangle className="size-3.5" /> Sanctions/PEP
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs">
              <Eye className="size-3.5" /> Manual Review
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">
              <Check className="size-3.5" /> Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs">
              <X className="size-3.5" /> Rejected
            </TabsTrigger>
          </TabsList>

          {/* ---------------------- KYC QUEUE ---------------------- */}
          <TabsContent value="kyc" className="space-y-3">
            <FilterBar
              search={kycSearch}
              setSearch={setKycSearch}
              country={kycCountry}
              setCountry={setKycCountry}
              status={kycStatus}
              setStatus={setKycStatus}
              countries={filterableCountries}
              searchPlaceholder="Search customer name..."
              count={filteredKyc.length}
              icon={ShieldCheck}
              title="KYC Queue"
              iconColor="text-emerald-600"
            />
            {filteredKyc.length === 0 ? (
              <Card>
                <CardContent className="p-0">
                  <EmptyState
                    icon={ShieldCheck}
                    title="No KYC cases match"
                    description="Adjust the filters above or check back later for new submissions."
                  />
                </CardContent>
              </Card>
            ) : (
              filteredKyc.map((k) => (
                <KycCaseCard
                  key={k.id}
                  kyc={k}
                  consumer={findConsumerForKyc(k)}
                  docs={documentsForKyc(k, findConsumerForKyc(k))}
                  onApprove={() => approveKyc(k)}
                  onReject={() =>
                    setRejectTarget({
                      type: "kyc",
                      id: k.id,
                      name: k.customerName,
                    })
                  }
                  onEscalate={() => escalateKyc(k)}
                  onRequestDocs={() => requestDocsKyc(k)}
                  onAssign={() => assignReviewerKyc(k)}
                  onViewProfile={() => viewKycProfile(k)}
                  onViewDoc={setViewDoc}
                  onApproveDoc={approveDocument}
                  onRejectDoc={rejectDocument}
                  staffName={staffName}
                  countryName={countryName}
                  riskScoreBadge={riskScoreBadge}
                  slaBadge={slaBadge}
                  tierChip={tierChip}
                  consumerStatusBadge={consumerStatusBadge}
                  platformChips={platformChips}
                />
              ))
            )}
          </TabsContent>

          {/* ---------------------- KYB QUEUE ---------------------- */}
          <TabsContent value="kyb" className="space-y-3">
            <FilterBar
              search={kybSearch}
              setSearch={setKybSearch}
              country={kybCountry}
              setCountry={setKybCountry}
              status={kybStatus}
              setStatus={setKybStatus}
              countries={filterableCountries}
              searchPlaceholder="Search merchant name..."
              count={filteredKyb.length}
              icon={FileText}
              title="KYB Queue"
              iconColor="text-amber-600"
            />
            {filteredKyb.length === 0 ? (
              <Card>
                <CardContent className="p-0">
                  <EmptyState
                    icon={FileText}
                    title="No KYB cases match"
                    description="Adjust the filters above or check back later for new merchant onboarding submissions."
                  />
                </CardContent>
              </Card>
            ) : (
              filteredKyb.map((k) => (
                <KybCaseCard
                  key={k.id}
                  kyb={k}
                  merchant={findMerchantForKyb(k)}
                  docs={documentsForKyb(k, findMerchantForKyb(k))}
                  onApprove={() => approveKyb(k)}
                  onReject={() =>
                    setRejectTarget({
                      type: "kyb",
                      id: k.id,
                      name: k.merchantName,
                    })
                  }
                  onEscalate={() => escalateKyb(k)}
                  onRequestDocs={() => requestDocsKyb(k)}
                  onAssign={() => assignReviewerKyb(k)}
                  onViewProfile={() => viewKybProfile(k)}
                  onViewDoc={setViewDoc}
                  onApproveDoc={approveDocument}
                  onRejectDoc={rejectDocument}
                  staffName={staffName}
                  countryName={countryName}
                  riskCategoryBadge={riskCategoryBadge}
                  slaBadge={slaBadge}
                  merchantStatusBadge={merchantStatusBadge}
                  platformChips={platformChips}
                />
              ))
            )}
          </TabsContent>

          {/* -------------------- SANCTIONS / PEP ------------------- */}
          <TabsContent value="sanctions" className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600" />
                  Escalated KYC Cases
                  <Badge variant="secondary" className="text-[10px]">
                    {escalatedKyc.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {escalatedKyc.length === 0 ? (
                  <EmptyState
                    icon={ShieldCheck}
                    title="No escalated KYC cases"
                    description="Sanctions/PEP escalations from the KYC queue will appear here for senior compliance review."
                  />
                ) : (
                  <div className="p-3 space-y-3">
                    {escalatedKyc.map((k) => (
                      <KycCaseCard
                        key={k.id}
                        kyc={k}
                        consumer={findConsumerForKyc(k)}
                        docs={documentsForKyc(k, findConsumerForKyc(k))}
                        onApprove={() => approveKyc(k)}
                        onReject={() =>
                          setRejectTarget({
                            type: "kyc",
                            id: k.id,
                            name: k.customerName,
                          })
                        }
                        onEscalate={() => escalateKyc(k)}
                        onRequestDocs={() => requestDocsKyc(k)}
                        onAssign={() => assignReviewerKyc(k)}
                        onViewProfile={() => viewKycProfile(k)}
                        onViewDoc={setViewDoc}
                        onApproveDoc={approveDocument}
                        onRejectDoc={rejectDocument}
                        staffName={staffName}
                        countryName={countryName}
                        riskScoreBadge={riskScoreBadge}
                        slaBadge={slaBadge}
                        tierChip={tierChip}
                        consumerStatusBadge={consumerStatusBadge}
                        platformChips={platformChips}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Workflow overview panel (always shown) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  Sanctions &amp; PEP Review Workflow
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ol className="space-y-3 text-sm">
                  {SANCTIONS_WORKFLOW.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="size-6 shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-semibold">
                        {i + 1}
                      </span>
                      <div>
                        <div className="font-medium">{step.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{step.desc}</div>
                      </div>
                    </li>
                  ))}
                </ol>
                <Separator className="my-4" />
                <div className="grid gap-3 md:grid-cols-3 text-xs">
                  <div className="rounded-md border p-3">
                    <div className="font-medium mb-1">Screening lists</div>
                    <div className="text-muted-foreground">
                      OFAC, UN, EU consolidated, local regulator watchlists.
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="font-medium mb-1">PEP databases</div>
                    <div className="text-muted-foreground">
                      Domestic &amp; foreign PEPs, relatives and close associates (RCA).
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="font-medium mb-1">Outcomes</div>
                    <div className="text-muted-foreground">
                      Approve (false positive), reject (true match), or file SAR/STR.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* -------------------- MANUAL REVIEW -------------------- */}
          <TabsContent value="manual" className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="size-4 text-emerald-600" />
                  Manual Review Queue
                  <Badge variant="secondary" className="text-[10px]">
                    {manualReviewKyc.length + manualReviewKyb.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {manualReviewKyc.length + manualReviewKyb.length === 0 ? (
                  <EmptyState
                    icon={Eye}
                    title="Nothing in manual review"
                    description="KYC/KYB cases currently being reviewed by an analyst will appear here."
                  />
                ) : (
                  <div className="p-3 space-y-3">
                    {manualReviewKyc.map((k) => (
                      <KycCaseCard
                        key={k.id}
                        kyc={k}
                        consumer={findConsumerForKyc(k)}
                        docs={documentsForKyc(k, findConsumerForKyc(k))}
                        onApprove={() => approveKyc(k)}
                        onReject={() =>
                          setRejectTarget({
                            type: "kyc",
                            id: k.id,
                            name: k.customerName,
                          })
                        }
                        onEscalate={() => escalateKyc(k)}
                        onRequestDocs={() => requestDocsKyc(k)}
                        onAssign={() => assignReviewerKyc(k)}
                        onViewProfile={() => viewKycProfile(k)}
                        onViewDoc={setViewDoc}
                        onApproveDoc={approveDocument}
                        onRejectDoc={rejectDocument}
                        staffName={staffName}
                        countryName={countryName}
                        riskScoreBadge={riskScoreBadge}
                        slaBadge={slaBadge}
                        tierChip={tierChip}
                        consumerStatusBadge={consumerStatusBadge}
                        platformChips={platformChips}
                      />
                    ))}
                    {manualReviewKyb.map((k) => (
                      <KybCaseCard
                        key={k.id}
                        kyb={k}
                        merchant={findMerchantForKyb(k)}
                        docs={documentsForKyb(k, findMerchantForKyb(k))}
                        onApprove={() => approveKyb(k)}
                        onReject={() =>
                          setRejectTarget({
                            type: "kyb",
                            id: k.id,
                            name: k.merchantName,
                          })
                        }
                        onEscalate={() => escalateKyb(k)}
                        onRequestDocs={() => requestDocsKyb(k)}
                        onAssign={() => assignReviewerKyb(k)}
                        onViewProfile={() => viewKybProfile(k)}
                        onViewDoc={setViewDoc}
                        onApproveDoc={approveDocument}
                        onRejectDoc={rejectDocument}
                        staffName={staffName}
                        countryName={countryName}
                        riskCategoryBadge={riskCategoryBadge}
                        slaBadge={slaBadge}
                        merchantStatusBadge={merchantStatusBadge}
                        platformChips={platformChips}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ----------------------- APPROVED ---------------------- */}
          <TabsContent value="approved" className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Check className="size-4 text-emerald-600" />
                  Approved Cases
                  <Badge variant="secondary" className="text-[10px]">
                    {approvedKyc.length + approvedKyb.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {approvedKyc.length + approvedKyb.length === 0 ? (
                  <EmptyState
                    icon={Check}
                    title="No approved cases"
                    description="Approved KYC and KYB cases will be archived here for audit."
                  />
                ) : (
                  <div className="p-3 space-y-3">
                    {approvedKyc.map((k) => (
                      <KycCaseCard
                        key={k.id}
                        kyc={k}
                        consumer={findConsumerForKyc(k)}
                        docs={documentsForKyc(k, findConsumerForKyc(k))}
                        onApprove={() => approveKyc(k)}
                        onReject={() =>
                          setRejectTarget({
                            type: "kyc",
                            id: k.id,
                            name: k.customerName,
                          })
                        }
                        onEscalate={() => escalateKyc(k)}
                        onRequestDocs={() => requestDocsKyc(k)}
                        onAssign={() => assignReviewerKyc(k)}
                        onViewProfile={() => viewKycProfile(k)}
                        onViewDoc={setViewDoc}
                        onApproveDoc={approveDocument}
                        onRejectDoc={rejectDocument}
                        staffName={staffName}
                        countryName={countryName}
                        riskScoreBadge={riskScoreBadge}
                        slaBadge={slaBadge}
                        tierChip={tierChip}
                        consumerStatusBadge={consumerStatusBadge}
                        platformChips={platformChips}
                      />
                    ))}
                    {approvedKyb.map((k) => (
                      <KybCaseCard
                        key={k.id}
                        kyb={k}
                        merchant={findMerchantForKyb(k)}
                        docs={documentsForKyb(k, findMerchantForKyb(k))}
                        onApprove={() => approveKyb(k)}
                        onReject={() =>
                          setRejectTarget({
                            type: "kyb",
                            id: k.id,
                            name: k.merchantName,
                          })
                        }
                        onEscalate={() => escalateKyb(k)}
                        onRequestDocs={() => requestDocsKyb(k)}
                        onAssign={() => assignReviewerKyb(k)}
                        onViewProfile={() => viewKybProfile(k)}
                        onViewDoc={setViewDoc}
                        onApproveDoc={approveDocument}
                        onRejectDoc={rejectDocument}
                        staffName={staffName}
                        countryName={countryName}
                        riskCategoryBadge={riskCategoryBadge}
                        slaBadge={slaBadge}
                        merchantStatusBadge={merchantStatusBadge}
                        platformChips={platformChips}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ----------------------- REJECTED ---------------------- */}
          <TabsContent value="rejected" className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <X className="size-4 text-red-600" />
                  Rejected Cases
                  <Badge variant="secondary" className="text-[10px]">
                    {rejectedKyc.length + rejectedKyb.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {rejectedKyc.length + rejectedKyb.length === 0 ? (
                  <EmptyState
                    icon={X}
                    title="No rejected cases"
                    description="Rejected KYC and KYB cases will be archived here for audit."
                  />
                ) : (
                  <div className="p-3 space-y-3">
                    {rejectedKyc.map((k) => (
                      <KycCaseCard
                        key={k.id}
                        kyc={k}
                        consumer={findConsumerForKyc(k)}
                        docs={documentsForKyc(k, findConsumerForKyc(k))}
                        onApprove={() => approveKyc(k)}
                        onReject={() =>
                          setRejectTarget({
                            type: "kyc",
                            id: k.id,
                            name: k.customerName,
                          })
                        }
                        onEscalate={() => escalateKyc(k)}
                        onRequestDocs={() => requestDocsKyc(k)}
                        onAssign={() => assignReviewerKyc(k)}
                        onViewProfile={() => viewKycProfile(k)}
                        onViewDoc={setViewDoc}
                        onApproveDoc={approveDocument}
                        onRejectDoc={rejectDocument}
                        staffName={staffName}
                        countryName={countryName}
                        riskScoreBadge={riskScoreBadge}
                        slaBadge={slaBadge}
                        tierChip={tierChip}
                        consumerStatusBadge={consumerStatusBadge}
                        platformChips={platformChips}
                      />
                    ))}
                    {rejectedKyb.map((k) => (
                      <KybCaseCard
                        key={k.id}
                        kyb={k}
                        merchant={findMerchantForKyb(k)}
                        docs={documentsForKyb(k, findMerchantForKyb(k))}
                        onApprove={() => approveKyb(k)}
                        onReject={() =>
                          setRejectTarget({
                            type: "kyb",
                            id: k.id,
                            name: k.merchantName,
                          })
                        }
                        onEscalate={() => escalateKyb(k)}
                        onRequestDocs={() => requestDocsKyb(k)}
                        onAssign={() => assignReviewerKyb(k)}
                        onViewProfile={() => viewKybProfile(k)}
                        onViewDoc={setViewDoc}
                        onApproveDoc={approveDocument}
                        onRejectDoc={rejectDocument}
                        staffName={staffName}
                        countryName={countryName}
                        riskCategoryBadge={riskCategoryBadge}
                        slaBadge={slaBadge}
                        merchantStatusBadge={merchantStatusBadge}
                        platformChips={platformChips}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </ViewContainer>

      {/* ----------------- Reject confirmation ----------------- */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reject {rejectTarget?.type === "kyc" ? "KYC" : "KYB"} case?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to reject <strong>{rejectTarget?.name}</strong>. This action is
              recorded in the audit log and the customer/merchant will be notified. It cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmReject}
            >
              <X className="size-4" /> Reject case
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ----------------- Document viewer dialog ----------------- */}
      <DocumentViewerDialog
        doc={viewDoc}
        countryName={countryName}
        staffName={staffName}
        onOpenChange={(o) => !o && setViewDoc(null)}
      />

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}

/* ============================ Sub-components ============================ */

const SANCTIONS_WORKFLOW: { title: string; desc: string }[] = [
  {
    title: "Sanctions screening",
    desc: "All customers and merchants are screened against OFAC, UN, EU and local regulator watchlists at onboarding and on an ongoing basis.",
  },
  {
    title: "PEP screening",
    desc: "Customers and beneficial owners are screened against PEP databases; matches trigger manual review by a Sanctions/PEP Analyst.",
  },
  {
    title: "False-positive review",
    desc: "The analyst reviews match details, customer documentation, and adverse media to determine whether the match is a true or false positive.",
  },
  {
    title: "Senior compliance escalation",
    desc: "High-confidence matches or high-risk profiles escalate to a Senior Compliance Analyst for secondary review and decision.",
  },
  {
    title: "Decision & reporting",
    desc: "Approve (false positive), reject (true match), or file a SAR/STR with the AML Investigator. All decisions are audit-logged.",
  },
];

/* --------------------------- Filter bar --------------------------- */

function FilterBar({
  search,
  setSearch,
  country,
  setCountry,
  status,
  setStatus,
  countries,
  searchPlaceholder,
  count,
  icon: Icon,
  title,
  iconColor,
}: {
  search: string;
  setSearch: (s: string) => void;
  country: string;
  setCountry: (s: string) => void;
  status: string;
  setStatus: (s: string) => void;
  countries: CountryConfig[];
  searchPlaceholder: string;
  count: number;
  icon: typeof ShieldCheck;
  title: string;
  iconColor: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className={cn("size-4", iconColor)} />
          {title}
          <Badge variant="secondary" className="text-[10px]">
            {count}
          </Badge>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8 w-56 text-xs"
            />
          </div>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger size="sm" className="w-44 text-xs h-8">
              <Filter className="size-3 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c.countryCode} value={c.countryCode}>
                  {c.countryCode} · {c.countryName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger size="sm" className="w-36 text-xs h-8">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
    </Card>
  );
}

/* --------------------------- Action buttons --------------------------- */

function ActionBar({
  canAct,
  onApprove,
  onReject,
  onEscalate,
  onRequestDocs,
  onAssign,
  onViewProfile,
  statusLabel,
  viewProfileLabel,
}: {
  canAct: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEscalate: () => void;
  onRequestDocs: () => void;
  onAssign: () => void;
  onViewProfile: () => void;
  statusLabel: string;
  viewProfileLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
      <Button
        onClick={onViewProfile}
        variant="outline"
        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
      >
        <ExternalLink className="size-4" /> {viewProfileLabel}
      </Button>
      <div className="flex-1" />
      {canAct ? (
        <>
          <Button
            onClick={onApprove}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Check className="size-4" /> Approve
          </Button>
          <Button
            onClick={onReject}
            variant="destructive"
          >
            <X className="size-4" /> Reject
          </Button>
          <Button
            onClick={onEscalate}
            variant="outline"
            className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900/20"
          >
            <ArrowUpCircle className="size-4" /> Escalate
          </Button>
          <Button onClick={onRequestDocs} variant="outline">
            <FileText className="size-4" /> Request docs
          </Button>
          <Button onClick={onAssign} variant="secondary">
            <UserCheck className="size-4" /> Assign to me
          </Button>
        </>
      ) : (
        <div className="text-xs text-muted-foreground italic">
          Case is <span className="font-medium">{statusLabel}</span> — no further actions available.
        </div>
      )}
    </div>
  );
}

/* --------------------------- KYC case card --------------------------- */

function KycCaseCard({
  kyc,
  consumer,
  docs,
  onApprove,
  onReject,
  onEscalate,
  onRequestDocs,
  onAssign,
  onViewProfile,
  onViewDoc,
  onApproveDoc,
  onRejectDoc,
  staffName,
  countryName,
  riskScoreBadge,
  slaBadge,
  tierChip,
  consumerStatusBadge,
  platformChips,
}: {
  kyc: KycCase;
  consumer: Consumer | null;
  docs: UserDocument[];
  onApprove: () => void;
  onReject: () => void;
  onEscalate: () => void;
  onRequestDocs: () => void;
  onAssign: () => void;
  onViewProfile: () => void;
  onViewDoc: (d: UserDocument) => void;
  onApproveDoc: (d: UserDocument) => void;
  onRejectDoc: (d: UserDocument) => void;
  staffName: (id: string | null) => string;
  countryName: (code: string) => string;
  riskScoreBadge: (s: number) => React.ReactNode;
  slaBadge: (d: number) => React.ReactNode;
  tierChip: (t: KycTier) => React.ReactNode;
  consumerStatusBadge: (s: ConsumerStatus) => React.ReactNode;
  platformChips: (p: PlatformKey[]) => React.ReactNode;
}) {
  const badge = statusBadge("kyc", kyc.status);
  const canAct = kyc.status !== "approved" && kyc.status !== "rejected";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Case header */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <ShieldCheck className="size-4 text-emerald-600" />
              <span className="font-medium text-sm">{kyc.customerName}</span>
              {consumer && tierChip(consumer.kycTier)}
              <Badge variant="secondary" className={cn("text-[10px]", badge.className)}>
                {badge.label}
              </Badge>
              {riskScoreBadge(kyc.riskScore)}
              {slaBadge(kyc.slaDeadline)}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground mt-1">
              {kyc.id} · {kyc.countryCode} · {countryName(kyc.countryCode)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Nationality: {kyc.nationality} · Submitted {timeAgo(kyc.submittedAt)} ·
              Reviewer: {staffName(kyc.assignedReviewer)}
            </div>
          </div>
        </div>

        {/* Linked consumer record */}
        {consumer ? (
          <div className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-900/10 p-3 text-xs">
            <div className="flex items-center gap-1 font-medium text-emerald-800 dark:text-emerald-300 mb-1">
              <User className="size-3" /> Linked consumer · {consumer.consumerCode}
              <Badge variant="outline" className="text-[9px] text-emerald-700 border-emerald-300 bg-white dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 ml-1">
                Live sync
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-muted-foreground">Name:</span>{" "}
                {consumer.firstName} {consumer.lastName}
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>{" "}
                <span className="font-mono">{consumer.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Risk:</span>{" "}
                {riskScoreBadge(consumer.riskScore)}
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                {consumerStatusBadge(consumer.status)}
              </div>
              <div className="col-span-2 md:col-span-4">
                <span className="text-muted-foreground">Platforms:</span>{" "}
                {platformChips(consumer.platforms)}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-amber-300 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-900/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <User className="size-3.5 inline mr-1 -mt-0.5" />
            No linked consumer record — approval/rejection will be recorded on the case only.
          </div>
        )}

        {/* Inline documents */}
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1">
            <FileText className="size-3" /> Submitted Documents ({docs.length})
          </div>
          {docs.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground italic">
              No documents uploaded yet for this case.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {docs.map((d) => (
                <DocumentCard
                  key={d.id}
                  doc={d}
                  onView={() => onViewDoc(d)}
                  onApprove={() => onApproveDoc(d)}
                  onReject={() => onRejectDoc(d)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        {kyc.notes && (
          <div className="rounded-md border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 p-2.5 text-xs text-amber-900 dark:text-amber-200">
            <span className="font-medium">Analyst notes:</span> {kyc.notes}
          </div>
        )}

        {/* Actions */}
        <ActionBar
          canAct={canAct}
          statusLabel={badge.label}
          viewProfileLabel="View consumer profile"
          onApprove={onApprove}
          onReject={onReject}
          onEscalate={onEscalate}
          onRequestDocs={onRequestDocs}
          onAssign={onAssign}
          onViewProfile={onViewProfile}
        />
      </CardContent>
    </Card>
  );
}

/* --------------------------- KYB case card --------------------------- */

function KybCaseCard({
  kyb,
  merchant,
  docs,
  onApprove,
  onReject,
  onEscalate,
  onRequestDocs,
  onAssign,
  onViewProfile,
  onViewDoc,
  onApproveDoc,
  onRejectDoc,
  staffName,
  countryName,
  riskCategoryBadge,
  slaBadge,
  merchantStatusBadge,
  platformChips,
}: {
  kyb: KybCase;
  merchant: Merchant | null;
  docs: UserDocument[];
  onApprove: () => void;
  onReject: () => void;
  onEscalate: () => void;
  onRequestDocs: () => void;
  onAssign: () => void;
  onViewProfile: () => void;
  onViewDoc: (d: UserDocument) => void;
  onApproveDoc: (d: UserDocument) => void;
  onRejectDoc: (d: UserDocument) => void;
  staffName: (id: string | null) => string;
  countryName: (code: string) => string;
  riskCategoryBadge: (cat: KybCase["riskCategory"]) => React.ReactNode;
  slaBadge: (d: number) => React.ReactNode;
  merchantStatusBadge: (s: MerchantStatus) => React.ReactNode;
  platformChips: (p: PlatformKey[]) => React.ReactNode;
}) {
  const badge = statusBadge("kyb", kyb.status);
  const canAct = kyb.status !== "approved" && kyb.status !== "rejected";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Case header */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="size-4 text-amber-600" />
              <span className="font-medium text-sm">{kyb.merchantName}</span>
              {merchant && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  {merchant.merchantCode}
                </Badge>
              )}
              <Badge variant="secondary" className={cn("text-[10px]", badge.className)}>
                {badge.label}
              </Badge>
              {riskCategoryBadge(kyb.riskCategory)}
              {slaBadge(kyb.slaDeadline)}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground mt-1">
              {kyb.id} · {kyb.countryCode} · {countryName(kyb.countryCode)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Type: {kyb.businessType} · Submitted {timeAgo(kyb.submittedAt)} ·
              Reviewer: {staffName(kyb.assignedReviewer)}
            </div>
          </div>
        </div>

        {/* Linked merchant record */}
        {merchant ? (
          <div className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-900/10 p-3 text-xs">
            <div className="flex items-center gap-1 font-medium text-emerald-800 dark:text-emerald-300 mb-1">
              <Building2 className="size-3" /> Linked merchant · {merchant.merchantCode}
              <Badge variant="outline" className="text-[9px] text-emerald-700 border-emerald-300 bg-white dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 ml-1">
                Live sync
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-muted-foreground">Trading:</span> {merchant.tradingName}
              </div>
              <div>
                <span className="text-muted-foreground">Legal:</span> {merchant.legalName}
              </div>
              <div>
                <span className="text-muted-foreground">Risk:</span>{" "}
                <span className="capitalize">{merchant.riskCategory}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                {merchantStatusBadge(merchant.status)}
              </div>
              <div className="col-span-2 md:col-span-4">
                <span className="text-muted-foreground">Platforms:</span>{" "}
                {platformChips(merchant.platforms)}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-amber-300 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-900/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <Building2 className="size-3.5 inline mr-1 -mt-0.5" />
            No linked merchant record — approval/rejection will be recorded on the case only.
          </div>
        )}

        {/* Inline documents */}
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1">
            <FileText className="size-3" /> Submitted Documents ({docs.length})
          </div>
          {docs.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground italic">
              No documents uploaded yet for this case.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {docs.map((d) => (
                <DocumentCard
                  key={d.id}
                  doc={d}
                  onView={() => onViewDoc(d)}
                  onApprove={() => onApproveDoc(d)}
                  onReject={() => onRejectDoc(d)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        {kyb.notes && (
          <div className="rounded-md border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 p-2.5 text-xs text-amber-900 dark:text-amber-200">
            <span className="font-medium">Analyst notes:</span> {kyb.notes}
          </div>
        )}

        {/* Actions */}
        <ActionBar
          canAct={canAct}
          statusLabel={badge.label}
          viewProfileLabel="View merchant profile"
          onApprove={onApprove}
          onReject={onReject}
          onEscalate={onEscalate}
          onRequestDocs={onRequestDocs}
          onAssign={onAssign}
          onViewProfile={onViewProfile}
        />
      </CardContent>
    </Card>
  );
}

/* --------------------------- Document card (inline) --------------------------- */

function DocumentCard({
  doc,
  onView,
  onApprove,
  onReject,
}: {
  doc: UserDocument;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const statusStyle = DOCUMENT_STATUS_STYLES[doc.status];
  const typeLabel = DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType.replace(/_/g, " ");
  const canReview = doc.status === "pending" || doc.status === "replacement_requested";

  return (
    <div className="rounded-md border p-2.5 space-y-1.5 bg-card">
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="size-7 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <FileText className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium truncate">{typeLabel}</div>
            <div className="text-[10px] text-muted-foreground font-mono truncate">
              {doc.fileName}
            </div>
          </div>
        </div>
        <Badge variant="secondary" className={cn("text-[9px] shrink-0", statusStyle.className)}>
          {statusStyle.label}
        </Badge>
      </div>
      <div className="text-[10px] text-muted-foreground">
        Uploaded {timeAgo(doc.uploadedAt)}
      </div>
      <div className="flex items-center gap-1 pt-0.5">
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] flex-1"
          onClick={onView}
        >
          <Eye className="size-3 mr-1" /> View
        </Button>
        {canReview && (
          <>
            <Button
              size="sm"
              className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onApprove}
            >
              <Check className="size-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
              onClick={onReject}
            >
              <X className="size-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Document viewer dialog --------------------------- */

/**
 * Document metadata viewer — NO download button.
 * Shows type, file name, entity, country, uploaded date, status, reviewed by,
 * notes, and a placeholder explaining the file is stored in Firebase Storage
 * (production preview only).
 */
function DocumentViewerDialog({
  doc,
  countryName,
  staffName,
  onOpenChange,
}: {
  doc: UserDocument | null;
  countryName: (code: string) => string;
  staffName: (id: string | null) => string;
  onOpenChange: (open: boolean) => void;
}) {
  if (!doc) return null;
  const statusStyle = DOCUMENT_STATUS_STYLES[doc.status];
  const typeLabel = DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType.replace(/_/g, " ");

  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="size-5 text-emerald-600" />
            Document metadata
          </DialogTitle>
          <DialogDescription>
            Inline review only — no download available from the admin portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Status badge */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {typeLabel}
            </Badge>
            <Badge variant="secondary" className={cn("text-[10px]", statusStyle.className)}>
              {statusStyle.label}
            </Badge>
          </div>

          {/* Metadata rows */}
          <div className="rounded-md border divide-y">
            <DetailRow
              label="Type"
              value={<span className="text-sm">{typeLabel}</span>}
            />
            <DetailRow
              label="File name"
              value={<span className="text-xs font-mono break-all">{doc.fileName}</span>}
            />
            <DetailRow
              label="MIME type"
              value={<span className="text-xs font-mono">{doc.mimeType || "—"}</span>}
            />
            <DetailRow
              label="Entity"
              value={
                <span className="text-xs">
                  <span className="capitalize">{doc.entityType}</span> · {doc.entityName}
                </span>
              }
            />
            <DetailRow
              label="Country"
              value={
                <span className="text-xs">
                  <span className="font-mono">{doc.countryCode}</span>
                  <span className="text-muted-foreground ml-1">· {countryName(doc.countryCode)}</span>
                </span>
              }
            />
            <DetailRow
              label="Uploaded"
              value={<span className="text-xs">{formatDateTime(doc.uploadedAt)}</span>}
            />
            <DetailRow
              label="Status"
              value={
                <Badge variant="secondary" className={cn("text-[10px]", statusStyle.className)}>
                  {statusStyle.label}
                </Badge>
              }
            />
            <DetailRow
              label="Reviewed by"
              value={
                doc.reviewedBy ? (
                  <span className="text-xs">
                    {staffName(doc.reviewedBy)}
                    {doc.reviewedAt && (
                      <span className="text-muted-foreground ml-1">
                        · {formatDateTime(doc.reviewedAt)}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Not yet reviewed</span>
                )
              }
            />
            {doc.notes && (
              <DetailRow
                label="Notes"
                value={<span className="text-xs">{doc.notes}</span>}
              />
            )}
          </div>

          {/* Preview placeholder */}
          <div className="rounded-md border border-dashed border-emerald-300 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-900/10 p-4 text-center">
            <ImageIcon className="size-8 text-emerald-600 mx-auto mb-1.5" />
            <div className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
              Document preview available in production
            </div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
              File stored in Firebase Storage — preview rendered server-side
              when the storage bucket is configured.
            </div>
          </div>

          {/* No-download notice */}
          <div className="rounded-md border border-amber-200 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-900/10 p-2 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
            <Download className="size-3 mt-0.5 shrink-0" />
            <span>
              <strong>No download</strong> — admin portal does not allow
              downloading customer documents. All review is done inline for
              compliance and data-protection reasons.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 px-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm text-right min-w-0">{value}</span>
    </div>
  );
}
