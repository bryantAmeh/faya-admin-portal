"use client";

/**
 * Faya Admin Portal — Country Detail view (spec §5.2 – §5.7)
 *
 * Shows the dashboard metrics for one country, plus tabs to browse and edit
 * the five rule sets: KYC, KYB, Device, Settlement, Risk, plus a read-only
 * Merchants & Consumers summary tab.
 *
 * Key feature: a prominent "Platform Scope" banner makes it clear that all
 * rules set on this page cut across ALL enabled platforms. Super Admins can
 * enable/disable platforms via a dialog with 6 switches.
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
  Info,
  Layers,
  Store,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";

import { ViewHeader, ViewContainer, StatCard, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import {
  PLATFORM_LABELS,
  type CountryConfig,
  type CountryStatus,
  type PlatformConfig,
  type PlatformKey,
  type Merchant,
  type Consumer,
} from "@/lib/types";

interface CountryDetailViewProps {
  countries: CountryConfig[];
  merchants: Merchant[];
  consumers: Consumer[];
}

type RuleKey = "kycRules" | "kybRules" | "deviceRules" | "settlementRules" | "riskRules";

const TAB_META: { key: RuleKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "kycRules", label: "KYC Rules", icon: ShieldCheck },
  { key: "kybRules", label: "KYB Rules", icon: Building2 },
  { key: "deviceRules", label: "Device Rules", icon: Smartphone },
  { key: "settlementRules", label: "Settlement Rules", icon: Wallet },
  { key: "riskRules", label: "Risk Rules", icon: AlertTriangle },
];

const PLATFORM_ORDER: PlatformKey[] = [
  "consumerApp",
  "merchantApp",
  "physicalTerminal",
  "phonePos",
  "nfcClosedLoop",
  "onlineCheckout",
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

export function CountryDetailView({ countries, merchants, consumers }: CountryDetailViewProps) {
  const { staff } = useAuth();
  const { selectedCountryCode, setView } = usePortalStore();
  const isSuperAdmin = staff?.departmentId === "dept_super_admin";

  const country = useMemo(
    () => countries.find((c) => c.countryCode === selectedCountryCode) ?? null,
    [countries, selectedCountryCode],
  );

  // Filter merchants/consumers to this country
  const countryMerchants = useMemo(() => {
    if (!country) return [];
    return merchants.filter((m) => m.countryCode === country.countryCode);
  }, [merchants, country]);

  const countryConsumers = useMemo(() => {
    if (!country) return [];
    return consumers.filter((c) => c.countryCode === country.countryCode);
  }, [consumers, country]);

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
  const enabledPlatforms = PLATFORM_ORDER.filter((key) => country.platforms?.[key] === true);
  const realMerchantCount = countryMerchants.length;
  const realConsumerCount = countryConsumers.length;

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

        {/* Platform Scope banner — PROMINENT */}
        <Card className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="size-10 rounded-lg bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 flex items-center justify-center shrink-0">
                <Info className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-1.5">
                    <Layers className="size-4" /> Platform Scope
                  </h3>
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    {enabledPlatforms.length} active
                  </Badge>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-1 max-w-2xl">
                  <span className="font-semibold">All rules set on this page cut across ALL enabled platforms.</span>{" "}
                  KYC, KYB, device, settlement and risk rules apply uniformly — there is no per-platform override.
                </p>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {PLATFORM_ORDER.map((key) => {
                    const enabled = country.platforms?.[key] === true;
                    const label = PLATFORM_LABELS[key].label;
                    return (
                      <TooltipProvider key={key} delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={
                                enabled
                                  ? "inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white dark:bg-emerald-900/40 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200"
                                  : "inline-flex items-center gap-1 rounded-md border border-muted bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground line-through"
                              }
                            >
                              {enabled ? <Check className="size-3" /> : <X className="size-3" />}
                              {label}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="text-[11px] font-semibold">{PLATFORM_LABELS[key].label}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{PLATFORM_LABELS[key].description}</div>
                            <div className="text-[11px] mt-1 font-medium">
                              {enabled ? "Enabled — rules apply" : "Disabled"}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </div>
              {isSuperAdmin && (
                <div className="shrink-0">
                  <EditPlatformsButton country={country} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Country dashboard KPIs */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Country Dashboard
          </h2>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Active Customers"
              value={formatCompact(realConsumerCount)}
              hint={`${formatNumber(country.activeCustomers)} (recorded)`}
              icon={Users}
              tone="info"
            />
            <StatCard
              label="Active Merchants"
              value={formatCompact(realMerchantCount)}
              hint={`${formatNumber(country.activeMerchants)} (recorded)`}
              icon={Building2}
            />
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
              <TabsTrigger value="entities" className="gap-1">
                <Store className="size-3.5" />
                Merchants &amp; Consumers
              </TabsTrigger>
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
            <TabsContent value="entities">
              <EntitiesTab
                country={country}
                merchants={countryMerchants}
                consumers={countryConsumers}
              />
            </TabsContent>
          </Tabs>
        </div>
      </ViewContainer>
    </>
  );
}

/* --------------------------- Platform Scope edit -------------------------- */

function EditPlatformsButton({ country }: { country: CountryConfig }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-emerald-400 text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
      >
        <Pencil className="size-3.5 mr-1" /> Edit Platforms
      </Button>
      <EditPlatformsDialog
        open={open}
        onOpenChange={setOpen}
        country={country}
      />
    </>
  );
}

function EditPlatformsDialog({
  open,
  onOpenChange,
  country,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  country: CountryConfig;
}) {
  const { staff } = useAuth();
  const current: PlatformConfig = country.platforms ?? ({} as PlatformConfig);
  const [draft, setDraft] = useState<PlatformConfig>(current);
  const [saving, setSaving] = useState(false);

  // Reset draft whenever the dialog opens
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft({ ...current });
    }
    onOpenChange(next);
  };

  const toggle = (key: PlatformKey, value: boolean) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const enabledCount = PLATFORM_ORDER.filter((k) => draft[k] === true).length;

  const handleSave = async () => {
    if (enabledCount === 0) {
      toast.error("At least one platform must be enabled for a country.");
      return;
    }
    setSaving(true);
    try {
      const before = JSON.stringify(current);
      const after = JSON.stringify(draft);
      await adminData.updateCountry(country.id, {
        platforms: draft,
        updatedAt: Date.now(),
      });
      if (staff) {
        logAudit(
          {
            staffId: staff.id,
            staffName: `${staff.firstName} ${staff.lastName}`,
            department: staff.departmentId,
            role: staff.roleId,
          },
          "country.change_platforms",
          "country",
          country.id,
          {
            countryCode: country.countryCode,
            beforeValue: before,
            afterValue: after,
          },
        );
      }
      toast.success(`Platforms updated for ${country.countryName}.`, {
        description: `${enabledCount} platform${enabledCount === 1 ? "" : "s"} now active.`,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error("Failed to update platforms", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit platform scope — {country.countryName}</DialogTitle>
          <DialogDescription>
            Toggle which Faya platforms are enabled for this country. All rules set on this page
            (KYC, KYB, device, settlement, risk) apply uniformly across every enabled platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
          {PLATFORM_ORDER.map((key) => {
            const meta = PLATFORM_LABELS[key];
            const enabled = draft[key] === true;
            return (
              <div
                key={key}
                className="flex items-start justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {meta.label}
                    {enabled ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-100">
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{meta.description}</div>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => toggle(key, v)}
                  aria-label={`Toggle ${meta.label}`}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || enabledCount === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Save className="size-4 mr-1" />
            {saving ? "Saving…" : `Save (${enabledCount} active)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

/* ---------------------- Merchants & Consumers tab ------------------------ */

function EntitiesTab({
  country,
  merchants,
  consumers,
}: {
  country: CountryConfig;
  merchants: Merchant[];
  consumers: Consumer[];
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <MerchantsSummaryCard country={country} merchants={merchants} />
        <ConsumersSummaryCard country={country} consumers={consumers} />
      </div>
    </div>
  );
}

function MerchantsSummaryCard({
  country,
  merchants,
}: {
  country: CountryConfig;
  merchants: Merchant[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Store className="size-4 text-emerald-600" />
          Merchants on {country.countryName}
        </CardTitle>
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-100">
          {merchants.length} total
        </Badge>
      </CardHeader>
      <CardContent>
        {merchants.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No merchants registered"
            description="Merchants in this country will appear here once they sign up via the Merchant App."
          />
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {merchants.map((m) => {
              const statusBd = statusBadge("risk", m.riskCategory);
              const kybBd = statusBadge("kyb", m.kybStatus);
              const merchantStatusStyle = MERCHANT_STATUS_STYLES[m.status] ?? {
                label: m.status,
                className: "bg-gray-100 text-gray-800",
              };
              return (
                <li
                  key={m.id}
                  className="flex items-start gap-3 py-2 border-b last:border-0"
                >
                  <div className="size-8 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <Building2 className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{m.tradingName}</span>
                      <Badge variant="secondary" className={`text-[10px] ${merchantStatusStyle.className}`}>
                        {merchantStatusStyle.label}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {m.merchantCode} · {m.businessType} · {m.city}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${kybBd.className}`}>
                        KYB: {kybBd.label}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${statusBd.className}`}>
                        Risk: {statusBd.label}
                      </Badge>
                      {m.platforms.length > 0 && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          {m.platforms.length} platform{m.platforms.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-2.5 flex items-start gap-2">
          <Info className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 dark:text-amber-200">
            Merchants use the separate <span className="font-medium">Merchant App</span>. Manage their KYB and
            restrictions via the <span className="font-medium">Compliance</span> and <span className="font-medium">Risk</span> views.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ConsumersSummaryCard({
  country,
  consumers,
}: {
  country: CountryConfig;
  consumers: Consumer[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <UserCircle className="size-4 text-emerald-600" />
          Consumers on {country.countryName}
        </CardTitle>
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-100">
          {consumers.length} total
        </Badge>
      </CardHeader>
      <CardContent>
        {consumers.length === 0 ? (
          <EmptyState
            icon={UserCircle}
            title="No consumers registered"
            description="Consumers in this country will appear here once they sign up via the Consumer App."
          />
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {consumers.map((c) => {
              const kycBd = statusBadge("kyc", c.kycStatus);
              const consumerStatusStyle = CONSUMER_STATUS_STYLES[c.status] ?? {
                label: c.status,
                className: "bg-gray-100 text-gray-800",
              };
              const riskTone =
                c.riskScore >= 80
                  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                  : c.riskScore >= 50
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
              return (
                <li
                  key={c.id}
                  className="flex items-start gap-3 py-2 border-b last:border-0"
                >
                  <div className="size-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <Users className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {c.firstName} {c.lastName}
                      </span>
                      <Badge variant="secondary" className={`text-[10px] ${consumerStatusStyle.className}`}>
                        {consumerStatusStyle.label}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {c.consumerCode} · {c.nationality} · {c.email}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${kycBd.className}`}>
                        KYC: {kycBd.label}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${riskTone}`}>
                        Risk: {c.riskScore}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        {c.kycTier.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-2.5 flex items-start gap-2">
          <Info className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 dark:text-amber-200">
            Consumers use the separate <span className="font-medium">Consumer App</span>. Manage their KYC and
            restrictions via the <span className="font-medium">Compliance</span> and <span className="font-medium">Risk</span> views.
          </p>
        </div>
      </CardContent>
    </Card>
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

/* -------------------- Inline status style tables ------------------------- */

const MERCHANT_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  onboarding: { label: "Onboarding", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  restricted: { label: "Restricted", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  closed: { label: "Closed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const CONSUMER_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending_kyc: { label: "Pending KYC", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  restricted: { label: "Restricted", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  closed: { label: "Closed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};
