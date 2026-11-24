export interface HitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Disjoint horizontal strips of the union, so overlapping holes cannot cancel
 * each other in an even-odd SVG clip (e.g. overlapping breadboards). */
export function unionHitRects(rectangles: readonly HitRect[]): HitRect[] {
  const events = new Map<number, { index: number; start: boolean }[]>();
  rectangles.forEach((r, index) => {
    if (r.width <= 0 || r.height <= 0) return;
    for (const [y, start] of [
      [r.y, true],
      [r.y + r.height, false],
    ] as const) {
      const at = events.get(y) ?? [];
      at.push({ index, start });
      events.set(y, at);
    }
  });
  const ys = [...events.keys()].sort((a, b) => a - b);
  const active = new Set<number>();
  const strips: HitRect[] = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const y = ys[i];
    for (const event of events.get(y)!) {
      if (event.start) active.add(event.index);
      else active.delete(event.index);
    }
    const intervals = [...active]
      .map((index) => rectangles[index])
      .sort((a, b) => a.x - b.x);
    let strip: HitRect | undefined;
    for (const r of intervals) {
      if (strip && r.x <= strip.x + strip.width) {
        strip.width = Math.max(strip.width, r.x + r.width - strip.x);
      } else {
        strip = { x: r.x, y, width: r.width, height: ys[i + 1] - y };
        strips.push(strip);
      }
    }
  }
  return strips;
}

export function wireHitClip(rectangles: readonly HitRect[]): string {
  return (
    'M -100000 -100000 H 100000 V 100000 H -100000 Z ' +
    unionHitRects(rectangles)
      .map((r) => `M ${r.x} ${r.y} h ${r.width} v ${r.height} h ${-r.width} Z`)
      .join(' ')
  );
}
