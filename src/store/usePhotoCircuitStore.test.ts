import { beforeEach, describe, expect, it } from 'vitest';
import { createPhotoWorkspace } from '../features/workbench/data/photoCircuits';
import { useCircuitStore } from './usePhotoCircuitStore';

beforeEach(() =>
  useCircuitStore.setState({
    mode: 'sequence',
    workspaces: {
      sequence: createPhotoWorkspace('sequence'),
      digital: createPhotoWorkspace('digital'),
    },
    selectedId: null,
    selectedWireId: null,
    calibration: false,
    sample: null,
    wireColor: '#dc4c4c',
  }),
);
const from = { componentId: 'seq-pb', pinId: 'no1' };
const to = { componentId: 'seq-lamp', pinId: 'plus' };

describe('photo circuit editing', () => {
  it('exits calibration on mode change and clears the old coordinate sample', () => {
    const store = useCircuitStore.getState();
    store.toggleCalibration();
    store.setSample({
      assetId: 'pb-switch',
      componentId: 'seq-pb',
      position: { x: 50, y: 50 },
      copied: false,
    });
    store.setMode('digital');
    expect(useCircuitStore.getState().calibration).toBe(false);
    expect(useCircuitStore.getState().sample).toBeNull();
  });
  it('clamps dial settings, rejects nonfinite values and locks voltage while powered', () => {
    const store = useCircuitStore.getState();
    store.updateSettings('seq-timer', { timerSeconds: 500 });
    expect(
      useCircuitStore
        .getState()
        .workspaces.sequence.components.find((c) => c.id === 'seq-timer')
        ?.settings.timerSeconds,
    ).toBe(10);
    store.setMode('digital');
    store.updateSettings('dig-power', { voltage: 50 });
    store.updateSettings('dig-power', { voltage: NaN });
    expect(useCircuitStore.getState().workspaces.digital.power.voltage).toBe(
      30,
    );
    store.togglePower();
    store.updateSettings('dig-power', { voltage: 3 });
    expect(useCircuitStore.getState().workspaces.digital.power.voltage).toBe(
      30,
    );
  });
  it('connects real pins with the chosen color and rejects duplicate/reversed wires', () => {
    const store = useCircuitStore.getState();
    store.setWireColor('#3780d5');
    store.connect(from, to);
    store.connect(from, to);
    store.connect(to, from);
    const wires = useCircuitStore.getState().workspaces.sequence.wires;
    expect(wires).toHaveLength(1);
    expect(wires[0].color).toBe('#3780d5');
  });
  it('rejects dangling references and a connection from a pin to itself', () => {
    const store = useCircuitStore.getState();
    store.connect(from, from);
    store.connect(from, { ...to, pinId: 'not-a-pin' });
    store.connect(from, { ...to, componentId: 'not-a-component' });
    expect(useCircuitStore.getState().workspaces.sequence.wires).toHaveLength(
      0,
    );
  });
  it('removes incident wires when deleting a device', () => {
    const store = useCircuitStore.getState();
    store.connect(from, to);
    store.select('seq-pb');
    store.deleteSelection();
    const workspace = useCircuitStore.getState().workspaces.sequence;
    expect(workspace.components.some((c) => c.id === 'seq-pb')).toBe(false);
    expect(workspace.wires).toHaveLength(0);
  });
  it('locks structural editing and calibration while power is on', () => {
    const store = useCircuitStore.getState();
    store.select('seq-pb');
    store.togglePower();
    const workspace = useCircuitStore.getState().workspaces.sequence;
    store.connect(from, to);
    store.addComponent('pilot-lamp');
    store.moveComponent('seq-pb', { x: 0, y: 0 });
    store.deleteSelection();
    store.reset();
    store.toggleCalibration();
    expect(useCircuitStore.getState().workspaces.sequence).toBe(workspace);
    expect(useCircuitStore.getState().calibration).toBe(false);
    expect(workspace.simulation.energizedComponents).toEqual([]);
    expect(workspace.simulation.shortCircuit.status).toBe('clear');
  });
  it('blocks structural edits and power during calibration', () => {
    const store = useCircuitStore.getState();
    store.toggleCalibration();
    const workspace = useCircuitStore.getState().workspaces.sequence;
    store.connect(from, to);
    store.addComponent('pilot-lamp');
    store.moveComponent('seq-pb', { x: 0, y: 0 });
    store.reset();
    store.togglePower();
    expect(useCircuitStore.getState().workspaces.sequence).toBe(workspace);
  });
  it('keeps modes independent and resets only the active workspace', () => {
    const store = useCircuitStore.getState();
    store.connect(from, to);
    const sequence = useCircuitStore.getState().workspaces.sequence;
    store.setMode('digital');
    store.addComponent('led-red');
    expect(
      useCircuitStore.getState().workspaces.digital.components,
    ).toHaveLength(7);
    store.reset();
    expect(
      useCircuitStore.getState().workspaces.digital.components,
    ).toHaveLength(6);
    expect(useCircuitStore.getState().workspaces.sequence).toBe(sequence);
    store.addComponent('pilot-lamp');
    expect(
      useCircuitStore.getState().workspaces.digital.components,
    ).toHaveLength(6);
  });
  it('halts live outputs on a real short, allows repair while tripped, and recovers immediately', () => {
    const store = useCircuitStore.getState();
    store.connect(
      { componentId: 'seq-board', pinId: 'plus' },
      { componentId: 'seq-board', pinId: 'minus' },
    );
    expect(
      useCircuitStore.getState().workspaces.sequence.simulation.isShorted,
    ).toBe(true);
    store.togglePower();
    let workspace = useCircuitStore.getState().workspaces.sequence;
    expect(workspace.power.on).toBe(true);
    expect(workspace.simulation.status).toBe('error');
    expect(workspace.simulation.energizedComponents).toEqual([]);
    store.selectWire(workspace.wires[0].id);
    store.deleteSelection();
    workspace = useCircuitStore.getState().workspaces.sequence;
    expect(workspace.simulation.isShorted).toBe(false);
    expect(workspace.simulation.status).toBe('running');
    store.togglePower();
    expect(
      useCircuitStore.getState().workspaces.sequence.simulation.status,
    ).toBe('ready');
  });
  it('re-evaluates contact closure immediately and retains diagnostics after switching power off', () => {
    const store = useCircuitStore.getState();
    store.connect(
      { componentId: 'seq-board', pinId: 'plus' },
      { componentId: 'seq-pb', pinId: 'no1' },
    );
    store.connect(
      { componentId: 'seq-board', pinId: 'minus' },
      { componentId: 'seq-pb', pinId: 'no2' },
    );
    store.togglePower();
    expect(
      useCircuitStore.getState().workspaces.sequence.simulation.isShorted,
    ).toBe(false);
    store.updateSettings('seq-pb', { pressed: true });
    expect(
      useCircuitStore.getState().workspaces.sequence.simulation.isShorted,
    ).toBe(true);
    store.togglePower();
    const workspace = useCircuitStore.getState().workspaces.sequence;
    expect(workspace.power.on).toBe(false);
    expect(workspace.simulation.isShorted).toBe(true);
    expect(workspace.simulation.componentCurrents).toEqual({});
  });
});
