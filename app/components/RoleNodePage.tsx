"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LegacyFirebaseScripts from "./LegacyFirebaseScripts";
import { AdvancedGPSTracker, getGPSWatchOptions } from "../lib/gps/advancedTracker";
import { SIMULATION_CONFIG } from "../lib/config/simulation";
import { ChipRow, PageShell, PanelHeader, StatusMessage, TableCard } from "./LiveBlocks";

function calcDistance(a, b) {
  if (!a || !b) return null;
  if (typeof window !== "undefined" && window.haversine) {
    return window.haversine(a.lat, a.lng, b.lat, b.lng);
  }
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(6371000 * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))));
}

export default function RoleNodePage({ nodeKey, title, isEmergency = false, isSignal = false }) {
  const router = useRouter();
  const watchRef = useRef(null);
  const trackerRef = useRef(new AdvancedGPSTracker({
    maxJumpMeters: SIMULATION_CONFIG.motion.maxVehicleJumpMeters
  }));
  const vehicleTypeRef = useRef("ambulance");
  const signalStateRef = useRef("RED");
  const pendingUpdateRef = useRef(null);

  const [scriptsReady, setScriptsReady] = useState(false);
  const [session, setSession] = useState(null);
  const [position, setPosition] = useState(null);
  const [emergencyPos, setEmergencyPos] = useState(null);
  const [signalPos, setSignalPos] = useState(null);
  const [v2vRange, setV2vRange] = useState(SIMULATION_CONFIG.defaultRanges.v2v);
  const [v2iRange, setV2iRange] = useState(SIMULATION_CONFIG.defaultRanges.v2i);
  const [vehicleType, setVehicleType] = useState("ambulance");
  const [signalState, setSignalState] = useState("RED");
  const [statusText, setStatusText] = useState("Waiting for GPS lock...");
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState("");
  const [gpsReport, setGpsReport] = useState({ readings: 0, outliersRejected: 0, confidence: 0, accuracy: null });

  const canUseLegacy = useMemo(() => {
    if (!scriptsReady || typeof window === "undefined") return false;
    return !!(window.db && window.getSession && window.firebase);
  }, [scriptsReady]);

  useEffect(() => {
    vehicleTypeRef.current = vehicleType;
  }, [vehicleType]);

  useEffect(() => {
    signalStateRef.current = signalState;
  }, [signalState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);

    const onOnline = async () => {
      setIsOnline(true);
      if (!canUseLegacy || !pendingUpdateRef.current) return;
      try {
        await window.db.ref("v4/" + nodeKey).update(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
        setStatusText("Reconnected and synced");
        setLastSyncAt(new Date().toLocaleTimeString());
      } catch (_) {
        setStatusText("Online, but sync still pending");
      }
    };
    const onOffline = () => {
      setIsOnline(false);
      setStatusText("Offline mode: updates queued");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [canUseLegacy, nodeKey]);

  useEffect(() => {
    if (!canUseLegacy) return;

    const s = window.getSession();
    if (!s?.user) {
      router.replace("/login");
      return;
    }
    setSession(s);

    if (!s.isAdmin && s.role && s.role !== nodeKey && !(nodeKey === "emergency" && s.role === "ev")) {
      router.replace("/user-portal");
      return;
    }

    const ranges = window.getRangeConfig?.();
    if (ranges) {
      setV2vRange(ranges.v2v || SIMULATION_CONFIG.defaultRanges.v2v);
      setV2iRange(ranges.v2i || SIMULATION_CONFIG.defaultRanges.v2i);
    }

    const onRanges = (e) => {
      setV2vRange(e.detail?.v2v || SIMULATION_CONFIG.defaultRanges.v2v);
      setV2iRange(e.detail?.v2i || SIMULATION_CONFIG.defaultRanges.v2i);
    };
    document.addEventListener("rangesUpdated", onRanges);

    const emergencyRef = window.db.ref("v4/emergency");
    const emergencyCb = emergencyRef.on("value", (snap) => {
      const v = snap.val() || null;
      setEmergencyPos(v && v.lat ? { lat: Number(v.lat), lng: Number(v.lng), heading: Number(v.heading || 0) } : null);
    });

    const signalRef = window.db.ref("v4/signal");
    const signalCb = signalRef.on("value", (snap) => {
      const v = snap.val() || null;
      setSignalPos(v && v.lat ? { lat: Number(v.lat), lng: Number(v.lng) } : null);
      if (isSignal && v?.state) setSignalState(v.state);
    });

    if (navigator.geolocation) {
      watchRef.current = navigator.geolocation.watchPosition(
        async (geo) => {
          const filtered = trackerRef.current.process(geo.coords);
          setGpsReport(trackerRef.current.getReport());

          if (filtered.rejected) {
            setStatusText("GPS spike filtered");
            return;
          }

          const next: any = {
            lat: filtered.lat,
            lng: filtered.lng,
            accuracy: filtered.accuracy,
            heading: filtered.heading || 0,
            speed: filtered.speed || 0,
            confidence: filtered.confidence,
            kalmanGain: filtered.kalmanGain,
            active: true,
            timestamp: new Date().toISOString(),
            t: (window as any).firebase.database.ServerValue.TIMESTAMP
          };

          if (isEmergency) next.type = vehicleTypeRef.current;
          if (isSignal) next.state = signalStateRef.current;
          setStatusText("GPS active (filtered)");
          setPosition(next);
          setStatusText("GPS active");

          if (!navigator.onLine) {
            pendingUpdateRef.current = next;
            setStatusText("Offline mode: updates queued");
            return;
          }

          try {
            await window.db.ref("v4/" + nodeKey).update(next);
            pendingUpdateRef.current = null;
            setLastSyncAt(new Date().toLocaleTimeString());
          } catch (err) {
            pendingUpdateRef.current = next;
            setStatusText(err?.message || "Realtime update failed");
          }
        },
        (err) => {
          const msg = err?.code === 1 ? "GPS permission denied" : err?.message || "GPS unavailable";
          setStatusText(msg);
        },
        getGPSWatchOptions()
      );
    } else {
      setStatusText("Geolocation not supported on this browser");
    }

    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      document.removeEventListener("rangesUpdated", onRanges);
      emergencyRef.off("value", emergencyCb);
      signalRef.off("value", signalCb);
    };
  }, [canUseLegacy, router, nodeKey, isEmergency, isSignal]);

  const distToEmergency = !isEmergency ? calcDistance(position, emergencyPos) : null;
  const distToSignal = isEmergency ? calcDistance(position, signalPos) : null;

  const danger = !isEmergency && distToEmergency !== null && distToEmergency <= v2vRange;
  const preempt = isSignal && emergencyPos && position && calcDistance(position, emergencyPos) <= v2iRange;

  const yieldSide =
    danger && emergencyPos && window.getYieldSide
      ? window.getYieldSide(emergencyPos.lat, emergencyPos.lng, emergencyPos.heading || 0, position.lat, position.lng)
      : null;

  const updateSignalState = async (nextState) => {
    setSignalState(nextState);
    if (!canUseLegacy) return;
    try {
      await window.db.ref("v4/signal").update({
        state: nextState,
        updatedAt: new Date().toISOString(),
        t: (window as any).firebase.database.ServerValue.TIMESTAMP
      });
    } catch (_) {
      // Keep local state while offline.
    }
  };

  return (
    <PageShell pageClassName="role-page" cardClassName="role-card" maxWidth={1000}>
      <LegacyFirebaseScripts onReady={() => setScriptsReady(true)} />
      <PanelHeader
        title={title}
        subtitle={session ? "Signed in as " + session.user : "Loading session..."}
        actions={<button type="button" onClick={() => router.push("/user-portal")}>Back to Role Select</button>}
      />

      <ChipRow className="chip-grid mt-14">
        <div className="rchip metric-chip"><span className="metric-label">Status</span><strong>{statusText}</strong></div>
        <div className="rchip metric-chip"><span className="metric-label">Network</span><strong>{isOnline ? "Online" : "Offline"}</strong></div>
        <div className="rchip metric-chip"><span className="metric-label">V2V Range</span><strong>{v2vRange}m</strong></div>
        <div className="rchip metric-chip"><span className="metric-label">V2I Range</span><strong>{v2iRange}m</strong></div>
        <div className="rchip metric-chip"><span className="metric-label">Last Sync</span><strong>{lastSyncAt || "-"}</strong></div>
        <div className="rchip metric-chip"><span className="metric-label">GPS Confidence</span><strong>{Math.round((gpsReport.confidence || 0) * 100)}%</strong></div>
        <div className="rchip metric-chip"><span className="metric-label">Rejected Spikes</span><strong>{gpsReport.outliersRejected || 0}</strong></div>
      </ChipRow>

      {!isOnline && <StatusMessage>Offline mode active. Position updates are queued and will flush on reconnect.</StatusMessage>}

      {position && (
        <ChipRow className="chip-grid mt-14">
          <div className="rchip metric-chip"><span className="metric-label">Latitude</span><strong>{Number(position.lat).toFixed(6)}</strong></div>
          <div className="rchip metric-chip"><span className="metric-label">Longitude</span><strong>{Number(position.lng).toFixed(6)}</strong></div>
          <div className="rchip metric-chip"><span className="metric-label">Accuracy</span><strong>{Math.round(position.accuracy || 0)}m</strong></div>
          <div className="rchip metric-chip"><span className="metric-label">Speed</span><strong>{Number(position.speed || 0).toFixed(1)} m/s</strong></div>
        </ChipRow>
      )}

      {isEmergency && (
        <ChipRow className="chip-grid mt-14">
          <label className="rchip role-select metric-chip">
            <span className="metric-label">Vehicle Type</span>
            <select className="role-select-field" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              <option value="ambulance">Ambulance</option>
              <option value="fire">Fire</option>
              <option value="police">Police</option>
            </select>
          </label>
          <div className="rchip metric-chip"><span className="metric-label">Distance to Signal</span><strong>{distToSignal === null ? "-" : distToSignal + "m"}</strong></div>
        </ChipRow>
      )}

      {!isEmergency && !isSignal && (
        <TableCard>
          <ChipRow className="chip-grid mt-14">
            <div className="rchip metric-chip"><span className="metric-label">Emergency Distance</span><strong>{distToEmergency === null ? "-" : distToEmergency + "m"}</strong></div>
            <div className="rchip metric-chip"><span className="metric-label">Yield Guidance</span><strong>{yieldSide || "-"}</strong></div>
            <div className={"rchip metric-chip " + (danger ? "rchip-danger" : "") }><span className="metric-label">Alert</span><strong>{danger ? "YIELD NOW" : "Clear"}</strong></div>
          </ChipRow>
        </TableCard>
      )}

      {isSignal && (
        <TableCard>
          <ChipRow className="chip-grid mt-14">
            <div className="rchip metric-chip"><span className="metric-label">EV Proximity</span><strong>{preempt ? "Within V2I Range" : "No EV in range"}</strong></div>
            <div className="legacy-actions">
              <button type="button" onClick={() => updateSignalState("RED")}>Set RED</button>
              <button type="button" onClick={() => updateSignalState("YELLOW")}>Set YELLOW</button>
              <button type="button" onClick={() => updateSignalState("GREEN")}>Set GREEN</button>
            </div>
            <div className="rchip metric-chip"><span className="metric-label">Current Signal State</span><strong>{signalState}</strong></div>
          </ChipRow>
        </TableCard>
      )}
    </PageShell>
  );
}
