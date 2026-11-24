import {
  TTL_MODELS,
  icModel,
  isOpenCollector,
  gateValue,
} from "../config/ttlModels";
import { insertedPins } from "../config/digitalPins";
import { componentAssets } from "../config/assets";
import type {
  CircuitComponent,
  CircuitFault,
  CircuitFaultCode,
  CircuitMode,
  CircuitNode,
  CircuitWire,
  CircuitWorkspace,
  LogicLevel,
  PinRef,
  SimulationState,
} from "../types/circuit";

export interface CircuitSolverInput extends Pick<
  CircuitWorkspace,
  "components" | "wires" | "power"
> {
  nowMs?: number;
  mode: CircuitMode;
  /** Previous energized relay states permit self-holding circuits to retain state. */
  previous?: SimulationState;
}
export interface CircuitSolverResult extends SimulationState {
  isShorted: boolean;
  faults: CircuitFault[];
  nets: CircuitNode[];
  componentCurrents: Record<string, number>;
  warnings: string[];
}

/** Keys are stable domain references, independent of SVG position or zoom. */
export const pinKey = ({ componentId, pinId }: PinRef) =>
  `${componentId}:${pinId}`;
const ref = (componentId: string, pinId: string): PinRef => ({
  componentId,
  pinId,
});
const EPS = 1e-7;
const unique = <T>(values: T[]) => [...new Set(values)];

/** Path compression + union by rank: O((pins + wires) alpha(pins)). */
export class UnionFind {
  private parents = new Map<string, string>();
  private ranks = new Map<string, number>();
  add(id: string) {
    if (!this.parents.has(id)) {
      this.parents.set(id, id);
      this.ranks.set(id, 0);
    }
  }
  has(id: string) {
    return this.parents.has(id);
  }
  find(id: string): string {
    const parent = this.parents.get(id);
    if (parent === undefined)
      throw new Error(`Unknown circuit terminal: ${id}`);
    if (parent === id) return id;
    const root = this.find(parent);
    this.parents.set(id, root);
    return root;
  }
  union(a: string, b: string) {
    let ra = this.find(a),
      rb = this.find(b);
    if (ra === rb) return;
    if (this.ranks.get(ra)! < this.ranks.get(rb)!) [ra, rb] = [rb, ra];
    this.parents.set(rb, ra);
    if (this.ranks.get(ra) === this.ranks.get(rb))
      this.ranks.set(ra, this.ranks.get(ra)! + 1);
  }
}

/** SN74LS00 PDIP-14, TI SDLS025D. All four push-pull outputs are independent.
 * https://www.ti.com/lit/ds/symlink/sn74ls00.pdf
 */
export const NAND_GATES = [
  { inputs: ["1", "2"], output: "3" },
  { inputs: ["4", "5"], output: "6" },
  { inputs: ["9", "10"], output: "8" },
  { inputs: ["12", "13"], output: "11" },
] as const;
export const TTL = {
  minSupply: 4.75,
  maxSupply: 5.25,
  lowMax: 0.8,
  highMin: 2,
} as const;
export function ttlLevel(voltage: number | null): LogicLevel {
  if (voltage === null) return "floating";
  if (!Number.isFinite(voltage) || voltage < -0.3) return "unknown";
  return voltage <= TTL.lowMax ? 0 : voltage >= TTL.highMin ? 1 : "unknown";
}

interface Topology {
  uf: UnionFind;
  refs: Map<string, PinRef>;
  groups: Map<string, PinRef[]>;
  wires: CircuitWire[];
  invalid: CircuitWire[];
}
function buildTopology(
  input: CircuitSolverInput,
  relays: Set<string>,
  timerOutputs = new Set<string>(),
): Topology {
  const uf = new UnionFind(),
    refs = new Map<string, PinRef>();
  for (const component of input.components) {
    const buses = new Map<string, string>(); // bus identity is LOCAL to one component
    for (const pin of componentAssets[component.assetId].pins) {
      const r = ref(component.id, pin.id),
        key = pinKey(r);
      uf.add(key);
      refs.set(key, r);
      if (pin.bus) {
        const first = buses.get(pin.bus);
        if (first) uf.union(first, key);
        else buses.set(pin.bus, key);
      }
    }
  }
  for (const c of input.components)
    for (const [pin, target] of Object.entries(insertedPins(c))) {
      const a = pinKey(ref(c.id, pin)),
        b = pinKey(target);
      if (uf.has(a) && uf.has(b)) uf.union(a, b);
    }
  const wires: CircuitWire[] = [],
    invalid: CircuitWire[] = [];
  for (const wire of input.wires) {
    const a = pinKey(wire.from),
      b = pinKey(wire.to);
    if (uf.has(a) && uf.has(b)) {
      uf.union(a, b);
      wires.push(wire);
    } else invalid.push(wire);
  }
  const contact = (c: CircuitComponent, a: string, b: string) =>
    uf.union(pinKey(ref(c.id, a)), pinKey(ref(c.id, b)));
  for (const c of input.components) {
    if (c.assetId === "pb-switch")
      contact(
        c,
        c.settings.pressed ? "no1" : "nc1",
        c.settings.pressed ? "no2" : "nc2",
      );
    if (c.assetId === "switch-3pin")
      contact(c, "com", c.settings.switchOn ? "2" : "1");
    if (c.assetId === "timer-at8n") {
      contact(c, "1", timerOutputs.has(c.id) ? "3" : "4");
      contact(c, "8", timerOutputs.has(c.id) ? "6" : "5");
    }
    if (
      c.assetId === "relay-socket" &&
      input.components.some(
        (b) => b.assetId === "relay-body" && b.mountedSocketId === c.id,
      )
    ) {
      // Training unit: NC 1–4, NO 5–8, COM 9–12, coil 13(-)/14(+).
      for (let pole = 0; pole < 4; pole++)
        contact(c, String(9 + pole), String((relays.has(c.id) ? 5 : 1) + pole));
    }
  }
  const groups = new Map<string, PinRef[]>();
  for (const [key, r] of refs) {
    const root = uf.find(key),
      group = groups.get(root);
    if (group) group.push(r);
    else groups.set(root, [r]);
  }
  return { uf, refs, groups, wires, invalid };
}

interface Branch {
  id: string;
  a: string;
  b: string;
  ohms: number;
  diode: boolean;
}
interface DcResult {
  volts: Map<string, number>;
  currents: Record<string, number>;
  converged: boolean;
}
/** Partial-pivot Gaussian elimination, only for load-connected unknown nets.
 * Floating breadboard holes are NOT added to the dense conductance matrix.
 */
function linearSolve(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col]))
        pivot = row;
    if (Math.abs(matrix[pivot][col]) < 1e-15) return null;
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
    [rhs[col], rhs[pivot]] = [rhs[pivot], rhs[col]];
    for (let row = col + 1; row < n; row++) {
      const ratio = matrix[row][col] / matrix[col][col];
      for (let k = col; k < n; k++) matrix[row][k] -= ratio * matrix[col][k];
      rhs[row] -= ratio * rhs[col];
    }
  }
  const result = Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let value = rhs[row];
    for (let col = row + 1; col < n; col++)
      value -= matrix[row][col] * result[col];
    result[row] = value / matrix[row][row];
  }
  return result.every(Number.isFinite) ? result : null;
}

function solveDc(fixed: Map<string, number>, branches: Branch[]): DcResult {
  const adjacent = new Map<string, Set<string>>();
  for (const b of branches) {
    if (!adjacent.has(b.a)) adjacent.set(b.a, new Set());
    if (!adjacent.has(b.b)) adjacent.set(b.b, new Set());
    adjacent.get(b.a)!.add(b.b);
    adjacent.get(b.b)!.add(b.a);
  }
  const connected = new Set(fixed.keys()),
    queue = [...connected];
  for (let i = 0; i < queue.length; i++)
    for (const next of adjacent.get(queue[i]) ?? []) {
      if (!connected.has(next)) {
        connected.add(next);
        queue.push(next);
      }
    }
  const unknown = [...connected].filter((id) => !fixed.has(id));
  const index = new Map(unknown.map((id, i) => [id, i]));
  const active = branches.filter(
    (b) => connected.has(b.a) && connected.has(b.b) && b.a !== b.b,
  );
  let on = new Set<string>(),
    volts = new Map(fixed);
  for (let iteration = 0; iteration < 24; iteration++) {
    const matrix = unknown.map(() => Array<number>(unknown.length).fill(0)),
      rhs = unknown.map(() => 0);
    for (const b of active) {
      // Educational LED: 2 V forward drop + 20 ohm slope; off branch has tiny leakage.
      const conductance = b.diode && !on.has(b.id) ? 1e-9 : 1 / b.ohms;
      const drop = b.diode && on.has(b.id) ? 2 : 0;
      for (const [node, other, sign] of [
        [b.a, b.b, 1],
        [b.b, b.a, -1],
      ] as const) {
        const i = index.get(node);
        if (i === undefined) continue;
        matrix[i][i] += conductance;
        rhs[i] += sign * conductance * drop;
        const j = index.get(other);
        if (j !== undefined) matrix[i][j] -= conductance;
        else rhs[i] += conductance * fixed.get(other)!;
      }
    }
    const solution = linearSolve(matrix, rhs);
    if (!solution)
      return { volts: new Map(fixed), currents: {}, converged: false };
    volts = new Map([
      ...fixed,
      ...unknown.map((id, i) => [id, solution[i]] as const),
    ]);
    const next = new Set(
      active
        .filter((b) => b.diode && volts.get(b.a)! - volts.get(b.b)! > 2 + EPS)
        .map((b) => b.id),
    );
    if (next.size === on.size && [...next].every((id) => on.has(id))) {
      const currents: Record<string, number> = {};
      for (const b of branches) {
        const delta =
          volts.has(b.a) && volts.has(b.b)
            ? volts.get(b.a)! - volts.get(b.b)!
            : 0;
        currents[b.id] = b.diode
          ? Math.max(0, (delta - 2) / b.ohms)
          : delta / b.ohms;
      }
      return { volts, currents, converged: true };
    }
    on = next;
  }
  return { volts, currents: {}, converged: false };
}

/** Pure, synchronous solver. No DOM, timers, sound or Zustand side effects.
 * Wires/buses/closed contacts form equipotential nets. Loads NEVER union their ends.
 * Voltages use an ideal shared DC reference; TTL output current limits and analog
 * waveforms are outside this training model. Main power OFF still checks wiring,
 * while returning no live voltages/current or energized loads.
 */
export function solveCircuit(input: CircuitSolverInput): CircuitSolverResult {
  const components = input.components,
    faults: CircuitFault[] = [],
    warnings: string[] = [];
  let relays = new Set(
    input.power.on
      ? (input.previous?.energizedComponents.filter((id) =>
          components.some((c) => c.id === id && c.assetId === "relay-socket"),
        ) ?? [])
      : [],
  );
  const now = input.nowMs ?? Date.now();
  const timerStates: NonNullable<SimulationState["timerStates"]> = {};
  let timerOutputs = new Set<string>(
    input.power.on
      ? Object.entries(input.previous?.timerStates ?? {})
          .filter(([, t]) => t.output)
          .map(([id]) => id)
      : [],
  );
  let topology = buildTopology(input, relays, timerOutputs);
  let finalBranches: Branch[] = [];
  let volts = new Map<string, number>(),
    currents: Record<string, number> = {};
  const root = (r: PinRef) => topology.uf.find(pinKey(r));
  const fault = (
    code: CircuitFaultCode,
    message: string,
    pins: PinRef[],
    roots: string[] = [],
    severity: "short" | "error" = "short",
  ) => {
    if (faults.some((f) => f.code === code && f.message === message)) return;
    const allPins = [
      ...pins,
      ...roots.flatMap((id) => topology.groups.get(id) ?? []),
    ];
    const pinMap = new Map(allPins.map((p) => [pinKey(p), p]));
    faults.push({
      code,
      severity,
      message,
      pins: [...pinMap.values()],
      componentIds: unique(allPins.map((p) => p.componentId)),
      wireIds: topology.wires
        .filter(
          (w) =>
            roots.includes(root(w.from)) ||
            (pinMap.has(pinKey(w.from)) && pinMap.has(pinKey(w.to))),
        )
        .map((w) => w.id),
    });
  };
  const finish = (): CircuitSolverResult => {
    const isShorted = faults.some((f) => f.severity === "short"),
      running = input.power.on && faults.length === 0;
    const nets = [...topology.groups].map(([id, pins]) => {
      const voltage = running ? (volts.get(id) ?? null) : null;
      return { id, pins, voltage, logic: ttlLevel(voltage) };
    });
    const pinValues: SimulationState["pinValues"] = {};
    for (const net of nets)
      for (const p of net.pins)
        pinValues[pinKey(p)] = { voltage: net.voltage, logic: net.logic };
    const shortPins = new Map(
      faults
        .filter((f) => f.severity === "short")
        .flatMap((f) => f.pins)
        .map((p) => [pinKey(p), p]),
    );
    const energizedComponents = running
      ? components
          .filter((c) => {
            const current = Math.abs(currents[c.id] ?? 0);
            if (c.assetId === "relay-socket") return relays.has(c.id);
            if (c.assetId === "led-red") return current > 0.0001;
            if (c.assetId === "pilot-lamp") return current * 480 >= 21.6;
            if (c.assetId === "relay-body")
              return !!c.mountedSocketId && relays.has(c.mountedSocketId);
            if (c.assetId === "timer-at8n") return !!timerStates[c.id];
            if (c.assetId === "ic-dip14") {
              const vcc = volts.get(root(ref(c.id, "14"))),
                gnd = volts.get(root(ref(c.id, "7")));
              return (
                vcc !== undefined &&
                gnd !== undefined &&
                vcc - gnd >= TTL.minSupply &&
                vcc - gnd <= TTL.maxSupply
              );
            }
            return false;
          })
          .map((c) => c.id)
      : [];
    const sourceCurrents: Record<string, number> = {};
    if (running)
      for (const c of components.filter((c) => c.assetId === "power-supply"))
        for (const pin of ["plus", "ch2-plus", "5v-plus"]) {
          const source = root(ref(c.id, pin));
          let gateCurrent = 0;
          for (const chip of components.filter(
            (chip) =>
              chip.assetId === "ic-dip14" &&
              !isOpenCollector(chip) &&
              root(ref(chip.id, "14")) === source,
          )) {
            for (const gate of TTL_MODELS[icModel(chip)].gates) {
              const output = root(ref(chip.id, gate.output));
              if (
                output === source ||
                !volts.has(output) ||
                Math.abs(volts.get(output)! - volts.get(source)!) > EPS
              )
                continue;
              gateCurrent += Math.max(
                0,
                finalBranches.reduce(
                  (sum, b) =>
                    sum +
                    (b.a === output
                      ? (currents[b.id] ?? 0)
                      : b.b === output
                        ? -(currents[b.id] ?? 0)
                        : 0),
                  0,
                ),
              );
            }
          }
          sourceCurrents[c.id + ":" + pin] =
            gateCurrent +
            Math.max(
              0,
              finalBranches.reduce(
                (sum, b) =>
                  sum +
                  (b.a === source
                    ? (currents[b.id] ?? 0)
                    : b.b === source
                      ? -(currents[b.id] ?? 0)
                      : 0),
                0,
              ),
            );
        }
    return {
      sourceCurrents,
      status: faults.length ? "error" : running ? "running" : "ready",
      isShorted,
      faults,
      nets,
      pinValues,
      energizedComponents,
      timerStates: running ? timerStates : {},
      componentCurrents: running ? currents : {},
      warnings: unique(warnings),
      shortCircuit: {
        status: isShorted ? "short" : "clear",
        involvedPins: [...shortPins.values()],
        message: faults.length ? faults.map((f) => f.message).join("\n") : null,
      },
    };
  };

  const outerLimit = Math.max(32, components.length * 4);
  for (let pass = 0; pass < outerLimit; pass++) {
    topology = buildTopology(input, relays, timerOutputs);
    if (topology.invalid.length) {
      for (const w of topology.invalid) {
        fault(
          "INVALID_WIRE",
          `전선 ${w.id}: 존재하지 않는 부품/단자를 참조합니다.`,
          [w.from, w.to],
          [],
          "error",
        );
        faults.at(-1)!.wireIds.push(w.id);
      }
      return finish();
    }
    const fixed = new Map<string, number>(),
      sourcePins = new Map<string, PinRef[]>();
    for (const c of components) {
      if (
        c.assetId !== "power-supply" &&
        !(c.assetId === "panel-board" && input.mode === "sequence")
      )
        continue;
      if (c.assetId === "power-supply" && c.settings.outputEnabled === false)
        continue;
      const channels =
        c.assetId === "panel-board"
          ? [["plus", "minus", 24] as const]
          : [
              ["plus", "minus", c.settings.voltage] as const,
              ["ch2-plus", "ch2-minus", 5] as const,
              ["5v-plus", "5v-minus", 5] as const,
            ];
      for (const [pp, np, voltage] of channels) {
        const plus = ref(c.id, pp),
          minus = ref(c.id, np),
          a = root(plus),
          b = root(minus);
        if (a === b)
          fault(
            "POWER_SHORT",
            c.label +
              " [" +
              c.id +
              "] " +
              pp +
              "/" +
              np +
              ": 부하 없이 직접 단락되었습니다.",
            [plus, minus],
            [a],
          );
        for (const [id, value, p] of [
          [a, voltage, plus],
          [b, 0, minus],
        ] as const) {
          if (fixed.has(id) && Math.abs(fixed.get(id)! - value) > EPS)
            fault(
              "POWER_SHORT",
              "서로 다른 전원 전위가 같은 Net에 직접 연결되었습니다.",
              [...(sourcePins.get(id) ?? []), p],
              [id],
            );
          fixed.set(id, value);
          sourcePins.set(id, [...(sourcePins.get(id) ?? []), p]);
        }
      }
    }
    for (const [id, pins] of topology.groups) {
      const outputs = pins.filter(
        (p) =>
          components.some(
            (c) => c.id === p.componentId && c.assetId === "ic-dip14",
          ) &&
          TTL_MODELS[
            icModel(components.find((c) => c.id === p.componentId)!)
          ].gates.some((g) => g.output === p.pinId),
      );
      if (
        outputs.length > 1 &&
        !outputs.every((p) =>
          isOpenCollector(components.find((c) => c.id === p.componentId)!),
        )
      )
        fault(
          "OUTPUT_CONFLICT",
          `논리 게이트 출력 충돌: ${outputs.map((p) => `${p.componentId}의 ${p.pinId}번`).join(", ")}이 같은 Net에 연결되었습니다.`,
          outputs,
          [id],
        );
    }
    if (faults.length) return finish();

    const branches: Branch[] = [];
    for (const c of components) {
      const add = (a: string, b: string, ohms: number, diode = false) =>
        branches.push({
          id: c.id,
          a: root(ref(c.id, a)),
          b: root(ref(c.id, b)),
          ohms,
          diode,
        });
      if (c.assetId === "resistor-330") add("1", "2", 330);
      // Nominal teaching approximations, not measured hardware specifications.
      if (c.assetId === "pilot-lamp") add("plus", "minus", 480);
      if (
        c.assetId === "relay-socket" &&
        components.some(
          (b) => b.assetId === "relay-body" && b.mountedSocketId === c.id,
        )
      )
        add("14", "13", 1200);
      if (c.assetId === "timer-at8n") add("7", "2", 1200);
      if (c.assetId === "led-red") add("anode", "cathode", 20, true);
    }
    finalBranches = branches;
    let drivers = new Map<string, number>(),
      settled = false;
    for (
      let iteration = 0;
      iteration < Math.max(32, components.length * 4);
      iteration++
    ) {
      const dc = solveDc(new Map([...fixed, ...drivers]), branches);
      volts = dc.volts;
      currents = dc.currents;
      if (!dc.converged) break;
      const next = new Map<string, number>();
      for (const c of components.filter(
        (item) => item.assetId === "ic-dip14",
      )) {
        const vcc = volts.get(root(ref(c.id, "14"))),
          gnd = volts.get(root(ref(c.id, "7")));
        if (
          vcc === undefined ||
          gnd === undefined ||
          vcc - gnd < TTL.minSupply ||
          vcc - gnd > TTL.maxSupply
        )
          continue;
        for (const gate of TTL_MODELS[icModel(c)].gates) {
          const values = gate.inputs.map((pin) => {
            const value = volts.get(root(ref(c.id, pin)));
            return ttlLevel(value === undefined ? null : value - gnd);
          });
          const output: LogicLevel = gateValue(icModel(c), values);
          if (output === "unknown" || (isOpenCollector(c) && output === 1))
            continue;
          const pin = ref(c.id, gate.output),
            id = root(pin),
            value = output === 1 ? vcc : gnd;
          if (fixed.has(id) && Math.abs(fixed.get(id)! - value) > EPS)
            fault(
              "OUTPUT_CONFLICT",
              `${c.label} [${c.id}]의 ${gate.output}번 출력이 반대 전원의 Net과 충돌합니다.`,
              [pin],
              [id],
            );
          next.set(id, value);
        }
      }
      if (faults.length) return finish();
      if (
        next.size === drivers.size &&
        [...next].every(
          ([id, value]) =>
            Math.abs((drivers.get(id) ?? Infinity) - value) < EPS,
        )
      ) {
        settled = true;
        break;
      }
      drivers = next;
    }
    if (!settled) {
      fault(
        "UNSTABLE_CIRCUIT",
        "회로가 안정된 상태로 수렴하지 않습니다. 논리 피드백 또는 부하 연결을 확인하세요.",
        [],
        [],
        "error",
      );
      return finish();
    }

    for (const c of components.filter((item) => item.assetId === "ic-dip14")) {
      const vp = ref(c.id, "14"),
        gp = ref(c.id, "7"),
        a = root(vp),
        b = root(gp);
      const vcc = volts.get(a),
        gnd = volts.get(b);
      if (vcc !== undefined && gnd !== undefined) {
        const delta = vcc - gnd;
        if (delta < -0.5)
          fault(
            "IC_REVERSED_POWER",
            `${c.label} [${c.id}]: 14번 VCC와 7번 GND가 역연결되었습니다 (${delta.toFixed(2)} V).`,
            [vp, gp],
            [a, b],
          );
        else if (delta > TTL.maxSupply)
          fault(
            "IC_SUPPLY_VOLTAGE",
            `${c.label} [${c.id}] 전원 ${delta.toFixed(2)} V: ${icModel(c)} TTL 권장 범위는 4.75–5.25 V입니다.`,
            [vp, gp],
            [a, b],
            "error",
          );
        else if (input.power.on && delta < TTL.minSupply)
          warnings.push(`${c.id}: IC 전원 전압이 부족합니다.`);
      } else if (input.power.on)
        warnings.push(`${c.id}: 14번 VCC와 7번 GND의 전원을 연결하세요.`);
    }
    const allDriven = new Map([...fixed, ...drivers]);
    for (const c of components.filter((item) => item.assetId === "led-red")) {
      const anode = ref(c.id, "anode"),
        cathode = ref(c.id, "cathode"),
        a = root(anode),
        b = root(cathode);
      // A series 330-ohm resistor on EITHER leg separates that LED pin from the
      // ideal source net. A disconnected resistor, parallel resistor or bypass
      // wire cannot falsely satisfy this check. Requires a complete forward loop.
      const high = allDriven.get(a),
        low = allDriven.get(b);
      if (high !== undefined && low !== undefined && high - low >= 4.5)
        fault(
          "LED_MISSING_RESISTOR",
          `${c.label} [${c.id}]에 ${(high - low).toFixed(2)} V가 330Ω 직렬 전류 제한 저항 없이 직접 인가되었습니다.`,
          [anode, cathode],
          [a, b],
        );
    }
    if (faults.length) return finish();
    const nextRelays = new Set(
      input.power.on
        ? components
            .filter(
              (c) =>
                c.assetId === "relay-socket" &&
                components.some(
                  (b) =>
                    b.assetId === "relay-body" && b.mountedSocketId === c.id,
                ) &&
                Math.abs(currents[c.id] ?? 0) * 1200 >= 18,
            )
            .map((c) => c.id)
        : [],
    );
    const nextTimers = new Set<string>();
    for (const c of components.filter((c) => c.assetId === "timer-at8n")) {
      const delta =
        (volts.get(root(ref(c.id, "7"))) ?? 0) -
        (volts.get(root(ref(c.id, "2"))) ?? 0);
      if (input.power.on && delta >= 18) {
        const since =
          input.previous?.timerStates?.[c.id]?.since ??
          timerStates[c.id]?.since ??
          now;
        const elapsed = Math.max(0, (now - since) / 1000);
        timerStates[c.id] = {
          since,
          elapsed,
          output: elapsed >= c.settings.timerSeconds,
        };
        if (timerStates[c.id].output) nextTimers.add(c.id);
      } else delete timerStates[c.id];
    }
    const timersStable =
      nextTimers.size === timerOutputs.size &&
      [...nextTimers].every((id) => timerOutputs.has(id));
    timerOutputs = nextTimers;
    if (
      timersStable &&
      nextRelays.size === relays.size &&
      [...nextRelays].every((id) => relays.has(id))
    )
      return finish();
    relays = nextRelays;
  }
  fault(
    "UNSTABLE_CIRCUIT",
    "릴레이 접점이 반복 전환되어 안정 상태를 찾지 못했습니다. 자기 차단 배선을 확인하세요.",
    [],
    [],
    "error",
  );
  return finish();
}
