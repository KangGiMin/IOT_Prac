import { expect, it } from 'vitest';
import { sequencePins } from '../../config/sequencePins';
import { UnionFind } from '../../engine/circuitSolver';
import { buildExercise, exercises } from './model';
import type { ExerciseCircuit, Lead } from './model';
import { relayWiring } from './relayWiring';

// These columns are read from the annotated photo, independent of the mapper.
const columns = [
  { a: '5', b: '1', c: '9' },
  { a: '6', b: '2', c: '10' },
  { a: '7', b: '3', c: '11' },
  { a: '8', b: '4', c: '12' },
];

it('places a, b, left +, right − and c on the marked screws', () => {
  const pins = new Map(sequencePins['relay-socket'].pins.map((pin) => [pin.id, pin]));
  const first = pins.get('14')!;
  const second = pins.get('13')!;
  expect(first.position.x).toBeLessThan(second.position.x);
  expect(first.label).toContain('COIL +');
  expect(second.label).toContain('COIL −');
  for (const { a, b, c } of columns) {
    expect(pins.get(a)!.position.y).toBeLessThan(pins.get(b)!.position.y);
    expect(pins.get(b)!.position.y).toBeLessThan(first.position.y);
    expect(pins.get(c)!.position.y).toBeGreaterThan(second.position.y);
    expect(pins.get(a)!.label).toContain('a (NO)');
    expect(pins.get(b)!.label).toContain('b (NC)');
    expect(pins.get(c)!.label).toContain('c (COM)');
  }
  for (const role of ['a', 'b', 'c'] as const) {
    const xs = columns.map((column) => pins.get(column[role])!.position.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  }
});

function wireNets(circuit: ExerciseCircuit, leads: Lead[]) {
  const nets = new UnionFind();
  for (const port of circuit.ports) nets.add(port);
  for (const [a, b] of leads) nets.union(a, b);
  return nets;
}

it.each(exercises)('matches the photographed relay topology in drawing $id', (exercise) => {
  for (const corrected of exercise.correction ? [false, true] : [false]) {
    const circuit = buildExercise(exercise, corrected);
    const { portsByScrew, aliases } = relayWiring(circuit);
    const relays = [...portsByScrew];
    for (const [id, screws] of relays) {
      expect(screws.get('14')).toBe(`${id}:1`);
      expect(screws.get('13')).toBe(`${id}:2`);
      expect(screws.size).toBeLessThanOrEqual(14);
    }
    // Compare every relay state against the schematic using the photograph's
    // four real changeover poles instead of the schematic's logical contacts.
    for (let mask = 0; mask < 2 ** relays.length; mask++) {
      const schematic = wireNets(circuit, circuit.leads);
      const photographed = wireNets(circuit, [...circuit.leads, ...aliases]);
      relays.forEach(([id, screws], index) => {
        const excited = !!(mask & (1 << index));
        for (const part of circuit.parts.filter((p) => p.owner === id)) {
          if (excited !== !!part.nc) schematic.union(`${part.id}:1`, `${part.id}:2`);
        }
        for (const column of columns) {
          const common = screws.get(column.c);
          const contact = screws.get(excited ? column.a : column.b);
          if (common && contact) photographed.union(common, contact);
        }
      });
      // Partition names are arbitrary. Compare membership, not representative IDs.
      const partition = (nets: UnionFind) => {
        const first = new Map<string, string>();
        return circuit.ports.map((port) => {
          const net = nets.find(port);
          if (!first.has(net)) first.set(net, port);
          return first.get(net);
        });
      };
      expect(partition(photographed)).toEqual(partition(schematic));
    }
  }
});
