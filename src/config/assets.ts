import { digitalPins, digitalGeometry } from "./digitalPins";
import { sequencePins } from "./sequencePins";
import type {
  AssetId,
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
  bus?: string,
): PhotoPinDefinition => ({
  id,
  label,
  position: { x, y },
  role,
  ...(bus ? { bus } : {}),
});

/** Flat public/assets paths in Vite dev, Vite preview AND the root Live Server entry. */
const assetRoot = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}assets/`
  : new URL(/* @vite-ignore */ ".", import.meta.url).href;
const image = (fileName: ComponentAsset["fileName"]) => ({
  fileName,
  src: `${assetRoot}${fileName}`,
});
export const jumperCableAsset = image("jumper-cable.png");

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
  "panel-board": {
    id: "panel-board",
    mode: "sequence",
    label: "시퀀스 실습 보드",
    model: "TRAINING PANEL",
    description: "sequencePins.ts",
    ...image("panel-board.png"),
    size: { width: 1120, height: 640 },
    category: "board",
    ...sequencePins["panel-board"],
  },
  "pilot-lamp": {
    id: "pilot-lamp",
    mode: "sequence",
    label: "표시 램프",
    model: "Sysi N-2260-06 ? 24V",
    description: "sequencePins.ts",
    ...image("pilot-lamp.png"),
    size: { width: 160, height: 200 },
    category: "control",
    ...sequencePins["pilot-lamp"],
  },
  "pb-switch": {
    id: "pb-switch",
    mode: "sequence",
    label: "푸시버튼 스위치",
    model: "Sysi N-2260-03 ? NO / NC",
    description: "sequencePins.ts",
    ...image("pb-switch.png"),
    size: { width: 160, height: 200 },
    category: "control",
    ...sequencePins["pb-switch"],
  },
  "relay-socket": {
    id: "relay-socket",
    mode: "sequence",
    label: "릴레이 소켓",
    model: "RELAY UNIT ? 14P",
    description: "sequencePins.ts",
    ...image("relay-socket.png"),
    size: { width: 210, height: 200 },
    category: "control",
    ...sequencePins["relay-socket"],
  },
  "relay-body": {
    id: "relay-body",
    mode: "sequence",
    label: "릴레이 본체",
    model: "DC 24V · 4PDT",
    description: "소켓 중앙으로 드래그하여 장착하세요.",
    ...image("relay-body.png"),
    size: { width: 100, height: 135 },
    category: "control",
    ...sequencePins["relay-body"],
  },
  "timer-at8n": {
    id: "timer-at8n",
    mode: "sequence",
    label: "타이머 릴레이",
    model: "Autonics AT8N · A ON-DELAY",
    description:
      "후면 소켓 전원 2−/7+, COM 1/8, NO 3/6, NC 4/5. A모드 On-Delay.",
    ...image("timer-at8n.png"),
    size: { width: 180, height: 200 },
    category: "control",
    ...sequencePins["timer-at8n"],
  },
  screwdriver: {
    id: "screwdriver",
    mode: "sequence",
    label: "십자 드라이버",
    model: "WIRING TOOL",
    description: "sequencePins.ts",
    ...image("screwdriver.png"),
    size: { width: 55, height: 220 },
    category: "tool",
    ...sequencePins["screwdriver"],
  },
  breadboard: {
    id: "breadboard",
    mode: "digital",
    label: "브레드보드",
    model: "E-CALL EIC-108",
    description:
      "같은 열의 5개 홀과 각 전원 레일은 내부 도통됩니다. 중앙 홈과 상·하단 레일은 분리됩니다.",
    ...image("breadboard.png"),
    size: { width: 680, height: 510 },
    category: "board",
    pins: digitalPins.breadboard.pins,
    controls: [],
    overlays: [],
  },
  "power-supply": {
    id: "power-supply",
    mode: "digital",
    label: "DC 파워서플라이",
    model: "EZ DIGITAL GP-4303TP",
    description:
      "DC 출력은 + / −에 연결하세요. 녹색 GND는 접지 단자이며 −와 자동 연결되지 않습니다.",
    ...image("power-supply.png"),
    size: { width: 330, height: 247.5 },
    category: "instrument",
    pins: [
      pin("gnd", "GND", 49, 88, "ground"),
      pin("minus", "−", 58, 88, "ground"),
      pin("plus", "+", 67, 88, "positive"),
    ],
    controls: [
      {
        id: "voltage",
        label: "출력 전압 다이얼",
        kind: "dial",
        setting: "voltage",
        bounds: { x: 84, y: 8, width: 13, height: 23 },
        min: 0,
        max: 30,
        step: 0.1,
        unit: "V",
      },
      {
        id: "output",
        label: "전원 공급기 출력",
        kind: "power",
        bounds: { x: 7, y: 80, width: 9, height: 14 },
      },
    ],
    overlays: [
      {
        id: "display",
        kind: "lcd",
        bounds: { x: 27, y: 14, width: 45, height: 37 },
        format: "supply",
      },
    ],
  },
  oscilloscope: {
    id: "oscilloscope",
    mode: "digital",
    label: "오실로스코프",
    model: "RIGOL DS5152C",
    description: "CH1·CH2에 연결된 노드의 실시간 디지털 파형을 표시합니다.",
    ...image("oscilloscope.png"),
    size: { width: 330, height: 247.5 },
    category: "instrument",
    pins: [
      pin("ch1", "CH1", 65, 89, "input"),
      pin("ch2", "CH2", 76, 89, "input"),
    ],
    controls: [],
    overlays: [
      {
        id: "screen",
        kind: "lcd",
        bounds: { x: 11, y: 19, width: 36, height: 59 },
        format: "scope",
      },
    ],
  },
  "led-red": {
    id: "led-red",
    mode: "digital",
    label: "적색 LED",
    model: "RED · 5MM",
    description: "애노드(A)와 캐소드(K)를 구분하는 발광 다이오드",
    ...image("led-red.png"),
    size: { width: 65, height: 110 },
    category: "passive",
    pins: [
      pin("anode", "A (+)", 31, 92, "passive"),
      pin("cathode", "K (−)", 65, 92, "passive"),
    ],
    controls: [],
    overlays: [
      {
        id: "led",
        kind: "glow",
        bounds: { x: 20, y: 5, width: 65, height: 43 },
        color: "#ff4040",
      },
    ],
  },
  "resistor-330": {
    id: "resistor-330",
    mode: "digital",
    label: "저항 330Ω",
    model: "330Ω · ¼W",
    description: "LED 전류 제한용 저항",
    ...image("resistor-330.png"),
    size: { width: 145, height: 65 },
    category: "passive",
    pins: [pin("1", "1", 7, 85, "passive"), pin("2", "2", 93, 85, "passive")],
    controls: [],
    overlays: [],
  },
  "ic-dip14": {
    // Preserve the existing domain id; the file MUST be named ic-14pin.png.
    id: "ic-dip14",
    mode: "digital",
    label: "TTL IC · DIP-14",
    model: "QUAD NAND · DIP-14",
    description: "2입력 NAND 4개. 14번 VCC(+5V), 7번 GND(0V), 출력 3·6·8·11번.",
    ...image("ic-14pin.png"),
    size: { width: 210, height: 100 },
    category: "passive",
    pins: Array.from({ length: 14 }, (_, i) =>
      pin(
        String(i + 1),
        i === 13
          ? "14 VCC"
          : i === 6
            ? "7 GND"
            : `${i + 1}${[2, 5, 7, 10].includes(i) ? " OUT" : " IN"}`,
        i < 7 ? 10 + i * 13.3 : 90 - (i - 7) * 13.3,
        i < 7 ? 90 : 10,
        i === 13
          ? "positive"
          : i === 6
            ? "ground"
            : [2, 5, 7, 10].includes(i)
              ? "output"
              : "input",
      ),
    ),
    controls: [],
    overlays: [],
  },
  "switch-3pin": {
    id: "switch-3pin",
    mode: "digital",
    label: "슬라이드 스위치",
    model: "SPDT · 3 PIN",
    description: "공통 단자(COM)와 두 접점을 전환하는 스위치",
    ...image("switch-3pin.png"),
    size: { width: 90, height: 100 },
    category: "control",
    pins: [
      pin("1", "1", 27, 88),
      pin("com", "COM", 50, 88),
      pin("2", "2", 73, 88),
    ],
    controls: [
      {
        id: "slide",
        label: "슬라이드 스위치 전환",
        kind: "toggle",
        setting: "switchOn",
        bounds: { x: 16, y: 15, width: 68, height: 50 },
      },
    ],
    overlays: [],
  },
};

for (const id of Object.keys(sequencePins) as (keyof typeof sequencePins)[])
  Object.assign(componentAssets[id], sequencePins[id]);

for (const id of Object.keys(digitalPins) as (keyof typeof digitalPins)[])
  Object.assign(componentAssets[id], digitalPins[id]);

export const wireColors = [
  { value: "#dc4c4c", label: "빨강" },
  { value: "#303b48", label: "검정" },
  { value: "#3780d5", label: "파랑" },
  { value: "#159477", label: "초록" },
  { value: "#e3ac32", label: "노랑" },
] as const;
