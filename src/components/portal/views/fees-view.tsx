"use client";

/**
 * Fees — §14
 *
 * Country-product fee configuration. Each Fee row has either a percentage,
 * a fixed amount, or both. Filter by country + product. Edit / activate /
 * deactivate.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Percent,
  Search,
  Filter,
  Plus,
  Pencil,
  MoreHorizontal,
  X,
  CheckCircle2,
  Ban,
  Globe2,
  DollarSign,
  TrendingUp,
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
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Fee, CountryConfig } from "@/lib/types";

const PRODUCTS = [
  "virtual_card",
  "physical_card",
  "card_replacement",
  "merchant_card_acceptance",
  "settlement",
  "chargeback",
  "refund",
  "wallet",
  "pos",
];

const FEE_TYPES = [
  "issuance",
  "monthly",
  "per_transaction",
  "per_settlement",
  "per_chargeback",
  "per_refund",
  "withdrawal",
];

const STATUS_STYLES: Record<Fee["status"], { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  inactive: { label: "Inactive", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

function formatFee(f: Fee): string {
  const parts: string[] = [];
  if (f.percentage !== null && f.percentage > 0) {
    parts.push(`${f.percentage}%`);
  }
  if (f.fixedAmount !== null && f.fixedAmount > 0) {
    parts.push(formatCurrency(f.fixedAmount, f.currency));
  }
  return parts.length > 0 ? parts.join(" + ") : "—";
}

export function FeesView() {
  const { staff: currentStaff } = useAuth();

  const [items, setItems] = useState<Fee[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);

  useEffect(() => adminData.subscribeFees(setItems), []);
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

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Fee | null>(null);
  const [form, setForm] = useState({
    countryCode: "NG",
    product: "virtual_card",
    feeType: "issuance",
    percentage: "",
    fixedAmount: "",
    currency: "NGN",
    effectiveDate: new Date().toISOString().slice(0, 10),
  });

  const scoped = useMemo(
    () => items.filter((f) => visibleCodes.has(f.countryCode)),
    [items, visibleCodes],
  );

  const filtered = useMemo(() => {
    return scoped.filter((f) => {
      if (countryFilter !== "all" && f.countryCode !== countryFilter) return false;
      if (productFilter !== "all" && f.product !== productFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${f.countryCode} ${f.product} ${f.feeType} ${f.currency}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scoped, countryFilter, productFilter, search]);

  const stats = useMemo(() => {
    return {
      total: scoped.length,
      active: scoped.filter((f) => f.status === "active").length,
      inactive: scoped.filter((f) => f.status === "inactive").length,
      countries: new Set(scoped.map((f) => f.countryCode)).size,
    };
  }, [scoped]);

  const hasActiveFilters = search !== "" || countryFilter !== "all" || productFilter !== "all";

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
      product: "virtual_card",
      feeType: "issuance",
      percentage: "",
      fixedAmount: "",
      currency: visibleCountries[0]?.currency ?? "NGN",
      effectiveDate: new Date().toISOString().slice(0, 10),
    });
    setEditorOpen(true);
  }

  function openEdit(f: Fee) {
    setEditing(f);
    setForm({
      countryCode: f.countryCode,
      product: f.product,
      feeType: f.feeType,
      percentage: f.percentage !== null ? String(f.percentage) : "",
      fixedAmount: f.fixedAmount !== null ? String(f.fixedAmount) : "",
      currency: f.currency,
      effectiveDate: new Date(f.effectiveDate).toISOString().slice(0, 10),
    });
    setEditorOpen(true);
  }

  function submitEditor() {
    if (!actor) return;
    const pct = form.percentage.trim() === "" ? null : Number(form.percentage);
    const fixed = form.fixedAmount.trim() === "" ? null : Number(form.fixedAmount);
    if (pct === null && fixed === null) {
      toast.error("Provide either a percentage or a fixed amount");
      return;
    }
    if (pct !== null && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
      toast.error("Percentage must be between 0 and 100");
      return;
    }
    if (fixed !== null && (Number.isNaN(fixed) || fixed < 0)) {
      toast.error("Fixed amount must be a positive number");
      return;
    }
    const effectiveTs = new Date(form.effectiveDate).getTime();
    const now = Date.now();

    if (editing) {
      const patch: Partial<Fee> = {
        countryCode: form.countryCode,
        product: form.product,
        feeType: form.feeType,
        percentage: pct,
        fixedAmount: fixed,
        currency: form.currency,
        effectiveDate: effectiveTs,
        updatedAt: now,
      };
      adminData
        .updateFee(editing.id, patch)
        .then(() => {
          logAudit(actor, "fee.update", "fee", editing.id, {
            countryCode: editing.countryCode,
            beforeValue: formatFee(editing),
            afterValue: formatFee({ ...editing, ...patch }),
          });
          toast.success("Fee updated");
          setEditorOpen(false);
        })
        .catch((e) => toast.error("Failed to update fee", { description: String(e) }));
    } else {
      const id = `fee_${now}_${Math.random().toString(36).slice(2, 6)}`;
      const newFee: Fee = {
        id,
        countryCode: form.countryCode,
        product: form.product,
        feeType: form.feeType,
        percentage: pct,
        fixedAmount: fixed,
        currency: form.currency,
        effectiveDate: effectiveTs,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      adminData
        .createFee(newFee)
        .then(() => {
          logAudit(actor, "fee.create", "fee", id, {
            countryCode: newFee.countryCode,
            afterValue: formatFee(newFee),
          });
          toast.success("Fee created");
          setEditorOpen(false);
        })
        .catch((e) => toast.error("Failed to create fee", { description: String(e) }));
    }
  }

  function toggleStatus(f: Fee) {
    if (!actor) return;
    const next = f.status === "active" ? "inactive" : "active";
    adminData
      .updateFee(f.id, { status: next, updatedAt: Date.now() })
      .then(() => {
        logAudit(actor, next === "active" ? "fee.activate" : "fee.deactivate", "fee", f.id, {
          countryCode: f.countryCode,
          beforeValue: f.status,
          afterValue: next,
        });
        toast.success(next === "active" ? "Fee activated" : "Fee deactivated");
      })
      .catch((e) => toast.error("Failed to toggle fee", { description: String(e) }));
  }

  return (
    <>
      <ViewHeader
        title="Fees"
        description={`Fee configuration by country & product · Your scope: ${getScopeLabel(currentStaff)}`}
        icon={Percent}
        actions={
          canManage ? (
            <Button size="sm" onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="size-4 mr-1" /> Create Fee
            </Button>
          ) : undefined
        }
      />
      <ViewContainer>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard label="Total Fees" value={stats.total} hint="in your scope" icon={Percent} tone="default" />
          <StatCard label="Active" value={stats.active} icon={CheckCircle2} tone="success" />
          <StatCard label="Inactive" value={stats.inactive} icon={Ban} tone="warning" />
          <StatCard label="Countries" value={stats.countries} hint="with fees configured" icon={Globe2} tone="info" />
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Country, product, fee type, currency…"
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
                <Label className="text-xs text-muted-foreground">Product</Label>
                <Select value={productFilter} onValueChange={setProductFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All products</SelectItem>
                    {PRODUCTS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.replace(/_/g, " ")}
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
                    setProductFilter("all");
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
              Fees
            </CardTitle>
            <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Percent}
                title="No fees configured"
                description="Create a fee to charge for cards, settlement, chargebacks, etc."
              />
            ) : (
              <div className="max-h-[70vh] overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 backdrop-blur">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Country</th>
                      <th className="px-4 py-2.5 font-medium">Product</th>
                      <th className="px-4 py-2.5 font-medium hidden md:table-cell">Fee Type</th>
                      <th className="px-4 py-2.5 font-medium">Fee</th>
                      <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Effective</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((f) => {
                      const status = STATUS_STYLES[f.status];
                      return (
                        <tr
                          key={f.id}
                          className="border-t hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10"
                        >
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className="font-mono text-xs">{f.countryCode}</Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{f.product.replace(/_/g, " ")}</div>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell text-xs">
                            {f.feeType.replace(/_/g, " ")}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-mono font-medium text-emerald-700 dark:text-emerald-400">
                              {formatFee(f)}
                            </div>
                            <div className="text-xs text-muted-foreground">{f.currency}</div>
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
                            {formatDate(f.effectiveDate)}
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
                                    <DropdownMenuItem onClick={() => openEdit(f)}>
                                      <Pencil className="size-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => toggleStatus(f)}
                                      className={f.status === "active" ? "text-amber-700" : "text-emerald-700"}
                                    >
                                      {f.status === "active" ? (
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
      </ViewContainer>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit fee" : "Create fee"}</DialogTitle>
            <DialogDescription>
              Set either a percentage, a fixed amount, or both. Both will be applied additively.
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
                <Label>Fee type</Label>
                <Select value={form.feeType} onValueChange={(v) => setForm({ ...form, feeType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="pct">Percentage (%)</Label>
                <div className="relative">
                  <TrendingUp className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="pct"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="0.0"
                    value={form.percentage}
                    onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fx">Fixed amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="fx"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.fixedAmount}
                    onChange={(e) => setForm({ ...form, fixedAmount: e.target.value })}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="eff">Effective date</Label>
              <Input
                id="eff"
                type="date"
                value={form.effectiveDate}
                onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={submitEditor} className="bg-emerald-600 hover:bg-emerald-700">
              {editing ? "Save changes" : "Create fee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}
