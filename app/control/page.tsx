"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LegacyFirebaseScripts from "../components/LegacyFirebaseScripts";
import { ChipRow, PageShell, PanelHeader, StatusMessage, TableCard } from "../components/LiveBlocks";

const unitKeys = ["emergency", "signal", "vehicle1", "vehicle2"];

export default function ControlPage() {
  const router = useRouter();
  const [scriptsReady, setScriptsReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [ranges, setRanges] = useState({ rangeV2V: 25, rangeV2I: 50 });
  const [events, setEvents] = useState<any[]>([]);
  const [units, setUnits] = useState<Record<string, any>>({});
  const [message, setMessage] = useState("");
  const [eventQuery, setEventQuery] = useState("");
  const [eventType, setEventType] = useState<"all" | "alert" | "info" | "v2v" | "v2i">("all");
  const [broadcast, setBroadcast] = useState("");

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

  const onlineCount = unitKeys.filter((key) => units[key]?.active).length;

  const filteredEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    return events.filter((e) => {
      if (eventType !== "all" && String(e.type || "").toLowerCase() !== eventType) return false;
      if (!q) return true;
      return String(e.message || "").toLowerCase().includes(q) || String(e.type || "").toLowerCase().includes(q);
    });
  }, [events, eventQuery, eventType]);

  const sendBroadcast = async () => {
    const msg = broadcast.trim();
    if (!msg) return;
    try {
      await window.db.ref("v4/broadcast").set({
        message: msg,
        timestamp: new Date().toISOString(),
        from: session?.user || "control"
      });
      setBroadcast("");
      setMessage("Broadcast sent.");
    } catch (err: any) {
      setMessage(err?.message || "Broadcast failed.");
    }
  };

  return (
    <PageShell pageClassName="control-page" cardClassName="control-card" maxWidth={1200}>
      <LegacyFirebaseScripts onReady={() => setScriptsReady(true)} />
      <PanelHeader
        title="Control Center"
        subtitle={session ? "Admin session: " + session.user : "Loading control session..."}
        actions={<button type="button" onClick={() => router.push("/admin")}>Open Admin</button>}
      />

      <ChipRow className="unit-grid mt-14">
        {unitKeys.map((key) => {
          const unit = units[key] || {};
          return (
            <div key={key} className="rchip unit-chip">
              <strong>{key}</strong>
              <div className="unit-meta text-meta-sm">
                {unit.active ? "online" : "idle"} | {unit.lat ? `${Number(unit.lat).toFixed(5)}, ${Number(unit.lng).toFixed(5)}` : "no location"}
              </div>
            </div>
          );
        })}
      </ChipRow>

      <ChipRow className="chip-grid mt-10">
        <div className="rchip">Online Units: <strong>{onlineCount}/{unitKeys.length}</strong></div>
        <div className="rchip">Event Feed: <strong>{events.length}</strong></div>
      </ChipRow>

      <ChipRow className="range-bar mt-14">
        <label className="rchip range-chip">
          V2V Range
          <input
            className="range-input range-input-sm"
            type="number"
            min={5}
            max={1000}
            step={1}
            value={ranges.rangeV2V}
            onChange={(e) => setRanges((prev) => ({ ...prev, rangeV2V: Number(e.target.value) }))}
          />
        </label>
        <label className="rchip range-chip">
          V2I Range
          <input
            className="range-input range-input-sm"
            type="number"
            min={10}
            max={2000}
            step={1}
            value={ranges.rangeV2I}
            onChange={(e) => setRanges((prev) => ({ ...prev, rangeV2I: Number(e.target.value) }))}
          />
        </label>
        <button className="submit-btn submit-user" type="button" onClick={saveRanges}>Save Ranges</button>
      </ChipRow>

      <div className="filter-row mt-12">
        <input
          className="form-inp"
          placeholder="Search events"
          value={eventQuery}
          onChange={(e) => setEventQuery(e.target.value)}
        />
        <div className="legacy-actions filter-actions">
          <button className="filter-chip" type="button" data-active={eventType === "all"} onClick={() => setEventType("all")}>All</button>
          <button className="filter-chip" type="button" data-active={eventType === "alert"} onClick={() => setEventType("alert")}>Alert</button>
          <button className="filter-chip" type="button" data-active={eventType === "info"} onClick={() => setEventType("info")}>Info</button>
          <button className="filter-chip" type="button" data-active={eventType === "v2v"} onClick={() => setEventType("v2v")}>V2V</button>
          <button className="filter-chip" type="button" data-active={eventType === "v2i"} onClick={() => setEventType("v2i")}>V2I</button>
        </div>
      </div>

      <form className="inline-form mt-10" onSubmit={(e) => { e.preventDefault(); sendBroadcast(); }}>
        <input
          className="form-inp"
          placeholder="Broadcast message to all nodes"
          value={broadcast}
          onChange={(e) => setBroadcast(e.target.value)}
          maxLength={140}
        />
        <button className="submit-btn submit-admin" type="submit">Send</button>
      </form>

      {message && <StatusMessage>{message}</StatusMessage>}

      <TableCard>
        <div className="table-scroll">
          <table className="simple-table mobile-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event, idx) => (
                <tr key={idx}>
                  <td data-label="Time">{event.timestamp || "-"}</td>
                  <td data-label="Type">{event.type || "-"}</td>
                  <td data-label="Message">{event.message || "-"}</td>
                </tr>
              ))}
              {!filteredEvents.length && (
                <tr className="empty-row">
                  <td colSpan={3} className="empty-cell">No events match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </TableCard>
    </PageShell>
  );
}
