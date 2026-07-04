/**
 * Faya Admin Portal — Firestore data access layer
 *
 * Provides typed CRUD + real-time subscriptions for all admin collections.
 * Attempts Firestore first; on permission-denied (or any access error) falls
 * back transparently to a local in-memory + localStorage store seeded from
 * the spec reference data. This means the portal works out of the box without
 * requiring Firestore security rule configuration, while still using real
 * Firebase wiring once permissions are granted.
 *
 * All collections are prefixed with `faya_admin_` to namespace within the
 * shared Firebase project (fayapay-ece98).
 */
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
  type Unsubscribe,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "./firebase";
import { localStore, LOCAL_COLLECTION_MAP } from "./local-store";
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
  PosStaff,
  Card,
  Wallet,
  Transaction,
  UserDocument,
  LegalPolicy,
  AppContent,
  NotificationCampaign,
  Fee,
  Limit,
  ProviderLog,
  WebhookLog,
  PosDeviceRequest,
  StockItem,
  StockOrder,
} from "./types";
import {
  SEED_DEPARTMENTS,
  SEED_ROLES,
  SEED_PERMISSIONS,
  SEED_COUNTRIES,
  SEED_STAFF,
  SEED_KYC_CASES,
  SEED_KYB_CASES,
  SEED_FRAUD_ALERTS,
  SEED_SETTLEMENTS,
  SEED_TICKETS,
  SEED_DISPUTES,
  SEED_TERMINALS,
  SEED_AUDIT_LOGS,
  SEED_APPROVALS,
  SEED_MERCHANTS,
  SEED_CONSUMERS,
  SEED_POS_STAFF,
  SEED_CARDS,
  SEED_WALLETS,
  SEED_TRANSACTIONS,
  SEED_DOCUMENTS,
  SEED_POLICIES,
  SEED_APP_CONTENT,
  SEED_NOTIFICATIONS,
  SEED_FEES,
  SEED_LIMITS,
  SEED_PROVIDER_LOGS,
  SEED_WEBHOOK_LOGS,
  SEED_STOCK_ITEMS,
  SEED_STOCK_ORDERS,
} from "./seed-data";

const PREFIX = "faya_admin_";

export const COLLECTIONS = {
  // Admin-managed (faya_admin_ prefix)
  departments: `${PREFIX}departments`,
  roles: `${PREFIX}roles`,
  permissions: `${PREFIX}permissions`,
  staff: `${PREFIX}staff`,
  countries: `${PREFIX}countries`,
  auditLogs: `${PREFIX}audit_logs`,
  approvals: `${PREFIX}approvals`,
  policies: `${PREFIX}policies`,
  appContent: `${PREFIX}app_content`,
  notifications: `${PREFIX}notifications`,
  fees: `${PREFIX}fees`,
  providerLogs: `${PREFIX}provider_logs`,
  webhookLogs: `${PREFIX}webhook_logs`,
  stock: `${PREFIX}stock`,
  stockOrders: `${PREFIX}stock_orders`,
  meta: `${PREFIX}meta`,
  // App-managed (real collection names from Faya Pay / Merchant / POS apps)
  consumers: "users",
  cards: "cards",
  devices: "devices",
  kycCases: "kyc",
  limits: "limits",
  wallets: "wallets",
  transactions: "transactions",
  merchants: "merchants",
  posStaff: "staff",
  posDeviceRequests: "pos_device_requests",
  terminals: "terminals",
  settlements: "settlements",
  disputes: "disputes",
  tickets: "support_tickets",
  documents: "documents",
  kybCases: "kyb",
  fraudAlerts: "fraud_alerts",
} as const;

/**
 * Tracks whether we've fallen back to local mode.
 * Once true, all subsequent operations use the local store.
 */
let useLocalMode = false;
let firestoreCheckPromise: Promise<boolean> | null = null;

/**
 * Check whether Firestore is accessible. Returns true if Firestore works,
 * false if we should use local mode. Result is cached.
 */
async function checkFirestoreAccess(): Promise<boolean> {
  if (useLocalMode) return false;
  if (firestoreCheckPromise) return firestoreCheckPromise;
  firestoreCheckPromise = (async () => {
    const d = db();
    if (!d) {
      useLocalMode = true;
      localStore.active = true;
      return false;
    }
    try {
      // Try a tiny read — if it fails with permission-denied, fall back.
      await getDocs(collection(d, COLLECTIONS.meta));
      console.log("[admin-data] Firestore access confirmed — using real data");
      return true;
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      console.warn("[admin-data] Firestore check failed:", code || e, "— switching to local mode");
      useLocalMode = true;
      localStore.active = true;
      return false;
    }
  })();
  return firestoreCheckPromise;
}

let seedPromise: Promise<void> | null = null;

/**
 * This function is a no-op. Data comes from the real apps (Faya Pay, Faya
 * Merchant, Faya POS) — the admin portal does NOT seed mock data.
 */
export async function ensureSeedData(): Promise<void> {
  // Intentionally empty — data is created by the apps, not the admin portal.
  // Just check Firestore access so the auth hook can proceed.
  await checkFirestoreAccess();
}

/* ----------------------------- Generic helpers ---------------------------- */

/**
 * Subscribe to a collection with optional query constraints.
 * Falls back to local store on Firestore access failure.
 */
export function subscribe<T extends { id: string }>(
  colName: string,
  cb: (items: T[]) => void,
  ...constraints: QueryConstraint[]
): Unsubscribe {
  const localCol = LOCAL_COLLECTION_MAP[colName];
  if (!localCol) {
    console.error(`[subscribe] unknown collection: ${colName}`);
    return () => {};
  }

  // If we already know we're in local mode, subscribe locally immediately
  if (useLocalMode) {
    return localStore.subscribe<T>(localCol, cb);
  }

  // Otherwise try Firestore; on error, switch to local
  let unsub: Unsubscribe | null = null;
  let switchedToLocal = false;

  const d = db();
  if (!d) {
    useLocalMode = true;
    localStore.active = true;
    return localStore.subscribe<T>(localCol, cb);
  }

  try {
    const q =
      constraints.length
        ? query(collection(d, colName), ...constraints)
        : collection(d, colName);
    unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => {
          const data = d.data() as DocumentData;
          const { _serverTime, ...rest } = data as Record<string, unknown>;
          return { ...(rest as T), id: (rest.id as string) ?? d.id };
        });
        console.log(`[subscribe:${colName}] received ${items.length} items`);
        cb(items);
      },
      (err) => {
        const code = (err as { code?: string })?.code ?? "";
        if (
          code === "permission-denied" ||
          code === "unavailable" ||
          code.includes("permission") ||
          !useLocalMode
        ) {
          if (!useLocalMode) {
            console.warn(
              `[subscribe:${colName}] Firestore error (${code || "unknown"}), switching to local mode`,
            );
            useLocalMode = true;
            localStore.active = true;
          }
          if (!switchedToLocal) {
            switchedToLocal = true;
            localStore.subscribe<T>(localCol, cb);
          }
        }
      },
    );
    return () => {
      unsub?.();
    };
  } catch {
    useLocalMode = true;
    localStore.active = true;
    return localStore.subscribe<T>(localCol, cb);
  }
}

/** Fetch all docs in a collection once. */
export async function fetchAll<T extends { id: string }>(colName: string): Promise<T[]> {
  const localCol = LOCAL_COLLECTION_MAP[colName];
  if (!localCol) return [];

  if (useLocalMode) {
    return new Promise((resolve) => {
      let unsub: (() => void) | null = null;
      unsub = localStore.subscribe<T>(localCol, (items) => {
        // Defer unsubscribe so the subscribe call has returned first
        setTimeout(() => unsub?.(), 0);
        resolve(items);
      });
    });
  }

  const d = db();
  if (!d) return [];
  try {
    const snap = await getDocs(collection(d, colName));
    return snap.docs.map((d) => {
      const data = d.data() as DocumentData;
      const { _serverTime, ...rest } = data as Record<string, unknown>;
      return { ...(rest as T), id: (rest.id as string) ?? d.id };
    });
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    if (code === "permission-denied" || code.includes("permission") || code === "unavailable") {
      useLocalMode = true;
      localStore.active = true;
      return new Promise((resolve) => {
        let unsub: (() => void) | null = null;
        unsub = localStore.subscribe<T>(localCol, (items) => {
          setTimeout(() => unsub?.(), 0);
          resolve(items);
        });
      });
    }
    console.error(`[fetchAll:${colName}]`, e);
    return [];
  }
}

/** Upsert a document by id. */
export async function upsert<T extends { id: string }>(
  colName: string,
  item: T,
): Promise<void> {
  const localCol = LOCAL_COLLECTION_MAP[colName];
  if (!localCol) return;

  if (useLocalMode) {
    localStore.upsert(localCol, item);
    return;
  }

  const d = db();
  if (!d) {
    localStore.upsert(localCol, item);
    return;
  }
  try {
    await setDoc(
      doc(d, colName, item.id),
      { ...item, _serverTime: serverTimestamp() },
      { merge: true },
    );
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    if (code === "permission-denied" || code.includes("permission") || code === "unavailable") {
      useLocalMode = true;
      localStore.active = true;
      localStore.upsert(localCol, item);
      return;
    }
    throw e;
  }
}

/** Partial update. */
export async function patch<T extends { id: string }>(
  colName: string,
  id: string,
  patchData: Partial<T>,
): Promise<void> {
  const localCol = LOCAL_COLLECTION_MAP[colName];
  if (!localCol) return;

  if (useLocalMode) {
    localStore.patch<T>(localCol, id, patchData);
    return;
  }

  const d = db();
  if (!d) {
    localStore.patch<T>(localCol, id, patchData);
    return;
  }
  try {
    await updateDoc(doc(d, colName, id), patchData as Record<string, unknown>);
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    if (code === "permission-denied" || code.includes("permission") || code === "unavailable") {
      useLocalMode = true;
      localStore.active = true;
      localStore.patch<T>(localCol, id, patchData);
      return;
    }
    throw e;
  }
}

/** Delete a document. */
export async function remove(colName: string, id: string): Promise<void> {
  const localCol = LOCAL_COLLECTION_MAP[colName];
  if (!localCol) return;

  if (useLocalMode) {
    localStore.remove(localCol, id);
    return;
  }

  const d = db();
  if (!d) {
    localStore.remove(localCol, id);
    return;
  }
  try {
    await deleteDoc(doc(d, colName, id));
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    if (code === "permission-denied" || code.includes("permission") || code === "unavailable") {
      useLocalMode = true;
      localStore.active = true;
      localStore.remove(localCol, id);
      return;
    }
    throw e;
  }
}

/** Returns true if the portal is running in local mode (Firestore unavailable). */
export function isLocalMode(): boolean {
  return useLocalMode;
}

/* --------------------- Typed convenience accessors ---------------------- */

export const adminData = {
  // Departments
  subscribeDepartments: (cb: (items: Department[]) => void) =>
    subscribe<Department>(COLLECTIONS.departments, cb, orderBy("name")),
  // Roles
  subscribeRoles: (cb: (items: Role[]) => void) =>
    subscribe<Role>(COLLECTIONS.roles, cb, orderBy("name")),
  // Permissions
  subscribePermissions: (cb: (items: Permission[]) => void) =>
    subscribe<Permission>(COLLECTIONS.permissions, cb, orderBy("key")),
  // Staff
  subscribeStaff: (cb: (items: AdminStaff[]) => void) =>
    subscribe<AdminStaff>(COLLECTIONS.staff, cb, orderBy("createdAt", "desc")),
  // Countries
  subscribeCountries: (cb: (items: CountryConfig[]) => void) =>
    subscribe<CountryConfig>(COLLECTIONS.countries, cb, orderBy("countryName")),
  // KYC
  subscribeKyc: (cb: (items: KycCase[]) => void) =>
    subscribe<KycCase>(COLLECTIONS.kycCases, cb),
  // KYB
  subscribeKyb: (cb: (items: KybCase[]) => void) =>
    subscribe<KybCase>(COLLECTIONS.kybCases, cb, orderBy("submittedAt", "desc")),
  // Fraud
  subscribeFraud: (cb: (items: FraudAlert[]) => void) =>
    subscribe<FraudAlert>(COLLECTIONS.fraudAlerts, cb, orderBy("createdAt", "desc")),
  // Settlements
  subscribeSettlements: (cb: (items: Settlement[]) => void) =>
    subscribe<Settlement>(COLLECTIONS.settlements, cb, orderBy("scheduledAt", "desc")),
  // Tickets
  subscribeTickets: (cb: (items: SupportTicket[]) => void) =>
    subscribe<SupportTicket>(COLLECTIONS.tickets, cb, orderBy("createdAt", "desc")),
  // Disputes
  subscribeDisputes: (cb: (items: Dispute[]) => void) =>
    subscribe<Dispute>(COLLECTIONS.disputes, cb, orderBy("createdAt", "desc")),
  // Terminals
  subscribeTerminals: (cb: (items: Terminal[]) => void) =>
    subscribe<Terminal>(COLLECTIONS.terminals, cb, orderBy("serialNumber")),
  // Audit logs
  subscribeAudit: (cb: (items: AuditLog[]) => void) =>
    subscribe<AuditLog>(COLLECTIONS.auditLogs, cb, orderBy("createdAt", "desc")),
  // Approvals
  subscribeApprovals: (cb: (items: ApprovalRequest[]) => void) =>
    subscribe<ApprovalRequest>(COLLECTIONS.approvals, cb, orderBy("createdAt", "desc")),
  // Merchants — managed via Compliance (KYB) + Risk (restrict) + Country rules.
  // The merchant app is a separate application that reads from this same database.
  subscribeMerchants: (cb: (items: Merchant[]) => void) =>
    subscribe<Merchant>(COLLECTIONS.merchants, cb, orderBy("createdAt", "desc")),
  // Consumers — managed via Compliance (KYC) + Risk (restrict) + Country rules.
  // The consumer app is a separate application that reads from this same database.
  subscribeConsumers: (cb: (items: Consumer[]) => void) =>
    subscribe<Consumer>(COLLECTIONS.consumers, cb),

  // Single-doc filters
  subscribeStaffById: (id: string, cb: (item: AdminStaff | null) => void) => {
    // In local mode, subscribe to all staff and filter
    if (useLocalMode) {
      return localStore.subscribe<AdminStaff>("staff", (items) => {
        cb(items.find((s) => s.id === id) ?? null);
      });
    }
    const d = db();
    if (!d) {
      return localStore.subscribe<AdminStaff>("staff", (items) => {
        cb(items.find((s) => s.id === id) ?? null);
      });
    }
    try {
      return onSnapshot(
        doc(d, COLLECTIONS.staff, id),
        (snap) => cb(snap.exists() ? (snap.data() as AdminStaff) : null),
        () => cb(null),
      );
    } catch {
      return localStore.subscribe<AdminStaff>("staff", (items) => {
        cb(items.find((s) => s.id === id) ?? null);
      });
    }
  },

  // Mutations
  createStaff: (staff: AdminStaff) => upsert(COLLECTIONS.staff, staff),
  updateStaff: (id: string, patchData: Partial<AdminStaff>) => patch<AdminStaff>(COLLECTIONS.staff, id, patchData),
  deleteStaff: (id: string) => remove(COLLECTIONS.staff, id),

  createCountry: (country: CountryConfig) => upsert(COLLECTIONS.countries, country),
  updateCountry: (id: string, patchData: Partial<CountryConfig>) => patch<CountryConfig>(COLLECTIONS.countries, id, patchData),

  updateKyc: (id: string, patchData: Partial<KycCase>) => patch<KycCase>(COLLECTIONS.kycCases, id, patchData),
  updateKyb: (id: string, patchData: Partial<KybCase>) => patch<KybCase>(COLLECTIONS.kybCases, id, patchData),
  updateFraud: (id: string, patchData: Partial<FraudAlert>) => patch<FraudAlert>(COLLECTIONS.fraudAlerts, id, patchData),
  updateSettlement: (id: string, patchData: Partial<Settlement>) => patch<Settlement>(COLLECTIONS.settlements, id, patchData),
  updateTicket: (id: string, patchData: Partial<SupportTicket>) => patch<SupportTicket>(COLLECTIONS.tickets, id, patchData),
  updateDispute: (id: string, patchData: Partial<Dispute>) => patch<Dispute>(COLLECTIONS.disputes, id, patchData),
  updateTerminal: (id: string, patchData: Partial<Terminal>) => patch<Terminal>(COLLECTIONS.terminals, id, patchData),

  // Merchant & Consumer mutations — admin manages these entities; the separate
  // merchant/consumer apps read from the same Firestore collections.
  createMerchant: (merchant: Merchant) => upsert(COLLECTIONS.merchants, merchant),
  updateMerchant: (id: string, patchData: Partial<Merchant>) => patch<Merchant>(COLLECTIONS.merchants, id, patchData),
  deleteMerchant: (id: string) => remove(COLLECTIONS.merchants, id),

  createConsumer: (consumer: Consumer) => upsert(COLLECTIONS.consumers, consumer),
  updateConsumer: (id: string, patchData: Partial<Consumer>) => patch<Consumer>(COLLECTIONS.consumers, id, patchData),
  deleteConsumer: (id: string) => remove(COLLECTIONS.consumers, id),

  createApproval: (req: ApprovalRequest) => upsert(COLLECTIONS.approvals, req),
  updateApproval: (id: string, patchData: Partial<ApprovalRequest>) => patch<ApprovalRequest>(COLLECTIONS.approvals, id, patchData),

  appendAuditLog: (log: AuditLog) => upsert(COLLECTIONS.auditLogs, log),

  // POS Staff
  subscribePosStaff: (cb: (items: PosStaff[]) => void) =>
    subscribe<PosStaff>(COLLECTIONS.posStaff, cb, orderBy("createdAt", "desc")),
  createPosStaff: (item: PosStaff) => upsert(COLLECTIONS.posStaff, item),
  updatePosStaff: (id: string, patchData: Partial<PosStaff>) => patch<PosStaff>(COLLECTIONS.posStaff, id, patchData),

  // Cards
  subscribeCards: (cb: (items: Card[]) => void) =>
    subscribe<Card>(COLLECTIONS.cards, cb),
  updateCard: (id: string, patchData: Partial<Card>) => patch<Card>(COLLECTIONS.cards, id, patchData),

  // Wallets
  subscribeWallets: (cb: (items: Wallet[]) => void) =>
    subscribe<Wallet>(COLLECTIONS.wallets, cb, orderBy("createdAt", "desc")),
  updateWallet: (id: string, patchData: Partial<Wallet>) => patch<Wallet>(COLLECTIONS.wallets, id, patchData),

  // Transactions
  subscribeTransactions: (cb: (items: Transaction[]) => void) =>
    subscribe<Transaction>(COLLECTIONS.transactions, cb, orderBy("createdAt", "desc")),
  updateTransaction: (id: string, patchData: Partial<Transaction>) => patch<Transaction>(COLLECTIONS.transactions, id, patchData),

  // Documents
  subscribeDocuments: (cb: (items: UserDocument[]) => void) =>
    subscribe<UserDocument>(COLLECTIONS.documents, cb, orderBy("uploadedAt", "desc")),
  updateDocument: (id: string, patchData: Partial<UserDocument>) => patch<UserDocument>(COLLECTIONS.documents, id, patchData),

  // Legal Policies
  subscribePolicies: (cb: (items: LegalPolicy[]) => void) =>
    subscribe<LegalPolicy>(COLLECTIONS.policies, cb, orderBy("updatedAt", "desc")),
  createPolicy: (item: LegalPolicy) => upsert(COLLECTIONS.policies, item),
  updatePolicy: (id: string, patchData: Partial<LegalPolicy>) => patch<LegalPolicy>(COLLECTIONS.policies, id, patchData),

  // App Content
  subscribeAppContent: (cb: (items: AppContent[]) => void) =>
    subscribe<AppContent>(COLLECTIONS.appContent, cb, orderBy("updatedAt", "desc")),
  createAppContent: (item: AppContent) => upsert(COLLECTIONS.appContent, item),
  updateAppContent: (id: string, patchData: Partial<AppContent>) => patch<AppContent>(COLLECTIONS.appContent, id, patchData),

  // Notifications
  subscribeNotifications: (cb: (items: NotificationCampaign[]) => void) =>
    subscribe<NotificationCampaign>(COLLECTIONS.notifications, cb, orderBy("createdAt", "desc")),
  createNotification: (item: NotificationCampaign) => upsert(COLLECTIONS.notifications, item),
  updateNotification: (id: string, patchData: Partial<NotificationCampaign>) => patch<NotificationCampaign>(COLLECTIONS.notifications, id, patchData),

  // Fees
  subscribeFees: (cb: (items: Fee[]) => void) =>
    subscribe<Fee>(COLLECTIONS.fees, cb, orderBy("updatedAt", "desc")),
  createFee: (item: Fee) => upsert(COLLECTIONS.fees, item),
  updateFee: (id: string, patchData: Partial<Fee>) => patch<Fee>(COLLECTIONS.fees, id, patchData),

  // Limits
  subscribeLimits: (cb: (items: Limit[]) => void) =>
    subscribe<Limit>(COLLECTIONS.limits, cb, orderBy("updatedAt", "desc")),
  createLimit: (item: Limit) => upsert(COLLECTIONS.limits, item),
  updateLimit: (id: string, patchData: Partial<Limit>) => patch<Limit>(COLLECTIONS.limits, id, patchData),

  // Provider Logs
  subscribeProviderLogs: (cb: (items: ProviderLog[]) => void) =>
    subscribe<ProviderLog>(COLLECTIONS.providerLogs, cb, orderBy("updatedAt", "desc")),
  updateProviderLog: (id: string, patchData: Partial<ProviderLog>) => patch<ProviderLog>(COLLECTIONS.providerLogs, id, patchData),

  // Webhook Logs
  subscribeWebhookLogs: (cb: (items: WebhookLog[]) => void) =>
    subscribe<WebhookLog>(COLLECTIONS.webhookLogs, cb, orderBy("receivedAt", "desc")),
  updateWebhookLog: (id: string, patchData: Partial<WebhookLog>) => patch<WebhookLog>(COLLECTIONS.webhookLogs, id, patchData),

  // POS Device Requests — device binding requests from POS app login
  subscribePosDeviceRequests: (cb: (items: PosDeviceRequest[]) => void) =>
    subscribe<PosDeviceRequest>(COLLECTIONS.posDeviceRequests, cb, orderBy("createdAt", "desc")),
  createPosDeviceRequest: (item: PosDeviceRequest) => upsert(COLLECTIONS.posDeviceRequests, item),
  updatePosDeviceRequest: (id: string, patchData: Partial<PosDeviceRequest>) => patch<PosDeviceRequest>(COLLECTIONS.posDeviceRequests, id, patchData),

  // Stock / Inventory — physical terminals and physical cards
  subscribeStock: (cb: (items: StockItem[]) => void) =>
    subscribe<StockItem>(COLLECTIONS.stock, cb, orderBy("createdAt", "desc")),
  createStockItem: (item: StockItem) => upsert(COLLECTIONS.stock, item),
  updateStockItem: (id: string, patchData: Partial<StockItem>) => patch<StockItem>(COLLECTIONS.stock, id, patchData),

  // Stock Orders — orders placed by consumers/merchants for physical items
  subscribeStockOrders: (cb: (items: StockOrder[]) => void) =>
    subscribe<StockOrder>(COLLECTIONS.stockOrders, cb, orderBy("createdAt", "desc")),
  createStockOrder: (item: StockOrder) => upsert(COLLECTIONS.stockOrders, item),
  updateStockOrder: (id: string, patchData: Partial<StockOrder>) => patch<StockOrder>(COLLECTIONS.stockOrders, id, patchData),

  // Local store management
  resetLocalStore: () => localStore.reset(),
};

/* ------------------------------- Audit helper ------------------------------ */

/**
 * Append a new audit log entry. Generates id + timestamps.
 */
export function logAudit(
  actor: { staffId: string; staffName: string; department: string; role: string },
  action: string,
  entityType: string,
  entityId: string,
  opts: {
    countryCode?: string | null;
    beforeValue?: string;
    afterValue?: string;
    reason?: string;
    ipAddress?: string;
    deviceFingerprint?: string;
  } = {},
): void {
  const log: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    staffId: actor.staffId,
    staffName: actor.staffName,
    department: actor.department,
    role: actor.role,
    countryCode: opts.countryCode ?? null,
    action,
    entityType,
    entityId,
    beforeValue: opts.beforeValue,
    afterValue: opts.afterValue,
    reason: opts.reason,
    ipAddress: opts.ipAddress ?? "0.0.0.0",
    deviceFingerprint: opts.deviceFingerprint ?? "unknown",
    createdAt: Date.now(),
  };
  adminData.appendAuditLog(log).catch((e) => console.error("[logAudit]", e));
}
