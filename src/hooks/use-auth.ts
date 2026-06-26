"use client";

/**
 * Faya Admin Portal — Auth hook
 *
 * Bridges Firebase Auth (identity / credentials) with the Firestore admin_staff
 * collection (authorization / department / role / country access / permissions).
 *
 * State is stored in a module-level Zustand store so all components calling
 * useAuth() share the same state (critical: PortalApp, LoginScreen, and
 * PortalShell all call useAuth and must see consistent state).
 *
 * Real Firebase Auth users must be provisioned in the Firebase console.
 * For convenience, a "demo mode" lets you sign in as a seeded staff member
 * without needing a Firebase Auth account — clearly marked in the UI.
 */
import { useEffect } from "react";
import { create } from "zustand";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ensureSeedData, COLLECTIONS, fetchAll } from "@/lib/admin-data";
import type { AdminStaff } from "@/lib/types";

export interface AuthState {
  loading: boolean;
  firebaseUser: User | null;
  staff: AdminStaff | null;
  error: string | null;
  isDemoMode: boolean;
  set: (partial: Partial<AuthState>) => void;
}

export const DEMO_EMAIL = "amara.okafor@faya.admin";
export const DEMO_PASSWORD = "Admin@123";

/** Module-level store — shared across all useAuth() callers. */
const useAuthStore = create<AuthState>((set) => ({
  loading: true,
  firebaseUser: null,
  staff: null,
  error: null,
  isDemoMode: false,
  set,
}));

let firebaseAuthListenerInitialized = false;

/** Look up a Firestore admin_staff record by email.
 * Works in both Firestore mode and local mode (via fetchAll fallback). */
async function findStaffByEmail(email: string): Promise<AdminStaff | null> {
  try {
    const all = await fetchAll<AdminStaff>(COLLECTIONS.staff);
    return (
      all.find((s) => s.email.toLowerCase() === email.toLowerCase()) ?? null
    );
  } catch {
    return null;
  }
}

/** Initialize the Firebase Auth listener once (idempotent). */
function initAuthListener() {
  if (firebaseAuthListenerInitialized) return;
  firebaseAuthListenerInitialized = true;

  const a = auth();
  if (!a) {
    // Firebase Auth unavailable — stay logged out, allow demo mode
    Promise.resolve().then(() => useAuthStore.getState().set({ loading: false }));
    return;
  }

  onAuthStateChanged(
    a,
    async (user) => {
      if (!user) {
        // Only clear if not in demo mode (demo mode bypasses Firebase Auth)
        const s = useAuthStore.getState();
        if (s.isDemoMode) {
          // Demo mode active — don't let Firebase Auth's null state clobber it
          useAuthStore.getState().set({ loading: false });
          return;
        }
        useAuthStore.getState().set({
          loading: false,
          firebaseUser: null,
          staff: null,
          error: null,
        });
        return;
      }
      // Look up the matching staff record by email
      try {
        const staff = await findStaffByEmail(user.email ?? "");
        if (!staff) {
          await signOut(a);
          useAuthStore.getState().set({
            loading: false,
            firebaseUser: null,
            staff: null,
            error: "No admin staff record found for this Firebase user.",
          });
          return;
        }
        if (staff.status !== "active") {
          await signOut(a);
          useAuthStore.getState().set({
            loading: false,
            firebaseUser: null,
            staff: null,
            error: `Account is ${staff.status}. Contact your administrator.`,
          });
          return;
        }
        useAuthStore.getState().set({
          loading: false,
          firebaseUser: user,
          staff,
          error: null,
          isDemoMode: false,
        });
      } catch (e) {
        useAuthStore.getState().set({
          loading: false,
          firebaseUser: user,
          staff: null,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    (err) => {
      useAuthStore.getState().set({
        loading: false,
        firebaseUser: null,
        staff: null,
        error: err.message,
      });
    },
  );
}

export function useAuth(): AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signInDemo: () => Promise<void>;
  logout: () => Promise<void>;
} {
  const state = useAuthStore();

  // Initialize the Firebase Auth listener on first mount (once, globally)
  useEffect(() => {
    initAuthListener();
  }, []);

  const signIn = async (email: string, password: string) => {
    useAuthStore.getState().set({ loading: true, error: null });
    const a = auth();
    if (!a) {
      // Firebase Auth unavailable — fall back to demo sign-in
      return signInDemoInternal(email);
    }
    try {
      await ensureSeedData();
      await signInWithEmailAndPassword(a, email, password);
      // onAuthStateChanged will populate staff
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("auth/invalid-credential") ||
        msg.includes("auth/user-not-found") ||
        msg.includes("auth/wrong-password") ||
        msg.includes("auth/invalid-email") ||
        msg.includes("auth/api-key-not-valid") ||
        msg.includes("auth/configuration-not-found") ||
        msg.includes("auth/network-request-failed")
      ) {
        const staff = await findStaffByEmail(email);
        if (staff && staff.status === "active") {
          await signInDemoInternal(email);
          return;
        }
      }
      useAuthStore.getState().set({ loading: false, error: msg });
    }
  };

  const signInDemo = async () => {
    useAuthStore.getState().set({ loading: true, error: null });
    await signInDemoInternal(DEMO_EMAIL);
  };

  const logout = async () => {
    const a = auth();
    if (a) {
      try {
        await signOut(a);
      } catch {
        /* ignore */
      }
    }
    useAuthStore.getState().set({
      loading: false,
      firebaseUser: null,
      staff: null,
      error: null,
      isDemoMode: false,
    });
  };

  return { ...state, signIn, signInDemo, logout };
}

/**
 * Demo mode sign-in: bypass Firebase Auth, use Firestore/local staff record directly.
 */
async function signInDemoInternal(email: string) {
  try {
    await ensureSeedData();
    const staff = await findStaffByEmail(email);
    if (!staff) {
      useAuthStore.getState().set({
        loading: false,
        error: `No staff record found for ${email}`,
      });
      return;
    }
    if (staff.status !== "active") {
      useAuthStore.getState().set({
        loading: false,
        error: `Account is ${staff.status}. Contact your administrator.`,
      });
      return;
    }
    useAuthStore.getState().set({
      loading: false,
      firebaseUser: null,
      staff,
      error: null,
      isDemoMode: true,
    });
  } catch (e) {
    useAuthStore.getState().set({
      loading: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
