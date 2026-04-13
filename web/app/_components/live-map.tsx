"use client";

import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { useMap } from "react-leaflet/hooks";
import type { RealtimeSnapshot } from "@/lib/v2x/types";

type MapMode = "street" | "walking";

type LiveMapProps = {
  snapshot: RealtimeSnapshot;
  mode: MapMode;
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
};

const NODE_COLORS: Record<string, string> = {
  emergency: "#ff2233",
  signal: "#facc15",
  vehicle1: "#3b82f6",
  vehicle2: "#a855f7",
};

function FollowCenter({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center);
  }, [center, map]);

  return null;
}

export default function LiveMap({ snapshot, mode }: LiveMapProps) {
  const emergency = snapshot.vehicles.emergency;
  const center: [number, number] = [
    emergency?.kalmanLatitude ?? emergency?.latitude ?? 12.918,
    emergency?.kalmanLongitude ?? emergency?.longitude ?? 77.6205,
  ];

  const tileLayer = TILE_LAYERS[mode];

  return (
    <div className="h-[420px] overflow-hidden rounded-xl border border-zinc-800">
      <MapContainer
        center={center}
        zoom={18}
        scrollWheelZoom
        className="h-full w-full"
      >
        <FollowCenter center={center} />
        <TileLayer attribution={tileLayer.attribution} url={tileLayer.url} />

        {Object.values(snapshot.vehicles).map((node) => {
          const latitude = node.kalmanLatitude || node.latitude;
          const longitude = node.kalmanLongitude || node.longitude;

          return (
            <CircleMarker
              key={node.id}
              center={[latitude, longitude]}
              radius={7}
              pathOptions={{
                color: NODE_COLORS[node.id] ?? "#22d3ee",
                fillColor: NODE_COLORS[node.id] ?? "#22d3ee",
                fillOpacity: 0.85,
              }}
            >
              <Popup>
                <strong>{node.label}</strong>
                <div className="text-xs">
                  {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </div>
                <div className="text-xs">Speed: {node.speed.toFixed(1)} m/s</div>
              </Popup>
            </CircleMarker>
          );
        })}

        {emergency && (
          <>
            <Circle
              center={[emergency.kalmanLatitude, emergency.kalmanLongitude]}
              radius={25}
              pathOptions={{ color: "#ef4444", weight: 1.2, fillOpacity: 0.08 }}
            />
            <Circle
              center={[emergency.kalmanLatitude, emergency.kalmanLongitude]}
              radius={50}
              pathOptions={{ color: "#facc15", weight: 1.2, fillOpacity: 0.06 }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
