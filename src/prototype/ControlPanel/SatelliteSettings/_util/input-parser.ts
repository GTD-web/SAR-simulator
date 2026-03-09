/**
 * 입력값 파싱 및 검증 유틸리티
 */

/**
 * 위치 정보 파싱
 */
export function parsePositionInputs(): {
  longitude: number;
  latitude: number;
  altitudeKm: number;
} | null {
  const lonInput = (document.getElementById('prototypeSatelliteLongitude') as HTMLInputElement)?.value;
  const latInput = (document.getElementById('prototypeSatelliteLatitude') as HTMLInputElement)?.value;
  const altInput = (document.getElementById('prototypeSatelliteAltitude') as HTMLInputElement)?.value;

  if (!lonInput || !latInput || !altInput) {
    return null;
  }

  const longitude = parseFloat(lonInput);
  const latitude = parseFloat(latInput);
  const altitudeKm = parseFloat(altInput);

  // 입력값 검증 (NaN 체크 포함)
  if (isNaN(longitude) || isNaN(latitude) || isNaN(altitudeKm) ||
      longitude < -180 || longitude > 180 ||
      latitude < -90 || latitude > 90 ||
      altitudeKm < 0) {
    return null;
  }

  return { longitude, latitude, altitudeKm };
}

/**
 * BUS 크기 파싱
 */
export function parseBusDimensionsInputs(): {
  length: number;
  width: number;
  height: number;
} | null {
  const busLengthInput = (document.getElementById('prototypeBusLength') as HTMLInputElement)?.value;
  const busWidthInput = (document.getElementById('prototypeBusWidth') as HTMLInputElement)?.value;
  const busHeightInput = (document.getElementById('prototypeBusHeight') as HTMLInputElement)?.value;

  if (!busLengthInput || !busWidthInput || !busHeightInput) {
    return null;
  }

  const busLengthMm = parseFloat(busLengthInput);
  const busWidthMm = parseFloat(busWidthInput);
  const busHeightMm = parseFloat(busHeightInput);

  if (isNaN(busLengthMm) || isNaN(busWidthMm) || isNaN(busHeightMm) ||
      busLengthMm <= 0 || busWidthMm <= 0 || busHeightMm <= 0) {
    return null;
  }

  // mm를 미터로 변환
  return {
    length: busLengthMm / 1000,
    width: busWidthMm / 1000,
    height: busHeightMm / 1000
  };
}

/**
 * BUS 방향 파싱
 */
export function parseBusOrientationInputs(): {
  rollAngle: number;
  pitchAngle: number;
  yawAngle: number;
} | null {
  const busRollInput = (document.getElementById('prototypeBusRoll') as HTMLInputElement)?.value;
  const busPitchInput = (document.getElementById('prototypeBusPitch') as HTMLInputElement)?.value;
  const busYawInput = (document.getElementById('prototypeBusYaw') as HTMLInputElement)?.value;

  if (busRollInput === undefined || busPitchInput === undefined || busYawInput === undefined) {
    return null;
  }

  const busRoll = parseFloat(busRollInput || '0');
  const busPitch = parseFloat(busPitchInput || '0');
  const busYaw = parseFloat(busYawInput || '0');

  if (isNaN(busRoll) || isNaN(busPitch) || isNaN(busYaw)) {
    return null;
  }

  return {
    rollAngle: busRoll,
    pitchAngle: busPitch,
    yawAngle: busYaw
  };
}

/**
 * 안테나 크기 파싱
 */
export function parseAntennaDimensionsInputs(): {
  height: number;
  width: number;
  depth: number;
} | null {
  const antennaHeightInput = (document.getElementById('prototypeAntennaHeight') as HTMLInputElement)?.value;
  const antennaWidthInput = (document.getElementById('prototypeAntennaWidth') as HTMLInputElement)?.value;
  const antennaDepthInput = (document.getElementById('prototypeAntennaDepth') as HTMLInputElement)?.value;

  if (!antennaHeightInput || !antennaWidthInput || !antennaDepthInput) {
    return null;
  }

  const antennaHeightMm = parseFloat(antennaHeightInput);
  const antennaWidthMm = parseFloat(antennaWidthInput);
  const antennaDepthMm = parseFloat(antennaDepthInput);

  if (isNaN(antennaHeightMm) || isNaN(antennaWidthMm) || isNaN(antennaDepthMm) ||
      antennaHeightMm <= 0 || antennaWidthMm <= 0 || antennaDepthMm <= 0) {
    return null;
  }

  // mm를 미터로 변환
  return {
    height: antennaHeightMm / 1000,
    width: antennaWidthMm / 1000,
    depth: antennaDepthMm / 1000
  };
}

/**
 * 안테나 간격 파싱
 */
export function parseAntennaGapInput(): number | null {
  const antennaGapInput = (document.getElementById('prototypeAntennaGap') as HTMLInputElement)?.value;

  if (antennaGapInput === undefined || antennaGapInput === '') {
    return null;
  }

  const antennaGapMm = parseFloat(antennaGapInput);

  if (isNaN(antennaGapMm) || antennaGapMm < 0) {
    return null;
  }

  // mm를 미터로 변환
  return antennaGapMm / 1000;
}

/**
 * 안테나 방향 파싱
 */
export function parseAntennaOrientationInputs(): {
  rollAngle: number;
  pitchAngle: number;
  yawAngle: number;
  initialElevationAngle: number;
  initialAzimuthAngle: number;
} | null {
  const antennaRollInput = (document.getElementById('prototypeAntennaRoll') as HTMLInputElement)?.value;
  const antennaPitchInput = (document.getElementById('prototypeAntennaPitch') as HTMLInputElement)?.value;
  const antennaYawInput = (document.getElementById('prototypeAntennaYaw') as HTMLInputElement)?.value;
  const antennaElevationInput = (document.getElementById('prototypeAntennaElevation') as HTMLInputElement)?.value;
  const antennaAzimuthInput = (document.getElementById('prototypeAntennaAzimuth') as HTMLInputElement)?.value;

  if (antennaRollInput === undefined || antennaPitchInput === undefined || antennaYawInput === undefined ||
      antennaElevationInput === undefined || antennaAzimuthInput === undefined) {
    return null;
  }

  const antennaRoll = parseFloat(antennaRollInput || '0');
  const antennaPitch = parseFloat(antennaPitchInput || '0');
  const antennaYaw = parseFloat(antennaYawInput || '0');
  const antennaElevation = parseFloat(antennaElevationInput || '0');
  const antennaAzimuth = parseFloat(antennaAzimuthInput || '0');

  // NaN 체크
  if (isNaN(antennaRoll) || isNaN(antennaPitch) || isNaN(antennaYaw) ||
      isNaN(antennaElevation) || isNaN(antennaAzimuth)) {
    return null;
  }

  return {
    rollAngle: antennaRoll,
    pitchAngle: antennaPitch,
    yawAngle: antennaYaw,
    initialElevationAngle: antennaElevation,
    initialAzimuthAngle: antennaAzimuth
  };
}

import { DEFAULT_SATELLITE_INFO } from '../constants.js';

/**
 * 위성 기본 정보 파싱
 */
export function parseSatelliteBasicInfo(): {
  name: string;
  id: string;
} {
  // 입력 필드가 없으므로 기본값 사용
  const name = (document.getElementById('prototypeSatelliteName') as HTMLInputElement)?.value || DEFAULT_SATELLITE_INFO.NAME;
  const id = (document.getElementById('prototypeSatelliteId') as HTMLInputElement)?.value || DEFAULT_SATELLITE_INFO.ID;
  return { name, id };
}
