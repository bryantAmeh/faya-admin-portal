"use client";

import dynamic from "next/dynamic";

// Firebase Auth/Firestore require the browser — load portal client-side only.
const PortalApp = dynamic(
  () => import("@/components/portal/portal-app").then((m) => m.PortalApp),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-4">
        <div className="size-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30 animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading Faya Admin Portal…</p>
      </div>
    ),
  },
);

export default function Home() {
  return <PortalApp />;
}
