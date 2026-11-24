import { BaseEdge, getBezierPath, useReactFlow } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

/** Wires stay above photos, while endpoint hit areas remain available for branching. */
export function PhotoWireEdge(props: EdgeProps) {
  const { id, sourceX, targetX, style } = props;
  const { getInternalNode } = useReactFlow();
  const digital = props.data?.mode === 'digital';
  const jumper = digital && props.data?.kind !== 'clip';
  // Photo terminals use top handles. React Flow anchors at their upper edge;
  // the actual socket/hole is at the center of the transparent input area.
  const radius = (nodeId: string) =>
    (getInternalNode(nodeId)?.internals.handleBounds?.source?.[0]?.height ??
      0) / 2;
  const sourceY = props.sourceY + (digital ? radius(props.source) : 0);
  const targetY = props.targetY + (digital ? radius(props.target) : 0);
  const [path] = getBezierPath({ ...props, sourceY, targetY });
  return (
    <>
      {!jumper &&
        [
          { x: sourceX, y: sourceY },
          { x: targetX, y: targetY },
        ].map((p, i) => (
          <g
            key={i}
            transform={`translate(${p.x},${p.y})`}
            pointerEvents="none"
          >
            {digital ? (
              <g transform="rotate(25)">
                <path
                  d="M -3 -1 L -6 10 L 6 10 L 3 -1"
                  fill="#bac4cb"
                  stroke="#657680"
                  strokeWidth="1.5"
                />
                <path
                  d="M -4 10 H4 V23 H-4 Z"
                  fill={String(style?.stroke ?? '#df4747')}
                />
                <path d="M -4 5 H4 M -5 8 H5" stroke="#536875" />
              </g>
            ) : (
              <path
                d="M -5 8 L -5 0 Q -5 -6 0 -6 Q 5 -6 5 0 L 5 8"
                fill="none"
                stroke="#c4ad76"
                strokeWidth="3"
              />
            )}
            <path
              d="M 0 8 V 15"
              stroke={String(style?.stroke ?? '#dc4c4c')}
              strokeWidth="5"
            />
          </g>
        ))}
      <BaseEdge
        id={id}
        path={path}
        style={{
          ...style,
          strokeLinecap: jumper ? 'round' : undefined,
          pointerEvents: 'none',
        }}
        interactionWidth={0}
      />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        pointerEvents="stroke"
        clipPath={`url(#${props.data?.interactionClipId})`}
      />
    </>
  );
}
