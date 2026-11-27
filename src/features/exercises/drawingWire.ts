import { drawingTerminals } from './drawingTerminals';
import { numberedContacts } from './drawingContacts';
import type { PartLocation } from './easyGuide';
import type { Lead } from './model';

type Point = { x: number; y: number };
type Line = readonly [Point, Point];
type Box = { left: number; right: number; top: number; bottom: number };

const pair = ([x, y, u, v]: readonly number[]): Line => [{ x, y }, { x: u, y: v }];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function drawingWireGeometry(
  id: number,
  locations: Record<string, PartLocation>,
  aliases: Lead[],
) {
  const drawing = drawingTerminals[id];
  const anchors = new Map<string, Point[]>();
  const rails = new Map(Object.entries(drawing.rails).map(([name, coordinates]) => [name, pair(coordinates)]));
  const dashedFeed = drawing.dashedFeed && pair(drawing.dashedFeed);
  for (const [id, coordinates] of Object.entries(drawing.loads)) {
    pair(coordinates).forEach((point, index) => anchors.set(`${id}:${index + 1}`, [point]));
  }
  for (const [id, { mark, roles }] of Object.entries(locations)) {
    if (mark.kind === 'unknown') continue;
    roles.forEach((role, index) => {
      const point = mark.points.find((point) => point.role === role);
      if (point) anchors.set(`${id}:${index + 1}`, [point]);
    });
  }
  for (const [from, alias] of aliases) {
    const points = anchors.get(alias);
    if (!points) continue;
    const known = anchors.get(from) ?? [];
    anchors.set(from, [...known, ...points.filter((point) =>
      !known.some((existing) => distance(existing, point) < 0.02))]);
  }

  const box = (points: Point[]): Box => {
    const xs = points.map(({ x }) => x);
    const ys = points.map(({ y }) => y);
    const [left, right] = [Math.min(...xs), Math.max(...xs)];
    const [top, bottom] = [Math.min(...ys), Math.max(...ys)];
    const padX = right - left < 0.5 ? 0.6 : -0.35;
    const padY = bottom - top < 0.5 ? 0.6 : -0.45;
    return { left: left - padX, right: right + padX, top: top - padY, bottom: bottom + padY };
  };
  const symbols = [
    ...numberedContacts(id).filter(({ kind }) => kind !== 'unknown').map(({ points }) => box(points)),
    ...Object.values(drawing.loads).map((coordinates) => box([...pair(coordinates)])),
  ];
  return { anchors, rails, dashedFeed, symbols };
}

export type DrawingWireGeometry = ReturnType<typeof drawingWireGeometry>;

export function drawingInk(image: HTMLImageElement): ((x: number, y: number) => boolean) | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = Math.round(canvas.width * image.naturalHeight / image.naturalWidth);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const { width, height } = canvas;
  try {
    ctx.drawImage(image, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) {
      const [red, green, blue, alpha] = [data[4 * i], data[4 * i + 1], data[4 * i + 2], data[4 * i + 3]];
      mask[i] = Number(alpha > 150 && (Math.max(red, green, blue) < 145 || green < 95));
    }
    return (x, y) => {
      const px = Math.round(width * x / 100);
      const py = Math.round(height * y / 100);
      return px >= 0 && py >= 0 && px < width && py < height && !!mask[py * width + px];
    };
  } catch {
    // The calibrated terminals remain available when pixels cannot be read.
    return undefined;
  }
}

function railPoint([left, right]: Line, x: number): Point {
  const t = Math.max(0, Math.min(1, (x - left.x) / (right.x - left.x)));
  return { x: left.x + t * (right.x - left.x), y: left.y + t * (right.y - left.y) };
}

export interface WireHighlight {
  ends: [Point | undefined, Point | undefined];
  path?: Point[];
  segments?: Line[];
}

export function wiresAtDrawingPoint(
  traces: readonly WireHighlight[],
  geometry: DrawingWireGeometry,
  leads: readonly Lead[],
  point: Point,
  size: { width: number; height: number },
  radius: number,
): number[] {
  // Measure in screen pixels so the tolerance stays useful on a phone and when zoomed.
  const x = size.width / 100;
  const y = size.height / 100;
  const pointDistance = (end: Point) => Math.hypot((point.x - end.x) * x, (point.y - end.y) * y);
  const segmentDistance = (a: Point, b: Point) => {
    const dx = (b.x - a.x) * x;
    const dy = (b.y - a.y) * y;
    const px = (point.x - a.x) * x;
    const py = (point.y - a.y) * y;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) return pointDistance(a);
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared));
    return Math.hypot(px - t * dx, py - t * dy);
  };
  const distances = traces.map(({ ends, path, segments }) => Math.min(
    ...ends.map((end) => end ? pointDistance(end) : Infinity),
    ...(path?.slice(1).map((end, i) => segmentDistance(path[i], end)) ?? []),
    ...(segments?.map(([a, b]) => segmentDistance(a, b)) ?? []),
  ));
  const nearest = Math.min(...distances);
  if (nearest <= radius) {
    // A junction or a coincident trace can represent several completed leads.
    return distances.flatMap((d, index) => d <= Math.min(radius, nearest + 1.5) ? [index] : []);
  }

  const rail = [...geometry.rails].find(([, [a, b]]) => segmentDistance(a, b) <= radius);
  return rail ? leads.flatMap((lead, index) => lead.includes(rail[0]) ? [index] : []) : [];
}

export function wireOnDrawing(
  geometry: DrawingWireGeometry,
  [from, to]: Lead,
  ink?: (x: number, y: number) => boolean,
): WireHighlight {
  const picks = (port: string, other: string) => {
    const rail = geometry.rails.get(port);
    if (!rail) return geometry.anchors.get(port) ?? [];
    return (geometry.anchors.get(other) ?? [rail[0]]).map(({ x }) => railPoint(rail, x));
  };
  const starts = picks(from, to);
  const ends = picks(to, from);
  const fallback: WireHighlight = { ends: [starts[0], ends[0]] };
  if (!ink) return fallback;

  const printedSegment = (a: Point, b: Point) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const vertical = Math.abs(dx) < Math.abs(dy);
    const length = distance(a, b);
    if (length < 0.17) return true;
    if (Math.min(Math.abs(dx), Math.abs(dy)) > 0.8) return false;
    const feed = geometry.dashedFeed;
    const followsDash = feed && Math.max(Math.abs(a.y - railPoint(feed, a.x).y), Math.abs(b.y - railPoint(feed, b.x).y)) < 0.25
      && Math.min(a.x, b.x) >= feed[0].x - 0.2 && Math.max(a.x, b.x) <= feed[1].x + 0.2;
    const count = Math.max(2, Math.ceil(length / 0.22));
    let voidLength = 0;
    let totalVoid = 0;
    for (let i = 1; i < count; i++) {
      const x = a.x + dx * i / count, y = a.y + dy * i / count;
      if (geometry.symbols.some((s) => x > s.left && x < s.right && y > s.top && y < s.bottom)) return false;
      const drawn = followsDash || [-0.46, -0.23, 0, 0.23, 0.46].some((offset) =>
        vertical ? ink(x + offset, y) : ink(x, y + offset));
      if (drawn) voidLength = 0;
      else {
        voidLength += length / count;
        totalVoid += length / count;
        if (voidLength > 0.7 || totalVoid > Math.max(0.45, length * 0.1)) return false;
      }
    }
    return true;
  };

  let shortest = Infinity;
  let best = fallback;
  for (const start of starts) for (const end of ends) {
    const paths = [[start, end], [start, { x: start.x, y: end.y }, end],
      [start, { x: end.x, y: start.y }, end]];
    const buses = [...geometry.rails.values(), ...(geometry.dashedFeed ? [geometry.dashedFeed] : [])];
    for (const line of buses) {
      const a = railPoint(line, start.x), b = railPoint(line, end.x);
      if (a.x === start.x && b.x === end.x) paths.push([start, a, b, end]);
    }
    // A junction may sit on a rail or between features, rather than at an end.
    for (let y = Math.min(start.y, end.y) + 0.35; y < Math.max(start.y, end.y); y += 0.45) {
      paths.push([start, { x: start.x, y }, { x: end.x, y }, end]);
    }
    for (let x = Math.min(start.x, end.x) + 0.35; x < Math.max(start.x, end.x); x += 0.45) {
      paths.push([start, { x, y: start.y }, { x, y: end.y }, end]);
    }
    for (const path of paths) {
      const length = path.slice(1).reduce((sum, point, index) => sum + distance(path[index], point), 0);
      if (length < 0.4 || length >= shortest) continue;
      if (!path.slice(1).every((point, index) => printedSegment(path[index], point))) continue;
      shortest = length;
      best = { ends: [start, end], path };
    }
  }
  if (best.path) return best;
  // If a complete route cannot be verified, mark only a terminal's visible
  // lead when it has one unambiguous exit. Do not draw across an open symbol.
  const segments = fallback.ends.flatMap((point, side): Line[] => {
    if (!point || geometry.rails.has(side === 0 ? from : to)) return [];
    const candidates = [
      { x: point.x, y: point.y - 3 }, { x: point.x, y: point.y + 3 },
      { x: point.x - 3, y: point.y }, { x: point.x + 3, y: point.y },
    ].filter((end) => printedSegment(point, end));
    return candidates.length === 1 ? [[point, candidates[0]]] : [];
  });
  return { ...fallback, segments };
}
