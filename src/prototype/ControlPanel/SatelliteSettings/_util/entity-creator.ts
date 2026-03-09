import { SatelliteBusPayloadManager } from '../SatelliteBusPayloadManager/index.js';
import { parseSatelliteBasicInfo, parsePositionInputs, parseBusDimensionsInputs, parseBusOrientationInputs, parseAntennaDimensionsInputs, parseAntennaGapInput, parseAntennaOrientationInputs } from './input-parser.js';
import { CAMERA, DEFAULT_BUS_DIMENSIONS_MM } from '../constants.js';
import { setupCameraAngle as setupCamera } from './camera-manager.js';

/**
 * 엔티티 생성 유틸리티
 */

/**
 * 위성 엔티티 생성
 */
export function createSatelliteEntity(
  busPayloadManager: SatelliteBusPayloadManager | null,
  viewer: any,
  showAlert: boolean = true
): boolean {
  if (!busPayloadManager || !viewer) {
    if (showAlert) {
      alert('Cesium 뷰어가 초기화되지 않았습니다.');
    }
    return false;
  }

  // 입력값 가져오기
  const { name, id } = parseSatelliteBasicInfo();
  
  const position = parsePositionInputs();
  if (!position) {
    if (showAlert) {
      alert('위치 정보를 올바르게 입력해주세요.');
    }
    return false;
  }

  // 입력값 검증
  if (position.longitude < -180 || position.longitude > 180) {
    if (showAlert) {
      alert('경도는 -180 ~ 180 사이의 값이어야 합니다.');
    }
    return false;
  }
  if (position.latitude < -90 || position.latitude > 90) {
    if (showAlert) {
      alert('위도는 -90 ~ 90 사이의 값이어야 합니다.');
    }
    return false;
  }
  if (position.altitudeKm < 0) {
    if (showAlert) {
      alert('고도는 0 이상이어야 합니다.');
    }
    return false;
  }

  const busDimensions = parseBusDimensionsInputs();
  if (!busDimensions) {
    if (showAlert) {
      alert('BUS 크기를 올바르게 입력해주세요.');
    }
    return false;
  }

  const antennaDimensions = parseAntennaDimensionsInputs();
  if (!antennaDimensions) {
    if (showAlert) {
      alert('안테나 크기를 올바르게 입력해주세요.');
    }
    return false;
  }

  const antennaGap = parseAntennaGapInput();
  if (antennaGap === null) {
    if (showAlert) {
      alert('안테나 간격을 올바르게 입력해주세요.');
    }
    return false;
  }

  const antennaOrientation = parseAntennaOrientationInputs();
  if (!antennaOrientation) {
    if (showAlert) {
      alert('안테나 방향 정보를 올바르게 입력해주세요.');
    }
    return false;
  }

  // 엔티티 생성 (입력된 좌표와 고도에 생성)
  try {
    // km를 미터로 변환 (Cesium은 미터 단위 사용)
    const altitude = position.altitudeKm * 1000;

    const busOrientation = parseBusOrientationInputs();

    busPayloadManager.createSatellite(
      name,
      { longitude: position.longitude, latitude: position.latitude, altitude },
      busDimensions,
      {
        height: antennaDimensions.height,
        width: antennaDimensions.width,
        depth: antennaDimensions.depth,
        rollAngle: antennaOrientation.rollAngle,
        pitchAngle: antennaOrientation.pitchAngle,
        yawAngle: antennaOrientation.yawAngle,
        initialElevationAngle: antennaOrientation.initialElevationAngle,
        initialAzimuthAngle: antennaOrientation.initialAzimuthAngle,
      },
      antennaGap,
      busOrientation ?? undefined
    );

    if (showAlert) {
      alert('위성 엔티티가 생성되었습니다.');
    }
    return true;
  } catch (error) {
    console.error('[SatelliteSettings] 위성 엔티티 생성 오류:', error);
    if (showAlert) {
      alert('위성 엔티티 생성 중 오류가 발생했습니다: ' + (error as Error).message);
    }
    return false;
  }
}

/**
 * 카메라 거리 계산 (BUS 크기 기반)
 */
export function calculateCameraRange(): number {
  // BUS 크기 정보로 적절한 거리 계산 (mm를 미터로 변환)
  const busLengthMm = parseFloat((document.getElementById('prototypeBusLength') as HTMLInputElement)?.value || String(DEFAULT_BUS_DIMENSIONS_MM.LENGTH));
  const busWidthMm = parseFloat((document.getElementById('prototypeBusWidth') as HTMLInputElement)?.value || String(DEFAULT_BUS_DIMENSIONS_MM.WIDTH));
  const busHeightMm = parseFloat((document.getElementById('prototypeBusHeight') as HTMLInputElement)?.value || String(DEFAULT_BUS_DIMENSIONS_MM.HEIGHT));
  const maxBusSize = Math.max(busLengthMm, busWidthMm, busHeightMm) / 1000;
  
  // BUS 크기의 배수 거리에서 보면 적절함 (엔티티가 잘 보이도록)
  return Math.max(maxBusSize * CAMERA.RANGE_MULTIPLIER, CAMERA.MIN_RANGE);
}

/**
 * 카메라 각도 설정
 * @deprecated 이 함수는 camera-manager.ts의 setupCameraAngle로 이동되었습니다.
 * 호환성을 위해 유지되지만, 새로운 코드에서는 camera-manager를 사용하세요.
 */
export function setupCameraAngle(
  viewer: any,
  busEntity: any
): void {
  // camera-manager로 위임
  setupCamera(viewer, busEntity);
}
