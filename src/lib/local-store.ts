"use client";

import {
  SEED_DEPARTMENTS, SEED_ROLES, SEED_PERMISSIONS, SEED_COUNTRIES,
  SEED_STAFF, SEED_KYC_CASES, SEED_KYB_CASES, SEED_FRAUD_ALERTS,
  SEED_SETTLEMENTS, SEED_TICKETS, SEED_DISPUTES, SEED_TERMINALS,
  SEED_AUDIT_LOGS, SEED_APPROVALS, SEED_MERCHANTS, SEED_CONSUMERS,
  SEED_POS_STAFF, SEED_CARDS, SEED_WALLETS, SEED_TRANSACTIONS,
  SEED_DOCUMENTS, SEED_POLICIES, SEED_APP_CONTENT, SEED_NOTIFICATIONS,
  SEED_FEES, SEED_LIMITS, SEED_PROVIDER_LOGS, SEED_WEBHOOK_LOGS,
  SEED_POS_DEVICE_REQUESTS, SEED_STOCK_ITEMS, SEED_STOCK_ORDERS,
} from "./seed-data";

const PREFIX = "faya_admin_";

export const LOCAL_COLLECTION_MAP: Record<string, string> = {
  [`${PREFIX}departments`]: "departments",
  [`${PREFIX}roles`]: "roles",
  [`${PREFIX}permissions`]: "permissions",
  [`${PREFIX}countries`]: "countries",
  [`${PREFIX}staff`]: "staff",
  [`${PREFIX}audit_logs`]: "audit_logs",
  [`${PREFIX}approvals`]: "approvals",
  [`${PREFIX}policies`]: "policies",
  [`${PREFIX}app_content`]: "app_content",
  [`${PREFIX}notifications`]: "notifications",
  [`${PREFIX}fees`]: "fees",
  [`${PREFIX}limits`]: "limits",
  [`${PREFIX}provider_logs`]: "provider_logs",
  [`${PREFIX}webhook_logs`]: "webhook_logs",
  [`${PREFIX}stock`]: "stock",
  [`${PREFIX}stock_orders`]: "stock_orders",
  [`${PREFIX}meta`]: "meta",
  "users": "consumers",
  "cards": "cards",
  "devices": "devices",
  "kyc": "kyc_cases",
  "limits": "limits",
  "wallets": "wallets",
  "transactions": "transactions",
  "merchants": "merchants",
  "staff": "pos_staff",
  "pos_device_requests": "pos_device_requests",
  "terminals": "terminals",
  "settlements": "settlements",
  "disputes": "disputes",
  "support_tickets": "tickets",
  "documents": "documents",
  "kyb": "kyb_cases",
  "fraud_alerts": "fraud_alerts",
};

const SEED_MAP: Record<string, { id: string }[]> = {
  departments: SEED_DEPARTMENTS, roles: SEED_ROLES, permissions: SEED_PERMISSIONS,
  countries: SEED_COUNTRIES, staff: SEED_STAFF, kyc_cases: SEED_KYC_CASES,
  kyb_cases: SEED_KYB_CASES, fraud_alerts: SEED_FRAUD_ALERTS,
  settlements: SEED_SETTLEMENTS, tickets: SEED_TICKETS, disputes: SEED_DISPUTES,
  terminals: SEED_TERMINALS, audit_logs: SEED_AUDIT_LOGS, approvals: SEED_APPROVALS,
  merchants: SEED_MERCHANTS, consumers: SEED_CONSUMERS, pos_staff: SEED_POS_STAFF,
  cards: SEED_CARDS, wallets: SEED_WALLETS, transactions: SEED_TRANSACTIONS,
  documents: SEED_DOCUMENTS, policies: SEED_POLICIES, app_content: SEED_APP_CONTENT,
  notifications: SEED_NOTIFICATIONS, fees: SEED_FEES, limits: SEED_LIMITS,
  provider_logs: SEED_PROVIDER_LOGS, webhook_logs: SEED_WEBHOOK_LOGS,
  pos_device_requests: SEED_POS_DEVICE_REQUESTS, stock: SEED_STOCK_ITEMS,
  stock_orders: SEED_STOCK_ORDERS, meta: [],
};

const STORAGE_KEY = "faya_admin_local_store_v7";

type Listener<T extends { id: string }> = (items: T[]) => void;

class LocalStore {
  active = false;
  private data: Record<string, { id: string }[]> = {};
  private listeners: Record<string, Set<Listener<any>>> = {};
  private seeded = false;
  private initialized = false;

  constructor() {
    if (typeof window !== "undefined") this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = parsed?.data ?? {};
        this.seeded = parsed?.seeded ?? false;
      }
    } catch {}
    this.initialized = true;
  }

  private saveToStorage() {
    if (typeof window === "undefined" || !this.initialized) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: this.data, seeded: this.seeded }));
    } catch {}
  }

  private ensureSeeded() {
    if (typeof window === "undefined") return;
    if (!this.initialized) this.loadFromStorage();
    this.seeded = true;
  }

  subscribe<T extends { id: string }>(col: string, cb: (items: T[]) => void): () => void {
    this.ensureSeeded();
    if (!this.listeners[col]) this.listeners[col] = new Set();
    const set = this.listeners[col] as Set<Listener<T>>;
    set.add(cb);
    const snapshot = (this.data[col] ?? []) as T[];
    setTimeout(() => cb(snapshot.map((x) => ({ ...x }))), 0);
    return () => { set.delete(cb); };
  }

  private emit(col: string) {
    if (!this.listeners[col]) return;
    const set = this.listeners[col] as Set<Listener<any>>;
    if (set.size === 0) return;
    const snapshot = (this.data[col] ?? []).map((x) => ({ ...x }));
    set.forEach((cb: Listener<any>) => cb(snapshot));
  }

  upsert<T extends { id: string }>(col: string, item: T): void {
    this.ensureSeeded();
    if (!this.data[col]) this.data[col] = [];
    const arr = this.data[col];
    const idx = arr.findIndex((x) => x.id === item.id);
    if (idx >= 0) arr[idx] = { ...item };
    else arr.push({ ...item });
    this.saveToStorage();
    this.emit(col);
  }

  patch<T extends { id: string }>(col: string, id: string, patchData: Partial<T>): void {
    this.ensureSeeded();
    const arr = this.data[col];
    if (!arr) return;
    const idx = arr.findIndex((x) => x.id === id);
    if (idx < 0) return;
    arr[idx] = { ...arr[idx], ...patchData };
    this.saveToStorage();
    this.emit(col);
  }

  remove(col: string, id: string): void {
    this.ensureSeeded();
    const arr = this.data[col];
    if (!arr) return;
    const idx = arr.findIndex((x) => x.id === id);
    if (idx < 0) return;
    arr.splice(idx, 1);
    this.saveToStorage();
    this.emit(col);
  }

  reset(): void {
    this.data = {};
    this.seeded = false;
    if (typeof window !== "undefined") {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
    }
    this.ensureSeeded();
    Object.keys(this.data).forEach((col) => this.emit(col));
  }
}

export const localStore = new LocalStore();
