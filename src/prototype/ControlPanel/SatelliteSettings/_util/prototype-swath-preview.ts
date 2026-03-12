import { SARSwathCalculator } from '../../../../poc/utils/sar-swath-calculator.js';
import type { SwathCorners } from '../../../../poc/types/sar-swath.types.js';
import type { SatelliteBusPayloadManager } from '../SatelliteBusPayloadManager/index.js';
import { SwathMiniMapViewer } from './swath-mini-map-viewer.js';

/** Y축 지표면 접촉점 기준 swath 간격 (m) */
const SWATH_SPACING_M = 5000;

const CORNER_KEYS: Array<keyof SwathCorners> = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

/**
 * Prototype용 Swath 미리보기 - 위성 위치·속도 기반으로 Swath 4각형을 지표면에 그림
 */
export class PrototypeSwathPreview {
  private viewer: any;
  private busPayloadManager: SatelliteBusPayloadManager | null;
  private swathEntity: any;
  private beamDirectionLines: any[];
  /** 안테나 Y축 방향으로 지표면까지 일직선 */
  private antennaYAxisGroundLine: any;
  /** 우측 상단 Swath 미니맵 */
  private swathMiniMap: SwathMiniMapViewer | null;

  constructor(viewer: any, busPayloadManager: SatelliteBusPayloadManager | null) {
    this.viewer = viewer;
    this.busPayloadManager = busPayloadManager;
    this.swathEntity = null;
    this.beamDirectionLines = [];
    this.antennaYAxisGroundLine = null;
    this.swathMiniMap = null;
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
        () => !!this.busPayloadManager?.getPositionForSwath?.() && !!this.busPayloadManager?.getYAxisGroundPoint?.(),
        false
      ),
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => {
          const groundPoint = this.busPayloadManager?.getYAxisGroundPoint?.();
          const pos = this.busPayloadManager?.getPositionForSwath?.();
          if (!groundPoint || !pos) {
            return new Cesium.PolygonHierarchy(defaultPositions);
          }

          const halfSpacing = SWATH_SPACING_M / 2;
          const geometry = {
            centerLat: groundPoint.latitude,
            centerLon: groundPoint.longitude,
            heading: pos.heading,
            nearRange: -halfSpacing,
            farRange: halfSpacing,
            swathWidth: SWATH_SPACING_M,
            azimuthLength: SWATH_SPACING_M,
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
    this.createAntennaYAxisGroundLine();

    this.swathMiniMap = new SwathMiniMapViewer(this.viewer, this.busPayloadManager);
    this.swathMiniMap.init();
  }

  /**
   * 안테나 엔티티 현재 Y축 방향으로 지표면까지 일직선 생성
   */
  private createAntennaYAxisGroundLine(): void {
    if (!this.viewer || !this.busPayloadManager) return;

    this.antennaYAxisGroundLine = this.viewer.entities.add({
      name: 'PrototypeAntennaYAxisGroundLine',
      show: new Cesium.CallbackProperty(
        () => !!this.busPayloadManager?.getPositionForSwath?.(),
        false
      ),
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const antennaCartesian = this.busPayloadManager?.getAntennaCartesian?.();
          const direction = this.busPayloadManager?.getBusYAxisDirection?.();
          if (!antennaCartesian || !direction) return [];

          try {

            const cesiumAny = Cesium as any;
            const ray = new cesiumAny.Ray(antennaCartesian, direction);
            const intersection = cesiumAny.IntersectionTests?.rayEllipsoid?.(
              ray,
              Cesium.Ellipsoid.WGS84
            );

            let endPoint: any;
            if (intersection) {
              endPoint = cesiumAny.Ray?.getPoint?.(ray, intersection.start, new Cesium.Cartesian3());
            } else {
              const extendDistance = 1e6;
              endPoint = Cesium.Cartesian3.add(
                antennaCartesian,
                Cesium.Cartesian3.multiplyByScalar(direction, extendDistance, new Cesium.Cartesian3()),
                new Cesium.Cartesian3()
              );
            }
            return [antennaCartesian, endPoint];
          } catch {
            return [];
          }
        }, false),
        width: 2,
        material: Cesium.Color.CYAN.withAlpha(0.9),
        clampToGround: false,
        arcType: Cesium.ArcType.NONE,
      },
    });
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
          () => !!this.busPayloadManager?.getPositionForSwath?.() && !!this.busPayloadManager?.getYAxisGroundPoint?.(),
          false
        ),
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const antennaCartesian = this.busPayloadManager?.getAntennaCartesian?.();
            const groundPoint = this.busPayloadManager?.getYAxisGroundPoint?.();
            const pos = this.busPayloadManager?.getPositionForSwath?.();
            if (!groundPoint || !pos) return [];

            const originCartesian = antennaCartesian ?? Cesium.Cartesian3.fromDegrees(
              pos.longitude,
              pos.latitude,
              pos.altitude
            );

            const halfSpacing = SWATH_SPACING_M / 2;
            const geometry = {
              centerLat: groundPoint.latitude,
              centerLon: groundPoint.longitude,
              heading: pos.heading,
              nearRange: -halfSpacing,
              farRange: halfSpacing,
              swathWidth: SWATH_SPACING_M,
              azimuthLength: SWATH_SPACING_M,
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

    if (this.antennaYAxisGroundLine && this.viewer) {
      try {
        this.viewer.entities.remove(this.antennaYAxisGroundLine);
      } catch {
        // 무시
      }
      this.antennaYAxisGroundLine = null;
    }

    if (this.swathEntity && this.viewer) {
      try {
        this.viewer.entities.remove(this.swathEntity);
      } catch {
        // 무시
      }
      this.swathEntity = null;
    }

    if (this.swathMiniMap) {
      this.swathMiniMap.clear();
      this.swathMiniMap = null;
    }
  }

  /**
   * busPayloadManager 설정 (초기화 후 변경 시)
   */
  setBusPayloadManager(manager: SatelliteBusPayloadManager | null): void {
    this.busPayloadManager = manager;
    this.swathMiniMap?.setBusPayloadManager(manager);
  }
}
