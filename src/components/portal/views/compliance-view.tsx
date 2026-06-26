"use client";

/**
 * Faya Admin Portal — Compliance (KYC / KYB) View
 * Implements §11.1 Compliance Admin Pages.
 *
 * Tabs:
 *   - KYC Queue       : customer identity submissions + actions
 *   - KYB Queue       : merchant business submissions + actions
 *   - Sanctions/PEP   : escalated KYC cases + workflow overview
 *   - Manual Review   : in_review KYC + KYB cases (combined)
 *   - Approved        : approved KYC + KYB cases (combined)
 *   - Rejected        : rejected KYC + KYB cases (combined)
 *
 * Country scoping: Super Admin sees all countries; other staff see only
 * the country codes listed on their `staff.countries` access record.
 *
 * Every action is mirrored to the audit log via `logAudit(...)` with the
 * action keys: kyc.approve / kyc.reject / kyc.escalate / kyc.request_documents
 * and the kyb.* equivalents.
 */
import { useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer, EmptyState, StatCard } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
import { formatDateTime, slaStatus, statusBadge, timeAgo } from "@/lib/formatters";
import type { KycCase, KybCase, AdminStaff, CountryConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ComplianceViewProps {
  kycCases: KycCase[];
  kybCases: KybCase[];
  staff: AdminStaff[];
  countries: CountryConfig[];
}

const SUPER_ADMIN_DEPT = "dept_super_admin";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In Review" },
  { value: "escalated", label: "Escalated" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

export function ComplianceView({ kycCases, kybCases, staff, countries }: ComplianceViewProps) {
  const { staff: currentStaff } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("kyc");

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

  /* --------------------- Detail sheet + dialog ------------------- */
  const [selectedKyc, setSelectedKyc] = useState<KycCase | null>(null);
  const [selectedKyb, setSelectedKyb] = useState<KybCase | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{
    type: "kyc" | "kyb";
    id: string;
    name: string;
  } | null>(null);

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
    toast.success(`KYC approved: ${k.customerName}`, {
      description: `Case ${k.id} · ${countryName(k.countryCode)}`,
    });
    setSelectedKyc(null);
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
    toast.error(`KYC rejected: ${k.customerName}`, { description: `Case ${k.id}` });
    setSelectedKyc(null);
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
    setSelectedKyc(null);
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
    const newStatus: KycCase["status"] = k.status === "pending" ? "in_review" : k.status;
    adminData.updateKyc(k.id, { assignedReviewer: currentStaff.id, status: newStatus });
    logAudit(actor, "kyc.assign", "kyc_case", k.id, {
      countryCode: k.countryCode,
      afterValue: `${currentStaff.firstName} ${currentStaff.lastName}`,
    });
    toast.success(`Assigned to you: ${k.customerName}`, {
      description: `You are now the reviewer for case ${k.id}`,
    });
    setSelectedKyc({ ...k, assignedReviewer: currentStaff.id, status: newStatus });
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
    toast.success(`KYB approved: ${k.merchantName}`, {
      description: `Case ${k.id} · ${countryName(k.countryCode)}`,
    });
    setSelectedKyb(null);
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
    toast.error(`KYB rejected: ${k.merchantName}`, { description: `Case ${k.id}` });
    setSelectedKyb(null);
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
    setSelectedKyb(null);
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
    const newStatus: KybCase["status"] = k.status === "pending" ? "in_review" : k.status;
    adminData.updateKyb(k.id, { assignedReviewer: currentStaff.id, status: newStatus });
    logAudit(actor, "kyb.assign", "kyb_case", k.id, {
      countryCode: k.countryCode,
      afterValue: `${currentStaff.firstName} ${currentStaff.lastName}`,
    });
    toast.success(`Assigned to you: ${k.merchantName}`, {
      description: `You are now the reviewer for case ${k.id}`,
    });
    setSelectedKyb({ ...k, assignedReviewer: currentStaff.id, status: newStatus });
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

  function docChips(docs: string[], emptyLabel = "—"): React.ReactNode {
    if (!docs || docs.length === 0) {
      return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
    }
    return (
      <div className="flex flex-wrap gap-1 max-w-[220px]">
        {docs.map((d) => (
          <Badge
            key={d}
            variant="outline"
            className="text-[10px] font-normal px-1.5 py-0 capitalize"
          >
            <FileText className="size-2.5 mr-0.5" />
            {d.replace(/_/g, " ")}
          </Badge>
        ))}
      </div>
    );
  }

  function typeBadge(type: "kyc" | "kyb"): React.ReactNode {
    return type === "kyc" ? (
      <Badge
        variant="outline"
        className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
      >
        <ShieldCheck className="size-2.5 mr-0.5" />
        KYC
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="text-[10px] text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
      >
        <FileText className="size-2.5 mr-0.5" />
        KYB
      </Badge>
    );
  }

  function reviewerCell(id: string | null): React.ReactNode {
    if (!id) {
      return <span className="text-xs text-muted-foreground italic">Unassigned</span>;
    }
    const s = staff.find((x) => x.id === id);
    return (
      <span className="text-xs inline-flex items-center gap-1">
        <UserCheck className="size-3 text-emerald-600" />
        {s ? `${s.firstName} ${s.lastName}` : id}
      </span>
    );
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
          <TabsContent value="kyc">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  KYC Queue
                  <Badge variant="secondary" className="text-[10px]">
                    {filteredKyc.length}
                  </Badge>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search customer name..."
                      value={kycSearch}
                      onChange={(e) => setKycSearch(e.target.value)}
                      className="pl-7 h-8 w-56 text-xs"
                    />
                  </div>
                  <Select value={kycCountry} onValueChange={setKycCountry}>
                    <SelectTrigger size="sm" className="w-44 text-xs h-8">
                      <Filter className="size-3 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All countries</SelectItem>
                      {filterableCountries.map((c) => (
                        <SelectItem key={c.countryCode} value={c.countryCode}>
                          {c.countryCode} · {c.countryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={kycStatus} onValueChange={setKycStatus}>
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
              <CardContent className="p-0">
                {filteredKyc.length === 0 ? (
                  <EmptyState
                    icon={ShieldCheck}
                    title="No KYC cases match"
                    description="Adjust the filters above or check back later for new submissions."
                  />
                ) : (
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                      <TableRow>
                        <TableHead className="pl-4">Customer</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Nationality</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Documents</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reviewer</TableHead>
                        <TableHead>SLA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredKyc.map((k) => {
                        const badge = statusBadge("kyc", k.status);
                        return (
                          <TableRow
                            key={k.id}
                            className="cursor-pointer"
                            onClick={() => setSelectedKyc(k)}
                          >
                            <TableCell className="pl-4 font-medium">{k.customerName}</TableCell>
                            <TableCell className="text-xs">
                              <span className="font-mono">{k.countryCode}</span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {k.nationality}
                            </TableCell>
                            <TableCell>{riskScoreBadge(k.riskScore)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {timeAgo(k.submittedAt)}
                            </TableCell>
                            <TableCell>{docChips(k.requiredDocuments)}</TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={cn("text-[10px]", badge.className)}
                              >
                                {badge.label}
                              </Badge>
                            </TableCell>
                            <TableCell>{reviewerCell(k.assignedReviewer)}</TableCell>
                            <TableCell>{slaBadge(k.slaDeadline)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </ScrollTable>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------------- KYB QUEUE ---------------------- */}
          <TabsContent value="kyb">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="size-4 text-amber-600" />
                  KYB Queue
                  <Badge variant="secondary" className="text-[10px]">
                    {filteredKyb.length}
                  </Badge>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search merchant name..."
                      value={kybSearch}
                      onChange={(e) => setKybSearch(e.target.value)}
                      className="pl-7 h-8 w-56 text-xs"
                    />
                  </div>
                  <Select value={kybCountry} onValueChange={setKybCountry}>
                    <SelectTrigger size="sm" className="w-44 text-xs h-8">
                      <Filter className="size-3 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All countries</SelectItem>
                      {filterableCountries.map((c) => (
                        <SelectItem key={c.countryCode} value={c.countryCode}>
                          {c.countryCode} · {c.countryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={kybStatus} onValueChange={setKybStatus}>
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
              <CardContent className="p-0">
                {filteredKyb.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No KYB cases match"
                    description="Adjust the filters above or check back later for new merchant onboarding submissions."
                  />
                ) : (
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                      <TableRow>
                        <TableHead className="pl-4">Merchant</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Business type</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Missing docs</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reviewer</TableHead>
                        <TableHead>SLA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredKyb.map((k) => {
                        const badge = statusBadge("kyb", k.status);
                        return (
                          <TableRow
                            key={k.id}
                            className="cursor-pointer"
                            onClick={() => setSelectedKyb(k)}
                          >
                            <TableCell className="pl-4 font-medium">{k.merchantName}</TableCell>
                            <TableCell className="text-xs">
                              <span className="font-mono">{k.countryCode}</span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {k.businessType}
                            </TableCell>
                            <TableCell>{riskCategoryBadge(k.riskCategory)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {timeAgo(k.submittedAt)}
                            </TableCell>
                            <TableCell>{docChips(k.missingDocuments, "Complete")}</TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={cn("text-[10px]", badge.className)}
                              >
                                {badge.label}
                              </Badge>
                            </TableCell>
                            <TableCell>{reviewerCell(k.assignedReviewer)}</TableCell>
                            <TableCell>{slaBadge(k.slaDeadline)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </ScrollTable>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* -------------------- SANCTIONS / PEP ------------------- */}
          <TabsContent value="sanctions" className="space-y-4">
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
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                      <TableRow>
                        <TableHead className="pl-4">Customer</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Reviewer</TableHead>
                        <TableHead>SLA</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {escalatedKyc.map((k) => (
                        <TableRow
                          key={k.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedKyc(k)}
                        >
                          <TableCell className="pl-4 font-medium">{k.customerName}</TableCell>
                          <TableCell className="text-xs font-mono">{k.countryCode}</TableCell>
                          <TableCell>{riskScoreBadge(k.riskScore)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {timeAgo(k.submittedAt)}
                          </TableCell>
                          <TableCell>{reviewerCell(k.assignedReviewer)}</TableCell>
                          <TableCell>{slaBadge(k.slaDeadline)}</TableCell>
                          <TableCell className="max-w-[280px]">
                            {k.notes ? (
                              <span className="text-xs text-amber-800 dark:text-amber-300 line-clamp-2">
                                {k.notes}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </ScrollTable>
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
          <TabsContent value="manual">
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
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                      <TableRow>
                        <TableHead className="pl-4">Type</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Reviewer</TableHead>
                        <TableHead>SLA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {manualReviewKyc.map((k) => (
                        <TableRow
                          key={k.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedKyc(k)}
                        >
                          <TableCell className="pl-4">{typeBadge("kyc")}</TableCell>
                          <TableCell className="font-medium">{k.customerName}</TableCell>
                          <TableCell className="text-xs font-mono">{k.countryCode}</TableCell>
                          <TableCell>{riskScoreBadge(k.riskScore)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {timeAgo(k.submittedAt)}
                          </TableCell>
                          <TableCell>{reviewerCell(k.assignedReviewer)}</TableCell>
                          <TableCell>{slaBadge(k.slaDeadline)}</TableCell>
                        </TableRow>
                      ))}
                      {manualReviewKyb.map((k) => (
                        <TableRow
                          key={k.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedKyb(k)}
                        >
                          <TableCell className="pl-4">{typeBadge("kyb")}</TableCell>
                          <TableCell className="font-medium">{k.merchantName}</TableCell>
                          <TableCell className="text-xs font-mono">{k.countryCode}</TableCell>
                          <TableCell>{riskCategoryBadge(k.riskCategory)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {timeAgo(k.submittedAt)}
                          </TableCell>
                          <TableCell>{reviewerCell(k.assignedReviewer)}</TableCell>
                          <TableCell>{slaBadge(k.slaDeadline)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </ScrollTable>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ----------------------- APPROVED ---------------------- */}
          <TabsContent value="approved">
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
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                      <TableRow>
                        <TableHead className="pl-4">Type</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Reviewer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approvedKyc.map((k) => (
                        <TableRow
                          key={k.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedKyc(k)}
                        >
                          <TableCell className="pl-4">{typeBadge("kyc")}</TableCell>
                          <TableCell className="font-medium">{k.customerName}</TableCell>
                          <TableCell className="text-xs font-mono">{k.countryCode}</TableCell>
                          <TableCell>{riskScoreBadge(k.riskScore)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {timeAgo(k.submittedAt)}
                          </TableCell>
                          <TableCell>{reviewerCell(k.assignedReviewer)}</TableCell>
                        </TableRow>
                      ))}
                      {approvedKyb.map((k) => (
                        <TableRow
                          key={k.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedKyb(k)}
                        >
                          <TableCell className="pl-4">{typeBadge("kyb")}</TableCell>
                          <TableCell className="font-medium">{k.merchantName}</TableCell>
                          <TableCell className="text-xs font-mono">{k.countryCode}</TableCell>
                          <TableCell>{riskCategoryBadge(k.riskCategory)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {timeAgo(k.submittedAt)}
                          </TableCell>
                          <TableCell>{reviewerCell(k.assignedReviewer)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </ScrollTable>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ----------------------- REJECTED ---------------------- */}
          <TabsContent value="rejected">
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
                  <ScrollTable>
                    <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                      <TableRow>
                        <TableHead className="pl-4">Type</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Reviewer</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rejectedKyc.map((k) => (
                        <TableRow
                          key={k.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedKyc(k)}
                        >
                          <TableCell className="pl-4">{typeBadge("kyc")}</TableCell>
                          <TableCell className="font-medium">{k.customerName}</TableCell>
                          <TableCell className="text-xs font-mono">{k.countryCode}</TableCell>
                          <TableCell>{riskScoreBadge(k.riskScore)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {timeAgo(k.submittedAt)}
                          </TableCell>
                          <TableCell>{reviewerCell(k.assignedReviewer)}</TableCell>
                          <TableCell className="max-w-[240px] text-xs text-muted-foreground line-clamp-2">
                            {k.notes || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {rejectedKyb.map((k) => (
                        <TableRow
                          key={k.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedKyb(k)}
                        >
                          <TableCell className="pl-4">{typeBadge("kyb")}</TableCell>
                          <TableCell className="font-medium">{k.merchantName}</TableCell>
                          <TableCell className="text-xs font-mono">{k.countryCode}</TableCell>
                          <TableCell>{riskCategoryBadge(k.riskCategory)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {timeAgo(k.submittedAt)}
                          </TableCell>
                          <TableCell>{reviewerCell(k.assignedReviewer)}</TableCell>
                          <TableCell className="max-w-[240px] text-xs text-muted-foreground line-clamp-2">
                            {k.notes || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </ScrollTable>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </ViewContainer>

      {/* ------------------- KYC Detail Sheet ------------------- */}
      <Sheet open={!!selectedKyc} onOpenChange={(o) => !o && setSelectedKyc(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
          {selectedKyc && (
            <KycDetailSheet
              kyc={selectedKyc}
              staffName={staffName}
              countryName={countryName}
              onClose={() => setSelectedKyc(null)}
              onApprove={() => approveKyc(selectedKyc)}
              onReject={() =>
                setRejectTarget({
                  type: "kyc",
                  id: selectedKyc.id,
                  name: selectedKyc.customerName,
                })
              }
              onEscalate={() => escalateKyc(selectedKyc)}
              onRequestDocs={() => requestDocsKyc(selectedKyc)}
              onAssign={() => assignReviewerKyc(selectedKyc)}
              riskScoreBadge={riskScoreBadge}
              slaBadge={slaBadge}
              docChips={docChips}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ------------------- KYB Detail Sheet ------------------- */}
      <Sheet open={!!selectedKyb} onOpenChange={(o) => !o && setSelectedKyb(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
          {selectedKyb && (
            <KybDetailSheet
              kyb={selectedKyb}
              staffName={staffName}
              countryName={countryName}
              onClose={() => setSelectedKyb(null)}
              onApprove={() => approveKyb(selectedKyb)}
              onReject={() =>
                setRejectTarget({
                  type: "kyb",
                  id: selectedKyb.id,
                  name: selectedKyb.merchantName,
                })
              }
              onEscalate={() => escalateKyb(selectedKyb)}
              onRequestDocs={() => requestDocsKyb(selectedKyb)}
              onAssign={() => assignReviewerKyb(selectedKyb)}
              slaBadge={slaBadge}
              docChips={docChips}
            />
          )}
        </SheetContent>
      </Sheet>

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

/**
 * Scrollable table wrapper with sticky-header support and custom scrollbar.
 *
 * NOTE: we use a raw <table> here (not the Table primitive) because the
 * Table primitive wraps the table in its own `overflow-x-auto` div, which
 * becomes a separate scroll container and prevents the <thead> from sticking
 * to this outer vertical-scroll viewport.
 */
function ScrollTable({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={
        "max-h-[60vh] overflow-auto " +
        "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent " +
        "[&::-webkit-scrollbar-thumb]:rounded-full " +
        "[&::-webkit-scrollbar-thumb]:bg-slate-300 " +
        "dark:[&::-webkit-scrollbar-thumb]:bg-slate-700"
      }
    >
      <table className="w-full caption-bottom text-sm">{children}</table>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm text-right min-w-0">{value}</span>
    </div>
  );
}

function ActionButtons({
  canAct,
  onApprove,
  onReject,
  onEscalate,
  onRequestDocs,
  onAssign,
  statusLabel,
}: {
  canAct: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEscalate: () => void;
  onRequestDocs: () => void;
  onAssign: () => void;
  statusLabel: string;
}) {
  if (!canAct) {
    return (
      <div className="text-center text-xs text-muted-foreground py-3 border rounded-md bg-muted/30">
        Case is <span className="font-medium">{statusLabel}</span> — no further actions available.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={onApprove}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Check className="size-4" /> Approve
        </Button>
        <Button onClick={onReject} variant="destructive">
          <X className="size-4" /> Reject
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onRequestDocs} variant="outline">
          <FileText className="size-4" /> Request docs
        </Button>
        <Button
          onClick={onEscalate}
          variant="outline"
          className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900/20"
        >
          <ArrowUpCircle className="size-4" /> Escalate
        </Button>
      </div>
      <Button onClick={onAssign} variant="secondary" className="w-full">
        <UserCheck className="size-4" /> Assign to me
      </Button>
    </div>
  );
}

function KycDetailSheet({
  kyc,
  staffName,
  countryName,
  onClose,
  onApprove,
  onReject,
  onEscalate,
  onRequestDocs,
  onAssign,
  riskScoreBadge,
  slaBadge,
  docChips,
}: {
  kyc: KycCase;
  staffName: (id: string | null) => string;
  countryName: (code: string) => string;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onEscalate: () => void;
  onRequestDocs: () => void;
  onAssign: () => void;
  riskScoreBadge: (s: number) => React.ReactNode;
  slaBadge: (d: number) => React.ReactNode;
  docChips: (d: string[], emptyLabel?: string) => React.ReactNode;
}) {
  const badge = statusBadge("kyc", kyc.status);
  const canAct = kyc.status !== "approved" && kyc.status !== "rejected";
  return (
    <>
      <SheetHeader>
        <SheetDescription className="text-[11px] font-mono">{kyc.id}</SheetDescription>
        <SheetTitle className="text-lg flex items-center gap-2">
          <ShieldCheck className="size-5 text-emerald-600" />
          {kyc.customerName}
        </SheetTitle>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant="secondary" className={cn("text-[10px]", badge.className)}>
            {badge.label}
          </Badge>
          {riskScoreBadge(kyc.riskScore)}
          {slaBadge(kyc.slaDeadline)}
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 space-y-4 text-sm">
        <div className="rounded-md border divide-y">
          <DetailRow label="Country" value={`${kyc.countryCode} · ${countryName(kyc.countryCode)}`} />
          <DetailRow label="Nationality" value={kyc.nationality} />
          <DetailRow label="Submitted" value={formatDateTime(kyc.submittedAt)} />
          <DetailRow label="SLA deadline" value={formatDateTime(kyc.slaDeadline)} />
          <DetailRow label="Risk score" value={`${kyc.riskScore} / 100`} />
          <DetailRow label="Reviewer" value={staffName(kyc.assignedReviewer)} />
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase mb-2">
            Required documents
          </div>
          {docChips(kyc.requiredDocuments, "No documents required")}
        </div>

        {kyc.notes && (
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
              Analyst notes
            </div>
            <p className="text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-md p-3 text-amber-900 dark:text-amber-200">
              {kyc.notes}
            </p>
          </div>
        )}
      </div>

      <SheetFooter className="flex flex-col gap-2 items-stretch">
        <ActionButtons
          canAct={canAct}
          statusLabel={badge.label}
          onApprove={onApprove}
          onReject={onReject}
          onEscalate={onEscalate}
          onRequestDocs={onRequestDocs}
          onAssign={onAssign}
        />
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </SheetFooter>
    </>
  );
}

function KybDetailSheet({
  kyb,
  staffName,
  countryName,
  onClose,
  onApprove,
  onReject,
  onEscalate,
  onRequestDocs,
  onAssign,
  slaBadge,
  docChips,
}: {
  kyb: KybCase;
  staffName: (id: string | null) => string;
  countryName: (code: string) => string;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onEscalate: () => void;
  onRequestDocs: () => void;
  onAssign: () => void;
  slaBadge: (d: number) => React.ReactNode;
  docChips: (d: string[], emptyLabel?: string) => React.ReactNode;
}) {
  const badge = statusBadge("kyb", kyb.status);
  const canAct = kyb.status !== "approved" && kyb.status !== "rejected";
  const riskBadge = statusBadge("risk", kyb.riskCategory);
  return (
    <>
      <SheetHeader>
        <SheetDescription className="text-[11px] font-mono">{kyb.id}</SheetDescription>
        <SheetTitle className="text-lg flex items-center gap-2">
          <FileText className="size-5 text-amber-600" />
          {kyb.merchantName}
        </SheetTitle>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant="secondary" className={cn("text-[10px]", badge.className)}>
            {badge.label}
          </Badge>
          <Badge variant="secondary" className={cn("text-[10px] capitalize", riskBadge.className)}>
            {riskBadge.label} risk
          </Badge>
          {slaBadge(kyb.slaDeadline)}
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 space-y-4 text-sm">
        <div className="rounded-md border divide-y">
          <DetailRow label="Country" value={`${kyb.countryCode} · ${countryName(kyb.countryCode)}`} />
          <DetailRow label="Business type" value={kyb.businessType} />
          <DetailRow label="Submitted" value={formatDateTime(kyb.submittedAt)} />
          <DetailRow label="SLA deadline" value={formatDateTime(kyb.slaDeadline)} />
          <DetailRow label="Risk category" value={<span className="capitalize">{kyb.riskCategory}</span>} />
          <DetailRow label="Reviewer" value={staffName(kyb.assignedReviewer)} />
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase mb-2">
            Missing documents
          </div>
          {docChips(kyb.missingDocuments, "All required documents received")}
        </div>

        {kyb.notes && (
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
              Analyst notes
            </div>
            <p className="text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-md p-3 text-amber-900 dark:text-amber-200">
              {kyb.notes}
            </p>
          </div>
        )}
      </div>

      <SheetFooter className="flex flex-col gap-2 items-stretch">
        <ActionButtons
          canAct={canAct}
          statusLabel={badge.label}
          onApprove={onApprove}
          onReject={onReject}
          onEscalate={onEscalate}
          onRequestDocs={onRequestDocs}
          onAssign={onAssign}
        />
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </SheetFooter>
    </>
  );
}
