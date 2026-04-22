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

// ─── EMISSION TYPES ─────────────────────────────────────────
export type VehicleClass = 'micro' | 'compact' | 'sedan' | 'suv' | 'truck' | 'bus' | 'ambulance' | 'police' | 'fire';
export type FuelType = 'petrol' | 'diesel' | 'cng' | 'electric' | 'hybrid' | 'lpg';

export type EmissionCalculationResult = {
  co2Grams: number;
  noxGrams: number;
  pmGrams: number;
  fuelConsumed: number;
  equivalentTreesNeeded: number;
  aqi: number;
};

// ─── ROUTE TYPES ────────────────────────────────────────────
export type RouteObjective = 'fastest' | 'shortest' | 'eco-friendly' | 'balanced' | 'safest';

export type GeoPoint = {
  latitude: number;
  longitude: number;
  name?: string;
};

// ─── NOTIFICATION TYPES ─────────────────────────────────────
export type NotificationType = 
  | 'accident' 
  | 'ev-arrival' 
  | 'signal-override' 
  | 'route-alert' 
  | 'emission-warning' 
  | 'pollution-alert' 
  | 'emergency' 
  | 'info';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationTarget = 'all' | 'ev' | 'nv' | 'signal' | 'rto' | 'admin' | 'location-based';

export type Notification = {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: string;
  source: string;
  target: NotificationTarget;
  targetRadius?: number;
  location?: GeoPoint;
  voice?: {
    enabled: boolean;
    text: string;
    language?: string;
  };
  action?: {
    label: string;
    url?: string;
    callback?: string;
  };
  read: boolean;
  readAt?: string;
  expiry?: string;
  metadata?: Record<string, string | number | boolean>;
};

// ─── POLLUTION TYPES ────────────────────────────────────────
export type PollutantType = 'PM2.5' | 'PM10' | 'NO2' | 'O3' | 'SO2' | 'CO' | 'AQI';
export type AQICategory = 'Good' | 'Satisfactory' | 'Moderately Polluted' | 'Poor' | 'Very Poor' | 'Severe';

export type AirQualityData = {
  timestamp: string;
  latitude: number;
  longitude: number;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  so2: number;
  co: number;
  aqi: number;
  aqiCategory: AQICategory;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
};

// ─── TRAFFIC TYPES ──────────────────────────────────────────
export type TrafficMode = 'normal' | 'emergency' | 'eco' | 'congestion';

export type SignalTiming = {
  north: number;
  south: number;
  east: number;
  west: number;
  cycleTime: number;
};

export type SmartTrafficState = {
  mode: TrafficMode;
  signals: {
    north: 'green' | 'yellow' | 'red';
    south: 'green' | 'yellow' | 'red';
    east: 'green' | 'yellow' | 'red';
    west: 'green' | 'yellow' | 'red';
  };
  timings: SignalTiming;
  evRoute?: string;
  trafficMetrics: {
    averageWaitTime: number;
    throughput: number;
    congestionLevel: number;
  };
};

// ─── RADIATION TYPES ────────────────────────────────────────
export type RadiationSource = {
  type: 'traffic_signal' | 'cellular_tower' | 'wifi' | 'power_line';
  location: GeoPoint;
  power: number;
  frequency: number;
  antennaType: 'omnidirectional' | 'directional';
  height: number;
};

export type RadiationExposureData = {
  location: GeoPoint;
  proximity: number;
  powerDensity: number;
  frequency: number;
  saLevel: number;
  exposureLimit: number;
  withinSafetyLimit: boolean;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
};

// ─── VEHICLE TYPES ──────────────────────────────────────────
export type VehicleRecord = {
  numberPlate: string;
  ownerName: string;
  vehicleType: 'two-wheeler' | 'three-wheeler' | 'car' | 'truck' | 'bus' | 'ambulance' | 'police' | 'fire';
  registrationDate: string;
  fuelType: FuelType;
  engineCC: number;
  manufacturerName: string;
  modelName: string;
  color: string;
  registrationState: string;
  isEV: boolean;
  pollutionCertificateExpiry?: string;
  lastPUCDate?: string;
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
