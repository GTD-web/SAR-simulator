import { ViewerInitializer } from './ViewerInitializer.js';
import { ImageryManager } from './ImageryManager.js';
import { BuildingManager } from './BuildingManager.js';
import { CameraManager } from './CameraManager.js';

/**
 * CesiumViewerManager - Cesium 뷰어 통합 관리
 */
export class CesiumViewerManager {
  private containerId: string;
  private viewer: any;
  private viewerInitializer: ViewerInitializer;
  private imageryManager: ImageryManager | null;
  private buildingManager: BuildingManager | null;
  private cameraManager: CameraManager | null;

  constructor(containerId: string) {
    this.containerId = containerId;
    this.viewer = null;
    this.viewerInitializer = new ViewerInitializer();
    this.imageryManager = null;
    this.buildingManager = null;
    this.cameraManager = null;
  }

  /**
   * 뷰어 초기화
   */
  async initialize(): Promise<any> {
    this.viewer = await this.viewerInitializer.initialize(this.containerId);
    this.imageryManager = new ImageryManager(this.viewer);
    this.buildingManager = new BuildingManager(this.viewer);
    this.cameraManager = new CameraManager(this.viewer);
    return this.viewer;
  }

  /**
   * 이미지 레이어 설정
   */
  async setupImagery(): Promise<void> {
    if (!this.imageryManager) {
      throw new Error('Viewer가 초기화되지 않았습니다.');
    }
    await this.imageryManager.setupImagery();
  }

  /**
   * 건물 레이어 추가
   */
  async addBuildings(): Promise<void> {
    if (!this.buildingManager) {
      throw new Error('Viewer가 초기화되지 않았습니다.');
    }
    await this.buildingManager.addBuildings();
  }

  /**
   * 카메라 설정
   */
  setupCamera(destination: any, orientation: { heading: number; pitch: number }, duration: number = 2.0): void {
    if (!this.cameraManager) {
      throw new Error('Viewer가 초기화되지 않았습니다.');
    }
    this.cameraManager.setupCamera(destination, orientation, duration);
  }

  /**
   * 위성 엔티티에 카메라 고정
   */
  trackEntity(entity: any): void {
    if (!this.cameraManager) {
      throw new Error('Viewer가 초기화되지 않았습니다.');
    }
    this.cameraManager.trackEntity(entity);
  }

  /**
   * 카메라 추적 해제
   */
  untrackEntity(): void {
    if (!this.cameraManager) {
      throw new Error('Viewer가 초기화되지 않았습니다.');
    }
    this.cameraManager.untrackEntity();
  }

  /**
   * 위성 추적 상태 반환
   */
  isTracking(): boolean {
    if (!this.cameraManager) {
      return false;
    }
    return this.cameraManager.isTracking();
  }

  /**
   * 뷰어 인스턴스 반환
   */
  getViewer(): any {
    return this.viewer;
  }

  /**
   * 지도 커서 스타일 설정
   */
  setCursorStyle(cursor: string): void {
    if (!this.viewer) {
      return;
    }
    if (this.viewer.canvas) {
      this.viewer.canvas.style.cursor = cursor;
    }
  }

  /**
   * 지도 클릭 이벤트 핸들러 등록
   */
  setupMapClickHandler(callback: (longitude: number, latitude: number) => void): void {
    if (!this.viewer) {
      throw new Error('Viewer가 초기화되지 않았습니다.');
    }

    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    
    handler.setInputAction((click: any) => {
      const cartesian = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid);
      
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        
        console.log('[CesiumViewerManager] 지도 클릭:', longitude, latitude);
        callback(longitude, latitude);
      } else {
        console.log('[CesiumViewerManager] 클릭 위치에서 좌표를 계산할 수 없습니다.');
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  /**
   * 지도 우클릭 이벤트 핸들러 등록 (컨텍스트 메뉴용: 경위도 + 화면 좌표 전달)
   */
  setupMapRightClickHandler(
    callback: (longitude: number, latitude: number, screenX: number, screenY: number) => void
  ): void {
    if (!this.viewer) {
      throw new Error('Viewer가 초기화되지 않았습니다.');
    }
    const canvas = this.viewer.scene.canvas;
    const handler = new Cesium.ScreenSpaceEventHandler(canvas);
    handler.setInputAction((click: any) => {
      const cartesian = this.viewer.camera.pickEllipsoid(
        click.position,
        this.viewer.scene.globe.ellipsoid
      );
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        const rect = canvas.getBoundingClientRect();
        const screenX = rect.left + click.position.x;
        const screenY = rect.top + click.position.y;
        callback(longitude, latitude, screenX, screenY);
      }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }
}
