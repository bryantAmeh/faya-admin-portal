"use client";

/**
 * Faya Admin Portal — Countries Management view (spec §5.1, §5.2)
 *
 * Lists every CountryConfig as a responsive card with key counters and a
 * status badge. Super Admins can add new countries via a dialog. Clicking a
 * card pushes the user into the country detail view via the portal store.
 */
import { useMemo, useState } from "react";
import {
  Globe2,
  Plus,
  Search,
  Filter,
  Building2,
  ShieldCheck,
  Smartphone,
  Wallet,
  AlertTriangle,
  Scale,
  Headphones,
  Clock,
  Users,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ViewHeader, ViewContainer, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

import { usePortalStore } from "@/hooks/use-portal-store";
import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
import { formatCompact, formatNumber, statusBadge } from "@/lib/formatters";
import type { CountryConfig, CountryStatus } from "@/lib/types";

interface CountriesViewProps {
  countries: CountryConfig[];
}

const STATUS_OPTIONS: { value: "all" | CountryStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "internal_testing", label: "Internal Testing" },
  { value: "pilot", label: "Pilot" },
  { value: "live", label: "Live" },
  { value: "restricted", label: "Restricted" },
  { value: "suspended", label: "Suspended" },
  { value: "closed", label: "Closed" },
];

/** Derive a coarse region label from a country's timezone. */
function regionOf(country: CountryConfig): string {
  const tz = country.timezone ?? "";
  const head = tz.split("/")[0];
  if (!head) return "Unknown";
  return head.replace(/_/g, " ");
}

const EMPTY_RULES: Record<string, unknown> = {};

export function CountriesView({ countries }: CountriesViewProps) {
  const { staff } = useAuth();
  const { selectCountry, setView } = usePortalStore();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CountryStatus>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);

  const isSuperAdmin = staff?.departmentId === "dept_super_admin";

  const regions = useMemo(() => {
    const set = new Set<string>();
    countries.forEach((c) => set.add(regionOf(c)));
    return Array.from(set).sort();
  }, [countries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return countries.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (regionFilter !== "all" && regionOf(c) !== regionFilter) return false;
      if (!q) return true;
      return (
        c.countryName.toLowerCase().includes(q) ||
        c.countryCode.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q) ||
        c.regulator.toLowerCase().includes(q)
      );
    });
  }, [countries, search, statusFilter, regionFilter]);

  const handleOpenCountry = (code: string) => {
    selectCountry(code);
    setView("country_detail");
  };

  return (
    <>
      <ViewHeader
        title="Country Management"
        description="Configure and monitor every country where Faya operates — KYC, KYB, device, settlement and risk rules."
        icon={Globe2}
        actions={
          isSuperAdmin ? (
            <Button onClick={() => setAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="size-4 mr-1" /> Add Country
            </Button>
          ) : null
        }
      />
      <ViewContainer>
        {/* Filter bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, code, currency, regulator…"
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-muted-foreground hidden sm:block" />
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | CountryStatus)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={regionFilter} onValueChange={setRegionFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All regions</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
                <span className="font-medium text-foreground">{countries.length}</span> countries
              </span>
              {(search || statusFilter !== "all" || regionFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setRegionFilter("all");
                  }}
                >
                  <X className="size-3 mr-1" /> Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cards grid */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={Globe2}
                title="No countries match your filters"
                description="Try adjusting the search or status/region filters above."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <CountryCard key={c.id} country={c} onOpen={() => handleOpenCountry(c.countryCode)} />
            ))}
          </div>
        )}
      </ViewContainer>

      {isSuperAdmin && (
        <AddCountryDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          existingCodes={new Set(countries.map((c) => c.countryCode))}
          onCreated={(code) => {
            setAddOpen(false);
            selectCountry(code);
            setView("country_detail");
          }}
        />
      )}
    </>
  );
}

/* ----------------------------- Country card ------------------------------ */

function CountryCard({ country, onOpen }: { country: CountryConfig; onOpen: () => void }) {
  const badge = statusBadge("country", country.status);
  const launchBadge = statusBadge("country", country.launchStatus as CountryStatus);

  return (
    <button
      onClick={onOpen}
      className="text-left rounded-lg border bg-card p-4 hover:border-emerald-400 hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      aria-label={`Open ${country.countryName} (${country.countryCode}) details`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight">{country.countryCode}</span>
            <span className="text-sm text-muted-foreground truncate">{country.countryName}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {country.currency} · {country.regulator}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{country.timezone}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant="secondary" className={badge.className}>
            {badge.label}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {launchBadge.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
        <CardMetric icon={Users} label="Customers" value={formatCompact(country.activeCustomers)} />
        <CardMetric icon={Building2} label="Merchants" value={formatCompact(country.activeMerchants)} />
        <CardMetric icon={Wallet} label="Today Vol." value={formatCompact(country.todayTxVolume)} />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
        <CardMetric icon={ShieldCheck} label="KYC" value={formatNumber(country.pendingKyc)} />
        <CardMetric icon={Building2} label="KYB" value={formatNumber(country.pendingKyb)} />
        <CardMetric icon={AlertTriangle} label="Risk" value={formatNumber(country.highRiskAlerts)} tone={country.highRiskAlerts > 0 ? "danger" : "default"} />
        <CardMetric icon={Smartphone} label="Terminals" value={formatNumber(country.activeTerminals)} />
        <CardMetric icon={Smartphone} label="Phone POS" value={formatNumber(country.activePhonePos)} />
        <CardMetric icon={Clock} label="Pend. Settle" value={formatNumber(country.pendingSettlements)} tone={country.pendingSettlements > 0 ? "warning" : "default"} />
        <CardMetric icon={AlertTriangle} label="Held Settle" value={formatNumber(country.heldSettlements)} tone={country.heldSettlements > 0 ? "danger" : "default"} />
        <CardMetric icon={Scale} label="Disputes" value={formatNumber(country.openDisputes)} tone={country.openDisputes > 0 ? "warning" : "default"} />
        <CardMetric icon={Headphones} label="Tickets" value={formatNumber(country.openTickets)} tone={country.openTickets > 0 ? "warning" : "default"} />
        <CardMetric icon={Check} label="Approved" value={formatCompact(country.todayApproved)} tone="success" />
        <CardMetric icon={X} label="Declined" value={formatCompact(country.todayDeclined)} tone={country.todayDeclined > 0 ? "danger" : "default"} />
        <CardMetric icon={AlertTriangle} label="Compliance" value={formatNumber(country.complianceAlerts)} tone={country.complianceAlerts > 0 ? "danger" : "default"} />
      </div>
    </button>
  );
}

function CardMetric({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "text-slate-900 dark:text-slate-100",
    success: "text-emerald-700 dark:text-emerald-400",
    warning: "text-amber-700 dark:text-amber-400",
    danger: "text-red-700 dark:text-red-400",
  }[tone];
  return (
    <div className="rounded-md bg-slate-50 dark:bg-slate-800/40 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
        <Icon className="size-3" />
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-sm font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

/* --------------------------- Add Country dialog -------------------------- */

const ALL_COUNTRY_STATUSES: CountryStatus[] = [
  "draft",
  "internal_testing",
  "pilot",
  "live",
  "restricted",
  "suspended",
  "closed",
];

function AddCountryDialog({
  open,
  onOpenChange,
  existingCodes,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCodes: Set<string>;
  onCreated: (code: string) => void;
}) {
  const { staff } = useAuth();
  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");
  const [currency, setCurrency] = useState("");
  const [timezone, setTimezone] = useState("");
  const [regulator, setRegulator] = useState("");
  const [status, setStatus] = useState<CountryStatus>("draft");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setCountryCode("");
    setCountryName("");
    setCurrency("");
    setTimezone("");
    setRegulator("");
    setStatus("draft");
  };

  const handleSubmit = async () => {
    const code = countryCode.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      toast.error("Country code must be exactly 2 uppercase letters (e.g. NG, GH).");
      return;
    }
    if (existingCodes.has(code)) {
      toast.error(`Country code ${code} already exists.`);
      return;
    }
    if (!countryName.trim() || !currency.trim() || !timezone.trim() || !regulator.trim()) {
      toast.error("All fields are required.");
      return;
    }

    setSaving(true);
    try {
      const now = Date.now();
      const id = `country_${code}`;
      const country: CountryConfig = {
        id,
        countryCode: code,
        countryName: countryName.trim(),
        currency: currency.trim().toUpperCase(),
        timezone: timezone.trim(),
        regulator: regulator.trim(),
        status,
        launchStatus: status.charAt(0).toUpperCase() + status.slice(1).replace("_", " "),
        kycRules: { ...EMPTY_RULES },
        kybRules: { ...EMPTY_RULES },
        deviceRules: { ...EMPTY_RULES },
        settlementRules: { ...EMPTY_RULES },
        riskRules: { ...EMPTY_RULES },
        activeCustomers: 0,
        activeMerchants: 0,
        pendingKyc: 0,
        pendingKyb: 0,
        highRiskAlerts: 0,
        activeTerminals: 0,
        activePhonePos: 0,
        todayTxVolume: 0,
        todayApproved: 0,
        todayDeclined: 0,
        pendingSettlements: 0,
        heldSettlements: 0,
        openDisputes: 0,
        openTickets: 0,
        complianceAlerts: 0,
        createdAt: now,
        updatedAt: now,
      };
      await adminData.createCountry(country);
      if (staff) {
        logAudit(
          {
            staffId: staff.id,
            staffName: `${staff.firstName} ${staff.lastName}`,
            department: staff.departmentId,
            role: staff.roleId,
          },
          "country.create",
          "country",
          id,
          {
            countryCode: code,
            afterValue: JSON.stringify({ countryName: country.countryName, status }),
          },
        );
      }
      toast.success(`${country.countryName} (${code}) created.`);
      resetForm();
      onCreated(code);
    } catch (e) {
      toast.error("Failed to create country", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add new country</DialogTitle>
          <DialogDescription>
            Create a new country configuration with empty rule sets and zero counters. You can configure rules after creation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-code">Country Code</Label>
              <Input
                id="cc-code"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="NG"
                autoCapitalize="characters"
              />
              <p className="text-[11px] text-muted-foreground">2-letter ISO code</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-currency">Currency</Label>
              <Input
                id="cc-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="NGN"
              />
              <p className="text-[11px] text-muted-foreground">3-letter ISO 4217</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-name">Country Name</Label>
            <Input id="cc-name" value={countryName} onChange={(e) => setCountryName(e.target.value)} placeholder="Nigeria" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-tz">Timezone</Label>
            <Input id="cc-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Africa/Lagos" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-regulator">Regulator</Label>
            <Input id="cc-regulator" value={regulator} onChange={(e) => setRegulator(e.target.value)} placeholder="CBN" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as CountryStatus)}>
              <SelectTrigger className="w-full">
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
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? "Creating…" : "Create country"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
