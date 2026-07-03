"use client";

import { useState } from "react";
import { ShieldCheck, Lock, Mail, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { FIREBASE_PROJECT_ID } from "@/lib/firebase";

export function LoginScreen() {
  const { signIn, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [showMfa, setShowMfa] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn(email.trim(), password);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950">
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
          {/* Brand / hero */}
          <div className="hidden lg:flex flex-col gap-6 p-8">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30">
                <ShieldCheck className="size-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Faya Admin Portal</h1>
                <p className="text-sm text-muted-foreground">Country Operations · Staff · Compliance</p>
              </div>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Internal control center for Faya staff managing fintech operations
              across African countries — KYC/KYB review, risk monitoring,
              settlements, devices, disputes and regulatory reporting.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { t: "Faya Pay consumers", d: "KYC, wallet, payments" },
                { t: "Faya Business merchants", d: "KYB, sales, settlements" },
                { t: "Country + region scoping", d: "NG · GH · KE · ZA · EG · MA" },
                { t: "Dual approval workflows", d: "For high-risk actions" },
              ].map((f) => (
                <div key={f.t} className="rounded-lg border bg-card p-3">
                  <div className="text-sm font-medium">{f.t}</div>
                  <div className="text-xs text-muted-foreground mt-1">{f.d}</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900 p-3 text-xs">
              <div className="font-medium text-emerald-900 dark:text-emerald-200 mb-1">
                Connected to Firebase
              </div>
              <div className="text-emerald-800 dark:text-emerald-300 leading-relaxed">
                Project <code className="font-mono">{FIREBASE_PROJECT_ID}</code> — Auth + Firestore.
                The Faya Pay app (consumers), Faya Business app (merchants), and Faya POS app
                all read from the same Firestore database. Admin actions sync to all apps in real time.
              </div>
            </div>
          </div>

          {/* Login card */}
          <Card className="w-full max-w-md mx-auto shadow-xl border-slate-200 dark:border-slate-800">
            <CardHeader className="space-y-3">
              <div className="lg:hidden flex items-center gap-3">
                <div className="size-10 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="size-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Faya Admin Portal</CardTitle>
                  <CardDescription>Staff sign-in</CardDescription>
                </div>
              </div>
              <div className="hidden lg:block">
                <CardTitle className="text-2xl">Staff Sign-in</CardTitle>
                <CardDescription>
                  Use your work email and password.
                </CardDescription>
              </div>
            </CardHeader>
            <form onSubmit={onSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@faya.africa"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                {showMfa && (
                  <div className="space-y-2">
                    <Label htmlFor="mfa">MFA code (6 digits)</Label>
                    <Input
                      id="mfa"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="font-mono tracking-widest text-center"
                    />
                    <p className="text-xs text-muted-foreground">
                      MFA is mandatory for all admin roles. Use your authenticator app.
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowMfa((v) => !v)}
                  className="text-xs text-emerald-600 hover:underline"
                >
                  {showMfa ? "Hide MFA field" : "Show MFA field"}
                </button>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-4" />
                      Sign in
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
      <footer className="border-t bg-white/50 dark:bg-slate-950/50 backdrop-blur py-3 text-center text-xs text-muted-foreground">
        Faya Admin Portal · Firebase project <code className="font-mono">{FIREBASE_PROJECT_ID}</code> · All actions are audited
      </footer>
    </div>
  );
}
