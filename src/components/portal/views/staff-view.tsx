"use client";

/**
 * Faya Admin Portal — Staff Management view (spec §6)
 *
 * Lists all admin staff with filters, search, create/edit dialog, row actions
 * (view / edit / suspend / unlock / reset MFA / force logout), and a detail
 * Sheet showing the full staff profile, country access and permissions.
 *
 * All mutations go through `adminData` and are logged via `logAudit`.
 */
import { useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  MoreHorizontal,
  Shield,
  ShieldOff,
  Lock,
  Unlock,
  Ban,
  LogOut,
  Search,
  Filter,
  Eye,
  Pencil,
  Mail,
  Phone,
  Building2,
  Calendar,
  KeyRound,
  Globe2,
  ScrollText,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ViewHeader, ViewContainer, StatCard, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
import { formatDateTime, formatDate, statusBadge, timeAgo } from "@/lib/formatters";
import type {
  AdminStaff,
  CountryConfig,
  Department,
  Role,
  StaffCountryAccess,
  StaffStatus,
} from "@/lib/types";

interface StaffViewProps {
  staff: AdminStaff[];
  departments: Department[];
  roles: Role[];
  countries: CountryConfig[];
}

const ACCESS_LEVELS: StaffCountryAccess["accessLevel"][] = ["view", "operate", "manage"];

const ACCESS_LEVEL_BADGE: Record<StaffCountryAccess["accessLevel"], string> = {
  view: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  operate: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  manage: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const SUPER_ADMIN_DEPT_ID = "dept_super_admin";

function initials(s: AdminStaff): string {
  return `${s.firstName?.[0] ?? ""}${s.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function fullName(s: AdminStaff): string {
  return `${s.firstName} ${s.lastName}`.trim();
}

function deptName(deptId: string, departments: Department[]): string {
  return departments.find((d) => d.id === deptId)?.name ?? "—";
}

function roleName(roleId: string, roles: Role[]): string {
  return roles.find((r) => r.id === roleId)?.name ?? "—";
}

function countryName(code: string, countries: CountryConfig[]): string {
  return countries.find((c) => c.countryCode === code)?.countryName ?? code;
}

function isSuperAdmin(s: AdminStaff | null): boolean {
  return !!s && s.departmentId === SUPER_ADMIN_DEPT_ID;
}

/** Empty form state used for "Create Staff". */
function emptyStaffForm(): StaffFormState {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    departmentId: "",
    roleId: "",
    mfaEnabled: true,
    notes: "",
    countries: [],
  };
}

interface StaffFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  roleId: string;
  mfaEnabled: boolean;
  notes: string;
  countries: StaffCountryAccess[];
}

export function StaffView({ staff, departments, roles, countries }: StaffViewProps) {
  const { staff: currentStaff } = useAuth();

  /* ---------------------------- filter state ---------------------------- */
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMfa, setFilterMfa] = useState<string>("all");

  /* --------------------------- dialog state ----------------------------- */
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminStaff | null>(null);
  const [form, setForm] = useState<StaffFormState>(emptyStaffForm());
  const [saving, setSaving] = useState(false);

  /* --------------------------- detail sheet ----------------------------- */
  const [detailStaff, setDetailStaff] = useState<AdminStaff | null>(null);

  /* --------------------------- suspend dialog --------------------------- */
  const [suspendTarget, setSuspendTarget] = useState<AdminStaff | null>(null);
  const [suspending, setSuspending] = useState(false);

  const canCreate = isSuperAdmin(currentStaff);

  /* ----------------------------- derived -------------------------------- */
  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (q) {
        const hay = `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterDept !== "all" && s.departmentId !== filterDept) return false;
      if (filterRole !== "all" && s.roleId !== filterRole) return false;
      if (filterCountry !== "all" && !s.countries.some((c) => c.countryCode === filterCountry)) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      if (filterMfa === "on" && !s.mfaEnabled) return false;
      if (filterMfa === "off" && s.mfaEnabled) return false;
      return true;
    });
  }, [staff, search, filterDept, filterRole, filterCountry, filterStatus, filterMfa]);

  const rolesForDept = useMemo(
    () => roles.filter((r) => r.departmentId === form.departmentId),
    [roles, form.departmentId],
  );

  const stats = useMemo(() => {
    const total = staff.length;
    const active = staff.filter((s) => s.status === "active").length;
    const suspended = staff.filter((s) => s.status === "suspended").length;
    const locked = staff.filter((s) => s.status === "locked").length;
    const invited = staff.filter((s) => s.status === "invited").length;
    const mfaOn = staff.filter((s) => s.mfaEnabled).length;
    return {
      total,
      active,
      suspended,
      locked,
      invited,
      mfaPct: total > 0 ? Math.round((mfaOn / total) * 100) : 0,
    };
  }, [staff]);

  /* ----------------------------- handlers ------------------------------- */
  function openCreate() {
    setEditing(null);
    setForm(emptyStaffForm());
    setFormOpen(true);
  }

  function openEdit(s: AdminStaff) {
    setEditing(s);
    setForm({
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      phone: s.phone,
      departmentId: s.departmentId,
      roleId: s.roleId,
      mfaEnabled: s.mfaEnabled,
      notes: s.notes ?? "",
      countries: s.countries.map((c) => ({ ...c })),
    });
    setFormOpen(true);
  }

  function onDeptChange(deptId: string) {
    // Reset role if it doesn't belong to the new dept
    const stillValid = roles.some((r) => r.id === form.roleId && r.departmentId === deptId);
    setForm((f) => ({ ...f, departmentId: deptId, roleId: stillValid ? f.roleId : "" }));
  }

  function toggleCountry(code: string, checked: boolean) {
    setForm((f) => {
      const exists = f.countries.find((c) => c.countryCode === code);
      if (checked && !exists) {
        return { ...f, countries: [...f.countries, { countryCode: code, accessLevel: "view" }] };
      }
      if (!checked && exists) {
        return { ...f, countries: f.countries.filter((c) => c.countryCode !== code) };
      }
      return f;
    });
  }

  function setCountryAccess(code: string, level: StaffCountryAccess["accessLevel"]) {
    setForm((f) => ({
      ...f,
      countries: f.countries.map((c) => (c.countryCode === code ? { ...c, accessLevel: level } : c)),
    }));
  }

  function validate(): string | null {
    if (!form.firstName.trim()) return "First name is required";
    if (!form.lastName.trim()) return "Last name is required";
    if (!form.email.trim()) return "Email is required";
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    if (!emailOk) return "Enter a valid email address";
    // email uniqueness
    const duplicate = staff.find(
      (s) => s.email.toLowerCase() === form.email.trim().toLowerCase() && s.id !== editing?.id,
    );
    if (duplicate) return `Email already used by ${duplicate.firstName} ${duplicate.lastName}`;
    if (!form.departmentId) return "Department is required";
    if (!form.roleId) return "Role is required";
    // country access — Super Admin dept may have zero
    if (form.departmentId !== SUPER_ADMIN_DEPT_ID && form.countries.length === 0) {
      return "Assign at least one country (or pick the Super Admin department for global access)";
    }
    return null;
  }

  async function onSave() {
    if (!currentStaff) return;
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const dept = departments.find((d) => d.id === form.departmentId);
      const role = roles.find((r) => r.id === form.roleId);
      const actor = {
        staffId: currentStaff.id,
        staffName: fullName(currentStaff),
        department: deptName(currentStaff.departmentId, departments),
        role: roleName(currentStaff.roleId, roles),
      };

      if (editing) {
        const after: AdminStaff = {
          ...editing,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          departmentId: form.departmentId,
          roleId: form.roleId,
          mfaEnabled: form.mfaEnabled,
          notes: form.notes.trim(),
          countries: form.countries,
          updatedAt: Date.now(),
        };
        await adminData.updateStaff(editing.id, {
          firstName: after.firstName,
          lastName: after.lastName,
          email: after.email,
          phone: after.phone,
          departmentId: after.departmentId,
          roleId: after.roleId,
          mfaEnabled: after.mfaEnabled,
          notes: after.notes,
          countries: after.countries,
          updatedAt: after.updatedAt,
        });
        logAudit(actor, "staff.update", "staff", editing.id, {
          afterValue: `${after.firstName} ${after.lastName} · ${dept?.name ?? "?"} · ${role?.name ?? "?"}`,
        });
        toast.success(`Updated ${after.firstName} ${after.lastName}`);
        setFormOpen(false);
      } else {
        const now = Date.now();
        const newStaff: AdminStaff = {
          id: `staff_${now}`,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          departmentId: form.departmentId,
          roleId: form.roleId,
          managerId: null,
          status: "invited",
          mfaEnabled: form.mfaEnabled,
          countries: form.countries,
          permissions: [],
          lastLoginAt: null,
          failedLoginCount: 0,
          createdBy: currentStaff.id,
          createdAt: now,
          updatedAt: now,
          notes: form.notes.trim(),
        };
        await adminData.createStaff(newStaff);
        logAudit(actor, "staff.create", "staff", newStaff.id, {
          afterValue: `${newStaff.firstName} ${newStaff.lastName} · ${dept?.name ?? "?"} · ${role?.name ?? "?"} · ${newStaff.email}`,
        });
        toast.success(`Invited ${newStaff.firstName} ${newStaff.lastName}`);
        setFormOpen(false);
      }
    } catch (e) {
      console.error("[StaffView.save]", e);
      toast.error(e instanceof Error ? e.message : "Failed to save staff");
    } finally {
      setSaving(false);
    }
  }

  async function onSuspendConfirm() {
    if (!currentStaff || !suspendTarget) return;
    setSuspending(true);
    try {
      await adminData.updateStaff(suspendTarget.id, { status: "suspended", updatedAt: Date.now() });
      logAudit(
        {
          staffId: currentStaff.id,
          staffName: fullName(currentStaff),
          department: deptName(currentStaff.departmentId, departments),
          role: roleName(currentStaff.roleId, roles),
        },
        "staff.suspend",
        "staff",
        suspendTarget.id,
        {
          beforeValue: suspendTarget.status,
          afterValue: "suspended",
          reason: "Manual suspension by admin",
        },
      );
      toast.success(`${suspendTarget.firstName} ${suspendTarget.lastName} suspended`);
      setSuspendTarget(null);
    } catch (e) {
      console.error("[StaffView.suspend]", e);
      toast.error("Failed to suspend staff");
    } finally {
      setSuspending(false);
    }
  }

  async function onUnlock(s: AdminStaff) {
    if (!currentStaff) return;
    try {
      await adminData.updateStaff(s.id, { status: "active", failedLoginCount: 0, updatedAt: Date.now() });
      logAudit(
        {
          staffId: currentStaff.id,
          staffName: fullName(currentStaff),
          department: deptName(currentStaff.departmentId, departments),
          role: roleName(currentStaff.roleId, roles),
        },
        "staff.unlock",
        "staff",
        s.id,
        { beforeValue: s.status, afterValue: "active" },
      );
      toast.success(`Unlocked ${s.firstName} ${s.lastName}`);
    } catch (e) {
      console.error("[StaffView.unlock]", e);
      toast.error("Failed to unlock staff");
    }
  }

  async function onResetMfa(s: AdminStaff) {
    if (!currentStaff) return;
    try {
      await adminData.updateStaff(s.id, { mfaEnabled: false, updatedAt: Date.now() });
      logAudit(
        {
          staffId: currentStaff.id,
          staffName: fullName(currentStaff),
          department: deptName(currentStaff.departmentId, departments),
          role: roleName(currentStaff.roleId, roles),
        },
        "staff.mfa_reset",
        "staff",
        s.id,
        { beforeValue: String(s.mfaEnabled), afterValue: "false" },
      );
      toast.success(`MFA reset for ${s.firstName} ${s.lastName}. They must re-enroll at next login.`);
    } catch (e) {
      console.error("[StaffView.resetMfa]", e);
      toast.error("Failed to reset MFA");
    }
  }

  function onForceLogout(s: AdminStaff) {
    // Demo only — no real session store.
    toast.message(`Force-logout signal sent to ${s.firstName} ${s.lastName}`, {
      description: "Active sessions will be invalidated on next request (demo only).",
    });
  }

  function clearFilters() {
    setSearch("");
    setFilterDept("all");
    setFilterRole("all");
    setFilterCountry("all");
    setFilterStatus("all");
    setFilterMfa("all");
  }

  const hasActiveFilters =
    search !== "" ||
    filterDept !== "all" ||
    filterRole !== "all" ||
    filterCountry !== "all" ||
    filterStatus !== "all" ||
    filterMfa !== "all";

  /* ------------------------------ render -------------------------------- */
  return (
    <>
      <ViewHeader
        title="Staff & Roles"
        description="Manage admin accounts, departments, country access, and MFA."
        icon={Users}
        actions={
          canCreate ? (
            <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <UserPlus className="size-4" /> Create Staff
            </Button>
          ) : null
        }
      />
      <ViewContainer>
        {/* Stat row */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard label="Total Staff" value={stats.total} hint={`${stats.invited} invited`} icon={Users} />
          <StatCard label="Active" value={stats.active} hint={`${stats.locked} locked · ${stats.suspended} suspended`} icon={Unlock} tone="success" />
          <StatCard label="Suspended" value={stats.suspended} icon={Ban} tone="danger" />
          <StatCard label="MFA Coverage" value={`${stats.mfaPct}%`} hint="of all staff" icon={Shield} tone={stats.mfaPct >= 90 ? "success" : "warning"} />
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="size-4 text-emerald-600" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
              <Select value={filterDept} onValueChange={setFilterDept}>
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCountry} onValueChange={setFilterCountry}>
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All countries</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.countryCode}>{c.countryCode} — {c.countryName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                  <SelectItem value="removed">Removed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterMfa} onValueChange={setFilterMfa}>
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue placeholder="MFA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">MFA: any</SelectItem>
                  <SelectItem value="on">MFA: enabled</SelectItem>
                  <SelectItem value="off">MFA: disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Showing {filteredStaff.length} of {staff.length} staff
                </p>
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
                  <X className="size-3 mr-1" /> Clear filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Staff table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="size-4 text-emerald-600" /> Staff directory
              </span>
              <span className="text-xs text-muted-foreground font-normal">{filteredStaff.length} records</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredStaff.length === 0 ? (
              <EmptyState
                icon={Users}
                title={hasActiveFilters ? "No staff match these filters" : "No staff yet"}
                description={hasActiveFilters ? "Try clearing filters or refining search." : "Create your first admin staff to get started."}
              />
            ) : (
              <div className="max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                    <TableRow>
                      <TableHead className="pl-4">Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Countries</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>MFA</TableHead>
                      <TableHead className="hidden lg:table-cell">Last login</TableHead>
                      <TableHead className="hidden lg:table-cell">Created</TableHead>
                      <TableHead className="text-right pr-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((s) => {
                      const status = statusBadge("staff", s.status);
                      return (
                        <TableRow
                          key={s.id}
                          className="cursor-pointer"
                          onClick={() => setDetailStaff(s)}
                        >
                          <TableCell className="pl-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="size-8">
                                <AvatarFallback className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold dark:bg-emerald-900/40 dark:text-emerald-300">
                                  {initials(s)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="font-medium truncate">{fullName(s)}</div>
                                <div className="text-xs text-muted-foreground font-mono truncate">{s.id}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                          <TableCell>
                            <span className="text-sm">{deptName(s.departmentId, departments)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{roleName(s.roleId, roles)}</span>
                          </TableCell>
                          <TableCell>
                            {s.countries.length === 0 ? (
                              <span className="text-xs text-muted-foreground">Global</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 max-w-[160px]">
                                {s.countries.slice(0, 3).map((c) => (
                                  <Badge key={c.countryCode} variant="outline" className="text-[10px] px-1.5 py-0">
                                    {c.countryCode}
                                  </Badge>
                                ))}
                                {s.countries.length > 3 && (
                                  <span className="text-[10px] text-muted-foreground">+{s.countries.length - 3}</span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={status.className}>{status.label}</Badge>
                          </TableCell>
                          <TableCell>
                            {s.mfaEnabled ? (
                              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700">
                                <Shield className="size-3" /> On
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
                                <ShieldOff className="size-3" /> Off
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {s.lastLoginAt ? (
                              <span title={formatDateTime(s.lastLoginAt)}>{timeAgo(s.lastLoginAt)}</span>
                            ) : (
                              <span>Never</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {formatDate(s.createdAt)}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Actions for ${fullName(s)}`}
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuLabel>{fullName(s)}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setDetailStaff(s)}>
                                  <Eye className="size-4" /> View profile
                                </DropdownMenuItem>
                                {canCreate && (
                                  <DropdownMenuItem onClick={() => openEdit(s)}>
                                    <Pencil className="size-4" /> Edit
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {s.status !== "suspended" && s.status !== "removed" && (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setSuspendTarget(s)}
                                    disabled={!canCreate}
                                  >
                                    <Ban className="size-4" /> Suspend
                                  </DropdownMenuItem>
                                )}
                                {(s.status === "locked" || s.status === "suspended") && (
                                  <DropdownMenuItem onClick={() => onUnlock(s)} disabled={!canCreate}>
                                    <Unlock className="size-4" /> Unlock
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => onResetMfa(s)} disabled={!canCreate}>
                                  <KeyRound className="size-4" /> Reset MFA
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onForceLogout(s)}>
                                  <LogOut className="size-4" /> Force logout
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </ViewContainer>

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => !saving && setFormOpen(o)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Staff" : "Create Staff"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update profile, department, role, country access and MFA."
                : "Provision a new admin account. The new staff will receive an invitation email."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {/* Name */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name <span className="text-destructive">*</span></Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  placeholder="Amara"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name <span className="text-destructive">*</span></Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  placeholder="Okafor"
                />
              </div>
            </div>

            {/* Contact */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="amara.okafor@faya.admin"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+234 800 000 0000"
                />
              </div>
            </div>

            {/* Dept + role */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="department">Department <span className="text-destructive">*</span></Label>
                <Select value={form.departmentId} onValueChange={onDeptChange}>
                  <SelectTrigger id="department" className="w-full">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Role <span className="text-destructive">*</span></Label>
                <Select value={form.roleId} onValueChange={(v) => setForm((f) => ({ ...f, roleId: v }))} disabled={!form.departmentId}>
                  <SelectTrigger id="role" className="w-full">
                    <SelectValue placeholder={form.departmentId ? "Select role" : "Pick a department first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {rolesForDept.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Country access */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Country access</Label>
                <span className="text-xs text-muted-foreground">
                  {form.departmentId === SUPER_ADMIN_DEPT_ID
                    ? "Super Admin — global access, no country selection required"
                    : `Select at least 1 country · ${form.countries.length} selected`}
                </span>
              </div>
              <div className="rounded-md border max-h-52 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                {countries.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No countries configured.</div>
                ) : (
                  <ul className="divide-y">
                    {countries.map((c) => {
                      const selected = form.countries.find((x) => x.countryCode === c.countryCode);
                      const isSel = !!selected;
                      return (
                        <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                          <Checkbox
                            checked={isSel}
                            onCheckedChange={(v) => toggleCountry(c.countryCode, v === true)}
                            id={`cntry-${c.countryCode}`}
                          />
                          <Label htmlFor={`cntry-${c.countryCode}`} className="flex-1 cursor-pointer text-sm font-normal">
                            <span className="font-medium">{c.countryCode}</span>
                            <span className="text-muted-foreground"> — {c.countryName}</span>
                          </Label>
                          {isSel && (
                            <Select
                              value={selected!.accessLevel}
                              onValueChange={(v) => setCountryAccess(c.countryCode, v as StaffCountryAccess["accessLevel"])}
                            >
                              <SelectTrigger size="sm" className="w-28 h-7">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACCESS_LEVELS.map((lv) => (
                                  <SelectItem key={lv} value={lv} className="capitalize">{lv}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* MFA + notes */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="mfa" className="text-sm">Require MFA</Label>
                  <p className="text-xs text-muted-foreground">Enforce 2-factor on next sign-in</p>
                </div>
                <Switch
                  id="mfa"
                  checked={form.mfaEnabled}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, mfaEnabled: v }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional internal notes (only visible to admins)"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Create & invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend confirmation */}
      <AlertDialog open={!!suspendTarget} onOpenChange={(o) => !suspending && !o && setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {suspendTarget ? fullName(suspendTarget) : "staff"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This staff member will immediately lose portal access. They can be reactivated later via the
              "Unlock" action. The action is recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={suspending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onSuspendConfirm}
              disabled={suspending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {suspending ? "Suspending…" : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Sheet */}
      <Sheet open={!!detailStaff} onOpenChange={(o) => !o && setDetailStaff(null)}>
        <SheetContent side="right" className="sm:max-w-md w-full overflow-y-auto">
          {detailStaff && (
            <StaffDetail
              staff={detailStaff}
              departments={departments}
              roles={roles}
              countries={countries}
              onEdit={canCreate ? () => {
                const s = detailStaff;
                setDetailStaff(null);
                openEdit(s);
              } : undefined}
              onAuditHistory={() => {
                toast.message("Audit history", {
                  description: `Open the Audit Logs view and filter by staff ID ${detailStaff.id}.`,
                });
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/* --------------------------- Detail Sheet panel -------------------------- */

interface StaffDetailProps {
  staff: AdminStaff;
  departments: Department[];
  roles: Role[];
  countries: CountryConfig[];
  onEdit?: () => void;
  onAuditHistory: () => void;
}

function StaffDetail({
  staff: s,
  departments,
  roles,
  countries,
  onEdit,
  onAuditHistory,
}: StaffDetailProps) {
  const status = statusBadge("staff", s.status);
  return (
    <>
      <SheetHeader>
        <div className="flex items-start gap-3 pr-6">
          <Avatar className="size-12">
            <AvatarFallback className="bg-emerald-100 text-emerald-800 text-sm font-semibold dark:bg-emerald-900/40 dark:text-emerald-300">
              {initials(s)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <SheetTitle className="truncate">{fullName(s)}</SheetTitle>
            <SheetDescription className="truncate">{s.email}</SheetDescription>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="secondary" className={status.className}>{status.label}</Badge>
              {s.mfaEnabled ? (
                <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700">
                  <Shield className="size-3" /> MFA on
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
                  <ShieldOff className="size-3" /> MFA off
                </Badge>
              )}
            </div>
          </div>
        </div>
      </SheetHeader>

      <div className="px-4 pb-4 space-y-4">
        {/* Identity */}
        <DetailSection title="Identity">
          <DetailRow icon={Users} label="Staff ID" value={<span className="font-mono text-xs">{s.id}</span>} />
          <DetailRow icon={Mail} label="Email" value={s.email} />
          <DetailRow icon={Phone} label="Phone" value={s.phone || "—"} />
          <DetailRow icon={Building2} label="Department" value={deptName(s.departmentId, departments)} />
          <DetailRow icon={KeyRound} label="Role" value={roleName(s.roleId, roles)} />
          <DetailRow
            icon={Calendar}
            label="Created"
            value={formatDateTime(s.createdAt)}
          />
          <DetailRow
            icon={Calendar}
            label="Last login"
            value={s.lastLoginAt ? `${formatDateTime(s.lastLoginAt)} (${timeAgo(s.lastLoginAt)})` : "Never"}
          />
          <DetailRow
            icon={Lock}
            label="Failed logins"
            value={String(s.failedLoginCount)}
          />
          <DetailRow
            icon={Users}
            label="Created by"
            value={<span className="font-mono text-xs">{s.createdBy}</span>}
          />
        </DetailSection>

        {/* Country access */}
        <DetailSection title={`Country access (${s.countries.length})`}>
          {s.countries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Global access (Super Admin department).</p>
          ) : (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
              {s.countries.map((c) => (
                <li key={c.countryCode} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{c.countryCode}</div>
                    <div className="text-xs text-muted-foreground truncate">{countryName(c.countryCode, countries)}</div>
                  </div>
                  <Badge variant="secondary" className={`capitalize text-[10px] ${ACCESS_LEVEL_BADGE[c.accessLevel]}`}>
                    {c.accessLevel}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </DetailSection>

        {/* Permissions */}
        <DetailSection title={`Permissions (${s.permissions.length})`}>
          {s.permissions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No explicit permission keys assigned.</p>
          ) : (
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1">
              {s.permissions.map((p) => (
                <Badge key={p} variant="outline" className="text-[10px] font-mono">
                  {p}
                </Badge>
              ))}
            </div>
          )}
        </DetailSection>

        {/* Notes */}
        {s.notes && (
          <DetailSection title="Notes">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.notes}</p>
          </DetailSection>
        )}

        <Separator />

        <div className="flex flex-col gap-2">
          {onEdit && (
            <Button onClick={onEdit} variant="outline" className="w-full">
              <Pencil className="size-4" /> Edit profile
            </Button>
          )}
          <Button onClick={onAuditHistory} variant="ghost" className="w-full text-emerald-700">
            <ScrollText className="size-4" /> View audit history
          </Button>
        </div>
      </div>
    </>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <Globe2 className="size-3 text-emerald-600" /> {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-foreground break-words">{value}</div>
      </div>
    </div>
  );
}

/* Re-exported so the unused-import linter doesn't strip StaffStatus — kept for
   callers that may want to type narrow statuses. */
export type { StaffStatus };
