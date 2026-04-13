const WGS84 = {
  a: 6378137,
  b: 6356752.314245,
  f: 1 / 298.257223563,
};

const EARTH_RADIUS_METERS = 6371008.8;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normalizeHeading(heading: number): number {
  return ((heading % 360) + 360) % 360;
}

export function headingToDirection(heading: number): "north" | "south" | "east" | "west" {
  const normalized = normalizeHeading(heading);
  if (normalized >= 45 && normalized < 135) return "east";
  if (normalized >= 135 && normalized < 225) return "south";
  if (normalized >= 225 && normalized < 315) return "west";
  return "north";
}

export function bearingBetweenCoordinates(
  originLat: number,
  originLng: number,
  targetLat: number,
  targetLng: number,
): number {
  const phi1 = toRadians(originLat);
  const phi2 = toRadians(targetLat);
  const lambdaDiff = toRadians(targetLng - originLng);

  const y = Math.sin(lambdaDiff) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambdaDiff);

  return normalizeHeading(toDegrees(Math.atan2(y, x)));
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export function vincentyDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const U1 = Math.atan((1 - WGS84.f) * Math.tan(toRadians(lat1)));
  const U2 = Math.atan((1 - WGS84.f) * Math.tan(toRadians(lat2)));
  const L = toRadians(lon2 - lon1);

  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);

  let lambda = L;
  let iteration = 0;

  while (iteration < 100) {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);

    const sinSigma = Math.sqrt(
      (cosU2 * sinLambda) * (cosU2 * sinLambda) +
        (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) *
          (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda),
    );

    if (sinSigma === 0) return 0;

    const cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    const sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    const cosSqAlpha = 1 - sinAlpha * sinAlpha;
    const cos2SigmaM =
      cosSqAlpha === 0 ? 0 : cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha;

    const C =
      (WGS84.f / 16) *
      cosSqAlpha *
      (4 + WGS84.f * (4 - 3 * cosSqAlpha));

    const previousLambda = lambda;
    lambda =
      L +
      (1 - C) *
        WGS84.f *
        sinAlpha *
        (sigma +
          C *
            sinSigma *
            (cos2SigmaM +
              C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));

    if (Math.abs(lambda - previousLambda) < 1e-12) {
      const uSq =
        (cosSqAlpha * (WGS84.a * WGS84.a - WGS84.b * WGS84.b)) /
        (WGS84.b * WGS84.b);
      const A =
        1 +
        (uSq / 16384) *
          (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
      const B =
        (uSq / 1024) *
        (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
      const deltaSigma =
        B *
        sinSigma *
        (cos2SigmaM +
          (B / 4) *
            (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
              (B / 6) *
                cos2SigmaM *
                (-3 + 4 * sinSigma * sinSigma) *
                (-3 + 4 * cos2SigmaM * cos2SigmaM)));

      return WGS84.b * A * (sigma - deltaSigma);
    }

    iteration += 1;
  }

  return haversineDistance(lat1, lon1, lat2, lon2);
}

export function predictFuturePosition(
  latitude: number,
  longitude: number,
  speedMetersPerSecond: number,
  headingDegrees: number,
  lookAheadSeconds: number,
): { latitude: number; longitude: number } {
  const distance = Math.max(0, speedMetersPerSecond) * Math.max(0, lookAheadSeconds);
  if (distance === 0) return { latitude, longitude };

  const angularDistance = distance / EARTH_RADIUS_METERS;
  const heading = toRadians(normalizeHeading(headingDegrees));
  const phi1 = toRadians(latitude);
  const lambda1 = toRadians(longitude);

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(angularDistance) +
      Math.cos(phi1) * Math.sin(angularDistance) * Math.cos(heading),
  );

  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(heading) * Math.sin(angularDistance) * Math.cos(phi1),
      Math.cos(angularDistance) - Math.sin(phi1) * Math.sin(phi2),
    );

  return {
    latitude: toDegrees(phi2),
    longitude: toDegrees(lambda2),
  };
}

/**
 * Returns true when the emergency vehicle (at evLat/evLon heading evHeading°)
 * is moving *toward* the civilian (at civLat/civLon).
 *
 * Uses dot-product of the EV heading unit-vector against the relative-position
 * vector from EV → civilian.  Works for small distances (< 5 km).
 */
export function isEvApproaching(
  evLat: number,
  evLon: number,
  evHeadingDegrees: number,
  civLat: number,
  civLon: number,
): boolean {
  const headingRad = toRadians(normalizeHeading(evHeadingDegrees));
  const evDirX = Math.sin(headingRad); // east component
  const evDirY = Math.cos(headingRad); // north component
  const relX = civLon - evLon;
  const relY = civLat - evLat;
  return evDirX * relX + evDirY * relY > 0;
}

/**
 * Returns a yield action string and arrow for the civilian vehicle to display.
 * civHeading is the civilian's current compass heading.
 * bearingToEV is the compass bearing FROM civilian TO the emergency vehicle.
 */
export function getYieldAction(
  civHeading: number,
  bearingToEV: number,
): { action: string; arrow: string } {
  const relative = ((bearingToEV - civHeading) % 360 + 540) % 360 - 180; // –180..180
  if (Math.abs(relative) < 60) {
    return { action: "Stop / Pull Over", arrow: "🛑" };
  }
  if (relative > 0) {
    // EV is to the right of civilian's heading → civilian moves left
    return { action: "Move Left", arrow: "⬅️" };
  }
  // EV is to the left of civilian's heading → civilian moves right
  return { action: "Move Right", arrow: "➡️" };
}
