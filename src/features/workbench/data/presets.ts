import { makeComponent } from './photoCircuits';
import { solveCircuit } from '../../../engine/circuitSolver';
import { placeDigital } from '../utils/digitalPlacement';
import { alignMountedRelays } from '../utils/relayMount';
import type {
  CircuitComponent,
  CircuitMode,
  CircuitWire,
  CircuitWorkspace,
} from '../../../types/circuit';
export type PresetId = 'self-hold' | 'nand' | 'nor';
export function createPreset(id: PresetId): {
  mode: CircuitMode;
  workspace: CircuitWorkspace;
} {
  const mode = id === 'self-hold' ? 'sequence' : 'digital';
  let components: CircuitComponent[] = [];
  const wires: CircuitWire[] = [];
  const add = (asset: Parameters<typeof makeComponent>[0], name: string, x: number, y: number) => {
    const c = makeComponent(asset, name, x, y);
    components.push(c);
    return c;
  };
  const connect = (a: string, ap: string, b: string, bp: string) =>
    wires.push({
      id: `preset-wire-${wires.length}`,
      from: { componentId: a, pinId: ap },
      to: { componentId: b, pinId: bp },
      color: ap.includes('minus') || ap === '13' ? '#303b48' : '#dc4c4c',
      kind: mode === 'digital' ? 'jumper' : undefined,
    });
  if (mode === 'digital') {
    const nor = id === 'nor';
    const outputPin = nor ? '1' : '3';
    add('breadboard', 'board', 0, 140);
    add('power-supply', 'power', 740, 80);
    add('oscilloscope', 'scope', 740, 340);
    add('ic-dip14', 'ic', 240, 295).settings.icModel = nor ? '7402' : '7400';
    add('switch-3pin', 'input-a', 100, 10).label = '입력 A';
    add('switch-3pin', 'input-b', 260, 10).label = '입력 B';
    add('resistor-330', 'resistor', 430, 340);
    add('led-red', 'output-led', 560, 330).label = '출력 Y';
    components = placeDigital(components, 'ic');
    connect('power', 'plus', 'board', 'top-plus-1');
    connect('power', 'minus', 'board', 'top-minus-1');
    for (const [s, p] of [
      ['input-a', nor ? '2' : '1'],
      ['input-b', nor ? '3' : '2'],
    ] as const) {
      connect(s, '1', 'board', 'top-minus-2');
      connect(s, '2', 'board', 'top-plus-2');
      connect(s, 'com', 'ic', p);
    }
    connect('ic', '14', 'board', 'top-plus-3');
    connect('ic', '7', 'board', 'top-minus-3');
    connect('ic', outputPin, 'resistor', '1');
    connect('resistor', '2', 'output-led', 'anode');
    connect('output-led', 'cathode', 'board', 'top-minus-4');
    connect('scope', 'ch1', 'input-a', 'com');
    connect('scope', 'ch2', 'ic', outputPin);
    connect('scope', 'ref', 'board', 'top-minus-5');
  } else {
    add('panel-board', 'board', 0, 0);
    add('pb-switch', 'stop', 90, 210).label = 'STOP · NC';
    add('pb-switch', 'start', 280, 210).label = 'START · NO';
    add('relay-socket', 'relay', 490, 210);
    add('relay-body', 'body', 599.6, 236.5).mountedSocketId = 'relay';
    components = alignMountedRelays(components);
    add('pilot-lamp', 'lamp', 800, 210);
    connect('board', 'plus', 'stop', 'nc1');
    connect('stop', 'nc2', 'start', 'no1');
    connect('start', 'no2', 'relay', '14');
    connect('stop', 'nc2', 'relay', '5');
    connect('relay', '9', 'relay', '14');
    connect('relay', '13', 'board', 'minus');
    connect('relay', '14', 'lamp', 'plus');
    connect('lamp', 'minus', 'board', 'minus');
  }
  const power = { on: false, voltage: mode === 'sequence' ? 24 : 5 };
  return {
    mode,
    workspace: {
      components,
      wires,
      power,
      simulation: solveCircuit({
        mode,
        components,
        wires,
        power,
        compactBreadboards: true,
      }),
    },
  };
}
