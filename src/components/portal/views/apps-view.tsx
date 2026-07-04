"use client";

/**
 * Faya Admin Portal — Apps Management view
 *
 * Shows details for the three Faya applications that connect to the same
 * Firebase project (fayapay-ece98):
 *
 *  1. Faya Pay       — consumer payment app (iOS/Android)
 *  2. Faya POS       — POS app on physical terminals + SoftPOS phones
 *  3. Faya Business  — merchant business app (iOS/Android)
 *
 * For each app the admin can see: description, target users, current version,
 * min OS, features, Firebase services used, and per-country enablement status.
 * Super Admins can toggle an app's platforms on/off per country.
 */
import { useMemo, useState } from "react";
import {
  Boxes,
  Smartphone,
  Store,
  Wallet,
  Check,
  X,
  Globe2,
  Info,
  Smartphone as PhoneIcon,
  Flame,
  Database,
  Bell,
  BarChart3,
  FileImage,
  ShieldCheck,
  Pencil,
  Tablet,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer, StatCard, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  APP_LIST,
  APP_DEFINITIONS,
  type AppDefinition,
  type AppKey,
  type CountryConfig,
  type PlatformKey,
  PLATFORM_LABELS,
} from "@/lib/types";
import { adminData, logAudit } from "@/lib/admin-data";
import { useAuth } from "@/hooks/use-auth";
import {
  getVisibleCountries,
  getScopeLabel,
} from "@/lib/access-scope";

interface AppsViewProps {
  countries: CountryConfig[];
}

/** Icon for each app. */
function AppIcon({ appKey, className }: { appKey: AppKey; className?: string }) {
  switch (appKey) {
    case "fayaPay":
      return <Wallet className={className} />;
    case "fayaPos":
      return <Smartphone className={className} />;
    case "fayaBusiness":
      return <Store className={className} />;
  }
}

/** Accent color per app (emerald family to stay on-brand). */
function appAccent(key: AppKey): string {
  switch (key) {
    case "fayaPay":
      return "from-emerald-500 to-teal-600";
    case "fayaPos":
      return "from-amber-500 to-orange-600";
    case "fayaBusiness":
      return "from-sky-500 to-cyan-600";
  }
}

function firebaseServiceIcon(service: string): React.ComponentType<{ className?: string }> {
  switch (service) {
    case "Authentication":
      return ShieldCheck;
    case "Cloud Firestore":
      return Database;
    case "Cloud Storage":
      return FileImage;
    case "Cloud Messaging":
      return Bell;
    case "Analytics":
      return BarChart3;
    default:
      return Flame;
  }
}

/** Check if an app is enabled in a given country (any of its platforms are on). */
function appEnabledInCountry(app: AppDefinition, country: CountryConfig): boolean {
  return app.platforms.some((p) => country.platforms[p]);
}

/** Count of countries where the app is enabled. */
function countEnabledCountries(app: AppDefinition, countries: CountryConfig[]): number {
  return countries.filter((c) => appEnabledInCountry(app, c)).length;
}

export function AppsView({ countries }: AppsViewProps) {
  const { staff, isDemoMode } = useAuth();
  const [selectedApp, setSelectedApp] = useState<AppKey | null>(null);
  const [editCountry, setEditCountry] = useState<CountryConfig | null>(null);

  const visibleCountries = useMemo(
    () => getVisibleCountries(staff, countries),
    [staff, countries],
  );

  const isSuperAdmin = staff?.departmentId === "dept_super_admin";

  return (
    <>
      <ViewHeader
        title="Faya Applications"
        description={`Three apps connected to Firebase project fayapay-ece98 · Scope: ${getScopeLabel(staff)}`}
        icon={Boxes}
        actions={
          isDemoMode ? (
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
              Demo mode
            </Badge>
          ) : null
        }
      />
      <ViewContainer>
        {/* Connection explainer banner */}
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="size-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed">
              <span className="font-medium">Three apps, one database.</span>{" "}
              Faya Pay (consumers), Faya POS (terminals &amp; SoftPOS), and Faya Business (merchants)
              are separate mobile/device applications that all read from and write to the same
              Firebase project (<code className="font-mono">fayapay-ece98</code>). Admin actions
              — KYC/KYB approvals, restrictions, suspensions, country rule changes — sync to all
              three apps in real time via Firestore. Rules set per country cut across every
              enabled app.
            </div>
          </CardContent>
        </Card>

        {/* Stat cards */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard label="Total Apps" value={APP_LIST.length} icon={Boxes} tone="info" />
          <StatCard label="Countries Available" value={visibleCountries.length} icon={Globe2} />
          <StatCard label="Faya Pay Enabled" value={countEnabledCountries(APP_DEFINITIONS.fayaPay, visibleCountries)} hint="consumer app" icon={Wallet} tone="success" />
          <StatCard label="Faya Business Enabled" value={countEnabledCountries(APP_DEFINITIONS.fayaBusiness, visibleCountries)} hint="merchant app" icon={Store} tone="success" />
        </div>

        {/* App cards */}
        <div className="grid gap-4 lg:grid-cols-3">
          {APP_LIST.map((app) => (
            <AppCard
              key={app.key}
              app={app}
              enabledCount={countEnabledCountries(app, visibleCountries)}
              totalCount={visibleCountries.length}
              onOpenDetails={() => setSelectedApp(app.key)}
            />
          ))}
        </div>

        {/* Per-country enablement matrix */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe2 className="size-4 text-emerald-600" />
              App Availability by Country
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Shows which apps are enabled in each country. Toggle platforms via Country Management → Platform Scope.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {visibleCountries.length === 0 ? (
              <EmptyState icon={Globe2} title="No countries visible" description="No countries assigned to your scope." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b">
                    <tr>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">Country</th>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">Region</th>
                      {APP_LIST.map((app) => (
                        <th key={app.key} className="text-center font-medium px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">
                          {app.name}
                        </th>
                      ))}
                      {isSuperAdmin && <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCountries.map((c) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base">{c.countryCode}</span>
                            <span className="text-muted-foreground">{c.countryName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{c.region}</td>
                        {APP_LIST.map((app) => {
                          const enabled = appEnabledInCountry(app, c);
                          return (
                            <td key={app.key} className="text-center px-4 py-2.5">
                              {enabled ? (
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                  <Check className="size-3 mr-1" /> Enabled
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                  <X className="size-3 mr-1" /> Off
                                </Badge>
                              )}
                            </td>
                          );
                        })}
                        {isSuperAdmin && (
                          <td className="text-right px-4 py-2.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setEditCountry(c)}
                            >
                              <Pencil className="size-3 mr-1" /> Edit platforms
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </ViewContainer>

      {/* App detail dialog */}
      {selectedApp && (
        <AppDetailDialog
          app={APP_DEFINITIONS[selectedApp]}
          onClose={() => setSelectedApp(null)}
        />
      )}

      {/* Edit platforms dialog (Super Admin) */}
      {editCountry && (
        <EditPlatformsDialog
          country={editCountry}
          onClose={() => setEditCountry(null)}
        />
      )}
    </>
  );
}

/* ------------------------------ App card ------------------------------- */

function AppCard({
  app,
  enabledCount,
  totalCount,
  onOpenDetails,
}: {
  app: AppDefinition;
  enabledCount: number;
  totalCount: number;
  onOpenDetails: () => void;
}) {
  return (
    <Card className="overflow-hidden flex flex-col">
      {/* Header banner */}
      <div className={`bg-gradient-to-br ${appAccent(app.key)} p-4 text-white`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <AppIcon appKey={app.key} className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-lg leading-tight">{app.name}</div>
              <div className="text-xs text-white/80 leading-tight">{app.tagline}</div>
            </div>
          </div>
          <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
            v{app.currentVersion}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 flex-1 flex flex-col gap-3">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {app.description}
        </p>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Target users</span>
            <span className="font-medium text-right max-w-[60%]">{app.targetUsers}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Min Android</span>
            <span className="font-medium flex items-center gap-1"><Tablet className="size-3" /> {app.minAndroid}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Min iOS</span>
            <span className="font-medium flex items-center gap-1"><Monitor className="size-3" /> {app.minIos}</span>
          </div>
        </div>

        <Separator />

        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Firebase services
          </div>
          <div className="flex flex-wrap gap-1.5">
            {app.firebaseServices.map((s) => {
              const SvcIcon = firebaseServiceIcon(s);
              return (
                <Badge key={s} variant="outline" className="text-[10px] gap-1 py-0.5">
                  <SvcIcon className="size-2.5" />
                  {s}
                </Badge>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Platforms ({app.platforms.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {app.platforms.map((p) => (
              <Badge key={p} variant="secondary" className="text-[10px] py-0.5">
                {PLATFORM_LABELS[p].label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-2 flex items-center justify-between">
          <div className="text-xs">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{enabledCount}</span>
            <span className="text-muted-foreground"> / {totalCount} countries</span>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenDetails} className="h-7 text-xs">
            View details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------- App detail dialog -------------------------- */

function AppDetailDialog({
  app,
  onClose,
}: {
  app: AppDefinition;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`size-10 rounded-lg bg-gradient-to-br ${appAccent(app.key)} flex items-center justify-center text-white`}>
              <AppIcon appKey={app.key} className="size-6" />
            </div>
            <div>
              <DialogTitle className="text-xl">{app.name}</DialogTitle>
              <DialogDescription>{app.tagline} · v{app.currentVersion}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm leading-relaxed">{app.description}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Target users</div>
              <div className="text-sm font-medium">{app.targetUsers}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current version</div>
              <div className="text-sm font-medium">v{app.currentVersion}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Min Android</div>
              <div className="text-sm font-medium flex items-center gap-1"><Tablet className="size-3.5" /> {app.minAndroid}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Min iOS</div>
              <div className="text-sm font-medium flex items-center gap-1"><Monitor className="size-3.5" /> {app.minIos}</div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Features</div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {app.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="size-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Firebase services used</div>
            <div className="flex flex-wrap gap-2">
              {app.firebaseServices.map((s) => {
                const SvcIcon = firebaseServiceIcon(s);
                return (
                  <Badge key={s} variant="outline" className="gap-1.5 py-1">
                    <SvcIcon className="size-3.5 text-emerald-600" />
                    {s}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              All services are part of the <code className="font-mono">fayapay-ece98</code> Firebase project.
            </p>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Platform flags</div>
            <div className="flex flex-wrap gap-2">
              {app.platforms.map((p) => (
                <Badge key={p} variant="secondary" className="gap-1.5">
                  <PhoneIcon className="size-3" />
                  {PLATFORM_LABELS[p].label}
                  <span className="text-muted-foreground">— {PLATFORM_LABELS[p].description}</span>
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------- Edit platforms dialog ------------------------ */

function EditPlatformsDialog({
  country,
  onClose,
}: {
  country: CountryConfig;
  onClose: () => void;
}) {
  const { staff } = useAuth();
  const [platforms, setPlatforms] = useState({ ...country.platforms });
  const [saving, setSaving] = useState(false);

  const handleToggle = (key: PlatformKey) => {
    setPlatforms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    const enabledCount = Object.values(platforms).filter(Boolean).length;
    if (enabledCount === 0) {
      toast.error("At least one platform must be enabled");
      return;
    }
    setSaving(true);
    try {
      const before = JSON.stringify(country.platforms);
      const after = JSON.stringify(platforms);
      await adminData.updateCountry(country.id, {
        platforms,
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
          "country_config",
          country.id,
          {
            countryCode: country.countryCode,
            beforeValue: before,
            afterValue: after,
            reason: `Updated app platform enablement for ${country.countryName}`,
          },
        );
      }
      toast.success(`Platforms updated for ${country.countryName}`);
      onClose();
    } catch (e) {
      toast.error(`Failed to update platforms: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit App Platforms — {country.countryName} ({country.countryCode})</DialogTitle>
          <DialogDescription>
            Toggle which Faya apps and platforms are enabled in this country.
            Rules (KYC, KYB, device, settlement, risk) cut across all enabled platforms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {(Object.keys(PLATFORM_LABELS) as PlatformKey[]).map((key) => {
            const meta = PLATFORM_LABELS[key];
            return (
              <div key={key} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium cursor-pointer">{meta.label}</Label>
                    <Badge variant="outline" className="text-[10px]">{meta.appName}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{meta.description}</div>
                </div>
                <Switch
                  checked={platforms[key]}
                  onCheckedChange={() => handleToggle(key)}
                />
              </div>
            );
          })}
        </div>

        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-900 dark:text-emerald-200">
          <Info className="size-3.5 inline mr-1" />
          Changes sync to all three apps (Faya Pay, Faya POS, Faya Business) in real time via Firestore.
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSave();
            }}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? "Saving…" : "Save platforms"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
