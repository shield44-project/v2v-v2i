"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const ROAD_W = 16;
const LOOP_X = 145;
const LOOP_Z = 102;
const PARTICLE_POOL = 44;
const AI_SPEED_BOOST = 1.28;
const VEHICLE_COUNT = 18;
const START_POSITION_JITTER = 0.7;
const LEFT_LANE_THRESHOLD = 1 / 3;
const CENTER_LANE_THRESHOLD = 2 / 3;
const LEFT_LANE = -1;
const CENTER_LANE = 0;
const RIGHT_LANE = 1;
const SLOW_VEHICLE_PROBABILITY = 0.15;
const SLOW_SPEED_FACTOR = 0.52;
const NORMAL_SPEED_FACTOR = 0.75;

type Dir = 1 | -1;

type VehicleTemplate = {
  id: string;
  label: string;
  emoji: string;
  dims: [number, number, number];
  color: number;
  baseSpeed: number;
  emitRate: number;
  smokeHex: number;
};

type VehicleDef = VehicleTemplate & {
  dir: Dir;
  startT: number;
};

const VEHICLE_TEMPLATES: VehicleTemplate[] = [
  { id: "car", label: "City Car", emoji: "🚗", dims: [4, 1.4, 2], color: 0xe74c3c, baseSpeed: 14, emitRate: 14, smokeHex: 0x999999 },
  { id: "truck", label: "Freight Truck", emoji: "🚚", dims: [8, 2.5, 3], color: 0x7f8c8d, baseSpeed: 9, emitRate: 28, smokeHex: 0x555555 },
  { id: "bus", label: "City Bus", emoji: "🚌", dims: [9, 2.8, 2.6], color: 0xf39c12, baseSpeed: 10, emitRate: 22, smokeHex: 0x666666 },
  { id: "bike", label: "Motor Bike", emoji: "🏍️", dims: [2, 1.2, 0.8], color: 0x3498db, baseSpeed: 18, emitRate: 10, smokeHex: 0xaaaaaa },
  { id: "scooter", label: "Urban Scooter", emoji: "🛵", dims: [1.5, 1, 0.7], color: 0x9b59b6, baseSpeed: 16, emitRate: 8, smokeHex: 0xaaaaaa },
  { id: "ev", label: "Electric Car", emoji: "⚡", dims: [4, 1.3, 2], color: 0x1abc9c, baseSpeed: 15, emitRate: 3, smokeHex: 0xdddddd },
];

type BuildingSpec = { x: number; z: number; w: number; h: number; d: number; color: number };

const BASE_BUILDINGS: BuildingSpec[] = [
  { x: -210, z: -145, w: 26, h: 84, d: 20, color: 0x2c3e50 },
  { x: -182, z: -126, w: 20, h: 64, d: 16, color: 0x34495e },
  { x: 210, z: -145, w: 24, h: 80, d: 18, color: 0x2e4057 },
  { x: 186, z: -126, w: 18, h: 54, d: 14, color: 0x35495e },
  { x: -208, z: 140, w: 24, h: 72, d: 18, color: 0x1a252f },
  { x: -180, z: 126, w: 18, h: 52, d: 15, color: 0x2c3e50 },
  { x: 206, z: 138, w: 26, h: 74, d: 20, color: 0x2c3e50 },
  { x: 184, z: 122, w: 16, h: 46, d: 14, color: 0x1c2833 },
  { x: -28, z: 0, w: 26, h: 108, d: 24, color: 0x2e4057 },
  { x: 26, z: -14, w: 24, h: 86, d: 20, color: 0x34495e },
  { x: 0, z: 24, w: 18, h: 56, d: 18, color: 0x2c3e50 },
];

function loopAt(t: number): { x: number; z: number; angle: number } {
  const lx = LOOP_X;
  const lz = LOOP_Z;
  const perim = 2 * (lx * 2 + lz * 2);
  const dist = ((t % 1 + 1) % 1) * perim;
  const top = lx * 2;
  const right = lz * 2;
  const bottom = lx * 2;
  if (dist < top) {
    const f = dist / top;
    return { x: -lx + f * lx * 2, z: -lz, angle: 0 };
  } else if (dist < top + right) {
    const f = (dist - top) / right;
    return { x: lx, z: -lz + f * lz * 2, angle: Math.PI / 2 };
  } else if (dist < top + right + bottom) {
    const f = (dist - top - right) / bottom;
    return { x: lx - f * lx * 2, z: lz, angle: Math.PI };
  } else {
    const f = (dist - top - right - bottom) / (perim - top - right - bottom);
    return { x: -lx, z: lz - f * lz * 2, angle: -Math.PI / 2 };
  }
}

type ParticlePool = {
  positions: Float32Array;
  ages: Float32Array;
  head: number;
  capacity: number;
  points: THREE.Points;
  material: THREE.PointsMaterial;
};

function createParticlePool(capacity: number, color: number): ParticlePool {
  const positions = new Float32Array(capacity * 3).fill(0);
  const ages = new Float32Array(capacity).fill(NaN);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.PointsMaterial({
    color,
    size: 3,
    transparent: true,
    opacity: 0.58,
    sizeAttenuation: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, material);
  return { positions, ages, head: 0, capacity, points, material };
}

function spawnParticle(pool: ParticlePool, x: number, y: number, z: number) {
  const i = pool.head;
  pool.positions[i * 3] = x;
  pool.positions[i * 3 + 1] = y;
  pool.positions[i * 3 + 2] = z;
  pool.ages[i] = 0;
  pool.head = (i + 1) % pool.capacity;
  (pool.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
}

function tickParticles(pool: ParticlePool, dt: number, maxAge: number) {
  let anyAlive = false;
  for (let i = 0; i < pool.capacity; i += 1) {
    if (isNaN(pool.ages[i])) continue;
    pool.ages[i] += dt;
    if (pool.ages[i] > maxAge) {
      pool.ages[i] = NaN;
      pool.positions[i * 3 + 1] = -9999;
      continue;
    }
    pool.positions[i * 3 + 1] += dt * 5.5;
    anyAlive = true;
  }
  if (anyAlive) {
    (pool.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);
  context.fillStyle = "#25272e";
  context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i += 1) {
    const shade = 28 + Math.floor(Math.random() * 22);
    context.fillStyle = `rgb(${shade},${shade},${shade + 3})`;
    context.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Applies a small random HSL variation to a base color.
 * `spread` is a byte-like value (0..255) that is normalized to a 0..1 lightness delta internally.
 */
function varyColor(hex: number, spread = 24): number {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.l = Math.max(0.1, Math.min(0.75, hsl.l + ((Math.random() * 2 - 1) * spread) / 255));
  hsl.s = Math.max(0.25, Math.min(0.95, hsl.s + (Math.random() * 2 - 1) * 0.1));
  return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l).getHex();
}

function createVehicleDefs(count: number): VehicleDef[] {
  const defs: VehicleDef[] = [];
  for (let i = 0; i < count; i += 1) {
    const template = VEHICLE_TEMPLATES[Math.floor(Math.random() * VEHICLE_TEMPLATES.length)];
    defs.push({
      ...template,
      id: `${template.id}-${i + 1}`,
      color: varyColor(template.color),
      dir: Math.random() > 0.52 ? 1 : -1,
      startT: Math.min(0.995, i / count + (Math.random() * START_POSITION_JITTER) / count),
      baseSpeed: template.baseSpeed * (0.82 + Math.random() * 0.42),
      emitRate: template.emitRate * (0.8 + Math.random() * 0.45),
    });
  }
  return defs;
}

function createExtendedBuildings(): BuildingSpec[] {
  const buildings = [...BASE_BUILDINGS];
  const colors = [0x2c3e50, 0x1f2937, 0x35495e, 0x2e4057, 0x3a475b];
  for (let i = 0; i < 28; i += 1) {
    const north = Math.random() > 0.5;
    const east = Math.random() > 0.5;
    const xBase = east ? 170 : -170;
    const zBase = north ? -130 : 130;
    buildings.push({
      x: xBase + (Math.random() * 80 - 40),
      z: zBase + (Math.random() * 80 - 40),
      w: 14 + Math.random() * 16,
      h: 30 + Math.random() * 80,
      d: 12 + Math.random() * 14,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
  return buildings;
}

type VehicleRuntime = {
  def: VehicleDef;
  mesh: THREE.Mesh;
  particle: ParticlePool;
  t: number;
  emitAccum: number;
  decisionCooldown: number;
  laneOffset: number;
  targetLaneOffset: number;
  speedFactor: number;
  targetSpeedFactor: number;
};

function buildScene(
  canvas: HTMLCanvasElement,
  containerEl: HTMLDivElement,
  getAiOn: () => boolean,
  getScenario: () => string,
  vehicleCount: number,
): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x151d2f);
  scene.fog = new THREE.FogExp2(0x151d2f, 0.0019);

  const aspect = containerEl.clientWidth / containerEl.clientHeight;
  const camera = new THREE.PerspectiveCamera(56, aspect, 0.5, 2600);
  camera.position.set(0, 110, 220);
  camera.lookAt(0, 0, 0);

  const hemi = new THREE.HemisphereLight(0x89b9ff, 0x0f1218, 0.9);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x334466, 0.8);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffd9b0, 1.45);
  sun.position.set(90, 165, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 900;
  sun.shadow.camera.left = -340;
  sun.shadow.camera.right = 340;
  sun.shadow.camera.top = 340;
  sun.shadow.camera.bottom = -340;
  scene.add(sun);
  const cyanGlow = new THREE.PointLight(0x24d6ff, 0.75, 500);
  cyanGlow.position.set(-40, 26, -30);
  scene.add(cyanGlow);
  const magentaGlow = new THREE.PointLight(0xb47bff, 0.48, 460);
  magentaGlow.position.set(60, 24, 20);
  scene.add(magentaGlow);

  const groundGeo = new THREE.PlaneGeometry(1400, 1400);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.95, metalness: 0.04 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const asphaltTexture = createAsphaltTexture();
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d34,
    roughness: 0.9,
    metalness: 0.08,
    map: asphaltTexture,
  });

  function addRoad(x: number, z: number, w: number, d: number) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.05, z);
    road.receiveShadow = true;
    scene.add(road);
  }

  addRoad(0, -LOOP_Z, LOOP_X * 2 + ROAD_W, ROAD_W);
  addRoad(0, LOOP_Z, LOOP_X * 2 + ROAD_W, ROAD_W);
  addRoad(-LOOP_X, 0, ROAD_W, LOOP_Z * 2 + ROAD_W);
  addRoad(LOOP_X, 0, ROAD_W, LOOP_Z * 2 + ROAD_W);
  addRoad(-LOOP_X, -LOOP_Z, ROAD_W, ROAD_W);
  addRoad(LOOP_X, -LOOP_Z, ROAD_W, ROAD_W);
  addRoad(-LOOP_X, LOOP_Z, ROAD_W, ROAD_W);
  addRoad(LOOP_X, LOOP_Z, ROAD_W, ROAD_W);

  const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x3a404d, roughness: 0.85, metalness: 0.05 });
  const shoulderH = 0.45;
  function addShoulder(x: number, z: number, w: number, d: number) {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(w, shoulderH, d), shoulderMat);
    shoulder.position.set(x, shoulderH / 2, z);
    shoulder.receiveShadow = true;
    scene.add(shoulder);
  }
  addShoulder(0, -(LOOP_Z + ROAD_W / 2 + 1.7), LOOP_X * 2 + ROAD_W + 8, 3.2);
  addShoulder(0, LOOP_Z + ROAD_W / 2 + 1.7, LOOP_X * 2 + ROAD_W + 8, 3.2);
  addShoulder(-(LOOP_X + ROAD_W / 2 + 1.7), 0, 3.2, LOOP_Z * 2 + ROAD_W + 8);
  addShoulder(LOOP_X + ROAD_W / 2 + 1.7, 0, 3.2, LOOP_Z * 2 + ROAD_W + 8);

  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.72 });
  function addDashes(axis: "h" | "v", fixedCoord: number, from: number, to: number, dashLen = 6, gapLen = 7) {
    let pos = from;
    while (pos + dashLen < to) {
      const w = axis === "h" ? dashLen : 0.38;
      const d = axis === "h" ? 0.38 : dashLen;
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(w, d), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(axis === "h" ? pos + dashLen / 2 : fixedCoord, 0.09, axis === "h" ? fixedCoord : pos + dashLen / 2);
      scene.add(dash);
      pos += dashLen + gapLen;
    }
  }
  addDashes("h", -LOOP_Z, -LOOP_X + ROAD_W / 2, LOOP_X - ROAD_W / 2);
  addDashes("h", LOOP_Z, -LOOP_X + ROAD_W / 2, LOOP_X - ROAD_W / 2);
  addDashes("v", -LOOP_X, -LOOP_Z + ROAD_W / 2, LOOP_Z - ROAD_W / 2);
  addDashes("v", LOOP_X, -LOOP_Z + ROAD_W / 2, LOOP_Z - ROAD_W / 2);

  const crosswalkMat = new THREE.MeshBasicMaterial({ color: 0xe5e7eb, transparent: true, opacity: 0.88 });
  function addCrosswalk(x: number, z: number, horizontal: boolean) {
    for (let i = -4; i <= 4; i += 1) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? 2.8 : 0.65, horizontal ? 0.65 : 2.8), crosswalkMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(horizontal ? x + i * 3 : x, 0.1, horizontal ? z : z + i * 3);
      scene.add(strip);
    }
  }
  addCrosswalk(0, -LOOP_Z + ROAD_W * 0.63, true);
  addCrosswalk(0, LOOP_Z - ROAD_W * 0.63, true);
  addCrosswalk(-LOOP_X + ROAD_W * 0.63, 0, false);
  addCrosswalk(LOOP_X - ROAD_W * 0.63, 0, false);

  const buildings = createExtendedBuildings();
  for (const b of buildings) {
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    const mat = new THREE.MeshStandardMaterial({
      color: b.color,
      roughness: 0.65,
      metalness: 0.28,
      emissive: varyColor(0x22394f, 12),
      emissiveIntensity: 0.14 + Math.random() * 0.12,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(b.x, b.h / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const roofLight = new THREE.PointLight(varyColor(0x4ec7ff, 10), 0.32, 70);
    roofLight.position.set(b.x, b.h + 2, b.z);
    scene.add(roofLight);
  }

  const poleGeo = new THREE.CylinderGeometry(0.3, 0.3, 8, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const tlGeo = new THREE.BoxGeometry(1.2, 3.2, 0.8);
  const corners = [
    [-LOOP_X, -LOOP_Z],
    [LOOP_X, -LOOP_Z],
    [-LOOP_X, LOOP_Z],
    [LOOP_X, LOOP_Z],
  ];
  for (const [cx, cz] of corners) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(cx + 5, 4, cz + 5);
    scene.add(pole);
    const tlBox = new THREE.Mesh(tlGeo, new THREE.MeshLambertMaterial({ color: 0x222222 }));
    tlBox.position.set(cx + 5, 9.5, cz + 5);
    scene.add(tlBox);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.4, 8), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
    lens.rotation.y = Math.PI / 2;
    lens.position.set(cx + 5.45, 8.5, cz + 5);
    scene.add(lens);
  }

  const vehicleDefs = createVehicleDefs(vehicleCount);
  const vehicles: VehicleRuntime[] = vehicleDefs.map((def) => {
    const geo = new THREE.BoxGeometry(...def.dims);
    const mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.42, metalness: 0.38 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    scene.add(mesh);
    const particle = createParticlePool(PARTICLE_POOL, def.smokeHex);
    scene.add(particle.points);
    return {
      def,
      mesh,
      particle,
      t: def.startT,
      emitAccum: 0,
      decisionCooldown: Math.random() * 3,
      laneOffset: 0,
      targetLaneOffset: 0,
      speedFactor: 1,
      targetSpeedFactor: 1,
    };
  });

  const smogGeo = new THREE.PlaneGeometry(520, 360);
  const smogMat = new THREE.MeshBasicMaterial({
    color: 0x5b6e88,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const smogPlane = new THREE.Mesh(smogGeo, smogMat);
  smogPlane.rotation.x = -Math.PI / 2;
  smogPlane.position.y = 24;
  scene.add(smogPlane);

  let theta = 0;
  let phi = 0.53;
  let radius = 280;
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  const onMouseDown = (event: MouseEvent) => {
    isDragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  };
  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    isDragging = true;
    lastX = event.touches[0].clientX;
    lastY = event.touches[0].clientY;
  };
  const onMouseUp = () => {
    isDragging = false;
  };
  const onMouseMove = (event: MouseEvent) => {
    if (!isDragging) return;
    theta -= (event.clientX - lastX) * 0.007;
    phi = Math.max(0.12, Math.min(1.35, phi - (event.clientY - lastY) * 0.007));
    lastX = event.clientX;
    lastY = event.clientY;
  };
  const onTouchMove = (event: TouchEvent) => {
    if (!isDragging || event.touches.length !== 1) return;
    theta -= (event.touches[0].clientX - lastX) * 0.007;
    phi = Math.max(0.12, Math.min(1.35, phi - (event.touches[0].clientY - lastY) * 0.007));
    lastX = event.touches[0].clientX;
    lastY = event.touches[0].clientY;
  };
  const onWheel = (event: WheelEvent) => {
    radius = Math.max(90, Math.min(520, radius + event.deltaY * 0.3));
  };
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("touchmove", onTouchMove, { passive: true });
  canvas.addEventListener("touchend", onMouseUp);
  canvas.addEventListener("wheel", onWheel, { passive: true });

  const onResize = () => {
    renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
    camera.aspect = containerEl.clientWidth / containerEl.clientHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);

  let lastTime = performance.now();
  let rafId = 0;
  const PARTICLE_MAX_AGE = 2.2;
  let simTime = 0;

  const loop = () => {
    rafId = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.06, (now - lastTime) / 1000);
    lastTime = now;
    simTime += dt;

    const aiOn = getAiOn();
    const scenario = getScenario();
    const congestion = scenario === "urban-peak" ? 1.0 : scenario === "incident" ? 1.2 : 0.72;

    smogMat.opacity = aiOn ? 0.07 : 0.2 * congestion;
    smogPlane.position.y = aiOn ? 27 : 19;

    cyanGlow.intensity = aiOn ? 0.84 : 0.58;
    magentaGlow.intensity = aiOn ? 0.56 : 0.36;

    const camX = radius * Math.sin(theta) * Math.cos(phi);
    const camY = radius * Math.sin(phi);
    const camZ = radius * Math.cos(theta) * Math.cos(phi);
    camera.position.set(camX, camY, camZ);
    camera.lookAt(0, 8, 0);

    for (const v of vehicles) {
      v.decisionCooldown -= dt;
      if (v.decisionCooldown <= 0) {
        if (aiOn) {
          const laneRoll = Math.random();
          const laneChoice = laneRoll < LEFT_LANE_THRESHOLD ? LEFT_LANE : laneRoll < CENTER_LANE_THRESHOLD ? CENTER_LANE : RIGHT_LANE;
          v.targetLaneOffset = laneChoice * ROAD_W * 0.18;
          v.targetSpeedFactor = Math.min(1.35, Math.max(0.9, 1.02 + Math.random() * 0.32 - (congestion - 1) * 0.18));
        } else {
          const jitterLane = (Math.random() * 2 - 1) * ROAD_W * 0.16;
          v.targetLaneOffset = jitterLane;
          const baseSpeedFactor = Math.random() < SLOW_VEHICLE_PROBABILITY ? SLOW_SPEED_FACTOR : NORMAL_SPEED_FACTOR;
          v.targetSpeedFactor = Math.min(1.08, Math.max(0.5, baseSpeedFactor + Math.random() * 0.34));
        }
        v.decisionCooldown = 1.2 + Math.random() * 3.6;
      }

      const responsiveness = aiOn ? 2.6 : 1.2;
      v.speedFactor += (v.targetSpeedFactor - v.speedFactor) * dt * responsiveness;
      v.laneOffset += (v.targetLaneOffset - v.laneOffset) * dt * (aiOn ? 2 : 1.1);

      const speedWave = 1 + Math.sin(simTime * 0.8 + v.def.startT * 12) * 0.08;
      const speedMult = (v.speedFactor * speedWave * (aiOn ? AI_SPEED_BOOST : 1)) / congestion;
      const loopPerim = 2 * (LOOP_X * 2 + LOOP_Z * 2);
      const advance = (v.def.baseSpeed * speedMult * dt * v.def.dir) / loopPerim;
      v.t = ((v.t + advance) % 1 + 1) % 1;

      const laneBaseOffset = (v.def.dir === 1 ? 1 : -1) * (ROAD_W * 0.25);
      const laneOffset = laneBaseOffset + v.laneOffset;
      const { x, z, angle } = loopAt(v.t);
      const lx = x + Math.sin(angle + Math.PI / 2) * laneOffset;
      const lz = z + Math.cos(angle + Math.PI / 2) * laneOffset;
      v.mesh.position.set(lx, v.def.dims[1] / 2, lz);
      v.mesh.rotation.y = -angle + (v.def.dir === -1 ? Math.PI : 0);

      const exhaustOffset = -v.def.dims[0] / 2 - 0.6;
      const ex = lx + Math.sin(-angle) * exhaustOffset;
      const ez = lz + Math.cos(-angle) * exhaustOffset;
      const ey = v.def.dims[1] * 0.6;

      const rate = aiOn ? v.def.emitRate * 0.24 * congestion : v.def.emitRate * congestion;
      v.emitAccum += rate * dt;
      while (v.emitAccum >= 1) {
        spawnParticle(v.particle, ex + (Math.random() - 0.5) * 1.2, ey + Math.random() * 0.8, ez + (Math.random() - 0.5) * 1.2);
        v.emitAccum -= 1;
      }

      tickParticles(v.particle, dt, PARTICLE_MAX_AGE);
      v.particle.material.opacity = aiOn ? 0.3 : 0.58;
    }

    if (!isDragging) theta += dt * 0.02;
    renderer.render(scene, camera);
  };

  loop();

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("mousedown", onMouseDown);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("touchmove", onTouchMove);
    canvas.removeEventListener("touchend", onMouseUp);
    canvas.removeEventListener("wheel", onWheel);
    window.removeEventListener("resize", onResize);

    for (const v of vehicles) {
      v.mesh.geometry.dispose();
      (v.mesh.material as THREE.Material).dispose();
      v.particle.points.geometry.dispose();
      v.particle.material.dispose();
    }
    roadMat.dispose();
    asphaltTexture.dispose();
    renderer.dispose();
  };
}

type CityWorld3DProps = {
  aiOptimized?: boolean;
  scenario?: string;
  heightClass?: string;
};

export default function CityWorld3D({
  aiOptimized = false,
  scenario = "urban-peak",
  heightClass = "h-[520px]",
}: CityWorld3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef(aiOptimized);
  const scenarioRef = useRef(scenario);
  const [aiOn, setAiOn] = useState(aiOptimized);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  useEffect(() => {
    aiRef.current = aiOptimized;
  }, [aiOptimized]);
  useEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);

  const handleAiToggle = () => {
    setAiOn((prev) => {
      const next = !prev;
      aiRef.current = next;
      return next;
    });
  };

  const handleFullscreenToggle = async () => {
    const container = containerRef.current;
    if (!container) return;
    setFullscreenError(null);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (!("requestFullscreen" in container)) {
        setFullscreenError("Fullscreen is not supported in this browser.");
        return;
      }
      await container.requestFullscreen();
    } catch {
      setFullscreenError("Fullscreen request was blocked by the browser.");
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const cleanup = buildScene(canvas, container, () => aiRef.current, () => scenarioRef.current, VEHICLE_COUNT);
    return cleanup;
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-zinc-700/60">
      <div ref={containerRef} className={`w-full ${isFullscreen ? "h-screen" : heightClass}`}>
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-zinc-700 bg-black/70 px-2 py-1 text-[11px] text-zinc-300 backdrop-blur">
          🌍 Open-world city · {VEHICLE_COUNT} randomized vehicles live
        </span>
        <button
          type="button"
          onClick={handleAiToggle}
          className={`rounded-md border px-2 py-1 text-[11px] backdrop-blur transition ${
            aiOn ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200" : "border-red-400/60 bg-red-500/20 text-red-200"
          }`}
        >
          AI Optimisation {aiOn ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          onClick={handleFullscreenToggle}
          className="rounded-md border border-cyan-400/60 bg-cyan-500/20 px-2 py-1 text-[11px] text-cyan-100 backdrop-blur transition hover:bg-cyan-500/30"
        >
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </button>
      </div>

      <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
        {VEHICLE_TEMPLATES.map((template) => (
          <span
            key={template.id}
            className="rounded-md border border-zinc-700/60 bg-black/70 px-1.5 py-0.5 text-[10px] text-zinc-300 backdrop-blur"
          >
            {template.emoji} {template.label}
          </span>
        ))}
      </div>

      <p className="absolute right-3 top-3 rounded-md border border-zinc-700/50 bg-black/70 px-2 py-1 text-[10px] text-zinc-400 backdrop-blur">
        Drag to orbit · scroll to zoom
      </p>
      {fullscreenError && (
        <p className="absolute right-3 top-10 rounded-md border border-red-500/40 bg-black/70 px-2 py-1 text-[10px] text-red-300 backdrop-blur">
          {fullscreenError}
        </p>
      )}
    </div>
  );
}
