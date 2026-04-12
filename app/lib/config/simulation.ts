export const SIMULATION_CONFIG = {
  defaultRanges: {
    v2v: Number(process.env.NEXT_PUBLIC_DEFAULT_RANGE_V2V || 25),
    v2i: Number(process.env.NEXT_PUBLIC_DEFAULT_RANGE_V2I || 50)
  },
  geoFence: {
    name: "Silk Board Junction, Bangalore",
    center: {
      lat: 12.918,
      lng: 77.6201
    },
    radiusMeters: 5000
  },
  motion: {
    minMovingSpeed: 0.3,
    maxVehicleJumpMeters: 120
  },
  ui: {
    refreshLabelMs: 1000,
    mapDefault: "satellite"
  }
};
