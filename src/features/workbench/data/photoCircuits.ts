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
  settings: { pressed: false, switchOn: false, timerSeconds: 3, voltage: 5 },
});

export const createPhotoWorkspace = (mode: CircuitMode): CircuitWorkspace => {
  const workspace: CircuitWorkspace = {
    components:
      mode === 'sequence'
        ? [
            makeComponent('panel-board', 'seq-board', 0, 0),
            makeComponent('pb-switch', 'seq-pb', 95, 210),
            makeComponent('relay-socket', 'seq-relay', 320, 210),
            makeComponent('pilot-lamp', 'seq-lamp', 595, 210),
            makeComponent('timer-at8n', 'seq-timer', 825, 210),
          ]
        : [
            makeComponent('breadboard', 'dig-board', 0, 110),
            makeComponent('power-supply', 'dig-power', 735, 80),
            makeComponent('oscilloscope', 'dig-scope', 735, 335),
            makeComponent('ic-dip14', 'dig-ic', 240, 295),
            makeComponent('led-red', 'dig-led', 100, 270),
            makeComponent('resistor-330', 'dig-resistor', 440, 310),
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
