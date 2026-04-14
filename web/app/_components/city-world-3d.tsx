"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// ─── scene constants ──────────────────────────────────────────────────────────

const ROAD_W = 12;          // lane-pair width (world units)
const LOOP_X = 85;          // half-width of the outer vehicle loop
const LOOP_Z = 58;          // half-depth of the outer vehicle loop
const PARTICLE_POOL = 32;   // smoke sprites per vehicle
const AI_SPEED_BOOST = 1.22; // vehicles move slightly faster when AI-optimised (less idling)

// ─── vehicle definitions ─────────────────────────────────────────────────────

type Dir = 1 | -1; // 1 = counter-clockwise, -1 = clockwise

type VehicleDef = {
  id: string;
  label: string;
  /** box [length, height, width] in world units */
  dims: [number, number, number];
  color: number;
  dir: Dir;
  /** fractional start position along the loop path 0..1 */
  startT: number;
  /** world-units per second */
  baseSpeed: number;
  /** particles emitted per second (base) */
  emitRate: number;
  /** hex color of smoke particles */
  smokeHex: number;
};

const VEHICLE_DEFS: VehicleDef[] = [
  { id: "car",     label: "City Car",       dims: [4,   1.4, 2  ], color: 0xe74c3c, dir:  1, startT: 0.00, baseSpeed: 14, emitRate: 14, smokeHex: 0x999999 },
  { id: "truck",   label: "Freight Truck",  dims: [8,   2.5, 3  ], color: 0x7f8c8d, dir: -1, startT: 0.10, baseSpeed:  9, emitRate: 28, smokeHex: 0x555555 },
  { id: "bus",     label: "City Bus",       dims: [9,   2.8, 2.6], color: 0xf39c12, dir:  1, startT: 0.38, baseSpeed: 10, emitRate: 22, smokeHex: 0x666666 },
  { id: "bike",    label: "Motor Bike",     dims: [2,   1.2, 0.8], color: 0x3498db, dir: -1, startT: 0.56, baseSpeed: 18, emitRate: 10, smokeHex: 0xaaaaaa },
  { id: "scooter", label: "Urban Scooter",  dims: [1.5, 1,   0.7], color: 0x9b59b6, dir:  1, startT: 0.73, baseSpeed: 16, emitRate:  8, smokeHex: 0xaaaaaa },
  { id: "ev",      label: "Electric Car",   dims: [4,   1.3, 2  ], color: 0x1abc9c, dir: -1, startT: 0.86, baseSpeed: 15, emitRate:  3, smokeHex: 0xdddddd },
];

// ─── static building layout ───────────────────────────────────────────────────

type BuildingSpec = { x: number; z: number; w: number; h: number; d: number; color: number };

const BUILDINGS: BuildingSpec[] = [
  // NW block
  { x: -130, z: -85, w: 22, h: 70,  d: 18, color: 0x2c3e50 },
  { x: -110, z: -70, w: 16, h: 48,  d: 14, color: 0x34495e },
  { x: -148, z: -68, w: 14, h: 38,  d: 16, color: 0x2c3e50 },
  { x: -125, z: -100, w: 18, h: 55, d: 12, color: 0x1a252f },
  { x: -155, z: -95, w: 12, h: 28,  d: 12, color: 0x2e4057 },
  // NE block
  { x:  125, z: -85, w: 20, h: 65,  d: 16, color: 0x2c3e50 },
  { x:  145, z: -70, w: 15, h: 44,  d: 13, color: 0x35495e },
  { x:  110, z: -100, w: 17, h: 52, d: 14, color: 0x1c2833 },
  { x:  155, z: -98, w: 13, h: 32,  d: 13, color: 0x2e4057 },
  // SW block
  { x: -128, z:  80, w: 21, h: 60,  d: 17, color: 0x1a252f },
  { x: -110, z:  96, w: 16, h: 36,  d: 15, color: 0x2c3e50 },
  { x: -148, z:  92, w: 14, h: 42,  d: 12, color: 0x34495e },
  // SE block
  { x:  122, z:  82, w: 22, h: 58,  d: 18, color: 0x2c3e50 },
  { x:  145, z:  95, w: 15, h: 32,  d: 13, color: 0x1c2833 },
  { x:  108, z:  98, w: 16, h: 45,  d: 14, color: 0x35495e },
  // Central block (island)
  { x: -18,  z:   0, w: 24, h: 90,  d: 20, color: 0x2e4057 },
  { x:  18,  z:  -8, w: 20, h: 62,  d: 16, color: 0x34495e },
  { x:   0,  z:  12, w: 14, h: 40,  d: 14, color: 0x2c3e50 },
];

// ─── loop-path math ───────────────────────────────────────────────────────────

/**
 * Rectangular loop: NW → NE → SE → SW → NW (counter-clockwise when viewed from above).
 * Returns world-space position and the forward-facing angle (radians, in XZ plane).
 */
function loopAt(t: number): { x: number; z: number; angle: number } {
  const lx = LOOP_X;
  const lz = LOOP_Z;
  // perimeter segments: top (W→E), right (N→S), bottom (E→W), left (S→N)
  const perim = 2 * (lx * 2 + lz * 2);
  const dist = ((t % 1 + 1) % 1) * perim;
  const top    = lx * 2;
  const right  = lz * 2;
  const bottom = lx * 2;
  // const left   = lz * 2;  (unused, remaining perimeter)
  if (dist < top) {
    // west → east along north edge
    const f = dist / top;
    return { x: -lx + f * lx * 2, z: -lz, angle: 0 };
  } else if (dist < top + right) {
    // north → south along east edge
    const f = (dist - top) / right;
    return { x: lx, z: -lz + f * lz * 2, angle: Math.PI / 2 };
  } else if (dist < top + right + bottom) {
    // east → west along south edge
    const f = (dist - top - right) / bottom;
    return { x: lx - f * lx * 2, z: lz, angle: Math.PI };
  } else {
    // south → north along west edge
    const f = (dist - top - right - bottom) / (perim - top - right - bottom);
    return { x: -lx, z: lz - f * lz * 2, angle: -Math.PI / 2 };
  }
}

// ─── particle ring-buffer ─────────────────────────────────────────────────────

type ParticlePool = {
  positions: Float32Array; // capacity * 3
  ages: Float32Array;      // capacity  (seconds, NaN = inactive)
  head: number;            // next slot to overwrite
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
    size: 2.8,
    transparent: true,
    opacity: 0.55,
    sizeAttenuation: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, material);
  return { positions, ages, head: 0, capacity, points, material };
}

function spawnParticle(pool: ParticlePool, x: number, y: number, z: number) {
  const i = pool.head;
  pool.positions[i * 3]     = x;
  pool.positions[i * 3 + 1] = y;
  pool.positions[i * 3 + 2] = z;
  pool.ages[i] = 0;
  pool.head = (i + 1) % pool.capacity;
  (pool.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
}

function tickParticles(pool: ParticlePool, dt: number, maxAge: number) {
  let anyAlive = false;
  for (let i = 0; i < pool.capacity; i++) {
    if (isNaN(pool.ages[i])) continue;
    pool.ages[i] += dt;
    if (pool.ages[i] > maxAge) {
      pool.ages[i] = NaN;
      pool.positions[i * 3 + 1] = -9999; // hide below ground
      continue;
    }
    // rise upward
    pool.positions[i * 3 + 1] += dt * 4.5;
    anyAlive = true;
  }
  if (anyAlive) {
    (pool.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ─── scene builder ────────────────────────────────────────────────────────────

type VehicleRuntime = {
  def: VehicleDef;
  mesh: THREE.Mesh;
  particle: ParticlePool;
  t: number;          // position along loop 0..1
  emitAccum: number;  // accumulated emission time
};

function buildScene(
  canvas: HTMLCanvasElement,
  containerEl: HTMLDivElement,
  getAiOn: () => boolean,
  getScenario: () => string,
): () => void {
  // ── renderer ─────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  // ── scene ─────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);
  scene.fog = new THREE.FogExp2(0x0d1117, 0.0028);

  // ── camera ────────────────────────────────────────────────────────────────
  const aspect = containerEl.clientWidth / containerEl.clientHeight;
  const camera = new THREE.PerspectiveCamera(55, aspect, 0.5, 2000);
  camera.position.set(0, 95, 160);
  camera.lookAt(0, 0, 0);

  // ── lights ────────────────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0x334466, 0.9);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffd9b0, 1.4);
  sun.position.set(80, 150, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.width  = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far  = 600;
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right  =  220;
  sun.shadow.camera.top    =  220;
  sun.shadow.camera.bottom = -220;
  scene.add(sun);

  const cityGlow = new THREE.PointLight(0x22bbff, 0.6, 280);
  cityGlow.position.set(0, 20, 0);
  scene.add(cityGlow);

  // ── ground ────────────────────────────────────────────────────────────────
  const groundGeo = new THREE.PlaneGeometry(800, 800);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x111318 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ── road surfaces ─────────────────────────────────────────────────────────
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x1e2230 });

  function addRoad(x: number, z: number, w: number, d: number) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.05, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  // north + south horizontal roads
  addRoad(0, -LOOP_Z, LOOP_X * 2 + ROAD_W, ROAD_W);
  addRoad(0,  LOOP_Z, LOOP_X * 2 + ROAD_W, ROAD_W);
  // west + east vertical roads
  addRoad(-LOOP_X, 0, ROAD_W, LOOP_Z * 2 + ROAD_W);
  addRoad( LOOP_X, 0, ROAD_W, LOOP_Z * 2 + ROAD_W);
  // corner fill
  addRoad(-LOOP_X, -LOOP_Z, ROAD_W, ROAD_W);
  addRoad( LOOP_X, -LOOP_Z, ROAD_W, ROAD_W);
  addRoad(-LOOP_X,  LOOP_Z, ROAD_W, ROAD_W);
  addRoad( LOOP_X,  LOOP_Z, ROAD_W, ROAD_W);

  // ── road centre dashes ────────────────────────────────────────────────────
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  function addDashes(
    axis: "h" | "v",
    fixedCoord: number,
    from: number,
    to: number,
    dashLen = 4,
    gapLen = 5,
  ) {
    let pos = from;
    while (pos + dashLen < to) {
      const w = axis === "h" ? dashLen : 0.3;
      const d = axis === "h" ? 0.3 : dashLen;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), dashMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(
        axis === "h" ? pos + dashLen / 2 : fixedCoord,
        0.08,
        axis === "h" ? fixedCoord : pos + dashLen / 2,
      );
      scene.add(m);
      pos += dashLen + gapLen;
    }
  }
  addDashes("h", -LOOP_Z, -LOOP_X + ROAD_W / 2, LOOP_X - ROAD_W / 2);
  addDashes("h",  LOOP_Z, -LOOP_X + ROAD_W / 2, LOOP_X - ROAD_W / 2);
  addDashes("v", -LOOP_X, -LOOP_Z + ROAD_W / 2, LOOP_Z - ROAD_W / 2);
  addDashes("v",  LOOP_X, -LOOP_Z + ROAD_W / 2, LOOP_Z - ROAD_W / 2);

  // ── buildings ─────────────────────────────────────────────────────────────
  for (const b of BUILDINGS) {
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    const mat = new THREE.MeshLambertMaterial({ color: b.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(b.x, b.h / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // rooftop point light to add urban-glow feel
    const roofLight = new THREE.PointLight(0x3388cc, 0.35, 55);
    roofLight.position.set(b.x, b.h + 2, b.z);
    scene.add(roofLight);
  }

  // ── traffic lights (simple poles at corners) ─────────────────────────────
  const poleGeo = new THREE.CylinderGeometry(0.3, 0.3, 8, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const tlGeo = new THREE.BoxGeometry(1.2, 3.2, 0.8);
  const corners = [
    [-LOOP_X, -LOOP_Z],
    [ LOOP_X, -LOOP_Z],
    [-LOOP_X,  LOOP_Z],
    [ LOOP_X,  LOOP_Z],
  ];
  for (const [cx, cz] of corners) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(cx + 5, 4, cz + 5);
    scene.add(pole);
    const tlBox = new THREE.Mesh(tlGeo, new THREE.MeshLambertMaterial({ color: 0x222222 }));
    tlBox.position.set(cx + 5, 9.5, cz + 5);
    scene.add(tlBox);
    // green lens
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.4, 8), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
    lens.rotation.y = Math.PI / 2;
    lens.position.set(cx + 5.45, 8.5, cz + 5);
    scene.add(lens);
  }

  // ── pavement / sidewalk strips ────────────────────────────────────────────
  const paveMat = new THREE.MeshLambertMaterial({ color: 0x252a35 });
  const paveH = 0.6;
  function addPavement(x: number, z: number, w: number, d: number) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, paveH, d), paveMat);
    m.position.set(x, paveH / 2, z);
    scene.add(m);
  }
  // thin kerb strips alongside roads
  addPavement(0, -(LOOP_Z + ROAD_W / 2 + 1.5), LOOP_X * 2 + ROAD_W + 6, 3);
  addPavement(0,   LOOP_Z + ROAD_W / 2 + 1.5,  LOOP_X * 2 + ROAD_W + 6, 3);
  addPavement(-(LOOP_X + ROAD_W / 2 + 1.5), 0, 3, LOOP_Z * 2 + ROAD_W + 6);
  addPavement(  LOOP_X + ROAD_W / 2 + 1.5,  0, 3, LOOP_Z * 2 + ROAD_W + 6);

  // ── vehicles ──────────────────────────────────────────────────────────────
  const vehicles: VehicleRuntime[] = VEHICLE_DEFS.map((def) => {
    const geo = new THREE.BoxGeometry(...def.dims);
    const mat = new THREE.MeshLambertMaterial({ color: def.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    scene.add(mesh);

    const particle = createParticlePool(PARTICLE_POOL, def.smokeHex);
    scene.add(particle.points);

    return { def, mesh, particle, t: def.startT, emitAccum: 0 };
  });

  // ── smog plane (ambient pollution cloud) ─────────────────────────────────
  const smogGeo = new THREE.PlaneGeometry(350, 250);
  const smogMat = new THREE.MeshBasicMaterial({
    color: 0x445566, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide,
  });
  const smogPlane = new THREE.Mesh(smogGeo, smogMat);
  smogPlane.rotation.x = -Math.PI / 2;
  smogPlane.position.y = 22;
  scene.add(smogPlane);

  // ── camera orbit controls ─────────────────────────────────────────────────
  let theta = 0;       // azimuth (rad)
  let phi   = 0.52;    // elevation (rad, 0 = horizon, PI/2 = overhead)
  let radius = 200;    // distance from origin
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  const onMouseDown = (event: MouseEvent) => { isDragging = true; lastX = event.clientX; lastY = event.clientY; };
  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 1) {
      isDragging = true;
      lastX = event.touches[0].clientX;
      lastY = event.touches[0].clientY;
    }
  };
  const onMouseUp = () => { isDragging = false; };
  const onMouseMove = (event: MouseEvent) => {
    if (!isDragging) return;
    theta -= (event.clientX - lastX) * 0.007;
    phi    = Math.max(0.12, Math.min(1.3, phi - (event.clientY - lastY) * 0.007));
    lastX = event.clientX;
    lastY = event.clientY;
  };
  const onTouchMove = (event: TouchEvent) => {
    if (!isDragging || event.touches.length !== 1) return;
    theta -= (event.touches[0].clientX - lastX) * 0.007;
    phi    = Math.max(0.12, Math.min(1.3, phi - (event.touches[0].clientY - lastY) * 0.007));
    lastX = event.touches[0].clientX;
    lastY = event.touches[0].clientY;
  };
  const onWheel = (event: WheelEvent) => {
    radius = Math.max(60, Math.min(380, radius + event.deltaY * 0.25));
  };

  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("touchmove", onTouchMove, { passive: true });
  canvas.addEventListener("touchend", onMouseUp);
  canvas.addEventListener("wheel", onWheel, { passive: true });

  // ── resize handler ────────────────────────────────────────────────────────
  const onResize = () => {
    if (!containerEl) return;
    renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
    camera.aspect = containerEl.clientWidth / containerEl.clientHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);

  // ── animation loop ────────────────────────────────────────────────────────
  let lastTime = performance.now();
  let rafId = 0;
  const PARTICLE_MAX_AGE = 2.2; // seconds
  let simTime = 0;

  const loop = () => {
    rafId = requestAnimationFrame(loop);
    const now = performance.now();
    const dt  = Math.min(0.06, (now - lastTime) / 1000);
    lastTime  = now;
    simTime  += dt;

    const aiOn    = getAiOn();
    const scenario = getScenario();
    const congestion = scenario === "urban-peak" ? 1.0 : scenario === "incident" ? 1.2 : 0.72;

    // smog layer: denser when AI is OFF
    smogMat.opacity = aiOn ? 0.06 : 0.18 * congestion;
    smogPlane.position.y = aiOn ? 25 : 18;

    // update camera orbit
    const camX = radius * Math.sin(theta) * Math.cos(phi);
    const camY = radius * Math.sin(phi);
    const camZ = radius * Math.cos(theta) * Math.cos(phi);
    camera.position.set(camX, camY, camZ);
    camera.lookAt(0, 5, 0);

    // move vehicles + emit particles
    for (const v of vehicles) {
      const speedMult = aiOn
        ? AI_SPEED_BOOST / congestion
        : (1 + Math.sin(simTime * 0.7 + v.def.startT * 12) * 0.18) / congestion;
      const loopPerim = 2 * (LOOP_X * 2 + LOOP_Z * 2);
      const advance = (v.def.baseSpeed * speedMult * dt * v.def.dir) / loopPerim;
      v.t = ((v.t + advance) % 1 + 1) % 1;

      // offset counter-clockwise vs clockwise vehicles to opposite lanes
      const laneOffset = (v.def.dir === 1 ? 1 : -1) * (ROAD_W * 0.28);
      const { x, z, angle } = loopAt(v.t);
      const lx = x + Math.sin(angle + Math.PI / 2) * laneOffset;
      const lz = z + Math.cos(angle + Math.PI / 2) * laneOffset;

      v.mesh.position.set(lx, v.def.dims[1] / 2, lz);
      v.mesh.rotation.y = -angle + (v.def.dir === -1 ? Math.PI : 0);

      // exhaust position: behind the vehicle centre
      const exhaustOffset = -v.def.dims[0] / 2 - 0.6;
      const ex = lx + Math.sin(-angle) * exhaustOffset;
      const ez = lz + Math.cos(-angle) * exhaustOffset;
      const ey = v.def.dims[1] * 0.6;

      // emission rate scales with AI state
      const rate = aiOn ? v.def.emitRate * 0.22 * congestion : v.def.emitRate * congestion;
      v.emitAccum += rate * dt;
      while (v.emitAccum >= 1) {
        spawnParticle(v.particle,
          ex + (Math.random() - 0.5) * 1.2,
          ey + Math.random() * 0.8,
          ez + (Math.random() - 0.5) * 1.2,
        );
        v.emitAccum -= 1;
      }

      // advance particle ages
      tickParticles(v.particle, dt, PARTICLE_MAX_AGE);

      // shrink opacity of particles over time (fade)
      v.particle.material.opacity = aiOn ? 0.28 : 0.55;
    }

    // slow camera auto-orbit when not being dragged
    if (!isDragging) {
      theta += dt * 0.018;
    }

    renderer.render(scene, camera);
  };

  loop();

  // ── cleanup ───────────────────────────────────────────────────────────────
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
    renderer.dispose();
  };
}

// ─── component ───────────────────────────────────────────────────────────────

type CityWorld3DProps = {
  aiOptimized?: boolean;
  scenario?: string;
  /** height class applied to the canvas wrapper, e.g. "h-[520px]" */
  heightClass?: string;
};

export default function CityWorld3D({
  aiOptimized = false,
  scenario = "urban-peak",
  heightClass = "h-[520px]",
}: CityWorld3DProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const aiRef        = useRef(aiOptimized);
  const scenarioRef  = useRef(scenario);

  // keep refs in sync without recreating the scene
  useEffect(() => { aiRef.current = aiOptimized; }, [aiOptimized]);
  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);

  const [aiOn, setAiOn] = useState(aiOptimized);

  const handleAiToggle = () => {
    setAiOn((prev) => {
      const next = !prev;
      aiRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const cleanup = buildScene(
      canvas,
      container,
      () => aiRef.current,
      () => scenarioRef.current,
    );
    return cleanup;
  }, []); // scene is built once; props fed through refs

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-zinc-700/60">
      <div ref={containerRef} className={`w-full ${heightClass}`}>
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      {/* overlay controls */}
      <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-zinc-700 bg-black/70 px-2 py-1 text-[11px] text-zinc-300 backdrop-blur">
          🌍 Open-world city · {VEHICLE_DEFS.length} vehicles live
        </span>
        <button
          type="button"
          onClick={handleAiToggle}
          className={`rounded-md border px-2 py-1 text-[11px] backdrop-blur transition ${
            aiOn
              ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
              : "border-red-400/60 bg-red-500/20 text-red-200"
          }`}
        >
          AI Optimisation {aiOn ? "ON" : "OFF"}
        </button>
      </div>

      {/* legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
        {VEHICLE_DEFS.map((v) => (
          <span
            key={v.id}
            className="rounded-md border border-zinc-700/60 bg-black/70 px-1.5 py-0.5 text-[10px] text-zinc-300 backdrop-blur"
          >
            {v.id === "car"     && "🚗"}
            {v.id === "truck"   && "🚚"}
            {v.id === "bus"     && "🚌"}
            {v.id === "bike"    && "🏍️"}
            {v.id === "scooter" && "🛵"}
            {v.id === "ev"      && "⚡"}
            {" "}{v.label}
          </span>
        ))}
      </div>

      {/* hint */}
      <p className="absolute right-3 top-3 rounded-md border border-zinc-700/50 bg-black/70 px-2 py-1 text-[10px] text-zinc-500 backdrop-blur">
        Drag to orbit · scroll to zoom
      </p>
    </div>
  );
}
