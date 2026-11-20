import type { CatalogItem, CircuitLabId } from "../../../shared/types/lab";

export const catalog: Record<CircuitLabId, CatalogItem[]> = {
  sequence: [
    {
      kind: "supply",
      label: "DC 전원 공급기",
      code: "PS",
      detail: "DC 24V",
      description: "제어 회로의 직류 전원",
    },
    {
      kind: "stop",
      label: "정지 버튼",
      code: "PB",
      detail: "NC · b접점",
      description: "누르면 열리는 접점",
    },
    {
      kind: "start",
      label: "시작 버튼",
      code: "PB",
      detail: "NO · a접점",
      description: "누르면 닫히는 접점",
    },
    {
      kind: "relay",
      label: "전자 릴레이",
      code: "K",
      detail: "COIL · 24V",
      description: "전자석으로 동작하는 스위치",
    },
    {
      kind: "lamp",
      label: "표시 램프",
      code: "H",
      detail: "GREEN · 24V",
      description: "회로의 동작 상태 표시",
    },
    {
      kind: "timer",
      label: "타이머 릴레이",
      code: "T",
      detail: "ON DELAY",
      description: "설정 시간 후 접점 전환",
    },
  ],
  breadboard: [
    {
      kind: "ic",
      label: "74LS08 AND",
      code: "U",
      detail: "QUAD AND · 14 PIN",
      description: "2입력 AND 게이트 4개",
    },
    {
      kind: "ic",
      label: "74LS32 OR",
      code: "U",
      detail: "QUAD OR · 14 PIN",
      description: "2입력 OR 게이트 4개",
    },
    {
      kind: "ic",
      label: "74LS04 NOT",
      code: "U",
      detail: "HEX INVERTER · 14 PIN",
      description: "인버터 게이트 6개",
    },
    {
      kind: "resistor",
      label: "저항",
      code: "R",
      detail: "330 Ω · ¼W",
      description: "LED 전류 제한용 저항",
    },
    {
      kind: "led",
      label: "LED",
      code: "D",
      detail: "GREEN · 5MM",
      description: "논리 출력 상태 표시",
    },
    {
      kind: "logic",
      label: "논리 입력 스위치",
      code: "SW",
      detail: "LOGIC 0 / 1",
      description: "디지털 입력 소자",
    },
  ],
};
