"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LegacyFirebaseScripts from "../components/LegacyFirebaseScripts";

const roleCards = [
  { id: "ev", title: "Emergency Vehicle", href: "/emergency", emoji: "EV" },
  { id: "signal", title: "Traffic Signal", href: "/signal", emoji: "SIG" },
  { id: "vehicle1", title: "Vehicle 1", href: "/vehicle1", emoji: "V1" },
  { id: "vehicle2", title: "Vehicle 2", href: "/vehicle2", emoji: "V2" }
];

export default function UserPortalPage() {
  const router = useRouter();
  const [scriptsReady, setScriptsReady] = useState(false);
  const [session, setSession] = useState(null);
  const [v2v, setV2v] = useState(25);
  const [v2i, setV2i] = useState(50);
  const [busyRole, setBusyRole] = useState("");

  const canUseLegacy = useMemo(() => {
    if (!scriptsReady || typeof window === "undefined") return false;
    return !!(window.getSession && window.db && window.firebase);
  }, [scriptsReady]);

  useEffect(() => {
    if (!canUseLegacy) return;

    const s = window.getSession();
    if (!s?.user) {
      router.replace("/login");
      return;
    }
    if (s.isAdmin) {
      router.replace("/control");
      return;
    }
    setSession(s);

    const onRanges = (e) => {
      setV2v(e.detail?.v2v || 25);
      setV2i(e.detail?.v2i || 50);
    };
    document.addEventListener("rangesUpdated", onRanges);

    window.db.ref("v4/config").once("value", (snap) => {
      const cfg = snap.val() || {};
      if (cfg.rangeV2V) setV2v(cfg.rangeV2V);
      if (cfg.rangeV2I) setV2i(cfg.rangeV2I);
    });

    return () => document.removeEventListener("rangesUpdated", onRanges);
  }, [canUseLegacy, router]);

  const chooseRole = async (role) => {
    if (!canUseLegacy || !session) return;
    setBusyRole(role);

    sessionStorage.setItem("v2x_role", role);
    window.setSession?.({ role });

    try {
      await window.db.ref("v4/sessions/" + role).set({
        user: session.user,
        role,
        joinedAt: new Date().toISOString(),
        t: (window as any).firebase.database.ServerValue.TIMESTAMP
      });
    } catch (_) {
      // Keep UX flowing even if session write fails.
    }

    if (role === "ev") router.push("/emergency");
    else if (role === "signal") router.push("/signal");
    else if (role === "vehicle1") router.push("/vehicle1");
    else router.push("/vehicle2");
  };

  const logout = async () => {
    window.clearSession?.();
    await window.auth?.signOut?.().catch(() => {});
    router.replace("/login");
  };

  return (
    <main className="page">
      <LegacyFirebaseScripts onReady={() => setScriptsReady(true)} />
      <div className="card" style={{ maxWidth: 900 }}>
        <div className="legacy-header">
          <div>
            <h1>Choose Your Role</h1>
            <p>{session ? "Signed in as " + session.user : "Loading session..."}</p>
          </div>
          <div className="legacy-actions">
            <button type="button" onClick={logout}>Sign Out</button>
          </div>
        </div>

        <div className="routes" style={{ marginTop: 14 }}>
          <div className="rchip">V2V Zone: <strong>{v2v}m</strong></div>
          <div className="rchip">V2I Zone: <strong>{v2i}m</strong></div>
          <div className="rchip">Update Rate: <strong>1s</strong></div>
        </div>

        <div className="routes" style={{ marginTop: 14 }}>
          {roleCards.map((role) => (
            <button
              key={role.id}
              className="tile-button"
              type="button"
              onClick={() => chooseRole(role.id)}
              disabled={!session || busyRole.length > 0}
            >
              <strong>{role.emoji} {role.title}</strong>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {busyRole === role.id ? "Connecting..." : "Open module route " + role.href}
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
