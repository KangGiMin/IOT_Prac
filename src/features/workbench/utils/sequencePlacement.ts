import { componentAssets } from '../../../config/assets';
import { sequenceGeometry } from '../../../config/sequencePins';
import type { CircuitComponent } from '../../../types/circuit';
import { relayMountLayout } from './relayMount';
export function placeSequence(components: CircuitComponent[], id: string): CircuitComponent[] {
  const item = components.find((c) => c.id === id);
  if (!item) return components;
  if (item.assetId === 'relay-body') {
    const size = item.displaySize ?? componentAssets['relay-body'].size;
    const center = {
      x: item.position.x + size.width / 2,
      y: item.position.y + size.height / 2,
    };
    const socket = components.find((c) => {
      if (
        c.assetId !== 'relay-socket' ||
        components.some((b) => b.id !== id && b.mountedSocketId === c.id)
      )
        return false;
      const { slot } = relayMountLayout(c);
      return (
        Math.abs(center.x - (slot.x + slot.width / 2)) < 85 &&
        Math.abs(center.y - (slot.y + slot.height / 2)) < 90
      );
    });
    const layout = socket && relayMountLayout(socket);
    return components.map((c) =>
      c.id !== id
        ? c
        : socket
          ? {
              ...c,
              mountedSocketId: socket.id,
              position: layout!.position,
              displaySize: layout!.displaySize,
            }
          : {
              ...c,
              mountedSocketId: undefined,
              displaySize: undefined,
              position: {
                x: center.x - componentAssets['relay-body'].size.width / 2,
                y: center.y - componentAssets['relay-body'].size.height / 2,
              },
            },
    );
  }
  const board = components.find(
    (c) =>
      c.assetId === 'panel-board' &&
      item.position.x + componentAssets[item.assetId].size.width / 2 >= c.position.x &&
      item.position.x <= c.position.x + 1120 &&
      item.position.y >= c.position.y - 100 &&
      item.position.y <= c.position.y + 640,
  );
  if (
    !board ||
    ![
      'pilot-lamp',
      'motor-unit',
      'pb-switch',
      'relay-socket',
      'relay-unit-11p',
      'timer-at8n',
    ].includes(item.assetId)
  )
    return components;
  const size = componentAssets[item.assetId].size;
  const rails = sequenceGeometry.railYs.map(
    (y) => board.position.y + (640 * y) / 100 - size.height / 2,
  );
  const y = rails.reduce((a, b) =>
    Math.abs(b - item.position.y) < Math.abs(a - item.position.y) ? b : a,
  );
  const x = Math.max(
    board.position.x + (1120 * sequenceGeometry.left) / 100,
    Math.min(
      board.position.x + (1120 * sequenceGeometry.right) / 100 - size.width,
      item.position.x,
    ),
  );
  const dx = x - item.position.x,
    dy = y - item.position.y;
  return components.map((c) =>
    c.id === id
      ? { ...c, position: { x, y } }
      : c.mountedSocketId === id
        ? { ...c, position: { x: c.position.x + dx, y: c.position.y + dy } }
        : c,
  );
}
