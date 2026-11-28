import { componentAssets } from '../../../config/assets';
import {
  breadboardPinById,
  breadboardPins,
  breadboardRows,
  digitalGeometry,
  holeId,
  insertedPins,
  pinsFor,
  plugInPart,
} from '../../../config/digitalPins';
import type { CircuitComponent, CircuitWire, PercentPoint, Point } from '../../../types/circuit';
import { containBounds } from './geometry';

export function breadboardPoint(board: CircuitComponent, point: PercentPoint) {
  const bounds = containBounds(board.displaySize ?? componentAssets.breadboard.size, {
    width: 1448,
    height: 1086,
  });
  return {
    x: board.position.x + bounds.x + (bounds.width * point.x) / 100,
    y: board.position.y + bounds.y + (bounds.height * point.y) / 100,
  };
}

export function plugInPhoto(component: CircuitComponent, width: number) {
  const part = plugInPart(component.assetId)!;
  const pins = pinsFor(component);
  const first = pins[0].position,
    last = pins.at(-1)!.position;
  const height = width * part.heightRatio;
  const shear = ((first.y - last.y) * height) / ((last.x - first.x) * width);
  const offset = Math.max(0, -shear * width);
  const seam = (first.y / 100) * height + ((shear * first.x) / 100) * width + offset;
  return { height, shear, offset, seam };
}

function mountPart(component: CircuitComponent, board: CircuitComponent) {
  const pins = pinsFor(component);
  const targets = insertedPins(component);
  const first = pins[0],
    last = pins.at(-1)!;
  const a = breadboardPoint(board, breadboardPinById.get(targets[first.id].pinId)!.position);
  const b = breadboardPoint(board, breadboardPinById.get(targets[last.id].pinId)!.position);
  const width = ((b.x - a.x) * 100) / (last.position.x - first.position.x);
  const photo = plugInPhoto(component, width);
  return {
    ...component,
    displaySize: { width, height: photo.seam },
    position: {
      x: a.x - (first.position.x / 100) * width,
      y: a.y - photo.seam,
    },
  };
}

export function alignPlugInParts(components: CircuitComponent[]) {
  return components.map((part) => {
    if (!part.insertion?.row || !plugInPart(part.assetId)) return part;
    const board = components.find(
      (component) => component.id === part.insertion!.boardId && component.assetId === 'breadboard',
    );
    return board ? mountPart(part, board) : part;
  });
}

function placeTwoOrThreePinPart(
  component: CircuitComponent,
  components: CircuitComponent[],
  wires: CircuitWire[],
  dropPoint?: Point,
) {
  const part = plugInPart(component.assetId)!;
  const base = componentAssets[component.assetId].size;
  const size = component.displaySize ?? base;
  const anchor = {
    x: component.position.x + size.width / 2,
    y: component.position.y + size.height * (component.insertion ? 1 : 0.5),
  };
  const target = dropPoint ?? anchor;
  let closest:
    | {
        board: CircuitComponent;
        bank: number;
        row: string;
        column: number;
        distance: number;
      }
    | undefined;
  for (const board of components.filter((item) => item.assetId === 'breadboard')) {
    const first = breadboardPoint(board, breadboardPinById.get('a1')!.position);
    const last = breadboardPoint(board, breadboardPinById.get('bank4-j63')!.position);
    const pitch = (last.x - first.x) / (digitalGeometry.columns - 1);
    if (
      target.x < first.x - pitch ||
      target.x > last.x + pitch ||
      target.y < first.y - pitch ||
      target.y > last.y + pitch
    )
      continue;
    // The resistor can also be dropped over a channel between signal rows.
    const snapDistance = pitch * (component.assetId === 'resistor-330' ? 4 : 1.6);
    const occupied = new Set(
      components
        .filter((item) => item.id !== component.id)
        .flatMap((item) => Object.values(insertedPins(item)))
        .concat(wires.flatMap((wire) => [wire.from, wire.to]))
        .filter((pin) => pin.componentId === board.id)
        .map((pin) => pin.pinId),
    );
    const span = part.offsets.at(-1)!;
    for (let bank = 0; bank < digitalGeometry.banks.length; bank++) {
      for (const row of breadboardRows) {
        const y = breadboardPoint(board, breadboardPinById.get(holeId(bank, row, 1))!.position).y;
        if (Math.abs(y - target.y) > snapDistance) continue;
        for (let column = 1; column <= digitalGeometry.columns - span; column++) {
          const a = breadboardPoint(
            board,
            breadboardPinById.get(holeId(bank, row, column))!.position,
          );
          const b = breadboardPoint(
            board,
            breadboardPinById.get(holeId(bank, row, column + span))!.position,
          );
          const distance = Math.hypot((a.x + b.x) / 2 - target.x, y - target.y);
          if (distance > snapDistance || (closest && closest.distance <= distance)) continue;
          if (part.offsets.some((offset) => occupied.has(holeId(bank, row, column + offset))))
            continue;
          closest = { board, bank, row, column, distance };
        }
      }
    }
  }
  if (closest) {
    const { board, bank, row, column } = closest;
    const mounted = mountPart(
      { ...component, insertion: { boardId: board.id, bank, row, column } },
      board,
    );
    if (mounted.displaySize.width >= 1 && mounted.displaySize.height >= 1) return mounted;
  }
  if (!component.insertion) return component;
  return {
    ...component,
    insertion: undefined,
    displaySize: undefined,
    position: { x: anchor.x - base.width / 2, y: anchor.y - base.height / 2 },
  };
}

export function placeDigital(
  components: CircuitComponent[],
  id: string,
  wires: CircuitWire[] = [],
  dropPoint?: Point,
): CircuitComponent[] {
  const c = components.find((c) => c.id === id);
  if (c && plugInPart(c.assetId)) {
    const placed = placeTwoOrThreePinPart(c, components, wires, dropPoint);
    return placed === c ? components : components.map((item) => (item.id === id ? placed : item));
  }
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
          ((b.displaySize ?? componentAssets.breadboard.size).width * digitalGeometry.firstX) /
            100 &&
      center.x <
        b.position.x +
          ((b.displaySize ?? componentAssets.breadboard.size).width * digitalGeometry.lastX) /
            100 &&
      center.y > b.position.y &&
      center.y < b.position.y + (b.displaySize ?? componentAssets.breadboard.size).height,
  );
  if (!board)
    return components.map((item) =>
      item.id === id ? { ...item, insertion: undefined, displaySize: undefined } : item,
    );
  const boardSize = board.displaySize ?? componentAssets.breadboard.size;
  const bank = digitalGeometry.banks
    .map((rows, i) => ({
      i,
      y: board.position.y + (boardSize.height * (rows[4] + rows[5])) / (2 * 1086),
    }))
    .reduce((a, b) => (Math.abs(a.y - center.y) < Math.abs(b.y - center.y) ? a : b));
  const pitch =
    (boardSize.width * (digitalGeometry.lastX - digitalGeometry.firstX)) /
    100 /
    (digitalGeometry.columns - 1);
  const column = Math.max(
    1,
    Math.min(
      digitalGeometry.columns - 6,
      Math.round(
        (center.x - board.position.x - (boardSize.width * digitalGeometry.firstX) / 100) / pitch,
      ) - 2,
    ),
  );
  const occupied = components.some(
    (item) =>
      item.id !== id &&
      item.insertion?.boardId === board.id &&
      item.insertion.bank === bank.i &&
      (item.assetId === 'ic-dip14'
        ? Math.abs(item.insertion.column - column) < 7
        : ['e', 'f'].includes(item.insertion.row ?? '') &&
          plugInPart(item.assetId)?.offsets.some((offset) => {
            const pinColumn = item.insertion!.column + offset;
            return pinColumn >= column && pinColumn < column + 7;
          })),
  );
  if (occupied)
    return components.map((item) =>
      item.id === id ? { ...item, insertion: undefined, displaySize: undefined } : item,
    );
  const rows = digitalGeometry.banks[bank.i];
  const width = (6 * pitch) / ((digitalGeometry.ic.lastX - digitalGeometry.ic.firstX) / 100),
    height =
      (((boardSize.height * (rows[5] - rows[4])) / 1086) * 100) /
      (digitalGeometry.ic.bottomY - digitalGeometry.ic.topY);
  const first = breadboardPins.find(
    (p) => p.id === (bank.i === 0 ? '' : 'bank' + (bank.i + 1) + '-') + 'f' + column,
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
