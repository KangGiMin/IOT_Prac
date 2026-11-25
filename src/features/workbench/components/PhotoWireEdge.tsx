import { BaseEdge, getBezierPath, Position, useReactFlow } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import type { CircuitComponent } from '../../../types/circuit';
import { sequenceScrewRadius, sequenceWireExit } from '../utils/sequenceTerminal';

interface Termination {
  x: number;
  y: number;
  radius: number;
  exit: 'top' | 'bottom';
}

/** The open center exposes the photograph's screw head; only the fork surrounds it. */
function ForkTerminal({ end, side, color }: {
  end: Termination;
  side: 'source' | 'target';
  color: string;
}) {
  const r = end.radius * 1.12;
  const fork = `M ${-r} ${-0.8 * r} V 0 A ${r} ${r} 0 0 0 ${r} 0 V ${-0.8 * r}`;
  return <g
    className="sequence-wire-terminal"
    data-terminal-end={side}
    data-screw-radius={end.radius}
    transform={`translate(${end.x},${end.y}) rotate(${end.exit === 'top' ? 180 : 0})`}
    pointerEvents="none"
  >
    <path d={`M ${-0.34 * r} ${r} L ${-0.5 * r} ${2.4 * r} H ${0.5 * r} L ${0.34 * r} ${r} Z`}
      fill="#c6b17b" stroke="#847447" strokeWidth={0.16 * r} />
    <path className="sequence-fork" d={fork} fill="none" stroke="#827042"
      strokeWidth={0.18 * r} strokeLinecap="round" />
    <path d={fork} fill="none" stroke="#e2d09a" strokeWidth={0.1 * r} strokeLinecap="round" />
    <rect className="sequence-wire-crimp" x={-0.56 * r} y={1.9 * r}
      width={1.12 * r} height={1.3 * r} rx={0.22 * r}
      fill={color} stroke="#26372d66" strokeWidth={0.12 * r} />
    <path d={`M ${-0.3 * r} ${2.15 * r} V ${2.9 * r}`}
      stroke="#ffffff66" strokeWidth={0.15 * r} strokeLinecap="round" />
  </g>;
}

/** Endpoint drawings are decorative; screw hotspots remain available for branching. */
export function PhotoWireEdge(props: EdgeProps) {
  const { id, style } = props;
  const { getInternalNode } = useReactFlow();
  const digital = props.data?.mode === 'digital';
  const jumper = digital && props.data?.kind !== 'clip';
  const terminal = (nodeId: string, pinId: string | null | undefined, x: number, y: number): Termination => {
    const node = getInternalNode(nodeId);
    const handle = node?.internals.handleBounds?.source?.find(h => h.id === pinId);
    const component = node?.data.component as CircuitComponent | undefined;
    return {
      // A top Handle's edge anchor differs from its photographed screw center.
      x: node && handle ? node.internals.positionAbsolute.x + handle.x + handle.width / 2 : x,
      y: node && handle ? node.internals.positionAbsolute.y + handle.y + handle.height / 2 : y,
      radius: !digital && component ? sequenceScrewRadius(component, handle?.width ?? 12) : 4,
      exit: !digital && component ? sequenceWireExit(component, pinId) : 'top',
    };
  };
  const source = terminal(props.source, props.sourceHandleId, props.sourceX, props.sourceY);
  const target = terminal(props.target, props.targetHandleId, props.targetX, props.targetY);
  const anchor = (end: Termination) => ({
    x: end.x,
    y: end.y + (digital ? 0 : end.radius * 1.12 * 3.1 * (end.exit === 'top' ? -1 : 1)),
  });
  const start = anchor(source), finish = anchor(target);
  const [path] = getBezierPath({
    ...props,
    sourceX: start.x, sourceY: start.y,
    targetX: finish.x, targetY: finish.y,
    sourcePosition: source.exit === 'top' ? Position.Top : Position.Bottom,
    targetPosition: target.exit === 'top' ? Position.Top : Position.Bottom,
  });
  const color = String(style?.stroke ?? '#dc4c4c');
  return <>
    <BaseEdge id={id} path={path} style={{ ...style, strokeLinecap: 'round', pointerEvents: 'none' }} interactionWidth={0} />
    {!digital && <>
      <ForkTerminal end={source} side="source" color={color} />
      <ForkTerminal end={target} side="target" color={color} />
    </>}
    {digital && !jumper && [source, target].map((p, i) => <g key={i}
      transform={`translate(${p.x},${p.y})`} pointerEvents="none">
      <g transform="rotate(25)">
        <path d="M -3 -1 L -6 10 L 6 10 L 3 -1" fill="#bac4cb" stroke="#657680" strokeWidth="1.5" />
        <path d="M -4 10 H4 V23 H-4 Z" fill={color} />
        <path d="M -4 5 H4 M -5 8 H5" stroke="#536875" />
      </g>
      <path d="M 0 8 V 15" stroke={color} strokeWidth="5" />
    </g>)}
    <path d={path} fill="none" stroke="transparent" strokeWidth={18}
      pointerEvents="stroke" clipPath={`url(#${props.data?.interactionClipId})`} />
  </>;
}
