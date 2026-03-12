/**
 * 궤도 설정 폼 파싱 유틸리티
 */

import type { OrbitalElements } from './orbit-calculator.js';

/** 폼 요소 ID 상수 */
export const ORBIT_FORM_IDS = {
  SEMI_MAJOR_AXIS: 'prototypeOrbitSemiMajorAxis',
  ECCENTRICITY: 'prototypeOrbitEccentricity',
  INCLINATION: 'prototypeOrbitInclination',
  RAAN: 'prototypeOrbitRAAN',
  ARGUMENT_OF_PERIGEE: 'prototypeOrbitArgumentOfPerigee',
  ANOMALY_TYPE: 'prototypeOrbitAnomalyType',
  ANOMALY: 'prototypeOrbitAnomaly',
  INITIAL_DATE: 'prototypeOrbitInitialDate',
  INITIAL_TIME: 'prototypeOrbitInitialTime',
} as const;

export interface ParsedOrbitForm {
  elements: OrbitalElements;
  epochTime: Cesium.JulianDate;
}

/**
 * 폼에서 궤도 6요소와 초기 시각(epoch)을 읽어 반환. 유효하지 않으면 null.
 */
export function getElementsAndEpochTimeFromForm(
  root: HTMLElement | Document,
  fallbackTime?: Cesium.JulianDate
): ParsedOrbitForm | null {
  const semiMajorAxis = parseFloat(
    (root.querySelector(`#${ORBIT_FORM_IDS.SEMI_MAJOR_AXIS}`) as HTMLInputElement)?.value || '6878.137'
  );
  const eccentricity = parseFloat(
    (root.querySelector(`#${ORBIT_FORM_IDS.ECCENTRICITY}`) as HTMLInputElement)?.value || '0.0'
  );
  if (semiMajorAxis < 6378.137 || eccentricity < 0 || eccentricity >= 1) {
    return null;
  }
  const inclination = parseFloat(
    (root.querySelector(`#${ORBIT_FORM_IDS.INCLINATION}`) as HTMLInputElement)?.value || '98.0'
  );
  const raan = parseFloat(
    (root.querySelector(`#${ORBIT_FORM_IDS.RAAN}`) as HTMLInputElement)?.value || '0.0'
  );
  const argumentOfPerigee = parseFloat(
    (root.querySelector(`#${ORBIT_FORM_IDS.ARGUMENT_OF_PERIGEE}`) as HTMLInputElement)?.value || '0.0'
  );
  const anomalyType =
    (root.querySelector(`#${ORBIT_FORM_IDS.ANOMALY_TYPE}`) as HTMLSelectElement)?.value || 'true';
  const anomaly = parseFloat(
    (root.querySelector(`#${ORBIT_FORM_IDS.ANOMALY}`) as HTMLInputElement)?.value || '0.0'
  );
  const elements: OrbitalElements = {
    semiMajorAxis,
    eccentricity,
    inclination,
    raan,
    argumentOfPerigee,
  };
  if (anomalyType === 'true') {
    elements.trueAnomaly = anomaly;
  } else {
    elements.meanAnomaly = anomaly;
  }
  const initialDateStr = (
    root.querySelector(`#${ORBIT_FORM_IDS.INITIAL_DATE}`) as HTMLInputElement
  )?.value?.trim();
  const initialTimeStr = (
    root.querySelector(`#${ORBIT_FORM_IDS.INITIAL_TIME}`) as HTMLInputElement
  )?.value?.trim();
  // date(YYYY-MM-DD) + time(HH:mm 또는 HH:mm:ss) → UTC ISO 문자열
  const timePart = initialTimeStr && /^\d{1,2}:\d{2}(:\d{2})?$/.test(initialTimeStr)
    ? initialTimeStr.length === 5 ? `${initialTimeStr}:00` : initialTimeStr
    : '00:00:00';
  const utcIsoStr = initialDateStr ? `${initialDateStr}T${timePart}Z` : '';
  const initialDateTimeValid =
    utcIsoStr !== '' && utcIsoStr !== 'T00:00:00Z' &&
    !Number.isNaN(new Date(utcIsoStr).getTime());
  const epochTime = initialDateTimeValid
    ? Cesium.JulianDate.fromDate(new Date(utcIsoStr))
    : fallbackTime ?? Cesium.JulianDate.now();
  return { elements, epochTime };
}
