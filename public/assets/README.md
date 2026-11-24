# 장비 PNG 파일과 좌표 보정

투명 배경의 개별 장비 PNG를 아래 이름으로 **이 폴더 바로 아래**에 넣습니다.

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

`sequence/`, `digital/` 하위 폴더는 사용하지 않습니다. 이미지 파일이 없거나 로드되지 않으면 플레이스홀더가 표시되며 부품 배치·배선·좌표 측정은 계속 가능합니다.

1. PNG를 넣고 새로고침합니다. Live Server라면 `npm.cmd run build` 후 새로고침합니다.
2. 메인 전원을 끄고 헤더의 **핀 좌표 디버그 모드**를 켭니다.
3. 이미지의 단자 또는 조작 위치를 클릭해 `x%, y%`를 확인합니다.
4. 우측 패널에서 `{ x: 35.25, y: 18.6 }`를 복사합니다. 자동 복사가 제한되면 좌표 입력란을 선택해 직접 복사합니다.
5. 시퀀스는 `src/config/sequencePins.ts`, 디지털은 `src/config/digitalPins.ts`의 `pins[].position`에 반영합니다. 버튼/다이얼은 `controls[].bounds`, 발광/LCD는 `overlays[].bounds`, 바늘은 `center`를 수정합니다.

좌표는 PNG의 실제 표시 사각형 기준 0–100입니다. `object-fit: contain` 레터박스는 제외하지만 파일 내부의 투명 여백은 포함합니다. 파일 내부의 불필요한 투명 여백을 먼저 잘라내면 보정이 편합니다. 클릭 결과는 소스 파일을 자동 수정하지 않습니다.

기본 좌표와 브레드보드 격자는 보정용 템플릿입니다. 최종 PNG의 단자 중심·홀 수·구역·레일 분할과 일치하도록 조정합니다. 타이머의 후면 단자는 정면 이미지의 실제 단자로 오인하지 않도록 ‘후면 소켓’ 스트립으로 구분해 제공합니다. 투명 릴레이 본체는 소켓에 장착한 뒤 소켓 단자로 배선합니다.

내부 ID `ic-dip14`와 별개로 IC 파일명은 반드시 `ic-14pin.png`입니다.
