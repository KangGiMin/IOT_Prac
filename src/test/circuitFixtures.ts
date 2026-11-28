import { createPhotoWorkspace, makeComponent } from '../features/workbench/data/photoCircuits';
import { componentAssets } from '../config/assets';
import { MAX_CIRCUIT_COMPONENTS } from '../engine/circuitFile';
import type { CircuitMode, CircuitWire } from '../types/circuit';

export function capacityWorkspace(
  mode: CircuitMode,
  wireCount: number,
  idLength = 8,
  wireIdLength = idLength,
) {
  const w = createPhotoWorkspace(mode);
  w.components = Array.from({ length: MAX_CIRCUIT_COMPONENTS }, (_, i) =>
    makeComponent(
      mode === 'sequence' ? 'pb-switch' : 'resistor-330',
      `${mode[0]}-${i}`.padEnd(idLength, 'x'),
      0,
      0,
    ),
  );
  const endpoints = w.components.flatMap((c) =>
    componentAssets[c.assetId].pins.map((p) => ({
      componentId: c.id,
      pinId: p.id,
    })),
  );
  const wires: CircuitWire[] = [];
  for (let i = 0; i < endpoints.length && wires.length < wireCount; i++)
    for (let j = i + 1; j < endpoints.length && wires.length < wireCount; j++)
      wires.push({
        id: `w-${wires.length}`.padEnd(wireIdLength, 'x'),
        from: endpoints[i],
        to: endpoints[j],
        color: '#dc4c4c',
        kind: mode === 'digital' ? 'jumper' : undefined,
      });
  return { ...w, wires };
}
