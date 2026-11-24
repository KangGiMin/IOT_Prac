import { describe, expect, it } from 'vitest';
import { deviceDefinitions } from '../../../components/devices/definitions';
import { createSvgWorkspace } from '../data/svgCircuits';
import { pinPosition, zoomAt } from './svgGeometry';
import { buildTopology } from './topology';

describe('SVG coordinates', () => {
  it('keeps the world position under the cursor when zooming, including at zoom limits', () => {
    for (const factor of [1.5, .2, 100, .0001]) {
      const before = { x: -325, y: 80, zoom: .7 };
      const cursor = { x: 460, y: 230 };
      const after = zoomAt(before, cursor, factor);
      expect((cursor.x - after.x) / after.zoom).toBeCloseTo((cursor.x - before.x) / before.zoom, 9);
      expect((cursor.y - after.y) / after.zoom).toBeCloseTo((cursor.y - before.y) / before.zoom, 9);
      expect(after.zoom).toBeGreaterThanOrEqual(.25); expect(after.zoom).toBeLessThanOrEqual(3);
    }
  });
  it('uses the exact artwork pin coordinate even with fractional component movement', () => {
    const workspace = createSvgWorkspace('sequence');
    const lamp = workspace.components.find((c) => c.id === 'seq-lamp')!;
    lamp.position = { x: 143.125, y: -35.5 };
    expect(pinPosition(workspace.components, { componentId: lamp.id, pinId: 'plus' })).toEqual({ x: 201.125, y: 6.5 });
    expect(pinPosition(workspace.components, { componentId: lamp.id, pinId: 'missing' })).toBeNull();
  });
  it('keeps every terminal inside its fixed viewBox and IDs unique', () => {
    for (const definition of Object.values(deviceDefinitions)) {
      expect(new Set(definition.pins.map((p) => p.id)).size).toBe(definition.pins.length);
      for (const pin of definition.pins) {
        expect(pin.position.x).toBeGreaterThanOrEqual(0); expect(pin.position.x).toBeLessThanOrEqual(definition.viewBox[2]);
        expect(pin.position.y).toBeGreaterThanOrEqual(0); expect(pin.position.y).toBeLessThanOrEqual(definition.viewBox[3]);
      }
    }
  });
});

describe('wiring topology', () => {
  it('detects an indirect supply short through breadboard buses without joining neighboring columns or the center gap', () => {
    const w = createSvgWorkspace('digital');
    const connect = (pinId: string) => [
      { id: 'a', color: '#dc4c4c' as const, from: { componentId: 'dig-power', pinId: 'plus' }, to: { componentId: 'dig-board', pinId: 'a1' } },
      { id: 'b', color: '#303b48' as const, from: { componentId: 'dig-power', pinId: 'minus' }, to: { componentId: 'dig-board', pinId } },
    ];
    expect(buildTopology(w.components, connect('e1')).shortCircuit.status).toBe('short');
    expect(buildTopology(w.components, connect('a2')).shortCircuit.status).toBe('clear');
    expect(buildTopology(w.components, connect('f1')).shortCircuit.status).toBe('clear');
  });
  it('does not treat a passive LED or lamp as a voltage source', () => {
    const w = createSvgWorkspace('digital');
    const result = buildTopology(w.components, [{ id: 'led-bridge', color: '#dc4c4c', from: { componentId: 'dig-led', pinId: 'anode' }, to: { componentId: 'dig-led', pinId: 'cathode' } }]);
    expect(result.shortCircuit.status).toBe('clear');
    expect(result.nodes.every((node) => node.voltage === null)).toBe(true);
  });
});
