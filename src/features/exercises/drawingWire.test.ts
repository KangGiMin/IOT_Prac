import { expect, it } from 'vitest';
import { buildCompletedWorkbench } from './completedCircuit';
import { wireOnDrawing, wiresAtDrawingPoint } from './drawingWire';
import type { DrawingWireGeometry, WireHighlight } from './drawingWire';
import type { Lead } from './model';
import { exercises } from './model';

const start = { x: 20, y: 15 };
const end = { x: 55, y: 40 };
const geometry: DrawingWireGeometry = {
  anchors: new Map([['from', [start]], ['to', [end]]]),
  rails: new Map(),
  dashedFeed: undefined,
  symbols: [],
};

it('follows the visible elbow and uses the selected wire terminals', () => {
  const ink = (x: number, y: number) =>
    (Math.abs(x - 20) < 0.3 && y >= 15 && y <= 40)
    || (Math.abs(y - 40) < 0.3 && x >= 20 && x <= 55);
  expect(wireOnDrawing(geometry, ['from', 'to'], ink)).toEqual({
    ends: [start, end],
    path: [start, { x: 20, y: 40 }, end],
  });
});

it('does not bridge missing ink or draw through a component symbol', () => {
  const vertical = { ...geometry, anchors: new Map([['from', [start]], ['to', [{ x: 20, y: 40 }]]]) };
  const ink = (x: number, y: number) => Math.abs(x - 20) < 0.3 && (y < 25 || y > 28);
  expect(wireOnDrawing(vertical, ['from', 'to'], ink).path).toBeUndefined();
  const symbol = { left: 19, right: 21, top: 23, bottom: 28 };
  expect(wireOnDrawing({ ...vertical, symbols: [symbol] }, ['from', 'to'], (x) => Math.abs(x - 20) < 0.3).path).toBeUndefined();
});

const elbow: WireHighlight = { ends: [start, end], path: [start, { x: 20, y: 40 }, end] };
const nearElbow: WireHighlight = { ends: [undefined, undefined], segments: [[{ x: 21, y: 20 }, { x: 21, y: 35 }]] };
const size = { width: 600, height: 450 };

it('picks the nearest printed conductor or terminal and ignores the interior of an elbow', () => {
  const traces = [elbow, nearElbow];
  const hit = (x: number, y: number) => wiresAtDrawingPoint(traces, geometry, [], { x, y }, size, 8);
  expect(hit(20.1, 28)).toEqual([0]);
  expect(hit(20.9, 28)).toEqual([1]);
  expect(hit(56, 40)).toEqual([0]);
  expect(hit(35, 24)).toEqual([]);
  expect(wiresAtDrawingPoint(traces, geometry, [], { x: 56, y: 40 }, { width: 1200, height: 900 }, 8)).toEqual([]);
});

it('returns all traces at a shared junction and relates the supply rail only to its own leads', () => {
  const leads: Lead[] = [['24V', 'from'], ['from', 'to'], ['24V', 'lamp']];
  const traces: WireHighlight[] = [elbow, { ends: [start, undefined] }, { ends: [undefined, undefined] }];
  const rails: DrawingWireGeometry['rails'] = new Map([['24V', [{ x: 3, y: 10 }, { x: 97, y: 10 }]]]);
  expect(wiresAtDrawingPoint(traces, { ...geometry, rails }, leads, start, size, 8)).toEqual([0, 1]);
  expect(wiresAtDrawingPoint(traces, { ...geometry, rails }, leads, { x: 70, y: 10 }, size, 8)).toEqual([0, 2]);
  expect(wiresAtDrawingPoint(traces, { ...geometry, rails }, leads, { x: 99, y: 10 }, size, 8)).toEqual([]);
});

it.each(exercises)('places the annotated terminals inside drawing $id', (exercise) => {
  const board = buildCompletedWorkbench(exercise);
  const selectedTerminals = board.steps.flatMap(({ lead }) =>
    wireOnDrawing(board.drawing, lead).ends.filter((point) => point !== undefined));
  expect(selectedTerminals.length).toBeGreaterThan(board.steps.length);
  for (const { x, y } of selectedTerminals) {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(100);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(100);
  }
});
