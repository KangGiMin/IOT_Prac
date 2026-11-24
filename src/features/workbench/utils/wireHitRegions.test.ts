import { describe, expect, it } from 'vitest';
import { unionHitRects } from './wireHitRegions';
import type { HitRect } from './wireHitRegions';

describe('wire selection exclusions', () => {
  it.each([
    [
      { x: 0, y: 0, width: 4, height: 4 },
      { x: 2, y: 2, width: 4, height: 4 },
    ],
    [
      { x: -2, y: -2, width: 8, height: 8 },
      { x: 0, y: 0, width: 2, height: 2 },
      { x: 0, y: 0, width: 2, height: 2 },
    ],
    [
      { x: 0, y: 0, width: 2, height: 2 },
      { x: 2, y: 0, width: 2, height: 2 },
      { x: 0, y: 2, width: 2, height: 2 },
    ],
    [],
  ])(
    'excludes the full union exactly once, including overlapping controls and boards: %j',
    (...rectangles: HitRect[]) => {
      const strips = unionHitRects(rectangles);
      const contains = (r: HitRect, x: number, y: number) =>
        x > r.x && x < r.x + r.width && y > r.y && y < r.y + r.height;
      for (let y = -2.5; y < 8; y++) {
        for (let x = -2.5; x < 8; x++) {
          const expected = rectangles.some((r) => contains(r, x, y));
          expect(strips.filter((r) => contains(r, x, y)).length).toBe(
            expected ? 1 : 0,
          );
        }
      }
    },
  );
});
