# CSCI 구조 정의서

## SAR Simulator (EchoSim)

**문서 번호:** ECHOSIM-CSCI-001  
**버전:** 3.2  
**작성일:** 2026-03-13  
**기술 기반:** MIL-STD-498 / DI-IPSC-81441A

---

## 1. CSCI 개요

| 항목 | 내용 |
|---|---|
| **CSCI 명칭** | SAR Simulator |
| **CSCI 식별자** | ECHOSIM |
| **목적** | SAR 위성의 궤도·자세·관측 기하를 3D 환경에서 시뮬레이션하고, Chirp 송신 신호를 생성하여 반환되는 Echo 신호를 SAR 처리 알고리즘으로 분석·영상화하는 데스크톱 소프트웨어 |
| **실행 환경** | 데스크톱 애플리케이션 (멀티 프로세스 렌더링 구조) |
| **외부 연동** | 3D 지구 시각화 엔진, 궤도 전파 라이브러리, SAR 신호 처리 서비스, 지리 정보 서비스 |

---

## 2. SAR 신호 처리 흐름

```
┌──────────────────────────────────────────────────────────────────┐
│                         SAR Simulator                            │
│                                                                  │
│  [위성 모델링] ◄──── [궤도 역학]                                 │
│  (CSC-2)              (CSC-1)                                    │
│       │                   │                                      │
│  자세/좌표 제공        위치/속도 제공                            │
│       │                   │                                      │
│       └──────────┬─────────┘                                     │
│                  ▼                                               │
│          [SAR 관측 기하]                                         │
│          (CSC-3)                                                 │
│                  │                                               │
│           Swath 기하 제공                                        │
│                  │                                               │
│                  ▼                                               │
│          [SAR 신호 생성]  ──Chirp 요청──► [외부 서비스 연동]     │
│          (CSC-4)                          (CSC-7)                │
│                                               │                  │
│                                          Echo 신호 반환          │
│                                               │                  │
│                                               ▼                  │
│                                   [SAR 원시 신호 처리]           │
│                                   (CSC-5)                        │
│                                               │                  │
│                                      압축 입력 데이터            │
│                                               │                  │
│                                               ▼                  │
│                                   [SAR 영상 처리]                │
│                                   (CSC-6)                        │
│                                               │                  │
│              ◄────────── 모든 시각화 결과 ────┘                  │
│         [시각화 엔진]                                            │
│         (CSC-8)                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. CSCI 계층 구조

```
CSCI: SAR Simulator (ECHOSIM)
│
│  ── 알고리즘 영역 ──────────────────────────────────────────────
│
├── CSC-1: 궤도 역학 (Orbital Mechanics)
│   ├── CSU-1.1: 궤도 계산기 (Orbit Calculator)
│   ├── CSU-1.2: 궤도 데이터 변환기 (Orbit Data Converter)
│   └── CSU-1.3: 궤도 시뮬레이션 관리자 (Orbit Simulation Manager)
│
├── CSC-2: 위성 모델링 (Satellite Modeling)
│   ├── CSU-2.1: 위성 자세 계산기 (Satellite Attitude Calculator)
│   └── CSU-2.2: 위성 파라미터 관리자 (Satellite Parameter Manager)
│
├── CSC-3: SAR 관측 기하 (SAR Observation Geometry)
│   ├── CSU-3.1: 관측 기하 계산기 (Observation Geometry Calculator)
│   └── CSU-3.2: 타겟 환경 분석기 (Target Environment Analyzer)
│
├── CSC-4: SAR 신호 생성 (SAR Signal Generation)
│   ├── CSU-4.1: 송신 파라미터 관리자 (Transmit Parameter Manager)
│   ├── CSU-4.2: Chirp 파형 생성기 (Chirp Waveform Generator)
│   └── CSU-4.3: 펄스 시퀀스 관리자 (Pulse Sequence Manager)
│
├── CSC-5: SAR 원시 신호 처리 (SAR Raw Signal Processing)
│   ├── CSU-5.1: Echo 신호 수신기 (Echo Signal Receiver)
│   ├── CSU-5.2: 원시 신호 관리자 (Raw Signal Manager)
│   └── CSU-5.3: 거리-도플러 변환기 (Range-Doppler Converter)
│
├── CSC-6: SAR 영상 처리 (SAR Image Processing)
│   ├── CSU-6.1: 거리 방향 압축기 (Range Compression Processor)
│   ├── CSU-6.2: 방위 방향 압축기 (Azimuth Compression Processor)
│   └── CSU-6.3: SAR 영상 형성기 (SAR Image Formation Processor)
│
│  ── I/O 영역 ───────────────────────────────────────────────────
│
├── CSC-7: 외부 서비스 연동 (External Service Integration)
│   ├── CSU-7.1: 궤도 데이터 서비스 클라이언트 (Orbit Data Service Client)
│   ├── CSU-7.2: SAR 신호 처리 서비스 클라이언트 (SAR Signal Processing Service Client)
│   └── CSU-7.3: 위성 상태 데이터 서비스 클라이언트 (Satellite State Data Service Client)
│
│  ── GUI 영역 ───────────────────────────────────────────────────
│
└── CSC-8: 시각화 엔진 (Visualization Engine)
    ├── CSU-8.1: 지구 환경 뷰어 (Earth Environment Viewer)
    ├── CSU-8.2: 카메라 제어기 (Camera Controller)
    ├── CSU-8.3: 위성 형상 관리자 (Satellite Geometry Manager)
    ├── CSU-8.4: 궤도 경로 시각화기 (Orbit Path Visualizer)
    ├── CSU-8.5: 관측 기하 시각화기 (Observation Geometry Visualizer)
    └── CSU-8.6: SAR 결과 영상 출력기 (SAR Result Image Output)
```

### 계층 구조 테이블

| CSCI | 영역 | CSC ID | CSC 명칭 | CSU ID | CSU 명칭 | 구현 상태 |
|---|---|---|---|---|---|---|
| SAR Simulator | 알고리즘 | CSC-1 | 궤도 역학 (Orbital Mechanics) | CSU-1.1 | 궤도 계산기 (Orbit Calculator) | 완료 |
| | | | | CSU-1.2 | 궤도 데이터 변환기 (Orbit Data Converter) | 완료 |
| | | | | CSU-1.3 | 궤도 시뮬레이션 관리자 (Orbit Simulation Manager) | 완료 |
| | | CSC-2 | 위성 모델링 (Satellite Modeling) | CSU-2.1 | 위성 자세 계산기 (Satellite Attitude Calculator) | 완료 |
| | | | | CSU-2.2 | 위성 파라미터 관리자 (Satellite Parameter Manager) | 완료 |
| | | CSC-3 | SAR 관측 기하 (SAR Observation Geometry) | CSU-3.1 | 관측 기하 계산기 (Observation Geometry Calculator) | 완료 |
| | | | | CSU-3.2 | 타겟 환경 분석기 (Target Environment Analyzer) | 완료 |
| | | CSC-4 | SAR 신호 생성 (SAR Signal Generation) | CSU-4.1 | 송신 파라미터 관리자 (Transmit Parameter Manager) | 완료 |
| | | | | CSU-4.2 | Chirp 파형 생성기 (Chirp Waveform Generator) | 완료 |
| | | | | CSU-4.3 | 펄스 시퀀스 관리자 (Pulse Sequence Manager) | 완료 |
| | | CSC-5 | SAR 원시 신호 처리 (SAR Raw Signal Processing) | CSU-5.1 | Echo 신호 수신기 (Echo Signal Receiver) | 완료 |
| | | | | CSU-5.2 | 원시 신호 관리자 (Raw Signal Manager) | 완료 |
| | | | | CSU-5.3 | 거리-도플러 변환기 (Range-Doppler Converter) | 완료 |
| | | CSC-6 | SAR 영상 처리 (SAR Image Processing) | CSU-6.1 | 거리 방향 압축기 (Range Compression Processor) | **예정** |
| | | | | CSU-6.2 | 방위 방향 압축기 (Azimuth Compression Processor) | **예정** |
| | | | | CSU-6.3 | SAR 영상 형성기 (SAR Image Formation Processor) | **예정** |
| | I/O | CSC-7 | 외부 서비스 연동 (External Service Integration) | CSU-7.1 | 궤도 데이터 서비스 클라이언트 (Orbit Data Service Client) | 완료 |
| | | | | CSU-7.2 | SAR 신호 처리 서비스 클라이언트 (SAR Signal Processing Service Client) | 완료 |
| | | | | CSU-7.3 | 위성 상태 데이터 서비스 클라이언트 (Satellite State Data Service Client) | 완료 |
| | GUI | CSC-8 | 시각화 엔진 (Visualization Engine) | CSU-8.1 | 지구 환경 뷰어 (Earth Environment Viewer) | 완료 |
| | | | | CSU-8.2 | 카메라 제어기 (Camera Controller) | 완료 |
| | | | | CSU-8.3 | 위성 형상 관리자 (Satellite Geometry Manager) | 완료 |
| | | | | CSU-8.4 | 궤도 경로 시각화기 (Orbit Path Visualizer) | 완료 |
| | | | | CSU-8.5 | 관측 기하 시각화기 (Observation Geometry Visualizer) | 완료 |
| | | | | CSU-8.6 | SAR 결과 영상 출력기 (SAR Result Image Output) | **예정** |

---

## 4. CSC 및 CSU 상세 정의

### CSC-1: 궤도 역학

**목적:** 케플러 궤도 6요소 기반 궤도 데이터를 생성·변환하고, 분석적 궤도 전파 모델로 위성 위치를 실시간 계산한다.

| CSU ID | CSU 명칭 | 소스 파일 | 기능 설명 |
|---|---|---|---|
| CSU-1.1 | 궤도 계산기 | `OrbitSettings/_util/orbit-calculator.ts`, `tle-position-util.ts` | 케플러 방정식 기반 ECI 위치/속도 계산, ECI→ECEF 변환, 분석적 궤도 전파 모델(SGP4/SDP4)로 시각별 위성 위치 계산 |
| CSU-1.2 | 궤도 데이터 변환기 | `OrbitSettings/_util/orbital-elements-to-tle.ts`, `tle-to-orbital-elements.ts` | 궤도 6요소 ↔ 표준 2줄 궤도 데이터(TLE) 상호 변환 |
| CSU-1.3 | 궤도 시뮬레이션 관리자 | `OrbitSettings/index.ts` | 궤도 전파 시뮬레이션 루프 제어, 초기 배치 위치/속도 제공 |

---

### CSC-2: 위성 모델링

**목적:** 위성 BUS와 SAR 안테나의 자세·좌표계를 계산하고 파라미터 변경을 관리한다.

| CSU ID | CSU 명칭 | 소스 파일 | 기능 설명 |
|---|---|---|---|
| CSU-2.1 | 위성 자세 계산기 | `SatelliteBusPayloadManager/_util/base-axes-calculator.ts`, `axis-position-calculator.ts`, `antenna-orientation-calculator.ts` | ECEF 기저 벡터 계산. 안테나 Roll/Pitch/Yaw 및 앙각/방위각을 사원수(쿼터니언)로 변환 |
| CSU-2.2 | 위성 파라미터 관리자 | `SatelliteSettings/_util/entity-creator.ts`, `entity-updater.ts`, `input-parser.ts` | 위성 위치·BUS 크기·안테나 자세 파라미터 수신 및 변경 조율 |

---

### CSC-3: SAR 관측 기하

**목적:** SAR 관측 모드에 따른 안테나-타겟 간 기하 관계를 계산하고, 타겟 지역 환경 정보를 분석한다.

| CSU ID | CSU 명칭 | 소스 파일 | 기능 설명 |
|---|---|---|---|
| CSU-3.1 | 관측 기하 계산기 | `sar-target-calculator.ts`, `sar-swath-calculator.ts`, `swath-param-calculator.ts`, `sar-grid-to-cesium.ts`, `swath-to-target-converter.ts` | SAR 커버리지 산출, Swath 4코너 지리 좌표 계산, 격자 좌표 변환, 스와스-타겟 좌표 변환 |
| CSU-3.2 | 타겟 환경 분석기 | `sar-region-payload.ts`, `overpass-buildings.ts` | 지형 고도 샘플링(DEM), 경사·사면 방향 계산, 지질 환경 추론, 관심 영역 내 건물 데이터 수집 |

---

### CSC-4: SAR 신호 생성

**목적:** SAR 송신 파라미터를 관리하고 Chirp(선형 주파수 변조) 파형을 생성하여 Echo 시뮬레이션의 입력 데이터를 제공한다.

| CSU ID | CSU 명칭 | 소스 파일 | 기능 설명 |
|---|---|---|---|
| CSU-4.1 | 송신 파라미터 관리자 | `src/poc/managers/SwathManager.ts` | SAR 송신 파라미터(펄스폭·반복 주파수·신호 대역폭·앙각·방위각) 관리 |
| CSU-4.2 | Chirp 파형 생성기 | `src/poc/utils/chirp-api-client.ts` | 설정된 파라미터를 기반으로 Chirp 송신 파형 생성 요청 및 결과 수신 |
| CSU-4.3 | 펄스 시퀀스 관리자 | `src/poc/managers/SwathGroupManager.ts` | 다중 관측 시나리오(Swath 그룹)별 펄스 시퀀스 생성·관리·전환 |

---

### CSC-5: SAR 원시 신호 처리

**목적:** 타겟으로부터 반환된 Echo 신호를 수신·저장하고, 거리-도플러 도메인으로 변환하여 SAR 영상 처리의 입력 데이터를 생성한다.

| CSU ID | CSU 명칭 | 소스 파일 | 기능 설명 |
|---|---|---|---|
| CSU-5.1 | Echo 신호 수신기 | `src/poc/utils/echo-api-client.ts` | 타겟으로부터 반환된 Echo 신호를 외부 서비스로부터 수신 |
| CSU-5.2 | 원시 신호 관리자 | `src/poc/managers/PulseStorageManager.ts`, `src/poc/utils/satellite-state-helper.ts` | 수신된 SAR 펄스 데이터를 시간 순서에 따라 저장·조회. 관측 시간대별 위성 상태와 신호를 연관하여 이력 관리 |
| CSU-5.3 | 거리-도플러 변환기 | `src/poc/utils/signal-data-processor.ts` | 수신 원시 신호에 대해 거리 방향 FFT 및 도플러 이력 추출 수행 |

---

### CSC-6: SAR 영상 처리

**목적:** 거리-도플러 도메인 원시 데이터에 압축 알고리즘을 순차 적용하여 SAR 반사 강도 영상을 형성한다.

| CSU ID | CSU 명칭 | 소스 파일 | 기능 설명 |
|---|---|---|---|
| CSU-6.1 | 거리 방향 압축기 | *(구현 예정)* | 거리 방향 매칭 필터(Matched Filter)를 적용하여 거리 방향 해상도 향상 |
| CSU-6.2 | 방위 방향 압축기 | *(구현 예정)* | 합성 개구 처리(Synthetic Aperture Processing)를 통해 방위 방향 해상도 향상 |
| CSU-6.3 | SAR 영상 형성기 | *(구현 예정)* | 거리·방위 방향 압축 결과를 결합하여 SAR 반사 강도 영상(Complex Image) 생성 |

---

### CSC-7: 외부 서비스 연동

**목적:** 궤도 데이터, SAR 신호 처리(Chirp/Echo), 위성 상태 정보를 외부 시스템으로부터 수신하는 연동 인터페이스를 제공한다.

| CSU ID | CSU 명칭 | 소스 파일 | 기능 설명 |
|---|---|---|---|
| CSU-7.1 | 궤도 데이터 서비스 클라이언트 | `src/poc/utils/tle-api-client.ts` | 외부 궤도 데이터 제공 서비스 호출. 표준 궤도 데이터(TLE) 수신 |
| CSU-7.2 | SAR 신호 처리 서비스 클라이언트 | `src/poc/utils/chirp-api-client.ts`, `echo-api-client.ts` | Chirp 파형 생성 및 Echo 신호 수신 외부 서비스 호출 |
| CSU-7.3 | 위성 상태 데이터 서비스 클라이언트 | `src/poc/utils/satellite-api-client.ts` | 위성 상태 데이터(위치·속도·자세) 외부 서비스 호출 |

---

### CSC-8: 시각화 엔진

**목적:** 3D 지구 환경, 위성 형상, 궤도 경로, SAR 관측 기하, 처리 결과 영상 등 시스템 내 모든 시각적 출력을 통합 관리한다.

| CSU ID | CSU 명칭 | 소스 파일 | 기능 설명 |
|---|---|---|---|
| CSU-8.1 | 지구 환경 뷰어 | `src/poc/cesium/CesiumViewerManager.ts`, `ImageryManager.ts`, `BuildingManager.ts` | 3D 지구 시각화 엔진 초기화. 위성영상 타일 레이어 및 3D 건물 타일 데이터 로드·관리 |
| CSU-8.2 | 카메라 제어기 | `src/poc/cesium/CameraManager.ts` | 카메라 이동·시점·추적 제어. 위성·지구·관측 영역 기준 카메라 전환 |
| CSU-8.3 | 위성 형상 관리자 | `SatelliteBusPayloadManager/_ui/entity-creator.ts`, `axis-creator.ts` | BUS 및 SAR 안테나 3D 객체 생성·갱신. XYZ 좌표축 3D 표현 관리 |
| CSU-8.4 | 궤도 경로 시각화기 | `OrbitSettings/_util/orbit-path-manager.ts` | 시뮬레이션 현재 시각 기준 전후 궤도 폴리라인 3D 객체 생성·갱신 |
| CSU-8.5 | 관측 기하 시각화기 | `attitude-mini-map-viewer.ts`, `swath-mini-map-viewer.ts`, `prototype-swath-preview.ts` | 위성 자세 및 Swath 영역을 독립 미니맵과 메인 뷰어에 실시간 오버레이 표시 |
| CSU-8.6 | SAR 결과 영상 출력기 | *(구현 예정)* | 형성된 SAR 영상을 지리 좌표에 투영하여 3D 뷰어에 표시 |

---

## 5. CSC 간 인터페이스 관계

```
CSC-7 (외부 서비스 연동)
  ├──궤도 데이터──────────────────────► CSC-1 (궤도 역학)
  │                                          │
  │                                     위치/속도 제공
  │                                          │
  └──위성 상태 데이터──► CSC-2 (위성 모델링) │
                              │              │
                         자세/좌표 제공       │
                              │              ▼
                              └─────────► CSC-3 (SAR 관측 기하)
                                               │
                                        Swath 기하 제공
                                               │
                                               ▼
                              CSC-4 (SAR 신호 생성) ──Chirp 요청──► CSC-7
                                                                         │
                                                                    Echo 반환
                                                                         │
                                                                         ▼
                                                           CSC-5 (SAR 원시 신호 처리)
                                                                         │
                                                                  압축 입력 데이터
                                                                         │
                                                                         ▼
                                                              CSC-6 (SAR 영상 처리)
                                                                         │
                                        ┌────────────────────────────────┘
                                        │  (모든 시각화 결과 수렴)
                               CSC-1 ───┤
                               CSC-2 ───┤──► CSC-8 (시각화 엔진)
                               CSC-3 ───┤
                               CSC-6 ───┘
```

---

## 6. CSC 구현 상태 요약

| CSC ID | 영역 | CSC 명칭 | CSU 수 | 구현 상태 |
|---|---|---|---|---|
| CSC-1 | 알고리즘 | 궤도 역학 | 3 | 구현 완료 |
| CSC-2 | 알고리즘 | 위성 모델링 | 2 | 구현 완료 |
| CSC-3 | 알고리즘 | SAR 관측 기하 | 2 | 구현 완료 |
| CSC-4 | 알고리즘 | SAR 신호 생성 | 3 | 구현 완료 |
| CSC-5 | 알고리즘 | SAR 원시 신호 처리 | 3 | 구현 완료 |
| CSC-6 | 알고리즘 | SAR 영상 처리 | 3 | **구현 예정** |
| CSC-7 | I/O | 외부 서비스 연동 | 3 | 구현 완료 |
| CSC-8 | GUI | 시각화 엔진 | 6 | 완료 (CSU-8.6 예정) |

---

*문서 끝*
