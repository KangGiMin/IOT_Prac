import { componentAssets } from '../../../config/assets';
import { breadboardPins, digitalGeometry } from '../../../config/digitalPins';
import type { CircuitComponent } from '../../../types/circuit';
export function placeDigital(
  components: CircuitComponent[],
  id: string,
): CircuitComponent[] {
  const c = components.find((c) => c.id === id);
  if (!c || c.assetId !== 'ic-dip14') return components;
  const frame = c.displaySize ?? componentAssets[c.assetId].size,
    center = {
      x: c.position.x + frame.width / 2,
      y: c.position.y + frame.height / 2,
    };
  const board = components.find(
    (b) =>
      b.assetId === 'breadboard' &&
      center.x >
        b.position.x +
          ((b.displaySize ?? componentAssets.breadboard.size).width *
            digitalGeometry.firstX) /
            100 &&
      center.x <
        b.position.x +
          ((b.displaySize ?? componentAssets.breadboard.size).width *
            digitalGeometry.lastX) /
            100 &&
      center.y > b.position.y &&
      center.y <
        b.position.y +
          (b.displaySize ?? componentAssets.breadboard.size).height,
  );
  if (!board)
    return components.map((item) =>
      item.id === id
        ? { ...item, insertion: undefined, displaySize: undefined }
        : item,
    );
  const boardSize = board.displaySize ?? componentAssets.breadboard.size;
  const bank = digitalGeometry.banks
    .map((b, i) => ({
      i,
      y:
        board.position.y +
        (boardSize.height * (b.top + 4 * digitalGeometry.rowPitch + b.bottom)) /
          200,
    }))
    .reduce((a, b) =>
      Math.abs(a.y - center.y) < Math.abs(b.y - center.y) ? a : b,
    );
  const pitch =
    (boardSize.width * (digitalGeometry.lastX - digitalGeometry.firstX)) /
    100 /
    (digitalGeometry.columns - 1);
  const column = Math.max(
    1,
    Math.min(
      digitalGeometry.columns - 6,
      Math.round(
        (center.x -
          board.position.x -
          (boardSize.width * digitalGeometry.firstX) / 100) /
          pitch,
      ) - 2,
    ),
  );
  const occupied = components.some(
    (item) =>
      item.id !== id &&
      item.insertion?.boardId === board.id &&
      item.insertion.bank === bank.i &&
      Math.abs(item.insertion.column - column) < 7,
  );
  if (occupied)
    return components.map((item) =>
      item.id === id
        ? { ...item, insertion: undefined, displaySize: undefined }
        : item,
    );
  const width =
      (6 * pitch) /
      ((digitalGeometry.ic.lastX - digitalGeometry.ic.firstX) / 100),
    height =
      (boardSize.height *
        (digitalGeometry.banks[bank.i].bottom -
          digitalGeometry.banks[bank.i].top -
          4 * digitalGeometry.rowPitch)) /
      (digitalGeometry.ic.bottomY - digitalGeometry.ic.topY);
  const first = breadboardPins.find(
    (p) =>
      p.id === (bank.i === 0 ? '' : 'bank' + (bank.i + 1) + '-') + 'f' + column,
  )!;
  return components.map((item) =>
    item.id === id
      ? {
          ...item,
          insertion: { boardId: board.id, bank: bank.i, column },
          displaySize: { width, height },
          position: {
            x:
              board.position.x +
              (boardSize.width * first.position.x) / 100 -
              (width * digitalGeometry.ic.firstX) / 100,
            y:
              board.position.y +
              (boardSize.height * first.position.y) / 100 -
              (height * digitalGeometry.ic.bottomY) / 100,
          },
        }
      : item,
  );
}
