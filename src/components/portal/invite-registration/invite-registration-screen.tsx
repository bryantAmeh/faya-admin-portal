"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface InviteDetails {
  email: string;
  firstName: string;
  lastName: string;
  departmentId: string;
  roleId: string;
  countryAccess: { countryCode: string; accessLevel: string }[];
  regionAccess: string[];
  createdBy: string;
  status: string;
}

/**
 * InviteRegistrationScreen — shown when the URL has ?invite=TOKEN.
 *
 * Loads the invite details by token, lets the invitee set a password + phone,
 * and submits to /api/admin-register. On success, the invitee can sign in.
 */
export function InviteRegistrationScreen({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/admin-invite?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (!data.success) {
          setError(data.error || "Could not load invite.");
        } else {
          setInvite(data.invite as InviteDetails);
        }
      })
      .catch(() => {
        if (mounted) setError("Could not load invite. Please check your link.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invite) return;
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Registration failed.");
      }
      setDone(true);
      toast.success("Admin account created!", {
        description: "You can now sign in with your email and password.",
      });
    } catch (e) {
      toast.error("Registration failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- Loading ---------- */
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-4">
        <Loader2 className="size-8 animate-spin text-emerald-600" />
        <p className="text-sm text-muted-foreground">Loading invite…</p>
      </div>
    );
  }

  /* ---------- Error (invalid/expired/used invite) ---------- */
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <div className="size-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
              <AlertCircle className="size-7 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-lg font-semibold">Invite unavailable</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="size-4 mr-1" /> Go to Admin Portal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------- Success ---------- */
  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <div className="size-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-lg font-semibold">Welcome to Faya, {invite?.firstName}!</h1>
            <p className="text-sm text-muted-foreground">
              Your admin account ({invite?.email}) has been created. You can now
              sign in to the Faya Admin Portal.
            </p>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => router.push("/")}
            >
              Sign in to Admin Portal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------- Registration form ---------- */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 py-8">
      <Card className="max-w-lg w-full">
        <CardContent className="p-6 sm:p-8 space-y-5">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="size-14 rounded-xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/30">
              <ShieldCheck className="size-7" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Admin Registration
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                You've been invited to join the Faya Admin Portal.
              </p>
            </div>
          </div>

          {/* Pre-filled invite details (read-only) */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Invitation details
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Name</div>
                <div className="font-medium">{invite?.firstName} {invite?.lastName}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Email</div>
                <div className="font-medium truncate">{invite?.email}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Department</div>
                <div className="font-medium font-mono text-xs">{invite?.departmentId || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Role</div>
                <div className="font-medium font-mono text-xs">{invite?.roleId || "—"}</div>
              </div>
            </div>
            {invite?.countryAccess && invite.countryAccess.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {invite.countryAccess.map((c) => (
                  <Badge key={c.countryCode} variant="outline" className="text-[10px]">
                    {c.countryCode} · {c.accessLevel}
                  </Badge>
                ))}
              </div>
            )}
            <div className="text-[10px] text-muted-foreground pt-1">
              Invited by <span className="font-medium">{invite?.createdBy}</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Work phone <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 803 000 0000"
                className="text-sm"
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Password <span className="text-red-500">*</span>
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="text-sm"
                required
                minLength={6}
                disabled={submitting}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Confirm password <span className="text-red-500">*</span>
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="text-sm"
                required
                minLength={6}
                disabled={submitting}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={submitting || password.length < 6 || password !== confirmPassword}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 mr-1 animate-spin" /> Creating account…
                </>
              ) : (
                "Create admin account"
              )}
            </Button>
          </form>

          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="size-3 mr-1" /> Back to Admin Portal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
