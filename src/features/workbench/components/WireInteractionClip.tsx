import { useEffect, useState } from 'react';
import { useReactFlow, useStore, ViewportPortal } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { wireHitClip } from '../utils/wireHitRegions';
import type { HitRect } from '../utils/wireHitRegions';

/** Wires remain visible above the photos, but their selection paths leave all
 * terminal and control areas available to the underlying real components. */
export function WireInteractionClip({ id }: { id: string }) {
  const nodes = useStore(useShallow((s) => [...s.nodeLookup.values()]));
  const { screenToFlowPosition } = useReactFlow();
  const [path, setPath] = useState(() => wireHitClip([]));
  useEffect(() => {
    const regions: HitRect[] = [];
    for (const node of nodes) {
      const position = node.internals.positionAbsolute;
      for (const handle of node.internals.handleBounds?.source ?? []) {
        regions.push({
          x: position.x + handle.x - 1,
          y: position.y + handle.y - 1,
          width: handle.width + 2,
          height: handle.height + 2,
        });
      }
    }
    for (const control of document.querySelectorAll('.photo-node .device-control')) {
      const rect = control.getBoundingClientRect();
      const from = screenToFlowPosition({ x: rect.left, y: rect.top }, { snapToGrid: false });
      const to = screenToFlowPosition({ x: rect.right, y: rect.bottom }, { snapToGrid: false });
      regions.push({
        x: from.x,
        y: from.y,
        width: to.x - from.x,
        height: to.y - from.y,
      });
    }
    setPath(wireHitClip(regions));
  }, [nodes, screenToFlowPosition]);
  return (
    <ViewportPortal>
      <svg
        width="0"
        height="0"
        aria-hidden="true"
        style={{ position: 'absolute', pointerEvents: 'none' }}
      >
        <defs>
          <clipPath id={id} clipPathUnits="userSpaceOnUse">
            <path d={path} clipRule="evenodd" />
          </clipPath>
        </defs>
      </svg>
    </ViewportPortal>
  );
}
