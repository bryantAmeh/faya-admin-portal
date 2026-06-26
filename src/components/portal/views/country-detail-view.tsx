"use client";

/**
 * Faya Admin Portal — Country Detail view (spec §5.2 – §5.7)
 *
 * Shows the dashboard metrics for one country, plus tabs to browse and edit
 * the five rule sets: KYC, KYB, Device, Settlement, Risk.
 */
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Globe2,
  Users,
  Building2,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  Wallet,
  Scale,
  Headphones,
  Clock,
  Check,
  X,
  Pencil,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import { ViewHeader, ViewContainer, StatCard, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { usePortalStore } from "@/hooks/use-portal-store";
import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
import { formatCompact, formatCurrency, formatNumber, statusBadge } from "@/lib/formatters";
import type { CountryConfig, CountryStatus } from "@/lib/types";

interface CountryDetailViewProps {
  countries: CountryConfig[];
}

type RuleKey = "kycRules" | "kybRules" | "deviceRules" | "settlementRules" | "riskRules";

const TAB_META: { key: RuleKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "kycRules", label: "KYC Rules", icon: ShieldCheck },
  { key: "kybRules", label: "KYB Rules", icon: Building2 },
  { key: "deviceRules", label: "Device Rules", icon: Smartphone },
  { key: "settlementRules", label: "Settlement Rules", icon: Wallet },
  { key: "riskRules", label: "Risk Rules", icon: AlertTriangle },
];

const ALL_COUNTRY_STATUSES: CountryStatus[] = [
  "draft",
  "internal_testing",
  "pilot",
  "live",
  "restricted",
  "suspended",
  "closed",
];

export function CountryDetailView({ countries }: CountryDetailViewProps) {
  const { staff } = useAuth();
  const { selectedCountryCode, setView } = usePortalStore();
  const isSuperAdmin = staff?.departmentId === "dept_super_admin";

  const country = useMemo(
    () => countries.find((c) => c.countryCode === selectedCountryCode) ?? null,
    [countries, selectedCountryCode],
  );

  if (!country) {
    return (
      <>
        <ViewHeader title="Country detail" description="No country selected" icon={Globe2} />
        <ViewContainer>
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={Globe2}
                title="Country not found"
                description="The selected country no longer exists. Pick another from the country list."
              />
            </CardContent>
          </Card>
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setView("countries")}>
              <ArrowLeft className="size-4 mr-1" /> Back to countries
            </Button>
          </div>
        </ViewContainer>
      </>
    );
  }

  const badge = statusBadge("country", country.status);
  const launchBadge = statusBadge("country", country.launchStatus as CountryStatus);

  return (
    <>
      <ViewHeader
        title={`${country.countryName} (${country.countryCode})`}
        description={`${country.currency} · ${country.regulator} · ${country.timezone}`}
        icon={Globe2}
        actions={
          <Button variant="outline" size="sm" onClick={() => setView("countries")}>
            <ArrowLeft className="size-4 mr-1" /> Back
          </Button>
        }
      />
      <ViewContainer>
        {/* Header card */}
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                <Globe2 className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">{country.countryName}</span>
                  <span className="text-sm text-muted-foreground">({country.countryCode})</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {country.currency} · {country.regulator} · {country.timezone}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className={badge.className}>
                Status: {badge.label}
              </Badge>
              <Badge variant="outline">Launch: {launchBadge.label}</Badge>
              {isSuperAdmin && <StatusChanger country={country} />}
            </div>
          </CardContent>
        </Card>

        {/* Country dashboard KPIs */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Country Dashboard
          </h2>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Active Customers" value={formatCompact(country.activeCustomers)} icon={Users} tone="info" />
            <StatCard label="Active Merchants" value={formatCompact(country.activeMerchants)} icon={Building2} />
            <StatCard label="Pending KYC" value={country.pendingKyc} icon={ShieldCheck} tone={country.pendingKyc > 0 ? "warning" : "default"} />
            <StatCard label="Pending KYB" value={country.pendingKyb} icon={Building2} tone={country.pendingKyb > 0 ? "warning" : "default"} />
            <StatCard label="High-Risk Alerts" value={country.highRiskAlerts} icon={AlertTriangle} tone={country.highRiskAlerts > 0 ? "danger" : "default"} />
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mt-3">
            <StatCard label="Active Terminals" value={formatNumber(country.activeTerminals)} icon={Smartphone} />
            <StatCard label="Active Phone POS" value={formatNumber(country.activePhonePos)} icon={Smartphone} />
            <StatCard label="Today Tx Volume" value={formatCurrency(country.todayTxVolume, country.currency)} icon={Wallet} tone="info" />
            <StatCard label="Today Approved" value={formatCompact(country.todayApproved)} icon={Check} tone="success" />
            <StatCard label="Today Declined" value={formatCompact(country.todayDeclined)} icon={X} tone={country.todayDeclined > 0 ? "danger" : "default"} />
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mt-3">
            <StatCard label="Pending Settlements" value={country.pendingSettlements} icon={Clock} tone={country.pendingSettlements > 0 ? "warning" : "default"} />
            <StatCard label="Held Settlements" value={country.heldSettlements} icon={AlertTriangle} tone={country.heldSettlements > 0 ? "danger" : "default"} />
            <StatCard label="Open Disputes" value={country.openDisputes} icon={Scale} tone={country.openDisputes > 0 ? "warning" : "default"} />
            <StatCard label="Open Tickets" value={country.openTickets} icon={Headphones} tone={country.openTickets > 0 ? "warning" : "default"} />
            <StatCard label="Compliance Alerts" value={country.complianceAlerts} icon={AlertTriangle} tone={country.complianceAlerts > 0 ? "danger" : "default"} />
          </div>
        </div>

        <Separator />

        {/* Configuration tabs */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Configuration
          </h2>
          <Tabs defaultValue="kycRules" className="w-full">
            <TabsList className="flex flex-wrap h-auto">
              {TAB_META.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="gap-1">
                  <t.icon className="size-3.5" />
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {TAB_META.map((t) => (
              <TabsContent key={t.key} value={t.key}>
                <RulesTab
                  country={country}
                  ruleKey={t.key}
                  canEdit={isSuperAdmin}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </ViewContainer>
    </>
  );
}

/* ------------------------------- Rules tab ------------------------------- */

function RulesTab({
  country,
  ruleKey,
  canEdit,
}: {
  country: CountryConfig;
  ruleKey: RuleKey;
  canEdit: boolean;
}) {
  const rules = (country[ruleKey] ?? {}) as Record<string, unknown>;
  const [editOpen, setEditOpen] = useState(false);

  const entries = Object.entries(rules);
  const tabMeta = TAB_META.find((t) => t.key === ruleKey)!;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <tabMeta.icon className="size-4 text-emerald-600" />
          {tabMeta.label}
        </CardTitle>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5 mr-1" /> Edit Rules
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyState
            icon={tabMeta.icon}
            title="No rules configured yet"
            description={canEdit ? "Click Edit Rules to define this rule set as JSON." : "An admin has not configured this rule set yet."}
          />
        ) : (
          <div className="border rounded-md max-h-[28rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Key</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell className="font-medium align-top">{k}</TableCell>
                    <TableCell className="text-muted-foreground">{formatRuleValue(v)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {canEdit && (
        <EditRulesDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          country={country}
          ruleKey={ruleKey}
          label={tabMeta.label}
        />
      )}
    </Card>
  );
}

/** Render a rule value in a human-friendly way. */
function formatRuleValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Required" : "Not required";
  if (Array.isArray(value)) {
    if (value.length === 0) return "None";
    return value.map((v) => formatRuleValue(v)).join(", ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/* --------------------------- Edit Rules dialog --------------------------- */

function EditRulesDialog({
  open,
  onOpenChange,
  country,
  ruleKey,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  country: CountryConfig;
  ruleKey: RuleKey;
  label: string;
}) {
  const { staff } = useAuth();
  const current = (country[ruleKey] ?? {}) as Record<string, unknown>;
  const [text, setText] = useState<string>(JSON.stringify(current, null, 2));
  const [saving, setSaving] = useState(false);

  // Reset text whenever the dialog opens
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setText(JSON.stringify(current, null, 2));
    }
    onOpenChange(next);
  };

  const handleSave = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      toast.error("Invalid JSON", { description: e instanceof Error ? e.message : String(e) });
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      toast.error("Rules must be a JSON object (key/value pairs).");
      return;
    }

    setSaving(true);
    try {
      const before = JSON.stringify(current);
      const after = JSON.stringify(parsed);
      await adminData.updateCountry(country.id, { [ruleKey]: parsed, updatedAt: Date.now() } as Partial<CountryConfig>);
      if (staff) {
        logAudit(
          {
            staffId: staff.id,
            staffName: `${staff.firstName} ${staff.lastName}`,
            department: staff.departmentId,
            role: staff.roleId,
          },
          `country.change_${ruleKey}`,
          "country",
          country.id,
          {
            countryCode: country.countryCode,
            beforeValue: before,
            afterValue: after,
          },
        );
      }
      toast.success(`${label} updated for ${country.countryName}.`);
      onOpenChange(false);
    } catch (e) {
      toast.error("Failed to save rules", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {label}</DialogTitle>
          <DialogDescription>
            Edit the rule set for {country.countryName} ({country.countryCode}) as JSON. Save will validate that the value is a JSON object.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={`rules-${ruleKey}`}>JSON</Label>
          <Textarea
            id={`rules-${ruleKey}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-xs min-h-[18rem] max-h-[28rem]"
            spellCheck={false}
          />
          <p className="text-[11px] text-muted-foreground">
            Tip: arrays should be lists of strings/numbers; booleans render as &quot;Required&quot;/&quot;Not required&quot; in the table.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Save className="size-4 mr-1" /> {saving ? "Saving…" : "Save rules"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- Status changer ---------------------------- */

function StatusChanger({ country }: { country: CountryConfig }) {
  const { staff } = useAuth();
  const [pending, setPending] = useState<CountryStatus | null>(null);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!pending || pending === country.status) {
      setPending(null);
      return;
    }
    setSaving(true);
    try {
      const before = country.status;
      await adminData.updateCountry(country.id, { status: pending, updatedAt: Date.now() });
      if (staff) {
        logAudit(
          {
            staffId: staff.id,
            staffName: `${staff.firstName} ${staff.lastName}`,
            department: staff.departmentId,
            role: staff.roleId,
          },
          "country.change_status",
          "country",
          country.id,
          {
            countryCode: country.countryCode,
            beforeValue: before,
            afterValue: pending,
          },
        );
      }
      toast.success(`${country.countryName} status changed to ${statusBadge("country", pending).label}.`);
      setPending(null);
    } catch (e) {
      toast.error("Failed to change status", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Select
        value={country.status}
        onValueChange={(v) => {
          const next = v as CountryStatus;
          if (next === country.status) return;
          setPending(next);
        }}
        disabled={saving}
      >
        <SelectTrigger className="h-8 w-[180px] text-xs" aria-label="Change country status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALL_COUNTRY_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {statusBadge("country", s).label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog open={pending !== null} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change country status?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && (
                <>
                  This will change <span className="font-medium">{country.countryName}</span> ({country.countryCode})
                  {" "}from <span className="font-medium">{statusBadge("country", country.status).label}</span>
                  {" "}to <span className="font-medium">{statusBadge("country", pending).label}</span>. This action will be recorded in the audit log.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? "Saving…" : "Confirm change"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
