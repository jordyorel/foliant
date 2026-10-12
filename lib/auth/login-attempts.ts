import {createCipheriv, createDecipheriv, createHash, randomBytes} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync} from "node:fs";
import path from "node:path";
import {storageRoot} from "@/lib/storage/root";

export const loginAttemptCookie = "foliant_login_attempt";

type Session = {access_token: string; refresh_token: string};
type AttemptState = "pending" | "confirmed";

type LoginAttempt = {
  id: string;
  verifierHash: string;
  state: AttemptState;
  sessionCiphertext?: string;
  expiresAt: string;
  createdAt: string;
};

const attemptTtlMs = 10 * 60 * 1000;
const attemptsFile = path.join(storageRoot, "auth", "login-attempts.json");

function isSupabase() {
  return process.env.WORKSPACE_STORAGE_DRIVER === "supabase";
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) throw new Error("Cross-device sign-in requires the Supabase server key.");
  return {url: url.replace(/\/$/, ""), secretKey};
}

async function supabaseRequest(pathname: string, init: RequestInit = {}) {
  const {url, secretKey} = supabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", secretKey);
  headers.set("Authorization", `Bearer ${secretKey}`);
  const response = await fetch(`${url}${pathname}`, {...init, headers});
  if (!response.ok) throw new Error(`Supabase sign-in attempt request failed: ${response.status}`);
  return response;
}

function key() {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Cross-device sign-in requires the Supabase server key.");
  return createHash("sha256").update(`foliant-login-transfer:${secret}`).digest();
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function encrypt(session: Session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}

function decrypt(value: string): Session | null {
  const [iv, ciphertext, tag] = value.split(".");
  if (!iv || !ciphertext || !tag) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const session = JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8")) as Session;
    return typeof session.access_token === "string" && typeof session.refresh_token === "string" ? session : null;
  } catch {
    return null;
  }
}

function isAttempt(value: unknown): value is LoginAttempt {
  return Boolean(value) && typeof value === "object" &&
    typeof (value as LoginAttempt).id === "string" &&
    typeof (value as LoginAttempt).verifierHash === "string" &&
    ["pending", "confirmed"].includes((value as LoginAttempt).state) &&
    typeof (value as LoginAttempt).expiresAt === "string" &&
    typeof (value as LoginAttempt).createdAt === "string";
}

function readLocalAttempts(now = Date.now()) {
  try {
    const attempts = JSON.parse(readFileSync(attemptsFile, "utf8")) as unknown;
    return Array.isArray(attempts) ? attempts.filter(isAttempt).filter((attempt) => Date.parse(attempt.expiresAt) > now) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Error("Unable to read sign-in attempts", {cause: error});
  }
}

function writeLocalAttempts(attempts: LoginAttempt[]) {
  const directory = path.dirname(attemptsFile);
  mkdirSync(directory, {recursive: true, mode: 0o700});
  const temporary = path.join(directory, `${crypto.randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, JSON.stringify(attempts), {encoding: "utf8", mode: 0o600});
    renameSync(temporary, attemptsFile);
  } finally {
    try { unlinkSync(temporary); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

function parseCookie(value: string | undefined) {
  const [id, verifier] = value?.split(".") ?? [];
  return id && verifier && /^[a-f0-9-]{36}$/.test(id) && /^[A-Za-z0-9_-]{40,}$/.test(verifier) ? {id, verifier} : null;
}

function cookieValue(request: Request) {
  const value = request.headers.get("cookie")?.split(";").map((item) => item.trim())
    .find((item) => item.startsWith(`${loginAttemptCookie}=`))?.slice(loginAttemptCookie.length + 1);
  return parseCookie(value);
}

function toSupabaseRow(attempt: LoginAttempt) {
  return {
    id: attempt.id,
    verifier_hash: attempt.verifierHash,
    state: attempt.state,
    session_ciphertext: attempt.sessionCiphertext ?? null,
    expires_at: attempt.expiresAt,
    created_at: attempt.createdAt
  };
}

function fromSupabaseRow(row: Record<string, unknown>): LoginAttempt | null {
  const attempt = {
    id: row.id,
    verifierHash: row.verifier_hash,
    state: row.state,
    sessionCiphertext: row.session_ciphertext ?? undefined,
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
  return isAttempt(attempt) ? attempt : null;
}

export async function createLoginAttempt() {
  const id = crypto.randomUUID();
  const verifier = randomBytes(32).toString("base64url");
  const now = new Date();
  const attempt: LoginAttempt = {
    id,
    verifierHash: hash(verifier),
    state: "pending",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + attemptTtlMs).toISOString()
  };

  if (isSupabase()) {
    await supabaseRequest("/rest/v1/auth_login_attempts", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(toSupabaseRow(attempt))
    });
  } else {
    const attempts = readLocalAttempts();
    attempts.push(attempt);
    writeLocalAttempts(attempts);
  }

  return {id, cookie: `${id}.${verifier}`, expiresAt: attempt.expiresAt};
}

export async function discardLoginAttempt(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) return;
  if (isSupabase()) {
    await supabaseRequest(`/rest/v1/auth_login_attempts?id=eq.${encodeURIComponent(id)}`, {method: "DELETE"});
    return;
  }
  writeLocalAttempts(readLocalAttempts().filter((attempt) => attempt.id !== id));
}

export async function confirmLoginAttempt(id: string, session: Session) {
  if (!/^[a-f0-9-]{36}$/.test(id)) return false;
  const ciphertext = encrypt(session);
  if (isSupabase()) {
    const response = await supabaseRequest(`/rest/v1/auth_login_attempts?id=eq.${encodeURIComponent(id)}&state=eq.pending&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`, {
      method: "PATCH",
      headers: {"Content-Type": "application/json", "Prefer": "return=representation"},
      body: JSON.stringify({state: "confirmed", session_ciphertext: ciphertext})
    });
    return (await response.json() as unknown[]).length === 1;
  }
  const attempts = readLocalAttempts();
  const attempt = attempts.find((item) => item.id === id && item.state === "pending");
  if (!attempt) return false;
  attempt.state = "confirmed";
  attempt.sessionCiphertext = ciphertext;
  writeLocalAttempts(attempts);
  return true;
}

export async function claimLoginAttempt(request: Request) {
  const cookie = cookieValue(request);
  if (!cookie) return null;
  if (isSupabase()) {
    const response = await supabaseRequest(`/rest/v1/auth_login_attempts?id=eq.${encodeURIComponent(cookie.id)}&verifier_hash=eq.${encodeURIComponent(hash(cookie.verifier))}&state=eq.confirmed&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`, {
      method: "DELETE",
      headers: {"Prefer": "return=representation"}
    });
    const row = (await response.json() as Record<string, unknown>[])[0];
    const attempt = row ? fromSupabaseRow(row) : null;
    return attempt?.sessionCiphertext ? decrypt(attempt.sessionCiphertext) : null;
  }
  const attempts = readLocalAttempts();
  const index = attempts.findIndex((attempt) => attempt.id === cookie.id && attempt.state === "confirmed" && attempt.verifierHash === hash(cookie.verifier));
  if (index < 0) return null;
  const [attempt] = attempts.splice(index, 1);
  writeLocalAttempts(attempts);
  return attempt.sessionCiphertext ? decrypt(attempt.sessionCiphertext) : null;
}
