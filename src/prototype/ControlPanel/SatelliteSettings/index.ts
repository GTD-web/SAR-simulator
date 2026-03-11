import { SatelliteBusPayloadManager } from './SatelliteBusPayloadManager/index.js';
import type { OrbitSettings } from '../OrbitSettings/index.js';
import { PrototypeSwathPreview } from './_util/prototype-swath-preview.js';
import { AttitudeMiniMapViewer } from './_util/attitude-mini-map-viewer.js';
import { renderSatelliteSettingsForm, FormRendererCallbacks } from './_ui/form-renderer.js';
import { updateEntity } from './_util/entity-updater.js';
import { createSatelliteEntity } from './_util/entity-creator.js';
import { getDirectionForInputId } from './_util/direction-mapper.js';
import {
  parseBusOrientationInputs,
  parseBusDimensionsInputs,
  parseAntennaDimensionsInputs,
  parseAntennaGapInput,
  parseAntennaOrientationInputs,
  parseSatelliteBasicInfo,
} from './_util/input-parser.js';
import { waitForCameraReady, setupCameraAngle, setupCanvasFocus } from './_util/camera-manager.js';
import {
  TIMER,
  DEFAULT_POSITION,
  DEFAULT_BUS_DIMENSIONS_M,
  DEFAULT_BUS_DIMENSIONS_MM,
  DEFAULT_BUS_ORIENTATION,
  DEFAULT_ANTENNA_DIMENSIONS_M,
  DEFAULT_ANTENNA_GAP_M,
  DEFAULT_ANTENNA_ORIENTATION,
  DEFAULT_SATELLITE_INFO,
  POSITION_VALIDATION,
} from './constants.js';
import { setCameraToEntityHorizontal } from './_util/camera-manager.js';

/**
 * SatelliteSettings - Satellite settings tab management class
 */
export class SatelliteSettings {
  private container: HTMLElement | null;
  private viewer: any;
  private busPayloadManager: SatelliteBusPayloadManager | null;
  private orbitSettingsRef: OrbitSettings | null;
  private swathPreview: PrototypeSwathPreview | null;
  private attitudeMiniMap: AttitudeMiniMapViewer | null;
  private updateDebounceTimer: number | null;
  private currentDirectionInputId: string | null;
  private cameraAnimationTimer: number | null;

  constructor() {
    this.container = null;
    this.viewer = null;
    this.busPayloadManager = null;
    this.orbitSettingsRef = null;
    this.swathPreview = null;
    this.attitudeMiniMap = null;
    this.updateDebounceTimer = null;
    this.currentDirectionInputId = null;
    this.cameraAnimationTimer = null;
  }

  /**
   * 궤도 설정 참조 설정 (최초 접근 시 궤도 위 위성 배치용)
   */
  setOrbitSettings(orbitSettings: OrbitSettings): void {
    this.orbitSettingsRef = orbitSettings;
  }

  /**
   * Initialize satellite settings tab
   */
  initialize(container: HTMLElement, viewer?: any): void {
    this.container = container;
    this.viewer = viewer || null;
    if (this.viewer) {
      this.busPayloadManager = new SatelliteBusPayloadManager(this.viewer);
      this.swathPreview = new PrototypeSwathPreview(this.viewer, this.busPayloadManager);
      this.swathPreview.init();
      this.attitudeMiniMap = new AttitudeMiniMapViewer(this.viewer, this.busPayloadManager);
      this.attitudeMiniMap.init();
    }
    this.render();
    
    // 폼 렌더링 후 궤도 위에 위성 엔티티 자동 생성 및 카메라 이동
    if (this.viewer && this.busPayloadManager) {
      // Cesium 초기 카메라 애니메이션이 완료될 때까지 기다린 후 궤도 위에 위성 배치
      waitForCameraReady(this.viewer, () => {
        this.createInitialEntityOnOrbit();
      });
    }
  }

  /**
   * 초기 엔티티 생성 - 위성 설정·궤도 설정 폼 값에 따라 궤도 위에 위성 배치
   * @param flyAfterCreate true면 생성 후 궤도로 카메라 이동 (flyToSatelliteEntity 등에서 사용)
   */
  private createInitialEntityOnOrbit(flyAfterCreate = false): void {
    if (!this.busPayloadManager || !this.viewer) {
      console.error('[SatelliteSettings] 초기 엔티티 생성 실패: busPayloadManager 또는 viewer가 없습니다.');
      return;
    }

    const result = this.orbitSettingsRef?.getOrbitPositionForInitialPlacement();
    if (!result) {
      // 궤도 위치를 구할 수 없으면 지구 전경으로만 이동 (위성 엔티티 생성 안 함)
      if (this.viewer.camera._flight && this.viewer.camera._flight.isActive()) {
        this.viewer.camera.cancelFlight();
      }
      this.viewer.trackedEntity = undefined;
      this.viewer.camera.flyHome(0);
      return;
    }

    try {
      // 위성 설정 폼 값 사용 (폼 없거나 파싱 실패 시 기본값)
      const { name } = parseSatelliteBasicInfo();
      const busDimensions = parseBusDimensionsInputs() ?? {
        length: DEFAULT_BUS_DIMENSIONS_M.LENGTH,
        width: DEFAULT_BUS_DIMENSIONS_M.WIDTH,
        height: DEFAULT_BUS_DIMENSIONS_M.HEIGHT,
      };
      const antennaDimensions = parseAntennaDimensionsInputs() ?? {
        height: DEFAULT_ANTENNA_DIMENSIONS_M.HEIGHT,
        width: DEFAULT_ANTENNA_DIMENSIONS_M.WIDTH,
        depth: DEFAULT_ANTENNA_DIMENSIONS_M.DEPTH,
      };
      const antennaOrientation = parseAntennaOrientationInputs() ?? {
        rollAngle: DEFAULT_ANTENNA_ORIENTATION.ROLL,
        pitchAngle: DEFAULT_ANTENNA_ORIENTATION.PITCH,
        yawAngle: DEFAULT_ANTENNA_ORIENTATION.YAW,
        initialElevationAngle: DEFAULT_ANTENNA_ORIENTATION.INITIAL_ELEVATION,
        initialAzimuthAngle: DEFAULT_ANTENNA_ORIENTATION.INITIAL_AZIMUTH,
      };
      const antennaGap = parseAntennaGapInput() ?? DEFAULT_ANTENNA_GAP_M;
      const busOrientation = parseBusOrientationInputs() ?? DEFAULT_BUS_ORIENTATION;

      this.busPayloadManager.createSatellite(
        name,
        {
          longitude: result.longitude,
          latitude: result.latitude,
          altitude: result.altitude,
        },
        busDimensions,
        {
          height: antennaDimensions.height,
          width: antennaDimensions.width,
          depth: antennaDimensions.depth,
          rollAngle: antennaOrientation.rollAngle,
          pitchAngle: antennaOrientation.pitchAngle,
          yawAngle: antennaOrientation.yawAngle,
          initialElevationAngle: antennaOrientation.initialElevationAngle,
          initialAzimuthAngle: antennaOrientation.initialAzimuthAngle,
        },
        antennaGap,
        busOrientation
      );

      this.busPayloadManager.setVelocityDirectionEcef(
        result.velocityEcef.x,
        result.velocityEcef.y,
        result.velocityEcef.z
      );

      // 궤도 설정에 따라 TLE 궤도 그리기 및 시뮬레이션 즉시 시작
      this.orbitSettingsRef?.applyOrbitToSatellite(false, true);

      if (flyAfterCreate) {
        this.flyToOrbitAfterEntityRendered();
      }
    } catch (error) {
      console.error('[SatelliteSettings] 궤도 위 초기 엔티티 생성 오류:', error);
    }
  }

  /**
   * 엔티티가 씬에 렌더된 후 궤도 위치로 카메라 이동
   * (postRender로 2프레임 대기 후 이동하여 엔티티 로드 완료 보장)
   */
  private flyToOrbitAfterEntityRendered(): void {
    if (!this.viewer?.scene) return;

    let frameCount = 0;
    const handler = () => {
      frameCount++;
      if (frameCount >= 2) {
        this.viewer.scene.postRender.removeEventListener(handler);
        this.orbitSettingsRef?.flyToOrbitPosition();
        setupCanvasFocus(this.viewer);
      }
    };
    this.viewer.scene.postRender.addEventListener(handler);
    this.viewer.scene.requestRender();
  }

  /**
   * Render satellite settings UI
   */
  private render(): void {
    if (!this.container) return;

    const callbacks: FormRendererCallbacks = {
      onInputFocus: (id: string) => {
        this.showDirectionForInput(id);
      },
      onInputBlur: (id: string) => {
        // 다른 입력 필드로 포커스 이동 시에도 화살표가 유지되도록 함
        setTimeout(() => {
          const activeElement = document.activeElement as HTMLElement;
          // 활성 요소가 다른 입력 필드가 아니고, 현재 방향 입력 필드도 아니면 화살표 제거
          if (activeElement && activeElement.tagName !== 'INPUT' && activeElement.id !== this.currentDirectionInputId) {
            this.hideDirectionArrows();
          }
        }, TIMER.INPUT_BLUR_DELAY);
      },
      onInputChange: () => {
        this.updateEntityFromInputs();
      },
      onCreateButtonClick: () => {
        this.createSatelliteEntity();
      },
      onAxisToggleChange: (checked: boolean) => {
        this.setAxisVisible(checked);
      },
      onAxisLengthChange: (length: number) => {
        this.setAxisLength(length);
      },
      onVelocityDirectionChange: (azimuthDeg: number, elevationDeg: number) => {
        if (this.busPayloadManager) {
          this.busPayloadManager.setVelocityDirection(azimuthDeg, elevationDeg);
        }
      },
    };

    renderSatelliteSettingsForm(this.container, callbacks);
  }

  /**
   * 입력 필드 값으로 엔티티 업데이트 (디바운싱 적용)
   */
  private updateEntityFromInputs(): void {
    // 디바운싱: 입력이 멈춘 후 일정 시간 후에 업데이트 실행
    if (this.updateDebounceTimer !== null) {
      clearTimeout(this.updateDebounceTimer);
    }
    
    this.updateDebounceTimer = window.setTimeout(() => {
      this.performEntityUpdate();
      this.updateDebounceTimer = null;
    }, TIMER.DEBOUNCE_DELAY);
  }

  /**
   * 실제 엔티티 업데이트 수행
   */
  private performEntityUpdate(): void {
    updateEntity(this.busPayloadManager, this.viewer);
    
    // 엔티티 업데이트 후에도 현재 포커스된 입력 필드가 있으면 화살표 다시 표시
    if (this.currentDirectionInputId) {
      const activeElement = document.activeElement as HTMLInputElement;
      if (activeElement && activeElement.id === this.currentDirectionInputId) {
        // 약간의 지연을 두어 엔티티 업데이트가 완료된 후 화살표 표시
        setTimeout(() => {
          // 엔티티가 여전히 존재하는지 확인
          if (this.busPayloadManager && this.busPayloadManager.getBusEntity()) {
            this.showDirectionForInput(this.currentDirectionInputId!);
          }
        }, TIMER.INPUT_FOCUS_RESTORE_DELAY);
      }
    }
  }

  /**
   * 위성 엔티티 생성
   */
  private createSatelliteEntity(): void {
    // 엔티티 생성 전 현재 포커스된 입력 필드 저장
    const activeElement = document.activeElement as HTMLElement;
    const wasInputFocused = activeElement && activeElement.tagName === 'INPUT' && 
                            activeElement.id && activeElement.id.startsWith('prototype');

    createSatelliteEntity(this.busPayloadManager, this.viewer, true);

    // 엔티티 생성 후 약간의 지연을 두고 카메라를 BUS에 고정
    setTimeout(() => {
      const busEntity = this.busPayloadManager?.getBusEntity();
      const antennaEntity = this.busPayloadManager?.getAntennaEntity();
      
      // 엔티티가 생성되었는지 확인
      if (!busEntity && !antennaEntity) {
        console.error('[SatelliteSettings] 엔티티가 생성되지 않았습니다!');
        alert('엔티티 생성에 실패했습니다. 콘솔을 확인하세요.');
        return;
      }

      // 카메라 각도 설정 (항상 동일한 각도로 설정)
      if (busEntity) {
        setupCameraAngle(this.viewer, busEntity);
      }
      
      // Cesium 캔버스가 포커스를 가져가지 않도록 설정
      setupCanvasFocus(this.viewer);
      
      // 포커스 복원: 이전에 입력 필드에 포커스가 있었다면 복원
      if (wasInputFocused && activeElement && activeElement.id) {
        // 카메라 조작 후 포커스 복원
        setTimeout(() => {
          const inputToFocus = document.getElementById(activeElement.id) as HTMLInputElement;
          if (inputToFocus && !inputToFocus.disabled && !inputToFocus.readOnly) {
            inputToFocus.focus();
            // 커서를 끝으로 이동
            inputToFocus.setSelectionRange(inputToFocus.value.length, inputToFocus.value.length);
          }
        }, TIMER.INPUT_FOCUS_RESTORE_DELAY);
      }
    }, TIMER.ENTITY_CREATION_CAMERA_DELAY);
  }


  /**
   * 지구로 이동
   */
  private moveSatelliteToEarth(): void {
    if (!this.busPayloadManager || !this.viewer) {
      alert('Cesium 뷰어가 초기화되지 않았습니다.');
      return;
    }

    // 입력된 위치 정보 가져오기
    const longitude = parseFloat((document.getElementById('prototypeSatelliteLongitude') as HTMLInputElement)?.value || String(DEFAULT_POSITION.LONGITUDE));
    const latitude = parseFloat((document.getElementById('prototypeSatelliteLatitude') as HTMLInputElement)?.value || String(DEFAULT_POSITION.LATITUDE));
    const altitudeKm = parseFloat((document.getElementById('prototypeSatelliteAltitude') as HTMLInputElement)?.value || String(DEFAULT_POSITION.ALTITUDE_KM));
    // km를 미터로 변환 (Cesium은 미터 단위 사용)
    const altitude = altitudeKm * 1000;

    // 입력값 검증
    if (longitude < POSITION_VALIDATION.LONGITUDE_MIN || longitude > POSITION_VALIDATION.LONGITUDE_MAX) {
      alert(`경도는 ${POSITION_VALIDATION.LONGITUDE_MIN} ~ ${POSITION_VALIDATION.LONGITUDE_MAX} 사이의 값이어야 합니다.`);
      return;
    }
    if (latitude < POSITION_VALIDATION.LATITUDE_MIN || latitude > POSITION_VALIDATION.LATITUDE_MAX) {
      alert(`위도는 ${POSITION_VALIDATION.LATITUDE_MIN} ~ ${POSITION_VALIDATION.LATITUDE_MAX} 사이의 값이어야 합니다.`);
      return;
    }
    if (altitudeKm < POSITION_VALIDATION.ALTITUDE_MIN_KM) {
      alert(`고도는 ${POSITION_VALIDATION.ALTITUDE_MIN_KM} 이상이어야 합니다.`);
      return;
    }

    try {
      // 위성 위치 업데이트
      this.busPayloadManager.updatePosition({ longitude, latitude, altitude });

      // 지구로 이동 시 항상 카메라를 엔티티에 고정하고 엔티티 생성 시와 동일한 각도로 설정
      const busEntity = this.busPayloadManager.getBusEntity();
      if (busEntity) {
        // BUS 크기 정보 가져오기
        const busLengthMm = parseFloat((document.getElementById('prototypeBusLength') as HTMLInputElement)?.value || String(DEFAULT_BUS_DIMENSIONS_MM.LENGTH));
        const busWidthMm = parseFloat((document.getElementById('prototypeBusWidth') as HTMLInputElement)?.value || String(DEFAULT_BUS_DIMENSIONS_MM.WIDTH));
        const busHeightMm = parseFloat((document.getElementById('prototypeBusHeight') as HTMLInputElement)?.value || String(DEFAULT_BUS_DIMENSIONS_MM.HEIGHT));
        
        // 카메라 설정
        setCameraToEntityHorizontal(this.viewer, busEntity, {
          length: busLengthMm,
          width: busWidthMm,
          height: busHeightMm
        });
      }

      alert('위성이 지구로 이동되었습니다.');
    } catch (error) {
      console.error('[SatelliteSettings] 지구로 이동 오류:', error);
      alert('지구로 이동 중 오류가 발생했습니다: ' + (error as Error).message);
    }
  }

  /**
   * XYZ 축 표시/숨김 설정
   */
  private setAxisVisible(visible: boolean): void {
    if (!this.busPayloadManager) {
      return;
    }

    this.busPayloadManager.setAxisVisible(visible);
    console.log(`[SatelliteSettings] XYZ 축 표시: ${visible ? 'ON' : 'OFF'}`);
  }

  /**
   * XYZ 축 길이 설정
   */
  private setAxisLength(length: number): void {
    if (!this.busPayloadManager) {
      return;
    }

    this.busPayloadManager.setAxisLength(length);
    console.log(`[SatelliteSettings] XYZ 축 길이: ${length}m`);
  }

  /**
   * 입력 필드에 해당하는 방향 화살표 표시
   */
  private showDirectionForInput(inputId: string): void {
    if (!this.busPayloadManager) {
      return;
    }

    // 엔티티가 생성되어 있는지 확인
    const busEntity = this.busPayloadManager.getBusEntity();
    if (!busEntity) {
      // 엔티티가 없으면 나중에 다시 시도할 수 있도록 ID만 저장
      this.currentDirectionInputId = inputId;
      return;
    }

    this.currentDirectionInputId = inputId;

    // 입력 필드 ID에 따라 방향 결정
    const direction = getDirectionForInputId(inputId);

    if (direction) {
      this.busPayloadManager.showDirectionArrows(direction);
    }
  }

  /**
   * 방향 화살표 숨김
   */
  private hideDirectionArrows(): void {
    if (this.busPayloadManager) {
      this.busPayloadManager.removeDirectionArrows();
      this.currentDirectionInputId = null;
    }
  }


  /**
   * 엔티티가 없으면 생성 (궤도 설정 탭 등에서 카메라 이동 전 호출)
   */
  ensureEntityExists(): void {
    if (!this.busPayloadManager || !this.viewer) return;
    if (this.busPayloadManager.getBusEntity()) return;

    try {
      const lonInput = (document.getElementById('prototypeSatelliteLongitude') as HTMLInputElement)?.value || String(DEFAULT_POSITION.LONGITUDE);
      const latInput = (document.getElementById('prototypeSatelliteLatitude') as HTMLInputElement)?.value || String(DEFAULT_POSITION.LATITUDE);
      const altInput = (document.getElementById('prototypeSatelliteAltitude') as HTMLInputElement)?.value || String(DEFAULT_POSITION.ALTITUDE_KM);

      const longitude = parseFloat(lonInput) || DEFAULT_POSITION.LONGITUDE;
      const latitude = parseFloat(latInput) || DEFAULT_POSITION.LATITUDE;
      const altitudeKm = parseFloat(altInput) || DEFAULT_POSITION.ALTITUDE_KM;
      const altitude = altitudeKm * 1000;

      const busOrientation = parseBusOrientationInputs() ?? DEFAULT_BUS_ORIENTATION;

      this.busPayloadManager.createSatellite(
        DEFAULT_SATELLITE_INFO.NAME,
        { longitude, latitude, altitude },
        {
          length: DEFAULT_BUS_DIMENSIONS_M.LENGTH,
          width: DEFAULT_BUS_DIMENSIONS_M.WIDTH,
          height: DEFAULT_BUS_DIMENSIONS_M.HEIGHT,
        },
        {
          height: DEFAULT_ANTENNA_DIMENSIONS_M.HEIGHT,
          width: DEFAULT_ANTENNA_DIMENSIONS_M.WIDTH,
          depth: DEFAULT_ANTENNA_DIMENSIONS_M.DEPTH,
          rollAngle: DEFAULT_ANTENNA_ORIENTATION.ROLL,
          pitchAngle: DEFAULT_ANTENNA_ORIENTATION.PITCH,
          yawAngle: DEFAULT_ANTENNA_ORIENTATION.YAW,
          initialElevationAngle: DEFAULT_ANTENNA_ORIENTATION.INITIAL_ELEVATION,
          initialAzimuthAngle: DEFAULT_ANTENNA_ORIENTATION.INITIAL_AZIMUTH,
        },
        DEFAULT_ANTENNA_GAP_M,
        busOrientation
      );
    } catch (error) {
      console.error('[SatelliteSettings] 엔티티 생성 오류:', error);
    }
  }

  /**
   * 위성 엔티티로 카메라 이동 (탭 전환 시 호출)
   */
  flyToSatelliteEntity(): void {
    if (!this.viewer || !this.busPayloadManager) {
      return;
    }

    const busEntity = this.busPayloadManager.getBusEntity();
    if (!busEntity) {
      // 엔티티가 없으면 궤도 위 초기 엔티티 생성 후 카메라 이동
      this.createInitialEntityOnOrbit(true);
      return;
    }

    // 기존 카메라 애니메이션 타이머 취소
    this.cancelCameraAnimation();

    // 엔티티가 있으면 카메라 이동
    const timerId = setupCameraAngle(this.viewer, busEntity);
    this.cameraAnimationTimer = timerId;
    setupCanvasFocus(this.viewer);
  }

  /**
   * 위성 BUS/Payload 매니저 반환 (궤도 설정 등에서 위성 배치 시 사용)
   */
  getBusPayloadManager(): SatelliteBusPayloadManager | null {
    return this.busPayloadManager;
  }

  /**
   * 자세 미니맵 반환 (카메라 위치 조정 등)
   */
  getAttitudeMiniMap(): AttitudeMiniMapViewer | null {
    return this.attitudeMiniMap;
  }

  /**
   * 위성 엔티티로 이동하는 카메라 애니메이션 취소
   */
  cancelCameraAnimation(): void {
    // 타이머 취소
    if (this.cameraAnimationTimer !== null) {
      clearTimeout(this.cameraAnimationTimer);
      this.cameraAnimationTimer = null;
    }

    // 진행 중인 카메라 애니메이션 취소
    if (this.viewer && this.viewer.camera._flight && this.viewer.camera._flight.isActive()) {
      this.viewer.camera.cancelFlight();
    }
  }

  /**
   * Cleanup satellite settings
   */
  cleanup(): void {
    // 디바운스 타이머 정리
    if (this.updateDebounceTimer !== null) {
      clearTimeout(this.updateDebounceTimer);
      this.updateDebounceTimer = null;
    }

    // 카메라 애니메이션 타이머 정리
    this.cancelCameraAnimation();
    
    // 카메라 고정 해제
    if (this.viewer) {
      this.viewer.trackedEntity = undefined;
    }

    // 방향 화살표 제거
    this.hideDirectionArrows();

    if (this.swathPreview) {
      this.swathPreview.clear();
      this.swathPreview = null;
    }
    if (this.attitudeMiniMap) {
      this.attitudeMiniMap.clear();
      this.attitudeMiniMap = null;
    }
    if (this.busPayloadManager) {
      this.busPayloadManager.removeSatellite();
      this.busPayloadManager = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.viewer = null;
    this.currentDirectionInputId = null;
  }
}
