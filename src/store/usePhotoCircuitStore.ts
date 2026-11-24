import { createPreset, type PresetId } from '../features/workbench/data/presets';
import { importCircuitFile } from '../engine/circuitFile';
import { placeDigital } from '../features/workbench/utils/digitalPlacement';
import type { IcModel } from '../config/ttlModels';
import { placeSequence } from '../features/workbench/utils/sequencePlacement';
import { create } from 'zustand';
import { componentAssets } from '../config/assets';
import { createPhotoWorkspace, makeComponent } from '../features/workbench/data/photoCircuits';
import { solveCircuit } from '../engine/circuitSolver';
import type { AssetId, CalibrationSample, CircuitComponent, CircuitMode, CircuitWorkspace, PinRef, Point, WireColor } from '../types/circuit';

const evaluate = (workspace: CircuitWorkspace, mode: CircuitMode): CircuitWorkspace => ({
  ...workspace, simulation: solveCircuit({ ...workspace, mode, previous: workspace.simulation }),
});

type Snapshot=Pick<CircuitWorkspace,'components'|'wires'|'power'>;
const snapshot=(w:CircuitWorkspace):Snapshot=>structuredClone({components:w.components,wires:w.wires,power:w.power});
const same=(a:Snapshot,b:Snapshot)=>JSON.stringify(a)===JSON.stringify(b);
interface CircuitState {
  histories:Record<CircuitMode,{past:Snapshot[];future:Snapshot[]}>;
  dragHistory:{mode:CircuitMode;before:Snapshot}|null;
  beginDrag:(id:string)=>void;
  undo:()=>void;
  redo:()=>void;
  loadPreset:(id:PresetId)=>void;
  importJson:(source:string)=>void;

  mode: CircuitMode;
  workspaces: Record<CircuitMode, CircuitWorkspace>;
  selectedId: string | null;
  selectedWireId: string | null;
  wireColor: WireColor;
  wireKind: 'jumper'|'clip';
  setWireKind: (kind:'jumper'|'clip')=>void;
  wiringMode: boolean;
  setWiringMode: (value: boolean) => void;
  finishDrag: (id: string) => void;
  tick: (nowMs: number) => void;
  calibration: boolean;
  sample: CalibrationSample | null;
  notice: string;
  setMode: (mode: CircuitMode) => void;
  select: (id: string | null) => void;
  selectWire: (id: string | null) => void;
  setWireColor: (color: WireColor) => void;
  togglePower: () => void;
  toggleCalibration: () => void;
  setSample: (sample: CalibrationSample) => void;
  addComponent: (assetId: AssetId, position?: Point, model?:IcModel) => void;
  moveComponent: (id: string, position: Point) => void;
  updateSettings: (id: string, settings: Partial<CircuitComponent['settings']>) => void;
  connect: (from: PinRef, to: PinRef) => void;
  deleteSelection: () => void;
  reset: () => void;
}

export const useCircuitStore = create<CircuitState>()((rawSet,get) => {
 const restore=(saved:Snapshot,mode:CircuitMode):CircuitWorkspace=>{
  const w=structuredClone(saved);w.power.on=false;
  for(const c of w.components)if(c.assetId==='pb-switch'&&c.settings.buttonMode!=='detent')c.settings.pressed=false;
  return {...w,simulation:solveCircuit({...w,mode})};
 };
 const set:typeof rawSet=(partial)=>{
  const before=get();const patch=typeof partial==='function'?partial(before):partial;
  if(patch===before)return;
  const next={...before,...patch};let histories=before.histories;
  for(const mode of ['sequence','digital'] as const) {
   const a=before.workspaces[mode],b=next.workspaces[mode];
   if(a.components===b.components&&a.wires===b.wires&&a.power===b.power)continue;
   const old=snapshot(a),fresh=snapshot(b);if(same(old,fresh)||before.dragHistory?.mode===mode)continue;
   histories={...histories,[mode]:{past:[...histories[mode].past,old].slice(-80),future:[]}};
  }
  rawSet({...patch,histories});
 };
 return ({
 histories:{sequence:{past:[],future:[]},digital:{past:[],future:[]}},dragHistory:null,
 beginDrag:(_id)=>{const s=get();if(s.calibration||s.workspaces[s.mode].power.on||s.dragHistory)return;rawSet({dragHistory:{mode:s.mode,before:snapshot(s.workspaces[s.mode])}});},
 undo:()=>{const s=get(),mode=s.mode,h=s.histories[mode];if(!h.past.length||s.dragHistory)return;rawSet({workspaces:{...s.workspaces,[mode]:restore(h.past.at(-1)!,mode)},histories:{...s.histories,[mode]:{past:h.past.slice(0,-1),future:[snapshot(s.workspaces[mode]),...h.future].slice(0,80)}},selectedId:null,selectedWireId:null,sample:null,calibration:false,notice:'실행 취소 · 전원 OFF로 복원했습니다.'});},
 redo:()=>{const s=get(),mode=s.mode,h=s.histories[mode];if(!h.future.length||s.dragHistory)return;rawSet({workspaces:{...s.workspaces,[mode]:restore(h.future[0],mode)},histories:{...s.histories,[mode]:{past:[...h.past,snapshot(s.workspaces[mode])].slice(-80),future:h.future.slice(1)}},selectedId:null,selectedWireId:null,sample:null,calibration:false,notice:'다시 실행 · 전원 OFF로 복원했습니다.'});},
 loadPreset:(id)=>{const p=createPreset(id);set(s=>({mode:p.mode,workspaces:{...s.workspaces,[p.mode]:p.workspace},selectedId:null,selectedWireId:null,sample:null,calibration:false,notice:'예제 회로를 불러왔습니다. 메인 전원을 켜서 실습하세요.'}));},
 importJson:(source)=>{const data=importCircuitFile(source);set({mode:data.mode,workspaces:data.workspaces,selectedId:null,selectedWireId:null,sample:null,calibration:false,notice:'JSON 회로를 전원 OFF로 불러왔습니다.'});},

  wireKind:'jumper',setWireKind:wireKind=>set({wireKind}),
  wiringMode: true,
  setWiringMode: (wiringMode) => set({wiringMode}),
  tick: (nowMs) => set(s => { const w=s.workspaces.sequence; if(!w.power.on || w.simulation.status==='error' || !w.components.some(c=>c.assetId==='timer-at8n')) return s; return {workspaces:{...s.workspaces,sequence:{...w,simulation:solveCircuit({...w,mode:'sequence',nowMs,previous:w.simulation})}}}; }),
  finishDrag: (id) => {
   set(s=>{const w=s.workspaces[s.mode];if(w.power.on||s.calibration)return s;return {workspaces:{...s.workspaces,[s.mode]:evaluate({...w,components:s.mode==='sequence'?placeSequence(w.components,id):placeDigital(w.components,id)},s.mode)}};});
   const s=get(),group=s.dragHistory;if(group){const h=s.histories[group.mode];rawSet({dragHistory:null,histories:same(group.before,snapshot(s.workspaces[group.mode]))?s.histories:{...s.histories,[group.mode]:{past:[...h.past,group.before].slice(-80),future:[]}}});}
  },
  mode: 'sequence', workspaces: { sequence: createPhotoWorkspace('sequence'), digital: createPhotoWorkspace('digital') },
  selectedId: null, selectedWireId: null, wireColor: '#dc4c4c', calibration: false, sample: null,
  notice: '부품을 배치하고 두 단자를 연결해 보세요.',
  setMode: (mode) => set({ mode, selectedId: null, selectedWireId: null, sample: null, calibration: false }),
  select: (selectedId) => set({ selectedId, selectedWireId: null }),
  selectWire: (selectedWireId) => set({ selectedWireId, selectedId: null }),
  setWireColor: (wireColor) => set({ wireColor }),
  togglePower: () => set((s) => {
    const w = s.workspaces[s.mode];
    if (s.calibration) return { notice: '좌표 보정 모드를 끈 뒤 전원을 켜세요.' };
    const next = evaluate({ ...w, power: { ...w.power, on: !w.power.on } }, s.mode);
    return { workspaces: { ...s.workspaces, [s.mode]: next },
      notice: w.power.on ? '메인 전원이 꺼졌습니다. 경고음과 회로 동작이 정지됩니다.' : next.simulation.status === 'error' ? '보호 정지 · 오류 배선을 제거하거나 메인 전원을 끄세요.' : '전원 ON · DC / TTL 회로 해석 중입니다.' };
  }),
  toggleCalibration: () => set((s) => {
    if (s.workspaces[s.mode].power.on) return { notice: '메인 전원을 끈 뒤 핀 좌표 디버그 모드를 켜세요.' };
    return { calibration: !s.calibration, sample: null, notice: s.calibration ? '핀 좌표 디버그를 종료했습니다.' : '이미지에서 보정할 위치를 클릭하세요. 백분율 좌표가 복사됩니다.' };
  }),
  setSample: (sample) => set({ sample }),
  addComponent: (assetId, position, model) => set((s) => {
    const w = s.workspaces[s.mode];
    const asset = componentAssets[assetId];
    if (w.power.on || s.calibration || asset.mode !== s.mode) return s;
    const id = crypto.randomUUID();
    const count = w.components.length;
    const component = makeComponent(assetId, id, position?.x ?? 110 + count % 4 * 220, position?.y ?? 70 + count % 3 * 170);
    if(model) component.settings.icModel=model;
    return { workspaces: { ...s.workspaces, [s.mode]: evaluate({ ...w, components: [...w.components, component] }, s.mode) }, selectedId: id, selectedWireId: null, notice: `${asset.label} 부품을 배치했습니다.` };
  }),
  moveComponent: (id, position) => set((s) => {
    const w = s.workspaces[s.mode];
    if (w.power.on || s.calibration || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return s;
    return { workspaces: { ...s.workspaces, [s.mode]: { ...w, components: w.components.map((c) => c.id === id ? { ...c, position } : c.mountedSocketId===id ? {...c,position:{x:c.position.x+position.x-(w.components.find(p=>p.id===id)?.position.x??position.x),y:c.position.y+position.y-(w.components.find(p=>p.id===id)?.position.y??position.y)}} : c) } } };
  }),
  updateSettings: (id, settings) => set((s) => {
    const w = s.workspaces[s.mode];
    if (s.calibration) return s;
    if (!w.components.some((c) => c.id === id) || w.power.on && settings.voltage !== undefined) return s;
    const safe = { ...settings };
    if (safe.voltage !== undefined) {
      if (!Number.isFinite(safe.voltage)) return s;
      safe.voltage = Math.max(0, Math.min(30, safe.voltage));
    }
    if (safe.timerSeconds !== undefined) {
      if (!Number.isFinite(safe.timerSeconds)) return s;
      safe.timerSeconds = Math.max(0, Math.min(10, safe.timerSeconds));
    }
    const supply = w.components.find((c) => c.assetId === 'power-supply');
    const power = supply?.id === id && safe.voltage !== undefined ? { ...w.power, voltage: safe.voltage } : w.power;
    return { workspaces: { ...s.workspaces, [s.mode]: evaluate({ ...w, power, components: w.components.map((c) => c.id === id ? { ...c, settings: { ...c.settings, ...safe } } : c) }, s.mode) } };
  }),
  connect: (from, to) => set((s) => {
    const w = s.workspaces[s.mode];
    if (w.power.on || s.calibration || from.componentId === to.componentId && from.pinId === to.pinId) return s;
    const valid = (ref: PinRef) => {
      const c = w.components.find((c) => c.id === ref.componentId);
      return c && componentAssets[c.assetId].pins.some((p) => p.id === ref.pinId);
    };
    if (!valid(from) || !valid(to)) return s;
    const same = (a: PinRef, b: PinRef) => a.componentId === b.componentId && a.pinId === b.pinId;
    if (w.wires.some((wire) => same(wire.from, from) && same(wire.to, to) || same(wire.from, to) && same(wire.to, from))) return s;
    const next = evaluate({ ...w, wires: [...w.wires, { id: crypto.randomUUID(), from, to, kind:s.mode==='digital'?s.wireKind:undefined, color: s.wireColor }] }, s.mode);
    return { workspaces: { ...s.workspaces, [s.mode]: next }, notice: next.simulation.shortCircuit.message ?? '배선을 연결하고 회로를 다시 해석했습니다.' };
  }),
  deleteSelection: () => set((s) => {
    const w = s.workspaces[s.mode];
    if (w.power.on && w.simulation.status !== 'error' || s.calibration) return s;
    const components = w.components.filter((c) => c.id !== s.selectedId).map(c=>c.mountedSocketId===s.selectedId?{...c,mountedSocketId:undefined}:c.insertion?.boardId===s.selectedId?{...c,insertion:undefined,displaySize:undefined}:c);
    const wires = w.wires.filter((wire) => wire.id !== s.selectedWireId && wire.from.componentId !== s.selectedId && wire.to.componentId !== s.selectedId);
    const next = evaluate({ ...w, components, wires }, s.mode);
    return { workspaces: { ...s.workspaces, [s.mode]: next }, selectedId: null, selectedWireId: null, sample: null, notice: next.simulation.shortCircuit.message ?? '선택 항목을 삭제하고 회로를 다시 해석했습니다.' };
  }),
  reset: () => set((s) => {
    if (s.workspaces[s.mode].power.on || s.calibration) return s;
    return { workspaces: { ...s.workspaces, [s.mode]: createPhotoWorkspace(s.mode) }, selectedId: null, selectedWireId: null, sample: null, notice: '현재 실습을 기본 배치로 초기화했습니다.' };
  }),
});
});
