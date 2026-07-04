"use client";

/**
 * System Settings — §24
 *
 * Platform-wide configuration: supported countries/currencies, enabled products,
 * maintenance mode, min app versions per app, contact email, SLA hours, policy
 * versions, risk thresholds, and provider wiring. Super Admin only — every
 * save is audit-logged.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Settings,
  Save,
  Globe2,
  Coins,
  Package,
  Wrench,
  Smartphone,
  Mail,
  Clock,
  ScrollText,
  ShieldAlert,
  CreditCard,
  UserCheck,
  Landmark,
  AlertTriangle,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit, upsert, COLLECTIONS, subscribe } from "@/lib/admin-data";
import { getScopeLabel, isGlobalScope } from "@/lib/access-scope";
import { SEED_SYSTEM_SETTINGS } from "@/lib/seed-data";
import { formatDateTime } from "@/lib/formatters";
import type { SystemSettings, CountryConfig } from "@/lib/types";

const ALL_COUNTRIES = ["NG", "GH", "KE", "ZA", "EG", "MA"];
const ALL_CURRENCIES = ["NGN", "GHS", "KES", "ZAR", "EGP", "MAD"];
const ALL_PRODUCTS = [
  "consumer_app",
  "merchant_app",
  "pos",
  "physical_terminal",
  "phone_pos",
  "nfc_closed_loop",
  "online_checkout",
  "virtual_card",
  "physical_card",
];

const PRODUCT_LABELS: Record<string, string> = {
  consumer_app: "Faya Pay (Consumer App)",
  merchant_app: "Faya Business (Merchant App)",
  pos: "Faya POS",
  physical_terminal: "Physical Terminals",
  phone_pos: "Phone POS (SoftPOS)",
  nfc_closed_loop: "NFC Closed-Loop",
  online_checkout: "Online Checkout",
  virtual_card: "Virtual Cards",
  physical_card: "Physical Cards",
};

export function SystemSettingsView() {
  const { staff: currentStaff } = useAuth();

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(
    () =>
      subscribe<SystemSettings>(COLLECTIONS.systemSettings, (items) => {
        setSettings(items[0] ?? null);
      }),
    [],
  );
  useEffect(() => adminData.subscribeCountries(setCountries), []);

  const isSuperAdmin = currentStaff ? isGlobalScope(currentStaff) : false;

  // Editable form state — initialised from settings (or seed defaults) once.
  // We use the "adjust state during render" pattern from the React docs
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // to sync `form` with `settings` on the first load without an effect.
  const [form, setForm] = useState<SystemSettings>(SEED_SYSTEM_SETTINGS);
  const [lastLoaded, setLastLoaded] = useState<SystemSettings | null>(null);
  if (settings && settings !== lastLoaded) {
    setLastLoaded(settings);
    setForm(settings);
  }

  // Has the form been modified vs. the persisted settings?
  const isDirty = useMemo(() => {
    if (!settings) return false;
    return JSON.stringify({ ...settings, updatedAt: 0, updatedBy: "" }) !==
      JSON.stringify({ ...form, updatedAt: 0, updatedBy: "" });
  }, [settings, form]);

  const actor = currentStaff
    ? {
        staffId: currentStaff.id,
        staffName: `${currentStaff.firstName} ${currentStaff.lastName}`,
        department: currentStaff.departmentId,
        role: currentStaff.roleId,
      }
    : null;

  function toggleArrayValue(field: "supportedCountries" | "supportedCurrencies" | "enabledProducts", value: string) {
    setForm((prev) => {
      const arr = prev[field] as string[];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [field]: next };
    });
  }

  function openSave() {
    if (!actor || !isSuperAdmin) return;
    if (form.supportedCountries.length === 0) {
      toast.error("At least one country must be supported");
      return;
    }
    if (form.supportedCurrencies.length === 0) {
      toast.error("At least one currency must be supported");
      return;
    }
    if (form.enabledProducts.length === 0) {
      toast.error("At least one product must be enabled");
      return;
    }
    if (!form.contactEmail.includes("@")) {
      toast.error("Contact email is invalid");
      return;
    }
    if (form.supportSlaHours < 1 || form.supportSlaHours > 240) {
      toast.error("Support SLA must be between 1 and 240 hours");
      return;
    }
    if (form.riskThresholdHigh < 0 || form.riskThresholdHigh > 100) {
      toast.error("Risk threshold (high) must be 0–100");
      return;
    }
    if (form.riskThresholdCritical < 0 || form.riskThresholdCritical > 100) {
      toast.error("Risk threshold (critical) must be 0–100");
      return;
    }
    if (form.riskThresholdCritical <= form.riskThresholdHigh) {
      toast.error("Critical threshold must be greater than high threshold");
      return;
    }
    setConfirmOpen(true);
  }

  function submitSave() {
    if (!actor) return;
    setConfirmOpen(false);
    const now = Date.now();
    const next: SystemSettings = {
      ...form,
      id: form.id ?? "settings_global",
      updatedAt: now,
      updatedBy: actor.staffId,
    };
    const before = settings
      ? JSON.stringify({ ...settings, updatedAt: 0, updatedBy: "" })
      : "null";
    const after = JSON.stringify({ ...next, updatedAt: 0, updatedBy: "" });
    upsert<SystemSettings>(COLLECTIONS.systemSettings, next)
      .then(() => {
        logAudit(actor, "system_settings.update", "system_settings", next.id, {
          countryCode: null,
          beforeValue: before,
          afterValue: after,
          reason: "Platform-wide configuration updated",
        });
        toast.success("System settings saved", {
          description: "Changes are now live across Faya Pay / Business / POS apps.",
        });
        setSettings(next);
        setForm(next);
      })
      .catch((e) => toast.error("Failed to save settings", { description: String(e) }));
  }

  // Non-super-admin read-only gate
  if (!isSuperAdmin) {
    return (
      <>
        <ViewHeader
          title="System Settings"
          description={`Platform-wide configuration · Your scope: ${getScopeLabel(currentStaff)}`}
          icon={Settings}
        />
        <ViewContainer>
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={Lock}
                title="Super Admin access required"
                description="System Settings control platform-wide behaviour and can only be edited by Super Admins. Contact a founder or Head of Ops if you need a change."
              />
            </CardContent>
          </Card>
        </ViewContainer>
      </>
    );
  }

  return (
    <>
      <ViewHeader
        title="System Settings"
        description={`Platform-wide configuration · Your scope: ${getScopeLabel(currentStaff)}`}
        icon={Settings}
        actions={
          <div className="flex items-center gap-2">
            {isDirty && (
              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                Unsaved changes
              </Badge>
            )}
            <Button
              size="sm"
              onClick={openSave}
              disabled={!isDirty}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Save className="size-4 mr-1" /> Save
            </Button>
          </div>
        }
      />
      <ViewContainer>
        {/* Maintenance mode banner */}
        {form.maintenanceMode && (
          <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 p-4 flex gap-3">
            <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-800 dark:text-red-300">
              <strong className="font-medium">Maintenance mode is ON.</strong>{" "}
              All Faya apps are currently displaying the maintenance banner and
              blocking transactional requests. Toggle this off to restore service.
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Platform identity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="size-4 text-emerald-600" />
                Platform Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="pn">Platform name</Label>
                <Input
                  id="pn"
                  value={form.platformName}
                  onChange={(e) => setForm({ ...form, platformName: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ce">Contact email</Label>
                <div className="relative">
                  <Mail className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="ce"
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sla">Support SLA (hours)</Label>
                <div className="relative">
                  <Clock className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="sla"
                    type="number"
                    min={1}
                    max={240}
                    value={form.supportSlaHours}
                    onChange={(e) => setForm({ ...form, supportSlaHours: Number(e.target.value) })}
                    className="pl-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Target first-response time for support tickets across all apps.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Maintenance + min versions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="size-4 text-emerald-600" />
                Maintenance & App Versions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border bg-slate-50 dark:bg-slate-900 p-3">
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Wrench className="size-4" /> Maintenance mode
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Blocks all transactional requests across Faya Pay / Business / POS.
                  </p>
                </div>
                <Switch
                  checked={form.maintenanceMode}
                  onCheckedChange={(v) => setForm({ ...form, maintenanceMode: v })}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Smartphone className="size-3" /> Minimum app versions
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="grid gap-1">
                    <Label className="text-xs" htmlFor="vpay">Faya Pay</Label>
                    <Input
                      id="vpay"
                      value={form.minAppVersionFayaPay}
                      onChange={(e) => setForm({ ...form, minAppVersionFayaPay: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs" htmlFor="vbus">Faya Business</Label>
                    <Input
                      id="vbus"
                      value={form.minAppVersionFayaBusiness}
                      onChange={(e) => setForm({ ...form, minAppVersionFayaBusiness: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs" htmlFor="vpos">Faya POS</Label>
                    <Input
                      id="vpos"
                      value={form.minAppVersionFayaPos}
                      onChange={(e) => setForm({ ...form, minAppVersionFayaPos: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Apps older than these versions will be forced to update.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Supported countries & currencies */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe2 className="size-4 text-emerald-600" />
                Countries & Currencies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Supported countries ({form.supportedCountries.length})
                </Label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {ALL_COUNTRIES.map((c) => {
                    const on = form.supportedCountries.includes(c);
                    const country = countries.find((cc) => cc.countryCode === c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleArrayValue("supportedCountries", c)}
                        className={`rounded-lg border p-2 text-center transition-all ${
                          on
                            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div className="font-mono text-sm font-bold">{c}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {country?.countryName ?? c}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Supported currencies ({form.supportedCurrencies.length})
                </Label>
                <div className="flex flex-wrap gap-2">
                  {ALL_CURRENCIES.map((cur) => {
                    const on = form.supportedCurrencies.includes(cur);
                    return (
                      <button
                        key={cur}
                        type="button"
                        onClick={() => toggleArrayValue("supportedCurrencies", cur)}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-mono transition-all ${
                          on
                            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <Coins className="size-3" /> {cur}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enabled products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="size-4 text-emerald-600" />
                Enabled Products
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ALL_PRODUCTS.map((p) => {
                const on = form.enabledProducts.includes(p);
                return (
                  <div
                    key={p}
                    className="flex items-center justify-between rounded-lg border bg-slate-50 dark:bg-slate-900 p-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="size-4 text-emerald-600 shrink-0" />
                      <span className="text-sm truncate">{PRODUCT_LABELS[p]}</span>
                    </div>
                    <Switch
                      checked={on}
                      onCheckedChange={() => toggleArrayValue("enabledProducts", p)}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Risk thresholds */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldAlert className="size-4 text-emerald-600" />
                Risk Thresholds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="rth" className="text-xs">High threshold</Label>
                  <Input
                    id="rth"
                    type="number"
                    min={0}
                    max={100}
                    value={form.riskThresholdHigh}
                    onChange={(e) => setForm({ ...form, riskThresholdHigh: Number(e.target.value) })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rtc" className="text-xs">Critical threshold</Label>
                  <Input
                    id="rtc"
                    type="number"
                    min={0}
                    max={100}
                    value={form.riskThresholdCritical}
                    onChange={(e) => setForm({ ...form, riskThresholdCritical: Number(e.target.value) })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Transactions with a risk score ≥ high are flagged; ≥ critical are blocked
                and routed to the fraud queue. Critical must be greater than high.
              </p>
              <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-900/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2 mb-1">
                  <span className="size-2 rounded-full bg-emerald-500" /> 0 – {form.riskThresholdHigh - 1}: Low
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="size-2 rounded-full bg-amber-500" /> {form.riskThresholdHigh} – {form.riskThresholdCritical - 1}: High
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-red-500" /> {form.riskThresholdCritical} – 100: Critical
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Provider wiring */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Landmark className="size-4 text-emerald-600" />
                Provider Wiring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="cp" className="text-xs flex items-center gap-1">
                  <CreditCard className="size-3" /> Card issuer
                </Label>
                <Input
                  id="cp"
                  value={form.cardProvider}
                  onChange={(e) => setForm({ ...form, cardProvider: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="kp" className="text-xs flex items-center gap-1">
                  <UserCheck className="size-3" /> KYC provider
                </Label>
                <Input
                  id="kp"
                  value={form.kycProvider}
                  onChange={(e) => setForm({ ...form, kycProvider: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sp" className="text-xs flex items-center gap-1">
                  <Landmark className="size-3" /> Settlement provider
                </Label>
                <Input
                  id="sp"
                  value={form.settlementProvider}
                  onChange={(e) => setForm({ ...form, settlementProvider: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Changing these will route new requests to the new provider. Pending
                settlements / KYC cases will continue with their original provider.
              </p>
            </CardContent>
          </Card>

          {/* Legal versions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ScrollText className="size-4 text-emerald-600" />
                Legal Versions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="tv" className="text-xs">Terms version</Label>
                  <Input
                    id="tv"
                    value={form.termsVersion}
                    onChange={(e) => setForm({ ...form, termsVersion: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pv" className="text-xs">Privacy version</Label>
                  <Input
                    id="pv"
                    value={form.privacyVersion}
                    onChange={(e) => setForm({ ...form, privacyVersion: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Bumping these versions forces all Faya Pay / Business / POS users to
                re-accept the corresponding policy on next launch.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Save bar (mobile-friendly) */}
        <div className="sticky bottom-0 rounded-lg border bg-white dark:bg-slate-900 p-3 flex items-center justify-between gap-3 shadow-sm">
          <div className="text-xs text-muted-foreground">
            {settings ? (
              <>
                Last saved <span className="font-medium">{formatDateTime(settings.updatedAt)}</span> by{" "}
                <span className="font-mono">{settings.updatedBy}</span>
              </>
            ) : (
              "Not yet saved — defaults will be applied on first save."
            )}
          </div>
          <Button
            size="sm"
            onClick={openSave}
            disabled={!isDirty}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="size-4 mr-1" /> Save changes
          </Button>
        </div>

        {/* Save confirmation */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-600" />
                Save system settings?
              </AlertDialogTitle>
              <AlertDialogDescription>
                These changes affect all Faya apps (Pay, Business, POS) and all
                countries immediately. The action will be recorded in the audit trail
                with your staff ID, the before/after values, and a timestamp.
                {form.maintenanceMode && (
                  <span className="block mt-2 text-red-700 dark:text-red-400 font-medium">
                    ⚠ Maintenance mode is ON — saving will block all transactional requests.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={submitSave}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="size-4 mr-1" /> Confirm & save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ViewContainer>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}
