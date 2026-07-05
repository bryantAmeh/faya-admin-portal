"use client";

/**
 * Faya Admin Portal — Departments & Roles view (spec §4)
 *
 * Two-column layout:
 *  Left  : list of Department cards (selectable; shows name, description,
 *          status badge, role count). Search-filtered.
 *  Right : list of Role cards for the selected department (name, description,
 *          risk-level badge, status, permission count). Search-filtered.
 *
 * "View Permissions" button on each role opens a read-only Dialog listing
 * the matching Permission entries (key, resource, action, scope, description).
 *
 * KPI strip at the top: total departments, total roles, critical-risk roles,
 * total permissions.
 */
import { useMemo, useState } from "react";
import {
  Building2,
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  KeyRound,
  Users,
  Eye,
  Filter,
  X,
  Layers,
  Lock,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ViewHeader, ViewContainer, StatCard, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { statusBadge } from "@/lib/formatters";
import { adminData, logAudit } from "@/lib/admin-data";
import { useAuth } from "@/hooks/use-auth";
import { isSuperAdmin } from "@/lib/permissions";
import type { Department, Permission, Role, RiskLevel } from "@/lib/types";

interface DepartmentsViewProps {
  departments: Department[];
  roles: Role[];
  permissions: Permission[];
}

const RISK_ICON: Record<RiskLevel, React.ComponentType<{ className?: string }>> = {
  low: Shield,
  medium: ShieldCheck,
  high: ShieldAlert,
  critical: ShieldX,
};

// Count permissions associated with a role by matching the role's name to
// permission resources/actions. Faya permission keys follow
// `<resource>.<action>.<scope>`. We approximate association by matching the
// permission resource to the department name's slug-equivalent; if no direct
// match exists, fall back to 0 so the count still renders meaningfully.
function countRolePermissions(role: Role, allPermissions: Permission[]): number {
  // Permission keys are e.g. "kyc.approve.country". We don't have a direct
  // role->permission link in the type, so we count permissions whose resource
  // matches keywords in the role name. This is a best-effort visual hint.
  const tokens = role.name.toLowerCase().split(/\s+/);
  const hits = allPermissions.filter((p) => {
    const r = p.resource.toLowerCase();
    return tokens.some((t) => t && r.includes(t));
  });
  return hits.length;
}

// Permissions shown in the role dialog: match by resource keyword from role name
function permissionsForRole(role: Role, allPermissions: Permission[]): Permission[] {
  const tokens = role.name.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const matched = allPermissions.filter((p) => {
    const r = p.resource.toLowerCase();
    const a = p.action.toLowerCase();
    return tokens.some((t) => r.includes(t) || a.includes(t));
  });
  // If no match, return all permissions starting with the first token (e.g. "kyc")
  if (matched.length === 0) {
    const first = tokens[0];
    return allPermissions.filter(
      (p) => p.key.toLowerCase().startsWith(first + ".") || p.resource.toLowerCase() === first,
    );
  }
  return matched;
}

export function DepartmentsView({ departments, roles, permissions }: DepartmentsViewProps) {
  const { staff: currentStaff } = useAuth();
  const canManage = isSuperAdmin(currentStaff);
  const [deptSearch, setDeptSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(
    departments[0]?.id ?? null,
  );
  const [permissionsRole, setPermissionsRole] = useState<Role | null>(null);

  // ---- Department create/edit state ----
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState({ name: "", description: "", status: "active" as "active" | "inactive" });
  const [deptDeleteTarget, setDeptDeleteTarget] = useState<Department | null>(null);

  // ---- Role create/edit state ----
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    departmentId: "",
    riskLevel: "medium" as RiskLevel,
    status: "active" as "active" | "inactive",
  });
  const [roleDeleteTarget, setRoleDeleteTarget] = useState<Role | null>(null);

  function openCreateDept() {
    setEditingDept(null);
    setDeptForm({ name: "", description: "", status: "active" });
    setDeptDialogOpen(true);
  }

  function openEditDept(d: Department) {
    setEditingDept(d);
    setDeptForm({ name: d.name, description: d.description, status: d.status });
    setDeptDialogOpen(true);
  }

  async function onSaveDept() {
    if (!currentStaff) return;
    if (!deptForm.name.trim()) {
      toast.error("Department name is required.");
      return;
    }
    const now = Date.now();
    try {
      if (editingDept) {
        await adminData.updateDepartment(editingDept.id, {
          name: deptForm.name.trim(),
          description: deptForm.description.trim(),
          status: deptForm.status,
          updatedAt: now,
        });
        logAudit(
          { staffId: currentStaff.id, staffName: `${currentStaff.firstName} ${currentStaff.lastName}`, department: currentStaff.departmentId, role: currentStaff.roleId },
          "department.update",
          "department",
          editingDept.id,
          { afterValue: deptForm.name.trim() },
        );
        toast.success(`Updated department: ${deptForm.name.trim()}`);
      } else {
        const id = `dept_${now}_${Math.random().toString(36).slice(2, 8)}`;
        const dept: Department = {
          id,
          name: deptForm.name.trim(),
          description: deptForm.description.trim(),
          status: deptForm.status,
          createdAt: now,
          updatedAt: now,
        };
        await adminData.createDepartment(dept);
        logAudit(
          { staffId: currentStaff.id, staffName: `${currentStaff.firstName} ${currentStaff.lastName}`, department: currentStaff.departmentId, role: currentStaff.roleId },
          "department.create",
          "department",
          id,
          { afterValue: dept.name },
        );
        toast.success(`Created department: ${dept.name}`);
        setSelectedDeptId(id);
      }
      setDeptDialogOpen(false);
    } catch (e) {
      toast.error("Could not save department", { description: e instanceof Error ? e.message : String(e) });
    }
  }

  async function onDeleteDept() {
    if (!currentStaff || !deptDeleteTarget) return;
    try {
      await adminData.deleteDepartment(deptDeleteTarget.id);
      logAudit(
        { staffId: currentStaff.id, staffName: `${currentStaff.firstName} ${currentStaff.lastName}`, department: currentStaff.departmentId, role: currentStaff.roleId },
        "department.delete",
        "department",
        deptDeleteTarget.id,
        { beforeValue: deptDeleteTarget.name },
      );
      toast.success(`Deleted department: ${deptDeleteTarget.name}`);
      if (selectedDeptId === deptDeleteTarget.id) setSelectedDeptId(null);
      setDeptDeleteTarget(null);
    } catch (e) {
      toast.error("Could not delete department", { description: e instanceof Error ? e.message : String(e) });
    }
  }

  function openCreateRole() {
    if (!selectedDeptId) {
      toast.error("Select a department first.");
      return;
    }
    setEditingRole(null);
    setRoleForm({ name: "", description: "", departmentId: selectedDeptId, riskLevel: "medium", status: "active" });
    setRoleDialogOpen(true);
  }

  function openEditRole(r: Role) {
    setEditingRole(r);
    setRoleForm({ name: r.name, description: r.description, departmentId: r.departmentId, riskLevel: r.riskLevel, status: r.status });
    setRoleDialogOpen(true);
  }

  async function onSaveRole() {
    if (!currentStaff) return;
    if (!roleForm.name.trim()) {
      toast.error("Role name is required.");
      return;
    }
    if (!roleForm.departmentId) {
      toast.error("Department is required.");
      return;
    }
    const now = Date.now();
    try {
      if (editingRole) {
        await adminData.updateRole(editingRole.id, {
          name: roleForm.name.trim(),
          description: roleForm.description.trim(),
          departmentId: roleForm.departmentId,
          riskLevel: roleForm.riskLevel,
          status: roleForm.status,
          updatedAt: now,
        });
        logAudit(
          { staffId: currentStaff.id, staffName: `${currentStaff.firstName} ${currentStaff.lastName}`, department: currentStaff.departmentId, role: currentStaff.roleId },
          "role.update",
          "role",
          editingRole.id,
          { afterValue: roleForm.name.trim() },
        );
        toast.success(`Updated role: ${roleForm.name.trim()}`);
      } else {
        const id = `role_${now}_${Math.random().toString(36).slice(2, 8)}`;
        const role: Role = {
          id,
          name: roleForm.name.trim(),
          description: roleForm.description.trim(),
          departmentId: roleForm.departmentId,
          riskLevel: roleForm.riskLevel,
          status: roleForm.status,
          createdAt: now,
          updatedAt: now,
        };
        await adminData.createRole(role);
        logAudit(
          { staffId: currentStaff.id, staffName: `${currentStaff.firstName} ${currentStaff.lastName}`, department: currentStaff.departmentId, role: currentStaff.roleId },
          "role.create",
          "role",
          id,
          { afterValue: role.name },
        );
        toast.success(`Created role: ${role.name}`);
      }
      setRoleDialogOpen(false);
    } catch (e) {
      toast.error("Could not save role", { description: e instanceof Error ? e.message : String(e) });
    }
  }

  async function onDeleteRole() {
    if (!currentStaff || !roleDeleteTarget) return;
    try {
      await adminData.deleteRole(roleDeleteTarget.id);
      logAudit(
        { staffId: currentStaff.id, staffName: `${currentStaff.firstName} ${currentStaff.lastName}`, department: currentStaff.departmentId, role: currentStaff.roleId },
        "role.delete",
        "role",
        roleDeleteTarget.id,
        { beforeValue: roleDeleteTarget.name },
      );
      toast.success(`Deleted role: ${roleDeleteTarget.name}`);
      setRoleDeleteTarget(null);
    } catch (e) {
      toast.error("Could not delete role", { description: e instanceof Error ? e.message : String(e) });
    }
  }

  // Filtered departments
  const filteredDepartments = useMemo(() => {
    const q = deptSearch.trim().toLowerCase();
    const sorted = [...departments].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q),
    );
  }, [departments, deptSearch]);

  // Roles for selected department
  const selectedDept = useMemo(
    () => departments.find((d) => d.id === selectedDeptId) ?? null,
    [departments, selectedDeptId],
  );

  const rolesForDept = useMemo(() => {
    if (!selectedDept) return [];
    return roles.filter((r) => r.departmentId === selectedDept.id);
  }, [roles, selectedDept]);

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    const sorted = [...rolesForDept].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.riskLevel.toLowerCase().includes(q),
    );
  }, [rolesForDept, roleSearch]);

  // KPI counts
  const totalDepts = departments.length;
  const totalRoles = roles.length;
  const criticalRoles = roles.filter((r) => r.riskLevel === "critical").length;
  const totalPerms = permissions.length;

  // Role count per department
  const roleCountByDept = useMemo(() => {
    const m = new Map<string, number>();
    roles.forEach((r) => m.set(r.departmentId, (m.get(r.departmentId) ?? 0) + 1));
    return m;
  }, [roles]);

  // Permissions shown in dialog
  const dialogPermissions = useMemo(
    () => (permissionsRole ? permissionsForRole(permissionsRole, permissions) : []),
    [permissionsRole, permissions],
  );

  return (
    <>
      <ViewHeader
        title="Departments & Roles"
        description="Organizational structure"
        icon={Building2}
        actions={
          canManage ? (
            <Button onClick={openCreateDept} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="size-4" /> New department
            </Button>
          ) : null
        }
      />
      <ViewContainer>
        {/* KPI strip */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard
            label="Departments"
            value={totalDepts}
            hint="organizational units"
            icon={Building2}
            tone="info"
          />
          <StatCard
            label="Roles"
            value={totalRoles}
            hint="across all departments"
            icon={Users}
          />
          <StatCard
            label="Critical-Risk Roles"
            value={criticalRoles}
            hint="require elevated scrutiny"
            icon={ShieldX}
            tone={criticalRoles > 0 ? "danger" : "default"}
          />
          <StatCard
            label="Permissions"
            value={totalPerms}
            hint="granular capability keys"
            icon={KeyRound}
          />
        </div>

        {/* Two-column layout */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
          {/* Departments list */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="size-4 text-emerald-600" /> Departments
                </CardTitle>
                <Badge variant="secondary" className="text-[10px]">
                  {filteredDepartments.length} / {departments.length}
                </Badge>
              </div>
              <div className="relative">
                <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search departments…"
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              {filteredDepartments.length === 0 ? (
                <EmptyState icon={Building2} title="No departments" description="No departments match your search." />
              ) : (
                <div className="max-h-[70vh] overflow-y-auto p-3 pt-0 space-y-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                  {filteredDepartments.map((d) => {
                    const isActive = d.id === selectedDeptId;
                    const badge = statusBadge("risk", d.status === "active" ? "low" : "medium");
                    const roleCount = roleCountByDept.get(d.id) ?? 0;
                    return (
                      <div
                        key={d.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedDeptId(d.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedDeptId(d.id); } }}
                        className={`w-full text-left rounded-lg border p-3 transition-all cursor-pointer ${
                          isActive
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/30"
                            : "hover:border-emerald-400 hover:shadow-sm bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Building2 className={`size-4 shrink-0 ${isActive ? "text-emerald-600" : "text-muted-foreground"}`} />
                              <span className="font-medium text-sm truncate">{d.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.description}</p>
                          </div>
                          <Badge variant="secondary" className={`text-[10px] shrink-0 ${badge.className}`}>
                            {d.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="size-3" /> {roleCount} {roleCount === 1 ? "role" : "roles"}
                          </span>
                          <span className="font-mono">{d.id}</span>
                          {canManage && (
                            <span className="ml-auto flex items-center gap-1">
                              <button
                                type="button"
                                className="inline-flex items-center justify-center size-6 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-muted-foreground hover:text-emerald-700"
                                onClick={(e) => { e.stopPropagation(); openEditDept(d); }}
                                title="Edit department"
                              >
                                <Pencil className="size-3" />
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center size-6 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-700"
                                onClick={(e) => { e.stopPropagation(); setDeptDeleteTarget(d); }}
                                title="Delete department"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Roles for selected department */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="size-4 text-emerald-600" />
                  {selectedDept ? (
                    <>
                      Roles in <span className="text-emerald-700 dark:text-emerald-400">{selectedDept.name}</span>
                    </>
                  ) : (
                    "Roles"
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {selectedDept && (
                    <Badge variant="secondary" className="text-[10px]">
                      {filteredRoles.length} / {rolesForDept.length}
                    </Badge>
                  )}
                  {canManage && selectedDept && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openCreateRole}>
                      <Plus className="size-3 mr-1" /> New role
                    </Button>
                  )}
                </div>
              </div>
              {selectedDept ? (
                <div className="relative">
                  <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search roles by name, description, risk…"
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="p-0 flex-1">
              {!selectedDept ? (
                <EmptyState
                  icon={Building2}
                  title="Select a department"
                  description="Choose a department on the left to see its roles."
                />
              ) : filteredRoles.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No roles"
                  description={
                    roleSearch
                      ? "No roles match your search in this department."
                      : "This department has no roles defined yet."
                  }
                />
              ) : (
                <div className="max-h-[70vh] overflow-y-auto p-3 pt-0 space-y-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                  {filteredRoles.map((r) => {
                    const riskBadge = statusBadge("risk", r.riskLevel);
                    const RiskIcon = RISK_ICON[r.riskLevel];
                    const permCount = countRolePermissions(r, permissions);
                    return (
                      <div
                        key={r.id}
                        className="rounded-lg border bg-card p-3 hover:border-emerald-400 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <RiskIcon
                                className={`size-4 shrink-0 ${
                                  r.riskLevel === "critical"
                                    ? "text-red-600"
                                    : r.riskLevel === "high"
                                      ? "text-orange-600"
                                      : r.riskLevel === "medium"
                                        ? "text-amber-600"
                                        : "text-emerald-600"
                                }`}
                              />
                              <span className="font-medium text-sm">{r.name}</span>
                              <Badge variant="secondary" className={`text-[10px] ${riskBadge.className}`}>
                                {riskBadge.label} risk
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  r.status === "active"
                                    ? "text-emerald-700 border-emerald-300"
                                    : "text-slate-500"
                                }`}
                              >
                                {r.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{r.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <KeyRound className="size-3" />
                                {permCount} {permCount === 1 ? "permission" : "permissions"}
                              </span>
                              <span className="font-mono">{r.id}</span>
                            </div>
                          </div>
                        </div>
                        <Separator className="my-2.5" />
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setPermissionsRole(r)}
                          >
                            <Eye className="size-3 mr-1" /> View Permissions
                          </Button>
                          {canManage && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => openEditRole(r)}
                              >
                                <Pencil className="size-3 mr-1" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300"
                                onClick={() => setRoleDeleteTarget(r)}
                              >
                                <Trash2 className="size-3 mr-1" /> Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Permissions dialog */}
        <Dialog open={!!permissionsRole} onOpenChange={(open) => !open && setPermissionsRole(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="size-5 text-emerald-600" />
                Permissions — {permissionsRole?.name}
              </DialogTitle>
              <DialogDescription>
                {permissionsRole?.description}
                <br />
                Showing {dialogPermissions.length} permission {dialogPermissions.length === 1 ? "entry" : "entries"} associated with this role.
                Read-only view.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-hidden border rounded-md">
              {dialogPermissions.length === 0 ? (
                <EmptyState
                  icon={KeyRound}
                  title="No permissions linked"
                  description="This role has no directly-associated permissions in the catalogue."
                />
              ) : (
                <div className="max-h-[55vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">
                      <TableRow>
                        <TableHead className="text-xs uppercase">Key</TableHead>
                        <TableHead className="text-xs uppercase">Resource</TableHead>
                        <TableHead className="text-xs uppercase">Action</TableHead>
                        <TableHead className="text-xs uppercase">Scope</TableHead>
                        <TableHead className="text-xs uppercase">Description</TableHead>
                        <TableHead className="text-xs uppercase">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dialogPermissions.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-[11px] align-top">{p.key}</TableCell>
                          <TableCell className="text-xs align-top">{p.resource}</TableCell>
                          <TableCell className="text-xs align-top">{p.action}</TableCell>
                          <TableCell className="align-top">
                            <Badge variant="outline" className="text-[10px] font-mono">{p.scope}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground align-top max-w-[20rem]">{p.description}</TableCell>
                          <TableCell className="align-top">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                p.status === "active"
                                  ? "text-emerald-700 border-emerald-300"
                                  : "text-slate-500"
                              }`}
                            >
                              {p.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <DialogFooter>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mr-auto">
                <Lock className="size-3" /> Read-only — permissions are managed by Super Admin.
              </div>
              <Button variant="outline" onClick={() => setPermissionsRole(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Department create/edit dialog */}
        <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingDept ? "Edit department" : "New department"}</DialogTitle>
              <DialogDescription>
                {editingDept
                  ? "Update the department details."
                  : "Create a new department to organize staff and roles."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <Label htmlFor="dept-name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="dept-name"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Compliance"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dept-desc">Description</Label>
                <Textarea
                  id="dept-desc"
                  rows={3}
                  value={deptForm.description}
                  onChange={(e) => setDeptForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What this department is responsible for…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dept-status">Status</Label>
                <Select
                  value={deptForm.status}
                  onValueChange={(v) => setDeptForm((f) => ({ ...f, status: v as "active" | "inactive" }))}
                >
                  <SelectTrigger id="dept-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeptDialogOpen(false)}>Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={onSaveDept}>
                {editingDept ? "Save changes" : "Create department"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Role create/edit dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingRole ? "Edit role" : "New role"}</DialogTitle>
              <DialogDescription>
                {editingRole
                  ? "Update the role details."
                  : "Create a new role for this department."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <Label htmlFor="role-name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="role-name"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Senior Compliance Analyst"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-desc">Description</Label>
                <Textarea
                  id="role-desc"
                  rows={3}
                  value={roleForm.description}
                  onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What this role does…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="role-dept">Department</Label>
                  <Select
                    value={roleForm.departmentId}
                    onValueChange={(v) => setRoleForm((f) => ({ ...f, departmentId: v }))}
                  >
                    <SelectTrigger id="role-dept" className="w-full">
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
                  <Label htmlFor="role-risk">Risk level</Label>
                  <Select
                    value={roleForm.riskLevel}
                    onValueChange={(v) => setRoleForm((f) => ({ ...f, riskLevel: v as RiskLevel }))}
                  >
                    <SelectTrigger id="role-risk" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-status">Status</Label>
                <Select
                  value={roleForm.status}
                  onValueChange={(v) => setRoleForm((f) => ({ ...f, status: v as "active" | "inactive" }))}
                >
                  <SelectTrigger id="role-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={onSaveRole}>
                {editingRole ? "Save changes" : "Create role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Department delete confirmation */}
        <AlertDialog open={!!deptDeleteTarget} onOpenChange={(o) => !o && setDeptDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete department?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes <span className="font-medium text-foreground">{deptDeleteTarget?.name}</span>.
                Roles in this department will remain but lose their department link. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={onDeleteDept}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Role delete confirmation */}
        <AlertDialog open={!!roleDeleteTarget} onOpenChange={(o) => !o && setRoleDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete role?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the <span className="font-medium text-foreground">{roleDeleteTarget?.name}</span> role.
                Staff assigned this role will keep their permissions until reassigned. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={onDeleteRole}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ViewContainer>
    </>
  );
}
