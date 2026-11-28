import { expect, it } from 'vitest';
import { useCircuitStore } from './usePhotoCircuitStore';
import { createPhotoWorkspace, makeComponent } from '../features/workbench/data/photoCircuits';
import { exportCircuitFile } from '../engine/circuitFile';

it('keeps import, evaluation, history replay and reset on the compact runtime path', () => {
  const digital = createPhotoWorkspace('digital');
  digital.components = Array.from({ length: 100 }, (_, i) =>
    makeComponent('breadboard', 'board-' + i, 0, 0),
  );
  digital.wires = [];
  const workspaces = { sequence: createPhotoWorkspace('sequence'), digital };
  useCircuitStore.setState({
    workspaces,
    mode: 'digital',
    calibration: false,
    dragHistory: null,
    histories: {
      sequence: { past: [], future: [] },
      digital: { past: [], future: [] },
    },
  });
  const s = useCircuitStore.getState();
  s.importJson(exportCircuitFile('digital', workspaces));
  const pins = () =>
    Object.keys(useCircuitStore.getState().workspaces.digital.simulation.pinValues);
  expect(pins()).toHaveLength(0);
  s.togglePower();
  expect(pins()).toHaveLength(0);
  s.undo();
  expect(pins()).toHaveLength(0);
  s.redo();
  expect(pins()).toHaveLength(0);
  s.reset();
  expect(pins().some((key) => key.startsWith('dig-board:'))).toBe(false);
  s.loadPreset('nand');
  expect(pins().filter((key) => key.startsWith('board:')).length).toBeLessThan(300);
});
