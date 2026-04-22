/**
 * Smart Traffic Mode System
 * Dynamically switches between normal and emergency modes based on EV presence and traffic volume
 */

export type TrafficMode = 'normal' | 'emergency' | 'eco' | 'congestion';

export interface TrafficModeConfig {
  currentMode: TrafficMode;
  evPresent: boolean;
  trafficVolume: number; // vehicles per minute
  averageSpeed: number; // km/h
  lastSwitchTime: string;
  switchReason: string;
}

export interface SignalTiming {
  north: number; // seconds
  south: number;
  east: number;
  west: number;
  cycleTime: number; // total cycle length
}

export interface SmartTrafficState {
  mode: TrafficMode;
  signals: {
    north: 'green' | 'yellow' | 'red';
    south: 'green' | 'yellow' | 'red';
    east: 'green' | 'yellow' | 'red';
    west:  'green' | 'yellow' | 'red';
  };
  timings: SignalTiming;
  evRoute?: string; // Which direction the EV is heading
  trafficMetrics: {
    averageWaitTime: number; // seconds
    throughput: number; // vehicles per minute
    congestionLevel: number; // 0-1
  };
}

/**
 * Determine optimal traffic mode based on conditions
 */
export function determineTrafficMode(
  trafficVolume: number,
  evPresent: boolean,
  averageSpeed: number,
  currentMode: TrafficMode
): { mode: TrafficMode; reason: string } {
  // Emergency mode takes priority
  if (evPresent) {
    return {
      mode: 'emergency',
      reason: 'Emergency vehicle (EV) detected in vicinity',
    };
  }

  // Congestion mode: high traffic volume, low speed
  if (trafficVolume > 80 && averageSpeed < 15) {
    return {
      mode: 'congestion',
      reason: 'High traffic volume with low average speed',
    };
  }

  // Eco mode: low traffic, optimize for emissions
  if (trafficVolume < 30 && averageSpeed > 30) {
    return {
      mode: 'eco',
      reason: 'Light traffic conditions - eco mode active',
    };
  }

  // Normal mode: standard conditions
  return {
    mode: 'normal',
    reason: 'Normal traffic conditions',
  };
}

/**
 * Calculate optimal signal timings based on traffic mode
 */
export function calculateSignalTimings(
  mode: TrafficMode,
  trafficDistribution: { north: number; south: number; east: number; west: number },
  evRoute?: string
): SignalTiming {
  let baseGreenTime = 30; // seconds

  switch (mode) {
    case 'emergency':
      // Maximize green time for EV direction
      if (evRoute === 'north' || evRoute === 'south') {
        return {
          north: 60,
          south: 60,
          east: 5,
          west: 5,
          cycleTime: 140,
        };
      } else {
        return {
          north: 5,
          south: 5,
          east: 60,
          west: 60,
          cycleTime: 140,
        };
      }

    case 'congestion':
      // Longer cycles to better handle volume
      baseGreenTime = 45;
      break;

    case 'eco':
      // Shorter cycles, prioritize flow
      baseGreenTime = 20;
      break;

    case 'normal':
    default:
      baseGreenTime = 30;
      break;
  }

  // Adjust timings based on traffic distribution
  const totalTraffic =
    trafficDistribution.north +
    trafficDistribution.south +
    trafficDistribution.east +
    trafficDistribution.west;

  const northTime = (trafficDistribution.north / Math.max(1, totalTraffic)) * baseGreenTime;
  const eastTime = (trafficDistribution.east / Math.max(1, totalTraffic)) * baseGreenTime;

  return {
    north: Math.max(5, Math.round(northTime)),
    south: Math.max(5, Math.round(northTime)),
    east: Math.max(5, Math.round(eastTime)),
    west: Math.max(5, Math.round(eastTime)),
    cycleTime:
      Math.round(northTime) * 2 + Math.round(eastTime) * 2 + 20, // +20 for yellow lights
  };
}

/**
 * Generate smart traffic state
 */
export function generateSmartTrafficState(
  config: TrafficModeConfig,
  trafficDistribution: { north: number; south: number; east: number; west: number },
  trafficFlow: { north: number; south: number; east: number; west: number } // vehicles/min
): SmartTrafficState {
  const timings = calculateSignalTimings(config.currentMode, trafficDistribution, config.evRoute);

  // Calculate signal states based on mode
  let signals = {
    north: 'red' as const,
    south: 'red' as const,
    east: 'red' as const,
    west: 'red' as const,
  };

  if (config.currentMode === 'emergency' && config.evRoute) {
    const evDirNum = config.evRoute.charCodeAt(0);
    if (config.evRoute === 'north' || config.evRoute === 'south') {
      signals.north = 'green';
      signals.south = 'green';
      signals.east = 'red';
      signals.west = 'red';
    } else {
      signals.north = 'red';
      signals.south = 'red';
      signals.east = 'green';
      signals.west = 'green';
    }
  } else {
    // Alternate based on cycle
    signals.north = 'green';
    signals.east = 'red';
  }

  // Calculate metrics
  const totalTraffic =
    trafficFlow.north + trafficFlow.south + trafficFlow.east + trafficFlow.west;
  const maxCapacity = 120; // vehicles/min max capacity
  const throughput = Math.min(totalTraffic, maxCapacity);
  const congestionLevel = totalTraffic / maxCapacity;

  // Estimate wait time (simple model)
  const avgWaitTime = config.currentMode === 'emergency' ? 5 : (timings.cycleTime / 2) * (congestionLevel || 0.5);

  return {
    mode: config.currentMode,
    signals,
    timings,
    evRoute: config.evRoute,
    trafficMetrics: {
      averageWaitTime: Math.round(avgWaitTime),
      throughput: Math.round(throughput),
      congestionLevel: Math.min(1, congestionLevel),
    },
  };
}

/**
 * Predict EV arrival and pre-emptively switch to emergency mode
 */
export function predictEVArrivalAndPrepare(
  evPosition: { latitude: number; longitude: number },
  signalPosition: { latitude: number; longitude: number },
  evSpeed: number = 60 // km/h
): {
  eta: number; // seconds
  shouldSwitch: boolean;
  preparationTime: number; // seconds before EV arrives
} {
  // Calculate distance using Haversine formula
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(signalPosition.latitude - evPosition.latitude);
  const dLon = toRad(signalPosition.longitude - evPosition.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(evPosition.latitude)) *
      Math.cos(toRad(signalPosition.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Calculate ETA
  const eta = (distance / evSpeed) * 3600; // convert to seconds

  // Switch to emergency mode 1-2 minutes before EV arrives
  const preparationTime = 90; // 90 seconds
  const shouldSwitch = eta <= preparationTime && eta > 0;

  return {
    eta: Math.round(eta),
    shouldSwitch,
    preparationTime,
  };
}

/**
 * Estimate emission savings from smart traffic mode
 */
export function estimateEmissionSavings(
  normalModeState: SmartTrafficState,
  optimizedModeState: SmartTrafficState
): {
  emissionsSaved: number; // grams CO2
  timeSaved: number; // seconds
  fuelSaved: number; // liters
  vehiclesBenefited: number;
} {
  // Rough estimates
  const normalEmissions = normalModeState.trafficMetrics.averageWaitTime * 2.5; // grams per second waiting
  const optimizedEmissions =optimizedModeState.trafficMetrics.averageWaitTime * 2.5;
  const emissionsSaved = Math.max(0, normalEmissions - optimizedEmissions) * 100; // scale for realistic numbers

  // Time savings
  const timeSaved = Math.max(0, normalModeState.trafficMetrics.averageWaitTime - optimizedModeState.trafficMetrics.averageWaitTime);

  // Fuel savings (rough: 0.1L per minute of idle)
  const fuelSaved = timeSaved / 60 * 0.1;

  // Rough estimate of vehicles in intersection
  const vehiclesBenefited = Math.round(normalModeState.trafficMetrics.throughput);

  return {
    emissionsSaved: Math.round(emissionsSaved),
    timeSaved: Math.round(timeSaved),
    fuelSaved: Number(fuelSaved.toFixed(2)),
    vehiclesBenefited,
  };
}

/**
 * Get mode-specific color for UI
 */
export function getModeColor(mode: TrafficMode): string {
  switch (mode) {
    case 'emergency':
      return '#ff0055'; // Magenta
    case 'congestion':
      return '#ff6b35'; // Orange
    case 'eco':
      return '#00ff00'; // Lime
    case 'normal':
    default:
      return '#00f5ff'; // Cyan
  }
}

/**
 * Get mode-specific description
 */
export function getModeDescription(mode: TrafficMode): string {
  switch (mode) {
    case 'emergency':
      return 'Emergency vehicle detected. Signals optimized for EV clearance.';
    case 'congestion':
      return 'High traffic volume detected. Extended cycle for better throughput.';
    case 'eco':
      return 'Light traffic. Eco mode: optimized for emissions reduction.';
    case 'normal':
    default:
      return 'Standard traffic conditions. Normal signal timing.';
  }
}
