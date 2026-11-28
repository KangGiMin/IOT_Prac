import { describe, expect, it } from 'vitest';
import { createPhotoWorkspace } from '../workbench/data/photoCircuits';
import { exercises, buildExercise } from './model';
import { gradeExercise, stopped, stepCircuit } from './solver';
import { buildCompletedWorkbench } from './completedCircuit';
describe('empty workspaces and lesson netlists', () => {
  it.each(['sequence', 'digital'] as const)('starts %s with only its board', (mode) => {
    const w = createPhotoWorkspace(mode);
    expect(w.components.map((c) => c.assetId)).toEqual([
      mode === 'sequence' ? 'panel-board' : 'breadboard',
    ]);
    expect(w.wires).toEqual([]);
    expect(w.power.on).toBe(false);
  });
  it.each(exercises)('runs exercise $id reference and detects missing wiring', (e) => {
    const c = buildExercise(e);
    expect(gradeExercise(e, c.leads).every((r) => r.pass)).toBe(true);
    expect(gradeExercise(e, []).some((r) => !r.pass)).toBe(true);
    expect(stepCircuit(c, [['24V', '0V']], {}, stopped(), 0).short).toBe(true);
  });
  it('preserves first input in 8 and lets later input replace it in 7', () => {
    for (const id of [7, 8]) {
      const c = buildExercise(exercises[id - 1]);
      let s = stepCircuit(c, c.leads, { PB1: true }, stopped(), 0);
      s = stepCircuit(c, c.leads, {}, s, 0);
      expect(s.on.R1).toBe(true);
      s = stepCircuit(c, c.leads, { PB2: true }, s, 0);
      expect(s.on.R2).toBe(id === 7);
      expect(s.on.R1).toBe(id === 8);
    }
  });
  it('turns delayed lights on at 1 and 4 seconds in 16', () => {
    const c = buildExercise(exercises[15]);
    let s = stepCircuit(c, c.leads, { PB1: true }, stopped(), 0);
    s = stepCircuit(c, c.leads, {}, s, 1);
    expect(s.on.PL1).toBe(true);
    expect(s.on.PL2).toBe(false);
    s = stepCircuit(c, c.leads, {}, s, 2);
    expect(s.on.PL2).toBe(false);
    s = stepCircuit(c, c.leads, {}, s, 1);
    expect(s.on.PL2).toBe(true);
  });
  it('retains source faults and separately provides corrections', () => {
    expect(exercises[3].correction).toBeDefined();
    expect(exercises[9].correction).toBeDefined();
    const c = buildExercise(exercises[3]);
    expect(stepCircuit(c, c.leads, { PB1: true }, stopped(), 0).on.R1).toBe(false);
  });
  it('uses four NO power contacts in 24 and leaves the motor floating at rest', () => {
    const c = buildExercise(exercises[23]);
    let s = stepCircuit(c, c.leads, {}, stopped(), 0);
    expect(s.motor).toBe('정지 / 개방');
    s = stepCircuit(c, c.leads, { PB1: true }, s, 0);
    expect(s.motor).toBe('CW');
    s = stepCircuit(c, c.leads, {}, s, 0);
    s = stepCircuit(c, c.leads, { PB2: true }, s, 0);
    expect(s.motor).toBe('CCW');
  });
  it('keeps the source 18 lamp on the start/hold node before the stop contact', () => {
    const c = buildExercise(exercises[17]);
    const s = stepCircuit(c, c.leads, { PB1: true, PB4: true }, stopped(), 0);
    expect(s.on.R1).toBe(false);
    expect(s.on.LAMP1).toBe(true);
  });
});

describe('completed drawing workbenches', () => {
  it.each(exercises)('shows and solves every visible connection in drawing $id', (exercise) => {
    const board = buildCompletedWorkbench(exercise);
    const terminals = board.devices.flatMap((device) =>
      device.rows.flatMap((row) => row.terminals),
    );
    expect(new Set(terminals.map(({ id }) => id)).size).toBe(terminals.length);
    for (const step of board.steps) {
      expect(board.deviceByTerminal.has(step.lead[0])).toBe(true);
      expect(board.deviceByTerminal.has(step.lead[1])).toBe(true);
    }
    expect(gradeExercise(exercise, board.leads, board.corrected).every((row) => row.pass)).toBe(
      true,
    );
  });

  it('starts and holds the corrected relays in drawings 04 and 10', () => {
    for (const [exerciseIndex, button, relay] of [
      [3, 'PB1', 'R1'],
      [9, 'PB2', 'R2'],
    ] as const) {
      const board = buildCompletedWorkbench(exercises[exerciseIndex]);
      expect(board.corrected).toBe(true);
      const ready =
        exerciseIndex === 9
          ? stepCircuit(board.circuit, board.leads, { PB3: true }, stopped(), 0)
          : stopped();
      const started = stepCircuit(board.circuit, board.leads, { [button]: true }, ready, 0);
      expect(started.on[relay]).toBe(true);
      expect(stepCircuit(board.circuit, board.leads, {}, started, 0).on[relay]).toBe(true);
    }
  });

  it('restarts the timing cycle while PB1 stays held in drawing 17', () => {
    const { circuit, leads } = buildCompletedWorkbench(exercises[16]);
    const held = { PB1: true };
    const started = stepCircuit(circuit, leads, held, stopped(), 0);
    const restarted = stepCircuit(circuit, leads, held, started, 3.01);
    expect(restarted.unstable).toBe(false);
    expect(restarted.on.R1).toBe(true);
    expect(restarted.elapsed.T1).toBeCloseTo(0.01);
    expect(stepCircuit(circuit, leads, {}, restarted, 3.01).on.R1).toBe(false);
  });

  it('energizes the buzzer only during the 0.3-second delay in drawing 18', () => {
    const { circuit, leads } = buildCompletedWorkbench(exercises[17]);
    const started = stepCircuit(circuit, leads, { PB1: true }, stopped(), 0);
    expect(started.on.BZ).toBe(true);
    const timed = stepCircuit(circuit, leads, {}, started, 0.3);
    expect(timed.on.BZ).toBe(false);
    expect(timed.on.LAMP1).toBe(true);
  });

  it.each([
    { id: 25, phase: 1, secondLamp: {} },
    { id: 26, phase: 0.5, secondLamp: { LAMP2: true } },
  ])(
    'blinks at each timer boundary and stops on PB2 in drawing $id',
    ({ id, phase, secondLamp }) => {
      const { circuit, leads } = buildCompletedWorkbench(exercises[id - 1]);
      const step = (previous: ReturnType<typeof stopped>, dt = 0, buttons = {}) =>
        stepCircuit(circuit, leads, buttons, previous, dt);
      const idle = step(stopped());
      const start = step(idle, 0, { PB1: true });
      expect(idle.on.LAMP1).toBe(false);
      expect(start.on).toMatchObject({ R1: true, LAMP1: true, T2: false });
      const before = step(start, phase - 0.01);
      expect(before.on.LAMP1).toBe(true);
      const transferred = step(before, 0.01);
      expect(transferred.unstable).toBe(false);
      expect(transferred.on).toMatchObject({
        R1: true,
        LAMP1: false,
        T1: false,
        T2: true,
        ...secondLamp,
      });
      expect(transferred.timing.T2).toBe(false); // Output stays on with no coil feed.
      const beforeReturn = step(transferred, phase - 0.01);
      expect(beforeReturn.on.LAMP1).toBe(false);
      const returned = step(beforeReturn, 0.01);
      expect(returned.on).toEqual(start.on);
      expect(step(start, phase * 9).on).toEqual(transferred.on);
      const stoppedMidCycle = step(transferred, 0, { PB2: true });
      expect(stoppedMidCycle.on.R1).toBe(false);
      expect(stoppedMidCycle.on.LAMP1).toBe(false);
      expect(stoppedMidCycle.on.LAMP2 ?? false).toBe(false);
      expect(step(stoppedMidCycle, phase * 3).on).toEqual(idle.on);
    },
  );

  it('flags a disconnected or bypassed common feed', () => {
    const exercise = exercises[25];
    const { parts, leads } = buildExercise(exercise);
    const feed = parts.find((part) => part.purpose === exercise.feed?.id)!;
    const missing = leads.filter(([from]) => from !== `${feed.id}:2`);
    expect(gradeExercise(exercise, missing).some((row) => !row.pass)).toBe(true);
    const bypassed: [string, string] = ['24V', exercise.feed!.id];
    expect(
      gradeExercise(exercise, [...leads, bypassed]).find((row) => row.action === '전원 인가')?.pass,
    ).toBe(false);
  });

  it('connects the lamps across their coils and powers the motor in drawing 22', () => {
    const { circuit, leads } = buildCompletedWorkbench(exercises[21]);
    for (let i = 1; i <= 3; i++) expect(circuit.leads).toContainEqual([`R${i}:1`, `L${i}:1`]);
    const started = stepCircuit(circuit, leads, { PB3: true }, stopped(), 0);
    expect(started.on).toMatchObject({ R3: true, L3: true, L1: false, L2: false, M: true });
  });
});
