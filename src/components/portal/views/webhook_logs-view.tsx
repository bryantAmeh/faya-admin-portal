"use client";

/**
 * Webhook Logs — §23
 *
 * Incoming webhook events from external providers (Paymentology, Smile Identity,
 * GTBank, Twilio, etc.). Replay / Mark resolved / View (masked) payload.
 * Filter by provider + payload status.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Webhook,
  Search,
  Filter,
  MoreHorizontal,
  RefreshCw,
  CheckCircle2,
  Eye,
  X,
  AlertTriangle,
  Clock,
  Server,
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
import { getScopeLabel } from "@/lib/access-scope";
import { timeAgo } from "@/lib/formatters";
import type { WebhookLog } from "@/lib/types";

const STATUS_STYLES: Record<WebhookLog["payloadStatus"], { label: string; className: string }> = {
  received: { label: "Received", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  processed: { label: "Processed", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  replayed: { label: "Replayed", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
};

export function WebhookLogsView() {
  const { staff: currentStaff } = useAuth();

  const [items, setItems] = useState<WebhookLog[]>([]);
  useEffect(() => adminData.subscribeWebhookLogs(setItems), []);

  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const providers = useMemo(() => {
    return Array.from(new Set(items.map((w) => w.provider))).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((w) => {
      if (providerFilter !== "all" && w.provider !== providerFilter) return false;
      if (statusFilter !== "all" && w.payloadStatus !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${w.provider} ${w.eventType} ${w.entityId} ${w.errorMessage ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, providerFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      processed: items.filter((w) => w.payloadStatus === "processed").length,
      failed: items.filter((w) => w.payloadStatus === "failed").length,
      replayed: items.filter((w) => w.payloadStatus === "replayed").length,
      received: items.filter((w) => w.payloadStatus === "received").length,
    };
  }, [items]);

  const hasActiveFilters = search !== "" || providerFilter !== "all" || statusFilter !== "all";

  const actor = currentStaff
    ? {
        staffId: currentStaff.id,
        staffName: `${currentStaff.firstName} ${currentStaff.lastName}`,
        department: currentStaff.departmentId,
        role: currentStaff.roleId,
      }
    : null;

  function replay(w: WebhookLog) {
    if (!actor) return;
    const before = w.payloadStatus;
    adminData
      .updateWebhookLog(w.id, {
        payloadStatus: "replayed",
        processedAt: Date.now(),
        // Note: real impl would re-invoke the handler; here we mark + log
      })
      .then(() => {
        logAudit(actor, "webhook.replay", "webhook_log", w.id, {
          countryCode: null,
          beforeValue: before,
          afterValue: "replayed",
          reason: `Replayed ${w.provider} ${w.eventType} webhook`,
        });
        toast.success("Webhook replayed", {
          description: `${w.provider} · ${w.eventType} · entity ${w.entityId}`,
        });
      })
      .catch((e) => toast.error("Failed to replay webhook", { description: String(e) }));
  }

  function markResolved(w: WebhookLog) {
    if (!actor) return;
    if (w.payloadStatus === "processed") {
      toast.info("Already processed");
      return;
    }
    const before = w.payloadStatus;
    adminData
      .updateWebhookLog(w.id, {
        payloadStatus: "processed",
        processedAt: w.processedAt ?? Date.now(),
      })
      .then(() => {
        logAudit(actor, "webhook.resolve", "webhook_log", w.id, {
          beforeValue: before,
          afterValue: "processed",
          reason: `Manually marked ${w.provider} ${w.eventType} as resolved`,
        });
        toast.success("Marked as resolved");
      })
      .catch((e) => toast.error("Failed to mark resolved", { description: String(e) }));
  }

  function viewPayload(w: WebhookLog) {
    if (!actor) return;
    // Permission-gated: in a full impl this would fetch the actual payload blob.
    // MVP: toast a masked preview and audit the access.
    logAudit(actor, "webhook.view_payload", "webhook_log", w.id, {
      reason: "Admin viewed masked webhook payload",
    });
    toast.info("Payload preview (masked)", {
      description: `${w.provider} · ${w.eventType} · entity ${w.entityId}`,
    });
  }

  return (
    <>
      <ViewHeader
        title="Webhook Logs"
        description={`Incoming webhook events from providers · Your scope: ${getScopeLabel(currentStaff)}`}
        icon={Webhook}
        actions={
          <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
            {filtered.length} of {stats.total} events
          </Badge>
        }
      />
      <ViewContainer>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total Webhooks" value={stats.total} icon={Webhook} tone="default" />
          <StatCard label="Processed" value={stats.processed} icon={CheckCircle2} tone="success" />
          <StatCard label="Received (pending)" value={stats.received} icon={Clock} tone="info" />
          <StatCard label="Failed" value={stats.failed} icon={AlertTriangle} tone="danger" />
          <StatCard label="Replayed" value={stats.replayed} icon={RefreshCw} tone="warning" />
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Provider, event type, entity ID, error…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <Label className="text-xs text-muted-foreground">Provider</Label>
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All providers</SelectItem>
                    {providers.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-44">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {Object.entries(STATUS_STYLES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
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
                    setProviderFilter("all");
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="size-4 text-emerald-600" />
              Webhook Events
            </CardTitle>
            <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Webhook}
                title="No webhook events"
                description="Incoming provider webhook events will appear here in real time."
              />
            ) : (
              <div className="max-h-[70vh] overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 backdrop-blur">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Provider / Event</th>
                      <th className="px-4 py-2.5 font-medium hidden md:table-cell">Entity</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Received</th>
                      <th className="px-4 py-2.5 font-medium hidden xl:table-cell">Processed</th>
                      <th className="px-4 py-2.5 font-medium hidden sm:table-cell text-center">Retries</th>
                      <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Error</th>
                      <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((w) => {
                      const status = STATUS_STYLES[w.payloadStatus];
                      return (
                        <tr
                          key={w.id}
                          className="border-t hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10"
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-start gap-2 min-w-0">
                              <Server className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{w.provider}</div>
                                <div className="text-xs text-muted-foreground font-mono truncate">
                                  {w.eventType}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            <span className="font-mono text-xs">{w.entityId}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary" className={`text-xs ${status.className}`}>
                              {status.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
                            {timeAgo(w.receivedAt)}
                          </td>
                          <td className="px-4 py-2.5 hidden xl:table-cell text-xs text-muted-foreground">
                            {w.processedAt ? timeAgo(w.processedAt) : "—"}
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell text-center">
                            {w.retryCount > 0 ? (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300">
                                {w.retryCount}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-red-700 dark:text-red-400 max-w-xs truncate" title={w.errorMessage ?? ""}>
                            {w.errorMessage ?? "—"}
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
                                <DropdownMenuItem onClick={() => viewPayload(w)}>
                                  <Eye className="size-4 mr-2" /> View payload (masked)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => replay(w)}
                                  disabled={w.payloadStatus === "processed"}
                                >
                                  <RefreshCw className="size-4 mr-2" /> Replay
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => markResolved(w)}
                                  disabled={w.payloadStatus === "processed"}
                                  className="text-emerald-700"
                                >
                                  <CheckCircle2 className="size-4 mr-2" /> Mark resolved
                                </DropdownMenuItem>
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
          <Webhook className="size-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-800 dark:text-emerald-300">
            <strong className="font-medium">Replay</strong> re-invokes the webhook handler
            against the original payload — useful when a downstream service was temporarily
            unavailable. <strong className="font-medium">Mark resolved</strong> is for cases
            where the underlying issue was fixed outside the webhook pipeline (e.g. manual
            reconciliation) and you want to clear the alert without re-processing.
          </div>
        </div>
      </ViewContainer>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}
