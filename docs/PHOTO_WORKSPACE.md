# PNG 작업대 구조와 확장

현재 진입점은 `src/app/App.tsx`이며, `src/main.tsx`가 React Flow 기본 스타일과 `styles/workspace.css`를 로드합니다. 폴더 구조·실행·파일명 목록은 [프로젝트 README](../README.md)에 있습니다.

## 타입과 설정

| 타입 | 역할 |
| --- | --- |
| `CircuitMode` | sequence / digital |
| `ComponentAsset` | 정적 PNG 경로, 파일명, 기본 크기, 단자, 조작 영역, 시각 오버레이 |
| `PhotoPinDefinition` | ID·라벨·역할·백분율 중심 좌표·내부 bus |
| `ControlDefinition` | 누름 버튼, 토글, 시간/전압 다이얼, 전원 버튼의 백분율 bounds |
| `PercentPoint` / `PercentRect` | 이미지 기준 0–100의 좌표 / 사각형 |
| `CircuitComponent` | 배치 ID, 에셋 참조, 월드 좌표(px), 개별 조작 설정 |
| `CircuitWire` / `PinRef` | 전선 색상과 양 끝의 부품 ID·단자 ID |
| `PowerState` | 메인 전원 상태와 설정 전압 |
| `ShortCircuitState` | 미검사 / 정상 / 쇼트, 관련 단자, 메시지 |
| `SimulationState` | 전압·논리값·통전 부품·Net·부품 전류·오류와 쇼트 결과 |
| `CalibrationSample` | 클릭한 부품과 백분율 좌표, 복사 결과 |
| `LogicMission` | AND·OR·NOT·NAND·NOR·XOR의 학습 목표와 진리표 |

`src/config/assets.ts`가 PNG 경로와 상대 좌표의 단일 원본입니다. `componentAssets.ts`는 이전 import 경로 호환용 re-export입니다. 보존된 SVG 작업대용 `PinDefinition`은 절대 로컬 좌표 타입이므로 PNG용 `PhotoPinDefinition`과 구분합니다.

## 표시와 좌표 변환

이미지 프레임은 에셋의 `size`를 사용합니다. PNG는 `object-fit: contain`으로 표시되며 자연 크기를 읽은 뒤 이미지가 실제로 차지하는 사각형을 계산합니다. 같은 사각형 안에 핀·버튼·다이얼·발광·LCD를 상대 좌표로 배치합니다.

```text
비율 = min(프레임 너비 / PNG 너비, 프레임 높이 / PNG 높이)
표시 너비 = PNG 너비 × 비율
표시 높이 = PNG 높이 × 비율
x% = (클릭 clientX - 표시 영역 left) / 표시 영역 width × 100
y% = (클릭 clientY - 표시 영역 top) / 표시 영역 height × 100
```

`getBoundingClientRect()`가 Zoom/Pan까지 반영하므로 동일한 이미지 지점에서 동일한 백분율을 얻습니다. PNG 내부의 투명 여백은 좌표에 포함됩니다. 로드 실패 시 플레이스홀더의 전체 프레임을 기준으로 사용합니다.

React Flow가 같은 핸들 위치에서 SVG 전선 끝점을 계산합니다. 전선에는 좌표 복사본을 저장하지 않으므로 부품 이동 후에도 단자와 전선이 함께 이동합니다. 전선 선택 영역은 단자 주변을 비워 분기 배선을 방해하지 않습니다.

`breadboardLayout`은 기본 63열·4구역 좌표 템플릿입니다. 5홀 스트립, 중앙 분리, 독립 레일을 `bus`로 구분합니다. 실제 이미지의 다중 뱅크·홀 수·전원 레일 분할에 맞춰 배열/생성기를 수정해야 합니다. 같은 부품 안에서 동일한 `bus`를 갖는 홀은 Union-Find로 실제 병합됩니다. 서로 다른 브레드보드의 같은 bus 이름은 자동 연결하지 않습니다.

## 상태와 조작

`usePhotoCircuitStore`는 모드별 작업대 상태를 분리합니다. 부품/전선 추가·선택·이동·삭제, 전선 색상, 전원, 좌표 디버그, 현재 모드 초기화를 제공합니다. 없는 단자, 자기 자신, 중복/역방향 전선은 거부합니다.

전원 ON은 구조 편집과 전압 변경을 잠급니다. 버튼 누름, 스위치 전환, 타이머 시간은 조작할 수 있습니다. 디버그 모드는 편집/조작과 전원 투입을 잠그고 모든 단자를 강조합니다. 모드 변경 시 디버그와 이전 좌표 결과를 정리합니다. 시간은 0–10초, 전압은 0–30V로 제한하고 비정상 숫자 입력은 거부합니다.

보호 정지 중에는 전원 ON이어도 선택한 오류 전선/부품을 삭제할 수 있습니다. 삭제 즉시 재해석해 오류가 없어지면 회로 동작과 정상 표시를 복구합니다. 오디오 구독은 동기식으로 경고음을 중지합니다.

버튼은 누르는 동안 상태를 유지하고 pointer up/cancel/capture 해제, 키보드 keyup/blur에서 해제합니다. 이미지 위 다이얼과 우측 패널은 동일한 Zustand 설정을 읽고 변경합니다.

## 해석 엔진 연결

`usePhotoCircuitStore`가 전원·배선·부품 추가/삭제·접점 설정 변경 시 `solveCircuit()`를 동기 호출합니다. 위치·선택·색상처럼 전기적으로 영향을 주지 않는 변경은 다시 계산하지 않습니다. 초기 배치도 전원 OFF 상태로 검사합니다.

점등은 `energizedComponents`, 단자 값은 `pinValues`, Net은 `nets`, 부품 전류는 `componentCurrents`, 단락은 `isShorted`와 `shortCircuit`, 상세 원인과 강조 대상은 `faults`에 연결합니다. 오류 시 모든 동작 출력은 차단하지만 Net 연결 구조와 오류 진단은 유지합니다.

`App.tsx`는 두 모드의 전원과 단락 상태를 구독해 `SoundAlert`를 제어합니다. 전원 OFF 상태의 배선 오류는 시각 경고만 표시합니다. 다른 모드에 켜진 오류 회로가 있어도 경고음을 유지하고 해당 모드로 이동할 수 있는 상단 안내를 표시합니다.

DC 근사·TTL 6종·릴레이 자기유지·AT8N 시간축·디지털 계측 파형·4대 오류 검사와 경고음을 제공합니다. 최종 미션은 AND/NAND/NOT/XOR/OR/XNOR이며, 행별 LED 자동 채점과 오배선 힌트를 제공합니다. 실행 취소·다시 실행과 JSON/예제 회로 입출력은 상단 학습 도구에서 사용할 수 있습니다. 최신 사용법은 [README](../README.md)에 있습니다.

보존된 `components/devices`, `WorkspaceCanvas`, `useCircuitStore`, `svgCircuits`, `svgGeometry`, `topology`는 이전 SVG 작업대입니다. `initialCircuits`, `useLabStore`, `shared`, `features/theory`는 이전 심볼/이론 화면입니다. 현재 PNG 화면은 이들을 실행하지 않습니다.

## 검증

`npm.cmd run build`는 전체 TypeScript 검사와 Vite 프로덕션 빌드를 수행합니다. `npm.cmd test`는 파일명·좌표·버스 구분, 레터박스·Zoom/Pan 좌표 변환, 모드별 화면·상태 격리, 배선 유효성, 삭제, 전원/디버그 잠금과 설정 범위를 검증합니다. 이전 SVG/심볼 회귀 검사도 유지합니다.

이번 환경에서는 연결된 브라우저 호스트가 없어 실제 화면 캡처와 클릭 검증은 수행하지 못했습니다. 로컬 브라우저에서 PNG 로드/플레이스홀더, 모드 전환, 배선과 좌표 보정을 확인할 수 있습니다.


??? ??? ?? ??, ?? ?? ??, ????/???, AT8N On-Delay, Y?? ??? ?? ??? [??? ?? ???](SEQUENCE_MODULES.md)? ?????. ??? ?? ?? ??? `src/config/sequencePins.ts`???.


Digital modules: [PNG board, six TTL models, supply and scope](DIGITAL_MODULES.md). Coordinates: `src/config/digitalPins.ts`; TTL pin maps: `src/config/ttlModels.ts`.
