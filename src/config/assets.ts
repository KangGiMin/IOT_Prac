import { digitalPins, digitalGeometry } from './digitalPins';
import { sequencePins } from './sequencePins';
import type { AssetId, ComponentAsset } from '../types/circuit';
/** Flat public/assets paths in Vite dev, Vite preview AND the root Live Server entry. */
const assetRoot = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}assets/`
  : new URL(/* @vite-ignore */ '.', import.meta.url).href;
const image = (fileName: ComponentAsset['fileName']) => ({
  fileName,
  src: `${assetRoot}${fileName}`,
});
export const jumperCableAsset = image('jumper-cable.png');
/** Starter breadboard template; adjust this grid to the user's final PNG.
 * Each column has two isolated strips of five holes. Rails are separate buses.
 * This is a coordinate template, not the reference board's exact hole count.
 */
export const breadboardLayout = digitalGeometry;
/** All positions/bounds are percentages (0–100) on the PNG rectangle.
 * Calibrate these starting points after installing each final cutout.
 * Rear pins hidden in a front photograph are intentionally left out.
 */
export const componentAssets: Record<AssetId, ComponentAsset> = {
  'panel-board': {
    id: 'panel-board',
    mode: 'sequence',
    label: '시퀀스 실습 보드',
    model: 'TRAINING PANEL',
    description:
      '24V 실습 전원과 부품 장착 레일을 제공하는 시퀀스 제어 판넬입니다.',
    ...image('panel-board.png'),
    size: { width: 1120, height: 640 },
    category: 'board',
    ...sequencePins['panel-board'],
  },
  'pilot-lamp': {
    id: 'pilot-lamp',
    mode: 'sequence',
    label: '표시 램프',
    model: 'Sysi N-2260-06 · 24V',
    description:
      '24V 전원이 흐르는 폐회로에서 켜지는 표시 램프입니다. +와 − 단자를 연결하세요.',
    ...image('pilot-lamp.png'),
    size: { width: 160, height: 200 },
    category: 'control',
    ...sequencePins['pilot-lamp'],
  },
  'pb-switch': {
    id: 'pb-switch',
    mode: 'sequence',
    label: '푸시버튼 스위치',
    model: 'Sysi N-2260-03 · NO / NC',
    description:
      '누르면 NO 접점이 닫히고 NC 접점이 열립니다. 모멘터리와 디텐트 동작을 선택할 수 있습니다.',
    ...image('pb-switch.png'),
    size: { width: 160, height: 200 },
    category: 'control',
    ...sequencePins['pb-switch'],
  },
  'relay-socket': {
    id: 'relay-socket',
    mode: 'sequence',
    label: '릴레이 본체',
    model: 'RELAY UNIT · 14P',
    description:
      '릴레이 소켓을 장착하면 코일 13(−)/14(+)와 네 조의 NC·NO·COM 접점을 사용할 수 있습니다.',
    ...image('relay-socket.png'),
    size: { width: 210, height: 200 },
    category: 'control',
    ...sequencePins['relay-socket'],
  },
  'relay-body': {
    id: 'relay-body',
    mode: 'sequence',
    label: '릴레이 소켓',
    model: 'DC 24V · 4PDT',
    description: '릴레이 본체 중앙으로 드래그하여 장착하세요.',
    ...image('relay-body.png'),
    size: { width: 100, height: 135 },
    category: 'control',
    ...sequencePins['relay-body'],
  },
  'timer-at8n': {
    id: 'timer-at8n',
    mode: 'sequence',
    label: '타이머 릴레이',
    model: 'Autonics AT8N · A ON-DELAY',
    description:
      '후면 소켓 전원 2−/7+, COM 1/8, NO 3/6, NC 4/5. A모드 On-Delay.',
    ...image('timer-at8n.png'),
    size: { width: 180, height: 200 },
    category: 'control',
    ...sequencePins['timer-at8n'],
  },
  screwdriver: {
    id: 'screwdriver',
    mode: 'sequence',
    label: '십자 드라이버',
    model: 'WIRING TOOL',
    description: '배선 모드에서 단자를 연결할 때 사용하는 십자 드라이버입니다.',
    ...image('screwdriver.png'),
    size: { width: 55, height: 220 },
    category: 'tool',
    ...sequencePins['screwdriver'],
  },
  breadboard: {
    id: 'breadboard',
    mode: 'digital',
    label: '브레드보드',
    model: 'E-CALL EIC-108',
    description:
      '같은 열의 5개 홀과 각 전원 레일은 내부 도통됩니다. 중앙 홈과 상·하단 레일은 분리됩니다.',
    ...image('breadboard.png'),
    size: { width: 680, height: 510 },
    category: 'board',
    ...digitalPins['breadboard'],
  },
  'power-supply': {
    id: 'power-supply',
    mode: 'digital',
    label: 'DC 파워서플라이',
    model: 'EZ DIGITAL GP-4303TP',
    description:
      'DC 출력은 + / −에 연결하세요. 녹색 GND는 접지 단자이며 −와 자동 연결되지 않습니다.',
    ...image('power-supply.png'),
    size: { width: 330, height: 247.5 },
    category: 'instrument',
    ...digitalPins['power-supply'],
  },
  oscilloscope: {
    id: 'oscilloscope',
    mode: 'digital',
    label: '오실로스코프',
    model: 'RIGOL DS5152C',
    description: '회로 프로브와 내장 아날로그 발생기 입력을 측정합니다. 사진의 다이얼에 커서를 놓고 휠을 돌리거나 드래그해 값을 바꾸세요.',
    ...image('oscilloscope.png'),
    size: { width: 330, height: 247.5 },
    category: 'instrument',
    ...digitalPins['oscilloscope'],
  },
  'led-red': {
    id: 'led-red',
    mode: 'digital',
    label: '적색 LED',
    model: 'RED · 5MM',
    description: '애노드(A)와 캐소드(K)를 구분하는 발광 다이오드',
    ...image('led-red.png'),
    size: { width: 65, height: 110 },
    category: 'passive',
    ...digitalPins['led-red'],
  },
  'resistor-330': {
    id: 'resistor-330',
    mode: 'digital',
    label: '저항 330Ω',
    model: '330Ω · ¼W',
    description: 'LED 전류 제한용 저항',
    ...image('resistor-330.png'),
    size: { width: 145, height: 65 },
    category: 'passive',
    ...digitalPins['resistor-330'],
  },
  'ic-dip14': {
    // Preserve the existing domain id; the file MUST be named ic-14pin.png.
    id: 'ic-dip14',
    mode: 'digital',
    label: 'TTL IC · DIP-14',
    model: 'TTL · DIP-14',
    description: '선택한 TTL 모델의 게이트 구성과 핀맵을 확인하세요.',
    ...image('ic-14pin.png'),
    size: { width: 210, height: 100 },
    category: 'passive',
    ...digitalPins['ic-dip14'],
  },
  'switch-3pin': {
    id: 'switch-3pin',
    mode: 'digital',
    label: '슬라이드 스위치',
    model: 'SPDT · 3 PIN',
    description: '공통 단자(COM)와 두 접점을 전환하는 스위치',
    ...image('switch-3pin.png'),
    size: { width: 90, height: 100 },
    category: 'control',
    ...digitalPins['switch-3pin'],
  },
};
export { wireColors } from './wireColors';
