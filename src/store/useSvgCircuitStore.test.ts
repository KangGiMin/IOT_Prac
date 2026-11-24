import { beforeEach, describe, expect, it } from 'vitest';
import { createSvgWorkspace } from '../features/workbench/data/svgCircuits';
import { useCircuitStore } from './useCircuitStore';

beforeEach(() => useCircuitStore.setState({
  mode: 'sequence', workspaces: { sequence: createSvgWorkspace('sequence'), digital: createSvgWorkspace('digital') },
  selectedId: null, selectedWireId: null, pendingPin: null, wireColor: '#dc4c4c',
}));
const from = { componentId: 'seq-power', pinId: 'plus' };
const to = { componentId: 'seq-lamp', pinId: 'plus' };

describe('SVG workspace state', () => {
  it('rejects duplicate, reversed, self and invalid connections', () => {
    const s = useCircuitStore.getState();
    s.connect(from, to); s.connect(to, from); s.connect(from, to); s.connect(from, from);
    s.connect(from, { ...to, pinId: 'missing' });
    expect(useCircuitStore.getState().workspaces.sequence.wires).toHaveLength(1);
  });
  it('preserves each mode including viewport and resets only the current mode', () => {
    const s = useCircuitStore.getState(); s.connect(from, to); s.setViewport({ x: -123, y: 45, zoom: 1.25 });
    const sequence = useCircuitStore.getState().workspaces.sequence;
    s.setMode('digital'); s.addComponent('led-red'); s.reset();
    expect(useCircuitStore.getState().workspaces.sequence).toBe(sequence);
    expect(useCircuitStore.getState().workspaces.digital.components).toHaveLength(6);
    s.setMode('sequence'); expect(useCircuitStore.getState().workspaces.sequence.viewport.zoom).toBe(1.25);
  });
  it('locks structural edits while powered and stops on power-off', () => {
    const s = useCircuitStore.getState(); s.select('seq-lamp'); s.togglePower(); s.toggleRunning();
    const w = useCircuitStore.getState().workspaces.sequence;
    s.moveComponent('seq-lamp', { x: 0, y: 0 }); s.addComponent('pilot-lamp'); s.connect(from, to); s.deleteSelection(); s.reset();
    expect(useCircuitStore.getState().workspaces.sequence).toBe(w);
    expect(w.simulation.energizedComponents).toEqual([]);
    s.togglePower(); expect(useCircuitStore.getState().workspaces.sequence.simulation.status).toBe('not-connected');
  });
  it('blocks power on a short and clears the short after deleting the wire', () => {
    const s = useCircuitStore.getState(); s.connect(from, { componentId: 'seq-power', pinId: 'minus' }); s.togglePower();
    let w = useCircuitStore.getState().workspaces.sequence;
    expect(w.power.on).toBe(false); expect(w.simulation.shortCircuit.status).toBe('short');
    s.selectWire(w.wires[0].id); s.deleteSelection(); s.togglePower();
    w = useCircuitStore.getState().workspaces.sequence;
    expect(w.simulation.shortCircuit.status).toBe('clear'); expect(w.power.on).toBe(true);
  });
  it('deletes attached wires, cancels pending wiring and invalidates stale grades', () => {
    const s = useCircuitStore.getState(); s.connect(from, to); s.gradeMission(); s.setPendingPin(to); s.select('seq-lamp'); s.deleteSelection();
    const state = useCircuitStore.getState();
    expect(state.workspaces.sequence.wires).toHaveLength(0); expect(state.pendingPin).toBeNull();
    expect(state.workspaces.sequence.missionResult).toBeNull();
  });
  it('grades only wiring structure and does not energize components', () => {
    const s = useCircuitStore.getState(); s.connect(from, to); s.connect({ ...from, pinId: 'minus' }, { ...to, pinId: 'minus' }); s.gradeMission();
    const w = useCircuitStore.getState().workspaces.sequence;
    expect(w.missionResult).toMatchObject({ score: 100, scope: 'wiring-only' });
    expect(w.simulation.energizedComponents).toEqual([]);
  });
  it('does not combine two half-connected lamps into one completed mission', () => {
    const s = useCircuitStore.getState(); s.addComponent('pilot-lamp');
    const secondLamp = useCircuitStore.getState().selectedId!;
    s.connect(from, to); s.connect({ ...from, pinId: 'minus' }, { componentId: secondLamp, pinId: 'minus' }); s.gradeMission();
    expect(useCircuitStore.getState().workspaces.sequence.missionResult?.checks[1].passed).toBe(false);
  });
});
