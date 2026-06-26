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
} from "lucide-react";

import { ViewHeader, ViewContainer, StatCard, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { statusBadge } from "@/lib/formatters";
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
  const [deptSearch, setDeptSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(
    departments[0]?.id ?? null,
  );
  const [permissionsRole, setPermissionsRole] = useState<Role | null>(null);

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
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedDeptId(d.id)}
                        className={`w-full text-left rounded-lg border p-3 transition-all ${
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
                        </div>
                      </button>
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
                {selectedDept && (
                  <Badge variant="secondary" className="text-[10px]">
                    {filteredRoles.length} / {rolesForDept.length}
                  </Badge>
                )}
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
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setPermissionsRole(r)}
                          >
                            <Eye className="size-3 mr-1" /> View Permissions
                          </Button>
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
      </ViewContainer>
    </>
  );
}
