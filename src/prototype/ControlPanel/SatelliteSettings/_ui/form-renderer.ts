import { createSection, createInputField } from './form-builder.js';

/**
 * 폼 렌더링 유틸리티
 */

export interface FormRendererCallbacks {
  onInputFocus?: (id: string) => void;
  onInputBlur?: (id: string) => void;
  onInputChange?: () => void;
  onCreateButtonClick?: () => void;
  onAxisToggleChange?: (checked: boolean) => void;
  onAxisLengthChange?: (length: number) => void;
  /** 속도 방위각/고도각 변경 시 (deg) */
  onVelocityDirectionChange?: (azimuthDeg: number, elevationDeg: number) => void;
}

/**
 * 위성 설정 폼 렌더링
 */
export function renderSatelliteSettingsForm(
  container: HTMLElement,
  callbacks: FormRendererCallbacks
): void {
  const section = document.createElement('div');
  section.className = 'sidebar-section';

  // Satellite settings form
  const form = document.createElement('div');

  // 위치 입력 필드 (숨겨진 상태로 생성하여 기본값 사용)
  const lonInput = createInputField(
    '경도 (도):',
    'prototypeSatelliteLongitude',
    'number',
    '-180 ~ 180',
    '127.5',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  (lonInput.querySelector('input') as HTMLInputElement).style.display = 'none';
  (lonInput as HTMLElement).style.display = 'none';

  const latInput = createInputField(
    '위도 (도):',
    'prototypeSatelliteLatitude',
    'number',
    '-90 ~ 90',
    '37.5',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  (latInput.querySelector('input') as HTMLInputElement).style.display = 'none';
  (latInput as HTMLElement).style.display = 'none';

  const altInput = createInputField(
    '고도 (km):',
    'prototypeSatelliteAltitude',
    'number',
    '0 이상',
    '50000',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  (altInput.querySelector('input') as HTMLInputElement).style.display = 'none';
  (altInput as HTMLElement).style.display = 'none';

  // 숨겨진 입력 필드를 form에 추가 (기본값 사용을 위해)
  form.appendChild(lonInput);
  form.appendChild(latInput);
  form.appendChild(altInput);

  // 속도 방향 (방위각/고도각) - BUS 설정 위
  const velocitySection = createSection('속도 방향');
  const velocitySectionTitle = velocitySection.querySelector('h4');
  if (velocitySectionTitle) {
    velocitySection.removeChild(velocitySectionTitle);
  }
  velocitySection.style.borderTop = 'none';
  velocitySection.style.paddingTop = '0';
  velocitySection.style.marginTop = '15px';

  const notifyVelocityDirection = () => {
    if (!callbacks.onVelocityDirectionChange) return;
    const azEl = document.getElementById('prototypeVelocityAzimuth') as HTMLInputElement | null;
    const elEl = document.getElementById('prototypeVelocityElevation') as HTMLInputElement | null;
    const az = azEl ? Number(azEl.value) : 0;
    const el = elEl ? Number(elEl.value) : 0;
    callbacks.onVelocityDirectionChange(az, el);
  };

  const velocityAzimuthInput = createInputField(
    '속도 방위각 (deg):',
    'prototypeVelocityAzimuth',
    'number',
    '0=동쪽, 90=북쪽',
    '0',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    () => {
      if (callbacks.onInputChange) callbacks.onInputChange();
      notifyVelocityDirection();
    }
  );
  (velocityAzimuthInput.querySelector('input') as HTMLInputElement).style.display = 'none';
  (velocityAzimuthInput as HTMLElement).style.display = 'none';
  velocitySection.appendChild(velocityAzimuthInput);

  const velocityElevationInput = createInputField(
    '속도 고도각 (deg):',
    'prototypeVelocityElevation',
    'number',
    '0=수평',
    '0',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    () => {
      if (callbacks.onInputChange) callbacks.onInputChange();
      notifyVelocityDirection();
    }
  );
  (velocityElevationInput.querySelector('input') as HTMLInputElement).style.display = 'none';
  (velocityElevationInput as HTMLElement).style.display = 'none';
  velocitySection.appendChild(velocityElevationInput);
  velocitySection.style.display = 'none';
  form.appendChild(velocitySection);

  // BUS 설정 섹션
  const busSection = createSection('BUS 설정');
  // 타이틀 제거
  const busSectionTitle = busSection.querySelector('h4');
  if (busSectionTitle) {
    busSection.removeChild(busSectionTitle);
  }
  // 첫 번째 섹션이므로 구분선 제거, 적절한 상단 간격 유지
  busSection.style.borderTop = 'none';
  busSection.style.paddingTop = '0';
  busSection.style.marginTop = '15px';
  
  const busLengthInput = createInputField(
    'BUS 길이 (mm):',
    'prototypeBusLength',
    'number',
    '예: 800',
    '800',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  busSection.appendChild(busLengthInput);

  const busWidthInput = createInputField(
    'BUS 너비 (mm):',
    'prototypeBusWidth',
    'number',
    '예: 700',
    '700',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  busSection.appendChild(busWidthInput);

  const busHeightInput = createInputField(
    'BUS 높이 (mm):',
    'prototypeBusHeight',
    'number',
    '예: 840',
    '840',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  busSection.appendChild(busHeightInput);

  const busRollInput = createInputField(
    'BUS Roll (도):',
    'prototypeBusRoll',
    'number',
    'X축 회전',
    '45',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  busSection.appendChild(busRollInput);

  const busPitchInput = createInputField(
    'BUS Pitch (도):',
    'prototypeBusPitch',
    'number',
    'Y축 회전',
    '0',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  busSection.appendChild(busPitchInput);

  const busYawInput = createInputField(
    'BUS Yaw (도):',
    'prototypeBusYaw',
    'number',
    'Z축 회전',
    '0',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  busSection.appendChild(busYawInput);

  form.appendChild(busSection);

  // 버스-안테나 간격 설정 섹션 (BUS 설정과 안테나 설정 사이)
  const gapSection = createSection('버스-안테나 간격 설정');
  const gapSectionTitle = gapSection.querySelector('h4');
  if (gapSectionTitle) {
    gapSection.removeChild(gapSectionTitle);
  }
  const antennaGapInput = createInputField(
    '버스-안테나 간격 (mm):',
    'prototypeAntennaGap',
    'number',
    '예: 100',
    '100',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  gapSection.appendChild(antennaGapInput);
  form.appendChild(gapSection);

  // 안테나 크기 설정 섹션
  const antennaSizeSection = createSection('안테나 크기 설정');
  // 타이틀 제거
  const antennaSizeSectionTitle = antennaSizeSection.querySelector('h4');
  if (antennaSizeSectionTitle) {
    antennaSizeSection.removeChild(antennaSizeSectionTitle);
  }
  
  const antennaHeightInput = createInputField(
    '안테나 높이 (mm):',
    'prototypeAntennaHeight',
    'number',
    '예: 800',
    '800',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaSizeSection.appendChild(antennaHeightInput);

  const antennaWidthInput = createInputField(
    '안테나 너비 (mm):',
    'prototypeAntennaWidth',
    'number',
    '예: 2410',
    '2410',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaSizeSection.appendChild(antennaWidthInput);

  const antennaDepthInput = createInputField(
    '안테나 두께 (mm):',
    'prototypeAntennaDepth',
    'number',
    '예: 100',
    '100',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaSizeSection.appendChild(antennaDepthInput);

  form.appendChild(antennaSizeSection);

  // 안테나 방향 파라미터 섹션
  const antennaOrientationSection = createSection('안테나 방향 파라미터');
  // 타이틀 제거
  const antennaOrientationSectionTitle = antennaOrientationSection.querySelector('h4');
  if (antennaOrientationSectionTitle) {
    antennaOrientationSection.removeChild(antennaOrientationSectionTitle);
  }
  
  const antennaRollInput = createInputField(
    'Antenna Roll Angle (도):',
    'prototypeAntennaRoll',
    'number',
    'x축 회전',
    '0',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaOrientationSection.appendChild(antennaRollInput);

  const antennaPitchInput = createInputField(
    'Antenna Pitch Angle (도):',
    'prototypeAntennaPitch',
    'number',
    'y축 회전',
    '0',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaOrientationSection.appendChild(antennaPitchInput);

  const antennaYawInput = createInputField(
    'Antenna Yaw Angle (도):',
    'prototypeAntennaYaw',
    'number',
    'z축 회전',
    '0',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaOrientationSection.appendChild(antennaYawInput);

  const antennaElevationInput = createInputField(
    'Initial Antenna Elevation Angle (도):',
    'prototypeAntennaElevation',
    'number',
    '초기 Elevation',
    '0',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaOrientationSection.appendChild(antennaElevationInput);

  const antennaAzimuthInput = createInputField(
    'Initial Antenna Azimuth Angle (도):',
    'prototypeAntennaAzimuth',
    'number',
    '초기 Azimuth',
    '0',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaOrientationSection.appendChild(antennaAzimuthInput);

  form.appendChild(antennaOrientationSection);

  // 안테나 기타 파라미터 섹션 (데이터 저장용)
  const antennaOtherSection = createSection('안테나 기타 파라미터 (데이터 저장용)');
  // 타이틀 제거
  const antennaOtherSectionTitle = antennaOtherSection.querySelector('h4');
  if (antennaOtherSectionTitle) {
    antennaOtherSection.removeChild(antennaOtherSectionTitle);
  }
  
  const beamwidthElevationInput = createInputField(
    'Beamwidth Elevation (도):',
    'prototypeBeamwidthElevation',
    'number',
    '',
    '1.0',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaOtherSection.appendChild(beamwidthElevationInput);

  const beamwidthAzimuthInput = createInputField(
    'Beamwidth Azimuth (도):',
    'prototypeBeamwidthAzimuth',
    'number',
    '',
    '1.0',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaOtherSection.appendChild(beamwidthAzimuthInput);

  const hpaInput = createInputField(
    'High Power Amp (HPA):',
    'prototypeHPA',
    'number',
    '',
    '1000',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaOtherSection.appendChild(hpaInput);

  const noiseFigureInput = createInputField(
    'Noise Figure (dB):',
    'prototypeNoiseFigure',
    'number',
    '',
    '3.0',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaOtherSection.appendChild(noiseFigureInput);

  const totalLossInput = createInputField(
    'Total Loss (dB):',
    'prototypeTotalLoss',
    'number',
    '',
    '2.0',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaOtherSection.appendChild(totalLossInput);

  const systemNoiseTempInput = createInputField(
    'System Noise Temperature:',
    'prototypeSystemNoiseTemp',
    'number',
    '',
    '290',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaOtherSection.appendChild(systemNoiseTempInput);

  const receiverGainInput = createInputField(
    'Receiver Gain (dB):',
    'prototypeReceiverGain',
    'number',
    '',
    '50',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaOtherSection.appendChild(receiverGainInput);

  const adcBitsInput = createInputField(
    'ADC Bits:',
    'prototypeADCBits',
    'number',
    '',
    '12',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaOtherSection.appendChild(adcBitsInput);

  const centerFreqInput = createInputField(
    'Center Frequency (Hz):',
    'prototypeCenterFrequency',
    'number',
    '',
    '9.65e9',
    callbacks.onInputFocus,
    callbacks.onInputBlur,
    callbacks.onInputChange
  );
  antennaOtherSection.appendChild(centerFreqInput);

  form.appendChild(antennaOtherSection);

  // 제어 버튼 섹션
  const buttonSection = document.createElement('div');
  buttonSection.style.marginTop = '20px';
  buttonSection.style.display = 'flex';
  buttonSection.style.gap = '10px';
  buttonSection.style.flexDirection = 'column';

  // 위성 엔티티 생성 버튼 (우주 공간에서 생성) - 숨김
  const createButton = document.createElement('button');
  createButton.textContent = '위성 엔티티 생성 (우주 공간)';
  createButton.style.padding = '10px';
  createButton.style.backgroundColor = '#4CAF50';
  createButton.style.color = 'white';
  createButton.style.border = 'none';
  createButton.style.borderRadius = '4px';
  createButton.style.cursor = 'pointer';
  createButton.style.display = 'none'; // 숨김 처리
  if (callbacks.onCreateButtonClick) {
    createButton.addEventListener('click', callbacks.onCreateButtonClick);
  }
  buttonSection.appendChild(createButton);

  // XYZ 축 표시/숨김 토글
  const axisToggleLabel = document.createElement('label');
  axisToggleLabel.style.display = 'flex';
  axisToggleLabel.style.alignItems = 'center';
  axisToggleLabel.style.gap = '8px';
  axisToggleLabel.style.marginTop = '10px';
  axisToggleLabel.style.cursor = 'pointer';

  const axisToggle = document.createElement('input');
  axisToggle.type = 'checkbox';
  axisToggle.id = 'prototypeAxisToggle';
  axisToggle.checked = true;
  const onAxisToggleChange = callbacks.onAxisToggleChange;
  if (onAxisToggleChange) {
    axisToggle.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      onAxisToggleChange(checked);
    });
  }

  const axisToggleText = document.createElement('span');
  axisToggleText.textContent = 'XYZ 축 표시';

  axisToggleLabel.appendChild(axisToggle);
  axisToggleLabel.appendChild(axisToggleText);
  buttonSection.appendChild(axisToggleLabel);

  // XYZ 축 길이 입력 필드
  const axisLengthInput = createInputField(
    'XYZ 축 길이 (m):',
    'prototypeAxisLength',
    'number',
    '예: 0.2',
    '0.2',
    undefined,
    undefined,
    () => {
      if (callbacks.onAxisLengthChange) {
        const value = parseFloat((document.getElementById('prototypeAxisLength') as HTMLInputElement)?.value || '0.2');
        if (!isNaN(value) && value > 0) {
          callbacks.onAxisLengthChange(value);
        }
      }
    }
  );
  axisLengthInput.style.marginTop = '15px';
  buttonSection.appendChild(axisLengthInput);

  form.appendChild(buttonSection);

  section.appendChild(form);
  container.appendChild(section);
}
