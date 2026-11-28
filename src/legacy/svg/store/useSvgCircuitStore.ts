import { create } from 'zustand';
import { deviceDefinitions } from '../devices/definitions';
import { createSvgWorkspace, makeSvgComponent } from '../data/svgCircuits';
import { buildTopology } from '../utils/topology';
import { MAX_ZOOM, MIN_ZOOM, pinPosition, samePin } from '../utils/svgGeometry';
import type {
  AssetId,
  CircuitComponent,
  CircuitMode,
  PinRef,
  Point,
  WireColor,
} from '../../../types/circuit';
import type { CircuitLog, MissionResult, SvgWorkspace, Viewport } from '../types.ts';
export interface SvgCircuitState {
  mode: CircuitMode;
  workspaces: Record<CircuitMode, SvgWorkspace>;
  selectedId: string | null;
  selectedWireId: string | null;
  pendingPin: PinRef | null;
  wireColor: WireColor;
  notice: string;
  setMode: (mode: CircuitMode) => void;
  select: (id: string | null) => void;
  selectWire: (id: string | null) => void;
  setWireColor: (color: WireColor) => void;
  setViewport: (viewport: Viewport) => void;
  togglePower: () => void;
  toggleRunning: () => void;
  addComponent: (assetId: AssetId, position?: Point) => void;
  moveComponent: (id: string, position: Point) => void;
  renameComponent: (id: string, label: string) => void;
  updateSettings: (id: string, settings: Partial<CircuitComponent['settings']>) => void;
  setPendingPin: (ref: PinRef | null) => void;
  connect: (from: PinRef, to: PinRef) => void;
  deleteSelection: () => void;
  reset: () => void;
  gradeMission: () => void;
  clearLogs: () => void;
}
const log = (message: string, level: CircuitLog['level'] = 'info'): CircuitLog => ({
  id: crypto.randomUUID(),
  message,
  level,
  timestamp: Date.now(),
});
const editLocked = (workspace: SvgWorkspace) =>
  workspace.power.on || workspace.simulation.status === 'running';
function checked(workspace: SvgWorkspace): SvgWorkspace {
  const { nodes, shortCircuit } = buildTopology(workspace.components, workspace.wires);
  const newlyShort =
    shortCircuit.status === 'short' && workspace.simulation.shortCircuit.status !== 'short';
  return {
    ...workspace,
    nodes,
    missionResult: null,
    logs: newlyShort
      ? [...workspace.logs, log(shortCircuit.message!, 'error')].slice(-50)
      : workspace.logs,
    simulation: {
      ...workspace.simulation,
      shortCircuit,
      pinValues: {},
      energizedComponents: [],
    },
  };
}
export const useSvgCircuitStore = create<SvgCircuitState>()((set) => ({
  mode: 'sequence',
  workspaces: {
    sequence: createSvgWorkspace('sequence'),
    digital: createSvgWorkspace('digital'),
  },
  selectedId: null,
  selectedWireId: null,
  pendingPin: null,
  wireColor: '#dc4c4c',
  notice: '단자를 차례로 클릭해 전선을 연결하세요.',
  setMode: (mode) =>
    set({
      mode,
      selectedId: null,
      selectedWireId: null,
      pendingPin: null,
      notice: '실습 모드를 전환했습니다. 각 작업대의 상태는 유지됩니다.',
    }),
  select: (selectedId) => set({ selectedId, selectedWireId: null }),
  selectWire: (selectedWireId) => set({ selectedWireId, selectedId: null, pendingPin: null }),
  setWireColor: (wireColor) => set({ wireColor }),
  setViewport: (viewport) =>
    set((s) => {
      if (![viewport.x, viewport.y, viewport.zoom].every(Number.isFinite)) return s;
      return {
        workspaces: {
          ...s.workspaces,
          [s.mode]: {
            ...s.workspaces[s.mode],
            viewport: {
              ...viewport,
              zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom)),
            },
          },
        },
      };
    }),
  togglePower: () =>
    set((s) => {
      const w = checked(s.workspaces[s.mode]);
      if (!w.power.on && w.simulation.shortCircuit.status === 'short')
        return {
          workspaces: { ...s.workspaces, [s.mode]: w },
          notice: '전원 투입 차단: + / − 직접 단락을 해소하세요.',
        };
      const on = !w.power.on;
      return {
        workspaces: {
          ...s.workspaces,
          [s.mode]: {
            ...w,
            power: { ...w.power, on },
            simulation: { ...w.simulation, status: 'not-connected' },
          },
        },
        pendingPin: null,
        notice: on
          ? '메인 전원 ON · 배선 편집이 잠겼습니다.'
          : '메인 전원 OFF · 배선을 편집할 수 있습니다.',
      };
    }),
  toggleRunning: () =>
    set((s) => {
      const w = s.workspaces[s.mode];
      if (w.simulation.status === 'running')
        return {
          workspaces: {
            ...s.workspaces,
            [s.mode]: {
              ...w,
              simulation: { ...w.simulation, status: 'not-connected' },
            },
          },
          notice: '실행을 정지했습니다.',
        };
      if (!w.power.on) return { notice: '메인 전원을 먼저 켜세요.' };
      const next = checked(w);
      if (next.simulation.shortCircuit.status === 'short')
        return { notice: '단락 상태에서는 실행할 수 없습니다.' };
      return {
        workspaces: {
          ...s.workspaces,
          [s.mode]: {
            ...next,
            simulation: { ...next.simulation, status: 'running' },
            logs: [
              ...next.logs,
              log('실행 UI 활성화. 전기 해석 엔진은 다음 단계에서 연결됩니다.'),
            ].slice(-50),
          },
        },
        notice: '실행 상태 · 전기 해석 엔진 연결 대기 중입니다.',
      };
    }),
  addComponent: (assetId, position) =>
    set((s) => {
      const w = s.workspaces[s.mode];
      const definition = deviceDefinitions[assetId];
      if (editLocked(w) || !definition.modes.includes(s.mode)) return s;
      const id = crypto.randomUUID();
      const point = position ?? {
        x: 80 + (w.components.length % 5) * 45,
        y: 80 + (w.components.length % 4) * 45,
      };
      if (![point.x, point.y].every(Number.isFinite)) return s;
      const component = makeSvgComponent(assetId, id, point.x, point.y, w.power.voltage);
      return {
        workspaces: {
          ...s.workspaces,
          [s.mode]: checked({ ...w, components: [...w.components, component] }),
        },
        selectedId: id,
        selectedWireId: null,
        notice: definition.label + ' 부품을 배치했습니다.',
      };
    }),
  moveComponent: (id, position) =>
    set((s) => {
      const w = s.workspaces[s.mode];
      if (editLocked(w) || ![position.x, position.y].every(Number.isFinite)) return s;
      return {
        workspaces: {
          ...s.workspaces,
          [s.mode]: {
            ...w,
            components: w.components.map((c) => (c.id === id ? { ...c, position } : c)),
          },
        },
      };
    }),
  renameComponent: (id, label) =>
    set((s) => {
      const w = s.workspaces[s.mode];
      if (editLocked(w)) return s;
      return {
        workspaces: {
          ...s.workspaces,
          [s.mode]: {
            ...w,
            components: w.components.map((c) =>
              c.id === id ? { ...c, label: label.slice(0, 60) } : c,
            ),
          },
        },
      };
    }),
  updateSettings: (id, settings) =>
    set((s) => {
      const w = s.workspaces[s.mode];
      if (editLocked(w)) return s;
      const safe = { ...settings };
      if (safe.timerSeconds !== undefined)
        safe.timerSeconds = Number.isFinite(safe.timerSeconds)
          ? Math.max(0, Math.min(10, safe.timerSeconds))
          : 3;
      if (safe.voltage !== undefined)
        safe.voltage = Number.isFinite(safe.voltage) ? Math.max(0, Math.min(30, safe.voltage)) : 5;
      return {
        workspaces: {
          ...s.workspaces,
          [s.mode]: checked({
            ...w,
            components: w.components.map((c) =>
              c.id === id ? { ...c, settings: { ...c.settings, ...safe } } : c,
            ),
          }),
        },
      };
    }),
  setPendingPin: (pendingPin) =>
    set((s) => (editLocked(s.workspaces[s.mode]) ? s : { pendingPin })),
  connect: (from, to) =>
    set((s) => {
      const w = s.workspaces[s.mode];
      if (editLocked(w)) return s;
      if (samePin(from, to)) return { pendingPin: null };
      if (!pinPosition(w.components, from) || !pinPosition(w.components, to))
        return {
          pendingPin: null,
          notice: '존재하지 않는 단자는 연결할 수 없습니다.',
        };
      if (
        w.wires.some(
          (wire) =>
            (samePin(wire.from, from) && samePin(wire.to, to)) ||
            (samePin(wire.from, to) && samePin(wire.to, from)),
        )
      )
        return { pendingPin: null, notice: '이미 연결된 단자입니다.' };
      const next = checked({
        ...w,
        wires: [...w.wires, { id: crypto.randomUUID(), from, to, color: s.wireColor }],
      });
      return {
        workspaces: { ...s.workspaces, [s.mode]: next },
        pendingPin: null,
        notice:
          next.simulation.shortCircuit.message ??
          '배선을 연결했습니다. 전선을 선택하면 삭제할 수 있습니다.',
      };
    }),
  deleteSelection: () =>
    set((s) => {
      const w = s.workspaces[s.mode];
      if (editLocked(w)) return s;
      return {
        workspaces: {
          ...s.workspaces,
          [s.mode]: checked({
            ...w,
            components: w.components.filter((c) => c.id !== s.selectedId),
            wires: w.wires.filter(
              (wire) =>
                wire.id !== s.selectedWireId &&
                wire.from.componentId !== s.selectedId &&
                wire.to.componentId !== s.selectedId,
            ),
          }),
        },
        selectedId: null,
        selectedWireId: null,
        pendingPin: null,
        notice: '선택 항목과 연결된 배선을 삭제했습니다.',
      };
    }),
  reset: () =>
    set((s) => {
      if (editLocked(s.workspaces[s.mode])) return s;
      return {
        workspaces: { ...s.workspaces, [s.mode]: createSvgWorkspace(s.mode) },
        selectedId: null,
        selectedWireId: null,
        pendingPin: null,
        notice: '현재 작업대를 기본 배치로 초기화했습니다.',
      };
    }),
  gradeMission: () =>
    set((s) => {
      const w = checked(s.workspaces[s.mode]);
      const target = s.mode === 'sequence' ? 'pilot-lamp' : 'led-red';
      const targetIds = w.components.filter((c) => c.assetId === target).map((c) => c.id);
      const reachesSource = (componentId: string, pinId: string) =>
        w.nodes.some(
          (node) =>
            node.pins.some((p) => p.componentId === componentId) &&
            node.pins.some(
              (ref) =>
                ref.pinId === pinId &&
                w.components.some((c) => c.id === ref.componentId && c.assetId === 'power-supply'),
            ),
        );
      const checks = [
        {
          label: '전원과 표시 부품 배치',
          passed: !!targetIds.length && w.components.some((c) => c.assetId === 'power-supply'),
        },
        {
          label: '표시 부품에 + / − 노드 연결',
          passed: targetIds.some((id) => reachesSource(id, 'plus') && reachesSource(id, 'minus')),
        },
        {
          label: '전원 + / − 직접 단락 없음',
          passed: w.simulation.shortCircuit.status === 'clear',
        },
      ];
      const missionResult: MissionResult = {
        checks,
        score: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100),
        scope: 'wiring-only',
      };
      return {
        workspaces: {
          ...s.workspaces,
          [s.mode]: {
            ...w,
            missionResult,
            logs: [
              ...w.logs,
              log(
                '배선 구조 점검 ' +
                  missionResult.score +
                  '점 · 접점 동작과 전류는 평가하지 않습니다.',
              ),
            ].slice(-50),
          },
        },
        notice: '배선 구조를 점검했습니다. 전기 동작 채점은 다음 단계입니다.',
      };
    }),
  clearLogs: () =>
    set((s) => ({
      workspaces: {
        ...s.workspaces,
        [s.mode]: { ...s.workspaces[s.mode], logs: [] },
      },
    })),
}));
