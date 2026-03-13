/**
 * SAR 타겟 그리드를 중심점+방위각 기준으로 WGS84 좌표로 변환
 * Cesium Entity 그리기용 꼭짓점/격자점 계산
 */

import type { SarRangeParams, SarAzimuthParams } from './sar-target-calculator.js';

export interface LonLat {
  longitude_deg: number;
  latitude_deg: number;
}

/**
 * 그리드 기하학적 중심의 WGS84 (lon, lat).
 * 오프셋/스페이싱을 반영해 실제 그려지는 폴리곤 중심과 일치.
 */
export function computeGridCenterLonLat(
  center_lon_deg: number,
  center_lat_deg: number,
  heading_deg: number,
  range_params: SarRangeParams,
  azimuth_params: SarAzimuthParams
): LonLat {
  const along_center_km =
    azimuth_params.offset_km +
    ((azimuth_params.count - 1) * azimuth_params.spacing_km) / 2;
  const cross_center_km =
    range_params.offset_km +
    ((range_params.count - 1) * range_params.spacing_km) / 2;
  return offsetKmToLonLat(
    center_lon_deg,
    center_lat_deg,
    heading_deg,
    along_center_km,
    cross_center_km
  );
}

/**
 * 그리드 4꼭짓점 (폴리곤용) WGS84 [lon, lat] 반환.
 * 첫/끝 샘플에서 반 스페이싱(±spacing/2)만큼 확장해, 마지막 점까지 한 칸(Spacing)이 온전히 범위에 포함되도록 함.
 * 순서: (azimuth_min, range_min) -> (azimuth_max, range_min) -> (azimuth_max, range_max) -> (azimuth_min, range_max)
 */
export function computeGridCornersLonLat(
  center_lon_deg: number,
  center_lat_deg: number,
  heading_deg: number,
  range_params: SarRangeParams,
  azimuth_params: SarAzimuthParams
): LonLat[] {
  const half_r = range_params.spacing_km / 2;
  const half_a = azimuth_params.spacing_km / 2;
  const az_min =
    azimuth_params.offset_km - half_a;
  const az_max =
    azimuth_params.offset_km +
    (azimuth_params.count - 1) * azimuth_params.spacing_km +
    half_a;
  const r_min = range_params.offset_km - half_r;
  const r_max =
    range_params.offset_km +
    (range_params.count - 1) * range_params.spacing_km +
    half_r;

  const corners_km: [number, number][] = [
    [az_min, r_min],
    [az_max, r_min],
    [az_max, r_max],
    [az_min, r_max],
  ];

  return corners_km.map(([along_km, cross_km]) =>
    offsetKmToLonLat(
      center_lon_deg,
      center_lat_deg,
      heading_deg,
      along_km,
      cross_km
    )
  );
}

/**
 * 모든 격자점 (range_index, azimuth_index)에 대한 WGS84 좌표 배열.
 */
export function computeAllGridPointsLonLat(
  center_lon_deg: number,
  center_lat_deg: number,
  heading_deg: number,
  range_params: SarRangeParams,
  azimuth_params: SarAzimuthParams
): LonLat[] {
  const points: LonLat[] = [];
  for (let az_i = 0; az_i < azimuth_params.count; az_i++) {
    for (let rng_i = 0; rng_i < range_params.count; rng_i++) {
      const along_km =
        azimuth_params.offset_km + az_i * azimuth_params.spacing_km;
      const cross_km =
        range_params.offset_km + rng_i * range_params.spacing_km;
      points.push(
        offsetKmToLonLat(
          center_lon_deg,
          center_lat_deg,
          heading_deg,
          along_km,
          cross_km
        )
      );
    }
  }
  return points;
}

/**
 * 중심점(경위도) + 방위각(0=북, 90=동) + along_km/cross_km -> WGS84 (lon, lat)
 * ENU: along = 방위각 방향, cross = 오른쪽 90°
 * 방향선(along-track / cross-track) 끝점 계산용으로 export.
 */
export function alongCrossKmToLonLat(
  center_lon_deg: number,
  center_lat_deg: number,
  heading_deg: number,
  along_km: number,
  cross_km: number
): LonLat {
  return offsetKmToLonLat(
    center_lon_deg,
    center_lat_deg,
    heading_deg,
    along_km,
    cross_km
  );
}

export function offsetKmToLonLat(
  center_lon_deg: number,
  center_lat_deg: number,
  heading_deg: number,
  along_km: number,
  cross_km: number
): LonLat {
  const h_rad = (heading_deg * Math.PI) / 180;
  const east_m =
    (along_km * Math.sin(h_rad) + cross_km * Math.cos(h_rad)) * 1000;
  const north_m =
    (along_km * Math.cos(h_rad) - cross_km * Math.sin(h_rad)) * 1000;

  const center_cartesian = Cesium.Cartesian3.fromDegrees(
    center_lon_deg,
    center_lat_deg,
    0
  );
  const ellipsoid = Cesium.Ellipsoid.WGS84;
  const enu_to_fixed = Cesium.Transforms.eastNorthUpToFixedFrame(
    center_cartesian,
    ellipsoid
  );
  const local_offset = new Cesium.Cartesian3(east_m, north_m, 0);
  const fixed_cartesian = Cesium.Matrix4.multiplyByPoint(
    enu_to_fixed,
    local_offset,
    new Cesium.Cartesian3()
  );
  const cartographic = Cesium.Cartographic.fromCartesian(fixed_cartesian);

  return {
    longitude_deg: (Cesium.Math.toDegrees(cartographic.longitude)),
    latitude_deg: (Cesium.Math.toDegrees(cartographic.latitude)),
  };
}
