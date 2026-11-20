import type { Circuit, ComponentNode } from '../../../shared/types/lab';

const node = (id: string, kind: ComponentNode['data']['kind'], label: string, code: string, detail: string, x: number, y: number): ComponentNode => ({
  id, type: 'component', position: { x, y }, data: { kind, label, code, detail },
});

// Example topology for editing the UI; this is not an electrically validated circuit.
export const createInitialCircuits = (): Record<'sequence' | 'breadboard', Circuit> => ({
  sequence: {
    nodes: [
      node('ps1', 'supply', 'DC 전원 공급기', 'PS1', 'DC 24V', 35, 110),
      node('pb1', 'stop', '정지 버튼', 'PB1', 'NC · b접점', 260, 40),
      node('pb2', 'start', '시작 버튼', 'PB2', 'NO · a접점', 260, 260),
      node('k1', 'relay', '전자 릴레이', 'K1', 'COIL · 24V', 505, 110),
      node('h1', 'lamp', '표시 램프', 'H1', 'GREEN · 24V', 740, 110),
    ],
    edges: [
      { id: 'e1', source: 'ps1', target: 'pb1', type: 'smoothstep', label: '24V', style: { stroke: '#d5954c', strokeWidth: 2 } },
      { id: 'e2', source: 'pb1', target: 'k1', type: 'smoothstep', style: { stroke: '#658c83', strokeWidth: 2 } },
      { id: 'e3', source: 'k1', target: 'h1', type: 'smoothstep', style: { stroke: '#658c83', strokeWidth: 2 } },
    ],
  },
  breadboard: { nodes: [node('u1', 'ic', '74LS08 AND', 'U1', 'QUAD AND · 14 PIN', 290, 140)], edges: [] },
});
