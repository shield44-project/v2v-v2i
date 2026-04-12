"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LegacyFirebaseScripts from "../components/LegacyFirebaseScripts";

export default function AdminPage() {
  const router = useRouter();
  const [scriptsReady, setScriptsReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState({ users: 0, admins: 0, banned: 0, pending: 0 });
  const [users, setUsers] = useState<any[]>([]);

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
        if (idx === 1) setStats((prev) => ({ ...prev, admins: Object.keys(value).length }));
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

  const runAction = async (fn: () => Promise<any>) => {
    try {
      await fn();
      setMessage("Action completed.");
    } catch (err: any) {
      setMessage(err?.message || "Action failed.");
    }
  };

  return (
    <main className="page">
      <LegacyFirebaseScripts onReady={() => setScriptsReady(true)} />
      <div className="card" style={{ maxWidth: 1100 }}>
        <div className="legacy-header">
          <div>
            <h1>Admin Panel</h1>
            <p>{session ? "Signed in as " + session.user : "Loading admin session..."}</p>
          </div>
          <div className="legacy-actions">
            <button type="button" onClick={() => router.push("/control")}>Open Control</button>
          </div>
        </div>

        <div className="routes" style={{ marginTop: 14 }}>
          <div className="rchip">Users: <strong>{stats.users}</strong></div>
          <div className="rchip">Admins: <strong>{stats.admins}</strong></div>
          <div className="rchip">Banned: <strong>{stats.banned}</strong></div>
          <div className="rchip">Pending: <strong>{stats.pending}</strong></div>
        </div>

        <form onSubmit={inviteAdmin} style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "1fr auto" }}>
          <input
            className="form-inp"
            placeholder="Invite admin by email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <button className="submit-btn submit-user" type="submit">Save Invite</button>
        </form>

        {message && <p style={{ marginTop: 10 }}>{message}</p>}

        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table className="simple-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 60).map((user) => (
                <tr key={user.uid}>
                  <td>{user.name || user.uid}</td>
                  <td>{user.email || "-"}</td>
                  <td>{user.status || "active"}</td>
                  <td>
                    <div className="legacy-actions" style={{ gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => runAction(() => window.promoteToAdmin(user.uid, user.email || "", user.name || "", session?.uid))}
                      >
                        Promote
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction(() => window.demoteAdmin(user.uid, user.email || ""))}
                      >
                        Demote
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction(() => window.banUser(user.uid, user.email || "", "Admin action", session?.uid))}
                      >
                        Ban
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction(() => window.unbanUser(user.uid))}
                      >
                        Unban
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
