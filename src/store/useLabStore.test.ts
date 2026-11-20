import { beforeEach, describe, expect, it } from 'vitest';
import { useLabStore } from './useLabStore';
import { createInitialCircuits } from '../features/workbench/data/initialCircuits';
import { catalog } from '../features/workbench/data/catalog';

beforeEach(() => useLabStore.setState({ activeLab: 'sequence', powerOn: false, guideOpen: false, circuits: createInitialCircuits() }));

describe('independent workspaces', () => {
  it('preserves components and other labs when clearing current wiring', () => {
    const before = useLabStore.getState().circuits;
    useLabStore.getState().resetWiring();
    const after = useLabStore.getState().circuits;
    expect(after.sequence.edges).toHaveLength(0);
    expect(after.sequence.nodes).toEqual(before.sequence.nodes);
    expect(after.breadboard).toBe(before.breadboard);
  });
  it('retains circuit edits across tab switches', () => {
    useLabStore.getState().addComponent('sequence', catalog.sequence[0]);
    useLabStore.getState().setActiveLab('breadboard');
    useLabStore.getState().setActiveLab('sequence');
    expect(useLabStore.getState().circuits.sequence.nodes).toHaveLength(6);
    expect(useLabStore.getState().circuits.breadboard.nodes).toHaveLength(1);
  });
  it('removes incident wires when deleting a component', () => {
    useLabStore.getState().changeNodes('sequence', [{ id: 'k1', type: 'remove' }]);
    const circuit = useLabStore.getState().circuits.sequence;
    expect(circuit.nodes.some((n) => n.id === 'k1')).toBe(false);
    expect(circuit.edges.some((e) => e.source === 'k1' || e.target === 'k1')).toBe(false);
    expect(circuit.edges).toHaveLength(1);
  });
  it('locks editing at store level while power is on', () => {
    const before = useLabStore.getState().circuits;
    const store = useLabStore.getState();
    store.togglePower();
    store.addComponent('sequence', catalog.sequence[0]);
    store.resetWiring();
    store.changeNodes('sequence', [{ id: 'ps1', type: 'remove' }]);
    store.changeEdges('sequence', [{ id: 'e1', type: 'remove' }]);
    store.connect('sequence', { source: 'pb2', target: 'h1', sourceHandle: null, targetHandle: null });
    expect(useLabStore.getState().circuits).toEqual(before);
  });
  it('does not reset any wiring from the theory room', () => {
    const before = useLabStore.getState().circuits;
    useLabStore.getState().setActiveLab('theory');
    useLabStore.getState().resetWiring();
    expect(useLabStore.getState().circuits).toBe(before);
  });
  it('allocates unique reference labels after deletion and insertion', () => {
    useLabStore.getState().changeNodes('sequence', [{ id: 'pb1', type: 'remove' }]);
    useLabStore.getState().addComponent('sequence', catalog.sequence[1]);
    const codes = useLabStore.getState().circuits.sequence.nodes.map((n) => n.data.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
