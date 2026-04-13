export type NodeRole = "emergency" | "signal" | "vehicle1" | "vehicle2" | "admin";

export type VehicleType = "ambulance" | "fire" | "police";

export type SignalDirection = "north" | "south" | "east" | "west";

export type SignalColor = "green" | "yellow" | "red";

export type TelemetryNode = {
  id: string;
  role: NodeRole;
  label: string;
  vehicleType?: VehicleType;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  kalmanLatitude: number;
  kalmanLongitude: number;
  updatedAt: string;
  connectionStatus: "connected" | "degraded" | "offline";
  broadcastEnabled?: boolean;
};

export type EmergencyState = {
  active: boolean;
  vehicleType: VehicleType;
  kalmanEnabled: boolean;
  lastUpdatedAt: string;
};

export type SignalState = {
  mode: "normal" | "override";
  source?: string;
  north: SignalColor;
  south: SignalColor;
  east: SignalColor;
  west: SignalColor;
  overrideDirection?: SignalDirection;
  evDistanceMeters?: number;
};

export type V2XLog = {
  id: string;
  level: "info" | "warning" | "critical";
  message: string;
  timestamp: string;
  source: string;
};

export type RealtimeSnapshot = {
  vehicles: Record<string, TelemetryNode>;
  emergency: EmergencyState;
  signals: SignalState;
  logs: V2XLog[];
  updatedAt: string;
};

/** A user record managed by the admin console (persisted in localStorage). */
export type UserRecord = {
  email: string;
  name?: string;
  role: "admin" | "operator" | "viewer";
  status: "active" | "banned";
  addedAt: string;
};

/** Canonical Vercel storage paths for backend listeners and sync handlers. */
export const VERCEL_SCHEMA_PATHS = {
  vehicles: "/vehicles/{id}",
  emergency: "/emergency",
  signals: "/signals",
  logs: "/logs",
} as const;
