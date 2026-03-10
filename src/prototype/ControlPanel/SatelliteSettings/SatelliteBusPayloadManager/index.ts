import { calculateBaseAxes, type VelocityDirectionOptions } from './_util/base-axes-calculator.js';
import { calculateAntennaOrientation } from './_util/antenna-orientation-calculator.js';
import { createBusEntity, createAntennaEntity, calculateBusOrientation, applyBusRollPitchYawToAxes } from './_ui/entity-creator.js';
import { createAxisEntities, createAntennaAxisEntities } from './_ui/axis-creator.js';
import { createDirectionArrows } from './_ui/direction-arrows-creator.js';

/**
 * SatelliteBusPayloadManager - BUS와 Payload(안테나) 엔티티 관리 클래스
 */
export class SatelliteBusPayloadManager {
  private viewer: any;
  private busEntity: any;
  private antennaEntity: any;
  private position: any;
  private currentCartesian: any;
  private velocityAzimuthDeg: number | undefined;
  private velocityElevationDeg: number | undefined;
  /** 정규화된 ECEF 속도 벡터 (POC 방식 X축 정렬용). 있으면 az/el 대신 사용 */
  private velocityEcef: { x: number; y: number; z: number } | undefined;
  private axisEntities: {
    xAxis: any;
    yAxis: any;
    zAxis: any;
    xLabel: any;
    yLabel: any;
    zLabel: any;
  } | null;
  private antennaAxisEntities: {
    xAxis: any;
    yAxis: any;
    zAxis: any;
    xLabel: any;
    yLabel: any;
    zLabel: any;
  } | null;
  private axisLength: number;
  private axisVisible: boolean;
  private busDimensions: { length: number; width: number; height: number } | null;
  private busOrientation: { rollAngle: number; pitchAngle: number; yawAngle: number } | null;
  private antennaParams: {
    height: number;
    width: number;
    depth: number;
    rollAngle: number;
    pitchAngle: number;
    yawAngle: number;
    initialElevationAngle: number;
    initialAzimuthAngle: number;
  } | null;
  private antennaGap: number; // 버스와 안테나 사이 간격 (미터)
  private directionArrows: {
    positive: any;
    negative: any;
    positiveLabel: any;
    negativeLabel: any;
  } | null;

  constructor(viewer: any) {
    this.viewer = viewer;
    this.busEntity = null;
    this.antennaEntity = null;
    this.position = null;
    this.currentCartesian = null;
    this.velocityAzimuthDeg = undefined;
    this.velocityElevationDeg = undefined;
    this.velocityEcef = undefined;
    this.axisEntities = null;
    this.antennaAxisEntities = null;
    this.axisLength = 0.2; // 기본값: 0.2m
    this.axisVisible = true;
    this.busDimensions = null;
    this.busOrientation = null;
    this.antennaParams = null;
    this.antennaGap = 0.1; // 기본값: 100mm (미터 단위)
    this.directionArrows = null;
  }

  /**
   * BUS와 안테나 엔티티 생성
   */
  createSatellite(
    name: string,
    position: { longitude: number; latitude: number; altitude: number },
    busDimensions: { length: number; width: number; height: number },
    antennaParams: {
      height: number;
      width: number;
      depth: number;
      rollAngle: number;
      pitchAngle: number;
      yawAngle: number;
      initialElevationAngle: number;
      initialAzimuthAngle: number;
    },
    antennaGap?: number, // 버스와 안테나 사이 간격 (미터)
    busOrientation?: { rollAngle: number; pitchAngle: number; yawAngle: number }
  ): void {
    if (!this.viewer) {
      console.error('[SatelliteBusPayloadManager] Viewer가 없습니다.');
      return;
    }

    // 기존 엔티티 제거
    this.removeSatellite();

    const initialCartesian = Cesium.Cartesian3.fromDegrees(
      position.longitude,
      position.latitude,
      position.altitude
    );

    this.currentCartesian = initialCartesian.clone();
    // BUS·축이 동일한 currentCartesian 참조 → 항상 함께 움직임
    this.position = new Cesium.CallbackProperty(() => this.currentCartesian, false);

    // 파라미터 저장
    this.busDimensions = busDimensions;
    this.busOrientation = busOrientation ?? { rollAngle: 0, pitchAngle: 0, yawAngle: 0 };
    this.antennaParams = antennaParams;
    this.antennaGap = antennaGap !== undefined ? antennaGap : 0.1; // 기본값: 100mm

    // BUS 기본 방향 계산
    const baseAxes = calculateBaseAxes(this.currentCartesian, this.getVelocityOptions());
    if (!baseAxes) {
      console.error('[SatelliteBusPayloadManager] BUS 축 계산 실패');
      return;
    }
    const bo = this.busOrientation;
    const busAxes = applyBusRollPitchYawToAxes(baseAxes, bo.rollAngle, bo.pitchAngle, bo.yawAngle);

    // BUS 방향 쿼터니언 계산
    const busOrientationQuat = calculateBusOrientation(initialCartesian, this.getVelocityOptions(), this.busOrientation);

    // BUS 엔티티 생성
    try {
      this.busEntity = createBusEntity(
        this.viewer,
        name,
        this.position,
        busOrientationQuat,
        busDimensions
      );
    } catch (error) {
      console.error('[SatelliteBusPayloadManager] BUS 엔티티 생성 오류:', error);
      return;
    }

    // 안테나 위치: currentCartesian 기반 CallbackProperty → BUS·축과 함께 움직임
    try {
      const antennaPositionProperty = new Cesium.CallbackProperty(() => {
        if (!this.currentCartesian || !this.busDimensions || !this.antennaParams || !this.busOrientation) {
          return new Cesium.Cartesian3(0, 0, 0);
        }
        const axes = calculateBaseAxes(this.currentCartesian, this.getVelocityOptions());
        if (!axes) return new Cesium.Cartesian3(0, 0, 0);
        const bo = this.busOrientation;
        const bAxes = applyBusRollPitchYawToAxes(axes, bo.rollAngle, bo.pitchAngle, bo.yawAngle);
        const offset = Cesium.Cartesian3.multiplyByScalar(
          bAxes.yAxis,
          this.busDimensions.width / 2 + this.antennaParams.depth / 2 + this.antennaGap,
          new Cesium.Cartesian3()
        );
        return Cesium.Cartesian3.add(this.currentCartesian, offset, new Cesium.Cartesian3());
      }, false);

      // 안테나 방향 계산 (busAxes 기준)
      const antennaOrientation = calculateAntennaOrientation(
        busAxes,
        antennaParams.rollAngle,
        antennaParams.pitchAngle,
        antennaParams.yawAngle,
        antennaParams.initialElevationAngle,
        antennaParams.initialAzimuthAngle
      );

      if (!antennaOrientation) {
        console.error('[SatelliteBusPayloadManager] 안테나 방향 계산 실패');
        return;
      }

      // 안테나 엔티티 생성
      this.antennaEntity = createAntennaEntity(
        this.viewer,
        name,
        antennaPositionProperty,
        antennaOrientation,
        {
          depth: antennaParams.depth,
          width: antennaParams.width,
          height: antennaParams.height
        }
      );
    } catch (error) {
      console.error('[SatelliteBusPayloadManager] 안테나 엔티티 생성 오류:', error);
    }

    // XYZ 축 생성 (BUS)
    try {
      this.createAxisLines();
    } catch (error) {
      console.error('[SatelliteBusPayloadManager] XYZ 축 생성 오류:', error);
    }

    // 안테나 XYZ 축 생성
    try {
      this.createAntennaAxisLines();
    } catch (error) {
      console.error('[SatelliteBusPayloadManager] 안테나 XYZ 축 생성 오류:', error);
    }
  }

  /**
   * Swath 미리보기용 위치·heading 반환. 위성이 없으면 null
   */
  getPositionForSwath(): { longitude: number; latitude: number; altitude: number; heading: number } | null {
    if (!this.currentCartesian) return null;
    const cartographic = Cesium.Cartographic.fromCartesian(this.currentCartesian);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    const altitude = cartographic.height;

    let heading = 90; // 기본: 동쪽
    if (this.velocityEcef) {
      const lonRad = cartographic.longitude;
      const latRad = cartographic.latitude;
      const v = this.velocityEcef;
      const vEast = v.x * -Math.sin(lonRad) + v.y * Math.cos(lonRad);
      const vNorth = v.x * (-Math.sin(latRad) * Math.cos(lonRad)) +
        v.y * (-Math.sin(latRad) * Math.sin(lonRad)) +
        v.z * Math.cos(latRad);
      heading = Cesium.Math.toDegrees(Math.atan2(vEast, vNorth));
      if (heading < 0) heading += 360;
    } else if (this.velocityAzimuthDeg !== undefined && !Number.isNaN(this.velocityAzimuthDeg)) {
      heading = this.velocityAzimuthDeg;
    }

    return { longitude, latitude, altitude, heading };
  }

  /**
   * 속도 방향 옵션 반환. velocityEcef이 있으면 우선 사용 (POC 방식), 없으면 방위각/고도각
   */
  getVelocityOptions(): VelocityDirectionOptions | undefined {
    if (this.velocityEcef) {
      return { velocityEcef: this.velocityEcef };
    }
    const az = this.velocityAzimuthDeg;
    const el = this.velocityElevationDeg;
    if (az === undefined || el === undefined || Number.isNaN(az) || Number.isNaN(el)) {
      return undefined;
    }
    return { velocityAzimuthDeg: az, velocityElevationDeg: el };
  }

  /**
   * 속도 방향 설정 (ECEF 벡터, POC 방식). 정규화 후 저장하고 BUS/안테나/축 갱신
   */
  setVelocityDirectionEcef(vx: number, vy: number, vz: number): void {
    const v = new Cesium.Cartesian3(vx, vy, vz);
    const norm = Cesium.Cartesian3.normalize(v, new Cesium.Cartesian3());
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (speed < 1e-6) return;
    this.velocityEcef = { x: norm.x, y: norm.y, z: norm.z };
    this.velocityAzimuthDeg = undefined;
    this.velocityElevationDeg = undefined;
    if (!this.position || !this.busEntity || !this.currentCartesian) return;
    const cartographic = Cesium.Cartographic.fromCartesian(this.currentCartesian);
    this.updatePosition({
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      altitude: cartographic.height,
    });
  }

  /**
   * 속도 방향 설정 (방위각·고도각 deg). 설정 시 velocityEcef은 초기화되고 az/el 사용
   */
  setVelocityDirection(azimuthDeg: number | undefined, elevationDeg: number | undefined): void {
    this.velocityAzimuthDeg = azimuthDeg;
    this.velocityElevationDeg = elevationDeg;
    this.velocityEcef = undefined;
    if (!this.position || !this.busEntity || !this.currentCartesian) return;
    const cartographic = Cesium.Cartographic.fromCartesian(this.currentCartesian);
    this.updatePosition({
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      altitude: cartographic.height,
    });
  }

  /**
   * BUS 방향 포함 축 옵션 반환 (CallbackProperty에서 호출되어 변경 시 축 갱신)
   */
  private getAxisOptions(): { busOrientation?: { rollAngle: number; pitchAngle: number; yawAngle: number } } & ReturnType<typeof this.getVelocityOptions> {
    const vel = this.getVelocityOptions();
    const busOrientation = this.busOrientation ?? undefined;
    return { ...vel, busOrientation };
  }

  /**
   * XYZ 축 방향선 생성 (BUS)
   * getCurrentCartesian getter 사용으로 시뮬레이션 시 매 프레임 최신 위치 반영, 축 제거/재생성 불필요
   */
  private createAxisLines(): void {
    if (!this.viewer || !this.position) return;

    this.axisEntities = createAxisEntities(
      this.viewer,
      () => this.currentCartesian,
      this.axisLength,
      this.axisVisible,
      this.getVelocityOptions(),
      () => this.getAxisOptions()
    );
  }

  /**
   * 안테나 XYZ 축 방향선 생성
   */
  private createAntennaAxisLines(): void {
    if (!this.viewer || !this.antennaEntity) return;

    this.antennaAxisEntities = createAntennaAxisEntities(
      this.viewer,
      this.antennaEntity,
      this.axisLength,
      false,
      this.getVelocityOptions(),
      () => this.currentCartesian,
      () => this.busOrientation ?? undefined
    );
  }


  /**
   * 위성 위치 업데이트
   */
  updatePosition(position: { longitude: number; latitude: number; altitude: number }): void {
    if (!this.currentCartesian) {
      console.warn('[SatelliteBusPayloadManager] 위치를 업데이트할 엔티티가 없습니다.');
      return;
    }

    if (!this.busDimensions || !this.antennaParams) {
      console.warn('[SatelliteBusPayloadManager] BUS 또는 안테나 파라미터가 없습니다.');
      return;
    }

    try {
      const newCartesian = Cesium.Cartesian3.fromDegrees(
        position.longitude,
        position.latitude,
        position.altitude
      );

      this.currentCartesian = newCartesian.clone();

      // BUS 방향 재계산 (X축 = 궤도 진행방향, Roll/Pitch/Yaw 적용)
      const baseAxes = calculateBaseAxes(this.currentCartesian, this.getVelocityOptions());
      if (baseAxes && this.busOrientation) {
        const bo = this.busOrientation;
        const busAxes = applyBusRollPitchYawToAxes(baseAxes, bo.rollAngle, bo.pitchAngle, bo.yawAngle);
        const busOrientationQuat = calculateBusOrientation(newCartesian, this.getVelocityOptions(), this.busOrientation);

        if (this.busEntity) {
          this.busEntity.orientation = new Cesium.ConstantProperty(busOrientationQuat);
        }

        // 안테나 방향 재계산 (위치는 CallbackProperty로 currentCartesian 기반 자동 갱신)
        if (this.antennaEntity && this.antennaParams) {
          const antennaOrientation = calculateAntennaOrientation(
            busAxes,
            this.antennaParams.rollAngle,
            this.antennaParams.pitchAngle,
            this.antennaParams.yawAngle,
            this.antennaParams.initialElevationAngle,
            this.antennaParams.initialAzimuthAngle
          );
          this.antennaEntity.orientation = new Cesium.ConstantProperty(antennaOrientation);
        }
      }

      // XYZ 축·안테나 축: getter 사용으로 CallbackProperty가 매 프레임 최신값 참조 → 제거/재생성 불필요
      // (시뮬레이션 시 매 프레임 updatePosition 호출해도 축 유지)
    } catch (error) {
      console.error('[SatelliteBusPayloadManager] 위치 업데이트 오류:', error);
    }
  }

  /**
   * BUS 크기 업데이트
   */
  updateBusDimensions(dimensions: { length: number; width: number; height: number }): void {
    if (!this.busEntity) {
      return;
    }

    try {
      this.busDimensions = dimensions;

      if (this.busEntity.box) {
        this.busEntity.box.dimensions = new Cesium.Cartesian3(
          dimensions.length,
          dimensions.width,
          dimensions.height
        );
      }

      // 안테나 위치: CallbackProperty가 busDimensions 기반 자동 갱신

      console.log('[SatelliteBusPayloadManager] BUS 크기 업데이트 완료:', dimensions);
    } catch (error) {
      console.error('[SatelliteBusPayloadManager] BUS 크기 업데이트 오류:', error);
    }
  }

  /**
   * 안테나 크기 업데이트
   */
  updateAntennaDimensions(dimensions: { height: number; width: number; depth: number }): void {
    if (!this.antennaEntity || !this.antennaParams) {
      return;
    }

    try {
      this.antennaParams.height = dimensions.height;
      this.antennaParams.width = dimensions.width;
      this.antennaParams.depth = dimensions.depth;

      if (this.antennaEntity.box) {
        this.antennaEntity.box.dimensions = new Cesium.Cartesian3(
          dimensions.depth,
          dimensions.width,
          dimensions.height
        );
      }

      // 안테나 위치: CallbackProperty가 antennaParams 기반 자동 갱신

      console.log('[SatelliteBusPayloadManager] 안테나 크기 업데이트 완료:', dimensions);
    } catch (error) {
      console.error('[SatelliteBusPayloadManager] 안테나 크기 업데이트 오류:', error);
    }
  }

  /**
   * 버스와 안테나 사이 간격 업데이트
   */
  updateAntennaGap(gap: number): void {
    if (!this.antennaEntity || !this.busDimensions || !this.antennaParams || !this.busOrientation || !this.currentCartesian) {
      return;
    }

    try {
      this.antennaGap = gap;
      // 안테나 위치: CallbackProperty가 antennaGap 기반 자동 갱신

      console.log('[SatelliteBusPayloadManager] 안테나 간격 업데이트 완료:', gap);
    } catch (error) {
      console.error('[SatelliteBusPayloadManager] 안테나 간격 업데이트 오류:', error);
    }
  }

  /**
   * BUS 방향 업데이트
   */
  updateBusOrientation(orientation: { rollAngle: number; pitchAngle: number; yawAngle: number }): void {
    if (!this.busEntity || !this.busDimensions || !this.antennaEntity || !this.antennaParams || !this.busOrientation || !this.currentCartesian) {
      return;
    }

    try {
      this.busOrientation = { ...orientation };

      const baseAxes = calculateBaseAxes(this.currentCartesian, this.getVelocityOptions());
      if (baseAxes) {
        const bo = this.busOrientation;
        const busAxes = applyBusRollPitchYawToAxes(baseAxes, bo.rollAngle, bo.pitchAngle, bo.yawAngle);
        const busOrientationQuat = calculateBusOrientation(this.currentCartesian, this.getVelocityOptions(), this.busOrientation);

        this.busEntity.orientation = new Cesium.ConstantProperty(busOrientationQuat);

        // 안테나 위치: CallbackProperty가 busOrientation 기반 자동 갱신
        const antennaOrientation = calculateAntennaOrientation(
          busAxes,
          this.antennaParams.rollAngle,
          this.antennaParams.pitchAngle,
          this.antennaParams.yawAngle,
          this.antennaParams.initialElevationAngle,
          this.antennaParams.initialAzimuthAngle
        );
        this.antennaEntity.orientation = new Cesium.ConstantProperty(antennaOrientation);
      }

      if (this.axisEntities) {
        if (this.axisEntities.xAxis) this.viewer.entities.remove(this.axisEntities.xAxis);
        if (this.axisEntities.yAxis) this.viewer.entities.remove(this.axisEntities.yAxis);
        if (this.axisEntities.zAxis) this.viewer.entities.remove(this.axisEntities.zAxis);
        if (this.axisEntities.xLabel) this.viewer.entities.remove(this.axisEntities.xLabel);
        if (this.axisEntities.yLabel) this.viewer.entities.remove(this.axisEntities.yLabel);
        if (this.axisEntities.zLabel) this.viewer.entities.remove(this.axisEntities.zLabel);
        this.axisEntities = null;
        this.createAxisLines();
      }
      if (this.antennaAxisEntities) {
        if (this.antennaAxisEntities.xAxis) this.viewer.entities.remove(this.antennaAxisEntities.xAxis);
        if (this.antennaAxisEntities.yAxis) this.viewer.entities.remove(this.antennaAxisEntities.yAxis);
        if (this.antennaAxisEntities.zAxis) this.viewer.entities.remove(this.antennaAxisEntities.zAxis);
        if (this.antennaAxisEntities.xLabel) this.viewer.entities.remove(this.antennaAxisEntities.xLabel);
        if (this.antennaAxisEntities.yLabel) this.viewer.entities.remove(this.antennaAxisEntities.yLabel);
        if (this.antennaAxisEntities.zLabel) this.viewer.entities.remove(this.antennaAxisEntities.zLabel);
        this.antennaAxisEntities = null;
        this.createAntennaAxisLines();
      }

      console.log('[SatelliteBusPayloadManager] BUS 방향 업데이트 완료:', orientation);
    } catch (error) {
      console.error('[SatelliteBusPayloadManager] BUS 방향 업데이트 오류:', error);
    }
  }

  /**
   * 안테나 방향 업데이트
   */
  updateAntennaOrientation(orientation: {
    rollAngle: number;
    pitchAngle: number;
    yawAngle: number;
    initialElevationAngle: number;
    initialAzimuthAngle: number;
  }): void {
    if (!this.antennaEntity || !this.antennaParams || !this.busOrientation || !this.currentCartesian) {
      return;
    }

    try {
      this.antennaParams.rollAngle = orientation.rollAngle;
      this.antennaParams.pitchAngle = orientation.pitchAngle;
      this.antennaParams.yawAngle = orientation.yawAngle;
      this.antennaParams.initialElevationAngle = orientation.initialElevationAngle;
      this.antennaParams.initialAzimuthAngle = orientation.initialAzimuthAngle;

      const baseAxes = calculateBaseAxes(this.currentCartesian, this.getVelocityOptions());
      if (baseAxes) {
        const bo = this.busOrientation;
        const busAxes = applyBusRollPitchYawToAxes(baseAxes, bo.rollAngle, bo.pitchAngle, bo.yawAngle);
        // 안테나 위치: CallbackProperty가 antennaParams 기반 자동 갱신
        const antennaOrientation = calculateAntennaOrientation(
          busAxes,
          orientation.rollAngle,
          orientation.pitchAngle,
          orientation.yawAngle,
          orientation.initialElevationAngle,
          orientation.initialAzimuthAngle
        );
        this.antennaEntity.orientation = new Cesium.ConstantProperty(antennaOrientation);
      }

      console.log('[SatelliteBusPayloadManager] 안테나 방향 업데이트 완료:', orientation);
    } catch (error) {
      console.error('[SatelliteBusPayloadManager] 안테나 방향 업데이트 오류:', error);
    }
  }

  /**
   * 모든 파라미터 업데이트 (편의 메서드)
   */
  updateAll(params: {
    position?: { longitude: number; latitude: number; altitude: number };
    busDimensions?: { length: number; width: number; height: number };
    antennaDimensions?: { height: number; width: number; depth: number };
    antennaOrientation?: {
      rollAngle: number;
      pitchAngle: number;
      yawAngle: number;
      initialElevationAngle: number;
      initialAzimuthAngle: number;
    };
    antennaGap?: number;
  }): void {
    if (params.position) {
      this.updatePosition(params.position);
    }
    if (params.busDimensions) {
      this.updateBusDimensions(params.busDimensions);
    }
    if (params.antennaDimensions) {
      this.updateAntennaDimensions(params.antennaDimensions);
    }
    if (params.antennaOrientation) {
      this.updateAntennaOrientation(params.antennaOrientation);
    }
    if (params.antennaGap !== undefined) {
      this.updateAntennaGap(params.antennaGap);
    }
  }

  /**
   * 위성 엔티티 제거
   */
  removeSatellite(): void {
    if (this.busEntity) {
      this.viewer.entities.remove(this.busEntity);
      this.busEntity = null;
    }
    if (this.antennaEntity) {
      this.viewer.entities.remove(this.antennaEntity);
      this.antennaEntity = null;
    }
    if (this.axisEntities) {
      if (this.axisEntities.xAxis) this.viewer.entities.remove(this.axisEntities.xAxis);
      if (this.axisEntities.yAxis) this.viewer.entities.remove(this.axisEntities.yAxis);
      if (this.axisEntities.zAxis) this.viewer.entities.remove(this.axisEntities.zAxis);
      if (this.axisEntities.xLabel) this.viewer.entities.remove(this.axisEntities.xLabel);
      if (this.axisEntities.yLabel) this.viewer.entities.remove(this.axisEntities.yLabel);
      if (this.axisEntities.zLabel) this.viewer.entities.remove(this.axisEntities.zLabel);
      this.axisEntities = null;
    }
    if (this.antennaAxisEntities) {
      if (this.antennaAxisEntities.xAxis) this.viewer.entities.remove(this.antennaAxisEntities.xAxis);
      if (this.antennaAxisEntities.yAxis) this.viewer.entities.remove(this.antennaAxisEntities.yAxis);
      if (this.antennaAxisEntities.zAxis) this.viewer.entities.remove(this.antennaAxisEntities.zAxis);
      if (this.antennaAxisEntities.xLabel) this.viewer.entities.remove(this.antennaAxisEntities.xLabel);
      if (this.antennaAxisEntities.yLabel) this.viewer.entities.remove(this.antennaAxisEntities.yLabel);
      if (this.antennaAxisEntities.zLabel) this.viewer.entities.remove(this.antennaAxisEntities.zLabel);
      this.antennaAxisEntities = null;
    }
    this.position = null;
    this.currentCartesian = null;
    this.busDimensions = null;
    this.antennaParams = null;
    
    // 방향 화살표 제거
    this.removeDirectionArrows();
  }

  /**
   * XYZ 축 표시/숨김 설정
   */
  setAxisVisible(visible: boolean): void {
    this.axisVisible = visible;
    if (this.axisEntities) {
      this.axisEntities.xAxis.polyline.show = visible;
      this.axisEntities.yAxis.polyline.show = visible;
      this.axisEntities.zAxis.polyline.show = visible;
      this.axisEntities.xLabel.label.show = visible;
      this.axisEntities.yLabel.label.show = visible;
      this.axisEntities.zLabel.label.show = visible;
    }
    if (this.antennaAxisEntities) {
      this.antennaAxisEntities.xAxis.polyline.show = visible;
      this.antennaAxisEntities.yAxis.polyline.show = visible;
      this.antennaAxisEntities.zAxis.polyline.show = visible;
      this.antennaAxisEntities.xLabel.label.show = visible;
      this.antennaAxisEntities.yLabel.label.show = visible;
      this.antennaAxisEntities.zLabel.label.show = visible;
    }
  }

  /**
   * 축 길이 설정
   */
  setAxisLength(length: number): void {
    this.axisLength = length;
    
    // 축 길이 변경 시 축 재생성
    if (this.axisEntities) {
      // 기존 BUS 축 제거
      if (this.axisEntities.xAxis) this.viewer.entities.remove(this.axisEntities.xAxis);
      if (this.axisEntities.yAxis) this.viewer.entities.remove(this.axisEntities.yAxis);
      if (this.axisEntities.zAxis) this.viewer.entities.remove(this.axisEntities.zAxis);
      if (this.axisEntities.xLabel) this.viewer.entities.remove(this.axisEntities.xLabel);
      if (this.axisEntities.yLabel) this.viewer.entities.remove(this.axisEntities.yLabel);
      if (this.axisEntities.zLabel) this.viewer.entities.remove(this.axisEntities.zLabel);
      this.axisEntities = null;
    }
    
    if (this.antennaAxisEntities) {
      // 기존 안테나 축 제거
      if (this.antennaAxisEntities.xAxis) this.viewer.entities.remove(this.antennaAxisEntities.xAxis);
      if (this.antennaAxisEntities.yAxis) this.viewer.entities.remove(this.antennaAxisEntities.yAxis);
      if (this.antennaAxisEntities.zAxis) this.viewer.entities.remove(this.antennaAxisEntities.zAxis);
      if (this.antennaAxisEntities.xLabel) this.viewer.entities.remove(this.antennaAxisEntities.xLabel);
      if (this.antennaAxisEntities.yLabel) this.viewer.entities.remove(this.antennaAxisEntities.yLabel);
      if (this.antennaAxisEntities.zLabel) this.viewer.entities.remove(this.antennaAxisEntities.zLabel);
      this.antennaAxisEntities = null;
    }
    
    // 새로운 길이로 축 재생성
    if (this.currentCartesian) {
      this.createAxisLines();
    }
    if (this.antennaEntity) {
      this.createAntennaAxisLines();
    }
  }

  /**
   * BUS 엔티티 반환
   */
  getBusEntity(): any {
    return this.busEntity;
  }

  /**
   * 안테나 엔티티 반환
   */
  getAntennaEntity(): any {
    return this.antennaEntity;
  }

  /**
   * 안테나 중심의 ECEF Cartesian3 반환 (빔 방향선 등에 사용)
   */
  getAntennaCartesian(): any {
    if (!this.antennaEntity?.position) return null;
    try {
      return this.antennaEntity.position.getValue(Cesium.JulianDate.now());
    } catch {
      return null;
    }
  }

  /**
   * BUS 방향 (roll, pitch, yaw) 반환
   */
  getBusOrientation(): { rollAngle: number; pitchAngle: number; yawAngle: number } | null {
    return this.busOrientation ?? null;
  }

  /**
   * BUS 현재 ECEF 좌표 반환 (미니맵 축 표시 등에 사용)
   */
  getBusCartesian(): any {
    return this.currentCartesian ?? null;
  }

  /**
   * 축 계산용 옵션 반환 (미니맵 축 표시 등에 사용)
   */
  getAxisOptionsForMiniMap(): { busOrientation?: { rollAngle: number; pitchAngle: number; yawAngle: number } } & ReturnType<typeof this.getVelocityOptions> {
    return this.getAxisOptions();
  }

  /**
   * BUS Y축 방향 (정규화된 ECEF 단위 벡터) 반환. 안테나 축이 BUS와 동일하므로 Y축 지표면 직선 등에 사용
   */
  getBusYAxisDirection(): any {
    if (!this.currentCartesian) return null;
    const baseAxes = calculateBaseAxes(this.currentCartesian, this.getVelocityOptions());
    if (!baseAxes) return null;
    const bo = this.busOrientation ?? { rollAngle: 0, pitchAngle: 0, yawAngle: 0 };
    const axes = applyBusRollPitchYawToAxes(baseAxes, bo.rollAngle, bo.pitchAngle, bo.yawAngle);
    return Cesium.Cartesian3.normalize(axes.yAxis, new Cesium.Cartesian3());
  }

  /**
   * Y축이 지표면(WGS84)과 만나는 점 반환. 없으면 null
   */
  getYAxisGroundPoint(): { longitude: number; latitude: number; cartesian: any } | null {
    const antennaCartesian = this.getAntennaCartesian();
    const direction = this.getBusYAxisDirection();
    if (!antennaCartesian || !direction) return null;

    try {
      const cesiumAny = Cesium as any;
      const ray = new cesiumAny.Ray(antennaCartesian, direction);
      const intersection = cesiumAny.IntersectionTests?.rayEllipsoid?.(ray, Cesium.Ellipsoid.WGS84);
      if (!intersection) return null;

      const groundCartesian = cesiumAny.Ray?.getPoint?.(ray, intersection.start, new Cesium.Cartesian3());
      if (!groundCartesian) return null;

      const cartographic = Cesium.Cartographic.fromCartesian(groundCartesian);
      return {
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        cartesian: groundCartesian,
      };
    } catch {
      return null;
    }
  }

  /**
   * 방향 화살표 표시
   * @param direction 방향 ('bus_length' | 'bus_width' | 'bus_height' | 'antenna_height' | 'antenna_width' | 'antenna_depth' | 'antenna_gap' | 'antenna_roll' | 'antenna_pitch' | 'antenna_yaw' | 'antenna_elevation' | 'antenna_azimuth')
   */
  showDirectionArrows(direction: string): void {
    // 기존 화살표 제거
    this.removeDirectionArrows();

    if (!this.viewer || !this.currentCartesian || !this.busEntity) {
      return;
    }

    // 안테나 관련 방향인 경우 안테나 위치 Property 전달 (동적 업데이트를 위해)
    const isAntennaDirection = direction.startsWith('antenna_');
    let antennaPosition: any = undefined;
    
    if (isAntennaDirection && this.antennaEntity) {
      // 안테나 위치 Property를 직접 전달하여 CallbackProperty에서 사용할 수 있도록 함
      antennaPosition = this.antennaEntity.position;
    }

    const arrows = createDirectionArrows(
      this.viewer,
      this.currentCartesian,
      direction,
      antennaPosition,
      this.getVelocityOptions()
    );

    if (arrows) {
      this.directionArrows = arrows;
    }
  }

  /**
   * 방향 화살표 제거
   */
  removeDirectionArrows(): void {
    if (this.directionArrows) {
      if (this.directionArrows.positive) this.viewer.entities.remove(this.directionArrows.positive);
      if (this.directionArrows.negative) this.viewer.entities.remove(this.directionArrows.negative);
      if (this.directionArrows.positiveLabel) this.viewer.entities.remove(this.directionArrows.positiveLabel);
      if (this.directionArrows.negativeLabel) this.viewer.entities.remove(this.directionArrows.negativeLabel);
      this.directionArrows = null;
    }
  }
}
