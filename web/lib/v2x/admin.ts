import type { UserRecord } from "@/lib/v2x/types";

// ── Hardcoded admin allow-list ──────────────────────────────────────────────
export const ADMIN_EMAILS_HARDCODED: readonly string[] = [
  "ksthejas060@gmail.com",
  "kstejas2718@gmail.com",
  "vishal797577@gmail.com",
] as const;

// ── Demo admin credentials (fallback for non-Google access) ────────────────
const ADMIN_CRED_USERNAME = "admin";
const ADMIN_CRED_PASSWORD = "V2X@2024";

export function checkAdminCredentials(username: string, password: string): boolean {
  return username === ADMIN_CRED_USERNAME && password === ADMIN_CRED_PASSWORD;
}

// ── localStorage keys ───────────────────────────────────────────────────────
const USERS_KEY = "v2x-users";
const EXTRA_ADMINS_KEY = "v2x-extra-admins";

// ── Extra admin emails (runtime-added via admin UI) ────────────────────────
export function getExtraAdminEmails(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EXTRA_ADMINS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addAdminEmail(email: string): void {
  const lower = email.toLowerCase().trim();
  if (!lower) return;
  const extras = getExtraAdminEmails();
  if (!extras.includes(lower)) {
    extras.push(lower);
    localStorage.setItem(EXTRA_ADMINS_KEY, JSON.stringify(extras));
  }
}

export function removeAdminEmail(email: string): void {
  const lower = email.toLowerCase().trim();
  if (ADMIN_EMAILS_HARDCODED.includes(lower)) return; // protect hardcoded list
  const extras = getExtraAdminEmails().filter((e) => e !== lower);
  localStorage.setItem(EXTRA_ADMINS_KEY, JSON.stringify(extras));
}

export function isAdminEmail(email: string): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  if (ADMIN_EMAILS_HARDCODED.includes(lower)) return true;
  return getExtraAdminEmails().includes(lower);
}

// ── User records ────────────────────────────────────────────────────────────
export function loadUsers(): UserRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as UserRecord[]) : [];
  } catch {
    return [];
  }
}

function persistUsers(users: UserRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function upsertUser(partial: Omit<UserRecord, "addedAt">): UserRecord[] {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === partial.email.toLowerCase());
  const existing = idx >= 0 ? users[idx] : null;
  const record: UserRecord = {
    ...partial,
    addedAt: existing?.addedAt ?? new Date().toISOString(),
  };
  if (idx >= 0) {
    users[idx] = record;
  } else {
    users.push(record);
  }
  persistUsers(users);
  return users;
}

export function banUser(email: string): UserRecord[] {
  const users = loadUsers();
  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  return upsertUser({
    email,
    role: existing?.role ?? "viewer",
    status: "banned",
    name: existing?.name,
  });
}

export function unbanUser(email: string): UserRecord[] {
  const users = loadUsers();
  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!existing) return users;
  return upsertUser({ ...existing, status: "active" });
}

export function removeUser(email: string): UserRecord[] {
  const users = loadUsers().filter((u) => u.email.toLowerCase() !== email.toLowerCase());
  persistUsers(users);
  return users;
}
