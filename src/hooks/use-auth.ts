"use client";

/**
 * Faya Admin Portal — Auth hook (LIVE mode)
 *
 * Uses real Firebase Auth for login. No demo mode.
 * After Firebase Auth succeeds, looks up the staff record in Firestore
 * by email. If no staff record exists, creates a Super Admin profile
 * for the first authenticated user.
 */
import { useEffect } from "react";
import { create } from "zustand";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { COLLECTIONS, upsert, fetchAll, logAudit } from "@/lib/admin-data";
import type { AdminStaff } from "@/lib/types";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

export interface AuthState {
  loading: boolean;
  firebaseUser: User | null;
  staff: AdminStaff | null;
  error: string | null;
  set: (partial: Partial<AuthState>) => void;
}

const useAuthStore = create<AuthState>((set) => ({
  loading: true,
  firebaseUser: null,
  staff: null,
  error: null,
  set,
}));

let firebaseAuthListenerInitialized = false;

/** Look up a Firestore admin_staff record by email. */
async function findStaffByEmail(email: string): Promise<AdminStaff | null> {
  try {
    // Try fetching all staff and filtering (works in both Firestore + local mode)
    const all = await fetchAll<AdminStaff>(COLLECTIONS.staff);
    return all.find((s) => s.email.toLowerCase() === email.toLowerCase()) ?? null;
  } catch {
    return null;
  }
}

/** Create a Super Admin staff record for a new Firebase Auth user. */
async function createSuperAdminStaff(user: User): Promise<AdminStaff> {
  const nameParts = (user.displayName || user.email?.split("@")[0] || "Admin").split(" ");
  const staff: AdminStaff = {
    id: user.uid,
    firstName: nameParts[0] || "Admin",
    lastName: nameParts.slice(1).join(" ") || "User",
    email: user.email ?? "",
    phone: user.phoneNumber ?? "",
    departmentId: "dept_super_admin",
    roleId: "role_super_admin",
    managerId: null,
    status: "active",
    mfaEnabled: false,
    countries: [],
    regionAccess: [],
    permissions: [
      "staff.manage.global",
      "country.configure.global",
      "audit.view.global",
      "approval.decide.global",
    ],
    lastLoginAt: Date.now(),
    failedLoginCount: 0,
    createdBy: "system",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    notes: "Auto-created Super Admin on first Firebase Auth login",
  };
  await upsert(COLLECTIONS.staff, staff);
  return staff;
}

/** Initialize the Firebase Auth listener once (idempotent). */
function initAuthListener() {
  if (firebaseAuthListenerInitialized) return;
  firebaseAuthListenerInitialized = true;

  const a = auth();
  if (!a) {
    Promise.resolve().then(() => useAuthStore.getState().set({ loading: false }));
    return;
  }

  onAuthStateChanged(
    a,
    async (user) => {
      if (!user) {
        useAuthStore.getState().set({
          loading: false,
          firebaseUser: null,
          staff: null,
          error: null,
        });
        return;
      }

      try {
        // Look up staff record by email
        let staff = await findStaffByEmail(user.email ?? "");

        if (!staff) {
          // No staff record — create a Super Admin for this first user
          staff = await createSuperAdminStaff(user);
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

        // Update last login
        const updatedStaff = { ...staff, lastLoginAt: Date.now(), updatedAt: Date.now() };
        await upsert(COLLECTIONS.staff, updatedStaff);

        useAuthStore.getState().set({
          loading: false,
          firebaseUser: user,
          staff: updatedStaff,
          error: null,
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
  logout: () => Promise<void>;
} {
  const state = useAuthStore();

  useEffect(() => {
    initAuthListener();
  }, []);

  const signIn = async (email: string, password: string) => {
    useAuthStore.getState().set({ loading: true, error: null });
    const a = auth();
    if (!a) {
      useAuthStore.getState().set({
        loading: false,
        error: "Firebase Auth is not available. Check your configuration.",
      });
      return;
    }
    try {
      await signInWithEmailAndPassword(a, email.trim(), password);
      // onAuthStateChanged will populate staff
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      useAuthStore.getState().set({ loading: false, error: msg });
    }
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
    });
  };

  return { ...state, signIn, logout };
}
