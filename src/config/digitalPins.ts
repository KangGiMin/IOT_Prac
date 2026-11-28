import type {
  ComponentAsset,
  PhotoPinDefinition,
  PinRole,
  CircuitComponent,
  PinRef,
} from '../types/circuit';
import { icModel, TTL_MODELS } from './ttlModels';
const pin = (
  id: string,
  label: string,
  x: number,
  y: number,
  role: PinRole = 'passive',
  bus?: string,
): PhotoPinDefinition => ({ id, label, position: { x, y }, role, bus });
/** Calibrated to the supplied 1448×1086 EIC-108 PNG, including its transparent padding. */
export const digitalGeometry = {
  columns: 63,
  firstX: (461.5 / 1448) * 100,
  lastX: (1266.5 / 1448) * 100,
  ic: { firstX: 19.3, lastX: 80.5, topY: 33.8, bottomY: 69.4 },
  // Signal row centers measured in native image pixels, including the channel gaps.
  banks: [
    [118, 131, 144, 157, 170, 209, 222, 234.5, 247, 260.5],
    [352, 365, 378, 390.5, 403, 442, 455, 468, 480, 493],
    [582, 595, 608, 621, 633.5, 672, 685, 698, 710, 724],
    [813, 826, 838.5, 851, 864, 902, 915, 928.5, 941.5, 954.5],
  ],
  rails: [
    { id: 'top-plus', y: (80 / 1086) * 100 },
    { id: 'top-minus', y: (66 / 1086) * 100 },
    { id: 'middle1-plus', y: (313.5 / 1086) * 100 },
    { id: 'middle1-minus', y: (300 / 1086) * 100 },
    { id: 'middle2-plus', y: (544.5 / 1086) * 100 },
    { id: 'middle2-minus', y: (531 / 1086) * 100 },
    { id: 'middle3-plus', y: (775.5 / 1086) * 100 },
    { id: 'middle3-minus', y: (762 / 1086) * 100 },
    { id: 'bottom-plus', y: (1008 / 1086) * 100 },
    { id: 'bottom-minus', y: (995 / 1086) * 100 },
  ],
  posts: [
    { id: 'post-gnd', label: 'GND', x: 13.3, y: 12.5 },
    { id: 'post-va', label: 'Va', x: 13.3, y: 47.5 },
    { id: 'post-vb', label: 'Vb', x: 13.3, y: 35.7 },
    { id: 'post-vc', label: 'Vc', x: 13.3, y: 24.1 },
  ],
};
export const breadboardRows = 'abcdefghij';
export const holeId = (bank: number, row: string, column: number) =>
  `${bank === 0 ? '' : `bank${bank + 1}-`}${row}${column}`;
export const breadboardPins: PhotoPinDefinition[] = digitalGeometry.posts.map((p) =>
  pin(p.id, p.label, p.x, p.y),
);
// Measured centers in the supplied PNG. Rail groups have real gaps; uniformly
// distributing connection points would put wire tips on the plastic between holes.
const columnCenters = [
  461.5, 474.5, 487, 499.5, 512.5, 525.5, 538, 550.5, 563.5, 576.5, 589, 602, 615, 627.5, 640.5,
  653.5, 667, 679.5, 692.5, 705.5, 718.5, 731.5, 744, 756.5, 769.5, 782.5, 795.5, 808.5, 821.5,
  834.5, 847.5, 860.5, 873.5, 886.5, 899.5, 912, 925, 937.5, 950.5, 963.5, 976.5, 989.5, 1002.5,
  1015.5, 1028.5, 1041.5, 1055, 1068.5, 1081.5, 1094.5, 1107.5, 1120.5, 1134, 1147.5, 1160.5,
  1173.5, 1187.5, 1200.5, 1213.5, 1226.5, 1240, 1253.5, 1266.5,
];
const railCenters = [
  486, 499, 511.5, 524.5, 537.5, 564, 576.5, 589.5, 602, 615, 641.5, 654, 667, 679.5, 692.5, 719,
  731.5, 744.5, 757, 770, 796.5, 809.5, 822.5, 835.5, 848.5, 875, 887.5, 900.5, 913.5, 926.5, 953,
  966, 978.5, 991.5, 1004.5, 1031, 1044, 1057, 1070, 1083, 1110.5, 1123.5, 1137, 1150, 1162.5,
  1190.5, 1203.5, 1216.5, 1229.5, 1243,
];
for (let col = 1; col <= digitalGeometry.columns; col++) {
  const x = (columnCenters[col - 1] / 1448) * 100;
  digitalGeometry.banks.forEach((bank, b) => {
    for (let row = 0; row < 10; row++) {
      const y = (bank[row] / 1086) * 100;
      breadboardPins.push(
        pin(
          holeId(b, breadboardRows[row], col),
          `${b + 1} / ${breadboardRows[row].toUpperCase()}${col}`,
          x,
          y,
          'passive',
          `bank${b}-${row < 5 ? 'top' : 'bottom'}-${col}`,
        ),
      );
    }
  });
  digitalGeometry.rails.forEach((r) =>
    breadboardPins.push(
      pin(
        `${r.id}-${col}`,
        `${r.id} ${col}`,
        // Keep existing 1–63 rail IDs as aliases on the same electrical bus;
        // the photo has 50 physical rail holes. Existing files remain valid.
        (railCenters[
          Math.round(((col - 1) * (railCenters.length - 1)) / (digitalGeometry.columns - 1))
        ] /
          1448) *
          100,
        r.y,
        'passive',
        r.id,
      ),
    ),
  );
}
export const breadboardPinById = new Map(breadboardPins.map((p) => [p.id, p]));
const breadboardBuses = new Map<string, PhotoPinDefinition[]>();
for (const p of breadboardPins) {
  if (!p.bus) continue;
  const bus = breadboardBuses.get(p.bus);
  if (bus) bus.push(p);
  else breadboardBuses.set(p.bus, [p]);
}
/** Keep every hole on an electrically used bus; disconnected buses are floating. */
export function connectedBreadboardPins(ids: Iterable<string>): PhotoPinDefinition[] {
  const pins = new Set<PhotoPinDefinition>();
  const buses = new Set<string>();
  for (const id of ids) {
    const p = breadboardPinById.get(id);
    if (!p) continue;
    if (!p.bus) pins.add(p);
    else if (!buses.has(p.bus)) {
      buses.add(p.bus);
      for (const member of breadboardBuses.get(p.bus)!) pins.add(member);
    }
  }
  return [...pins];
}

type Layout = Pick<ComponentAsset, 'pins' | 'controls' | 'overlays'>;
// Insertion seams measured just inside the visible metal tips of the source photos.
const leadPin = (id: string, label: string, x: number, y: number) =>
  pin(id, label, (x / 1122) * 100, (y / 1402) * 100);
export const plugInParts = {
  'led-red': { offsets: [0, 1], heightRatio: 0.8 },
  'resistor-330': { offsets: [0, 4], heightRatio: 0.49 },
  'switch-3pin': { offsets: [0, 1, 2], heightRatio: 0.62 },
} as const;
export const plugInPart = (asset: CircuitComponent['assetId']) =>
  asset === 'led-red' || asset === 'resistor-330' || asset === 'switch-3pin'
    ? plugInParts[asset]
    : undefined;
export const digitalPins = {
  breadboard: { pins: breadboardPins, controls: [], overlays: [] },
  'power-supply': {
    pins: [
      pin('minus', 'CH1 −', 60.6, 85.4),
      pin('plus', 'CH1 +', 68.4, 85.4),
      pin('ch2-minus', 'CH2 −', 38.0, 85.4),
      pin('ch2-plus', 'CH2 +', 45.9, 85.4),
      pin('gnd', 'GND 접지', 53.0, 85.4),
      pin('5v-minus', 'CH3 −', 79.4, 85.4),
      pin('5v-plus', 'CH3 +', 87.4, 85.4),
    ],
    controls: [
      {
        id: 'power',
        label: '파워서플라이 전원',
        kind: 'power',
        bounds: { x: 7.9, y: 77.8, width: 6.4, height: 8.5 },
      },
      {
        id: 'output',
        label: 'OUTPUT ON/OFF',
        kind: 'power',
        bounds: { x: 29.7, y: 64.7, width: 3.6, height: 4.0 },
      },
      {
        id: 'ch2-volts',
        label: 'CH2 전압',
        kind: 'supply-control',
        field: 'ch2Voltage',
        bounds: { x: 5.5, y: 26.6, width: 10.1, height: 13.5 },
      },
      {
        id: 'ch1-amps',
        label: 'CH1 전류 제한',
        kind: 'supply-control',
        field: 'ch1Limit',
        bounds: { x: 82.6, y: 45.6, width: 10.4, height: 13.6 },
      },
      {
        id: 'ch2-amps',
        label: 'CH2 전류 제한',
        kind: 'supply-control',
        field: 'ch2Limit',
        bounds: { x: 5.5, y: 45.3, width: 10.2, height: 13.6 },
      },
      {
        id: 'series',
        label: 'TRACKING 직렬',
        kind: 'supply-control',
        field: 'series',
        bounds: { x: 50.5, y: 64.6, width: 3.3, height: 4.0 },
      },
      {
        id: 'parallel',
        label: 'TRACKING 병렬',
        kind: 'supply-control',
        field: 'parallel',
        bounds: { x: 64.2, y: 64.6, width: 3.4, height: 4.0 },
      },
      {
        id: 'ch3-range',
        label: 'CH3 전압 선택',
        kind: 'supply-control',
        field: 'auxiliaryVoltage',
        bounds: { x: 79.8, y: 72.4, width: 6.1, height: 3.6 },
      },
      {
        id: 'voltage',
        label: 'CH1 전압',
        kind: 'dial',
        setting: 'voltage',
        bounds: { x: 82.5, y: 26, width: 10.5, height: 14 },
        min: 0,
        max: 30,
        step: 0.1,
        unit: 'V',
      },
    ],
    overlays: [
      {
        id: 'display',
        kind: 'lcd',
        format: 'supply',
        bounds: { x: 26.0, y: 27.9, width: 46.0, height: 30.3 },
      },
      {
        id: 'cc',
        kind: 'glow',
        bounds: { x: 80.1, y: 40.6, width: 2, height: 2.6 },
        color: '#ff2525',
      },
      {
        id: 'cc-ch2',
        kind: 'glow',
        bounds: { x: 16.4, y: 41.0, width: 1.5, height: 2.0 },
        color: '#ff2525',
      },
      {
        id: 'overload',
        kind: 'glow',
        bounds: { x: 80.1, y: 57.6, width: 2, height: 2.6 },
        color: '#ff2525',
      },
    ],
  },
  oscilloscope: {
    pins: [
      pin('ch1', 'CH1', 63.7, 76.2, 'input'),
      pin('ch2', 'CH2', 74.6, 76.2, 'input'),
      pin('ref', 'GND REF', 96, 80),
    ],
    controls: [
      {
        id: 'run',
        label: 'RUN/STOP',
        kind: 'toggle',
        setting: 'scopeRunning',
        bounds: { x: 89.4, y: 29.8, width: 5.0, height: 4.0 },
      },
      {
        id: 'scope-power',
        label: '오실로스코프 전원',
        kind: 'scope-action',
        action: 'power',
        bounds: { x: 8.6, y: 77.8, width: 4.5, height: 4.1 },
      },
      {
        id: 'vertical-off',
        label: 'OFF 채널 표시 해제',
        kind: 'scope-action',
        action: 'off',
        bounds: { x: 68.2, y: 50.7, width: 4.4, height: 4.1 },
      },
      {
        id: 'horizontal-menu',
        label: '수평 시간축 MENU',
        kind: 'scope-action',
        action: 'horizontal',
        bounds: { x: 78.7, y: 50.7, width: 4.5, height: 4.1 },
      },
      ...[38.4, 44.9, 51.4, 57.9, 64.4].map((y, index) => ({
        id: `scope-key-${index}`,
        label: `화면 소프트키 ${index + 1}`,
        kind: 'scope-key' as const,
        index,
        bounds: { x: 51.8, y, width: 4.5, height: 4.2 },
      })),
      {
        id: 'auto',
        label: 'AUTO 자동 설정',
        kind: 'scope-action',
        action: 'auto',
        bounds: { x: 81.6, y: 29.8, width: 5, height: 4.2 },
      },
      {
        id: 'measure',
        label: 'MEASURE 측정 메뉴',
        kind: 'scope-action',
        action: 'measure',
        bounds: { x: 59.1, y: 26.5, width: 4.5, height: 4.2 },
      },
      {
        id: 'cursor',
        label: 'CURSOR 커서',
        kind: 'scope-action',
        action: 'cursor',
        bounds: { x: 59.1, y: 33.1, width: 4.5, height: 4.2 },
      },
      {
        id: 'acquire',
        label: 'ACQUIRE 취득 모드',
        kind: 'scope-action',
        action: 'acquire',
        bounds: { x: 66.4, y: 26.5, width: 4.5, height: 4.2 },
      },
      {
        id: 'display',
        label: 'DISPLAY 표시 형식',
        kind: 'scope-action',
        action: 'display',
        bounds: { x: 66.4, y: 33.1, width: 4.5, height: 4.2 },
      },
      {
        id: 'storage',
        label: 'STORAGE 저장 메뉴',
        kind: 'scope-action',
        action: 'storage',
        bounds: { x: 73.8, y: 26.5, width: 4.5, height: 4.2 },
      },
      {
        id: 'utility',
        label: 'UTILITY 계측 설정',
        kind: 'scope-action',
        action: 'utility',
        bounds: { x: 73.8, y: 33.1, width: 4.5, height: 4.2 },
      },
      {
        id: 'ch1-menu',
        label: 'CH1 채널 설정',
        kind: 'scope-action',
        action: 'ch1',
        bounds: { x: 59.1, y: 41.4, width: 4.4, height: 4.4 },
      },
      {
        id: 'ch2-menu',
        label: 'CH2 채널 설정',
        kind: 'scope-action',
        action: 'ch2',
        bounds: { x: 59.1, y: 49, width: 4.4, height: 4.4 },
      },
      {
        id: 'math',
        label: 'MATH 연산 전환',
        kind: 'scope-action',
        action: 'math',
        bounds: { x: 59.1, y: 56.4, width: 4.4, height: 4.4 },
      },
      {
        id: 'ref-menu',
        label: 'REF 기준 파형 저장',
        kind: 'scope-action',
        action: 'ref',
        bounds: { x: 59.1, y: 63.5, width: 4.4, height: 4.4 },
      },
      {
        id: 'trigger-menu',
        label: 'TRIGGER 트리거 설정',
        kind: 'scope-action',
        action: 'trigger',
        bounds: { x: 89.4, y: 51.1, width: 5, height: 4.2 },
      },
      {
        id: 'midpoint',
        label: '트리거 50% 레벨',
        kind: 'scope-action',
        action: 'midpoint',
        bounds: { x: 89.4, y: 57.6, width: 5, height: 4.2 },
      },
      {
        id: 'force',
        label: 'FORCE 강제 트리거',
        kind: 'scope-action',
        action: 'force',
        bounds: { x: 89.4, y: 64, width: 5, height: 4.2 },
      },
      {
        id: 'vertical-scale',
        label: '선택 채널 전압축 다이얼',
        kind: 'scope-dial',
        field: 'voltsDiv',
        bounds: { x: 67.5, y: 58.8, width: 6.3, height: 7 },
      },
      {
        id: 'vertical-position',
        label: '선택 채널 수직 위치 다이얼',
        kind: 'scope-dial',
        field: 'offset',
        bounds: { x: 68, y: 42.7, width: 4.7, height: 4.9 },
      },
      {
        id: 'time-scale',
        label: '시간축 다이얼',
        kind: 'scope-dial',
        field: 'timeDiv',
        bounds: { x: 78.4, y: 58.8, width: 6.3, height: 7 },
      },
      {
        id: 'horizontal-position',
        label: '수평 위치 다이얼',
        kind: 'scope-dial',
        field: 'delayDiv',
        bounds: { x: 79.2, y: 42.7, width: 4.7, height: 4.9 },
      },
      {
        id: 'trigger-level',
        label: '트리거 레벨 다이얼',
        kind: 'scope-dial',
        field: 'triggerLevel',
        bounds: { x: 89.7, y: 41.8, width: 6, height: 6.2 },
      },
    ],
    overlays: [
      {
        id: 'screen',
        kind: 'lcd',
        format: 'scope',
        bounds: { x: 10.2, y: 33.3, width: 37.3, height: 37.5 },
      },
    ],
  },
  'led-red': {
    pins: [
      pin('anode', 'A (+) 긴 다리', (419 / 1086) * 100, (1330 / 1448) * 100),
      pin('cathode', 'K (−) 짧은 다리', (658 / 1086) * 100, (1299 / 1448) * 100),
    ],
    controls: [],
    overlays: [
      {
        id: 'led',
        kind: 'glow',
        bounds: { x: 40.0, y: 10.0, width: 20.0, height: 22.0 },
        color: '#ff3030',
      },
    ],
  },
  'resistor-330': {
    pins: [leadPin('1', '1', 99, 1278), leadPin('2', '2', 1027, 1178)],
    controls: [],
    overlays: [],
  },
  'switch-3pin': {
    pins: [
      leadPin('1', 'LEFT', 414, 1244),
      leadPin('com', 'COM', 576, 1244),
      leadPin('2', 'RIGHT', 738, 1244),
    ],
    controls: [
      {
        id: 'slide',
        label: '슬라이드 스위치',
        kind: 'toggle',
        setting: 'switchOn',
        bounds: { x: 17, y: 35, width: 65, height: 31 },
      },
    ],
    overlays: [],
  },
  'ic-dip14': {
    pins: Array.from({ length: 14 }, (_, i) =>
      pin(
        String(i + 1),
        String(i + 1),
        i < 7
          ? digitalGeometry.ic.firstX +
              (i * (digitalGeometry.ic.lastX - digitalGeometry.ic.firstX)) / 6
          : digitalGeometry.ic.lastX -
              ((i - 7) * (digitalGeometry.ic.lastX - digitalGeometry.ic.firstX)) / 6,
        i < 7 ? digitalGeometry.ic.bottomY : digitalGeometry.ic.topY,
      ),
    ),
    controls: [],
    overlays: [],
  },
} satisfies Record<string, Layout>;
export function pinsFor(c: CircuitComponent): readonly PhotoPinDefinition[] {
  if (c.assetId !== 'ic-dip14')
    return digitalPins[c.assetId as keyof typeof digitalPins]?.pins ?? [];
  const outputs = TTL_MODELS[icModel(c)].gates.map((g) => g.output);
  return digitalPins['ic-dip14'].pins.map((p) => ({
    ...p,
    label:
      p.id === '14'
        ? '14 VCC'
        : p.id === '7'
          ? '7 GND'
          : `${p.id} ${outputs.includes(p.id) ? 'OUT' : 'IN'}`,
    role:
      p.id === '14'
        ? 'positive'
        : p.id === '7'
          ? 'ground'
          : outputs.includes(p.id)
            ? 'output'
            : 'input',
  }));
}
export function insertedPins(c: CircuitComponent): Record<string, PinRef> {
  const result: Record<string, PinRef> = {};
  const ins = c.insertion;
  if (!ins) return result;
  const part = plugInPart(c.assetId);
  if (part && ins.row) {
    pinsFor(c).forEach((pin, index) => {
      result[pin.id] = {
        componentId: ins.boardId,
        pinId: holeId(ins.bank, ins.row!, ins.column + part.offsets[index]),
      };
    });
    return result;
  }
  if (c.assetId !== 'ic-dip14') return result;
  for (let i = 0; i < 14; i++)
    result[String(i + 1)] = {
      componentId: ins.boardId,
      pinId: holeId(ins.bank, i < 7 ? 'f' : 'e', ins.column + (i < 7 ? i : 13 - i)),
    };
  return result;
}
