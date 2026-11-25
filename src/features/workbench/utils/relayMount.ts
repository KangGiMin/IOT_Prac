import { componentAssets } from '../../../config/assets';
import { sequenceGeometry } from '../../../config/sequencePins';
import type { CircuitComponent } from '../../../types/circuit';
import { containBounds } from './geometry';

/** Fit the visible housing to the photographed slot without scaling the screw board. */
export function relayMountLayout(socket: CircuitComponent) {
  const size = socket.displaySize ?? componentAssets['relay-socket'].size;
  const image = containBounds(size, sequenceGeometry.relayImages.socket);
  const mount = sequenceGeometry.mount;
  const slot = {
    x: socket.position.x + image.x + image.width * (mount.x - mount.width / 2) / 100,
    y: socket.position.y + image.y + image.height * (mount.y - mount.height / 2) / 100,
    width: image.width * mount.width / 100,
    height: image.height * mount.height / 100,
  };
  const body = sequenceGeometry.relayImages.body;
  const housing = body.housing;
  const scale = Math.min(
    slot.width / (body.width * housing.width / 100),
    slot.height / (body.height * housing.height / 100),
  );
  const displaySize = { width: body.width * scale, height: body.height * scale };
  return {
    slot,
    displaySize,
    position: {
      x: slot.x + slot.width / 2 - displaySize.width * (housing.x + housing.width / 2) / 100,
      y: slot.y + slot.height / 2 - displaySize.height * (housing.y + housing.height / 2) / 100,
    },
  };
}

/** Also refit older saved circuits whose mounted bodies used the old large frame. */
export function alignMountedRelays(components: CircuitComponent[]): CircuitComponent[] {
  return components.map(component => {
    if (component.assetId !== 'relay-body' || !component.mountedSocketId) return component;
    const socket = components.find(c => c.id === component.mountedSocketId && c.assetId === 'relay-socket');
    if (!socket) return component;
    const { position, displaySize } = relayMountLayout(socket);
    return { ...component, position, displaySize };
  });
}
