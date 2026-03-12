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
  /** 궤도 입력값 변경 시 호출 (debounced) */
  onOrbitChange: () => void;
  /** 궤도 및 시각 적용 버튼 클릭 시 호출 */
  onApplyOrbit?: () => void;
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

  // 초기 날짜 (UTC) - 선택한 날짜의 00:00 UTC부터 시작
  const initialDateWrapper = document.createElement('div');
  initialDateWrapper.lang = 'en-US';
  initialDateWrapper.style.marginTop = '10px';
  const initialDateLabel = document.createElement('label');
  initialDateLabel.style.display = 'block';
  initialDateLabel.textContent = 'Initial Date (UTC):';
  const initialDateInput = document.createElement('input');
  initialDateInput.type = 'date';
  initialDateInput.id = ORBIT_FORM_IDS.INITIAL_TIME;
  const d = defaultInitialDate;
  initialDateInput.value =
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  initialDateLabel.appendChild(initialDateInput);
  initialDateWrapper.appendChild(initialDateLabel);
  form.appendChild(initialDateWrapper);

  createInputField(
    form,
    'a - Semi-major Axis (km):',
    ORBIT_FORM_IDS.SEMI_MAJOR_AXIS,
    String(RADARSAT_RCM.semiMajorAxis),
    '100',
    '50000',
    '0.1'
  );

  createInputField(
    form,
    'e - Eccentricity:',
    ORBIT_FORM_IDS.ECCENTRICITY,
    String(RADARSAT_RCM.eccentricity),
    '0',
    '1',
    '0.0001'
  );

  createInputField(
    form,
    'i - Inclination (deg):',
    ORBIT_FORM_IDS.INCLINATION,
    String(RADARSAT_RCM.inclination),
    '0',
    '180',
    '0.1'
  );

  createInputField(
    form,
    'Ω - RAAN (deg):',
    ORBIT_FORM_IDS.RAAN,
    String(RADARSAT_RCM.raan),
    '0',
    '360',
    '0.1'
  );

  createInputField(
    form,
    'ω - Argument of Perigee (deg):',
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
  anomalyTypeLabel.textContent = 'Anomaly Type:';

  const anomalyTypeSelect = document.createElement('select');
  anomalyTypeSelect.id = ORBIT_FORM_IDS.ANOMALY_TYPE;
  anomalyTypeSelect.style.width = '100%';
  anomalyTypeSelect.style.marginTop = '4px';
  anomalyTypeSelect.style.padding = '4px';

  const trueAnomalyOption = document.createElement('option');
  trueAnomalyOption.value = 'true';
  trueAnomalyOption.textContent = 'ν (True Anomaly)';
  anomalyTypeSelect.appendChild(trueAnomalyOption);

  const meanAnomalyOption = document.createElement('option');
  meanAnomalyOption.value = 'mean';
  meanAnomalyOption.textContent = 'M (Mean Anomaly)';
  meanAnomalyOption.selected = true;
  anomalyTypeSelect.appendChild(meanAnomalyOption);

  anomalyTypeLabel.appendChild(anomalyTypeSelect);
  form.appendChild(anomalyTypeLabel);

  createInputField(
    form,
    'ν or M - Anomaly (deg):',
    ORBIT_FORM_IDS.ANOMALY,
    String(RADARSAT_RCM.meanAnomaly ?? 0),
    '0',
    '360',
    '0.1'
  );

  // 진행 방향 표시
  const passDirectionLabel = document.createElement('div');
  passDirectionLabel.id = 'prototypeOrbitPassDirection';
  passDirectionLabel.style.marginTop = '12px';
  passDirectionLabel.style.padding = '8px';
  passDirectionLabel.style.background = 'rgba(0,0,0,0.2)';
  passDirectionLabel.style.borderRadius = '4px';
  passDirectionLabel.style.fontSize = '13px';
  passDirectionLabel.textContent = 'Pass Direction: -';
  form.appendChild(passDirectionLabel);

  // 궤도 및 시각 적용 버튼
  const applyButton = document.createElement('button');
  applyButton.textContent = 'Apply Orbit & Date';
  applyButton.className = 'sidebar-section-apply-orbit';
  applyButton.style.marginTop = '16px';
  applyButton.style.width = '100%';
  applyButton.style.padding = '10px';
  applyButton.style.cursor = 'pointer';
  if (callbacks.onApplyOrbit) {
    applyButton.addEventListener('click', callbacks.onApplyOrbit);
  }
  form.appendChild(applyButton);

  // Generated TLE 섹션
  const tleSection = document.createElement('div');
  tleSection.style.marginTop = '16px';
  tleSection.style.paddingTop = '12px';
  tleSection.style.borderTop = '1px solid rgba(255,255,255,0.15)';
  const tleLabel = document.createElement('label');
  tleLabel.style.display = 'block';
  tleLabel.style.marginBottom = '6px';
  tleLabel.style.fontSize = '13px';
  tleLabel.textContent = 'Generated TLE:';
  tleSection.appendChild(tleLabel);
  const tlePre = document.createElement('pre');
  tlePre.id = 'prototypeOrbitTleDisplay';
  tlePre.style.cssText = `
    margin: 0 0 8px 0;
    padding: 8px;
    font-size: 11px;
    font-family: monospace;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 4px;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 120px;
    overflow-y: auto;
    color: var(--pink-orchid, #c9a0dc);
  `;
  tlePre.textContent = 'Enter orbit values and apply to generate TLE.';
  tleSection.appendChild(tlePre);
  const copyTleBtn = document.createElement('button');
  copyTleBtn.type = 'button';
  copyTleBtn.textContent = 'Copy TLE';
  copyTleBtn.style.cssText = 'width: 100%; padding: 6px; cursor: pointer; font-size: 12px;';
  copyTleBtn.addEventListener('click', () => {
    const el = document.getElementById('prototypeOrbitTleDisplay');
    const text = el?.textContent?.trim();
    if (text && !text.startsWith('Enter orbit')) {
      navigator.clipboard.writeText(text).then(
        () => { copyTleBtn.textContent = 'Copied!'; setTimeout(() => { copyTleBtn.textContent = 'Copy TLE'; }, 1500); },
        () => { copyTleBtn.textContent = 'Copy failed'; setTimeout(() => { copyTleBtn.textContent = 'Copy TLE'; }, 1500); }
      );
    }
  });
  tleSection.appendChild(copyTleBtn);
  form.appendChild(tleSection);

  // 궤도 입력 변경 시 즉시 적용 (debounced는 OrbitSettings에서 처리)
  const orbitInputIds = [
    ORBIT_FORM_IDS.INITIAL_TIME,
    ORBIT_FORM_IDS.SEMI_MAJOR_AXIS,
    ORBIT_FORM_IDS.ECCENTRICITY,
    ORBIT_FORM_IDS.INCLINATION,
    ORBIT_FORM_IDS.RAAN,
    ORBIT_FORM_IDS.ARGUMENT_OF_PERIGEE,
    ORBIT_FORM_IDS.ANOMALY_TYPE,
    ORBIT_FORM_IDS.ANOMALY,
  ];
  orbitInputIds.forEach((id) => {
    const el = section.querySelector(`#${id}`);
    if (el) {
      el.addEventListener('input', () => callbacks.onOrbitChange());
      el.addEventListener('change', () => callbacks.onOrbitChange());
    }
  });

  section.appendChild(form);
  container.appendChild(section);
}
