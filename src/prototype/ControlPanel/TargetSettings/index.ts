import {
  computeSarSummary,
  type SarRangeParams,
  type SarAzimuthParams,
} from './_util/sar-target-calculator.js';
import {
  computeGridCornersLonLat,
  computeGridCenterLonLat,
  computeAllGridPointsLonLat,
} from './_util/sar-grid-to-cesium.js';
import { fetchBuildingsFromOverpass } from './_util/overpass-buildings.js';
import { addTerrainElevationToBuildings } from './_util/sar-region-payload.js';

/** DEM 격자 한 점 (SAR 지오코딩용) */
export interface ElevationGridPoint {
  longitude_deg: number;
  latitude_deg: number;
  height_m: number;
}

/** 3D Tiles/OSM 건물 피처 한 건 (위치 + 속성, 지면 고도 보정 시 ground_elevation_m 사용) */
export interface BuildingFeature {
  longitude_deg: number;
  latitude_deg: number;
  height_m: number;
  properties: Record<string, unknown>;
  /** DEM 격자로 보정한 지면 고도(m). 없으면 location.elevation에 height_m 사용 */
  ground_elevation_m?: number;
}

/** 우측 패널에 전달하는 지역 정보 */
export interface RegionInfo {
  bounds: { lonMin: number; lonMax: number; latMin: number; latMax: number };
  areaKm2: number;
  elevation: { min: number; max: number; mean: number } | null;
  sampleCount: number;
  /** 타겟 격자와 동일 순서 (range 우선, azimuth) */
  elevationGrid: ElevationGridPoint[];
  rangeCount: number;
  azimuthCount: number;
  /** 타겟 bounds 내 3D Tiles/OSM 건물 피처 */
  buildings: BuildingFeature[];
  /** 지역 이름 (payload metadata.region용) */
  regionName?: string;
  /** 건물 데이터 출처 (payload buildings[].source용) */
  buildingsSource?: 'OpenStreetMap Overpass API' | 'Cesium OSM Buildings';
}

export interface TargetSettingsOptions {
  onRegionInfoFetched?: (data: RegionInfo) => void;
}

/**
 * TargetSettings - Target settings tab management class
 */
export class TargetSettings {
  private container: HTMLElement | null;
  private viewer: any;
  private target_footprint_entity: any;
  private grid_point_entities: any[];
  private direction_entities: any[];
  private update_debounce_timer: number | null;
  private on_region_info_fetched: ((data: RegionInfo) => void) | null;
  private fetch_region_info_button: HTMLButtonElement | null;

  constructor() {
    this.container = null;
    this.viewer = null;
    this.target_footprint_entity = null;
    this.grid_point_entities = [];
    this.direction_entities = [];
    this.update_debounce_timer = null;
    this.on_region_info_fetched = null;
    this.fetch_region_info_button = null;
  }

  /**
   * Initialize target settings tab
   */
  initialize(container: HTMLElement, viewer?: any, options?: TargetSettingsOptions): void {
    this.container = container;
    this.viewer = viewer || null;
    this.on_region_info_fetched = options?.onRegionInfoFetched ?? null;
    this.render();
    if (this.viewer) {
      this.updateTargetDebounced();
    }
  }

  /**
   * Render target settings UI
   */
  private render(): void {
    if (!this.container) return;

    const section = document.createElement('div');
    section.className = 'sidebar-section';

    const title = document.createElement('h3');
    title.textContent = '타겟 설정';
    section.appendChild(title);

    const description = document.createElement('p');
    description.style.color = '#aaa';
    description.style.fontSize = '12px';
    description.style.marginTop = '10px';
    description.textContent = '타겟 관련 설정을 관리합니다.';
    section.appendChild(description);

    // Target settings form
    const form = document.createElement('div');
    form.style.marginTop = '15px';

    // Target name input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = '타겟 이름:';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'prototypeTargetName';
    nameInput.placeholder = '타겟 이름을 입력하세요';
    nameInput.style.width = '100%';
    nameInput.style.marginTop = '4px';
    nameLabel.appendChild(nameInput);
    form.appendChild(nameLabel);

    // Target longitude input
    const longitudeLabel = document.createElement('label');
    longitudeLabel.style.marginTop = '10px';
    longitudeLabel.style.display = 'block';
    longitudeLabel.textContent = '경도 (deg):';
    const longitudeInput = document.createElement('input');
    longitudeInput.type = 'number';
    longitudeInput.id = 'prototypeTargetLongitude';
    longitudeInput.value = '127.0';
    longitudeInput.min = '-180';
    longitudeInput.max = '180';
    longitudeInput.step = '0.0001';
    longitudeInput.style.width = '100%';
    longitudeInput.style.marginTop = '4px';
    longitudeLabel.appendChild(longitudeInput);
    form.appendChild(longitudeLabel);

    // Target latitude input
    const latitudeLabel = document.createElement('label');
    latitudeLabel.style.marginTop = '10px';
    latitudeLabel.style.display = 'block';
    latitudeLabel.textContent = '위도 (deg):';
    const latitudeInput = document.createElement('input');
    latitudeInput.type = 'number';
    latitudeInput.id = 'prototypeTargetLatitude';
    latitudeInput.value = '37.5';
    latitudeInput.min = '-90';
    latitudeInput.max = '90';
    latitudeInput.step = '0.0001';
    latitudeInput.style.width = '100%';
    latitudeInput.style.marginTop = '4px';
    latitudeLabel.appendChild(latitudeInput);
    form.appendChild(latitudeLabel);

    // Target altitude input
    const altitudeLabel = document.createElement('label');
    altitudeLabel.style.marginTop = '10px';
    altitudeLabel.style.display = 'block';
    altitudeLabel.textContent = '고도 (m):';
    const altitudeInput = document.createElement('input');
    altitudeInput.type = 'number';
    altitudeInput.id = 'prototypeTargetAltitude';
    altitudeInput.value = '0';
    altitudeInput.min = '0';
    altitudeInput.step = '1';
    altitudeInput.style.width = '100%';
    altitudeInput.style.marginTop = '4px';
    altitudeLabel.appendChild(altitudeInput);
    form.appendChild(altitudeLabel);

    // SAR 타겟 파라미터 섹션
    const sar_section = document.createElement('div');
    sar_section.style.marginTop = '20px';
    sar_section.style.paddingTop = '15px';
    sar_section.style.borderTop = '1px solid #333';
    const sar_title = document.createElement('h4');
    sar_title.textContent = 'SAR 타겟 파라미터';
    sar_title.style.marginBottom = '10px';
    sar_title.style.fontSize = '14px';
    sar_title.style.color = '#ccc';
    sar_section.appendChild(sar_title);

    // Along-track 방위각 (deg)
    this.createInputField(
      sar_section,
      'Along-track 방위각 (deg, 0=북 90=동):',
      'prototypeTargetAlongTrackHeading',
      '90',
      '-180',
      '180',
      '1'
    );
    form.appendChild(sar_section);

    // Range
    const range_title = document.createElement('h5');
    range_title.textContent = 'Range (Cross-track)';
    range_title.style.marginTop = '12px';
    range_title.style.fontSize = '12px';
    range_title.style.color = '#aaa';
    sar_section.appendChild(range_title);
    this.createInputField(sar_section, 'Range Count:', 'prototypeTargetRangeCount', '8', '1', '10000', '1');
    this.createInputField(sar_section, 'Range Spacing (km):', 'prototypeTargetRangeSpacing', '1.5', '0', '1000', '0.1');
    this.createInputField(sar_section, 'Range Offset (km):', 'prototypeTargetRangeOffset', '0', '-1000', '1000', '0.1');

    // Azimuth
    const azimuth_title = document.createElement('h5');
    azimuth_title.textContent = 'Azimuth (Along-track)';
    azimuth_title.style.marginTop = '12px';
    azimuth_title.style.fontSize = '12px';
    azimuth_title.style.color = '#aaa';
    sar_section.appendChild(azimuth_title);
    this.createInputField(sar_section, 'Azimuth Count:', 'prototypeTargetAzimuthCount', '9', '1', '10000', '1');
    this.createInputField(sar_section, 'Azimuth Spacing (km):', 'prototypeTargetAzimuthSpacing', '1.5', '0', '1000', '0.1');
    this.createInputField(sar_section, 'Azimuth Offset (km):', 'prototypeTargetAzimuthOffset', '0', '-1000', '1000', '0.1');

    // 요약 (읽기 전용)
    const summary_title = document.createElement('h5');
    summary_title.textContent = '요약';
    summary_title.style.marginTop = '12px';
    summary_title.style.fontSize = '12px';
    summary_title.style.color = '#aaa';
    sar_section.appendChild(summary_title);
    const summary_div = document.createElement('div');
    summary_div.id = 'prototypeTargetSarSummary';
    summary_div.style.fontSize = '12px';
    summary_div.style.color = '#ccc';
    summary_div.style.marginTop = '6px';
    summary_div.style.whiteSpace = 'pre-wrap';
    sar_section.appendChild(summary_div);

    // 지역 정보 가져오기 버튼
    const region_info_section = document.createElement('div');
    region_info_section.style.marginTop = '20px';
    region_info_section.style.paddingTop = '15px';
    region_info_section.style.borderTop = '1px solid #333';
    const region_info_btn = document.createElement('button');
    region_info_btn.type = 'button';
    region_info_btn.id = 'prototypeFetchRegionInfo';
    region_info_btn.textContent = '지역 정보 가져오기';
    region_info_btn.className = 'sidebar-section button';
    region_info_btn.style.width = '100%';
    region_info_btn.style.marginTop = '8px';
    region_info_section.appendChild(region_info_btn);
    form.appendChild(region_info_section);
    this.fetch_region_info_button = region_info_btn;

    region_info_btn.addEventListener('click', () => this.fetchRegionInfo());

    section.appendChild(form);
    this.container.appendChild(section);

    // 입력 변경 시 요약 갱신 + Cesium 디바운스
    const input_ids = [
      'prototypeTargetLongitude',
      'prototypeTargetLatitude',
      'prototypeTargetAlongTrackHeading',
      'prototypeTargetRangeCount',
      'prototypeTargetRangeSpacing',
      'prototypeTargetRangeOffset',
      'prototypeTargetAzimuthCount',
      'prototypeTargetAzimuthSpacing',
      'prototypeTargetAzimuthOffset',
    ];
    input_ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          this.updateSummary();
          this.updateTargetDebounced();
        });
        el.addEventListener('change', () => {
          this.updateSummary();
          this.updateTargetDebounced();
        });
      }
    });
    this.updateSummary();
  }

  private createInputField(
    parent: HTMLElement,
    label_text: string,
    input_id: string,
    default_value: string,
    min: string,
    max: string,
    step: string
  ): HTMLElement {
    const label = document.createElement('label');
    label.style.marginTop = '10px';
    label.style.display = 'block';
    label.textContent = label_text;
    const input = document.createElement('input');
    input.type = 'number';
    input.id = input_id;
    input.value = default_value;
    input.min = min;
    input.max = max;
    input.step = step;
    input.style.width = '100%';
    input.style.marginTop = '4px';
    input.style.padding = '4px';
    label.appendChild(input);
    parent.appendChild(label);
    return label;
  }

  private updateSummary(): void {
    const summary_el = document.getElementById('prototypeTargetSarSummary');
    if (!summary_el) return;
    const range_params: SarRangeParams = {
      count: parseInt((document.getElementById('prototypeTargetRangeCount') as HTMLInputElement)?.value || '8', 10),
      spacing_km: parseFloat((document.getElementById('prototypeTargetRangeSpacing') as HTMLInputElement)?.value || '1.5'),
      offset_km: parseFloat((document.getElementById('prototypeTargetRangeOffset') as HTMLInputElement)?.value || '0'),
    };
    const azimuth_params: SarAzimuthParams = {
      count: parseInt((document.getElementById('prototypeTargetAzimuthCount') as HTMLInputElement)?.value || '9', 10),
      spacing_km: parseFloat((document.getElementById('prototypeTargetAzimuthSpacing') as HTMLInputElement)?.value || '1.5'),
      offset_km: parseFloat((document.getElementById('prototypeTargetAzimuthOffset') as HTMLInputElement)?.value || '0'),
    };
    const summary = computeSarSummary(range_params, azimuth_params);
    summary_el.textContent =
      `Range Coverage: ${summary.range_coverage_km.toFixed(2)} km\n` +
      `Azimuth Coverage: ${summary.azimuth_coverage_km.toFixed(2)} km\n` +
      `Total Area: ${summary.total_area_km2.toFixed(2)} km²\n` +
      `Total Pixels: ${summary.total_pixels}`;
  }

  private updateTargetDebounced(): void {
    if (this.update_debounce_timer !== null) {
      clearTimeout(this.update_debounce_timer);
    }
    this.update_debounce_timer = window.setTimeout(() => {
      this.drawTargetFootprint();
      this.update_debounce_timer = null;
    }, 500);
  }

  private drawTargetFootprint(): void {
    if (!this.viewer) return;
    this.clearTargetEntities();
    const center_lon = parseFloat((document.getElementById('prototypeTargetLongitude') as HTMLInputElement)?.value || '127');
    const center_lat = parseFloat((document.getElementById('prototypeTargetLatitude') as HTMLInputElement)?.value || '37.5');
    const heading_deg = parseFloat((document.getElementById('prototypeTargetAlongTrackHeading') as HTMLInputElement)?.value || '90');
    const range_params: SarRangeParams = {
      count: parseInt((document.getElementById('prototypeTargetRangeCount') as HTMLInputElement)?.value || '8', 10),
      spacing_km: parseFloat((document.getElementById('prototypeTargetRangeSpacing') as HTMLInputElement)?.value || '1.5'),
      offset_km: parseFloat((document.getElementById('prototypeTargetRangeOffset') as HTMLInputElement)?.value || '0'),
    };
    const azimuth_params: SarAzimuthParams = {
      count: parseInt((document.getElementById('prototypeTargetAzimuthCount') as HTMLInputElement)?.value || '9', 10),
      spacing_km: parseFloat((document.getElementById('prototypeTargetAzimuthSpacing') as HTMLInputElement)?.value || '1.5'),
      offset_km: parseFloat((document.getElementById('prototypeTargetAzimuthOffset') as HTMLInputElement)?.value || '0'),
    };
    const corners = computeGridCornersLonLat(
      center_lon,
      center_lat,
      heading_deg,
      range_params,
      azimuth_params
    );
    const positions = corners.map((c) =>
      Cesium.Cartesian3.fromDegrees(c.longitude_deg, c.latitude_deg, 0)
    );
    const center_alt = parseFloat(
      (document.getElementById('prototypeTargetAltitude') as HTMLInputElement)?.value || '0'
    );
    const grid_center = computeGridCenterLonLat(
      center_lon,
      center_lat,
      heading_deg,
      range_params,
      azimuth_params
    );
    this.target_footprint_entity = this.viewer.entities.add({
      name: 'SAR 타겟 영역',
      position: Cesium.Cartesian3.fromDegrees(
        grid_center.longitude_deg,
        grid_center.latitude_deg,
        center_alt
      ),
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: Cesium.Color.CYAN.withAlpha(0.25),
        outline: true,
        outlineColor: Cesium.Color.CYAN,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });

    // 격자점(픽셀) 표시
    const grid_points = computeAllGridPointsLonLat(
      center_lon,
      center_lat,
      heading_deg,
      range_params,
      azimuth_params
    );
    for (const p of grid_points) {
      const entity = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          p.longitude_deg,
          p.latitude_deg,
          0
        ),
        point: {
          pixelSize: 6,
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
      this.grid_point_entities.push(entity);
    }

    // Along-track / Cross-track 방향선 — 폴리곤 모서리(가장자리)에 배치
    // corners 순서: [0]=(az_min,r_min), [1]=(az_max,r_min), [2]=(az_max,r_max), [3]=(az_min,r_max)
    const c0 = corners[0];
    const c1 = corners[1];
    const c3 = corners[3];

    const along_line = this.viewer.entities.add({
      name: 'Along-track',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          c0.longitude_deg,
          c0.latitude_deg,
          center_alt,
          c1.longitude_deg,
          c1.latitude_deg,
          center_alt,
        ]),
        width: 3,
        material: Cesium.Color.YELLOW,
        clampToGround: true,
      },
    });
    this.direction_entities.push(along_line);

    const cross_line = this.viewer.entities.add({
      name: 'Cross-track',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          c0.longitude_deg,
          c0.latitude_deg,
          center_alt,
          c3.longitude_deg,
          c3.latitude_deg,
          center_alt,
        ]),
        width: 3,
        material: Cesium.Color.ORANGE,
        clampToGround: true,
      },
    });
    this.direction_entities.push(cross_line);

    // 방향선 끝(모서리 방향)에 레이블 배치
    const along_label = this.viewer.entities.add({
      name: 'Along-track label',
      position: Cesium.Cartesian3.fromDegrees(
        c1.longitude_deg,
        c1.latitude_deg,
        center_alt
      ),
      label: {
        text: 'Along-track',
        font: '14px sans-serif',
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(8, 0),
      },
    });
    this.direction_entities.push(along_label);

    const cross_label = this.viewer.entities.add({
      name: 'Cross-track label',
      position: Cesium.Cartesian3.fromDegrees(
        c3.longitude_deg,
        c3.latitude_deg,
        center_alt
      ),
      label: {
        text: 'Cross-track',
        font: '14px sans-serif',
        fillColor: Cesium.Color.ORANGE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(8, 0),
      },
    });
    this.direction_entities.push(cross_label);
  }

  private clearTargetEntities(): void {
    if (this.viewer) {
      if (this.target_footprint_entity) {
        if (this.viewer.trackedEntity === this.target_footprint_entity) {
          this.viewer.trackedEntity = undefined;
        }
        this.viewer.entities.remove(this.target_footprint_entity);
        this.target_footprint_entity = null;
      }
      for (const entity of this.grid_point_entities) {
        this.viewer.entities.remove(entity);
      }
      this.grid_point_entities.length = 0;
      for (const entity of this.direction_entities) {
        this.viewer.entities.remove(entity);
      }
      this.direction_entities.length = 0;
    }
  }

  /**
   * 타겟 폴리곤 범위 내 지역 정보(경계·면적·고도)를 Cesium terrain으로 가져와 콜백 호출
   */
  async fetchRegionInfo(): Promise<void> {
    if (!this.viewer || !this.on_region_info_fetched) return;
    const btn = this.fetch_region_info_button;
    if (btn) {
      btn.disabled = true;
      btn.textContent = '가져오는 중…';
    }
    const center_lon = parseFloat(
      (document.getElementById('prototypeTargetLongitude') as HTMLInputElement)?.value || '127'
    );
    const center_lat = parseFloat(
      (document.getElementById('prototypeTargetLatitude') as HTMLInputElement)?.value || '37.5'
    );
    const heading_deg = parseFloat(
      (document.getElementById('prototypeTargetAlongTrackHeading') as HTMLInputElement)?.value || '90'
    );
    const range_params: SarRangeParams = {
      count: parseInt((document.getElementById('prototypeTargetRangeCount') as HTMLInputElement)?.value || '8', 10),
      spacing_km: parseFloat((document.getElementById('prototypeTargetRangeSpacing') as HTMLInputElement)?.value || '1.5'),
      offset_km: parseFloat((document.getElementById('prototypeTargetRangeOffset') as HTMLInputElement)?.value || '0'),
    };
    const azimuth_params: SarAzimuthParams = {
      count: parseInt((document.getElementById('prototypeTargetAzimuthCount') as HTMLInputElement)?.value || '9', 10),
      spacing_km: parseFloat((document.getElementById('prototypeTargetAzimuthSpacing') as HTMLInputElement)?.value || '1.5'),
      offset_km: parseFloat((document.getElementById('prototypeTargetAzimuthOffset') as HTMLInputElement)?.value || '0'),
    };
    const grid_points = computeAllGridPointsLonLat(
      center_lon,
      center_lat,
      heading_deg,
      range_params,
      azimuth_params
    );
    const corners = computeGridCornersLonLat(
      center_lon,
      center_lat,
      heading_deg,
      range_params,
      azimuth_params
    );
    const summary = computeSarSummary(range_params, azimuth_params);
    const bounds = {
      lonMin: Math.min(...corners.map((c) => c.longitude_deg)),
      lonMax: Math.max(...corners.map((c) => c.longitude_deg)),
      latMin: Math.min(...corners.map((c) => c.latitude_deg)),
      latMax: Math.max(...corners.map((c) => c.latitude_deg)),
    };
    const areaKm2 = summary.total_area_km2;
    const rangeCount = range_params.count;
    const azimuthCount = azimuth_params.count;
    const cartographics = grid_points.map((c) =>
      Cesium.Cartographic.fromDegrees(c.longitude_deg, c.latitude_deg, 0)
    );
    let elevation: { min: number; max: number; mean: number } | null = null;
    const elevationGrid: ElevationGridPoint[] = [];
    try {
      const provider = this.viewer.terrainProvider;
      const sampled = await Cesium.sampleTerrainMostDetailed(provider, cartographics);
      for (let i = 0; i < grid_points.length; i++) {
        const p = grid_points[i];
        const h = sampled[i]?.height;
        const height_m = typeof h === 'number' ? h : 0;
        elevationGrid.push({
          longitude_deg: p.longitude_deg,
          latitude_deg: p.latitude_deg,
          height_m,
        });
      }
      const heights = elevationGrid.map((e) => e.height_m).filter((h) => h !== undefined);
      if (heights.length > 0) {
        const min = Math.min(...heights);
        const max = Math.max(...heights);
        const mean = heights.reduce((a, b) => a + b, 0) / heights.length;
        elevation = { min, max, mean };
      }
    } catch (err) {
      console.warn('[TargetSettings] 지형 고도 샘플 실패, 경계/면적만 전달:', err);
      for (const p of grid_points) {
        elevationGrid.push({
          longitude_deg: p.longitude_deg,
          latitude_deg: p.latitude_deg,
          height_m: 0,
        });
      }
    }

    let buildings = await fetchBuildingsFromOverpass(bounds);
    let buildingsSource: 'OpenStreetMap Overpass API' | 'Cesium OSM Buildings' =
      'OpenStreetMap Overpass API';
    if (buildings.length === 0) {
      buildings = this.collectBuildingsInBounds(bounds);
      buildingsSource = 'Cesium OSM Buildings';
    }
    if (elevationGrid.length > 0) {
      addTerrainElevationToBuildings(buildings, elevationGrid);
    }

    const regionInfo: RegionInfo = {
      bounds,
      areaKm2,
      elevation,
      sampleCount: elevationGrid.length,
      elevationGrid,
      rangeCount,
      azimuthCount,
      buildings,
      regionName: 'Seoul Target',
      buildingsSource,
    };
    this.on_region_info_fetched(regionInfo);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '지역 정보 가져오기';
    }
  }

  /**
   * 타겟 bounds 내 로드된 3D Tiles 건물 피처 수집 (타일 중심 + batch table 속성)
   */
  private collectBuildingsInBounds(bounds: {
    lonMin: number;
    lonMax: number;
    latMin: number;
    latMax: number;
  }): BuildingFeature[] {
    const result: BuildingFeature[] = [];
    if (!this.viewer || !this.viewer.scene) return result;
    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    const scratchCartographic = new Cesium.Cartographic();

    const inBounds = (lon: number, lat: number): boolean =>
      lon >= bounds.lonMin && lon <= bounds.lonMax && lat >= bounds.latMin && lat <= bounds.latMax;

    const visitTile = (tile: any): void => {
      if (!tile) return;
      try {
        const content = tile.content;
        if (content && content.featuresLength > 0) {
          const sphere = tile.boundingSphere;
          if (sphere && sphere.center) {
            const carto = Cesium.Cartographic.fromCartesian(
              sphere.center,
              ellipsoid,
              scratchCartographic
            );
            const lonDeg = Cesium.Math.toDegrees(carto.longitude);
            const latDeg = Cesium.Math.toDegrees(carto.latitude);
            const height_m = carto.height ?? 0;
            if (inBounds(lonDeg, latDeg)) {
              for (let i = 0; i < content.featuresLength; i++) {
                try {
                  const feature = content.getFeature(i);
                  if (!feature) continue;
                  const ids = feature.getPropertyIds ? feature.getPropertyIds() : [];
                  const properties: Record<string, unknown> = {};
                  for (const id of ids) {
                    try {
                      properties[id] = feature.getProperty(id);
                    } catch {
                      // skip single property
                    }
                  }
                  result.push({
                    longitude_deg: lonDeg,
                    latitude_deg: latDeg,
                    height_m,
                    properties,
                  });
                } catch {
                  // skip single feature
                }
              }
            }
          }
        }
        const children = tile.children;
        if (children && children.length > 0) {
          for (let c = 0; c < children.length; c++) {
            visitTile(children[c]);
          }
        }
      } catch {
        // skip tile
      }
    };

    const primitives = this.viewer.scene.primitives;
    for (let i = 0; i < primitives.length; i++) {
      const p = primitives.get(i);
      if (p && p instanceof Cesium.Cesium3DTileset && p.root) {
        visitTile(p.root);
      }
    }
    return result;
  }

  /**
   * 타겟 위치로 카메라 이동 (타겟 설정 탭 진입 시 호출)
   */
  flyToTarget(): void {
    if (!this.viewer) return;
    try {
      // 타겟 엔티티가 없으면 먼저 그리기 (중심 엔티티 포함)
      this.drawTargetFootprint();

      if (this.viewer.camera._flight && this.viewer.camera._flight.isActive()) {
        this.viewer.camera.cancelFlight();
      }
      this.viewer.trackedEntity = undefined;

      // 폴리곤 엔티티의 position(그리드 중심)으로만 비행 (카메라 고정 없음)
      if (this.target_footprint_entity) {
        const pos = this.target_footprint_entity.position.getValue(Cesium.JulianDate.now());
        if (pos) {
          const radius = 80000; // 80km — 타겟 영역이 보이도록
          const boundingSphere = new Cesium.BoundingSphere(pos, radius);
          this.viewer.camera.flyToBoundingSphere(boundingSphere, { duration: 1.5 });
        }
      }
    } catch (error) {
      console.error('[TargetSettings] 타겟으로 카메라 이동 오류:', error);
    }
  }

  /**
   * 지도 우클릭 위치로 타겟 설정 (경·위도 입력 갱신, 폴리곤·카메라 이동)
   */
  setTargetFromMap(lon: number, lat: number): void {
    const lonEl = document.getElementById('prototypeTargetLongitude') as HTMLInputElement;
    const latEl = document.getElementById('prototypeTargetLatitude') as HTMLInputElement;
    if (lonEl) lonEl.value = String(lon);
    if (latEl) latEl.value = String(lat);
    this.updateSummary();
    this.updateTargetDebounced();
    if (this.viewer) this.flyToTarget();
  }

  /**
   * Cleanup target settings
   */
  cleanup(): void {
    if (this.update_debounce_timer !== null) {
      clearTimeout(this.update_debounce_timer);
      this.update_debounce_timer = null;
    }
    this.clearTargetEntities();
    this.fetch_region_info_button = null;
    this.on_region_info_fetched = null;
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.viewer = null;
  }
}