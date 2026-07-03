"use client";

import { useMemo } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  Wallet,
  Scale,
  Headphones,
  Globe2,
  TrendingUp,
  TrendingDown,
  Clock,
  Eye,
  Layers,
} from "lucide-react";
import { ViewHeader, ViewContainer, StatCard, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePortalStore } from "@/hooks/use-portal-store";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatNumber, formatCompact, statusBadge, timeAgo } from "@/lib/formatters";
import { PLATFORM_LABELS, type CountryConfig, type AdminStaff, type KycCase, type KybCase, type FraudAlert, type Settlement, type SupportTicket, type Merchant, type Consumer, type PlatformKey } from "@/lib/types";

interface DashboardViewProps {
  countries: CountryConfig[];
  staff: AdminStaff[];
  kycCases: KycCase[];
  kybCases: KybCase[];
  fraudAlerts: FraudAlert[];
  settlements: Settlement[];
  tickets: SupportTicket[];
  merchants: Merchant[];
  consumers: Consumer[];
}

const PLATFORM_ORDER: PlatformKey[] = [
  "consumerApp",
  "merchantApp",
  "physicalTerminal",
  "phonePos",
  "nfcClosedLoop",
  "onlineCheckout",
];

export function DashboardView({
  countries,
  staff,
  kycCases,
  kybCases,
  fraudAlerts,
  settlements,
  tickets,
  merchants,
  consumers,
}: DashboardViewProps) {
  const { staff: currentStaff } = useAuth();
  const { setView, selectCountry, setView: setPortalView } = usePortalStore();

  // Filter to the staff's assigned countries (Super Admin sees all)
  const visibleCountries = useMemo(() => {
    if (!currentStaff) return [];
    if (currentStaff.departmentId === "dept_super_admin") return countries;
    const codes = new Set(currentStaff.countries.map((c) => c.countryCode));
    return countries.filter((c) => codes.has(c.countryCode));
  }, [countries, currentStaff]);

  // Filter merchants/consumers to visible countries using the same logic
  const visibleMerchants = useMemo(() => {
    if (!currentStaff) return [];
    if (currentStaff.departmentId === "dept_super_admin") return merchants;
    const codes = new Set(currentStaff.countries.map((c) => c.countryCode));
    return merchants.filter((m) => codes.has(m.countryCode));
  }, [merchants, currentStaff]);

  const visibleConsumers = useMemo(() => {
    if (!currentStaff) return [];
    if (currentStaff.departmentId === "dept_super_admin") return consumers;
    const codes = new Set(currentStaff.countries.map((c) => c.countryCode));
    return consumers.filter((c) => codes.has(c.countryCode));
  }, [consumers, currentStaff]);

  // Aggregate KPIs across visible countries
  const kpis = useMemo(() => {
    const acc = visibleCountries.reduce(
      (a, c) => {
        a.activeCustomers += c.activeCustomers;
        a.activeMerchants += c.activeMerchants;
        a.pendingKyc += c.pendingKyc;
        a.pendingKyb += c.pendingKyb;
        a.highRiskAlerts += c.highRiskAlerts;
        a.activeTerminals += c.activeTerminals;
        a.activePhonePos += c.activePhonePos;
        a.todayTxVolume += c.todayTxVolume;
        a.todayApproved += c.todayApproved;
        a.todayDeclined += c.todayDeclined;
        a.pendingSettlements += c.pendingSettlements;
        a.heldSettlements += c.heldSettlements;
        a.openDisputes += c.openDisputes;
        a.openTickets += c.openTickets;
        a.complianceAlerts += c.complianceAlerts;
        return a;
      },
      {
        activeCustomers: 0, activeMerchants: 0, pendingKyc: 0, pendingKyb: 0, highRiskAlerts: 0,
        activeTerminals: 0, activePhonePos: 0, todayTxVolume: 0, todayApproved: 0, todayDeclined: 0,
        pendingSettlements: 0, heldSettlements: 0, openDisputes: 0, openTickets: 0, complianceAlerts: 0,
      },
    );
    const declineRate = acc.todayApproved + acc.todayDeclined > 0
      ? (acc.todayDeclined / (acc.todayApproved + acc.todayDeclined)) * 100
      : 0;
    return { ...acc, declineRate };
  }, [visibleCountries]);

  // Recent activity across visible countries
  const visibleCountryCodes = new Set(visibleCountries.map((c) => c.countryCode));
  const recentKyc = kycCases.filter((k) => visibleCountryCodes.has(k.countryCode)).slice(0, 5);
  const recentFraud = fraudAlerts.filter((f) => visibleCountryCodes.has(f.countryCode)).slice(0, 5);
  const pendingSettlements = settlements
    .filter((s) => visibleCountryCodes.has(s.countryCode) && (s.status === "pending" || s.status === "processing" || s.status === "held"))
    .slice(0, 5);
  const openTickets = tickets
    .filter((t) => visibleCountryCodes.has(t.countryCode) && (t.status === "open" || t.status === "in_progress"))
    .slice(0, 5);

  const totalTx = kpis.todayApproved + kpis.todayDeclined;
  const approvalRate = totalTx > 0 ? (kpis.todayApproved / totalTx) * 100 : 0;

  return (
    <>
      <ViewHeader
        title="Operations Dashboard"
        description={
          currentStaff?.departmentId === "dept_super_admin"
            ? "Global view across all countries"
            : `Scoped to your assigned countries: ${visibleCountries.map((c) => c.countryCode).join(", ")}`
        }
        icon={LayoutDashboard}
      />
      <ViewContainer>
        {/* Top KPI row */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Today's Volume" value={formatCompact(kpis.todayTxVolume)} hint="across visible countries" icon={Wallet} tone="info" />
          <StatCard label="Approval Rate" value={`${approvalRate.toFixed(1)}%`} hint={`${formatNumber(kpis.todayApproved)} approved · ${formatNumber(kpis.todayDeclined)} declined`} icon={TrendingUp} tone="success" />
          <StatCard label="Decline Rate" value={`${kpis.declineRate.toFixed(1)}%`} icon={TrendingDown} tone={kpis.declineRate > 5 ? "danger" : "default"} />
          <StatCard label="Total Merchants" value={formatCompact(visibleMerchants.length)} hint="visible merchant records" icon={Building2} tone="success" />
          <StatCard label="Total Consumers" value={formatCompact(visibleConsumers.length)} hint="visible consumer records" icon={Users} tone="success" />
        </div>

        {/* Compliance + Risk row */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Pending KYC" value={kpis.pendingKyc} icon={ShieldCheck} tone="warning" />
          <StatCard label="Pending KYB" value={kpis.pendingKyb} icon={Building2} tone="warning" />
          <StatCard label="High-Risk Alerts" value={kpis.highRiskAlerts} icon={AlertTriangle} tone="danger" />
          <StatCard label="Compliance Alerts" value={kpis.complianceAlerts} icon={AlertTriangle} tone="danger" />
          <StatCard label="Open Disputes" value={kpis.openDisputes} icon={Scale} tone="warning" />
        </div>

        {/* Devices + Settlements row */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Active Terminals" value={formatNumber(kpis.activeTerminals)} icon={Smartphone} />
          <StatCard label="Active Phone POS" value={formatNumber(kpis.activePhonePos)} icon={Smartphone} />
          <StatCard label="Pending Settlements" value={kpis.pendingSettlements} icon={Clock} tone="warning" />
          <StatCard label="Held Settlements" value={kpis.heldSettlements} icon={AlertTriangle} tone="danger" />
          <StatCard label="Open Tickets" value={kpis.openTickets} icon={Headphones} tone="warning" />
        </div>

        {/* Country cards */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Countries</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setView("countries")} className="text-emerald-700">
              <Globe2 className="size-4 mr-1" /> Manage
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {visibleCountries.length === 0 ? (
              <EmptyState icon={Globe2} title="No countries assigned" description="Contact a Super Admin to assign country access." />
            ) : (
              <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleCountries.map((c) => {
                  const badge = statusBadge("country", c.status);
                  const enabledPlatforms = PLATFORM_ORDER.filter((key) => c.platforms?.[key] === true);
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        selectCountry(c.countryCode);
                        setPortalView("country_detail");
                      }}
                      className="text-left rounded-lg border bg-card p-4 hover:border-emerald-400 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold">{c.countryCode}</span>
                            <span className="text-sm text-muted-foreground truncate">{c.countryName}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{c.currency} · {c.regulator}</div>
                        </div>
                        <Badge variant="secondary" className={badge.className}>{badge.label}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                        <div>
                          <div className="text-muted-foreground">Customers</div>
                          <div className="font-semibold tabular-nums">{formatCompact(c.activeCustomers)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Merchants</div>
                          <div className="font-semibold tabular-nums">{formatCompact(c.activeMerchants)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Today Vol.</div>
                          <div className="font-semibold tabular-nums">{formatCompact(c.todayTxVolume)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="size-3" /> {c.pendingKyc} KYC</span>
                        <span className="flex items-center gap-1"><AlertTriangle className="size-3" /> {c.highRiskAlerts} risk</span>
                        <span className="flex items-center gap-1"><Scale className="size-3" /> {c.openDisputes} disp.</span>
                      </div>
                      {/* Platform scope chips */}
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t flex-wrap">
                        <Layers className="size-3 text-emerald-600 shrink-0" />
                        {enabledPlatforms.length === 0 ? (
                          <span className="text-[11px] text-muted-foreground italic">No platforms enabled</span>
                        ) : (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 cursor-help">
                                  {enabledPlatforms.length} platform{enabledPlatforms.length === 1 ? "" : "s"}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <div className="space-y-1">
                                  <div className="text-xs font-semibold mb-1">Enabled platforms</div>
                                  {enabledPlatforms.map((key) => (
                                    <div key={key} className="text-[11px]">{PLATFORM_LABELS[key].label}</div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <div className="flex items-center gap-1 flex-wrap ml-1">
                          {enabledPlatforms.map((key) => (
                            <Badge
                              key={key}
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                            >
                              {PLATFORM_LABELS[key].label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity grid */}
        <div className="grid gap-3 lg:grid-cols-2">
          <ActivityCard
            title="Recent KYC Cases"
            icon={ShieldCheck}
            onView={() => setView("compliance")}
            items={recentKyc.map((k) => ({
              id: k.id,
              primary: k.customerName,
              secondary: `${k.countryCode} · Risk ${k.riskScore}`,
              badge: statusBadge("kyc", k.status),
              meta: timeAgo(k.submittedAt),
            }))}
            emptyIcon={ShieldCheck}
            emptyTitle="No recent KYC cases"
          />
          <ActivityCard
            title="Fraud Alerts"
            icon={AlertTriangle}
            onView={() => setView("risk")}
            items={recentFraud.map((f) => ({
              id: f.id,
              primary: f.entityName,
              secondary: `${f.countryCode} · ${f.trigger}`,
              badge: statusBadge("risk", f.severity),
              meta: timeAgo(f.createdAt),
            }))}
            emptyIcon={AlertTriangle}
            emptyTitle="No fraud alerts"
          />
          <ActivityCard
            title="Pending Settlements"
            icon={Wallet}
            onView={() => setView("finance")}
            items={pendingSettlements.map((s) => ({
              id: s.id,
              primary: s.merchantName,
              secondary: `${s.countryCode} · ${formatCurrency(s.amount, s.currency)}`,
              badge: { label: s.status, className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300" },
              meta: s.batchId,
            }))}
            emptyIcon={Wallet}
            emptyTitle="No pending settlements"
          />
          <ActivityCard
            title="Open Support Tickets"
            icon={Headphones}
            onView={() => setView("support")}
            items={openTickets.map((t) => ({
              id: t.id,
              primary: t.subject,
              secondary: `${t.countryCode} · ${t.requesterName}`,
              badge: { label: t.priority, className: t.priority === "urgent" || t.priority === "high" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
              meta: timeAgo(t.createdAt),
            }))}
            emptyIcon={Headphones}
            emptyTitle="No open tickets"
          />
        </div>
      </ViewContainer>
    </>
  );
}

interface ActivityItem {
  id: string;
  primary: string;
  secondary: string;
  badge: { label: string; className: string };
  meta: string;
}

function ActivityCard({
  title,
  icon: Icon,
  onView,
  items,
  emptyIcon,
  emptyTitle,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  onView: () => void;
  items: ActivityItem[];
  emptyIcon: React.ComponentType<{ className?: string }>;
  emptyTitle: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="size-4 text-emerald-600" />
          {title}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onView} className="text-xs text-emerald-700 h-7">
          <Eye className="size-3 mr-1" /> View all
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} />
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{it.primary}</div>
                  <div className="text-xs text-muted-foreground truncate">{it.secondary}</div>
                </div>
                <Badge variant="secondary" className={`text-[10px] shrink-0 ${it.badge.className}`}>
                  {it.badge.label}
                </Badge>
                <span className="text-[11px] text-muted-foreground shrink-0 w-16 text-right">{it.meta}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
