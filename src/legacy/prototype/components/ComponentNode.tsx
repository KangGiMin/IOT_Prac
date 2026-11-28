import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ComponentNode as LabNode } from '../types';
import { ComponentSymbol } from './ComponentSymbol';

export const ComponentNode = memo(function ComponentNode({ data, selected }: NodeProps<LabNode>) {
  return (
    <div className={`apparatus ${selected ? 'is-selected' : ''} kind-${data.kind}`}>
      <Handle type="target" position={Position.Left} aria-label={`${data.code} 입력 단자`} />
      <div className="apparatus-top">
        <span>{data.code}</span>
        <span className="screw" />
      </div>
      <div className="apparatus-symbol">
        <ComponentSymbol kind={data.kind} />
      </div>
      <strong>{data.label}</strong>
      <small>{data.detail}</small>
      <Handle type="source" position={Position.Right} aria-label={`${data.code} 출력 단자`} />
    </div>
  );
});
