/**
 * 궤도 경로 폴리라인 그리기/제거 관리
 */

import { orbitalElementsToTLE } from './orbital-elements-to-tle.js';
import { getOrbitPathPositionsFromTLE } from './tle-position-util.js';
import type { ParsedOrbitForm } from './orbit-form-parser.js';

export interface OrbitPathManagerOptions {
  /** Cesium 뷰어 */
  viewer: any;
  /** 폼 파싱 결과를 반환하는 함수 */
  getParsedForm: () => ParsedOrbitForm | null;
}

/**
 * 궤도 경로 엔티티를 관리하는 클래스 (항상 30분 궤도선)
 */
export class OrbitPathManager {
  private viewer: any;
  private getParsedForm: () => ParsedOrbitForm | null;
  private orbitPathEntity: any = null;

  constructor(options: OrbitPathManagerOptions) {
    this.viewer = options.viewer;
    this.getParsedForm = options.getParsedForm;
  }

  /**
   * 궤도 경로 그리기 (TLE 기반, satellite.js SGP4, 30분 구간)
   */
  draw(): void {
    this.clear();
    if (!this.viewer) return;

    const parsed = this.getParsedForm();
    if (!parsed) return;

    const { elements, epochTime } = parsed;
    const tle = orbitalElementsToTLE(elements, epochTime, 'Orbit6Elements', 99999);
    if (!tle) return;

    const centerTime = epochTime;
    // 샘플 간격 2초 - 궤도선 촘촘히
    const positions = getOrbitPathPositionsFromTLE(tle, centerTime, 0.5, 2 / 60);
    if (positions.length === 0) return;

    this.orbitPathEntity = this.viewer.entities.add({
      name: '궤도 경로 (TLE/SGP4, 30분)',
      polyline: {
        positions: positions,
        width: 2,
        material: Cesium.Color.ORANGE.withAlpha(0.9),
        clampToGround: false,
        arcType: Cesium.ArcType.NONE, // 3D 직선 - 위성 궤도와 일치
        show: true,
      },
    });
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
