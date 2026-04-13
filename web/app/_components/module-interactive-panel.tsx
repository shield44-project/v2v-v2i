"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  appendLog,
  readSnapshot,
  subscribeRealtime,
  updateEmergency,
  updateSignals,
  updateVehicle,
} from "@/lib/v2x/realtime";
import { KalmanFilter2D } from "@/lib/v2x/kalman";
import {
  bearingBetweenCoordinates,
  getYieldAction,
  headingToDirection,
  isEvApproaching,
  predictFuturePosition,
  vincentyDistanceMeters,
} from "@/lib/v2x/geodesy";
import { generateV2XAiInsights } from "@/lib/v2x/risk-model";
import type { NodeRole, RealtimeSnapshot, SignalDirection, VehicleType } from "@/lib/v2x/types";
import type { MapMode } from "@/app/_components/live-map";

const LiveMap = dynamic(() => import("@/app/_components/live-map"), { ssr: false });

type ModuleInteractivePanelProps = {
  slug: string;
  title: string;
};

const ROLE_FROM_SLUG: Record<string, NodeRole> = {
  emergency: "emergency",
  signal: "signal",
  vehicle1: "vehicle1",
  vehicle2: "vehicle2",
  admin: "admin",
  "admin-preview": "admin",
  control: "admin",
  "user-portal": "admin",
};

const EV_DRIFT_LAT_FREQUENCY = 0.45;
const EV_DRIFT_LNG_FREQUENCY = 0.41;
const EV_DRIFT_AMPLITUDE = 0.00001;
const MIN_GPS_ACCURACY_METERS = 2.5;
const MAX_GPS_ACCURACY_METERS = 35;
const DEFAULT_GPS_ACCURACY_METERS = 8;

function drift(seed: number, scale: number): number {
  return Math.sin(seed) * scale;
}

function signalTemplate(direction: SignalDirection) {
  if (direction === "north" || direction === "south") {
    return { north: "green", south: "green", east: "red", west: "red" } as const;
  }
  return { north: "red", south: "red", east: "green", west: "green" } as const;
}

function triggerSirenBeep(intensity: number = 0.5): void {
  if (typeof window === "undefined") return;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const clampedIntensity = Math.min(1, Math.max(0.05, intensity));
    const peakGain = 0.04 + clampedIntensity * 0.22;

    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.22);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.3);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.32);
  } catch {
    // AudioContext may be unavailable in some environments
  }
}

function triggerVibration(): void {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([200, 100, 200, 100, 400]);
  }
}

function compactTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour12: false });
}

export default function ModuleInteractivePanel({ slug, title }: ModuleInteractivePanelProps) {
  const role = ROLE_FROM_SLUG[slug] ?? "admin";
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot>(() => readSnapshot());
  const [mapMode, setMapMode] = useState<MapMode>("street");
  const [gpsStatus, setGpsStatus] = useState("Awaiting GPS signal");
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "degraded">("connected");
  const [simulationMode, setSimulationMode] = useState(false);

  const kalmanRef = useRef(new KalmanFilter2D());
  const evRawRef = useRef({
    latitude: snapshot.vehicles.emergency.latitude,
    longitude: snapshot.vehicles.emergency.longitude,
  });
  const tickRef = useRef(0);
  const warning50Ref = useRef(false);
  const warning25Ref = useRef(false);
  const signalOverrideRef = useRef<"normal" | "override">(snapshot.signals.mode);
  const geoWatchRef = useRef<number | null>(null);
  const snapshotRef = useRef(snapshot);
  const connectionRef = useRef(connectionStatus);
  const simulationModeRef = useRef(simulationMode);

  const emergencyNode = snapshot.vehicles.emergency;
  const signalNode = snapshot.vehicles.signal;

  const civilianNodes = useMemo(
    () => [snapshot.vehicles.vehicle1, snapshot.vehicles.vehicle2],
    [snapshot.vehicles.vehicle1, snapshot.vehicles.vehicle2],
  );

  const civilianMetrics = useMemo(() => {
    return civilianNodes.map((node) => {
      const distance = vincentyDistanceMeters(
        node.kalmanLatitude,
        node.kalmanLongitude,
        emergencyNode.kalmanLatitude,
        emergencyNode.kalmanLongitude,
      );

      const approaching = isEvApproaching(
        emergencyNode.kalmanLatitude,
        emergencyNode.kalmanLongitude,
        emergencyNode.heading,
        node.kalmanLatitude,
        node.kalmanLongitude,
      );

      const bearingToEV = bearingBetweenCoordinates(
        node.kalmanLatitude,
        node.kalmanLongitude,
        emergencyNode.kalmanLatitude,
        emergencyNode.kalmanLongitude,
      );
      const { action: yieldAction, arrow: yieldArrow } = approaching
        ? getYieldAction(node.heading, bearingToEV)
        : { action: "Normal Driving", arrow: "✅" };

      return {
        id: node.id,
        label: node.label,
        distance,
        approaching,
        warning: distance <= 25,
        alert50: distance <= 50 && approaching,
        alert25: distance <= 25 && approaching,
        yieldAction,
        yieldArrow,
        heading: emergencyNode.heading,
      };
    });
  }, [civilianNodes, emergencyNode]);

  const nearbyCount = civilianMetrics.filter((m) => m.distance <= 25).length;

  const evToSignalDistance = useMemo(
    () =>
      vincentyDistanceMeters(
        emergencyNode.kalmanLatitude,
        emergencyNode.kalmanLongitude,
        signalNode.kalmanLatitude,
        signalNode.kalmanLongitude,
      ),
    [
      emergencyNode.kalmanLatitude,
      emergencyNode.kalmanLongitude,
      signalNode.kalmanLatitude,
      signalNode.kalmanLongitude,
    ],
  );

  const evDirection = headingToDirection(emergencyNode.heading);
  const aiInsights = useMemo(
    () =>
      generateV2XAiInsights(
        snapshot,
        civilianMetrics.map((metric) => ({
          id: metric.id,
          label: metric.label,
          distanceMeters: metric.distance,
          approaching: metric.approaching,
        })),
        evToSignalDistance,
      ),
    [civilianMetrics, evToSignalDistance, snapshot],
  );

  const predictedPosition = useMemo(
    () =>
      predictFuturePosition(
        emergencyNode.kalmanLatitude,
        emergencyNode.kalmanLongitude,
        emergencyNode.speed,
        emergencyNode.heading,
        5,
      ),
    [emergencyNode.heading, emergencyNode.kalmanLatitude, emergencyNode.kalmanLongitude, emergencyNode.speed],
  );

  // — sync refs ———————————————————————————————————————————
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  useEffect(() => { connectionRef.current = connectionStatus; }, [connectionStatus]);
  useEffect(() => { simulationModeRef.current = simulationMode; }, [simulationMode]);

  // — global realtime subscription ————————————————————————
  useEffect(() => {
    const unsubscribe = subscribeRealtime((next) => setSnapshot(next));
    return unsubscribe;
  }, []);

  // — online/offline detection ————————————————————————————
  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateConnection = () => {
      setConnectionStatus(navigator.onLine ? "connected" : "degraded");
    };
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  // — GPS watch (emergency role only, unless simulation mode) —
  useEffect(() => {
    if (simulationMode) {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }
      setGpsStatus("Simulation mode active — GPS overridden");
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus("Browser geolocation unavailable. Running simulation feed.");
      return;
    }

    setGpsStatus("Tracking live GPS feed");
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (simulationModeRef.current) return;
        evRawRef.current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        updateVehicle("emergency", {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.min(
            MAX_GPS_ACCURACY_METERS,
            Math.max(MIN_GPS_ACCURACY_METERS, position.coords.accuracy || DEFAULT_GPS_ACCURACY_METERS),
          ),
          speed: Math.max(0, position.coords.speed ?? snapshotRef.current.vehicles.emergency.speed),
          heading:
            position.coords.heading ??
            bearingBetweenCoordinates(
              snapshotRef.current.vehicles.emergency.latitude,
              snapshotRef.current.vehicles.emergency.longitude,
              position.coords.latitude,
              position.coords.longitude,
            ),
        });
      },
      () => {
        setGpsStatus("GPS permission denied, using simulated node movement.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 800 },
    );

    return () => {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
      }
    };
  }, [simulationMode]);

  // — simulation tick ————————————————————————————————————
  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentSnapshot = snapshotRef.current;
      const currentEmergencyNode = currentSnapshot.vehicles.emergency;
      const currentSignalNode = currentSnapshot.vehicles.signal;
      tickRef.current += 1;

      const nextEmergencyLat =
        evRawRef.current.latitude +
        drift(tickRef.current * EV_DRIFT_LAT_FREQUENCY, EV_DRIFT_AMPLITUDE);
      const nextEmergencyLng =
        evRawRef.current.longitude +
        drift(tickRef.current * EV_DRIFT_LNG_FREQUENCY, EV_DRIFT_AMPLITUDE);
      evRawRef.current = { latitude: nextEmergencyLat, longitude: nextEmergencyLng };

      const kalmanPoint = currentSnapshot.emergency.kalmanEnabled
        ? kalmanRef.current.update({ latitude: nextEmergencyLat, longitude: nextEmergencyLng })
        : { latitude: nextEmergencyLat, longitude: nextEmergencyLng };

      updateVehicle("emergency", {
        latitude: nextEmergencyLat,
        longitude: nextEmergencyLng,
        kalmanLatitude: kalmanPoint.latitude,
        kalmanLongitude: kalmanPoint.longitude,
        speed: Math.max(2, Math.min(22, currentEmergencyNode.speed + drift(tickRef.current * 0.33, 0.5))),
        heading: (currentEmergencyNode.heading + 4 + drift(tickRef.current * 0.21, 2)) % 360,
        broadcastEnabled: currentSnapshot.emergency.active,
        vehicleType: currentSnapshot.emergency.vehicleType,
        connectionStatus: connectionRef.current === "connected" ? "connected" : "degraded",
      });

      updateVehicle("vehicle1", {
        latitude: currentSnapshot.vehicles.vehicle1.latitude + drift(tickRef.current * 0.24, 0.000015),
        longitude: currentSnapshot.vehicles.vehicle1.longitude + drift(tickRef.current * 0.19, 0.000015),
        kalmanLatitude: currentSnapshot.vehicles.vehicle1.kalmanLatitude + drift(tickRef.current * 0.24, 0.000013),
        kalmanLongitude: currentSnapshot.vehicles.vehicle1.kalmanLongitude + drift(tickRef.current * 0.19, 0.000013),
        heading: (currentSnapshot.vehicles.vehicle1.heading + 2) % 360,
      });

      updateVehicle("vehicle2", {
        latitude: currentSnapshot.vehicles.vehicle2.latitude + drift(tickRef.current * 0.27, 0.000013),
        longitude: currentSnapshot.vehicles.vehicle2.longitude + drift(tickRef.current * 0.22, 0.000013),
        kalmanLatitude: currentSnapshot.vehicles.vehicle2.kalmanLatitude + drift(tickRef.current * 0.27, 0.000011),
        kalmanLongitude: currentSnapshot.vehicles.vehicle2.kalmanLongitude + drift(tickRef.current * 0.22, 0.000011),
        heading: (currentSnapshot.vehicles.vehicle2.heading + 1.5) % 360,
      });

      const evDistance = vincentyDistanceMeters(
        kalmanPoint.latitude,
        kalmanPoint.longitude,
        currentSignalNode.kalmanLatitude,
        currentSignalNode.kalmanLongitude,
      );

      // Proactive preemption: check if predicted position (5s ahead) is within 50m
      const predicted = predictFuturePosition(
        kalmanPoint.latitude,
        kalmanPoint.longitude,
        currentEmergencyNode.speed,
        currentEmergencyNode.heading,
        5,
      );
      const predictedDistance = vincentyDistanceMeters(
        predicted.latitude,
        predicted.longitude,
        currentSignalNode.kalmanLatitude,
        currentSignalNode.kalmanLongitude,
      );

      const shouldOverride =
        currentSnapshot.emergency.active &&
        (evDistance <= 50 || predictedDistance <= 50) &&
        isEvApproaching(
          kalmanPoint.latitude,
          kalmanPoint.longitude,
          currentEmergencyNode.heading,
          currentSignalNode.kalmanLatitude,
          currentSignalNode.kalmanLongitude,
        );

      if (shouldOverride) {
        const overrideDirection = headingToDirection(currentEmergencyNode.heading);
        updateSignals({
          ...signalTemplate(overrideDirection),
          mode: "override",
          source: "emergency",
          overrideDirection,
          evDistanceMeters: evDistance,
        });
      } else {
        updateSignals({
          mode: "normal",
          source: undefined,
          overrideDirection: undefined,
          evDistanceMeters: evDistance,
          north: "green",
          south: "green",
          east: "red",
          west: "red",
        });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // — proximity alerts (siren + vibration) ——————————————
  useEffect(() => {
    const has50 = civilianMetrics.some((m) => m.alert50);
    const has25 = civilianMetrics.some((m) => m.alert25);

    if (has50 && !warning50Ref.current) {
      warning50Ref.current = true;
      const closest = Math.min(...civilianMetrics.filter((m) => m.alert50).map((m) => m.distance));
      const intensity = Math.min(1, Math.max(0.15, 1 - closest / 50));
      triggerSirenBeep(intensity);
      appendLog({
        level: "warning",
        source: "v2v",
        message: `EV entered 50m alert zone (approaching) — ${civilianMetrics
          .filter((m) => m.alert50)
          .map((m) => m.label)
          .join(", ")}`,
      });
    }

    if (has25 && !warning25Ref.current) {
      warning25Ref.current = true;
      triggerSirenBeep(1);
      triggerVibration();
      appendLog({
        level: "critical",
        source: "v2v",
        message: `CRITICAL: EV within 25m of ${civilianMetrics
          .filter((m) => m.alert25)
          .map((m) => m.label)
          .join(", ")} — vibration alert triggered`,
      });
    }

    if (!has50) warning50Ref.current = false;
    if (!has25) warning25Ref.current = false;
  }, [civilianMetrics]);

  // — signal override log ————————————————————————————————
  useEffect(() => {
    if (signalOverrideRef.current === snapshot.signals.mode) return;
    signalOverrideRef.current = snapshot.signals.mode;
    appendLog({
      level: snapshot.signals.mode === "override" ? "critical" : "info",
      source: "signal",
      message:
        snapshot.signals.mode === "override"
          ? `Signal override engaged for ${evDirection.toUpperCase()} approach (${evToSignalDistance.toFixed(1)}m)`
          : "Signal override released, reverted to normal cycle",
    });
  }, [evDirection, evToSignalDistance, snapshot.signals.mode]);

  // — control actions ————————————————————————————————————
  const setEmergencyVehicleType = (vehicleType: VehicleType) => {
    updateEmergency({ vehicleType });
    updateVehicle("emergency", { vehicleType });
    appendLog({ level: "info", source: "emergency", message: `Emergency type changed to ${vehicleType.toUpperCase()}` });
  };

  const toggleBroadcast = () => {
    const nextActive = !snapshot.emergency.active;
    updateEmergency({ active: nextActive });
    updateVehicle("emergency", { broadcastEnabled: nextActive });
    appendLog({
      level: nextActive ? "critical" : "info",
      source: "emergency",
      message: `Broadcast ${nextActive ? "activated" : "deactivated"}`,
    });
  };

  const toggleKalman = () => {
    const enabled = !snapshot.emergency.kalmanEnabled;
    updateEmergency({ kalmanEnabled: enabled });
    appendLog({ level: "info", source: "emergency", message: `Kalman filter ${enabled ? "enabled" : "disabled"}` });
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <section className="animate-fade-in-up mt-8 rounded-2xl border border-zinc-800 bg-black/40 p-6">
      {/* Status bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
        <div>
          <p className="font-semibold text-zinc-100">{title}</p>
          <p className="text-zinc-500">GPS: {gpsStatus}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {simulationMode && (
            <span className="sim-badge">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
              Simulation
            </span>
          )}
          {connectionStatus === "degraded" && (
            <span className="low-net-badge">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              Low Network
            </span>
          )}
          <div className="text-right">
            <p className={connectionStatus === "connected" ? "acc-good text-xs" : "acc-medium text-xs"}>
              {connectionStatus === "connected" ? "● Connected" : "● Fallback mode"}
            </p>
          </div>
          {(role === "emergency" || role === "vehicle1" || role === "vehicle2") && (
            <button
              type="button"
              onClick={() => setSimulationMode((v) => !v)}
              className={`rounded-md border px-3 py-1 text-xs transition ${simulationMode ? "tab-active" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}
            >
              {simulationMode ? "Exit Sim" : "Sim Mode"}
            </button>
          )}
        </div>
      </div>

      {/* ── EMERGENCY VEHICLE ──────────────────────────────────────────────── */}
      {role === "emergency" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="animate-slide-in-left rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="font-semibold text-zinc-100">Emergency Vehicle Module</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["ambulance", "fire", "police"] as VehicleType[]).map((vehicleType) => (
                <button
                  key={vehicleType}
                  type="button"
                  className={`rounded-md border px-3 py-2 text-sm uppercase transition ${snapshot.emergency.vehicleType === vehicleType ? "tab-active" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"}`}
                  onClick={() => setEmergencyVehicleType(vehicleType)}
                >
                  {vehicleType === "ambulance" ? "🚑" : vehicleType === "fire" ? "🚒" : "🚓"} {vehicleType}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={toggleBroadcast}
                aria-label="Toggle emergency broadcast"
                className={`h-24 w-24 rounded-full border text-xs font-semibold tracking-wide transition ${
                  snapshot.emergency.active
                    ? "ev-active-glow border-red-500 bg-red-500/20 text-red-200"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {snapshot.emergency.active ? "BROADCAST ON" : "BROADCAST OFF"}
              </button>
              <button type="button" className="btn-secondary" onClick={toggleKalman}>
                Kalman {snapshot.emergency.kalmanEnabled ? "ON" : "OFF"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-zinc-800 p-2">
                <p className="text-zinc-500 text-xs">Raw GPS</p>
                <p className="font-mono text-zinc-200 text-xs">
                  {emergencyNode.latitude.toFixed(6)}, {emergencyNode.longitude.toFixed(6)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 p-2">
                <p className="text-zinc-500 text-xs">Kalman GPS</p>
                <p className="font-mono text-cyan-300 text-xs">
                  {emergencyNode.kalmanLatitude.toFixed(6)}, {emergencyNode.kalmanLongitude.toFixed(6)}
                </p>
              </div>
              <p className="text-zinc-400">Speed: {emergencyNode.speed.toFixed(1)} m/s</p>
              <p className="text-zinc-400">Heading: {emergencyNode.heading.toFixed(0)}° ({evDirection})</p>
              <p className="text-zinc-400">Accuracy: ±{emergencyNode.accuracy.toFixed(1)} m</p>
              <p className="text-zinc-400">Nearby V2V (25m): {nearbyCount}</p>
            </div>
          </article>

          <article className="animate-slide-in-right rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="font-semibold text-zinc-100">Predictive Routing (5 s)</h3>
            <p className="mt-2 font-mono text-xs text-zinc-300">
              {predictedPosition.latitude.toFixed(6)}, {predictedPosition.longitude.toFixed(6)}
            </p>
            <p className="mt-1 text-zinc-500 text-xs">
              Direction: {evDirection.toUpperCase()} · Broadcast {snapshot.emergency.active ? "ON" : "OFF"}
            </p>
            <div className="mt-4 space-y-2">
              {civilianMetrics.map((metric) => (
                <div
                  key={metric.id}
                  className={`rounded-lg border p-2 text-sm transition ${
                    metric.alert25
                      ? "warning-card animate-warning-pulse"
                      : metric.alert50
                        ? "border-yellow-500/40 bg-yellow-500/5"
                        : "border-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-zinc-200 font-medium">{metric.label}</p>
                    <span className="text-lg">{metric.yieldArrow}</span>
                  </div>
                  <p className={metric.alert25 ? "text-red-300 text-xs" : metric.alert50 ? "text-yellow-300 text-xs" : "text-zinc-500 text-xs"}>
                    {metric.alert25 ? "⚠ CRITICAL" : metric.alert50 ? "⚠ Approaching" : "Normal"} ·{" "}
                    {metric.distance.toFixed(1)} m
                    {metric.approaching ? "" : " · Moving away"}
                  </p>
                  {metric.approaching && metric.alert50 && (
                    <p className="text-xs text-zinc-400 mt-1">{metric.yieldAction}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="ai-card mt-4 rounded-lg border border-cyan-500/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-300">AI Guidance</p>
              <p className="mt-1 text-sm text-zinc-200">{aiInsights.overall.recommendation}</p>
              <p className="mt-1 text-xs text-zinc-400">
                Confidence {aiInsights.overall.confidence.toFixed(0)}% ·{" "}
                {aiInsights.overall.etaSeconds === null ? "ETA n/a" : `Signal ETA ${aiInsights.overall.etaSeconds}s`}
              </p>
            </div>
          </article>
        </div>
      )}

      {/* ── TRAFFIC SIGNAL ─────────────────────────────────────────────────── */}
      {role === "signal" && (
        <article className="animate-slide-in-left rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="font-semibold text-zinc-100">Traffic Signal Module</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Mode:{" "}
            <span
              className={`font-semibold ${snapshot.signals.mode === "override" ? "text-red-300" : "acc-good"}`}
            >
              {snapshot.signals.mode.toUpperCase()}
            </span>
            {" · "}EV distance: {evToSignalDistance.toFixed(1)} m
            {" · "}EV direction: {evDirection.toUpperCase()}
          </p>
          {snapshot.signals.mode === "override" && (
            <p className="mt-1 text-xs text-amber-300 animate-warning-pulse">
              ⚡ Proactive override active — EV predicted within 50 m
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(["north", "south", "east", "west"] as const).map((direction) => (
              <div
                key={direction}
                className={`rounded-lg border p-3 transition ${
                  snapshot.signals[direction] === "green"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : snapshot.signals[direction] === "yellow"
                      ? "border-yellow-500/30 bg-yellow-500/5"
                      : "border-red-500/30 bg-red-500/5"
                }`}
              >
                <p className="text-zinc-400 uppercase text-xs">{direction}</p>
                <p
                  className={`mt-1 text-sm font-bold ${
                    snapshot.signals[direction] === "green"
                      ? "text-emerald-400"
                      : snapshot.signals[direction] === "yellow"
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}
                >
                  ● {snapshot.signals[direction].toUpperCase()}
                </p>
              </div>
            ))}
          </div>
          <div className="ai-card mt-4 rounded-lg border border-cyan-500/20 p-3 text-sm">
            <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-300">AI Signal Copilot</p>
            <p className="mt-1 text-zinc-200">
              Risk score <span className="font-semibold text-cyan-300">{aiInsights.overall.score.toFixed(0)}</span>/100 ·{" "}
              {aiInsights.summary}
            </p>
            <p className="mt-1 text-zinc-400">{aiInsights.overall.recommendation}</p>
          </div>
          <p className="mt-4 text-xs text-zinc-600">
            Override triggers when EV is within 50 m or predicted within 50 m (5 s ahead) — approaching check active.
          </p>
        </article>
      )}

      {/* ── CIVILIAN VEHICLES (vehicle1 / vehicle2) ────────────────────────── */}
      {(role === "vehicle1" || role === "vehicle2") && (
        <div className="space-y-4">
          {/* Live map centred on this vehicle */}
          <article className="animate-slide-in-left rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-zinc-100">Live Map</h3>
              <div className="flex gap-2 flex-wrap text-xs">
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
            <LiveMap
              snapshot={snapshot}
              mode={mapMode}
              focusNodeId={role}
              showPredictedPath
            />
            <p className="mt-2 text-xs text-zinc-600">
              Red dashed line = EV predicted path (8 s ahead) · Red ring = 25 m · Yellow ring = 50 m
            </p>
          </article>

          {/* Safety status */}
          {civilianMetrics
            .filter((m) => m.id === role)
            .map((metric) => (
              <article
                key={metric.id}
                className={`animate-slide-in-right rounded-xl border p-4 transition ${
                  metric.alert25
                    ? "warning-card animate-warning-pulse"
                    : metric.alert50
                      ? "border-yellow-500/40 bg-yellow-500/5"
                      : "border-zinc-800 bg-zinc-950"
                }`}
              >
                <h3 className="font-semibold text-zinc-100">Civilian Vehicle (V2V)</h3>

                {/* Yield direction indicator */}
                <div className="mt-3 flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl ${
                      !metric.approaching || metric.distance > 100
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : metric.alert25
                          ? "border-red-500/80 bg-red-500/15 animate-warning-pulse"
                          : "border-yellow-500/60 bg-yellow-500/10"
                    }`}
                  >
                    {metric.yieldArrow}
                  </div>
                  <div>
                    <p
                      className={`text-lg font-bold ${
                        metric.alert25
                          ? "text-red-300"
                          : metric.alert50
                            ? "text-yellow-300"
                            : "acc-good"
                      }`}
                    >
                      {metric.yieldAction}
                    </p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {metric.approaching ? "EV approaching" : "EV not approaching"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-zinc-800 bg-black/40 p-2">
                    <p className="text-zinc-500 text-xs">EV Type</p>
                    <p className="font-semibold text-zinc-200 uppercase">
                      {snapshot.emergency.vehicleType === "ambulance"
                        ? "🚑"
                        : snapshot.emergency.vehicleType === "fire"
                          ? "🚒"
                          : "🚓"}{" "}
                      {snapshot.emergency.vehicleType}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-black/40 p-2">
                    <p className="text-zinc-500 text-xs">Distance</p>
                    <p
                      className={`font-bold ${metric.alert25 ? "text-red-300" : metric.alert50 ? "text-yellow-300" : "text-zinc-200"}`}
                    >
                      {metric.distance.toFixed(1)} m
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-black/40 p-2">
                    <p className="text-zinc-500 text-xs">EV Heading</p>
                    <p className="text-zinc-200">{metric.heading.toFixed(0)}° ({evDirection})</p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-black/40 p-2">
                    <p className="text-zinc-500 text-xs">Status</p>
                    <p
                      className={`font-semibold ${metric.alert25 ? "text-red-300" : metric.alert50 ? "text-yellow-300" : "acc-good"}`}
                    >
                      {metric.alert25 ? "⚠ CRITICAL" : metric.alert50 ? "⚠ Warning" : "Normal"}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-zinc-600">
                  🔊 Siren triggers at 50 m · 📳 Vibration at 25 m · Only when EV is approaching.
                </p>
                {aiInsights.perVehicle[metric.id] && (
                  <div className="ai-card mt-3 rounded-lg border border-cyan-500/20 p-3 text-sm">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-300">AI Yield Assistant</p>
                    <p className="mt-1 text-zinc-200">
                      Score {aiInsights.perVehicle[metric.id].score.toFixed(0)}/100 ·{" "}
                      {aiInsights.perVehicle[metric.id].level.toUpperCase()}
                    </p>
                    <p className="mt-1 text-zinc-400">{aiInsights.perVehicle[metric.id].recommendation}</p>
                  </div>
                )}
              </article>
            ))}
        </div>
      )}

      {/* ── ADMIN / CONTROL / USER-PORTAL ──────────────────────────────────── */}
      {role === "admin" && (
        <div className="space-y-4">
          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="font-semibold text-zinc-100">Admin Control Center</h3>
              <div className="flex gap-2 text-sm flex-wrap">
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
            <p className="text-xs text-zinc-500 mb-3">
              Live nodes: {Object.keys(snapshot.vehicles).length} · EV 25 m zone (red) · V2I 50 m zone (yellow) ·
              Dashed line = predicted path
            </p>
            <LiveMap snapshot={snapshot} mode={mapMode} showPredictedPath />
          </article>

          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="font-semibold text-zinc-100 mb-3">Node Status</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.values(snapshot.vehicles).map((node) => (
                <div key={node.id} className="rounded-lg border border-zinc-800 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-zinc-200">{node.label}</p>
                    <span className={node.connectionStatus === "connected" ? "acc-good text-xs" : "acc-medium text-xs"}>
                      {node.connectionStatus.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs mt-1">
                    {node.kalmanLatitude.toFixed(5)}, {node.kalmanLongitude.toFixed(5)}
                  </p>
                  <p className="text-zinc-500 text-xs">
                    Speed {node.speed.toFixed(1)} m/s · Heading {node.heading.toFixed(0)}°
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="ai-card rounded-xl border border-cyan-500/20 bg-zinc-950 p-4">
            <h3 className="font-semibold text-zinc-100">AI Incident Forecast</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Overall {aiInsights.overall.level.toUpperCase()} · Score {aiInsights.overall.score.toFixed(0)}/100 · Confidence{" "}
              {aiInsights.overall.confidence.toFixed(0)}%
            </p>
            <p className="mt-2 text-sm text-zinc-300">{aiInsights.summary}</p>
            <p className="mt-1 text-sm text-zinc-400">{aiInsights.overall.recommendation}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {civilianMetrics.map((metric) => {
                const insight = aiInsights.perVehicle[metric.id];
                return (
                  <div key={`ai-${metric.id}`} className="rounded-md border border-zinc-800 bg-black/30 p-2 text-xs text-zinc-300">
                    <p className="font-medium text-zinc-200">{metric.label}</p>
                    <p className="mt-0.5">Risk {insight?.score.toFixed(0) ?? "0"}/100 · {insight?.level.toUpperCase() ?? "LOW"}</p>
                    <p className="mt-0.5 text-zinc-500">{insight?.recommendation ?? "No active recommendation."}</p>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="font-semibold text-zinc-100 mb-3">Live Logs</h3>
            <div className="max-h-64 overflow-auto space-y-2 pr-1">
              {snapshot.logs.length === 0 ? (
                <p className="text-zinc-600 text-sm">No events yet.</p>
              ) : (
                snapshot.logs.slice(0, 25).map((log) => (
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
                    <p className="text-zinc-300">
                      [{compactTime(log.timestamp)}] {log.message}
                    </p>
                    <p className="text-zinc-600 text-xs uppercase mt-0.5">
                      {log.source} · {log.level}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
