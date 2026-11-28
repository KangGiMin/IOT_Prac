import type { AssetId, PinRole } from '../../../types/circuit';
import type { ComponentDefinition, LocalPin } from '../types.ts';
const pin = (
  id: string,
  label: string,
  x: number,
  y: number,
  role: PinRole = 'terminal',
  style: LocalPin['style'] = 'screw',
  bus?: string,
): LocalPin => ({ id, label, position: { x, y }, role, style, bus });
const device = (
  id: AssetId,
  label: string,
  model: string,
  width: number,
  height: number,
  category: ComponentDefinition['category'],
  modes: ComponentDefinition['modes'],
  pins: LocalPin[] = [],
): ComponentDefinition => ({
  id,
  label,
  model,
  category,
  modes,
  viewBox: [0, 0, width, height],
  pins,
});
// This is the sole coordinate source for BOTH visible terminals and wire endpoints.
// Dimensions reproduce the reference's appearance, not calibrated physical dimensions.
const breadboardPins: LocalPin[] = [];
for (let column = 1; column <= 30; column++) {
  for (let row = 0; row < 10; row++) {
    const letter = 'abcdefghij'[row];
    breadboardPins.push(
      pin(
        `${letter}${column}`,
        `${letter.toUpperCase()}${column}`,
        47 + (column - 1) * 16,
        75 + row * 12 + (row >= 5 ? 28 : 0),
        'passive',
        'hole',
        `${row < 5 ? 'top' : 'bottom'}-${column}`,
      ),
    );
  }
  for (const [id, y, role] of [
    ['top-plus', 30, 'positive'],
    ['top-minus', 44, 'ground'],
    ['bottom-plus', 254, 'positive'],
    ['bottom-minus', 268, 'ground'],
  ] as const) {
    breadboardPins.push(
      pin(`${id}-${column}`, `${id} ${column}`, 47 + (column - 1) * 16, y, role, 'hole', id),
    );
  }
}
export const deviceDefinitions: Record<AssetId, ComponentDefinition> = {
  'panel-board': device(
    'panel-board',
    '알루미늄 실습판',
    'SEQUENCE TRAINING PANEL',
    1100,
    620,
    'board',
    ['sequence'],
  ),
  'pilot-lamp': device(
    'pilot-lamp',
    '표시 램프',
    'N-2260-06 · DC 24V',
    160,
    200,
    'control',
    ['sequence'],
    [pin('plus', '+', 58, 42, 'passive'), pin('minus', '−', 102, 42, 'passive')],
  ),
  'pb-switch': device(
    'pb-switch',
    '푸시버튼 스위치',
    'N-2260-03 · NO / NC',
    160,
    200,
    'control',
    ['sequence'],
    [
      pin('no1', 'NO 1', 35, 42),
      pin('no2', 'NO 2', 65, 42),
      pin('nc1', 'NC 1', 95, 42),
      pin('nc2', 'NC 2', 125, 42),
    ],
  ),
  'relay-socket': device(
    'relay-socket',
    '14핀 릴레이 소켓',
    'N-2260-11 · 4PDT',
    210,
    200,
    'control',
    ['sequence'],
    Array.from({ length: 14 }, (_, i) => {
      const number = i + 1;
      const coil = number >= 13;
      return pin(
        String(number),
        coil ? `${number} COIL` : String(number),
        123 + (i % 4) * 22,
        34 + Math.floor(i / 4) * 44,
        'terminal',
      );
    }),
  ),
  'relay-body': device('relay-body', '투명 릴레이', 'DC 24V · 4PDT', 100, 140, 'control', [
    'sequence',
  ]),
  // Reserved here because AssetId is shared with the photo workbench.
  'relay-unit-11p': device(
    'relay-unit-11p',
    '8핀 온딜레이 타이머 유닛',
    'TIMER UNIT (ON-DELAY)',
    192,
    256,
    'control',
    [],
  ),
  'motor-unit': device('motor-unit', '모터 유닛', 'N-2260-08', 184, 200, 'control', []),
  'timer-at8n': device('timer-at8n', '타이머 릴레이', 'AT8N · ON DELAY', 180, 200, 'control', [
    'sequence',
  ]),
  screwdriver: device('screwdriver', '배선 드라이버', 'INSULATED DRIVER', 50, 200, 'tool', [
    'sequence',
  ]),
  breadboard: device(
    'breadboard',
    '브레드보드',
    '30열 · 420개 홀',
    560,
    300,
    'board',
    ['digital'],
    breadboardPins,
  ),
  'power-supply': device(
    'power-supply',
    'DC 전원 공급기',
    'GP-4303TP · DC OUTPUT',
    310,
    190,
    'instrument',
    ['sequence', 'digital'],
    [
      pin('minus', '−', 127, 158, 'ground', 'socket'),
      pin('gnd', 'GND', 168, 158, 'ground', 'socket'),
      pin('plus', '+', 209, 158, 'positive', 'socket'),
    ],
  ),
  oscilloscope: device(
    'oscilloscope',
    '오실로스코프',
    'DS5152C · 2 CHANNEL',
    320,
    185,
    'instrument',
    ['digital'],
    [
      pin('ch1', 'CH1', 211, 158, 'input', 'socket'),
      pin('ch2', 'CH2', 252, 158, 'input', 'socket'),
    ],
  ),
  'led-red': device(
    'led-red',
    '적색 LED',
    '5 mm · A / K',
    65,
    110,
    'passive',
    ['digital'],
    [
      pin('anode', 'A +', 22, 96, 'passive', 'lead'),
      pin('cathode', 'K −', 43, 96, 'passive', 'lead'),
    ],
  ),
  'resistor-330': device(
    'resistor-330',
    '저항 330 Ω',
    '330 Ω · ±5% · ¼ W',
    145,
    65,
    'passive',
    ['digital'],
    [pin('1', '1', 12, 49, 'passive', 'lead'), pin('2', '2', 133, 49, 'passive', 'lead')],
  ),
  'ic-dip14': device(
    'ic-dip14',
    '74LS00 NAND',
    'QUAD 2-INPUT · DIP-14',
    210,
    100,
    'passive',
    ['digital'],
    Array.from({ length: 14 }, (_, i) =>
      pin(
        String(i + 1),
        i === 6 ? '7 GND' : i === 13 ? '14 VCC' : String(i + 1),
        i < 7 ? 24 + i * 27 : 186 - (i - 7) * 27,
        i < 7 ? 85 : 15,
        i === 6 ? 'ground' : i === 13 ? 'positive' : [2, 5, 7, 10].includes(i) ? 'output' : 'input',
        'lead',
      ),
    ),
  ),
  'switch-3pin': device(
    'switch-3pin',
    '슬라이드 스위치',
    'SPDT · 3 PIN',
    90,
    100,
    'control',
    ['digital'],
    [
      pin('1', '1', 25, 85, 'terminal', 'lead'),
      pin('com', 'COM', 45, 85, 'terminal', 'lead'),
      pin('2', '2', 65, 85, 'terminal', 'lead'),
    ],
  ),
};
export const wireColors = [
  { value: '#dc4c4c', label: '빨강' },
  { value: '#303b48', label: '검정' },
  { value: '#3780d5', label: '파랑' },
  { value: '#e3ac32', label: '노랑' },
  { value: '#159477', label: '초록' },
] as const;
