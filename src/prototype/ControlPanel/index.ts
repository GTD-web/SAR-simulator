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
  private flyToSatelliteButton: HTMLButtonElement | null;
  private flyToSatelliteCooldownUntil = 0;

  constructor() {
    this.sidebar = null;
    this.sidebarContent = null;
    this.satelliteSettings = null;
    this.orbitSettings = null;
    this.targetSettings = null;
    this.viewer = null;
    this.regionInfoPanel = null;
    this.flyToSatelliteButton = null;
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

    // 위성으로 이동 버튼 (화면 하단 중앙, 아이콘)
    this.flyToSatelliteButton = document.createElement('button');
    this.flyToSatelliteButton.className = 'fly-to-satellite-button';
    this.flyToSatelliteButton.title = 'Fly to satellite';
    this.flyToSatelliteButton.setAttribute('aria-label', 'Fly to satellite');
    this.flyToSatelliteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="24" height="24"><style>.st0{fill:currentColor}</style><g><path class="st0" d="M321.637,234.88c-22.205,0-44.402,8.47-61.349,25.417c-33.86,33.869-33.86,88.793,0,122.679l122.688-122.679 C366.037,243.349,343.832,234.88,321.637,234.88z M273.637,273.646c12.823-12.832,29.867-19.888,48-19.888 c11.654,0,22.854,2.914,32.78,8.408l-92.234,92.224C247.991,328.596,251.809,295.464,273.637,273.646z"/><path class="st0" d="M135.467,55.819l-79.648,79.648l146.068,146.069l79.666-79.666L135.467,55.819z M82.509,135.467l52.958-52.958 L254.864,201.87l-52.976,52.976L82.509,135.467z"/><path class="st0" d="M413.29,68.063L345.219,0L223.11,122.118l68.062,68.071L413.29,68.063z M326.683,129.508l-15.86-15.851 l25.944-25.944l15.851,15.842L326.683,129.508z M388.101,68.063l-24.311,24.31l-15.842-15.85l24.302-24.302L388.101,68.063z M345.219,25.216l15.842,15.833L336.767,65.36l-15.841-15.851L345.219,25.216z M309.744,60.699l15.833,15.825l-25.926,25.952 L283.8,86.634L309.744,60.699z M248.317,122.118l24.303-24.302l15.841,15.842l-24.31,24.293L248.317,122.118z M299.633,124.83 l15.851,15.85l-24.302,24.302l-15.833-15.833L299.633,124.83z"/><path class="st0" d="M0.009,345.21l68.072,68.063l122.118-122.118l-68.054-68.045L0.009,345.21z M86.652,283.783l15.842,15.842 l-25.944,25.952l-15.841-15.851L86.652,283.783z M25.224,345.21l24.293-24.294l15.842,15.833L41.066,361.06L25.224,345.21z M68.081,388.075L52.23,372.242l24.32-24.312l15.834,15.833L68.081,388.075z M103.573,352.6l-15.851-15.851l25.943-25.952 l15.842,15.851L103.573,352.6z M164.992,291.172l-24.286,24.294l-15.851-15.842l24.294-24.293L164.992,291.172z M113.665,288.442 l-15.85-15.824l24.328-24.32l15.833,15.842L113.665,288.442z"/><path class="st0" d="M363.422,338.522c-6.864-6.846-18.01-6.854-24.856,0c-6.89,6.864-6.89,18.019-0.017,24.882 c6.881,6.872,18.01,6.872,24.873,0C370.293,356.541,370.293,345.412,363.422,338.522z"/><path class="st0" d="M493.683,378.64c-5.292,27.61-18.536,53.888-39.836,75.18c-21.31,21.31-47.587,34.562-75.172,39.881 L382.194,512c31.087-5.976,60.831-20.993,84.835-44.997c24.004-24.004,39.002-53.756,44.962-84.852L493.683,378.64z"/><path class="st0" d="M466.433,372.277l-18.343-3.344c-3.484,19.089-12.49,37.248-27.181,51.94 c-14.701,14.692-32.877,23.714-51.949,27.225l3.361,18.325c22.608-4.124,44.313-14.92,61.77-32.377 C451.53,416.608,462.316,394.894,466.433,372.277z"/><path class="st0" d="M401.143,401.108c10.928-10.928,17.492-24.645,19.748-38.82l-18.396-2.949 c-1.702,10.532-6.494,20.538-14.542,28.586v0.008c-8.066,8.049-18.063,12.849-28.586,14.543l2.967,18.396 c14.157-2.265,27.866-8.829,38.792-19.757L401.143,401.108z"/></g></svg>`;
    this.flyToSatelliteButton.addEventListener('click', () => this.flyToSatellite());
    document.body.appendChild(this.flyToSatelliteButton);

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
   * 위성으로 카메라 이동 + 추적 (버튼 클릭 시 호출)
   * 시뮬레이션 유지, 카메라가 위성 움직임에 따라 추적
   * 연속 클릭 방지: 1.5초 쿨다운
   */
  private flyToSatellite(): void {
    const now = Date.now();
    if (now < this.flyToSatelliteCooldownUntil) return;
    this.flyToSatelliteCooldownUntil = now + 1500;

    if (!this.viewer) return;
    if (this.satelliteSettings) {
      this.satelliteSettings.cancelCameraAnimation();
      this.satelliteSettings.ensureEntityExists();
    }
    this.orbitSettings?.zoomToSatelliteAndTrack();
  }

  /**
   * 지구로 카메라 이동
   */
  private flyToEarth(): void {
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
    if (this.flyToSatelliteButton && this.flyToSatelliteButton.parentNode) {
      this.flyToSatelliteButton.parentNode.removeChild(this.flyToSatelliteButton);
      this.flyToSatelliteButton = null;
    }
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