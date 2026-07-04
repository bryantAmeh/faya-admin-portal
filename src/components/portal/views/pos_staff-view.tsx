"use client";

/**
 * POS Staff — §4
 *
 * Merchant cashiers operating terminals or SoftPOS phones on the Faya POS app.
 * The Admin Portal manages POS staff PIN resets, suspensions, device assignments,
 * and force-logouts. The Faya POS app reads from the same Firestore collection.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ScanLine,
  Search,
  Filter,
  Building2,
  Smartphone,
  KeyRound,
  Ban,
  LogOut,
  MoreHorizontal,
  X,
  Users,
  CheckCircle2,
  AlertCircle,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
import {
  getVisibleCountries,
  getVisibleCountryCodes,
  getScopeLabel,
  isGlobalScope,
} from "@/lib/access-scope";
import { formatNumber, timeAgo } from "@/lib/formatters";
import type { PosStaff, CountryConfig } from "@/lib/types";

const STATUS_STYLES: Record<PosStaff["status"], { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  removed: { label: "Removed", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const ROLE_STYLES: Record<PosStaff["role"], { label: string; className: string }> = {
  cashier: { label: "Cashier", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  supervisor: { label: "Supervisor", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  branch_manager: { label: "Branch Manager", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
};

export function PosStaffView() {
  const { staff: currentStaff } = useAuth();

  // Subscriptions: POS staff + countries (for scoping)
  const [items, setItems] = useState<PosStaff[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);

  useEffect(() => adminData.subscribePosStaff(setItems), []);
  useEffect(() => adminData.subscribeCountries(setCountries), []);

  const visibleCodes = useMemo(
    () => getVisibleCountryCodes(currentStaff, countries),
    [currentStaff, countries],
  );
  const visibleCountries = useMemo(
    () => getVisibleCountries(currentStaff, countries),
    [currentStaff, countries],
  );

  // Filters
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Detail sheet
  const [selected, setSelected] = useState<PosStaff | null>(null);

  // Suspend dialog
  const [suspendTarget, setSuspendTarget] = useState<PosStaff | null>(null);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (!visibleCodes.has(p.countryCode)) return false;
      if (countryFilter !== "all" && p.countryCode !== countryFilter) return false;
      if (roleFilter !== "all" && p.role !== roleFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${p.staffCode} ${p.firstName} ${p.lastName} ${p.email} ${p.merchantName} ${p.branchName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, visibleCodes, countryFilter, roleFilter, statusFilter, search]);

  // KPIs
  const stats = useMemo(() => {
    const scoped = items.filter((p) => visibleCodes.has(p.countryCode));
    return {
      total: scoped.length,
      active: scoped.filter((p) => p.status === "active").length,
      suspended: scoped.filter((p) => p.status === "suspended").length,
      withDevice: scoped.filter((p) => p.deviceAssigned).length,
      txToday: scoped.reduce((sum, p) => sum + p.transactionsToday, 0),
    };
  }, [items, visibleCodes]);

  const hasActiveFilters =
    search !== "" || countryFilter !== "all" || roleFilter !== "all" || statusFilter !== "all";

  const actor = currentStaff
    ? {
        staffId: currentStaff.id,
        staffName: `${currentStaff.firstName} ${currentStaff.lastName}`,
        department: currentStaff.departmentId,
        role: currentStaff.roleId,
      }
    : null;

  function handleSuspend() {
    if (!suspendTarget || !actor) return;
    const was = suspendTarget.status;
    const next = was === "suspended" ? "active" : "suspended";
    adminData
      .updatePosStaff(suspendTarget.id, { status: next, updatedAt: Date.now() })
      .then(() => {
        logAudit(actor, next === "suspended" ? "pos_staff.suspend" : "pos_staff.reactivate", "pos_staff", suspendTarget.id, {
          countryCode: suspendTarget.countryCode,
          beforeValue: was,
          afterValue: next,
        });
        toast.success(
          next === "suspended"
            ? `Suspended ${suspendTarget.firstName} ${suspendTarget.lastName}`
            : `Reactivated ${suspendTarget.firstName} ${suspendTarget.lastName}`,
        );
        setSelected((prev) => (prev && prev.id === suspendTarget.id ? { ...prev, status: next } : prev));
      })
      .catch((e) => toast.error("Failed to update POS staff", { description: String(e) }));
    setSuspendTarget(null);
  }

  function handleResetPin(p: PosStaff) {
    if (!actor) return;
    logAudit(actor, "pos_staff.reset_pin", "pos_staff", p.id, {
      countryCode: p.countryCode,
      reason: "PIN reset requested by admin — staff must re-choose PIN on next login",
    });
    toast.success(`PIN reset`, {
      description: `${p.firstName} ${p.lastName} will be prompted to set a new PIN on next Faya POS login.`,
    });
  }

  function handleForceLogout(p: PosStaff) {
    if (!actor) return;
    logAudit(actor, "pos_staff.force_logout", "pos_staff", p.id, {
      countryCode: p.countryCode,
      reason: "Force logout issued — all active POS sessions terminated",
    });
    toast.success(`Force logout issued`, {
      description: `${p.firstName} ${p.lastName}'s active POS sessions have been terminated.`,
    });
  }

  function handleRemoveDevice(p: PosStaff) {
    if (!actor) return;
    if (!p.deviceAssigned) {
      toast.info("No device assigned", { description: "This POS staff has no device to remove." });
      return;
    }
    const before = p.deviceAssigned;
    adminData
      .updatePosStaff(p.id, { deviceAssigned: null, updatedAt: Date.now() })
      .then(() => {
        logAudit(actor, "pos_staff.remove_device", "pos_staff", p.id, {
          countryCode: p.countryCode,
          beforeValue: before,
          afterValue: "null",
        });
        toast.success("Device assignment removed", {
          description: `Terminal ${before} is now free to reassign.`,
        });
        setSelected((prev) => (prev && prev.id === p.id ? { ...prev, deviceAssigned: null } : prev));
      })
      .catch((e) => toast.error("Failed to remove device", { description: String(e) }));
  }

  return (
    <>
      <ViewHeader
        title="POS Staff"
        description={`Merchant cashiers using Faya POS · Your scope: ${getScopeLabel(currentStaff)}`}
        icon={ScanLine}
        actions={
          <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
            {filtered.length} of {stats.total} staff
          </Badge>
        }
      />
      <ViewContainer>
        {/* KPI strip */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <StatCard label="POS Staff" value={formatNumber(stats.total)} hint="in your scope" icon={Users} tone="default" />
          <StatCard label="Active" value={formatNumber(stats.active)} hint="currently signed in or recently" icon={CheckCircle2} tone="success" />
          <StatCard label="Suspended" value={formatNumber(stats.suspended)} icon={Ban} tone="danger" />
          <StatCard label="Devices Assigned" value={formatNumber(stats.withDevice)} hint="terminals paired" icon={Smartphone} tone="info" />
          <StatCard label="Tx Today" value={formatNumber(stats.txToday)} hint="across all active staff" icon={ScanLine} tone="success" />
        </div>

        {/* Filter card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Name, code, email, merchant, branch…"
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
              <div className="w-full sm:w-36">
                <Label className="text-xs text-muted-foreground">Role</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="branch_manager">Branch Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-36">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="removed">Removed</SelectItem>
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
                    setRoleFilter("all");
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

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="size-4 text-emerald-600" />
              POS Staff Directory
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Showing {filtered.length} of {stats.total}
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <EmptyState
                icon={ScanLine}
                title="No POS staff found"
                description="Try adjusting filters or check the Faya POS app for new staff sign-ups."
              />
            ) : (
              <div className="max-h-[70vh] overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 backdrop-blur">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Staff</th>
                      <th className="px-4 py-2.5 font-medium hidden md:table-cell">Merchant / Branch</th>
                      <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Country</th>
                      <th className="px-4 py-2.5 font-medium">Role</th>
                      <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Device</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium hidden lg:table-cell text-right">Tx Today</th>
                      <th className="px-4 py-2.5 font-medium hidden xl:table-cell">Last login</th>
                      <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const status = STATUS_STYLES[p.status];
                      const role = ROLE_STYLES[p.role];
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelected(p)}
                          className="border-t cursor-pointer hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10"
                        >
                          <td className="px-4 py-2.5">
                            <div className="font-medium truncate">
                              {p.firstName} {p.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{p.staffCode}</div>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            <div className="font-medium truncate">{p.merchantName}</div>
                            <div className="text-xs text-muted-foreground truncate">{p.branchName}</div>
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            <Badge variant="outline" className="font-mono text-xs">
                              {p.countryCode}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary" className={`text-xs ${role.className}`}>
                              {role.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell">
                            {p.deviceAssigned ? (
                              <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-700 dark:text-emerald-400">
                                <Smartphone className="size-3" />
                                {p.deviceAssigned}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary" className={`text-xs ${status.className}`}>
                              {status.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell text-right tabular-nums">
                            {p.transactionsToday}
                          </td>
                          <td className="px-4 py-2.5 hidden xl:table-cell text-xs text-muted-foreground">
                            {timeAgo(p.lastLoginAt)}
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
                                <DropdownMenuItem onClick={() => setSelected(p)}>
                                  <Users className="size-4 mr-2" /> View profile
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleResetPin(p)}
                                  disabled={p.status === "removed"}
                                >
                                  <KeyRound className="size-4 mr-2" /> Reset PIN
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleForceLogout(p)}
                                  disabled={p.status !== "active"}
                                >
                                  <LogOut className="size-4 mr-2" /> Force logout
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleRemoveDevice(p)}
                                  disabled={!p.deviceAssigned}
                                >
                                  <Smartphone className="size-4 mr-2" /> Remove device
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setSuspendTarget(p)}
                                  disabled={p.status === "removed"}
                                  className={p.status === "suspended" ? "text-emerald-700" : "text-red-700"}
                                >
                                  {p.status === "suspended" ? (
                                    <>
                                      <CheckCircle2 className="size-4 mr-2" /> Reactivate
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="size-4 mr-2" /> Suspend
                                    </>
                                  )}
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

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.firstName} {selected.lastName}
                </SheetTitle>
                <SheetDescription className="font-mono">{selected.staffCode}</SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <DetailItem label="Status" value={
                    <Badge variant="secondary" className={STATUS_STYLES[selected.status].className}>
                      {STATUS_STYLES[selected.status].label}
                    </Badge>
                  } />
                  <DetailItem label="Role" value={
                    <Badge variant="secondary" className={ROLE_STYLES[selected.role].className}>
                      {ROLE_STYLES[selected.role].label}
                    </Badge>
                  } />
                  <DetailItem label="Country" value={<span className="font-mono">{selected.countryCode}</span>} />
                  <DetailItem label="Email" value={<span className="truncate">{selected.email}</span>} />
                  <DetailItem label="Phone" value={selected.phone} />
                  <DetailItem label="Last login" value={timeAgo(selected.lastLoginAt)} />
                  <DetailItem label="Transactions today" value={formatNumber(selected.transactionsToday)} />
                  <DetailItem
                    label="Device assigned"
                    value={selected.deviceAssigned ? (
                      <span className="font-mono text-emerald-700 dark:text-emerald-400">{selected.deviceAssigned}</span>
                    ) : (
                      <span className="text-muted-foreground">No device</span>
                    )}
                  />
                </div>

                <div className="rounded-lg border bg-emerald-50/40 dark:bg-emerald-900/10 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <Building2 className="size-3" /> Merchant
                  </div>
                  <div className="font-medium text-sm">{selected.merchantName}</div>
                  <div className="text-xs text-muted-foreground">{selected.branchName} branch</div>
                  <div className="text-xs text-muted-foreground font-mono mt-1">{selected.merchantId}</div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800 p-3 flex gap-2">
                  <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-300">
                    PIN is stored as a one-way hash. Admins cannot view a cashier's PIN — they can only
                    trigger a reset, which forces the cashier to choose a new PIN on the next Faya POS login.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleResetPin(selected)}>
                    <KeyRound className="size-4 mr-1" /> Reset PIN
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleForceLogout(selected)} disabled={selected.status !== "active"}>
                    <LogOut className="size-4 mr-1" /> Force logout
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleRemoveDevice(selected)} disabled={!selected.deviceAssigned}>
                    <Smartphone className="size-4 mr-1" /> Remove device
                  </Button>
                  <Button
                    variant={selected.status === "suspended" ? "default" : "destructive"}
                    size="sm"
                    onClick={() => setSuspendTarget(selected)}
                    disabled={selected.status === "removed"}
                    className={selected.status === "suspended" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                  >
                    {selected.status === "suspended" ? (
                      <><CheckCircle2 className="size-4 mr-1" /> Reactivate</>
                    ) : (
                      <><Ban className="size-4 mr-1" /> Suspend</>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Suspend confirm */}
      <AlertDialog open={!!suspendTarget} onOpenChange={(o) => !o && setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendTarget?.status === "suspended" ? "Reactivate POS staff?" : "Suspend POS staff?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget?.status === "suspended"
                ? `${suspendTarget?.firstName} ${suspendTarget?.lastName} will be able to log in to Faya POS again.`
                : `${suspendTarget?.firstName} ${suspendTarget?.lastName} will be immediately signed out and unable to log in to Faya POS until reactivated.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspend}
              className={suspendTarget?.status === "suspended" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm mt-0.5">{value}</div>
    </div>
  );
}
