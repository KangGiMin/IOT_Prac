import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from './usePhotoCircuitStore';
import {
  createPhotoWorkspace,
  makeComponent,
} from '../features/workbench/data/photoCircuits';
import { placeSequence } from '../features/workbench/utils/sequencePlacement';
beforeEach(() =>
  useCircuitStore.setState({
    mode: 'sequence',
    calibration: false,
    workspaces: {
      sequence: createPhotoWorkspace('sequence'),
      digital: createPhotoWorkspace('digital'),
    },
  }),
);
describe('rail placement and installation', () => {
  it('snaps module center to a board rail and clamps its horizontal position', () => {
    const board = makeComponent('panel-board', 'board', 0, 0),
      lamp = makeComponent('pilot-lamp', 'lamp', 20, 140);
    const placed = placeSequence([board, lamp], 'lamp')[1];
    expect(placed.position.x).toBe(56);
    expect(placed.position.y).toBeCloseTo(130.4);
  });
  it('attaches one body per socket, supports removal and carries the body with a moving socket', () => {
    const socket = makeComponent('relay-socket', 'socket', 320, 210),
      body = makeComponent('relay-body', 'body', 430, 237),
      other = makeComponent('relay-body', 'other', 430, 237);
    const first = placeSequence([socket, body, other], 'body');
    expect(first[1].mountedSocketId).toBe('socket');
    expect(first[1].displaySize!.width).toBeLessThan(50);
    expect(placeSequence(first, 'other')[2].mountedSocketId).toBeUndefined();
    useCircuitStore.setState((s) => ({
      workspaces: {
        ...s.workspaces,
        sequence: { ...s.workspaces.sequence, components: first },
      },
    }));
    useCircuitStore.getState().moveComponent('socket', { x: 420, y: 310 });
    const moved = useCircuitStore.getState().workspaces.sequence.components[1];
    expect(moved.position.x).toBeCloseTo(first[1].position.x + 100);
    useCircuitStore.getState().moveComponent('body', { x: 900, y: 900 });
    useCircuitStore.getState().finishDrag('body');
    expect(
      useCircuitStore.getState().workspaces.sequence.components[1]
        .mountedSocketId,
    ).toBeUndefined();
    expect(useCircuitStore.getState().workspaces.sequence.components[1].displaySize).toBeUndefined();
  });
});
