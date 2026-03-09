/**
 * SatelliteSettings 모듈 상수 정의
 */

// 타이머 관련 상수 (밀리초)
export const TIMER = {
  /** 입력 디바운스 시간 */
  DEBOUNCE_DELAY: 300,
  /** 카메라 준비 대기 시간 */
  CAMERA_READY_DELAY: 500,
  /** 카메라 애니메이션 취소 후 대기 시간 */
  CAMERA_ANIMATION_CANCEL_DELAY: 100,
  /** 입력 필드 포커스 복원 대기 시간 */
  INPUT_FOCUS_RESTORE_DELAY: 100,
  /** 엔티티 생성 완료 대기 시간 */
  ENTITY_CREATION_DELAY: 500,
  /** 엔티티 생성 후 카메라 설정 대기 시간 */
  ENTITY_CREATION_CAMERA_DELAY: 300,
  /** 카메라 초기화 대기 시간 */
  CAMERA_INIT_DELAY: 1000,
  /** 카메라 이동 확인 간격 */
  CAMERA_CHECK_INTERVAL: 200,
  /** 입력 필드 블러 이벤트 지연 시간 */
  INPUT_BLUR_DELAY: 200,
} as const;

// 기본 위치값
export const DEFAULT_POSITION = {
  /** 기본 경도 (도) */
  LONGITUDE: 127.5,
  /** 기본 위도 (도) */
  LATITUDE: 37.5,
  /** 기본 고도 (km) */
  ALTITUDE_KM: 500000,
} as const;

// 기본 BUS 크기 (mm)
export const DEFAULT_BUS_DIMENSIONS_MM = {
  /** BUS 길이 (mm) */
  LENGTH: 800,
  /** BUS 너비 (mm) */
  WIDTH: 700,
  /** BUS 높이 (mm) */
  HEIGHT: 840,
} as const;

// 기본 BUS 방향 (도) - createSatellite busOrientation 형식과 동일
export const DEFAULT_BUS_ORIENTATION = {
  /** Roll 각도 (도) - X축 회전 */
  rollAngle: 45,
  /** Pitch 각도 (도) - Y축 회전 */
  pitchAngle: 0,
  /** Yaw 각도 (도) - Z축 회전 */
  yawAngle: 0,
} as const;

// 기본 BUS 크기 (미터) - Cesium에서 사용
export const DEFAULT_BUS_DIMENSIONS_M = {
  /** BUS 길이 (m) */
  LENGTH: DEFAULT_BUS_DIMENSIONS_MM.LENGTH / 1000,
  /** BUS 너비 (m) */
  WIDTH: DEFAULT_BUS_DIMENSIONS_MM.WIDTH / 1000,
  /** BUS 높이 (m) */
  HEIGHT: DEFAULT_BUS_DIMENSIONS_MM.HEIGHT / 1000,
} as const;

// 기본 안테나 크기 (mm)
export const DEFAULT_ANTENNA_DIMENSIONS_MM = {
  /** 안테나 높이 (mm) */
  HEIGHT: 800,
  /** 안테나 너비 (mm) */
  WIDTH: 2410,
  /** 안테나 두께 (mm) */
  DEPTH: 100,
} as const;

// 기본 안테나 크기 (미터) - Cesium에서 사용
export const DEFAULT_ANTENNA_DIMENSIONS_M = {
  /** 안테나 높이 (m) */
  HEIGHT: DEFAULT_ANTENNA_DIMENSIONS_MM.HEIGHT / 1000,
  /** 안테나 너비 (m) */
  WIDTH: DEFAULT_ANTENNA_DIMENSIONS_MM.WIDTH / 1000,
  /** 안테나 두께 (m) */
  DEPTH: DEFAULT_ANTENNA_DIMENSIONS_MM.DEPTH / 1000,
} as const;

// 기본 안테나 간격 (mm)
export const DEFAULT_ANTENNA_GAP_MM = 100;

// 기본 안테나 간격 (미터) - Cesium에서 사용
export const DEFAULT_ANTENNA_GAP_M = DEFAULT_ANTENNA_GAP_MM / 1000;

// 기본 안테나 방향 (도)
export const DEFAULT_ANTENNA_ORIENTATION = {
  /** Roll 각도 (도) */
  ROLL: 0,
  /** Pitch 각도 (도) */
  PITCH: 0,
  /** Yaw 각도 (도) */
  YAW: 0,
  /** 초기 Elevation 각도 (도) */
  INITIAL_ELEVATION: 0,
  /** 초기 Azimuth 각도 (도) */
  INITIAL_AZIMUTH: 0,
} as const;

// 기본 위성 정보
export const DEFAULT_SATELLITE_INFO = {
  /** 기본 위성 이름 */
  NAME: 'Satellite-1',
  /** 기본 위성 ID */
  ID: 'SAT-001',
} as const;

// 카메라 설정
export const CAMERA = {
  /** Heading 각도 (도) - 대각선 방향 */
  HEADING_DEGREES: 45,
  /** Pitch 각도 (도) - 위에서 내려다보기 */
  PITCH_DEGREES: -45,
  /** Pitch 각도 (도) - 수평선에 가까운 대각선 뷰 (moveSatelliteToEarth에서 사용) */
  PITCH_DEGREES_HORIZONTAL: 0,
  /** 카메라 애니메이션 시간 (초) */
  ANIMATION_DURATION: 1.5,
  /** 카메라 거리 배수 (BUS 크기의 배수) */
  RANGE_MULTIPLIER: 10,
  /** 최소 카메라 거리 (미터) */
  MIN_RANGE: 3,
  /** 최소 카메라 거리 (미터) - moveSatelliteToEarth에서 사용 */
  MIN_RANGE_HORIZONTAL: 20,
  /** 카메라 거리 배수 (BUS 크기의 배수) - moveSatelliteToEarth에서 사용 */
  RANGE_MULTIPLIER_HORIZONTAL: 3,
} as const;

// 위치 검증 범위
export const POSITION_VALIDATION = {
  /** 경도 최소값 */
  LONGITUDE_MIN: -180,
  /** 경도 최대값 */
  LONGITUDE_MAX: 180,
  /** 위도 최소값 */
  LATITUDE_MIN: -90,
  /** 위도 최대값 */
  LATITUDE_MAX: 90,
  /** 고도 최소값 (km) */
  ALTITUDE_MIN_KM: 0,
} as const;
