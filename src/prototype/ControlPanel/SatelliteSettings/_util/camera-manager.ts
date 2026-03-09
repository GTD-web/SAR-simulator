import { CAMERA, TIMER } from '../constants.js';
import { calculateCameraRange } from './entity-creator.js';

/**
 * 카메라 관리 유틸리티
 */

/**
 * 카메라가 준비될 때까지 대기 (초기 애니메이션 완료 대기)
 */
export function waitForCameraReady(
  viewer: any,
  callback: () => void
): void {
  if (!viewer) {
    callback();
    return;
  }

  // 카메라 이동이 완료되었는지 확인하는 함수
  const checkCameraReady = () => {
    // 카메라가 이동 중인지 확인
    const isMoving = viewer.camera._flight && viewer.camera._flight.isActive();
    
    if (!isMoving) {
      // 카메라 이동이 완료되었거나 이동 중이 아니면
      // 추가로 씬 렌더링이 완료될 때까지 약간 대기
      setTimeout(() => {
        callback();
      }, TIMER.CAMERA_READY_DELAY);
    } else {
      // 아직 이동 중이면 다시 확인
      setTimeout(checkCameraReady, TIMER.CAMERA_CHECK_INTERVAL);
    }
  };

  // 초기 지연 후 확인 시작 (Cesium 초기화 시간 고려)
  setTimeout(() => {
    checkCameraReady();
  }, TIMER.CAMERA_INIT_DELAY);
}

/**
 * 카메라 각도 설정
 * @returns setTimeout 타이머 ID (취소 가능하도록)
 */
export function setupCameraAngle(
  viewer: any,
  busEntity: any
): number | null {
  if (!viewer || !busEntity) {
    console.error('[setupCameraAngle] viewer 또는 busEntity가 없습니다.');
    return null;
  }

  viewer.trackedEntity = undefined;
  restoreZoomDistance(viewer);

  const busPosition = busEntity.position?.getValue(Cesium.JulianDate.now());
  if (!busPosition) {
    console.error('[setupCameraAngle] BUS 위치를 가져올 수 없습니다.');
    return null;
  }

  return flyToPosition(viewer, busPosition);
}

/**
 * 카메라를 지정한 Cartesian3 위치로 즉시 이동 (위성 설정과 동일한 시점/거리)
 * @returns null (즉시 이동이므로 타이머 없음)
 */
export function flyToPosition(viewer: any, position: Cesium.Cartesian3): number | null {
  if (!viewer || !position) {
    return null;
  }

  viewer.trackedEntity = undefined;
  restoreZoomDistance(viewer);
  const cameraRange = calculateCameraRange();

  try {
    if (viewer.camera._flight && viewer.camera._flight.isActive()) {
      viewer.camera.cancelFlight();
    }

    viewer.camera.lookAt(
      position,
      new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(CAMERA.HEADING_DEGREES),
        Cesium.Math.toRadians(CAMERA.PITCH_DEGREES),
        cameraRange
      )
    );
    return null;
  } catch (error) {
    console.error('[flyToPosition] 카메라 이동 오류:', error);
    return null;
  }
}

/**
 * 카메라를 엔티티에 즉시 고정 (애니메이션 없이)
 */
export function setCameraToEntity(
  viewer: any,
  busEntity: any,
  cameraRange?: number
): void {
  if (!viewer || !busEntity) {
    return;
  }

  viewer.trackedEntity = undefined;
  restoreZoomDistance(viewer);

  const busPosition = busEntity.position?.getValue(Cesium.JulianDate.now());
  if (!busPosition) {
    return;
  }

  // 카메라 거리 계산
  const range = cameraRange ?? calculateCameraRange();

  // 기존 카메라 애니메이션 취소
  if (viewer.camera._flight && viewer.camera._flight.isActive()) {
    viewer.camera.cancelFlight();
  }

  // lookAt으로 바로 이동 (애니메이션 없이)
  try {
    viewer.camera.lookAt(
      busPosition,
      new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(CAMERA.HEADING_DEGREES),
        Cesium.Math.toRadians(CAMERA.PITCH_DEGREES),
        range
      )
    );
  } catch (error) {
    console.error('[setCameraToEntity] 카메라 이동 오류:', error);
  }
}

/**
 * 카메라를 엔티티에 수평선 뷰로 설정 (moveSatelliteToEarth에서 사용)
 */
export function setCameraToEntityHorizontal(
  viewer: any,
  busEntity: any,
  busDimensionsMm: { length: number; width: number; height: number }
): void {
  if (!viewer || !busEntity) {
    return;
  }

  viewer.trackedEntity = undefined;
  restoreZoomDistance(viewer);

  const busPosition = busEntity.position?.getValue(Cesium.JulianDate.now());
  if (!busPosition) {
    return;
  }

  // BUS 크기 정보로 적절한 거리 계산 (mm를 미터로 변환)
  const maxBusSize = Math.max(busDimensionsMm.length, busDimensionsMm.width, busDimensionsMm.height) / 1000;
  const cameraRange = Math.max(maxBusSize * CAMERA.RANGE_MULTIPLIER_HORIZONTAL, CAMERA.MIN_RANGE_HORIZONTAL);

  // 엔티티 생성 시와 동일한 카메라 각도 설정
  setTimeout(() => {
    try {
      viewer.camera.lookAt(
        busPosition,
        new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(CAMERA.HEADING_DEGREES),
          Cesium.Math.toRadians(CAMERA.PITCH_DEGREES_HORIZONTAL),
          cameraRange
        )
      );
    } catch (error) {
      console.error('[setCameraToEntityHorizontal] 카메라 이동 오류:', error);
    }
  }, TIMER.CAMERA_ANIMATION_CANCEL_DELAY);
}

/**
 * 엔티티로 카메라 이동 후 추적 (trackedEntity 설정, flyToPosition 호출 안 함)
 */
export function zoomToEntityAndTrack(
  viewer: any,
  entity: any,
  cameraRange?: number
): void {
  if (!viewer || !entity) return;
  const range = cameraRange ?? calculateCameraRange();
  const offset = new Cesium.HeadingPitchRange(
    Cesium.Math.toRadians(CAMERA.HEADING_DEGREES),
    Cesium.Math.toRadians(CAMERA.PITCH_DEGREES),
    range
  );
  viewer.zoomTo(entity, { offset });
  viewer.trackedEntity = entity;
  viewer.scene.screenSpaceCameraController.maximumZoomDistance =
    CAMERA.MAX_ZOOM_DISTANCE_WHEN_TRACKING;
}

/**
 * 줌 거리 제한 해제 (trackedEntity 해제 시 호출)
 */
export function restoreZoomDistance(viewer: any): void {
  if (viewer?.scene?.screenSpaceCameraController) {
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = Number.POSITIVE_INFINITY;
  }
}

/**
 * Cesium 캔버스 포커스 설정 (포커스를 가져가지 않도록)
 */
export function setupCanvasFocus(viewer: any): void {
  const cesiumCanvas = viewer?.canvas;
  if (cesiumCanvas) {
    cesiumCanvas.setAttribute('tabindex', '-1');
    cesiumCanvas.style.outline = 'none';
  }
}
