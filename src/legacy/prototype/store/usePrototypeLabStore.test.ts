import { beforeEach, describe, expect, it } from 'vitest';
import { usePrototypeLabStore } from './usePrototypeLabStore';
import { createInitialCircuits } from '../data/initialCircuits';
import { catalog } from '../data/catalog';

beforeEach(() =>
  usePrototypeLabStore.setState({
    activeLab: 'sequence',
    powerOn: false,
    guideOpen: false,
    circuits: createInitialCircuits(),
  }),
);

describe('independent workspaces', () => {
  it('preserves components and other labs when clearing current wiring', () => {
    const before = usePrototypeLabStore.getState().circuits;
    usePrototypeLabStore.getState().resetWiring();
    const after = usePrototypeLabStore.getState().circuits;
    expect(after.sequence.edges).toHaveLength(0);
    expect(after.sequence.nodes).toEqual(before.sequence.nodes);
    expect(after.breadboard).toBe(before.breadboard);
  });
  it('retains circuit edits across tab switches', () => {
    usePrototypeLabStore.getState().addComponent('sequence', catalog.sequence[0]);
    usePrototypeLabStore.getState().setActiveLab('breadboard');
    usePrototypeLabStore.getState().setActiveLab('sequence');
    expect(usePrototypeLabStore.getState().circuits.sequence.nodes).toHaveLength(6);
    expect(usePrototypeLabStore.getState().circuits.breadboard.nodes).toHaveLength(1);
  });
  it('removes incident wires when deleting a component', () => {
    usePrototypeLabStore.getState().changeNodes('sequence', [{ id: 'k1', type: 'remove' }]);
    const circuit = usePrototypeLabStore.getState().circuits.sequence;
    expect(circuit.nodes.some((n) => n.id === 'k1')).toBe(false);
    expect(circuit.edges.some((e) => e.source === 'k1' || e.target === 'k1')).toBe(false);
    expect(circuit.edges).toHaveLength(1);
  });
  it('locks editing at store level while power is on', () => {
    const before = usePrototypeLabStore.getState().circuits;
    const store = usePrototypeLabStore.getState();
    store.togglePower();
    store.addComponent('sequence', catalog.sequence[0]);
    store.resetWiring();
    store.changeNodes('sequence', [{ id: 'ps1', type: 'remove' }]);
    store.changeEdges('sequence', [{ id: 'e1', type: 'remove' }]);
    store.connect('sequence', {
      source: 'pb2',
      target: 'h1',
      sourceHandle: null,
      targetHandle: null,
    });
    expect(usePrototypeLabStore.getState().circuits).toEqual(before);
  });
  it('does not reset any wiring from the theory room', () => {
    const before = usePrototypeLabStore.getState().circuits;
    usePrototypeLabStore.getState().setActiveLab('theory');
    usePrototypeLabStore.getState().resetWiring();
    expect(usePrototypeLabStore.getState().circuits).toBe(before);
  });
  it('allocates unique reference labels after deletion and insertion', () => {
    usePrototypeLabStore.getState().changeNodes('sequence', [{ id: 'pb1', type: 'remove' }]);
    usePrototypeLabStore.getState().addComponent('sequence', catalog.sequence[1]);
    const codes = usePrototypeLabStore.getState().circuits.sequence.nodes.map((n) => n.data.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
