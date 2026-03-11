/**
 * 궤도 경로 폴리라인 그리기/제거 관리
 */

import { orbitalElementsToTLE } from './orbital-elements-to-tle.js';
import {
  getOrbitPathPositionsFromTLE,
  getOrbitPathPositionsFromSatrec,
  parseTleToSatrec,
  type Satrec,
} from './tle-position-util.js';
import type { ParsedOrbitForm } from './orbit-form-parser.js';

export interface OrbitPathManagerOptions {
  /** Cesium 뷰어 */
  viewer: any;
  /** 폼 파싱 결과를 반환하는 함수 */
  getParsedForm: () => ParsedOrbitForm | null;
}

/** 궤도선 캐시: centerTime(ms) 기준 10초 이상 변경 시 재계산 */
const ORBIT_CACHE_THRESHOLD_SEC = 10;

/**
 * 궤도 경로 엔티티를 관리하는 클래스 (현재 위성 위치 기준 30분 궤도선)
 */
export class OrbitPathManager {
  private viewer: any;
  private getParsedForm: () => ParsedOrbitForm | null;
  private orbitPathEntity: any = null;
  private cachedCenterTimeMs: number | null = null;
  private cachedPositions: Cesium.Cartesian3[] = [];
  private cachedSatrec: Satrec | null = null;
  private recalcScheduled = false;

  constructor(options: OrbitPathManagerOptions) {
    this.viewer = options.viewer;
    this.getParsedForm = options.getParsedForm;
  }

  /**
   * 궤도 경로 그리기 (현재 시뮬레이션 시간 기준, TLE/SGP4, 30분 구간)
   */
  draw(): void {
    this.clear();
    if (!this.viewer) return;

    const parsed = this.getParsedForm();
    if (!parsed) return;

    const { elements, epochTime } = parsed;
    const tle = orbitalElementsToTLE(elements, epochTime, 'Orbit6Elements', 99999);
    if (!tle) return;

    const centerTime = this.viewer.clock.currentTime;
    const centerTimeMs = Cesium.JulianDate.toDate(centerTime).getTime();
    const satrec = parseTleToSatrec(tle);
    if (!satrec) return;
    const positions = getOrbitPathPositionsFromSatrec(satrec, centerTime, 0.5, 2 / 60);
    if (positions.length === 0) return;

    this.cachedSatrec = satrec;
    this.cachedCenterTimeMs = centerTimeMs;
    this.cachedPositions = positions;

    const self = this;
    this.orbitPathEntity = this.viewer.entities.add({
      name: '궤도 경로 (TLE/SGP4, 30분)',
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          if (!self.viewer?.clock || !self.cachedSatrec) return self.cachedPositions;
          const currentTime = self.viewer.clock.currentTime;
          const currentMs = Cesium.JulianDate.toDate(currentTime).getTime();
          const diffSec = Math.abs(currentMs - (self.cachedCenterTimeMs ?? 0)) / 1000;
          if (self.cachedCenterTimeMs !== null && diffSec < ORBIT_CACHE_THRESHOLD_SEC) {
            return self.cachedPositions;
          }
          if (!self.recalcScheduled) {
            self.recalcScheduled = true;
            const satrec = self.cachedSatrec;
            requestAnimationFrame(() => {
              if (!satrec || !self.viewer) {
                self.recalcScheduled = false;
                return;
              }
              const t = self.viewer.clock.currentTime;
              const positions = getOrbitPathPositionsFromSatrec(satrec, t, 0.5, 2 / 60);
              if (positions.length > 0) {
                self.cachedCenterTimeMs = Cesium.JulianDate.toDate(t).getTime();
                self.cachedPositions = positions;
              }
              self.recalcScheduled = false;
              self.viewer.scene.requestRender();
            });
          }
          return self.cachedPositions;
        }, false),
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
    this.cachedCenterTimeMs = null;
    this.cachedPositions = [];
    this.cachedSatrec = null;
    this.recalcScheduled = false;
  }
}
