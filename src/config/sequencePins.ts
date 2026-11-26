import type {
  ComponentAsset,
  PhotoPinDefinition,
  PinRole,
} from '../types/circuit';
const pin = (
  id: string,
  label: string,
  x: number,
  y: number,
  role: PinRole = 'terminal',
): PhotoPinDefinition => ({ id, label, position: { x, y }, role });
type Layout = Pick<ComponentAsset, 'pins' | 'controls' | 'overlays'>;
export const relay14 = {
  coil: { plus: '14', minus: '13' },
  poles: [
    { com: '9', no: '5', nc: '1' },
    { com: '10', no: '6', nc: '2' },
    { com: '11', no: '7', nc: '3' },
    { com: '12', no: '8', nc: '4' },
  ],
} as const;
/** PNG-relative percentages; edit these numbers after installing final cutouts. */
export const sequenceGeometry = {
  railYs: [18, 36, 54, 72, 90],
  left: 5,
  right: 95,
  // Slot between the upper contact rows and lower coil screws on relay-socket.png.
  mount: { x: 78.3, y: 42.2, width: 19.2, height: 21.8 },
  relayImages: {
    socket: { width: 1122, height: 1402 },
    body: {
      width: 1254, height: 1254,
      // Visible housing inside the transparent PNG canvas (percent).
      housing: { x: 14.3, y: 4.4, width: 71.1, height: 91.2 },
    },
  },
  dialCenter: { x: 50, y: 50 },
};
interface ScrewRim { x: number; y: number; rx: number; ry: number }
/** Each photographed rim measured on the original PNG, including transparency.
 * Pixel measurements are converted to percentage hotspots below. */
export const sequenceScrewGeometry = {
  'pb-switch': {
    image: { width: 1122, height: 1402 },
    heads: {
      no1: { x: 403.5, y: 278.5, rx: 38.5, ry: 41.5 },
      no2: { x: 510.5, y: 277.5, rx: 38.5, ry: 41.5 },
      nc1: { x: 619.5, y: 276.5, rx: 38.5, ry: 41.5 },
      nc2: { x: 724.5, y: 278.5, rx: 38.5, ry: 41.5 },
    } as Record<string, ScrewRim>,
  },
  'pilot-lamp': {
    image: { width: 1122, height: 1402 },
    heads: {
      plus: { x: 517.5, y: 274, rx: 36, ry: 41.5 },
      minus: { x: 618, y: 275.5, rx: 35.5, ry: 40 },
    } as Record<string, ScrewRim>,
  },
  'motor-unit': {
    image: { width: 1201, height: 1309 },
    heads: {
      plus: { x: 540, y: 332, rx: 42, ry: 43 },
      minus: { x: 672, y: 332, rx: 42, ry: 43 },
    } as Record<string, ScrewRim>,
  },
  'relay-socket': {
    image: sequenceGeometry.relayImages.socket,
    heads: {
      '5': { x: 750.5, y: 301.5, rx: 29.5, ry: 31 },
      '6': { x: 838.5, y: 301.5, rx: 30.5, ry: 33.5 },
      '7': { x: 921, y: 300.5, rx: 32.5, ry: 33.5 },
      '8': { x: 1005.5, y: 301, rx: 32.5, ry: 33.5 },
      '1': { x: 755, y: 386, rx: 30, ry: 28.5 },
      '2': { x: 840.5, y: 387, rx: 29.5, ry: 28.5 },
      '3': { x: 927.5, y: 386, rx: 29.5, ry: 28.5 },
      '4': { x: 1013.5, y: 387, rx: 29.5, ry: 28.5 },
      '9': { x: 755, y: 901.5, rx: 29.5, ry: 34.5 },
      '10': { x: 840, y: 902.5, rx: 29.5, ry: 32 },
      '11': { x: 925.5, y: 902.5, rx: 29.5, ry: 32 },
      '12': { x: 1011.5, y: 902.5, rx: 29.5, ry: 32 },
      '14': { x: 754, y: 793.5, rx: 29.5, ry: 30 },
      '13': { x: 1011, y: 793.5, rx: 29.5, ry: 29.5 },
    } as Record<string, ScrewRim>,
  },
  virtualHeadRatio: 0.72,
};
type PhotographedScrewAsset = Exclude<keyof typeof sequenceScrewGeometry, 'virtualHeadRatio'>;
const photoPin = (asset: PhotographedScrewAsset, id: string, label: string) => {
  const { image, heads } = sequenceScrewGeometry[asset];
  const rim = heads[id];
  return pin(id, label, rim.x / image.width * 100, rim.y / image.height * 100);
};
// The timer front has no wiring terminals.
export const sequencePins = {
  'panel-board': {
    pins: [
      pin('plus', '+24V (실습 전원)', 9, 8, 'positive'),
      pin('minus', '0V (실습 전원)', 22, 8, 'ground'),
    ],
    controls: [],
    overlays: [],
  },
  'pilot-lamp': {
    pins: [photoPin('pilot-lamp', 'plus', '+'), photoPin('pilot-lamp', 'minus', '−')],
    controls: [],
    overlays: [
      {
        id: 'lamp',
        kind: 'glow',
        bounds: { x: 27, y: 35, width: 46, height: 39 },
        color: '#ffde35',
      },
    ],
  },
  'motor-unit': {
    pins: [photoPin('motor-unit', 'plus', '+'), photoPin('motor-unit', 'minus', '−')],
    controls: [],
    overlays: [],
  },
  'pb-switch': {
    pins: [
      photoPin('pb-switch', 'no1', 'NO 1'),
      photoPin('pb-switch', 'no2', 'NO 2'),
      photoPin('pb-switch', 'nc1', 'NC 1'),
      photoPin('pb-switch', 'nc2', 'NC 2'),
    ],
    controls: [
      {
        id: 'push',
        label: '푸시버튼 누르기',
        kind: 'momentary',
        setting: 'pressed',
        bounds: { x: 27, y: 38, width: 46, height: 35 },
      },
    ],
    overlays: [],
  },
  'relay-socket': {
    pins: [
      ...relay14.poles.map(({ no }) => photoPin('relay-socket', no, `${no} a (NO)`)),
      ...relay14.poles.map(({ nc }) => photoPin('relay-socket', nc, `${nc} b (NC)`)),
      ...relay14.poles.map(({ com }) => photoPin('relay-socket', com, `${com} c (COM)`)),
      photoPin('relay-socket', relay14.coil.plus, `${relay14.coil.plus} COIL +`),
      photoPin('relay-socket', relay14.coil.minus, `${relay14.coil.minus} COIL −`),
    ],
    controls: [],
    overlays: [],
  },
  'relay-body': {
    pins: [],
    controls: [],
    overlays: [
      {
        id: 'relay-led',
        kind: 'glow',
        bounds: { x: 35, y: 12, width: 25, height: 18 },
        color: '#ff8844',
      },
    ],
  },
  // This asset retains its original ID so previously saved placements load.
  'relay-unit-11p': { pins: [], controls: [], overlays: [] },
  // Front PNG has no rear pins: these are explicitly shown as a rear-socket strip.
  'timer-at8n': {
    pins: [
      pin('1', '1 COM', 8, 94),
      pin('2', '2 POWER −', 20, 94),
      pin('3', '3 NO', 32, 94),
      pin('4', '4 NC', 44, 94),
      pin('5', '5 NC', 56, 94),
      pin('6', '6 NO', 68, 94),
      pin('7', '7 POWER +', 80, 94),
      pin('8', '8 COM', 92, 94),
    ],
    controls: [
      {
        id: 'time',
        label: '타이머 시간 다이얼',
        kind: 'dial',
        setting: 'timerSeconds',
        bounds: { x: 23, y: 27, width: 54, height: 50 },
        min: 0,
        max: 10,
        step: 0.1,
        unit: 's',
      },
    ],
    overlays: [
      {
        id: 'needle',
        kind: 'needle',
        center: sequenceGeometry.dialCenter,
        length: 33,
        minAngle: -135,
        maxAngle: 135,
      },
      {
        id: 'timer-run',
        kind: 'glow',
        bounds: { x: 13, y: 11, width: 5, height: 5 },
        color: '#40ed83',
      },
      {
        id: 'timer-out',
        kind: 'glow',
        bounds: { x: 83, y: 11, width: 5, height: 5 },
        color: '#ff4934',
      },
    ],
  },
  screwdriver: { pins: [], controls: [], overlays: [] },
} satisfies Record<string, Layout>;
