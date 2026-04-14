"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
  predictEmergencyCollisions,
  predictFuturePosition,
  vincentyDistanceMeters,
} from "@/lib/v2x/geodesy";
import {
  generateV2XAiInsights,
  TRAINED_V2X_MODELS,
  type AiRiskLevel,
  type V2XModelId,
} from "@/lib/v2x/risk-model";
import type { NodeRole, RealtimeSnapshot, SignalDirection, VehicleType } from "@/lib/v2x/types";
import type { MapMode } from "@/app/_components/live-map";
import { DEFAULT_LATITUDE, DEFAULT_LONGITUDE } from "@/lib/v2x/constants";

const LiveMap = dynamic(() => import("@/app/_components/live-map"), { ssr: false });
const StreetLevelMap3D = dynamic(() => import("@/app/_components/street-level-map-3d"), { ssr: false });

type ModuleInteractivePanelProps = {
  slug: string;
  title: string;
  isAdminUser: boolean;
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
// Approx. 3.3m latitude movement per button tap (demo-scale repositioning).
const VEHICLE_NUDGE_STEP = 0.00003;
// Converts small longitude deltas to stereo pan range [-1, 1] for alert cues.
const STEREO_PAN_LONGITUDE_SCALE_CLOSE = 3500;
const STEREO_PAN_LONGITUDE_SCALE_SIGNAL = 3200;
const ROUTE_WAYPOINTS: [number, number][] = [
  [12.91825, 77.62064],
  [12.91818, 77.62051],
  [12.91809, 77.62039],
  [12.91799, 77.62026],
  [12.9179, 77.62014],
  [12.91784, 77.62003],
];
const ALT_ROUTE_NORTH: [number, number][] = [
  [12.91825, 77.62064],
  [12.91835, 77.62058],
  [12.91843, 77.62046],
  [12.91831, 77.62027],
  [12.91817, 77.62013],
  [12.91799, 77.62003],
];
const ALT_ROUTE_SOUTH: [number, number][] = [
  [12.91825, 77.62064],
  [12.91812, 77.62074],
  [12.91798, 77.62067],
  [12.91784, 77.62052],
  [12.9178, 77.62033],
  [12.91784, 77.62003],
];

type DemoScenario = "urban-peak" | "intersection-block" | "low-latency";
type ChatbotMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};
const MAX_CHAT_HISTORY = 10;
const RESTRICTED_CONTROL_HINT = "Admin Gmail account required to change this control.";
const VEHICLE_ICON_BY_NODE_ID: Record<string, string> = {
  emergency: "🚑",
  signal: "🚦",
  vehicle1: "🚗",
  vehicle2: "🚙",
};

function drift(seed: number, scale: number): number {
  return Math.sin(seed) * scale;
}

function signalTemplate(direction: SignalDirection) {
  if (direction === "north" || direction === "south") {
    return { north: "green", south: "green", east: "red", west: "red" } as const;
  }
  return { north: "red", south: "red", east: "green", west: "green" } as const;
}

function interpolateRoutePoint(route: [number, number][], progress: number): { latitude: number; longitude: number; heading: number } {
  if (route.length < 2) {
    const [lat, lon] = route[0] ?? [DEFAULT_LATITUDE, DEFAULT_LONGITUDE];
    return { latitude: lat, longitude: lon, heading: 0 };
  }
  const clamped = ((progress % 1) + 1) % 1;
  const segmentFloat = clamped * (route.length - 1);
  const segmentIndex = Math.floor(segmentFloat);
  const nextIndex = Math.min(route.length - 1, segmentIndex + 1);
  const localT = segmentFloat - segmentIndex;
  const [latA, lonA] = route[segmentIndex];
  const [latB, lonB] = route[nextIndex];
  return {
    latitude: latA + (latB - latA) * localT,
    longitude: lonA + (lonB - lonA) * localT,
    heading: bearingBetweenCoordinates(latA, lonA, latB, lonB),
  };
}

function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}

function triggerSirenBeep(intensity: number = 0.5, pan = 0, masterVolume = 0.65): void {
  if (typeof window === "undefined") return;
  try {
    const context = createAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
    const clampedIntensity = Math.min(1, Math.max(0.05, intensity));
    const peakGain = (0.04 + clampedIntensity * 0.22) * Math.max(0, Math.min(1, masterVolume));

    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.22);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.3);

    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      oscillator.connect(gain).connect(panner).connect(context.destination);
    } else {
      oscillator.connect(gain).connect(context.destination);
    }
    oscillator.onended = () => {
      void context.close();
    };
    oscillator.start();
    oscillator.stop(context.currentTime + 0.32);
  } catch {
    // AudioContext may be unavailable in some environments
  }
}

function triggerPing(pan = 0, masterVolume = 0.5): void {
  const context = createAudioContext();
  if (!context) return;
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(720, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1200, context.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05 * masterVolume, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      oscillator.connect(gain).connect(panner).connect(context.destination);
    } else {
      oscillator.connect(gain).connect(context.destination);
    }
    oscillator.onended = () => {
      void context.close();
    };
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  } catch {}
}

function triggerVibration(): void {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([200, 100, 200, 100, 400]);
  }
}

function compactTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour12: false });
}

function formatRiskLabel(score: number, level: AiRiskLevel): string {
  return `${score.toFixed(0)}/100 · ${level.toUpperCase()}`;
}

function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "n/a";
  if (seconds <= 0) return "<1s";
  return `${Math.round(seconds)}s`;
}

function alertLevelChipClass(level: "critical" | "warning" | "normal"): string {
  if (level === "critical") return "border-red-500/50 text-red-300";
  if (level === "warning") return "border-yellow-500/50 text-yellow-300";
  return "border-emerald-500/50 text-emerald-300";
}

function signalLensClass(active: boolean, color: "red" | "yellow" | "green"): string {
  if (!active) return "bg-zinc-800/80 border-zinc-700";
  if (color === "green") return "bg-emerald-400 border-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.65)]";
  if (color === "yellow") return "bg-amber-300 border-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.6)]";
  return "bg-red-400 border-red-200 shadow-[0_0_18px_rgba(248,113,113,0.6)]";
}

function buildChatbotReply(
  prompt: string,
  aiSummary: string,
  recommendation: string,
  nearestDistanceMeters: number | null,
  etaSeconds: number | null,
  collisionCount: number,
  modelName: string,
): string {
  const text = prompt.toLowerCase();
  const nearest = nearestDistanceMeters === null ? "No nearby civilian targets in range." : `Closest vehicle is ${nearestDistanceMeters.toFixed(1)}m from EV.`;
  const eta = etaSeconds === null ? "Signal ETA unavailable due to low EV speed." : `EV reaches signal in ~${Math.max(1, Math.round(etaSeconds))}s.`;

  if (text.includes("model")) {
    return `Active model: ${modelName}. ${aiSummary}`;
  }
  if (text.includes("eta") || text.includes("when")) {
    return `${eta} ${nearest}`;
  }
  if (text.includes("collision") || text.includes("risk")) {
    return collisionCount > 0
      ? `${collisionCount} collision forecast(s) detected. ${recommendation}`
      : `No predicted collision windows right now. ${recommendation}`;
  }
  if (text.includes("vehicle") || text.includes("approach") || text.includes("distance")) {
    return `${nearest} ${recommendation}`;
  }
  if (text.includes("signal") || text.includes("override")) {
    return `${eta} Signal override is managed automatically when EV is within predictive threshold.`;
  }
  return `${aiSummary} ${recommendation} ${nearest}`;
}

export default function ModuleInteractivePanel({ slug, title, isAdminUser }: ModuleInteractivePanelProps) {
  const role = ROLE_FROM_SLUG[slug] ?? "admin";
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot>(() => readSnapshot());
  const [mapMode, setMapMode] = useState<MapMode>("street");
  const [mapView, setMapView] = useState<"2d" | "3d">("2d");
  const [mapResetToken, setMapResetToken] = useState(0);
  const [driverPov, setDriverPov] = useState(false);
  const [manualDriveMode, setManualDriveMode] = useState(false);
  const [manualLane, setManualLane] = useState<"left" | "center" | "right">("center");
  const [cameraHeight, setCameraHeight] = useState(18);
  const [cameraFov, setCameraFov] = useState(58);
  const [gpsStatus, setGpsStatus] = useState("Awaiting GPS signal");
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "degraded">("connected");
  const [simulationMode, setSimulationMode] = useState(false);
  const [demoRunning, setDemoRunning] = useState(true);
  const [demoPaused, setDemoPaused] = useState(false);
  const [demoSpeedMultiplier, setDemoSpeedMultiplier] = useState(1);
  const [demoScenario, setDemoScenario] = useState<DemoScenario>("urban-peak");
  const [activeAiModelId, setActiveAiModelId] = useState<V2XModelId>("hybrid-fusion-ops");
  const [routeProgress, setRouteProgress] = useState(0);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [predictionHorizonSeconds, setPredictionHorizonSeconds] = useState(8);
  const [safetyRadiusMeters, setSafetyRadiusMeters] = useState(28);
  const [showCommunication, setShowCommunication] = useState(true);
  const [audioMuted, setAudioMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState(65);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatbotMessage[]>([
    {
      id: "assistant-init",
      role: "assistant",
      text: "V2X Copilot online. Ask about risk, ETA, approaching vehicles, collisions, or active model.",
    },
  ]);

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
  const demoPausedRef = useRef(demoPaused);
  const demoSpeedRef = useRef(demoSpeedMultiplier);
  const routeProgressRef = useRef(routeProgress);

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
  const evEtaToSignalSeconds = emergencyNode.speed > 0.1 ? evToSignalDistance / emergencyNode.speed : null;
  const highestAlertLevel = civilianMetrics.some((metric) => metric.alert25)
    ? "critical"
    : civilianMetrics.some((metric) => metric.alert50)
      ? "warning"
      : "normal";
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
        activeAiModelId,
      ),
    [activeAiModelId, civilianMetrics, evToSignalDistance, snapshot],
  );
  const activeAiModel = useMemo(
    () =>
      TRAINED_V2X_MODELS.find((model) => model.id === activeAiModelId) ??
      TRAINED_V2X_MODELS.find((model) => model.id === "hybrid-fusion-ops") ??
      TRAINED_V2X_MODELS[0],
    [activeAiModelId],
  );
  const nearestApproachDistance = useMemo(() => {
    if (civilianMetrics.length === 0) return null;
    return civilianMetrics.reduce<number | null>(
      (nearest, metric) => (nearest === null ? metric.distance : Math.min(nearest, metric.distance)),
      null,
    );
  }, [civilianMetrics]);
  const moveEmergencyByMeters = useCallback((distanceMeters: number, headingOffsetDegrees = 0) => {
    const node = snapshot.vehicles.emergency;
    const heading = node.heading + headingOffsetDegrees + (distanceMeters < 0 ? 180 : 0);
    const next = predictFuturePosition(
      node.kalmanLatitude,
      node.kalmanLongitude,
      Math.abs(distanceMeters),
      heading,
      1,
    );
    updateVehicle("emergency", {
      latitude: next.latitude,
      longitude: next.longitude,
      kalmanLatitude: next.latitude,
      kalmanLongitude: next.longitude,
      heading: ((heading % 360) + 360) % 360,
    });
  }, [snapshot.vehicles.emergency]);

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

  const radarTargets = useMemo(
    () =>
      civilianMetrics.map((metric) => {
        const node = snapshot.vehicles[metric.id];
        const bearing = bearingBetweenCoordinates(
          emergencyNode.kalmanLatitude,
          emergencyNode.kalmanLongitude,
          node.kalmanLatitude,
          node.kalmanLongitude,
        );
        const clampedDistance = Math.max(0, Math.min(metric.distance, 90));
        const radius = (clampedDistance / 90) * 44;
        const radians = ((bearing - 90) * Math.PI) / 180;
        return {
          id: metric.id,
          label: metric.label,
          x: 50 + Math.cos(radians) * radius,
          y: 50 + Math.sin(radians) * radius,
          alertClass: metric.alert25 ? "text-red-400" : metric.alert50 ? "text-yellow-300" : "text-emerald-300",
          distance: metric.distance,
        };
      }),
    [civilianMetrics, emergencyNode.kalmanLatitude, emergencyNode.kalmanLongitude, snapshot.vehicles],
  );

  const alternateRoutes = useMemo<[number, number][][]>(() => [ALT_ROUTE_NORTH, ALT_ROUTE_SOUTH], []);
  const chosenRoute = useMemo<[number, number][]>(() => {
    if (demoScenario === "intersection-block") {
      return selectedRouteIndex === 0 ? ALT_ROUTE_NORTH : ALT_ROUTE_SOUTH;
    }
    return ROUTE_WAYPOINTS;
  }, [demoScenario, selectedRouteIndex]);

  const communicationLinks = useMemo(() => {
    const baselineLatency = demoScenario === "low-latency" ? 28 : demoScenario === "intersection-block" ? 92 : 55;
    return [
      { from: "emergency", to: "signal", latencyMs: baselineLatency + 12 },
      { from: "emergency", to: "vehicle1", latencyMs: baselineLatency + 4 },
      { from: "emergency", to: "vehicle2", latencyMs: baselineLatency + 9 },
      { from: "vehicle1", to: "signal", latencyMs: baselineLatency + 18 },
      { from: "vehicle2", to: "signal", latencyMs: baselineLatency + 14 },
    ];
  }, [demoScenario]);
  const averageCommunicationLatency = useMemo(() => {
    if (communicationLinks.length === 0) return null;
    return communicationLinks.reduce((sum, link) => sum + link.latencyMs, 0) / communicationLinks.length;
  }, [communicationLinks]);

  const collisionForecasts = useMemo(
    () =>
      predictEmergencyCollisions(
        emergencyNode,
        civilianNodes.map((node) => ({
          id: node.id,
          kalmanLatitude: node.kalmanLatitude,
          kalmanLongitude: node.kalmanLongitude,
          speed: node.speed,
          heading: node.heading,
        })),
        predictionHorizonSeconds,
        safetyRadiusMeters,
      ),
    [civilianNodes, emergencyNode, predictionHorizonSeconds, safetyRadiusMeters],
  );

  // — sync refs ———————————————————————————————————————————
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  useEffect(() => { connectionRef.current = connectionStatus; }, [connectionStatus]);
  useEffect(() => { simulationModeRef.current = simulationMode; }, [simulationMode]);
  useEffect(() => { demoPausedRef.current = demoPaused; }, [demoPaused]);
  useEffect(() => { demoSpeedRef.current = demoSpeedMultiplier; }, [demoSpeedMultiplier]);
  useEffect(() => { routeProgressRef.current = routeProgress; }, [routeProgress]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("v2x-demo-scenario", demoScenario);
    window.localStorage.setItem(
      "v2x-debug-info",
      JSON.stringify({
        role,
        mapView,
        routeProgress: Number((routeProgress * 100).toFixed(1)),
        collisions: collisionForecasts.length,
        communication: showCommunication,
      }),
    );
  }, [collisionForecasts.length, demoScenario, mapView, role, routeProgress, showCommunication]);

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
      if (demoPausedRef.current) return;
      const currentSnapshot = snapshotRef.current;
      const currentEmergencyNode = currentSnapshot.vehicles.emergency;
      const currentSignalNode = currentSnapshot.vehicles.signal;
      const speedScale = Math.max(0.25, Math.min(3, demoSpeedRef.current));
      tickRef.current += 1;

      let nextEmergencyLat =
        evRawRef.current.latitude +
        drift(tickRef.current * EV_DRIFT_LAT_FREQUENCY, EV_DRIFT_AMPLITUDE * speedScale);
      let nextEmergencyLng =
        evRawRef.current.longitude +
        drift(tickRef.current * EV_DRIFT_LNG_FREQUENCY, EV_DRIFT_AMPLITUDE * speedScale);
      let nextHeading = (currentEmergencyNode.heading + 4 + drift(tickRef.current * 0.21, 2)) % 360;

      if (demoRunning || simulationModeRef.current) {
        const nextProgress = (routeProgressRef.current + 0.018 * speedScale) % 1;
        routeProgressRef.current = nextProgress;
        setRouteProgress(nextProgress);
        const routePoint = interpolateRoutePoint(chosenRoute, nextProgress);
        nextEmergencyLat = routePoint.latitude;
        nextEmergencyLng = routePoint.longitude;
        nextHeading = routePoint.heading;
      }

      evRawRef.current = { latitude: nextEmergencyLat, longitude: nextEmergencyLng };

      const kalmanPoint = currentSnapshot.emergency.kalmanEnabled
        ? kalmanRef.current.update({ latitude: nextEmergencyLat, longitude: nextEmergencyLng })
        : { latitude: nextEmergencyLat, longitude: nextEmergencyLng };

      updateVehicle("emergency", {
        latitude: nextEmergencyLat,
        longitude: nextEmergencyLng,
        kalmanLatitude: kalmanPoint.latitude,
        kalmanLongitude: kalmanPoint.longitude,
        speed: Math.max(2, Math.min(24, currentEmergencyNode.speed + drift(tickRef.current * 0.33, 0.5 * speedScale))),
        heading: nextHeading,
        broadcastEnabled: currentSnapshot.emergency.active,
        vehicleType: currentSnapshot.emergency.vehicleType,
        connectionStatus: connectionRef.current === "connected" ? "connected" : "degraded",
      });

      updateVehicle("vehicle1", {
        latitude: currentSnapshot.vehicles.vehicle1.latitude + drift(tickRef.current * 0.24, 0.000015 * speedScale),
        longitude: currentSnapshot.vehicles.vehicle1.longitude + drift(tickRef.current * 0.19, 0.000015 * speedScale),
        kalmanLatitude: currentSnapshot.vehicles.vehicle1.kalmanLatitude + drift(tickRef.current * 0.24, 0.000013 * speedScale),
        kalmanLongitude: currentSnapshot.vehicles.vehicle1.kalmanLongitude + drift(tickRef.current * 0.19, 0.000013 * speedScale),
        heading: (currentSnapshot.vehicles.vehicle1.heading + 2 * speedScale) % 360,
      });

      updateVehicle("vehicle2", {
        latitude: currentSnapshot.vehicles.vehicle2.latitude + drift(tickRef.current * 0.27, 0.000013 * speedScale),
        longitude: currentSnapshot.vehicles.vehicle2.longitude + drift(tickRef.current * 0.22, 0.000013 * speedScale),
        kalmanLatitude: currentSnapshot.vehicles.vehicle2.kalmanLatitude + drift(tickRef.current * 0.27, 0.000011 * speedScale),
        kalmanLongitude: currentSnapshot.vehicles.vehicle2.kalmanLongitude + drift(tickRef.current * 0.22, 0.000011 * speedScale),
        heading: (currentSnapshot.vehicles.vehicle2.heading + 1.5 * speedScale) % 360,
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
  }, [chosenRoute, demoRunning]);

  // — proximity alerts (siren + vibration) ——————————————
  useEffect(() => {
    const has50 = civilianMetrics.some((m) => m.alert50);
    const has25 = civilianMetrics.some((m) => m.alert25);

    if (has50 && !warning50Ref.current) {
      warning50Ref.current = true;
      const closest = Math.min(...civilianMetrics.filter((m) => m.alert50).map((m) => m.distance));
      const intensity = Math.min(1, Math.max(0.15, 1 - closest / 50));
      const closestNodeId = civilianMetrics.find((m) => m.distance === closest)?.id;
      const closestNode = closestNodeId ? snapshot.vehicles[closestNodeId] : null;
      const pan = closestNode
        ? Math.max(-1, Math.min(1, (closestNode.kalmanLongitude - emergencyNode.kalmanLongitude) * STEREO_PAN_LONGITUDE_SCALE_CLOSE))
        : 0;
      if (!audioMuted) {
        triggerSirenBeep(intensity, pan, audioVolume / 100);
      }
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
      if (!audioMuted) {
        triggerSirenBeep(1, 0, Math.max(0.45, audioVolume / 100));
      }
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
  }, [audioMuted, audioVolume, civilianMetrics, emergencyNode.kalmanLongitude, snapshot.vehicles]);

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

  useEffect(() => {
    if (!showCommunication || audioMuted) return;
    const timer = window.setInterval(() => {
      const signalPan = Math.max(
        -1,
        Math.min(1, (signalNode.kalmanLongitude - emergencyNode.kalmanLongitude) * STEREO_PAN_LONGITUDE_SCALE_SIGNAL),
      );
      triggerPing(signalPan, Math.min(0.6, audioVolume / 100));
    }, 3500);
    return () => window.clearInterval(timer);
  }, [audioMuted, audioVolume, emergencyNode.kalmanLongitude, showCommunication, signalNode.kalmanLongitude]);

  useEffect(() => {
    if (!manualDriveMode || mapView !== "3d") return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
        event.preventDefault();
        moveEmergencyByMeters(4.5, 0);
      } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
        event.preventDefault();
        moveEmergencyByMeters(-3.5, 0);
      } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        moveEmergencyByMeters(3.2, -90);
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        moveEmergencyByMeters(3.2, 90);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [manualDriveMode, mapView, moveEmergencyByMeters]);

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

  const nudgeVehicle = (nodeId: "vehicle1" | "vehicle2", latitudeDelta: number, longitudeDelta: number) => {
    const node = snapshot.vehicles[nodeId];
    updateVehicle(nodeId, {
      latitude: node.latitude + latitudeDelta,
      longitude: node.longitude + longitudeDelta,
      kalmanLatitude: node.kalmanLatitude + latitudeDelta,
      kalmanLongitude: node.kalmanLongitude + longitudeDelta,
    });
    appendLog({
      level: "info",
      source: nodeId,
      message: `${node.label} position tuned (lat: ${latitudeDelta.toFixed(5)}, lon: ${longitudeDelta.toFixed(5)})`,
    });
  };

  const setVehicleTelemetry = (nodeId: "vehicle1" | "vehicle2", key: "speed" | "heading", value: number) => {
    if (key === "speed") {
      updateVehicle(nodeId, { speed: value });
      return;
    }
    updateVehicle(nodeId, { heading: value });
  };

  const resetDemo = () => {
    setRouteProgress(0);
    routeProgressRef.current = 0;
    setDemoPaused(false);
    setDemoRunning(true);
    setSimulationMode(true);
    appendLog({
      level: "info",
      source: "admin",
      message: `Demo reset · scenario ${demoScenario} · route ${selectedRouteIndex + 1}`,
    });
  };

  const applyLanePreset = (lane: "left" | "center" | "right") => {
    setManualLane(lane);
    if (lane === "center") return;
    moveEmergencyByMeters(3.2, lane === "left" ? -90 : 90);
    appendLog({ level: "info", source: "emergency", message: `Manual lane set to ${lane.toUpperCase()}` });
  };

  const handleChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    const userMessage: ChatbotMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    const assistantMessage: ChatbotMessage = {
      id: `assistant-${Date.now() + 1}`,
      role: "assistant",
      text: buildChatbotReply(
        trimmed,
        aiInsights.summary,
        aiInsights.overall.recommendation,
        nearestApproachDistance,
        aiInsights.overall.etaSeconds,
        collisionForecasts.length,
        aiInsights.modelName,
      ),
    };
    setChatMessages((messages) => [...messages, userMessage, assistantMessage].slice(-MAX_CHAT_HISTORY));
    setChatInput("");
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <section className="animate-fade-in-up glass-panel mt-8 rounded-2xl p-6">
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
          <div className="hidden items-center gap-2 rounded-full border border-cyan-500/35 bg-cyan-500/10 px-3 py-1 sm:inline-flex">
            <Image src="/icons/monitoring.svg" alt="Monitoring icon" width={20} height={20} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">Live Monitoring</span>
          </div>
          {isAdminUser && (role === "emergency" || role === "vehicle1" || role === "vehicle2") && (
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

      {isAdminUser ? (
        <article
          className="mb-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
          aria-label="Admin controls panel"
        >
          <div className="grid gap-3 lg:grid-cols-4">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">View Modes</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <button type="button" className={`rounded-md px-3 py-1 ${mapView === "2d" ? "tab-active" : "border border-zinc-700 text-zinc-400"}`} onClick={() => setMapView("2d")}>2D Map</button>
              <button type="button" className={`rounded-md px-3 py-1 ${mapView === "3d" ? "tab-active" : "border border-zinc-700 text-zinc-400"}`} onClick={() => setMapView("3d")}>3D Street</button>
              <button type="button" className={`rounded-md px-3 py-1 ${driverPov ? "tab-active" : "border border-zinc-700 text-zinc-400"}`} onClick={() => setDriverPov((v) => !v)}>Driver POV</button>
              <button type="button" className="rounded-md border border-zinc-700 px-3 py-1 text-zinc-300 hover:border-zinc-500" onClick={() => setMapResetToken((token) => token + 1)}>Reset View</button>
            </div>
            {mapView === "3d" && (
              <div className="space-y-2 rounded-md border border-zinc-800/80 bg-black/25 p-2 text-xs">
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 ${manualDriveMode ? "tab-active" : "border border-zinc-700 text-zinc-400"}`}
                  onClick={() => setManualDriveMode((enabled) => !enabled)}
                >
                  {manualDriveMode ? "Manual Drive ON" : "Manual Drive OFF"}
                </button>
                {manualDriveMode && (
                  <>
                    <div className="flex flex-wrap gap-1">
                      {(["left", "center", "right"] as const).map((lane) => (
                        <button
                          key={lane}
                          type="button"
                          className={`rounded-md px-2 py-1 uppercase ${manualLane === lane ? "tab-active" : "border border-zinc-700 text-zinc-400"}`}
                          onClick={() => applyLanePreset(lane)}
                        >
                          {lane}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      <button type="button" className="btn-secondary !py-1 !text-xs" onClick={() => moveEmergencyByMeters(3.2, -90)}>←</button>
                      <button type="button" className="btn-secondary !py-1 !text-xs" onClick={() => moveEmergencyByMeters(4.5)}>↑</button>
                      <button type="button" className="btn-secondary !py-1 !text-xs" onClick={() => moveEmergencyByMeters(-3.5)}>↓</button>
                      <button type="button" className="btn-secondary !py-1 !text-xs" onClick={() => moveEmergencyByMeters(3.2, 90)}>→</button>
                    </div>
                    <p className="text-zinc-500">W/A/S/D or arrow keys to move in 3D.</p>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Demo Timeline</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <button type="button" className={`rounded-md px-3 py-1 ${!demoPaused ? "tab-active" : "border border-zinc-700 text-zinc-400"}`} onClick={() => { setDemoRunning(true); setDemoPaused(false); }}>Start</button>
              <button type="button" className={`rounded-md px-3 py-1 ${demoPaused ? "tab-active" : "border border-zinc-700 text-zinc-400"}`} onClick={() => setDemoPaused(true)}>Pause</button>
              <button type="button" className="rounded-md border border-zinc-700 px-3 py-1 text-zinc-300 hover:border-zinc-500" onClick={resetDemo}>Reset</button>
            </div>
            <select className="w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-300" value={demoScenario} onChange={(event) => setDemoScenario(event.target.value as DemoScenario)}>
              <option value="urban-peak">Urban Peak</option>
              <option value="intersection-block">Intersection Block</option>
              <option value="low-latency">Low Latency Channel</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Audio + Camera</p>
            <div className="flex items-center gap-2 text-xs">
              <button type="button" className={`rounded-md px-3 py-1 ${audioMuted ? "border border-zinc-700 text-zinc-400" : "tab-active"}`} onClick={() => setAudioMuted((v) => !v)}>{audioMuted ? "Unmute" : "Mute"}</button>
              <label className="flex-1 text-zinc-400">Vol {audioVolume}%</label>
            </div>
            <input type="range" min={0} max={100} step={1} value={audioVolume} onChange={(event) => setAudioVolume(Number(event.target.value))} className="w-full accent-cyan-300" />
            {driverPov && (
              <>
                <label className="block text-xs text-zinc-400">Height {cameraHeight.toFixed(0)}m</label>
                <input type="range" min={8} max={48} step={1} value={cameraHeight} onChange={(event) => setCameraHeight(Number(event.target.value))} className="w-full accent-cyan-300" />
                <label className="block text-xs text-zinc-400">FOV {cameraFov.toFixed(0)}°</label>
                <input type="range" min={45} max={90} step={1} value={cameraFov} onChange={(event) => setCameraFov(Number(event.target.value))} className="w-full accent-fuchsia-300" />
              </>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Prediction + Route</p>
            <label className="block text-xs text-zinc-400">Speed x{demoSpeedMultiplier.toFixed(1)}</label>
            <input type="range" min={0.5} max={3} step={0.1} value={demoSpeedMultiplier} onChange={(event) => setDemoSpeedMultiplier(Number(event.target.value))} className="w-full accent-cyan-300" />
            <label className="block text-xs text-zinc-400">Horizon {predictionHorizonSeconds}s · Radius {safetyRadiusMeters}m</label>
            <input type="range" min={3} max={20} step={1} value={predictionHorizonSeconds} onChange={(event) => setPredictionHorizonSeconds(Number(event.target.value))} className="w-full accent-cyan-300" />
            <input type="range" min={10} max={60} step={1} value={safetyRadiusMeters} onChange={(event) => setSafetyRadiusMeters(Number(event.target.value))} className="w-full accent-fuchsia-300" />
            <button type="button" className={`rounded-md px-3 py-1 text-xs ${showCommunication ? "tab-active" : "border border-zinc-700 text-zinc-400"}`} onClick={() => setShowCommunication((v) => !v)}>
              {showCommunication ? "V2V/V2I Visual On" : "V2V/V2I Visual Off"}
            </button>
            <select
              className="w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-300"
              value={activeAiModelId}
              onChange={(event) => setActiveAiModelId(event.target.value as V2XModelId)}
            >
              {TRAINED_V2X_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500">
              Avg latency {averageCommunicationLatency === null ? "N/A" : `${averageCommunicationLatency.toFixed(0)}ms`} ·{" "}
              {activeAiModel.specialization}
            </p>
          </div>
          </div>
        </article>
      ) : (
        <article className="mb-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="font-semibold text-zinc-100">Basic User View</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Advanced module controls are restricted to admin accounts.
          </p>
        </article>
      )}

      <div className="mb-5 grid gap-4 xl:grid-cols-4">
        <article className="glass-panel layered-card float-soft rounded-xl p-4 xl:col-span-1">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">3D Vehicle View</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-zinc-800/80 bg-black/35 p-2">
              <Image src="/vehicles/emergency-car.svg" alt="Emergency vehicle" width={120} height={60} className="w-full" />
              <p className="mt-1 text-center text-[11px] text-red-300">Emergency</p>
            </div>
            <div className="rounded-lg border border-zinc-800/80 bg-black/35 p-2">
              <Image src="/vehicles/civilian-car.svg" alt="Civilian vehicle" width={120} height={60} className="w-full" />
              <p className="mt-1 text-center text-[11px] text-cyan-300">Civilian</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`cyber-chip ${alertLevelChipClass(highestAlertLevel)}`}>
              Alert {highestAlertLevel}
            </span>
            <span className="cyber-chip text-cyan-300">ETA {formatEta(evEtaToSignalSeconds)}</span>
            <span className="cyber-chip text-zinc-300">Route {(routeProgress * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, routeProgress * 100))}%` }} />
          </div>
          {demoScenario === "intersection-block" && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="text-zinc-500">Congestion reroute:</span>
              {[0, 1].map((routeIndex) => (
                <button key={`route-alt-${routeIndex}`} type="button" className={`rounded-md px-2 py-1 ${selectedRouteIndex === routeIndex ? "tab-active" : "border border-zinc-700 text-zinc-400"}`} onClick={() => setSelectedRouteIndex(routeIndex)}>
                  Alt {routeIndex + 1}
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="glass-panel layered-card rounded-xl p-4 xl:col-span-1">
          <div className="flex items-center gap-2">
            <Image src="/icons/monitoring.svg" alt="Monitoring radar icon" width={30} height={30} className="h-8 w-8" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-300">Radar Monitoring</p>
          </div>
          <div className="mt-3 radar-widget">
            {radarTargets.map((target) => (
              <span
                key={target.id}
                className={`radar-dot ${target.alertClass}`}
                style={{ left: `${target.x}%`, top: `${target.y}%` }}
                title={`${target.label} · ${target.distance.toFixed(1)}m`}
              />
            ))}
          </div>
        </article>

        <article className="glass-panel layered-card rounded-xl p-4 xl:col-span-1">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Direction + ETA</p>
          <div className="mt-3 flex items-center justify-center">
            <div className="compass-ring">
              <div className="compass-needle" style={{ transform: `translateX(-50%) rotate(${emergencyNode.heading}deg)` }} />
              <span className="absolute left-1/2 top-2 -translate-x-1/2 text-[11px] text-zinc-400">N</span>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-zinc-400">S</span>
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400">W</span>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400">E</span>
            </div>
          </div>
          <p className="mt-3 text-center text-sm text-zinc-200">Heading {emergencyNode.heading.toFixed(0)}° · {evDirection.toUpperCase()}</p>
          <p className="text-center text-xs text-zinc-400">Signal ETA: {formatEta(evEtaToSignalSeconds)}</p>
          <p className="text-center text-xs text-zinc-500">Predicted: {predictedPosition.latitude.toFixed(5)}, {predictedPosition.longitude.toFixed(5)}</p>
        </article>

        <article className="glass-panel layered-card rounded-xl p-4 xl:col-span-1">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">System Notifications</p>
          {collisionForecasts.length > 0 && (
            <div className="mt-2 space-y-1">
              {collisionForecasts.slice(0, 2).map((forecast) => (
                <p
                  key={`collision-${forecast.nodeId}`}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    forecast.severity === "critical"
                      ? "border-red-500/35 bg-red-500/10 text-red-200"
                      : "border-yellow-500/35 bg-yellow-500/10 text-yellow-200"
                  }`}
                >
                  Collision {forecast.severity.toUpperCase()} with {snapshot.vehicles[forecast.nodeId]?.label} in{" "}
                  {forecast.secondsAhead}s · {(forecast.distanceMeters).toFixed(1)}m
                </p>
              ))}
            </div>
          )}
          <div className="mt-3 max-h-[220px] space-y-2 overflow-auto pr-1">
            {snapshot.logs.length === 0 ? (
              <p className="text-xs text-zinc-500">No events yet.</p>
            ) : (
              snapshot.logs.slice(0, 8).map((log) => (
                <div
                  key={`compact-${log.id}`}
                  className={`rounded-lg border px-2.5 py-2 text-xs transition ${
                    log.level === "critical"
                      ? "border-red-500/35 bg-red-500/10"
                      : log.level === "warning"
                        ? "border-yellow-500/35 bg-yellow-500/10"
                        : "border-zinc-800 bg-zinc-900/40"
                  }`}
                >
                  <p className="text-zinc-200">[{compactTime(log.timestamp)}] {log.message}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="font-semibold text-zinc-100">Approaching Vehicle Simulator</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Icon-first view for quick readability. Active model: {aiInsights.modelName}.
          </p>
          <div className="mt-3 space-y-2">
            {civilianMetrics.map((metric) => {
              const progress = Math.max(0, Math.min(100, 100 - (metric.distance / 120) * 100));
              return (
                <div key={`approach-${metric.id}`} className="rounded-lg border border-zinc-800 bg-black/25 p-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <p className="font-medium text-zinc-100">
                      {VEHICLE_ICON_BY_NODE_ID[metric.id] ?? "🚘"} {metric.label}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {metric.distance.toFixed(1)}m · {metric.approaching ? "Approaching EV 🚑" : "Moving away"}
                    </p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${metric.alert25 ? "bg-red-400" : metric.alert50 ? "bg-amber-300" : "bg-cyan-300"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-xl border border-cyan-500/25 bg-zinc-950 p-4">
          <h3 className="font-semibold text-zinc-100">AI Chatbot Copilot</h3>
          <p className="mt-1 text-xs text-zinc-500">{activeAiModel.notes}</p>
          <form onSubmit={handleChatSubmit} className="mt-3 flex gap-2">
            <input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Ask: risk, ETA, collisions, lane guidance..."
              className="flex-1 rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-400"
            />
            <button type="submit" className="btn-secondary !px-3 !py-2 !text-xs">
              Send
            </button>
          </form>
          <div className="mt-3 max-h-48 space-y-2 overflow-auto pr-1">
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-md border px-3 py-2 text-xs ${
                  message.role === "assistant"
                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                    : "border-zinc-700 bg-zinc-900/80 text-zinc-200"
                }`}
              >
                <p className="mb-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                  {message.role === "assistant" ? "Copilot" : "You"}
                </p>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
        </article>
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
                  disabled={!isAdminUser}
                  title={!isAdminUser ? RESTRICTED_CONTROL_HINT : undefined}
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
                className={`group h-36 w-36 rounded-full border p-3 text-center text-xs font-semibold tracking-wide transition ${
                  snapshot.emergency.active
                    ? "ev-active-glow border-red-400 bg-gradient-to-br from-red-500/35 via-fuchsia-500/20 to-cyan-500/20 text-red-100"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-cyan-500/50"
                }`}
                disabled={!isAdminUser}
                title={!isAdminUser ? RESTRICTED_CONTROL_HINT : undefined}
              >
                <span className="flex h-full flex-col items-center justify-center gap-1">
                  <Image
                    src="/icons/broadcasting.svg"
                    alt="Broadcasting icon"
                    width={72}
                    height={72}
                    className={`h-16 w-16 transition duration-300 ${snapshot.emergency.active ? "scale-110" : "group-hover:scale-105"}`}
                  />
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-100/90">
                    {snapshot.emergency.active ? "Broadcast ON" : "Broadcast OFF"}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={toggleKalman}
                disabled={!isAdminUser}
                title={!isAdminUser ? RESTRICTED_CONTROL_HINT : undefined}
              >
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
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-black/35 p-3"
              >
                <div className="flex flex-col items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-2">
                  <span className={`h-3 w-3 rounded-full border ${signalLensClass(snapshot.signals[direction] === "red", "red")}`} />
                  <span className={`h-3 w-3 rounded-full border ${signalLensClass(snapshot.signals[direction] === "yellow", "yellow")}`} />
                  <span className={`h-3 w-3 rounded-full border ${signalLensClass(snapshot.signals[direction] === "green", "green")}`} />
                </div>
                <div>
                  <p className="text-zinc-400 uppercase text-xs">{direction}</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-200">🚦 {snapshot.signals[direction].toUpperCase()}</p>
                </div>
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
                <button
                  type="button"
                  className={`rounded-md px-3 py-1 transition ${mapView === "2d" ? "tab-active" : "border border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                  onClick={() => setMapView("2d")}
                >
                  2D
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-1 transition ${mapView === "3d" ? "tab-active" : "border border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                  onClick={() => setMapView("3d")}
                >
                  3D
                </button>
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
            {mapView === "2d" ? (
              <LiveMap
                snapshot={snapshot}
                mode={mapMode}
                focusNodeId={role}
                showPredictedPath
                routePath={chosenRoute}
                alternateRoutes={alternateRoutes}
                selectedRouteIndex={selectedRouteIndex}
                collisionZones={collisionForecasts}
                communicationLinks={communicationLinks}
                showCommunication={showCommunication}
                resetViewToken={mapResetToken}
              />
            ) : (
              <StreetLevelMap3D
                snapshot={snapshot}
                route={chosenRoute}
                alternateRoutes={alternateRoutes}
                chosenAlternative={selectedRouteIndex}
                collisions={collisionForecasts}
                communicationLinks={communicationLinks}
                showCommunication={showCommunication}
                driverPov={driverPov}
                cameraHeight={cameraHeight}
                cameraFov={cameraFov}
                resetViewToken={mapResetToken}
              />
            )}
            <p className="mt-2 text-xs text-zinc-600">
              Red dashed line = EV predicted path · Cyan = selected route · Collision zones are highlighted.
            </p>
          </article>

          {/* Safety status */}
          {civilianMetrics
            .filter((m) => m.id === role)
            .map((metric) => {
              const vehicleInsight = aiInsights.perVehicle[metric.id];
              return (
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
                {vehicleInsight && (
                  <div className="ai-card mt-3 rounded-lg border border-cyan-500/20 p-3 text-sm">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-300">AI Yield Assistant</p>
                    <p className="mt-1 text-zinc-200">
                      Score {formatRiskLabel(vehicleInsight.score, vehicleInsight.level)}
                    </p>
                    <p className="mt-1 text-zinc-400">{vehicleInsight.recommendation}</p>
                  </div>
                )}
                </article>
              );
            })}
        </div>
      )}

      {/* ── ADMIN / CONTROL / USER-PORTAL ──────────────────────────────────── */}
      {role === "admin" && (
        <div className="space-y-4">
          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="font-semibold text-zinc-100">Admin Control Center</h3>
              <div className="flex gap-2 text-sm flex-wrap">
                <button
                  type="button"
                  className={`rounded-md px-3 py-1 transition ${mapView === "2d" ? "tab-active" : "border border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                  onClick={() => setMapView("2d")}
                >
                  2D
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-1 transition ${mapView === "3d" ? "tab-active" : "border border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                  onClick={() => setMapView("3d")}
                >
                  3D
                </button>
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
            {mapView === "2d" ? (
              <LiveMap
                snapshot={snapshot}
                mode={mapMode}
                showPredictedPath
                routePath={chosenRoute}
                alternateRoutes={alternateRoutes}
                selectedRouteIndex={selectedRouteIndex}
                collisionZones={collisionForecasts}
                communicationLinks={communicationLinks}
                showCommunication={showCommunication}
                resetViewToken={mapResetToken}
              />
            ) : (
              <StreetLevelMap3D
                snapshot={snapshot}
                route={chosenRoute}
                alternateRoutes={alternateRoutes}
                chosenAlternative={selectedRouteIndex}
                collisions={collisionForecasts}
                communicationLinks={communicationLinks}
                showCommunication={showCommunication}
                driverPov={driverPov}
                cameraHeight={cameraHeight}
                cameraFov={cameraFov}
                resetViewToken={mapResetToken}
              />
            )}
          </article>

          <article className="glass-panel layered-card rounded-xl p-4">
            <h3 className="mb-3 font-semibold text-zinc-100">Vehicle Motion Tuning</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {(["vehicle1", "vehicle2"] as const).map((nodeId) => {
                const node = snapshot.vehicles[nodeId];
                return (
                  <div key={`tune-${node.id}`} className="rounded-lg border border-zinc-800/80 bg-black/35 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-100">{node.label}</p>
                      <span className="text-xs text-zinc-500">
                        {node.kalmanLatitude.toFixed(5)}, {node.kalmanLongitude.toFixed(5)}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1 text-xs">
                      <button type="button" aria-label={`Nudge ${node.label} north`} className="btn-secondary !py-1 !text-xs" onClick={() => nudgeVehicle(nodeId, VEHICLE_NUDGE_STEP, 0)}>N +</button>
                      <button type="button" aria-label={`Nudge ${node.label} south`} className="btn-secondary !py-1 !text-xs" onClick={() => nudgeVehicle(nodeId, -VEHICLE_NUDGE_STEP, 0)}>S -</button>
                      <button type="button" aria-label={`Nudge ${node.label} east`} className="btn-secondary !py-1 !text-xs" onClick={() => nudgeVehicle(nodeId, 0, VEHICLE_NUDGE_STEP)}>E +</button>
                      <button type="button" aria-label={`Nudge ${node.label} west`} className="btn-secondary !py-1 !text-xs" onClick={() => nudgeVehicle(nodeId, 0, -VEHICLE_NUDGE_STEP)}>W -</button>
                    </div>
                    <div className="mt-3 space-y-2">
                      <label className="block text-xs text-zinc-400">
                        Speed: {node.speed.toFixed(1)} m/s
                        <input
                          type="range"
                          min={0}
                          max={30}
                          step={0.2}
                          value={node.speed}
                          onChange={(event) => setVehicleTelemetry(nodeId, "speed", Number(event.target.value))}
                          className="mt-1 w-full accent-cyan-300"
                        />
                      </label>
                      <label className="block text-xs text-zinc-400">
                        Heading: {node.heading.toFixed(0)}°
                        <input
                          type="range"
                          min={0}
                          max={359}
                          step={1}
                          value={node.heading}
                          onChange={(event) => setVehicleTelemetry(nodeId, "heading", Number(event.target.value))}
                          className="mt-1 w-full accent-fuchsia-300"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="mb-3 font-semibold text-zinc-100">Node Status</h3>
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
                if (!insight) return null;
                return (
                  <div key={`ai-${metric.id}`} className="rounded-md border border-zinc-800 bg-black/30 p-2 text-xs text-zinc-300">
                    <p className="font-medium text-zinc-200">{metric.label}</p>
                    <p className="mt-0.5">Risk {formatRiskLabel(insight.score, insight.level)}</p>
                    <p className="mt-0.5 text-zinc-500">{insight.recommendation}</p>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="mb-3 font-semibold text-zinc-100">Live Logs</h3>
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
