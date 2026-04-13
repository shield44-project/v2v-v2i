"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";
import { useMap } from "react-leaflet/hooks";
import { predictFuturePosition, vincentyDistanceMeters } from "@/lib/v2x/geodesy";
import type { RealtimeSnapshot } from "@/lib/v2x/types";

export type MapMode = "street" | "walking" | "satellite";

type LiveMapProps = {
  snapshot: RealtimeSnapshot;
  mode: MapMode;
  /** Center and highlight this node ID (e.g. "vehicle1"). */
  focusNodeId?: string;
  /** Draw the EV predicted path polyline. */
  showPredictedPath?: boolean;
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
  signal: "/vehicles/signal-node.svg",
  vehicle1: "/vehicles/civilian-car.svg",
  vehicle2: "/vehicles/civilian-car.svg",
};
// Minimum combined coordinate-delta (in degrees), ~0.2-0.3m movement at this latitude, before appending a trail point.
const MIN_TRAIL_DELTA_THRESHOLD = 0.000002;

function FollowCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export default function LiveMap({
  snapshot,
  mode,
  focusNodeId,
  showPredictedPath = false,
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
        <FollowCenter center={center} />
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
              <CircleMarker
                key={node.id}
                center={[lat, lon]}
                radius={isFocused ? baseRadius + 3 : baseRadius}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: isFocused ? 1 : 0.9,
                  weight: isFocused ? 3 : 1.5,
                  className: node.id === "emergency" ? "map-node-core-critical" : "map-node-core",
                }}
              >
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
              </CircleMarker>
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
