import { describe, expect, it } from 'vitest';
import { gradeLogicMission } from './missionGrader';
import { createPreset } from '../features/workbench/data/presets';
import { makeComponent } from '../features/workbench/data/photoCircuits';
import { logicMissions } from '../features/workbench/data/logicMissions';
import type { CircuitWorkspace, LogicGate, CircuitWire } from '../types/circuit';
const bindings={a:'input-a',b:'input-b',led:'output-led'};
const mission=(id:LogicGate)=>logicMissions.find(m=>m.id===id)!;
const wire=(a:string,ap:string,b:string,bp:string):CircuitWire=>({id:`test-${a}-${ap}-${b}-${bp}`,from:{componentId:a,pinId:ap},to:{componentId:b,pinId:bp},color:'#dc4c4c'});
function circuit(id:LogicGate):CircuitWorkspace {
  const w=createPreset('nand').workspace,ic=w.components.find(c=>c.id==='ic')!;
  if(id==='AND')ic.settings.icModel='7408';
  if(id==='XOR'||id==='XNOR')ic.settings.icModel='7486';
  if(id==='NOT'){
    ic.settings.icModel='7406';w.wires=w.wires.filter(wire=>!(wire.from.componentId==='input-b'&&wire.from.pinId==='com'));
    w.wires.find(wire=>wire.from.componentId==='ic'&&wire.to.componentId==='resistor')!.from.pinId='2';
  }
  if(id==='OR'||id==='XNOR'){
    const inverter=makeComponent('ic-dip14','inverter',400,400);inverter.settings.icModel='7406';w.components.push(inverter);
    const output=w.wires.find(wire=>wire.from.componentId==='ic'&&wire.to.componentId==='resistor')!;
    if(id==='OR'){
      ic.settings.icModel='7402';
      w.wires.find(wire=>wire.from.componentId==='input-a'&&wire.to.componentId==='ic')!.to.pinId='2';
      w.wires.find(wire=>wire.from.componentId==='input-b'&&wire.to.componentId==='ic')!.to.pinId='3';
      output.from.pinId='1';
    }
    const previous={...output.from};output.from={componentId:'inverter',pinId:'2'};
    w.wires.push(wire(previous.componentId,previous.pinId,'inverter','1'),wire('power','plus','inverter','14'),wire('power','minus','inverter','7'));
  }
  return w;
}
describe('functional logic missions',()=>{
  it.each(['AND','NAND','NOT','XOR','OR','XNOR'] as const)('grades every %s input row using the LED',id=>{
    const w=circuit(id),before=JSON.stringify(w),result=gradeLogicMission(w,mission(id),bindings);
    expect(result.hints).toEqual([]);expect(result.score).toBe(100);expect(result.passed).toBe(true);
    expect(result.rows).toHaveLength(id==='NOT'?2:4);expect(result.rows.every(row=>row.actual===row.expected)).toBe(true);
    expect(JSON.stringify(w)).toBe(before);
  });
  it('accepts 7411 AND with its third input tied HIGH',()=>{
    const w=circuit('AND');w.components.find(c=>c.id==='ic')!.settings.icModel='7411';
    w.wires.find(wire=>wire.from.componentId==='ic'&&wire.to.componentId==='resistor')!.from.pinId='12';w.wires.push(wire('power','plus','ic','13'));
    expect(gradeLogicMission(w,mission('AND'),bindings).passed).toBe(true);
  });
  it('accepts the three-NAND implementation of OR',()=>{
    const w=circuit('NAND');w.wires=w.wires.filter(wire=>!(wire.from.componentId==='input-b'&&wire.to.componentId==='ic'));
    w.wires.push(wire('input-a','com','ic','2'),wire('input-b','com','ic','4'),wire('input-b','com','ic','5'),wire('ic','3','ic','9'),wire('ic','6','ic','10'));
    w.wires.find(wire=>wire.from.componentId==='ic'&&wire.to.componentId==='resistor')!.from.pinId='8';
    expect(gradeLogicMission(w,mission('OR'),bindings).passed).toBe(true);
  });
  it('rejects a NAND submitted as AND with row-by-row failures',()=>{
    const result=gradeLogicMission(circuit('NAND'),mission('AND'),bindings);expect(result.score).toBe(0);expect(result.rows.every(r=>!r.passed)).toBe(true);
  });
  it('never counts a disconnected LED as a valid LOW',()=>{
    const w=circuit('AND');w.wires=w.wires.filter(wire=>wire.to.componentId!=='output-led'&&wire.from.componentId!=='output-led');
    const result=gradeLogicMission(w,mission('AND'),bindings);expect(result.score).toBe(0);expect(result.rows.every(r=>r.actual===null)).toBe(true);
  });
  it('does not mistake passive LED leakage for a defined gate LOW',()=>{
    const w=circuit('AND');w.wires=w.wires.filter(wire=>!(wire.from.componentId==='input-b'&&wire.from.pinId==='com'));
    const result=gradeLogicMission(w,mission('AND'),bindings);expect(result.rows[2].actual).toBeNull();expect(result.hints.join(' ')).toContain('부동');
  });
  it('rejects a resistor loop returning both LED legs to the same driver',()=>{
    const w=circuit('AND');w.wires=w.wires.filter(wire=>wire.from.componentId!=='output-led');w.wires.push(wire('output-led','cathode','resistor','1'));
    const result=gradeLogicMission(w,mission('AND'),bindings);expect(result.rows.every(row=>row.actual===null)).toBe(true);expect(result.hints.join(' ')).toContain('귀환');
  });
  it('reports missing IC power instead of passing dark output rows',()=>{
    const w=circuit('AND');w.wires=w.wires.filter(wire=>!(wire.from.componentId==='ic'&&wire.from.pinId==='14'));
    const result=gradeLogicMission(w,mission('AND'),bindings);expect(result.passed).toBe(false);expect(result.hints.join(' ')).toContain('전원');
  });
  it('reports LED reverse polarity',()=>{
    const w=circuit('NAND');w.wires.find(wire=>wire.to.componentId==='output-led')!.to.pinId='cathode';w.wires.find(wire=>wire.from.componentId==='output-led')!.from.pinId='anode';
    const result=gradeLogicMission(w,mission('NAND'),bindings);expect(result.passed).toBe(false);expect(result.hints.join(' ')).toContain('역연결');
  });
  it('reports a bypassed resistor',()=>{
    const w=circuit('NAND');w.wires.push(wire('resistor','1','resistor','2'));
    const result=gradeLogicMission(w,mission('NAND'),bindings);expect(result.passed).toBe(false);expect(result.hints.join(' ')).toContain('330');
  });
  it('requires distinct A/B switches and a selected LED',()=>{
    const result=gradeLogicMission(circuit('NAND'),mission('NAND'),{a:'input-a',b:'input-a',led:'missing'});expect(result.score).toBe(0);expect(result.hints.join(' ')).toContain('다른');
  });
  it('detects swapped switch rail polarity even when XOR would be unchanged',()=>{
    const w=circuit('XOR');for(const wire of w.wires)if(wire.from.componentId==='input-a'||wire.from.componentId==='input-b'){
      if(wire.from.pinId==='1')wire.from.pinId='2';else if(wire.from.pinId==='2')wire.from.pinId='1';
    }
    expect(gradeLogicMission(w,mission('XOR'),bindings).passed).toBe(false);
  });
});
