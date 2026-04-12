"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ModuleInteractivePanelProps = {
  slug: string;
  title: string;
};

type UnitId = "emergency" | "signal" | "vehicle1" | "vehicle2";
type MapLayer = "street" | "satellite";
type DashboardTab = "overview" | "dashboard" | "gps" | "map";

type UnitState = {
  id: UnitId;
  label: string;
  lat: number;
  lng: number;
  speed: number;
  bearing: number;
  confidence: number;
  accuracy: number;
  gpsLock: boolean;
};

const BASE_COORDS = { lat: 12.918, lng: 77.6205 };
const ADMIN_SLUGS = ["admin", "admin-preview"] as const;
const TABS: DashboardTab[] = ["overview", "dashboard", "gps", "map"];
const MIN_ACCURACY = 3;
const DEFAULT_ACCURACY = 8;
const MAX_ACCURACY = 30;
const TAB_LABELS: Record<DashboardTab, string> = {
  overview: "Overview",
  dashboard: "Dashboard",
  gps: "GPS",
  map: "Map",
};

const DEFAULT_UNITS: UnitState[] = [
  {
    id: "emergency",
    label: "Emergency",
    lat: BASE_COORDS.lat + 0.0002,
    lng: BASE_COORDS.lng + 0.0002,
    speed: 7.2,
    bearing: 35,
    confidence: 91,
    accuracy: 5.3,
    gpsLock: true,
  },
  {
    id: "signal",
    label: "Signal",
    lat: BASE_COORDS.lat - 0.0003,
    lng: BASE_COORDS.lng + 0.0001,
    speed: 0.1,
    bearing: 0,
    confidence: 99,
    accuracy: 3.2,
    gpsLock: true,
  },
  {
    id: "vehicle1",
    label: "Vehicle 1",
    lat: BASE_COORDS.lat + 0.0004,
    lng: BASE_COORDS.lng - 0.0003,
    speed: 4.9,
    bearing: 118,
    confidence: 87,
    accuracy: 7.9,
    gpsLock: true,
  },
  {
    id: "vehicle2",
    label: "Vehicle 2",
    lat: BASE_COORDS.lat - 0.0004,
    lng: BASE_COORDS.lng - 0.0002,
    speed: 3.3,
    bearing: 255,
    confidence: 89,
    accuracy: 6.8,
    gpsLock: true,
  },
];

/**
 * Produces a pseudo-random delta for smooth simulation updates.
 */
function drift(seed: number, scale: number): number {
  return Math.sin(seed) * scale;
}

/**
 * Builds an embeddable map source URL for the selected map layer.
 */
function buildMapSrc(layer: MapLayer, lat: number, lng: number): string {
  if (layer === "satellite") {
    return `https://maps.google.com/maps?q=${lat},${lng}&z=16&t=k&output=embed`;
  }
  return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
}

/**
 * Renders functional GPS, dashboard, and map controls for module pages.
 */
export default function ModuleInteractivePanel({ slug, title }: ModuleInteractivePanelProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [mapLayer, setMapLayer] = useState<MapLayer>("street");
  const [units, setUnits] = useState<UnitState[]>(DEFAULT_UNITS);
  const [trackerStatus, setTrackerStatus] = useState("Idle");
  const [gpsStatus, setGpsStatus] = useState("Ready");
  const [selectedUnit, setSelectedUnit] = useState<UnitId>("emergency");
  const [search, setSearch] = useState("");

  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const geoWatchRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const tickRef = useRef(0);

  const selectedUnitData = useMemo(
    () => units.find((unit) => unit.id === selectedUnit) ?? units[0],
    [selectedUnit, units],
  );

  const averageAccuracy = useMemo(() => {
    const sum = units.reduce((acc, unit) => acc + unit.accuracy, 0);
    return (sum / units.length).toFixed(1);
  }, [units]);

  const initializeTrackers = useCallback(() => {
    setTrackerStatus("GPS tracker active on 4/4 units");
    setUnits(DEFAULT_UNITS);
  }, []);

  const useCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("Geolocation is not supported in this browser.");
      return;
    }

    setGpsStatus("Requesting location permission…");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsStatus("Live location connected.");
        const { latitude, longitude, accuracy } = position.coords;
        setUnits((prev) =>
          prev.map((unit) =>
            unit.id === "emergency"
              ? {
                  ...unit,
                  lat: latitude,
                  lng: longitude,
                  accuracy: Math.max(
                    MIN_ACCURACY,
                    Math.min(accuracy || DEFAULT_ACCURACY, MAX_ACCURACY),
                  ),
                  confidence: 95,
                  gpsLock: true,
                }
              : unit,
          ),
        );
      },
      () => {
        setGpsStatus("Location permission denied. Using simulated GPS feed.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );

    if (geoWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
    }

    if (!mountedRef.current) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setUnits((prev) =>
          prev.map((unit) =>
            unit.id === "emergency"
              ? {
                  ...unit,
                  lat: latitude,
                  lng: longitude,
                  accuracy: Math.max(
                    MIN_ACCURACY,
                    Math.min(accuracy || DEFAULT_ACCURACY, MAX_ACCURACY),
                  ),
                  confidence: 96,
                  gpsLock: true,
                }
              : unit,
          ),
        );
      },
      () => {
        setGpsStatus("Live watch unavailable. Continuing with simulated data.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 2000 },
    );

    if (mountedRef.current) {
      geoWatchRef.current = watchId;
    } else {
      navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    initializeTrackers();
  }, [initializeTrackers]);

  useEffect(() => {
    simulationTimerRef.current = setInterval(() => {
      tickRef.current += 1;
      setUnits((prev) =>
        prev.map((unit, index) => {
          const t = tickRef.current + index * 3;
          const lat = unit.lat + drift(t * 0.35, 0.00003);
          const lng = unit.lng + drift(t * 0.31, 0.00003);
          const speed = Math.max(0, Math.min(14, unit.speed + drift(t * 0.5, 0.35)));
          const bearing = (unit.bearing + 2 + index) % 360;
          const confidence = Math.max(
            70,
            Math.min(99, unit.confidence + drift(t * 0.2, 1.2)),
          );
          const accuracy = Math.max(
            MIN_ACCURACY,
            Math.min(22, unit.accuracy + drift(t * 0.28, 0.4)),
          );

          return {
            ...unit,
            lat,
            lng,
            speed,
            bearing,
            confidence,
            accuracy,
            gpsLock: true,
          };
        }),
      );
    }, 1000);

    return () => {
      mountedRef.current = false;
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }
    };
  }, []);

  const filteredAdminRows = useMemo(() => {
    const rows = units.map((unit) => ({
      key: unit.id,
      module: unit.label,
      state: unit.gpsLock ? "Online" : "Offline",
      accuracy: `${unit.accuracy.toFixed(1)}m`,
      confidence: `${unit.confidence.toFixed(0)}%`,
    }));

    const q = search.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter((row) => row.module.toLowerCase().includes(q));
  }, [search, units]);

  const isAdminReviewModule = ADMIN_SLUGS.includes(
    slug as (typeof ADMIN_SLUGS)[number],
  );
  const mapSrc = buildMapSrc(mapLayer, selectedUnitData.lat, selectedUnitData.lng);

  return (
    <section className="mt-8 rounded-2xl border border-zinc-800 bg-black/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-100">Live Module Tools</h2>
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm ${
                activeTab === tab
                  ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
        <p>
          <strong>{title}</strong> · Tracker status: {trackerStatus}
        </p>
        <p className="mt-1">GPS status: {gpsStatus}</p>
      </div>

      {activeTab === "overview" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            className="btn-primary cursor-pointer"
            onClick={initializeTrackers}
          >
            Initialize GPS Trackers (4 Units)
          </button>
          <button
            type="button"
            className="btn-secondary cursor-pointer"
            onClick={useCurrentLocation}
          >
            Use My GPS for Emergency Unit
          </button>
        </div>
      )}

      {activeTab === "gps" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {units.map((unit) => (
            <article key={unit.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="font-semibold text-zinc-100">{unit.label}</h3>
              <p className="mt-2 text-zinc-300">
                {unit.lat.toFixed(5)}, {unit.lng.toFixed(5)}
              </p>
              <p className="text-zinc-400">Accuracy: {unit.accuracy.toFixed(1)}m</p>
              <p className="text-zinc-400">Confidence: {unit.confidence.toFixed(0)}%</p>
              <p className="text-zinc-400">Speed: {unit.speed.toFixed(1)} m/s</p>
            </article>
          ))}
        </div>
      )}

      {activeTab === "dashboard" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="font-semibold text-zinc-100">Accuracy Snapshot</h3>
            <p className="mt-2 text-zinc-300">Average accuracy: {averageAccuracy}m</p>
            <p className="text-zinc-400">Units with GPS lock: {units.filter((u) => u.gpsLock).length}/4</p>
            <p className="text-zinc-400">Real-time feed interval: 1s</p>
          </article>
          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="font-semibold text-zinc-100">Interactive Controls</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {units.map((unit) => (
                <button
                  key={unit.id}
                  type="button"
                  className={`rounded-md border px-3 py-1 text-sm ${
                    selectedUnit === unit.id
                      ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                      : "border-zinc-700 bg-zinc-900 text-zinc-200"
                  }`}
                  onClick={() => setSelectedUnit(unit.id)}
                >
                  {unit.label}
                </button>
              ))}
            </div>
          </article>
        </div>
      )}

      {activeTab === "map" && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-md border px-3 py-1 text-sm ${
                mapLayer === "street"
                  ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200"
              }`}
              onClick={() => setMapLayer("street")}
            >
              Street
            </button>
            <button
              type="button"
              className={`rounded-md border px-3 py-1 text-sm ${
                mapLayer === "satellite"
                  ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200"
              }`}
              onClick={() => setMapLayer("satellite")}
            >
              Satellite
            </button>
            <span className="text-sm text-zinc-400">
              Showing {selectedUnitData.label} · {selectedUnitData.lat.toFixed(4)},{" "}
              {selectedUnitData.lng.toFixed(4)}
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <iframe
              key={`${mapLayer}-${selectedUnitData.id}`}
              src={mapSrc}
              width="100%"
              height="380"
              loading="lazy"
              className="block transition-opacity duration-300"
              title="Live map"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )}

      {isAdminReviewModule && (
        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="text-base font-semibold text-zinc-100">Admin Review</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Read-only operational review panel for all tracked modules.
          </p>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-3 w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-400"
            placeholder="Filter by module name"
            aria-label="Filter module rows"
          />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-zinc-400">
                  <th className="border-b border-zinc-800 px-2 py-2">Module</th>
                  <th className="border-b border-zinc-800 px-2 py-2">State</th>
                  <th className="border-b border-zinc-800 px-2 py-2">Accuracy</th>
                  <th className="border-b border-zinc-800 px-2 py-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdminRows.map((row) => (
                  <tr key={row.key} className="text-zinc-200">
                    <td className="border-b border-zinc-900 px-2 py-2">{row.module}</td>
                    <td className="border-b border-zinc-900 px-2 py-2">{row.state}</td>
                    <td className="border-b border-zinc-900 px-2 py-2">{row.accuracy}</td>
                    <td className="border-b border-zinc-900 px-2 py-2">{row.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}
