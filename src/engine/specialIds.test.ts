import { describe, expect, it } from 'vitest';
import { exportCircuitFile, importCircuitFile } from './circuitFile';
import { solveCircuit } from './circuitSolver';
import { createPreset } from '../features/workbench/data/presets';
import { makeComponent } from '../features/workbench/data/photoCircuits';

const ids = ['__proto__', 'constructor', 'toString', 'hasOwnProperty'];
const workspaces = () => ({
  sequence: createPreset('self-hold').workspace,
  digital: createPreset('nand').workspace,
});

describe('component IDs that match Object.prototype properties', () => {
  it.each(ids)(
    'round-trips and lights an LED named %s with a numeric current',
    (id) => {
      const w = workspaces();
      w.digital.components.find((c) => c.id === 'output-led')!.id = id;
      for (const wire of w.digital.wires)
        for (const endpoint of [wire.from, wire.to])
          if (endpoint.componentId === 'output-led') endpoint.componentId = id;
      const loaded = importCircuitFile(exportCircuitFile('digital', w))
        .workspaces.digital;
      const result = solveCircuit({
        ...loaded,
        mode: 'digital',
        power: { ...loaded.power, on: true },
      });
      expect(result.faults).toEqual([]);
      expect(result.energizedComponents).toContain(id);
      expect(result.componentCurrents[id]).toBeCloseTo(3 / 350);
      expect(Object.getPrototypeOf(result.componentCurrents)).toBeNull();
      const off = solveCircuit({
        ...loaded,
        mode: 'digital',
        power: { ...loaded.power, on: false },
        previous: result,
      });
      expect(off.componentCurrents[id]).toBeUndefined();
    },
  );

  it.each(ids)(
    'never invents a timer state for an unwired timer named %s',
    (id) => {
      const w = workspaces();
      w.sequence.components.push(makeComponent('timer-at8n', id, 0, 0));
      const loaded = importCircuitFile(exportCircuitFile('sequence', w))
        .workspaces.sequence;
      for (const on of [false, true]) {
        const result = solveCircuit({
          ...loaded,
          mode: 'sequence',
          power: { ...loaded.power, on },
          previous: loaded.simulation,
        });
        expect(result.timerStates?.[id]).toBeUndefined();
        expect(result.energizedComponents).not.toContain(id);
      }
    },
  );

  it.each(ids)(
    'times and resets a powered timer named %s, including JSON-cloned previous results',
    (id) => {
      const w = workspaces();
      w.sequence.components.push(makeComponent('timer-at8n', id, 0, 0));
      w.sequence.wires.push(
        {
          id: 'timer-plus',
          from: { componentId: 'board', pinId: 'plus' },
          to: { componentId: id, pinId: '7' },
          color: '#dc4c4c',
        },
        {
          id: 'timer-minus',
          from: { componentId: 'board', pinId: 'minus' },
          to: { componentId: id, pinId: '2' },
          color: '#303b48',
        },
      );
      const loaded = importCircuitFile(exportCircuitFile('sequence', w))
        .workspaces.sequence;
      const request = {
        ...loaded,
        mode: 'sequence' as const,
        power: { ...loaded.power, on: true },
        nowMs: 1000,
      };
      const start = solveCircuit(request);
      expect(start.timerStates?.[id]).toEqual({
        since: 1000,
        elapsed: 0,
        output: false,
      });
      const done = solveCircuit({
        ...request,
        nowMs: 4000,
        previous: JSON.parse(JSON.stringify(start)),
      });
      expect(done.timerStates?.[id]?.output).toBe(true);
      expect(done.componentCurrents[id]).toBeCloseTo(24 / 1200);
      const off = solveCircuit({
        ...request,
        power: { ...request.power, on: false },
        previous: done,
      });
      expect(off.timerStates?.[id]).toBeUndefined();
      const restart = solveCircuit({ ...request, nowMs: 9000, previous: off });
      expect(restart.timerStates?.[id]).toEqual({
        since: 9000,
        elapsed: 0,
        output: false,
      });
    },
  );
});
