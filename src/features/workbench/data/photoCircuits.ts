import type {
  AssetId,
  CircuitComponent,
  CircuitMode,
  CircuitWorkspace,
} from '../../../types/circuit';
import { componentAssets } from '../../../config/assets';
import { solveCircuit } from '../../../engine/circuitSolver';

export const makeComponent = (
  assetId: AssetId,
  id: string,
  x: number,
  y: number,
): CircuitComponent => ({
  id,
  assetId,
  label: componentAssets[assetId].label,
  position: { x, y },
  settings: {
    pressed: false,
    switchOn: false,
    timerSeconds: 3,
    voltage: 5,
    ...(assetId === 'pb-switch' ? { buttonMode: 'detent' } : {}),
  },
});

export const createPhotoWorkspace = (mode: CircuitMode): CircuitWorkspace => {
  const workspace: CircuitWorkspace = {
    components:
      mode === 'sequence'
        ? [
            makeComponent('panel-board', 'seq-board', 0, 0),
          ]
        : [
            makeComponent('breadboard', 'dig-board', 0, 110),
          ],
    wires: [],
    power: { on: false, voltage: mode === 'sequence' ? 24 : 5 },
    simulation: {
      status: 'not-connected',
      pinValues: {},
      energizedComponents: [],
      shortCircuit: { status: 'unchecked', involvedPins: [], message: null },
    },
  };
  return {
    ...workspace,
    simulation: solveCircuit({ ...workspace, mode, compactBreadboards: true }),
  };
};
