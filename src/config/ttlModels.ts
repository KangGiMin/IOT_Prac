import type { CircuitComponent, LogicLevel } from "../types/circuit";
export const IC_MODELS = [
  "7400",
  "7402",
  "7406",
  "7408",
  "7411",
  "7486",
] as const;
export type IcModel = (typeof IC_MODELS)[number];
export interface Gate {
  inputs: readonly string[];
  output: string;
}
const quad: readonly Gate[] = [
  { inputs: ["1", "2"], output: "3" },
  { inputs: ["4", "5"], output: "6" },
  { inputs: ["9", "10"], output: "8" },
  { inputs: ["12", "13"], output: "11" },
];
export const TTL_MODELS: Record<
  IcModel,
  { name: string; gates: readonly Gate[] }
> = {
  "7400": { name: "NAND", gates: quad },
  "7402": {
    name: "NOR",
    gates: [
      { inputs: ["2", "3"], output: "1" },
      { inputs: ["5", "6"], output: "4" },
      { inputs: ["8", "9"], output: "10" },
      { inputs: ["11", "12"], output: "13" },
    ],
  },
  "7406": {
    name: "NOT",
    gates: [
      { inputs: ["1"], output: "2" },
      { inputs: ["3"], output: "4" },
      { inputs: ["5"], output: "6" },
      { inputs: ["9"], output: "8" },
      { inputs: ["11"], output: "10" },
      { inputs: ["13"], output: "12" },
    ],
  },
  "7408": { name: "AND", gates: quad },
  "7411": {
    name: "3-INPUT AND",
    gates: [
      { inputs: ["1", "2", "13"], output: "12" },
      { inputs: ["3", "4", "5"], output: "6" },
      { inputs: ["9", "10", "11"], output: "8" },
    ],
  },
  "7486": { name: "XOR", gates: quad },
};
export const icModel = (c: CircuitComponent): IcModel =>
  c.settings.icModel && IC_MODELS.includes(c.settings.icModel)
    ? c.settings.icModel
    : "7400";
export const isOpenCollector = (c: CircuitComponent) =>
  icModel(c) === "7406" && c.settings.openCollector === true;
export function gateValue(model: IcModel, values: LogicLevel[]): LogicLevel {
  if (model === "7406")
    return values[0] === 0 ? 1 : values[0] === 1 ? 0 : "unknown";
  if (model === "7486")
    return values.every((v) => v === 0 || v === 1)
      ? ((values.reduce<number>((a, b) => a + Number(b), 0) % 2) as 0 | 1)
      : "unknown";
  if (model === "7402")
    return values.includes(1)
      ? 0
      : values.every((v) => v === 0)
        ? 1
        : "unknown";
  const and: LogicLevel = values.includes(0)
    ? 0
    : values.every((v) => v === 1)
      ? 1
      : "unknown";
  return model === "7400" ? (and === 0 ? 1 : and === 1 ? 0 : "unknown") : and;
}
