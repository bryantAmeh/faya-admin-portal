"use client";

/**
 * Faya Admin Portal — Audit Logs view (spec §13)
 *
 * Immutable record of every admin action. Provides:
 *  - KPI strip: total today, unique actors today, failed logins 24h, sensitive actions 24h
 *  - Filters: free-text search, country select, department select, time range, action filter
 *  - Sortable table (sticky header, scrollable body, custom scrollbar)
 *  - Row click opens right-side Sheet with full detail (incl. before/after JSON pretty-printed)
 *
 * Country scoping: Super Admin sees all logs; everyone else only sees logs whose
 * countryCode is null (system actions) or matches one of their assigned countries.
 */
import { useMemo, useState } from "react";
import {
  ScrollText,
  Search,
  Filter,
  X,
  Clock,
  Users,
  AlertTriangle,
  ShieldAlert,
  Lock,
  Fingerprint,
  Globe2,
  Building2,
  FileJson,
  ArrowDownUp,
  ArrowDown,
  ArrowUp,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";

import { ViewHeader, ViewContainer, StatCard, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, timeAgo } from "@/lib/formatters";
import type { AuditLog, Department } from "@/lib/types";

interface AuditViewProps {
  auditLogs: AuditLog[];
  departments: Department[];
}

type SortDir = "asc" | "desc";
type TimeRange = "24h" | "7d" | "30d" | "all";

const SENSITIVE_ACTIONS = [
  "staff.suspend",
  "staff.delete",
  "staff.mfa_reset",
  "staff.unlock",
  "country.change_status",
  "country.change_kyc_rules",
  "country.change_kyb_rules",
  "country.change_risk_rules",
  "settlement.release_hold",
  "settlement.hold",
  "account.restrict",
  "account.unrestrict",
  "device.block",
  "merchant.restrict",
  "approval.approve",
  "approval.reject",
];

function prettyJson(value: string | undefined): string {
  if (!value) return "—";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function isFailedLogin(action: string): boolean {
  return (
    action === "login.failed" ||
    action === "auth.login_failed" ||
    action === "staff.failed_login" ||
    action.toLowerCase().includes("failed_login")
  );
}

function isSensitive(action: string): boolean {
  return SENSITIVE_ACTIONS.some((s) => action === s || action.startsWith(s + "."));
}

export function AuditView({ auditLogs, departments }: AuditViewProps) {
  const { staff: currentStaff } = useAuth();

  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [actionFilter, setActionFilter] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const isSuperAdmin = currentStaff?.departmentId === "dept_super_admin";
  const myCountryCodes = useMemo(
    () => new Set(currentStaff?.countries.map((c) => c.countryCode) ?? []),
    [currentStaff],
  );

  // Country scoping
  const scopedLogs = useMemo(() => {
    if (!currentStaff) return [];
    if (isSuperAdmin) return auditLogs;
    return auditLogs.filter(
      (l) => l.countryCode === null || myCountryCodes.has(l.countryCode),
    );
  }, [auditLogs, currentStaff, isSuperAdmin, myCountryCodes]);

  // Country options derived from scoped logs (plus "system" for null)
  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    scopedLogs.forEach((l) => {
      if (l.countryCode) set.add(l.countryCode);
    });
    return Array.from(set).sort();
  }, [scopedLogs]);

  // Time cutoff
  const cutoff = useMemo(() => {
    if (timeRange === "all") return 0;
    const hrs = timeRange === "24h" ? 24 : timeRange === "7d" ? 24 * 7 : 24 * 30;
    return Date.now() - hrs * 60 * 60 * 1000;
  }, [timeRange]);

  // Filtered logs
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const a = actionFilter.trim().toLowerCase();
    return scopedLogs
      .filter((l) => (cutoff === 0 ? true : l.createdAt >= cutoff))
      .filter((l) => (countryFilter === "all" ? true : l.countryCode === countryFilter))
      .filter((l) => {
        if (deptFilter === "all") return true;
        // Match department by name (audit logs store department as name string)
        const dept = departments.find((d) => d.id === deptFilter);
        if (!dept) return false;
        return l.department === dept.name;
      })
      .filter((l) => (a === "" ? true : l.action.toLowerCase().includes(a)))
      .filter((l) => {
        if (q === "") return true;
        return (
          l.action.toLowerCase().includes(q) ||
          l.entityId.toLowerCase().includes(q) ||
          l.staffName.toLowerCase().includes(q) ||
          l.entityType.toLowerCase().includes(q) ||
          (l.reason ?? "").toLowerCase().includes(q) ||
          l.ipAddress.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (sortDir === "desc" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
  }, [scopedLogs, cutoff, countryFilter, deptFilter, departments, actionFilter, search, sortDir]);

  // KPI calculations
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const logsToday = scopedLogs.filter((l) => l.createdAt >= todayMs);
  const uniqueActorsToday = new Set(logsToday.map((l) => l.staffId)).size;
  const failedLogins24h = scopedLogs.filter(
    (l) => l.createdAt >= dayAgo && isFailedLogin(l.action),
  ).length;
  const sensitiveActions24h = scopedLogs.filter(
    (l) => l.createdAt >= dayAgo && isSensitive(l.action),
  ).length;

  const activeFilters =
    (search ? 1 : 0) +
    (countryFilter !== "all" ? 1 : 0) +
    (deptFilter !== "all" ? 1 : 0) +
    (timeRange !== "24h" ? 1 : 0) +
    (actionFilter ? 1 : 0);

  function clearFilters() {
    setSearch("");
    setCountryFilter("all");
    setDeptFilter("all");
    setTimeRange("24h");
    setActionFilter("");
  }

  function copyLogJson(log: AuditLog) {
    try {
      navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      toast.success("Audit log copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <>
      <ViewHeader
        title="Audit Logs"
        description="Immutable record of every admin action"
        icon={ScrollText}
        actions={
          <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
            <Lock className="size-3 mr-1" /> Immutable
          </Badge>
        }
      />
      <ViewContainer>
        {/* KPI strip */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard
            label="Logs Today"
            value={logsToday.length}
            hint="since midnight"
            icon={ScrollText}
            tone="info"
          />
          <StatCard
            label="Unique Actors"
            value={uniqueActorsToday}
            hint="today"
            icon={Users}
          />
          <StatCard
            label="Failed Logins"
            value={failedLogins24h}
            hint="last 24h"
            icon={ShieldAlert}
            tone={failedLogins24h > 0 ? "danger" : "default"}
          />
          <StatCard
            label="Sensitive Actions"
            value={sensitiveActions24h}
            hint="last 24h"
            icon={AlertTriangle}
            tone={sensitiveActions24h > 0 ? "warning" : "default"}
          />
        </div>

        {/* Filters card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="size-4 text-emerald-600" /> Filters
                {activeFilters > 0 && (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800">
                    {activeFilters} active
                  </Badge>
                )}
              </CardTitle>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                  <X className="size-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="audit-search" className="text-xs">Search</Label>
                <div className="relative">
                  <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="audit-search"
                    placeholder="Action, entity ID, staff name, reason…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Country</Label>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All countries</SelectItem>
                    {countryOptions.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Department</Label>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Time range</Label>
                <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3 grid gap-3 grid-cols-1 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="audit-action" className="text-xs">Action filter</Label>
                <Input
                  id="audit-action"
                  placeholder="e.g. kyc.approve, staff.suspend, settlement."
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit log table */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <ScrollText className="size-4 text-emerald-600" />
              Audit Trail
              <Badge variant="secondary" className="text-[10px]">
                {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
              </Badge>
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Sorted {sortDir === "desc" ? "newest first" : "oldest first"}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="No audit logs match your filters"
                description="Adjust filters or widen the time range to see more entries."
              />
            ) : (
              <div className="max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 shadow-sm">
                    <tr className="border-b">
                      <th className="text-left font-medium text-xs uppercase tracking-wide px-3 py-2.5 text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          Timestamp
                          <ArrowDownUp className="size-3" />
                          {sortDir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
                        </button>
                      </th>
                      <th className="text-left font-medium text-xs uppercase tracking-wide px-3 py-2.5 text-muted-foreground">Staff</th>
                      <th className="text-left font-medium text-xs uppercase tracking-wide px-3 py-2.5 text-muted-foreground hidden lg:table-cell">Department</th>
                      <th className="text-left font-medium text-xs uppercase tracking-wide px-3 py-2.5 text-muted-foreground hidden xl:table-cell">Role</th>
                      <th className="text-left font-medium text-xs uppercase tracking-wide px-3 py-2.5 text-muted-foreground">Country</th>
                      <th className="text-left font-medium text-xs uppercase tracking-wide px-3 py-2.5 text-muted-foreground">Action</th>
                      <th className="text-left font-medium text-xs uppercase tracking-wide px-3 py-2.5 text-muted-foreground hidden md:table-cell">Entity</th>
                      <th className="text-left font-medium text-xs uppercase tracking-wide px-3 py-2.5 text-muted-foreground hidden xl:table-cell">Entity ID</th>
                      <th className="text-left font-medium text-xs uppercase tracking-wide px-3 py-2.5 text-muted-foreground hidden 2xl:table-cell">Reason</th>
                      <th className="text-left font-medium text-xs uppercase tracking-wide px-3 py-2.5 text-muted-foreground hidden 2xl:table-cell">IP</th>
                      <th className="text-left font-medium text-xs uppercase tracking-wide px-3 py-2.5 text-muted-foreground hidden 2xl:table-cell">Device</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((log) => {
                      const sensitive = isSensitive(log.action);
                      const failed = isFailedLogin(log.action);
                      return (
                        <tr
                          key={log.id}
                          onClick={() => setSelected(log)}
                          className="border-b last:border-0 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-2.5 align-top whitespace-nowrap">
                            <div className="text-xs font-medium">{formatDateTime(log.createdAt)}</div>
                            <div className="text-[10px] text-muted-foreground">{timeAgo(log.createdAt)}</div>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <div className="font-medium text-xs">{log.staffName}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{log.staffId}</div>
                          </td>
                          <td className="px-3 py-2.5 align-top hidden lg:table-cell">
                            <span className="text-xs">{log.department}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top hidden xl:table-cell">
                            <span className="text-xs text-muted-foreground">{log.role}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            {log.countryCode ? (
                              <Badge variant="outline" className="text-[10px] font-mono">{log.countryCode}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-slate-500">system</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-medium">{log.action}</span>
                              {sensitive && (
                                <ShieldAlert className="size-3 text-amber-500" aria-label="Sensitive action" />
                              )}
                              {failed && (
                                <AlertTriangle className="size-3 text-red-500" aria-label="Failed" />
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-top hidden md:table-cell">
                            <Badge variant="secondary" className="text-[10px]">{log.entityType}</Badge>
                          </td>
                          <td className="px-3 py-2.5 align-top hidden xl:table-cell">
                            <span className="font-mono text-[11px] text-muted-foreground">{log.entityId}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top hidden 2xl:table-cell max-w-[18rem]">
                            <span className="text-xs text-muted-foreground line-clamp-1">{log.reason ?? "—"}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top hidden 2xl:table-cell">
                            <span className="font-mono text-[11px] text-muted-foreground">{log.ipAddress}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top hidden 2xl:table-cell">
                            <span className="font-mono text-[11px] text-muted-foreground">{log.deviceFingerprint}</span>
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

        {/* Detail Sheet */}
        <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent
            side="right"
            className="w-full sm:max-w-lg md:max-w-xl overflow-y-auto p-0"
          >
            {selected && (
              <>
                <SheetHeader className="border-b bg-emerald-50/50 dark:bg-emerald-950/20">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <ScrollText className="size-4 text-emerald-600" />
                    <span className="font-mono">{selected.action}</span>
                  </SheetTitle>
                  <SheetDescription>
                    Audit log <span className="font-mono">{selected.id}</span>
                  </SheetDescription>
                </SheetHeader>

                <div className="p-4 space-y-4">
                  {/* Quick meta */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <DetailField icon={Clock} label="Timestamp" value={formatDateTime(selected.createdAt)} sub={timeAgo(selected.createdAt)} />
                    <DetailField icon={Globe2} label="Country" value={selected.countryCode ?? "System (no country)"} />
                    <DetailField icon={Users} label="Staff" value={selected.staffName} sub={selected.staffId} mono />
                    <DetailField icon={Building2} label="Department" value={selected.department} sub={selected.role} />
                    <DetailField icon={KeyRound} label="Entity type" value={selected.entityType} />
                    <DetailField icon={KeyRound} label="Entity ID" value={selected.entityId} mono />
                    <DetailField icon={Globe2} label="IP address" value={selected.ipAddress} mono />
                    <DetailField icon={Fingerprint} label="Device fingerprint" value={selected.deviceFingerprint} mono />
                  </div>

                  {/* Reason */}
                  {selected.reason && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reason</div>
                      <div className="text-sm rounded-md border bg-card p-3">{selected.reason}</div>
                    </div>
                  )}

                  {/* Before/After values */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <FileJson className="size-3.5" /> Before / After values
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyLogJson(selected)}>
                        Copy JSON
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase font-medium text-red-600 dark:text-red-400">Before</div>
                        <pre className="text-[11px] font-mono rounded-md border bg-red-50/50 dark:bg-red-950/20 p-2 overflow-x-auto max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
                          {prettyJson(selected.beforeValue)}
                        </pre>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase font-medium text-emerald-600 dark:text-emerald-400">After</div>
                        <pre className="text-[11px] font-mono rounded-md border bg-emerald-50/50 dark:bg-emerald-950/20 p-2 overflow-x-auto max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
                          {prettyJson(selected.afterValue)}
                        </pre>
                      </div>
                    </div>
                  </div>

                  {/* Raw record */}
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Raw record</div>
                    <pre className="text-[11px] font-mono rounded-md border bg-slate-50 dark:bg-slate-900 p-2 overflow-x-auto max-h-72 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
                      {JSON.stringify(selected, null, 2)}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </ViewContainer>
    </>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
  sub,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1 rounded-md border bg-card p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Icon className="size-3" /> {label}
      </div>
      <div className={`text-sm font-medium ${mono ? "font-mono" : ""} break-words`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground font-mono">{sub}</div>}
    </div>
  );
}
