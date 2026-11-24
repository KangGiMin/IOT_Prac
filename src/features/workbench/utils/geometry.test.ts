import { describe, expect, it } from 'vitest';
import { containBounds, percentAt } from './geometry';

describe('photo calibration geometry', () => {
  it('excludes horizontal or vertical letterboxing from the content rectangle', () => {
    expect(
      containBounds({ width: 200, height: 200 }, { width: 400, height: 200 }),
    ).toEqual({ x: 0, y: 50, width: 200, height: 100 });
    expect(
      containBounds({ width: 200, height: 200 }, { width: 200, height: 400 }),
    ).toEqual({ x: 50, y: 0, width: 100, height: 200 });
  });
  it('reports the same photo coordinate after zoom and pan', () => {
    expect(
      percentAt(180, 140, { left: 100, top: 100, width: 200, height: 100 }),
    ).toEqual(
      percentAt(360, 250, { left: 40, top: 90, width: 800, height: 400 }),
    );
    expect(
      percentAt(180, 140, { left: 100, top: 100, width: 200, height: 100 }),
    ).toEqual({ x: 40, y: 40 });
  });
  it('clamps border clicks and rounds to two decimal places', () => {
    expect(
      percentAt(-1, 101, { left: 0, top: 0, width: 100, height: 100 }),
    ).toEqual({ x: 0, y: 100 });
    expect(percentAt(1, 2, { left: 0, top: 0, width: 3, height: 3 })).toEqual({
      x: 33.33,
      y: 66.67,
    });
  });
});
