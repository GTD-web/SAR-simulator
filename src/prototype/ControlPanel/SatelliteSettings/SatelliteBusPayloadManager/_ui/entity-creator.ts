import { calculateBaseAxes, type VelocityDirectionOptions } from '../_util/base-axes-calculator.js';
import { calculateAntennaOrientation } from '../_util/antenna-orientation-calculator.js';

/**
 * BUS 엔티티 생성
 */
export function createBusEntity(
  viewer: any,
  name: string,
  position: any,
  orientation: any,
  dimensions: { length: number; width: number; height: number }
): any {
  return viewer.entities.add({
    name: `${name} - BUS`,
    position: position,
    orientation: new Cesium.ConstantProperty(orientation),
    box: {
      dimensions: new Cesium.Cartesian3(
        dimensions.length,
        dimensions.width,
        dimensions.height
      ),
      material: Cesium.Color.GRAY.withAlpha(0.8),
      outline: true,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    },
    show: true,
  });
}

/**
 * 안테나 엔티티 생성
 */
export function createAntennaEntity(
  viewer: any,
  name: string,
  position: any,
  orientation: any,
  dimensions: { depth: number; width: number; height: number }
): any {
  return viewer.entities.add({
    name: `${name} - Antenna`,
    position: position,
    orientation: new Cesium.ConstantProperty(orientation),
    box: {
      dimensions: new Cesium.Cartesian3(
        dimensions.depth,
        dimensions.width,
        dimensions.height
      ),
      material: Cesium.Color.CYAN.withAlpha(0.7),
      outline: true,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    },
    show: true,
  });
}

/**
 * X축 기준 roll 회전 적용한 축 반환
 */
export function applyBusRollToAxes(
  axes: { xAxis: any; yAxis: any; zAxis: any },
  busRollDeg: number
): { xAxis: any; yAxis: any; zAxis: any } {
  if (typeof busRollDeg !== 'number' || Number.isNaN(busRollDeg) || busRollDeg === 0) {
    return axes;
  }
  const rollRad = Cesium.Math.toRadians(busRollDeg);
  const rollQuat = Cesium.Quaternion.fromAxisAngle(axes.xAxis, rollRad, new Cesium.Quaternion());
  const rollMatrix = Cesium.Matrix3.fromQuaternion(rollQuat, new Cesium.Matrix3());
  const yAxis = Cesium.Cartesian3.normalize(
    Cesium.Matrix3.multiplyByVector(rollMatrix, axes.yAxis, new Cesium.Cartesian3()),
    new Cesium.Cartesian3()
  );
  const zAxis = Cesium.Cartesian3.normalize(
    Cesium.Matrix3.multiplyByVector(rollMatrix, axes.zAxis, new Cesium.Cartesian3()),
    new Cesium.Cartesian3()
  );
  return { xAxis: axes.xAxis, yAxis, zAxis };
}

/**
 * BUS 방향 쿼터니언 계산
 * @param cartesian 위성 ECEF 좌표
 * @param velocityOptions 속도 방향(방위각/고도각)이 주어지면 해당 축 기준으로 방향 계산
 * @param busRollDeg BUS Roll 각도 (도). X축(궤도 진행방향) 기준 회전. 안테나 roll과 동일하게 적용
 */
export function calculateBusOrientation(
  cartesian: any,
  velocityOptions?: VelocityDirectionOptions,
  busRollDeg?: number
): any {
  const axes = velocityOptions
    ? calculateBaseAxes(cartesian, velocityOptions)
    : null;
  if (!axes) {
    return Cesium.Transforms.headingPitchRollQuaternion(
      cartesian,
      new Cesium.HeadingPitchRoll(0, 0, 0)
    );
  }

  const rolledAxes = (typeof busRollDeg === 'number' && !Number.isNaN(busRollDeg) && busRollDeg !== 0)
    ? applyBusRollToAxes(axes, busRollDeg)
    : axes;

  // 회전 행렬: 열이 xAxis, yAxis, zAxis (Matrix3 생성자는 row-major)
  const m = new Cesium.Matrix3(
    rolledAxes.xAxis.x, rolledAxes.yAxis.x, rolledAxes.zAxis.x,
    rolledAxes.xAxis.y, rolledAxes.yAxis.y, rolledAxes.zAxis.y,
    rolledAxes.xAxis.z, rolledAxes.yAxis.z, rolledAxes.zAxis.z
  );
  return Cesium.Quaternion.fromRotationMatrix(m);
}

/**
 * 안테나 방향 계산
 * @param velocityOptions 속도 방향(방위각/고도각). 없으면 기존 동작
 */
export function calculateAntennaOrientationForUI(
  currentCartesian: any,
  rollAngle: number,
  pitchAngle: number,
  yawAngle: number,
  initialElevationAngle: number,
  initialAzimuthAngle: number,
  velocityOptions?: VelocityDirectionOptions
): any {
  const busAxes = calculateBaseAxes(currentCartesian, velocityOptions);
  if (!busAxes) {
    return null;
  }

  return calculateAntennaOrientation(
    busAxes,
    rollAngle,
    pitchAngle,
    yawAngle,
    initialElevationAngle,
    initialAzimuthAngle
  );
}
