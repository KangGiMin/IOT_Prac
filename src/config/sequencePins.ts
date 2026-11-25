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
/** PNG-relative percentages; edit these numbers after installing final cutouts. */
export const sequenceGeometry = {
  railYs: [18, 36, 54, 72, 90],
  left: 5,
  right: 95,
  // Slot between the upper NO and lower coil screws, on relay-socket.png.
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
// PB, lamp and relay centers follow the supplied 1134×1400 PNGs, including
// transparent padding. The timer front has no wiring terminals.
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
    pins: [pin('plus', '+', 45.3, 19.5), pin('minus', '−', 54.6, 19.5)],
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
  'pb-switch': {
    pins: [
      pin('no1', 'NO 1', 35.5, 19.9),
      pin('no2', 'NO 2', 45, 19.9),
      pin('nc1', 'NC 1', 54.5, 19.9),
      pin('nc2', 'NC 2', 64, 19.9),
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
      pin('1', '1 NC', 66.2, 21.3),
      pin('2', '2 NC', 73.8, 21.3),
      pin('3', '3 NC', 81.3, 21.3),
      pin('4', '4 NC', 88.8, 21.3),
      pin('5', '5 NO', 66.5, 27.6),
      pin('6', '6 NO', 74, 27.6),
      pin('7', '7 NO', 81.6, 27.6),
      pin('8', '8 NO', 89, 27.6),
      pin('9', '9 COM', 66.2, 64.1),
      pin('10', '10 COM', 73.8, 64.1),
      pin('11', '11 COM', 81.3, 64.1),
      pin('12', '12 COM', 88.8, 64.1),
      pin('13', '13 COIL −', 66.5, 56.4),
      pin('14', '14 COIL +', 89, 56.4),
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
