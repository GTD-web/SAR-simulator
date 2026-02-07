import {
  calculateOrbitPath,
  calculateOrbitalPeriod,
  computeInitialTrueAnomalyFromPosition,
  OrbitalElements,
} from './_util/orbit-calculator.js';

/**
 * OrbitSettings - Orbit settings tab management class
 */
export class OrbitSettings {
  private container: HTMLElement | null;
  private viewer: any;
  private orbitEntity: any;
  private updateDebounceTimer: number | null;

  constructor() {
    this.container = null;
    this.viewer = null;
    this.orbitEntity = null;
    this.updateDebounceTimer = null;
  }

  /**
   * Initialize orbit settings tab
   */
  initialize(container: HTMLElement, viewer?: any): void {
    this.container = container;
    this.viewer = viewer || null;
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

    // 초기 위치 / 초기 시각 (궤도 그리기 시작점) — 기본값: 서울
    const initialLatitudeInput = this.createInputField(
      form,
      '초기 위치 위도 (deg):',
      'prototypeOrbitInitialLatitude',
      '37.5665',
      '-90',
      '90',
      '0.1'
    );
    const initialLongitudeInput = this.createInputField(
      form,
      '초기 위치 경도 (deg):',
      'prototypeOrbitInitialLongitude',
      '126.978',
      '-180',
      '180',
      '0.1'
    );
    const initialTimeLabel = document.createElement('label');
    initialTimeLabel.style.marginTop = '10px';
    initialTimeLabel.style.display = 'block';
    initialTimeLabel.textContent = '초기 시각 (Initial Time):';
    const initialTimeInput = document.createElement('input');
    initialTimeInput.type = 'datetime-local';
    initialTimeInput.id = 'prototypeOrbitInitialTime';
    const now = new Date();
    initialTimeInput.value =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T` +
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    initialTimeLabel.appendChild(initialTimeInput);
    form.appendChild(initialTimeLabel);

    // RADARSAT RCM 위성 기본값
    const RADARSAT_RCM: OrbitalElements = {
      semiMajorAxis: 6970.1,         // km (고도 592 km)
      eccentricity: 0.0001,
      inclination: 97.74,
      raan: 0,
      argumentOfPerigee: 0,
      meanAnomaly: 0
    };
    
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

    // 입력 필드에 change 이벤트 추가 (자동 업데이트)
    const inputFields = [
      initialLatitudeInput.querySelector('input'),
      initialLongitudeInput.querySelector('input'),
      initialTimeInput,
      semiMajorAxisInput.querySelector('input'),
      eccentricityInput.querySelector('input'),
      inclinationInput.querySelector('input'),
      raanInput.querySelector('input'),
      argumentOfPerigeeInput.querySelector('input'),
      anomalyInput.querySelector('input'),
      anomalyTypeSelect
    ].filter(Boolean) as (HTMLInputElement | HTMLSelectElement)[];

    inputFields.forEach(input => {
      input.addEventListener('change', () => {
        this.updateOrbitDebounced();
      });
      input.addEventListener('input', () => {
        this.updateOrbitDebounced();
      });
    });


    section.appendChild(form);
    this.container.appendChild(section);

    // 초기화 시 자동으로 궤도 그리기 (alert 없이)
    if (this.viewer) {
      // Cesium 초기화 완료 대기 후 자동 그리기
      setTimeout(() => {
        this.drawOrbit(false); // 자동 그리기는 alert 표시 안 함
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
      this.drawOrbit(false); // 값 변경 시 alert 표시 안 함
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
   * 궤도 6요소로부터 궤도 경로 그리기
   * @param showAlert - alert를 표시할지 여부 (기본값: true)
   */
  private drawOrbit(showAlert: boolean = true): void {
    if (!this.viewer) {
      if (showAlert) {
        alert('Cesium 뷰어가 초기화되지 않았습니다.');
      }
      return;
    }

    try {
      // 입력값 읽기
      const semiMajorAxis = parseFloat(
        (document.getElementById('prototypeOrbitSemiMajorAxis') as HTMLInputElement)?.value || '6878.137'
      );
      const eccentricity = parseFloat(
        (document.getElementById('prototypeOrbitEccentricity') as HTMLInputElement)?.value || '0.0'
      );
      const inclination = parseFloat(
        (document.getElementById('prototypeOrbitInclination') as HTMLInputElement)?.value || '98.0'
      );
      const raan = parseFloat(
        (document.getElementById('prototypeOrbitRAAN') as HTMLInputElement)?.value || '0.0'
      );
      const argumentOfPerigee = parseFloat(
        (document.getElementById('prototypeOrbitArgumentOfPerigee') as HTMLInputElement)?.value || '0.0'
      );
      const anomalyType = (document.getElementById('prototypeOrbitAnomalyType') as HTMLSelectElement)?.value || 'true';
      const anomaly = parseFloat(
        (document.getElementById('prototypeOrbitAnomaly') as HTMLInputElement)?.value || '0.0'
      );

      // 입력값 검증
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

      // 궤도 주기 계산
      const orbitalPeriodHours = calculateOrbitalPeriod(semiMajorAxis);
      
      // 지구 표면 전체를 순회하기 위해 충분한 시간 계산
      // 지구 자전 주기(24시간)와 궤도 주기를 고려하여 여러 주기 그리기
      // 최소 24시간 이상 그리기 (지구 자전 1회)
      const durationHours = Math.max(24, orbitalPeriodHours * 2); // 최소 2주기 또는 24시간

      // 궤도 6요소 구성
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

      // 초기 위치/시간 사용 여부: 세 값이 모두 유효하면 사용
      const initialLatStr = (document.getElementById('prototypeOrbitInitialLatitude') as HTMLInputElement)?.value?.trim();
      const initialLonStr = (document.getElementById('prototypeOrbitInitialLongitude') as HTMLInputElement)?.value?.trim();
      const initialTimeStr = (document.getElementById('prototypeOrbitInitialTime') as HTMLInputElement)?.value?.trim();
      const initialLat = initialLatStr !== undefined && initialLatStr !== '' ? parseFloat(initialLatStr) : NaN;
      const initialLon = initialLonStr !== undefined && initialLonStr !== '' ? parseFloat(initialLonStr) : NaN;
      const initialTimeValid = initialTimeStr !== undefined && initialTimeStr !== '' && !Number.isNaN(new Date(initialTimeStr).getTime());
      const useInitialPosition = !Number.isNaN(initialLat) && !Number.isNaN(initialLon) && initialTimeValid;

      let startTime: any;
      if (useInitialPosition) {
        startTime = Cesium.JulianDate.fromDate(new Date(initialTimeStr!));
        const computedNu = computeInitialTrueAnomalyFromPosition(elements, initialLat, initialLon);
        if (computedNu !== null) {
          elements.trueAnomaly = computedNu;
          delete elements.meanAnomaly;
        }
      } else {
        startTime = this.viewer.clock.currentTime;
      }

      // 기존 궤도 제거
      this.clearOrbit();

      console.log(`[OrbitSettings] 궤도 그리기 시작: ${durationHours.toFixed(2)}시간 (궤도 주기: ${orbitalPeriodHours.toFixed(2)}시간)`);

      // 궤도 경로 계산 (1분 간격으로 샘플링)
      const positions = calculateOrbitPath(elements, startTime, durationHours, 1);

      if (positions.length === 0) {
        if (showAlert) {
          alert('궤도 경로 계산에 실패했습니다.');
        }
        return;
      }

      // 궤도 엔티티 생성
      this.orbitEntity = this.viewer.entities.add({
        name: '위성 궤도',
        polyline: {
          positions: positions,
          width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.CYAN.withAlpha(0.8),
          }),
          clampToGround: false,
          arcType: Cesium.ArcType.GEODESIC,
          show: true,
        },
      });

      console.log(`[OrbitSettings] 궤도 그리기 완료: ${positions.length}개 점`);
      if (showAlert) {
        alert(`궤도가 그려졌습니다.\n궤도 주기: ${orbitalPeriodHours.toFixed(2)}시간\n그린 기간: ${durationHours.toFixed(2)}시간`);
      }
    } catch (error: any) {
      console.error('[OrbitSettings] 궤도 그리기 오류:', error);
      if (showAlert) {
        alert('궤도 그리기 실패: ' + error.message);
      }
    }
  }

  /**
   * 궤도 경로 지우기
   */
  private clearOrbit(): void {
    if (this.orbitEntity && this.viewer) {
      this.viewer.entities.remove(this.orbitEntity);
      this.orbitEntity = null;
      console.log('[OrbitSettings] 궤도 제거됨');
    }
  }

  /**
   * Cleanup orbit settings
   */
  cleanup(): void {
    // 디바운스 타이머 정리
    if (this.updateDebounceTimer !== null) {
      clearTimeout(this.updateDebounceTimer);
      this.updateDebounceTimer = null;
    }
    
    this.clearOrbit();
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.viewer = null;
  }
}