"use client";

/**
 * Provider Logs — §22
 *
 * Read-only monitoring of external provider status (Firebase, Paymentology,
 * Smile Identity, Twilio, SendGrid, FCM, settlement banks). Status badge:
 * operational = emerald, degraded = amber, outage = red. Shows uptime,
 * error rate, last success/error, API latency, webhook failures, retry queue.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Server,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Webhook,
  RefreshCw,
  Search,
  X,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { adminData } from "@/lib/admin-data";
import { getScopeLabel } from "@/lib/access-scope";
import { formatDateTime, timeAgo } from "@/lib/formatters";
import type { ProviderLog } from "@/lib/types";

const STATUS_META: Record<ProviderLog["status"], { label: string; className: string; dot: string }> = {
  operational: {
    label: "Operational",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
    dot: "bg-emerald-500",
  },
  degraded: {
    label: "Degraded",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-700",
    dot: "bg-amber-500",
  },
  outage: {
    label: "Outage",
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",
    dot: "bg-red-500",
  },
};

export function ProviderLogsView() {
  const { staff: currentStaff } = useAuth();

  const [items, setItems] = useState<ProviderLog[]>([]);
  useEffect(() => adminData.subscribeProviderLogs(setItems), []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.provider.toLowerCase().includes(q) && !p.notes.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      operational: items.filter((p) => p.status === "operational").length,
      degraded: items.filter((p) => p.status === "degraded").length,
      outage: items.filter((p) => p.status === "outage").length,
      avgUptime: items.length > 0 ? items.reduce((s, p) => s + p.uptime, 0) / items.length : 0,
      totalRetries: items.reduce((s, p) => s + p.retryQueue, 0),
    };
  }, [items]);

  const hasActiveFilters = search !== "" || statusFilter !== "all";

  function refresh() {
    // In local mode, subscriptions auto-update; we just simulate a refresh toast
    toast.success("Provider statuses refreshed", {
      description: `${stats.operational} operational · ${stats.degraded} degraded · ${stats.outage} outage`,
    });
  }

  return (
    <>
      <ViewHeader
        title="Provider Logs"
        description={`External provider status monitoring · Your scope: ${getScopeLabel(currentStaff)}`}
        icon={Server}
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="size-4 mr-1" /> Refresh
          </Button>
        }
      />
      <ViewContainer>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Providers" value={stats.total} icon={Server} tone="default" />
          <StatCard label="Operational" value={stats.operational} icon={CheckCircle2} tone="success" />
          <StatCard label="Degraded" value={stats.degraded} icon={AlertTriangle} tone="warning" />
          <StatCard label="Outage" value={stats.outage} icon={XCircle} tone="danger" />
          <StatCard label="Avg Uptime" value={`${stats.avgUptime.toFixed(2)}%`} icon={Activity} tone="success" />
          <StatCard label="Retry Queue" value={stats.totalRetries} hint="across all providers" icon={RefreshCw} tone="warning" />
        </div>

        {/* Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Provider name, notes…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="w-full sm:w-44">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="degraded">Degraded</SelectItem>
                    <SelectItem value="outage">Outage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                  className="text-muted-foreground"
                >
                  <X className="size-4 mr-1" /> Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Provider cards */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={Server}
                title="No providers"
                description="Provider status will appear here once the monitoring agent checks in."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const meta = STATUS_META[p.status];
              return (
                <Card key={p.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{p.provider}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Updated {timeAgo(p.updatedAt)}</p>
                      </div>
                      <Badge variant="outline" className={`text-xs ${meta.className}`}>
                        <span className={`size-1.5 rounded-full mr-1.5 ${meta.dot} ${p.status !== "operational" ? "animate-pulse" : ""}`} />
                        {meta.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {p.notes && (
                      <p className="text-xs text-muted-foreground italic line-clamp-2">{p.notes}</p>
                    )}
                    {/* Uptime + error rate */}
                    <div className="grid grid-cols-2 gap-3">
                      <Metric
                        label="Uptime"
                        value={`${p.uptime.toFixed(2)}%`}
                        icon={Activity}
                        tone={p.uptime >= 99.5 ? "success" : p.uptime >= 98 ? "warning" : "danger"}
                      />
                      <Metric
                        label="Error rate"
                        value={`${p.errorRate.toFixed(2)}%`}
                        icon={AlertTriangle}
                        tone={p.errorRate < 0.5 ? "success" : p.errorRate < 2 ? "warning" : "danger"}
                      />
                    </div>
                    {/* Latency + retries */}
                    <div className="grid grid-cols-2 gap-3">
                      <Metric
                        label="API latency"
                        value={`${p.apiLatencyMs}ms`}
                        icon={Zap}
                        tone={p.apiLatencyMs < 200 ? "success" : p.apiLatencyMs < 800 ? "warning" : "danger"}
                      />
                      <Metric
                        label="Retry queue"
                        value={String(p.retryQueue)}
                        icon={RefreshCw}
                        tone={p.retryQueue === 0 ? "success" : "warning"}
                      />
                    </div>
                    {/* Webhook failures */}
                    <div className="grid grid-cols-2 gap-3">
                      <Metric
                        label="Webhook failures"
                        value={String(p.webhookFailures)}
                        icon={Webhook}
                        tone={p.webhookFailures === 0 ? "success" : "danger"}
                      />
                      <div className="rounded-lg border bg-slate-50 dark:bg-slate-900 p-2.5">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-emerald-600" /> Last success
                        </div>
                        <div className="text-xs font-medium mt-1" title={formatDateTime(p.lastSuccessAt)}>
                          {timeAgo(p.lastSuccessAt)}
                        </div>
                      </div>
                    </div>
                    {/* Last error */}
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="rounded-lg border bg-slate-50 dark:bg-slate-900 p-2.5 cursor-help">
                            <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                              <XCircle className={`size-3 ${p.lastErrorAt ? "text-red-600" : "text-slate-400"}`} /> Last error
                            </div>
                            <div className="text-xs font-medium mt-1">
                              {p.lastErrorAt ? timeAgo(p.lastErrorAt) : "No recent errors"}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          {p.lastErrorAt ? formatDateTime(p.lastErrorAt) : "No errors recorded"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Read-only notice */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-900/10 dark:border-emerald-800 p-4 flex gap-3">
          <Clock className="size-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-800 dark:text-emerald-300">
            <strong className="font-medium">Read-only monitoring.</strong>{" "}
            Provider statuses are updated automatically by the monitoring agent every
            60 seconds. To pause, failover, or rotate API keys for any provider, contact
            the platform engineering team — these actions are not exposed in the admin portal.
          </div>
        </div>
      </ViewContainer>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "warning" | "danger";
}) {
  const toneClasses = {
    success: "text-emerald-700 dark:text-emerald-400",
    warning: "text-amber-700 dark:text-amber-400",
    danger: "text-red-700 dark:text-red-400",
  }[tone];
  return (
    <div className="rounded-lg border bg-slate-50 dark:bg-slate-900 p-2.5">
      <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <Icon className={`size-3 ${toneClasses}`} /> {label}
      </div>
      <div className={`text-sm font-semibold mt-1 tabular-nums ${toneClasses}`}>{value}</div>
    </div>
  );
}
