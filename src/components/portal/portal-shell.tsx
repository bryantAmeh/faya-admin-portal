"use client";

import { useMemo } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  Globe2,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  Wallet,
  Headphones,
  Scale,
  ScrollText,
  CheckSquare,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { usePortalStore, type PortalView } from "@/hooks/use-portal-store";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AdminStaff, Department, Role } from "@/lib/types";

interface NavItem {
  view: PortalView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "operations" | "governance" | "admin";
  requiredPermission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "operations" },
  { view: "compliance", label: "Compliance · KYC/KYB", icon: ShieldCheck, group: "operations" },
  { view: "risk", label: "Risk & Fraud", icon: AlertTriangle, group: "operations" },
  { view: "devices", label: "Devices & Terminals", icon: Smartphone, group: "operations" },
  { view: "finance", label: "Finance & Settlements", icon: Wallet, group: "operations" },
  { view: "support", label: "Support Tickets", icon: Headphones, group: "operations" },
  { view: "disputes", label: "Disputes & Chargebacks", icon: Scale, group: "operations" },
  { view: "countries", label: "Country Management", icon: Globe2, group: "admin", requiredPermission: "country.configure.global" },
  { view: "staff", label: "Staff & Roles", icon: Users, group: "admin" },
  { view: "departments", label: "Departments", icon: Building2, group: "admin" },
  { view: "audit", label: "Audit Logs", icon: ScrollText, group: "governance" },
  { view: "approvals", label: "Approvals", icon: CheckSquare, group: "governance" },
];

const GROUP_LABELS: Record<NavItem["group"], string> = {
  operations: "Operations",
  admin: "Admin",
  governance: "Governance",
};

function initials(staff: AdminStaff): string {
  return `${staff.firstName[0] ?? ""}${staff.lastName[0] ?? ""}`.toUpperCase();
}

function deptName(staff: AdminStaff, departments: Department[]): string {
  return departments.find((d) => d.id === staff.departmentId)?.name ?? "—";
}

function roleName(staff: AdminStaff, roles: Role[]): string {
  return roles.find((r) => r.id === staff.roleId)?.name ?? "—";
}

interface PortalShellProps {
  children: React.ReactNode;
  departments: Department[];
  roles: Role[];
  pendingApprovalsCount: number;
  pendingTicketsCount: number;
}

export function PortalShell({
  children,
  departments,
  roles,
  pendingApprovalsCount,
  pendingTicketsCount,
}: PortalShellProps) {
  const { view, setView, sidebarCollapsed, toggleSidebar } = usePortalStore();
  const { staff, isDemoMode, logout } = useAuth();

  const groupedNav = useMemo(() => {
    const groups: Record<NavItem["group"], NavItem[]> = {
      operations: [],
      admin: [],
      governance: [],
    };
    for (const item of NAV_ITEMS) {
      // Super admin sees everything
      if (staff?.departmentId === "dept_super_admin") {
        groups[item.group].push(item);
        continue;
      }
      // Permission gate (optional)
      if (item.requiredPermission && !staff?.permissions.includes(item.requiredPermission)) {
        continue;
      }
      groups[item.group].push(item);
    }
    return groups;
  }, [staff]);

  if (!staff) return null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top header */}
      <header className="sticky top-0 z-30 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight truncate">Faya Admin Portal</div>
              <div className="text-[11px] text-muted-foreground leading-tight truncate">
                {deptName(staff, departments)} · {roleName(staff, roles)}
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isDemoMode && (
              <Badge variant="outline" className="hidden sm:inline-flex text-amber-700 border-amber-300 bg-amber-50">
                <ShieldAlert className="size-3 mr-1" /> Demo mode
              </Badge>
            )}
            {staff.mfaEnabled ? (
              <Badge variant="outline" className="hidden sm:inline-flex text-emerald-700 border-emerald-300 bg-emerald-50">
                MFA on
              </Badge>
            ) : (
              <Badge variant="outline" className="hidden sm:inline-flex text-red-700 border-red-300 bg-red-50">
                MFA off
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
            <Avatar className="size-8 border">
              <AvatarFallback className="bg-emerald-100 text-emerald-800 text-xs font-semibold">
                {initials(staff)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "sticky top-14 self-start h-[calc(100vh-3.5rem)] border-r bg-white dark:bg-slate-900 transition-all duration-200 overflow-hidden shrink-0",
            "w-14 lg:w-auto",
            !sidebarCollapsed && "lg:w-64",
            sidebarCollapsed && "lg:w-16",
          )}
        >
          <nav className="p-2 space-y-4 h-full overflow-y-auto" aria-label="Main navigation">
            {(Object.keys(groupedNav) as NavItem["group"][]).map((group) => {
              const items = groupedNav[group];
              if (items.length === 0) return null;
              return (
                <div key={group} className="space-y-1">
                  {!sidebarCollapsed && (
                    <div className="hidden lg:block px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {GROUP_LABELS[group]}
                    </div>
                  )}
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = view === item.view ||
                      (item.view === "countries" && view === "country_detail");
                    const badge =
                      item.view === "approvals"
                        ? pendingApprovalsCount
                        : item.view === "support"
                          ? pendingTicketsCount
                          : 0;
                    return (
                      <button
                        key={item.view}
                        onClick={() => setView(item.view)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={cn(
                          "relative w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                          "lg:gap-2",
                          active
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                          // On mobile: always icon-only (centered). On desktop: respect sidebarCollapsed.
                          "justify-center lg:justify-start",
                          sidebarCollapsed && "lg:justify-center",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className={cn(
                          "truncate flex-1 text-left",
                          "hidden lg:inline",
                          !sidebarCollapsed && "lg:inline",
                          sidebarCollapsed && "lg:hidden",
                        )}>
                          {item.label}
                        </span>
                        {badge > 0 && (
                          <span className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            "absolute top-0.5 right-0.5 lg:static lg:ml-auto",
                            active ? "bg-white/20 text-white" : "bg-red-100 text-red-700",
                            sidebarCollapsed && "lg:absolute lg:top-0.5 lg:right-0.5",
                          )}>
                            {badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Sticky footer */}
      <footer className="mt-auto border-t bg-white dark:bg-slate-900 py-3 px-4 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Signed in as <strong className="text-foreground">{staff.firstName} {staff.lastName}</strong> ·{" "}
            <span className="font-mono">{staff.email}</span>
          </span>
          <span className="flex items-center gap-2">
            <span>Countries: {staff.countries.map((c) => c.countryCode).join(", ") || "—"}</span>
            <Separator orientation="vertical" className="h-3" />
            <span>All actions logged</span>
            <Separator orientation="vertical" className="h-3" />
            <span className="font-mono">fayapay-ece98</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
