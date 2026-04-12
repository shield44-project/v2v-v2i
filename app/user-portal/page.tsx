"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LegacyFirebaseScripts from "../components/LegacyFirebaseScripts";
import { ChipRow, PageShell, PanelHeader, StatusMessage } from "../components/LiveBlocks";

const roleCards = [
  { id: "ev", title: "Emergency Vehicle", href: "/emergency", emoji: "EV" },
  { id: "signal", title: "Traffic Signal", href: "/signal", emoji: "SIG" },
  { id: "vehicle1", title: "Vehicle 1", href: "/vehicle1", emoji: "V1" },
  { id: "vehicle2", title: "Vehicle 2", href: "/vehicle2", emoji: "V2" }
];

type Session = {
  user: string;
  isAdmin?: boolean;
};

export default function UserPortalPage() {
  const router = useRouter();
  const [scriptsReady, setScriptsReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [v2v, setV2v] = useState(25);
  const [v2i, setV2i] = useState(50);
  const [busyRole, setBusyRole] = useState("");
  const [message, setMessage] = useState("");

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

    const onRanges = (e: Event) => {
      const custom = e as CustomEvent<{ v2v?: number; v2i?: number }>;
      setV2v(custom.detail?.v2v || 25);
      setV2i(custom.detail?.v2i || 50);
    };
    document.addEventListener("rangesUpdated", onRanges);

    window.db.ref("v4/config").once("value", (snap) => {
      const cfg = snap.val() || {};
      if (cfg.rangeV2V) setV2v(cfg.rangeV2V);
      if (cfg.rangeV2I) setV2i(cfg.rangeV2I);
    });

    return () => document.removeEventListener("rangesUpdated", onRanges);
  }, [canUseLegacy, router]);

  const chooseRole = async (role: typeof roleCards[number]) => {
    if (!canUseLegacy || !session) return;
    setBusyRole(role.id);

    sessionStorage.setItem("v2x_role", role.id);
    window.setSession?.({ role: role.id });

    try {
      await window.db.ref("v4/sessions/" + role.id).set({
        user: session.user,
        joinedAt: new Date().toISOString(),
        active: true
      });

      setMessage("Connected as " + role.title + ". Redirecting...");
      router.push(role.href);
    } catch {
      setMessage("Could not open selected module. Please try again.");
    } finally {
      setBusyRole("");
    }
  };

  return (
    <PageShell pageClassName="portal-page" cardClassName="portal-card" maxWidth={960}>
      <LegacyFirebaseScripts onReady={() => setScriptsReady(true)} />

      <PanelHeader
        title="User Portal"
        subtitle={session ? "Signed in as: " + session.user : "Loading user session..."}
        actions={<button type="button" onClick={() => router.push("/login")}>Back to Login</button>}
      />

      <ChipRow className="chip-grid mt-14">
        <div className="rchip">V2V Range: <strong>{v2v}m</strong></div>
        <div className="rchip">V2I Range: <strong>{v2i}m</strong></div>
        <div className="rchip">Session: <strong>{session?.user || "-"}</strong></div>
      </ChipRow>

      <div className="portal-quick-links mt-12">
        <a href="/">Dashboard Home</a>
        <a href="/admin-preview">Public Preview</a>
        <a href="/archive">Archive</a>
      </div>

      {message && <StatusMessage>{message}</StatusMessage>}

      <div className="portal-role-head mt-14">
        <h2>Choose Active Role</h2>
        <p>Select the module you want to operate. Session role is persisted automatically.</p>
      </div>

      <div className="routes role-grid mt-14">
        {roleCards.map((role) => (
          <button
            key={role.id}
            className="rchip role-card"
            type="button"
            onClick={() => chooseRole(role)}
            disabled={!session || busyRole.length > 0}
          >
            <strong>{role.emoji} {role.title}</strong>
            <div className="role-meta text-meta-sm">
              {busyRole === role.id ? "Connecting..." : "Open module route " + role.href}
            </div>
          </button>
        ))}
      </div>
    </PageShell>
  );
}
