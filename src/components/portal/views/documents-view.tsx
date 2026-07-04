"use client";

/**
 * Documents — §21
 *
 * Review of KYC/KYB documents uploaded by consumers (Faya Pay app) and
 * merchants (Faya Business app). Actions: Approve, Reject, Request replacement,
 * View (permission-gated; we toast a masked preview in this MVP).
 */
import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Search,
  Filter,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  Clock,
  X,
  FileCheck2,
  FileWarning,
  HardDriveUpload,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer, StatCard, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
import {
  getVisibleCountries,
  getVisibleCountryCodes,
  getScopeLabel,
} from "@/lib/access-scope";
import { formatDateTime, timeAgo } from "@/lib/formatters";
import type {
  UserDocument,
  CountryConfig,
  DocumentType,
} from "@/lib/types";

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
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

const STATUS_STYLES: Record<UserDocument["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  expired: { label: "Expired", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  replacement_requested: { label: "Replacement Requested", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
};

type TabKey = "pending" | "approved" | "rejected" | "all";

export function DocumentsView() {
  const { staff: currentStaff } = useAuth();

  const [items, setItems] = useState<UserDocument[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);

  useEffect(() => adminData.subscribeDocuments(setItems), []);
  useEffect(() => adminData.subscribeCountries(setCountries), []);

  const visibleCodes = useMemo(
    () => getVisibleCountryCodes(currentStaff, countries),
    [currentStaff, countries],
  );
  const visibleCountries = useMemo(
    () => getVisibleCountries(currentStaff, countries),
    [currentStaff, countries],
  );

  const [tab, setTab] = useState<TabKey>("pending");
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Action dialog
  type ActionMode = "approve" | "reject" | "replace";
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [target, setTarget] = useState<UserDocument | null>(null);
  const [note, setNote] = useState("");

  const scoped = useMemo(
    () => items.filter((d) => visibleCodes.has(d.countryCode)),
    [items, visibleCodes],
  );

  const filtered = useMemo(() => {
    return scoped.filter((d) => {
      if (tab === "pending" && d.status !== "pending") return false;
      if (tab === "approved" && d.status !== "approved") return false;
      if (tab === "rejected" && d.status !== "rejected" && d.status !== "expired" && d.status !== "replacement_requested") return false;
      if (countryFilter !== "all" && d.countryCode !== countryFilter) return false;
      if (typeFilter !== "all" && d.documentType !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${d.entityName} ${d.fileName} ${d.documentType} ${d.entityId} ${d.countryCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scoped, tab, countryFilter, typeFilter, search]);

  const stats = useMemo(() => {
    return {
      total: scoped.length,
      pending: scoped.filter((d) => d.status === "pending").length,
      approved: scoped.filter((d) => d.status === "approved").length,
      rejected: scoped.filter((d) => d.status === "rejected" || d.status === "expired").length,
    };
  }, [scoped]);

  const hasActiveFilters = search !== "" || countryFilter !== "all" || typeFilter !== "all";

  const actor = currentStaff
    ? {
        staffId: currentStaff.id,
        staffName: `${currentStaff.firstName} ${currentStaff.lastName}`,
        department: currentStaff.departmentId,
        role: currentStaff.roleId,
      }
    : null;

  function openAction(mode: ActionMode, doc: UserDocument) {
    setActionMode(mode);
    setTarget(doc);
    setNote("");
  }

  function submitAction() {
    if (!target || !actor || !actionMode) return;
    const now = Date.now();
    const before = target.status;

    let nextStatus: UserDocument["status"];
    let actionKey: string;
    let toastMsg: string;

    if (actionMode === "approve") {
      nextStatus = "approved";
      actionKey = "document.approve";
      toastMsg = `Document approved — ${target.entityName}`;
    } else if (actionMode === "reject") {
      if (note.trim().length < 3) {
        toast.error("Please provide a rejection reason (min 3 chars)");
        return;
      }
      nextStatus = "rejected";
      actionKey = "document.reject";
      toastMsg = `Document rejected — ${target.entityName}`;
    } else {
      nextStatus = "replacement_requested";
      actionKey = "document.request_replacement";
      toastMsg = `Replacement requested — ${target.entityName}`;
    }

    const patch: Partial<UserDocument> = {
      status: nextStatus,
      reviewedBy: actor.staffId,
      reviewedAt: now,
      notes: note.trim() || target.notes,
      // fileName/mimeType unchanged
    } as Partial<UserDocument>;

    adminData
      .updateDocument(target.id, patch)
      .then(() => {
        logAudit(actor, actionKey, "document", target.id, {
          countryCode: target.countryCode,
          beforeValue: before,
          afterValue: nextStatus,
          reason: note.trim() || undefined,
        });
        toast.success(toastMsg);
      })
      .catch((e) => toast.error("Failed to update document", { description: String(e) }));

    setActionMode(null);
    setTarget(null);
    setNote("");
  }

  function handleView(doc: UserDocument) {
    // Permission-gated: in a full impl, this would fetch a signed URL or stream the bytes.
    // In the MVP we toast a masked preview and log the access.
    if (!actor) return;
    logAudit(actor, "document.view", "document", doc.id, {
      countryCode: doc.countryCode,
      reason: "Admin viewed document content (masked preview)",
    });
    toast.info("Document opened (masked preview)", {
      description: `${doc.fileName} · ${DOC_TYPE_LABELS[doc.documentType]} · ${doc.entityName}`,
    });
  }

  return (
    <>
      <ViewHeader
        title="Documents"
        description={`KYC & KYB document review · Your scope: ${getScopeLabel(currentStaff)}`}
        icon={FileText}
        actions={
          <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
            {stats.pending} pending
          </Badge>
        }
      />
      <ViewContainer>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard label="Total Documents" value={stats.total} hint="in your scope" icon={FileText} tone="default" />
          <StatCard label="Pending Review" value={stats.pending} hint="awaiting reviewer" icon={Clock} tone="warning" />
          <StatCard label="Approved" value={stats.approved} icon={FileCheck2} tone="success" />
          <StatCard label="Rejected / Expired" value={stats.rejected} icon={FileWarning} tone="danger" />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="pending">
              Pending
              <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                {stats.pending}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          {/* Filter card — same for all tabs */}
          <Card className="mt-3">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">Search</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Entity, file name, document type…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-44">
                  <Label className="text-xs text-muted-foreground">Country</Label>
                  <Select value={countryFilter} onValueChange={setCountryFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All countries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All countries</SelectItem>
                      {visibleCountries.map((c) => (
                        <SelectItem key={c.countryCode} value={c.countryCode}>
                          {c.countryCode} · {c.countryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-56">
                  <Label className="text-xs text-muted-foreground">Document type</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setCountryFilter("all");
                      setTypeFilter("all");
                    }}
                    className="text-muted-foreground"
                  >
                    <X className="size-4 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {(["pending", "approved", "rejected", "all"] as TabKey[]).map((t) => (
            <TabsContent key={t} value={t}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Filter className="size-4 text-emerald-600" />
                    Documents
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {filtered.length} shown
                  </span>
                </CardHeader>
                <CardContent className="p-0">
                  {filtered.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="No documents"
                      description="Documents uploaded by Faya Pay consumers and Faya Business merchants will appear here."
                    />
                  ) : (
                    <div className="max-h-[70vh] overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 backdrop-blur">
                          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-2.5 font-medium">File / Entity</th>
                            <th className="px-4 py-2.5 font-medium hidden md:table-cell">Type</th>
                            <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Country</th>
                            <th className="px-4 py-2.5 font-medium">Status</th>
                            <th className="px-4 py-2.5 font-medium hidden xl:table-cell">Reviewer</th>
                            <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Uploaded</th>
                            <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((d) => {
                            const status = STATUS_STYLES[d.status];
                            return (
                              <tr
                                key={d.id}
                                className="border-t hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10"
                              >
                                <td className="px-4 py-2.5">
                                  <div className="flex items-start gap-2 min-w-0">
                                    <FileText className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                      <div className="font-medium truncate">{d.fileName}</div>
                                      <div className="text-xs text-muted-foreground truncate">
                                        {d.entityName} · <span className="font-mono">{d.entityId}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 hidden md:table-cell">
                                  <Badge variant="outline" className="text-xs">
                                    {DOC_TYPE_LABELS[d.documentType]}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2.5 hidden lg:table-cell">
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {d.countryCode}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2.5">
                                  <Badge variant="secondary" className={`text-xs ${status.className}`}>
                                    {status.label}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2.5 hidden xl:table-cell text-xs text-muted-foreground">
                                  {d.reviewedBy ? (
                                    <span className="font-mono">{d.reviewedBy}</span>
                                  ) : (
                                    <span className="italic">Unassigned</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 hidden sm:table-cell text-xs text-muted-foreground">
                                  {timeAgo(d.uploadedAt)}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="size-8">
                                        <MoreHorizontal className="size-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52">
                                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                      <DropdownMenuItem onClick={() => handleView(d)}>
                                        <Eye className="size-4 mr-2" /> View (masked)
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => openAction("approve", d)}
                                        disabled={d.status === "approved"}
                                        className="text-emerald-700"
                                      >
                                        <CheckCircle2 className="size-4 mr-2" /> Approve
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => openAction("reject", d)}
                                        disabled={d.status === "rejected"}
                                        className="text-red-700"
                                      >
                                        <XCircle className="size-4 mr-2" /> Reject
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => openAction("replace", d)}
                                        disabled={d.status === "replacement_requested"}
                                      >
                                        <RefreshCw className="size-4 mr-2" /> Request replacement
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </ViewContainer>

      {/* Action dialog */}
      <Dialog open={!!actionMode} onOpenChange={(o) => !o && setActionMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionMode === "approve" && "Approve document"}
              {actionMode === "reject" && "Reject document"}
              {actionMode === "replace" && "Request replacement"}
            </DialogTitle>
            <DialogDescription>
              {target && (
                <>
                  <span className="font-mono text-xs">{target.fileName}</span>
                  <br />
                  {target.entityName} · {DOC_TYPE_LABELS[target.documentType]}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border bg-slate-50 dark:bg-slate-900 p-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted-foreground">Current status</span>
                {target && (
                  <Badge variant="secondary" className={STATUS_STYLES[target.status].className}>
                    {STATUS_STYLES[target.status].label}
                  </Badge>
                )}
              </div>
              {target?.reviewedAt && (
                <div className="text-muted-foreground">
                  Last reviewed {formatDateTime(target.reviewedAt)} by{" "}
                  <span className="font-mono">{target.reviewedBy}</span>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="note">
                {actionMode === "reject"
                  ? "Rejection reason (required)"
                  : actionMode === "replace"
                    ? "Why is a replacement needed? (required)"
                    : "Reviewer note (optional)"}
              </Label>
              <Textarea
                id="note"
                placeholder={
                  actionMode === "reject"
                    ? "e.g. Photo is blurred, cannot read ID number…"
                    : actionMode === "replace"
                      ? "e.g. Document expired, please upload a current one…"
                      : "Add any context for this approval…"
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
            {actionMode === "approve" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-800 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex gap-2">
                <HardDriveUpload className="size-4 shrink-0 mt-0.5" />
                <span>
                  Approving will mark the document as verified and feed the result back to the
                  consumer's KYC (Faya Pay) or merchant's KYB (Faya Business) case.
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionMode(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitAction}
              className={
                actionMode === "reject"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : actionMode === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : ""
              }
            >
              {actionMode === "approve" && <CheckCircle2 className="size-4 mr-1" />}
              {actionMode === "reject" && <XCircle className="size-4 mr-1" />}
              {actionMode === "replace" && <RefreshCw className="size-4 mr-1" />}
              {actionMode === "approve" && "Approve"}
              {actionMode === "reject" && "Reject"}
              {actionMode === "replace" && "Request replacement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}
