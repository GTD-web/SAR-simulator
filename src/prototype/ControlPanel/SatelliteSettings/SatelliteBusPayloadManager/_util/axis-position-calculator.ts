import {
  calculateBaseAxes,
  type VelocityDirectionOptions,
} from './base-axes-calculator.js';
import { applyBusRollToAxes } from '../_ui/entity-creator.js';

export interface AxisPositionOptions extends VelocityDirectionOptions {
  /** BUS Roll 각도 (도). 있으면 축 방향에 roll 반영 */
  busRollDeg?: number;
}

/**
 * 축 위치 계산 유틸리티
 */

/**
 * 축 방향선 위치 계산
 * @param cartesian 위성의 ECEF 좌표 (Cartesian3)
 * @param axis 축 종류 ('x' | 'y' | 'z')
 * @param axisLength 축 길이
 * @param options 속도 방향(방위각/고도각 deg). busRollDeg 있으면 roll 반영
 * @returns 축 방향선의 시작점과 끝점 배열
 */
export function getAxisLinePositions(
  cartesian: any,
  axis: 'x' | 'y' | 'z',
  axisLength: number,
  options?: AxisPositionOptions
): any[] {
  if (!cartesian) {
    return [];
  }

  const baseAxes = calculateBaseAxes(cartesian, options);
  if (!baseAxes) {
    return [];
  }
  const axes = (typeof options?.busRollDeg === 'number' && options.busRollDeg !== 0)
    ? applyBusRollToAxes(baseAxes, options.busRollDeg)
    : baseAxes;

  const start = cartesian;
  let direction: any;

  switch (axis) {
    case 'x':
      direction = axes.xAxis;
      break;
    case 'y':
      direction = axes.yAxis;
      break;
    case 'z':
      direction = axes.zAxis;
      break;
    default:
      return [];
  }

  // 방향 벡터 정규화 및 스케일링
  const normalized = Cesium.Cartesian3.normalize(direction, new Cesium.Cartesian3());
  const scaled = Cesium.Cartesian3.multiplyByScalar(
    normalized,
    axisLength,
    new Cesium.Cartesian3()
  );

  // 끝점 계산
  const end = Cesium.Cartesian3.add(start, scaled, new Cesium.Cartesian3());

  return [start, end];
}

/**
 * 축 끝점 위치 계산 (레이블용)
 * @param cartesian 위성의 ECEF 좌표 (Cartesian3)
 * @param axis 축 종류 ('x' | 'y' | 'z')
 * @param axisLength 축 길이
 * @param options 속도 방향(방위각/고도각 deg). busRollDeg 있으면 roll 반영
 * @returns 축 끝점 위치 (Cartesian3)
 */
export function getAxisEndPosition(
  cartesian: any,
  axis: 'x' | 'y' | 'z',
  axisLength: number,
  options?: AxisPositionOptions
): any | undefined {
  if (!cartesian) {
    return undefined;
  }

  const baseAxes = calculateBaseAxes(cartesian, options);
  if (!baseAxes) {
    return undefined;
  }
  const axes = (typeof options?.busRollDeg === 'number' && options.busRollDeg !== 0)
    ? applyBusRollToAxes(baseAxes, options.busRollDeg)
    : baseAxes;

  const start = cartesian;
  let direction: any;

  switch (axis) {
    case 'x':
      direction = axes.xAxis;
      break;
    case 'y':
      direction = axes.yAxis;
      break;
    case 'z':
      direction = axes.zAxis;
      break;
    default:
      return undefined;
  }

  // 방향 벡터 정규화 및 스케일링
  const normalized = Cesium.Cartesian3.normalize(direction, new Cesium.Cartesian3());
  const scaled = Cesium.Cartesian3.multiplyByScalar(
    normalized,
    axisLength,
    new Cesium.Cartesian3()
  );

  // 끝점 계산
  return Cesium.Cartesian3.add(start, scaled, new Cesium.Cartesian3());
}

/** 축 타입 (임의 축 객체용) */
export interface AxesLike {
  xAxis: any;
  yAxis: any;
  zAxis: any;
}

/**
 * 주어진 중심과 축 벡터로 축 방향선 위치 계산 (안테나 등 임의 방향용)
 */
export function getAxisLinePositionsWithAxes(
  center: any,
  axes: AxesLike,
  axis: 'x' | 'y' | 'z',
  axisLength: number
): any[] {
  if (!center || !axes) {
    return [];
  }
  let direction: any;
  switch (axis) {
    case 'x':
      direction = axes.xAxis;
      break;
    case 'y':
      direction = axes.yAxis;
      break;
    case 'z':
      direction = axes.zAxis;
      break;
    default:
      return [];
  }
  const normalized = Cesium.Cartesian3.normalize(direction, new Cesium.Cartesian3());
  const scaled = Cesium.Cartesian3.multiplyByScalar(normalized, axisLength, new Cesium.Cartesian3());
  const end = Cesium.Cartesian3.add(center, scaled, new Cesium.Cartesian3());
  return [center, end];
}

/**
 * 주어진 중심과 축 벡터로 축 끝점 위치 계산 (레이블용)
 */
export function getAxisEndPositionWithAxes(
  center: any,
  axes: AxesLike,
  axis: 'x' | 'y' | 'z',
  axisLength: number
): any {
  if (!center || !axes) {
    return undefined;
  }
  let direction: any;
  switch (axis) {
    case 'x':
      direction = axes.xAxis;
      break;
    case 'y':
      direction = axes.yAxis;
      break;
    case 'z':
      direction = axes.zAxis;
      break;
    default:
      return undefined;
  }
  const normalized = Cesium.Cartesian3.normalize(direction, new Cesium.Cartesian3());
  const scaled = Cesium.Cartesian3.multiplyByScalar(normalized, axisLength, new Cesium.Cartesian3());
  return Cesium.Cartesian3.add(center, scaled, new Cesium.Cartesian3());
}
