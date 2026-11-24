import { create } from 'zustand';
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import type { Connection, EdgeChange, NodeChange } from '@xyflow/react';
import type {
  CatalogItem,
  Circuit,
  CircuitLabId,
  ComponentNode,
  LabId,
} from '../types';
import { createInitialCircuits } from '../data/initialCircuits';

interface PrototypeLabState {
  activeLab: LabId;
  powerOn: boolean;
  guideOpen: boolean;
  guideTab: 'guide' | 'timing';
  circuits: Record<CircuitLabId, Circuit>;
  setActiveLab: (lab: LabId) => void;
  togglePower: () => void;
  setGuideOpen: (open: boolean) => void;
  setGuideTab: (tab: 'guide' | 'timing') => void;
  addComponent: (lab: CircuitLabId, item: CatalogItem) => void;
  changeNodes: (
    lab: CircuitLabId,
    changes: NodeChange<ComponentNode>[],
  ) => void;
  changeEdges: (lab: CircuitLabId, changes: EdgeChange[]) => void;
  connect: (lab: CircuitLabId, connection: Connection) => void;
  resetWiring: () => void;
}

export const usePrototypeLabStore = create<PrototypeLabState>()((set) => ({
  activeLab: 'sequence',
  powerOn: false,
  guideOpen: false,
  guideTab: 'guide',
  circuits: createInitialCircuits(),
  setActiveLab: (activeLab) => set({ activeLab }),
  togglePower: () => set((s) => ({ powerOn: !s.powerOn })),
  setGuideOpen: (guideOpen) => set({ guideOpen }),
  setGuideTab: (guideTab) => set({ guideTab }),
  addComponent: (lab, item) =>
    set((s) => {
      if (s.powerOn) return s;
      const circuit = s.circuits[lab];
      const id = crypto.randomUUID();
      const occupiedCodes = new Set(circuit.nodes.map((n) => n.data.code));
      let number = 1;
      while (occupiedCodes.has(`${item.code}${number}`)) number++;
      const { description: _description, ...data } = item;
      const component: ComponentNode = {
        id,
        type: 'component',
        position: {
          x: 100 + (circuit.nodes.length % 4) * 220,
          y: 440 + Math.floor(circuit.nodes.length / 4) * 190,
        },
        data: { ...data, code: `${item.code}${number}` },
      };
      return {
        circuits: {
          ...s.circuits,
          [lab]: { ...circuit, nodes: [...circuit.nodes, component] },
        },
      };
    }),
  changeNodes: (lab, changes) =>
    set((s) => {
      // Measurement and selection remain available while power is on.
      const allowed = s.powerOn
        ? changes.filter((c) => c.type === 'dimensions' || c.type === 'select')
        : changes;
      const nodes = applyNodeChanges(allowed, s.circuits[lab].nodes);
      const ids = new Set(nodes.map((n) => n.id));
      const edges = s.circuits[lab].edges.filter(
        (e) => ids.has(e.source) && ids.has(e.target),
      );
      return { circuits: { ...s.circuits, [lab]: { nodes, edges } } };
    }),
  changeEdges: (lab, changes) =>
    set((s) => {
      const allowed = s.powerOn
        ? changes.filter((c) => c.type === 'select')
        : changes;
      return {
        circuits: {
          ...s.circuits,
          [lab]: {
            ...s.circuits[lab],
            edges: applyEdgeChanges(allowed, s.circuits[lab].edges),
          },
        },
      };
    }),
  connect: (lab, connection) =>
    set((s) => {
      if (s.powerOn || connection.source === connection.target) return s;
      const nodes = s.circuits[lab].nodes;
      if (
        !nodes.some((n) => n.id === connection.source) ||
        !nodes.some((n) => n.id === connection.target)
      )
        return s;
      return {
        circuits: {
          ...s.circuits,
          [lab]: {
            ...s.circuits[lab],
            edges: addEdge(
              {
                ...connection,
                type: 'smoothstep',
                style: { stroke: '#148573', strokeWidth: 2 },
              },
              s.circuits[lab].edges,
            ),
          },
        },
      };
    }),
  resetWiring: () =>
    set((s) => {
      if (s.powerOn || s.activeLab === 'theory') return s;
      return {
        circuits: {
          ...s.circuits,
          [s.activeLab]: { ...s.circuits[s.activeLab], edges: [] },
        },
      };
    }),
}));
