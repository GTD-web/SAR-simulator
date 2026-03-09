/**
 * 궤도 설정 탭 전용 카메라 추적 (위성 엔티티 따라가기)
 */

import { restoreZoomDistance } from '../../SatelliteSettings/_util/camera-manager.js';
import { CAMERA } from '../../SatelliteSettings/constants.js';

const DEFAULT_RANGE = 30; // 기본 카메라 거리 (m)

export interface OrbitCameraTrackingOptions {
  viewer: any;
}

/**
 * 궤도 설정 탭에서 위성 엔티티를 추적하는 카메라 관리
 */
export class OrbitCameraTracking {
  private viewer: any;
  private cameraTrackingHandler: (() => void) | null = null;

  constructor(options: OrbitCameraTrackingOptions) {
    this.viewer = options.viewer;
  }

  /**
   * 카메라 추적 중지 (postRender 핸들러 제거)
   */
  stop(): void {
    if (this.cameraTrackingHandler && this.viewer) {
      this.viewer.scene.postRender.removeEventListener(this.cameraTrackingHandler);
      this.cameraTrackingHandler = null;
    }
    if (this.viewer) {
      this.viewer.trackedEntity = undefined;
      restoreZoomDistance(this.viewer);
    }
  }

  /**
   * 카메라 추적 시작 (postRender에서 매 프레임 위성 위치로 lookAt)
   * 드래그로 시점 회전은 유지, 줌은 maximumZoomDistance로 제한
   */
  start(busEntity: any): void {
    this.stop();
    if (!this.viewer || !busEntity) return;

    let currentHeading = Cesium.Math.toRadians(CAMERA.HEADING_DEGREES);
    let currentPitch = Cesium.Math.toRadians(CAMERA.PITCH_DEGREES);
    let currentRange = DEFAULT_RANGE;

    this.cameraTrackingHandler = () => {
      const pos = busEntity.position?.getValue(this.viewer.clock.currentTime);
      if (!pos) return;
      try {
        const camPos = this.viewer.camera.positionWC;
        const offset = Cesium.Cartesian3.subtract(camPos, pos, new Cesium.Cartesian3());
        const dist = Cesium.Cartesian3.magnitude(offset);
        if (dist > 1) {
          const carto = Cesium.Cartographic.fromCartesian(pos);
          const lon = carto.longitude;
          const lat = carto.latitude;
          const sinLon = Math.sin(lon);
          const cosLon = Math.cos(lon);
          const sinLat = Math.sin(lat);
          const cosLat = Math.cos(lat);
          const east = new Cesium.Cartesian3(-sinLon, cosLon, 0);
          const north = new Cesium.Cartesian3(-sinLat * cosLon, -sinLat * sinLon, cosLat);
          const up = new Cesium.Cartesian3(cosLat * cosLon, cosLat * sinLon, sinLat);
          const offsetEast = Cesium.Cartesian3.dot(offset, east);
          const offsetNorth = Cesium.Cartesian3.dot(offset, north);
          const offsetUp = Cesium.Cartesian3.dot(offset, up);
          currentHeading = Math.atan2(offsetEast, offsetNorth);
          const pitchVal = offsetUp / dist;
          currentPitch = Math.asin(pitchVal < -1 ? -1 : pitchVal > 1 ? 1 : pitchVal);
          currentRange = Math.min(dist, CAMERA.MAX_ZOOM_DISTANCE_WHEN_TRACKING);
        }
        this.viewer.camera.lookAt(
          pos,
          new Cesium.HeadingPitchRange(currentHeading, currentPitch, currentRange)
        );
      } catch {
        // ignore
      }
    };
    this.viewer.scene.postRender.addEventListener(this.cameraTrackingHandler);
    this.viewer.scene.screenSpaceCameraController.maximumZoomDistance =
      CAMERA.MAX_ZOOM_DISTANCE_WHEN_TRACKING;
  }
}
