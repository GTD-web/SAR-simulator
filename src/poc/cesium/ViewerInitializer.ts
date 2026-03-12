/**
 * Cesium 뷰어 초기화
 */
export class ViewerInitializer {
  /**
   * 뷰어 초기화
   */
  async initialize(containerId: string): Promise<any> {
    const viewer = new Cesium.Viewer(containerId, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      animation: true,
      timeline: true,
      vrButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
    });

    // Attribution/Credit 컨테이너 숨기기
    if (viewer.cesiumWidget && viewer.cesiumWidget.creditContainer) {
      viewer.cesiumWidget.creditContainer.style.display = 'none';
    }

    // 클럭 설정 (타임라인용 - 궤도 Apply 시 OrbitSettings에서 범위 갱신, 시작 시 정지 상태)
    viewer.clock.shouldAnimate = false;
    viewer.clock.multiplier = 1.0;
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    const now = Cesium.JulianDate.now();
    viewer.clock.startTime = Cesium.JulianDate.addSeconds(now, -3600, new Cesium.JulianDate());
    viewer.clock.stopTime = Cesium.JulianDate.addSeconds(now, 7200, new Cesium.JulianDate());
    viewer.clock.currentTime = now.clone();
    
    // 깊이 테스트 비활성화
    viewer.scene.globe.depthTestAgainstTerrain = false;

    // 위성 근접 뷰 시 depth 정밀도 개선 (Fly to Satellite 등)
    viewer.scene.logarithmicDepthBuffer = true;

    // 좌클릭 드래그로 카메라 방향(회전) 변경
    const controller = viewer.scene.screenSpaceCameraController;
    controller.enableRotate = true;
    controller.enableLook = true;
    controller.enableTranslate = true;

    // 위성 근접 시 모델이 사라지는 문제 방지
    const frustum = viewer.scene.camera.frustum;
    if (frustum && frustum.near !== undefined) {
      frustum.near = 0.01; // near plane 1cm (기본 1m → 근접 뷰 허용)
    }
    controller.minimumZoomDistance = 0.5;
    controller.enableCollisionDetection = false; // 궤도 위성 뷰 시 카메라 밀림 방지

    // 스크롤 줌 단위 축소
    controller.zoomFactor = 0.8;

    // Cesium 기본 wheel 줌 비활성화 (trackedEntity 시 pickPosition 버그 회피, setupZoomLimits가 대신 처리)
    controller.enableZoom = false;

    // 줌인/줌아웃 제한 (wheel 직접 처리, Cesium 기본 제한은 enableCollisionDetection 의존)
    setupZoomLimits(viewer, containerId);

    return viewer;
  }
}

const ZOOM_MIN_M = 0.5;
const ZOOM_MAX_M = 10_000_000;
const ZOOM_FACTOR = 0.0012;

/**
 * wheel 줌 핸들러 - moveForward/moveBackward로 거리만 변경
 * lookAt()을 사용하지 않아 카메라 lock이 발생하지 않음 → 회전 가능
 */
function setupZoomLimits(viewer: any, containerId: string): void {
  const container = document.getElementById(containerId);
  const canvas = viewer.scene.canvas;
  if (!container || !canvas) return;

  document.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (!container.contains(e.target as Node)) return;

      const cam = viewer.camera;
      let targetPos: Cesium.Cartesian3 | undefined;

      const entity = viewer.trackedEntity;
      if (entity?.position) {
        targetPos = entity.position.getValue(viewer.clock.currentTime);
      } else {
        const ray = cam.getPickRay(
          new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2)
        );
        if (ray) {
          targetPos = viewer.scene.globe.pick(ray, viewer.scene);
          if (!targetPos) {
            const intersection = (Cesium as any).IntersectionTests?.rayEllipsoid?.(
              ray,
              viewer.scene.globe.ellipsoid
            );
            if (intersection) {
              targetPos = (Cesium as any).Ray.getPoint(ray, intersection.start);
            }
          }
        }
      }

      if (!targetPos) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const range = Cesium.Cartesian3.distance(cam.positionWC, targetPos);
      if (range < 1e-6) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const delta = e.deltaY * ZOOM_FACTOR * range;
      const newRange = Math.max(ZOOM_MIN_M, Math.min(ZOOM_MAX_M, range + delta));
      const moveAmount = newRange - range;

      if (moveAmount > 0) {
        cam.moveBackward(moveAmount);
      } else if (moveAmount < 0) {
        cam.moveForward(-moveAmount);
      }

      e.preventDefault();
      e.stopPropagation();
      viewer.scene.requestRender();
    },
    { passive: false, capture: true }
  );
}
