import {
  calculateOrbitPath,
  calculateOrbitalPeriod,
  getPositionAndVelocityAtEpoch,
  computeTimeOverPosition,
  type OrbitalElements,
  type PositionAndVelocityAtEpoch,
} from './_util/orbit-calculator.js';
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
  /** 현재 위성 진행 30분 구간 궤도 경로 폴리라인 (XYZ 축 참고용) */
  private orbitPathEntity: any;

  constructor() {
    this.container = null;
    this.viewer = null;
    this.busPayloadManager = null;
    this.updateDebounceTimer = null;
    this.orbitPathEntity = null;
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
      this.busPayloadManager.setVelocityDirectionEcef(result.velocityEcef.x, result.velocityEcef.y, result.velocityEcef.z);
      this.busPayloadManager.updatePosition({
        longitude: result.longitude,
        latitude: result.latitude,
        altitude: result.altitude,
      });
    }

    // 진행 30분 궤도 경로 그리기 (XYZ 축 참고용)
    this.drawOrbitPath30Min();

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
    this.viewer.camera.flyHome(1.5);
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
   * 현재 위성 진행 30분 구간 궤도 경로만 그림 (XYZ 축·진행방향 참고용)
   */
  private drawOrbitPath30Min(): void {
    this.clearOrbitPath();
    if (!this.viewer) return;

    const parsed = this.getElementsAndEpochTimeFromForm();
    if (!parsed) return;

    const { elements, epochTime } = parsed;
    const durationHours = 0.5; // 30분
    const sampleIntervalMinutes = 1 / 6; // 10초 간격 (181점) — 줌인해도 보이는 구간에 점이 많아 곡선으로 보임
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

  private clearOrbitPath(): void {
    if (this.orbitPathEntity && this.viewer) {
      this.viewer.entities.remove(this.orbitPathEntity);
      this.orbitPathEntity = null;
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

      // 진행 30분 궤도 경로 그리기 (XYZ 축 참고용)
      this.drawOrbitPath30Min();

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
    this.clearOrbitPath();
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.viewer = null;
    this.busPayloadManager = null;
  }
}