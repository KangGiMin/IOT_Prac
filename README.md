# 한국폴리텍 IoT 전기·전자 회로 실습실

React + TypeScript + Vite + Tailwind CSS + Zustand 기반의 PNG 회로 시뮬레이터입니다. 시퀀스 제어와 디지털 회로를 별도 작업대로 유지하며, 실제 장비 사진 위 상대 좌표 단자·버튼·계측 오버레이를 제공합니다.

## 공개 실습 사이트

[Circuit Lab · IoT 전기·전자 회로 실습실](https://gimin-iot-circuit-lab.famousessay4.chatgpt.site)

Sites 정적 호스팅으로 제공하며 개발 PC와 VS Code가 꺼져 있어도 접속할 수 있습니다. 방문자 로그인은 필요하지 않습니다. 회로는 각 방문자의 브라우저에서 연산하며, 공유할 배선은 회로 JSON으로 저장하고 불러옵니다.

호스팅 설정은 `.openai/hosting.json`에 있습니다. GitHub에 소스를 푸시하는 것과 공개 사이트에 새 버전을 배포하는 것은 별도 작업입니다. 소스를 수정한 뒤에는 빌드한 새 버전을 Sites에도 배포해야 공개 화면에 반영됩니다.

## 1. PNG 넣기

누끼를 딴 개별 PNG를 **`public/assets/` 바로 아래**에 넣습니다. `sequence/`, `digital/` 하위 폴더는 사용하지 않습니다.

```text
public/assets/
  panel-board.png
  pilot-lamp.png
  pb-switch.png
  relay-socket.png
  relay-body.png
  timer-at8n.png
  screwdriver.png
  breadboard.png
  power-supply.png
  oscilloscope.png
  led-red.png
  resistor-330.png
  ic-14pin.png
  switch-3pin.png
```

IC는 `ic-14pin.png` 한 장을 6종 모델이 공유합니다. 내부 에셋 ID `ic-dip14`와 파일명을 혼동하지 마세요. 최종 PNG가 없는 경우에도 `onError` 플레이스홀더로 모든 배치·배선·채점 기능을 사용할 수 있습니다.

넣어 주신 시퀀스·디지털 PNG는 원본을 유지하고 위 영문 파일명으로 복사해 연결했습니다. `릴레이.png`는 `relay-socket.png`로 연결하고 화면에서는 **릴레이 본체**, `릴레이 소켓.png`는 `relay-body.png`로 연결하고 화면에서는 **릴레이 소켓**으로 표시합니다. 영문 파일명과 내부 ID는 기존 저장 회로와의 호환성을 위해 유지합니다. 디지털은 `브레드 보드.png`·`파워 서플라이.png`·`오실로스코프.png`·`LED.png`·`저항.png`·`TTL IC.png`·`3핀 슬라이드 스위치.png`를 각각 적용했습니다. `점퍼 케이블.png`도 `jumper-cable.png`로 복사해 팔레트 배선 도구에 표시합니다. 이후 원본을 수정한다면 영문 파일도 갱신하세요.

## 2. 바로 실행

Node.js 22 LTS(22.12 이상) 또는 24 LTS와 npm을 설치한 뒤 프로젝트 폴더의 터미널에서 실행합니다.

```sh
npm install
npm run dev
```

터미널에 출력되는 Local 주소를 브라우저에서 엽니다. 기본 주소는 `http://127.0.0.1:5173`이며 포트 사용 여부에 따라 달라질 수 있습니다. 개발 중에는 PNG·소스 변경 후 화면을 새로고침하면 됩니다.

PowerShell 실행 정책이 `npm.ps1`을 차단한다면 같은 명령을 아래처럼 실행합니다.

```powershell
npm.cmd install
npm.cmd run dev
```

검사와 배포용 빌드:

```sh
npm test
npm run build
npm run preview
npm run benchmark
```

실제 브라우저 조작 테스트는 처음 한 번 Chromium을 설치한 뒤 실행합니다. `test:e2e`는 배포용 빌드를 만든 후 전용 미리보기 서버를 자동으로 시작하고 종료합니다.

```sh
npx playwright install chromium
npm run test:e2e
npm run test:all
```

`test:all`은 단위 테스트와 브라우저 테스트를 모두 실행합니다. 설치된 Chrome을 사용하려면 PowerShell에서 `$env:PLAYWRIGHT_CHANNEL = 'chrome'`을 지정한 뒤 실행할 수 있습니다. GitHub Actions에서도 Chromium으로 전체 검사와 의존성 보안 검사를 수행하며, 실패 시 화면과 추적 기록을 보관합니다.

VS Code Live Server를 사용할 경우 먼저 `npm run build`를 실행하고 루트 `index.html`을 엽니다. 루트 `index.html`과 `dist/index.html`은 빌드가 갱신하는 파일입니다. HTML 원본은 `app.html`, 앱 소스는 `src/`에서 수정합니다. PNG를 추가한 뒤 Live Server에서 사용하려면 다시 빌드합니다.

## 3. 가장 빠른 실습 순서

1. 상단 **디지털 · 7400 NAND** 예제를 불러옵니다. 브레드보드, 장착된 IC, 입력 A/B 스위치, 저항·LED, 전원과 프로브가 배선되어 있습니다.
2. 메인 전원을 ON으로 바꾸고 A/B 스위치를 조작해 LED와 파형을 확인합니다. 초기 00 입력의 NAND 출력은 HIGH입니다.
3. 아래 미션에서 **NAND**를 선택합니다. A 입력, B 입력, 출력 LED를 확인한 뒤 **회로 검증하기**를 누릅니다.
4. 00·01·10·11의 실제 LED 결과와 성공/실패가 표시됩니다. 정상 예제는 100점입니다.
5. 회로를 변경한 뒤 다시 검증합니다. 미션·대상·부품·설정·배선이 바뀌면 이전 채점은 숨겨집니다.

시퀀스는 **시퀀스 · 자기유지** 예제를 불러와 전원을 ON으로 바꿉니다. START를 눌렀다 놓으면 릴레이와 램프가 유지되고, STOP을 눌렀다 놓으면 해제됩니다. 두 예제 모두 불러올 때 전원 OFF로 시작합니다.

NOR는 상단 **디지털 · 7402 NOR** 예제를 불러옵니다. 메인 전원을 켜고 입력 A/B 스위치를 바꾸면 **00에서만 LED가 켜지고 01·10·11에서는 꺼집니다.** 아래 미션에서 **NOR → 회로 검증하기**를 누르면 네 행을 자동 채점합니다. 예제의 오실로스코프 CH1은 A 입력, CH2는 Y 출력을 측정합니다.

## 4. 미션과 자동 채점

| 미션 | 권장 IC                    | 검증 행        |
| ---- | -------------------------- | -------------- |
| AND  | 7408 또는 7411             | 00, 01, 10, 11 |
| NAND | 7400                       | 00, 01, 10, 11 |
| NOT  | 7406                       | 0, 1           |
| XOR  | 7486                       | 00, 01, 10, 11 |
| OR   | 7402 + 7406 또는 7400 응용 | 00, 01, 10, 11 |
| NOR  | 7402                       | 00, 01, 10, 11 |
| XNOR | 7486 + 7406                | 00, 01, 10, 11 |

각 미션은 논리 기호, 수식, 진리표, 권장 IC와 접이식 배선 힌트를 제공합니다. 검증 대상 스위치와 LED를 명시적으로 선택하므로 여러 LED나 스위치가 있어도 다른 부품의 결과를 합산하지 않습니다.

자동 채점은 현재 회로의 **복사본**에 테스트 전원을 공급하고 스위치 조합을 바꿔 실제 해석 엔진을 실행합니다. 화면의 메인 전원·스위치·배선·경고음은 변경하지 않습니다. 파워서플라이 OUTPUT OFF, IC 전원 미연결, 부동 입력, LED 전류 경로 단절, 저항 누락/우회, LED 역연결과 논리 오배선 힌트를 표시합니다. 단순히 LED가 꺼져 있다는 이유로 미연결·부동 회로를 정상 LOW로 인정하지 않습니다.

채점은 구현된 교육용 DC/TTL 모델에 따른 기능 검증입니다. 실물 IC의 팬아웃·소비 전류·출력 전류 한계나 접점 바운스까지 평가하는 SPICE 해석은 아닙니다. 실제 7406 오픈컬렉터 동작은 설정에서 활성화하며 외부 풀업 저항이 필요합니다.

## 5. 편의 기능

- **넓은 작업대:** 두 모드 모두 상단의 가로폭 전체를 배치·배선 영역으로 사용합니다. 부품 라이브러리와 회로 해석·부품 설정·미션은 아래로 스크롤해 이용하며, 부품 카드를 클릭해 작업대에 추가할 수 있습니다.
- **화면 테마:** 상단 헤더에서 라이트 모드·다크 모드·시스템 설정을 선택합니다. 선택은 브라우저에 저장되고, 시스템 설정은 운영체제의 밝은/어두운 테마 변경을 자동으로 따라갑니다.
- **단자 호버:** `Pin 14: VCC (+5V)`처럼 모델별 실제 핀 번호·역할을 표시합니다. 7402·7411의 다른 핀맵도 반영합니다.
- **사진 위 직접 배선:** 별도의 초록색 단자 원을 표시하지 않고, 사진 속 나사·기기 단자·브레드보드 홀을 클릭하거나 드래그해 연결합니다. 푸시버튼·램프·릴레이는 제공된 사진의 나사 중심에 연결점이 있습니다. 사진에 단자가 없는 실습 전원과 타이머 후면 소켓은 이름·번호가 있는 별도 나사 단자로 표시합니다. 좌표 디버그 모드에서는 보정용 표시를 켭니다.
- **키보드 배선:** 페이지 처음에서 Tab을 두 번 누르면 **키보드 배선으로 이동** 링크에 도달합니다. Enter로 이동하고 **단자 선택으로 배선**을 펼친 뒤, Tab과 방향키로 출발·도착 부품 및 단자를 선택하고 **배선 연결**을 실행합니다. 화면에 표시되지 않은 브레드보드 홀도 선택할 수 있습니다. 전원 ON·좌표 보정·배선 모드 OFF에서는 연결을 잠그고, 같은 단자나 이미 연결된 단자 쌍은 중복 연결하지 않습니다.
- **큰 작업대:** 브레드보드에 포인터를 올리거나 보드를 선택하면 전체 단자를 표시합니다. 연결된 전선의 단자는 항상 유지하며 모든 보드의 단자를 한꺼번에 생성하지 않습니다. 해석에는 배선과 삽입된 IC가 사용하는 버스를 포함하고, 연결하지 않은 홀은 부동 상태로 취급합니다. 화면 밖 계측기는 이력을 유지합니다.
- **Ctrl+Z / Ctrl+Y:** 현재 모드의 부품·배선·설정·전원 변경을 실행 취소/다시 실행합니다. Ctrl+Shift+Z와 macOS Command 조합도 지원합니다. 입력 필드 안에서는 브라우저의 텍스트 편집 동작을 유지합니다.
- **드래그 기록:** 부품 이동과 레일/홀 스냅을 한 단계로 묶습니다. 모드마다 최대 80단계를 보관하며, 선택·색상 변경과 타이머 틱은 기록하지 않습니다. 새로운 편집을 하면 다시 실행 기록을 비웁니다.
- **Delete / Backspace:** 선택 부품 또는 전선을 삭제합니다. 부품 삭제 시 연결된 전선도 제거하고, Undo로 함께 복원합니다.
- **전원 상태:** Undo/Redo·JSON 불러오기·예제 불러오기는 전원 OFF에서 복원합니다. 순간 누름 버튼은 해제하고 시간축·해석은 다시 계산합니다.
- **JSON 저장:** 두 모드의 부품·설정·장착 정보·전선을 `iot-circuit-lab.json`으로 다운로드합니다. PNG, 런타임 전압·시간축, 경고음, 채점 결과와 Undo 기록은 저장하지 않습니다.
- **JSON 불러오기:** 형식·버전·숫자 범위·부품 종류·모드·핀 참조·중복·장착/삽입 위치를 검사합니다. 잘못된 파일은 현재 회로를 바꾸지 않습니다. 1MB, 모드별 부품 100개·전선 2000개까지 지원합니다. 두 모드 각각의 교체는 해당 모드에서 실행 취소할 수 있습니다.
- **예제 불러오기:** 현재 작업을 교체하지만 Undo로 되돌릴 수 있습니다. 다른 모드의 작업은 예제 불러오기로 변경하지 않습니다.

## 6. 이미지 좌표 보정

메인 전원을 끄고 헤더의 **핀 좌표 디버그 모드**를 켭니다. 모든 단자가 강조되고, 이미지 클릭 위치의 `x%, y%`가 표시됩니다. 우측 입력란의 `{ x: 35.25, y: 18.6 }`를 복사해 좌표 설정에 반영합니다.

- `src/config/sequencePins.ts`: 시퀀스 핀·버튼·발광·바늘·레일·장착 위치
- `src/config/digitalPins.ts`: 4개 바인딩 포스트·홀 격자·계측기 단자·LCD·버튼·LED 위치
- `pins[].position`: 단자 중심
- `controls[].bounds`: 조작 영역
- `overlays[].bounds`, `center`: 발광·LCD·바늘 위치

좌표는 표시된 PNG 사각형의 0–100%입니다. `object-fit: contain`의 이미지 바깥 레터박스는 제외하고 PNG 내부의 투명 여백은 포함합니다. 제공된 디지털 사진의 4구역·63열 브레드보드와 LCD·단자 위치에 맞춰 1차 보정했습니다. PNG를 교체하면 좌표를 다시 확인하세요. 클릭 결과가 TypeScript 파일을 자동 수정하지는 않습니다.

## 통합 소스 구조

```text
src/
  app/
    App.tsx                         # 모드·전원·오디오·시간축과 4분할 UI
    components/LearningToolbar.tsx  # 단축키·JSON 파일·예제·Undo/Redo
  config/
    assets.ts                       # PNG 파일명·메타데이터
    sequencePins.ts                 # 시퀀스 상대 좌표
    digitalPins.ts                  # 디지털 상대 좌표와 IC 삽입 핀 연결
    ttlModels.ts                    # 7400/7402/7406/7408/7411/7486 핀맵·연산
    pinTooltip.ts                   # 모델별 핀 역할 툴팁
  engine/
    circuitSolver.ts                # Union-Find, DC·TTL, 보호 정지
    soundAlert.ts                   # 1200Hz 경고음·릴레이 클릭
    missionGrader.ts                # 분리된 회로 복사본의 행별 기능 채점
    circuitFile.ts                  # 버전형 JSON 입출력과 검증
  store/usePhotoCircuitStore.ts     # 모드별 상태·편집·히스토리·복원
  features/workbench/
    components/
      LogicMissions.tsx             # 미션·바인딩·진리표·점수·오류 힌트
      LogicSymbol.tsx               # 7대 미션 논리 기호
      PhotoCanvas.tsx               # Zoom/Pan·드래그·SVG 전선
      PhotoComponentNode.tsx        # PNG와 핀/조작/발광 오버레이
      PhotoControl.tsx              # 버튼·다이얼·토글
      PhotoInspector.tsx            # 선택 부품·좌표·상태·미션 패널
      KeyboardWiring.tsx            # 키보드로 출발·도착 단자를 선택해 배선
      PhotoPalette.tsx              # 부품 및 TTL 모델 팔레트
      PhotoWireEdge.tsx             # Y단자·점퍼·악어클립 전선
      ScopeScreen.tsx               # 실시간 CH1/CH2 canvas 파형
      SupplyReadout.tsx             # CH1/CH2 전압·전류 LCD
      AssetImage.tsx                # PNG와 onError 플레이스홀더
    data/
      photoCircuits.ts              # 초기 배치
      logicMissions.ts              # 7대 미션과 힌트
      presets.ts                    # 자기유지 / NAND 예제 팩터리
    utils/
      geometry.ts                   # 이미지 표시 영역과 백분율
      sequencePlacement.ts          # 레일 스냅·릴레이 장착
      digitalPlacement.ts           # 중앙 홈 IC 삽입
  styles/workspace.css              # Tailwind·레이아웃·상태 효과
  types/circuit.ts                  # 공통 도메인 타입
  legacy/                           # 보존된 SVG·프로토타입과 전용 타입·스토어
  architecture.test.ts              # 현재/이전 구현 경계와 설정 단일 정의 검사
  main.tsx
tests/e2e/                          # 실제 브라우저 조작 회귀 테스트
playwright.config.ts                # 브라우저·미리보기 서버·실패 추적 설정
public/assets/                      # 사용자 제공 PNG 14개
app.html                            # Vite 원본 HTML
index.html                          # 빌드가 갱신하는 Live Server 진입점
```

이전 SVG/심볼/이론 작업대 소스는 [`src/legacy/`](src/legacy/README.md)에 분리해 보존했습니다. 현재 진입점은 PNG 작업대이며 `src/store/usePhotoCircuitStore.ts`만 사용합니다. 부품 메타데이터는 `assets.ts`, 단자·조작·오버레이는 `sequencePins.ts`와 `digitalPins.ts`에서 한 번씩 정의합니다. 세부 장비 동작은 [시퀀스 모듈](docs/SEQUENCE_MODULES.md), [디지털 모듈](docs/DIGITAL_MODULES.md), [해석 엔진](docs/CIRCUIT_ENGINE.md) 문서를 참고하세요.

단위 테스트는 전체 TTL 진리표·회로 해석, 시퀀스 장착과 시간축, 미션 성공/오배선, 파일 검증, 모드별 히스토리와 프리셋 동작을 포함합니다. Playwright는 실제 브라우저에서 키보드 배선·이동, 중단된 포인터 조작, Undo/Redo, JSON 다운로드·파일 업로드, 특수 ID, IC 설명과 대용량 회로를 검증합니다. 사진의 물리적 정합과 스피커 청음은 별도 수동 확인 항목입니다.
