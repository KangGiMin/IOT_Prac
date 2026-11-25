import { buildExercise, type Exercise, type ExerciseCircuit, type Lead } from './model';
export interface RunState {on:Record<string,boolean>;elapsed:Record<string,number>;timing:Record<string,boolean>;short:boolean;unstable:boolean;motor:string}
export const stopped=():RunState=>({on:{},elapsed:{},timing:{},short:false,unstable:false,motor:'정지'});
export function stepCircuit(c:ExerciseCircuit,leads:Lead[],buttons:Record<string,boolean>,previous:RunState,dt:number,power=true):RunState {
 if(!power)return stopped();
 let on={...previous.on},elapsed={...previous.elapsed};
 const visited=new Set<string>();
 const timersReset=new Set<string>();
 for(let iteration=0;iteration<32;iteration++){
  const parent=new Map(c.ports.map(p=>[p,p]));
  const root=(p:string):string=>{if(!parent.has(p))parent.set(p,p);const a=parent.get(p)!;if(a===p)return p;const r=root(a);parent.set(p,r);return r;};
  const union=(a:string,b:string)=>parent.set(root(a),root(b));
  for(const [a,b] of leads)if(c.ports.includes(a)&&c.ports.includes(b))union(a,b);
  for(const p of c.parts)if(p.kind==='contact'){const value=p.owner!.startsWith('PB')?!!buttons[p.owner!]:!!on[p.owner!];if(value!==!!p.nc)union(p.id+':1',p.id+':2');}
  if(root('24V')===root('0V'))return {...stopped(),short:true};
  const next:Record<string,boolean>={},timing:Record<string,boolean>={};const nextElapsed={...elapsed};let motor='정지';
  for(const p of c.parts.filter(p=>p.kind!=='contact')){
   const powered=(root(p.id+':1')===root('24V')&&root(p.id+':2')===root('0V'));
   if(p.kind==='motor'){const reverse=root(p.id+':2')===root('24V')&&root(p.id+':1')===root('0V');motor=powered?'CW':reverse?'CCW':root(p.id+':1')===root(p.id+':2')?'정지 / 제동':'정지 / 개방';next[p.id]=powered||reverse;}
   else if(p.kind==='timer'){
    timing[p.id]=powered;
    // A break in the coil feed resets its timing even if a held input restarts it during settling.
    if(!powered)timersReset.add(p.id);
    nextElapsed[p.id]=powered&&!timersReset.has(p.id)&&previous.timing[p.id]?(previous.elapsed[p.id]??0)+dt:0;
    next[p.id]=powered&&nextElapsed[p.id]>=p.seconds!;
   }else next[p.id]=powered;
  }
  const key=JSON.stringify(next);if(key===JSON.stringify(on))return {on:next,elapsed:nextElapsed,timing,short:false,unstable:false,motor};
  if(visited.has(key))return {on:next,elapsed:nextElapsed,timing,short:false,unstable:true,motor:'경합'};
  visited.add(key);on=next;elapsed=nextElapsed;
 }
 return {...stopped(),unstable:true};
}
export function motorState(e:Exercise,state:RunState) {
 if(state.short||state.unstable)return '보호 정지';if(!e.motor)return '모터 없음';
 if(e.motor[1]==='OFF')return state.on.M?'운전':'정지';
 return state.motor;
}
export interface TestRow {action:string;pass:boolean;expected:string;actual:string}
/** Runs the learner netlist and reference independently, preserving the live workspace. */
export function gradeExercise(e:Exercise,leads:Lead[],corrected=false):TestRow[] {
 const c=buildExercise(e,corrected),buttons=[...new Set(c.parts.filter(p=>p.owner?.startsWith('PB')).map(p=>p.owner!))].sort();
 let reference=stopped(),actual=stopped();const rows:TestRow[]=[];
 const run=(input:Record<string,boolean>,dt:number,action:string)=>{
  reference=stepCircuit(c,c.leads,input,reference,dt);actual=stepCircuit(c,leads,input,actual,dt);
  const summary=(s:RunState)=>s.short?'단락':s.unstable?'접점 경합':c.parts.filter(p=>p.kind!=='contact').map(p=>`${p.id}=${s.on[p.id]?1:0}`).join(' ')+' · '+motorState(e,s);
  rows.push({action,expected:summary(reference),actual:summary(actual),pass:actual.short===reference.short&&summary(reference)===summary(actual)});
 };
 run({},0,'전원 인가');
 for(const b of buttons){run({[b]:true},0,`${b} 누름`);run({},0,`${b} 놓음`);for(const delay of [.3,1,3,4])run({},delay,`${delay}초 경과`);}
 for(const a of buttons)for(const b of buttons.filter(x=>x!==a)){reference=stopped();actual=stopped();run({[a]:true},0,`${a} 먼저 입력`);run({},0,`${a} 해제`);run({[b]:true},0,`${b} 나중 입력`);run({},0,'입력 모두 해제');}
 for(let mask=0;mask<2**buttons.length;mask++){reference=stopped();actual=stopped();run(Object.fromEntries(buttons.map((b,i)=>[b,!!(mask&(1<<i))])),0,`동시 입력 ${buttons.map((b,i)=>`${b}=${(mask>>i)&1}`).join(' ')}`);}
 reference=stepCircuit(c,c.leads,{},reference,0,false);actual=stepCircuit(c,leads,{},actual,0,false);rows.push({action:'전원 OFF',expected:'전체 출력 정지',actual:Object.values(actual.on).some(Boolean)?'출력 잔류':'전체 출력 정지',pass:!Object.values(actual.on).some(Boolean)});
 return rows;
}
