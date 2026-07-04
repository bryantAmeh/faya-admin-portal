"use client";

/**
 * App Content — §6
 *
 * In-app text snippets surfaced across Faya Pay, Faya Business, Faya POS and
 * the Admin Portal (e.g. onboarding welcome copy, KYC help text, security
 * notices). Filter by app / country / language. Create / edit / publish flow.
 */
import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Search,
  Filter,
  Plus,
  Eye,
  Send,
  Pencil,
  MoreHorizontal,
  X,
  Globe2,
  Languages,
  CheckCircle2,
  Clock,
  LayoutTemplate,
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
import { timeAgo, formatDate } from "@/lib/formatters";
import type { AppContent } from "@/lib/types";

const APP_LABELS: Record<AppContent["app"], string> = {
  faya_pay: "Faya Pay",
  faya_business: "Faya Business",
  faya_pos: "Faya POS",
  admin: "Admin Portal",
};

const STATUS_STYLES: Record<AppContent["status"], { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  pending_approval: { label: "Pending Approval", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  published: { label: "Published", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  archived: { label: "Archived", className: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
};

const LANGUAGES = ["en", "fr", "ar", "sw"];

export function AppContentView() {
  const { staff: currentStaff } = useAuth();

  const [items, setItems] = useState<AppContent[]>([]);
  useEffect(() => adminData.subscribeAppContent(setItems), []);

  const canManage = currentStaff ? isGlobalScope(currentStaff) : false;

  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [langFilter, setLangFilter] = useState<string>("all");

  // Create/Edit dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AppContent | null>(null);
  const [form, setForm] = useState({
    contentKey: "",
    title: "",
    body: "",
    app: "faya_pay" as AppContent["app"],
    countryCode: "global", // "global" = null
    language: "en",
    version: "1.0",
  });

  // View sheet
  const [viewing, setViewing] = useState<AppContent | null>(null);

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (appFilter !== "all" && c.app !== appFilter) return false;
      if (countryFilter !== "all") {
        if (countryFilter === "global" && c.countryCode !== null) return false;
        if (countryFilter !== "global" && c.countryCode !== countryFilter) return false;
      }
      if (langFilter !== "all" && c.language !== langFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${c.contentKey} ${c.title} ${c.body} ${c.app}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, appFilter, countryFilter, langFilter, search]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      published: items.filter((c) => c.status === "published").length,
      drafts: items.filter((c) => c.status === "draft").length,
      languages: new Set(items.map((c) => c.language)).size,
    };
  }, [items]);

  const hasActiveFilters = search !== "" || appFilter !== "all" || countryFilter !== "all" || langFilter !== "all";

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
      contentKey: "",
      title: "",
      body: "",
      app: "faya_pay",
      countryCode: "global",
      language: "en",
      version: "1.0",
    });
    setEditorOpen(true);
  }

  function openEdit(c: AppContent) {
    setEditing(c);
    setForm({
      contentKey: c.contentKey,
      title: c.title,
      body: c.body,
      app: c.app,
      countryCode: c.countryCode ?? "global",
      language: c.language,
      version: c.version,
    });
    setEditorOpen(true);
  }

  function submitEditor() {
    if (!actor) return;
    if (form.contentKey.trim().length < 3) {
      toast.error("Content key must be at least 3 characters (e.g. consumer.onboarding.welcome)");
      return;
    }
    if (form.title.trim().length < 3) {
      toast.error("Title must be at least 3 characters");
      return;
    }
    if (form.body.trim().length < 5) {
      toast.error("Body must be at least 5 characters");
      return;
    }

    const now = Date.now();
    if (editing) {
      // Edit existing
      const patch: Partial<AppContent> = {
        contentKey: form.contentKey.trim(),
        title: form.title.trim(),
        body: form.body.trim(),
        app: form.app,
        countryCode: form.countryCode === "global" ? null : form.countryCode,
        language: form.language,
        version: form.version.trim() || "1.0",
        updatedAt: now,
      };
      adminData
        .updateAppContent(editing.id, patch)
        .then(() => {
          logAudit(actor, "app_content.update", "app_content", editing.id, {
            countryCode: patch.countryCode ?? null,
            beforeValue: JSON.stringify({ title: editing.title, version: editing.version }),
            afterValue: JSON.stringify({ title: patch.title, version: patch.version }),
          });
          toast.success("Content updated", {
            description: `${form.contentKey} · ${APP_LABELS[form.app]}`,
          });
          setEditorOpen(false);
        })
        .catch((e) => toast.error("Failed to update content", { description: String(e) }));
    } else {
      const id = `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newContent: AppContent = {
        id,
        contentKey: form.contentKey.trim(),
        title: form.title.trim(),
        body: form.body.trim(),
        app: form.app,
        countryCode: form.countryCode === "global" ? null : form.countryCode,
        language: form.language,
        version: form.version.trim() || "1.0",
        status: "draft",
        createdBy: actor.staffId,
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      adminData
        .createAppContent(newContent)
        .then(() => {
          logAudit(actor, "app_content.create", "app_content", id, {
            countryCode: newContent.countryCode,
            afterValue: "draft",
            reason: `New content key ${newContent.contentKey}`,
          });
          toast.success("Content created as draft");
          setEditorOpen(false);
        })
        .catch((e) => toast.error("Failed to create content", { description: String(e) }));
    }
  }

  function publishContent(c: AppContent) {
    if (!actor) return;
    const before = c.status;
    adminData
      .updateAppContent(c.id, {
        status: "published",
        publishedAt: Date.now(),
        updatedAt: Date.now(),
      })
      .then(() => {
        logAudit(actor, "app_content.publish", "app_content", c.id, {
          countryCode: c.countryCode,
          beforeValue: before,
          afterValue: "published",
        });
        toast.success(`Published — ${c.title}`);
      })
      .catch((e) => toast.error("Failed to publish content", { description: String(e) }));
  }

  return (
    <>
      <ViewHeader
        title="App Content"
        description={`In-app text across Faya Pay / Business / POS · Your scope: ${getScopeLabel(currentStaff)}`}
        icon={FileText}
        actions={
          canManage ? (
            <Button size="sm" onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="size-4 mr-1" /> Create Content
            </Button>
          ) : undefined
        }
      />
      <ViewContainer>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard label="Content Items" value={stats.total} icon={LayoutTemplate} tone="default" />
          <StatCard label="Published" value={stats.published} hint="live in apps" icon={CheckCircle2} tone="success" />
          <StatCard label="Drafts" value={stats.drafts} icon={Clock} tone="warning" />
          <StatCard label="Languages" value={stats.languages} hint="en, fr, ar, sw" icon={Languages} tone="info" />
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Content key, title, body…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="w-full sm:w-44">
                <Label className="text-xs text-muted-foreground">App</Label>
                <Select value={appFilter} onValueChange={setAppFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All apps" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All apps</SelectItem>
                    {Object.entries(APP_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-44">
                <Label className="text-xs text-muted-foreground">Country</Label>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All countries</SelectItem>
                    <SelectItem value="global">
                      <span className="inline-flex items-center gap-1">
                        <Globe2 className="size-3" /> Global only
                      </span>
                    </SelectItem>
                    <SelectItem value="NG">NG · Nigeria</SelectItem>
                    <SelectItem value="GH">GH · Ghana</SelectItem>
                    <SelectItem value="KE">KE · Kenya</SelectItem>
                    <SelectItem value="ZA">ZA · South Africa</SelectItem>
                    <SelectItem value="EG">EG · Egypt</SelectItem>
                    <SelectItem value="MA">MA · Morocco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-32">
                <Label className="text-xs text-muted-foreground">Language</Label>
                <Select value={langFilter} onValueChange={setLangFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All languages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All languages</SelectItem>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
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
                    setAppFilter("all");
                    setCountryFilter("all");
                    setLangFilter("all");
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
              Content Items
            </CardTitle>
            <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No content"
                description="Create content keys to surface text in the Faya apps."
              />
            ) : (
              <div className="max-h-[70vh] overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 backdrop-blur">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Content Key / Title</th>
                      <th className="px-4 py-2.5 font-medium hidden md:table-cell">App</th>
                      <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Country</th>
                      <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Lang</th>
                      <th className="px-4 py-2.5 font-medium">Version</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium hidden xl:table-cell">Updated</th>
                      <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const status = STATUS_STYLES[c.status];
                      return (
                        <tr
                          key={c.id}
                          className="border-t hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10 cursor-pointer"
                          onClick={() => setViewing(c)}
                        >
                          <td className="px-4 py-2.5">
                            <div className="font-mono text-xs text-emerald-700 dark:text-emerald-400 truncate">
                              {c.contentKey}
                            </div>
                            <div className="font-medium truncate">{c.title}</div>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell text-xs">
                            {APP_LABELS[c.app]}
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            {c.countryCode ? (
                              <Badge variant="outline" className="font-mono text-xs">
                                {c.countryCode}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                <Globe2 className="size-3 mr-1" /> Global
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell">
                            <Badge variant="outline" className="font-mono text-xs">
                              {c.language}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary" className="font-mono text-xs bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                              v{c.version}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary" className={`text-xs ${status.className}`}>
                              {status.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 hidden xl:table-cell text-xs text-muted-foreground">
                            {timeAgo(c.updatedAt)}
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
                                  <Eye className="size-4 mr-2" /> View
                                </DropdownMenuItem>
                                {canManage && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => openEdit(c)}>
                                      <Pencil className="size-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => publishContent(c)}
                                      disabled={c.status === "published" || c.status === "archived"}
                                      className="text-emerald-700"
                                    >
                                      <Send className="size-4 mr-2" /> Publish
                                    </DropdownMenuItem>
                                  </>
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

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit content" : "Create content"}</DialogTitle>
            <DialogDescription>
              Content keys are dot-namespaced (e.g. <code>consumer.onboarding.welcome</code>).
              The appropriate Faya app fetches the latest published version on launch.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="ck">Content key</Label>
                <Input
                  id="ck"
                  placeholder="consumer.onboarding.welcome"
                  value={form.contentKey}
                  onChange={(e) => setForm({ ...form, contentKey: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cv">Version</Label>
                <Input
                  id="cv"
                  placeholder="1.0"
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ct">Title</Label>
              <Input
                id="ct"
                placeholder="Welcome to Faya Pay"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>App</Label>
                <Select
                  value={form.app}
                  onValueChange={(v) => setForm({ ...form, app: v as AppContent["app"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(APP_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                    <SelectItem value="NG">NG · Nigeria</SelectItem>
                    <SelectItem value="GH">GH · Ghana</SelectItem>
                    <SelectItem value="KE">KE · Kenya</SelectItem>
                    <SelectItem value="ZA">ZA · South Africa</SelectItem>
                    <SelectItem value="EG">EG · Egypt</SelectItem>
                    <SelectItem value="MA">MA · Morocco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Language</Label>
                <Select
                  value={form.language}
                  onValueChange={(v) => setForm({ ...form, language: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cb">Body</Label>
              <Textarea
                id="cb"
                placeholder="Body text…"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">{form.body.length} characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitEditor} className="bg-emerald-600 hover:bg-emerald-700">
              {editing ? "Save changes" : "Create as draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View sheet */}
      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {viewing && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono text-sm">{viewing.contentKey}</SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">{APP_LABELS[viewing.app]}</Badge>
                  <Badge variant="outline" className="font-mono text-xs">v{viewing.version}</Badge>
                  <Badge variant="outline" className="font-mono text-xs">{viewing.language}</Badge>
                  {viewing.countryCode ? (
                    <Badge variant="outline" className="font-mono text-xs">{viewing.countryCode}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <Globe2 className="size-3 mr-1" /> Global
                    </Badge>
                  )}
                  <Badge variant="secondary" className={`text-xs ${STATUS_STYLES[viewing.status].className}`}>
                    {STATUS_STYLES[viewing.status].label}
                  </Badge>
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6 space-y-4">
                <div>
                  <div className="text-lg font-semibold">{viewing.title}</div>
                </div>
                <div className="rounded-lg border bg-slate-50 dark:bg-slate-900 p-4 text-sm whitespace-pre-wrap">
                  {viewing.body}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>
                    <span className="uppercase tracking-wide">Created by</span>
                    <div className="font-mono">{viewing.createdBy}</div>
                  </div>
                  <div>
                    <span className="uppercase tracking-wide">Published</span>
                    <div>{formatDate(viewing.publishedAt)}</div>
                  </div>
                  <div>
                    <span className="uppercase tracking-wide">Updated</span>
                    <div>{timeAgo(viewing.updatedAt)}</div>
                  </div>
                  <div>
                    <span className="uppercase tracking-wide">Created</span>
                    <div>{formatDate(viewing.createdAt)}</div>
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(viewing)}>
                      <Pencil className="size-4 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => publishContent(viewing)}
                      disabled={viewing.status === "published" || viewing.status === "archived"}
                      className="text-emerald-700"
                    >
                      <Send className="size-4 mr-1" /> Publish
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}
