import {
  calculateOrbitalPeriod,
  type PositionAndVelocityAtEpoch,
} from './_util/orbit-calculator.js';
import { orbitalElementsToTLE } from './_util/orbital-elements-to-tle.js';
import {
  flyToPosition,
  setupCameraAngle,
  restoreZoomDistance,
} from '../SatelliteSettings/_util/camera-manager.js';
import { CAMERA } from '../SatelliteSettings/constants.js';
import { getPositionFromTLE } from './_util/tle-position-util.js';
import {
  getElementsAndEpochTimeFromForm,
  type ParsedOrbitForm,
} from './_util/orbit-form-parser.js';
import { OrbitPathManager } from './_util/orbit-path-manager.js';
import { renderOrbitForm } from './_ui/orbit-form-renderer.js';

export interface OrbitSettingsOptions {
  /** 위성 설정에서 생성한 위성 엔티티를 배치할 때 사용. 없으면 배치하지 않음 */
  busPayloadManager?: import('../SatelliteSettings/SatelliteBusPayloadManager/index.js').SatelliteBusPayloadManager | null;
}

/**
 * OrbitSettings - Orbit settings tab management class
 */
export class OrbitSettings {
  private container: HTMLElement | null;
  private viewer: any;
  private busPayloadManager: import('../SatelliteSettings/SatelliteBusPayloadManager/index.js').SatelliteBusPayloadManager | null;
  /** 궤도 6요소에서 생성한 TLE (시뮬레이션용) */
  private currentTLE: string | null;
  /** 시뮬레이션 활성화 여부 (시간 기반 궤도 전파) */
  private simulationEnabled: boolean;
  /** postRender 핸들러 (시뮬레이션 시 시간 기반 위치 업데이트) */
  private postRenderHandler: (() => void) | null;
  private orbitPathManager: OrbitPathManager | null;
  /** Cesium trackedEntity용 point 프록시 (POC 방식, box geometry는 trackedEntity 버그) */
  private trackProxyEntity: any;

  constructor() {
    this.container = null;
    this.viewer = null;
    this.busPayloadManager = null;
    this.currentTLE = null;
    this.simulationEnabled = true;
    this.postRenderHandler = null;
    this.orbitPathManager = null;
    this.trackProxyEntity = null;
  }

  /**
   * Initialize orbit settings tab
   */
  initialize(container: HTMLElement, viewer?: any, options?: OrbitSettingsOptions): void {
    this.container = container;
    this.viewer = viewer || null;
    this.busPayloadManager = options?.busPayloadManager ?? null;
    this.render();
  }

  /**
   * Render orbit settings UI
   */
  private render(): void {
    if (!this.container) return;

    renderOrbitForm(this.container, {
      onApply: () => this.applyOrbitToSatellite(false),
    });

    if (this.viewer) {
      this.orbitPathManager = new OrbitPathManager({
        viewer: this.viewer,
        getParsedForm: () => this.getParsedForm(),
      });
    }

    // TLE 궤도·엔티티 그리기는 SatelliteSettings.createInitialEntityOnOrbit 완료 후
    // applyOrbitToSatellite 호출로 수행됨 (위성 설정·궤도 설정 폼 값 반영)
  }

  /**
   * 폼에서 궤도 6요소와 초기 시각 파싱 (orbit-form-parser 래퍼)
   */
  private getParsedForm(): ParsedOrbitForm | null {
    const root = this.container || document;
    const fallbackTime =
      this.viewer?.clock?.currentTime ?? Cesium.JulianDate.now();
    return getElementsAndEpochTimeFromForm(root, fallbackTime);
  }

  /**
   * 현재 폼의 궤도 6요소·초기 시각으로 해당 시각의 궤도 위치 반환 (최초 접근 시 위성 배치용)
   */
  getOrbitPositionForInitialPlacement(): PositionAndVelocityAtEpoch | null {
    return this.getOrbitPositionFromForm();
  }

  /**
   * 궤도 설정 탭 진입 시 해당 시각의 궤도 위치로 카메라 이동.
   */
  flyToOrbitPosition(trackEntity = false): void {
    if (!this.viewer) return;

    // 탭 전환 시 시뮬레이션 중지 (무한 업데이트 방지)
    this.stopSimulationLoop();
    this.simulationEnabled = false; // 30분 정적 궤도선 표시

    const result = this.getOrbitPositionFromForm();
    const busEntity = this.busPayloadManager?.getBusEntity();

    if (result && this.busPayloadManager && busEntity) {
      this.busPayloadManager.updatePosition({
        longitude: result.longitude,
        latitude: result.latitude,
        altitude: result.altitude,
      });
      this.busPayloadManager.setVelocityDirectionEcef(
        result.velocityEcef.x,
        result.velocityEcef.y,
        result.velocityEcef.z
      );
      // 탭 전환 시에는 시뮬레이션 루프를 시작하지 않음 (계속 업데이트 방지)
      // 시뮬레이션은 '궤도 적용' 버튼 클릭 시에만 시작
    }

    this.drawOrbitPath();

    if (result) {
      this.updatePassDirectionDisplay(result.passDirection);
      const position = Cesium.Cartesian3.fromDegrees(
        result.longitude,
        result.latitude,
        result.altitude
      );
      this.stopTracking();
      this.viewer.camera.lookAt(
        position,
        new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(CAMERA.HEADING_DEGREES),
          Cesium.Math.toRadians(CAMERA.PITCH_DEGREES),
          CAMERA.ORBIT_TAB_ZOOM_RANGE
        )
      );
      return;
    }

    if (busEntity) {
      if (trackEntity) {
        this.stopTracking();
        const pos = busEntity.position?.getValue(Cesium.JulianDate.now());
        if (pos) {
          this.viewer.camera.lookAt(
            pos,
            new Cesium.HeadingPitchRange(
              Cesium.Math.toRadians(CAMERA.HEADING_DEGREES),
              Cesium.Math.toRadians(CAMERA.PITCH_DEGREES),
              CAMERA.ORBIT_TAB_ZOOM_RANGE
            )
          );
        }
        // 시뮬레이션 중지 상태에서는 카메라 추적 불필요 (무한 업데이트 방지)
      } else {
        this.stopTracking();
        setupCameraAngle(this.viewer, busEntity);
      }
      return;
    }

    if (this.viewer.camera._flight && this.viewer.camera._flight.isActive()) {
      this.viewer.camera.cancelFlight();
    }
    this.stopTracking();
    this.viewer.camera.flyHome(0);
  }

  /**
   * 현재 폼 값으로 궤도 6요소·epoch 시각을 구성해 해당 시각의 위치 반환 (실패 시 null)
   */
  private getOrbitPositionFromForm(): PositionAndVelocityAtEpoch | null {
    const parsed = this.getParsedForm();
    if (!parsed) return null;
    const tle = orbitalElementsToTLE(
      parsed.elements,
      parsed.epochTime,
      'Orbit6Elements',
      99999
    );
    if (!tle) return null;
    const pos = getPositionFromTLE(tle, parsed.epochTime);
    if (!pos) return null;
    return {
      longitude: pos.longitude,
      latitude: pos.latitude,
      altitude: pos.altitude,
      velocityAzimuthDeg: 0,
      velocityElevationDeg: 0,
      velocityEcef: pos.velocityEcef,
      passDirection: pos.passDirection,
    };
  }

  /**
   * 궤도 경로 그리기
   */
  private drawOrbitPath(): void {
    this.orbitPathManager?.draw();
  }

  /**
   * 카메라 추적 중지 (trackProxy 제거, trackedEntity 해제)
   */
  private stopTracking(): void {
    if (this.trackProxyEntity && this.viewer) {
      this.viewer.entities.remove(this.trackProxyEntity);
      this.trackProxyEntity = null;
    }
    if (this.viewer) {
      this.viewer.trackedEntity = undefined;
      restoreZoomDistance(this.viewer);
    }
  }

  /**
   * 위성에 카메라 고정 시작 (엔티티 더블클릭과 동일: zoomTo + trackedEntity)
   * box geometry 버그 → bus와 같은 position을 쓰는 point 프록시로 추적
   */
  startTracking(): boolean {
    const busEntity = this.busPayloadManager?.getBusEntity();
    if (!busEntity || !this.viewer) return false;
    this.stopTracking();

    this.trackProxyEntity = this.viewer.entities.add({
      position: busEntity.position,
      point: {
        pixelSize: 1,
        color: Cesium.Color.TRANSPARENT,
        outlineColor: Cesium.Color.TRANSPARENT,
        outlineWidth: 0,
      },
      show: false,
    });

    const offset = new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(CAMERA.HEADING_DEGREES),
      Cesium.Math.toRadians(CAMERA.PITCH_DEGREES),
      CAMERA.ORBIT_TAB_ZOOM_RANGE
    );
    this.viewer.zoomTo(this.trackProxyEntity, { offset });
    this.viewer.trackedEntity = this.trackProxyEntity;
    this.viewer.scene.screenSpaceCameraController.maximumZoomDistance =
      CAMERA.MAX_ZOOM_DISTANCE_WHEN_TRACKING;

    return true;
  }

  /** 카메라가 위성에 고정 중인지 */
  isTracking(): boolean {
    return this.trackProxyEntity != null;
  }

  /**
   * 카메라 추적 중지. 탭 전환 시 ControlPanel에서 호출 가능.
   */
  stopCameraTracking(): void {
    this.stopTracking();
  }

  /**
   * 시뮬레이션 루프 시작 (postRender에서 TLE 기반 위치 업데이트)
   */
  private startSimulationLoop(): void {
    this.stopSimulationLoop();
    if (!this.viewer || !this.busPayloadManager?.getBusEntity() || !this.currentTLE) {
      console.warn('[OrbitSettings] 시뮬레이션 시작 불가: 뷰어/위성/TLE 필요');
      return;
    }

    const parsed = this.getParsedForm();
    if (parsed && this.viewer.clock) {
      this.viewer.clock.currentTime = Cesium.JulianDate.addSeconds(
        parsed.epochTime,
        0,
        new Cesium.JulianDate()
      );
      this.viewer.clock.shouldAnimate = true;
    }

    this.postRenderHandler = () => {
      if (!this.currentTLE || !this.busPayloadManager?.getBusEntity()) return;
      const currentTime = this.viewer.clock.currentTime;
      const pos = getPositionFromTLE(this.currentTLE, currentTime);
      if (pos) {
        this.busPayloadManager.updatePosition({
          longitude: pos.longitude,
          latitude: pos.latitude,
          altitude: pos.altitude,
        });
        this.busPayloadManager.setVelocityDirectionEcef(
          pos.velocityEcef.x,
          pos.velocityEcef.y,
          pos.velocityEcef.z
        );
      }
    };
    this.viewer.scene.postRender.addEventListener(this.postRenderHandler);

    const currentTime = this.viewer.clock.currentTime;
    const pos = getPositionFromTLE(this.currentTLE!, currentTime);
    if (pos) {
      this.busPayloadManager!.updatePosition({
        longitude: pos.longitude,
        latitude: pos.latitude,
        altitude: pos.altitude,
      });
      this.busPayloadManager!.setVelocityDirectionEcef(
        pos.velocityEcef.x,
        pos.velocityEcef.y,
        pos.velocityEcef.z
      );
    }

    console.log('[OrbitSettings] 시뮬레이션 루프 시작 (TLE 기반)');
  }

  /**
   * 시뮬레이션 루프 중지
   */
  private stopSimulationLoop(): void {
    if (this.postRenderHandler && this.viewer) {
      this.viewer.scene.postRender.removeEventListener(this.postRenderHandler);
      this.postRenderHandler = null;
    }
  }

  /**
   * 궤도 6요소·초기 시각으로 해당 시각의 위치에 위성 배치
   * (SatelliteSettings 초기 엔티티 생성 후 TLE 궤도·시뮬레이션 적용용으로 public)
   * @param showAlert 알림 표시 여부
   * @param startSimulation 시뮬레이션 시작 여부. false면 30분 궤도선만 표시 (초기 접근 시)
   */
  applyOrbitToSatellite(showAlert = true, startSimulation = true): void {
    if (!this.viewer) {
      if (showAlert) alert('Cesium 뷰어가 초기화되지 않았습니다.');
      return;
    }

    if (!this.busPayloadManager || !this.busPayloadManager.getBusEntity()) {
      if (showAlert) alert('위성 설정 탭에서 먼저 위성을 생성해주세요.');
      return;
    }

    try {
      const parsed = this.getParsedForm();
      if (!parsed) {
        if (showAlert) {
          alert(
            '긴반지름은 지구 반지름(6378.137km)보다 커야 하고, 이심률은 0 이상 1 미만이어야 합니다.'
          );
        }
        return;
      }

      const { elements, epochTime } = parsed;
      const tle = orbitalElementsToTLE(elements, epochTime, 'Orbit6Elements', 99999);
      if (!tle) {
        if (showAlert) alert('TLE 생성에 실패했습니다.');
        return;
      }
      this.currentTLE = tle;

      const result = getPositionFromTLE(tle, epochTime);
      if (!result) {
        if (showAlert) alert('해당 시각의 궤도 위치·속도 계산에 실패했습니다.');
        return;
      }

      this.busPayloadManager.setVelocityDirectionEcef(
        result.velocityEcef.x,
        result.velocityEcef.y,
        result.velocityEcef.z
      );
      this.busPayloadManager.updatePosition({
        longitude: result.longitude,
        latitude: result.latitude,
        altitude: result.altitude,
      });
      console.log('[OrbitSettings] TLE 생성 완료:\n', this.currentTLE);

      this.simulationEnabled = startSimulation;
      this.drawOrbitPath();

      if (startSimulation) {
        this.startSimulationLoop();
        this.startTracking();
      } else {
        const position = Cesium.Cartesian3.fromDegrees(
          result.longitude,
          result.latitude,
          result.altitude
        );
        flyToPosition(this.viewer, position);
      }

      this.updatePassDirectionDisplay(result.passDirection);

      const periodHours = calculateOrbitalPeriod(elements.semiMajorAxis);
      console.log(
        `[OrbitSettings] 위성 배치 완료: (${result.longitude.toFixed(4)}°, ${result.latitude.toFixed(4)}°), 고도 ${(result.altitude / 1000).toFixed(2)} km, ${result.passDirection}, 진행방향=X축`
      );
      if (showAlert) {
        alert(
          `해당 시각의 궤도 위치에 위성을 배치했습니다.\n진행 방향이 위성 X축과 일치합니다.\n궤도 주기: ${periodHours.toFixed(2)}시간`
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[OrbitSettings] 위성 배치 오류:', error);
      if (showAlert) alert('위성 배치 실패: ' + message);
    }
  }

  /**
   * 진행 방향(Ascending/Descending) 표시 업데이트
   */
  private updatePassDirectionDisplay(
    passDirection: 'ascending' | 'descending'
  ): void {
    const root = this.container || document;
    const el = root.querySelector('#prototypeOrbitPassDirection') as HTMLElement;
    if (el) {
      const label =
        passDirection === 'ascending'
          ? 'Ascending (남→북)'
          : 'Descending (북→남)';
      el.textContent = `진행 방향: ${label}`;
    }
  }

  /**
   * Cleanup orbit settings
   */
  cleanup(): void {
    this.stopSimulationLoop();
    this.stopCameraTracking();
    this.orbitPathManager?.clear();
    this.orbitPathManager = null;
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.viewer = null;
    this.busPayloadManager = null;
  }
}
