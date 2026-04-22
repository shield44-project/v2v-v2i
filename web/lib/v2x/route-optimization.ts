/**
 * Route Optimization Engine
 * Calculates optimal routes considering multiple objectives:
 * - Distance & time
 * - Emissions
 * - Traffic/congestion
 * - Safety (accident hotspots)
 * - EV requirements (person pickup, hospital drop)
 */

import { VehicleEmissionProfile } from './emissions';

export type RouteObjective = 'fastest' | 'shortest' | 'eco-friendly' | 'balanced' | 'safest';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  name?: string;
}

export interface RouteSegment {
  startPoint: GeoPoint;
  endPoint: GeoPoint;
  distance: number; // km
  estimatedTime: number; // seconds
  avgSpeed: number; // km/h
  roadType: 'highway' | 'arterial' | 'local' | 'residential';
  trafficDensity: number; // 0-1
  pollutionLevel: number; // 0-500 (AQI)
  accidentRisk: number; // 0-1
  emissions: number; // grams CO2
}

export interface Route {
  id: string;
  startPoint: GeoPoint;
  endPoint: GeoPoint;
  waypoints?: GeoPoint[]; // Intermediate stops (person pickup, hospital)
  segments: RouteSegment[];
  totalDistance: number; // km
  estimatedTime: number; // seconds
  totalEmissions: number; // grams CO2
  emissionsSaved?: number; // compared to baseline
  objective: RouteObjective;
  score: number; // 0-100 overall quality score
  environmentalImpact: {
    co2Grams: number;
    treesNeeded: number;
    comparableTo: string; // e.g., "equivalent to driving 50km in average car"
  };
  trafficStatus: 'clear' | 'moderate' | 'congested' | 'severe';
  isOptimal: boolean;
  generatedAt: string;
}

export interface RouteComparison {
  routes: Route[];
  fastestRoute: Route;
  shortestRoute: Route;
  ecoFriendliestRoute: Route;
  recommendedRoute: Route;
}

/**
 * Mock road network data
 * In production, integrate with actual map APIs (Google Maps, OpenStreetMap)
 */
const MOCK_ROUTES: Record<string, RouteSegment[]> = {
  'start-to-hospital': [
    {
      startPoint: { latitude: 28.7041, longitude: 77.1025, name: 'Start' },
      endPoint: { latitude: 28.708, longitude: 77.11, name: 'Hospital' },
      distance: 1.2,
      estimatedTime: 300,
      avgSpeed: 14.4,
      roadType: 'arterial',
      trafficDensity: 0.6,
      pollutionLevel: 120,
      accidentRisk: 0.1,
      emissions: 245,
    },
  ],
  'start-to-pickup': [
    {
      startPoint: { latitude: 28.7041, longitude: 77.1025, name: 'Start' },
      endPoint: { latitude: 28.702, longitude: 77.108, name: 'Pickup' },
      distance: 0.8,
      estimatedTime: 240,
      avgSpeed: 12,
      roadType: 'local',
      trafficDensity: 0.4,
      pollutionLevel: 95,
      accidentRisk: 0.05,
      emissions: 165,
    },
  ],
  'pickup-to-hospital': [
    {
      startPoint: { latitude: 28.702, longitude: 77.108, name: 'Pickup' },
      endPoint: { latitude: 28.708, longitude: 77.11, name: 'Hospital' },
      distance: 0.9,
      estimatedTime: 270,
      avgSpeed: 12,
      roadType: 'arterial',
      trafficDensity: 0.7,
      pollutionLevel: 140,
      accidentRisk: 0.15,
      emissions: 186,
    },
  ],
};

/**
 * Calculate great-circle distance between two points
 */
function haversineDistance(from: GeoPoint, to: GeoPoint): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generate route segments (simplified mock)
 */
function generateRouteSegments(
  from: GeoPoint,
  to: GeoPoint,
  trafficFactor: number = 1.0,
  pollutionFactor: number = 1.0
): RouteSegment[] {
  const baseKey = `${from.name || 'start'}-to-${to.name || 'end'}`;
  const mockRoute = MOCK_ROUTES[baseKey];

  if (mockRoute) {
    return mockRoute.map((seg) => ({
      ...seg,
      trafficDensity: Math.min(1, seg.trafficDensity * trafficFactor),
      pollutionLevel: seg.pollutionLevel * pollutionFactor,
      emissions: seg.emissions * trafficFactor,
    }));
  }

  // Fallback: create simple point-to-point route
  const distance = haversineDistance(from, to);
  const avgSpeed = 25; // km/h default
  const estimatedTime = (distance / avgSpeed) * 3600; // seconds

  return [
    {
      startPoint: from,
      endPoint: to,
      distance,
      estimatedTime,
      avgSpeed,
      roadType: 'arterial',
      trafficDensity: trafficFactor * 0.5,
      pollutionLevel: pollutionFactor * 100,
      accidentRisk: 0.1,
      emissions: distance * 200 * trafficFactor, // rough estimate
    },
  ];
}

/**
 * Calculate optimal route score for given objective
 */
function calculateRouteScore(
  route: Route,
  objective: RouteObjective,
  emissions: number
): number {
  let score = 100; // Start with perfect score

  // Time penalty
  const avgTimePerKm = route.estimatedTime / route.totalDistance / 60; // minutes per km
  const timeDeviation = Math.abs(avgTimePerKm - 3) / 3; // 3 min/km is target
  score -= Math.min(20, timeDeviation * 20);

  // Distance penalty
  score -= (route.totalDistance / 10) * 2; // max 20 points

  // Emission penalty
  const emissionPerKm = emissions / route.totalDistance;
  score -= Math.min(20, (emissionPerKm / 300) * 20); // 300g per km is "baseline"

  // Pollution penalty
  const avgPollution = route.segments.reduce((sum, seg) => sum + seg.pollutionLevel, 0) / route.segments.length;
  score -= Math.min(10, (avgPollution / 200) * 10);

  // Accident risk penalty
  const avgRisk = route.segments.reduce((sum, seg) => sum + seg.accidentRisk, 0) / route.segments.length;
  score -= avgRisk * 15;

  // Apply objective-specific adjustments
  switch (objective) {
    case 'fastest':
      score += 20;
      break;
    case 'shortest':
      score += 15;
      break;
    case 'eco-friendly':
      score += 25;
      break;
    case 'balanced':
      // No bonus
      break;
    case 'safest':
      score += 15 - avgRisk * 10; // More bonus for safer routes
      break;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate optimized route
 */
export function generateOptimizedRoute(
  from: GeoPoint,
  to: GeoPoint,
  objective: RouteObjective = 'balanced',
  options?: {
    waypoints?: GeoPoint[]; // Intermediate stops
    vehicle?: VehicleEmissionProfile;
    trafficDensity?: number; // 0-1
    pollutionFactor?: number; // 0-1
    avoidAccidents?: boolean;
  }
): Route {
  const trafficFactor = options?.trafficDensity || 0.7;
  const pollutionFactor = options?.pollutionFactor || 1.0;

  let allSegments: RouteSegment[] = [];
  let currentPoint = from;

  // Generate segments for all waypoints
  if (options?.waypoints && options.waypoints.length > 0) {
    for (const waypoint of options.waypoints) {
      const segments = generateRouteSegments(currentPoint, waypoint, trafficFactor, pollutionFactor);
      allSegments = allSegments.concat(segments);
      currentPoint = waypoint;
    }
  }

  // Generate final segment to destination
  const finalSegments = generateRouteSegments(currentPoint, to, trafficFactor, pollutionFactor);
  allSegments = allSegments.concat(finalSegments);

  // Calculate route totals
  const totalDistance = allSegments.reduce((sum, seg) => sum + seg.distance, 0);
  const estimatedTime = allSegments.reduce((sum, seg) => sum + seg.estimatedTime, 0);
  const totalEmissions = allSegments.reduce((sum, seg) => sum + seg.emissions, 0);

  // Determine traffic status
  let trafficStatus: Route['trafficStatus'] = 'clear';
  const avgTraffic = allSegments.reduce((sum, seg) => sum + seg.trafficDensity, 0) / allSegments.length;
  if (avgTraffic > 0.8) trafficStatus = 'severe';
  else if (avgTraffic > 0.6) trafficStatus = 'congested';
  else if (avgTraffic > 0.4) trafficStatus = 'moderate';

  const score = calculateRouteScore(
    {
      id: '',
      startPoint: from,
      endPoint: to,
      waypoints: options?.waypoints,
      segments: allSegments,
      totalDistance,
      estimatedTime,
      totalEmissions,
      objective,
      score: 0,
      environmentalImpact: {
        co2Grams: totalEmissions,
        treesNeeded: totalEmissions / 21000 / 365,
        comparableTo: '',
      },
      trafficStatus,
      isOptimal: false,
      generatedAt: new Date().toISOString(),
    },
    objective,
    totalEmissions
  );

  const route: Route = {
    id: `route-${Date.now()}`,
    startPoint: from,
    endPoint: to,
    waypoints: options?.waypoints,
    segments: allSegments,
    totalDistance,
    estimatedTime,
    totalEmissions,
    objective,
    score,
    environmentalImpact: {
      co2Grams: totalEmissions,
      treesNeeded: totalEmissions / 21000 / 365,
      comparableTo: `${(totalEmissions / 1000).toFixed(1)}kg CO2`,
    },
    trafficStatus,
    isOptimal: score > 75,
    generatedAt: new Date().toISOString(),
  };

  return route;
}

/**
 * Compare multiple route options
 */
export function compareRoutes(
  from: GeoPoint,
  to: GeoPoint,
  options?: {
    waypoints?: GeoPoint[];
    vehicle?: VehicleEmissionProfile;
  }
): RouteComparison {
  const objectives: RouteObjective[] = ['fastest', 'shortest', 'eco-friendly', 'balanced'];
  const routes = objectives.map((obj) => generateOptimizedRoute(from, to, obj, options));

  return {
    routes,
    fastestRoute: routes.find((r) => r.objective === 'fastest') || routes[0],
    shortestRoute: routes.find((r) => r.objective === 'shortest') || routes[0],
    ecoFriendliestRoute: routes.find((r) => r.objective === 'eco-friendly') || routes[0],
    recommendedRoute: routes.reduce((best, curr) => (curr.score > best.score ? curr : best)),
  };
}

/**
 * Calculate emission savings for optimized route
 */
export function calculateRoutOptimizationBenefit(
  standardRoute: Route,
  optimizedRoute: Route
): {
  emissionsSaved: number;
  percentReduction: number;
  timeSavings: number;
  distanceSavings: number;
} {
  return {
    emissionsSaved: standardRoute.totalEmissions - optimizedRoute.totalEmissions,
    percentReduction:
      ((standardRoute.totalEmissions - optimizedRoute.totalEmissions) / standardRoute.totalEmissions) *
      100,
    timeSavings: (standardRoute.estimatedTime - optimizedRoute.estimatedTime) / 60,
    distanceSavings: standardRoute.totalDistance - optimizedRoute.totalDistance,
  };
}

/**
 * Generate voice guidance for route
 */
export function generateRouteGuidance(route: Route): string[] {
  const guidance: string[] = [];

  guidance.push(
    `Starting route: ${route.startPoint.name || 'Start'} to ${route.endPoint.name || 'Destination'}`
  );
  guidance.push(`Total distance: ${route.totalDistance.toFixed(1)} kilometers`);
  guidance.push(`Estimated time: ${Math.ceil(route.estimatedTime / 60)} minutes`);
  guidance.push(`Objective: ${route.objective} route`);

  if (route.objective === 'eco-friendly') {
    guidance.push(
      `This eco-friendly route saves ${route.emissionsSaved?.toFixed(0) || 0} grams of CO2`
    );
    guidance.push(`Equivalent to planting ${route.environmentalImpact.treesNeeded.toFixed(1)} trees`);
  }

  guidance.push(`Traffic condition: ${route.trafficStatus}`);

  return guidance;
}

/**
 * Format route for display
 */
export function formatRouteForDisplay(route: Route): {
  title: string;
  details: string[];
  stats: Record<string, string>;
} {
  return {
    title: `${route.objective.charAt(0).toUpperCase() + route.objective.slice(1)} Route`,
    details: generateRouteGuidance(route),
    stats: {
      Distance: `${route.totalDistance.toFixed(1)} km`,
      Time: `${Math.ceil(route.estimatedTime / 60)} min`,
      Emissions: `${(route.totalEmissions / 1000).toFixed(2)} kg CO2`,
      Traffic: route.trafficStatus,
      Quality: `${route.score.toFixed(0)}/100`,
    },
  };
}
