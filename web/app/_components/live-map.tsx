"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { divIcon } from "leaflet";
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import { useMap } from "react-leaflet/hooks";
import { predictFuturePosition, vincentyDistanceMeters } from "@/lib/v2x/geodesy";
import type { RealtimeSnapshot } from "@/lib/v2x/types";
import { COMMUNICATION_ARC_LIFT } from "@/lib/v2x/constants";

export type MapMode = "street" | "walking" | "satellite";

type LiveMapProps = {
  snapshot: RealtimeSnapshot;
  mode: MapMode;
  /** Center and highlight this node ID (e.g. "vehicle1"). */
  focusNodeId?: string;
  /** Draw the EV predicted path polyline. */
  showPredictedPath?: boolean;
  routePath?: [number, number][];
  alternateRoutes?: [number, number][][];
  selectedRouteIndex?: number;
  collisionZones?: Array<{ latitude: number; longitude: number; severity: "warning" | "critical" }>;
  communicationLinks?: Array<{ from: string; to: string; latencyMs: number }>;
  showCommunication?: boolean;
  resetViewToken?: number;
};

const TILE_LAYERS: Record<MapMode, { url: string; attribution: string }> = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  walking: {
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors, HOT",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGS, and the GIS User Community",
  },
};

const NODE_COLORS: Record<string, string> = {
  emergency: "#ff2233",
  signal: "#facc15",
  vehicle1: "#3b82f6",
  vehicle2: "#a855f7",
};

const NODE_LABELS: Record<string, string> = {
  emergency: "🚨",
  signal: "🚦",
  vehicle1: "🚗",
  vehicle2: "🚙",
};

const NODE_IMAGES: Record<string, string> = {
  emergency: "/vehicles/emergency-car.svg",
  signal: "/icons/traffic-light.svg",
  vehicle1: "/vehicles/civilian-car.svg",
  vehicle2: "/vehicles/civilian-car.svg",
};
// Minimum combined coordinate-delta (in degrees), ~0.2-0.3m movement at this latitude, before appending a trail point.
const MIN_TRAIL_DELTA_THRESHOLD = 0.000002;

function FollowCenter({ center, resetToken }: { center: [number, number]; resetToken: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  useEffect(() => {
    map.setView(center, 18, { animate: true });
  }, [center, map, resetToken]);
  return null;
}

function buildNodeIcon(nodeId: string, isFocused: boolean) {
  const imageSrc = NODE_IMAGES[nodeId] ?? "/vehicles/civilian-car.svg";
  const iconSize = isFocused ? 34 : 30;
  const iconHtml = `
    <div style="height:${iconSize}px;width:${iconSize}px;border-radius:999px;border:2px solid rgba(148,163,184,0.9);background:rgba(2,6,23,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px rgba(15,23,42,0.7),0 10px 20px rgba(2,6,23,0.45);">
      <img src="${imageSrc}" alt="${nodeId}" style="height:${Math.round(iconSize * 0.74)}px;width:${Math.round(iconSize * 0.74)}px;object-fit:contain;" />
    </div>
  `;
  return divIcon({
    className: "v2x-node-icon",
    html: iconHtml,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
    popupAnchor: [0, -iconSize / 2],
  });
}

export default function LiveMap({
  snapshot,
  mode,
  focusNodeId,
  showPredictedPath = false,
  routePath = [],
  alternateRoutes = [],
  selectedRouteIndex = 0,
  collisionZones = [],
  communicationLinks = [],
  showCommunication = false,
  resetViewToken = 0,
}: LiveMapProps) {
  const [trails, setTrails] = useState<Record<string, [number, number][]>>({});
  const emergency = snapshot.vehicles.emergency;
  const focusNode = focusNodeId ? snapshot.vehicles[focusNodeId] : null;
  const signal = snapshot.vehicles.signal;

  const center: [number, number] = focusNode
    ? [
        focusNode.kalmanLatitude || focusNode.latitude,
        focusNode.kalmanLongitude || focusNode.longitude,
      ]
    : [
        emergency?.kalmanLatitude ?? emergency?.latitude ?? 12.918,
        emergency?.kalmanLongitude ?? emergency?.longitude ?? 77.6205,
      ];

  const tileLayer = TILE_LAYERS[mode] ?? TILE_LAYERS.street;

  const predictedPath = useMemo(() => {
    if (!emergency || !showPredictedPath) return [];
    const points: [number, number][] = [
      [emergency.kalmanLatitude, emergency.kalmanLongitude],
    ];
    for (let t = 1; t <= 8; t++) {
      const pos = predictFuturePosition(
        emergency.kalmanLatitude,
        emergency.kalmanLongitude,
        emergency.speed,
        emergency.heading,
        t,
      );
      points.push([pos.latitude, pos.longitude]);
    }
    return points;
  }, [emergency, showPredictedPath]);

  useEffect(() => {
    setTrails((previous) => {
      const next: Record<string, [number, number][]> = { ...previous };
      Object.values(snapshot.vehicles).forEach((node) => {
        const point: [number, number] = [
          node.kalmanLatitude || node.latitude,
          node.kalmanLongitude || node.longitude,
        ];
        const existing = next[node.id] ?? [];
        const last = existing[existing.length - 1];
        if (
          !last ||
          Math.abs(last[0] - point[0]) + Math.abs(last[1] - point[1]) > MIN_TRAIL_DELTA_THRESHOLD
        ) {
          next[node.id] = [...existing, point].slice(-12);
        }
      });
      return next;
    });
  }, [snapshot.vehicles]);

  return (
    <div className="map-container-animated h-[420px] overflow-hidden rounded-xl border border-zinc-800">
      <MapContainer center={center} zoom={18} scrollWheelZoom className="h-full w-full">
        <FollowCenter center={center} resetToken={resetViewToken} />
        <TileLayer attribution={tileLayer.attribution} url={tileLayer.url} />

        {/* Predicted EV path */}
        {showPredictedPath && predictedPath.length > 1 && (
          <Polyline
            positions={predictedPath}
            pathOptions={{
              color: "#ff2233",
              weight: 2.5,
              opacity: 0.65,
              dashArray: "8, 5",
            }}
          />
        )}

        {/* Chosen navigation route */}
        {routePath.length > 1 && (
          <Polyline
            positions={routePath}
            pathOptions={{
              color: "#06b6d4",
              weight: 4,
              opacity: 0.78,
            }}
          />
        )}
        {alternateRoutes.map((alt, index) =>
          alt.length > 1 ? (
            <Polyline
              key={`alt-route-${index}`}
              positions={alt}
              pathOptions={{
                color: index === selectedRouteIndex ? "#22d3ee" : "#64748b",
                weight: index === selectedRouteIndex ? 3 : 2,
                opacity: 0.55,
                dashArray: index === selectedRouteIndex ? "10, 6" : "5, 7",
              }}
            />
          ) : null,
        )}

        {/* Collision prediction zones */}
        {collisionZones.map((zone, index) => (
          <Circle
            key={`collision-zone-${index}`}
            center={[zone.latitude, zone.longitude]}
            radius={zone.severity === "critical" ? 18 : 12}
            pathOptions={{
              color: zone.severity === "critical" ? "#ef4444" : "#f59e0b",
              fillOpacity: 0.15,
              weight: 1.4,
              dashArray: "5, 4",
            }}
          />
        ))}

        {/* V2V / V2I communication arcs */}
        {showCommunication &&
          communicationLinks.map((link, index) => {
            const start = snapshot.vehicles[link.from];
            const end = snapshot.vehicles[link.to];
            if (!start || !end) return null;
            const midLat = (start.kalmanLatitude + end.kalmanLatitude) / 2 + COMMUNICATION_ARC_LIFT;
            const midLon = (start.kalmanLongitude + end.kalmanLongitude) / 2;
            const latencyColor = link.latencyMs > 120 ? "#ef4444" : link.latencyMs > 70 ? "#f59e0b" : "#10b981";
            const pulseFactor = (Date.now() % 1000) / 1000;
            const pulseLat = start.kalmanLatitude + (end.kalmanLatitude - start.kalmanLatitude) * pulseFactor;
            const pulseLon = start.kalmanLongitude + (end.kalmanLongitude - start.kalmanLongitude) * pulseFactor;
            return (
              <Fragment key={`comms-${link.from}-${link.to}-${index}`}>
                <Polyline
                  positions={[
                    [start.kalmanLatitude, start.kalmanLongitude],
                    [midLat, midLon],
                    [end.kalmanLatitude, end.kalmanLongitude],
                  ]}
                  pathOptions={{
                    color: latencyColor,
                    weight: 2,
                    opacity: 0.62,
                    dashArray: "3, 5",
                  }}
                />
                <CircleMarker
                  center={[pulseLat, pulseLon]}
                  radius={3.4}
                  pathOptions={{
                    color: latencyColor,
                    fillColor: latencyColor,
                    fillOpacity: 0.9,
                    weight: 1,
                  }}
                />
              </Fragment>
            );
          })}

        {/* Predicted end-point marker */}
        {showPredictedPath && predictedPath.length > 1 && (
          <CircleMarker
            center={predictedPath[predictedPath.length - 1]}
            radius={5}
            pathOptions={{
              color: "#ff2233",
              fillColor: "#ff2233",
              fillOpacity: 0.4,
              weight: 1.5,
              dashArray: "3, 3",
            }}
          />
        )}

        {/* EV proximity zones */}
        {emergency && (
          <>
            <Circle
              center={[emergency.kalmanLatitude, emergency.kalmanLongitude]}
              radius={25}
              pathOptions={{
                color: "#ef4444",
                weight: 1.5,
                fillOpacity: 0.07,
                dashArray: "4, 4",
              }}
            />
            <Circle
              center={[emergency.kalmanLatitude, emergency.kalmanLongitude]}
              radius={50}
              pathOptions={{
                color: "#facc15",
                weight: 1.2,
                fillOpacity: 0.05,
                dashArray: "4, 4",
              }}
            />
          </>
        )}

        {/* node trails */}
        {Object.values(snapshot.vehicles).map((node) => {
          const nodeTrail = trails[node.id] ?? [];
          if (nodeTrail.length < 2) return null;
          return (
            <Polyline
              key={`${node.id}-trail`}
              positions={nodeTrail}
              pathOptions={{
                color: NODE_COLORS[node.id] ?? "#22d3ee",
                weight: node.id === "emergency" ? 3 : 2,
                opacity: 0.45,
                dashArray: node.id === "emergency" ? "10, 8" : "6, 8",
                className: "map-trail-line",
              }}
            />
          );
        })}

        {/* Vehicle nodes */}
        {Object.values(snapshot.vehicles).map((node) => {
          const lat = node.kalmanLatitude || node.latitude;
          const lon = node.kalmanLongitude || node.longitude;
          const isFocused = node.id === focusNodeId;
          const color = NODE_COLORS[node.id] ?? "#22d3ee";
          const baseRadius = node.id === "emergency" ? 10 : 8;

          return (
            <Fragment key={`${node.id}-cluster`}>
              <CircleMarker
                key={`${node.id}-pulse`}
                center={[lat, lon]}
                radius={isFocused ? baseRadius + 8 : baseRadius + 6}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.08,
                  weight: 1.2,
                  className: "map-node-pulse",
                }}
              />
              <Marker key={node.id} position={[lat, lon]} icon={buildNodeIcon(node.id, isFocused)}>
                <Popup>
                  <div className="flex items-center gap-2">
                    <Image
                      src={NODE_IMAGES[node.id] ?? "/vehicles/civilian-car.svg"}
                      alt={node.label}
                      width={40}
                      height={24}
                      className="h-8 w-10"
                    />
                    <strong>
                      {NODE_LABELS[node.id] ?? "📍"} {node.label}
                    </strong>
                  </div>
                  <div className="text-xs mt-1">
                    {lat.toFixed(6)}, {lon.toFixed(6)}
                  </div>
                  <div className="text-xs">
                    Speed: {node.speed.toFixed(1)} m/s · Hdg: {node.heading.toFixed(0)}°
                  </div>
                  {node.id === "emergency" && (
                    <div className="text-xs">
                      ETA signal: {node.speed > 0.1 ? `${(vincentyDistanceMeters(lat, lon, signal.kalmanLatitude, signal.kalmanLongitude) / node.speed).toFixed(1)}s` : "n/a"}
                    </div>
                  )}
                  <div className="text-xs capitalize">Status: {node.connectionStatus}</div>
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
