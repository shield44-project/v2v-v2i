/**
 * Pollution & Air Quality Prediction System
 * Predicts air quality based on traffic, emissions, and weather patterns
 */

export type PollutantType = 'PM2.5' | 'PM10' | 'NO2' | 'O3' | 'SO2' | 'CO' | 'AQI';

export interface AirQualityData {
  timestamp: string;
  latitude: number;
  longitude: number;
  pm25: number; // µg/m³
  pm10: number; // µg/m³
  no2: number; // ppb
  o3: number; // ppb
  so2: number; // ppb
  co: number; // ppm
  aqi: number; // 0-500 scale
  aqiCategory: 'Good' | 'Satisfactory' | 'Moderately Polluted' | 'Poor' | 'Very Poor' | 'Severe';
  temperature: number; // Celsius
  humidity: number; // %
  windSpeed: number; // m/s
  windDirection: number; // degrees
}

export interface PollutionPrediction {
  location: {
    latitude: number;
    longitude: number;
    areaName?: string;
  };
  current: AirQualityData;
  forecast: {
    '1h': AirQualityData;
    '3h': AirQualityData;
    '6h': AirQualityData;
    '12h': AirQualityData;
    '24h': AirQualityData;
  };
  trafficImpact: {
    vehicleCount: number;
    averageEmissions: number;
    contributionPercentage: number;
  };
  healthAdvisory: string;
}

export interface HistoricalPollutionData {
  date: string;
  hourlyAQI: number[];
  peakHour: number;
  averageAQI: number;
  worstPollutant: PollutantType;
}

/**
 * WHO/EPA Air Quality Index Categories
 */
const AQI_BREAKPOINTS = {
  good: { min: 0, max: 50, category: 'Good' as const, color: '#10b981' },
  satisfactory: { min: 51, max: 100, category: 'Satisfactory' as const, color: '#fbbf24' },
  moderatelyPolluted: { min: 101, max: 200, category: 'Moderately Polluted' as const, color: '#f97316' },
  poor: { min: 201, max: 300, category: 'Poor' as const, color: '#ef4444' },
  veryPoor: { min: 301, max: 400, category: 'Very Poor' as const, color: '#991b1b' },
  severe: { min: 401, max: 500, category: 'Severe' as const, color: '#7c2d12' },
};

/**
 * Calculate AQI from pollutant measurements
 * Based on EPA/AQI formula
 */
export function calculateAQI(pollutants: Partial<AirQualityData>): {
  aqi: number;
  category: AirQualityData['aqiCategory'];
  primaryPollutant: PollutantType;
} {
  // Sub-indices for each pollutant
  const pm25_aqi = calculatePollutantAQI(pollutants.pm25 || 0, 'PM2.5');
  const pm10_aqi = calculatePollutantAQI(pollutants.pm10 || 0, 'PM10');
  const no2_aqi = calculatePollutantAQI(pollutants.no2 || 0, 'NO2');
  const o3_aqi = calculatePollutantAQI(pollutants.o3 || 0, 'O3');
  const so2_aqi = calculatePollutantAQI(pollutants.so2 || 0, 'SO2');
  const co_aqi = calculatePollutantAQI(pollutants.co || 0, 'CO');

  // Overall AQI is the maximum sub-index
  const indices = [
    { aqi: pm25_aqi, pollutant: 'PM2.5' as PollutantType },
    { aqi: pm10_aqi, pollutant: 'PM10' as PollutantType },
    { aqi: no2_aqi, pollutant: 'NO2' as PollutantType },
    { aqi: o3_aqi, pollutant: 'O3' as PollutantType },
    { aqi: so2_aqi, pollutant: 'SO2' as PollutantType },
    { aqi: co_aqi, pollutant: 'CO' as PollutantType },
  ];

  const maxIndex = indices.reduce((max, curr) => (curr.aqi > max.aqi ? curr : max));
  const aqi = Math.min(500, maxIndex.aqi);

  let category: AirQualityData['aqiCategory'] = 'Severe';
  if (aqi <= 50) category = 'Good';
  else if (aqi <= 100) category = 'Satisfactory';
  else if (aqi <= 200) category = 'Moderately Polluted';
  else if (aqi <= 300) category = 'Poor';
  else if (aqi <= 400) category = 'Very Poor';

  return {
    aqi,
    category,
    primaryPollutant: maxIndex.pollutant,
  };
}

/**
 * Calculate sub-index for individual pollutant
 */
function calculatePollutantAQI(concentration: number, pollutant: PollutantType): number {
  // Simplified sub-index calculation (full formula requires breakpoint tables)
  const breakpoints: Record<PollutantType, { concentration: number; index: number }[]> = {
    'PM2.5': [
      { concentration: 12, index: 50 },
      { concentration: 35.5, index: 100 },
      { concentration: 55.5, index: 150 },
      { concentration: 150.5, index: 200 },
      { concentration: 250.5, index: 300 },
      { concentration: 500, index: 500 },
    ],
    'PM10': [
      { concentration: 54, index: 50 },
      { concentration: 154, index: 100 },
      { concentration: 254, index: 150 },
      { concentration: 354, index: 200 },
      { concentration: 424, index: 300 },
      { concentration: 604, index: 500 },
    ],
    'NO2': [
      { concentration: 40, index: 50 },
      { concentration: 80, index: 100 },
      { concentration: 180, index: 150 },
      { concentration: 280, index: 200 },
      { concentration: 400, index: 300 },
      { concentration: 1000, index: 500 },
    ],
    'O3': [
      { concentration: 54, index: 50 },
      { concentration: 70, index: 100 },
      { concentration: 85, index: 150 },
      { concentration: 105, index: 200 },
      { concentration: 200, index: 300 },
      { concentration: 400, index: 500 },
    ],
    'SO2': [
      { concentration: 40, index: 50 },
      { concentration: 80, index: 100 },
      { concentration: 380, index: 150 },
      { concentration: 800, index: 200 },
      { concentration: 1600, index: 300 },
      { concentration: 2620, index: 500 },
    ],
    'CO': [
      { concentration: 1, index: 50 },
      { concentration: 2, index: 100 },
      { concentration: 10, index: 150 },
      { concentration: 17, index: 200 },
      { concentration: 34, index: 300 },
      { concentration: 50, index: 500 },
    ],
  };

  const breaks = breakpoints[pollutant];
  let lowerBreak = breaks[0];
  let upperBreak = breaks[breaks.length - 1];

  for (let i = 0; i < breaks.length - 1; i++) {
    if (concentration >= breaks[i].concentration && concentration < breaks[i + 1].concentration) {
      lowerBreak = breaks[i];
      upperBreak = breaks[i + 1];
      break;
    }
  }

  // Linear interpolation
  const aqi =
    ((upperBreak.index - lowerBreak.index) / (upperBreak.concentration - lowerBreak.concentration)) *
      (concentration - lowerBreak.concentration) +
    lowerBreak.index;

  return Math.max(0, Math.min(500, aqi));
}

/**
 * Predict pollution for next 24 hours using simple LSTM-inspired model
 */
export function predictPollution(
  currentAQI: AirQualityData,
  trafficDensity: number, // 0-100%
  weatherForecast: {
    windSpeed: number;
    temperature: number;
    humidity: number;
  }
): PollutionPrediction {
  // Simple prediction model
  // Factors: time of day, traffic patterns, wind (dispersion), temperature (inversion)

  const now = new Date();
  const hour = now.getHours();

  // Peak traffic hours: 7-9 AM, 5-8 PM
  const trafficFactor = [7, 8, 17, 18, 19, 20].includes(hour) ? 1.3 : 0.9;

  // Wind dispersion: higher wind = better dispersion
  const windFactor = Math.max(0.5, 1 - weatherForecast.windSpeed / 15);

  // Temperature inversion: more likely at night/early morning
  const inversionFactor = hour >= 4 && hour <= 7 ? 1.2 : 1.0;

  // Decay factor: pollution dissipates over time
  const generateForecast = (hoursAhead: number) => {
    const decayFactor = Math.pow(0.95, hoursAhead); // 5% reduction per hour
    const aqi = Math.max(
      currentAQI.aqi * decayFactor * windFactor * inversionFactor + trafficDensity * 0.1
    );

    const { category, primaryPollutant } = calculateAQI({ ...currentAQI, aqi });

    return {
      ...currentAQI,
      aqi,
      aqiCategory: category,
      timestamp: new Date(
        currentAQI.timestamp
      ).getTime() +
        hoursAhead * 3600000).toISOString(),
    };
  };

  return {
    location: {
      latitude: currentAQI.latitude,
      longitude: currentAQI.longitude,
    },
    current: currentAQI,
    forecast: {
      '1h': generateForecast(1),
      '3h': generateForecast(3),
      '6h': generateForecast(6),
      '12h': generateForecast(12),
      '24h': generateForecast(24),
    },
    trafficImpact: {
      vehicleCount: Math.floor(trafficDensity * 100),
      averageEmissions: (trafficDensity * 500),
      contributionPercentage: trafficDensity * 50,
    },
    healthAdvisory: generateHealthAdvisory(currentAQI.aqi, trafficDensity),
  };
}

/**
 * Generate health advisory based on AQI
 */
function generateHealthAdvisory(aqi: number, trafficDensity: number): string {
  if (aqi <= 50) {
    return '✓ Air quality is good. Safe for outdoor activities.';
  } else if (aqi <= 100) {
    return '⚠ Air quality is satisfactory. Sensitive groups should limit prolonged outdoor exposure.';
  } else if (aqi <= 200) {
    return '⚠ Moderate pollution. Sensitive groups should avoid outdoor activities.';
  } else if (aqi <= 300) {
    return '🚨 Poor air quality. Everyone should reduce outdoor exposure.';
  } else if (aqi <= 400) {
    return '🚨 Very poor air quality. Avoid outdoor activities. Use N95 masks if necessary.';
  } else {
    return '🚨 SEVERE pollution. Stay indoors. Use air purifiers and N95+ masks.';
  }
}

/**
 * Calculate area-wide pollution index
 */
export function calculateAreaPollutionIndex(
  measurements: AirQualityData[],
  gridSize: number = 5 // km
): Map<string, AirQualityData> {
  const grid = new Map<string, AirQualityData[]>();

  // Group measurements into grid cells
  for (const measurement of measurements) {
    const gridKey = `${Math.floor(measurement.latitude / gridSize)}_${Math.floor(
      measurement.longitude / gridSize
    )}`;
    if (!grid.has(gridKey)) {
      grid.set(gridKey, []);
    }
    grid.get(gridKey)!.push(measurement);
  }

  // Calculate average for each cell
  const result = new Map<string, AirQualityData>();
  for (const [key, cellMeasurements] of grid) {
    const avgMeasurement: AirQualityData = {
      timestamp: new Date().toISOString(),
      latitude:
        cellMeasurements.reduce((sum, m) => sum + m.latitude, 0) / cellMeasurements.length,
      longitude:
        cellMeasurements.reduce((sum, m) => sum + m.longitude, 0) / cellMeasurements.length,
      pm25: cellMeasurements.reduce((sum, m) => sum + m.pm25, 0) / cellMeasurements.length,
      pm10: cellMeasurements.reduce((sum, m) => sum + m.pm10, 0) / cellMeasurements.length,
      no2: cellMeasurements.reduce((sum, m) => sum + m.no2, 0) / cellMeasurements.length,
      o3: cellMeasurements.reduce((sum, m) => sum + m.o3, 0) / cellMeasurements.length,
      so2: cellMeasurements.reduce((sum, m) => sum + m.so2, 0) / cellMeasurements.length,
      co: cellMeasurements.reduce((sum, m) => sum + m.co, 0) / cellMeasurements.length,
      temperature:
        cellMeasurements.reduce((sum, m) => sum + m.temperature, 0) / cellMeasurements.length,
      humidity:
        cellMeasurements.reduce((sum, m) => sum + m.humidity, 0) / cellMeasurements.length,
      windSpeed:
        cellMeasurements.reduce((sum, m) => sum + m.windSpeed, 0) / cellMeasurements.length,
      windDirection:
        cellMeasurements.reduce((sum, m) => sum + m.windDirection, 0) / cellMeasurements.length,
      aqi: 0,
      aqiCategory: 'Satisfactory',
    };

    const { aqi, category } = calculateAQI(avgMeasurement);
    avgMeasurement.aqi = aqi;
    avgMeasurement.aqiCategory = category;

    result.set(key, avgMeasurement);
  }

  return result;
}

/**
 * Get color for AQI visualization
 */
export function getAQIColor(aqi: number): string {
  if (aqi <= 50) return '#10b981'; // Green
  if (aqi <= 100) return '#fbbf24'; // Yellow
  if (aqi <= 200) return '#f97316'; // Orange
  if (aqi <= 300) return '#ef4444'; // Red
  if (aqi <= 400) return '#991b1b'; // Dark Red
  return '#7c2d12'; // Brown/Severe
}

/**
 * Get AQI category
 */
export function getAQICategory(aqi: number): AirQualityData['aqiCategory'] {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderately Polluted';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}
