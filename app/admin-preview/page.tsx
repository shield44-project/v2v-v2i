"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LegacyFirebaseScripts from "../components/LegacyFirebaseScripts";

export default function AdminPreviewPage() {
  const [scriptsReady, setScriptsReady] = useState(false);
  const [stats, setStats] = useState({ users: 0, admins: 0, events: 0 });

  const canUseLegacy = useMemo(() => {
    if (!scriptsReady || typeof window === "undefined") return false;
    return !!window.db;
  }, [scriptsReady]);

  useEffect(() => {
    if (!canUseLegacy) return;

    const usersRef = window.db.ref("v4/users");
    const adminsRef = window.db.ref("v4/admins");
    const eventsRef = window.db.ref("v4/events");

    const usersCb = usersRef.on("value", (snap) => {
      setStats((prev) => ({ ...prev, users: Object.keys(snap.val() || {}).length }));
    });
    const adminsCb = adminsRef.on("value", (snap) => {
      setStats((prev) => ({ ...prev, admins: Object.keys(snap.val() || {}).length }));
    });
    const eventsCb = eventsRef.on("value", (snap) => {
      setStats((prev) => ({ ...prev, events: Object.keys(snap.val() || {}).length }));
    });

    return () => {
      usersRef.off("value", usersCb);
      adminsRef.off("value", adminsCb);
      eventsRef.off("value", eventsCb);
    };
  }, [canUseLegacy]);

  return (
    <main className="page">
      <LegacyFirebaseScripts onReady={() => setScriptsReady(true)} />
      <div className="card">
        <h1>Admin Preview</h1>
        <p>Public live overview of V2X system activity.</p>

        <div className="routes mt-14">
          <div className="rchip">Users: <strong>{stats.users}</strong></div>
          <div className="rchip">Admins: <strong>{stats.admins}</strong></div>
          <div className="rchip">Events: <strong>{stats.events}</strong></div>
        </div>

        <div className="legacy-actions mt-14">
          <Link href="/login">Sign In</Link>
          <Link href="/admin">Open Admin</Link>
        </div>
      </div>
    </main>
  );
}
