import {
  getAxisLinePositions,
  getAxisEndPosition,
  getAxisLinePositionsWithAxes,
  getAxisEndPositionWithAxes,
  type AxesLike,
} from '../_util/axis-position-calculator.js';
import { calculateBaseAxes, type VelocityDirectionOptions } from '../_util/base-axes-calculator.js';

/**
 * XYZ 축 엔티티 생성
 * @param velocityOptions 속도 방향(방위각/고도각 deg). 없으면 기존 동작
 */
export function createAxisEntities(
  viewer: any,
  currentCartesian: any,
  axisLength: number,
  axisVisible: boolean,
  velocityOptions?: VelocityDirectionOptions
): {
  xAxis: any;
  yAxis: any;
  zAxis: any;
  xLabel: any;
  yLabel: any;
  zLabel: any;
} {
  // X축 (위성 진행 방향) - 빨간색
  const xAxisEntity = viewer.entities.add({
    name: 'X-Axis (Satellite Velocity)',
    polyline: {
      positions: new Cesium.CallbackProperty(() => {
        return getAxisLinePositions(currentCartesian, 'x', axisLength, velocityOptions);
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
        return getAxisLinePositions(currentCartesian, 'y', axisLength, velocityOptions);
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
        return getAxisLinePositions(currentCartesian, 'z', axisLength, velocityOptions);
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
      return getAxisEndPosition(currentCartesian, 'x', axisLength, velocityOptions);
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
      scaleByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 5.0e6, 0.0),
      translucencyByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 5.0e6, 1.0),
      show: axisVisible,
    },
  });

  // Y축 레이블
  const yLabelEntity = viewer.entities.add({
    name: 'Y-Axis Label',
    position: new Cesium.CallbackProperty(() => {
      return getAxisEndPosition(currentCartesian, 'y', axisLength, velocityOptions);
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
      scaleByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 5.0e6, 0.0),
      translucencyByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 5.0e6, 1.0),
      show: axisVisible,
    },
  });

  // Z축 레이블
  const zLabelEntity = viewer.entities.add({
    name: 'Z-Axis Label',
    position: new Cesium.CallbackProperty(() => {
      return getAxisEndPosition(currentCartesian, 'z', axisLength, velocityOptions);
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
      scaleByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 5.0e6, 0.0),
      translucencyByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 5.0e6, 1.0),
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

/**
 * 안테나 XYZ 축 엔티티 생성 (BUS와 동일한 방향 사용, 안테나 위치에서 시작)
 * @param velocityOptions 속도 방향(방위각/고도각 또는 ECEF). 없으면 기존 동작
 * @param busCartesian 버스 위치(ECEF). 주어지면 이 위치에서 축 방향을 계산해 BUS와 동일하게 함
 */
export function createAntennaAxisEntities(
  viewer: any,
  antennaEntity: any,
  axisLength: number,
  axisVisible: boolean,
  velocityOptions?: VelocityDirectionOptions,
  busCartesian?: any
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
    // BUS와 동일한 방향: 축은 버스 위치에서 계산하고, 선만 안테나 중심에서 그림
    const axes = calculateBaseAxes(busCartesian || center, velocityOptions);
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
      scaleByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 5.0e6, 0.0),
      translucencyByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 5.0e6, 1.0),
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
      scaleByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 5.0e6, 0.0),
      translucencyByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 5.0e6, 1.0),
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
      scaleByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 5.0e6, 0.0),
      translucencyByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 5.0e6, 1.0),
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
