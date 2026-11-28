import { describe, expect, it } from 'vitest';
import { solveCircuit, pinKey } from './circuitSolver';
import type { CircuitSolverInput } from './circuitSolver';
import { createPreset } from '../features/workbench/data/presets';
import { makeComponent } from '../features/workbench/data/photoCircuits';
import type { CircuitWire } from '../types/circuit';

const wire = (from: string, fp: string, to: string, tp: string): CircuitWire => ({
  id: `${from}-${fp}-${to}-${tp}`,
  from: { componentId: from, pinId: fp },
  to: { componentId: to, pinId: tp },
  color: '#dc4c4c',
});
function equivalent(input: CircuitSolverInput) {
  const full = solveCircuit({ ...input, compactBreadboards: false });
  const compact = solveCircuit({ ...input, compactBreadboards: true });
  expect(compact.status).toBe(full.status);
  expect(compact.energizedComponents).toEqual(full.energizedComponents);
  expect(compact.componentCurrents).toEqual(full.componentCurrents);
  expect(compact.sourceCurrents).toEqual(full.sourceCurrents);
  expect(
    compact.faults.map((f) => ({
      code: f.code,
      severity: f.severity,
      wires: [...f.wireIds].sort(),
      pins: f.pins.map(pinKey).sort(),
    })),
  ).toEqual(
    full.faults.map((f) => ({
      code: f.code,
      severity: f.severity,
      wires: [...f.wireIds].sort(),
      pins: f.pins.map(pinKey).sort(),
    })),
  );
  for (const [key, value] of Object.entries(full.pinValues)) {
    const actual = compact.pinValues[key] ?? {
      voltage: null,
      logic: 'floating',
    };
    expect(actual).toEqual(value);
  }
  return compact;
}

describe('compact runtime breadboard topology', () => {
  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])('preserves NAND simulation with inputs %s/%s and an inserted chip', (a, b) => {
    const w = createPreset('nand').workspace;
    w.components.find((c) => c.id === 'input-a')!.settings.switchOn = a;
    w.components.find((c) => c.id === 'input-b')!.settings.switchOn = b;
    equivalent({ ...w, mode: 'digital', power: { ...w.power, on: true } });
  });

  it('preserves direct-short and output-conflict diagnostics', () => {
    const w = createPreset('nand').workspace;
    equivalent({
      ...w,
      mode: 'digital',
      wires: [...w.wires, wire('board', 'top-plus-10', 'board', 'top-minus-10')],
      power: { ...w.power, on: true },
    });
    equivalent({
      ...w,
      mode: 'digital',
      wires: [...w.wires, wire('ic', '3', 'ic', '6')],
      power: { ...w.power, on: true },
    });
  });

  it('propagates voltage to every hole on used buses without joining different boards', () => {
    const components = [
      makeComponent('breadboard', 'left', 0, 0),
      makeComponent('breadboard', 'right', 0, 0),
      makeComponent('power-supply', 'ps', 0, 0),
    ];
    const result = equivalent({
      mode: 'digital',
      components,
      power: { on: true, voltage: 5 },
      wires: [wire('ps', 'plus', 'left', 'a1'), wire('ps', 'minus', 'left', 'top-minus-1')],
    });
    expect(result.pinValues['left:e1'].voltage).toBe(5);
    expect(result.pinValues['left:top-minus-63'].voltage).toBe(0);
    expect(result.pinValues['right:a1']).toBeUndefined();
  });

  it('retains invalid-wire diagnostics for unknown board holes', () => {
    const w = createPreset('nand').workspace;
    equivalent({
      ...w,
      mode: 'digital',
      wires: [...w.wires, wire('board', 'missing', 'ic', '1')],
    });
  });

  it('avoids expanding 315400 unused pins on 100 boards and expands only connected buses', () => {
    const input: CircuitSolverInput = {
      mode: 'digital',
      compactBreadboards: true,
      components: Array.from({ length: 100 }, (_, i) =>
        makeComponent('breadboard', 'board-' + i, 0, 0),
      ),
      wires: [],
      power: { on: true, voltage: 5 },
    };
    expect(Object.keys(solveCircuit(input).pinValues)).toHaveLength(0);
    input.wires.push(wire('board-0', 'a1', 'board-99', 'f63'));
    expect(Object.keys(solveCircuit(input).pinValues)).toHaveLength(10);
  });
});
