import { relay14 } from '../../config/sequencePins';
import { UnionFind } from '../../engine/circuitSolver';
import type { ExerciseCircuit, Lead } from './model';

export interface RelayScrew {
  relay: string;
  number: string;
  role: 'a' | 'b' | 'c' | '+' | '−';
}

interface Contact {
  nets: Lead;
  ports: Lead[];
}

/** Find the largest set of NO/NC pairs whose common ends are on the same net. */
function matchPoles(normallyOpen: Contact[], normallyClosed: Contact[]) {
  const pairs = new Map<Contact, Contact>();
  const match = (open: Contact, visited: Set<Contact>): boolean => {
    for (const closed of normallyClosed) {
      if (visited.has(closed) || !closed.nets.some((net) => open.nets.includes(net))) continue;
      visited.add(closed);
      const previous = pairs.get(closed);
      if (previous && !match(previous, visited)) continue;
      pairs.set(closed, open);
      return true;
    }
    return false;
  };
  for (const open of normallyOpen) match(open, new Set());
  return new Map([...pairs].map(([closed, open]) => [open, closed]));
}

export function relayWiring(circuit: ExerciseCircuit) {
  const nets = new UnionFind();
  for (const port of circuit.ports) nets.add(port);
  for (const [a, b] of circuit.leads) nets.union(a, b);
  const screws = new Map<string, RelayScrew>();
  const portsByScrew = new Map<string, Map<string, string>>();
  const aliases: Lead[] = [];
  const canonical = new Map<string, string>();

  for (const { id } of circuit.parts.filter((part) => part.kind === 'relay')) {
    const portsByNumber = new Map<string, string>();
    portsByScrew.set(id, portsByNumber);
    const assign = (port: string, number: string, role: RelayScrew['role']) => {
      screws.set(port, { relay: id, number, role });
      const first = portsByNumber.get(number);
      if (first) {
        aliases.push([first, port]);
        canonical.set(port, first);
      } else {
        portsByNumber.set(number, port);
      }
    };
    assign(`${id}:1`, relay14.coil.plus, '+');
    assign(`${id}:2`, relay14.coil.minus, '−');

    const open = new Map<string, Contact>();
    const closed = new Map<string, Contact>();
    for (const part of circuit.parts.filter((part) => part.owner === id)) {
      const first = `${part.id}:1`;
      const second = `${part.id}:2`;
      const ends: Lead = nets.find(first) <= nets.find(second) ? [first, second] : [second, first];
      const endpoints: Lead = [nets.find(ends[0]), nets.find(ends[1])];
      const key = JSON.stringify(endpoints);
      const groups = part.nc ? closed : open;
      const existing = groups.get(key);
      if (existing) existing.ports.push(ends);
      else groups.set(key, { nets: endpoints, ports: [ends] });
    }

    const pairs = matchPoles([...open.values()], [...closed.values()]);
    const pairedClosed = new Set(pairs.values());
    const poles = [
      ...[...open.values()].map((a) => ({ a, b: pairs.get(a) })),
      ...[...closed.values()].filter((b) => !pairedClosed.has(b)).map((b) => ({ a: undefined, b })),
    ];
    if (poles.length > relay14.poles.length)
      throw new Error(`${id} uses ${poles.length} poles, exceeding the 14-pin relay capacity.`);
    poles.forEach(({ a, b }, index) => {
      const pin = relay14.poles[index];
      const common = a?.nets.find((net) => b?.nets.includes(net)) ?? (a ?? b)!.nets[0];
      for (const [contact, role, number] of [
        [a, 'a', pin.no],
        [b, 'b', pin.nc],
      ] as const) {
        if (!contact) continue;
        const commonIndex = contact.nets[0] === common ? 0 : 1;
        for (const ends of contact.ports) {
          assign(ends[commonIndex], pin.com, 'c');
          assign(ends[1 - commonIndex], number, role);
        }
      }
    });
  }
  return { screws, portsByScrew, aliases, canonical };
}

export type RelayWiring = ReturnType<typeof relayWiring>;

export function relayScrewLabel({ relay, number, role }: RelayScrew): string {
  return role === '+' || role === '−'
    ? `${relay} 코일 ${role} (${number}번 나사)`
    : `${relay} ${number}번 나사 · ${role}${role === 'c' ? ' 공통' : ' 접점'}`;
}
