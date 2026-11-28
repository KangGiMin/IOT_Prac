import { deviceDefinitions } from '../devices/definitions';
import type { CircuitComponent, PinRef, Point } from '../../../types/circuit';
import type { Viewport } from '../types.ts';
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;
export function pinPosition(components: CircuitComponent[], ref: PinRef): Point | null {
  const component = components.find((item) => item.id === ref.componentId);
  const pin =
    component && deviceDefinitions[component.assetId].pins.find((item) => item.id === ref.pinId);
  return component && pin
    ? {
        x: component.position.x + pin.position.x,
        y: component.position.y + pin.position.y,
      }
    : null;
}
export const samePin = (a: PinRef, b: PinRef) =>
  a.componentId === b.componentId && a.pinId === b.pinId;
export function wirePath(a: Point, b: Point): string {
  const bend = Math.max(40, Math.min(180, Math.abs(b.x - a.x) * 0.45 + Math.abs(b.y - a.y) * 0.2));
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + bend}, ${b.x} ${b.y + bend}, ${b.x} ${b.y}`;
}
/** Preserve the world point under the cursor, including after prior pan/zoom. */
export function zoomAt(viewport: Viewport, cursor: Point, factor: number): Viewport {
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom * factor));
  return {
    x: cursor.x - ((cursor.x - viewport.x) * zoom) / viewport.zoom,
    y: cursor.y - ((cursor.y - viewport.y) * zoom) / viewport.zoom,
    zoom,
  };
}
