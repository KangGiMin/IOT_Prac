import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from './usePhotoCircuitStore';
import { createPopulatedWorkspace as createPhotoWorkspace } from '../test/populatedWorkspace';
import { exportCircuitFile } from '../engine/circuitFile';
import { solveCircuit } from '../engine/circuitSolver';
const a = { componentId: 'seq-pb', pinId: 'no1' },
  b = { componentId: 'seq-lamp', pinId: 'plus' };
beforeEach(() =>
  useCircuitStore.setState({
    mode: 'sequence',
    workspaces: {
      sequence: createPhotoWorkspace('sequence'),
      digital: createPhotoWorkspace('digital'),
    },
    histories: {
      sequence: { past: [], future: [] },
      digital: { past: [], future: [] },
    },
    dragHistory: null,
    selectedId: null,
    selectedWireId: null,
    calibration: false,
  }),
);
describe('user edit history', () => {
  it('undoes and redoes connections and clears redo after a new edit', () => {
    const s = useCircuitStore.getState();
    s.connect(a, b);
    expect(useCircuitStore.getState().histories.sequence.past).toHaveLength(1);
    s.undo();
    expect(useCircuitStore.getState().workspaces.sequence.wires).toHaveLength(
      0,
    );
    s.redo();
    expect(useCircuitStore.getState().workspaces.sequence.wires).toHaveLength(
      1,
    );
    s.undo();
    s.addComponent('pilot-lamp');
    expect(useCircuitStore.getState().histories.sequence.future).toHaveLength(
      0,
    );
  });
  it('coalesces drag moves and snap into one history entry', () => {
    const s = useCircuitStore.getState(),
      before = useCircuitStore
        .getState()
        .workspaces.sequence.components.find(
          (c) => c.id === 'seq-pb',
        )!.position;
    s.beginDrag('seq-pb');
    for (let x = 100; x < 200; x += 5) s.moveComponent('seq-pb', { x, y: 220 });
    s.finishDrag('seq-pb');
    const after = useCircuitStore
      .getState()
      .workspaces.sequence.components.find((c) => c.id === 'seq-pb')!.position;
    expect(useCircuitStore.getState().histories.sequence.past).toHaveLength(1);
    s.undo();
    expect(
      useCircuitStore
        .getState()
        .workspaces.sequence.components.find((c) => c.id === 'seq-pb')!
        .position,
    ).toEqual(before);
    s.redo();
    expect(
      useCircuitStore
        .getState()
        .workspaces.sequence.components.find((c) => c.id === 'seq-pb')!
        .position,
    ).toEqual(after);
  });
  it('does not record selection, timer ticks or unchanged edits', () => {
    const s = useCircuitStore.getState();
    s.select('seq-lamp');
    s.setWireColor('#3780d5');
    s.moveComponent('seq-lamp', {
      ...useCircuitStore
        .getState()
        .workspaces.sequence.components.find((c) => c.id === 'seq-lamp')!
        .position,
    });
    expect(useCircuitStore.getState().histories.sequence.past).toHaveLength(0);
    s.togglePower();
    const count = useCircuitStore.getState().histories.sequence.past.length;
    s.tick(Date.now() + 1000);
    expect(useCircuitStore.getState().histories.sequence.past).toHaveLength(
      count,
    );
  });
  it('restores deleted parts with incident wires and powers down on history replay', () => {
    const s = useCircuitStore.getState();
    s.connect(a, b);
    s.select('seq-lamp');
    s.deleteSelection();
    s.undo();
    expect(useCircuitStore.getState().workspaces.sequence.wires).toHaveLength(
      1,
    );
    expect(
      useCircuitStore
        .getState()
        .workspaces.sequence.components.some((c) => c.id === 'seq-lamp'),
    ).toBe(true);
    s.togglePower();
    s.undo();
    expect(useCircuitStore.getState().workspaces.sequence.power.on).toBe(false);
    s.redo();
    expect(useCircuitStore.getState().workspaces.sequence.power.on).toBe(false);
  });
  it('isolates histories across modes and leaves state unchanged on import failure', () => {
    const s = useCircuitStore.getState();
    s.connect(a, b);
    s.setMode('digital');
    s.addComponent('led-red');
    s.undo();
    expect(useCircuitStore.getState().workspaces.sequence.wires).toHaveLength(
      1,
    );
    const before = useCircuitStore.getState();
    expect(() => s.importJson('broken')).toThrow();
    expect(useCircuitStore.getState()).toBe(before);
  });
  it('loads presets and JSON as undoable replacements', () => {
    const s = useCircuitStore.getState(),
      old = useCircuitStore.getState().workspaces.digital;
    s.loadPreset('nand');
    expect(useCircuitStore.getState().mode).toBe('digital');
    s.undo();
    expect(useCircuitStore.getState().workspaces.digital.components).toEqual(
      old.components,
    );
    const encoded = exportCircuitFile(
      'digital',
      useCircuitStore.getState().workspaces,
    );
    s.addComponent('led-red');
    const count =
      useCircuitStore.getState().workspaces.digital.components.length;
    s.importJson(encoded);
    expect(
      useCircuitStore.getState().workspaces.digital.components,
    ).toHaveLength(count - 1);
    s.undo();
    expect(
      useCircuitStore.getState().workspaces.digital.components,
    ).toHaveLength(count);
  });
  it('runs the self-holding preset through START, release, STOP and release', () => {
    const s = useCircuitStore.getState();
    s.loadPreset('self-hold');
    s.togglePower();
    expect(
      useCircuitStore.getState().workspaces.sequence.simulation
        .energizedComponents,
    ).not.toContain('lamp');
    s.updateSettings('start', { pressed: true });
    expect(
      useCircuitStore.getState().workspaces.sequence.simulation
        .energizedComponents,
    ).toContain('lamp');
    s.updateSettings('start', { pressed: false });
    expect(
      useCircuitStore.getState().workspaces.sequence.simulation
        .energizedComponents,
    ).toContain('lamp');
    s.updateSettings('stop', { pressed: true });
    expect(
      useCircuitStore.getState().workspaces.sequence.simulation
        .energizedComponents,
    ).not.toContain('lamp');
    s.updateSettings('stop', { pressed: false });
    expect(
      useCircuitStore.getState().workspaces.sequence.simulation
        .energizedComponents,
    ).not.toContain('lamp');
  });
  it('NAND preset is safe for every input state', () => {
    const s = useCircuitStore.getState();
    s.loadPreset('nand');
    const w = useCircuitStore.getState().workspaces.digital;
    for (const a of [false, true])
      for (const b of [false, true]) {
        const components = structuredClone(w.components);
        components.find((c) => c.id === 'input-a')!.settings.switchOn = a;
        components.find((c) => c.id === 'input-b')!.settings.switchOn = b;
        expect(
          solveCircuit({
            ...w,
            components,
            mode: 'digital',
            power: { ...w.power, on: true },
          }).isShorted,
        ).toBe(false);
      }
  });
});
