"use client";

import { io, type Socket } from "socket.io-client";
import type { RealtimeSnapshot, TelemetryNode, V2XLog, SignalState, EmergencyState } from "@/lib/v2x/types";

const STORAGE_KEY = "v2x-realtime-state-v1";
const CHANNEL_KEY = "v2x-realtime-channel";
const MAX_LOGS = 150;

type SnapshotListener = (snapshot: RealtimeSnapshot) => void;

const BASE_COORDS = { latitude: 12.918, longitude: 77.6205 };

const initialSnapshot: RealtimeSnapshot = {
  vehicles: {
    emergency: {
      id: "emergency",
      role: "emergency",
      label: "Emergency Vehicle",
      vehicleType: "ambulance",
      latitude: BASE_COORDS.latitude + 0.00024,
      longitude: BASE_COORDS.longitude + 0.00017,
      kalmanLatitude: BASE_COORDS.latitude + 0.00024,
      kalmanLongitude: BASE_COORDS.longitude + 0.00017,
      speed: 8,
      heading: 34,
      accuracy: 7,
      updatedAt: new Date().toISOString(),
      connectionStatus: "connected",
      broadcastEnabled: false,
    },
    signal: {
      id: "signal",
      role: "signal",
      label: "Traffic Signal Node",
      latitude: BASE_COORDS.latitude,
      longitude: BASE_COORDS.longitude,
      kalmanLatitude: BASE_COORDS.latitude,
      kalmanLongitude: BASE_COORDS.longitude,
      speed: 0,
      heading: 0,
      accuracy: 3,
      updatedAt: new Date().toISOString(),
      connectionStatus: "connected",
    },
    vehicle1: {
      id: "vehicle1",
      role: "vehicle1",
      label: "Civilian Vehicle 1",
      latitude: BASE_COORDS.latitude - 0.00024,
      longitude: BASE_COORDS.longitude - 0.0002,
      kalmanLatitude: BASE_COORDS.latitude - 0.00024,
      kalmanLongitude: BASE_COORDS.longitude - 0.0002,
      speed: 6,
      heading: 215,
      accuracy: 9,
      updatedAt: new Date().toISOString(),
      connectionStatus: "connected",
    },
    vehicle2: {
      id: "vehicle2",
      role: "vehicle2",
      label: "Civilian Vehicle 2",
      latitude: BASE_COORDS.latitude + 0.00028,
      longitude: BASE_COORDS.longitude - 0.00019,
      kalmanLatitude: BASE_COORDS.latitude + 0.00028,
      kalmanLongitude: BASE_COORDS.longitude - 0.00019,
      speed: 5,
      heading: 104,
      accuracy: 8,
      updatedAt: new Date().toISOString(),
      connectionStatus: "connected",
    },
  },
  emergency: {
    active: false,
    vehicleType: "ambulance",
    kalmanEnabled: true,
    lastUpdatedAt: new Date().toISOString(),
  },
  signals: {
    mode: "normal",
    north: "green",
    south: "green",
    east: "red",
    west: "red",
  },
  logs: [],
  updatedAt: new Date().toISOString(),
};

let state: RealtimeSnapshot = initialSnapshot;
let channel: BroadcastChannel | null = null;
let socket: Socket | null = null;
let eventSource: EventSource | null = null;
const listeners = new Set<SnapshotListener>();
let initialized = false;

async function syncToVercel(snapshot: RealtimeSnapshot): Promise<void> {
  if (typeof window === "undefined") return;
  const endpoint = process.env.NEXT_PUBLIC_VERCEL_SYNC_ENDPOINT;
  if (!endpoint) return;

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
      keepalive: true,
    });
  } catch {
    // Ignore network sync failures and keep local/broadcast listeners active.
  }
}

function safeParseSnapshot(value: string): RealtimeSnapshot | null {
  try {
    const parsed = JSON.parse(value) as RealtimeSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function publish(nextSnapshot: RealtimeSnapshot, source: "local" | "broadcast" | "socket"): void {
  state = nextSnapshot;
  listeners.forEach((listener) => listener(state));

  if (source !== "broadcast" && channel) {
    channel.postMessage(state);
  }

  if (source !== "socket" && socket?.connected) {
    socket.emit("v2x-sync", state);
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  if (source === "local") {
    void syncToVercel(state);
  }
}

function initTransport(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const cached = window.localStorage.getItem(STORAGE_KEY);
  if (cached) {
    const parsed = safeParseSnapshot(cached);
    if (parsed) {
      state = parsed;
    }
  }

  channel = new BroadcastChannel(CHANNEL_KEY);
  channel.onmessage = (event: MessageEvent<RealtimeSnapshot>) => {
    publish(event.data, "broadcast");
  };

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    const parsed = safeParseSnapshot(event.newValue);
    if (parsed) {
      state = parsed;
      listeners.forEach((listener) => listener(state));
    }
  });

  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (socketUrl) {
    socket = io(socketUrl, {
      transports: ["websocket"],
      timeout: 5000,
    });

    socket.on("v2x-sync", (incoming: RealtimeSnapshot) => publish(incoming, "socket"));
    socket.on("connect_error", () => {
      listeners.forEach((listener) =>
        listener({
          ...state,
          updatedAt: new Date().toISOString(),
        }),
      );
    });
  }

  const streamUrl = process.env.NEXT_PUBLIC_VERCEL_LISTENER_URL;
  if (streamUrl) {
    eventSource = new EventSource(streamUrl);
    eventSource.onmessage = (event) => {
      const parsed = safeParseSnapshot(event.data);
      if (parsed) {
        publish(parsed, "socket");
      }
    };
  }
}

function nextSnapshot(
  updater: (previous: RealtimeSnapshot) => RealtimeSnapshot,
  source: "local" | "broadcast" | "socket" = "local",
): void {
  initTransport();
  const updated = updater(state);
  publish({ ...updated, updatedAt: new Date().toISOString() }, source);
}

export function appendLog(log: Omit<V2XLog, "id" | "timestamp">): void {
  nextSnapshot((previous) => ({
    ...previous,
    logs: [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ...log,
      },
      ...previous.logs,
    ].slice(0, MAX_LOGS),
  }));
}

export function updateVehicle(nodeId: string, node: Partial<TelemetryNode>): void {
  nextSnapshot((previous) => {
    const existing = previous.vehicles[nodeId];
    if (!existing) return previous;

    return {
      ...previous,
      vehicles: {
        ...previous.vehicles,
        [nodeId]: {
          ...existing,
          ...node,
          updatedAt: new Date().toISOString(),
        },
      },
    };
  });
}

export function updateSignals(nextSignals: Partial<SignalState>): void {
  nextSnapshot((previous) => ({
    ...previous,
    signals: {
      ...previous.signals,
      ...nextSignals,
    },
  }));
}

export function updateEmergency(nextEmergency: Partial<EmergencyState>): void {
  nextSnapshot((previous) => ({
    ...previous,
    emergency: {
      ...previous.emergency,
      ...nextEmergency,
      lastUpdatedAt: new Date().toISOString(),
    },
  }));
}

export function readSnapshot(): RealtimeSnapshot {
  initTransport();
  return state;
}

export function subscribeRealtime(listener: SnapshotListener): () => void {
  initTransport();
  listeners.add(listener);
  listener(state);

  return () => {
    listeners.delete(listener);
  };
}
