/**
 * Radiation & EM Field Model
 * Calculates electromagnetic field exposure from traffic signals and infrastructure
 * Combines with emission metrics for comprehensive health impact assessment
 */

export interface RadiationSource {
  type: 'traffic_signal' | 'cellular_tower' | 'wifi' | 'power_line';
  location: { latitude: number; longitude: number };
  power: number; // Watts - transmission power
  frequency: number; // MHz
  antennaType: 'omnidirectional' | 'directional';
  height: number; // meters above ground
}

export interface RadiationExposureData {
  location: { latitude: number; longitude: number };
  proximity: number; // meters
  powerDensity: number; // µW/cm² (microwatts per square centimeter)
  frequency: number; // MHz
  saLevel: number; // Specific Absorption Rate in W/kg
  exposureLimit: number; // WHO/FCC limit in µW/cm²
  withinSafetyLimit: boolean;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
}

export interface CombinedHealthImpact {
  radiationExposure: RadiationExposureData;
  emissionExposure: {
    pm25: number; // µg/m³
    no2: number; // ppb
    co2Equivalent: number; // km equivalent
  };
  combinedRiskScore: number; // 0-100
  healthAdvisory: string;
  recommendedAction: string;
}

// WHO/FCC Safety Standards
const SAFETY_LIMITS = {
  fcc: 1000, // µW/cm² (USA)
  who: 450, // µW/cm² (more conservative)
  icnirp: 1000, // µW/cm² (International)
};

/**
 * Calculate power density from a radiation source
 * Using inverse square law: PD = P / (4 * π * r²)
 */
export function calculatePowerDensity(
  transmitterPower: number, // Watts
  distance: number, // meters
  antennaGain: number = 3, // dBi (typical for traffic signal)
  cableAttenuation: number = -2 // dB (losses)
): {
  powerDensity: number; // µW/cm²
  saLevel: number; // W/kg
} {
  // Convert power to linear scale
  const effectiveIsotropicRadiatedPower = transmitterPower * Math.pow(10, (antennaGain + cableAttenuation) / 10);

  // Apply inverse square law
  const powerDensity = (effectiveIsotropicRadiatedPower * 1e6) / (4 * Math.PI * distance * distance);

  // Convert to µW/cm² (divide by 10000 to convert from µW/m² to µW/cm²)
  const powerDensityMicroWcm2 = powerDensity / 10000;

  // Calculate SAR (Specific Absorption Rate)
  // Simplified formula: SAR = σ * E² / ρ
  // Where σ is conductivity (~0.65 S/m for tissue), E is electric field
  // SAR in W/kg ≈ powerDensity * 0.001 (simplified)
  const saLevel = powerDensityMicroWcm2 * 0.001;

  return {
    powerDensity: Math.max(0, powerDensityMicroWcm2),
    saLevel: Math.max(0, saLevel),
  };
}

/**
 * Assess radiation exposure
 */
export function assessRadiationExposure(
  source: RadiationSource,
  vehicleLocation: { latitude: number; longitude: number }
): RadiationExposureData {
  // Calculate distance
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(source.location.latitude - vehicleLocation.latitude);
  const dLon = toRad(source.location.longitude - vehicleLocation.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(vehicleLocation.latitude)) *
      Math.cos(toRad(source.location.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = Math.max(1, R * c); // minimum 1 meter for safety

  // Calculate power density
  const { powerDensity, saLevel } = calculatePowerDensity(
    source.power,
    distance
  );

  // Determine risk level
  let riskLevel: RadiationExposureData['riskLevel'] = 'low';
  if (powerDensity > 900) riskLevel = 'critical';
  else if (powerDensity > 450) riskLevel = 'high';
  else if (powerDensity > 100) riskLevel = 'moderate';

  return {
    location: vehicleLocation,
    proximity: distance,
    powerDensity,
    frequency: source.frequency,
    saLevel,
    exposureLimit: SAFETY_LIMITS.who,
    withinSafetyLimit: powerDensity <= SAFETY_LIMITS.who,
    riskLevel,
  };
}

/**
 * Calculate cumulative exposure from multiple sources
 */
export function calculateCumulativeExposure(
  sources: RadiationSource[],
  vehicleLocation: { latitude: number; longitude: number }
): {
  totalPowerDensity: number;
  maxSource: RadiationSource;
  averageRiskLevel: string;
  safetyMargin: number; // percentage below limit (0-100)
} {
  const exposures = sources.map((source) => assessRadiationExposure(source, vehicleLocation));

  // Power density addition (linear, not quadratic, because it's a scalar quantity)
  const totalPowerDensity = exposures.reduce((sum, exp) => sum + exp.powerDensity, 0);

  // Find maximum source
  const maxExposure = exposures.reduce((max, curr) =>
    curr.powerDensity > max.powerDensity ? curr : max
  );
  const maxSource = sources[exposures.indexOf(maxExposure)];

  // Average risk
  const riskScores = { low: 1, moderate: 2, high: 3, critical: 4 };
  const avgRiskScore =
    exposures.reduce((sum, exp) => sum + (riskScores[exp.riskLevel] || 1), 0) / exposures.length;
  const avgRiskLevel =
    avgRiskScore < 1.5
      ? 'low'
      : avgRiskScore < 2.5
      ? 'moderate'
      : avgRiskScore < 3.5
      ? 'high'
      : 'critical';

  // Safety margin
  const safetyMargin = Math.max(
    0,
    100 - (totalPowerDensity / SAFETY_LIMITS.who) * 100
  );

  return {
    totalPowerDensity,
    maxSource,
    averageRiskLevel,
    safetyMargin: Math.round(safetyMargin),
  };
}

/**
 * Calculate combined health impact (radiation + emissions)
 */
export function calculateCombinedHealthImpact(
  radiationExposure: RadiationExposureData,
  emissionMetrics: {
    pm25: number; // µg/m³
    no2: number; // ppb
    co2: number; // grams per km
  }
): CombinedHealthImpact {
  // Radiation risk score (0-30)
  const radiationScore = radiationExposure.powerDensity / 30; // normalize

  // Emission risk score (0-70)
  const pm25Score = (emissionMetrics.pm25 / 100) * 30; // normalize PM2.5
  const no2Score = (emissionMetrics.no2 / 200) * 20; // normalize NO2
  const co2Score = (emissionMetrics.co2 / 500) * 20; // normalize CO2

  const emissionScore = Math.min(70, pm25Score + no2Score + co2Score);

  // Combined score
  const combinedRiskScore = radiationScore + emissionScore;

  // Health advisory
  let healthAdvisory = '';
  let recommendedAction = '';

  if (combinedRiskScore < 20) {
    healthAdvisory = '✓ Low combined health risk. Safe for prolonged exposure.';
    recommendedAction = 'No action necessary.';
  } else if (combinedRiskScore < 40) {
    healthAdvisory = '⚠ Moderate combined health risk. Sensitive groups should be cautious.';
    recommendedAction = 'Keep vehicle windows closed. Limit outdoor exposure.';
  } else if (combinedRiskScore < 60) {
    healthAdvisory = '⚠ High combined health risk. Avoid unnecessary time in this area.';
    recommendedAction = 'Use air filtration. Take alternative route if possible.';
  } else {
    healthAdvisory = '🚨 CRITICAL combined health risk. Avoid this area if possible.';
    recommendedAction = 'Use HEPA filtration and N95+masks. Evacuate if symptoms occur.';
  }

  return {
    radiationExposure,
    emissionExposure: {
      pm25: emissionMetrics.pm25,
      no2: emissionMetrics.no2,
      co2Equivalent: emissionMetrics.co2 / 200, // Approximate km equivalent
    },
    combinedRiskScore: Math.min(100, combinedRiskScore),
    healthAdvisory,
    recommendedAction,
  };
}

/**
 * Estimate safe zones (low radiation + low emission areas)
 */
export function identifySafeZones(
  radiationSources: RadiationSource[],
  center: { latitude: number; longitude: number },
  radiusKm: number = 5
): Array<{
  location: { latitude: number; longitude: number };
  safetyScore: number; // 0-100
  radiationLevel: number;
  suggestedFor: string[];
}> {
  const zones: Array<{
    location: { latitude: number; longitude: number };
    safetyScore: number;
    radiationLevel: number;
    suggestedFor: string[];
  }> = [];

  // Create a grid of potential safe zones
  const gridSize = radiusKm / 5;
  for (let lat = -radiusKm; lat <= radiusKm; lat += gridSize) {
    for (let lng = -radiusKm; lng <= radiusKm; lng += gridSize) {
      const location = {
        latitude: center.latitude + lat / 111, // 1 degree ≈ 111 km
        longitude: center.longitude + lng / (111 * Math.cos((center.latitude * Math.PI) / 180)),
      };

      const cumExposure = calculateCumulativeExposure(radiationSources, location);
      const safetyScore = Math.max(0, 100 - cumExposure.totalPowerDensity * 0.1);

      const suggestedFor: string[] = [];
      if (safetyScore > 80) suggestedFor.push('Children', 'Pregnant women', 'Elderly');
      if (safetyScore > 60) suggestedFor.push('General population');
      if (safetyScore > 40) suggestedFor.push('Construction workers', 'Outdoor activities');

      zones.push({
        location,
        safetyScore,
        radiationLevel: cumExposure.totalPowerDensity,
        suggestedFor,
      });
    }
  }

  // Sort by safety score descending
  return zones.sort((a, b) => b.safetyScore - a.safetyScore);
}

/**
 * Generate safety report
 */
export function generateRadiationSafetyReport(
  exposures: RadiationExposureData[]
): {
  totalExposure: number;
  riskLevel: string;
  compliancePercentage: number; // How many are within limits
  recommendations: string[];
} {
  const totalExposure = exposures.reduce((sum, exp) => sum + exp.powerDensity, 0);
  const withinLimits = exposures.filter((exp) => exp.withinSafetyLimit).length;
  const compliancePercentage = (withinLimits / exposures.length) * 100;

  let riskLevel = 'low';
  if (compliancePercentage < 50) riskLevel = 'critical';
  else if (compliancePercentage < 75) riskLevel = 'high';
  else if (compliancePercentage < 90) riskLevel = 'moderate';

  const recommendations: string[] = [];
  if (compliancePercentage < 75) {
    recommendations.push('⚠ Some exposure sources exceed safety limits');
    recommendations.push('• Report to local authorities for remediation');
    recommendations.push('• Maintain distance from signal boxes');
    recommendations.push('• Use EMF shielding if prolonged exposure');
  }

  return {
    totalExposure: Math.round(totalExposure),
    riskLevel,
    compliancePercentage: Math.round(compliancePercentage),
    recommendations,
  };
}
