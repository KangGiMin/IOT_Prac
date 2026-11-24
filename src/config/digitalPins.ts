import type {
  ComponentAsset,
  PhotoPinDefinition,
  PinRole,
  CircuitComponent,
  PinRef,
} from "../types/circuit";
import { icModel, TTL_MODELS } from "./ttlModels";
const pin = (
  id: string,
  label: string,
  x: number,
  y: number,
  role: PinRole = "passive",
  bus?: string,
): PhotoPinDefinition => ({ id, label, position: { x, y }, role, bus });
/** Calibrated to the supplied 1448×1086 EIC-108 PNG, including its transparent padding. */
export const digitalGeometry = {
  columns: 63,
  firstX: 31.0,
  lastX: 88.8,
  rowPitch: 1.2,
  ic: { firstX: 19.3, lastX: 80.5, topY: 33.8, bottomY: 69.4 },
  banks: [
    { top: 10.8, bottom: 19.2 },
    { top: 32.2, bottom: 40.8 },
    { top: 53.7, bottom: 62.1 },
    { top: 75.0, bottom: 83.4 },
  ],
  rails: [
    { id: "top-plus", y: 7.0 },
    { id: "top-minus", y: 5.8 },
    { id: "middle1-plus", y: 28.7 },
    { id: "middle1-minus", y: 27.4 },
    { id: "middle2-plus", y: 50.0 },
    { id: "middle2-minus", y: 48.7 },
    { id: "middle3-plus", y: 71.5 },
    { id: "middle3-minus", y: 70.2 },
    { id: "bottom-plus", y: 92.8 },
    { id: "bottom-minus", y: 91.5 },
  ],
  posts: [
    { id: "post-gnd", label: "GND", x: 13.3, y: 12.5 },
    { id: "post-va", label: "Va", x: 13.3, y: 47.5 },
    { id: "post-vb", label: "Vb", x: 13.3, y: 35.7 },
    { id: "post-vc", label: "Vc", x: 13.3, y: 24.1 },
  ],
};
export const holeId = (bank: number, row: string, column: number) =>
  `${bank === 0 ? "" : `bank${bank + 1}-`}${row}${column}`;
export const breadboardPins: PhotoPinDefinition[] = digitalGeometry.posts.map(
  (p) => pin(p.id, p.label, p.x, p.y),
);
for (let col = 1; col <= digitalGeometry.columns; col++) {
  const x =
    digitalGeometry.firstX +
    ((col - 1) * (digitalGeometry.lastX - digitalGeometry.firstX)) /
      (digitalGeometry.columns - 1);
  digitalGeometry.banks.forEach((bank, b) => {
    for (let row = 0; row < 10; row++) {
      const y =
        (row < 5 ? bank.top : bank.bottom) +
        (row % 5) * digitalGeometry.rowPitch;
      breadboardPins.push(
        pin(
          holeId(b, "abcdefghij"[row], col),
          `${b + 1} / ${"ABCDEFGHIJ"[row]}${col}`,
          x,
          y,
          "passive",
          `bank${b}-${row < 5 ? "top" : "bottom"}-${col}`,
        ),
      );
    }
  });
  digitalGeometry.rails.forEach((r) =>
    breadboardPins.push(
      pin(`${r.id}-${col}`, `${r.id} ${col}`, x, r.y, "passive", r.id),
    ),
  );
}
type Layout = Pick<ComponentAsset, "pins" | "controls" | "overlays">;
export const digitalPins = {
  breadboard: { pins: breadboardPins, controls: [], overlays: [] },
  "power-supply": {
    pins: [
      pin("minus", "CH1 −", 60.6, 85.4),
      pin("plus", "CH1 +", 68.4, 85.4),
      pin("ch2-minus", "CH2 −", 38.0, 85.4),
      pin("ch2-plus", "CH2 +", 45.9, 85.4),
      pin("gnd", "GND 접지", 53.0, 85.4),
      pin("5v-minus", "5V −", 79.4, 85.4),
      pin("5v-plus", "5V +", 87.4, 85.4),
    ],
    controls: [
      {
        id: "output",
        label: "OUTPUT ON/OFF",
        kind: "power",
        bounds: { x: 29.7, y: 64.7, width: 3.6, height: 4.0 },
      },
      {
        id: "voltage",
        label: "CH1 전압",
        kind: "dial",
        setting: "voltage",
        bounds: { x: 82.5, y: 26, width: 10.5, height: 14 },
        min: 0,
        max: 30,
        step: 0.1,
        unit: "V",
      },
    ],
    overlays: [
      {
        id: "display",
        kind: "lcd",
        format: "supply",
        bounds: { x: 26.0, y: 27.9, width: 46.0, height: 30.3 },
      },
      {
        id: "cc",
        kind: "glow",
        bounds: { x: 80.1, y: 40.6, width: 2, height: 2.6 },
        color: "#ff2525",
      },
      {
        id: "overload",
        kind: "glow",
        bounds: { x: 80.1, y: 57.6, width: 2, height: 2.6 },
        color: "#ff2525",
      },
    ],
  },
  oscilloscope: {
    pins: [
      pin("ch1", "CH1", 63.7, 76.2, "input"),
      pin("ch2", "CH2", 74.6, 76.2, "input"),
      pin("ref", "GND REF", 96, 80),
    ],
    controls: [
      {
        id: "run",
        label: "RUN/STOP",
        kind: "toggle",
        setting: "scopeRunning",
        bounds: { x: 89.4, y: 29.8, width: 5.0, height: 4.0 },
      },
    ],
    overlays: [
      {
        id: "screen",
        kind: "lcd",
        format: "scope",
        bounds: { x: 10.2, y: 33.3, width: 37.3, height: 37.5 },
      },
    ],
  },
  "led-red": {
    pins: [
      pin("anode", "A (+) 긴 다리", 38.6, 91.9),
      pin("cathode", "K (−) 짧은 다리", 60.6, 89.8),
    ],
    controls: [],
    overlays: [
      {
        id: "led",
        kind: "glow",
        bounds: { x: 40.0, y: 10.0, width: 20.0, height: 22.0 },
        color: "#ff3030",
      },
    ],
  },
  "resistor-330": {
    pins: [pin("1", "1", 8.8, 91.4), pin("2", "2", 91.8, 84.2)],
    controls: [],
    overlays: [],
  },
  "switch-3pin": {
    pins: [
      pin("1", "LEFT", 36.5, 88.7),
      pin("com", "COM", 51.1, 88.7),
      pin("2", "RIGHT", 66.3, 88.7),
    ],
    controls: [
      {
        id: "slide",
        label: "슬라이드 스위치",
        kind: "toggle",
        setting: "switchOn",
        bounds: { x: 17, y: 35, width: 65, height: 31 },
      },
    ],
    overlays: [],
  },
  "ic-dip14": {
    pins: Array.from({ length: 14 }, (_, i) =>
      pin(
        String(i + 1),
        String(i + 1),
        i < 7 ? digitalGeometry.ic.firstX + i * (digitalGeometry.ic.lastX - digitalGeometry.ic.firstX) / 6 : digitalGeometry.ic.lastX - (i - 7) * (digitalGeometry.ic.lastX - digitalGeometry.ic.firstX) / 6,
        i < 7 ? digitalGeometry.ic.bottomY : digitalGeometry.ic.topY,
      ),
    ),
    controls: [],
    overlays: [],
  },
} satisfies Record<string, Layout>;
export function pinsFor(c: CircuitComponent): readonly PhotoPinDefinition[] {
  if (c.assetId !== "ic-dip14")
    return digitalPins[c.assetId as keyof typeof digitalPins]?.pins ?? [];
  const outputs = TTL_MODELS[icModel(c)].gates.map((g) => g.output);
  return digitalPins["ic-dip14"].pins.map((p) => ({
    ...p,
    label:
      p.id === "14"
        ? "14 VCC"
        : p.id === "7"
          ? "7 GND"
          : `${p.id} ${outputs.includes(p.id) ? "OUT" : "IN"}`,
    role:
      p.id === "14"
        ? "positive"
        : p.id === "7"
          ? "ground"
          : outputs.includes(p.id)
            ? "output"
            : "input",
  }));
}
export function insertedPins(c: CircuitComponent): Record<string, PinRef> {
  const result: Record<string, PinRef> = {};
  const ins = c.insertion;
  if (!ins) return result;
  for (let i = 0; i < 14; i++)
    result[String(i + 1)] = {
      componentId: ins.boardId,
      pinId: holeId(
        ins.bank,
        i < 7 ? "f" : "e",
        ins.column + (i < 7 ? i : 13 - i),
      ),
    };
  return result;
}
