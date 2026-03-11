/**
 * TLE 기반 위치·속도 계산 (satellite.js SGP4)
 */

export interface TlePositionResult {
  longitude: number;
  latitude: number;
  altitude: number;
  velocityEcef: { x: number; y: number; z: number };
  passDirection: 'ascending' | 'descending';
}

/** satellite.js satrec 타입 (캐싱용) */
export type Satrec = Record<string, unknown>;

/**
 * TLE 문자열을 satrec로 파싱 (캐싱용, 매 프레임 파싱 방지)
 */
export function parseTleToSatrec(tleText: string): Satrec | null {
  const sat = (window as any).satellite;
  if (!sat) return null;
  try {
    const lines = tleText.trim().split('\n');
    const line1 = lines.length >= 2 ? lines[lines.length - 2] : lines[0];
    const line2 = lines.length >= 2 ? lines[lines.length - 1] : lines[1];
    return sat.twoline2satrec(line1, line2);
  } catch {
    return null;
  }
}

/**
 * satrec로 특정 시각의 위치·속도 계산 (파싱 생략, preRender 등 고빈도 호출용)
 */
export function getPositionFromSatrec(
  satrec: Satrec,
  time: Cesium.JulianDate
): TlePositionResult | null {
  const sat = (window as any).satellite;
  if (!sat) return null;
  try {
    const date = Cesium.JulianDate.toDate(time);
    const posVel = sat.propagate(satrec, date);
    if (posVel.error) return null;
    const gmst = sat.gstime(date);
    const geodetic = sat.eciToGeodetic(posVel.position, gmst);
    const longitude = sat.degreesLong(geodetic.longitude);
    const latitude = sat.degreesLat(geodetic.latitude);
    const altitude = geodetic.height * 1000; // km → m

    const EARTH_OMEGA = 7.292115e-5; // rad/s
    const cosG = Math.cos(gmst);
    const sinG = Math.sin(gmst);
    const rx = posVel.position.x;
    const ry = posVel.position.y;
    const vx = posVel.velocity.x;
    const vy = posVel.velocity.y;
    const vz = posVel.velocity.z;
    const rEcefX = rx * cosG + ry * sinG;
    const rEcefY = -rx * sinG + ry * cosG;
    const vRotX = vx * cosG + vy * sinG;
    const vRotY = -vx * sinG + vy * cosG;
    const vEcefX = vRotX + EARTH_OMEGA * rEcefY;
    const vEcefY = vRotY - EARTH_OMEGA * rEcefX;
    const vEcefZ = vz;
    const mag = Math.sqrt(vEcefX * vEcefX + vEcefY * vEcefY + vEcefZ * vEcefZ);
    const velocityEcef =
      mag > 1e-10
        ? { x: vEcefX / mag, y: vEcefY / mag, z: vEcefZ / mag }
        : { x: vEcefX, y: vEcefY, z: vEcefZ };

    const passDirection = posVel.velocity.z >= 0 ? 'ascending' : 'descending';
    return { longitude, latitude, altitude, velocityEcef, passDirection };
  } catch {
    return null;
  }
}

/**
 * TLE로부터 특정 시각의 위치·속도 계산 (satellite.js SGP4)
 */
export function getPositionFromTLE(
  tleText: string,
  time: Cesium.JulianDate
): TlePositionResult | null {
  const satrec = parseTleToSatrec(tleText);
  if (!satrec) return null;
  return getPositionFromSatrec(satrec, time);
}

/**
 * satrec로 궤도 경로 위치 배열 계산 (파싱 생략, 고빈도 호출용)
 */
export function getOrbitPathPositionsFromSatrec(
  satrec: Satrec,
  centerTime: Cesium.JulianDate,
  durationHours: number,
  sampleIntervalMinutes: number
): Cesium.Cartesian3[] {
  const halfHours = durationHours / 2;
  const startTime = Cesium.JulianDate.addSeconds(
    centerTime,
    -halfHours * 3600,
    new Cesium.JulianDate()
  );
  const sampleIntervalSeconds = sampleIntervalMinutes * 60;
  const totalSamples = Math.floor((durationHours * 3600) / sampleIntervalSeconds);
  const positions: Cesium.Cartesian3[] = [];

  for (let i = 0; i <= totalSamples; i++) {
    const sampleTime = Cesium.JulianDate.addSeconds(
      startTime,
      i * sampleIntervalSeconds,
      new Cesium.JulianDate()
    );
    const pos = getPositionFromSatrec(satrec, sampleTime);
    if (pos) {
      positions.push(
        Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.altitude)
      );
    }
  }
  return positions;
}

/**
 * TLE로부터 궤도 경로 위치 배열 계산
 */
export function getOrbitPathPositionsFromTLE(
  tleText: string,
  centerTime: Cesium.JulianDate,
  durationHours: number,
  sampleIntervalMinutes: number
): Cesium.Cartesian3[] {
  const satrec = parseTleToSatrec(tleText);
  if (!satrec) return [];
  return getOrbitPathPositionsFromSatrec(satrec, centerTime, durationHours, sampleIntervalMinutes);
}
