// Cesium 전역 타입 선언
declare namespace Cesium {
  namespace Math {
    function toRadians(degrees: number): number;
    function toDegrees(radians: number): number;
  }
  
  namespace Cartesian3 {
    function fromDegrees(longitude: number, latitude: number, height?: number): Cartesian3;
    function fromDegreesArrayHeights(coordinates: number[]): Cartesian3[];
    function fromRadians(longitude: number, latitude: number, height?: number, result?: Cartesian3): Cartesian3;
    function normalize(cartesian: Cartesian3, result?: Cartesian3): Cartesian3;
    function multiplyByScalar(cartesian: Cartesian3, scalar: number, result?: Cartesian3): Cartesian3;
    function add(left: Cartesian3, right: Cartesian3, result?: Cartesian3): Cartesian3;
    function subtract(left: Cartesian3, right: Cartesian3, result?: Cartesian3): Cartesian3;
    function cross(left: Cartesian3, right: Cartesian3, result?: Cartesian3): Cartesian3;
    function distance(left: Cartesian3, right: Cartesian3): number;
    function lerp(start: Cartesian3, end: Cartesian3, t: number, result?: Cartesian3): Cartesian3;
    function negate(cartesian: Cartesian3, result?: Cartesian3): Cartesian3;
    function magnitude(cartesian: Cartesian3): number;
    function dot(left: Cartesian3, right: Cartesian3): number;
  }
  class Cartesian3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    clone(result?: Cartesian3): Cartesian3;
  }
  
  namespace Cartesian2 {
    function fromElements(x: number, y: number, result?: Cartesian2): Cartesian2;
  }
  class Cartesian2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
  }
  
  namespace Cartographic {
    function fromCartesian(cartesian: Cartesian3, ellipsoid?: any, result?: Cartographic): Cartographic;
    function fromDegrees(longitude: number, latitude: number, height?: number, result?: Cartographic): Cartographic;
    function toCartesian(cartographic: Cartographic, ellipsoid?: any, result?: Cartesian3): Cartesian3;
  }
  class Cartographic {
    longitude: number;
    latitude: number;
    height: number;
  }
  
  namespace JulianDate {
    function now(): any;
    function fromDate(date: Date, result?: any): any;
    function addMinutes(julianDate: any, minutes: number, result?: any): any;
    function addSeconds(julianDate: any, seconds: number, result?: any): any;
    function toDate(julianDate: any): Date;
  }
  class JulianDate {
    constructor(julianDayNumber?: number, secondsOfDay?: number);
  }
  
  namespace Quaternion {
    function fromAxisAngle(axis: Cartesian3, angle: number, result?: Quaternion): Quaternion;
    function multiply(left: Quaternion, right: Quaternion, result?: Quaternion): Quaternion;
    function fromRotationMatrix(matrix: Matrix3, result?: Quaternion): Quaternion;
    const IDENTITY: Quaternion;
  }
  class Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
  }
  
  namespace Matrix3 {
    function fromQuaternion(quaternion: Quaternion, result?: Matrix3): Matrix3;
    function multiplyByVector(matrix: Matrix3, cartesian: Cartesian3, result?: Cartesian3): Cartesian3;
    function fromColumnMajorArray(values: number[], result?: Matrix3): Matrix3;
  }
  class Matrix3 {
    constructor(
      column0Row0?: number, column1Row0?: number, column2Row0?: number,
      column0Row1?: number, column1Row1?: number, column2Row1?: number,
      column0Row2?: number, column1Row2?: number, column2Row2?: number
    );
  }
  
  // Viewer 및 기타 클래스들
  class Viewer {
    constructor(container: string | HTMLElement, options?: any);
    cesiumWidget: any;
    clock: any;
    scene: any;
  }
  
  namespace Terrain {
    function fromWorldTerrain(options?: any): any;
  }
  
  enum ClockRange {
    CLAMPED = 0,
    UNBOUNDED = 1,
    LOOP_STOP = 2
  }
  
  // Color 관련
  namespace Color {
    function fromCssColorString(color: string, result?: Color): Color;
    const YELLOW: Color;
    const WHITE: Color;
    const BLACK: Color;
    const CYAN: Color;
    const RED: Color;
    const GREEN: Color;
    const BLUE: Color;
    const ORANGE: Color;
    const PURPLE: Color;
    const GRAY: Color;
    const TRANSPARENT: Color;
  }
  class Color {
    red: number;
    green: number;
    blue: number;
    alpha: number;
    withAlpha(alpha: number, result?: Color): Color;
  }
  
  // Property 관련
  class CallbackProperty {
    constructor(callback: () => any, isConstant?: boolean);
  }
  
  class ConstantProperty {
    constructor(value: any);
  }
  
  class ConstantPositionProperty {
    constructor(value: Cartesian3);
  }
  
  class VelocityOrientationProperty {
    constructor(position: any, ellipsoid?: any);
  }
  
  // Material 관련
  class PolylineGlowMaterialProperty {
    constructor(options?: any);
  }
  
  // Geometry 관련
  class PolygonHierarchy {
    constructor(positions: Cartesian3[], holes?: PolygonHierarchy[]);
    positions: Cartesian3[];
    holes?: PolygonHierarchy[];
  }
  
  namespace GeometryInstance {
    function fromGeometry(geometry: any, attributes?: any, id?: any): any;
  }
  class GeometryInstance {
    constructor(options?: any);
  }
  
  namespace PolygonGeometry {
    function fromPositions(positions: Cartesian3[], options?: any): any;
  }
  class PolygonGeometry {
    constructor(options?: any);
  }
  
  class GroundPrimitive {
    constructor(options?: any);
  }
  
  namespace ColorGeometryInstanceAttribute {
    function fromColor(color: Color, result?: any): any;
  }
  
  class PerInstanceColorAppearance {
    constructor(options?: any);
  }
  
  // Imagery 관련
  namespace ImageryLayer {
    function fromProviderAsync(imageryProvider: any, options?: any): Promise<ImageryLayer>;
  }
  class ImageryLayer {
    constructor(imageryProvider: any, options?: any);
  }
  
  namespace IonImageryProvider {
    function fromAssetId(assetId: number, options?: any): IonImageryProvider;
  }
  class IonImageryProvider {
    constructor(options?: any);
  }
  
  // Buildings 관련
  function createOsmBuildingsAsync(options?: any): Promise<any>;

  // Terrain
  function sampleTerrainMostDetailed(terrainProvider: any, positions: Cartographic[]): Promise<Cartographic[]>;

  // 3D Tiles
  class Cesium3DTileset {
    root: any;
  }
  class BoundingSphere {
    constructor(center: Cartesian3, radius?: number);
    center: Cartesian3;
    radius: number;
  }
  
  // Enum 관련
  enum ArcType {
    NONE = 0,
    GEODESIC = 1,
    RHUMB = 2
  }
  
  enum ClassificationType {
    TERRAIN = 0,
    CESIUM_3D_TILE = 1,
    BOTH = 2
  }
  
  enum LabelStyle {
    FILL = 0,
    OUTLINE = 1,
    FILL_AND_OUTLINE = 2
  }
  
  enum VerticalOrigin {
    BOTTOM = 0,
    CENTER = 1,
    TOP = 2,
    BASELINE = 3
  }
  
  enum HorizontalOrigin {
    LEFT = 0,
    CENTER = 1,
    RIGHT = 2
  }
  
  enum HeightReference {
    NONE = 0,
    CLAMP_TO_GROUND = 1,
    RELATIVE_TO_GROUND = 2
  }
  
  class NearFarScalar {
    constructor(near?: number, nearValue?: number, far?: number, farValue?: number);
  }
  
  // ScreenSpaceEventHandler 관련
  class ScreenSpaceEventHandler {
    constructor(element: HTMLElement | HTMLCanvasElement);
    setInputAction(action: (event: any) => void, type: ScreenSpaceEventType, modifier?: KeyboardEventModifier): void;
    destroy(): void;
  }
  
  enum ScreenSpaceEventType {
    LEFT_DOWN = 0,
    LEFT_UP = 1,
    LEFT_CLICK = 2,
    LEFT_DOUBLE_CLICK = 3,
    RIGHT_DOWN = 4,
    RIGHT_UP = 5,
    RIGHT_CLICK = 6,
    MIDDLE_DOWN = 7,
    MIDDLE_UP = 8,
    MIDDLE_CLICK = 9,
    MOUSE_MOVE = 10,
    WHEEL = 11,
    PINCH_START = 12,
    PINCH_END = 13,
    PINCH_MOVE = 14
  }
  
  enum KeyboardEventModifier {
    SHIFT = 1,
    CTRL = 2,
    ALT = 4
  }
  
  // HeadingPitchRange 관련
  class HeadingPitchRange {
    constructor(heading?: number, pitch?: number, range?: number);
    heading: number;
    pitch: number;
    range: number;
  }
  
  class HeadingPitchRoll {
    constructor(heading?: number, pitch?: number, roll?: number);
    heading: number;
    pitch: number;
    roll: number;
  }
  
  // Transforms 관련
  namespace Transforms {
    function headingPitchRollQuaternion(position: Cartesian3, headingPitchRoll: HeadingPitchRoll, result?: Quaternion): Quaternion;
    function eastNorthUpToFixedFrame(origin: Cartesian3, ellipsoid?: any, result?: Matrix4): Matrix4;
  }
  class Cartesian4 {
    constructor(x?: number, y?: number, z?: number, w?: number);
    x: number;
    y: number;
    z: number;
    w: number;
  }
  namespace Matrix4 {
    function multiplyByPoint(matrix: Matrix4, cartesian: Cartesian3, result?: Cartesian3): Cartesian3;
    function getColumn(matrix: Matrix4, index: number, result: Cartesian4): Cartesian4;
  }
  class Matrix4 {
    constructor(column0Row0?: number, column1Row0?: number, column2Row0?: number, column3Row0?: number, column0Row1?: number, column1Row1?: number, column2Row1?: number, column3Row1?: number, column0Row2?: number, column1Row2?: number, column2Row2?: number, column3Row2?: number, column0Row3?: number, column1Row3?: number, column2Row3?: number, column3Row3?: number);
  }
  namespace Ellipsoid {
    const WGS84: Ellipsoid;
  }
  class Ellipsoid {
    constructor(x?: number, y?: number, z?: number);
  }
  
  // Camera 관련
  class Camera {
    position: Cartesian3;
    orientation: Quaternion;
    lookAt(target: Cartesian3, offset: HeadingPitchRange | Cartesian3): void;
    flyTo(options: {
      destination?: Cartesian3;
      orientation?: {
        heading?: number;
        pitch?: number;
        roll?: number;
      };
      duration?: number;
    }): void;
  }
}
declare var Cesium: typeof Cesium;
declare var satellite: any;
