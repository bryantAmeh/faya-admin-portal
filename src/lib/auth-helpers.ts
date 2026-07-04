import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Faya Admin Portal — custom password auth helper
 *
 * Consumer (Faya Pay) and merchant (Faya Business / Faya POS) authentication
 * is handled with bcrypt password hashes stored on the Firestore profile doc
 * (`users.passwordHash` / `merchants.passwordHash`), NOT Firebase Auth.
 *
 * Why not Firebase Auth for these accounts:
 *   Firebase Auth enforces ONE email = ONE password per project, which blocks
 *   the dual-account requirement (same email, independent consumer + merchant
 *   accounts with different passwords). Storing the hash on the profile doc
 *   makes the two accounts fully independent and makes account deletion
 *   trivially complete (delete the doc = delete the account).
 *
 * Firebase Auth is kept ONLY for admin portal staff login.
 */

const BCRYPT_ROUNDS = 10;

/** Hash a plaintext password with bcrypt. */
export function hashPassword(plaintext: string): string {
  return bcrypt.hashSync(plaintext, BCRYPT_ROUNDS);
}

/** Verify a plaintext password against a stored bcrypt hash. */
export function verifyPassword(plaintext: string, hash: string): boolean {
  if (!hash) return false;
  try {
    return bcrypt.compareSync(plaintext, hash);
  } catch {
    return false;
  }
}

/**
 * Session token = base64(payload).signature, where payload = {uid, role, exp}
 * and signature = HMAC-SHA256(payload, AUTH_SECRET). The consumer/merchant
 * apps store this token and send it as `Authorization: Bearer <token>` on
 * subsequent requests. Routes can verify it with verifyToken().
 */
const AUTH_SECRET =
  process.env.FAYA_AUTH_SECRET || "faya-portal-dev-secret-change-in-prod";

export interface SessionPayload {
  uid: string;
  role: "consumer" | "merchant";
  exp: number; // epoch ms
}

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/** Issue a session token for a consumer or merchant. */
export function issueToken(uid: string, role: "consumer" | "merchant"): string {
  const payload: SessionPayload = {
    uid,
    role,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", AUTH_SECRET).update(payloadB64).digest("hex");
  return `${payloadB64}.${sig}`;
}

/** Verify a session token. Returns the payload or null if invalid/expired. */
export function verifyToken(token: string): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const expectedSig = createHmac("sha256", AUTH_SECRET)
    .update(payloadB64)
    .digest("hex");
  // Constant-time comparison to avoid timing attacks.
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return false as unknown as null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (payload.role !== "consumer" && payload.role !== "merchant") return null;
    return payload;
  } catch {
    return null;
  }
}

/** Extract a Bearer token from a Request's Authorization header. */
export function extractBearerToken(request: Request): string | null {
  const h = request.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/** Generate a random alphanumeric password of the given length. */
export function generateTempPassword(length = 12): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}
