import { componentAssets } from '../../../config/assets';
import { sequenceScrewGeometry } from '../../../config/sequencePins';
import type { CircuitComponent } from '../../../types/circuit';
import { containBounds } from './geometry';

/** Radius in workbench coordinates, independent of canvas zoom or hit area. */
export function sequenceScrewRadii(
  component: CircuitComponent,
  pinId: string | null | undefined,
  handleWidth: number,
) {
  const id = component.assetId;
  if (id === 'pb-switch' || id === 'pilot-lamp' || id === 'relay-socket' || id === 'motor-unit') {
    const photo = sequenceScrewGeometry[id];
    const frame = component.displaySize ?? componentAssets[id].size;
    const bounds = containBounds(frame, photo.image);
    const rim = photo.heads[pinId ?? ''];
    const scale = bounds.width / photo.image.width;
    if (rim) return { x: rim.rx * scale, y: rim.ry * scale };
  }
  // The virtual terminal housing has a 1px border on each side.
  const radius = (Math.max(0, handleWidth - 2) * sequenceScrewGeometry.virtualHeadRatio) / 2;
  return { x: radius, y: radius };
}

/** Route the lower relay rows and timer rear strip away from the housing. */
export function sequenceWireExit(component: CircuitComponent, pinId: string | null | undefined) {
  return component.assetId === 'timer-at8n' ||
    (component.assetId === 'relay-socket' && Number(pinId) >= 9)
    ? 'bottom'
    : 'top';
}
