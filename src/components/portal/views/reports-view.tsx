"use client";

/**
 * Reports & Exports — §17
 *
 * Catalog of report types. Each card has a "Generate" button that opens a
 * dialog to pick a format (CSV / Excel / PDF), enter a reason (required for
 * sensitive reports), and trigger an export. Exports are simulated — the
 * action is logged via `logAudit("report.export")` and a success toast shown.
 */
import { useEffect, useMemo, useState } from "react";
import {
  FileBarChart,
  Users,
  Building2,
  ShieldCheck,
  CreditCard,
  Wallet,
  ArrowLeftRight,
  Smartphone,
  Scale,
  Headphones,
  ScrollText,
  Landmark,
  Download,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Filter,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { logAudit } from "@/lib/admin-data";
import {
  getVisibleCountries,
  getVisibleCountryCodes,
  getScopeLabel,
  isGlobalScope,
} from "@/lib/access-scope";
import type { CountryConfig } from "@/lib/types";
import { adminData } from "@/lib/admin-data";

type ReportKey =
  | "user"
  | "merchant"
  | "kyc"
  | "kyb"
  | "transaction"
  | "settlement"
  | "card"
  | "wallet"
  | "device"
  | "dispute"
  | "support"
  | "audit"
  | "regulatory";

interface ReportDef {
  key: ReportKey;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  sensitive: boolean;
  category: "Operations" | "Finance" | "Compliance" | "Risk" | "Audit";
}

const REPORTS: ReportDef[] = [
  { key: "user", title: "User Report", description: "All Faya Pay consumers with KYC tier, status, wallet balance, and risk score.", icon: Users, sensitive: false, category: "Operations" },
  { key: "merchant", title: "Merchant Report", description: "All Faya Business merchants with KYB status, terminal count, monthly volume, chargeback rate.", icon: Building2, sensitive: false, category: "Operations" },
  { key: "kyc", title: "KYC Report", description: "KYC verification cases — submitted, approved, rejected, escalated, with reviewer notes.", icon: ShieldCheck, sensitive: true, category: "Compliance" },
  { key: "kyb", title: "KYB Report", description: "KYB verification cases for merchants — submitted, approved, rejected, escalated.", icon: Building2, sensitive: true, category: "Compliance" },
  { key: "transaction", title: "Transaction Report", description: "Every transaction across all platforms — type, status, amount, risk score, provider reference.", icon: ArrowLeftRight, sensitive: true, category: "Finance" },
  { key: "settlement", title: "Settlement Report", description: "Settlement batches — pending, processing, completed, failed, held, with merchant totals.", icon: Wallet, sensitive: false, category: "Finance" },
  { key: "card", title: "Card Report", description: "All issued cards — virtual / physical, scheme, status, spend limits, tokenization state.", icon: CreditCard, sensitive: true, category: "Operations" },
  { key: "wallet", title: "Wallet Report", description: "Wallet balances, held balances, linked cards, frozen / closed status.", icon: Wallet, sensitive: true, category: "Finance" },
  { key: "device", title: "Device Report", description: "Terminals & SoftPOS devices — serial, merchant, status, last seen.", icon: Smartphone, sensitive: false, category: "Operations" },
  { key: "dispute", title: "Dispute Report", description: "All disputes — reason, status, deadline, evidence submission state, win/loss outcome.", icon: Scale, sensitive: false, category: "Risk" },
  { key: "support", title: "Support Ticket Report", description: "Support tickets by type, priority, status, SLA deadline, resolution time.", icon: Headphones, sensitive: false, category: "Operations" },
  { key: "audit", title: "Audit Log Report", description: "Immutable audit trail — every admin action with before/after, IP, device fingerprint.", icon: ScrollText, sensitive: true, category: "Audit" },
  { key: "regulatory", title: "Regulatory Report", description: "Country-level regulatory reports — CBN, BoG, CBK, SARB, CBE, BAM compliance filings.", icon: Landmark, sensitive: true, category: "Compliance" },
];

type ExportFormat = "csv" | "excel" | "pdf";

export function ReportsView() {
  const { staff: currentStaff } = useAuth();

  const [countries, setCountries] = useState<CountryConfig[]>([]);
  useEffect(() => adminData.subscribeCountries(setCountries), []);

  const visibleCodes = useMemo(
    () => getVisibleCountryCodes(currentStaff, countries),
    [currentStaff, countries],
  );
  const visibleCountries = useMemo(
    () => getVisibleCountries(currentStaff, countries),
    [currentStaff, countries],
  );
  const isSuperAdmin = currentStaff ? isGlobalScope(currentStaff) : false;

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [target, setTarget] = useState<ReportDef | null>(null);
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [countryScope, setCountryScope] = useState<string>("all");
  const [reason, setReason] = useState("");

  // Filter reports: regulatory & audit require Super Admin
  const visibleReports = useMemo(() => {
    return REPORTS.filter((r) => {
      if ((r.key === "audit" || r.key === "regulatory") && !isSuperAdmin) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      return true;
    });
  }, [isSuperAdmin, categoryFilter]);

  const stats = useMemo(() => {
    return {
      total: visibleReports.length,
      sensitive: visibleReports.filter((r) => r.sensitive).length,
      categories: new Set(visibleReports.map((r) => r.category)).size,
    };
  }, [visibleReports]);

  const actor = currentStaff
    ? {
        staffId: currentStaff.id,
        staffName: `${currentStaff.firstName} ${currentStaff.lastName}`,
        department: currentStaff.departmentId,
        role: currentStaff.roleId,
      }
    : null;

  function openGenerate(def: ReportDef) {
    setTarget(def);
    setFormat("csv");
    setCountryScope("all");
    setReason("");
  }

  function submitExport() {
    if (!target || !actor) return;
    if (target.sensitive && reason.trim().length < 5) {
      toast.error("A reason is required for sensitive exports (min 5 chars)");
      return;
    }
    const country = countryScope === "all" ? null : countryScope;
    if (country && !visibleCodes.has(country)) {
      toast.error("You can only export data within your country scope");
      return;
    }
    logAudit(actor, "report.export", "report", target.key, {
      countryCode: country,
      reason: reason.trim() || `Export ${target.title} as ${format.toUpperCase()}`,
      afterValue: JSON.stringify({ format, countryScope: country ?? "all" }),
    });
    toast.success(`${target.title} exported`, {
      description: `${format.toUpperCase()} · ${country ?? "All visible countries"} · ${target.sensitive ? "Sensitive — reason logged" : "Standard export"}`,
    });
    setTarget(null);
  }

  return (
    <>
      <ViewHeader
        title="Reports & Exports"
        description={`Generate downloadable reports · Your scope: ${getScopeLabel(currentStaff)}`}
        icon={FileBarChart}
      />
      <ViewContainer>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
          <StatCard label="Available Reports" value={stats.total} icon={FileBarChart} tone="default" />
          <StatCard label="Sensitive" value={stats.sensitive} hint="require reason" icon={Lock} tone="warning" />
          <StatCard label="Categories" value={stats.categories} icon={Filter} tone="info" />
        </div>

        {/* Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-end gap-3">
              <div className="w-full sm:w-56">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Compliance">Compliance</SelectItem>
                    <SelectItem value="Risk">Risk</SelectItem>
                    <SelectItem value="Audit">Audit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report cards */}
        {visibleReports.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={FileBarChart}
                title="No reports available"
                description="Some reports require Super Admin access. Contact your administrator if you need access."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visibleReports.map((r) => {
              const Icon = r.icon;
              return (
                <Card key={r.key} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                        <Icon className="size-5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {r.sensitive && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300">
                            <Lock className="size-3 mr-1" /> Sensitive
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">{r.category}</Badge>
                      </div>
                    </div>
                    <CardTitle className="text-base mt-3">{r.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-3 pt-0">
                    <p className="text-xs text-muted-foreground flex-1">{r.description}</p>
                    <Button
                      size="sm"
                      onClick={() => openGenerate(r)}
                      className="bg-emerald-600 hover:bg-emerald-700 self-start"
                    >
                      <Download className="size-4 mr-1" /> Generate
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Audit / regulatory access notice */}
        {!isSuperAdmin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800 p-4 flex gap-3">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <strong className="font-medium">Audit Log</strong> and{" "}
              <strong className="font-medium">Regulatory</strong> reports require Super Admin
              access. These exports contain sensitive platform-wide data and must be reviewed
              by a founder or Head of Ops before being released.
            </div>
          </div>
        )}
      </ViewContainer>

      {/* Generate dialog */}
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {target && <target.icon className="size-4 text-emerald-600" />}
              {target?.title}
            </DialogTitle>
            <DialogDescription>
              {target?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Export format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (.csv) — spreadsheet-friendly</SelectItem>
                  <SelectItem value="excel">Excel (.xlsx) — formatted workbook</SelectItem>
                  <SelectItem value="pdf">PDF (.pdf) — printable summary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Country scope</Label>
              <Select value={countryScope} onValueChange={setCountryScope}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All visible countries ({visibleCountries.length})</SelectItem>
                  {visibleCountries.map((c) => (
                    <SelectItem key={c.countryCode} value={c.countryCode}>
                      {c.countryCode} · {c.countryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Limited to your scope ({getScopeLabel(currentStaff)}).
              </p>
            </div>
            {target?.sensitive && (
              <div className="grid gap-2">
                <Label htmlFor="reason">
                  Reason <span className="text-red-600">*</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder="This export contains PII / financial data. Explain why it's needed (e.g. CBN quarterly audit)…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  Sensitive export — reason will be recorded in the audit trail.
                </p>
              </div>
            )}
            <div className="rounded-lg border bg-emerald-50/40 dark:bg-emerald-900/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex gap-2">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              <span>
                The export will be generated in the background and a download link will appear
                here when ready. All exports are logged in the audit trail with the actor,
                timestamp, format, scope, and reason.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={submitExport} className="bg-emerald-600 hover:bg-emerald-700">
              <Download className="size-4 mr-1" /> Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}
