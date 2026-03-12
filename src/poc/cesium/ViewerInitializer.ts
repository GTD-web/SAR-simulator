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

    // 줌인/줌아웃 제한 (wheel 직접 처리, Cesium 기본 제한은 enableCollisionDetection 의존)
    setupZoomLimits(viewer);

    return viewer;
  }
}

const ZOOM_MIN_M = 0.5;
const ZOOM_MAX_M = 10_000_000;
const ZOOM_FACTOR = 0.0012;

/** wheel 줌에 거리 제한 적용 */
function setupZoomLimits(viewer: any): void {
  viewer.scene.canvas.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      const entity = viewer.trackedEntity;
      let targetPos: Cesium.Cartesian3 | undefined;
      let range: number;

      if (entity?.position) {
        const pos = entity.position.getValue(viewer.clock.currentTime);
        if (!pos) return;
        targetPos = pos;
      } else {
        const ray = viewer.camera.getPickRay(new Cesium.Cartesian2(
          viewer.scene.canvas.clientWidth / 2,
          viewer.scene.canvas.clientHeight / 2
        ));
        if (!ray) return;
        targetPos = viewer.scene.globe.pick(ray, viewer.scene);
        if (!targetPos) {
          const intersection = (Cesium as any).IntersectionTests?.rayEllipsoid?.(
            ray,
            viewer.scene.globe.ellipsoid
          );
          if (!intersection) return;
          targetPos = (Cesium as any).Ray.getPoint(ray, intersection.start);
        }
      }

      if (!targetPos) return;

      const camPos = viewer.camera.positionWC;
      range = Cesium.Cartesian3.distance(camPos, targetPos);
      if (range < 1e-6) return;

      const delta = e.deltaY * ZOOM_FACTOR * range;
      const newRange = Math.max(ZOOM_MIN_M, Math.min(ZOOM_MAX_M, range + delta));

      // 한계에 도달했으면 스크롤 이벤트 무시 (불필요한 lookAt/렌더 스킵)
      if (newRange === range) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const transform = Cesium.Transforms.eastNorthUpToFixedFrame(targetPos);
      const toCamera = Cesium.Cartesian3.subtract(camPos, targetPos, new Cesium.Cartesian3());
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
        targetPos,
        new Cesium.HeadingPitchRange(heading, pitch, newRange)
      );
      e.preventDefault();
      e.stopPropagation();
      viewer.scene.requestRender();
    },
    { passive: false, capture: true }
  );
}
