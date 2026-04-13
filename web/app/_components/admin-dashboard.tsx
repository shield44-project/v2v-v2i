"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useMemo } from "react";
import { readSnapshot, subscribeRealtime } from "@/lib/v2x/realtime";
import type { RealtimeSnapshot } from "@/lib/v2x/types";
import type { UserRecord } from "@/lib/v2x/types";
import type { MapMode } from "@/app/_components/live-map";
import {
  ADMIN_EMAILS_HARDCODED,
  checkAdminCredentials,
  isAdminEmail,
  addAdminEmail,
  removeAdminEmail,
  getExtraAdminEmails,
  loadUsers,
  upsertUser,
  banUser,
  unbanUser,
  removeUser,
} from "@/lib/v2x/admin";

const LiveMap = dynamic(() => import("@/app/_components/live-map"), { ssr: false });

type AdminDashboardProps = {
  currentUserEmail: string;
  isInitiallyAdmin: boolean;
};

type AdminTab = "operations" | "users" | "analytics";

function compactTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour12: false });
}

// ── Admin login gate ────────────────────────────────────────────────────────
function AdminLoginGate({ onUnlock }: { onUnlock: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkAdminCredentials(username, password)) {
      try { sessionStorage.setItem("v2x-admin-unlocked", "true"); } catch { /* ignore */ }
      onUnlock();
    } else {
      setError("Invalid credentials. Access denied.");
    }
  };

  return (
    <div className="mx-auto mt-12 max-w-md animate-fade-in-up">
      <div className="rounded-2xl border border-red-500/25 bg-zinc-950 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10">
          <span className="text-2xl">🔐</span>
        </div>
        <p className="text-xs uppercase tracking-[0.2em] text-red-400">Restricted Area</p>
        <h2 className="text-gradient mt-2 text-2xl font-bold">Admin Access</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Sign in with a whitelisted Google account or enter admin credentials below.
        </p>

        <form className="mt-6 space-y-3 text-left" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Username</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-black px-4 py-3 text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-black px-4 py-3 text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary w-full cursor-pointer mt-2">
            Unlock Admin Panel
          </button>
        </form>

        <p className="mt-6 text-xs text-zinc-700">
          Authorised Google accounts: {ADMIN_EMAILS_HARDCODED.length} pre-approved + runtime additions
        </p>
      </div>
    </div>
  );
}

// ── Main admin dashboard ────────────────────────────────────────────────────
export default function AdminDashboard({ currentUserEmail, isInitiallyAdmin }: AdminDashboardProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot>(() => readSnapshot());
  const [tab, setTab] = useState<AdminTab>("operations");
  const [mapMode, setMapMode] = useState<MapMode>("street");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [extraAdmins, setExtraAdmins] = useState<string[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "warning" | "critical">("all");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRecord["role"]>("viewer");

  // Check unlock state on mount
  useEffect(() => {
    let unlocked = isInitiallyAdmin;
    if (!unlocked) {
      try {
        unlocked = sessionStorage.getItem("v2x-admin-unlocked") === "true";
      } catch { /* ignore */ }
    }
    if (!unlocked) {
      unlocked = isAdminEmail(currentUserEmail);
    }
    setIsUnlocked(unlocked);
  }, [isInitiallyAdmin, currentUserEmail]);

  // Subscribe to live data after unlock
  useEffect(() => {
    if (!isUnlocked) return;
    const unsub = subscribeRealtime(setSnapshot);
    setUsers(loadUsers());
    setExtraAdmins(getExtraAdminEmails());
    return unsub;
  }, [isUnlocked]);

  // ── Analytics derived from logs ─────────────────────────────────────────
  const analytics = useMemo(() => {
    const logs = snapshot.logs;
    const activations = logs.filter(
      (l) => l.source === "emergency" && l.message.toLowerCase().includes("activated"),
    ).length;
    const overrides = logs.filter(
      (l) => l.source === "signal" && l.level === "critical",
    ).length;
    const warnings = logs.filter((l) => l.level === "warning").length;
    const lastOverride = logs.find(
      (l) => l.source === "signal" && l.level === "critical",
    );
    const avgDist =
      overrides > 0
        ? logs
            .filter((l) => l.source === "signal" && l.level === "critical")
            .reduce((acc, l) => {
              const m = l.message.match(/\((\d+\.?\d*)m\)/);
              return acc + (m ? parseFloat(m[1]) : 0);
            }, 0) / overrides
        : 0;

    return {
      activations,
      overrides,
      warnings,
      lastOverrideAt: lastOverride?.timestamp ?? null,
      avgOverrideDist: avgDist,
      activeNodes: Object.values(snapshot.vehicles).filter((n) => n.connectionStatus === "connected").length,
    };
  }, [snapshot]);

  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return snapshot.logs;
    return snapshot.logs.filter((l) => l.level === logFilter);
  }, [snapshot.logs, logFilter]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddAdmin = () => {
    if (!newAdminEmail.trim()) return;
    addAdminEmail(newAdminEmail.trim());
    setExtraAdmins(getExtraAdminEmails());
    setNewAdminEmail("");
  };

  const handleRemoveAdmin = (email: string) => {
    removeAdminEmail(email);
    setExtraAdmins(getExtraAdminEmails());
  };

  const handleAddUser = () => {
    if (!newUserEmail.trim()) return;
    const updated = upsertUser({ email: newUserEmail.trim(), role: newUserRole, status: "active" });
    setUsers(updated);
    setNewUserEmail("");
  };

  const handleBan = (email: string) => setUsers(banUser(email));
  const handleUnban = (email: string) => setUsers(unbanUser(email));
  const handleRemove = (email: string) => setUsers(removeUser(email));

  const handleLock = () => {
    try { sessionStorage.removeItem("v2x-admin-unlocked"); } catch { /* ignore */ }
    setIsUnlocked(false);
  };

  const handleExportLogs = () => {
    const blob = new Blob([JSON.stringify(snapshot.logs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `v2x-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isUnlocked) {
    return <AdminLoginGate onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Admin header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            Admin Console
          </span>
          <span className="text-sm text-zinc-400">{currentUserEmail}</span>
        </div>
        <button type="button" onClick={handleLock} className="btn-secondary px-3 py-1.5 text-sm">
          🔒 Lock Admin
        </button>
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "operations", label: "🗺 Operations" },
            { id: "users", label: "👥 Users" },
            { id: "analytics", label: "📊 Analytics" },
          ] as { id: AdminTab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              tab === t.id ? "tab-active" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OPERATIONS TAB ───────────────────────────────────────────────── */}
      {tab === "operations" && (
        <div className="space-y-4 animate-fade-in">
          {/* Map */}
          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-zinc-100">Live Map</h3>
              <div className="flex flex-wrap gap-2 text-sm">
                {(["street", "walking", "satellite"] as MapMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`rounded-md px-3 py-1 capitalize transition ${mapMode === m ? "tab-active" : "border border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                    onClick={() => setMapMode(m)}
                  >
                    {m === "satellite" ? "🛰 Satellite" : m}
                  </button>
                ))}
              </div>
            </div>
            <LiveMap snapshot={snapshot} mode={mapMode} showPredictedPath />
            <p className="mt-2 text-xs text-zinc-600">
              Red dashed = EV predicted path · Red ring = 25 m · Yellow ring = 50 m
            </p>
          </article>

          {/* Node status */}
          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="mb-3 font-semibold text-zinc-100">Node Status</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.values(snapshot.vehicles).map((node) => (
                <div key={node.id} className="rounded-lg border border-zinc-800 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-zinc-200">{node.label}</p>
                    <span
                      className={`text-xs font-semibold ${node.connectionStatus === "connected" ? "acc-good" : "acc-medium"}`}
                    >
                      ● {node.connectionStatus.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-zinc-600">
                    {node.kalmanLatitude.toFixed(5)}, {node.kalmanLongitude.toFixed(5)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {node.speed.toFixed(1)} m/s · {node.heading.toFixed(0)}° hdg
                  </p>
                </div>
              ))}
            </div>
          </article>

          {/* Signal status */}
          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="mb-3 font-semibold text-zinc-100">Traffic Signal</h3>
            <p className="mb-3 text-sm text-zinc-500">
              Mode:{" "}
              <span
                className={`font-semibold ${snapshot.signals.mode === "override" ? "text-red-300" : "acc-good"}`}
              >
                {snapshot.signals.mode.toUpperCase()}
              </span>
              {snapshot.signals.evDistanceMeters !== undefined && (
                <> · EV distance: {snapshot.signals.evDistanceMeters.toFixed(1)} m</>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["north", "south", "east", "west"] as const).map((dir) => (
                <div
                  key={dir}
                  className={`rounded-lg border p-2 text-center ${
                    snapshot.signals[dir] === "green"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : snapshot.signals[dir] === "yellow"
                        ? "border-yellow-500/30"
                        : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  <p className="text-xs uppercase text-zinc-500">{dir}</p>
                  <p
                    className={`mt-1 text-sm font-bold ${snapshot.signals[dir] === "green" ? "text-emerald-400" : snapshot.signals[dir] === "yellow" ? "text-yellow-400" : "text-red-400"}`}
                  >
                    ● {snapshot.signals[dir].toUpperCase()}
                  </p>
                </div>
              ))}
            </div>
          </article>

          {/* Logs */}
          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-zinc-100">Live Logs</h3>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 text-xs">
                  {(["all", "warning", "critical"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setLogFilter(f)}
                      className={`rounded px-2 py-1 capitalize transition ${logFilter === f ? "tab-active" : "border border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleExportLogs}
                  className="btn-secondary px-2 py-1 text-xs"
                >
                  ↓ Export
                </button>
              </div>
            </div>
            <div className="max-h-72 space-y-1.5 overflow-auto pr-1">
              {filteredLogs.length === 0 ? (
                <p className="text-sm text-zinc-600">No events match this filter.</p>
              ) : (
                filteredLogs.slice(0, 50).map((log) => (
                  <div
                    key={log.id}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      log.level === "critical"
                        ? "border-red-500/30 bg-red-500/5"
                        : log.level === "warning"
                          ? "border-yellow-500/30 bg-yellow-500/5"
                          : "border-zinc-800"
                    }`}
                  >
                    <p className="text-zinc-200">
                      [{compactTime(log.timestamp)}] {log.message}
                    </p>
                    <p className="mt-0.5 text-xs uppercase text-zinc-600">
                      {log.source} · {log.level}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      )}

      {/* ── USERS TAB ────────────────────────────────────────────────────── */}
      {tab === "users" && (
        <div className="space-y-4 animate-fade-in">
          {/* Admin list */}
          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="mb-3 font-semibold text-zinc-100">Admin Allow-list</h3>

            {/* Hardcoded admins */}
            <p className="mb-2 text-xs uppercase tracking-wider text-zinc-600">Built-in admins</p>
            <div className="mb-4 space-y-2">
              {ADMIN_EMAILS_HARDCODED.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm"
                >
                  <span className="text-zinc-300">{email}</span>
                  <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-400">
                    Protected
                  </span>
                </div>
              ))}
            </div>

            {/* Extra admins */}
            {extraAdmins.length > 0 && (
              <>
                <p className="mb-2 text-xs uppercase tracking-wider text-zinc-600">Added admins</p>
                <div className="mb-4 space-y-2">
                  {extraAdmins.map((email) => (
                    <div
                      key={email}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm"
                    >
                      <span className="text-zinc-300">{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAdmin(email)}
                        className="rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 transition"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Add admin form */}
            <p className="mb-2 text-xs uppercase tracking-wider text-zinc-600">Add admin</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="email@gmail.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-cyan-500"
              />
              <button type="button" onClick={handleAddAdmin} className="btn-secondary px-4 py-2 text-sm">
                Add
              </button>
            </div>
          </article>

          {/* User management */}
          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="mb-3 font-semibold text-zinc-100">User Management</h3>

            {/* Current session user */}
            <div className="mb-4 flex items-center justify-between rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-cyan-300">{currentUserEmail}</p>
                <p className="text-xs text-zinc-500">Current session</p>
              </div>
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-400">
                Admin
              </span>
            </div>

            {/* User list */}
            {users.length > 0 && (
              <div className="mb-4 space-y-2">
                {users.map((user) => (
                  <div
                    key={user.email}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      user.status === "banned"
                        ? "border-red-500/30 bg-red-500/5"
                        : "border-zinc-800"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className={user.status === "banned" ? "text-zinc-500 line-through" : "text-zinc-200"}>
                          {user.email}
                        </p>
                        <p className="text-xs text-zinc-600 capitalize">
                          {user.role} · {user.status}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        {user.status === "banned" ? (
                          <button
                            type="button"
                            onClick={() => handleUnban(user.email)}
                            className="rounded px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10 transition"
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleBan(user.email)}
                            className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 transition"
                          >
                            Ban
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemove(user.email)}
                          className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 transition"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add user form */}
            <p className="mb-2 text-xs uppercase tracking-wider text-zinc-600">Add user</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="email"
                placeholder="user@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-cyan-500"
              />
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRecord["role"])}
                className="rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-300 outline-none transition focus:border-cyan-500"
              >
                <option value="viewer">Viewer</option>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
              <button type="button" onClick={handleAddUser} className="btn-secondary px-4 py-2 text-sm">
                Add
              </button>
            </div>
          </article>
        </div>
      )}

      {/* ── ANALYTICS TAB ────────────────────────────────────────────────── */}
      {tab === "analytics" && (
        <div className="space-y-4 animate-fade-in">
          {/* KPI cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                label: "EV Activations",
                value: analytics.activations,
                icon: "🚨",
                color: "text-red-300",
                border: "border-red-500/20",
                bg: "bg-red-500/5",
              },
              {
                label: "Signal Overrides",
                value: analytics.overrides,
                icon: "⚡",
                color: "text-yellow-300",
                border: "border-yellow-500/20",
                bg: "bg-yellow-500/5",
              },
              {
                label: "Warning Events",
                value: analytics.warnings,
                icon: "⚠️",
                color: "text-orange-300",
                border: "border-orange-500/20",
                bg: "bg-orange-500/5",
              },
              {
                label: "Active Nodes",
                value: analytics.activeNodes,
                icon: "📡",
                color: "acc-good",
                border: "border-emerald-500/20",
                bg: "bg-emerald-500/5",
              },
              {
                label: "Total Log Events",
                value: snapshot.logs.length,
                icon: "📋",
                color: "text-zinc-300",
                border: "border-zinc-700",
                bg: "",
              },
              {
                label: "Avg Override Dist",
                value: analytics.avgOverrideDist > 0 ? `${analytics.avgOverrideDist.toFixed(1)} m` : "—",
                icon: "📏",
                color: "text-cyan-300",
                border: "border-cyan-500/20",
                bg: "bg-cyan-500/5",
              },
            ].map((card) => (
              <div
                key={card.label}
                className={`metric-card animate-count-up rounded-xl border p-4 ${card.border} ${card.bg}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">{card.label}</p>
                  <span className="text-xl">{card.icon}</span>
                </div>
                <p className={`mt-2 text-3xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Last override */}
          {analytics.lastOverrideAt && (
            <article className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Last Signal Override</p>
              <p className="mt-1 font-mono text-yellow-300">
                {new Date(analytics.lastOverrideAt).toLocaleString()}
              </p>
            </article>
          )}

          {/* Signal state summary */}
          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="mb-3 font-semibold text-zinc-100">Current Signal State</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["north", "south", "east", "west"] as const).map((dir) => (
                <div key={dir} className="rounded-lg border border-zinc-800 p-2 text-center">
                  <p className="text-xs uppercase text-zinc-600">{dir}</p>
                  <p
                    className={`mt-1 text-sm font-bold ${snapshot.signals[dir] === "green" ? "text-emerald-400" : snapshot.signals[dir] === "yellow" ? "text-yellow-400" : "text-red-400"}`}
                  >
                    {snapshot.signals[dir].toUpperCase()}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-zinc-500">
                Override mode:{" "}
                <span
                  className={snapshot.signals.mode === "override" ? "text-red-300 font-semibold" : "acc-good"}
                >
                  {snapshot.signals.mode.toUpperCase()}
                </span>
              </span>
              <button
                type="button"
                onClick={handleExportLogs}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                ↓ Export Logs
              </button>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
