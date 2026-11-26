import { describe, expect, it } from 'vitest';
import { solveCircuit } from './circuitSolver';
import { makeComponent } from '../features/workbench/data/photoCircuits';
import type { CircuitSolverInput } from './circuitSolver';
const make = (asset: Parameters<typeof makeComponent>[0], id: string) =>
  makeComponent(asset, id, 0, 0);
const wire = (a: string, ap: string, b: string, bp: string) => ({
  id: `${a}${ap}-${b}${bp}`,
  from: { componentId: a, pinId: ap },
  to: { componentId: b, pinId: bp },
  color: '#dc4c4c' as const,
});
const timerCircuit = (): CircuitSolverInput => ({
  mode: 'sequence',
  power: { on: true, voltage: 24 },
  nowMs: 1000,
  components: [
    make('panel-board', 'board'),
    make('timer-at8n', 'timer'),
    make('pilot-lamp', 'lamp'),
  ],
  wires: [
    wire('board', 'plus', 'timer', '7'),
    wire('board', 'minus', 'timer', '2'),
    wire('board', 'plus', 'timer', '1'),
    wire('timer', '3', 'lamp', 'plus'),
    wire('lamp', 'minus', 'board', 'minus'),
  ],
});
describe('physical sequence modules', () => {
  it('models the motor as a reversible load and stops when its return is open', () => {
    const request: CircuitSolverInput = {
      mode: 'sequence',
      power: { on: true, voltage: 24 },
      components: [make('panel-board', 'board'), make('motor-unit', 'motor')],
      wires: [
        wire('board', 'plus', 'motor', 'plus'),
        wire('board', 'minus', 'motor', 'minus'),
      ],
    };
    const forward = solveCircuit(request);
    expect(forward.isShorted).toBe(false);
    expect(forward.energizedComponents).toContain('motor');
    expect(forward.componentCurrents.motor).toBeGreaterThan(0);
    request.wires = [
      wire('board', 'plus', 'motor', 'minus'),
      wire('board', 'minus', 'motor', 'plus'),
    ];
    const reverse = solveCircuit(request);
    expect(reverse.energizedComponents).toContain('motor');
    expect(reverse.componentCurrents.motor).toBeCloseTo(-forward.componentCurrents.motor);
    request.wires.pop();
    expect(solveCircuit(request).energizedComponents).not.toContain('motor');
  });

  it('requires an installed body before coil current and contact switching', () => {
    const request: CircuitSolverInput = {
      mode: 'sequence',
      power: { on: true, voltage: 24 },
      components: [
        make('panel-board', 'board'),
        make('relay-socket', 'socket'),
      ],
      wires: [
        wire('board', 'plus', 'socket', '14'),
        wire('board', 'minus', 'socket', '13'),
      ],
    };
    expect(solveCircuit(request).energizedComponents).not.toContain('socket');
    const body = { ...make('relay-body', 'body'), mountedSocketId: 'socket' };
    request.components.push(body);
    const mounted = solveCircuit(request);
    expect(mounted.energizedComponents).toEqual(
      expect.arrayContaining(['socket', 'body']),
    );
    body.mountedSocketId = 'not-a-socket';
    expect(solveCircuit(request).energizedComponents).not.toContain('socket');
  });
  it('switches both delayed contact groups exactly after the configured time', () => {
    const request = timerCircuit();
    const start = solveCircuit(request);
    expect(start.timerStates?.timer.output).toBe(false);
    expect(start.energizedComponents).not.toContain('lamp');
    request.previous = start;
    request.nowMs = 3999;
    const before = solveCircuit(request);
    expect(before.timerStates?.timer.output).toBe(false);
    request.previous = before;
    request.nowMs = 4000;
    const after = solveCircuit(request);
    expect(after.timerStates?.timer.output).toBe(true);
    expect(after.energizedComponents).toContain('lamp');
    const net = (pin: string) =>
      after.nets.find((n) =>
        n.pins.some((p) => p.componentId === 'timer' && p.pinId === pin),
      )?.id;
    expect(net('8')).toBe(net('6'));
    expect(net('8')).not.toBe(net('5'));
  });
  it('resets on supply interruption and restarts a full delay when restored', () => {
    const request = timerCircuit();
    const feed = request.wires.shift()!;
    request.wires.unshift(feed);
    const start = solveCircuit(request);
    request.previous = start;
    request.nowMs = 2500;
    request.wires.shift();
    const lost = solveCircuit(request);
    expect(lost.timerStates?.timer).toBeUndefined();
    request.previous = lost;
    request.nowMs = 5000;
    request.wires.unshift(feed);
    const restart = solveCircuit(request);
    expect(restart.timerStates?.timer.since).toBe(5000);
    expect(restart.timerStates?.timer.output).toBe(false);
    request.previous = restart;
    request.nowMs = 9000;
    request.power.on = false;
    expect(solveCircuit(request).timerStates).toEqual({});
  });
  it('supports zero-delay and preserves an already switched contact on subsequent ticks', () => {
    const request = timerCircuit();
    request.components[1].settings.timerSeconds = 0;
    const first = solveCircuit(request);
    expect(first.timerStates?.timer.output).toBe(true);
    request.previous = first;
    request.nowMs = 1100;
    expect(solveCircuit(request).energizedComponents).toContain('lamp');
  });
});
