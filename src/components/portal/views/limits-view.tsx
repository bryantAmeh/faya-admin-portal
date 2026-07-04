"use client";

/**
 * Limits — §14
 *
 * Country-product spending and transaction limits by KYC tier + risk level.
 * Filter by country + product + KYC tier. Edit / activate / deactivate.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Gauge,
  Search,
  Filter,
  Plus,
  Pencil,
  MoreHorizontal,
  X,
  CheckCircle2,
  Ban,
  Globe2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer, StatCard, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  isGlobalScope,
} from "@/lib/access-scope";
import { formatCurrency } from "@/lib/formatters";
import type { Limit, CountryConfig, KycTier, RiskLevel } from "@/lib/types";

const PRODUCTS = ["wallet", "card", "pos", "merchant", "virtual_card", "physical_card"];
const LIMIT_TYPES = ["daily", "monthly", "per_transaction", "weekly", "annual"];
const KYC_TIERS: (KycTier | "all")[] = ["all", "tier_1", "tier_2", "tier_3"];
const RISK_LEVELS: (RiskLevel | "all")[] = ["all", "low", "medium", "high", "critical"];

const STATUS_STYLES: Record<Limit["status"], { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  inactive: { label: "Inactive", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const TIER_LABELS: Record<KycTier | "all", string> = {
  all: "All Tiers",
  tier_1: "Tier 1",
  tier_2: "Tier 2",
  tier_3: "Tier 3",
};

const RISK_LABELS: Record<RiskLevel | "all", string> = {
  all: "All Risk",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function LimitsView() {
  const { staff: currentStaff } = useAuth();

  const [items, setItems] = useState<Limit[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);

  useEffect(() => adminData.subscribeLimits(setItems), []);
  useEffect(() => adminData.subscribeCountries(setCountries), []);

  const visibleCodes = useMemo(
    () => getVisibleCountryCodes(currentStaff, countries),
    [currentStaff, countries],
  );
  const visibleCountries = useMemo(
    () => getVisibleCountries(currentStaff, countries),
    [currentStaff, countries],
  );
  const canManage = currentStaff ? isGlobalScope(currentStaff) : false;

  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Limit | null>(null);
  const [form, setForm] = useState({
    countryCode: "NG",
    product: "wallet",
    limitType: "daily",
    kycTier: "all" as KycTier | "all",
    riskLevel: "all" as RiskLevel | "all",
    maxAmount: "",
    currency: "NGN",
  });

  const scoped = useMemo(
    () => items.filter((l) => visibleCodes.has(l.countryCode)),
    [items, visibleCodes],
  );

  const filtered = useMemo(() => {
    return scoped.filter((l) => {
      if (countryFilter !== "all" && l.countryCode !== countryFilter) return false;
      if (productFilter !== "all" && l.product !== productFilter) return false;
      if (tierFilter !== "all" && l.kycTier !== tierFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${l.countryCode} ${l.product} ${l.limitType} ${l.kycTier} ${l.riskLevel} ${l.currency}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scoped, countryFilter, productFilter, tierFilter, search]);

  const stats = useMemo(() => {
    return {
      total: scoped.length,
      active: scoped.filter((l) => l.status === "active").length,
      inactive: scoped.filter((l) => l.status === "inactive").length,
      countries: new Set(scoped.map((l) => l.countryCode)).size,
    };
  }, [scoped]);

  const hasActiveFilters = search !== "" || countryFilter !== "all" || productFilter !== "all" || tierFilter !== "all";

  const actor = currentStaff
    ? {
        staffId: currentStaff.id,
        staffName: `${currentStaff.firstName} ${currentStaff.lastName}`,
        department: currentStaff.departmentId,
        role: currentStaff.roleId,
      }
    : null;

  function openCreate() {
    setEditing(null);
    setForm({
      countryCode: visibleCountries[0]?.countryCode ?? "NG",
      product: "wallet",
      limitType: "daily",
      kycTier: "all",
      riskLevel: "all",
      maxAmount: "",
      currency: visibleCountries[0]?.currency ?? "NGN",
    });
    setEditorOpen(true);
  }

  function openEdit(l: Limit) {
    setEditing(l);
    setForm({
      countryCode: l.countryCode,
      product: l.product,
      limitType: l.limitType,
      kycTier: l.kycTier,
      riskLevel: l.riskLevel,
      maxAmount: String(l.maxAmount),
      currency: l.currency,
    });
    setEditorOpen(true);
  }

  function submitEditor() {
    if (!actor) return;
    const max = Number(form.maxAmount);
    if (Number.isNaN(max) || max <= 0) {
      toast.error("Max amount must be a positive number");
      return;
    }
    const now = Date.now();

    if (editing) {
      const patch: Partial<Limit> = {
        countryCode: form.countryCode,
        product: form.product,
        limitType: form.limitType,
        kycTier: form.kycTier,
        riskLevel: form.riskLevel,
        maxAmount: max,
        currency: form.currency,
        updatedAt: now,
      };
      adminData
        .updateLimit(editing.id, patch)
        .then(() => {
          logAudit(actor, "limit.update", "limit", editing.id, {
            countryCode: editing.countryCode,
            beforeValue: formatCurrency(editing.maxAmount, editing.currency),
            afterValue: formatCurrency(max, form.currency),
          });
          toast.success("Limit updated");
          setEditorOpen(false);
        })
        .catch((e) => toast.error("Failed to update limit", { description: String(e) }));
    } else {
      const id = `lmt_${now}_${Math.random().toString(36).slice(2, 6)}`;
      const newLimit: Limit = {
        id,
        countryCode: form.countryCode,
        product: form.product,
        limitType: form.limitType,
        kycTier: form.kycTier,
        riskLevel: form.riskLevel,
        maxAmount: max,
        currency: form.currency,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      adminData
        .createLimit(newLimit)
        .then(() => {
          logAudit(actor, "limit.create", "limit", id, {
            countryCode: newLimit.countryCode,
            afterValue: formatCurrency(newLimit.maxAmount, newLimit.currency),
          });
          toast.success("Limit created");
          setEditorOpen(false);
        })
        .catch((e) => toast.error("Failed to create limit", { description: String(e) }));
    }
  }

  function toggleStatus(l: Limit) {
    if (!actor) return;
    const next = l.status === "active" ? "inactive" : "active";
    adminData
      .updateLimit(l.id, { status: next, updatedAt: Date.now() })
      .then(() => {
        logAudit(actor, next === "active" ? "limit.activate" : "limit.deactivate", "limit", l.id, {
          countryCode: l.countryCode,
          beforeValue: l.status,
          afterValue: next,
        });
        toast.success(next === "active" ? "Limit activated" : "Limit deactivated");
      })
      .catch((e) => toast.error("Failed to toggle limit", { description: String(e) }));
  }

  return (
    <>
      <ViewHeader
        title="Limits"
        description={`Spending & transaction limits by KYC tier · Your scope: ${getScopeLabel(currentStaff)}`}
        icon={Gauge}
        actions={
          canManage ? (
            <Button size="sm" onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="size-4 mr-1" /> Create Limit
            </Button>
          ) : undefined
        }
      />
      <ViewContainer>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard label="Total Limits" value={stats.total} hint="in your scope" icon={Gauge} tone="default" />
          <StatCard label="Active" value={stats.active} icon={CheckCircle2} tone="success" />
          <StatCard label="Inactive" value={stats.inactive} icon={Ban} tone="warning" />
          <StatCard label="Countries" value={stats.countries} hint="with limits configured" icon={Globe2} tone="info" />
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Country, product, limit type, tier…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="w-full sm:w-40">
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
              <div className="w-full sm:w-44">
                <Label className="text-xs text-muted-foreground">Product</Label>
                <Select value={productFilter} onValueChange={setProductFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All products</SelectItem>
                    {PRODUCTS.map((p) => (
                      <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-40">
                <Label className="text-xs text-muted-foreground">KYC Tier</Label>
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All tiers" />
                  </SelectTrigger>
                  <SelectContent>
                    {KYC_TIERS.map((t) => (
                      <SelectItem key={t} value={t}>{TIER_LABELS[t]}</SelectItem>
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
                    setProductFilter("all");
                    setTierFilter("all");
                  }}
                  className="text-muted-foreground"
                >
                  <X className="size-4 mr-1" /> Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="size-4 text-emerald-600" />
              Limits
            </CardTitle>
            <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Gauge}
                title="No limits configured"
                description="Create spending limits per country, product, KYC tier, and risk level."
              />
            ) : (
              <div className="max-h-[70vh] overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 backdrop-blur">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Country</th>
                      <th className="px-4 py-2.5 font-medium">Product</th>
                      <th className="px-4 py-2.5 font-medium hidden md:table-cell">Type</th>
                      <th className="px-4 py-2.5 font-medium">KYC Tier</th>
                      <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Risk</th>
                      <th className="px-4 py-2.5 font-medium">Max Amount</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l) => {
                      const status = STATUS_STYLES[l.status];
                      return (
                        <tr key={l.id} className="border-t hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10">
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className="font-mono text-xs">{l.countryCode}</Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{l.product.replace(/_/g, " ")}</div>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell text-xs">
                            {l.limitType.replace(/_/g, " ")}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className="text-xs">{TIER_LABELS[l.kycTier]}</Badge>
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            <Badge variant="outline" className="text-xs">{RISK_LABELS[l.riskLevel]}</Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-mono font-medium text-emerald-700 dark:text-emerald-400">
                              {formatCurrency(l.maxAmount, l.currency)}
                            </div>
                            <div className="text-xs text-muted-foreground">{l.currency}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary" className={`text-xs ${status.className}`}>
                              {status.label}
                            </Badge>
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
                                {canManage && (
                                  <>
                                    <DropdownMenuItem onClick={() => openEdit(l)}>
                                      <Pencil className="size-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => toggleStatus(l)}
                                      className={l.status === "active" ? "text-amber-700" : "text-emerald-700"}
                                    >
                                      {l.status === "active" ? (
                                        <><Ban className="size-4 mr-2" /> Deactivate</>
                                      ) : (
                                        <><CheckCircle2 className="size-4 mr-2" /> Activate</>
                                      )}
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {!canManage && (
                                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                    Read-only — Super Admin only.
                                  </div>
                                )}
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

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-900/10 dark:border-emerald-800 p-4 flex gap-3">
          <ShieldCheck className="size-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-800 dark:text-emerald-300">
            <strong className="font-medium">How limits apply:</strong> When a Faya Pay or Faya
            Business app initiates a transaction, the engine resolves the most restrictive active
            limit matching the user's KYC tier and risk level for the given product. Limits with
            <code className="mx-1 px-1 py-0.5 rounded bg-white dark:bg-slate-900 font-mono">tier_1</code>
            apply only to Tier-1 users; <code className="mx-1 px-1 py-0.5 rounded bg-white dark:bg-slate-900 font-mono">all</code>
            applies as a fallback when no tier-specific limit matches.
          </div>
        </div>
      </ViewContainer>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit limit" : "Create limit"}</DialogTitle>
            <DialogDescription>
              Define the maximum amount for a given product, KYC tier, and risk level.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Country</Label>
                <Select value={form.countryCode} onValueChange={(v) => setForm({ ...form, countryCode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {visibleCountries.map((c) => (
                      <SelectItem key={c.countryCode} value={c.countryCode}>
                        {c.countryCode} · {c.countryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set(visibleCountries.map((c) => c.currency))).map((cur) => (
                      <SelectItem key={cur} value={cur}>{cur}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Product</Label>
                <Select value={form.product} onValueChange={(v) => setForm({ ...form, product: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCTS.map((p) => (
                      <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Limit type</Label>
                <Select value={form.limitType} onValueChange={(v) => setForm({ ...form, limitType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LIMIT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>KYC tier</Label>
                <Select value={form.kycTier} onValueChange={(v) => setForm({ ...form, kycTier: v as KycTier | "all" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KYC_TIERS.map((t) => (
                      <SelectItem key={t} value={t}>{TIER_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Risk level</Label>
                <Select value={form.riskLevel} onValueChange={(v) => setForm({ ...form, riskLevel: v as RiskLevel | "all" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RISK_LEVELS.map((r) => (
                      <SelectItem key={r} value={r}>{RISK_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="max">Max amount ({form.currency})</Label>
              <Input
                id="max"
                type="number"
                min="0"
                placeholder="0"
                value={form.maxAmount}
                onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={submitEditor} className="bg-emerald-600 hover:bg-emerald-700">
              {editing ? "Save changes" : "Create limit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}
