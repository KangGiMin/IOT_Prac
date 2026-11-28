import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from './usePhotoCircuitStore';
import { createPopulatedWorkspace as createPhotoWorkspace } from '../test/populatedWorkspace';
import { exportCircuitFile } from '../engine/circuitFile';
import { insertedPins } from '../config/digitalPins';

beforeEach(() => {
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
    calibration: false,
    selectedId: null,
    selectedWireId: null,
    sample: null,
  });
});

const workspace = () => useCircuitStore.getState().workspaces.sequence;
const chip = () =>
  useCircuitStore.getState().workspaces.digital.components.find((c) => c.id === 'ic')!;
const net = (componentId: string, pinId: string) =>
  useCircuitStore
    .getState()
    .workspaces.digital.simulation.nets!.find((n) =>
      n.pins.some((p) => p.componentId === componentId && p.pinId === pinId),
    )!;

describe('movement completion', () => {
  it('updates inserted holes and circuit nets together, with one undo step', () => {
    const s = useCircuitStore.getState();
    s.loadPreset('nand');
    const before = structuredClone(chip());
    const oldHole = insertedPins(before)['1'];
    const count = useCircuitStore.getState().histories.digital.past.length;
    s.beginDrag('ic');
    s.moveComponent('ic', { x: before.position.x + 50, y: before.position.y });
    s.finishDrag('ic', 'digital');
    const newHole = insertedPins(chip())['1'];
    expect(newHole).not.toEqual(oldHole);
    expect(net('ic', '1').pins).toContainEqual(newHole);
    expect(net('ic', '1').pins).not.toContainEqual(oldHole);
    expect(useCircuitStore.getState().histories.digital.past).toHaveLength(count + 1);
    s.undo();
    expect(chip()).toEqual(before);
    expect(net('ic', '1').pins).toContainEqual(oldHole);
  });

  it('disconnects a chip from its old holes when movement ends outside the board', () => {
    const s = useCircuitStore.getState();
    s.loadPreset('nand');
    const oldHole = insertedPins(chip())['1'];
    s.beginDrag('ic');
    s.moveComponent('ic', { x: 1500, y: 900 });
    s.finishDrag('ic', 'digital');
    expect(chip().insertion).toBeUndefined();
    expect(chip().displaySize).toBeUndefined();
    expect(net('ic', '1').pins).not.toContainEqual(oldHole);
  });

  it('detaches a moved relay body and removes its electrical contacts', () => {
    const s = useCircuitStore.getState();
    s.loadPreset('self-hold');
    s.beginDrag('body');
    s.moveComponent('body', { x: 1500, y: 900 });
    s.finishDrag('body', 'sequence');
    expect(workspace().components.find((c) => c.id === 'body')!.mountedSocketId).toBeUndefined();
    s.togglePower();
    s.updateSettings('start', { pressed: true });
    expect(workspace().simulation.energizedComponents).not.toContain('relay');
  });
});

describe('interrupted interactions', () => {
  it('releases a momentary button and recalculates its circuit when leaving the mode', () => {
    const s = useCircuitStore.getState();
    s.updateSettings('seq-pb', { buttonMode: 'momentary' });
    s.connect({ componentId: 'seq-board', pinId: 'plus' }, { componentId: 'seq-pb', pinId: 'no1' });
    s.connect({ componentId: 'seq-pb', pinId: 'no2' }, { componentId: 'seq-lamp', pinId: 'plus' });
    s.connect(
      { componentId: 'seq-lamp', pinId: 'minus' },
      { componentId: 'seq-board', pinId: 'minus' },
    );
    s.togglePower();
    s.updateSettings('seq-pb', { pressed: true });
    expect(workspace().simulation.energizedComponents).toContain('seq-lamp');
    s.setMode('digital');
    expect(workspace().components.find((c) => c.id === 'seq-pb')!.settings.pressed).toBe(false);
    expect(workspace().power.on).toBe(true);
    expect(workspace().simulation.energizedComponents).not.toContain('seq-lamp');
  });

  it('preserves detent buttons while releasing momentary buttons', () => {
    const s = useCircuitStore.getState();
    s.loadPreset('self-hold');
    s.updateSettings('start', { pressed: true });
    s.updateSettings('stop', { buttonMode: 'momentary', pressed: true });
    s.setMode('digital');
    expect(workspace().components.find((c) => c.id === 'start')!.settings.pressed).toBe(true);
    expect(workspace().components.find((c) => c.id === 'stop')!.settings.pressed).toBe(false);
  });

  it('commits an interrupted drag in its original mode without losing undo or redo', () => {
    const s = useCircuitStore.getState();
    const before = structuredClone(workspace().components);
    s.beginDrag('seq-pb');
    s.moveComponent('seq-pb', { x: 250, y: 300 });
    s.setMode('digital');
    const after = structuredClone(workspace().components);
    expect(after).not.toEqual(before);
    expect(useCircuitStore.getState().dragHistory).toBeNull();
    expect(useCircuitStore.getState().histories.sequence.past).toHaveLength(1);
    s.addComponent('led-red');
    s.undo();
    expect(useCircuitStore.getState().workspaces.digital.components).toHaveLength(6);
    s.setMode('sequence');
    s.undo();
    expect(workspace().components).toEqual(before);
    s.redo();
    expect(workspace().components).toEqual(after);
  });

  it('does not let a late drag stop from the old canvas finish a new drag', () => {
    const s = useCircuitStore.getState();
    s.beginDrag('seq-pb');
    s.moveComponent('seq-pb', { x: 250, y: 300 });
    s.setMode('digital');
    s.beginDrag('dig-ic');
    const group = useCircuitStore.getState().dragHistory;
    s.finishDrag('seq-pb', 'sequence');
    expect(useCircuitStore.getState().dragHistory).toBe(group);
    s.endInteraction();
    expect(useCircuitStore.getState().dragHistory).toBeNull();
  });

  it('finishes an active drag before loading a same-mode preset and keeps both undo steps', () => {
    const s = useCircuitStore.getState();
    const original = structuredClone(workspace().components);
    s.beginDrag('seq-pb');
    s.moveComponent('seq-pb', { x: 250, y: 300 });
    s.loadPreset('self-hold');
    expect(useCircuitStore.getState().dragHistory).toBeNull();
    expect(useCircuitStore.getState().histories.sequence.past).toHaveLength(2);
    s.undo();
    expect(workspace().components).not.toEqual(original);
    expect(workspace().components.some((c) => c.id === 'seq-pb')).toBe(true);
    s.undo();
    expect(workspace().components).toEqual(original);
  });

  it('keeps an interaction intact on invalid import, and finishes it on valid import', () => {
    const s = useCircuitStore.getState();
    const saved = exportCircuitFile('sequence', s.workspaces);
    s.beginDrag('seq-pb');
    s.moveComponent('seq-pb', { x: 250, y: 300 });
    const before = useCircuitStore.getState();
    expect(() => s.importJson('broken')).toThrow();
    expect(useCircuitStore.getState()).toBe(before);
    s.importJson(saved);
    expect(useCircuitStore.getState().dragHistory).toBeNull();
    expect(useCircuitStore.getState().histories.sequence.past).toHaveLength(2);
    s.undo();
    expect(workspace().components.find((c) => c.id === 'seq-pb')!.position.x).toBe(250);
  });

  it('ends focus-loss interactions idempotently without adding empty undo entries', () => {
    const s = useCircuitStore.getState();
    s.updateSettings('seq-pb', { buttonMode: 'momentary', pressed: true });
    s.beginDrag('seq-lamp');
    s.moveComponent('seq-lamp', { x: 700, y: 300 });
    s.endInteraction();
    expect(useCircuitStore.getState().dragHistory).toBeNull();
    expect(workspace().components.find((c) => c.id === 'seq-pb')!.settings.pressed).toBe(false);
    const settled = useCircuitStore.getState();
    s.endInteraction();
    expect(useCircuitStore.getState()).toBe(settled);
  });

  it('finishes a drag and releases momentary input before enabling calibration', () => {
    const s = useCircuitStore.getState();
    s.updateSettings('seq-pb', { buttonMode: 'momentary', pressed: true });
    s.beginDrag('seq-lamp');
    s.moveComponent('seq-lamp', { x: 700, y: 300 });
    s.toggleCalibration();
    expect(useCircuitStore.getState().calibration).toBe(true);
    expect(useCircuitStore.getState().dragHistory).toBeNull();
    expect(workspace().components.find((c) => c.id === 'seq-pb')!.settings.pressed).toBe(false);
  });

  it('finishes a drag before reset so the moved layout can be restored', () => {
    const s = useCircuitStore.getState();
    s.beginDrag('seq-pb');
    s.moveComponent('seq-pb', { x: 250, y: 300 });
    s.reset();
    expect(useCircuitStore.getState().dragHistory).toBeNull();
    expect(useCircuitStore.getState().histories.sequence.past).toHaveLength(2);
    s.undo();
    expect(workspace().components.find((c) => c.id === 'seq-pb')!.position.x).toBe(250);
  });
});
