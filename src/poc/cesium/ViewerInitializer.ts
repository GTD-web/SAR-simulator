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
    viewer.clock.startTime = Cesium.JulianDate.addHours(now, -1, new Cesium.JulianDate());
    viewer.clock.stopTime = Cesium.JulianDate.addHours(now, 2, new Cesium.JulianDate());
    viewer.clock.currentTime = now.clone();
    
    // 깊이 테스트 비활성화
    viewer.scene.globe.depthTestAgainstTerrain = false;

    // 좌클릭 드래그로 카메라 방향(회전) 변경
    const controller = viewer.scene.screenSpaceCameraController;
    controller.enableRotate = true;
    controller.enableLook = true;
    controller.enableTranslate = true;

    // 위성 근접 시 모델이 사라지는 문제 방지
    const frustum = viewer.camera.frustum;
    if (frustum && frustum.near !== undefined) {
      frustum.near = 0.01; // near plane 1cm (기본 1m → 근접 뷰 허용)
    }
    controller.minimumZoomDistance = 0.5; // 최소 줌 거리 50cm (위성 근접 뷰 허용)
    controller.enableCollisionDetection = false; // 궤도 위성 뷰 시 카메라가 밀려나지 않도록

    return viewer;
  }
}
