import { solveCircuit, pinKey, ttlLevel } from './circuitSolver';
import { TTL_MODELS, icModel, gateValue } from '../config/ttlModels';
import type { CircuitWorkspace, LogicMission, PinRef } from '../types/circuit';

export interface MissionBindings {
  a: string;
  b: string;
  led: string;
}
export interface GradeRow {
  a: 0 | 1;
  b?: 0 | 1;
  expected: 0 | 1;
  actual: 0 | 1 | null;
  passed: boolean;
  hints: string[];
}
export interface MissionGrade {
  rows: GradeRow[];
  score: number;
  passed: boolean;
  hints: string[];
}

/** Tests an isolated, powered copy. Never changes the live switches, power, audio or timers. */
export function gradeLogicMission(
  workspace: CircuitWorkspace,
  mission: LogicMission,
  bindings: MissionBindings,
): MissionGrade {
  const rows: GradeRow[] = [];
  const baseHints: string[] = [];
  const switches = workspace.components.filter(
    (c) => c.assetId === 'switch-3pin',
  );
  if (!switches.some((c) => c.id === bindings.a))
    baseHints.push('A 입력용 3핀 스위치를 선택하세요.');
  if (
    mission.inputs === 2 &&
    (!switches.some((c) => c.id === bindings.b) || bindings.a === bindings.b)
  )
    baseHints.push('B 입력에는 A와 다른 3핀 스위치를 선택하세요.');
  const led = workspace.components.find(
    (c) => c.id === bindings.led && c.assetId === 'led-red',
  );
  if (!led) baseHints.push('검증할 출력 LED를 선택하세요.');
  const supplies = workspace.components.filter(
    (c) => c.assetId === 'power-supply',
  );
  if (!supplies.length)
    baseHints.push('5V 파워서플라이를 배치하고 전원 배선을 연결하세요.');
  else if (supplies.every((c) => c.settings.outputEnabled === false))
    baseHints.push('파워서플라이 OUTPUT이 OFF입니다. 출력을 켜세요.');
  for (const truth of mission.truthTable) {
    const hints = [...baseHints];
    const components = structuredClone(workspace.components);
    for (const c of components) {
      if (c.id === bindings.a) c.settings.switchOn = truth.a === 1;
      if (mission.inputs === 2 && c.id === bindings.b)
        c.settings.switchOn = truth.b === 1;
    }
    const result = solveCircuit({
      compactBreadboards: true,
      mode: 'digital',
      components,
      wires: workspace.wires,
      power: { ...workspace.power, on: true },
    });
    hints.push(...result.faults.map((f) => f.message));
    const nets = new Map(
      result.nets.flatMap((net) =>
        net.pins.map((p) => [pinKey(p), net.id] as const),
      ),
    );
    const root = (c: string, p: string) =>
      nets.get(pinKey({ componentId: c, pinId: p }));
    const graph = new Map<string, Set<string>>();
    for (const r of components.filter((c) => c.assetId === 'resistor-330')) {
      const a = root(r.id, '1'),
        b = root(r.id, '2');
      if (!a || !b || a === b) continue;
      if (!graph.has(a)) graph.set(a, new Set());
      if (!graph.has(b)) graph.set(b, new Set());
      graph.get(a)!.add(b);
      graph.get(b)!.add(a);
    }
    const anchors: { net: string; pin: PinRef; gate: boolean }[] = [];
    for (const c of components) {
      const pins =
        c.assetId === 'ic-dip14'
          ? TTL_MODELS[icModel(c)].gates.map((g) => g.output)
          : c.assetId === 'power-supply'
            ? ['plus', 'minus', 'ch2-plus', 'ch2-minus', '5v-plus', '5v-minus']
            : [];
      for (const p of pins) {
        const net = root(c.id, p);
        if (net)
          anchors.push({
            net,
            pin: { componentId: c.id, pinId: p },
            gate: c.assetId === 'ic-dip14',
          });
      }
    }
    const trace = (start: string | undefined) => {
      const distance = new Map<string, number>();
      if (start) distance.set(start, 0);
      const queue = start ? [start] : [];
      for (let i = 0; i < queue.length; i++) {
        // Stop at the first source/driver: unrelated parallel loads must not
        // masquerade as this LED's series resistor or required IC.
        if (anchors.some((a) => a.net === queue[i])) continue;
        for (const next of graph.get(queue[i]) ?? [])
          if (!distance.has(next)) {
            distance.set(next, distance.get(queue[i])! + 1);
            queue.push(next);
          }
      }
      return anchors
        .filter((a) => distance.has(a.net))
        .map((a) => ({ ...a, resistors: distance.get(a.net)! }));
    };
    const known = (p: PinRef) => result.pinValues[pinKey(p)]?.voltage != null;
    const onGate = (id: string) => result.energizedComponents.includes(id);
    if (!result.faults.length) {
      for (const [id, bit, name] of [
        [bindings.a, truth.a, 'A'],
        ...(mission.inputs === 2 ? [[bindings.b, truth.b, 'B'] as const] : []),
      ] as const) {
        const value =
          result.pinValues[pinKey({ componentId: id, pinId: 'com' })];
        if (value?.logic !== bit)
          hints.push(
            `${name} 스위치: 좌측 1번은 0V, 우측 2번은 +5V, COM은 IC 입력에 연결하세요.`,
          );
      }
      if (led) {
        const anode = trace(root(led.id, 'anode')),
          cathode = trace(root(led.id, 'cathode'));
        if (root(led.id, 'anode') === root(led.id, 'cathode'))
          hints.push(
            'LED 양 다리가 같은 Net입니다. 중앙 홈이나 다른 열로 분리하세요.',
          );
        if (
          !anode.some((a) => known(a.pin)) ||
          !cathode.some((a) => known(a.pin))
        )
          hints.push(
            'LED의 전류 경로가 끊겨 있습니다. 출력과 전원 귀환 배선을 확인하세요.',
          );
        if (
          anode.length &&
          cathode.length &&
          !anode.some((a) => cathode.some((k) => k.net !== a.net))
        )
          hints.push(
            'LED 양쪽이 동일한 구동 노드로 되돌아갑니다. 다른 전위의 전원 귀환 경로를 연결하세요.',
          );
        const gates = [...anode, ...cathode].filter((a) => a.gate);
        if (!gates.length)
          hints.push('출력 LED를 논리 게이트 출력 핀에 연결하세요.');
        if (gates.some((a) => !onGate(a.pin.componentId)))
          hints.push(
            '출력 IC의 전원이 연결되지 않았습니다. 14번 VCC(+5V), 7번 GND(0V)를 확인하세요.',
          );
        for (const anchor of gates) {
          const chip = components.find((c) => c.id === anchor.pin.componentId)!;
          const model = icModel(chip),
            gate = TTL_MODELS[model].gates.find(
              (g) => g.output === anchor.pin.pinId,
            )!;
          const ground = result.pinValues[`${chip.id}:7`]?.voltage;
          const values = gate.inputs.map((p) => {
            const v = result.pinValues[`${chip.id}:${p}`]?.voltage;
            return ttlLevel(v == null || ground == null ? null : v - ground);
          });
          if (gateValue(model, values) === 'unknown')
            hints.push(
              `${model} 게이트 입력이 부동 또는 미정입니다. LED가 꺼져 있어도 유효한 LOW로 채점하지 않습니다.`,
            );
        }
        if (![...anode, ...cathode].some((a) => a.resistors > 0))
          hints.push(
            'LED 전류 경로에 330Ω 직렬 저항을 넣으세요. 병렬·미연결 저항은 인정하지 않습니다.',
          );
        if (!gates.some((a) => known(a.pin)))
          hints.push(
            '게이트 출력이 부동 상태입니다. 입력 핀과 IC 전원, 7406 풀업 저항을 확인하세요.',
          );
        const av = result.pinValues[`${led.id}:anode`]?.voltage,
          kv = result.pinValues[`${led.id}:cathode`]?.voltage;
        if (av != null && kv != null && av < kv - 0.5)
          hints.push(
            'LED가 역연결되었습니다. 긴 다리 A(+), 짧은 다리 K(−)를 확인하세요.',
          );
      }
    }
    const actual: 0 | 1 | null = hints.length
      ? null
      : result.energizedComponents.includes(bindings.led)
        ? 1
        : 0;
    const passed = actual === truth.output;
    if (!passed && actual !== null)
      hints.push(
        `LED 출력은 ${actual}, 목표 출력은 ${truth.output}입니다. IC 종류·게이트 핀맵과 중간 단계 배선을 확인하세요.`,
      );
    rows.push({
      a: truth.a,
      b: truth.b,
      expected: truth.output,
      actual,
      passed,
      hints: [...new Set(hints)],
    });
  }
  const score = Math.round(
    (rows.filter((r) => r.passed).length / rows.length) * 100,
  );
  return {
    rows,
    score,
    passed: rows.every((r) => r.passed),
    hints: [...new Set(rows.flatMap((r) => r.hints))],
  };
}
