import { SARSwathCalculator } from '../../../../poc/utils/sar-swath-calculator.js';
import type { SwathCorners } from '../../../../poc/types/sar-swath.types.js';
import type { SatelliteBusPayloadManager } from '../SatelliteBusPayloadManager/index.js';

/** POC 기본값과 동일 */
const DEFAULT_SWATH_PARAMS = {
  nearRange: 200000,
  farRange: 800000,
  swathWidth: 400000,
  azimuthLength: 50000,
};

const CORNER_KEYS: Array<keyof SwathCorners> = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

/**
 * Prototype용 Swath 미리보기 - 위성 위치·속도 기반으로 Swath 4각형을 지표면에 그림
 */
export class PrototypeSwathPreview {
  private viewer: any;
  private busPayloadManager: SatelliteBusPayloadManager | null;
  private swathEntity: any;
  private beamDirectionLines: any[];

  constructor(viewer: any, busPayloadManager: SatelliteBusPayloadManager | null) {
    this.viewer = viewer;
    this.busPayloadManager = busPayloadManager;
    this.swathEntity = null;
    this.beamDirectionLines = [];
  }

  /**
   * Swath 미리보기 엔티티 생성 (CallbackProperty로 실시간 갱신)
   */
  init(): void {
    if (!this.viewer || !this.busPayloadManager) return;

    const defaultPositions = [
      Cesium.Cartesian3.fromDegrees(0, 0, 0),
      Cesium.Cartesian3.fromDegrees(0.001, 0, 0),
      Cesium.Cartesian3.fromDegrees(0.001, 0.001, 0),
      Cesium.Cartesian3.fromDegrees(0, 0.001, 0),
    ];

    this.swathEntity = this.viewer.entities.add({
      name: 'PrototypeSwathPreview',
      show: new Cesium.CallbackProperty(
        () => !!this.busPayloadManager?.getPositionForSwath?.(),
        false
      ),
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => {
          const pos = this.busPayloadManager?.getPositionForSwath?.();
          if (!pos) {
            return new Cesium.PolygonHierarchy(defaultPositions);
          }

          const geometry = {
            centerLat: pos.latitude,
            centerLon: pos.longitude,
            heading: pos.heading,
            nearRange: DEFAULT_SWATH_PARAMS.nearRange,
            farRange: DEFAULT_SWATH_PARAMS.farRange,
            swathWidth: DEFAULT_SWATH_PARAMS.swathWidth,
            azimuthLength: DEFAULT_SWATH_PARAMS.azimuthLength,
            satelliteAltitude: pos.altitude,
          };

          try {
            const corners = SARSwathCalculator.calculateSwathCorners(geometry);
            const positions = SARSwathCalculator.cornersToCartesian(corners);
            return new Cesium.PolygonHierarchy(positions);
          } catch {
            return new Cesium.PolygonHierarchy(defaultPositions);
          }
        }, false),
        material: Cesium.Color.TRANSPARENT,
        fill: false,
        outline: true,
        outlineColor: Cesium.Color.YELLOW.withAlpha(0.8),
        outlineWidth: 3,
        classificationType: Cesium.ClassificationType.TERRAIN,
        height: 0,
        extrudedHeight: 0,
      },
    });

    this.createBeamDirectionLines();
  }

  /**
   * 위성 안테나 중심에서 Swath 4개 모서리로 연결되는 빔 방향선 생성 (POC SwathPreviewManager 참고)
   */
  private createBeamDirectionLines(): void {
    if (!this.viewer || !this.busPayloadManager) return;

    CORNER_KEYS.forEach((cornerKey, index) => {
      const lineEntity = this.viewer.entities.add({
        name: `PrototypeBeamDirectionLine_${index}`,
        show: new Cesium.CallbackProperty(
          () => !!this.busPayloadManager?.getPositionForSwath?.(),
          false
        ),
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const antennaCartesian = this.busPayloadManager?.getAntennaCartesian?.();
            const pos = this.busPayloadManager?.getPositionForSwath?.();
            if (!pos) return [];

            const originCartesian = antennaCartesian ?? Cesium.Cartesian3.fromDegrees(
              pos.longitude,
              pos.latitude,
              pos.altitude
            );

            const geometry = {
              centerLat: pos.latitude,
              centerLon: pos.longitude,
              heading: pos.heading,
              nearRange: DEFAULT_SWATH_PARAMS.nearRange,
              farRange: DEFAULT_SWATH_PARAMS.farRange,
              swathWidth: DEFAULT_SWATH_PARAMS.swathWidth,
              azimuthLength: DEFAULT_SWATH_PARAMS.azimuthLength,
              satelliteAltitude: pos.altitude,
            };

            try {
              const corners = SARSwathCalculator.calculateSwathCorners(geometry);
              const corner = corners[cornerKey];
              const cornerPosition = Cesium.Cartesian3.fromDegrees(corner[0], corner[1], 0);
              return [originCartesian, cornerPosition];
            } catch {
              return [originCartesian, originCartesian];
            }
          }, false),
          width: 1,
          material: Cesium.Color.YELLOW.withAlpha(0.8),
          clampToGround: false,
          arcType: Cesium.ArcType.NONE,
        },
      });
      this.beamDirectionLines.push(lineEntity);
    });
  }

  /**
   * Swath 미리보기 제거
   */
  clear(): void {
    this.beamDirectionLines.forEach((lineEntity) => {
      try {
        this.viewer?.entities.remove(lineEntity);
      } catch {
        // 무시
      }
    });
    this.beamDirectionLines = [];

    if (this.swathEntity && this.viewer) {
      try {
        this.viewer.entities.remove(this.swathEntity);
      } catch {
        // 무시
      }
      this.swathEntity = null;
    }
  }

  /**
   * busPayloadManager 설정 (초기화 후 변경 시)
   */
  setBusPayloadManager(manager: SatelliteBusPayloadManager | null): void {
    this.busPayloadManager = manager;
  }
}
