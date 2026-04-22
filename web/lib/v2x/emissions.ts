/**
 * Emission Calculation Engine
 * Calculates CO2 and pollutant emissions based on vehicle type, state, and telemetry
 * Supports both standing (idle) and motion emissions
 */

export type VehicleClass = 'micro' | 'compact' | 'sedan' | 'suv' | 'truck' | 'bus' | 'ambulance' | 'police' | 'fire';

export interface EmissionFactors {
  fuelType: 'petrol' | 'diesel' | 'cng' | 'electric' | 'hybrid';
  co2PerLiter: number; // grams of CO2 per liter of fuel
  noxPerKm: number; // grams of NOx per km (at constant speed)
  pmPerKm: number; // grams of PM2.5 per km
  idleEmissionRate: number; // grams CO2 per minute while idling
}

export interface VehicleEmissionProfile {
  id: string;
  numberPlate: string;
  vehicleClass: VehicleClass;
  year: number;
  engineCc: number;
  fuelType: 'petrol' | 'diesel' | 'cng' | 'electric' | 'hybrid';
  weight: number; // kg
  emissionFactor: EmissionFactors;
}

export interface EmissionCalculationResult {
  co2Grams: number; // Total CO2 in grams
  noxGrams: number; // NOx pollutant in grams
  pmGrams: number; // PM2.5 (fine particles) in grams
  fuelConsumed: number; // Liters
  equivalentTreesNeeded: number; // Trees needed to offset CO2 for one year
  aqi: number; // Air Quality Index contribution
}

export interface RouteEmissionData {
  distance: number; // km
  duration: number; // seconds
  avgSpeed: number; // km/h
  maxSpeed: number; // km/h
  standingTime: number; // seconds while stopped
  acceleration: number; // average m/s^2
  emissions: EmissionCalculationResult;
}

// Standard emission profiles for common Indian vehicles
const STANDARD_PROFILES: Record<string, EmissionFactors> = {
  'sedan_petrol': {
    fuelType: 'petrol',
    co2PerLiter: 2313, // ~1 liter produces 2.3 kg CO2
    noxPerKm: 0.45,
    pmPerKm: 0.08,
    idleEmissionRate: 2.5, // grams CO2 per minute
  },
  'sedan_diesel': {
    fuelType: 'diesel',
    co2PerLiter: 2680,
    noxPerKm: 0.65,
    pmPerKm: 0.15,
    idleEmissionRate: 3.2,
  },
  'suv_petrol': {
    fuelType: 'petrol',
    co2PerLiter: 2313,
    noxPerKm: 0.55,
    pmPerKm: 0.12,
    idleEmissionRate: 3.5,
  },
  'suv_diesel': {
    fuelType: 'diesel',
    co2PerLiter: 2680,
    noxPerKm: 0.75,
    pmPerKm: 0.20,
    idleEmissionRate: 4.1,
  },
  'auto_petrol': {
    fuelType: 'cng',
    co2PerLiter: 1600, // CNG produces less CO2 per unit
    noxPerKm: 0.35,
    pmPerKm: 0.05,
    idleEmissionRate: 1.8,
  },
  'ambulance_diesel': {
    fuelType: 'diesel',
    co2PerLiter: 2680,
    noxPerKm: 0.68,
    pmPerKm: 0.18,
    idleEmissionRate: 3.8,
  },
  'electric': {
    fuelType: 'electric',
    co2PerLiter: 0, // Direct emissions = 0, but grid emissions in scope 3
    noxPerKm: 0,
    pmPerKm: 0,
    idleEmissionRate: 0,
  },
};

// Vehicle class to typical fuel consumption mapping
const FUEL_EFFICIENCY: Record<VehicleClass, number> = {
  micro: 18, // km/liter
  compact: 15,
  sedan: 12,
  suv: 9,
  truck: 6,
  bus: 4,
  ambulance: 8,
  police: 10,
  fire: 5,
};

/**
 * Get emission profile by vehicle characteristics
 */
export function getEmissionProfile(
  numberPlate: string,
  vehicleClass: VehicleClass,
  fuelType: 'petrol' | 'diesel' | 'cng' | 'electric' | 'hybrid',
  year: number = 2023,
  engineCc: number = 1200,
  weight: number = 1200
): VehicleEmissionProfile {
  const profileKey = `${vehicleClass}_${fuelType}`;
  const emissionFactor = STANDARD_PROFILES[profileKey] || STANDARD_PROFILES['sedan_petrol'];

  return {
    id: `${numberPlate}-${Date.now()}`,
    numberPlate,
    vehicleClass,
    year,
    engineCc,
    fuelType,
    weight,
    emissionFactor,
  };
}

/**
 * Calculate emissions for motion (driving)
 * @param profile Vehicle emission profile
 * @param distance Distance in km
 * @param avgSpeed Average speed in km/h
 * @param acceleration Average acceleration in m/s^2 (optional, increases emissions)
 */
export function calculateMotionEmissions(
  profile: VehicleEmissionProfile,
  distance: number,
  avgSpeed: number,
  acceleration: number = 0
): EmissionCalculationResult {
  const efficiency = FUEL_EFFICIENCY[profile.vehicleClass];
  
  // Base fuel consumption
  let fuelConsumed = distance / efficiency;
  
  // Inefficiency factor based on speed (worst at 60-80 km/h acceleration patterns)
  const speedFactor = 0.8 + (Math.abs(avgSpeed - 70) / 100) * 0.3;
  
  // Acceleration increases fuel consumption
  const accelerationPenalty = Math.max(0, acceleration * 0.05);
  
  // Urban vs highway (urban = more stops = more fuel)
  fuelConsumed *= (1 + speedFactor + accelerationPenalty);

  const co2Grams = fuelConsumed * profile.emissionFactor.co2PerLiter;
  const noxGrams = distance * profile.emissionFactor.noxPerKm;
  const pmGrams = distance * profile.emissionFactor.pmPerKm;

  return {
    co2Grams,
    noxGrams,
    pmGrams,
    fuelConsumed,
    equivalentTreesNeeded: co2Grams / 365 / 21000, // One tree absorbs ~21kg CO2/year
    aqi: calculateAQI(noxGrams, pmGrams),
  };
}

/**
 * Calculate emissions while standing (idle)
 * @param profile Vehicle emission profile
 * @param standingTimeSeconds Time standing in seconds
 */
export function calculateStandingEmissions(
  profile: VehicleEmissionProfile,
  standingTimeSeconds: number
): EmissionCalculationResult {
  const standingTimeMinutes = standingTimeSeconds / 60;
  const co2Grams = standingTimeMinutes * profile.emissionFactor.idleEmissionRate;
  
  // Idle produces more pollutants per unit of fuel
  const noxGrams = (standingTimeMinutes * profile.emissionFactor.noxPerKm) / 10; // Reduced for idle
  const pmGrams = (standingTimeMinutes * profile.emissionFactor.pmPerKm) / 10;

  return {
    co2Grams,
    noxGrams,
    pmGrams,
    fuelConsumed: co2Grams / profile.emissionFactor.co2PerLiter,
    equivalentTreesNeeded: co2Grams / 365 / 21000,
    aqi: calculateAQI(noxGrams, pmGrams),
  };
}

/**
 * Calculate total emissions for a complete route/trip
 */
export function calculateTotalEmissions(
  profile: VehicleEmissionProfile,
  distance: number,
  duration: number,
  avgSpeed: number,
  standingTime: number,
  acceleration: number = 0
): RouteEmissionData {
  const motionEmissions = calculateMotionEmissions(profile, distance, avgSpeed, acceleration);
  const standingEmissions = calculateStandingEmissions(profile, standingTime);

  return {
    distance,
    duration,
    avgSpeed,
    maxSpeed: avgSpeed * 1.3, // Estimated max speed
    standingTime,
    acceleration,
    emissions: {
      co2Grams: motionEmissions.co2Grams + standingEmissions.co2Grams,
      noxGrams: motionEmissions.noxGrams + standingEmissions.noxGrams,
      pmGrams: motionEmissions.pmGrams + standingEmissions.pmGrams,
      fuelConsumed: motionEmissions.fuelConsumed + standingEmissions.fuelConsumed,
      equivalentTreesNeeded: (motionEmissions.equivalentTreesNeeded + standingEmissions.equivalentTreesNeeded),
      aqi: calculateAQI(
        motionEmissions.noxGrams + standingEmissions.noxGrams,
        motionEmissions.pmGrams + standingEmissions.pmGrams
      ),
    },
  };
}

/**
 * Calculate emission savings for an optimized route vs standard route
 */
export function calculateEmissionSavings(
  standardRoute: RouteEmissionData,
  optimizedRoute: RouteEmissionData
): {
  co2Saved: number;
  percentReduction: number;
  timeReduction: number;
  estimatedCost: number;
} {
  const co2Saved = standardRoute.emissions.co2Grams - optimizedRoute.emissions.co2Grams;
  const percentReduction = (co2Saved / standardRoute.emissions.co2Grams) * 100;
  const timeReduction = (standardRoute.duration - optimizedRoute.duration) / 60; // in minutes

  // Cost per kg CO2 offset (typical carbon credit pricing)
  const estimatedCost = (co2Saved / 1000) * 10; // $10 per kg CO2

  return {
    co2Saved,
    percentReduction: Math.max(0, percentReduction),
    timeReduction: Math.max(0, timeReduction),
    estimatedCost: Math.max(0, estimatedCost),
  };
}

/**
 * Calculate Air Quality Index (AQI) contribution from pollutants
 * Based on standard AQI formula
 */
function calculateAQI(noxGrams: number, pmGrams: number): number {
  // Convert grams to µg/m³ (simplified, assuming dispersion in 10km x 10km x 1km area)
  const areaVolume = 10 * 10 * 1 * 1e6; // in cubic meters
  const noxMicrograms = (noxGrams * 1e6) / areaVolume;
  const pmMicrograms = (pmGrams * 1e6) / areaVolume;

  // AQI formula (simplified)
  const noxIndex = (noxMicrograms / 200) * 100; // WHO limit: 200 µg/m³
  const pmIndex = (pmMicrograms / 35) * 100; // WHO limit: 35 µg/m³

  // Return the worst of the two
  return Math.min(500, Math.max(noxIndex, pmIndex));
}

/**
 * Compare emissions between different vehicle types for same route
 */
export function compareVehicleEmissions(
  distance: number,
  avgSpeed: number,
  vehicles: VehicleEmissionProfile[]
): Record<string, EmissionCalculationResult> {
  const results: Record<string, EmissionCalculationResult> = {};

  for (const vehicle of vehicles) {
    results[vehicle.numberPlate] = calculateMotionEmissions(vehicle, distance, avgSpeed);
  }

  return results;
}

/**
 * Get vehicle class from number plate based on Indian RTO patterns
 * (This is simplified; in production, use RTO API)
 */
export function guessVehicleClassFromNumberPlate(numberPlate: string): VehicleClass {
  const plate = numberPlate.toUpperCase();
  
  // Simplified pattern matching (In production, use RTO database)
  if (plate.includes('AMB')) return 'ambulance';
  if (plate.includes('PKL')) return 'police';
  if (plate.includes('FIRE')) return 'fire';
  if (plate.includes('TRUCK')) return 'truck';
  if (plate.includes('BUS')) return 'bus';
  
  // Default to sedan for most vehicles
  return 'sedan';
}
