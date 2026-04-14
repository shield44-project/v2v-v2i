"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type GasKey = "co2" | "co" | "nox" | "so2" | "pm25" | "pm10" | "hc" | "vocs" | "ch4" | "ozone";
type Scenario = "urban-peak" | "free-flow" | "incident";
type ThemeMode = "dark" | "light";

type GasInfo = {
  key: GasKey;
  label: string;
  source: string;
  environmentalImpact: string;
  shortTermHealthEffects: string;
  longTermHealthProblems: string;
};

type VehicleProfile = {
  id: string;
  label: string;
  icon: string;
  vehicleType: string;
  fuelType: string;
  aiStrategy: string;
  baseEmission: Record<GasKey, number>;
};

type VehicleEmissionTick = {
  id: string;
  label: string;
  icon: string;
  vehicleType: string;
  fuelType: string;
  aiStrategy: string;
  aiReductionPercent: number;
  beforeTotal: number;
  afterTotal: number;
  beforeByGas: Record<GasKey, number>;
  afterByGas: Record<GasKey, number>;
};

type EmissionTick = {
  timeLabel: string;
  trafficDensity: number;
  aqi: number;
  beforeByGas: Record<GasKey, number>;
  afterByGas: Record<GasKey, number>;
  vehicleTicks: VehicleEmissionTick[];
};

const GAS_DETAILS: GasInfo[] = [
  {
    key: "co2",
    label: "Carbon Dioxide (CO₂)",
    source: "Complete combustion of petrol/diesel in engines.",
    environmentalImpact: "Drives climate change and global warming.",
    shortTermHealthEffects: "Headache and breathing discomfort in enclosed/high exposure spaces.",
    longTermHealthProblems: "Chronic climate-linked heat stress and respiratory burden.",
  },
  {
    key: "co",
    label: "Carbon Monoxide (CO)",
    source: "Incomplete fuel combustion, common in congestion and idling.",
    environmentalImpact: "Contributes to poor urban air quality chemistry.",
    shortTermHealthEffects: "Dizziness, nausea, reduced blood oxygen transport.",
    longTermHealthProblems: "Cardiovascular strain and neurological stress.",
  },
  {
    key: "nox",
    label: "Nitrogen Oxides (NOx)",
    source: "High-temperature combustion in engines.",
    environmentalImpact: "Forms smog, acid rain, and secondary PM.",
    shortTermHealthEffects: "Airway irritation, wheezing, inflammation.",
    longTermHealthProblems: "Asthma progression, chronic lung damage.",
  },
  {
    key: "so2",
    label: "Sulfur Dioxide (SO₂)",
    source: "Sulfur in diesel and other sulfur-containing fuels.",
    environmentalImpact: "Acid rain and aerosol formation.",
    shortTermHealthEffects: "Throat irritation, coughing, breathlessness.",
    longTermHealthProblems: "Persistent respiratory disease aggravation.",
  },
  {
    key: "pm25",
    label: "Particulate Matter (PM2.5)",
    source: "Exhaust soot plus brake/tire wear and secondary particles.",
    environmentalImpact: "Regional haze and ecosystem deposition.",
    shortTermHealthEffects: "Chest tightness and acute asthma flare-ups.",
    longTermHealthProblems: "COPD, lung cancer risk, heart disease.",
  },
  {
    key: "pm10",
    label: "Particulate Matter (PM10)",
    source: "Road dust resuspension and mechanical wear.",
    environmentalImpact: "Visibility loss and urban dust loading.",
    shortTermHealthEffects: "Eye, nose, and throat irritation.",
    longTermHealthProblems: "Chronic bronchitis and reduced lung function.",
  },
  {
    key: "hc",
    label: "Hydrocarbons (HC)",
    source: "Unburned fuel escaping combustion.",
    environmentalImpact: "Smog precursor compounds.",
    shortTermHealthEffects: "Headache, mucosal irritation.",
    longTermHealthProblems: "Toxic exposure-related organ stress.",
  },
  {
    key: "vocs",
    label: "Volatile Organic Compounds (VOCs)",
    source: "Fuel evaporation and incomplete combustion.",
    environmentalImpact: "Ozone precursor and photochemical smog driver.",
    shortTermHealthEffects: "Eye irritation and reduced cognitive comfort.",
    longTermHealthProblems: "Liver/kidney stress and cancer risk for some compounds.",
  },
  {
    key: "ch4",
    label: "Methane (CH₄)",
    source: "Unburned hydrocarbon leakage in fuel systems/exhaust.",
    environmentalImpact: "Potent greenhouse gas.",
    shortTermHealthEffects: "Low direct toxicity but oxygen displacement at high levels.",
    longTermHealthProblems: "Climate-linked health impacts via warming and ozone chemistry.",
  },
  {
    key: "ozone",
    label: "Ozone (secondary formation)",
    source: "NOx and VOC reactions in sunlight.",
    environmentalImpact: "Damages crops and worsens urban smog.",
    shortTermHealthEffects: "Coughing, chest pain, and breathing difficulty.",
    longTermHealthProblems: "Declining lung function and chronic respiratory disease.",
  },
];

const VEHICLE_PROFILES: VehicleProfile[] = [
  {
    id: "car",
    label: "City Car",
    icon: "🚗",
    vehicleType: "car",
    fuelType: "petrol",
    aiStrategy: "Adaptive green-wave routing",
    baseEmission: { co2: 14.5, co: 1.3, nox: 0.84, so2: 0.22, pm25: 0.36, pm10: 0.42, hc: 0.66, vocs: 0.62, ch4: 0.26, ozone: 0.74 },
  },
  {
    id: "truck",
    label: "Freight Truck",
    icon: "🚚",
    vehicleType: "truck",
    fuelType: "diesel",
    aiStrategy: "Load-aware speed smoothing",
    baseEmission: { co2: 26.2, co: 2.1, nox: 1.9, so2: 0.74, pm25: 1.24, pm10: 1.32, hc: 0.78, vocs: 0.72, ch4: 0.34, ozone: 1.18 },
  },
  {
    id: "bus",
    label: "City Bus",
    icon: "🚌",
    vehicleType: "bus",
    fuelType: "diesel-hybrid",
    aiStrategy: "Signal-priority transit corridor",
    baseEmission: { co2: 21.8, co: 1.7, nox: 1.45, so2: 0.58, pm25: 0.98, pm10: 1.08, hc: 0.62, vocs: 0.58, ch4: 0.31, ozone: 0.96 },
  },
  {
    id: "bike",
    label: "Motor Bike",
    icon: "🏍️",
    vehicleType: "bike",
    fuelType: "petrol",
    aiStrategy: "Dynamic lane harmonization",
    baseEmission: { co2: 7.8, co: 1.9, nox: 0.44, so2: 0.14, pm25: 0.22, pm10: 0.28, hc: 0.92, vocs: 0.84, ch4: 0.21, ozone: 0.42 },
  },
  {
    id: "scooter",
    label: "Urban Scooter",
    icon: "🛵",
    vehicleType: "scooter",
    fuelType: "petrol",
    aiStrategy: "Platoon spacing assistant",
    baseEmission: { co2: 6.9, co: 1.55, nox: 0.35, so2: 0.11, pm25: 0.19, pm10: 0.24, hc: 0.81, vocs: 0.78, ch4: 0.19, ozone: 0.38 },
  },
  {
    id: "ev",
    label: "Electric Vehicle",
    icon: "⚡",
    vehicleType: "ev",
    fuelType: "electric",
    aiStrategy: "Battery-aware eco-routing",
    baseEmission: { co2: 2.4, co: 0.18, nox: 0.08, so2: 0.04, pm25: 0.14, pm10: 0.19, hc: 0.06, vocs: 0.05, ch4: 0.03, ozone: 0.1 },
  },
];

const HEALTH_SYSTEMS = [
  { name: "Lungs", impact: "Airway inflammation, reduced lung capacity, chronic irritation" },
  { name: "Heart", impact: "Higher blood pressure, plaque instability, cardiac stress" },
  { name: "Brain", impact: "Neuroinflammation, reduced oxygen delivery, cognitive strain" },
  { name: "Overall", impact: "Immune stress, fatigue, and quality-of-life decline" },
];

const DISEASES = ["Asthma", "Lung cancer", "COPD", "Cardiovascular diseases"];

const GAS_ORDER = GAS_DETAILS.map((gas) => gas.key);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function emptyGasRecord(): Record<GasKey, number> {
  return {
    co2: 0,
    co: 0,
    nox: 0,
    so2: 0,
    pm25: 0,
    pm10: 0,
    hc: 0,
    vocs: 0,
    ch4: 0,
    ozone: 0,
  };
}

function riskFromAqi(aqi: number) {
  if (aqi >= 180) return "critical";
  if (aqi >= 130) return "high";
  if (aqi >= 90) return "moderate";
  return "low";
}

export default function EmissionsIntelligencePanel() {
  const [scenario, setScenario] = useState<Scenario>("urban-peak");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [selectedGas, setSelectedGas] = useState<GasKey>("co2");
  const [selectedVehicle, setSelectedVehicle] = useState<string>("all");
  const [history, setHistory] = useState<EmissionTick[]>([]);
  const tickRef = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      tickRef.current += 1;
      const t = tickRef.current;
      const scenarioDensityBase = scenario === "urban-peak" ? 82 : scenario === "incident" ? 94 : 52;
      const trafficDensity = clamp(scenarioDensityBase + Math.sin(t / 3.3) * 10 + Math.cos(t / 4.7) * 5, 20, 100);
      const congestionMultiplier = 0.65 + trafficDensity / 100;
      const beforeByGas = emptyGasRecord();
      const afterByGas = emptyGasRecord();

      const vehicleTicks = VEHICLE_PROFILES.map((vehicle, index) => {
        const flowWobble = 1 + Math.sin((t + index * 3) / 4.5) * 0.12;
        const aiReductionPercent = clamp(
          8 + index * 2.2 + (scenario === "incident" ? 6 : scenario === "urban-peak" ? 4 : 2) + Math.sin((t + index) / 6.2) * 3,
          10,
          36,
        );

        const beforeGas = emptyGasRecord();
        const afterGas = emptyGasRecord();

        GAS_ORDER.forEach((gas) => {
          const beforeValue = vehicle.baseEmission[gas] * congestionMultiplier * flowWobble;
          const afterValue = beforeValue * (1 - aiReductionPercent / 100);
          beforeGas[gas] = beforeValue;
          afterGas[gas] = afterValue;
          beforeByGas[gas] += beforeValue;
          afterByGas[gas] += afterValue;
        });

        const beforeTotal = GAS_ORDER.reduce((sum, gas) => sum + beforeGas[gas], 0);
        const afterTotal = GAS_ORDER.reduce((sum, gas) => sum + afterGas[gas], 0);

        return {
          id: vehicle.id,
          label: vehicle.label,
          icon: vehicle.icon,
          vehicleType: vehicle.vehicleType,
          fuelType: vehicle.fuelType,
          aiStrategy: vehicle.aiStrategy,
          aiReductionPercent,
          beforeTotal,
          afterTotal,
          beforeByGas: beforeGas,
          afterByGas: afterGas,
        };
      });

      const aqi = clamp(
        40 + afterByGas.pm25 * 14 + afterByGas.pm10 * 8 + afterByGas.nox * 6 + afterByGas.ozone * 5,
        35,
        280,
      );

      const nextTick: EmissionTick = {
        timeLabel: new Date().toLocaleTimeString([], { hour12: false }),
        trafficDensity,
        aqi,
        beforeByGas,
        afterByGas,
        vehicleTicks,
      };

      setHistory((prev) => [...prev.slice(-34), nextTick]);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [scenario]);

  const latest = history[history.length - 1] ?? {
    timeLabel: "--:--:--",
    trafficDensity: 0,
    aqi: 0,
    beforeByGas: emptyGasRecord(),
    afterByGas: emptyGasRecord(),
    vehicleTicks: VEHICLE_PROFILES.map((v) => ({
      id: v.id,
      label: v.label,
      icon: v.icon,
      vehicleType: v.vehicleType,
      fuelType: v.fuelType,
      aiStrategy: v.aiStrategy,
      aiReductionPercent: 0,
      beforeTotal: 0,
      afterTotal: 0,
      beforeByGas: emptyGasRecord(),
      afterByGas: emptyGasRecord(),
    })),
  };

  const gasReduction = useMemo(() => {
    return GAS_DETAILS.map((gas) => {
      const before = latest.beforeByGas[gas.key];
      const after = latest.afterByGas[gas.key];
      const reductionPercent = before > 0 ? ((before - after) / before) * 100 : 0;
      return { ...gas, before, after, reductionPercent };
    });
  }, [latest.afterByGas, latest.beforeByGas]);

  const filteredVehicles = selectedVehicle === "all"
    ? latest.vehicleTicks
    : latest.vehicleTicks.filter((vehicle) => vehicle.id === selectedVehicle);

  const totalBefore = filteredVehicles.reduce((sum, vehicle) => sum + vehicle.beforeTotal, 0);
  const totalAfter = filteredVehicles.reduce((sum, vehicle) => sum + vehicle.afterTotal, 0);
  const totalReduction = totalBefore > 0 ? ((totalBefore - totalAfter) / totalBefore) * 100 : 0;
  const riskLevel = riskFromAqi(latest.aqi);

  const graphBars = history.slice(-18);
  const graphMax = Math.max(1, ...graphBars.map((point) => Math.max(point.beforeByGas[selectedGas], point.afterByGas[selectedGas])));
  const pointPairs = history.slice(-16).map((point) => ({
    density: point.trafficDensity,
    pollution: point.afterByGas.pm25 * 18 + point.afterByGas.nox * 8 + point.afterByGas.ozone * 7,
  }));
  const pollutionMax = Math.max(1, ...pointPairs.map((point) => point.pollution));

  const panelClass =
    themeMode === "dark"
      ? "border-zinc-800 bg-zinc-950 text-zinc-100"
      : "border-zinc-200 bg-white text-zinc-900";

  const secondaryClass = themeMode === "dark" ? "border-zinc-800 bg-black/30" : "border-zinc-200 bg-zinc-50";
  const mutedText = themeMode === "dark" ? "text-zinc-400" : "text-zinc-600";

  return (
    <section className={`mt-6 rounded-2xl border p-5 ${panelClass}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-xs uppercase tracking-[0.16em] ${mutedText}`}>Real-time Monitoring Dashboard</p>
          <h2 className="text-2xl font-semibold">Traffic Emissions Intelligence Suite</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-md border px-2 py-1 text-xs ${secondaryClass}`}>🧾 Google Profile</span>
          <button
            type="button"
            className={`rounded-md border px-3 py-1 text-xs ${secondaryClass}`}
            onClick={() => setThemeMode((mode) => (mode === "dark" ? "light" : "dark"))}
          >
            {themeMode === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-4">
        <label className="text-xs">
          <span className={`${mutedText}`}>Traffic condition</span>
          <select className={`mt-1 w-full rounded-md border px-2 py-1 ${secondaryClass}`} value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)}>
            <option value="urban-peak">Urban peak</option>
            <option value="free-flow">Free flow</option>
            <option value="incident">Incident congestion</option>
          </select>
        </label>
        <label className="text-xs">
          <span className={`${mutedText}`}>Gas filter</span>
          <select className={`mt-1 w-full rounded-md border px-2 py-1 ${secondaryClass}`} value={selectedGas} onChange={(event) => setSelectedGas(event.target.value as GasKey)}>
            {GAS_DETAILS.map((gas) => (
              <option key={gas.key} value={gas.key}>{gas.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className={`${mutedText}`}>Vehicle filter</span>
          <select className={`mt-1 w-full rounded-md border px-2 py-1 ${secondaryClass}`} value={selectedVehicle} onChange={(event) => setSelectedVehicle(event.target.value)}>
            <option value="all">All vehicles</option>
            {VEHICLE_PROFILES.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>
            ))}
          </select>
        </label>
        <div className={`rounded-xl border p-3 ${secondaryClass}`}>
          <p className="text-xs uppercase tracking-[0.12em]">Live AQI</p>
          <p className={`text-xl font-bold ${riskLevel === "critical" ? "text-red-400" : riskLevel === "high" ? "text-yellow-300" : riskLevel === "moderate" ? "text-cyan-300" : "text-emerald-300"}`}>
            {latest.aqi.toFixed(0)}
          </p>
          <p className={`text-xs ${mutedText}`}>Density {latest.trafficDensity.toFixed(0)}% · Updated {latest.timeLabel}</p>
        </div>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <article className={`rounded-xl border p-3 xl:col-span-2 ${secondaryClass}`}>
          <p className="text-xs uppercase tracking-[0.12em]">📉 Emissions vs Time ({selectedGas.toUpperCase()})</p>
          <div className="mt-3 flex h-44 items-end gap-1">
            {graphBars.map((point, idx) => (
              <div key={`${point.timeLabel}-${idx}`} className="flex flex-1 items-end gap-0.5" title={`${point.timeLabel} · Before ${point.beforeByGas[selectedGas].toFixed(2)} · After ${point.afterByGas[selectedGas].toFixed(2)}`}>
                <span className="w-1/2 rounded-t bg-red-400/70" style={{ height: `${(point.beforeByGas[selectedGas] / graphMax) * 100}%` }} />
                <span className="w-1/2 rounded-t bg-emerald-400/70" style={{ height: `${(point.afterByGas[selectedGas] / graphMax) * 100}%` }} />
              </div>
            ))}
          </div>
          <p className={`mt-2 text-xs ${mutedText}`}>Interactive hover enabled. Red = before system, Green = AI/V2X optimized.</p>
        </article>

        <article className={`rounded-xl border p-3 ${secondaryClass}`}>
          <p className="text-xs uppercase tracking-[0.12em]">📊 Traffic density vs pollution</p>
          <svg viewBox="0 0 100 100" className="mt-3 h-44 w-full rounded-lg border border-zinc-700/40 bg-black/20">
            {pointPairs.map((point, idx) => {
              const x = point.density;
              const y = 100 - (point.pollution / pollutionMax) * 100;
              return (
                <circle key={`${x}-${y}-${idx}`} cx={x} cy={y} r="2.3" fill="rgb(34 197 94)" opacity="0.8">
                  <title>{`Density ${point.density.toFixed(0)}% · Pollution ${point.pollution.toFixed(1)}`}</title>
                </circle>
              );
            })}
          </svg>
          <p className={`mt-2 text-xs ${mutedText}`}>Higher density clusters produce higher pollutant concentration.</p>
        </article>
      </div>

      <article className={`mb-4 rounded-xl border p-3 ${secondaryClass}`}>
        <p className="text-xs uppercase tracking-[0.12em]">🚗 Vehicle-wise emissions + independent AI</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredVehicles.map((vehicle, index) => (
            <div key={vehicle.id} className={`rounded-lg border p-3 ${secondaryClass}`}>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{vehicle.icon} {vehicle.label}</p>
                <span className="text-xs text-emerald-300">-{vehicle.aiReductionPercent.toFixed(1)}%</span>
              </div>
              <p className={`text-xs ${mutedText}`}>{vehicle.vehicleType} · {vehicle.fuelType} · {vehicle.aiStrategy}</p>
              <div className="mt-2 h-1.5 rounded-full bg-zinc-800/50">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${Math.max(5, vehicle.aiReductionPercent * 2.4)}%` }} />
              </div>
              <p className="mt-2 text-xs">Before {vehicle.beforeTotal.toFixed(1)} → After {vehicle.afterTotal.toFixed(1)} mg/min</p>
              <p className="text-xs">{selectedGas.toUpperCase()}: {vehicle.beforeByGas[selectedGas].toFixed(2)} → {vehicle.afterByGas[selectedGas].toFixed(2)}</p>
              <div className="relative mt-2 h-8 overflow-hidden rounded bg-black/30">
                <span className="absolute top-1 text-lg" style={{ left: `${((tickRef.current * 6 + index * 14) % 80)}%` }}>{vehicle.icon}</span>
                <span className="absolute right-1 top-1 text-[10px] text-zinc-400">3D lane sim</span>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className={`mb-4 rounded-xl border p-3 ${secondaryClass}`}>
        <p className="text-xs uppercase tracking-[0.12em]">🌫️ Gas concentration comparison (Before vs After)</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {gasReduction.map((gas) => (
            <div key={gas.key} className="rounded-lg border border-zinc-700/40 p-2 text-xs">
              <p className="font-medium">{gas.label}</p>
              <p className={`${mutedText}`}>Before {gas.before.toFixed(2)} · After {gas.after.toFixed(2)} · Reduction {gas.reductionPercent.toFixed(1)}%</p>
              <div className="mt-1 flex h-2 overflow-hidden rounded bg-zinc-800/50" title={`${gas.label} reduction ${gas.reductionPercent.toFixed(1)}%`}>
                <span className="h-full bg-red-400/70" style={{ width: `${Math.min(100, (gas.after / Math.max(gas.before, 0.001)) * 100)}%` }} />
                <span className="h-full bg-emerald-400/70" style={{ width: `${Math.min(100, gas.reductionPercent)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </article>

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <article className={`rounded-xl border p-3 ${secondaryClass}`}>
          <p className="text-xs uppercase tracking-[0.12em]">🧠 Health impact analysis</p>
          <div className="mt-2 space-y-2 text-sm">
            {HEALTH_SYSTEMS.map((system) => (
              <div key={system.name} className="rounded-md border border-zinc-700/40 p-2">
                <p className="font-medium">{system.name}</p>
                <p className={`text-xs ${mutedText}`}>{system.impact}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {DISEASES.map((disease) => (
              <div key={disease} className="rounded-md border border-zinc-700/40 px-2 py-1">• {disease}</div>
            ))}
          </div>
          <p className={`mt-2 text-xs ${mutedText}`}>Long-term exposure risk indicator: {riskLevel.toUpperCase()} ({latest.aqi.toFixed(0)} AQI)</p>
        </article>

        <article className={`rounded-xl border p-3 ${secondaryClass}`}>
          <p className="text-xs uppercase tracking-[0.12em]">📉 Emission reduction system impact</p>
          <div className="mt-2 space-y-2 text-xs">
            <p>• Smart traffic routing reduces stop-go emissions and reroutes around high-density corridors.</p>
            <p>• Emergency vehicle prioritization lowers intersection waiting and queue spillback.</p>
            <p>• Reduced idle time from predictive green-wave signaling.</p>
            <p>• Optimized AI/V2X flow coordination improves throughput and lowers pollutant spikes.</p>
          </div>
          <div className="mt-3 rounded-md border border-zinc-700/40 p-2 text-xs">
            <p className="font-medium">Before vs After (filtered set)</p>
            <p>Before: {totalBefore.toFixed(1)} mg/min</p>
            <p>After: {totalAfter.toFixed(1)} mg/min</p>
            <p className="text-emerald-300">Estimated reduction: {totalReduction.toFixed(1)}%</p>
          </div>
          <p className={`mt-2 text-xs ${mutedText}`}>AI pollution trend predictor: next window likely {latest.trafficDensity > 75 ? "high" : "moderate"} emission load.</p>
        </article>
      </div>

      <article className={`mb-4 rounded-xl border p-3 ${secondaryClass}`}>
        <p className="text-xs uppercase tracking-[0.12em]">🌍 Gas knowledge base (source, environmental + health impact)</p>
        <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
          {GAS_DETAILS.map((gas) => (
            <details key={gas.key} className="rounded-md border border-zinc-700/40 p-2 text-xs" open={gas.key === selectedGas}>
              <summary className="cursor-pointer font-medium">{gas.label}</summary>
              <p className="mt-1"><span className="font-semibold">Source:</span> {gas.source}</p>
              <p className="mt-1"><span className="font-semibold">Environmental impact:</span> {gas.environmentalImpact}</p>
              <p className="mt-1"><span className="font-semibold">Short-term effects:</span> {gas.shortTermHealthEffects}</p>
              <p className="mt-1"><span className="font-semibold">Long-term problems:</span> {gas.longTermHealthProblems}</p>
            </details>
          ))}
        </div>
      </article>

      <article className={`rounded-xl border p-3 ${secondaryClass}`}>
        <p className="text-xs uppercase tracking-[0.12em]">🛰️ Live pollution tracking + heatmap alerts</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 16 }).map((_, index) => {
              const row = Math.floor(index / 4);
              const col = index % 4;
              const zoneLoad = clamp(latest.trafficDensity + row * 6 + col * 4 + Math.sin((tickRef.current + index) / 2) * 9, 0, 100);
              return (
                <div
                  key={`zone-${index}`}
                  className="h-10 rounded"
                  style={{ background: `rgba(239,68,68,${zoneLoad / 120})` }}
                  title={`Zone ${index + 1} load ${zoneLoad.toFixed(0)}%`}
                />
              );
            })}
          </div>
          <div className="space-y-1 text-xs">
            <p>⚠️ Alert threshold: AQI {'>'} 150</p>
            <p>{latest.aqi > 150 ? "Danger zone alerts active" : "Air quality within managed range"}</p>
            <p>Map integration mode: simulated IoT + V2X feed</p>
            <p>Assistant hint: Ask chatbot for gas-wise recommendations.</p>
          </div>
        </div>
      </article>
    </section>
  );
}
