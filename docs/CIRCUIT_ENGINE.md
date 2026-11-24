# DC / TTL 회로 해석과 쇼트 경고음

## 모듈

- `src/engine/circuitSolver.ts`: 순수 TypeScript 동기 해석기. React·DOM·타이머·오디오 상태를 변경하지 않습니다.
- `src/engine/soundAlert.ts`: AudioContext·OscillatorNode·GainNode 기반 경고음. 모듈 import 시 오디오를 생성하지 않습니다.
- `src/store/usePhotoCircuitStore.ts`: 전기적 변경마다 해석하고 결과를 Zustand에 저장합니다.
- `src/app/App.tsx`: 두 모드의 전원/쇼트 상태를 구독하고 경고음을 제어합니다.

## Solver API

```ts
const simulation = solveCircuit({
  mode: 'digital', // 또는 'sequence'
  components: workspace.components,
  wires: workspace.wires,
  power: workspace.power,
  previous: workspace.simulation,
});
```

| 결과                       | 의미                                                            |
| -------------------------- | --------------------------------------------------------------- |
| `nets`                     | 전선·버스·닫힌 접점으로 병합한 등전위 노드                      |
| `pinValues['부품ID:핀ID']` | 전압과 0 / 1 / floating / unknown 논리값                        |
| `energizedComponents`      | 실제 폐회로의 DC 전류로 동작 판정한 LED·램프·릴레이와 급전된 IC |
| `componentCurrents`        | 부품별 근사 전류(A)                                             |
| `isShorted`                | 요구한 4가지 단락/오배선 여부                                   |
| `faults`                   | 코드·정확한 원인·단자·부품 ID·전선 ID                           |
| `warnings`                 | 미급전 IC 등 동작을 강제 중지하지 않는 정보                     |
| `shortCircuit`             | 기존 화면과 호환되는 집계 결과                                  |

오류가 있으면 `status = 'error'`, 통전 부품과 전류 출력은 비우고 모든 단자/Net의 동작 전압을 null로 차단합니다. 연결 구조와 원인은 유지합니다. 회로가 정상이고 전원 ON이면 `running`, OFF면 `ready`입니다. 전원 OFF에서도 배선 검사는 수행하지만 살아 있는 전압/전류를 표시하지 않습니다.

## 해석 순서

1. 모든 단자에 Union-Find 집합을 만들고, 같은 부품의 같은 `bus` 홀과 전선 양 끝을 병합합니다.
2. 현재 상태의 푸시버튼 NO/NC, SPDT, 릴레이 접점을 추가로 병합합니다. 저항·램프·코일·LED의 양 끝은 병합하지 않습니다.
3. 직접 전원 단락, 독립 게이트 출력 연결과 잘못된 전선 참조를 검사합니다.
4. 고정 전원·TTL 출력을 경계조건으로 두고 DC 부하의 conductance 행렬을 풉니다. 부하와 연결되지 않은 브레드보드의 개별 홀은 행렬에서 제외합니다.
5. LED 도통 상태와 NAND 출력을 반복 갱신합니다. 부동 입력을 임의로 0/1로 채우지 않습니다. NAND의 한 입력이 0이면 다른 입력이 부동이어도 출력은 1입니다.
6. IC 전원 역연결, TTL 공급 전압과 LED 직렬 저항 누락을 검사합니다.
7. 코일 전류에 따른 릴레이 접점 상태가 바뀌면 다시 풉니다. 이전 상태를 전달해 자기유지 회로를 유지하며, 안정 상태가 없는 자기 차단 회로는 유한 횟수 후 오류로 중지합니다.

전선·부품 위치와 Zoom/Pan은 해석에 영향을 주지 않습니다. 서로 다른 브레드보드의 동일 bus 이름도 구분합니다.

## 보호 조건

| 코드                   | 감지 내용                                                                |
| ---------------------- | ------------------------------------------------------------------------ |
| `POWER_SHORT`          | 전원 +/−가 부하 없이 같은 Net, 또는 서로 다른 이상 전원 전위의 직접 연결 |
| `IC_REVERSED_POWER`    | 74LS00의 14번 VCC가 7번 GND보다 낮은 역전원                              |
| `LED_MISSING_RESISTOR` | 완성된 순방향 회로에서 LED 양 끝이 4.5V 이상의 구동 Net에 직접 연결됨    |
| `OUTPUT_CONFLICT`      | 서로 다른 게이트의 출력이 같은 Net 또는 확정된 출력과 반대 전원 충돌     |
| `IC_SUPPLY_VOLTAGE`    | TTL 권장 공급 전압 초과. 단락과 구분하는 해석 오류                       |
| `INVALID_WIRE`         | 존재하지 않는 부품/단자 참조                                             |
| `UNSTABLE_CIRCUIT`     | DC·논리·릴레이 반복 해석 미수렴                                          |

첫 네 종류는 `isShorted = true`입니다. 뒤 세 종류도 모든 회로 동작을 중지하지만 단락 경고음은 울리지 않습니다. 서로 다른 출력은 현재 논리값이 같아도 연결을 허용하지 않습니다. 같은 IC 내부의 서로 다른 게이트 출력도 해당합니다.

330Ω 저항은 LED의 애노드 또는 캐소드 어느 쪽에 직렬로 배치해도 허용합니다. 다른 위치의 저항, LED와 병렬인 저항, 저항을 우회하는 전선은 보호 저항으로 인정하지 않습니다. 한쪽 다리가 열린 LED는 전류가 흐르지 않으므로 순방향 직접 전원 오류로 표시하지 않습니다.

오류 Net에 속한 전선·부품 ID로 붉은 점멸을 표시하고 우측 패널에 원인을 나열합니다. 동작 감소 설정에서는 점멸 대신 붉은 고정 표시를 사용합니다.

## 전기 모델의 범위

- 시퀀스 실습 전원: 판넬 상단의 가상 `plus`(+24V), `minus`(0V) 단자. 실제 PNG에 없는 실습 전원임을 명시합니다.
- 디지털 전원: 파워서플라이 `plus`와 `minus`. 녹색 `gnd`는 접지이므로 `minus`와 자동 병합하지 않습니다.
- 여러 전원은 공통 DC 기준의 이상 전압원으로 모델링합니다. 절연 전원의 직렬 적층/부유 전원은 지원하지 않습니다.
- 저항: 330Ω. LED: 순방향 2V + 기울기 저항 20Ω, 역방향 비도통 근사.
- 램프: 480Ω 저항 근사. 릴레이 소켓: 코일이 장착된 상태의 1200Ω 코일 근사, 양단 전압 크기 18V 이상에서 동작하는 이상 접점 모델.
- 램프·코일 수치는 실물 측정값이 아닌 학습용 가정입니다. 열·지연·자기 유도·접점 바운스·드라이버 전류 한계는 계산하지 않습니다.
- 릴레이 단자 템플릿: NC 1–4, NO 5–8, COM 9–12, 코일 13/14. 최종 장비 소켓 핀맵에 맞춰 확인·보정합니다.
- IC: 첨부 이미지의 74LS00 PDIP-14. VCC 14, GND 7, NAND 출력 3/6/8/11. 입력 LOW ≤0.8V, HIGH ≥2V, 권장 공급 4.75–5.25V. [TI 공식 데이터시트](https://www.ti.com/lit/ds/symlink/sn74ls00.pdf)
- TTL 출력은 이상적인 0V/VCC 구동입니다. 실제 LS 출력 HIGH 전압, 팬아웃·출력 전류와 LED 구동 적합성까지 보증하는 SPICE 모델은 아닙니다.
- 현재 AT8N On-Delay, TTL 6종, 디지털 계측 파형과 6대 미션 자동 채점을 제공합니다. 자동 채점은 `missionGrader.ts`가 복사된 회로에서 수행합니다. 실물의 아날로그 과도해석은 지원하지 않습니다. 최신 사용법은 [README](../README.md)를 확인하세요.

## 경고음과 UI 연결

```ts
const alarm = new SoundAlert();
// pointer/keyboard 이벤트 안에서 호출. import/render 시 자동 실행하지 않습니다.
void alarm.unlock();
alarm.setActive(power.on && simulation.isShorted === true);
alarm.stop(); // 예약된 펄스까지 즉시 취소
alarm.dispose(); // 언마운트: 타이머·노드 정리와 컨텍스트 close
```

1200Hz 사각파를 GainNode로 0.2초 ON / 0.15초 OFF 반복합니다. JS 타이머가 개별 ON/OFF를 실행하는 대신 오디오 시계에 2초 앞까지 예약합니다. `stop()`은 예약 취소·gain=0·oscillator stop/disconnect를 동기 실행합니다. 중복 start는 음원을 겹치지 않으며, 중지 후 늦게 도착한 resume Promise가 경고음을 다시 켜지 못하도록 세대 번호로 무효화합니다.

브라우저 자동 재생 제한에 대응해 최초 클릭/키 입력에서 AudioContext를 resume합니다. 지원하지 않거나 거부되면 예외로 앱을 중단하지 않고, 보호 배너의 경고음 활성화 버튼에서 재시도할 수 있습니다. [MDN 오디오 권장 사용법](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), [오디오 시계 예약](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setValueAtTime)

메인 전원 ON은 사용자의 전원 투입 요청이고, 실제 해석 출력 차단은 별도 보호 상태입니다. 단락 시 전원 ON을 강제로 OFF 처리하지 않으므로 경고음이 유지됩니다. 전원 OFF 또는 오류 제거 시 동기식 Zustand 구독이 경고음을 즉시 멈춥니다. 보호 정지 중에는 전원 ON에서도 오류 배선/부품을 삭제할 수 있고, 오류가 사라지면 자동으로 해석을 재개합니다. 다른 모드의 켜진 단락 회로도 경고음을 유지합니다.

## 검증

```powershell
npm.cmd test
npm.cmd run build
```

Union-Find 1만 단자, 브레드보드 구획, 4대 오류와 정상 반례, 저항 직렬/병렬/우회, LED 전류, NAND 진리표/연쇄/부동/역전원, 스위치·램프·릴레이 자기유지·미수렴, 상태 정지·삭제 복구, 경고음 패턴·중복·정지·autoplay·늦은 Promise 재개를 테스트합니다.

오디오 테스트는 모의 AudioContext로 시간 예약과 수명 관리를 검증합니다. 연결된 브라우저 호스트가 없어 실제 스피커 청음과 UI 클릭·점멸 캡처는 검증하지 못했습니다.

판넬 레일 정렬, 릴레이 장착·분리, 모멘터리·디텐트 버튼, AT8N On-Delay와 Y단자 배선은 [시퀀스 모듈 안내](SEQUENCE_MODULES.md)를 참고하세요. 단자와 조작 영역의 좌표는 `src/config/sequencePins.ts`에서 관리합니다.

Digital modules: [PNG board, six TTL models, supply and scope](DIGITAL_MODULES.md). Coordinates: `src/config/digitalPins.ts`; TTL pin maps: `src/config/ttlModels.ts`.
