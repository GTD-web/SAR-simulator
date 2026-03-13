import { SatelliteSettings } from './SatelliteSettings/index.js';
import { OrbitSettings } from './OrbitSettings/index.js';
import { TargetSettings, type TargetSettingsOptions } from './TargetSettings/index.js';
import { restoreZoomDistance } from './SatelliteSettings/_util/camera-manager.js';
import { SARSwathCalculator } from '../../poc/utils/sar-swath-calculator.js';

export interface ControlPanelOptions {
  onRegionInfoFetched?: (data: import('./TargetSettings/index.js').RegionInfo) => void;
  /** 미니맵 열기 버튼을 추가할 컨테이너 (카메라 버튼 우측) */
  miniMapExpandButtonContainer?: HTMLElement | null;
}

/**
 * ControlPanelManager - Prototype 제어 패널 관리자
 */
export class ControlPanelManager {
  private sidebar: HTMLElement | null;
  private sidebarContent: HTMLElement | null;
  private satelliteSettings: SatelliteSettings | null;
  private orbitSettings: OrbitSettings | null;
  private targetSettings: TargetSettings | null;
  private viewer: any;

  constructor() {
    this.sidebar = null;
    this.sidebarContent = null;
    this.satelliteSettings = null;
    this.orbitSettings = null;
    this.targetSettings = null;
    this.viewer = null;
  }

  /**
   * 제어 패널 초기화
   */
  initialize(viewer?: any, options?: ControlPanelOptions): void {
    this.createControlPanel(viewer, options);
    this.setupStyles();
  }

  /**
   * 제어 패널 생성
   */
  private createControlPanel(viewer?: any, options?: ControlPanelOptions): void {
    this.viewer = viewer || null;
    // 기존 사이드바 확인
    this.sidebar = document.getElementById('sidebar');
    
    if (!this.sidebar) {
      console.warn('[ControlPanelManager] 사이드바를 찾을 수 없습니다.');
      return;
    }

    // 사이드바 콘텐츠
    this.sidebarContent = this.sidebar.querySelector('#sidebarContent');
    if (!this.sidebarContent) {
      console.warn('[ControlPanelManager] 사이드바 콘텐츠를 찾을 수 없습니다.');
      return;
    }

    // 기존 콘텐츠 제거
    this.sidebarContent.innerHTML = '';

    // 탭 컨테이너 생성
    const tabContainer = document.createElement('div');
    tabContainer.className = 'tab-container';

    // 탭 버튼 생성
    const tabButtons = document.createElement('div');
    tabButtons.className = 'tab-buttons';

    // 위성 설정 탭 버튼
    const satelliteTabButton = document.createElement('button');
    satelliteTabButton.className = 'tab-button active';
    satelliteTabButton.setAttribute('data-tab', 'satellite');
    satelliteTabButton.textContent = 'Satellite';
    tabButtons.appendChild(satelliteTabButton);

    // 궤도 설정 탭 버튼
    const orbitTabButton = document.createElement('button');
    orbitTabButton.className = 'tab-button';
    orbitTabButton.setAttribute('data-tab', 'orbit');
    orbitTabButton.textContent = 'Orbit';
    tabButtons.appendChild(orbitTabButton);

    // AOI 탭 버튼
    const targetTabButton = document.createElement('button');
    targetTabButton.className = 'tab-button';
    targetTabButton.setAttribute('data-tab', 'target');
    targetTabButton.textContent = 'AOI';
    tabButtons.appendChild(targetTabButton);

    tabContainer.appendChild(tabButtons);

    // 위성 설정 탭 콘텐츠
    const satelliteTabContent = document.createElement('div');
    satelliteTabContent.id = 'satelliteTab';
    satelliteTabContent.className = 'tab-content active';
    satelliteTabContent.style.paddingTop = '0';
    tabContainer.appendChild(satelliteTabContent);

    // 궤도 설정 탭 콘텐츠
    const orbitTabContent = document.createElement('div');
    orbitTabContent.id = 'orbitTab';
    orbitTabContent.className = 'tab-content';
    orbitTabContent.style.paddingTop = '0';
    tabContainer.appendChild(orbitTabContent);

    // 타겟 설정 탭 콘텐츠 — 2단 사이드바 (좌: AOI 폼, 우: 지역 정보)
    const targetTabContent = document.createElement('div');
    targetTabContent.id = 'targetTab';
    targetTabContent.className = 'tab-content target-tab-two-tier';

    const targetFormColumn = document.createElement('div');
    targetFormColumn.className = 'target-form-column';

    const targetRegionColumn = document.createElement('div');
    targetRegionColumn.id = 'targetGeoDataContent';
    targetRegionColumn.className = 'target-geo-data-content target-region-column';
    targetRegionColumn.innerHTML = '<p class="target-geo-data-placeholder">Set target first, then click \'Fetch Region Info\'.</p>';

    targetTabContent.appendChild(targetFormColumn);
    targetTabContent.appendChild(targetRegionColumn);
    tabContainer.appendChild(targetTabContent);

    this.sidebarContent.appendChild(tabContainer);

    // 각 설정 클래스 초기화
    this.satelliteSettings = new SatelliteSettings();
    this.satelliteSettings.initialize(satelliteTabContent, viewer, {
      miniMapExpandButtonContainer: options?.miniMapExpandButtonContainer ?? null,
    });

    this.orbitSettings = new OrbitSettings();
    this.orbitSettings.initialize(orbitTabContent, viewer, {
      busPayloadManager: this.satelliteSettings.getBusPayloadManager(),
    });
    this.satelliteSettings.setOrbitSettings(this.orbitSettings);

    const targetOptions: TargetSettingsOptions = {
      onRegionInfoFetched: options?.onRegionInfoFetched ?? undefined,
      busPayloadManager: this.satelliteSettings.getBusPayloadManager(),
      getCachedSatrec: () => this.orbitSettings?.getCachedSatrec() ?? null,
    };
    this.targetSettings = new TargetSettings();
    this.targetSettings.initialize(targetFormColumn, viewer, targetOptions);

    // 탭 전환 이벤트 설정
    this.setupTabEvents();

    // localStorage에 저장된 탭 복원, 없으면 satellite
    const savedTab = localStorage.getItem('prototype_active_tab');
    const initialTab = savedTab === 'orbit' || savedTab === 'target' ? savedTab : 'satellite';
    this.activateTab(initialTab);
    this.runTabActivationLogic(initialTab);

    // 프로토타입 로드 완료 후 사이드바 표시
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.visibility = 'visible';
  }

  /**
   * 탭 이벤트 설정
   */
  private setupTabEvents(): void {
    const tabButtons = this.sidebarContent?.querySelectorAll('.tab-button');
    const tabContents = this.sidebarContent?.querySelectorAll('.tab-content');

    if (!tabButtons || !tabContents) return;

    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');

        // 모든 탭 버튼과 콘텐츠에서 active 클래스 제거
        tabButtons.forEach((btn) => btn.classList.remove('active'));
        tabContents.forEach((content) => content.classList.remove('active'));

        // 클릭한 탭 버튼과 해당 콘텐츠에 active 클래스 추가
        button.classList.add('active');
        const targetContent = this.sidebarContent?.querySelector(`#${targetTab}Tab`);
        if (targetContent) {
          targetContent.classList.add('active');
        }

        // AOI 탭일 때 사이드바 확장 (2단 레이아웃용)
        this.sidebar?.classList.toggle('sidebar-aoi-expanded', targetTab === 'target');

        // 선택한 탭을 localStorage에 저장
        if (targetTab) {
          localStorage.setItem('prototype_active_tab', targetTab);
        }

        this.runTabActivationLogic(targetTab ?? '');
      });
    });
  }

  /**
   * 탭별 활성화 로직 (클릭/복원 시 공통)
   */
  private runTabActivationLogic(targetTab: string): void {
    if (targetTab === 'satellite' && this.satelliteSettings) {
      this.satelliteSettings.cancelCameraAnimation();
    }
    if (targetTab === 'orbit' && this.viewer) {
      if (this.satelliteSettings) {
        this.satelliteSettings.cancelCameraAnimation();
        this.satelliteSettings.ensureEntityExists();
      }
      this.orbitSettings?.prepareOrbitTab();
    }
    if (targetTab === 'target' && this.targetSettings) {
      this.orbitSettings?.stopCameraTracking();
      if (this.satelliteSettings) {
        this.satelliteSettings.cancelCameraAnimation();
      }
    }
  }

  /**
   * 스타일 설정
   */
  private setupStyles(): void {
    // 필요한 경우 추가 스타일 설정
  }

  /**
   * 특정 탭 활성화 (서버 초기화 시 사용)
   */
  private activateTab(tabId: string): void {
    const tabButtons = this.sidebarContent?.querySelectorAll('.tab-button');
    const tabContents = this.sidebarContent?.querySelectorAll('.tab-content');

    if (!tabButtons || !tabContents) return;

    // 모든 탭 버튼과 콘텐츠에서 active 클래스 제거
    tabButtons.forEach((btn) => btn.classList.remove('active'));
    tabContents.forEach((content) => content.classList.remove('active'));

    // 지정된 탭 버튼과 콘텐츠에 active 클래스 추가
    const targetButton = Array.from(tabButtons).find(
      (btn) => btn.getAttribute('data-tab') === tabId
    ) as HTMLElement;
    const targetContent = this.sidebarContent?.querySelector(`#${tabId}Tab`) as HTMLElement;

    if (targetButton) {
      targetButton.classList.add('active');
    }
    if (targetContent) {
      targetContent.classList.add('active');
    }
    this.sidebar?.classList.toggle('sidebar-aoi-expanded', tabId === 'target');
  }

  /**
   * 위성 위치로 카메라 이동 + 추적 설정
   */
  flyToSatellite(): void {
    if (!this.orbitSettings || !this.viewer) {
      console.warn('[ControlPanelManager] flyToSatellite: orbitSettings 또는 viewer 없음');
      return;
    }

    // entity가 없으면 기본 위치에 먼저 생성
    const busPayloadManager = this.satelliteSettings?.getBusPayloadManager();
    if (!busPayloadManager?.getBusEntity()) {
      this.satelliteSettings?.ensureEntityExists();
    }

    this.orbitSettings.zoomToSatelliteAndTrack();
  }

  /**
   * 지구로 카메라 이동
   */
  flyToEarth(): void {
    if (!this.viewer) {
      return;
    }

    try {
      // 기존 카메라 애니메이션 취소
      if (this.viewer.camera._flight && this.viewer.camera._flight.isActive()) {
        this.viewer.camera.cancelFlight();
      }

      this.viewer.trackedEntity = undefined;
      restoreZoomDistance(this.viewer);

      // 지구 전체 보기 (한반도 중앙, 30,000km 고도)
      const koreaCenter = Cesium.Cartesian3.fromDegrees(127, 37, 0);
      const koreaHeight = 30_000_000;
      const radialUp = Cesium.Cartesian3.normalize(koreaCenter, new Cesium.Cartesian3());
      const camPos = Cesium.Cartesian3.add(
        koreaCenter,
        Cesium.Cartesian3.multiplyByScalar(radialUp, koreaHeight, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      );
      const direction = Cesium.Cartesian3.negate(radialUp, new Cesium.Cartesian3());
      const zAxis = new Cesium.Cartesian3(0, 0, 1);
      let east = Cesium.Cartesian3.cross(zAxis, radialUp, new Cesium.Cartesian3());
      if (Cesium.Cartesian3.magnitude(east) < 1e-6) east = new Cesium.Cartesian3(1, 0, 0);
      Cesium.Cartesian3.normalize(east, east);
      const north = Cesium.Cartesian3.cross(radialUp, east, new Cesium.Cartesian3());
      Cesium.Cartesian3.normalize(north, north);
      this.viewer.camera.setView({
        destination: camPos,
        orientation: { direction, up: north },
      });
    } catch (error) {
      console.error('[ControlPanelManager] 지구로 카메라 이동 오류:', error);
    }
  }

  /**
   * AOI 영역으로 카메라 이동 (즉시, 수직 하향 뷰)
   */
  flyToSwath(): void {
    if (!this.viewer || !this.satelliteSettings) return;

    const busPayloadManager = this.satelliteSettings.getBusPayloadManager();
    const groundPoint = busPayloadManager?.getYAxisGroundPoint?.();
    const pos = busPayloadManager?.getPositionForSwath?.();
    if (!groundPoint || !pos) {
      console.warn('[ControlPanelManager] flyToSwath: swath 위치 없음 (위성/안테나 필요)');
      return;
    }

    const SWATH_SPACING_M = 5000;
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
      const maxSpan = Math.max(latSpanM, lonSpanM, 1000) * 16;

      const centerCartesian = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, 0);
      const radialUp = Cesium.Cartesian3.normalize(centerCartesian, new Cesium.Cartesian3());
      const camPos = Cesium.Cartesian3.add(
        centerCartesian,
        Cesium.Cartesian3.multiplyByScalar(radialUp, maxSpan, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      );
      const direction = Cesium.Cartesian3.negate(radialUp, new Cesium.Cartesian3());
      const zAxis = new Cesium.Cartesian3(0, 0, 1);
      let eastVec = Cesium.Cartesian3.cross(zAxis, radialUp, new Cesium.Cartesian3());
      if (Cesium.Cartesian3.magnitude(eastVec) < 1e-6) eastVec = new Cesium.Cartesian3(1, 0, 0);
      Cesium.Cartesian3.normalize(eastVec, eastVec);
      const northWC = Cesium.Cartesian3.cross(radialUp, eastVec, new Cesium.Cartesian3());
      Cesium.Cartesian3.normalize(northWC, northWC);

      if (this.viewer.camera._flight && this.viewer.camera._flight.isActive()) {
        this.viewer.camera.cancelFlight();
      }
      this.viewer.trackedEntity = undefined;
      this.viewer._trackingTarget = undefined;
      restoreZoomDistance(this.viewer);

      this.viewer.camera.setView({
        destination: camPos,
        orientation: { direction, up: northWC },
      });
    } catch (error) {
      console.error('[ControlPanelManager] flyToSwath 오류:', error);
    }
  }

  /**
   * 지도 우클릭 위치를 타겟으로 설정 (경도·위도 입력 갱신 및 타겟 이동)
   */
  setTargetLocation(longitude: number, latitude: number): void {
    this.targetSettings?.setTargetFromMap(longitude, latitude);
  }

  /**
   * 제어 패널 정리
   */
  cleanup(): void {
    if (this.satelliteSettings) {
      this.satelliteSettings.cleanup();
      this.satelliteSettings = null;
    }
    if (this.orbitSettings) {
      this.orbitSettings.cleanup();
      this.orbitSettings = null;
    }
    if (this.targetSettings) {
      this.targetSettings.cleanup();
      this.targetSettings = null;
    }
    if (this.sidebarContent) {
      this.sidebarContent.innerHTML = '';
    }
  }
}