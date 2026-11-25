import { describe, expect, it } from 'vitest';
import { createPhotoWorkspace } from '../workbench/data/photoCircuits';
import { exercises,buildExercise } from './model';
import { gradeExercise,stopped,stepCircuit } from './solver';
describe('empty workspaces and lesson netlists',()=>{
 it.each(['sequence','digital'] as const)('starts %s with only its board',mode=>{const w=createPhotoWorkspace(mode);expect(w.components.map(c=>c.assetId)).toEqual([mode==='sequence'?'panel-board':'breadboard']);expect(w.wires).toEqual([]);expect(w.power.on).toBe(false);});
 it.each(exercises)('runs exercise $id reference and detects missing wiring',e=>{const c=buildExercise(e);expect(gradeExercise(e,c.leads).every(r=>r.pass)).toBe(true);expect(gradeExercise(e,[]).some(r=>!r.pass)).toBe(true);expect(stepCircuit(c,[['24V','0V']],{},stopped(),0).short).toBe(true);});
 it('preserves first input in 8 and lets later input replace it in 7',()=>{for(const id of [7,8]){const c=buildExercise(exercises[id-1]);let s=stepCircuit(c,c.leads,{PB1:true},stopped(),0);s=stepCircuit(c,c.leads,{},s,0);expect(s.on.R1).toBe(true);s=stepCircuit(c,c.leads,{PB2:true},s,0);expect(s.on.R2).toBe(id===7);expect(s.on.R1).toBe(id===8);}});
 it('turns delayed lights on at 1 and 4 seconds in 16',()=>{const c=buildExercise(exercises[15]);let s=stepCircuit(c,c.leads,{PB1:true},stopped(),0);s=stepCircuit(c,c.leads,{},s,1);expect(s.on.PL1).toBe(true);expect(s.on.PL2).toBe(false);s=stepCircuit(c,c.leads,{},s,2);expect(s.on.PL2).toBe(false);s=stepCircuit(c,c.leads,{},s,1);expect(s.on.PL2).toBe(true);});
 it('retains source faults and separately provides corrections',()=>{expect(exercises[3].correction).toBeDefined();expect(exercises[9].correction).toBeDefined();const c=buildExercise(exercises[3]);expect(stepCircuit(c,c.leads,{PB1:true},stopped(),0).on.R1).toBe(false);});
 it('uses four NO power contacts in 24 and leaves the motor floating at rest',()=>{const c=buildExercise(exercises[23]);let s=stepCircuit(c,c.leads,{},stopped(),0);expect(s.motor).toBe('정지 / 개방');s=stepCircuit(c,c.leads,{PB1:true},s,0);expect(s.motor).toBe('CW');s=stepCircuit(c,c.leads,{},s,0);s=stepCircuit(c,c.leads,{PB2:true},s,0);expect(s.motor).toBe('CCW');});
});
