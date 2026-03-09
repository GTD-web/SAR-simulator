/**
 * 궤도 6요소(Keplerian elements)를 TLE(Two-Line Element) 형식으로 변환
 * satellite.js SGP4 전파와 호환되도록 생성
 */

import type { OrbitalElements } from './orbit-calculator.js';

const EARTH_GM_KM = 3.986004418e5; // 지구 중력 상수 (km³/s²)

/**
 * TLE 체크섬 계산 (modulo 10)
 * 숫자는 그대로, 공백/문자/마침표/플러스=0, 마이너스=1
 */
function tleChecksum(line: string): number {
  let sum = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c >= '0' && c <= '9') {
      sum += parseInt(c, 10);
    } else if (c === '-') {
      sum += 1;
    }
    // 공백, 문자, 마침표, 플러스는 0
  }
  return sum % 10;
}

/**
 * 문자열을 지정된 길이로 패딩 (오른쪽 정렬, 공백 또는 0으로 채움)
 */
function padLeft(value: string, length: number, useZero = false): string {
  const pad = useZero ? '0' : ' ';
  return (pad.repeat(Math.max(0, length - value.length)) + value).slice(-length);
}

/**
 * 진근점이각(ν)을 평균근점이각(M)으로 변환 (라디안)
 */
function trueAnomalyToMeanAnomaly(trueAnomaly: number, eccentricity: number): number {
  const tanEHalf =
    Math.sqrt((1 - eccentricity) / (1 + eccentricity)) * Math.tan(trueAnomaly / 2);
  const E = 2 * Math.atan(tanEHalf);
  return E - eccentricity * Math.sin(E);
}

/**
 * 궤도 6요소와 epoch 시각으로 TLE 생성
 * @param elements 궤도 6요소
 * @param epochTime epoch 시각 (JulianDate)
 * @param satelliteName 위성 이름 (선택, 기본 "CUSTOM")
 * @param satelliteNumber NORAD 번호 (선택, 기본 99999)
 * @returns TLE 문자열 (3줄: 이름, Line1, Line2) 또는 null
 */
export function orbitalElementsToTLE(
  elements: OrbitalElements,
  epochTime: Cesium.JulianDate,
  satelliteName: string = 'CUSTOM',
  satelliteNumber: number = 99999
): string | null {
  try {
    const a = elements.semiMajorAxis; // km
    const e = Math.min(0.9999999, Math.max(0, elements.eccentricity));
    const i = elements.inclination;
    const raan = ((elements.raan % 360) + 360) % 360;
    const argPerigee = ((elements.argumentOfPerigee % 360) + 360) % 360;

    // 평균근점이각 계산 (TLE는 Mean Anomaly 사용)
    let meanAnomalyDeg: number;
    if (elements.meanAnomaly !== undefined) {
      meanAnomalyDeg = ((elements.meanAnomaly % 360) + 360) % 360;
    } else if (elements.trueAnomaly !== undefined) {
      const trueAnomalyRad = (elements.trueAnomaly * Math.PI) / 180;
      const meanAnomalyRad = trueAnomalyToMeanAnomaly(trueAnomalyRad, e);
      meanAnomalyDeg = (meanAnomalyRad * 180) / Math.PI;
      meanAnomalyDeg = ((meanAnomalyDeg % 360) + 360) % 360;
    } else {
      meanAnomalyDeg = 0;
    }

    // 평균 운동 (rev/day): n = sqrt(GM/a³) rad/s → rev/day = n * 86400 / (2π)
    const nRadPerSec = Math.sqrt(EARTH_GM_KM / (a * a * a));
    const meanMotion = (nRadPerSec * 86400) / (2 * Math.PI);

    // Epoch: 연도(2자리) + 일(1~366) + 소수
    const epochDate = Cesium.JulianDate.toDate(epochTime);
    const year = epochDate.getUTCFullYear();
    const year2 = year >= 2000 ? year - 2000 : year - 1900;
    if (year2 < 0 || year2 > 99) return null;

    const startOfYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const dayOfYear =
      Math.floor((epochDate.getTime() - startOfYear.getTime()) / 86400000) + 1;
    const dayFraction =
      (epochDate.getUTCHours() * 3600 +
        epochDate.getUTCMinutes() * 60 +
        epochDate.getUTCSeconds() +
        epochDate.getUTCMilliseconds() / 1000) /
      86400;
    const epochDay = dayOfYear + dayFraction;

    // Line 1 - Epoch: YY + DDD.DDDDDDDD (columns 19-32)
    const satNumStr = String(satelliteNumber).padStart(5, '0').slice(-5);
    const epochYearStr = String(year2).padStart(2, '0');
    const dayInt = Math.floor(epochDay);
    const dayFrac = epochDay - dayInt;
    const epochDayStr = `${String(dayInt).padStart(3, '0')}.${dayFrac.toFixed(8).slice(2, 10)}`;

    let line1 =
      `1 ${satNumStr}U 00000A   ${epochYearStr}${epochDayStr}  .00000000  00000-0  00000-0 0 0001`;
    line1 = line1.slice(0, 68) + String(tleChecksum(line1));

    // Line 2
    const incStr = i.toFixed(4).padStart(8);
    const raanStr = raan.toFixed(4).padStart(8);
    const eccStr = e.toFixed(7).replace('0.', '').padStart(7).slice(-7);
    const argPStr = argPerigee.toFixed(4).padStart(8);
    const meanAnomStr = meanAnomalyDeg.toFixed(4).padStart(8);
    const meanMotionStr = meanMotion.toFixed(8).padStart(11);
    const revNum = Math.floor(
      (epochDate.getTime() - startOfYear.getTime()) / 86400000 / (1440 / meanMotion)
    );
    const revStr = padLeft(String(Math.max(0, revNum)), 5, true);

    let line2 = `2 ${satNumStr} ${incStr} ${raanStr} ${eccStr} ${argPStr} ${meanAnomStr} ${meanMotionStr}${revStr}`;
    line2 = line2.slice(0, 68) + String(tleChecksum(line2));

    const nameLine = (satelliteName || 'CUSTOM').padEnd(24).slice(0, 24);
    return `${nameLine}\n${line1}\n${line2}`;
  } catch (err) {
    console.error('[orbitalElementsToTLE] 변환 실패:', err);
    return null;
  }
}
