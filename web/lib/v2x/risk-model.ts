import type { RealtimeSnapshot } from "@/lib/v2x/types";

export type AiRiskLevel = "low" | "medium" | "high" | "critical";

export type AiRiskNodeInput = {
  id: string;
  label: string;
  distanceMeters: number;
  approaching: boolean;
};

export type AiVehicleInsight = {
  score: number;
  level: AiRiskLevel;
  confidence: number;
  etaSeconds: number | null;
  recommendation: string;
  reasons: string[];
};

export type AiInsights = {
  overall: AiVehicleInsight;
  perVehicle: Record<string, AiVehicleInsight>;
  summary: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function levelFromScore(score: number): AiRiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function recommendationFromLevel(level: AiRiskLevel, approaching: boolean): string {
  if (level === "critical") return "Immediate yield and controlled deceleration required.";
  if (level === "high") return "Prepare to yield now and clear the lane edge.";
  if (level === "medium") return approaching ? "Stay alert and plan lane clearance." : "Continue with caution.";
  return "Maintain normal driving with periodic checks.";
}

function reasonsForNode(distanceMeters: number, approaching: boolean, accuracyMeters: number): string[] {
  // These strings are shown in the UI as explainability hints for each AI recommendation.
  return [
    `Distance ${distanceMeters.toFixed(1)}m`,
    approaching ? "EV approach vector confirmed" : "EV moving away or lateral",
    `GPS uncertainty ±${accuracyMeters.toFixed(1)}m`,
  ];
}

function scoreNode(
  distanceMeters: number,
  approaching: boolean,
  evSpeed: number,
  accuracyMeters: number,
  degradedConnection: boolean,
): number {
  const distanceFactor = clamp(1 - distanceMeters / 120, 0, 1);
  const approachFactor = approaching ? 1 : 0.15;
  const speedFactor = clamp(evSpeed / 24, 0, 1);
  const accuracyPenalty = clamp((accuracyMeters - 3) / 22, 0, 1) * 12;
  const networkPenalty = degradedConnection ? 6 : 0;

  const base = distanceFactor * 58 + approachFactor * 24 + speedFactor * 18;
  return clamp(base + accuracyPenalty + networkPenalty, 0, 100);
}

function estimateEtaSeconds(distanceMeters: number, speedMetersPerSecond: number): number | null {
  if (speedMetersPerSecond <= 0.4) return null;
  return Math.round(distanceMeters / speedMetersPerSecond);
}

export function generateV2XAiInsights(
  snapshot: RealtimeSnapshot,
  nodes: AiRiskNodeInput[],
  signalDistanceMeters: number,
): AiInsights {
  const ev = snapshot.vehicles.emergency;
  const degradedConnection = ev.connectionStatus !== "connected";

  const perVehicle = nodes.reduce<Record<string, AiVehicleInsight>>((acc, node) => {
    const score = scoreNode(node.distanceMeters, node.approaching, ev.speed, ev.accuracy, degradedConnection);
    const level = levelFromScore(score);
    acc[node.id] = {
      score,
      level,
      confidence: clamp(100 - ev.accuracy * 2.5 - (degradedConnection ? 16 : 0), 40, 98),
      etaSeconds: estimateEtaSeconds(node.distanceMeters, ev.speed),
      recommendation: recommendationFromLevel(level, node.approaching),
      reasons: reasonsForNode(node.distanceMeters, node.approaching, ev.accuracy),
    };
    return acc;
  }, {});

  const vehicleInsights = Object.values(perVehicle);
  const maxVehicleScore = vehicleInsights.length > 0 ? Math.max(...vehicleInsights.map((entry) => entry.score)) : 0;
  const signalFactor = clamp(1 - signalDistanceMeters / 140, 0, 1) * 20;
  const overallScore = clamp(maxVehicleScore * 0.86 + signalFactor, 0, 100);
  const overallLevel = levelFromScore(overallScore);

  return {
    overall: {
      score: overallScore,
      level: overallLevel,
      confidence: clamp(100 - ev.accuracy * 2.2 - (degradedConnection ? 12 : 0), 45, 99),
      etaSeconds: estimateEtaSeconds(signalDistanceMeters, ev.speed),
      recommendation:
        overallLevel === "critical"
          ? "Activate corridor protection and broadcast highest-priority alerts."
          : overallLevel === "high"
            ? "Enable early lane guidance and keep signal override pre-armed."
            : overallLevel === "medium"
              ? "Maintain active monitoring with predictive checks."
              : "Normal operations with AI watch mode.",
      reasons: [
        `Signal distance ${signalDistanceMeters.toFixed(1)}m`,
        `Current EV speed ${ev.speed.toFixed(1)}m/s`,
        degradedConnection ? "Network degraded fallback active" : "Network link healthy",
      ],
    },
    perVehicle,
    summary:
      overallLevel === "critical"
        ? "High collision probability window detected."
        : overallLevel === "high"
          ? "Elevated risk window detected."
          : overallLevel === "medium"
            ? "Moderate approach risk under watch."
            : "Low immediate risk.",
  };
}
