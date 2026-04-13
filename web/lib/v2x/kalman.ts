export type KalmanPoint = {
  latitude: number;
  longitude: number;
};

class ScalarKalmanFilter {
  private estimate = 0;
  private covariance = 1;
  private initialized = false;

  constructor(
    private readonly processNoise: number,
    private readonly measurementNoise: number,
  ) {}

  update(measurement: number): number {
    if (!this.initialized) {
      this.estimate = measurement;
      this.initialized = true;
      return this.estimate;
    }

    this.covariance += this.processNoise;
    const gain = this.covariance / (this.covariance + this.measurementNoise);
    this.estimate += gain * (measurement - this.estimate);
    this.covariance *= 1 - gain;

    return this.estimate;
  }
}

export class KalmanFilter2D {
  private latitudeFilter: ScalarKalmanFilter;
  private longitudeFilter: ScalarKalmanFilter;

  constructor(options?: { processNoise?: number; measurementNoise?: number }) {
    const processNoise = options?.processNoise ?? 1e-6;
    const measurementNoise = options?.measurementNoise ?? 1e-4;

    this.latitudeFilter = new ScalarKalmanFilter(processNoise, measurementNoise);
    this.longitudeFilter = new ScalarKalmanFilter(processNoise, measurementNoise);
  }

  update(point: KalmanPoint): KalmanPoint {
    return {
      latitude: this.latitudeFilter.update(point.latitude),
      longitude: this.longitudeFilter.update(point.longitude),
    };
  }
}
