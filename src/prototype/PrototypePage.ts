import { CesiumViewerManager } from '../poc/cesium/CesiumViewerManager.js';
import { ControlPanelManager } from './ControlPanel/index.js';
import type { RegionInfo } from './ControlPanel/TargetSettings/index.js';
import {
  calculateStdDev,
  calculateSlopeAndAspect,
  getGeologyMock,
  getGeologyFromTerrain,
} from './ControlPanel/TargetSettings/_util/sar-region-payload.js';

/**
 * PrototypePage - Prototype 전용 페이지 클래스
 */
export class PrototypePage {
  private viewerManager: CesiumViewerManager | null;
  private viewer: any;
  private controlPanelManager: ControlPanelManager | null;
  private regionInfoPanel: HTMLElement | null;
  private lastRegionInfo: RegionInfo | null;
  private mapContextMenuEl: HTMLElement | null;
  private mapContextMenuClose: (() => void) | null;

  constructor() {
    this.viewerManager = null;
    this.viewer = null;
    this.controlPanelManager = null;
    this.regionInfoPanel = null;
    this.lastRegionInfo = null;
    this.mapContextMenuEl = null;
    this.mapContextMenuClose = null;
  }

  /**
   * 우측 지역 정보 패널 DOM 생성 (초기 숨김)
   */
  private createRegionInfoPanel(): void {
    const existing = document.getElementById('targetGeoDataSidebar');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'targetGeoDataSidebar';
    panel.className = 'target-geo-data-sidebar hidden';

    const header = document.createElement('div');
    header.className = 'target-geo-data-header';
    header.textContent = '타겟 지역 정보';
    panel.appendChild(header);

    const content = document.createElement('div');
    content.id = 'targetGeoDataContent';
    content.className = 'target-geo-data-content';
    content.innerHTML = '<p class="target-geo-data-placeholder">타겟을 설정한 뒤 \'지역 정보 가져오기\'를 누르세요.</p>';
    panel.appendChild(content);

    this.injectRegionInfoPanelStyles();
    document.body.appendChild(panel);
    this.regionInfoPanel = panel;
  }

  /**
   * 우측 패널용 스타일 주입
   */
  private injectRegionInfoPanelStyles(): void {
    if (document.getElementById('targetGeoDataSidebarStyles')) return;
    const style = document.createElement('style');
    style.id = 'targetGeoDataSidebarStyles';
    style.textContent = `
      .target-geo-data-sidebar {
        position: fixed;
        right: 0;
        top: 0;
        bottom: 0;
        width: 320px;
        background: rgba(30, 30, 30, 0.95);
        color: #eee;
        font-family: sans-serif;
        z-index: 1000;
        box-shadow: -2px 0 10px rgba(0, 0, 0, 0.3);
        border-left: 1px solid #555;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .target-geo-data-sidebar.hidden {
        display: none;
      }
      .target-geo-data-header {
        padding: 12px 16px;
        font-size: 16px;
        font-weight: 600;
        border-bottom: 1px solid #444;
        flex-shrink: 0;
      }
      .target-geo-data-content {
        padding: 16px;
        overflow-y: auto;
        font-size: 13px;
      }
      .target-geo-data-placeholder {
        color: #aaa;
        margin: 0;
      }
      .target-geo-data-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
      }
      .target-geo-data-table th,
      .target-geo-data-table td {
        text-align: left;
        padding: 6px 8px;
        border-bottom: 1px solid #333;
      }
      .target-geo-data-table th { color: #aaa; font-weight: 500; }
      .target-geo-data-grid-title {
        margin: 16px 0 8px 0;
        font-size: 13px;
        color: #ccc;
      }
      .target-geo-data-grid-scroll {
        max-height: 280px;
        overflow-y: auto;
        border: 1px solid #333;
        border-radius: 4px;
      }
      .target-geo-data-grid-table { margin: 0; }
      .target-geo-data-grid-table thead th { position: sticky; top: 0; background: rgba(30,30,30,0.98); z-index: 1; }
      .target-geo-data-json-title { margin: 16px 0 8px 0; font-size: 13px; color: #ccc; }
      .target-geo-data-json-pre { max-height: 240px; overflow: auto; font-size: 11px; white-space: pre-wrap; word-break: break-all; padding: 8px; border: 1px solid #333; border-radius: 4px; margin: 0 0 8px 0; background: rgba(0,0,0,0.3); }
      .target-geo-data-json-dl { width: 100%; padding: 8px; margin-top: 4px; cursor: pointer; }
      .prototype-map-context-menu {
        position: fixed;
        z-index: 2000;
        min-width: 220px;
        background: rgba(30, 30, 30, 0.97);
        color: #eee;
        font-family: sans-serif;
        font-size: 13px;
        border: 1px solid #555;
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        padding: 10px 12px;
      }
      .prototype-map-context-menu-section { margin-bottom: 10px; }
      .prototype-map-context-menu-row { padding: 2px 0; }
      .prototype-map-context-menu-actions { border-top: 1px solid #444; padding-top: 8px; }
      .prototype-map-context-menu-btn {
        width: 100%;
        padding: 8px 10px;
        background: #2a5a8a;
        color: #fff;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
      }
      .prototype-map-context-menu-btn:hover { background: #357ab8; }
    `;
    document.head.appendChild(style);
  }

  /**
   * 건물 한 건을 참고 문서 형식(id, name, location, properties, geometry)으로 매핑
   * location.elevation에는 지면 고도(ground_elevation_m) 사용, 없으면 0
   */
  private mapBuildingToSarFormat(
    b: {
      longitude_deg: number;
      latitude_deg: number;
      height_m: number;
      properties: Record<string, unknown>;
      ground_elevation_m?: number;
    },
    index: number
  ): Record<string, unknown> {
    const props = b.properties ?? {};
    const name = (props.name as string) ?? (props['name'] as string) ?? `Building ${index}`;
    const height = (props.height as number) ?? (props['height'] as number) ?? b.height_m ?? 10;
    const levels = (props['building:levels'] as number) ?? (props.levels as number) ?? 3;
    const size = 0.0001;
    const lon = b.longitude_deg;
    const lat = b.latitude_deg;
    const groundElevation = b.ground_elevation_m ?? 0;
    const coordinates = [
      [lon - size, lat - size],
      [lon + size, lat - size],
      [lon + size, lat + size],
      [lon - size, lat + size],
      [lon - size, lat - size],
    ];
    return {
      id: `building_${index}`,
      name,
      location: {
        longitude: lon,
        latitude: lat,
        elevation: groundElevation,
      },
      properties: {
        height,
        levels,
        type: props.building ?? props.type ?? 'yes',
        use: props['building:use'] ?? props.use ?? 'unknown',
        material: props['building:material'] ?? props.material ?? 'concrete',
        roof_material: props['roof:material'] ?? props.roof_material ?? 'concrete',
        roof_shape: props['roof:shape'] ?? props.roof_shape ?? 'flat',
        construction_year: props.start_date ?? props.construction_year ?? null,
        ...props,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates],
      },
    };
  }

  /**
   * RegionInfo를 JSON 출력용 객체(terrain + buildings + geology, 참고 문서 호환)로 변환
   */
  private buildRegionInfoPayload(regionInfo: RegionInfo): Record<string, unknown> {
    const {
      bounds,
      areaKm2,
      elevation,
      elevationGrid,
      rangeCount,
      azimuthCount,
      buildings,
      regionName,
      buildingsSource,
    } = regionInfo;
    const grid = (elevationGrid ?? []).map((p) => ({
      longitude: p.longitude_deg,
      latitude: p.latitude_deg, 
      elevation: p.height_m,
    }));

    // [추가된 정렬 로직] 위도 > 위에서 아래로(위도 내림차순), 경도 > 좌에서 우로(경도 오름차순)
    grid.sort((a, b) => {
      if (Math.abs(b.latitude - a.latitude) > 1e-7) {
        return b.latitude - a.latitude;
      }
      return a.longitude - b.longitude;
    });
    const heights = grid.map((g) => g.elevation);
    const std_deviation = heights.length > 0 ? calculateStdDev(heights) : 0;
    const statistics =
      elevation != null
        ? {
            min_elevation: elevation.min,
            max_elevation: elevation.max,
            mean_elevation: elevation.mean,
            std_deviation,
          }
        : { min_elevation: 0, max_elevation: 0, mean_elevation: 0, std_deviation: 0 };

    let slope_map: Array<{ longitude: number; latitude: number; slope: number }> = [];
    let aspect_map: Array<{ longitude: number; latitude: number; aspect: number }> = [];
    if (
      elevationGrid &&
      elevationGrid.length > 0 &&
      rangeCount != null &&
      azimuthCount != null &&
      elevationGrid.length === rangeCount * azimuthCount
    ) {
      const result = calculateSlopeAndAspect(
        elevationGrid,
        rangeCount,
        azimuthCount,
        bounds
      );
      slope_map = result.slope_map;
      aspect_map = result.aspect_map;
    }

    const rc = rangeCount ?? 0;
    const ac = azimuthCount ?? 0;
    const centerLat = (bounds.latMin + bounds.latMax) / 2;
    const lonSpanKm =
      (bounds.lonMax - bounds.lonMin) * 111 * Math.cos((centerLat * Math.PI) / 180);
    const latSpanKm = (bounds.latMax - bounds.latMin) * 111;
    const resolutionKm =
      rc > 1 && ac > 1
        ? `${(lonSpanKm / (rc - 1)).toFixed(2)}km x ${(latSpanKm / (ac - 1)).toFixed(2)}km`
        : 'variable';

// [추가된 계층 구조 로직] 1차원 grid를 가로 한 줄(rangeCount) 크기만큼씩 잘라서 2차원 배열로 묶기
const grid2D = [];
if (rc > 0) {
  for (let i = 0; i < grid.length; i += rc) {
    grid2D.push(grid.slice(i, i + rc));
  }
}

const terrain = {
  type: 'DEM',
  source: 'Cesium World Terrain',
  resolution: resolutionKm,
  bounds,
  areaKm2,
  grid: grid2D, // <-- 기존의 1차원(grid) 대신 2차원 계층 구조(grid2D)를 주입!
  rangeCount: rc,
  azimuthCount: ac,
  gridSize: { rows: ac, cols: rc },
  statistics,
  slope_map,
  aspect_map,
};

    const geology =
      elevationGrid &&
      elevationGrid.length > 0 &&
      elevation != null &&
      std_deviation >= 0
        ? getGeologyFromTerrain(
            regionName ?? 'Seoul Target',
            bounds,
            elevationGrid,
            {
              min_elevation: statistics.min_elevation,
              max_elevation: statistics.max_elevation,
              mean_elevation: statistics.mean_elevation,
              std_deviation: statistics.std_deviation,
            }
          )
        : getGeologyMock(bounds, regionName ?? 'Seoul Target');

    const buildingsSar = (buildings ?? []).map((b, i) => {
      const item = this.mapBuildingToSarFormat(b, i) as Record<string, unknown>;
      item.source = buildingsSource ?? 'unknown';
      return item;
    });

    const geological_units = (geology as Record<string, unknown>).geological_units as unknown[];
    const summary = {
      total_buildings: (buildings ?? []).length,
      terrain_points: grid.length,
      geological_units: Array.isArray(geological_units) ? geological_units.length : 0,
      coverage_area_km2: areaKm2,
      elevation_range:
        elevation != null
          ? { min: elevation.min, max: elevation.max, mean: elevation.mean }
          : { min: 0, max: 0, mean: 0 },
    };

    return {
      metadata: {
        processing_version: '1.0',
        creation_date: new Date().toISOString(),
        coordinate_system: 'WGS84',
        data_source: 'Cesium Platform',
        region: regionName ?? 'Seoul Target',
      },
      usage_instructions: {
        coordinate_system: 'Geographic (WGS84)',
        elevation_reference: 'EGM96 Geoid',
        units: {
          distance: 'meters',
          area: 'square_meters',
          angle: 'degrees',
          backscatter: 'dB',
          elevation: 'meters',
        },
        description:
          'This data can be used for SAR simulation, urban analysis, or GIS applications',
      },
      terrain,
      buildings: buildingsSar,
      geology,
      summary,
    };
  }

  /**
   * 화면 하단 카메라 이동 버튼 생성
   */
  private createCameraButtons(): void {
    const existing = document.getElementById('cameraControlButtons');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'cameraControlButtons';

    const btnSatellite = document.createElement('button');
    btnSatellite.id = 'btnFlyToSatellite';
    btnSatellite.type = 'button';
    btnSatellite.title = 'Fly to satellite';
    btnSatellite.innerHTML = '<span class="cam-btn-icon satellite-icon"></span>Satellite';
    btnSatellite.addEventListener('click', () => {
      this.controlPanelManager?.flyToSatellite();
    });

    const btnEarth = document.createElement('button');
    btnEarth.id = 'btnFlyToEarth';
    btnEarth.type = 'button';
    btnEarth.title = 'View whole Earth';
    btnEarth.innerHTML = '<span class="cam-btn-icon earth-icon"></span>Earth';
    btnEarth.addEventListener('click', () => {
      this.controlPanelManager?.flyToEarth();
    });

    container.appendChild(btnSatellite);
    container.appendChild(btnEarth);
    document.body.appendChild(container);

    this.injectCameraButtonStyles();
  }

  /**
   * 하단 카메라 버튼 스타일 주입
   */
  private injectCameraButtonStyles(): void {
    if (document.getElementById('cameraControlButtonsStyles')) return;
    const style = document.createElement('style');
    style.id = 'cameraControlButtonsStyles';
    style.textContent = `
      #cameraControlButtons {
        position: fixed;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 10px;
        z-index: 500;
        pointer-events: none;
      }
      #cameraControlButtons button {
        pointer-events: all;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 18px;
        border: 1px solid var(--dusty-grape);
        border-radius: 20px;
        background: rgba(35, 25, 66, 0.82);
        color: var(--pink-orchid);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        backdrop-filter: blur(6px);
        transition: background 0.15s, color 0.15s, border-color 0.15s;
        white-space: nowrap;
      }
      #cameraControlButtons button:hover {
        background: var(--dusty-grape);
        color: #fff;
        border-color: var(--lilac);
      }
      #cameraControlButtons button:hover .cam-btn-icon {
        background-color: #fff;
      }
      #cameraControlButtons button:active {
        background: var(--dark-amethyst);
        color: var(--lilac);
      }
      #cameraControlButtons button:active .cam-btn-icon {
        background-color: var(--lilac);
      }
      .cam-btn-icon {
        display: inline-block;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        background-color: var(--pink-orchid);
        -webkit-mask-size: contain;
        mask-size: contain;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-position: center;
        mask-position: center;
        transition: background-color 0.15s;
      }
      .satellite-icon {
        -webkit-mask-image: url('assets/satellite-icon.svg');
        mask-image: url('assets/satellite-icon.svg');
      }
      .earth-icon {
        -webkit-mask-image: url('assets/earth-14-svgrepo-com.svg');
        mask-image: url('assets/earth-14-svgrepo-com.svg');
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 지역 정보 수신 시 우측 패널 내용 갱신
   */
  updateRegionInfoPanel(regionInfo: RegionInfo): void {
    const content = document.getElementById('targetGeoDataContent');
    if (!content) return;

    this.lastRegionInfo = regionInfo;
    const { bounds, areaKm2, elevation, sampleCount, elevationGrid, rangeCount, azimuthCount } = regionInfo;
    let html = '';
    let summaryRows = `
      <tr><th>경도 범위</th><td>${bounds.lonMin.toFixed(4)}° ~ ${bounds.lonMax.toFixed(4)}°</td></tr>
      <tr><th>위도 범위</th><td>${bounds.latMin.toFixed(4)}° ~ ${bounds.latMax.toFixed(4)}°</td></tr>
      <tr><th>면적</th><td>${areaKm2.toFixed(2)} km²</td></tr>
      <tr><th>격자 크기</th><td>${rangeCount ?? '-'} × ${azimuthCount ?? '-'}</td></tr>
      <tr><th>샘플 수</th><td>${sampleCount}</td></tr>
    `;
    if (elevation) {
      summaryRows += `
        <tr><th>고도 (최소)</th><td>${elevation.min.toFixed(1)} m</td></tr>
        <tr><th>고도 (최대)</th><td>${elevation.max.toFixed(1)} m</td></tr>
        <tr><th>고도 (평균)</th><td>${elevation.mean.toFixed(1)} m</td></tr>
      `;
    } else {
      summaryRows += '<tr><th>고도</th><td>고도 데이터를 사용할 수 없습니다</td></tr>';
    }
    html += `<table class="target-geo-data-table"><tbody>${summaryRows}</tbody></table>`;

    if (elevationGrid && elevationGrid.length > 0) {
      const gridRows = elevationGrid
        .map(
          (p, i) =>
            `<tr><td>${i + 1}</td><td>${p.longitude_deg.toFixed(6)}</td><td>${p.latitude_deg.toFixed(6)}</td><td>${p.height_m.toFixed(1)}</td></tr>`
        )
        .join('');
      html += `
        <h5 class="target-geo-data-grid-title">DEM 격자 (SAR 지오코딩용)</h5>
        <div class="target-geo-data-grid-scroll">
          <table class="target-geo-data-table target-geo-data-grid-table">
            <thead><tr><th>No.</th><th>경도 (°)</th><th>위도 (°)</th><th>고도 (m)</th></tr></thead>
            <tbody>${gridRows}</tbody>
          </table>
        </div>
      `;
    }

    const payload = this.buildRegionInfoPayload(regionInfo);
    let jsonStr = '';
    try {
      jsonStr = JSON.stringify(payload, null, 2);
    } catch {
      jsonStr = JSON.stringify({ error: 'JSON 직렬화 실패' });
    }
    html += `
      <h5 class="target-geo-data-json-title">JSON 출력</h5>
      <pre class="target-geo-data-json-pre" id="targetGeoDataJsonPre"></pre>
      <button type="button" class="target-geo-data-json-dl sidebar-section button" id="targetGeoDataJsonDownload">JSON 다운로드</button>
    `;
    content.innerHTML = html;

    const preEl = content.querySelector('#targetGeoDataJsonPre');
    if (preEl) preEl.textContent = jsonStr;

    const downloadBtn = content.querySelector('#targetGeoDataJsonDownload');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.downloadRegionInfoJson());
    }
  }

  /**
   * 지역 정보 JSON 파일 다운로드
   */
  private downloadRegionInfoJson(): void {
    if (!this.lastRegionInfo) return;
    const payload = this.buildRegionInfoPayload(this.lastRegionInfo);
    let jsonStr: string;
    try {
      jsonStr = JSON.stringify(payload, null, 2);
    } catch {
      jsonStr = JSON.stringify({ error: 'JSON 직렬화 실패' });
    }
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'region-info.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 지도 우클릭 컨텍스트 메뉴 표시 (경·위도 + 해당 위치로 타겟 설정)
   */
  private showMapContextMenu(longitude: number, latitude: number, screenX: number, screenY: number): void {
    this.closeMapContextMenu();
    const menu = document.createElement('div');
    menu.id = 'prototypeMapContextMenu';
    menu.className = 'prototype-map-context-menu';
    menu.innerHTML = `
      <div class="prototype-map-context-menu-section">
        <div class="prototype-map-context-menu-row"><strong>경도</strong>: ${longitude.toFixed(6)}°</div>
        <div class="prototype-map-context-menu-row"><strong>위도</strong>: ${latitude.toFixed(6)}°</div>
      </div>
      <div class="prototype-map-context-menu-actions">
        <button type="button" class="prototype-map-context-menu-btn" data-action="set-target">해당 위치로 타겟 설정</button>
      </div>
    `;
    menu.style.left = `${screenX}px`;
    menu.style.top = `${screenY}px`;
    document.body.appendChild(menu);

    const close = (): void => {
      if (menu.parentNode) menu.parentNode.removeChild(menu);
      this.mapContextMenuEl = null;
      this.mapContextMenuClose = null;
      document.removeEventListener('click', close);
    };
    this.mapContextMenuEl = menu;
    this.mapContextMenuClose = close;

    menu.querySelector('[data-action="set-target"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.controlPanelManager?.setTargetLocation(longitude, latitude);
      close();
    });
    document.addEventListener('click', close);
  }

  private closeMapContextMenu(): void {
    if (this.mapContextMenuClose) {
      this.mapContextMenuClose();
    }
  }

  /**
   * Prototype 페이지 초기화
   */
  async initialize(): Promise<void> {
    try {
      // 기존 Cesium 뷰어 정리
      this.cleanupCesiumViewer();

      // 1. Cesium 뷰어 초기화
      this.viewerManager = new CesiumViewerManager('cesiumContainer');
      this.viewer = await this.viewerManager.initialize();

      // 2. 이미지 레이어 설정
      await this.viewerManager.setupImagery();

      // 3. 건물 레이어 추가
      await this.viewerManager.addBuildings();

      // 4. 카메라: 지구 중심으로 초기화 (컨트롤 가능)
      this.viewer.trackedEntity = undefined;
      this.viewer.camera.flyHome(0);

      // 5. 우측 지역 정보 패널 생성 (초기 숨김)
      this.createRegionInfoPanel();

      // 6. 제어 패널 초기화 (콜백 및 패널 ref 전달)
      this.controlPanelManager = new ControlPanelManager();
      this.controlPanelManager.initialize(this.viewer, {
        onRegionInfoFetched: this.updateRegionInfoPanel.bind(this),
        regionInfoPanel: this.regionInfoPanel,
      });

      // 7. 하단 카메라 이동 버튼
      this.createCameraButtons();

      // 8. 지도 우클릭 컨텍스트 메뉴 (경·위도 표시, 해당 위치로 타겟 설정)
      const canvas = this.viewer.scene.canvas;
      canvas.addEventListener('contextmenu', (e: Event) => e.preventDefault());
      this.viewerManager.setupMapRightClickHandler((lon, lat, x, y) => {
        this.showMapContextMenu(lon, lat, x, y);
      });

    } catch (error) {
      console.error('[PrototypePage] 초기화 오류:', error);
    }
  }

  /**
   * 기존 Cesium 뷰어 정리
   */
  private cleanupCesiumViewer(): void {
    const container = document.getElementById('cesiumContainer');
    if (container) {
      // 기존 뷰어가 있으면 제거
      const existingViewer = (window as any).cesiumViewer;
      if (existingViewer && existingViewer.destroy) {
        existingViewer.destroy();
      }
      // 컨테이너 내용 비우기
      container.innerHTML = '';
    }
  }

  /**
   * Prototype 페이지 정리
   */
  cleanup(): void {
    this.closeMapContextMenu();
    // 제어 패널 정리
    if (this.controlPanelManager) {
      this.controlPanelManager.cleanup();
      this.controlPanelManager = null;
    }

    // 우측 지역 정보 패널 제거
    const panel = document.getElementById('targetGeoDataSidebar');
    if (panel) panel.remove();
    this.regionInfoPanel = null;
    const styleEl = document.getElementById('targetGeoDataSidebarStyles');
    if (styleEl) styleEl.remove();

    // 하단 카메라 버튼 제거
    document.getElementById('cameraControlButtons')?.remove();
    document.getElementById('cameraControlButtonsStyles')?.remove();

    // Cesium 뷰어 정리
    if (this.viewer) {
      try {
        this.viewer.destroy();
      } catch (error) {
        console.warn('[PrototypePage] 뷰어 정리 중 오류:', error);
      }
      this.viewer = null;
    }
    this.viewerManager = null;
    console.log('[PrototypePage] Prototype 페이지 정리 완료');
  }
}
