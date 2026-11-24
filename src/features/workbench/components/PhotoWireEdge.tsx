import { BaseEdge, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

/** Wires stay above photos, while endpoint hit areas remain available for branching. */
export function PhotoWireEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, style } = props;
  const [path] = getBezierPath(props);
  const clipId = `wire-hit-${id}`;
  const hole = (x: number, y: number) =>
    `M ${x - 13} ${y} a 13 13 0 1 0 26 0 a 13 13 0 1 0 -26 0 Z`;
  // Even-odd clipping removes a small circle at each pin from the hit path.
  const clip = `M -100000 -100000 H 100000 V 100000 H -100000 Z ${hole(sourceX, sourceY)} ${hole(targetX, targetY)}`;
  return <>
    <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><path d={clip} clipRule="evenodd" /></clipPath></defs>
    {[{x:sourceX,y:sourceY},{x:targetX,y:targetY}].map((p,i)=><g key={i} transform={`translate(${p.x},${p.y})`} pointerEvents="none">{props.data?.mode==='digital' ? props.data?.kind==='clip' ? <g transform="rotate(25)"><path d="M -3 -1 L -6 10 L 6 10 L 3 -1" fill="#bac4cb" stroke="#657680" strokeWidth="1.5"/><path d="M -4 10 H4 V23 H-4 Z" fill={String(style?.stroke??'#df4747')}/><path d="M -4 5 H4 M -5 8 H5" stroke="#536875"/></g> : <g><path d="M0 -3 V8" stroke="#bfba9b" strokeWidth="3"/><rect x="-4" y="7" width="8" height="12" rx="2" fill={String(style?.stroke??'#df4747')}/></g> : <path d="M -5 8 L -5 0 Q -5 -6 0 -6 Q 5 -6 5 0 L 5 8" fill="none" stroke="#c4ad76" strokeWidth="3"/>}<path d="M 0 8 V 15" stroke={String(style?.stroke??'#dc4c4c')} strokeWidth="5"/></g>)}
    <BaseEdge id={id} path={path} style={{ ...style, pointerEvents: 'none' }} interactionWidth={0} />
    <path d={path} fill="none" stroke="transparent" strokeWidth={18} pointerEvents="stroke" clipPath={`url(#${clipId})`} />
  </>;
}
