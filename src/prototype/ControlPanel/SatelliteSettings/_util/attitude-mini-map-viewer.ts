import { SARSwathCalculator } from '../../../../poc/utils/sar-swath-calculator.js';
import type { SwathCorners } from '../../../../poc/types/sar-swath.types.js';
import type { SatelliteBusPayloadManager } from '../SatelliteBusPayloadManager/index.js';
import { createAxisEntities } from '../SatelliteBusPayloadManager/_ui/axis-creator.js';

/** Y축 지표면 접촉점 기준 swath 간격 (m) */
const SWATH_SPACING_M = 5000;
const CORNER_KEYS: Array<keyof SwathCorners> = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

const MINI_MAP_SIZE = 360;
const DEFAULT_CAMERA_OFFSET_M = 3;

/** 카메라 방향 가중치: above(-Z), behind(-X), left(-Y). 위에서 내려다보며 Z축이 화면 아래로 향함 */
const DEFAULT_CAMERA_WEIGHTS = { above: 1.5, behind: 0.5, left: 0.5 };

const DEFAULT_POSITION = Cesium.Cartesian3.fromDegrees(0, 0, 0);
const DEFAULT_ORIENTATION = Cesium.Quaternion.IDENTITY;
const DEFAULT_DIMENSIONS = new Cesium.Cartesian3(1, 0.5, 0.5);
const DEFAULT_ANTENNA_DIMENSIONS = new Cesium.Cartesian3(0.5, 0.5, 0.5);
const AXIS_LENGTH = 1;
/** 궤도 방향선 길이 (m). 미니맵에서 궤도 연결 표시 */
const ORBIT_LINE_LENGTH_M = 100;

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
  private orbitLineEntity: any;
  private swathLineEntities: any[];
  private postRenderRemove: (() => void) | null;
  private cameraOffsetM: number;
  private cameraWeights: { above: number; behind: number; left: number };
  private isCollapsed: boolean;
  private expandButton: HTMLElement | null;
  private expandButtonContainer: HTMLElement | null;

  constructor(
    mainViewer: any,
    busPayloadManager: SatelliteBusPayloadManager | null,
    expandButtonContainer?: HTMLElement | null
  ) {
    this.mainViewer = mainViewer;
    this.busPayloadManager = busPayloadManager;
    this.expandButtonContainer = expandButtonContainer ?? null;
    this.miniContainer = null;
    this.miniViewer = null;
    this.satelliteEntity = null;
    this.antennaEntity = null;
    this.axisEntities = null;
    this.orbitLineEntity = null;
    this.swathLineEntities = [];
    this.postRenderRemove = null;
    this.cameraOffsetM = DEFAULT_CAMERA_OFFSET_M;
    this.cameraWeights = { ...DEFAULT_CAMERA_WEIGHTS };
    this.isCollapsed = false;
    this.expandButton = null;
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
    this.createOrbitLine();
    this.createSwathLines();
    this.setupCameraUpdate();
    if (this.expandButtonContainer) {
      this.createToggleButton();
    }
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
      border: 2px solid var(--dusty-grape);
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
      background: color-mix(in srgb, var(--dark-amethyst) 95%, transparent);
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4px;
      z-index: 10;
      background: linear-gradient(to bottom, rgba(0,0,0,0.3), transparent);
    `;

    const label = document.createElement('div');
    label.className = 'attitude-mini-map-label';
    label.textContent = 'Orientation';
    label.style.cssText = `
      font-size: 11px;
      color: var(--pink-orchid);
      pointer-events: none;
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    `;
    header.appendChild(label);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '−';
    closeBtn.title = '미니맵 닫기';
    closeBtn.style.cssText = `
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: 4px;
      background: rgba(255,255,255,0.15);
      color: var(--pink-orchid);
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
    `;
    closeBtn.addEventListener('click', () => this.collapse());
    header.appendChild(closeBtn);

    container.appendChild(header);

    const cesiumDiv = document.createElement('div');
    cesiumDiv.id = 'attitudeMiniMapCesium';
    cesiumDiv.style.cssText = 'width: 100%; height: 100%;';
    container.appendChild(cesiumDiv);

    document.body.appendChild(container);
    this.miniContainer = container;
  }

  private collapse(): void {
    if (!this.miniContainer) return;
    this.isCollapsed = true;
    this.miniContainer.style.display = 'none';
    this.updateToggleButtonState();
  }

  private expand(): void {
    this.isCollapsed = false;
    if (this.miniContainer) {
      this.miniContainer.style.display = '';
    }
    this.updateToggleButtonState();
  }

  private toggle(): void {
    if (this.isCollapsed) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  private createToggleButton(): void {
    if (!this.expandButtonContainer || this.expandButton) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Orientation';
    btn.title = '미니맵 토글';
    btn.className = 'cam-btn-minimap-toggle';
    btn.dataset.minimap = 'orientation';
    btn.addEventListener('click', () => this.toggle());
    this.expandButtonContainer.appendChild(btn);
    this.expandButton = btn;
    this.updateToggleButtonState();
  }

  private updateToggleButtonState(): void {
    if (!this.expandButton) return;
    if (this.isCollapsed) {
      this.expandButton.classList.remove('active');
      this.expandButton.title = '미니맵 열기';
    } else {
      this.expandButton.classList.add('active');
      this.expandButton.title = '미니맵 닫기';
    }
  }

  private removeExpandButton(): void {
    if (this.expandButton?.parentNode) {
      this.expandButton.parentNode.removeChild(this.expandButton);
    }
    this.expandButton = null;
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

  /**
   * 궤도 방향 연결선 (노란색) - 위성에서 궤도 진행 방향으로
   */
  private createOrbitLine(): void {
    if (!this.miniViewer || !this.busPayloadManager || !this.mainViewer) return;

    const busPayloadManager = this.busPayloadManager;
    const mainViewer = this.mainViewer;

    this.orbitLineEntity = this.miniViewer.entities.add({
      name: 'AttitudeMiniMapOrbitLine',
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const busPos = busPayloadManager.getBusCartesian();
          const velOpt = busPayloadManager.getVelocityOptions();
          if (!busPos || !velOpt?.velocityEcef) return [DEFAULT_POSITION, DEFAULT_POSITION];

          const v = velOpt.velocityEcef;
          const velDir = new Cesium.Cartesian3(v.x, v.y, v.z);
          const halfLen = ORBIT_LINE_LENGTH_M / 2;
          const forward = Cesium.Cartesian3.add(
            busPos,
            Cesium.Cartesian3.multiplyByScalar(velDir, halfLen, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
          );
          const backward = Cesium.Cartesian3.subtract(
            busPos,
            Cesium.Cartesian3.multiplyByScalar(velDir, halfLen, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
          );
          return [backward, forward];
        }, false),
        width: 2,
        material: Cesium.Color.ORANGE.withAlpha(0.9),
        clampToGround: false,
        arcType: Cesium.ArcType.NONE,
        show: new Cesium.CallbackProperty(
          () =>
            !!busPayloadManager?.getBusEntity?.() &&
            !!busPayloadManager?.getVelocityOptions?.()?.velocityEcef,
          false
        ),
      },
    });
  }

  /**
   * Swath 연결선 (노란색) - 안테나에서 지표면 swath 4개 모서리로
   */
  private createSwathLines(): void {
    if (!this.miniViewer || !this.busPayloadManager || !this.mainViewer) return;

    const busPayloadManager = this.busPayloadManager;

    CORNER_KEYS.forEach((cornerKey, index) => {
      const lineEntity = this.miniViewer.entities.add({
        name: `AttitudeMiniMapSwathLine_${index}`,
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const antennaPos = busPayloadManager.getAntennaCartesian();
            const groundPoint = busPayloadManager.getYAxisGroundPoint?.();
            const pos = busPayloadManager.getPositionForSwath?.();
            if (!antennaPos || !groundPoint || !pos) return [DEFAULT_POSITION, DEFAULT_POSITION];

            const halfSpacing = SWATH_SPACING_M / 2;
            const geometry = {
              centerLat: groundPoint.latitude,
              centerLon: groundPoint.longitude,
              heading: pos.heading,
              nearRange: -halfSpacing,
              farRange: halfSpacing,
              swathWidth: SWATH_SPACING_M,
              azimuthLength: SWATH_SPACING_M,
              satelliteAltitude: pos.altitude,
            };

            try {
              const corners = SARSwathCalculator.calculateSwathCorners(geometry);
              const corner = corners[cornerKey];
              const cornerPosition = Cesium.Cartesian3.fromDegrees(corner[0], corner[1], 0);
              return [antennaPos, cornerPosition];
            } catch {
              return [antennaPos, groundPoint.cartesian];
            }
          }, false),
          width: 2,
          material: Cesium.Color.YELLOW.withAlpha(0.9),
          clampToGround: false,
          arcType: Cesium.ArcType.NONE,
          show: new Cesium.CallbackProperty(
            () =>
              !!busPayloadManager?.getAntennaEntity?.() &&
              !!busPayloadManager?.getYAxisGroundPoint?.(),
            false
          ),
        },
      });
      this.swathLineEntities.push(lineEntity);
    });
  }

  private setupCameraUpdate(): void {
    if (!this.miniViewer || !this.mainViewer || !this.busPayloadManager) return;

    const removePostRender = this.mainViewer.scene.postRender.addEventListener(() => {
      this.syncClockAndUpdateCamera();
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

      let targetPos = busPos;
      try {
        const antennaPos = antennaEntity?.position?.getValue?.(time);
        if (antennaPos) {
          targetPos = Cesium.Cartesian3.multiplyByScalar(
            Cesium.Cartesian3.add(busPos, antennaPos, new Cesium.Cartesian3()),
            0.5,
            new Cesium.Cartesian3()
          );
        }
      } catch {
        targetPos = busPos;
      }

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
    this.removeExpandButton();
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
        if (this.orbitLineEntity) {
          this.miniViewer.entities.remove(this.orbitLineEntity);
        }
        this.swathLineEntities.forEach((entity) => {
          this.miniViewer.entities.remove(entity);
        });
        this.miniViewer.destroy();
      } catch {
        // 무시
      }
      this.miniViewer = null;
      this.satelliteEntity = null;
      this.antennaEntity = null;
      this.axisEntities = null;
      this.orbitLineEntity = null;
      this.swathLineEntities = [];
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
