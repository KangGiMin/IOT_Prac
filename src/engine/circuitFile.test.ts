import { describe, expect, it } from 'vitest';
import { exportCircuitFile, importCircuitFile } from './circuitFile';
import { createPreset } from '../features/workbench/data/presets';
import { placeDigital } from '../features/workbench/utils/digitalPlacement';
const workspaces=()=>({sequence:createPreset('self-hold').workspace,digital:createPreset('nand').workspace});
const saved=()=>exportCircuitFile('digital',workspaces());
function invalid(change:(data:ReturnType<typeof JSON.parse>)=>void){const data=JSON.parse(saved());change(data);return JSON.stringify(data);}
describe('versioned circuit JSON',()=>{
  it('round-trips an IC inserted in the fourth bank of the supplied breadboard',()=>{
    const w=workspaces();w.digital.components=w.digital.components.map(c=>c.id==='ic'?{...c,position:{x:240,y:570}}:c);
    w.digital.components=placeDigital(w.digital.components,'ic');
    expect(w.digital.components.find(c=>c.id==='ic')!.insertion?.bank).toBe(3);
    const loaded=importCircuitFile(exportCircuitFile('digital',w));expect(loaded.workspaces.digital.components.find(c=>c.id==='ic')!.insertion?.bank).toBe(3);
  });
  it('round-trips both presets with metadata, wires and power OFF',()=>{
    const before=workspaces();before.digital.power.on=true;before.sequence.power.on=true;
    const source=exportCircuitFile('digital',before),result=importCircuitFile(source);
    expect(result.mode).toBe('digital');expect(result.workspaces.digital.components).toEqual(before.digital.components);
    expect(result.workspaces.sequence.wires).toEqual(before.sequence.wires);
    expect(result.workspaces.digital.power.on).toBe(false);expect(result.workspaces.sequence.power.on).toBe(false);
    expect(source).not.toContain('"simulation"');expect(result.workspaces.digital.simulation.isShorted).toBe(false);
  });
  it.each(['bad JSON','[]','{}','null'])('rejects malformed or unsupported input %s',source=>expect(()=>importCircuitFile(source)).toThrow());
  it('rejects a future version and oversize files',()=>{
    expect(()=>importCircuitFile(invalid(d=>d.version=2))).toThrow('버전');expect(()=>importCircuitFile(' '.repeat(1_000_001))).toThrow('1MB');
  });
  it('rejects unknown assets, duplicate IDs and dangling endpoints',()=>{
    expect(()=>importCircuitFile(invalid(d=>d.workspaces.digital.components[0].assetId='__proto__'))).toThrow();
    expect(()=>importCircuitFile(invalid(d=>d.workspaces.digital.components[1].id=d.workspaces.digital.components[0].id))).toThrow('중복');
    expect(()=>importCircuitFile(invalid(d=>d.workspaces.digital.wires[0].to.pinId='missing'))).toThrow('단자');
  });
  it('rejects invalid numeric settings, IC models and mount references',()=>{
    expect(()=>importCircuitFile(invalid(d=>d.workspaces.digital.components[0].position.x=null))).toThrow();
    expect(()=>importCircuitFile(invalid(d=>d.workspaces.digital.components.find((c:{id:string})=>c.id==='ic').settings.icModel='7499'))).toThrow('TTL');
    expect(()=>importCircuitFile(invalid(d=>d.workspaces.sequence.components.find((c:{id:string})=>c.id==='body').mountedSocketId='missing'))).toThrow('장착');
  });
  it('ignores execution state and clears physically held momentary buttons',()=>{
    const data=JSON.parse(saved());data.workspaces.sequence.power.on=true;data.workspaces.sequence.components.find((c:{id:string})=>c.id==='start').settings.pressed=true;
    const result=importCircuitFile(JSON.stringify(data));expect(result.workspaces.sequence.power.on).toBe(false);expect(result.workspaces.sequence.components.find(c=>c.id==='start')!.settings.pressed).toBe(false);
  });
});
