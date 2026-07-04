"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, Eye, CheckCircle2, Archive } from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer, StatCard, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
import { formatDateTime, timeAgo } from "@/lib/formatters";
import type { LegalPolicy } from "@/lib/types";
import { cn } from "@/lib/utils";

const POLICY_TYPES: { value: string; label: string }[] = [
  { value: "consumer_terms", label: "Consumer Terms & Conditions" },
  { value: "merchant_terms", label: "Merchant Terms & Conditions" },
  { value: "pos_terms", label: "POS Terms of Use" },
  { value: "privacy_policy", label: "Privacy Policy" },
  { value: "cardholder_agreement", label: "Cardholder Agreement" },
  { value: "virtual_card_terms", label: "Virtual Card Terms" },
  { value: "physical_card_terms", label: "Physical Card Terms" },
  { value: "nfc_payment_terms", label: "NFC Payment Terms" },
  { value: "merchant_acquiring_agreement", label: "Merchant Acquiring Agreement" },
  { value: "settlement_terms", label: "Settlement Terms" },
  { value: "refund_policy", label: "Refund Policy" },
  { value: "chargeback_policy", label: "Chargeback Policy" },
  { value: "cookie_policy", label: "Cookie Policy" },
  { value: "data_processing_agreement", label: "Data Processing Agreement" },
  { value: "country_legal_notice", label: "Country-Specific Legal Notice" },
];

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  published: { label: "Published", className: "bg-emerald-100 text-emerald-800" },
  draft: { label: "Draft", className: "bg-amber-100 text-amber-800" },
  pending_approval: { label: "Pending Approval", className: "bg-sky-100 text-sky-800" },
  scheduled: { label: "Scheduled", className: "bg-purple-100 text-purple-800" },
  archived: { label: "Archived", className: "bg-gray-200 text-gray-700" },
};

export function TermsView() {
  const { staff } = useAuth();
  const [policies, setPolicies] = useState<LegalPolicy[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewPolicy, setViewPolicy] = useState<LegalPolicy | null>(null);

  useEffect(() => {
    const unsub = adminData.subscribePolicies(setPolicies);
    return () => unsub();
  }, []);

  const isSuperAdmin = staff?.departmentId === "dept_super_admin";
  const published = policies.filter((p) => (p.status as string) === "published");
  const drafts = policies.filter((p) => (p.status as string) === "draft");
  const pending = policies.filter((p) => (p.status as string) === "pending_approval");
  const archived = policies.filter((p) => (p.status as string) === "archived");

  async function publishPolicy(p: LegalPolicy) {
    if (!staff) return;
    const updated = { ...p, status: "published", publishedAt: Date.now(), updatedAt: Date.now(), approvedBy: staff.id };
    await adminData.updatePolicy(p.id, updated);
    logAudit({ staffId: staff.id, staffName: `${staff.firstName} ${staff.lastName}`, department: staff.departmentId, role: staff.roleId }, "policy.publish", "policy", p.id, { beforeValue: p.status as string, afterValue: "published" });
    toast.success(`Published: ${p.title} v${p.version}`);
  }

  async function archivePolicy(p: LegalPolicy) {
    if (!staff) return;
    await adminData.updatePolicy(p.id, { status: "archived", updatedAt: Date.now() });
    logAudit({ staffId: staff.id, staffName: `${staff.firstName} ${staff.lastName}`, department: staff.departmentId, role: staff.roleId }, "policy.archive", "policy", p.id, { beforeValue: p.status as string, afterValue: "archived" });
    toast.success(`Archived: ${p.title}`);
  }

  function PolicyCard({ p }: { p: LegalPolicy }) {
    const style = STATUS_STYLES[(p.status as string)] || STATUS_STYLES.published;
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{p.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {POLICY_TYPES.find((t) => t.value === (p.policyType as string))?.label || p.policyType} · v{p.version}
              </div>
            </div>
            <Badge variant="secondary" className={cn("text-[10px] shrink-0", style.className)}>{style.label}</Badge>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>App: {(p.appAffected as string) || "all"}</span>
            {p.countryCode && <span>Country: {p.countryCode}</span>}
            <span>Updated: {timeAgo(p.updatedAt ?? null)}</span>
          </div>
          {p.summaryOfChanges && <div className="text-xs text-muted-foreground line-clamp-2">{p.summaryOfChanges}</div>}
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setViewPolicy(p)}>
              <Eye className="size-3 mr-1" /> View
            </Button>
            {isSuperAdmin && (p.status as string) !== "published" && (
              <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => publishPolicy(p)}>
                <CheckCircle2 className="size-3 mr-1" /> Publish
              </Button>
            )}
            {isSuperAdmin && (p.status as string) === "published" && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => archivePolicy(p)}>
                <Archive className="size-3 mr-1" /> Archive
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ViewHeader
        title="Terms & Legal"
        description="Manage all legal content for Faya Pay, Faya Merchant, and Faya POS apps. Apps read published policies from here."
        icon={FileText}
        actions={isSuperAdmin ? (
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New Policy
          </Button>
        ) : undefined}
      />
      <ViewContainer>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard label="Total Policies" value={policies.length} icon={FileText} />
          <StatCard label="Published" value={published.length} tone="success" icon={CheckCircle2} />
          <StatCard label="Drafts" value={drafts.length} tone="warning" icon={FileText} />
          <StatCard label="Pending" value={pending.length} tone="info" icon={FileText} />
        </div>

        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20">
          <CardContent className="p-3 text-xs text-emerald-900 dark:text-emerald-200">
            <strong>How it works:</strong> Admin creates and publishes legal policies here. The 3 apps (Faya Pay, Faya Merchant, Faya POS)
            fetch published policies via <code className="font-mono">/api/legal-content</code>. When terms change materially, apps force
            users to accept the new version before using payment features. Apps cannot create their own terms — only admin controls legal content.
          </CardContent>
        </Card>

        <Tabs defaultValue="published">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="published" className="text-xs">Published ({published.length})</TabsTrigger>
            <TabsTrigger value="drafts" className="text-xs">Drafts ({drafts.length})</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="archived" className="text-xs">Archived ({archived.length})</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">All ({policies.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="published" className="mt-2">
            {published.length === 0 ? <EmptyState icon={FileText} title="No published policies" description="Create and publish policies for the apps to use." /> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{published.map((p) => <PolicyCard key={p.id} p={p} />)}</div>
            )}
          </TabsContent>
          <TabsContent value="drafts" className="mt-2">
            {drafts.length === 0 ? <EmptyState icon={FileText} title="No drafts" /> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{drafts.map((p) => <PolicyCard key={p.id} p={p} />)}</div>
            )}
          </TabsContent>
          <TabsContent value="pending" className="mt-2">
            {pending.length === 0 ? <EmptyState icon={FileText} title="No pending approvals" /> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pending.map((p) => <PolicyCard key={p.id} p={p} />)}</div>
            )}
          </TabsContent>
          <TabsContent value="archived" className="mt-2">
            {archived.length === 0 ? <EmptyState icon={FileText} title="No archived policies" /> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{archived.map((p) => <PolicyCard key={p.id} p={p} />)}</div>
            )}
          </TabsContent>
          <TabsContent value="all" className="mt-2">
            {policies.length === 0 ? <EmptyState icon={FileText} title="No policies yet" description="Create your first legal policy." /> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{policies.map((p) => <PolicyCard key={p.id} p={p} />)}</div>
            )}
          </TabsContent>
        </Tabs>
      </ViewContainer>

      <CreatePolicyDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ViewPolicyDialog policy={viewPolicy} onClose={() => setViewPolicy(null)} />
      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}

function CreatePolicyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { staff } = useAuth();
  const [title, setTitle] = useState("");
  const [policyType, setPolicyType] = useState("consumer_terms");
  const [appAffected, setAppAffected] = useState("all");
  const [version, setVersion] = useState("1.0");
  const [countryCode, setCountryCode] = useState("");
  const [contentBody, setContentBody] = useState("");
  const [summary, setSummary] = useState("");

  async function submit() {
    if (!staff || !title || !contentBody) return;
    const policy: LegalPolicy = {
      id: `pol_${Date.now()}`,
      title,
      policyType,
      countryCode: countryCode || null,
      appAffected: appAffected as "faya_pay" | "faya_business" | "faya_pos" | "all",
      version,
      status: "draft",
      effectiveDate: Date.now(),
      expiryDate: null,
      contentBody,
      summaryOfChanges: summary,
      createdBy: staff.id,
      approvedBy: null,
      publishedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await adminData.createPolicy(policy);
    logAudit({ staffId: staff.id, staffName: `${staff.firstName} ${staff.lastName}`, department: staff.departmentId, role: staff.roleId }, "policy.create", "policy", policy.id, { afterValue: `${title} v${version}` });
    toast.success(`Created: ${title}`);
    onOpenChange(false);
    setTitle(""); setVersion("1.0"); setContentBody(""); setSummary(""); setCountryCode("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Legal Policy</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Consumer Terms and Conditions" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Policy Type</Label>
              <select className="w-full h-9 rounded-md border px-2 text-sm" value={policyType} onChange={(e) => setPolicyType(e.target.value)}>
                {POLICY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><Label>App Affected</Label>
              <select className="w-full h-9 rounded-md border px-2 text-sm" value={appAffected} onChange={(e) => setAppAffected(e.target.value)}>
                <option value="all">All Apps</option>
                <option value="faya_pay">Faya Pay (Consumer)</option>
                <option value="faya_business">Faya Merchant</option>
                <option value="faya_pos">Faya POS</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Version</Label><Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0" /></div>
            <div><Label>Country (optional — leave empty for global)</Label><Input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} placeholder="NG or leave empty" /></div>
          </div>
          <div><Label>Summary of Changes</Label><Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What changed in this version?" /></div>
          <div><Label>Content Body</Label><Textarea value={contentBody} onChange={(e) => setContentBody(e.target.value)} rows={10} placeholder="Full legal text..." className="font-mono text-xs" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-emerald-600 hover:bg-emerald-700">Create as Draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewPolicyDialog({ policy, onClose }: { policy: LegalPolicy | null; onClose: () => void }) {
  if (!policy) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{policy.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-muted-foreground">Type:</span> {POLICY_TYPES.find((t) => t.value === (policy.policyType as string))?.label || policy.policyType}</div>
            <div><span className="text-muted-foreground">Version:</span> {policy.version}</div>
            <div><span className="text-muted-foreground">App:</span> {policy.appAffected as string}</div>
            <div><span className="text-muted-foreground">Country:</span> {policy.countryCode || "Global"}</div>
            <div><span className="text-muted-foreground">Status:</span> {policy.status as string}</div>
            <div><span className="text-muted-foreground">Effective:</span> {formatDateTime(policy.effectiveDate ?? null)}</div>
          </div>
          {policy.summaryOfChanges && (
            <div className="rounded-md border p-2 bg-muted/30">
              <div className="text-xs font-medium mb-1">Summary of Changes</div>
              <div className="text-xs">{policy.summaryOfChanges}</div>
            </div>
          )}
          <div className="rounded-md border p-3 max-h-96 overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap font-sans">{policy.contentBody}</pre>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
