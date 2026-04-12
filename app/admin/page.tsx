"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LegacyFirebaseScripts from "../components/LegacyFirebaseScripts";
import { ChipRow, PageShell, PanelHeader, StatusMessage, TableCard } from "../components/LiveBlocks";

export default function AdminPage() {
  const router = useRouter();
  const [scriptsReady, setScriptsReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState({ users: 0, admins: 0, banned: 0, pending: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [adminIds, setAdminIds] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "admin" | "banned">("all");
  const [busyUid, setBusyUid] = useState("");

  const canUseLegacy = useMemo(() => {
    if (!scriptsReady || typeof window === "undefined") return false;
    return !!(window.db && window.getSession && window.checkIsAdmin);
  }, [scriptsReady]);

  useEffect(() => {
    if (!canUseLegacy) return;
    const s = window.getSession();
    if (!s?.user) {
      router.replace("/login");
      return;
    }
    if (!s.isAdmin) {
      router.replace("/user-portal");
      return;
    }
    setSession(s);

    const refs = [
      window.db.ref("v4/users"),
      window.db.ref("v4/admins"),
      window.db.ref("v4/banned"),
      window.db.ref("v4/pending_admins")
    ];

    const unsubs = refs.map((ref, idx) =>
      ref.on("value", (snap) => {
        const value = snap.val() || {};
        if (idx === 0) {
          const list = Object.entries(value as Record<string, any>).map(([uid, row]) => ({ uid, ...(row || {}) }));
          setUsers(list.sort((a, b) => String(b.lastSeen || "").localeCompare(String(a.lastSeen || ""))));
          setStats((prev) => ({ ...prev, users: list.length }));
        }
        if (idx === 1) {
          setStats((prev) => ({ ...prev, admins: Object.keys(value).length }));
          const ids: Record<string, boolean> = {};
          Object.keys(value).forEach((k) => {
            ids[k] = true;
          });
          setAdminIds(ids);
        }
        if (idx === 2) setStats((prev) => ({ ...prev, banned: Object.keys(value).length }));
        if (idx === 3) setStats((prev) => ({ ...prev, pending: Object.keys(value).length }));
      })
    );

    return () => {
      refs.forEach((ref, i) => ref.off("value", unsubs[i]));
    };
  }, [canUseLegacy, router]);

  const inviteAdmin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canUseLegacy || !inviteEmail.trim()) return;
    try {
      await window.db.ref("v4/pending_admins").push({
        email: inviteEmail.trim().toLowerCase(),
        invitedAt: new Date().toISOString(),
        invitedBy: session?.uid || "admin"
      });
      setInviteEmail("");
      setMessage("Admin invite saved in pending_admins.");
    } catch (err: any) {
      setMessage(err?.message || "Failed to save invite.");
    }
  };

  const filteredUsers = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return users.filter((u) => {
      const isAdmin = Boolean(adminIds[u.uid]);
      const isBanned = (u.status || "") === "banned";
      if (filter === "admin" && !isAdmin) return false;
      if (filter === "banned" && !isBanned) return false;
      if (!lower) return true;
      return (u.name || "").toLowerCase().includes(lower) || (u.email || "").toLowerCase().includes(lower);
    });
  }, [users, query, filter, adminIds]);

  const runAction = async (uid: string, fn: () => Promise<any>, label: string) => {
    if (busyUid) return;
    setBusyUid(uid);
    try {
      await fn();
      setMessage(label + " completed.");
    } catch (err: any) {
      setMessage(err?.message || "Action failed.");
    } finally {
      setBusyUid("");
    }
  };

  return (
    <PageShell pageClassName="admin-page" cardClassName="admin-card" maxWidth={1100}>
      <LegacyFirebaseScripts onReady={() => setScriptsReady(true)} />
      <PanelHeader
        title="Admin Panel"
        subtitle={session ? "Signed in as " + session.user : "Loading admin session..."}
        actions={<button type="button" onClick={() => router.push("/control")}>Open Control</button>}
      />

      <ChipRow className="chip-grid mt-14">
        <div className="rchip">Users: <strong>{stats.users}</strong></div>
        <div className="rchip">Admins: <strong>{stats.admins}</strong></div>
        <div className="rchip">Banned: <strong>{stats.banned}</strong></div>
        <div className="rchip">Pending: <strong>{stats.pending}</strong></div>
      </ChipRow>

      <div className="filter-row mt-12">
        <input
          className="form-inp"
          placeholder="Search users by name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="legacy-actions filter-actions">
          <button className="filter-chip" type="button" data-active={filter === "all"} onClick={() => setFilter("all")}>All</button>
          <button className="filter-chip" type="button" data-active={filter === "admin"} onClick={() => setFilter("admin")}>Admins</button>
          <button className="filter-chip" type="button" data-active={filter === "banned"} onClick={() => setFilter("banned")}>Banned</button>
        </div>
      </div>

      <form className="inline-form mt-14" onSubmit={inviteAdmin}>
        <input
          className="form-inp"
          placeholder="Invite admin by email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
        />
        <button className="submit-btn submit-user" type="submit">Save Invite</button>
      </form>

      {message && <StatusMessage>{message}</StatusMessage>}

      <TableCard>
        <div className="table-scroll">
          <table className="simple-table mobile-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.slice(0, 60).map((user) => {
                const disabled = busyUid.length > 0;
                const isBanned = (user.status || "") === "banned";
                return (
                <tr key={user.uid}>
                  <td data-label="User">{user.name || user.uid}</td>
                  <td data-label="Email">{user.email || "-"}</td>
                  <td data-label="Status">{isBanned ? "banned" : (user.status || "active")}</td>
                  <td data-label="Actions">
                    <div className="legacy-actions action-pack compact-gap">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => runAction(user.uid, () => window.promoteToAdmin(user.uid, user.email || "", user.name || "", session?.uid), "Promote")}
                      >
                        Promote
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => runAction(user.uid, () => window.demoteAdmin(user.uid, user.email || ""), "Demote")}
                      >
                        Demote
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => runAction(user.uid, () => window.banUser(user.uid, user.email || "", "Admin action", session?.uid), "Ban")}
                      >
                        Ban
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => runAction(user.uid, () => window.unbanUser(user.uid), "Unban")}
                      >
                        Unban
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
              {!filteredUsers.length && (
                <tr className="empty-row">
                  <td colSpan={4} className="empty-cell">No users match this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </TableCard>
    </PageShell>
  );
}
