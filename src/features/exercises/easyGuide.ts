import { numberedContacts } from './drawingContacts';
import type { DrawingPoint } from './drawingContacts';
import type { ExerciseCircuit,Lead } from './model';
export type ContactMark=ReturnType<typeof numberedContacts>[number];
export interface PartLocation {mark:ContactMark;roles:[DrawingPoint['role'],DrawingPoint['role']]}
const motorIndices:Record<number,number[]>={1:[1,2],2:[1,2],3:[2,3],4:[6,7],5:[4,5,6],6:[7,8],7:[7,8],8:[7,8],9:[7,8],10:[10,11],11:[10,11],12:[7,8],22:[1,2,3],23:[3],24:[4,5,6,7]};
const lampIndices:Record<number,number[]>={2:[3],3:[4,5],4:[8,9],13:[5,6],14:[6,7],15:[9,10,11],19:[6,7],20:[7,8],21:[13,14,15],23:[4]};
const motorPoles:Record<number,[number,number]>={1:[1,2],2:[1,2],3:[2,3],4:[6,7],5:[5,6],6:[7,8],7:[7,8],8:[7,8],9:[7,8],10:[10,11],11:[10,11],12:[7,8],23:[3,3]};
/** Never pretend an equivalent model contact exists in a source drawing. */
export function locateParts(id:number,c:ExerciseCircuit):Record<string,PartLocation>{
 const marks=numberedContacts(id),result:Record<string,PartLocation>={},used=new Map<string,number>();
 for(const p of c.parts.filter(p=>p.kind==='contact')){
  const role=p.nc?'b':'a';let candidates=marks.filter(m=>m.owner===p.owner&&(m.kind===role||m.kind==='changeover'||m.kind==='unknown'));
  if(!p.owner!.startsWith('PB')){
   if(p.purpose==='M')candidates=candidates.filter(m=>motorIndices[id]?.includes(m.number-1));
   else if(lampIndices[id]&&/^(L|PL)/.test(p.purpose??''))candidates=candidates.filter(m=>lampIndices[id].includes(m.number-1));
   else candidates=candidates.filter(m=>!motorIndices[id]?.includes(m.number-1)&&!lampIndices[id]?.includes(m.number-1));
  }
  // A single printed timer/holding contact can supply more than one load.
  if(id===16&&p.owner==='T2')candidates=[marks[4]];
  if(id===16&&p.owner==='T1')candidates=[marks[5]];
  if(id===17&&p.owner==='R1')candidates=[marks[p.purpose==='T1'?3:1]];
  if(id===18&&p.owner==='R1')candidates=[marks[p.purpose==='T1'?5:p.purpose==='BZ'?6:3]];
  if((id===10||id===11)&&p.owner==='R3')candidates=[marks[p.purpose==='R3'?1:3]];
  if(p.purpose==='M'&&p.pole!==undefined&&motorPoles[id]){const m=marks[motorPoles[id][p.pole]];candidates=m.owner===p.owner&&(m.kind===role||m.kind==='changeover')?[m]:[];}
  if(id===24&&p.purpose==='M'){const m=marks[p.pole===0?(p.owner==='R1'?4:5):(p.owner==='R2'?6:7)];candidates=[m];}
  if(id===5&&p.owner==='R1'&&p.purpose==='R2')candidates=[]; // equivalent enabling contact, not the printed holding contact
  if(!candidates.length)continue;
  const key=`${p.owner}:${role}:${p.purpose==='M'?'motor':/^(L|PL)/.test(p.purpose??'')?'lamp':'control'}`;
  const index=used.get(key)??0,mark=candidates[index%candidates.length];used.set(key,index+1);
  result[p.id]={mark,roles:mark.kind==='changeover'?(p.purpose==='M'?[role,'c']:['c',role]):['c',role]};
 }
 return result;
}
export function simplePort(c:ExerciseCircuit,locations:Record<string,PartLocation>,port:string):string{
 if(port==='24V')return '전원 + (위쪽 전원선)';if(port==='0V')return '전원 − (아래쪽 전원선)';
 const [id,side]=port.split(':'),p=c.parts.find(x=>x.id===id),loc=locations[id];
 if(loc){const index=Number(side)-1,point=loc.mark.points.find(x=>x.role===loc.roles[index]);
  const orientation=loc.mark.points.length===2?(Math.abs(loc.mark.points[0].x-loc.mark.points[1].x)>Math.abs(loc.mark.points[0].y-loc.mark.points[1].y)?(index===0?'왼쪽':'오른쪽'):(index===0?'위쪽':'아래쪽')):'';
  return `${loc.mark.number}번 ${p!.owner}${p!.owner!.startsWith('PB')?' 버튼':' 접점'} · ${loc.mark.kind==='unknown'?'기호가 빠진 자리의 연습 단자 '+side:loc.mark.kind==='changeover'?`${point?.role}점`: `${orientation} 점(${loc.roles[index]}*)`}`;
 }
 if(p?.kind==='contact')return `${p.owner} ${p.nc?'b':'a'}접점 · 연습 모델의 ${side==='1'?'한쪽':'다른 쪽'} 단자 (원본 위치 없음)`;
 if(p?.kind==='relay')return `${p.label} 코일 ${side==='1'?'+쪽 (14번)':'−쪽 (13번)'}`;
 if(p?.kind==='timer')return `${p.label} 타이머 전원 ${side==='1'?'+쪽':'−쪽'}`;
 if(p?.kind==='motor')return `모터 ${side==='1'?'왼쪽':'오른쪽'} 단자`;
 if(p)return `${p.label} ${p.kind==='buzzer'?'부저':'램프'}의 ${side==='1'?'한쪽':'다른 쪽'} 단자`;
 return '선을 나누어 잇는 자리';
}
export interface EasyStep {lead:Lead;title:string;why:string;marks:string[]}
/** Repeated expressions can refer to the very same printed terminal.
 * Tie those model ports internally, rather than ask a beginner to wire a dot
 * to itself or to repeat the same physical lead twice.
 */
export function physicalAliases(locations:Record<string,PartLocation>):Lead[]{
 const first=new Map<string,string>(),aliases:Lead[]=[];
 for(const [id,loc] of Object.entries(locations)){if(loc.mark.kind==='unknown')continue;loc.roles.forEach((role,i)=>{const key=`${loc.mark.id}:${role}`,port=`${id}:${i+1}`,prior=first.get(key);if(prior)aliases.push([prior,port]);else first.set(key,port);});}
 return aliases;
}
/** Collapse wire-only junctions into ordinary terminal-to-terminal connections.
 * No J/C implementation IDs are exposed in the beginner instructions.
 */
export function easySteps(c:ExerciseCircuit,locations:Record<string,PartLocation>):EasyStep[]{
 const parents=new Map(c.ports.map(p=>[p,p]));const root=(p:string):string=>{const r=parents.get(p)!;if(r===p)return r;const n=root(r);parents.set(p,n);return n;};
 const aliases=physicalAliases(locations),representative=new Map<string,string>();
 for(const [a,b] of [...c.leads,...aliases])parents.set(root(a),root(b));
 for(const [a,b] of aliases)representative.set(b,representative.get(a)??a);
 const groups=new Map<string,string[]>();
 const physical=['24V','0V',...c.parts.flatMap(p=>[`${p.id}:1`,`${p.id}:2`])];
 for(const p of physical){if(representative.has(p))continue;const r=root(p);groups.set(r,[...(groups.get(r)??[]),p]);}
 const steps:EasyStep[]=[];
 for(const ports of groups.values())for(const target of ports.slice(1)){
  const source=ports[0],sourcePart=c.parts.find(p=>p.id===source.split(':')[0]),targetPart=c.parts.find(p=>p.id===target.split(':')[0]);
  const marks=[source,target].flatMap(p=>locations[p.split(':')[0]]?[locations[p.split(':')[0]].mark.id]:[]);
  const why=source==='24V'?'위쪽 전원선에서 이 점까지 선 하나를 이으세요.':source==='0V'?'이 부품을 지나온 전기가 아래쪽 전원선으로 돌아가는 길입니다.':sourcePart?.kind==='contact'&&targetPart?.kind==='contact'?'두 점을 선 하나로 이으세요. 이미 선이 꽂힌 점이라도 다른 선을 한 가닥 더 이을 수 있어요.':'그림에 적힌 부품 이름을 찾고, 설명한 단자끼리 선 하나로 이으세요.';
  steps.push({lead:[source,target],title:`${simplePort(c,locations,source)}에서 ${simplePort(c,locations,target)}으로 연결`,why,marks:[...new Set(marks)]});
 }
 return steps;
}
