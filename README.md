# Circuit Lab · 가상 전자공학 실습실

대학 공학 실습용 웹 애플리케이션의 UI 시작점입니다. React + TypeScript + Tailwind CSS v4 + React Flow + Zustand를 사용합니다. VS Code에서 개발할 로컬 프로젝트입니다.

## 실행

Node.js 22.12 이상 또는 24 LTS 환경을 권장합니다.

### VS Code Live Server

루트의 `index.html`을 우클릭하고 **Open with Live Server**를 선택하세요. 빌드된 `dist/assets/`의 JavaScript와 CSS를 불러와 실습실 화면을 표시합니다. `index.html`과 `dist/`는 함께 있어야 합니다.

`src/`의 React·TypeScript 소스나 HTML 템플릿 `app.html`을 수정한 뒤에는 `npm run build`를 실행하고 브라우저를 새로고침하세요. 빌드가 루트의 `index.html`과 `dist/index.html`을 자동 갱신합니다. 루트 `index.html`은 생성 파일이므로 직접 수정하지 않습니다.

### Vite 개발 서버

```sh
npm install
npm run dev
```

터미널에 출력된 로컬 주소를 브라우저에서 여세요. Vite 개발 서버는 소스 템플릿 `app.html`을 사용하므로 React·TypeScript 변경 사항이 즉시 반영됩니다.

```sh
npm run build    # TypeScript 검사 + 프로덕션 빌드
npm run preview  # 빌드 결과 확인
npm test         # 상태 격리 / 초기화 / 편집 잠금 검증
```

## 현재 기능

- 실습실 3개 탭 전환, 공통 전원 UI, 현재 실습실 배선 초기화
- 오른쪽 학습 가이드/타임차트 서랍, Escape로 닫기 및 포커스 복귀
- 부품 검색/추가/이동, 단자 드래그 배선, 선택 후 Delete/Backspace로 삭제
- 확대/축소/전체 보기, 실습실별 상태 유지, 전원 ON 시 편집 잠금
- 이론실: 2변수 카르노 맵과 최소항 합 표시, 파형 예시, AND 진리표/타임차트
- 반응형 레이아웃, 상단 탭 키보드 방향키 및 Home/End 지원

전원은 UI/편집 상태를 제어합니다. 실제 릴레이 동작, 전류 계산, TTL 논리 연산, IC 핀별 연결, 브레드보드 홀 내부 연결, 타이머 실행은 확장 영역입니다. 초기 회로는 배치/배선 UI 예제로 전기적 정합성이 검증된 실습 회로가 아닙니다. 파형은 정적 학습 예시입니다. 새로고침하면 상태가 초기화됩니다.

## 폴더 구조

```text
src/
  app/
    App.tsx                    # 화면 조합
    labs.ts                    # 탭 메타데이터
    components/                # Header, Toolbar, GuideDrawer
  features/
    workbench/
      Workbench.tsx            # 실습실별 React Flow Provider/캔버스
      components/              # 부품 라이브러리와 사용자 정의 노드
      data/
        catalog.ts             # 부품 카탈로그
        initialCircuits.ts     # 최초 배치 예제 팩토리
    theory/
      TheoryLab.tsx            # 이론 화면과 예시 타임차트
      store/useTheoryStore.ts  # 학습 주제/카르노 맵 상태
  shared/
    components/                # 재사용 회로 기호
    types/lab.ts               # 실습실, 회로, 부품 공통 타입
  store/
    useLabStore.ts             # 공통 UI와 회로 편집 상태
    useLabStore.test.ts         # 상태 불변 조건 검증
  styles/index.css             # Tailwind 진입점/테마/레이아웃
  main.tsx
```

## 상태와 확장 지점

`useLabStore`는 `activeLab`, `powerOn`, `guideOpen`, `guideTab`과 `circuits.sequence`, `circuits.breadboard`를 관리합니다. 회로 데이터는 실습실 키로 격리됩니다. `resetWiring`은 현재 회로의 `edges`만 비우며 부품은 유지합니다. 부품 삭제 시 연결된 선도 삭제합니다. 전원 ON 시 UI와 store 양쪽에서 회로 변경을 막습니다. 이론 주제와 카르노 맵 상태는 `useTheoryStore`로 분리했습니다.

새 부품은 `catalog.ts`와 `ComponentSymbol.tsx`에 추가하세요. 현재 노드는 왼쪽 입력/오른쪽 출력 단자를 사용합니다. 시퀀스 접점과 IC 핀을 구현할 때 `ComponentData`에 단자 정의를 추가하고 각 React Flow `Handle`에 고유 ID를 부여하세요. 실제 브레드보드 hole/net 모델은 공통 편집기와 별도의 feature로 확장할 수 있습니다.

시뮬레이션은 `features/simulation/`을 추가해 **회로 그래프 → 도메인별 netlist → 계산 결과** 순으로 연결하세요. 편집용 상태와 전압/논리값/시간축 결과를 분리하면 UI와 엔진을 각각 검증하기 좋습니다. 파형 렌더러에는 계산 결과를 전달합니다. 저장 기능은 직렬화 스키마 버전을 정한 뒤 Zustand `persist` 또는 파일 내보내기로 확장할 수 있습니다.

## 공식 참고 문서

- [React Flow 노드 변경 처리](https://reactflow.dev/api-reference/utils/apply-node-changes)
- [Tailwind CSS Vite 설정](https://tailwindcss.com/docs/installation/using-vite)
- [Zustand create API](https://zustand.docs.pmnd.rs/reference/apis/create)
