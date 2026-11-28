import { Handle, Position } from '@xyflow/react';
import { componentAssets } from '../../config/assets';
import { relay14 } from '../../config/sequencePins';
import { AssetImage } from '../workbench/components/AssetImage';
import './relayScrewPhoto.css';

const relay = componentAssets['relay-socket'];

export function RelayScrewPhoto({
  ports,
  highlighted = [],
}: {
  ports?: ReadonlyMap<string, string>;
  highlighted?: string[];
}) {
  return (
    <div className="relay-screw-photo">
      <AssetImage asset={relay} thumbnail />
      {relay.pins.map((pin) => {
        const port = ports?.get(pin.id);
        const selected = !!port && highlighted.includes(port);
        const number =
          pin.id === relay14.coil.plus
            ? `${pin.id}+`
            : pin.id === relay14.coil.minus
              ? `${pin.id}−`
              : pin.id;
        return (
          <span
            key={pin.id}
            className="completed-terminal relay-screw"
            data-screw={pin.id}
            title={pin.label}
            style={{ left: `${pin.position.x}%`, top: `${pin.position.y}%` }}
          >
            <span className={selected ? 'relay-screw-number is-active' : 'relay-screw-number'}>
              {number}
            </span>
            {port && (
              <Handle
                id={port}
                type="source"
                position={Position.Bottom}
                isConnectable={false}
                className={selected ? 'is-highlighted' : undefined}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
