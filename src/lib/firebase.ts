/**
 * Firebase initialization — Faya Admin Portal
 *
 * Project: fayapay-ece98
 * Services: Auth (email/password + MFA), Firestore (admin data), Analytics (optional)
 *
 * NOTE: This module is CLIENT-side only (`'use client'` boundary enforced by callers).
 * The config below is the user-provided Firebase web config. For a real production
 * deploy you'd move secrets to env vars, but Firebase web SDK config is intentionally
 * public (security enforced by Firebase Security Rules + Admin SDK on server).
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  type Auth,
  setPersistence,
  browserLocalPersistence,
  RecaptchaVerifier,
} from "firebase/auth";
import {
  getFirestore,
  type Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

export const firebaseConfig = {
  apiKey: "AIzaSyAuHmu4z06EPZJ6L4p0a_r-lrbGYo_RyPM",
  authDomain: "fayapay-ece98.firebaseapp.com",
  projectId: "fayapay-ece98",
  storageBucket: "fayapay-ece98.firebasestorage.app",
  messagingSenderId: "401350981808",
  appId: "1:401350981808:web:127488fb53c6e534736375",
  measurementId: "G-4ZMVXN0XNV",
};

// Singleton initializers (safe for Next.js HMR / multi-render)
let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let analyticsInstance: Analytics | null = null;
let initError: string | null = null;

function initFirebase() {
  if (typeof window === "undefined") return null;
  if (app) return app;

  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);

    // Firestore with offline persistence (multi-tab safe)
    try {
      dbInstance = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch {
      // already initialized — fall back to default getter
      dbInstance = getFirestore(app);
    }

    authInstance = getAuth(app);
    // Keep admin session across reloads
    setPersistence(authInstance, browserLocalPersistence).catch(() => {
      /* ignore persistence errors (private mode etc.) */
    });

    // Analytics is optional and only in browser
    isSupported()
      .then((ok) => {
        if (ok && app) analyticsInstance = getAnalytics(app);
      })
      .catch(() => {
        /* analytics non-critical */
      });
  } catch (e) {
    initError = e instanceof Error ? e.message : String(e);
    console.error("[firebase] init failed:", initError);
  }
  return app;
}

export function getFirebase() {
  if (!app) initFirebase();
  return {
    app,
    auth: authInstance,
    db: dbInstance,
    analytics: analyticsInstance,
    initError,
  };
}

/** Lazy Firestore accessor (auto-inits). */
export function db() {
  if (!dbInstance) initFirebase();
  return dbInstance!;
}

/** Lazy Auth accessor (auto-inits). */
export function auth() {
  if (!authInstance) initFirebase();
  return authInstance!;
}

/**
 * Build an invisible reCAPTCHA verifier for phone/MFA flows.
 * Caller is responsible for clearing it after use.
 */
export function makeRecaptcha(containerId: string): RecaptchaVerifier {
  const a = auth();
  return new RecaptchaVerifier(a, containerId, {
    size: "invisible",
    callback: () => {
      /* reCAPTCHA solved — will auto-submit */
    },
  });
}

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_AUTH_DOMAIN = firebaseConfig.authDomain;
