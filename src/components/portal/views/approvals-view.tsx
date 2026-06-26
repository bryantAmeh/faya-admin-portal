"use client";

/**
 * Faya Admin Portal — Approvals view (spec §12)
 *
 * Dual-approval workflow for high-risk actions. Tabs:
 *  Pending | Approved | Rejected | All
 *
 * Pending requests are shown as cards with:
 *  - action (font-mono, bold), entity, country, requested-by + time-ago, reason
 *  - Progress bar (currentApprovals / requiredApprovals)
 *  - Decisions list (approver name, decision badge, note, time)
 *  - Approve / Reject buttons (open dialogs requiring a note)
 *
 * A user cannot approve their own request (button disabled + tooltip).
 * All decisions are persisted via adminData.updateApproval and logged via logAudit.
 */
import { useMemo, useState } from "react";
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  FileText,
  Globe2,
  User,
  MessageSquare,
  History,
  Inbox,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";

import { ViewHeader, ViewContainer, StatCard, EmptyState } from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
import { statusBadge, timeAgo, formatDateTime } from "@/lib/formatters";
import type { ApprovalRequest } from "@/lib/types";

interface ApprovalsViewProps {
  approvals: ApprovalRequest[];
}

type TabKey = "pending" | "approved" | "rejected" | "all";
type DecisionMode = "approve" | "reject";

export function ApprovalsView({ approvals }: ApprovalsViewProps) {
  const { staff: currentStaff } = useAuth();
  const [tab, setTab] = useState<TabKey>("pending");
  const [decisionMode, setDecisionMode] = useState<DecisionMode | null>(null);
  const [target, setTarget] = useState<ApprovalRequest | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSuperAdmin = currentStaff?.departmentId === "dept_super_admin";
  const myCountryCodes = useMemo(
    () => new Set(currentStaff?.countries.map((c) => c.countryCode) ?? []),
    [currentStaff],
  );

  // Country scoping — Super Admin sees all; others see only their countries (or null = global)
  const scopedApprovals = useMemo(() => {
    if (!currentStaff) return [];
    if (isSuperAdmin) return approvals;
    return approvals.filter(
      (a) => a.countryCode === null || myCountryCodes.has(a.countryCode),
    );
  }, [approvals, currentStaff, isSuperAdmin, myCountryCodes]);

  const byStatus = useMemo(() => {
    const pending = scopedApprovals.filter((a) => a.status === "pending");
    const approved = scopedApprovals.filter((a) => a.status === "approved");
    const rejected = scopedApprovals.filter((a) => a.status === "rejected");
    return { pending, approved, rejected, all: scopedApprovals };
  }, [scopedApprovals]);

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const approved7d = byStatus.approved.filter((a) => a.updatedAt >= weekAgo).length;
  const rejected7d = byStatus.rejected.filter((a) => a.updatedAt >= weekAgo).length;
  const myPending = byStatus.pending.filter((a) => a.requestedBy === currentStaff?.id).length;

  function openDecision(req: ApprovalRequest, mode: DecisionMode) {
    if (req.requestedBy === currentStaff?.id) {
      toast.error("You cannot approve your own request");
      return;
    }
    setTarget(req);
    setDecisionMode(mode);
    setNote("");
  }

  function closeDecision() {
    setDecisionMode(null);
    setTarget(null);
    setNote("");
    setSubmitting(false);
  }

  async function submitDecision() {
    if (!target || !decisionMode || !currentStaff) return;
    const trimmed = note.trim();
    if (trimmed.length < 3) {
      toast.error("Please provide a note (at least 3 characters)");
      return;
    }
    setSubmitting(true);

    try {
      const isApprove = decisionMode === "approve";
      const newDecision = {
        approvedBy: currentStaff.id,
        approvedByName: `${currentStaff.firstName} ${currentStaff.lastName}`,
        decision: decisionMode,
        note: trimmed,
        createdAt: Date.now(),
      } as const;

      const nextDecisions = [...target.decisions, newDecision];
      const nextApprovals = isApprove ? target.currentApprovals + 1 : target.currentApprovals;
      const nextStatus = isApprove
        ? nextApprovals >= target.requiredApprovals
          ? ("approved" as const)
          : ("pending" as const)
        : ("rejected" as const);

      const beforeValue = JSON.stringify({
        status: target.status,
        currentApprovals: target.currentApprovals,
        decisions: target.decisions.length,
      });
      const afterValue = JSON.stringify({
        status: nextStatus,
        currentApprovals: nextApprovals,
        decisions: nextDecisions.length,
      });

      await adminData.updateApproval(target.id, {
        status: nextStatus,
        currentApprovals: nextApprovals,
        decisions: nextDecisions,
        updatedAt: Date.now(),
      });

      logAudit(
        {
          staffId: currentStaff.id,
          staffName: `${currentStaff.firstName} ${currentStaff.lastName}`,
          department: target.action.includes("settlement")
            ? "Finance"
            : target.action.includes("kyc") || target.action.includes("kyb")
              ? "Compliance"
              : currentStaff.departmentId === "dept_super_admin"
                ? "Super Admin"
                : "Operations",
          role: currentStaff.roleId,
        },
        isApprove ? "approval.approve" : "approval.reject",
        "approval_request",
        target.id,
        {
          countryCode: target.countryCode,
          beforeValue,
          afterValue,
          reason: trimmed,
          ipAddress: "0.0.0.0",
          deviceFingerprint: "unknown",
        },
      );

      toast.success(
        isApprove
          ? nextStatus === "approved"
            ? "Approval recorded — request fully approved"
            : `Approval recorded (${nextApprovals}/${target.requiredApprovals})`
          : "Request rejected",
      );
      closeDecision();
    } catch (e) {
      console.error("[submitDecision]", e);
      toast.error("Failed to record decision. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <ViewHeader
        title="Approval Requests"
        description="Dual-approval workflow for high-risk actions"
        icon={CheckSquare}
      />
      <ViewContainer>
        {/* KPI strip */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard
            label="Pending"
            value={byStatus.pending.length}
            hint="awaiting decisions"
            icon={Clock}
            tone="warning"
          />
          <StatCard
            label="Approved (7d)"
            value={approved7d}
            hint="last 7 days"
            icon={CheckCircle2}
            tone="success"
          />
          <StatCard
            label="Rejected (7d)"
            value={rejected7d}
            hint="last 7 days"
            icon={XCircle}
            tone="danger"
          />
          <StatCard
            label="My Pending Requests"
            value={myPending}
            hint="submitted by me"
            icon={Inbox}
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="pending">
              <Clock className="size-3.5 mr-1" /> Pending
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1.5">{byStatus.pending.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="approved">
              <CheckCircle2 className="size-3.5 mr-1" /> Approved
            </TabsTrigger>
            <TabsTrigger value="rejected">
              <XCircle className="size-3.5 mr-1" /> Rejected
            </TabsTrigger>
            <TabsTrigger value="all">
              <ListChecks className="size-3.5 mr-1" /> All
            </TabsTrigger>
          </TabsList>

          {/* Pending tab */}
          <TabsContent value="pending">
            <ApprovalList
              items={byStatus.pending}
              emptyTitle="No pending approvals"
              emptyDescription="All high-risk actions have been reviewed."
              currentStaffId={currentStaff?.id}
              onDecision={openDecision}
              showActions
            />
          </TabsContent>

          {/* Approved tab */}
          <TabsContent value="approved">
            <ApprovalList
              items={byStatus.approved}
              emptyTitle="No approved requests"
              emptyDescription="Approved approval requests will appear here."
              currentStaffId={currentStaff?.id}
              onDecision={() => {}}
            />
          </TabsContent>

          {/* Rejected tab */}
          <TabsContent value="rejected">
            <ApprovalList
              items={byStatus.rejected}
              emptyTitle="No rejected requests"
              emptyDescription="Rejected approval requests will appear here."
              currentStaffId={currentStaff?.id}
              onDecision={() => {}}
            />
          </TabsContent>

          {/* All tab */}
          <TabsContent value="all">
            <ApprovalList
              items={byStatus.all}
              emptyTitle="No approval requests"
              emptyDescription="Approval requests for high-risk actions will appear here."
              currentStaffId={currentStaff?.id}
              onDecision={openDecision}
              showActions
            />
          </TabsContent>
        </Tabs>

        {/* Decision dialog */}
        <Dialog open={!!decisionMode} onOpenChange={(open) => !open && closeDecision()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {decisionMode === "approve" ? (
                  <>
                    <ThumbsUp className="size-5 text-emerald-600" />
                    Approve Request
                  </>
                ) : (
                  <>
                    <ThumbsDown className="size-5 text-red-600" />
                    Reject Request
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {target && (
                  <>
                    Add a note explaining your decision. This will be recorded in the audit log.
                    <div className="mt-2 rounded-md border bg-muted/50 p-2 text-xs">
                      <div className="font-mono font-medium">{target.action}</div>
                      <div className="text-muted-foreground">
                        {target.entityType} · {target.entityId}
                      </div>
                    </div>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="approval-note">Decision note</Label>
              <Textarea
                id="approval-note"
                placeholder={
                  decisionMode === "approve"
                    ? "e.g. Verified compliance clearance, risk review passed."
                    : "e.g. Missing documentation, requires further review."
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 3 characters. This note is visible to all approvers and recorded in the audit log.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDecision} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={submitDecision}
                disabled={submitting || note.trim().length < 3}
                className={
                  decisionMode === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }
              >
                {submitting ? "Submitting…" : decisionMode === "approve" ? "Confirm approval" : "Confirm rejection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ViewContainer>
    </>
  );
}

/* ---------------------------- Approval list/card ---------------------------- */

interface ApprovalListProps {
  items: ApprovalRequest[];
  emptyTitle: string;
  emptyDescription: string;
  currentStaffId?: string;
  onDecision: (req: ApprovalRequest, mode: DecisionMode) => void;
  showActions?: boolean;
}

function ApprovalList({
  items,
  emptyTitle,
  emptyDescription,
  currentStaffId,
  onDecision,
  showActions,
}: ApprovalListProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState icon={CheckSquare} title={emptyTitle} description={emptyDescription} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((req) => (
        <ApprovalCard
          key={req.id}
          req={req}
          currentStaffId={currentStaffId}
          onDecision={onDecision}
          showActions={showActions}
        />
      ))}
    </div>
  );
}

function ApprovalCard({
  req,
  currentStaffId,
  onDecision,
  showActions,
}: {
  req: ApprovalRequest;
  currentStaffId?: string;
  onDecision: (req: ApprovalRequest, mode: DecisionMode) => void;
  showActions?: boolean;
}) {
  const isOwn = req.requestedBy === currentStaffId;
  const isApproved = req.status === "approved";
  const isRejected = req.status === "rejected";
  const isPending = req.status === "pending";
  const progressPct = req.requiredApprovals > 0
    ? Math.min(100, (req.currentApprovals / req.requiredApprovals) * 100)
    : 0;

  const statusB = statusBadge("approval", req.status);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold">{req.action}</span>
              <Badge variant="outline" className="text-[10px]">{req.entityType}</Badge>
              <Badge variant="secondary" className={`text-[10px] ${statusB.className}`}>{statusB.label}</Badge>
              {isOwn && (
                <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                  Your request
                </Badge>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
              <span className="font-mono">{req.entityId}</span>
              <span className="flex items-center gap-1">
                <Globe2 className="size-3" />
                {req.countryCode ?? "Global"}
              </span>
              <span className="flex items-center gap-1">
                <User className="size-3" />
                {req.requestedByName}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {timeAgo(req.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Reason */}
        {req.reason && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <FileText className="size-3" /> Reason
            </div>
            <div className="text-sm rounded-md border bg-card p-2.5">{req.reason}</div>
          </div>
        )}

        {/* Payload */}
        {req.payload && Object.keys(req.payload).length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Payload</div>
            <pre className="text-[11px] font-mono rounded-md border bg-slate-50 dark:bg-slate-900 p-2 overflow-x-auto max-h-32 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
              {JSON.stringify(req.payload, null, 2)}
            </pre>
          </div>
        )}

        {/* Progress (only relevant if still pending or part-way) */}
        {(isPending || isApproved) && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">
                {req.currentApprovals} of {req.requiredApprovals} approvals
              </span>
            </div>
            <Progress
              value={progressPct}
              className={`h-2 ${isApproved ? "[&>[data-slot=progress-indicator]]:bg-emerald-600" : "[&>[data-slot=progress-indicator]]:bg-amber-500"}`}
            />
          </div>
        )}

        {/* Decisions list */}
        {req.decisions.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <History className="size-3" /> Decisions ({req.decisions.length})
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
              {req.decisions.map((d, i) => (
                <div
                  key={`${d.approvedBy}-${i}`}
                  className="flex items-start gap-2 rounded-md border bg-card p-2"
                >
                  <div className="shrink-0 mt-0.5">
                    {d.decision === "approve" ? (
                      <ThumbsUp className="size-3.5 text-emerald-600" />
                    ) : (
                      <ThumbsDown className="size-3.5 text-red-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium">{d.approvedByName}</span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${
                          d.decision === "approve"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                        }`}
                      >
                        {d.decision === "approve" ? "Approved" : "Rejected"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(d.createdAt)}</span>
                    </div>
                    {d.note && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                        <MessageSquare className="size-3 mt-0.5 shrink-0" />
                        <span className="break-words">{d.note}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {showActions && isPending && (
          <>
            <Separator />
            <div className="flex items-center gap-2 flex-wrap">
              {isOwn ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Button disabled size="sm" className="bg-emerald-600 text-white opacity-60">
                        <ThumbsUp className="size-3.5 mr-1" /> Approve
                      </Button>
                      <Button disabled size="sm" variant="outline" className="border-red-200 text-red-600 opacity-60">
                        <ThumbsDown className="size-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>You cannot approve your own request</TooltipContent>
                </Tooltip>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={() => onDecision(req, "approve")}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <ThumbsUp className="size-3.5 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDecision(req, "reject")}
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <ThumbsDown className="size-3.5 mr-1" /> Reject
                  </Button>
                </>
              )}
              <div className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                <AlertCircle className="size-3" /> A note is required for every decision.
              </div>
            </div>
          </>
        )}

        {/* Final timestamp footer for closed requests */}
        {(isApproved || isRejected) && (
          <div className="text-[10px] text-muted-foreground border-t pt-2">
            {isApproved ? "Approved" : "Rejected"} on {formatDateTime(req.updatedAt)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
