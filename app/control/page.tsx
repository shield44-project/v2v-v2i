"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LegacyFirebaseScripts from "../components/LegacyFirebaseScripts";

const unitKeys = ["emergency", "signal", "vehicle1", "vehicle2"];

export default function ControlPage() {
  const router = useRouter();
  const [scriptsReady, setScriptsReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [ranges, setRanges] = useState({ rangeV2V: 25, rangeV2I: 50 });
  const [events, setEvents] = useState<any[]>([]);
  const [units, setUnits] = useState<Record<string, any>>({});
  const [message, setMessage] = useState("");

  const canUseLegacy = useMemo(() => {
    if (!scriptsReady || typeof window === "undefined") return false;
    return !!(window.db && window.getSession);
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

    const unitRefs = unitKeys.map((k) => window.db.ref("v4/" + k));
    const unitHandlers = unitRefs.map((ref, idx) =>
      ref.on("value", (snap) => {
        setUnits((prev) => ({ ...prev, [unitKeys[idx]]: snap.val() || {} }));
      })
    );

    const configRef = window.db.ref("v4/config");
    const configHandler = configRef.on("value", (snap) => {
      const cfg = snap.val() || {};
      setRanges({
        rangeV2V: cfg.rangeV2V || 25,
        rangeV2I: cfg.rangeV2I || 50
      });
    });

    const eventsRef = window.db.ref("v4/events").limitToLast(25);
    const eventsHandler = eventsRef.on("value", (snap) => {
      const value = snap.val() || {};
      const list = (Object.values(value) as any[])
        .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")))
        .slice(0, 25);
      setEvents(list);
    });

    return () => {
      unitRefs.forEach((ref, i) => ref.off("value", unitHandlers[i]));
      configRef.off("value", configHandler);
      eventsRef.off("value", eventsHandler);
    };
  }, [canUseLegacy, router]);

  const saveRanges = async () => {
    const v2v = Number(ranges.rangeV2V);
    const v2i = Number(ranges.rangeV2I);
    if (!Number.isFinite(v2v) || !Number.isFinite(v2i) || v2v < 5 || v2i < 10) {
      setMessage("Enter valid ranges (V2V >= 5, V2I >= 10).");
      return;
    }

    try {
      await window.db.ref("v4/config").update({
        rangeV2V: v2v,
        rangeV2I: v2i
      });
      setMessage("Ranges updated.");
    } catch (err: any) {
      setMessage(err?.message || "Failed to update ranges.");
    }
  };

  return (
    <main className="page">
      <LegacyFirebaseScripts onReady={() => setScriptsReady(true)} />
      <div className="card" style={{ maxWidth: 1200 }}>
        <div className="legacy-header">
          <div>
            <h1>Control Center</h1>
            <p>{session ? "Admin session: " + session.user : "Loading control session..."}</p>
          </div>
          <div className="legacy-actions">
            <button type="button" onClick={() => router.push("/admin")}>Open Admin</button>
          </div>
        </div>

        <div className="routes" style={{ marginTop: 14 }}>
          {unitKeys.map((key) => {
            const unit = units[key] || {};
            return (
              <div key={key} className="rchip">
                <strong>{key}</strong>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {unit.active ? "online" : "idle"} | {unit.lat ? `${Number(unit.lat).toFixed(5)}, ${Number(unit.lng).toFixed(5)}` : "no location"}
                </div>
              </div>
            );
          })}
        </div>

        <div className="routes" style={{ marginTop: 14 }}>
          <label className="rchip">
            V2V Range
            <input
              type="number"
              min={5}
              max={1000}
              step={1}
              value={ranges.rangeV2V}
              onChange={(e) => setRanges((prev) => ({ ...prev, rangeV2V: Number(e.target.value) }))}
              style={{ marginLeft: 8, width: 90 }}
            />
          </label>
          <label className="rchip">
            V2I Range
            <input
              type="number"
              min={10}
              max={2000}
              step={1}
              value={ranges.rangeV2I}
              onChange={(e) => setRanges((prev) => ({ ...prev, rangeV2I: Number(e.target.value) }))}
              style={{ marginLeft: 8, width: 90 }}
            />
          </label>
          <button className="submit-btn submit-user" type="button" onClick={saveRanges}>Save Ranges</button>
        </div>

        {message && <p style={{ marginTop: 10 }}>{message}</p>}

        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table className="simple-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, idx) => (
                <tr key={idx}>
                  <td>{event.timestamp || "-"}</td>
                  <td>{event.type || "-"}</td>
                  <td>{event.message || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
