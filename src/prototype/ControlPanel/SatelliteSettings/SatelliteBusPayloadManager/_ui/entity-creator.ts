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
 * BUS Roll, Pitch, Yaw 회전 적용한 축 반환
 * 순서: Roll(X) -> Pitch(Y) -> Yaw(Z)
 */
export function applyBusRollPitchYawToAxes(
  axes: { xAxis: any; yAxis: any; zAxis: any },
  rollDeg: number,
  pitchDeg: number,
  yawDeg: number
): { xAxis: any; yAxis: any; zAxis: any } {
  let result = axes;
  if (typeof rollDeg === 'number' && !Number.isNaN(rollDeg) && rollDeg !== 0) {
    result = applyBusRollToAxes(result, rollDeg);
  }
  if (typeof pitchDeg === 'number' && !Number.isNaN(pitchDeg) && pitchDeg !== 0) {
    const pitchRad = Cesium.Math.toRadians(pitchDeg);
    const pitchQuat = Cesium.Quaternion.fromAxisAngle(result.yAxis, pitchRad, new Cesium.Quaternion());
    const pitchMatrix = Cesium.Matrix3.fromQuaternion(pitchQuat, new Cesium.Matrix3());
    const xAxis = Cesium.Cartesian3.normalize(
      Cesium.Matrix3.multiplyByVector(pitchMatrix, result.xAxis, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );
    const zAxis = Cesium.Cartesian3.normalize(
      Cesium.Matrix3.multiplyByVector(pitchMatrix, result.zAxis, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );
    result = { xAxis, yAxis: result.yAxis, zAxis };
  }
  if (typeof yawDeg === 'number' && !Number.isNaN(yawDeg) && yawDeg !== 0) {
    const yawRad = Cesium.Math.toRadians(yawDeg);
    const yawQuat = Cesium.Quaternion.fromAxisAngle(result.zAxis, yawRad, new Cesium.Quaternion());
    const yawMatrix = Cesium.Matrix3.fromQuaternion(yawQuat, new Cesium.Matrix3());
    const xAxis = Cesium.Cartesian3.normalize(
      Cesium.Matrix3.multiplyByVector(yawMatrix, result.xAxis, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );
    const yAxis = Cesium.Cartesian3.normalize(
      Cesium.Matrix3.multiplyByVector(yawMatrix, result.yAxis, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );
    result = { xAxis, yAxis, zAxis: result.zAxis };
  }
  return result;
}

/**
 * BUS 방향 쿼터니언 계산
 * @param cartesian 위성 ECEF 좌표
 * @param velocityOptions 속도 방향(방위각/고도각)이 주어지면 해당 축 기준으로 방향 계산
 * @param busOrientation BUS Roll, Pitch, Yaw 각도 (도)
 */
export function calculateBusOrientation(
  cartesian: any,
  velocityOptions?: VelocityDirectionOptions,
  busOrientation?: { rollAngle: number; pitchAngle: number; yawAngle: number }
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

  const rollDeg = busOrientation?.rollAngle ?? 0;
  const pitchDeg = busOrientation?.pitchAngle ?? 0;
  const yawDeg = busOrientation?.yawAngle ?? 0;
  const transformedAxes = applyBusRollPitchYawToAxes(axes, rollDeg, pitchDeg, yawDeg);

  // 회전 행렬: 열이 xAxis, yAxis, zAxis (Matrix3 생성자는 row-major)
  const m = new Cesium.Matrix3(
    transformedAxes.xAxis.x, transformedAxes.yAxis.x, transformedAxes.zAxis.x,
    transformedAxes.xAxis.y, transformedAxes.yAxis.y, transformedAxes.zAxis.y,
    transformedAxes.xAxis.z, transformedAxes.yAxis.z, transformedAxes.zAxis.z
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
