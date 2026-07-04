"use client";

/**
 * Notifications — §13
 *
 * Push / email / SMS / in-app / security-alert campaign management.
 * Create campaigns, schedule, send now (draft → sent), cancel, view delivery stats.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Search,
  Filter,
  Plus,
  Send,
  Ban,
  Eye,
  MoreHorizontal,
  X,
  Mail,
  MessageSquare,
  Smartphone,
  AlertTriangle,
  Inbox,
  CheckCircle2,
  Clock,
  Globe2,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer, StatCard, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { getScopeLabel, isGlobalScope } from "@/lib/access-scope";
import { formatDateTime, timeAgo, formatNumber } from "@/lib/formatters";
import type {
  NotificationCampaign,
  NotificationChannel,
  NotificationAudience,
  CountryConfig,
} from "@/lib/types";

const CHANNEL_META: Record<NotificationChannel, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  push: { label: "Push", icon: Smartphone, className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  email: { label: "Email", icon: Mail, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  sms: { label: "SMS", icon: MessageSquare, className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  in_app: { label: "In-App", icon: Inbox, className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  security_alert: { label: "Security Alert", icon: AlertTriangle, className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const AUDIENCE_LABELS: Record<NotificationAudience, string> = {
  all_consumers: "All Consumers",
  consumers_by_country: "Consumers by Country",
  merchants_by_country: "Merchants by Country",
  pos_staff: "POS Staff",
  admin_staff: "Admin Staff",
  kyc_pending: "KYC Pending Users",
  card_users: "Card Users",
  suspended_accounts: "Suspended Accounts",
  high_risk_accounts: "High-Risk Accounts",
};

const STATUS_STYLES: Record<NotificationCampaign["status"], { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  scheduled: { label: "Scheduled", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  sending: { label: "Sending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  sent: { label: "Sent", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

export function NotificationsView() {
  const { staff: currentStaff } = useAuth();

  const [items, setItems] = useState<NotificationCampaign[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);

  useEffect(() => adminData.subscribeNotifications(setItems), []);
  useEffect(() => adminData.subscribeCountries(setCountries), []);

  const canCreate = currentStaff ? isGlobalScope(currentStaff) : false;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    channel: "push" as NotificationChannel,
    audience: "all_consumers" as NotificationAudience,
    countryCode: "global", // "global" = null
    scheduledAt: "", // ISO datetime-local string, empty = send immediately
  });

  const [viewing, setViewing] = useState<NotificationCampaign | null>(null);

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (channelFilter !== "all" && c.channel !== channelFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${c.title} ${c.body} ${c.audience} ${c.channel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, statusFilter, channelFilter, search]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      sent: items.filter((c) => c.status === "sent").length,
      scheduled: items.filter((c) => c.status === "scheduled").length,
      drafts: items.filter((c) => c.status === "draft").length,
      totalRecipients: items.reduce((sum, c) => sum + c.sentCount, 0),
    };
  }, [items]);

  const hasActiveFilters = search !== "" || statusFilter !== "all" || channelFilter !== "all";

  const actor = currentStaff
    ? {
        staffId: currentStaff.id,
        staffName: `${currentStaff.firstName} ${currentStaff.lastName}`,
        department: currentStaff.departmentId,
        role: currentStaff.roleId,
      }
    : null;

  function submitCreate() {
    if (!actor) return;
    if (form.title.trim().length < 3) {
      toast.error("Title must be at least 3 characters");
      return;
    }
    if (form.body.trim().length < 5) {
      toast.error("Body must be at least 5 characters");
      return;
    }
    const now = Date.now();
    const scheduledTs = form.scheduledAt ? new Date(form.scheduledAt).getTime() : null;
    const id = `ntf_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const newCampaign: NotificationCampaign = {
      id,
      title: form.title.trim(),
      body: form.body.trim(),
      channel: form.channel,
      audience: form.audience,
      countryCode: form.countryCode === "global" ? null : form.countryCode,
      scheduledAt: scheduledTs,
      status: scheduledTs && scheduledTs > now ? "scheduled" : "draft",
      sentCount: 0,
      failedCount: 0,
      createdBy: actor.staffId,
      createdAt: now,
      updatedAt: now,
    };
    adminData
      .createNotification(newCampaign)
      .then(() => {
        logAudit(actor, "notification.create", "notification", id, {
          countryCode: newCampaign.countryCode,
          afterValue: newCampaign.status,
          reason: `${newCampaign.channel} → ${newCampaign.audience}`,
        });
        toast.success(newCampaign.status === "scheduled" ? "Campaign scheduled" : "Campaign saved as draft", {
          description: newCampaign.title,
        });
        setCreateOpen(false);
        setForm({
          title: "",
          body: "",
          channel: "push",
          audience: "all_consumers",
          countryCode: "global",
          scheduledAt: "",
        });
      })
      .catch((e) => toast.error("Failed to create campaign", { description: String(e) }));
  }

  function sendNow(c: NotificationCampaign) {
    if (!actor) return;
    if (c.status !== "draft" && c.status !== "scheduled") {
      toast.info("Only draft or scheduled campaigns can be sent immediately");
      return;
    }
    const before = c.status;
    // Simulate delivery: pick a plausible recipient count based on audience
    const audienceSizeMap: Record<NotificationAudience, number> = {
      all_consumers: 25000,
      consumers_by_country: 8000,
      merchants_by_country: 1200,
      pos_staff: 350,
      admin_staff: 15,
      kyc_pending: 640,
      card_users: 5400,
      suspended_accounts: 80,
      high_risk_accounts: 35,
    };
    const total = audienceSizeMap[c.audience] ?? 1000;
    const failed = Math.floor(total * 0.005);
    adminData
      .updateNotification(c.id, {
        status: "sent",
        sentCount: total - failed,
        failedCount: failed,
        scheduledAt: null,
        updatedAt: Date.now(),
      })
      .then(() => {
        logAudit(actor, "notification.send", "notification", c.id, {
          countryCode: c.countryCode,
          beforeValue: before,
          afterValue: "sent",
          reason: `Sent to ${total - failed} recipients (${failed} failed)`,
        });
        toast.success("Campaign sent", {
          description: `${formatNumber(total - failed)} recipients · ${failed} failed`,
        });
      })
      .catch((e) => toast.error("Failed to send campaign", { description: String(e) }));
  }

  function cancelCampaign(c: NotificationCampaign) {
    if (!actor) return;
    if (c.status === "sent" || c.status === "cancelled") {
      toast.info("Cannot cancel a sent or already-cancelled campaign");
      return;
    }
    const before = c.status;
    adminData
      .updateNotification(c.id, { status: "cancelled", updatedAt: Date.now() })
      .then(() => {
        logAudit(actor, "notification.cancel", "notification", c.id, {
          countryCode: c.countryCode,
          beforeValue: before,
          afterValue: "cancelled",
        });
        toast.success("Campaign cancelled");
      })
      .catch((e) => toast.error("Failed to cancel campaign", { description: String(e) }));
  }

  return (
    <>
      <ViewHeader
        title="Notifications"
        description={`Push, email, SMS, in-app campaigns · Your scope: ${getScopeLabel(currentStaff)}`}
        icon={Bell}
        actions={
          canCreate ? (
            <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="size-4 mr-1" /> Create Campaign
            </Button>
          ) : undefined
        }
      />
      <ViewContainer>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard label="Total Campaigns" value={stats.total} icon={Bell} tone="default" />
          <StatCard label="Sent" value={stats.sent} hint="historical" icon={CheckCircle2} tone="success" />
          <StatCard label="Scheduled" value={stats.scheduled} hint="future sends" icon={Clock} tone="info" />
          <StatCard label="Recipients Reached" value={formatNumber(stats.totalRecipients)} hint="lifetime" icon={Send} tone="success" />
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Title, body, audience…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="w-full sm:w-44">
                <Label className="text-xs text-muted-foreground">Channel</Label>
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All channels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All channels</SelectItem>
                    {Object.entries(CHANNEL_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
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
                      <SelectItem key={k} value={k}>
                        {v.label}
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
                    setStatusFilter("all");
                    setChannelFilter("all");
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
              Campaigns
            </CardTitle>
            <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No campaigns"
                description="Create a campaign to send push, email, SMS, in-app, or security alerts."
              />
            ) : (
              <div className="max-h-[70vh] overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 backdrop-blur">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Title / Body</th>
                      <th className="px-4 py-2.5 font-medium">Channel</th>
                      <th className="px-4 py-2.5 font-medium hidden md:table-cell">Audience</th>
                      <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Country</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium hidden xl:table-cell text-right">Sent / Failed</th>
                      <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Created</th>
                      <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const ch = CHANNEL_META[c.channel];
                      const status = STATUS_STYLES[c.status];
                      const ChannelIcon = ch.icon;
                      return (
                        <tr
                          key={c.id}
                          className="border-t hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10 cursor-pointer"
                          onClick={() => setViewing(c)}
                        >
                          <td className="px-4 py-2.5">
                            <div className="font-medium truncate">{c.title}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-md">{c.body}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary" className={`text-xs ${ch.className}`}>
                              <ChannelIcon className="size-3 mr-1" />
                              {ch.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell text-xs">
                            {AUDIENCE_LABELS[c.audience]}
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            {c.countryCode ? (
                              <Badge variant="outline" className="font-mono text-xs">{c.countryCode}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                <Globe2 className="size-3 mr-1" /> Global
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary" className={`text-xs ${status.className}`}>
                              {status.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 hidden xl:table-cell text-right tabular-nums">
                            <div className="text-emerald-700 dark:text-emerald-400 font-medium">
                              {formatNumber(c.sentCount)}
                            </div>
                            {c.failedCount > 0 && (
                              <div className="text-xs text-red-600">{formatNumber(c.failedCount)} failed</div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell text-xs text-muted-foreground">
                            {timeAgo(c.createdAt)}
                          </td>
                          <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => setViewing(c)}>
                                  <Eye className="size-4 mr-2" /> View details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => sendNow(c)}
                                  disabled={c.status !== "draft" && c.status !== "scheduled"}
                                  className="text-emerald-700"
                                >
                                  <Send className="size-4 mr-2" /> Send now
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => cancelCampaign(c)}
                                  disabled={c.status === "sent" || c.status === "cancelled"}
                                  className="text-red-700"
                                >
                                  <Ban className="size-4 mr-2" /> Cancel
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
      </ViewContainer>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create notification campaign</DialogTitle>
            <DialogDescription>
              Compose a campaign and either save as draft, schedule for later, or send immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ct">Title</Label>
              <Input
                id="ct"
                placeholder="e.g. Scheduled Maintenance"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cb">Body</Label>
              <Textarea
                id="cb"
                placeholder="Message body…"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">{form.body.length} characters</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Channel</Label>
                <Select
                  value={form.channel}
                  onValueChange={(v) => setForm({ ...form, channel: v as NotificationChannel })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANNEL_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Audience</Label>
                <Select
                  value={form.audience}
                  onValueChange={(v) => setForm({ ...form, audience: v as NotificationAudience })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUDIENCE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Country</Label>
                <Select
                  value={form.countryCode}
                  onValueChange={(v) => setForm({ ...form, countryCode: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">
                      <span className="inline-flex items-center gap-1">
                        <Globe2 className="size-3" /> Global
                      </span>
                    </SelectItem>
                    {countries.map((c) => (
                      <SelectItem key={c.countryCode} value={c.countryCode}>
                        {c.countryCode} · {c.countryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sch">Schedule (optional)</Label>
                <Input
                  id="sch"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to save as draft — you can send immediately later.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submitCreate} className="bg-emerald-600 hover:bg-emerald-700">
              {form.scheduledAt ? "Schedule campaign" : "Save as draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View details sheet */}
      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {viewing && (
            <>
              <SheetHeader>
                <SheetTitle>{viewing.title}</SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const ch = CHANNEL_META[viewing.channel];
                    const ChannelIcon = ch.icon;
                    return (
                      <Badge variant="secondary" className={`text-xs ${ch.className}`}>
                        <ChannelIcon className="size-3 mr-1" />
                        {ch.label}
                      </Badge>
                    );
                  })()}
                  <Badge variant="secondary" className={`text-xs ${STATUS_STYLES[viewing.status].className}`}>
                    {STATUS_STYLES[viewing.status].label}
                  </Badge>
                  {viewing.countryCode ? (
                    <Badge variant="outline" className="font-mono text-xs">{viewing.countryCode}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <Globe2 className="size-3 mr-1" /> Global
                    </Badge>
                  )}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6 space-y-4">
                <div className="rounded-lg border bg-slate-50 dark:bg-slate-900 p-3 text-sm">
                  {viewing.body}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase">Audience</div>
                    <div className="font-medium">{AUDIENCE_LABELS[viewing.audience]}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase">Created by</div>
                    <div className="font-mono text-xs">{viewing.createdBy}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase">Created</div>
                    <div>{formatDateTime(viewing.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase">Scheduled</div>
                    <div>{viewing.scheduledAt ? formatDateTime(viewing.scheduledAt) : "—"}</div>
                  </div>
                </div>

                {viewing.status === "sent" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-800 p-3">
                      <div className="text-xs uppercase text-emerald-700 dark:text-emerald-300">Delivered</div>
                      <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        {formatNumber(viewing.sentCount)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800 p-3">
                      <div className="text-xs uppercase text-red-700 dark:text-red-300">Failed</div>
                      <div className="text-2xl font-bold text-red-700 dark:text-red-300 tabular-nums">
                        {formatNumber(viewing.failedCount)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendNow(viewing)}
                    disabled={viewing.status !== "draft" && viewing.status !== "scheduled"}
                    className="text-emerald-700"
                  >
                    <Send className="size-4 mr-1" /> Send now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelCampaign(viewing)}
                    disabled={viewing.status === "sent" || viewing.status === "cancelled"}
                    className="text-red-700"
                  >
                    <Ban className="size-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}
