import type { SatelliteBusPayloadManager } from '../SatelliteBusPayloadManager/index.js';
import { createAxisEntities } from '../SatelliteBusPayloadManager/_ui/axis-creator.js';

const MINI_MAP_SIZE = 240;
const DEFAULT_CAMERA_OFFSET_M = 3;

/** 카메라 방향 가중치: above(-Z), behind(-X), left(-Y). 위에서 내려다보며 Z축이 화면 아래로 향함 */
const DEFAULT_CAMERA_WEIGHTS = { above: 1.5, behind: 0.5, left: 0.5 };

const DEFAULT_POSITION = Cesium.Cartesian3.fromDegrees(0, 0, 0);
const DEFAULT_ORIENTATION = Cesium.Quaternion.IDENTITY;
const DEFAULT_DIMENSIONS = new Cesium.Cartesian3(1, 0.5, 0.5);
const DEFAULT_ANTENNA_DIMENSIONS = new Cesium.Cartesian3(0.5, 0.5, 0.5);
const AXIS_LENGTH = 1;

/**
 * 위성 자세를 우측 하단에 보여주는 미니 3D 뷰
 */
export class AttitudeMiniMapViewer {
  private mainViewer: any;
  private busPayloadManager: SatelliteBusPayloadManager | null;
  private miniContainer: HTMLElement | null;
  private miniViewer: any;
  private satelliteEntity: any;
  private antennaEntity: any;
  private axisEntities: { xAxis: any; yAxis: any; zAxis: any; xLabel: any; yLabel: any; zLabel: any } | null;
  private postRenderRemove: (() => void) | null;
  private cameraOffsetM: number;
  private cameraWeights: { above: number; behind: number; left: number };

  constructor(mainViewer: any, busPayloadManager: SatelliteBusPayloadManager | null) {
    this.mainViewer = mainViewer;
    this.busPayloadManager = busPayloadManager;
    this.miniContainer = null;
    this.miniViewer = null;
    this.satelliteEntity = null;
    this.antennaEntity = null;
    this.axisEntities = null;
    this.postRenderRemove = null;
    this.cameraOffsetM = DEFAULT_CAMERA_OFFSET_M;
    this.cameraWeights = { ...DEFAULT_CAMERA_WEIGHTS };
  }

  /**
   * 카메라 거리 설정 (위성으로부터의 거리, m)
   */
  setCameraOffset(meters: number): void {
    this.cameraOffsetM = Math.max(1, meters);
  }

  /**
   * 카메라 방향 가중치 설정
   * @param above 위쪽(-Z) 가중치, 기본 1
   * @param behind 뒤쪽(-X) 가중치, 기본 0.5
   * @param left 왼쪽(-Y) 가중치, 기본 0.5
   */
  setCameraWeights(above: number, behind: number, left: number): void {
    this.cameraWeights = { above, behind, left };
  }

  /**
   * 미니맵 초기화
   */
  init(): void {
    if (!this.mainViewer || !this.busPayloadManager) return;

    this.createMiniMapContainer();
    this.createMiniViewer();
    this.createSatelliteEntity();
    this.createAntennaEntity();
    this.createAxisEntities();
    this.setupCameraUpdate();
  }

  private createMiniMapContainer(): void {
    const existing = document.getElementById('attitudeMiniMapContainer');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'attitudeMiniMapContainer';
    container.className = 'attitude-mini-map-container';
    container.style.cssText = `
      position: fixed;
      bottom: 70px;
      right: 12px;
      width: ${MINI_MAP_SIZE}px;
      height: ${MINI_MAP_SIZE}px;
      z-index: 1000;
      border: 2px solid rgba(255, 255, 255, 0.5);
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
      background: rgba(20, 20, 20, 0.9);
    `;

    const label = document.createElement('div');
    label.className = 'attitude-mini-map-label';
    label.textContent = '자세';
    label.style.cssText = `
      position: absolute;
      top: 4px;
      left: 4px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.9);
      z-index: 10;
      pointer-events: none;
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    `;
    container.appendChild(label);

    const cesiumDiv = document.createElement('div');
    cesiumDiv.id = 'attitudeMiniMapCesium';
    cesiumDiv.style.cssText = 'width: 100%; height: 100%;';
    container.appendChild(cesiumDiv);

    document.body.appendChild(container);
    this.miniContainer = container;
  }

  private createMiniViewer(): void {
    const cesiumDiv = document.getElementById('attitudeMiniMapCesium');
    if (!cesiumDiv || !this.mainViewer) return;

    this.miniViewer = new Cesium.Viewer(cesiumDiv, {
      clock: this.mainViewer.clock,
      animation: false,
      timeline: false,
      vrButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      creditContainer: undefined,
      useDefaultRenderLoop: true,
      requestRenderMode: false,
    });

    if (this.miniViewer.cesiumWidget?.creditContainer) {
      this.miniViewer.cesiumWidget.creditContainer.style.display = 'none';
    }

    this.miniViewer.scene.globe.depthTestAgainstTerrain = false;
    this.miniViewer.scene.globe.enableLighting = false;
  }

  private createSatelliteEntity(): void {
    if (!this.miniViewer || !this.busPayloadManager || !this.mainViewer) return;

    const busPayloadManager = this.busPayloadManager;
    const mainViewer = this.mainViewer;

    this.satelliteEntity = this.miniViewer.entities.add({
      name: 'AttitudeMiniMapSatellite',
      show: new Cesium.CallbackProperty(
        () => !!busPayloadManager?.getBusEntity?.(),
        false
      ),
      position: new Cesium.CallbackProperty(() => {
        const busEntity = busPayloadManager?.getBusEntity?.();
        if (!busEntity?.position) return DEFAULT_POSITION;
        const t = mainViewer?.clock?.currentTime ?? Cesium.JulianDate.now();
        try {
          return busEntity.position.getValue(t) ?? DEFAULT_POSITION;
        } catch {
          return DEFAULT_POSITION;
        }
      }, false),
      orientation: new Cesium.CallbackProperty(() => {
        const busEntity = busPayloadManager?.getBusEntity?.();
        if (!busEntity?.orientation) return DEFAULT_ORIENTATION;
        const t = mainViewer?.clock?.currentTime ?? Cesium.JulianDate.now();
        try {
          return busEntity.orientation.getValue(t) ?? DEFAULT_ORIENTATION;
        } catch {
          return DEFAULT_ORIENTATION;
        }
      }, false),
      box: {
        dimensions: new Cesium.CallbackProperty(() => {
          const busEntity = busPayloadManager?.getBusEntity?.();
          if (!busEntity?.box?.dimensions) return DEFAULT_DIMENSIONS;
        const t = mainViewer?.clock?.currentTime ?? Cesium.JulianDate.now();
        try {
          return busEntity.box.dimensions.getValue(t) ?? DEFAULT_DIMENSIONS;
          } catch {
            return DEFAULT_DIMENSIONS;
          }
        }, false),
        material: Cesium.Color.GRAY.withAlpha(0.8),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
    });
  }

  private createAntennaEntity(): void {
    if (!this.miniViewer || !this.busPayloadManager || !this.mainViewer) return;

    const busPayloadManager = this.busPayloadManager;
    const mainViewer = this.mainViewer;

    this.antennaEntity = this.miniViewer.entities.add({
      name: 'AttitudeMiniMapAntenna',
      show: new Cesium.CallbackProperty(
        () => !!busPayloadManager?.getAntennaEntity?.(),
        false
      ),
      position: new Cesium.CallbackProperty(() => {
        const antennaEntity = busPayloadManager?.getAntennaEntity?.();
        if (!antennaEntity?.position) return DEFAULT_POSITION;
        const t = mainViewer?.clock?.currentTime ?? Cesium.JulianDate.now();
        try {
          return antennaEntity.position.getValue(t) ?? DEFAULT_POSITION;
        } catch {
          return DEFAULT_POSITION;
        }
      }, false),
      orientation: new Cesium.CallbackProperty(() => {
        const antennaEntity = busPayloadManager?.getAntennaEntity?.();
        if (!antennaEntity?.orientation) return DEFAULT_ORIENTATION;
        const t = mainViewer?.clock?.currentTime ?? Cesium.JulianDate.now();
        try {
          return antennaEntity.orientation.getValue(t) ?? DEFAULT_ORIENTATION;
        } catch {
          return DEFAULT_ORIENTATION;
        }
      }, false),
      box: {
        dimensions: new Cesium.CallbackProperty(() => {
          const antennaEntity = busPayloadManager?.getAntennaEntity?.();
          if (!antennaEntity?.box?.dimensions) return DEFAULT_ANTENNA_DIMENSIONS;
        const t = mainViewer?.clock?.currentTime ?? Cesium.JulianDate.now();
        try {
          return antennaEntity.box.dimensions.getValue(t) ?? DEFAULT_ANTENNA_DIMENSIONS;
          } catch {
            return DEFAULT_ANTENNA_DIMENSIONS;
          }
        }, false),
        material: Cesium.Color.CYAN.withAlpha(0.7),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
    });
  }

  private createAxisEntities(): void {
    if (!this.miniViewer || !this.busPayloadManager) return;

    const busPayloadManager = this.busPayloadManager;

    this.axisEntities = createAxisEntities(
      this.miniViewer,
      () => busPayloadManager.getBusCartesian(),
      AXIS_LENGTH,
      true,
      undefined,
      () => busPayloadManager.getAxisOptionsForMiniMap()
    );
  }

  private setupCameraUpdate(): void {
    if (!this.miniViewer || !this.mainViewer || !this.busPayloadManager) return;

    const removePostRender = this.mainViewer.scene.postRender.addEventListener(() => {
      requestAnimationFrame(() => {
        this.syncClockAndUpdateCamera();
      });
    });

    this.postRenderRemove = removePostRender;
  }

  private syncClockAndUpdateCamera(): void {
    if (!this.miniViewer || !this.mainViewer || !this.busPayloadManager) return;

    if (this.mainViewer.clock) {
      this.miniViewer.clock.currentTime = this.mainViewer.clock.currentTime;
      this.miniViewer.clock.shouldAnimate = this.mainViewer.clock.shouldAnimate;
    }
    this.miniViewer.scene.requestRender();
    this.updateMiniCamera();
  }

  private updateMiniCamera(): void {
    if (!this.miniViewer || !this.busPayloadManager) return;

    const busEntity = this.busPayloadManager.getBusEntity?.();
    const antennaEntity = this.busPayloadManager.getAntennaEntity?.();
    if (!busEntity?.position || !busEntity?.orientation) return;

    try {
      const time = this.mainViewer?.clock?.currentTime ?? Cesium.JulianDate.now();
      const busPos = busEntity.position.getValue(time);
      const orientation = busEntity.orientation.getValue(time);
      if (!busPos || !orientation) return;

      const antennaPos = antennaEntity?.position?.getValue?.(time);
      const targetPos = antennaPos
        ? Cesium.Cartesian3.multiplyByScalar(
            Cesium.Cartesian3.add(busPos, antennaPos, new Cesium.Cartesian3()),
            0.5,
            new Cesium.Cartesian3()
          )
        : busPos;

      const matrix = Cesium.Matrix3.fromQuaternion(orientation);
      const xAxis = Cesium.Matrix3.multiplyByVector(
        matrix,
        new Cesium.Cartesian3(1, 0, 0),
        new Cesium.Cartesian3()
      );
      const yAxis = Cesium.Matrix3.multiplyByVector(
        matrix,
        new Cesium.Cartesian3(0, 1, 0),
        new Cesium.Cartesian3()
      );
      const zAxis = Cesium.Matrix3.multiplyByVector(
        matrix,
        new Cesium.Cartesian3(0, 0, 1),
        new Cesium.Cartesian3()
      );
      const negX = Cesium.Cartesian3.negate(xAxis, new Cesium.Cartesian3());
      const negY = Cesium.Cartesian3.negate(yAxis, new Cesium.Cartesian3());
      const negZ = Cesium.Cartesian3.negate(zAxis, new Cesium.Cartesian3());
      const w = this.cameraWeights;
      const viewDir = Cesium.Cartesian3.add(
        Cesium.Cartesian3.multiplyByScalar(negZ, w.above, new Cesium.Cartesian3()),
        Cesium.Cartesian3.add(
          Cesium.Cartesian3.multiplyByScalar(negX, w.behind, new Cesium.Cartesian3()),
          Cesium.Cartesian3.multiplyByScalar(negY, w.left, new Cesium.Cartesian3()),
          new Cesium.Cartesian3()
        ),
        new Cesium.Cartesian3()
      );
      const cameraOffset = Cesium.Cartesian3.multiplyByScalar(
        Cesium.Cartesian3.normalize(viewDir, viewDir),
        this.cameraOffsetM,
        new Cesium.Cartesian3()
      );
      const destination = Cesium.Cartesian3.add(
        targetPos,
        cameraOffset,
        new Cesium.Cartesian3()
      );

      const direction = Cesium.Cartesian3.normalize(
        Cesium.Cartesian3.subtract(targetPos, destination, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      );
      const up = Cesium.Cartesian3.negate(zAxis, new Cesium.Cartesian3());
      this.miniViewer.camera.setView({
        destination,
        orientation: {
          direction,
          up,
        },
      });
    } catch {
      // 무시
    }
  }

  /**
   * 미니맵 제거
   */
  clear(): void {
    if (typeof this.postRenderRemove === 'function') {
      this.postRenderRemove();
      this.postRenderRemove = null;
    }

    if (this.miniViewer) {
      try {
        if (this.satelliteEntity) {
          this.miniViewer.entities.remove(this.satelliteEntity);
        }
        if (this.antennaEntity) {
          this.miniViewer.entities.remove(this.antennaEntity);
        }
        if (this.axisEntities) {
          this.miniViewer.entities.remove(this.axisEntities.xAxis);
          this.miniViewer.entities.remove(this.axisEntities.yAxis);
          this.miniViewer.entities.remove(this.axisEntities.zAxis);
          this.miniViewer.entities.remove(this.axisEntities.xLabel);
          this.miniViewer.entities.remove(this.axisEntities.yLabel);
          this.miniViewer.entities.remove(this.axisEntities.zLabel);
        }
        this.miniViewer.destroy();
      } catch {
        // 무시
      }
      this.miniViewer = null;
      this.satelliteEntity = null;
      this.antennaEntity = null;
      this.axisEntities = null;
    }

    if (this.miniContainer?.parentNode) {
      this.miniContainer.parentNode.removeChild(this.miniContainer);
    }
    this.miniContainer = null;
  }

  /**
   * busPayloadManager 설정
   */
  setBusPayloadManager(manager: SatelliteBusPayloadManager | null): void {
    this.busPayloadManager = manager;
  }
}
