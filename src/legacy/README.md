# 보존된 이전 구현

현재 앱의 진입점은 `src/main.tsx` → `src/app/App.tsx`이며, 상태는 `src/store/usePhotoCircuitStore.ts`에서 관리합니다. 이 폴더의 구현은 현재 앱에서 가져오지 않습니다.

- `svg/`: 이전 SVG 편집기, `useSvgCircuitStore`, 좌표·연결 검사와 호환성 테스트입니다.
- `prototype/`: 초기 React Flow 작업대와 이론 화면, `usePrototypeLabStore` 및 `usePrototypeTheoryStore`입니다.
- SVG 전용 타입은 `svg/types.ts`, 프로토타입 전용 타입은 `prototype/types.ts`에 있습니다. 현재 PNG 회로의 공통 타입은 `src/types/circuit.ts`를 사용합니다.

현재 부품 메타데이터는 `src/config/assets.ts`, 단자·조작·오버레이 설정은 `sequencePins.ts`와 `digitalPins.ts`에서 각각 한 번 정의합니다. 이전 구현을 수정해도 현재 앱에는 적용되지 않습니다.

보존된 테스트는 `npm test`에서 함께 실행됩니다. `src/architecture.test.ts`는 현재 코드가 이전 구현을 가져오거나 설정을 중복 정의하는 일을 방지합니다.
