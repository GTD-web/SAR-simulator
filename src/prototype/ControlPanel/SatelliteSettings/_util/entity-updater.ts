import { SatelliteBusPayloadManager } from '../SatelliteBusPayloadManager/index.js';
import { parseBusDimensionsInputs, parseBusOrientationInputs, parseAntennaDimensionsInputs, parseAntennaGapInput, parseAntennaOrientationInputs } from './input-parser.js';

/**
 * 엔티티 업데이트 유틸리티
 */

/**
 * 엔티티 업데이트 수행
 * 위치는 궤도 설정 등에서만 변경되므로, 폼 값 변경 시에는 현재 궤도상 엔티티 위치를 유지한다.
 */
export function updateEntity(
  busPayloadManager: SatelliteBusPayloadManager | null,
  viewer: any
): void {
  if (!busPayloadManager || !viewer) {
    return;
  }

  // 엔티티가 생성되어 있는지 확인
  const busEntity = busPayloadManager.getBusEntity();
  const antennaEntity = busPayloadManager.getAntennaEntity();
  
  if (!busEntity && !antennaEntity) {
    // 엔티티가 없으면 업데이트하지 않음
    return;
  }

  try {
    // 위치 정보는 숨겨진 입력에 기본값(50000km 등)이 있어 궤도 위치와 불일치하므로
    // 폼 값 변경 시에는 업데이트하지 않음 (현재 궤도상 엔티티 위치 유지)

    // BUS 크기 업데이트
    const busDimensions = parseBusDimensionsInputs();
    if (busDimensions) {
      busPayloadManager.updateBusDimensions(busDimensions);
    }

    // BUS 방향 업데이트
    const busOrientation = parseBusOrientationInputs();
    if (busOrientation) {
      busPayloadManager.updateBusOrientation(busOrientation);
    }

    // 안테나 크기 업데이트
    const antennaDimensions = parseAntennaDimensionsInputs();
    if (antennaDimensions) {
      busPayloadManager.updateAntennaDimensions(antennaDimensions);
    }

    // 버스-안테나 간격 업데이트
    const antennaGap = parseAntennaGapInput();
    if (antennaGap !== null) {
      busPayloadManager.updateAntennaGap(antennaGap);
    }

    // 안테나 방향 업데이트
    const antennaOrientation = parseAntennaOrientationInputs();
    if (antennaOrientation) {
      busPayloadManager.updateAntennaOrientation(antennaOrientation);
    }
  } catch (error) {
    // 입력값 파싱 오류는 무시 (사용자가 입력 중일 수 있음)
    console.debug('[SatelliteSettings] 엔티티 업데이트 중 오류 (무시됨):', error);
  }
  // 폼 값 변경 시 위치를 업데이트하지 않으므로 카메라 이동 없음 (현재 궤도상 엔티티로 유지)
}
