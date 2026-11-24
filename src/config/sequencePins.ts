import type {
  ComponentAsset,
  PhotoPinDefinition,
  PinRole,
} from "../types/circuit";
const pin = (
  id: string,
  label: string,
  x: number,
  y: number,
  role: PinRole = "terminal",
): PhotoPinDefinition => ({ id, label, position: { x, y }, role });
type Layout = Pick<ComponentAsset, "pins" | "controls" | "overlays">;
/** PNG-relative percentages; edit these numbers after installing final cutouts. */
export const sequenceGeometry = {
  railYs: [18, 36, 54, 72, 90],
  left: 5,
  right: 95,
  mount: { x: 76, y: 47, width: 28, height: 52 },
  dialCenter: { x: 50, y: 50 },
};
export const sequencePins = {
  "panel-board": {
    pins: [
      pin("plus", "+24V (실습 전원)", 9, 8, "positive"),
      pin("minus", "0V (실습 전원)", 22, 8, "ground"),
    ],
    controls: [],
    overlays: [],
  },
  "pilot-lamp": {
    pins: [pin("plus", "+", 42, 18), pin("minus", "?", 58, 18)],
    controls: [],
    overlays: [
      {
        id: "lamp",
        kind: "glow",
        bounds: { x: 27, y: 35, width: 46, height: 39 },
        color: "#ffde35",
      },
    ],
  },
  "pb-switch": {
    pins: [
      pin("no1", "NO 1", 30, 18),
      pin("no2", "NO 2", 43, 18),
      pin("nc1", "NC 1", 57, 18),
      pin("nc2", "NC 2", 70, 18),
    ],
    controls: [
      {
        id: "push",
        label: "??실습 전원?",
        kind: "momentary",
        setting: "pressed",
        bounds: { x: 27, y: 38, width: 46, height: 35 },
      },
    ],
    overlays: [],
  },
  "relay-socket": {
    pins: [
      pin("1", "1 NC", 67, 8),
      pin("2", "2 NC", 75, 8),
      pin("3", "3 NC", 83, 8),
      pin("4", "4 NC", 91, 8),
      pin("5", "5 NO", 67, 18),
      pin("6", "6 NO", 75, 18),
      pin("7", "7 NO", 83, 18),
      pin("8", "8 NO", 91, 18),
      pin("9", "9 COM", 67, 66),
      pin("10", "10 COM", 75, 66),
      pin("11", "11 COM", 83, 66),
      pin("12", "12 COM", 91, 66),
      pin("13", "13 COIL ?", 67, 77),
      pin("14", "14 COIL +", 91, 77),
    ],
    controls: [],
    overlays: [],
  },
  "relay-body": {
    pins: [],
    controls: [],
    overlays: [
      {
        id: "relay-led",
        kind: "glow",
        bounds: { x: 35, y: 12, width: 25, height: 18 },
        color: "#ff8844",
      },
    ],
  },
  // Front PNG has no rear pins: these are explicitly shown as a rear-socket strip.
  "timer-at8n": {
    pins: [
      pin("1", "1 COM", 8, 94),
      pin("2", "2 POWER ?", 20, 94),
      pin("3", "3 NO", 32, 94),
      pin("4", "4 NC", 44, 94),
      pin("5", "5 NC", 56, 94),
      pin("6", "6 NO", 68, 94),
      pin("7", "7 POWER +", 80, 94),
      pin("8", "8 COM", 92, 94),
    ],
    controls: [
      {
        id: "time",
        label: "타이머 시간 다이얼",
        kind: "dial",
        setting: "timerSeconds",
        bounds: { x: 23, y: 27, width: 54, height: 50 },
        min: 0,
        max: 10,
        step: 0.1,
        unit: "s",
      },
    ],
    overlays: [
      {
        id: "needle",
        kind: "needle",
        center: sequenceGeometry.dialCenter,
        length: 33,
        minAngle: -135,
        maxAngle: 135,
      },
      {
        id: "timer-run",
        kind: "glow",
        bounds: { x: 13, y: 11, width: 5, height: 5 },
        color: "#40ed83",
      },
      {
        id: "timer-out",
        kind: "glow",
        bounds: { x: 83, y: 11, width: 5, height: 5 },
        color: "#ff4934",
      },
    ],
  },
  screwdriver: { pins: [], controls: [], overlays: [] },
} satisfies Record<string, Layout>;
