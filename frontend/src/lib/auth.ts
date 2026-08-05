/**
 * Mock authentication for the Sentinel prototype.
 *
 * Accounts and sessions live in localStorage only — there is no server.
 * The public interface mirrors what a real auth provider (Supabase,
 * a FastAPI JWT endpoint, …) would expose, so this can be swapped later
 * without touching the pages that consume it.
 *
 * IMPORTANT: This is demo-grade auth. Passwords are SHA-256 hashed in the
 * browser (no salt, no rate limiting, no server) — never use this pattern
 * for production data. Do not store real credentials with it.
 */

export type SentinelRole = "officer" | "viewer";

export interface SentinelUser {
  id: string;
  name: string;
  email: string;
  /** Null until the onboarding wizard completes. */
  role: SentinelRole | null;
  /** Free-form organisation name, set during onboarding. */
  organization: string | null;
  onboarded: boolean;
  createdAt: string;
}

interface StoredUser extends SentinelUser {
  /** Hex digest of the password (mock only). */
  passwordHash: string;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

const USERS_KEY = "sentinel.users";
const SESSION_KEY = "sentinel.session";

/** Users are keyed by lowercased email so duplicates are easy to spot. */
function loadUsers(): Record<string, StoredUser> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const users = parsed as Record<string, StoredUser>;
      // Prototype previously offered "admin"; map it to viewer.
      for (const user of Object.values(users)) {
        if ((user.role as string | null) === "admin") {
          user.role = "viewer";
        }
      }
      return users;
    }
  } catch {
    // corrupted store — start fresh
  }
  return {};
}

function saveUsers(users: Record<string, StoredUser>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // storage unavailable — auth still works for the session only
  }
}

function loadSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function saveSession(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_KEY, userId);
  } catch {
    // ignore
  }
}

function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/** crypto.randomUUID with a small fallback for non-secure contexts. */
function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** SHA-256 hex digest of a string (Web Crypto). */
async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Reactive session store — lets the header/footer react to login/logout
// without a state library. `getSnapshot` must return a referentially stable
// value until the session actually changes (see useSyncExternalStore).
// ---------------------------------------------------------------------------

/** Cached current user; `undefined` means "not loaded yet" (SSR). */
let cachedSession: SentinelUser | null | undefined;
const listeners = new Set<() => void>();

export function authSubscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitChange(): void {
  for (const listener of listeners) listener();
}

/** Stable snapshot for useSyncExternalStore. */
export function readSession(): SentinelUser | null {
  if (cachedSession !== undefined) return cachedSession;
  cachedSession = findSessionUser();
  return cachedSession;
}

/** Snapshot for SSR — never touch localStorage there. */
export function readSessionServer(): SentinelUser | null {
  return null;
}

function findSessionUser(): SentinelUser | null {
  const id = loadSessionUserId();
  if (!id) return null;
  const users = loadUsers();
  const found = Object.values(users).find((u) => u.id === id);
  if (!found) return null;
  const { passwordHash, ...user } = found;
  void passwordHash;
  return user;
}

function invalidateSession(): void {
  cachedSession = undefined;
  emitChange();
}

// Keep multiple tabs in sync when a session changes elsewhere.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_KEY || event.key === USERS_KEY) {
      invalidateSession();
    }
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function registerUser(args: {
  name: string;
  email: string;
  password: string;
}): Promise<SentinelUser> {
  const name = args.name.trim();
  const email = args.email.trim().toLowerCase();

  if (name.length < 2) {
    throw new AuthError("Enter your full name (at least 2 characters).");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError("Enter a valid email address.");
  }
  if (args.password.length < 8) {
    throw new AuthError("Password must be at least 8 characters.");
  }

  const users = loadUsers();
  if (users[email]) {
    throw new AuthError("An account with this email already exists.");
  }

  const user: StoredUser = {
    id: uuid(),
    name,
    email,
    role: null,
    organization: null,
    onboarded: false,
    createdAt: new Date().toISOString(),
    passwordHash: await hashPassword(args.password),
  };
  users[email] = user;
  saveUsers(users);
  saveSession(user.id);
  invalidateSession();
  return toPublicUser(user);
}

export async function loginUser(args: {
  email: string;
  password: string;
}): Promise<SentinelUser> {
  const email = args.email.trim().toLowerCase();
  if (!email || !args.password) {
    throw new AuthError("Enter your email and password.");
  }

  const users = loadUsers();
  const stored = users[email];
  if (!stored) {
    throw new AuthError("No account found for this email. Register first.");
  }

  const hash = await hashPassword(args.password);
  if (hash !== stored.passwordHash) {
    throw new AuthError("Incorrect email or password.");
  }

  saveSession(stored.id);
  invalidateSession();
  return toPublicUser(stored);
}

export function getCurrentUser(): SentinelUser | null {
  return readSession();
}

export function isAuthenticated(): boolean {
  return readSession() !== null;
}

/** Persist profile changes (used by the onboarding wizard). */
export async function updateUser(
  patch: Partial<Pick<SentinelUser, "role" | "organization" | "onboarded" | "name">>,
): Promise<SentinelUser | null> {
  const current = readSession();
  if (!current) return null;
  const users = loadUsers();
  const stored = users[current.email];
  if (!stored) return null;

  const next: StoredUser = {
    ...stored,
    ...patch,
    email: stored.email,
    id: stored.id,
    createdAt: stored.createdAt,
    passwordHash: stored.passwordHash,
  };
  users[current.email] = next;
  saveUsers(users);
  invalidateSession();
  return toPublicUser(next);
}

export function logoutUser(): void {
  clearSession();
  invalidateSession();
}

function toPublicUser(stored: StoredUser): SentinelUser {
  const { passwordHash, ...user } = stored;
  void passwordHash;
  return user;
}
