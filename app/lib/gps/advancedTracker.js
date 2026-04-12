class KalmanFilter1D {
  constructor(processNoise = 0.01, measurementNoise = 2.0) {
    this.q = processNoise;
    this.r = measurementNoise;
    this.p = 1;
    this.x = null;
    this.k = 0;
  }

  filter(measurement) {
    if (this.x === null) {
      this.x = measurement;
      return measurement;
    }

    this.p += this.q;
    this.k = this.p / (this.p + this.r);
    this.x += this.k * (measurement - this.x);
    this.p *= 1 - this.k;
    return this.x;
  }

  reset() {
    this.p = 1;
    this.x = null;
    this.k = 0;
  }
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371000 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export class AdvancedGPSTracker {
  constructor(options = {}) {
    this.options = {
      kalmanQ: 0.008,
      kalmanR: 1.8,
      maxJumpMeters: 120,
      minAccuracyMeters: 3,
      ...options
    };

    this.kalmanLat = new KalmanFilter1D(this.options.kalmanQ, this.options.kalmanR);
    this.kalmanLng = new KalmanFilter1D(this.options.kalmanQ, this.options.kalmanR);

    this.lastState = null;
    this.history = [];
    this.stats = {
      readings: 0,
      outliersRejected: 0
    };
  }

  process(geoCoords) {
    const now = Date.now();
    const lat = Number(geoCoords.latitude);
    const lng = Number(geoCoords.longitude);
    const rawAccuracy = Number(geoCoords.accuracy || this.options.minAccuracyMeters);
    const accuracy = Math.max(this.options.minAccuracyMeters, rawAccuracy);

    if (this.lastState?.lat && this.lastState?.lng) {
      const jump = haversineMeters(this.lastState.lat, this.lastState.lng, lat, lng);
      if (jump > this.options.maxJumpMeters) {
        this.stats.outliersRejected += 1;
        return { ...this.lastState, rejected: true };
      }
    }

    const smoothLat = this.kalmanLat.filter(lat);
    const smoothLng = this.kalmanLng.filter(lng);

    const previous = this.history[this.history.length - 1] || null;
    let speed = Number(geoCoords.speed || 0);
    if ((!Number.isFinite(speed) || speed < 0.01) && previous) {
      const dt = (now - previous.timestamp) / 1000;
      if (dt > 0) {
        const dist = haversineMeters(previous.lat, previous.lng, smoothLat, smoothLng);
        speed = dist / dt;
      }
    }

    const heading = Number(geoCoords.heading);
    const inferredHeading = Number.isFinite(heading) ? heading : this.lastState?.heading || 0;

    const state = {
      lat: smoothLat,
      lng: smoothLng,
      accuracy,
      speed: Number.isFinite(speed) ? speed : 0,
      heading: inferredHeading,
      altitude: Number.isFinite(geoCoords.altitude) ? Number(geoCoords.altitude) : null,
      timestamp: now,
      confidence: Math.max(0, Math.min(1, 1 - accuracy / 75)),
      kalmanGain: this.kalmanLat.k,
      rejected: false
    };

    this.lastState = state;
    this.history.push(state);
    if (this.history.length > 15) this.history.shift();
    this.stats.readings += 1;

    return state;
  }

  getReport() {
    return {
      readings: this.stats.readings,
      outliersRejected: this.stats.outliersRejected,
      confidence: this.lastState ? this.lastState.confidence : 0,
      accuracy: this.lastState ? this.lastState.accuracy : null
    };
  }
}

export function getGPSWatchOptions() {
  const timeout = Number(process.env.NEXT_PUBLIC_GPS_TIMEOUT_MS || 8000);
  const maximumAge = Number(process.env.NEXT_PUBLIC_GPS_MAX_AGE_MS || 400);
  const highAccuracy = String(process.env.NEXT_PUBLIC_GPS_HIGH_ACCURACY || "true") !== "false";

  return {
    enableHighAccuracy: highAccuracy,
    timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 8000,
    maximumAge: Number.isFinite(maximumAge) && maximumAge >= 0 ? maximumAge : 400
  };
}
