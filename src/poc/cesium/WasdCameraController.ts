/**
 * WASD 키보드로 카메라 앞뒤좌우 이동
 */

const MOVE_SPEED = 1000; // 미터/프레임 (대략 60fps 기준, 궤도 고도에서 적당한 속도)

export function setupWasdCameraController(viewer: any): () => void {
  if (!viewer?.camera) return () => {};

  const keys: Record<string, boolean> = { w: false, a: false, s: false, d: false };

  const onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key?.toLowerCase();
    if (k === 'w' || k === 'a' || k === 's' || k === 'd') {
      keys[k] = true;
      e.preventDefault();
    }
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key?.toLowerCase();
    if (k === 'w' || k === 'a' || k === 's' || k === 'd') {
      keys[k] = false;
      e.preventDefault();
    }
  };

  const onPreRender = (): void => {
    if (!viewer?.camera || (!keys.w && !keys.a && !keys.s && !keys.d)) return;

    const cam = viewer.camera;
    const forward = cam.directionWC;
    const right = cam.rightWC;

    const delta = new Cesium.Cartesian3(0, 0, 0);
    if (keys.w) Cesium.Cartesian3.add(delta, forward, delta);
    if (keys.s) Cesium.Cartesian3.subtract(delta, forward, delta);
    if (keys.d) Cesium.Cartesian3.add(delta, right, delta);
    if (keys.a) Cesium.Cartesian3.subtract(delta, right, delta);

    const len = Cesium.Cartesian3.magnitude(delta);
    if (len > 1e-6) {
      Cesium.Cartesian3.normalize(delta, delta);
      Cesium.Cartesian3.multiplyByScalar(delta, MOVE_SPEED, delta);
      cam.position = Cesium.Cartesian3.add(cam.position, delta, new Cesium.Cartesian3());
    }
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  viewer.scene.preRender.addEventListener(onPreRender);

  return (): void => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    viewer?.scene?.preRender?.removeEventListener(onPreRender);
  };
}
