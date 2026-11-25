import { describe, expect, it } from 'vitest';
import { IC_MODELS, TTL_MODELS, type IcModel } from '../config/ttlModels';
import { breadboardPinById, digitalPins, insertedPins } from '../config/digitalPins';
import { componentAssets } from '../config/assets';
import { getSupplySettings } from '../config/supplySettings';
import { makeComponent } from '../features/workbench/data/photoCircuits';
import { solveCircuit, type CircuitSolverInput } from './circuitSolver';
import { breadboardPoint, placeDigital } from '../features/workbench/utils/digitalPlacement';
import { scopeLevel } from '../features/workbench/components/ScopeScreen';
import type { CircuitWire } from '../types/circuit';
const make = (asset: Parameters<typeof makeComponent>[0], id: string) =>
  makeComponent(asset, id, 0, 0);
const wire = (a: string, ap: string, b: string, bp: string): CircuitWire => ({
  id: `${a}${ap}-${b}${bp}`,
  from: { componentId: a, pinId: ap },
  to: { componentId: b, pinId: bp },
  color: '#dc4c4c',
});
const input = (model: IcModel): CircuitSolverInput => ({
  mode: 'digital',
  power: { on: true, voltage: 5 },
  components: [
    make('power-supply', 'ps'),
    {
      ...make('ic-dip14', 'ic'),
      settings: { ...make('ic-dip14', 'ic').settings, icModel: model },
    },
  ],
  wires: [wire('ps', 'plus', 'ic', '14'), wire('ps', 'minus', 'ic', '7')],
});
const expected = (model: IcModel, v: number[]) =>
  model === '7400'
    ? Number(!v.every(Boolean))
    : model === '7402'
      ? Number(!v.some(Boolean))
      : model === '7406'
        ? 1 - v[0]
        : model === '7486'
          ? v.reduce((a, b) => a + b, 0) % 2
          : Number(v.every(Boolean));

describe('plug-in parts and front-panel supply settings', () => {
  it('uses the mounted leads as real electrical connections', () => {
    const ps = make('power-supply', 'ps');
    const board = make('breadboard', 'board');
    const resistor = make('resistor-330', 'r');
    const switchPart = make('switch-3pin', 's');
    const dropAt = (part: typeof resistor, pin: string) => {
      const hole = breadboardPoint(board, breadboardPinById.get(pin)!.position);
      const frame = componentAssets[part.assetId].size;
      return { ...part, position: { x: hole.x - frame.width / 2, y: hole.y - frame.height / 2 } };
    };
    let components = placeDigital([ps, board, dropAt(resistor, 'a13'), dropAt(switchPart, 'd12')], 'r');
    components = placeDigital(components, 's');
    expect(insertedPins(components[2])).toMatchObject({
      '1': { pinId: 'a11' }, '2': { pinId: 'a15' },
    });
    expect(insertedPins(components[3])).toMatchObject({
      '1': { pinId: 'd11' }, com: { pinId: 'd12' }, '2': { pinId: 'd13' },
    });
    const request: CircuitSolverInput = {
      ...input('7400'), components, compactBreadboards: true,
      wires: [wire('ps', 'plus', 'board', 'c12'), wire('ps', 'minus', 'board', 'b15')],
    };
    expect(solveCircuit(request).componentCurrents?.r).toBeCloseTo(5 / 330);
    components[3].settings.switchOn = true;
    expect(solveCircuit(request).componentCurrents?.r).toBeCloseTo(0);
  });

  it('regulates channel current, follows the auxiliary selector and tracks series/parallel channels', () => {
    const supply = make('power-supply', 'ps');
    const resistor = make('resistor-330', 'r');
    supply.settings.supply = { ...getSupplySettings(), ch2Voltage: 8, ch2Limit: .01, auxiliaryVoltage: 3.3 };
    const request: CircuitSolverInput = {
      ...input('7400'), components: [supply, resistor],
      wires: [wire('ps', 'ch2-plus', 'r', '1'), wire('ps', 'ch2-minus', 'r', '2')],
    };
    const limited = solveCircuit(request);
    expect(limited.pinValues['ps:ch2-plus'].voltage).toBeCloseTo(3.3);
    expect(limited.sourceCurrents?.['ps:ch2-plus']).toBeCloseTo(.01, 5);
    expect(limited.limitedOutputs).toContain('ps:ch2-plus');
    expect(limited.pinValues['ps:5v-plus'].voltage).toBe(3.3);
    supply.settings.supply = { ...supply.settings.supply, ch2Limit: 3, tracking: 'series' };
    request.wires[0] = wire('ps', 'plus', 'r', '1');
    const series = solveCircuit(request);
    expect(series.pinValues['ps:plus'].voltage).toBe(10);
    expect(series.pinValues['ps:minus'].voltage).toBe(5);
    expect(series.sourceCurrents?.['ps:ch2-plus']).toBeCloseTo(10 / 330);
    supply.settings.supply.tracking = 'parallel';
    const parallel = solveCircuit(request);
    expect(parallel.pinValues['ps:ch2-plus'].voltage).toBe(5);
    expect(parallel.sourceCurrents?.['ps:plus']).toBeCloseTo(5 / 660);
    expect(parallel.sourceCurrents?.['ps:ch2-plus']).toBeCloseTo(5 / 660);
  });
});

describe('six exact TTL pin maps and gate behavior', () => {
  const required = {
    '7400': ['1,2>3', '4,5>6', '9,10>8', '12,13>11'],
    '7402': ['2,3>1', '5,6>4', '8,9>10', '11,12>13'],
    '7406': ['1>2', '3>4', '5>6', '9>8', '11>10', '13>12'],
    '7408': ['1,2>3', '4,5>6', '9,10>8', '12,13>11'],
    '7411': ['1,2,13>12', '3,4,5>6', '9,10,11>8'],
    '7486': ['1,2>3', '4,5>6', '9,10>8', '12,13>11'],
  };
  for (const model of IC_MODELS) {
    it(`${model} uses every specified input/output pin`, () =>
      expect(
        TTL_MODELS[model].gates.map((g) => g.inputs.join(',') + '>' + g.output),
      ).toEqual(required[model]));
    TTL_MODELS[model].gates.forEach((gate, index) => {
      for (let bits = 0; bits < 2 ** gate.inputs.length; bits++)
        it(`${model} gate ${index + 1} truth vector ${bits}`, () => {
          const request = input(model),
            values = gate.inputs.map((_, i) => (bits >> i) & 1);
          gate.inputs.forEach((pin, i) =>
            request.wires.push(
              wire('ps', values[i] ? 'plus' : 'minus', 'ic', pin),
            ),
          );
          const result = solveCircuit(request);
          expect(result.faults).toEqual([]);
          expect(result.pinValues['ic:' + gate.output].logic).toBe(
            expected(model, values),
          );
        });
    });
  }
  it('7402 flags output collisions on pins 1 and 4 instead of the NAND output map', () => {
    const request = input('7402');
    request.wires.push(wire('ic', '1', 'ic', '4'));
    expect(solveCircuit(request).faults.map((f) => f.code)).toContain(
      'OUTPUT_CONFLICT',
    );
  });
  it('7411 pin 13 remains an input and pin 12 is its first output', () => {
    const request = input('7411');
    request.wires.push(
      wire('ps', 'plus', 'ic', '13'),
      wire('ps', 'plus', 'ic', '1'),
      wire('ps', 'plus', 'ic', '2'),
    );
    expect(solveCircuit(request).pinValues['ic:12'].logic).toBe(1);
  });
});
describe('7406 open collector', () => {
  it('releases HIGH, requires external pullup, and sinks LOW', () => {
    const request = input('7406');
    request.components[1].settings.openCollector = true;
    request.wires.push(wire('ps', 'minus', 'ic', '1'));
    expect(solveCircuit(request).pinValues['ic:2'].voltage).toBeNull();
    request.components.push(make('resistor-330', 'r'));
    request.wires.push(wire('ps', 'plus', 'r', '1'), wire('r', '2', 'ic', '2'));
    expect(solveCircuit(request).pinValues['ic:2'].logic).toBe(1);
    request.wires = request.wires.filter(
      (w) => w.to.pinId !== '1' || w.to.componentId !== 'ic',
    );
    request.wires.push(wire('ps', 'plus', 'ic', '1'));
    const low = solveCircuit(request);
    expect(low.isShorted).toBe(false);
    expect(low.pinValues['ic:2'].logic).toBe(0);
    expect(low.sourceCurrents?.['ps:plus']).toBeCloseTo(5 / 330);
  });
  it('allows multiple open collector sinks on a common pulled-up net', () => {
    const request = input('7406');
    request.components[1].settings.openCollector = true;
    request.components.push(make('resistor-330', 'r'));
    request.wires.push(
      wire('ic', '2', 'ic', '4'),
      wire('ps', 'plus', 'ic', '1'),
      wire('ps', 'minus', 'ic', '3'),
      wire('ps', 'plus', 'r', '1'),
      wire('r', '2', 'ic', '2'),
    );
    const result = solveCircuit(request);
    expect(result.isShorted).toBe(false);
    expect(result.pinValues['ic:4'].logic).toBe(0);
  });
});
describe('digital board and instruments', () => {
  it('includes current supplied through a HIGH logic output in the power reading', () => {
    const request = input('7408');
    request.components.push(make('resistor-330', 'r'), make('led-red', 'led'));
    request.wires.push(
      wire('ps', 'plus', 'ic', '1'),
      wire('ps', 'plus', 'ic', '2'),
      wire('ic', '3', 'r', '1'),
      wire('r', '2', 'led', 'anode'),
      wire('led', 'cathode', 'ps', 'minus'),
    );
    const result = solveCircuit(request);
    expect(result.isShorted).toBe(false);
    expect(result.sourceCurrents?.['ps:plus']).toBeCloseTo(
      result.componentCurrents.led,
      6,
    );
  });
  it('keeps posts isolated and upper/lower banks separated', () => {
    const request = input('7400');
    request.components.push(make('breadboard', 'bb'));
    const result = solveCircuit(request),
      net = (pin: string) =>
        result.nets.find((n) =>
          n.pins.some((p) => p.componentId === 'bb' && p.pinId === pin),
        )?.id;
    expect(net('post-gnd')).not.toBe(net('post-va'));
    expect(net('post-gnd')).not.toBe(net('top-minus-1'));
    expect(net('a1')).toBe(net('e1'));
    expect(net('a1')).not.toBe(net('f1'));
    expect(net('a1')).not.toBe(net('bank2-a1'));
    expect(
      digitalPins.breadboard.pins.every(
        (p) =>
          p.position.x >= 0 &&
          p.position.x <= 100 &&
          p.position.y >= 0 &&
          p.position.y <= 100,
      ),
    ).toBe(true);
  });
  it('snaps DIP-14 across the center and merges all 14 legs with actual holes', () => {
    const board = make('breadboard', 'bb'),
      ic = { ...make('ic-dip14', 'ic'), position: { x: 220, y: 45 } };
    const placed = placeDigital([board, ic], 'ic'),
      chip = placed[1];
    expect(chip.insertion).toBeDefined();
    expect(chip.displaySize!.width).toBeLessThan(100);
    const result = solveCircuit({
      mode: 'digital',
      components: placed,
      wires: [],
      power: { on: true, voltage: 5 },
    });
    for (const [pin, target] of Object.entries(insertedPins(chip))) {
      const net = result.nets.find((n) =>
        n.pins.some((p) => p.componentId === 'ic' && p.pinId === pin),
      );
      expect(net?.pins).toContainEqual(target);
    }
    const moved = placeDigital(
      [board, { ...chip, position: { x: 1000, y: 1000 } }],
      'ic',
    )[1];
    expect(moved.insertion).toBeUndefined();
  });
  it('measures load current and cuts supply voltage/current on OUTPUT OFF or short', () => {
    const request = input('7400');
    request.components.push(make('resistor-330', 'r'));
    request.wires.push(
      wire('ps', 'plus', 'r', '1'),
      wire('ps', 'minus', 'r', '2'),
    );
    expect(solveCircuit(request).sourceCurrents?.['ps:plus']).toBeCloseTo(
      5 / 330,
    );
    request.components[0].settings.outputEnabled = false;
    const off = solveCircuit(request);
    expect(off.pinValues['ps:plus'].voltage).toBeNull();
    expect(off.sourceCurrents?.['ps:plus']).toBe(0);
    request.components[0].settings.outputEnabled = true;
    request.wires.push(wire('ps', 'plus', 'ps', 'minus'));
    const fault = solveCircuit(request);
    expect(fault.isShorted).toBe(true);
    expect(fault.sourceCurrents).toEqual({});
  });
  it('provides CH2 and fixed 5V outputs with independent Net identities', () => {
    const r = solveCircuit(input('7400'));
    expect(r.pinValues['ps:ch2-plus'].voltage).toBe(5);
    expect(r.pinValues['ps:5v-plus'].voltage).toBe(5);
    expect(r.pinValues['ps:gnd'].voltage).toBeNull();
  });
  it('samples scope probes from actual connected nodes and preserves floating gaps', () => {
    const request = input('7408');
    request.components.push(make('oscilloscope', 'scope'));
    request.wires.push(
      wire('ps', 'minus', 'scope', 'ch1'),
      wire('ps', 'plus', 'scope', 'ch2'),
    );
    const r = solveCircuit(request);
    expect(scopeLevel(r.pinValues['scope:ch1'].voltage)).toBe(0);
    expect(scopeLevel(r.pinValues['scope:ch2'].voltage)).toBe(5);
    expect(scopeLevel(null)).toBeNull();
    expect(scopeLevel(1.5)).toBeNull();
  });
});
