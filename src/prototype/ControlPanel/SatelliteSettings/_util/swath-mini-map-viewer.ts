import { SARSwathCalculator } from '../../../../poc/utils/sar-swath-calculator.js';
import type { SatelliteBusPayloadManager } from '../SatelliteBusPayloadManager/index.js';

/** Y축 지표면 접촉점 기준 swath 간격 (m) */
const SWATH_SPACING_M = 5000;

const MINI_MAP_SIZE = 360;
const MINI_MAP_PADDING_FACTOR = 1.5;

/**
 * Swath 범위를 우측 상단에 보여주는 미니 카메라 뷰
 */
export class SwathMiniMapViewer {
  private mainViewer: any;
  private busPayloadManager: SatelliteBusPayloadManager | null;
  private expandButtonContainer: HTMLElement | null;
  private miniContainer: HTMLElement | null;
  private miniViewer: any;
  private swathEntity: any;
  private postRenderRemove: (() => void) | null;
  private isCollapsed: boolean;
  private expandButton: HTMLElement | null;

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
    this.swathEntity = null;
    this.postRenderRemove = null;
    this.isCollapsed = false;
    this.expandButton = null;
  }

  /**
   * 미니맵 초기화
   */
  init(): void {
    if (!this.mainViewer || !this.busPayloadManager) return;

    this.createMiniMapContainer();
    this.createMiniViewer();
    this.createSwathEntity();
    this.setupCameraUpdate();
    if (this.expandButtonContainer) {
      this.createToggleButton();
    }
  }

  private createMiniMapContainer(): void {
    const existing = document.getElementById('swathMiniMapContainer');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'swathMiniMapContainer';
    container.className = 'swath-mini-map-container';
    container.style.cssText = `
      position: fixed;
      top: 12px;
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
    label.className = 'swath-mini-map-label';
    label.textContent = 'AOI';
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
    cesiumDiv.id = 'swathMiniMapCesium';
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
    btn.textContent = 'AOI';
    btn.title = '미니맵 토글';
    btn.className = 'cam-btn-minimap-toggle';
    btn.dataset.minimap = 'aoi';
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
    const cesiumDiv = document.getElementById('swathMiniMapCesium');
    if (!cesiumDiv) return;

    this.miniViewer = new Cesium.Viewer(cesiumDiv, {
      clock: this.mainViewer.clock,
      terrain: Cesium.Terrain.fromWorldTerrain(),
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

  private createSwathEntity(): void {
    if (!this.miniViewer || !this.busPayloadManager) return;

    const defaultPositions = [
      Cesium.Cartesian3.fromDegrees(0, 0, 0),
      Cesium.Cartesian3.fromDegrees(0.001, 0, 0),
      Cesium.Cartesian3.fromDegrees(0.001, 0.001, 0),
      Cesium.Cartesian3.fromDegrees(0, 0.001, 0),
    ];

    this.swathEntity = this.miniViewer.entities.add({
      name: 'SwathMiniMapView',
      show: new Cesium.CallbackProperty(
        () => !!this.busPayloadManager?.getPositionForSwath?.() && !!this.busPayloadManager?.getYAxisGroundPoint?.(),
        false
      ),
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => {
          const groundPoint = this.busPayloadManager?.getYAxisGroundPoint?.();
          const pos = this.busPayloadManager?.getPositionForSwath?.();
          if (!groundPoint || !pos) {
            return new Cesium.PolygonHierarchy(defaultPositions);
          }

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
            const positions = SARSwathCalculator.cornersToCartesian(corners);
            return new Cesium.PolygonHierarchy(positions);
          } catch {
            return new Cesium.PolygonHierarchy(defaultPositions);
          }
        }, false),
        material: Cesium.Color.YELLOW.withAlpha(0.4),
        fill: true,
        outline: true,
        outlineColor: Cesium.Color.YELLOW.withAlpha(0.9),
        outlineWidth: 2,
        classificationType: Cesium.ClassificationType.TERRAIN,
        height: 0,
        extrudedHeight: 0,
      },
    });
  }

  private setupCameraUpdate(): void {
    if (!this.miniViewer || !this.mainViewer || !this.busPayloadManager) return;

    const removePostRender = this.mainViewer.scene.postRender.addEventListener(() => {
      this.updateMiniCamera();
      this.miniViewer.scene.requestRender();
    });

    this.postRenderRemove = removePostRender;
  }

  private updateMiniCamera(): void {
    if (!this.miniViewer || !this.busPayloadManager) return;

    const groundPoint = this.busPayloadManager.getYAxisGroundPoint?.();
    const pos = this.busPayloadManager.getPositionForSwath?.();
    if (!groundPoint || !pos) return;

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
      const positions = SARSwathCalculator.cornersToCartesian(corners);
      if (positions.length < 4) return;

      let west = Infinity;
      let south = Infinity;
      let east = -Infinity;
      let north = -Infinity;
      for (const cartesianPos of positions) {
        const carto = Cesium.Cartographic.fromCartesian(cartesianPos);
        const lon = Cesium.Math.toDegrees(carto.longitude);
        const lat = Cesium.Math.toDegrees(carto.latitude);
        west = Math.min(west, lon);
        south = Math.min(south, lat);
        east = Math.max(east, lon);
        north = Math.max(north, lat);
      }

      const centerLon = (west + east) / 2;
      const centerLat = (south + north) / 2;
      const latSpanM = (north - south) * 111000;
      const lonSpanM = (east - west) * 111000 * Math.cos((centerLat * Math.PI) / 180);
      const maxSpan = Math.max(latSpanM, lonSpanM, 1000) * MINI_MAP_PADDING_FACTOR;

      const height = maxSpan * 2.5;
      const destination = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, height);

      this.miniViewer.camera.setView({
        destination,
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
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
        if (this.swathEntity) {
          this.miniViewer.entities.remove(this.swathEntity);
        }
        this.miniViewer.destroy();
      } catch {
        // 무시
      }
      this.miniViewer = null;
      this.swathEntity = null;
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
