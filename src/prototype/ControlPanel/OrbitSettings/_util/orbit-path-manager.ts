/**
 * 궤도 경로 폴리라인 그리기/제거 관리
 */

import { orbitalElementsToTLE } from './orbital-elements-to-tle.js';
import { getOrbitPathPositionsFromTLE } from './tle-position-util.js';
import type { ParsedOrbitForm } from './orbit-form-parser.js';

/** 궤도선 갱신 간격 (초) - 매 프레임 갱신 시 떨림 방지 */
const ORBIT_PATH_UPDATE_INTERVAL_SECONDS = 30;

export interface OrbitPathManagerOptions {
  /** Cesium 뷰어 */
  viewer: any;
  /** 폼 파싱 결과를 반환하는 함수 */
  getParsedForm: () => ParsedOrbitForm | null;
  /** 시뮬레이션 활성화 여부 (4시간 궤도선 vs 30분 궤도선) */
  simulationEnabled: boolean;
}

/**
 * 궤도 경로 엔티티를 관리하는 클래스
 */
export class OrbitPathManager {
  private viewer: any;
  private getParsedForm: () => ParsedOrbitForm | null;
  private simulationEnabled: boolean;
  private orbitPathEntity: any = null;

  constructor(options: OrbitPathManagerOptions) {
    this.viewer = options.viewer;
    this.getParsedForm = options.getParsedForm;
    this.simulationEnabled = options.simulationEnabled;
  }

  /**
   * 시뮬레이션 활성화 여부 업데이트
   */
  setSimulationEnabled(enabled: boolean): void {
    this.simulationEnabled = enabled;
  }

  /**
   * 궤도 경로 그리기 (TLE 기반, satellite.js SGP4)
   */
  draw(): void {
    this.clear();
    if (!this.viewer) return;

    const parsed = this.getParsedForm();
    if (!parsed) return;

    const { elements, epochTime } = parsed;
    const tle = orbitalElementsToTLE(elements, epochTime, 'Orbit6Elements', 99999);
    if (!tle) return;

    if (this.simulationEnabled) {
      let lastBucket = -1;
      let cachedPositions: Cesium.Cartesian3[] = [];

      const positionsProperty = new Cesium.CallbackProperty(() => {
        const freshParsed = this.getParsedForm();
        if (!freshParsed) return cachedPositions;
        const freshTle = orbitalElementsToTLE(
          freshParsed.elements,
          freshParsed.epochTime,
          'Orbit6Elements',
          99999
        );
        if (!freshTle) return cachedPositions;
        const centerTime = this.viewer?.clock?.currentTime ?? freshParsed.epochTime;
        const totalSeconds = Cesium.JulianDate.toDate(centerTime).getTime() / 1000;
        const bucket = Math.floor(totalSeconds / ORBIT_PATH_UPDATE_INTERVAL_SECONDS);
        if (bucket !== lastBucket) {
          lastBucket = bucket;
          cachedPositions = getOrbitPathPositionsFromTLE(freshTle, centerTime, 4, 5);
        }
        return cachedPositions;
      }, false);

      this.orbitPathEntity = this.viewer.entities.add({
        name: '궤도 경로 (TLE/SGP4, 4시간)',
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
      const centerTime = epochTime;
      const positions = getOrbitPathPositionsFromTLE(tle, centerTime, 0.5, 1 / 6);
      if (positions.length === 0) return;

      this.orbitPathEntity = this.viewer.entities.add({
        name: '궤도 경로 (TLE/SGP4, 30분)',
        polyline: {
          positions: positions,
          width: 2,
          material: Cesium.Color.ORANGE.withAlpha(0.9),
          clampToGround: false,
          arcType: Cesium.ArcType.GEODESIC,
          show: true,
        },
      });
    }
  }

  /**
   * 궤도 경로 제거
   */
  clear(): void {
    if (this.orbitPathEntity && this.viewer) {
      this.viewer.entities.remove(this.orbitPathEntity);
      this.orbitPathEntity = null;
    }
  }
}
