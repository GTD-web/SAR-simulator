import {
  calculateOrbitPath,
  calculateOrbitPathCentered,
  calculateOrbitalPeriod,
  getPositionAndVelocityAtEpoch,
  computeTimeOverPosition,
  type OrbitalElements,
  type PositionAndVelocityAtEpoch,
} from './_util/orbit-calculator.js';
import { orbitalElementsToTLE } from './_util/orbital-elements-to-tle.js';
import { flyToPosition, setupCameraAngle } from '../SatelliteSettings/_util/camera-manager.js';

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
  private updateDebounceTimer: number | null;
  /** 궤도 경로 폴리라인 (30분 또는 전체 4시간) */
  private orbitPathEntity: any;
  /** 궤도 6요소에서 생성한 TLE (시뮬레이션용) */
  private currentTLE: string | null;
  /** 시뮬레이션 활성화 여부 (시간 기반 궤도 전파) */
  private simulationEnabled: boolean;
  /** postRender 핸들러 (시뮬레이션 시 시간 기반 위치 업데이트) */
  private postRenderHandler: (() => void) | null;

  constructor() {
    this.container = null;
    this.viewer = null;
    this.busPayloadManager = null;
    this.updateDebounceTimer = null;
    this.orbitPathEntity = null;
    this.currentTLE = null;
    this.simulationEnabled = true; // 기본 시뮬레이션 활성화
    this.postRenderHandler = null;
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

    const section = document.createElement('div');
    section.className = 'sidebar-section';

    // Orbit settings form
    const form = document.createElement('div');
    form.style.marginTop = '15px';

    // RADARSAT RCM 위성 기본값
    const RADARSAT_RCM: OrbitalElements = {
      semiMajorAxis: 6970.1,         // km (고도 592 km)
      eccentricity: 0.0001,
      inclination: 97.74,
      raan: 0,
      argumentOfPerigee: 0,
      meanAnomaly: 0
    };

    // 한반도(127°E, 37°N)에 가장 가까운 시각을 기본값으로 사용 (14일간 탐색)
    const refTime = Cesium.JulianDate.fromDate(new Date());
    const koreaPassTime = computeTimeOverPosition(RADARSAT_RCM, refTime);
    const defaultInitialDate = Cesium.JulianDate.toDate(koreaPassTime);

    // 초기 시각 (해당 시각의 궤도 위치에 위성 설정의 모델이 배치됨, 진행방향=위성 X축)
    const initialTimeLabel = document.createElement('label');
    initialTimeLabel.style.marginTop = '10px';
    initialTimeLabel.style.display = 'block';
    initialTimeLabel.textContent = '초기 시각 (Initial Time):';
    const initialTimeInput = document.createElement('input');
    initialTimeInput.type = 'datetime-local';
    initialTimeInput.id = 'prototypeOrbitInitialTime';
    const d = defaultInitialDate;
    initialTimeInput.value =
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T` +
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    initialTimeLabel.appendChild(initialTimeInput);
    form.appendChild(initialTimeLabel);

    // 1. a (Semi-major Axis) - 긴반지름
    const semiMajorAxisInput = this.createInputField(
      form,
      'a - 긴반지름 (Semi-major Axis) (km):',
      'prototypeOrbitSemiMajorAxis',
      String(RADARSAT_RCM.semiMajorAxis),
      '100',
      '50000',
      '0.1'
    );

    // 2. e (Eccentricity) - 이심률
    const eccentricityInput = this.createInputField(
      form,
      'e - 이심률 (Eccentricity):',
      'prototypeOrbitEccentricity',
      String(RADARSAT_RCM.eccentricity),
      '0',
      '1',
      '0.0001'
    );

    // 3. i (Inclination) - 궤도 경사각
    const inclinationInput = this.createInputField(
      form,
      'i - 궤도 경사각 (Inclination) (deg):',
      'prototypeOrbitInclination',
      String(RADARSAT_RCM.inclination),
      '0',
      '180',
      '0.1'
    );

    // 4. Ω (RAAN) - 승교점 적경
    const raanInput = this.createInputField(
      form,
      'Ω - 승교점 적경 (RAAN) (deg):',
      'prototypeOrbitRAAN',
      String(RADARSAT_RCM.raan),
      '0',
      '360',
      '0.1'
    );

    // 5. ω (Argument of Perigee) - 근지점 편각
    const argumentOfPerigeeInput = this.createInputField(
      form,
      'ω - 근지점 편각 (Argument of Perigee) (deg):',
      'prototypeOrbitArgumentOfPerigee',
      String(RADARSAT_RCM.argumentOfPerigee),
      '0',
      '360',
      '0.1'
    );

    // 6. ν 또는 M - 진근점이각 또는 평균근점이각
    const anomalyTypeLabel = document.createElement('label');
    anomalyTypeLabel.style.marginTop = '10px';
    anomalyTypeLabel.style.display = 'block';
    anomalyTypeLabel.textContent = '이각 타입 (Anomaly Type):';
    
    const anomalyTypeSelect = document.createElement('select');
    anomalyTypeSelect.id = 'prototypeOrbitAnomalyType';
    anomalyTypeSelect.style.width = '100%';
    anomalyTypeSelect.style.marginTop = '4px';
    anomalyTypeSelect.style.padding = '4px';
    
    const trueAnomalyOption = document.createElement('option');
    trueAnomalyOption.value = 'true';
    trueAnomalyOption.textContent = 'ν (진근점이각, True Anomaly)';
    anomalyTypeSelect.appendChild(trueAnomalyOption);
    
    const meanAnomalyOption = document.createElement('option');
    meanAnomalyOption.value = 'mean';
    meanAnomalyOption.textContent = 'M (평균근점이각, Mean Anomaly)';
    meanAnomalyOption.selected = true; // RADARSAT RCM은 평균근점이각 사용
    anomalyTypeSelect.appendChild(meanAnomalyOption);
    
    anomalyTypeLabel.appendChild(anomalyTypeSelect);
    form.appendChild(anomalyTypeLabel);

    const anomalyInput = this.createInputField(
      form,
      'ν 또는 M - 이각 (True/Mean Anomaly) (deg):',
      'prototypeOrbitAnomaly',
      String(RADARSAT_RCM.meanAnomaly), // RADARSAT RCM 평균근점이각
      '0',
      '360',
      '0.1'
    );

    // 폼 전체에 이벤트 위임 (change, input) - 궤도값 변경 시 자동 업데이트
    const handleOrbitInputChange = () => {
      this.updateOrbitDebounced();
    };
    form.addEventListener('change', handleOrbitInputChange);
    form.addEventListener('input', handleOrbitInputChange);

    // 시뮬레이션 활성화 체크박스 (poc처럼 시간 기반 궤도 전파)
    const simLabel = document.createElement('label');
    simLabel.style.marginTop = '12px';
    simLabel.style.display = 'flex';
    simLabel.style.alignItems = 'center';
    simLabel.style.gap = '8px';
    simLabel.style.cursor = 'pointer';
    const simCheckbox = document.createElement('input');
    simCheckbox.type = 'checkbox';
    simCheckbox.id = 'prototypeOrbitSimulationEnabled';
    simCheckbox.checked = true; // 기본 시뮬레이션 활성화
    const simText = document.createElement('span');
    simText.textContent = '시뮬레이션 활성화 (시간 기반 궤도 전파, poc 방식)';
    simLabel.appendChild(simCheckbox);
    simLabel.appendChild(simText);
    form.appendChild(simLabel);

    simCheckbox.addEventListener('change', () => {
      this.simulationEnabled = simCheckbox.checked;
      if (this.simulationEnabled) {
        this.startSimulationLoop();
      } else {
        this.stopSimulationLoop();
      }
    });

    // 진행 방향 표시 (Ascending / Descending)
    const passDirectionLabel = document.createElement('div');
    passDirectionLabel.id = 'prototypeOrbitPassDirection';
    passDirectionLabel.style.marginTop = '12px';
    passDirectionLabel.style.padding = '8px';
    passDirectionLabel.style.background = 'rgba(0,0,0,0.2)';
    passDirectionLabel.style.borderRadius = '4px';
    passDirectionLabel.style.fontSize = '13px';
    passDirectionLabel.textContent = '진행 방향: -';
    form.appendChild(passDirectionLabel);

    // 수동 적용 버튼 (자동 업데이트가 동작하지 않을 때 사용)
    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.className = 'sidebar-section button';
    applyButton.style.width = '100%';
    applyButton.style.marginTop = '15px';
    applyButton.textContent = '궤도 적용';
    applyButton.addEventListener('click', () => {
      this.applyOrbitToSatellite(false);
    });
    form.appendChild(applyButton);

    section.appendChild(form);
    this.container.appendChild(section);

    // 초기화 시 해당 시각 위치에 위성 배치 (alert 없이)
    if (this.viewer) {
      setTimeout(() => {
        this.applyOrbitToSatellite(false);
      }, 500);
    }
  }

  /**
   * 궤도 자동 업데이트 (디바운싱 적용)
   */
  private updateOrbitDebounced(): void {
    if (this.updateDebounceTimer !== null) {
      clearTimeout(this.updateDebounceTimer);
    }
    
    this.updateDebounceTimer = window.setTimeout(() => {
      this.applyOrbitToSatellite(false);
      this.updateDebounceTimer = null;
    }, 500); // 500ms 디바운스
  }

  /**
   * 입력 필드 생성 헬퍼 함수
   */
  private createInputField(
    parent: HTMLElement,
    labelText: string,
    inputId: string,
    defaultValue: string,
    min: string,
    max: string,
    step: string
  ): HTMLElement {
    const label = document.createElement('label');
    label.style.marginTop = '10px';
    label.style.display = 'block';
    label.textContent = labelText;
    
    const input = document.createElement('input');
    input.type = 'number';
    input.id = inputId;
    input.value = defaultValue;
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

  /**
   * 현재 폼의 궤도 6요소·초기 시각으로 해당 시각의 궤도 위치 반환 (최초 접근 시 위성 배치용)
   */
  getOrbitPositionForInitialPlacement(): import('./_util/orbit-calculator.js').PositionAndVelocityAtEpoch | null {
    return this.getOrbitPositionFromForm();
  }

  /**
   * 궤도 설정 탭 진입 시 해당 시각의 궤도 위치로 카메라 이동.
   * 진입 시 위성 엔티티가 있으면 먼저 해당 궤도 위치에 배치한 뒤 카메라를 이동한다.
   * 궤도 위치를 구할 수 없으면 위성 엔티티로, 없으면 지구 전경으로 이동.
   */
  flyToOrbitPosition(): void {
    if (!this.viewer) return;

    const result = this.getOrbitPositionFromForm();
    const busEntity = this.busPayloadManager?.getBusEntity();

    // 위성 엔티티가 있고 궤도 위치를 구할 수 있으면, 먼저 해당 궤도 위치에 위성 배치 (POC 방식: ECEF 속도 벡터로 X축 정렬)
    if (result && this.busPayloadManager && busEntity) {
      this.busPayloadManager.updatePosition({
        longitude: result.longitude,
        latitude: result.latitude,
        altitude: result.altitude,
      });
      this.busPayloadManager.setVelocityDirectionEcef(result.velocityEcef.x, result.velocityEcef.y, result.velocityEcef.z);

      // 시뮬레이션 기본 활성화: TLE 생성 및 루프 시작
      const parsed = this.getElementsAndEpochTimeFromForm();
      if (parsed && this.simulationEnabled) {
        this.currentTLE = orbitalElementsToTLE(parsed.elements, parsed.epochTime, 'Orbit6Elements', 99999);
        this.startSimulationLoop();
      }
    }

    // 궤도 경로 그리기
    this.drawOrbitPath();

    if (result) {
      this.updatePassDirectionDisplay(result.passDirection);
      const position = Cesium.Cartesian3.fromDegrees(
        result.longitude,
        result.latitude,
        result.altitude
      );
      flyToPosition(this.viewer, position);
      return;
    }

    if (busEntity) {
      setupCameraAngle(this.viewer, busEntity);
      return;
    }

    if (this.viewer.camera._flight && this.viewer.camera._flight.isActive()) {
      this.viewer.camera.cancelFlight();
    }
    this.viewer.trackedEntity = undefined;
    this.viewer.camera.flyHome(0);
  }

  /**
   * 현재 폼 값으로 궤도 6요소·epoch 시각을 구성해 해당 시각의 위치 반환 (실패 시 null)
   */
  private getOrbitPositionFromForm(): PositionAndVelocityAtEpoch | null {
    const parsed = this.getElementsAndEpochTimeFromForm();
    if (!parsed) return null;
    return getPositionAndVelocityAtEpoch(parsed.elements, parsed.epochTime);
  }

  /**
   * 폼에서 궤도 6요소와 초기 시각(epoch)을 읽어 반환. 유효하지 않으면 null.
   */
  private getElementsAndEpochTimeFromForm(): { elements: OrbitalElements; epochTime: Cesium.JulianDate } | null {
    const root = this.container || document;
    const semiMajorAxis = parseFloat(
      (root.querySelector('#prototypeOrbitSemiMajorAxis') as HTMLInputElement)?.value || '6878.137'
    );
    const eccentricity = parseFloat(
      (root.querySelector('#prototypeOrbitEccentricity') as HTMLInputElement)?.value || '0.0'
    );
    if (semiMajorAxis < 6378.137 || eccentricity < 0 || eccentricity >= 1) {
      return null;
    }
    const inclination = parseFloat(
      (root.querySelector('#prototypeOrbitInclination') as HTMLInputElement)?.value || '98.0'
    );
    const raan = parseFloat(
      (root.querySelector('#prototypeOrbitRAAN') as HTMLInputElement)?.value || '0.0'
    );
    const argumentOfPerigee = parseFloat(
      (root.querySelector('#prototypeOrbitArgumentOfPerigee') as HTMLInputElement)?.value || '0.0'
    );
    const anomalyType = (root.querySelector('#prototypeOrbitAnomalyType') as HTMLSelectElement)?.value || 'true';
    const anomaly = parseFloat(
      (root.querySelector('#prototypeOrbitAnomaly') as HTMLInputElement)?.value || '0.0'
    );
    const elements: OrbitalElements = {
      semiMajorAxis,
      eccentricity,
      inclination,
      raan,
      argumentOfPerigee,
    };
    if (anomalyType === 'true') {
      elements.trueAnomaly = anomaly;
    } else {
      elements.meanAnomaly = anomaly;
    }
    const initialTimeStr = (root.querySelector('#prototypeOrbitInitialTime') as HTMLInputElement)?.value?.trim();
    const initialTimeValid = initialTimeStr !== undefined && initialTimeStr !== '' && !Number.isNaN(new Date(initialTimeStr).getTime());
    const epochTime = initialTimeValid
      ? Cesium.JulianDate.fromDate(new Date(initialTimeStr!))
      : this.viewer?.clock?.currentTime ?? Cesium.JulianDate.now();
    return { elements, epochTime };
  }

  /**
   * 궤도 경로 그리기
   * 시뮬레이션 시: CallbackProperty로 매 프레임 동적 계산 → 제거/재생성 없이 부드럽게 갱신 (깜빡임 방지)
   * 비시뮬레이션 시: 30분 구간 정적 경로
   */
  private drawOrbitPath(): void {
    this.clearOrbitPath();
    if (!this.viewer) return;

    const parsed = this.getElementsAndEpochTimeFromForm();
    if (!parsed) return;

    const { elements, epochTime } = parsed;

    if (this.simulationEnabled) {
      // CallbackProperty: 제거/재생성 없이 시계에 따라 궤도 경로만 갱신 → 깜빡임 없음
      const positionsProperty = new Cesium.CallbackProperty(() => {
        const centerTime = this.viewer?.clock?.currentTime ?? epochTime;
        return calculateOrbitPathCentered(elements, epochTime, centerTime, 4, 5);
      }, false);

      this.orbitPathEntity = this.viewer.entities.add({
        name: '궤도 경로 (4시간, poc 방식)',
        polyline: {
          positions: positionsProperty,
          width: 4,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.ORANGE.withAlpha(0.7),
          }),
          clampToGround: false,
          arcType: Cesium.ArcType.GEODESIC,
          show: true,
        },
      });
    } else {
      const durationHours = 0.5;
      const sampleIntervalMinutes = 1 / 6;
      const positions = calculateOrbitPath(elements, epochTime, durationHours, sampleIntervalMinutes);
      if (positions.length === 0) return;

      this.orbitPathEntity = this.viewer.entities.add({
        name: '위성 진행 30분 경로 (참고용)',
        polyline: {
          positions: positions,
          width: 2,
          material: Cesium.Color.ORANGE.withAlpha(0.9),
          clampToGround: false,
          arcType: Cesium.ArcType.NONE,
          show: true,
        },
      });
    }
  }

  private clearOrbitPath(): void {
    if (this.orbitPathEntity && this.viewer) {
      this.viewer.entities.remove(this.orbitPathEntity);
      this.orbitPathEntity = null;
    }
  }

  /**
   * TLE로부터 특정 시각의 위치·속도 계산 (satellite.js SGP4)
   */
  private getPositionFromTLE(
    tleText: string,
    time: Cesium.JulianDate
  ): { longitude: number; latitude: number; altitude: number; velocityEcef: { x: number; y: number; z: number } } | null {
    const sat = (window as any).satellite;
    if (!sat) return null;
    try {
      const lines = tleText.trim().split('\n');
      const line1 = lines.length >= 2 ? lines[lines.length - 2] : lines[0];
      const line2 = lines.length >= 2 ? lines[lines.length - 1] : lines[1];
      const satrec = sat.twoline2satrec(line1, line2);
      const date = Cesium.JulianDate.toDate(time);
      const posVel = sat.propagate(satrec, date);
      if (posVel.error) return null;
      const gmst = sat.gstime(date);
      const geodetic = sat.eciToGeodetic(posVel.position, gmst);
      const longitude = sat.degreesLong(geodetic.longitude);
      const latitude = sat.degreesLat(geodetic.latitude);
      const altitude = geodetic.height * 1000; // km → m

      // ECI 속도 → ECEF 속도 (지구 자전 보정)
      const EARTH_OMEGA = 7.292115e-5; // rad/s
      const cosG = Math.cos(gmst);
      const sinG = Math.sin(gmst);
      const rx = posVel.position.x;
      const ry = posVel.position.y;
      const rz = posVel.position.z;
      const vx = posVel.velocity.x;
      const vy = posVel.velocity.y;
      const vz = posVel.velocity.z;
      const rEcefX = rx * cosG + ry * sinG;
      const rEcefY = -rx * sinG + ry * cosG;
      const vRotX = vx * cosG + vy * sinG;
      const vRotY = -vx * sinG + vy * cosG;
      const vEcefX = vRotX + EARTH_OMEGA * rEcefY;
      const vEcefY = vRotY - EARTH_OMEGA * rEcefX;
      const vEcefZ = vz;
      const mag = Math.sqrt(vEcefX * vEcefX + vEcefY * vEcefY + vEcefZ * vEcefZ);
      const velocityEcef =
        mag > 1e-10
          ? { x: vEcefX / mag, y: vEcefY / mag, z: vEcefZ / mag }
          : { x: vEcefX, y: vEcefY, z: vEcefZ };

      return { longitude, latitude, altitude, velocityEcef };
    } catch {
      return null;
    }
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

    // 뷰어 시계를 epoch에 맞춰 궤도와 위성이 동일 시점에서 시작
    const parsed = this.getElementsAndEpochTimeFromForm();
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
      const pos = this.getPositionFromTLE(this.currentTLE, currentTime);
      if (pos) {
        // 위치를 먼저 업데이트한 뒤 속도 방향(진행 방향) 설정 (순서 중요)
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
      // 궤도 경로는 CallbackProperty로 매 프레임 자동 갱신 → 별도 drawOrbitPath 호출 불필요
    };
    this.viewer.scene.postRender.addEventListener(this.postRenderHandler);
    this.drawOrbitPath();

    // 즉시 위성 위치 업데이트 (첫 프레임 대기 없이 궤도 위에 배치)
    const currentTime = this.viewer.clock.currentTime;
    const pos = this.getPositionFromTLE(this.currentTLE!, currentTime);
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
   * 궤도 6요소·초기 시각으로 해당 시각의 위치에 위성 배치 (진행방향 = 위성 X축)
   * 궤도선은 그리지 않음.
   * @param showAlert - alert를 표시할지 여부 (기본값: true)
   */
  private applyOrbitToSatellite(showAlert: boolean = true): void {
    if (!this.viewer) {
      if (showAlert) {
        alert('Cesium 뷰어가 초기화되지 않았습니다.');
      }
      return;
    }

    if (!this.busPayloadManager || !this.busPayloadManager.getBusEntity()) {
      if (showAlert) {
        alert('위성 설정 탭에서 먼저 위성을 생성해주세요.');
      }
      return;
    }

    try {
      const root = this.container || document;
      const semiMajorAxis = parseFloat(
        (root.querySelector('#prototypeOrbitSemiMajorAxis') as HTMLInputElement)?.value || '6878.137'
      );
      const eccentricity = parseFloat(
        (root.querySelector('#prototypeOrbitEccentricity') as HTMLInputElement)?.value || '0.0'
      );
      const inclination = parseFloat(
        (root.querySelector('#prototypeOrbitInclination') as HTMLInputElement)?.value || '98.0'
      );
      const raan = parseFloat(
        (root.querySelector('#prototypeOrbitRAAN') as HTMLInputElement)?.value || '0.0'
      );
      const argumentOfPerigee = parseFloat(
        (root.querySelector('#prototypeOrbitArgumentOfPerigee') as HTMLInputElement)?.value || '0.0'
      );
      const anomalyType = (root.querySelector('#prototypeOrbitAnomalyType') as HTMLSelectElement)?.value || 'true';
      const anomaly = parseFloat(
        (root.querySelector('#prototypeOrbitAnomaly') as HTMLInputElement)?.value || '0.0'
      );

      if (semiMajorAxis < 6378.137) {
        if (showAlert) {
          alert('긴반지름은 지구 반지름(6378.137km)보다 커야 합니다.');
        }
        return;
      }
      if (eccentricity < 0 || eccentricity >= 1) {
        if (showAlert) {
          alert('이심률은 0 이상 1 미만이어야 합니다.');
        }
        return;
      }

      const elements: OrbitalElements = {
        semiMajorAxis,
        eccentricity,
        inclination,
        raan,
        argumentOfPerigee,
      };
      if (anomalyType === 'true') {
        elements.trueAnomaly = anomaly;
      } else {
        elements.meanAnomaly = anomaly;
      }

      const initialTimeStr = (root.querySelector('#prototypeOrbitInitialTime') as HTMLInputElement)?.value?.trim();
      const initialTimeValid = initialTimeStr !== undefined && initialTimeStr !== '' && !Number.isNaN(new Date(initialTimeStr).getTime());
      const epochTime = initialTimeValid
        ? Cesium.JulianDate.fromDate(new Date(initialTimeStr!))
        : this.viewer.clock.currentTime;

      const result = getPositionAndVelocityAtEpoch(elements, epochTime);
      if (!result) {
        if (showAlert) {
          alert('해당 시각의 궤도 위치·속도 계산에 실패했습니다.');
        }
        return;
      }

      this.busPayloadManager.setVelocityDirectionEcef(result.velocityEcef.x, result.velocityEcef.y, result.velocityEcef.z);
      this.busPayloadManager.updatePosition({
        longitude: result.longitude,
        latitude: result.latitude,
        altitude: result.altitude,
      });

      // 궤도 6요소에서 TLE 생성 (시뮬레이션용, satellite.js SGP4 전파)
      this.currentTLE = orbitalElementsToTLE(elements, epochTime, 'Orbit6Elements', 99999);
      if (this.currentTLE) {
        console.log('[OrbitSettings] TLE 생성 완료:\n', this.currentTLE);
      }

      // 궤도 경로 그리기
      this.drawOrbitPath();

      // 시뮬레이션이 활성화되어 있으면 루프 시작
      const simCheck = (this.container || document).querySelector('#prototypeOrbitSimulationEnabled') as HTMLInputElement;
      if (simCheck?.checked) {
        this.simulationEnabled = true;
        this.startSimulationLoop();
      }

      // 궤도 변경 시 카메라도 새 위치로 이동
      const position = Cesium.Cartesian3.fromDegrees(
        result.longitude,
        result.latitude,
        result.altitude
      );
      flyToPosition(this.viewer, position);

      this.updatePassDirectionDisplay(result.passDirection);

      const periodHours = calculateOrbitalPeriod(semiMajorAxis);
      console.log(`[OrbitSettings] 위성 배치 완료: (${result.longitude.toFixed(4)}°, ${result.latitude.toFixed(4)}°), 고도 ${(result.altitude / 1000).toFixed(2)} km, ${result.passDirection}, 진행방향=X축`);
      if (showAlert) {
        alert(`해당 시각의 궤도 위치에 위성을 배치했습니다.\n진행 방향이 위성 X축과 일치합니다.\n궤도 주기: ${periodHours.toFixed(2)}시간`);
      }
    } catch (error: any) {
      console.error('[OrbitSettings] 위성 배치 오류:', error);
      if (showAlert) {
        alert('위성 배치 실패: ' + error.message);
      }
    }
  }

  /**
   * 진행 방향(Ascending/Descending) 표시 업데이트
   */
  private updatePassDirectionDisplay(passDirection: 'ascending' | 'descending'): void {
    const root = this.container || document;
    const el = root.querySelector('#prototypeOrbitPassDirection') as HTMLElement;
    if (el) {
      const label = passDirection === 'ascending' ? 'Ascending (남→북)' : 'Descending (북→남)';
      el.textContent = `진행 방향: ${label}`;
    }
  }

  /**
   * Cleanup orbit settings
   */
  cleanup(): void {
    if (this.updateDebounceTimer !== null) {
      clearTimeout(this.updateDebounceTimer);
      this.updateDebounceTimer = null;
    }
    this.stopSimulationLoop();
    this.clearOrbitPath();
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.viewer = null;
    this.busPayloadManager = null;
  }
}