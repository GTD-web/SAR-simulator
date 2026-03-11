import {
  getAxisLinePositions,
  getAxisEndPosition,
  getAxisLinePositionsWithAxes,
  getAxisEndPositionWithAxes,
  type AxesLike,
  type AxisPositionOptions,
} from '../_util/axis-position-calculator.js';
import { calculateBaseAxes, type VelocityDirectionOptions } from '../_util/base-axes-calculator.js';
import { applyBusRollPitchYawToAxes } from './entity-creator.js';

/**
 * XYZ 축 엔티티 생성
 * @param getCurrentCartesian 현재 위치 getter (CallbackProperty에서 매 프레임 최신값 참조, 시뮬레이션 시 축 유지)
 * @param velocityOptions 속도 방향(방위각/고도각 deg). 없으면 기존 동작
 * @param getAxisOptions roll 포함 옵션 getter. CallbackProperty에서 호출되어 roll 변경 시 축 갱신
 */
export function createAxisEntities(
  viewer: any,
  getCurrentCartesian: () => any,
  axisLength: number,
  axisVisible: boolean,
  velocityOptions?: VelocityDirectionOptions,
  getAxisOptions?: () => AxisPositionOptions | undefined
): {
  xAxis: any;
  yAxis: any;
  zAxis: any;
  xLabel: any;
  yLabel: any;
  zLabel: any;
} {
  const resolveOptions = () => getAxisOptions?.() ?? velocityOptions;

  // X축 (위성 진행 방향) - 빨간색
  const xAxisEntity = viewer.entities.add({
    name: 'X-Axis (Satellite Velocity)',
    polyline: {
      positions: new Cesium.CallbackProperty(() => {
        return getAxisLinePositions(getCurrentCartesian(), 'x', axisLength, resolveOptions());
      }, false),
      width: 3,
      material: Cesium.Color.RED,
      clampToGround: false,
      show: axisVisible,
    },
  });

  // Y축 (SAR 관측 방향) - 초록색
  const yAxisEntity = viewer.entities.add({
    name: 'Y-Axis (SAR Look Direction)',
    polyline: {
      positions: new Cesium.CallbackProperty(() => {
        return getAxisLinePositions(getCurrentCartesian(), 'y', axisLength, resolveOptions());
      }, false),
      width: 3,
      material: Cesium.Color.GREEN,
      clampToGround: false,
      show: axisVisible,
    },
  });

  // Z축 (지구 중심 방향) - 파란색
  const zAxisEntity = viewer.entities.add({
    name: 'Z-Axis (Earth Center Direction)',
    polyline: {
      positions: new Cesium.CallbackProperty(() => {
        return getAxisLinePositions(getCurrentCartesian(), 'z', axisLength, resolveOptions());
      }, false),
      width: 3,
      material: Cesium.Color.BLUE,
      clampToGround: false,
      show: axisVisible,
    },
  });

  // X축 레이블
  const xLabelEntity = viewer.entities.add({
    name: 'X-Axis Label',
    position: new Cesium.CallbackProperty(() => {
      return getAxisEndPosition(getCurrentCartesian(), 'x', axisLength, resolveOptions());
    }, false),
    label: {
      text: 'X',
      font: '20px sans-serif',
      fillColor: Cesium.Color.RED,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(50, 1.0, 5.0e6, 0.0),
      translucencyByDistance: new Cesium.NearFarScalar(50, 1.0, 5.0e6, 1.0),
      show: axisVisible,
    },
  });

  // Y축 레이블
  const yLabelEntity = viewer.entities.add({
    name: 'Y-Axis Label',
    position: new Cesium.CallbackProperty(() => {
      return getAxisEndPosition(getCurrentCartesian(), 'y', axisLength, resolveOptions());
    }, false),
    label: {
      text: 'Y',
      font: '20px sans-serif',
      fillColor: Cesium.Color.GREEN,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(50, 1.0, 5.0e6, 0.0),
      translucencyByDistance: new Cesium.NearFarScalar(50, 1.0, 5.0e6, 1.0),
      show: axisVisible,
    },
  });

  // Z축 레이블
  const zLabelEntity = viewer.entities.add({
    name: 'Z-Axis Label',
    position: new Cesium.CallbackProperty(() => {
      return getAxisEndPosition(getCurrentCartesian(), 'z', axisLength, resolveOptions());
    }, false),
    label: {
      text: 'Z',
      font: '20px sans-serif',
      fillColor: Cesium.Color.BLUE,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(50, 1.0, 5.0e6, 0.0),
      translucencyByDistance: new Cesium.NearFarScalar(50, 1.0, 5.0e6, 1.0),
      show: axisVisible,
    },
  });

  return {
    xAxis: xAxisEntity,
    yAxis: yAxisEntity,
    zAxis: zAxisEntity,
    xLabel: xLabelEntity,
    yLabel: yLabelEntity,
    zLabel: zLabelEntity,
  };
}

/** BUS/안테나 방향 타입 */
export type BusOrientation = { rollAngle: number; pitchAngle: number; yawAngle: number };

/**
 * 안테나 XYZ 축 엔티티 생성 (안테나 위치에서 시작, BUS와 동일한 축 방향)
 * @param velocityOptions 속도 방향(방위각/고도각 또는 ECEF). 없으면 기존 동작
 * @param getBusCartesian 버스 위치 getter. 주어지면 이 위치에서 축 방향 계산 (시뮬레이션 시 최신값 참조)
 * @param getBusOrientation BUS 방향 getter
 */
export function createAntennaAxisEntities(
  viewer: any,
  antennaEntity: any,
  axisLength: number,
  axisVisible: boolean,
  velocityOptions?: VelocityDirectionOptions,
  getBusCartesian?: () => any,
  getBusOrientation?: () => BusOrientation | undefined
): {
  xAxis: any;
  yAxis: any;
  zAxis: any;
  xLabel: any;
  yLabel: any;
  zLabel: any;
} {
  const getCenterAndAxes = () => {
    if (!viewer?.clock || !antennaEntity) return { center: null, axes: null };
    const time = viewer.clock.currentTime;
    const center = antennaEntity.position?.getValue(time);
    if (!center) return { center: null, axes: null };
    const busCart = getBusCartesian?.();
    const baseAxes = calculateBaseAxes(busCart || center, velocityOptions);
    if (!baseAxes) return { center, axes: null };
    const busOri = getBusOrientation?.() ?? { rollAngle: 0, pitchAngle: 0, yawAngle: 0 };
    const axes = applyBusRollPitchYawToAxes(baseAxes, busOri.rollAngle, busOri.pitchAngle, busOri.yawAngle);
    return { center, axes };
  };

  const xAxisEntity = viewer.entities.add({
    name: 'Antenna X-Axis',
    polyline: {
      positions: new Cesium.CallbackProperty(() => {
        const { center, axes } = getCenterAndAxes();
        if (!center || !axes) return [];
        return getAxisLinePositionsWithAxes(center, axes, 'x', axisLength);
      }, false),
      width: 3,
      material: Cesium.Color.RED,
      clampToGround: false,
      show: axisVisible,
    },
  });

  const yAxisEntity = viewer.entities.add({
    name: 'Antenna Y-Axis',
    polyline: {
      positions: new Cesium.CallbackProperty(() => {
        const { center, axes } = getCenterAndAxes();
        if (!center || !axes) return [];
        return getAxisLinePositionsWithAxes(center, axes, 'y', axisLength);
      }, false),
      width: 3,
      material: Cesium.Color.GREEN,
      clampToGround: false,
      show: axisVisible,
    },
  });

  const zAxisEntity = viewer.entities.add({
    name: 'Antenna Z-Axis',
    polyline: {
      positions: new Cesium.CallbackProperty(() => {
        const { center, axes } = getCenterAndAxes();
        if (!center || !axes) return [];
        return getAxisLinePositionsWithAxes(center, axes, 'z', axisLength);
      }, false),
      width: 3,
      material: Cesium.Color.BLUE,
      clampToGround: false,
      show: axisVisible,
    },
  });

  const xLabelEntity = viewer.entities.add({
    name: 'Antenna X-Axis Label',
    position: new Cesium.CallbackProperty(() => {
      const { center, axes } = getCenterAndAxes();
      if (!center || !axes) return undefined;
      return getAxisEndPositionWithAxes(center, axes, 'x', axisLength);
    }, false),
    label: {
      text: 'X',
      font: '20px sans-serif',
      fillColor: Cesium.Color.RED,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(50, 1.0, 5.0e6, 0.0),
      translucencyByDistance: new Cesium.NearFarScalar(50, 1.0, 5.0e6, 1.0),
      show: axisVisible,
    },
  });

  const yLabelEntity = viewer.entities.add({
    name: 'Antenna Y-Axis Label',
    position: new Cesium.CallbackProperty(() => {
      const { center, axes } = getCenterAndAxes();
      if (!center || !axes) return undefined;
      return getAxisEndPositionWithAxes(center, axes, 'y', axisLength);
    }, false),
    label: {
      text: 'Y',
      font: '20px sans-serif',
      fillColor: Cesium.Color.GREEN,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(50, 1.0, 5.0e6, 0.0),
      translucencyByDistance: new Cesium.NearFarScalar(50, 1.0, 5.0e6, 1.0),
      show: axisVisible,
    },
  });

  const zLabelEntity = viewer.entities.add({
    name: 'Antenna Z-Axis Label',
    position: new Cesium.CallbackProperty(() => {
      const { center, axes } = getCenterAndAxes();
      if (!center || !axes) return undefined;
      return getAxisEndPositionWithAxes(center, axes, 'z', axisLength);
    }, false),
    label: {
      text: 'Z',
      font: '20px sans-serif',
      fillColor: Cesium.Color.BLUE,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(50, 1.0, 5.0e6, 0.0),
      translucencyByDistance: new Cesium.NearFarScalar(50, 1.0, 5.0e6, 1.0),
      show: axisVisible,
    },
  });

  return {
    xAxis: xAxisEntity,
    yAxis: yAxisEntity,
    zAxis: zAxisEntity,
    xLabel: xLabelEntity,
    yLabel: yLabelEntity,
    zLabel: zLabelEntity,
  };
}
