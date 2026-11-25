import {describe,expect,it} from 'vitest';
import {buildExercise,exercises} from './model';
import {easySteps,locateParts,physicalAliases} from './easyGuide';
import {drawingContacts,numberedContacts} from './drawingContacts';
import {gradeExercise} from './solver';
describe('source locations and beginner wiring',()=>{
 it.each(exercises)('has bounded numbered source contacts for drawing $id',e=>{
  const marks=numberedContacts(e.id);expect(marks.length).toBeGreaterThan(0);expect(new Set(marks.map(m=>m.id)).size).toBe(marks.length);
  for(const m of drawingContacts[e.id]){for(const p of m.points){expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(100);expect(p.y).toBeGreaterThan(0);expect(p.y).toBeLessThan(100);}expect(m.points.map(p=>p.role)).toEqual(m.kind==='changeover'?['c','a','b']:m.kind==='unknown'?['?']:['c',m.kind]);}
 });
 it.each(exercises)('can rebuild drawing $id using plain terminal wiring without junction codes',e=>{
  for(const corrected of e.correction?[false,true]:[false]){
   const c=buildExercise(e,corrected),locations=locateParts(e.id,c),steps=easySteps(c,locations);
   expect(steps.length).toBeGreaterThan(0);expect(steps.every(s=>!/[CJ]\d+:?/.test(s.title))).toBe(true);
   expect(gradeExercise(e,[...physicalAliases(locations),...steps.map(s=>s.lead)],corrected).every(r=>r.pass)).toBe(true);
   for(const loc of Object.values(locations))expect(loc.mark.owner).toBe(c.parts.find(p=>locations[p.id]===loc)?.owner);
  }
 });
 it('does not fabricate a second terminal on omitted original symbols',()=>{expect(numberedContacts(4).filter(c=>c.owner==='PB3').every(c=>c.kind==='unknown'&&c.points.length===1)).toBe(true);});
});
