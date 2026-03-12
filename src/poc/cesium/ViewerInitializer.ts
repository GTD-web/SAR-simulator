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
    controller.minimumZoomDistance = 0.5; // 최소 줌 거리 50cm (위성 근접 뷰 허용)
    controller.enableCollisionDetection = false; // 궤도 위성 뷰 시 카메라가 밀려나지 않도록

    // 스크롤 줌 단위 축소 (기본 5.0 → 0.5, 값이 작을수록 스크롤당 변화량 감소)
    controller.zoomFactor = 0.8;

    // trackedEntity 고정 시: wheel 줌을 위성 기준으로 직접 처리 + 거리 제한
    // (Cesium pickPosition 버그·enableCollisionDetection 미적용으로 기본 줌 제한이 동작하지 않음)
    setupTrackedEntityZoomWithLimits(viewer);

    return viewer;
  }
}

const TRACKING_MIN_ZOOM_M = 0.5;
const TRACKING_MAX_ZOOM_M = 200_000; // 위성 고정 시 최대 줌 아웃 거리 300km
const TRACKING_ZOOM_FACTOR = 0.0012;

/** trackedEntity 설정 시 wheel 줌을 위성 기준으로 처리하고 거리 제한 적용 */
function setupTrackedEntityZoomWithLimits(viewer: any): void {
  viewer.scene.canvas.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      const entity = viewer.trackedEntity;
      if (!entity?.position) return;

      const time = viewer.clock.currentTime;
      const pos = entity.position.getValue(time);
      if (!pos) return;

      e.preventDefault();
      e.stopPropagation();

      const camPos = viewer.camera.positionWC;
      const range = Cesium.Cartesian3.distance(camPos, pos);
      const delta = e.deltaY * TRACKING_ZOOM_FACTOR * range;
      const newRange = Math.max(
        TRACKING_MIN_ZOOM_M,
        Math.min(TRACKING_MAX_ZOOM_M, range + delta)
      );

      const transform = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
      const toCamera = Cesium.Cartesian3.subtract(camPos, pos, new Cesium.Cartesian3());
      const invTransform = (Cesium.Matrix4 as any).inverseTransformation(
        transform,
        new Cesium.Matrix4()
      );
      const local = Cesium.Matrix4.multiplyByPoint(
        invTransform,
        toCamera,
        new Cesium.Cartesian3()
      );
      const heading = Math.atan2(local.x, local.y);
      const mag = Cesium.Cartesian3.magnitude(toCamera);
      const pitch = mag > 0 ? Math.asin(Math.max(-1, Math.min(1, local.z / mag))) : 0;

      viewer.camera.lookAt(
        pos,
        new Cesium.HeadingPitchRange(heading, pitch, newRange)
      );
      viewer.scene.requestRender();
    },
    { passive: false, capture: true }
  );
}
