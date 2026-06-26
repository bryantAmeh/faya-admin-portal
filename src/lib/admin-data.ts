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
} from "./seed-data";

const PREFIX = "faya_admin_";

export const COLLECTIONS = {
  departments: `${PREFIX}departments`,
  roles: `${PREFIX}roles`,
  permissions: `${PREFIX}permissions`,
  staff: `${PREFIX}staff`,
  countries: `${PREFIX}countries`,
  kycCases: `${PREFIX}kyc_cases`,
  kybCases: `${PREFIX}kyb_cases`,
  fraudAlerts: `${PREFIX}fraud_alerts`,
  settlements: `${PREFIX}settlements`,
  tickets: `${PREFIX}tickets`,
  disputes: `${PREFIX}disputes`,
  terminals: `${PREFIX}terminals`,
  auditLogs: `${PREFIX}audit_logs`,
  approvals: `${PREFIX}approvals`,
  merchants: `${PREFIX}merchants`,
  consumers: `${PREFIX}consumers`,
  meta: `${PREFIX}meta`,
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
      return true;
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      if (
        code === "permission-denied" ||
        code === "unavailable" ||
        code === "unimplemented" ||
        code.includes("permission")
      ) {
        console.warn(
          "[admin-data] Firestore access denied — switching to local mode. Configure Firestore security rules to enable cloud sync.",
          code,
        );
        useLocalMode = true;
        localStore.active = true;
        return false;
      }
      // Other errors — also fall back to keep the portal usable
      console.warn("[admin-data] Firestore check failed, using local mode:", code || e);
      useLocalMode = true;
      localStore.active = true;
      return false;
    }
  })();
  return firestoreCheckPromise;
}

let seedPromise: Promise<void> | null = null;

/**
 * Seed all reference collections if they are empty.
 * In local mode, this is a no-op (the local store seeds itself).
 */
export async function ensureSeedData(): Promise<void> {
  // Always run the access check first
  const ok = await checkFirestoreAccess();
  if (!ok) {
    // Local mode — store self-seeds from SEED_* on first read
    return;
  }
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      const d = db();
      if (!d) return;
      const metaSnap = await getDocs(collection(d, COLLECTIONS.meta));
      const existing = metaSnap.docs.find((doc) => doc.id === "seed_status");
      if (existing?.data()?.seeded) return;

      const seedBatch = async <T extends { id: string }>(
        colName: string,
        items: T[],
      ) => {
        const batch = writeBatch(d);
        for (const item of items) {
          const ref = doc(d, colName, item.id);
          batch.set(ref, { ...item, _serverTime: serverTimestamp() }, { merge: false });
        }
        await batch.commit();
      };

      await seedBatch(COLLECTIONS.departments, SEED_DEPARTMENTS);
      await seedBatch(COLLECTIONS.roles, SEED_ROLES);
      await seedBatch(COLLECTIONS.permissions, SEED_PERMISSIONS);
      await seedBatch(COLLECTIONS.countries, SEED_COUNTRIES);
      await seedBatch(COLLECTIONS.staff, SEED_STAFF);
      await seedBatch(COLLECTIONS.kycCases, SEED_KYC_CASES);
      await seedBatch(COLLECTIONS.kybCases, SEED_KYB_CASES);
      await seedBatch(COLLECTIONS.fraudAlerts, SEED_FRAUD_ALERTS);
      await seedBatch(COLLECTIONS.settlements, SEED_SETTLEMENTS);
      await seedBatch(COLLECTIONS.tickets, SEED_TICKETS);
      await seedBatch(COLLECTIONS.disputes, SEED_DISPUTES);
      await seedBatch(COLLECTIONS.terminals, SEED_TERMINALS);
      await seedBatch(COLLECTIONS.auditLogs, SEED_AUDIT_LOGS);
      await seedBatch(COLLECTIONS.approvals, SEED_APPROVALS);
      await seedBatch(COLLECTIONS.merchants, SEED_MERCHANTS);
      await seedBatch(COLLECTIONS.consumers, SEED_CONSUMERS);

      await setDoc(doc(d, COLLECTIONS.meta, "seed_status"), {
        seeded: true,
        seededAt: serverTimestamp(),
      });
    } catch (e) {
      seedPromise = null;
      console.error("[ensureSeedData] failed:", e);
      throw e;
    }
  })();
  return seedPromise;
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
    subscribe<KycCase>(COLLECTIONS.kycCases, cb, orderBy("submittedAt", "desc")),
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
    subscribe<Consumer>(COLLECTIONS.consumers, cb, orderBy("createdAt", "desc")),

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
