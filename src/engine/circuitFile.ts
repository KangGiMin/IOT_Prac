import { digitalGeometry } from '../config/digitalPins';
import { componentAssets } from '../config/assets';
import { IC_MODELS } from '../config/ttlModels';
import { solveCircuit } from './circuitSolver';
import { alignMountedRelays } from '../features/workbench/utils/relayMount';
import type {
  CircuitComponent,
  CircuitMode,
  CircuitWorkspace,
  CircuitWire,
} from '../types/circuit';
export const MAX_CIRCUIT_FILE_BYTES = 1_000_000;
export const MAX_CIRCUIT_COMPONENTS = 100;
export const MAX_CIRCUIT_WIRES = 2000;
export interface CircuitFile {
  format: 'iot-circuit-lab';
  version: 1;
  activeMode: CircuitMode;
  workspaces: Record<
    CircuitMode,
    Pick<CircuitWorkspace, 'components' | 'wires' | 'power'>
  >;
}
const fail = (message: string): never => {
  throw new Error(message);
};
const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail('JSON 객체가 필요합니다.');
const number = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
    ? v
    : fail(`숫자는 ${min}~${max} 범위여야 합니다.`);
const text = (v: unknown, max = 80) =>
  typeof v === 'string' && v.length > 0 && v.length <= max
    ? v
    : fail('이름 또는 ID가 올바르지 않습니다.');
const id = (v: unknown) => {
  const s = text(v);
  return /^[A-Za-z0-9_-]+$/.test(s)
    ? s
    : fail('ID에는 영문·숫자·밑줄·하이픈만 사용할 수 있습니다.');
};
const boolean = (v: unknown) =>
  typeof v === 'boolean' ? v : fail('참/거짓 설정이 올바르지 않습니다.');
const savedComponents = (w: CircuitWorkspace) =>
  w.components.map((c) =>
    c.assetId === 'pb-switch' &&
    c.settings.buttonMode !== 'detent' &&
    c.settings.pressed
      ? { ...c, settings: { ...c.settings, pressed: false } }
      : c,
  );
const fileData = (
  mode: CircuitMode,
  workspaces: Record<CircuitMode, CircuitWorkspace>,
): CircuitFile => ({
  format: 'iot-circuit-lab',
  version: 1,
  activeMode: mode,
  workspaces: {
    sequence: {
      components: savedComponents(workspaces.sequence),
      wires: workspaces.sequence.wires,
      power: { ...workspaces.sequence.power, on: false },
    },
    digital: {
      components: savedComponents(workspaces.digital),
      wires: workspaces.digital.wires,
      power: { ...workspaces.digital.power, on: false },
    },
  },
});
const byteLength = (source: string) => new TextEncoder().encode(source).length;
/** Shared by editing and export so the editor cannot outgrow its file format. */
export function circuitCapacityIssue(
  workspaces: Record<CircuitMode, CircuitWorkspace>,
): string | null {
  for (const mode of ['sequence', 'digital'] as const) {
    const w = workspaces[mode];
    if (w.components.length > MAX_CIRCUIT_COMPONENTS)
      return `각 모드의 부품은 ${MAX_CIRCUIT_COMPONENTS}개까지 지원합니다.`;
    if (w.wires.length > MAX_CIRCUIT_WIRES)
      return `각 모드의 전선은 ${MAX_CIRCUIT_WIRES}개까지 지원합니다.`;
  }
  // The longer active-mode name gives an upper bound. Check the compact form;
  // export falls back to it when indentation alone would exceed the limit.
  return byteLength(JSON.stringify(fileData('sequence', workspaces))) >
    MAX_CIRCUIT_FILE_BYTES
    ? '회로 파일은 1MB 이하여야 합니다. 부품이나 전선을 줄여 주세요.'
    : null;
}
export function exportCircuitFile(
  mode: CircuitMode,
  workspaces: Record<CircuitMode, CircuitWorkspace>,
): string {
  const issue = circuitCapacityIssue(workspaces);
  if (issue) fail(issue);
  const data = fileData(mode, workspaces);
  const pretty = JSON.stringify(data, null, 2);
  const source =
    byteLength(pretty) <= MAX_CIRCUIT_FILE_BYTES
      ? pretty
      : JSON.stringify(data);
  // Do not offer a download that the same format's validator cannot read.
  parseCircuitFile(source);
  return source;
}
function parseCircuitFile(source: string): {
  mode: CircuitMode;
  workspaces: CircuitFile['workspaces'];
} {
  if (new TextEncoder().encode(source).length > MAX_CIRCUIT_FILE_BYTES)
    fail('회로 파일은 1MB 이하여야 합니다.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    fail('유효한 JSON 파일이 아닙니다.');
  }
  const doc = object(parsed);
  if (doc.format !== 'iot-circuit-lab' || doc.version !== 1)
    fail('지원하지 않는 회로 파일 형식 또는 버전입니다.');
  const mode = doc.activeMode;
  if (mode !== 'sequence' && mode !== 'digital')
    fail('실습 모드가 올바르지 않습니다.');
  const inputs = object(doc.workspaces),
    workspaces = {} as CircuitFile['workspaces'];
  for (const m of ['sequence', 'digital'] as const) {
    const w = object(inputs[m]);
    if (
      !Array.isArray(w.components) ||
      w.components.length > MAX_CIRCUIT_COMPONENTS ||
      !Array.isArray(w.wires) ||
      w.wires.length > MAX_CIRCUIT_WIRES
    )
      fail(
        `부품은 ${MAX_CIRCUIT_COMPONENTS}개, 전선은 ${MAX_CIRCUIT_WIRES}개까지 지원합니다.`,
      );
    const componentInputs = w.components as unknown[],
      wireInputs = w.wires as unknown[];
    const ids = new Set<string>();
    const components: CircuitComponent[] = componentInputs.map((value) => {
      const c = object(value),
        cid = id(c.id),
        asset = c.assetId;
      if (ids.has(cid)) fail('중복 부품 ID가 있습니다.');
      ids.add(cid);
      if (typeof asset !== 'string' || !Object.hasOwn(componentAssets, asset))
        fail('알 수 없는 부품입니다.');
      const assetId = asset as CircuitComponent['assetId'];
      if (componentAssets[assetId].mode !== m)
        fail('다른 실습 모드의 부품이 포함되어 있습니다.');
      const p = object(c.position),
        s = object(c.settings);
      const settings: CircuitComponent['settings'] = {
        pressed: boolean(s.pressed),
        switchOn: boolean(s.switchOn),
        timerSeconds: number(s.timerSeconds, 0, 10),
        voltage: number(s.voltage, 0, 30),
      };
      for (const k of [
        'openCollector',
        'outputEnabled',
        'scopeRunning',
      ] as const)
        if (s[k] !== undefined) settings[k] = boolean(s[k]);
      if (s.icModel !== undefined) {
        if (!IC_MODELS.includes(s.icModel as (typeof IC_MODELS)[number]))
          fail('지원하지 않는 TTL IC입니다.');
        settings.icModel = s.icModel as (typeof IC_MODELS)[number];
      }
      if (s.buttonMode !== undefined) {
        if (s.buttonMode !== 'momentary' && s.buttonMode !== 'detent')
          fail('버튼 동작이 올바르지 않습니다.');
        settings.buttonMode = s.buttonMode as 'momentary' | 'detent';
      }
      if (assetId === 'pb-switch' && settings.buttonMode !== 'detent')
        settings.pressed = false;
      const result: CircuitComponent = {
        id: cid,
        assetId,
        label: text(c.label, 60),
        position: { x: number(p.x, -1e6, 1e6), y: number(p.y, -1e6, 1e6) },
        settings,
      };
      if (c.mountedSocketId !== undefined)
        result.mountedSocketId = id(c.mountedSocketId);
      if (c.insertion !== undefined) {
        const ins = object(c.insertion);
        result.insertion = {
          boardId: id(ins.boardId),
          bank: number(ins.bank, 0, digitalGeometry.banks.length - 1),
          column: number(ins.column, 1, digitalGeometry.columns - 6),
        };
        if (
          !Number.isInteger(result.insertion.bank) ||
          !Number.isInteger(result.insertion.column)
        )
          fail('IC 삽입 위치는 정수여야 합니다.');
      }
      if (c.displaySize !== undefined) {
        const size = object(c.displaySize);
        result.displaySize = {
          width: number(size.width, 1, 2000),
          height: number(size.height, 1, 2000),
        };
      }
      return result;
    });
    const mounted = new Set<string>(),
      occupied = new Set<string>();
    for (const c of components) {
      if (c.mountedSocketId) {
        if (
          c.assetId !== 'relay-body' ||
          !components.some(
            (s) => s.id === c.mountedSocketId && s.assetId === 'relay-socket',
          ) ||
          mounted.has(c.mountedSocketId)
        )
          fail('릴레이 장착 정보가 올바르지 않습니다.');
        mounted.add(c.mountedSocketId);
      }
      if (c.insertion) {
        const ins = c.insertion;
        if (
          c.assetId !== 'ic-dip14' ||
          !components.some(
            (b) => b.id === ins.boardId && b.assetId === 'breadboard',
          )
        )
          fail('IC 삽입 대상이 올바르지 않습니다.');
        for (let col = ins.column; col < ins.column + 7; col++) {
          const key = `${ins.boardId}:${ins.bank}:${col}`;
          if (occupied.has(key)) fail('IC 삽입 위치가 겹칩니다.');
          occupied.add(key);
        }
      }
    }
    const wireIds = new Set<string>(),
      connections = new Set<string>();
    const wires: CircuitWire[] = wireInputs.map((value) => {
      const w = object(value),
        wid = id(w.id);
      if (wireIds.has(wid)) fail('중복 전선 ID가 있습니다.');
      wireIds.add(wid);
      const endpoint = (v: unknown) => {
        const p = object(v),
          componentId = id(p.componentId),
          pinId = text(p.pinId);
        const c = components.find((c) => c.id === componentId);
        if (
          !c ||
          !componentAssets[c.assetId].pins.some((pin) => pin.id === pinId)
        )
          fail('전선이 존재하지 않는 부품 또는 단자를 참조합니다.');
        return { componentId, pinId };
      };
      const from = endpoint(w.from),
        to = endpoint(w.to),
        a = `${from.componentId}:${from.pinId}`,
        b = `${to.componentId}:${to.pinId}`,
        key = [a, b].sort().join('|');
      if (a === b || connections.has(key))
        fail('자기 연결 또는 중복 전선이 있습니다.');
      connections.add(key);
      if (
        !['#dc4c4c', '#303b48', '#3780d5', '#159477', '#e3ac32'].includes(
          String(w.color),
        )
      )
        fail('전선 색상이 올바르지 않습니다.');
      if (w.kind !== undefined && w.kind !== 'clip' && w.kind !== 'jumper')
        fail('전선 종류가 올바르지 않습니다.');
      return {
        id: wid,
        from,
        to,
        color: w.color as CircuitWire['color'],
        ...(w.kind ? { kind: w.kind as CircuitWire['kind'] } : {}),
      };
    });
    const power = {
      on: false,
      voltage: number(object(w.power).voltage, 0, 30),
    };
    workspaces[m] = {
      components,
      wires,
      power,
    };
  }
  return { mode: mode as CircuitMode, workspaces };
}

export function importCircuitFile(source: string): {
  mode: CircuitMode;
  workspaces: Record<CircuitMode, CircuitWorkspace>;
} {
  const data = parseCircuitFile(source);
  const hydrate = (mode: CircuitMode): CircuitWorkspace => {
    const saved = data.workspaces[mode];
    const w = mode === 'sequence' ? { ...saved, components: alignMountedRelays(saved.components) } : saved;
    return {
      ...w,
      simulation: solveCircuit({ ...w, mode, compactBreadboards: true }),
    };
  };
  return {
    mode: data.mode,
    workspaces: { sequence: hydrate('sequence'), digital: hydrate('digital') },
  };
}
