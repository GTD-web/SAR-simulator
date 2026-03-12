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

    // trackedEntity 기반 카메라 추적 (delta 방식 - lookAt lock 없이 회전 가능)
    setupEntityTracking(viewer);

    return viewer;
  }
}

/**
 * trackedEntity 기반 카메라 추적
 * - preRender에서 entity 이동 delta만큼 카메라를 같이 이동 → entity가 화면에 고정됨
 * - lookAt 사용 안함 → lock 없음 → 드래그 회전 가능
 * - 드래그 중에는 스킵 → 회전 자유도 유지
 * - 50km 이상 순간이동(시뮬레이션 시작 시 위치 리셋 등)은 무시 → 점프 방지
 */
function setupEntityTracking(viewer: any): void {
  const canvas = viewer.scene.canvas;
  let lastEntityPosWC: Cesium.Cartesian3 | null = null;
  let isMouseDown = false;

  canvas.addEventListener('mousedown', () => {
    isMouseDown = true;
  });
  document.addEventListener('mouseup', () => {
    isMouseDown = false;
    lastEntityPosWC = null; // 드래그 후 현재 위치를 새 기준점으로
  });

  viewer.scene.preRender.addEventListener(() => {
    // viewer.trackedEntity가 외부에서 설정되면 _trackingTarget으로 이동
    // → Cesium 기본 lookAt 추적 비활성화, 우리의 delta 추적만 동작
    if (viewer.trackedEntity) {
      viewer._trackingTarget = viewer.trackedEntity;
      viewer.trackedEntity = undefined;
      lastEntityPosWC = null;
    }

    const entity = viewer._trackingTarget;
    if (!entity?.position) {
      lastEntityPosWC = null;
      return;
    }
    if (isMouseDown) {
      lastEntityPosWC = null;
      return;
    }

    const currentPosWC = entity.position.getValue(viewer.clock.currentTime);
    if (!currentPosWC) {
      lastEntityPosWC = null;
      return;
    }

    if (lastEntityPosWC) {
      const delta = Cesium.Cartesian3.subtract(
        currentPosWC,
        lastEntityPosWC,
        new Cesium.Cartesian3()
      );
      const deltaMag = Cesium.Cartesian3.magnitude(delta);

      // 정상 이동 범위(0.01m ~ 50km)만 추적 - 50km 초과는 시뮬 시작 점프로 간주해 무시
      if (deltaMag > 0.01 && deltaMag < 50_000) {
        const cam = viewer.camera;
        const newCamPosWC = Cesium.Cartesian3.add(
          cam.positionWC,
          delta,
          new Cesium.Cartesian3()
        );
        cam.setView({
          destination: newCamPosWC,
          orientation: {
            direction: cam.directionWC,
            up: cam.upWC,
          },
        });
      }
    }

    lastEntityPosWC = currentPosWC.clone();
  });
}

const ZOOM_MIN_M = 1_000; // 1.0km
const ZOOM_MAX_M = 20_000_000;
const ZOOM_FACTOR = 0.00008;

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

      if (moveAmount !== 0) {
        // target→camera 방향 유지, 거리만 스케일 → 카메라 각도 변경 없이 줌만 됨
        // setupEntityTracking의 delta 추적이 화면 고정을 담당하므로 direction 변경 불필요
        const targetToCamWC = Cesium.Cartesian3.subtract(
          cam.positionWC,
          targetPos,
          new Cesium.Cartesian3()
        );
        const scale = newRange / range;
        const newPosWC = Cesium.Cartesian3.add(
          targetPos,
          Cesium.Cartesian3.multiplyByScalar(targetToCamWC, scale, new Cesium.Cartesian3()),
          new Cesium.Cartesian3()
        );
        cam.setView({
          destination: newPosWC,
          orientation: { direction: cam.directionWC, up: cam.upWC },
        });
      }

      e.preventDefault();
      e.stopPropagation();
      viewer.scene.requestRender();
    },
    { passive: false, capture: true }
  );
}
