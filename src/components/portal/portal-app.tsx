"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, WifiOff, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePortalStore } from "@/hooks/use-portal-store";
import { adminData, ensureSeedData } from "@/lib/admin-data";
import type {
  Department,
  Role,
  Permission,
  CountryConfig,
  AdminStaff,
  KycCase,
  KybCase,
  FraudAlert,
  Settlement,
  SupportTicket,
  Dispute,
  Terminal,
  AuditLog,
  ApprovalRequest,
  Merchant,
  Consumer,
} from "@/lib/types";
import { LoginScreen } from "@/components/portal/login-screen";
import { PortalShell } from "@/components/portal/portal-shell";
import { DashboardView } from "@/components/portal/views/dashboard-view";
import { UsersView } from "@/components/portal/views/users-view";
import { UserDetailView } from "@/components/portal/views/user-detail-view";
import { MerchantDetailView } from "@/components/portal/views/merchant-detail-view";
import { MerchantsView } from "@/components/portal/views/merchants-view";
import { StaffView } from "@/components/portal/views/staff-view";
import { DepartmentsView } from "@/components/portal/views/departments-view";
import { CountriesView } from "@/components/portal/views/countries-view";
import { CountryDetailView } from "@/components/portal/views/country-detail-view";
import { ComplianceView } from "@/components/portal/views/compliance-view";
import { StockView } from "@/components/portal/views/stock-view";
import { RiskView } from "@/components/portal/views/risk-view";
import { DevicesView } from "@/components/portal/views/devices-view";
import { FinanceView } from "@/components/portal/views/finance-view";
import { SupportView } from "@/components/portal/views/support-view";
import { DisputesView } from "@/components/portal/views/disputes-view";
import { AuditView } from "@/components/portal/views/audit-view";
import { ApprovalsView } from "@/components/portal/views/approvals-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Toaster as SonnerToaster } from "sonner";

/**
 * Root portal component — wires Firestore subscriptions to all views.
 * Handles auth gate + data loading state.
 */
export function PortalApp() {
  const { loading, staff } = useAuth();
  const [seeding, setSeeding] = useState(true);
  const [seedError, setSeedError] = useState<string | null>(null);

  // Live data state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [staffList, setStaffList] = useState<AdminStaff[]>([]);
  const [kycCases, setKycCases] = useState<KycCase[]>([]);
  const [kybCases, setKybCases] = useState<KybCase[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [consumers, setConsumers] = useState<Consumer[]>([]);

  // Seed the database on first mount
  useEffect(() => {
    let mounted = true;
    ensureSeedData()
      .catch((e) => {
        if (mounted) setSeedError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (mounted) setSeeding(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to all collections once seeding is done
  useEffect(() => {
    if (seeding) return;
    const unsubs: Array<() => void> = [];
    try {
      unsubs.push(adminData.subscribeDepartments(setDepartments));
      unsubs.push(adminData.subscribeRoles(setRoles));
      unsubs.push(adminData.subscribePermissions(setPermissions));
      unsubs.push(adminData.subscribeCountries(setCountries));
      unsubs.push(adminData.subscribeStaff(setStaffList));
      unsubs.push(adminData.subscribeKyc(setKycCases));
      unsubs.push(adminData.subscribeKyb(setKybCases));
      unsubs.push(adminData.subscribeFraud(setFraudAlerts));
      unsubs.push(adminData.subscribeSettlements(setSettlements));
      unsubs.push(adminData.subscribeTickets(setTickets));
      unsubs.push(adminData.subscribeDisputes(setDisputes));
      unsubs.push(adminData.subscribeTerminals(setTerminals));
      unsubs.push(adminData.subscribeAudit(setAuditLogs));
      unsubs.push(adminData.subscribeApprovals(setApprovals));
      unsubs.push(adminData.subscribeMerchants(setMerchants));
      unsubs.push(adminData.subscribeConsumers(setConsumers));
    } catch (e) {
      console.error("[PortalApp] subscription error:", e);
    }
    return () => unsubs.forEach((u) => u());
  }, [seeding]);

  // Show loading screen while seeding / auth-loading
  if (loading || seeding) {
    return <LoadingScreen message={seeding ? "Initializing Firebase…" : "Authenticating…"} />;
  }

  // Auth gate
  if (!staff) {
    return <LoginScreen />;
  }

  // Compute sidebar badge counts
  const pendingApprovalsCount = approvals.filter((a) => a.status === "pending").length;
  const pendingTicketsCount = tickets.filter(
    (t) => t.status === "open" || t.status === "in_progress",
  ).length;

  return (
    <>
      <PortalShell
        departments={departments}
        roles={roles}
        pendingApprovalsCount={pendingApprovalsCount}
        pendingTicketsCount={pendingTicketsCount}
      >
        <PortalContent
          departments={departments}
          roles={roles}
          permissions={permissions}
          countries={countries}
          staffList={staffList}
          kycCases={kycCases}
          kybCases={kybCases}
          fraudAlerts={fraudAlerts}
          settlements={settlements}
          tickets={tickets}
          disputes={disputes}
          terminals={terminals}
          auditLogs={auditLogs}
          approvals={approvals}
          merchants={merchants}
          consumers={consumers}
        />
      </PortalShell>
      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}

function PortalContent(props: {
  departments: Department[];
  roles: Role[];
  permissions: Permission[];
  countries: CountryConfig[];
  staffList: AdminStaff[];
  kycCases: KycCase[];
  kybCases: KybCase[];
  fraudAlerts: FraudAlert[];
  settlements: Settlement[];
  tickets: SupportTicket[];
  disputes: Dispute[];
  terminals: Terminal[];
  auditLogs: AuditLog[];
  approvals: ApprovalRequest[];
  merchants: Merchant[];
  consumers: Consumer[];
}) {
  const { view } = usePortalStore();

  // Quick empty-data check to show seed-error recovery
  const totalDocs =
    props.departments.length +
    props.countries.length +
    props.staffList.length;

  switch (view) {
    case "dashboard":
      return (
        <DashboardView
          countries={props.countries}
          staff={props.staffList}
          kycCases={props.kycCases}
          kybCases={props.kybCases}
          fraudAlerts={props.fraudAlerts}
          settlements={props.settlements}
          tickets={props.tickets}
          merchants={props.merchants}
          consumers={props.consumers}
        />
      );
    case "users":
      return <UsersView consumers={props.consumers} countries={props.countries} />;
    case "user_detail":
      return <UserDetailView consumers={props.consumers} countries={props.countries} />;
    case "merchants":
      return <MerchantsView merchants={props.merchants} countries={props.countries} />;
    case "merchant_detail":
      return <MerchantDetailView merchants={props.merchants} countries={props.countries} />;
    case "staff":
      return (
        <StaffView
          staff={props.staffList}
          departments={props.departments}
          roles={props.roles}
          countries={props.countries}
        />
      );
    case "departments":
      return (
        <DepartmentsView
          departments={props.departments}
          roles={props.roles}
          permissions={props.permissions}
        />
      );
    case "countries":
      return <CountriesView countries={props.countries} />;
    case "country_detail":
      return <CountryDetailView countries={props.countries} merchants={props.merchants} consumers={props.consumers} />;
    case "compliance":
      return (
        <ComplianceView
          kycCases={props.kycCases}
          kybCases={props.kybCases}
          staff={props.staffList}
          countries={props.countries}
          consumers={props.consumers}
          merchants={props.merchants}
        />
      );
    case "stock":
      return <StockView />;
    case "risk":
      return <RiskView fraudAlerts={props.fraudAlerts} countries={props.countries} merchants={props.merchants} consumers={props.consumers} />;
    case "devices":
      return <DevicesView terminals={props.terminals} countries={props.countries} />;
    case "finance":
      return <FinanceView settlements={props.settlements} countries={props.countries} />;
    case "support":
      return <SupportView tickets={props.tickets} countries={props.countries} />;
    case "disputes":
      return <DisputesView disputes={props.disputes} countries={props.countries} />;
    case "audit":
      return <AuditView auditLogs={props.auditLogs} departments={props.departments} />;
    case "approvals":
      return <ApprovalsView approvals={props.approvals} />;
    default:
      return <DashboardView countries={props.countries} staff={props.staffList} kycCases={props.kycCases} kybCases={props.kybCases} fraudAlerts={props.fraudAlerts} settlements={props.settlements} tickets={props.tickets} merchants={props.merchants} consumers={props.consumers} />;
  }
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-4">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30">
          <Loader2 className="size-6 text-white animate-spin" />
        </div>
        <div className="text-lg font-semibold">Faya Admin Portal</div>
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">Connecting to Firebase project <code className="font-mono">fayapay-ece98</code></p>
    </div>
  );
}
