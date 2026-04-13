"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import * as THREE from "three";
import type { RealtimeSnapshot } from "@/lib/v2x/types";

type RoutePoint = [number, number];

type StreetLevelMap3DProps = {
  snapshot: RealtimeSnapshot;
  route: RoutePoint[];
  alternateRoutes: RoutePoint[][];
  chosenAlternative: number;
  collisions: Array<{ latitude: number; longitude: number; severity: "warning" | "critical" }>;
  communicationLinks: Array<{ from: string; to: string; latencyMs: number }>;
  showCommunication: boolean;
  driverPov: boolean;
  cameraHeight: number;
  cameraFov: number;
};

const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";
const SOURCE_ROUTE_MAIN = "ev-route-main";
const SOURCE_ROUTE_ALT = "ev-route-alt";
const SOURCE_COLLISION = "predicted-collision-zones";
const SOURCE_NODES = "v2x-node-points";
const SOURCE_COMMS = "v2x-comms";

function makeLine(points: RoutePoint[]) {
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: points.map(([lat, lng]) => [lng, lat]),
    },
    properties: {},
  };
}

export default function StreetLevelMap3D({
  snapshot,
  route,
  alternateRoutes,
  chosenAlternative,
  collisions,
  communicationLinks,
  showCommunication,
  driverPov,
  cameraHeight,
  cameraFov,
}: StreetLevelMap3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const animationFrameRef = useRef<number | null>(null);
  const threeCleanupRef = useRef<(() => void) | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? "";
  const hasToken = Boolean(token);
  const emergency = snapshot.vehicles.emergency;

  const nodeFeatures = useMemo(
    () =>
      Object.values(snapshot.vehicles).map((node) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [node.kalmanLongitude, node.kalmanLatitude],
        },
        properties: {
          id: node.id,
          label: node.label,
        },
      })),
    [snapshot.vehicles],
  );

  useEffect(() => {
    if (!containerRef.current || !hasToken || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [emergency.kalmanLongitude, emergency.kalmanLatitude],
      zoom: 16.5,
      pitch: 58,
      bearing: emergency.heading,
      antialias: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("style.load", () => {
      if (!map.getSource(SOURCE_ROUTE_MAIN)) {
        map.addSource(SOURCE_ROUTE_MAIN, { type: "geojson", data: makeLine(route) as GeoJSON.Feature });
      }
      if (!map.getLayer("ev-route-main-line")) {
        map.addLayer({
          id: "ev-route-main-line",
          type: "line",
          source: SOURCE_ROUTE_MAIN,
          paint: {
            "line-color": "#ff2233",
            "line-width": 5,
            "line-opacity": 0.95,
          },
        });
      }

      if (!map.getSource(SOURCE_ROUTE_ALT)) {
        map.addSource(SOURCE_ROUTE_ALT, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: alternateRoutes.map((points, index) => ({
              ...makeLine(points),
              properties: { altIndex: index },
            })),
          } as GeoJSON.FeatureCollection,
        });
      }
      if (!map.getLayer("ev-route-alt-line")) {
        map.addLayer({
          id: "ev-route-alt-line",
          type: "line",
          source: SOURCE_ROUTE_ALT,
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "altIndex"], chosenAlternative],
              "#22d3ee",
              "#71717a",
            ],
            "line-width": ["case", ["==", ["get", "altIndex"], chosenAlternative], 3, 2],
            "line-dasharray": ["case", ["==", ["get", "altIndex"], chosenAlternative], ["literal", [1, 0]], ["literal", [2, 2]]],
            "line-opacity": 0.7,
          },
        });
      }

      if (!map.getSource(SOURCE_COLLISION)) {
        map.addSource(SOURCE_COLLISION, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer("collision-zones")) {
        map.addLayer({
          id: "collision-zones",
          type: "circle",
          source: SOURCE_COLLISION,
          paint: {
            "circle-radius": ["case", ["==", ["get", "severity"], "critical"], 16, 10],
            "circle-color": ["case", ["==", ["get", "severity"], "critical"], "#ef4444", "#f59e0b"],
            "circle-opacity": 0.25,
            "circle-stroke-color": "#fef2f2",
            "circle-stroke-width": 1.2,
          },
        });
      }

      if (!map.getSource(SOURCE_NODES)) {
        map.addSource(SOURCE_NODES, {
          type: "geojson",
          data: { type: "FeatureCollection", features: nodeFeatures },
        });
      }

      if (!map.getSource(SOURCE_COMMS)) {
        map.addSource(SOURCE_COMMS, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer("comms-lines")) {
        map.addLayer({
          id: "comms-lines",
          type: "line",
          source: SOURCE_COMMS,
          paint: {
            "line-color": ["interpolate", ["linear"], ["get", "latency"], 20, "#10b981", 80, "#f59e0b", 140, "#ef4444"],
            "line-width": 2.2,
            "line-opacity": 0.75,
            "line-dasharray": [1.2, 1.2],
          },
        });
      }

      if (map.getLayer("3d-buildings")) {
        map.removeLayer("3d-buildings");
      }
      const layers = map.getStyle()?.layers ?? [];
      const labelLayerId = layers.find((layer) => layer.type === "symbol" && layer.layout?.["text-field"])?.id;
      map.addLayer(
        {
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 14,
          paint: {
            "fill-extrusion-color": "#2f4554",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "min_height"],
            "fill-extrusion-opacity": 0.45,
          },
        },
        labelLayerId,
      );

      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.25 });

      const scene = new THREE.Scene();
      const camera = new THREE.Camera();
      let renderer: THREE.WebGLRenderer | null = null;

      const geometry = new THREE.BoxGeometry(14, 8, 6);
      const material = new THREE.MeshBasicMaterial({ color: 0xff3344, wireframe: true });
      const emergencyMesh = new THREE.Mesh(geometry, material);
      scene.add(emergencyMesh);
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));

      const modelAsMercator = mapboxgl.MercatorCoordinate.fromLngLat(
        [emergency.kalmanLongitude, emergency.kalmanLatitude],
        0,
      );
      const modelTransform = {
        translateX: modelAsMercator.x,
        translateY: modelAsMercator.y,
        translateZ: modelAsMercator.z,
        scale: modelAsMercator.meterInMercatorCoordinateUnits(),
      };

      const customLayer: mapboxgl.CustomLayerInterface = {
        id: "three-emergency-layer",
        type: "custom",
        renderingMode: "3d",
        onAdd: (_map, gl) => {
          renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true,
          });
          renderer.autoClear = false;
        },
        render: (_gl, matrix) => {
          const rotation = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2);
          const m = new THREE.Matrix4().fromArray(matrix as number[]);
          const l = new THREE.Matrix4()
            .makeTranslation(
              modelTransform.translateX,
              modelTransform.translateY,
              modelTransform.translateZ + 0.000002 * cameraHeight,
            )
            .scale(new THREE.Vector3(modelTransform.scale, -modelTransform.scale, modelTransform.scale))
            .multiply(rotation);
          camera.projectionMatrix = m.multiply(l);
          emergencyMesh.rotation.z += 0.01;
          if (!renderer) return;
          renderer.resetState();
          renderer.render(scene, camera);
          map.triggerRepaint();
        },
      };

      if (!map.getLayer(customLayer.id)) {
        map.addLayer(customLayer);
      }

      threeCleanupRef.current = () => {
        geometry.dispose();
        material.dispose();
        renderer?.dispose();
      };
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      Object.values(markersRef.current).forEach((marker) => marker.remove());
      markersRef.current = {};
      if (threeCleanupRef.current) {
        threeCleanupRef.current();
        threeCleanupRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, [cameraHeight, emergency.heading, emergency.kalmanLatitude, emergency.kalmanLongitude, hasToken, nodeFeatures, route, token, chosenAlternative, alternateRoutes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const routeSource = map.getSource(SOURCE_ROUTE_MAIN) as mapboxgl.GeoJSONSource | undefined;
    routeSource?.setData(makeLine(route) as GeoJSON.Feature);

    const altSource = map.getSource(SOURCE_ROUTE_ALT) as mapboxgl.GeoJSONSource | undefined;
    altSource?.setData({
      type: "FeatureCollection",
      features: alternateRoutes.map((points, index) => ({
        ...makeLine(points),
        properties: { altIndex: index },
      })),
    } as GeoJSON.FeatureCollection);

    const collisionSource = map.getSource(SOURCE_COLLISION) as mapboxgl.GeoJSONSource | undefined;
    collisionSource?.setData({
      type: "FeatureCollection",
      features: collisions.map((zone, index) => ({
        type: "Feature",
        id: `col-${index}`,
        geometry: {
          type: "Point",
          coordinates: [zone.longitude, zone.latitude],
        },
        properties: { severity: zone.severity },
      })),
    });

    const nodeSource = map.getSource(SOURCE_NODES) as mapboxgl.GeoJSONSource | undefined;
    nodeSource?.setData({ type: "FeatureCollection", features: nodeFeatures });

    const commsSource = map.getSource(SOURCE_COMMS) as mapboxgl.GeoJSONSource | undefined;
    commsSource?.setData({
      type: "FeatureCollection",
      features: !showCommunication
        ? []
        : communicationLinks.flatMap((link, idx) => {
            const start = snapshot.vehicles[link.from];
            const end = snapshot.vehicles[link.to];
            if (!start || !end) return [];
            const midLat = (start.kalmanLatitude + end.kalmanLatitude) / 2 + 0.00005;
            const midLng = (start.kalmanLongitude + end.kalmanLongitude) / 2;
            return [
              {
                type: "Feature",
                id: `comms-${idx}`,
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [start.kalmanLongitude, start.kalmanLatitude],
                    [midLng, midLat],
                    [end.kalmanLongitude, end.kalmanLatitude],
                  ],
                },
                properties: { latency: link.latencyMs },
              },
            ];
          }),
    });

    Object.values(snapshot.vehicles).forEach((node) => {
      const existingMarker = markersRef.current[node.id];
      if (existingMarker) {
        existingMarker.setLngLat([node.kalmanLongitude, node.kalmanLatitude]);
        return;
      }
      const markerEl = document.createElement("div");
      markerEl.className = "street-level-node";
      markerEl.textContent = node.id === "emergency" ? "🚨" : node.id === "signal" ? "🚦" : "🚘";
      markerEl.style.fontSize = node.id === "emergency" ? "18px" : "14px";
      const marker = new mapboxgl.Marker({ element: markerEl, anchor: "center" })
        .setLngLat([node.kalmanLongitude, node.kalmanLatitude])
        .addTo(map);
      markersRef.current[node.id] = marker;
    });

    if (driverPov) {
      map.flyTo({
        center: [emergency.kalmanLongitude, emergency.kalmanLatitude],
        zoom: Math.max(15, 18 - (cameraFov - 55) / 18),
        pitch: Math.min(80, 55 + cameraHeight * 0.55),
        bearing: emergency.heading,
        speed: 0.38,
        curve: 1.5,
        easing: (t) => t * t * (3 - 2 * t),
      });
    }
  }, [
    alternateRoutes,
    cameraFov,
    cameraHeight,
    chosenAlternative,
    collisions,
    communicationLinks,
    driverPov,
    emergency.heading,
    emergency.kalmanLatitude,
    emergency.kalmanLongitude,
    nodeFeatures,
    route,
    showCommunication,
    snapshot.vehicles,
  ]);

  if (!hasToken) {
    return (
      <div className="map-container-animated relative h-[420px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.14),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(244,63,94,0.12),transparent_40%)]" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
          <p className="text-sm font-semibold text-zinc-100">3D Street-Level View (Fallback)</p>
          <p className="max-w-xl text-xs text-zinc-400">
            Mapbox token is missing. Running demo-safe fallback visuals with full 2D simulation support.
            Set <code className="rounded bg-black/60 px-1 py-0.5 text-cyan-300">NEXT_PUBLIC_MAPBOX_TOKEN</code> for full terrain/buildings.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="map-container-animated h-[420px] overflow-hidden rounded-xl border border-zinc-800" />;
}
