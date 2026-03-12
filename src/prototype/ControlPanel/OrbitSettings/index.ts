import {
  calculateOrbitalPeriod,
  type PositionAndVelocityAtEpoch,
} from './_util/orbit-calculator.js';
import { orbitalElementsToTLE } from './_util/orbital-elements-to-tle.js';
import {
  flyToPosition,
  setupCameraAngle,
  restoreZoomDistance,
  zoomToEntityAndTrack,
} from '../SatelliteSettings/_util/camera-manager.js';
import { calculateCameraRange } from '../SatelliteSettings/_util/entity-creator.js';
import { CAMERA } from '../SatelliteSettings/constants.js';
import {
  getPositionFromTLE,
  getPositionFromSatrec,
  parseTleToSatrec,
  type Satrec,
} from './_util/tle-position-util.js';
import {
  getElementsAndEpochTimeFromForm,
  type ParsedOrbitForm,
} from './_util/orbit-form-parser.js';
import { OrbitPathManager } from './_util/orbit-path-manager.js';
import { renderOrbitForm } from './_ui/orbit-form-renderer.js';

const scratchCartesian = new Cesium.Cartesian3();
const scratchCartesian2 = new Cesium.Cartesian3();
const scratchMatrix = new Cesium.Matrix4();

/** target + offset으로 카메라 위치·방향 계산 후 setView (lookAt 대신, 고정 없이 위치 이동만) */
function setCameraAtPosition(
  camera: any,
  target: Cesium.Cartesian3,
  headingDeg: number,
  pitchDeg: number,
  range: number
): void {
  const h = Cesium.Math.toRadians(headingDeg);
  const p = Cesium.Math.toRadians(pitchDeg);
  const cosP = Math.cos(p);
  const sinP = Math.sin(p);
  const cosH = Math.cos(h);
  const sinH = Math.sin(h);
  const localOffset = new Cesium.Cartesian3(
    range * cosP * sinH,
    range * cosP * cosH,
    range * sinP
  );
  const transform = Cesium.Transforms.eastNorthUpToFixedFrame(target, undefined, scratchMatrix);
  const dest = Cesium.Matrix4.multiplyByPoint(transform, localOffset, new Cesium.Cartesian3());
  const direction = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.subtract(target, dest, scratchCartesian),
    scratchCartesian
  );
  const up = Cesium.Cartesian3.normalize(target, scratchCartesian2);
  camera.setView({
    destination: dest,
    orientation: { direction, up },
  });
}

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
  /** TLE 파싱 결과 캐시 (매 프레임 파싱 방지) */
  private cachedSatrec: Satrec | null;
  /** 시뮬레이션 활성화 여부 (시간 기반 궤도 전파) */
  private simulationEnabled: boolean;
  /** postRender 핸들러 (시뮬레이션 시 시간 기반 위치 업데이트) */
  private postRenderHandler: (() => void) | null;
  private orbitPathManager: OrbitPathManager | null;
  /** 궤도 입력 변경 debounce 타이머 */
  private orbitChangeDebounceTimer: number | null;
  /** 마지막 적용한 위성 위치 (떨림 방지용 최소 이동량 체크) */
  private lastAppliedPos: { longitude: number; latitude: number; altitude: number } | null;
  /** preRender 스로틀: 마지막 처리 시각 ms (클럭 정지 시 불필요 업데이트 방지) */
  private lastProcessedTimeMs: number | null;
  /** preRender 스로틀: 프레임 카운터 (매 2프레임마다 업데이트) */
  private orbitUpdateFrameCount: number;
  /** 더블클릭 핸들러 제거 함수 (cleanup용) */
  private doubleClickRemove: (() => void) | null;

  constructor() {
    this.container = null;
    this.viewer = null;
    this.busPayloadManager = null;
    this.currentTLE = null;
    this.cachedSatrec = null;
    this.simulationEnabled = true;
    this.postRenderHandler = null;
    this.orbitPathManager = null;
    this.orbitChangeDebounceTimer = null;
    this.lastAppliedPos = null;
    this.lastProcessedTimeMs = null;
    this.orbitUpdateFrameCount = 0;
    this.doubleClickRemove = null;
  }

  /**
   * Initialize orbit settings tab
   */
  initialize(container: HTMLElement, viewer?: any, options?: OrbitSettingsOptions): void {
    this.container = container;
    this.viewer = viewer || null;
    this.busPayloadManager = options?.busPayloadManager ?? null;
    this.render();
    this.setupDoubleClickToTrack();
  }

  /**
   * Render orbit settings UI
   */
  private render(): void {
    if (!this.container) return;

    renderOrbitForm(this.container, {
      onOrbitChange: () => this.debouncedApplyOrbit(),
      onApplyOrbit: () => this.applyOrbitToSatellite(true, false),
    });

    if (this.viewer) {
      this.orbitPathManager = new OrbitPathManager({
        viewer: this.viewer,
        getParsedForm: () => this.getParsedForm(),
      });
    }

    this.updateTleDisplay();

    // TLE 궤도·엔티티 그리기는 SatelliteSettings.createInitialEntityOnOrbit 완료 후
    // applyOrbitToSatellite 호출로 수행됨 (위성 설정·궤도 설정 폼 값 반영)
  }

  /**
   * 현재 궤도 폼 값으로 TLE 생성 후 표시 영역 갱신
   */
  private updateTleDisplay(): void {
    const el = this.container?.querySelector('#prototypeOrbitTleDisplay');
    if (!el) return;

    const parsed = this.getParsedForm();
    if (!parsed) {
      el.textContent = 'Enter valid orbit values to generate TLE.';
      return;
    }

    const tle = orbitalElementsToTLE(
      parsed.elements,
      parsed.epochTime,
      'Orbit6Elements',
      99999
    );
    el.textContent = tle ?? 'Failed to generate TLE.';
  }

  /**
   * 위성 엔티티 더블클릭 시 zoomTo + trackedEntity (Cesium 기본 동작과 동일)
   */
  private setupDoubleClickToTrack(): void {
    if (!this.viewer?.scene?.canvas) return;
    if (this.doubleClickRemove) return;

    try {
      const widget = this.viewer.cesiumWidget;
      if (widget?.screenSpaceEventHandler) {
        widget.screenSpaceEventHandler.removeInputAction(
          Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
        );
      }

      const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

      const action = (event: { position: { x: number; y: number } }) => {
        const picked = this.viewer.scene.pick(event.position);
        let entity = picked?.id;
        if (!entity && picked) {
          const drilled = this.viewer.scene.drillPick(event.position);
          for (const obj of drilled) {
            if (obj.id) {
              entity = obj.id;
              break;
            }
          }
        }
        if (!entity) return;

        const busEntity = this.busPayloadManager?.getBusEntity();
        const antennaEntity = this.busPayloadManager?.getAntennaEntity?.();
        if (entity !== busEntity && entity !== antennaEntity) return;

        this.viewer.selectedEntity = entity;
        zoomToEntityAndTrack(
          this.viewer,
          busEntity ?? entity,
          CAMERA.ORBIT_TAB_ZOOM_RANGE,
          0,
          false
        );
      };

      handler.setInputAction(action, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
      this.doubleClickRemove = () => {
        handler.destroy();
        this.doubleClickRemove = null;
      };
    } catch (e) {
      console.warn('[OrbitSettings] 더블클릭 핸들러 등록 실패:', e);
    }
  }

  /**
   * 궤도 입력 변경 시 debounced 적용 (값 변경 시 즉시 반영)
   */
  private debouncedApplyOrbit(): void {
    if (this.orbitChangeDebounceTimer !== null) {
      clearTimeout(this.orbitChangeDebounceTimer);
    }
    this.orbitChangeDebounceTimer = window.setTimeout(() => {
      this.applyOrbitToSatellite(false, false);
      this.updateTleDisplay();
      this.orbitChangeDebounceTimer = null;
    }, 400);
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
   * 궤도 설정 탭 진입 시 (위성 위치·클럭·궤도선 변경 없음)
   */
  prepareOrbitTab(): void {
    if (!this.viewer) return;

    this.updateTleDisplay();

    if (this.cachedSatrec && this.viewer.clock) {
      const pos = getPositionFromSatrec(
        this.cachedSatrec,
        this.viewer.clock.currentTime
      );
      if (pos) {
        this.updatePassDirectionDisplay(pos.passDirection);
      }
    }
  }

  /**
   * 위성/궤도 위치로 카메라 이동 (버튼 클릭 시 호출)
   * @param trackEntity true면 trackedEntity 설정
   * @param topDownView true면 위에서 아래로 바라보는 정수리 뷰 (Fly to Satellite 버튼용)
   */
  flyToOrbitPosition(trackEntity = false, topDownView = false): void {
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
      // lastAppliedPos 동기화 - preRender 핸들러가 다음 프레임에 중복 updatePosition 호출하는 것 방지
      this.lastAppliedPos = {
        longitude: result.longitude,
        latitude: result.latitude,
        altitude: result.altitude,
      };
      // 탭 전환 시에는 시뮬레이션 루프를 시작하지 않음 (계속 업데이트 방지)
      // 시뮬레이션은 '궤도 적용' 버튼 클릭 시에만 시작
    }

    this.drawOrbitPath();

    if (result) {
      this.updatePassDirectionDisplay(result.passDirection);
      let position: Cesium.Cartesian3;
      if (busEntity?.position) {
        const pos = busEntity.position.getValue(Cesium.JulianDate.now());
        position = pos ?? Cesium.Cartesian3.fromDegrees(
          result.longitude,
          result.latitude,
          result.altitude
        );
      } else {
        position = Cesium.Cartesian3.fromDegrees(
          result.longitude,
          result.latitude,
          result.altitude
        );
      }
      this.stopTracking();
      const cameraRange = topDownView ? CAMERA.FLY_TO_SATELLITE_RANGE : calculateCameraRange();
      const pitchDeg = topDownView ? CAMERA.FLY_TO_SATELLITE_PITCH_DEGREES : CAMERA.PITCH_DEGREES;
      if (topDownView) {
        setCameraAtPosition(
          this.viewer.camera,
          position,
          CAMERA.HEADING_DEGREES,
          pitchDeg,
          cameraRange
        );
      } else {
        this.viewer.camera.lookAt(
          position,
          new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(CAMERA.HEADING_DEGREES),
            Cesium.Math.toRadians(pitchDeg),
            cameraRange
          )
        );
      }
      return;
    }

    if (busEntity) {
      const pos = busEntity.position?.getValue(Cesium.JulianDate.now());
      if (pos) {
        // lastAppliedPos 동기화 - preRender 핸들러의 중복 updatePosition 방지
        const carto = Cesium.Cartographic.fromCartesian(pos);
        this.lastAppliedPos = {
          longitude: Cesium.Math.toDegrees(carto.longitude),
          latitude: Cesium.Math.toDegrees(carto.latitude),
          altitude: carto.height,
        };
      }
      if (trackEntity) {
        this.stopTracking();
        if (pos) {
          const cameraRange = topDownView ? CAMERA.FLY_TO_SATELLITE_RANGE : calculateCameraRange();
          const pitchDeg = topDownView ? CAMERA.FLY_TO_SATELLITE_PITCH_DEGREES : CAMERA.PITCH_DEGREES;
          if (topDownView) {
            setCameraAtPosition(
              this.viewer.camera,
              pos,
              CAMERA.HEADING_DEGREES,
              pitchDeg,
              cameraRange
            );
          } else {
            this.viewer.camera.lookAt(
              pos,
              new Cesium.HeadingPitchRange(
                Cesium.Math.toRadians(CAMERA.HEADING_DEGREES),
                Cesium.Math.toRadians(pitchDeg),
                cameraRange
              )
            );
          }
        }
        // 시뮬레이션 중지 상태에서는 카메라 추적 불필요 (무한 업데이트 방지)
      } else {
        this.stopTracking();
        if (topDownView && pos) {
          setCameraAtPosition(
            this.viewer.camera,
            pos,
            CAMERA.HEADING_DEGREES,
            CAMERA.FLY_TO_SATELLITE_PITCH_DEGREES,
            CAMERA.FLY_TO_SATELLITE_RANGE
          );
        } else {
          setupCameraAngle(this.viewer, busEntity);
        }
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
   * 카메라 추적 중지 (trackedEntity 해제 시 호출)
   */
  private stopTracking(): void {
    if (this.viewer) {
      this.viewer.trackedEntity = undefined;
      this.viewer._trackingTarget = undefined;
      this.viewer.selectedEntity = undefined;
      restoreZoomDistance(this.viewer);
    }
  }

  /**
   * 위성 위치로 카메라 이동 (고정 없음, setView로 위치만 이동)
   * 다음 프레임에 한 번 더 적용하여 충돌 감지 등으로 밀려나는 현상 방지
   */
  zoomToSatelliteOnce(): void {
    const busEntity = this.busPayloadManager?.getBusEntity();
    if (!busEntity || !this.viewer) return;
    this.stopTracking();
    this.viewer.selectedEntity = busEntity;

    const applyCamera = (): void => {
      const pos = busEntity.position?.getValue?.(this.viewer.clock.currentTime);
      if (!pos) return;
      setCameraAtPosition(
        this.viewer.camera,
        pos,
        CAMERA.HEADING_DEGREES,
        CAMERA.FLY_TO_SATELLITE_PITCH_DEGREES,
        CAMERA.FLY_TO_SATELLITE_RANGE
      );
    };

    applyCamera();
    requestAnimationFrame(() => applyCamera());
  }

  /**
   * Fly to Satellite 버튼: 위성 바로 위에서 수직 하향(-90°) 뷰로 카메라 이동 후 추적
   * viewer.zoomTo 대신 camera.flyTo 직접 사용 → bounding sphere 계산 불필요
   */
  zoomToSatelliteAndTrack(): void {
    const busEntity = this.busPayloadManager?.getBusEntity();
    if (!busEntity || !this.viewer) {
      console.warn('[OrbitSettings] zoomToSatelliteAndTrack: busEntity 또는 viewer 없음');
      return;
    }

    const currentTime = this.viewer.clock.currentTime;
    const entityPos = busEntity.position?.getValue(currentTime);
    if (!entityPos) {
      console.warn('[OrbitSettings] zoomToSatelliteAndTrack: entity position 없음');
      return;
    }

    if (this.viewer.camera._flight && this.viewer.camera._flight.isActive()) {
      this.viewer.camera.cancelFlight();
    }

    const range = CAMERA.FLY_TO_SATELLITE_RANGE;
    // 지구 반경 방향(위쪽) 단위벡터
    const radialUp = Cesium.Cartesian3.normalize(entityPos, new Cesium.Cartesian3());
    // 카메라 위치: entity 바로 위
    const camPos = Cesium.Cartesian3.add(
      entityPos,
      Cesium.Cartesian3.multiplyByScalar(radialUp, range, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );
    // 카메라 direction: 아래를 향함(-radialUp)
    const direction = Cesium.Cartesian3.negate(radialUp, new Cesium.Cartesian3());
    // 카메라 up: North 방향 (Z축과 radialUp의 cross product로 East를 구한 뒤 North 계산)
    const zAxis = new Cesium.Cartesian3(0, 0, 1);
    let east = Cesium.Cartesian3.cross(zAxis, radialUp, new Cesium.Cartesian3());
    if (Cesium.Cartesian3.magnitude(east) < 1e-6) {
      // 극지방 예외: X축 사용
      east = new Cesium.Cartesian3(1, 0, 0);
    }
    Cesium.Cartesian3.normalize(east, east);
    const northWC = Cesium.Cartesian3.cross(radialUp, east, new Cesium.Cartesian3());
    Cesium.Cartesian3.normalize(northWC, northWC);

    this.viewer.camera.setView({
      destination: camPos,
      orientation: { direction, up: northWC },
    });

    // 추적 설정 (_trackingTarget은 ViewerInitializer preRender에서 처리)
    this.viewer._trackingTarget = busEntity;
    this.viewer.scene.screenSpaceCameraController.maximumZoomDistance =
      CAMERA.MAX_ZOOM_DISTANCE_WHEN_TRACKING;
  }

  /** 시뮬레이션(clock 재생)이 실행 중인지 */
  isSimulationRunning(): boolean {
    return !!(this.viewer?.clock?.shouldAnimate);
  }

  /**
   * 카메라 추적 중지. 탭 전환 시 ControlPanel에서 호출 가능.
   */
  stopCameraTracking(): void {
    this.stopTracking();
  }

  /**
   * 궤도 preRender 핸들러 등록 (TLE 기반 위치 업데이트, Cesium play 버튼/타임라인과 연동)
   * preRender 사용: 카메라 추적 시 해당 프레임의 위치를 먼저 갱신해야 추적이 정확함
   */
  private ensureOrbitPostRenderAttached(): void {
    if (!this.viewer || !this.busPayloadManager?.getBusEntity() || !this.currentTLE) return;
    if (this.postRenderHandler) return; // 이미 등록됨

    /** 최소 이동량 (m) - 이보다 작은 변화는 무시하여 떨림 감소 (궤도 속도 ~7.5km/s이므로 0.5m로 부동소수점 노이즈만 필터) */
    const MIN_MOVE_M = 0.5;
    /** 스로틀: 클럭 정지 시 시각 변경 없으면 스킵, 재생 시 2프레임마다 업데이트 (멈춤 방지) */
    let wasAnimating = false;
    this.postRenderHandler = () => {
      const satrec = this.cachedSatrec;
      if (!satrec || !this.busPayloadManager?.getBusEntity()) return;
      const currentTime = this.viewer.clock.currentTime;
      const isAnimating = this.viewer.clock.shouldAnimate;

      // 재생 중 _trackingTarget이 해제되어 있으면 재설정 (Play 버튼, 탭 전환 후 재생 등 모든 경우 처리)
      if (isAnimating) {
        const busEntity = this.busPayloadManager?.getBusEntity();
        if (busEntity && !this.viewer._trackingTarget) {
          this.viewer._trackingTarget = busEntity;
        }
      }
      wasAnimating = isAnimating;

      if (!isAnimating) {
        const currentMs = Cesium.JulianDate.toDate(currentTime).getTime();
        if (this.lastProcessedTimeMs !== null && this.lastProcessedTimeMs === currentMs) return;
        this.lastProcessedTimeMs = currentMs;
      } else {
        this.orbitUpdateFrameCount++;
        if (this.orbitUpdateFrameCount % 2 !== 0) return;
      }
      const pos = getPositionFromSatrec(satrec, currentTime);
      if (pos) {
        const newCart = Cesium.Cartesian3.fromDegrees(
          pos.longitude,
          pos.latitude,
          pos.altitude
        );
        const shouldUpdate =
          !this.lastAppliedPos ||
          Cesium.Cartesian3.distance(
            newCart,
            Cesium.Cartesian3.fromDegrees(
              this.lastAppliedPos.longitude,
              this.lastAppliedPos.latitude,
              this.lastAppliedPos.altitude
            )
          ) >= MIN_MOVE_M;
        if (shouldUpdate) {
          this.lastAppliedPos = {
            longitude: pos.longitude,
            latitude: pos.latitude,
            altitude: pos.altitude,
          };
          this.busPayloadManager.updatePosition(this.lastAppliedPos);
          this.busPayloadManager.setVelocityDirectionEcef(
            pos.velocityEcef.x,
            pos.velocityEcef.y,
            pos.velocityEcef.z
          );
        }
      }
    };
    this.viewer.scene.preRender.addEventListener(this.postRenderHandler);
  }

  /**
   * 시뮬레이션 루프 시작 (postRender 등록 + clock 재생)
   */
  private startSimulationLoop(): void {
    if (!this.viewer || !this.busPayloadManager?.getBusEntity() || !this.currentTLE) {
      console.warn('[OrbitSettings] 시뮬레이션 시작 불가: 뷰어/위성/TLE 필요');
      return;
    }

    this.ensureOrbitPostRenderAttached();

    const parsed = this.getParsedForm();
    if (parsed && this.viewer.clock) {
      this.viewer.clock.currentTime = Cesium.JulianDate.addSeconds(
        parsed.epochTime,
        0,
        new Cesium.JulianDate()
      );
      this.viewer.clock.shouldAnimate = true;
    }

    this.lastAppliedPos = null;
    this.lastProcessedTimeMs = null;
    this.orbitUpdateFrameCount = 0;
    const currentTime = this.viewer.clock.currentTime;
    const pos = getPositionFromTLE(this.currentTLE!, currentTime);
    if (pos) {
      this.lastAppliedPos = {
        longitude: pos.longitude,
        latitude: pos.latitude,
        altitude: pos.altitude,
      };
      this.busPayloadManager!.updatePosition(this.lastAppliedPos);
      this.busPayloadManager!.setVelocityDirectionEcef(
        pos.velocityEcef.x,
        pos.velocityEcef.y,
        pos.velocityEcef.z
      );
    }

    // 시뮬레이션 시작 시 위성 추적 설정
    const busEntity = this.busPayloadManager?.getBusEntity();
    if (busEntity && this.viewer._trackingTarget !== busEntity) {
      this.viewer._trackingTarget = busEntity;
    }

    console.log('[OrbitSettings] 시뮬레이션 루프 시작 (TLE 기반)');
  }

  /**
   * 시뮬레이션 루프 중지 (shouldAnimate만 false, postRender는 유지하여 타임라인 스크럽 시에도 위치 갱신)
   */
  private stopSimulationLoop(): void {
    if (this.viewer?.clock) {
      this.viewer.clock.shouldAnimate = false;
    }
  }

  /**
   * preRender 핸들러 제거 (cleanup 시에만 호출)
   */
  private removeOrbitPostRender(): void {
    if (this.postRenderHandler && this.viewer) {
      this.viewer.scene.preRender.removeEventListener(this.postRenderHandler);
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
      if (showAlert) alert('Cesium viewer is not initialized.');
      return;
    }

    if (!this.busPayloadManager || !this.busPayloadManager.getBusEntity()) {
      if (showAlert) alert('Please create a satellite first in the Satellite tab.');
      return;
    }

    try {
      const parsed = this.getParsedForm();
      if (!parsed) {
        if (showAlert) {
          alert(
            'Semi-major axis must be greater than Earth radius (6378.137 km), and eccentricity must be between 0 and 1 (exclusive).'
          );
        }
        return;
      }

      const { elements, epochTime } = parsed;
      const tle = orbitalElementsToTLE(elements, epochTime, 'Orbit6Elements', 99999);
      if (!tle) {
        if (showAlert) alert('Failed to generate TLE.');
        return;
      }
      this.currentTLE = tle;
      this.cachedSatrec = parseTleToSatrec(tle);

      const result = getPositionFromTLE(tle, epochTime);
      if (!result) {
        if (showAlert) alert('Failed to calculate orbit position and velocity for the specified time.');
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

      this.updateTleDisplay();
      this.simulationEnabled = startSimulation;
      this.drawOrbitPath();

      // 타임라인 시뮬레이션 시간 범위 설정 (Initial Time 기반)
      const periodSeconds = calculateOrbitalPeriod(elements.semiMajorAxis) * 3600;
      const startTime = epochTime;
      const stopTime = Cesium.JulianDate.addSeconds(
        epochTime,
        30 * periodSeconds,
        new Cesium.JulianDate()
      );
      if (this.viewer.clock) {
        this.viewer.clock.startTime = Cesium.JulianDate.addSeconds(startTime, 0, new Cesium.JulianDate());
        this.viewer.clock.stopTime = Cesium.JulianDate.addSeconds(stopTime, 0, new Cesium.JulianDate());
        this.viewer.clock.currentTime = Cesium.JulianDate.addSeconds(startTime, 0, new Cesium.JulianDate());
        this.viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
      }
      if (this.viewer.timeline) {
        this.viewer.timeline.zoomTo(startTime, stopTime);
      }

      // postRender 등록 (Cesium play 버튼/타임라인 스크럽 시 위성 위치 갱신)
      this.ensureOrbitPostRenderAttached();

      const busEntity = this.busPayloadManager?.getBusEntity();
      if (startSimulation) {
        this.startSimulationLoop();
        if (busEntity) {
          zoomToEntityAndTrack(this.viewer, busEntity, calculateCameraRange(), 0);
        }
      } else {
        if (busEntity) {
          zoomToEntityAndTrack(this.viewer, busEntity, calculateCameraRange(), 0);
        } else {
          const position = Cesium.Cartesian3.fromDegrees(
            result.longitude,
            result.latitude,
            result.altitude
          );
          flyToPosition(this.viewer, position);
        }
      }

      this.updatePassDirectionDisplay(result.passDirection);

      const periodHours = calculateOrbitalPeriod(elements.semiMajorAxis);
      console.log(
        `[OrbitSettings] 위성 배치 완료: (${result.longitude.toFixed(4)}°, ${result.latitude.toFixed(4)}°), 고도 ${(result.altitude / 1000).toFixed(2)} km, ${result.passDirection}, 진행방향=X축`
      );
      if (showAlert) {
        alert(
          `Satellite placed at epoch orbit position.\nPropagation direction matches satellite X-axis.\nOrbital period: ${periodHours.toFixed(2)} hours`
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[OrbitSettings] 위성 배치 오류:', error);
      if (showAlert) alert('Satellite placement failed: ' + message);
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
          ? 'Ascending (S→N)'
          : 'Descending (N→S)';
      el.textContent = `Pass Direction: ${label}`;
    }
  }

  /**
   * Cleanup orbit settings
   */
  cleanup(): void {
    if (this.orbitChangeDebounceTimer !== null) {
      clearTimeout(this.orbitChangeDebounceTimer);
      this.orbitChangeDebounceTimer = null;
    }
    this.doubleClickRemove?.();
    this.stopSimulationLoop();
    this.removeOrbitPostRender();
    this.cachedSatrec = null;
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
