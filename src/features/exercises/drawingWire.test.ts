import { expect, it } from 'vitest';
import { buildCompletedWorkbench } from './completedCircuit';
import { wireOnDrawing } from './drawingWire';
import type { DrawingWireGeometry } from './drawingWire';
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
