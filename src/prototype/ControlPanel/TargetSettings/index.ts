import {
  computeSarSummary,
  type SarRangeParams,
  type SarAzimuthParams,
} from './_util/sar-target-calculator.js';
import {
  computeGridCornersLonLat,
  computeAllGridPointsLonLat,
} from './_util/sar-grid-to-cesium.js';
import { fetchBuildingsFromOverpass } from './_util/overpass-buildings.js';
import { addTerrainElevationToBuildings } from './_util/sar-region-payload.js';
import { restoreZoomDistance } from '../SatelliteSettings/_util/camera-manager.js';
import type { SatelliteBusPayloadManager } from '../SatelliteSettings/SatelliteBusPayloadManager/index.js';

/** swath 크기 (km) — prototype-swath-preview.ts의 SWATH_SPACING_M = 5000과 동일 */
const SWATH_KM = 5.0;
/** postRender sync 최소 간격 (ms) */
const SYNC_THROTTLE_MS = 500;
/** 지구 중력상수 (km³/s²) */
const GM_EARTH_KM3_S2 = 3.986004418e5;
/** 지구 평균 반경 (km) */
const R_EARTH_KM = 6371.0;

type SarMode = 'spotlight' | 'sliding_spotlight' | 'stripmap';

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
  /** 위성 swath 연동용 busPayloadManager */
  busPayloadManager?: SatelliteBusPayloadManager | null;
}

/**
 * TargetSettings - Target settings tab management class
 */
export class TargetSettings {
  private container: HTMLElement | null;
  private viewer: any;
  private grid_point_entities: any[];
  private update_debounce_timer: number | null;
  private on_region_info_fetched: ((data: RegionInfo) => void) | null;
  private fetch_region_info_button: HTMLButtonElement | null;
  private bus_payload_manager: SatelliteBusPayloadManager | null;
  private post_render_remove: (() => void) | null;
  private sync_throttle_last_ms: number;
  private along_track_entity: any | null;
  private current_sar_mode: SarMode;

  constructor() {
    this.container = null;
    this.viewer = null;
    this.grid_point_entities = [];
    this.update_debounce_timer = null;
    this.on_region_info_fetched = null;
    this.fetch_region_info_button = null;
    this.bus_payload_manager = null;
    this.post_render_remove = null;
    this.sync_throttle_last_ms = 0;
    this.along_track_entity = null;
    this.current_sar_mode = 'spotlight';
  }

  /**
   * Initialize target settings tab
   */
  initialize(container: HTMLElement, viewer?: any, options?: TargetSettingsOptions): void {
    this.container = container;
    this.viewer = viewer || null;
    this.on_region_info_fetched = options?.onRegionInfoFetched ?? null;
    this.bus_payload_manager = options?.busPayloadManager ?? null;

    const saved_mode = localStorage.getItem('prototype_sar_mode') as SarMode | null;
    if (saved_mode === 'sliding_spotlight' || saved_mode === 'stripmap') {
      this.current_sar_mode = saved_mode;
    } else {
      this.current_sar_mode = 'spotlight';
    }

    this.render();
    if (this.viewer) {
      this.setupSwathSync();
      this.updateSpacings();
      this.updateMissionTime();
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

    // Target settings form
    const form = document.createElement('div');
    form.style.marginTop = '4px';

    // 위성 swath 동기화 정보 (읽기 전용)
    this.createReadonlyField(form, 'Longitude (deg):', 'prototypeTargetLongitude', '—');
    this.createReadonlyField(form, 'Latitude (deg):', 'prototypeTargetLatitude', '—');
    this.createReadonlyField(form, 'Heading (deg):', 'prototypeTargetAlongTrackHeading', '—');

    // SAR 타겟 파라미터 섹션
    const sar_section = document.createElement('div');
    sar_section.style.marginTop = '16px';
    sar_section.style.paddingTop = '12px';
    sar_section.style.borderTop = '1px solid #333';
    const sar_title = document.createElement('h4');
    sar_title.textContent = 'SAR Grid Parameters';
    sar_title.style.marginBottom = '10px';
    sar_title.style.fontSize = '14px';
    sar_title.style.color = '#ccc';
    sar_section.appendChild(sar_title);
    form.appendChild(sar_section);

    // 모드 선택 버튼 그룹
    const mode_selector = document.createElement('div');
    mode_selector.className = 'sar-mode-selector';
    const mode_defs: { id: string; label: string; mode: SarMode }[] = [
      { id: 'sarModeSpotlight', label: 'Spotlight', mode: 'spotlight' },
      { id: 'sarModeSlidingSpotlight', label: 'Sliding Spotlight', mode: 'sliding_spotlight' },
      { id: 'sarModeStripmap', label: 'Stripmap', mode: 'stripmap' },
    ];
    const mode_buttons: HTMLButtonElement[] = [];
    mode_defs.forEach(({ id, label, mode }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = id;
      btn.textContent = label;
      btn.className = 'sar-mode-btn' + (this.current_sar_mode === mode ? ' active' : '');
      btn.addEventListener('click', () => {
        this.current_sar_mode = mode;
        localStorage.setItem('prototype_sar_mode', mode);
        mode_buttons.forEach((b, i) => {
          b.classList.toggle('active', mode_defs[i].mode === mode);
        });
        spotlight_params.style.display = mode === 'spotlight' ? 'block' : 'none';
        non_spotlight_params.style.display = mode !== 'spotlight' ? 'block' : 'none';
        this.updateMissionTime();
        this.updateSummary();
        this.updateTargetDebounced();
      });
      mode_selector.appendChild(btn);
      mode_buttons.push(btn);
    });
    sar_section.appendChild(mode_selector);

    // Spotlight 전용 파라미터
    const spotlight_params = document.createElement('div');
    spotlight_params.style.display = this.current_sar_mode === 'spotlight' ? 'block' : 'none';
    this.createInputField(spotlight_params, 'Max Squint Angle (deg):', 'prototypeTargetSquintAngle', '20', '1', '60', '0.5');
    sar_section.appendChild(spotlight_params);

    // Sliding Spotlight / Stripmap 공통 파라미터
    const non_spotlight_params = document.createElement('div');
    non_spotlight_params.style.display = this.current_sar_mode !== 'spotlight' ? 'block' : 'none';
    this.createInputField(non_spotlight_params, 'Along Track Length (km):', 'prototypeTargetAlongTrackLength', '20', '0.1', '10000', '0.1');
    sar_section.appendChild(non_spotlight_params);

    // 미션 시간 (읽기 전용, text 타입으로 '—' 표시 가능)
    this.createReadonlyField(sar_section, 'Mission Time (s):', 'prototypeTargetMissionTime', '—', 'text');

    this.createInputField(sar_section, 'Range Count:', 'prototypeTargetRangeCount', '8', '1', '10000', '1');
    this.createReadonlyField(sar_section, 'Range Spacing (km):', 'prototypeTargetRangeSpacing', `${(SWATH_KM / 7).toFixed(4)}`);
    this.createReadonlyField(sar_section, 'Range Offset (km):', 'prototypeTargetRangeOffset', `${(-SWATH_KM / 2).toFixed(4)}`);
    this.createInputField(sar_section, 'Azimuth Count:', 'prototypeTargetAzimuthCount', '9', '1', '10000', '1');
    this.createReadonlyField(sar_section, 'Azimuth Spacing (km):', 'prototypeTargetAzimuthSpacing', `${(SWATH_KM / 8).toFixed(4)}`);
    this.createReadonlyField(sar_section, 'Azimuth Offset (km):', 'prototypeTargetAzimuthOffset', `${(-SWATH_KM / 2).toFixed(4)}`);

    // 격자점 크기
    const display_title = document.createElement('h5');
    display_title.textContent = 'Display';
    display_title.style.marginTop = '12px';
    display_title.style.fontSize = '12px';
    display_title.style.color = '#aaa';
    sar_section.appendChild(display_title);
    this.createInputField(sar_section, 'Point Size (px):', 'prototypeTargetPointSize', '6', '1', '50', '1');

    // 요약 (읽기 전용)
    const summary_title = document.createElement('h5');
    summary_title.textContent = 'Summary';
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
    region_info_btn.textContent = 'Fetch Region Info';
    region_info_btn.className = 'sidebar-section button';
    region_info_btn.style.width = '100%';
    region_info_btn.style.marginTop = '8px';
    region_info_section.appendChild(region_info_btn);
    form.appendChild(region_info_section);
    this.fetch_region_info_button = region_info_btn;

    region_info_btn.addEventListener('click', () => this.fetchRegionInfo());

    section.appendChild(form);
    this.container.appendChild(section);

    // Count 변경 시 spacing 자동 재계산
    const count_ids = ['prototypeTargetRangeCount', 'prototypeTargetAzimuthCount'];
    count_ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateSpacings());
        el.addEventListener('change', () => this.updateSpacings());
      }
    });

    // 모드별 파라미터 입력 변경 시 미션시간 갱신
    const mission_input_ids = ['prototypeTargetSquintAngle', 'prototypeTargetAlongTrackLength'];
    mission_input_ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateMissionTime());
        el.addEventListener('change', () => this.updateMissionTime());
      }
    });

    // 입력 변경 시 요약 갱신 + Cesium 디바운스 (readonly 필드 제외)
    const input_ids = [
      'prototypeTargetRangeCount',
      'prototypeTargetAzimuthCount',
      'prototypeTargetPointSize',
      'prototypeTargetSquintAngle',
      'prototypeTargetAlongTrackLength',
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

  /** Swath에서 자동 계산되는 읽기 전용 입력 필드 생성 */
  private createReadonlyField(
    parent: HTMLElement,
    label_text: string,
    input_id: string,
    initial_value: string,
    input_type: 'number' | 'text' = 'number'
  ): HTMLElement {
    const label = document.createElement('label');
    label.style.marginTop = '10px';
    label.style.display = 'block';
    label.textContent = label_text;
    const input = document.createElement('input');
    input.type = input_type;
    input.id = input_id;
    input.value = initial_value;
    input.readOnly = true;
    input.tabIndex = -1;
    input.style.width = '100%';
    input.style.marginTop = '4px';
    input.style.padding = '4px';
    input.style.opacity = '0.6';
    input.style.cursor = 'not-allowed';
    label.appendChild(input);
    parent.appendChild(label);
    return label;
  }

  /**
   * 위성 고도로부터 지상 궤도 속도 계산 (원궤도 근사)
   */
  private getSatelliteGroundSpeedKmS(): number | null {
    const pos = this.bus_payload_manager?.getPositionForSwath?.();
    if (!pos) return null;
    const alt_km = pos.altitude / 1000;
    return Math.sqrt(GM_EARTH_KM3_S2 / (R_EARTH_KM + alt_km));
  }

  /**
   * 현재 모드와 파라미터를 기반으로 미션시간 계산 후 읽기전용 필드에 반영
   */
  private updateMissionTime(): void {
    const mission_time_el = document.getElementById('prototypeTargetMissionTime') as HTMLInputElement | null;
    if (!mission_time_el) return;

    const v = this.getSatelliteGroundSpeedKmS();

    if (this.current_sar_mode === 'spotlight') {
      if (!v || !this.bus_payload_manager) {
        mission_time_el.value = '—';
        return;
      }
      const pos = this.bus_payload_manager.getPositionForSwath?.();
      const alt_km = pos ? pos.altitude / 1000 : 500;
      const squint_el = document.getElementById('prototypeTargetSquintAngle') as HTMLInputElement | null;
      const squint_deg = parseFloat(squint_el?.value || '20');
      const t = (2 * alt_km * Math.tan((squint_deg * Math.PI) / 180)) / v;
      mission_time_el.value = t.toFixed(1);
    } else {
      if (!v) {
        mission_time_el.value = '—';
        return;
      }
      const along_el = document.getElementById('prototypeTargetAlongTrackLength') as HTMLInputElement | null;
      const along_km = parseFloat(along_el?.value || '20');
      const t = along_km / v;
      mission_time_el.value = t.toFixed(1);
    }
  }

  /**
   * Range/Azimuth Spacing을 swath 크기 기준으로 자동 계산하여 readonly 필드에 반영
   * spacing = SWATH_KM / (count - 1), count=1일 때는 SWATH_KM
   */
  private updateSpacings(): void {
    const range_count = parseInt(
      (document.getElementById('prototypeTargetRangeCount') as HTMLInputElement)?.value || '8',
      10
    );
    const azimuth_count = parseInt(
      (document.getElementById('prototypeTargetAzimuthCount') as HTMLInputElement)?.value || '9',
      10
    );

    const range_spacing = range_count > 1 ? SWATH_KM / (range_count - 1) : SWATH_KM;
    const azimuth_spacing = azimuth_count > 1 ? SWATH_KM / (azimuth_count - 1) : SWATH_KM;

    const range_el = document.getElementById('prototypeTargetRangeSpacing') as HTMLInputElement;
    const azimuth_el = document.getElementById('prototypeTargetAzimuthSpacing') as HTMLInputElement;
    if (range_el) range_el.value = range_spacing.toFixed(4);
    if (azimuth_el) azimuth_el.value = azimuth_spacing.toFixed(4);

    // swath 중심 기준 대칭 배치를 위해 offset = -SWATH_KM/2 고정
    const range_offset_el = document.getElementById('prototypeTargetRangeOffset') as HTMLInputElement;
    const azimuth_offset_el = document.getElementById('prototypeTargetAzimuthOffset') as HTMLInputElement;
    const center_offset = (-SWATH_KM / 2).toFixed(4);
    if (range_offset_el) range_offset_el.value = center_offset;
    if (azimuth_offset_el) azimuth_offset_el.value = center_offset;

    this.updateSummary();
    this.updateTargetDebounced();
  }

  /**
   * postRender 이벤트를 통해 위성 swath 중심 좌표와 heading을 AOI 필드에 실시간 동기화
   */
  private setupSwathSync(): void {
    if (!this.viewer || !this.bus_payload_manager) return;

    const remove = this.viewer.scene.postRender.addEventListener(() => {
      const now = performance.now();
      if (now - this.sync_throttle_last_ms < SYNC_THROTTLE_MS) return;
      this.sync_throttle_last_ms = now;
      this.syncFromSwath();
    });

    this.post_render_remove = remove;
  }

  /**
   * 위성 swath 중심 좌표와 heading을 읽어 AOI 입력 필드에 반영
   * 포커스 중인 필드는 덮어쓰지 않음
   */
  private syncFromSwath(): void {
    if (!this.bus_payload_manager) return;

    const ground_point = this.bus_payload_manager.getYAxisGroundPoint?.();
    const pos = this.bus_payload_manager.getPositionForSwath?.();
    if (!ground_point || !pos) return;

    const lon_el = document.getElementById('prototypeTargetLongitude') as HTMLInputElement | null;
    const lat_el = document.getElementById('prototypeTargetLatitude') as HTMLInputElement | null;
    const heading_el = document.getElementById('prototypeTargetAlongTrackHeading') as HTMLInputElement | null;

    let changed = false;
    const lon_str = ground_point.longitude.toFixed(6);
    const lat_str = ground_point.latitude.toFixed(6);
    const heading_str = pos.heading.toFixed(2);

    if (lon_el && document.activeElement !== lon_el && lon_el.value !== lon_str) {
      lon_el.value = lon_str;
      changed = true;
    }
    if (lat_el && document.activeElement !== lat_el && lat_el.value !== lat_str) {
      lat_el.value = lat_str;
      changed = true;
    }
    if (heading_el && document.activeElement !== heading_el && heading_el.value !== heading_str) {
      heading_el.value = heading_str;
      changed = true;
    }

    if (changed) {
      this.updateSpacings(); // spacing/offset 표시 갱신 + summary + debounced draw
      this.updateMissionTime();
    }
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
    const mode_label: Record<SarMode, string> = {
      spotlight: 'Spotlight',
      sliding_spotlight: 'Sliding Spotlight',
      stripmap: 'Stripmap',
    };
    const mission_time_val = (document.getElementById('prototypeTargetMissionTime') as HTMLInputElement | null)?.value ?? '—';
    summary_el.textContent =
      `Mode: ${mode_label[this.current_sar_mode]}\n` +
      `Mission Time: ${mission_time_val} s\n` +
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

    // bus_payload_manager가 있으면 DOM 필드 대신 직접 위성 swath 위치를 읽어 타이밍 문제 방지
    let center_lon: number;
    let center_lat: number;
    let heading_deg: number;

    if (this.bus_payload_manager) {
      const ground_point = this.bus_payload_manager.getYAxisGroundPoint?.();
      const pos = this.bus_payload_manager.getPositionForSwath?.();
      if (!ground_point || !pos) return; // 위성 위치 미확보 시 미표시
      center_lon = ground_point.longitude;
      center_lat = ground_point.latitude;
      heading_deg = pos.heading;
    } else {
      center_lon = parseFloat((document.getElementById('prototypeTargetLongitude') as HTMLInputElement)?.value || '127');
      center_lat = parseFloat((document.getElementById('prototypeTargetLatitude') as HTMLInputElement)?.value || '37.5');
      heading_deg = parseFloat((document.getElementById('prototypeTargetAlongTrackHeading') as HTMLInputElement)?.value || '90');
    }

    const range_count = parseInt((document.getElementById('prototypeTargetRangeCount') as HTMLInputElement)?.value || '8', 10);
    const azimuth_count = parseInt((document.getElementById('prototypeTargetAzimuthCount') as HTMLInputElement)?.value || '9', 10);
    const range_spacing = range_count > 1 ? SWATH_KM / (range_count - 1) : SWATH_KM;
    const azimuth_spacing = azimuth_count > 1 ? SWATH_KM / (azimuth_count - 1) : SWATH_KM;

    const range_params: SarRangeParams = {
      count: range_count,
      spacing_km: range_spacing,
      offset_km: -SWATH_KM / 2, // swath 중심 기준 대칭 — 항상 고정
    };
    const azimuth_params: SarAzimuthParams = {
      count: azimuth_count,
      spacing_km: azimuth_spacing,
      offset_km: -SWATH_KM / 2, // swath 중심 기준 대칭 — 항상 고정
    };

    const point_size = parseInt(
      (document.getElementById('prototypeTargetPointSize') as HTMLInputElement)?.value || '6',
      10
    );

    // swath 내 격자점만 표시 (별도 폴리곤/방향선 없음)
    const grid_points = computeAllGridPointsLonLat(
      center_lon,
      center_lat,
      heading_deg,
      range_params,
      azimuth_params
    );
    for (const p of grid_points) {
      const entity = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(p.longitude_deg, p.latitude_deg, 0),
        point: {
          pixelSize: point_size,
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
      this.grid_point_entities.push(entity);
    }

    // Sliding Spotlight / Stripmap 모드에서 Along Track 미션 영역 표시
    this.drawAlongTrackEntity();
  }

  private clearTargetEntities(): void {
    if (this.viewer) {
      for (const entity of this.grid_point_entities) {
        this.viewer.entities.remove(entity);
      }
      this.grid_point_entities.length = 0;
    }
    this.clearAlongTrackEntity();
  }

  /**
   * Sliding Spotlight / Stripmap 모드에서 Along Track 미션 영역을 Cesium 폴리곤으로 표시
   */
  private drawAlongTrackEntity(): void {
    this.clearAlongTrackEntity();
    if (this.current_sar_mode === 'spotlight') return;
    if (!this.viewer || !this.bus_payload_manager) return;

    const ground_point = this.bus_payload_manager.getYAxisGroundPoint?.();
    const pos = this.bus_payload_manager.getPositionForSwath?.();
    if (!ground_point || !pos) return;

    const along_km = parseFloat(
      (document.getElementById('prototypeTargetAlongTrackLength') as HTMLInputElement)?.value || '20'
    );

    // swath 뒤쪽 끝선(-SWATH_KM/2)에서 시작해 진행 방향으로 along_km 뻗는 폴리곤
    // offset = -SWATH_KM/2 + along_km/2 → az_min=-SWATH_KM/2 (swath trailing edge), az_max=-SWATH_KM/2+along_km
    const range_params: SarRangeParams = { count: 1, spacing_km: SWATH_KM, offset_km: 0 };
    const azimuth_params: SarAzimuthParams = { count: 1, spacing_km: along_km, offset_km: -SWATH_KM / 2 + along_km / 2 };

    const corners = computeGridCornersLonLat(
      ground_point.longitude,
      ground_point.latitude,
      pos.heading,
      range_params,
      azimuth_params
    );

    const positions = corners.map((c) =>
      Cesium.Cartesian3.fromDegrees(c.longitude_deg, c.latitude_deg, 0)
    );

    this.along_track_entity = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: Cesium.Color.ORANGE.withAlpha(0.18),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      polyline: {
        positions: [...positions, positions[0]],
        width: 1.5,
        material: Cesium.Color.ORANGE.withAlpha(0.8),
        clampToGround: true,
      },
    });
  }

  private clearAlongTrackEntity(): void {
    if (this.viewer && this.along_track_entity) {
      this.viewer.entities.remove(this.along_track_entity);
      this.along_track_entity = null;
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
      btn.textContent = 'Fetching...';
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
      btn.textContent = 'Fetch Region Info';
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
      this.drawTargetFootprint();

      if (this.viewer.camera._flight && this.viewer.camera._flight.isActive()) {
        this.viewer.camera.cancelFlight();
      }
      this.viewer.trackedEntity = undefined;
      restoreZoomDistance(this.viewer);

      const center_lon = parseFloat(
        (document.getElementById('prototypeTargetLongitude') as HTMLInputElement)?.value || '127'
      );
      const center_lat = parseFloat(
        (document.getElementById('prototypeTargetLatitude') as HTMLInputElement)?.value || '37.5'
      );
      const pos = Cesium.Cartesian3.fromDegrees(center_lon, center_lat, 0);
      const boundingSphere = new Cesium.BoundingSphere(pos, 80000);
      this.viewer.camera.flyToBoundingSphere(boundingSphere, { duration: 0 });
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
    if (typeof this.post_render_remove === 'function') {
      this.post_render_remove();
      this.post_render_remove = null;
    }
    this.clearAlongTrackEntity();
    this.clearTargetEntities();
    this.fetch_region_info_button = null;
    this.on_region_info_fetched = null;
    this.bus_payload_manager = null;
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.viewer = null;
  }
}