import { SatelliteManager } from '../satellite/SatelliteManager.js';
import { EntityManager } from '../entity/EntityManager.js';
import { CesiumViewerManager } from '../cesium/CesiumViewerManager.js';
import { SatelliteUIManager } from './SatelliteUIManager.js';
import { SwathControlUIManager } from './SwathControlUIManager.js';
import { SwathGroupsUIManager } from './SwathGroupsUIManager.js';
import { SarConfigUIManager } from './SarConfigUIManager.js';
import { SignalVisualizationPanel } from './SignalVisualizationPanel.js';
import { SatelliteOrientationUIManager } from './SatelliteOrientationUIManager.js';

/**
 * UIManager - UI 이벤트 처리 통합 관리
 */
export class UIManager {
  private satelliteManager: SatelliteManager;
  private entityManager: EntityManager;
  private viewer: any;
  private viewerManager: CesiumViewerManager | null;
  private satelliteUIManager: SatelliteUIManager;
  private swathControlUIManager: SwathControlUIManager;
  private swathGroupsUIManager: SwathGroupsUIManager;
  private sarConfigUIManager: SarConfigUIManager;
  private signalVisualizationPanel: SignalVisualizationPanel;
  private satelliteOrientationUIManager: SatelliteOrientationUIManager;

  constructor(satelliteManager: SatelliteManager, entityManager: EntityManager, viewer?: any, viewerManager?: CesiumViewerManager) {
    this.satelliteManager = satelliteManager;
    this.entityManager = entityManager;
    this.viewer = viewer;
    this.viewerManager = viewerManager || null;
    
    this.satelliteUIManager = new SatelliteUIManager(satelliteManager, entityManager, viewerManager || null);
    this.sarConfigUIManager = new SarConfigUIManager();
    this.swathControlUIManager = new SwathControlUIManager(
      entityManager,
      this.sarConfigUIManager,
      satelliteManager,
      viewer
    );
    this.swathGroupsUIManager = new SwathGroupsUIManager(entityManager);
    
    // Signal 시각화 패널 초기화
    this.signalVisualizationPanel = new SignalVisualizationPanel();
    this.swathControlUIManager.setSignalVisualizationPanel(this.signalVisualizationPanel);
    
    // 위성 방향 제어 UI 초기화
    const satelliteEntityManager = entityManager.getSatelliteEntityManager();
    this.satelliteOrientationUIManager = new SatelliteOrientationUIManager(satelliteEntityManager);
  }

  /**
   * UI 초기화
   */
  initialize(defaultTLE: string): void {
    this.satelliteUIManager.initialize(defaultTLE);
    this.swathControlUIManager.initialize(() => {
      this.swathGroupsUIManager.updateSwathGroupsList();
      const selectedGroupId = this.swathGroupsUIManager.getSelectedGroupId();
      this.entityManager.showSwathsByGroupId(selectedGroupId);
    });
    this.swathGroupsUIManager.initialize();
    
    // SAR 설정 불러오기 시 Swath 제어 탭에 자동 적용
    this.sarConfigUIManager.initialize(
      (sarConfig) => {
        this.swathControlUIManager.applySarConfigToSwathParams(sarConfig);
      },
      this.satelliteOrientationUIManager
    );
    
    // 위성 방향 제어 UI 초기화
    this.satelliteOrientationUIManager.initialize();
    
    // 지도 클릭 이벤트 설정
    this.setupMapClickHandler();
  }

  /**
   * SarConfigUIManager 가져오기
   */
  getSarConfigUIManager(): SarConfigUIManager {
    return this.sarConfigUIManager;
  }

  /**
   * 지도 클릭 이벤트 핸들러 설정
   */
  private setupMapClickHandler(): void {
    if (!this.viewerManager) {
      console.warn('[UIManager] ViewerManager가 없어 지도 클릭 이벤트를 설정할 수 없습니다.');
      return;
    }

    this.viewerManager.setupMapClickHandler((longitude: number, latitude: number) => {
      console.log('[UIManager] 지도 클릭 핸들러 호출:', longitude, latitude);
      // 미션 위치 선택 모드가 활성화된 경우에만 처리
      if (this.satelliteUIManager.isMissionLocationSelectionModeActive()) {
        // 위성 생성 UI의 미션 위치로 설정
        this.satelliteUIManager.setMissionLocationFromClick(longitude, latitude);
      }
    });
  }
}
