import { describe, expect, it } from "vitest";
import { solveCircuit, ttlLevel, UnionFind } from "./circuitSolver";
import type { CircuitSolverInput, CircuitSolverResult } from "./circuitSolver";
import type {
  AssetId,
  CircuitComponent,
  CircuitMode,
  CircuitWire,
} from "../types/circuit";

const component = (assetId: AssetId, id: string): CircuitComponent => ({
  id,
  assetId,
  label: id,
  position: { x: 0, y: 0 },
  settings: { pressed: false, switchOn: false, timerSeconds: 3, voltage: 5 },
});
const wire = (a: string, ap: string, b: string, bp: string): CircuitWire => ({
  id: `${a}.${ap}-${b}.${bp}`,
  from: { componentId: a, pinId: ap },
  to: { componentId: b, pinId: bp },
  color: "#dc4c4c",
});
const input = (
  components: CircuitComponent[],
  wires: CircuitWire[] = [],
  mode: CircuitMode = "digital",
): CircuitSolverInput => ({
  mode,
  components,
  wires,
  power: { on: true, voltage: mode === "sequence" ? 24 : 5 },
});
const net = (r: CircuitSolverResult, id: string, pin: string) =>
  r.nets.find((n) =>
    n.pins.some((p) => p.componentId === id && p.pinId === pin),
  )!;
const codes = (r: CircuitSolverResult) => r.faults.map((f) => f.code);
const ps = () => component("power-supply", "ps");
const ic = () => component("ic-dip14", "ic");
const supplyIc = () => [
  wire("ps", "plus", "ic", "14"),
  wire("ps", "minus", "ic", "7"),
];

describe("equipotential nets", () => {
  it("compresses a long union chain without losing members", () => {
    const uf = new UnionFind();
    for (let i = 0; i < 10000; i++) uf.add(String(i));
    for (let i = 1; i < 10000; i++) uf.union(String(i - 1), String(i));
    expect(uf.find("0")).toBe(uf.find("9999"));
  });
  it("merges wires and five-hole strips but separates the center, rails and other boards", () => {
    const r = solveCircuit(
      input(
        [ps(), component("breadboard", "bb"), component("breadboard", "other")],
        [wire("ps", "plus", "bb", "a1")],
      ),
    );
    expect(net(r, "ps", "plus").id).toBe(net(r, "bb", "e1").id);
    expect(net(r, "bb", "a1").id).not.toBe(net(r, "bb", "f1").id);
    expect(net(r, "bb", "a1").id).not.toBe(net(r, "other", "a1").id);
    expect(net(r, "bb", "top-plus-1").id).toBe(net(r, "bb", "top-plus-30").id);
    expect(net(r, "bb", "top-plus-1").id).not.toBe(
      net(r, "bb", "top-minus-1").id,
    );
    expect(net(r, "bb", "top-plus-1").id).not.toBe(
      net(r, "bb", "bottom-plus-1").id,
    );
    expect(net(r, "bb", "e1").voltage).toBe(5);
  });
  it("never unions the ends of a resistor/lamp/coil and keeps chassis ground separate", () => {
    const r = solveCircuit(
      input(
        [ps(), component("resistor-330", "r")],
        [wire("ps", "plus", "r", "1"), wire("r", "2", "ps", "minus")],
      ),
    );
    expect(r.isShorted).toBe(false);
    expect(net(r, "r", "1").id).not.toBe(net(r, "r", "2").id);
    expect(r.componentCurrents.r).toBeCloseTo(5 / 330);
    expect(net(r, "ps", "gnd").voltage).toBeNull();
  });
  it("reports invalid wire references without throwing or energizing anything", () => {
    const r = solveCircuit(input([ps()], [wire("ps", "plus", "missing", "1")]));
    expect(codes(r)).toContain("INVALID_WIRE");
    expect(r.status).toBe("error");
    expect(r.energizedComponents).toEqual([]);
  });
});

describe("shorts and wiring faults", () => {
  it("detects direct source shorts through wires and breadboard internal buses", () => {
    const r = solveCircuit(
      input(
        [ps(), component("breadboard", "bb")],
        [wire("ps", "plus", "bb", "a1"), wire("ps", "minus", "bb", "e1")],
      ),
    );
    expect(r.isShorted).toBe(true);
    expect(codes(r)).toContain("POWER_SHORT");
    expect(r.faults[0].wireIds).toHaveLength(2);
    expect(r.energizedComponents).toEqual([]);
    expect(
      Object.values(r.pinValues).every((value) => value.voltage === null),
    ).toBe(true);
  });
  it("a load elsewhere does not hide a source bypass", () => {
    const r = solveCircuit(
      input(
        [ps(), component("resistor-330", "r")],
        [
          wire("ps", "plus", "r", "1"),
          wire("r", "2", "ps", "minus"),
          wire("ps", "plus", "ps", "minus"),
        ],
      ),
    );
    expect(codes(r)).toContain("POWER_SHORT");
  });
  it("detects reversed IC VCC/GND through breadboard buses", () => {
    const r = solveCircuit(
      input(
        [ps(), ic(), component("breadboard", "bb")],
        [
          wire("ps", "minus", "bb", "a1"),
          wire("ic", "14", "bb", "e1"),
          wire("ps", "plus", "ic", "7"),
        ],
      ),
    );
    expect(r.isShorted).toBe(true);
    expect(codes(r)).toContain("IC_REVERSED_POWER");
    expect(r.faults[0].message).toContain("14번 VCC와 7번 GND");
    expect(r.faults[0].componentIds).toContain("ic");
    expect(r.faults[0].wireIds).toHaveLength(3);
  });
  it("detects LED supply without a series resistor, including a useless parallel resistor", () => {
    const r = solveCircuit(
      input(
        [ps(), component("led-red", "led"), component("resistor-330", "r")],
        [
          wire("ps", "plus", "led", "anode"),
          wire("led", "cathode", "ps", "minus"),
          wire("r", "1", "ps", "plus"),
          wire("r", "2", "ps", "minus"),
        ],
      ),
    );
    expect(codes(r)).toContain("LED_MISSING_RESISTOR");
    expect(r.isShorted).toBe(true);
    expect(r.energizedComponents).toEqual([]);
  });
  it.each(["anode", "cathode"] as const)(
    "accepts a 330-ohm resistor on the %s leg",
    (leg) => {
      const wires =
        leg === "anode"
          ? [
              wire("ps", "plus", "r", "1"),
              wire("r", "2", "led", "anode"),
              wire("led", "cathode", "ps", "minus"),
            ]
          : [
              wire("ps", "plus", "led", "anode"),
              wire("led", "cathode", "r", "1"),
              wire("r", "2", "ps", "minus"),
            ];
      const r = solveCircuit(
        input(
          [ps(), component("led-red", "led"), component("resistor-330", "r")],
          wires,
        ),
      );
      expect(r.isShorted).toBe(false);
      expect(r.faults).toEqual([]);
      expect(r.energizedComponents).toContain("led");
      expect(r.componentCurrents.led).toBeCloseTo(3 / 350, 5);
    },
  );
  it("detects a bypass around an otherwise correctly installed 330-ohm resistor", () => {
    const r = solveCircuit(
      input(
        [ps(), component("led-red", "led"), component("resistor-330", "r")],
        [
          wire("ps", "plus", "r", "1"),
          wire("r", "2", "led", "anode"),
          wire("led", "cathode", "ps", "minus"),
          wire("r", "1", "r", "2"),
        ],
      ),
    );
    expect(codes(r)).toContain("LED_MISSING_RESISTOR");
  });
  it("does not report an open LED leg or reverse-biased LED as a forward supply short", () => {
    const open = solveCircuit(
      input(
        [ps(), component("led-red", "led")],
        [wire("ps", "plus", "led", "anode")],
      ),
    );
    expect(open.isShorted).toBe(false);
    expect(open.energizedComponents).toEqual([]);
    const reverse = solveCircuit(
      input(
        [ps(), component("led-red", "led")],
        [
          wire("ps", "minus", "led", "anode"),
          wire("ps", "plus", "led", "cathode"),
        ],
      ),
    );
    expect(reverse.isShorted).toBe(false);
    expect(reverse.energizedComponents).toEqual([]);
  });
  it("rejects two independent outputs even on the same IC and even before power-on", () => {
    const request = input(
      [ps(), ic(), component("breadboard", "bb")],
      [wire("ic", "3", "bb", "a1"), wire("ic", "6", "bb", "e1")],
    );
    request.power.on = false;
    const r = solveCircuit(request);
    expect(r.isShorted).toBe(true);
    expect(codes(r)).toContain("OUTPUT_CONFLICT");
  });
  it("detects outputs from different ICs and clears the fault after the wire is removed", () => {
    const request = input(
      [ic(), component("ic-dip14", "ic2")],
      [wire("ic", "3", "ic2", "11")],
    );
    expect(solveCircuit(request).isShorted).toBe(true);
    request.wires = [];
    expect(solveCircuit(request).isShorted).toBe(false);
  });
});

describe("real-time TTL and sequence operation", () => {
  it.each([
    [0, 0, 1],
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
  ])("evaluates NAND %i,%i => %i", (a, b, output) => {
    const r = solveCircuit(
      input(
        [ps(), ic()],
        [
          ...supplyIc(),
          wire("ps", a ? "plus" : "minus", "ic", "1"),
          wire("ps", b ? "plus" : "minus", "ic", "2"),
        ],
      ),
    );
    expect(r.faults).toEqual([]);
    expect(r.pinValues["ic:3"].logic).toBe(output);
    expect(r.pinValues["ic:3"].voltage).toBe(output * 5);
  });
  it("propagates through cascaded gates and preserves floating/undefined inputs", () => {
    const r = solveCircuit(
      input(
        [ps(), ic()],
        [
          ...supplyIc(),
          wire("ps", "plus", "ic", "1"),
          wire("ps", "plus", "ic", "2"),
          wire("ic", "3", "ic", "4"),
          wire("ic", "3", "ic", "5"),
        ],
      ),
    );
    expect(r.pinValues["ic:6"].logic).toBe(1);
    expect(r.pinValues["ic:8"].logic).toBe("floating");
    const unpowered = solveCircuit(
      input(
        [ps(), ic()],
        [wire("ps", "plus", "ic", "1"), wire("ps", "plus", "ic", "14")],
      ),
    );
    expect(unpowered.pinValues["ic:3"].voltage).toBeNull();
    expect(unpowered.energizedComponents).not.toContain("ic");
    expect(ttlLevel(0.8)).toBe(0);
    expect(ttlLevel(2)).toBe(1);
    expect(ttlLevel(1.3)).toBe("unknown");
  });
  it("detects a driven gate output shorted to the opposite power rail", () => {
    const r = solveCircuit(
      input(
        [ps(), ic()],
        [
          ...supplyIc(),
          wire("ps", "minus", "ic", "1"),
          wire("ic", "3", "ps", "minus"),
        ],
      ),
    );
    expect(codes(r)).toContain("OUTPUT_CONFLICT");
    expect(r.isShorted).toBe(true);
  });
  it("protects TTL from a 24V supply", () => {
    const supply = ps();
    supply.settings.voltage = 24;
    const r = solveCircuit(input([supply, ic()], supplyIc()));
    expect(codes(r)).toContain("IC_SUPPLY_VOLTAGE");
    expect(r.status).toBe("error");
  });
  it("lights a 24V lamp only when the NO button completes the loop, and extinguishes on power-off", () => {
    const board = component("panel-board", "board"),
      pb = component("pb-switch", "pb"),
      lamp = component("pilot-lamp", "lamp");
    const request = input(
      [board, pb, lamp],
      [
        wire("board", "plus", "pb", "no1"),
        wire("pb", "no2", "lamp", "plus"),
        wire("lamp", "minus", "board", "minus"),
      ],
      "sequence",
    );
    expect(solveCircuit(request).energizedComponents).not.toContain("lamp");
    pb.settings.pressed = true;
    expect(solveCircuit(request).energizedComponents).toContain("lamp");
    request.power.on = false;
    const off = solveCircuit(request);
    expect(off.energizedComponents).toEqual([]);
    expect(off.componentCurrents).toEqual({});
    expect(Object.values(off.pinValues).every((p) => p.voltage === null)).toBe(
      true,
    );
  });
  it("detects a button-closing short immediately", () => {
    const pb = component("pb-switch", "pb");
    const request = input(
      [component("panel-board", "board"), pb],
      [wire("board", "plus", "pb", "no1"), wire("board", "minus", "pb", "no2")],
      "sequence",
    );
    expect(solveCircuit(request).isShorted).toBe(false);
    pb.settings.pressed = true;
    expect(solveCircuit(request).isShorted).toBe(true);
  });
  it("switches a 24V relay and preserves a self-holding contact after button release", () => {
    const pb = component("pb-switch", "pb"),
      relay = component("relay-socket", "relay");
    const body = {
      ...component("relay-body", "body"),
      mountedSocketId: "relay",
    };
    const request = input(
      [component("panel-board", "board"), pb, relay, body],
      [
        wire("board", "plus", "pb", "no1"),
        wire("pb", "no2", "relay", "14"),
        wire("relay", "13", "board", "minus"),
        wire("board", "plus", "relay", "5"),
        wire("relay", "9", "relay", "14"),
      ],
      "sequence",
    );
    expect(solveCircuit(request).energizedComponents).not.toContain("relay");
    pb.settings.pressed = true;
    const pressed = solveCircuit(request);
    expect(pressed.energizedComponents).toContain("relay");
    pb.settings.pressed = false;
    request.previous = pressed;
    expect(solveCircuit(request).energizedComponents).toContain("relay");
    request.power.on = false;
    expect(solveCircuit(request).energizedComponents).toEqual([]);
  });
  it("stops a relay that repeatedly interrupts its own NC coil path", () => {
    const request = input(
      [
        component("panel-board", "board"),
        component("relay-socket", "relay"),
        { ...component("relay-body", "body"), mountedSocketId: "relay" },
      ],
      [
        wire("board", "plus", "relay", "1"),
        wire("relay", "9", "relay", "14"),
        wire("relay", "13", "board", "minus"),
      ],
      "sequence",
    );
    const r = solveCircuit(request);
    expect(codes(r)).toContain("UNSTABLE_CIRCUIT");
    expect(r.energizedComponents).toEqual([]);
  });
});
