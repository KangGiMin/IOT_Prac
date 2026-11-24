import { deviceDefinitions } from '../../../components/devices/definitions';
import type { CircuitComponent, CircuitNode, CircuitWire, PinRef, ShortCircuitState } from '../../../types/circuit';

const key = (ref: PinRef) => `${ref.componentId}:${ref.pinId}`;
/** Connectivity only: resistance, contacts and logic gates belong to the future solver. */
export function buildTopology(components: CircuitComponent[], wires: CircuitWire[]): { nodes: CircuitNode[]; shortCircuit: ShortCircuitState } {
  const parents = new Map<string, string>();
  const refs = new Map<string, PinRef>();
  const find = (id: string): string => {
    const parent = parents.get(id)!;
    if (parent === id) return id;
    const root = find(parent); parents.set(id, root); return root;
  };
  const join = (a: string, b: string) => { if (parents.has(a) && parents.has(b)) parents.set(find(a), find(b)); };
  for (const component of components) {
    const buses = new Map<string, string>();
    for (const pin of deviceDefinitions[component.assetId].pins) {
      const ref = { componentId: component.id, pinId: pin.id };
      const id = key(ref); parents.set(id, id); refs.set(id, ref);
      if (pin.bus) {
        const previous = buses.get(pin.bus);
        if (previous) join(previous, id); else buses.set(pin.bus, id);
      }
    }
  }
  for (const wire of wires) join(key(wire.from), key(wire.to));
  const groups = new Map<string, PinRef[]>();
  for (const [id, ref] of refs) { const root = find(id); groups.set(root, [...groups.get(root) ?? [], ref]); }
  const nodes: CircuitNode[] = Array.from(groups, ([id, pins]) => ({ id, pins, voltage: null, logic: 'unknown' }));
  for (const source of components.filter((item) => item.assetId === 'power-supply')) {
    const plus = key({ componentId: source.id, pinId: 'plus' });
    const minus = key({ componentId: source.id, pinId: 'minus' });
    if (find(plus) === find(minus)) return { nodes, shortCircuit: { status: 'short', involvedPins: groups.get(find(plus)) ?? [], message: `${source.label}의 + / − 단자가 같은 노드에 직접 연결되어 있습니다.` } };
  }
  return { nodes, shortCircuit: { status: 'clear', involvedPins: [], message: null } };
}
