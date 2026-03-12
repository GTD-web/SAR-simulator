---
name: SAR Simulator 역할 구분 문서화
overview: SAR Sensor Simulator와 Echo Simulator의 역할을 명확히 구분하고, 위성 위치/속도 정보가 어디서 필요한지 문서화합니다.
todos: []
isProject: false
---

# SAR Simulator 역할 구분 문서화

## 목표

SAR Sensor Simulator와 Echo Simulator의 역할을 명확히 구분하고, 위성 위치/속도 정보가 어디서 필요한지 문서화합니다.

## 핵심 내용

### 1. SAR Sensor Simulator (Chirp 생성)

- **역할**: LFM Chirp 신호 생성
- **필요한 파라미터**: 
                                        - `bw` (대역폭)
                                        - `taup` (펄스 폭)
                                        - `fs` (샘플링 주파수)
- **위성 위치/속도**: **불필요**
- **코드 위치**: `backend/sar_simulator/sensor/chirp_generator.py`

### 2. SAR Echo Simulator (Echo 생성)

- **역할**: Chirp 신호를 받아 타겟에서 반사된 Echo 신호 생성
- **필요한 파라미터**:
                                        - `chirp_signal` (Sensor Simulator에서 생성)
                                        - `target_list` (타겟 정보)
                                        - `satellite_position` (위성 위치, ECEF 좌표)
                                        - `satellite_velocity` (위성 속도, ECEF 좌표)
                                        - `beam_direction` (빔 방향, 선택적)
- **위성 위치/속도**: **필요**
                                        - 거리 계산: `R = ||target_position - satellite_position||`
                                        - 안테나 게인 계산: 타겟 방향 벡터 계산에 사용
                                        - 빔 방향 계산: 기본값 계산에 사용
                                        - 대기 손실 계산: 경로 계산에 사용
- **코드 위치**: `backend/sar_simulator/echo/echo_generator.py`

## 수정할 파일

### 1. `backend/docs/architecture.md`

- 섹션 "모듈 구조"에 각 Simulator의 입력 파라미터 명시
- 섹션 "데이터 흐름"에 위성 위치/속도 정보가 어디서 사용되는지 명시
- 새로운 섹션 추가: "입력 파라미터 요구사항"

### 2. `backend/docs/variable_nomenclature.md`

- 섹션 6 "위성 및 궤도 관련 변수"에 각 Simulator에서의 사용 여부 명시

## 구체적 수정 내용

### `backend/docs/architecture.md`

#### 섹션 1. Sensor 모듈 설명 보완

```markdown
### 1. Sensor 모듈 (`sar_simulator/sensor/`)

**ChirpGenerator**
- LFM Chirp 신호 생성
- 보간을 위한 Chirp 세트 생성
- **입력 파라미터**: `bw`, `taup`, `fs` (시스템 설정만 필요)
- **위성 위치/속도 불필요**: Chirp 신호는 순수하게 주파수 변조 신호만 생성

**SarSensorSimulator**
- Chirp 신호 생성 관리
- **입력 파라미터**: `SarSystemConfig` (위성 위치/속도 정보 불필요)
```

#### 섹션 2. Echo 모듈 설명 보완

```markdown
### 2. Echo 모듈 (`sar_simulator/echo/`)

**EchoGenerator**
- Chirp 신호를 받아 Echo 신호 생성
- 타겟 반사 모델링
- 전파 손실 계산
- **입력 파라미터**: 
  - `chirp_signal` (Sensor Simulator에서 생성)
  - `target_list` (타겟 정보)
  - `satellite_position` (위성 위치, ECEF 좌표) - **필수**
  - `satellite_velocity` (위성 속도, ECEF 좌표) - **필수**
  - `beam_direction` (빔 방향, 선택적)
- **위성 위치/속도 필요**: 거리 계산, 안테나 게인 계산, 시간 지연 계산에 사용

**SarEchoSimulator**
- Echo 신호 생성 관리
- 여러 펄스 처리
```

#### 새로운 섹션 추가: "입력 파라미터 요구사항"

```markdown
## 입력 파라미터 요구사항

### SAR Sensor Simulator
- **필요한 파라미터**: `bw`, `taup`, `fs` (시스템 설정)
- **불필요한 파라미터**: 위성 위치, 위성 속도, 타겟 정보
- **역할**: 순수하게 LFM Chirp 신호 생성

### SAR Echo Simulator
- **필요한 파라미터**:
  - `chirp_signal`: Sensor Simulator에서 생성된 Chirp 신호
  - `target_list`: 타겟 위치 및 반사도 정보
  - `satellite_position`: 위성 위치 (ECEF 좌표, 단위: m) - **필수**
  - `satellite_velocity`: 위성 속도 (ECEF 좌표, 단위: m/s) - **필수**
  - `beam_direction`: 빔 방향 벡터 (선택적, None인 경우 자동 계산)
- **역할**: 
  - 위성-타겟 간 거리 계산
  - 안테나 게인 계산
  - 시간 지연 계산
  - Echo 신호 생성
```

### `backend/docs/variable_nomenclature.md`

#### 섹션 6 "위성 및 궤도 관련 변수"에 사용 위치 명시

```markdown
| 변수명 | 설명 | 단위 | 수식/관계 | 코드에서 사용 | 사용 위치 |
|--------|------|------|-----------|---------------|-----------|
| `pos_t`, `satellite_position` | 위성 위치 (Satellite Position) | m | ECEF 좌표 `[x, y, z]` | `satellite_position` | **Echo Simulator만** |
| `vel_t`, `satellite_velocity` | 위성 속도 (Satellite Velocity) | m/s | ECEF 좌표 `[vx, vy, vz]` | `satellite_velocity` | **Echo Simulator만** |
```

## 검증 방법

1. 문서 읽기: 각 Simulator의 역할과 필요한 파라미터가 명확히 구분되어 있는지 확인
2. 코드 일치성 확인: 문서의 설명이 실제 코드 구현과 일치하는지 확인

