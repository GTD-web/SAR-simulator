/**
 * TLE(Two-Line Element)를 궤도 6요소(Keplerian elements)로 변환
 */

import type { OrbitalElements } from './orbit-calculator.js';

const EARTH_GM_KM = 3.986004418e5; // 지구 중력 상수 (km³/s²)

/**
 * TLE 문자열을 파싱하여 line1, line2 반환
 */
function parseTLE(tleData: string): { line1: string; line2: string } | null {
  if (!tleData?.trim()) return null;
  const lines = tleData.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 2) {
    return { line1: lines[0], line2: lines[1] };
  }
  if (lines.length === 3) {
    return { line1: lines[1], line2: lines[2] };
  }
  return null;
}

/**
 * TLE를 궤도 6요소로 변환
 * @param tleData TLE 문자열 (2줄 또는 3줄)
 * @returns OrbitalElements 또는 null (파싱 실패 시)
 */
export function tleToOrbitalElements(tleData: string): OrbitalElements | null {
  const parsed = parseTLE(tleData);
  if (!parsed) return null;

  try {
    const line2 = parsed.line2;
    const fields = line2.split(/\s+/);
    if (fields.length < 8) return null;

    const inclination = parseFloat(fields[2]);
    const raan = parseFloat(fields[3]);
    const eccStr = fields[4];
    const argumentOfPerigee = parseFloat(fields[5]);
    const meanAnomaly = parseFloat(fields[6]);
    const meanMotion = parseFloat(fields[7]);

    if (
      isNaN(inclination) ||
      isNaN(raan) ||
      isNaN(argumentOfPerigee) ||
      isNaN(meanAnomaly) ||
      isNaN(meanMotion) ||
      meanMotion <= 0
    ) {
      return null;
    }

    // TLE 이심률: 0007588 → 0.0007588 (소수점 앞 0)
    const eccentricity = eccStr ? parseFloat('0.' + eccStr) : 0;
    if (isNaN(eccentricity) || eccentricity < 0 || eccentricity >= 1) return null;

    // Mean motion (rev/day) → semi-major axis (km)
    // n (rad/s) = meanMotion * 2π / 86400
    // a = (GM / n²)^(1/3)
    const nRadPerSec = (meanMotion * 2 * Math.PI) / 86400;
    const semiMajorAxis = Math.pow(EARTH_GM_KM / (nRadPerSec * nRadPerSec), 1 / 3);

    if (semiMajorAxis < 6378.137) return null; // 지구 반경 미만

    return {
      semiMajorAxis,
      eccentricity,
      inclination,
      raan,
      argumentOfPerigee,
      meanAnomaly,
    };
  } catch {
    return null;
  }
}
