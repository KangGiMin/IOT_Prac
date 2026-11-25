import { BaseEdge, getBezierPath, Position, useReactFlow } from '@xyflow/react';
import { Fragment } from 'react';
import type { EdgeProps } from '@xyflow/react';
import type { CircuitComponent } from '../../../types/circuit';
import { sequenceScrewRadii, sequenceWireExit } from '../utils/sequenceTerminal';

const FORK_THICKNESS_RATIO = 0.15;

interface Termination {
  x: number;
  y: number;
  radius: number;
  radiusY: number;
  exit: 'top' | 'bottom';
  seated: boolean;
}
const jumperSocketDepth = 7;
const exposedJumperTip = 3;

/** The open center exposes the photograph's screw head; only the fork surrounds it. */
function ForkTerminal({ end, side, color }: {
  end: Termination;
  side: 'source' | 'target';
  color: string;
}) {
  const thickness = Math.min(end.radius, end.radiusY) * FORK_THICKNESS_RATIO;
  // The inner edge touches the measured rim. No straight arms outside the circle.
  const rx = end.radius + thickness / 2;
  const r = end.radiusY + thickness / 2;
  const fork = `M ${-rx * Math.SQRT1_2} ${-r * Math.SQRT1_2} A ${rx} ${r} 0 1 0 ${rx * Math.SQRT1_2} ${-r * Math.SQRT1_2}`;
  return <g
    className="sequence-wire-terminal"
    data-terminal-end={side}
    data-screw-radius={end.radius}
    data-screw-radius-y={end.radiusY}
    transform={`translate(${end.x},${end.y}) rotate(${end.exit === 'top' ? 180 : 0})`}
    pointerEvents="none"
  >
    <path d={`M ${-0.34 * r} ${r} L ${-0.5 * r} ${2.4 * r} H ${0.5 * r} L ${0.34 * r} ${r} Z`}
      fill="#c6b17b" stroke="#847447" strokeWidth={0.16 * r} />
    <path className="sequence-fork" d={fork} fill="none" stroke="#827042"
      strokeWidth={thickness} strokeLinecap="round" />
    <path d={fork} fill="none" stroke="#e2d09a" strokeWidth={thickness * 0.55} strokeLinecap="round" />
    <rect className="sequence-wire-crimp" x={-0.56 * rx} y={1.9 * r}
      width={1.12 * rx} height={1.3 * r} rx={0.22 * rx}
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
  const highlighted = props.selected;
  const jumper = digital && props.data?.kind !== 'clip';
  const terminal = (nodeId: string, pinId: string | null | undefined, x: number, y: number): Termination => {
    const node = getInternalNode(nodeId);
    const handle = node?.internals.handleBounds?.source?.find(h => h.id === pinId);
    const component = node?.data.component as CircuitComponent | undefined;
    const radii = !digital && component
      ? sequenceScrewRadii(component, pinId, handle?.width ?? 12)
      : { x: 4, y: 4 };
    return {
      // A top Handle's edge anchor differs from its photographed screw center.
      x: node && handle ? node.internals.positionAbsolute.x + handle.x + handle.width / 2 : x,
      y: node && handle ? node.internals.positionAbsolute.y + handle.y + handle.height / 2 : y,
      radius: radii.x,
      radiusY: radii.y,
      exit: !digital && component ? sequenceWireExit(component, pinId) : 'top',
      seated: jumper && component?.assetId === 'breadboard' && !!pinId && !pinId.startsWith('post-'),
    };
  };
  const source = terminal(props.source, props.sourceHandleId, props.sourceX, props.sourceY);
  const target = terminal(props.target, props.targetHandleId, props.targetX, props.targetY);
  const anchor = (end: Termination) => ({
    x: end.x,
    y: end.y + (end.seated ? -jumperSocketDepth : digital ? 0 : (end.radiusY + Math.min(end.radius, end.radiusY) * FORK_THICKNESS_RATIO / 2) * 3.1 * (end.exit === 'top' ? -1 : 1)),
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
    {highlighted && <path
      className="wire-highlight"
      d={path}
      fill="none"
      strokeWidth={8}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />}
    <BaseEdge id={id} path={path} style={{ ...style, strokeLinecap: 'round', pointerEvents: 'none' }} interactionWidth={0} />
    {[source, target].map((end, index) => end.seated && (
      <Fragment key={index}>
        <path d={`M ${end.x} ${end.y - jumperSocketDepth} V ${end.y - exposedJumperTip}`} fill="none"
          stroke={color} strokeWidth={3.2} strokeLinecap="round" pointerEvents="none" />
        <path className="jumper-inserted-tip" data-end={index === 0 ? 'source' : 'target'}
          d={`M ${end.x} ${end.y - exposedJumperTip} V ${end.y}`} fill="none"
          stroke="#aebac5" strokeWidth={1.2} strokeLinecap="butt" pointerEvents="none" />
      </Fragment>
    ))}
    {!digital && <>
      <ForkTerminal end={source} side="source" color={color} />
      <ForkTerminal end={target} side="target" color={color} />
    </>}
    {highlighted && [source, target].map((end, i) => (
      <ellipse
        key={i}
        className="wire-highlight wire-terminal-highlight"
        cx={end.x}
        cy={end.y}
        rx={end.radius * 1.3}
        ry={end.radiusY * 1.3}
        fill="none"
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
    ))}
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
