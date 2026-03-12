import { SatelliteSettings } from './SatelliteSettings/index.js';
import { OrbitSettings } from './OrbitSettings/index.js';
import { TargetSettings, type TargetSettingsOptions } from './TargetSettings/index.js';
import { restoreZoomDistance } from './SatelliteSettings/_util/camera-manager.js';

export interface ControlPanelOptions {
  onRegionInfoFetched?: (data: import('./TargetSettings/index.js').RegionInfo) => void;
  regionInfoPanel?: HTMLElement | null;
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
  private regionInfoPanel: HTMLElement | null;

  constructor() {
    this.sidebar = null;
    this.sidebarContent = null;
    this.satelliteSettings = null;
    this.orbitSettings = null;
    this.targetSettings = null;
    this.viewer = null;
    this.regionInfoPanel = null;
  }

  /**
   * 제어 패널 초기화
   */
  initialize(viewer?: any, options?: ControlPanelOptions): void {
    this.regionInfoPanel = options?.regionInfoPanel ?? null;
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

    // 타겟 설정 탭 콘텐츠
    const targetTabContent = document.createElement('div');
    targetTabContent.id = 'targetTab';
    targetTabContent.className = 'tab-content';
    tabContainer.appendChild(targetTabContent);

    this.sidebarContent.appendChild(tabContainer);

    // 각 설정 클래스 초기화
    this.satelliteSettings = new SatelliteSettings();
    this.satelliteSettings.initialize(satelliteTabContent, viewer);

    this.orbitSettings = new OrbitSettings();
    this.orbitSettings.initialize(orbitTabContent, viewer, {
      busPayloadManager: this.satelliteSettings.getBusPayloadManager(),
    });
    this.satelliteSettings.setOrbitSettings(this.orbitSettings);

    const targetOptions: TargetSettingsOptions = {
      onRegionInfoFetched: options?.onRegionInfoFetched ?? undefined,
    };
    this.targetSettings = new TargetSettings();
    this.targetSettings.initialize(targetTabContent, viewer, targetOptions);

    // 탭 전환 이벤트 설정
    this.setupTabEvents();

    // 기본으로 위성 설정 탭 활성화 (서버 초기화 시)
    this.activateTab('satellite');

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

        // 위성 설정 탭 클릭 시 (카메라 이동 없음)
        if (targetTab === 'satellite' && this.satelliteSettings) {
          this.satelliteSettings.cancelCameraAnimation();
        }

        // 궤도 설정 탭 클릭 시 엔티티만 생성 (카메라 이동 없음)
        if (targetTab === 'orbit' && this.viewer) {
          if (this.satelliteSettings) {
            this.satelliteSettings.cancelCameraAnimation();
            this.satelliteSettings.ensureEntityExists();
          }
          this.orbitSettings?.prepareOrbitTab();
        }

        // 타겟 설정 탭 클릭 시 우측 지역 정보 패널 표시 (카메라 이동 없음)
        if (targetTab === 'target' && this.targetSettings) {
          this.orbitSettings?.stopCameraTracking();
          if (this.satelliteSettings) {
            this.satelliteSettings.cancelCameraAnimation();
          }
          if (this.regionInfoPanel) {
            this.regionInfoPanel.classList.remove('hidden');
          }
        } else {
          // 다른 탭으로 전환 시 우측 지역 정보 패널 숨김
          if (this.regionInfoPanel) {
            this.regionInfoPanel.classList.add('hidden');
          }
        }
      });
    });
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

      // 지구로 카메라 이동 (즉시)
      this.viewer.camera.flyHome(0);
    } catch (error) {
      console.error('[ControlPanelManager] 지구로 카메라 이동 오류:', error);
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