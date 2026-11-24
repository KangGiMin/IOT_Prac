import { deviceDefinitions } from '../devices/definitions';
import type {
  AssetId,
  CircuitComponent,
  CircuitMode,
} from '../../../types/circuit';
import type { SvgWorkspace } from '../types.ts';
export function makeSvgComponent(
  assetId: AssetId,
  id: string,
  x: number,
  y: number,
  voltage = 5,
): CircuitComponent {
  return {
    id,
    assetId,
    label: deviceDefinitions[assetId].label,
    position: { x, y },
    settings: { pressed: false, switchOn: false, timerSeconds: 3, voltage },
  };
}
export function createSvgWorkspace(mode: CircuitMode): SvgWorkspace {
  const make = (asset: AssetId, id: string, x: number, y: number) =>
    makeSvgComponent(asset, id, x, y, mode === 'sequence' ? 24 : 5);
  return {
    components:
      mode === 'sequence'
        ? [
            make('panel-board', 'seq-board', 0, 0),
            make('power-supply', 'seq-power', 50, 65),
            make('pb-switch', 'seq-pb', 65, 315),
            make('relay-socket', 'seq-relay', 275, 315),
            make('pilot-lamp', 'seq-lamp', 535, 315),
            make('timer-at8n', 'seq-timer', 745, 315),
            make('relay-body', 'seq-body', 770, 105),
          ]
        : [
            make('breadboard', 'dig-board', 35, 105),
            make('power-supply', 'dig-power', 635, 65),
            make('oscilloscope', 'dig-scope', 630, 315),
            make('ic-dip14', 'dig-ic', 180, 460),
            make('led-red', 'dig-led', 70, 455),
            make('resistor-330', 'dig-resistor', 435, 470),
          ],
    wires: [],
    nodes: [],
    power: { on: false, voltage: mode === 'sequence' ? 24 : 5 },
    simulation: {
      status: 'not-connected',
      pinValues: {},
      energizedComponents: [],
      shortCircuit: { status: 'unchecked', involvedPins: [], message: null },
    },
    viewport: { x: 32, y: 40, zoom: 0.7 },
    logs: [],
    missionResult: null,
  };
}
