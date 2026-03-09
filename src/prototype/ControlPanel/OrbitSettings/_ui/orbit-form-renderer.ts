/**
 * 궤도 설정 폼 UI 렌더링
 */

import type { OrbitalElements } from '../_util/orbit-calculator.js';
import { computeTimeOverPosition } from '../_util/orbit-calculator.js';
import { ORBIT_FORM_IDS } from '../_util/orbit-form-parser.js';

/** RADARSAT RCM 위성 기본값 */
const RADARSAT_RCM: OrbitalElements = {
  semiMajorAxis: 6970.1, // km (고도 592 km)
  eccentricity: 0.0001,
  inclination: 97.74,
  raan: 0,
  argumentOfPerigee: 0,
  meanAnomaly: 0,
};

export interface OrbitFormRendererCallbacks {
  /** 폼 change 시 호출 (디바운스 적용은 호출 측에서) */
  onOrbitChange: () => void;
  /** 궤도 적용 버튼 클릭 시 호출 */
  onApply: () => void;
  /** 탭 활성 여부 (change 시 업데이트 스킵용) */
  isActive: () => boolean;
  /** 업데이트 억제 종료 시각 (ms) */
  getIgnoreUpdatesUntil: () => number;
}

/**
 * 입력 필드 생성 헬퍼
 */
function createInputField(
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
 * 궤도 설정 폼을 렌더링하고 컨테이너에 추가
 */
export function renderOrbitForm(
  container: HTMLElement,
  callbacks: OrbitFormRendererCallbacks
): void {
  const section = document.createElement('div');
  section.className = 'sidebar-section';

  const form = document.createElement('div');
  form.style.marginTop = '15px';

  // 한반도(127°E, 37°N)에 가장 가까운 시각을 기본값으로 사용 (14일간 탐색)
  const refTime = Cesium.JulianDate.fromDate(new Date());
  const koreaPassTime = computeTimeOverPosition(RADARSAT_RCM, refTime);
  const defaultInitialDate = Cesium.JulianDate.toDate(koreaPassTime);

  // 초기 시각
  const initialTimeLabel = document.createElement('label');
  initialTimeLabel.style.marginTop = '10px';
  initialTimeLabel.style.display = 'block';
  initialTimeLabel.textContent = '초기 시각 (Initial Time):';
  const initialTimeInput = document.createElement('input');
  initialTimeInput.type = 'datetime-local';
  initialTimeInput.id = ORBIT_FORM_IDS.INITIAL_TIME;
  const d = defaultInitialDate;
  initialTimeInput.value =
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T` +
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  initialTimeLabel.appendChild(initialTimeInput);
  form.appendChild(initialTimeLabel);

  createInputField(
    form,
    'a - 긴반지름 (Semi-major Axis) (km):',
    ORBIT_FORM_IDS.SEMI_MAJOR_AXIS,
    String(RADARSAT_RCM.semiMajorAxis),
    '100',
    '50000',
    '0.1'
  );

  createInputField(
    form,
    'e - 이심률 (Eccentricity):',
    ORBIT_FORM_IDS.ECCENTRICITY,
    String(RADARSAT_RCM.eccentricity),
    '0',
    '1',
    '0.0001'
  );

  createInputField(
    form,
    'i - 궤도 경사각 (Inclination) (deg):',
    ORBIT_FORM_IDS.INCLINATION,
    String(RADARSAT_RCM.inclination),
    '0',
    '180',
    '0.1'
  );

  createInputField(
    form,
    'Ω - 승교점 적경 (RAAN) (deg):',
    ORBIT_FORM_IDS.RAAN,
    String(RADARSAT_RCM.raan),
    '0',
    '360',
    '0.1'
  );

  createInputField(
    form,
    'ω - 근지점 편각 (Argument of Perigee) (deg):',
    ORBIT_FORM_IDS.ARGUMENT_OF_PERIGEE,
    String(RADARSAT_RCM.argumentOfPerigee),
    '0',
    '360',
    '0.1'
  );

  // 이각 타입 선택
  const anomalyTypeLabel = document.createElement('label');
  anomalyTypeLabel.style.marginTop = '10px';
  anomalyTypeLabel.style.display = 'block';
  anomalyTypeLabel.textContent = '이각 타입 (Anomaly Type):';

  const anomalyTypeSelect = document.createElement('select');
  anomalyTypeSelect.id = ORBIT_FORM_IDS.ANOMALY_TYPE;
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
  meanAnomalyOption.selected = true;
  anomalyTypeSelect.appendChild(meanAnomalyOption);

  anomalyTypeLabel.appendChild(anomalyTypeSelect);
  form.appendChild(anomalyTypeLabel);

  createInputField(
    form,
    'ν 또는 M - 이각 (True/Mean Anomaly) (deg):',
    ORBIT_FORM_IDS.ANOMALY,
    String(RADARSAT_RCM.meanAnomaly ?? 0),
    '0',
    '360',
    '0.1'
  );

  form.addEventListener('change', () => {
    if (!callbacks.isActive()) return;
    if (Date.now() < callbacks.getIgnoreUpdatesUntil()) return;
    callbacks.onOrbitChange();
  });

  // 진행 방향 표시
  const passDirectionLabel = document.createElement('div');
  passDirectionLabel.id = 'prototypeOrbitPassDirection';
  passDirectionLabel.style.marginTop = '12px';
  passDirectionLabel.style.padding = '8px';
  passDirectionLabel.style.background = 'rgba(0,0,0,0.2)';
  passDirectionLabel.style.borderRadius = '4px';
  passDirectionLabel.style.fontSize = '13px';
  passDirectionLabel.textContent = '진행 방향: -';
  form.appendChild(passDirectionLabel);

  // 궤도 적용 버튼
  const applyButton = document.createElement('button');
  applyButton.type = 'button';
  applyButton.className = 'sidebar-section button';
  applyButton.style.width = '100%';
  applyButton.style.marginTop = '15px';
  applyButton.textContent = '궤도 적용';
  applyButton.addEventListener('click', () => callbacks.onApply());
  form.appendChild(applyButton);

  section.appendChild(form);
  container.appendChild(section);
}
