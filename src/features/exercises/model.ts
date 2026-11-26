export type Expression = string | {and:Expression[]} | {or:Expression[]};
export const all=(...and:Expression[]):Expression=>({and});
export const any=(...or:Expression[]):Expression=>({or});
export const describeExpression=(x:Expression):string=>typeof x==='string'?(x.startsWith('!')?`${x.slice(1)} OFF`:x):'and'in x?`(${x.and.map(describeExpression).join(' AND ')})`:`(${x.or.map(describeExpression).join(' OR ')})`;
export type TimerMode = 'on-delay' | 'off-delay';
export interface Rung {load:string;when:Expression;kind:'relay'|'timer'|'lamp'|'buzzer';seconds?:number;timerMode?:TimerMode;feed?:string}
export interface Exercise {
 id:number;title:string;category:string;rungs:Rung[];motor?:[string,string];note?:string;correction?:Rung[];
 diagram?:string; feed?:{id:string; label:string; when:Expression}; procedure?:string[];
}
const r=(load:string,when:Expression):Rung=>({load,when,kind:'relay'});
const l=(load:string,when:Expression):Rung=>({load,when,kind:'lamp'});
const hold=(pb:string,relay:string)=>any(pb,relay);
const pair=(first:boolean,stop=true)=>[1,2].map(i=>r('R'+i,all(...(stop?['!PB4']:[]),first?all(hold('PB'+i,'R'+i),'!R'+(3-i)):any('PB'+i,all('R'+i,'!R'+(3-i))))));
const triple=()=>[1,2,3].map(i=>r('R'+i,all('!PB4',any('PB'+i,all('R'+i,...[1,2,3].filter(j=>j!==i).map(j=>'!R'+j))))));
const lamps=(n=2)=>Array.from({length:n},(_,i)=>l('L'+(i+1),'R'+(i+1)));
const direction='모터 방향 제어',priority='인터록·입력 우선',sequence='자기유지·순차 제어',timer='타이머·경보';
export const exercises:Exercise[]=[
 {id:1,title:'단일 릴레이 극성 반전',category:direction,rungs:[r('R','PB1')],motor:['R','!R']},
 {id:2,title:'극성 반전과 방향 표시등',category:direction,rungs:[r('R','PB1'),l('L1','!R'),l('L2','R')],motor:['R','!R'],note:'원본 M 아래의 0V 연결은 3선식 모터의 공통선으로 해석해야 합니다. 일반 2선식 DC 모터의 극성 반전 배선과 구분하세요. 여기서는 방향 접점의 전압 차이를 표시합니다.'},
 {id:3,title:'독립 2릴레이 방향 제어',category:direction,rungs:[r('R1','PB1'),r('R2','PB2'),...lamps()],motor:['R1','R2']},
 {id:4,title:'직렬 유지접점 오류 진단',category:sequence,rungs:[r('R1',all('PB1','R1','PB3')),r('R2','PB3'),...lamps()],motor:['R1','R2'],note:'원본 PB1–R1-a 직렬은 무여자 상태에서 기동 불가입니다. PB2 오른쪽 가지는 PB2와 R2-a를 함께 우회합니다. PB3의 두 접점은 기호가 생략되어 있어 NO로 가정했습니다. 수정안은 PB3을 공통 NC 정지, 각 유지접점을 기동 버튼과 병렬로 둡니다.',correction:[r('R1',all('!PB3',hold('PB1','R1'))),r('R2',all('!PB3',hold('PB2','R2'))),...lamps()]},
 {id:5,title:'운전 허가와 방향 선택 분리',category:direction,rungs:[r('R1',all(hold('PB1','R1'),'!PB2')),r('R2',all('R1','!PB3'))],motor:['R2','!R2'],note:'R1은 기동·정지 허가, PB3은 R2 방향 선택입니다. 원본의 R1 직렬 접점으로 모터 전원을 허가하는 구조입니다.'},
 {id:6,title:'후입력 우선 방향 제어 A',category:priority,rungs:pair(false),motor:['R1','R2']},
 {id:7,title:'후입력 우선 방향 제어 B',category:priority,rungs:pair(false),motor:['R1','R2']},
 {id:8,title:'선입력 우선 방향 제어 A',category:priority,rungs:pair(true),motor:['R1','R2']},
 {id:9,title:'선입력 우선 방향 제어 B',category:priority,rungs:pair(true),motor:['R1','R2']},
 {id:10,title:'운전 허가와 교차 유지접점 진단',category:priority,rungs:[r('R3',all(hold('PB3','R3'),'!PB4')),r('R1',all('R3',hold('PB1','R1'),'!R2')),r('R2',all('R3',any('PB2','R1'),'!R1'))],motor:['R2','!R2'],note:'원본 R2 가지의 유지접점이 R1로 표기되어 있습니다. R1-a와 R1-b를 동시에 요구하는 유지 경로는 성립하지 않습니다. 수정안은 해당 R1-a를 R2-a로 바꿉니다.',correction:[r('R3',all(hold('PB3','R3'),'!PB4')),r('R1',all('R3',hold('PB1','R1'),'!R2')),r('R2',all('R3',hold('PB2','R2'),'!R1'))]},
 {id:11,title:'운전 허가형 후입력 우선',category:priority,rungs:[r('R3',all(hold('PB3','R3'),'!PB4')),...pair(false,false).map(x=>({...x,when:all('R3',x.when)}))],motor:['R1','R2']},
 {id:12,title:'공통 정지형 후입력 우선',category:priority,rungs:pair(false),motor:['R1','R2']},
 {id:13,title:'2단 순차 기동·자기유지',category:sequence,rungs:[r('R1',hold('PB1','R1')),r('R2',all(hold('PB2','R2'),'R1')),...lamps()]},
 {id:14,title:'순차 기동과 공통 출력 표시',category:sequence,rungs:[r('R1',all(hold('PB1','R1'),'!PB3')),r('R2',all(hold('PB2','R2'),'R1')),l('L1','R2'),l('L2','R2')],note:'원본의 L1과 L2 접점 모두 R2-a입니다. 두 램프가 함께 켜지는 원본 동작을 유지합니다.'},
 {id:15,title:'3단 순차 기동·연쇄 해제',category:sequence,rungs:[r('R1',all(hold('PB1','R1'),'!PB4')),r('R2',all(hold('PB2','R2'),'R1')),r('R3',all(hold('PB3','R3'),'R2')),...lamps(3)]},
 {id:16,title:'1초·3초 순차 지연 점등',category:timer,rungs:[r('R1',all(hold('PB1','R1'),'!PB2')),{load:'T2',kind:'timer',when:'R1',seconds:1},l('PL1','T2'),{load:'T1',kind:'timer',when:'T2',seconds:3},l('PL2','T1')]},
 {id:17,title:'3초 후 자동 해제',category:timer,rungs:[r('R1',all(hold('PB1','R1'),'!T1')),l('LAMP1',hold('PB1','R1')),{load:'T1',kind:'timer',when:'R1',seconds:3}],note:'PB1을 놓으면 약 3초 뒤 해제됩니다. PB1을 계속 누르면 타이머 재설정과 재기동이 반복될 수 있습니다.'},
 {id:18,title:'3지점 기동·0.3초 부저',category:timer,rungs:[r('R1',all(any('PB1','PB2','PB3','R1'),'!PB4')),l('LAMP1',any('PB1','PB2','PB3','R1')),{load:'T1',kind:'timer',when:'R1',seconds:.3},{load:'BZ',kind:'buzzer',when:all('R1','!T1')}]},
 {id:19,title:'후입력 우선 표시 회로',category:priority,rungs:[...pair(false,false),...lamps()]},
 {id:20,title:'공통 정지·후입력 우선 표시',category:priority,rungs:[...pair(false),...lamps()]},
 {id:21,title:'3입력 후입력 우선',category:priority,rungs:[...triple(),...lamps(3)]},
 {id:22,title:'3입력 후입력 우선·모터 운전',category:priority,rungs:[...triple(),...lamps(3)],motor:['ANY','OFF'],note:'R1/R2/R3 a접점 병렬은 모터를 한 방향으로 운전합니다. 역전 회로가 아닙니다. 램프는 각 코일과 병렬입니다.'},
 {id:23,title:'자기유지 운전과 전환 표시',category:sequence,rungs:[r('R',all(hold('PB1','R'),'!PB2')),l('L1','!R'),l('L2','R')],motor:['R','OFF'],note:'원본은 R-a로 모터를 급전하고 R-c로 L1/L2를 절환합니다. 모터 권선·단자 내부도가 없어 CW/CCW를 확정하지 않고 운전/정지로 표시합니다.'},
 {id:24,title:'비유지 인터록 H 브리지',category:direction,rungs:[r('R1',all('PB1','!R2')),r('R2',all('PB2','!R1'))],motor:['R1','R2'],note:'교차된 a접점으로 극성을 반전합니다. 동시 입력은 물리적 접점 지연에 따라 경합할 수 있어 보장된 우선순위로 채점하지 않습니다.'},
 {
  id:25,title:'깜박이 회로 1 · 램프 한 개',category:timer,diagram:'25.svg',
  rungs:[
   r('R1',all(hold('PB1','R1'),'!PB2')),
   {load:'T1',kind:'timer',when:all('R1','!T2'),seconds:1,timerMode:'on-delay'},
   {load:'T2',kind:'timer',when:'T1',seconds:1,timerMode:'off-delay'},
   l('LAMP1',all('R1','!T2')),
  ],
  note:'교재 29쪽에는 타이머 시간이 적혀 있지 않아 실습에서는 T1과 T2를 각각 1초로 설정했어요.',
  procedure:[
   '전원을 켜고 PB1을 짧게 눌렀다 놓으세요. R1이 켜진 채로 유지되고 LAMP1이 바로 켜져요.',
   'T1의 1초가 지나면 T2가 켜져 램프가 꺼져요. T2는 전원이 끊긴 뒤에도 1초 동안 접점을 유지해요. 그 시간이 끝나면 램프가 다시 켜져요.',
   '몇 번 깜박인 뒤 PB2를 누르세요. R1이 풀리고 램프가 즉시 꺼져요. 아래 자동 테스트에서도 켜짐·꺼짐·정지 순서를 확인할 수 있어요.',
  ],
 },
 {
  id:26,title:'깜박이 회로 2 · 램프 교대 점등',category:timer,diagram:'26.svg',
  feed:{id:'blink-feed',label:'점선 공통 전원선',when:'R1'},
  rungs:[
   r('R1',all(hold('PB1','R1'),'!PB2')),
   {load:'T1',kind:'timer',when:'!T2',feed:'blink-feed',seconds:.5,timerMode:'on-delay'},
   {load:'T2',kind:'timer',when:'T1',feed:'blink-feed',seconds:.5,timerMode:'off-delay'},
   {...l('LAMP1','!T2'),feed:'blink-feed'},
   {...l('LAMP2','T2'),feed:'blink-feed'},
  ],
  note:'교재 30쪽의 점선은 R1 접점을 지난 공통 전원선이에요. 점선을 위쪽 +24V에 바로 잇지 말고, 4번 R1 접점 아래쪽에서 네 갈래로 나누세요.',
  procedure:[
   '전원을 켜고 PB1을 짧게 눌렀다 놓으세요. R1이 점선에 전원을 보내고 LAMP1부터 켜져요.',
   '0.5초 뒤 T1이 동작하면 T2가 켜지면서 LAMP1은 꺼지고 LAMP2가 켜져요. 다시 0.5초 뒤 T2가 풀리면 LAMP1으로 돌아와요.',
   'PB2를 누르면 점선에 공급되는 전원이 끊겨 두 램프가 바로 꺼져요. 아래 자동 테스트에서도 교대로 켜지는 순서를 확인할 수 있어요.',
  ],
 },
];
export interface Part {id:string;label:string;kind:Rung['kind']|'contact'|'motor';owner?:string;nc?:boolean;seconds?:number;timerMode?:TimerMode;purpose?:string;pole?:number}
export type Lead=[string,string];
export interface ExerciseCircuit {parts:Part[];leads:Lead[];ports:string[]}
/** Explicit netlist: contacts conduct, loads never merge their two terminals. */
export function buildExercise(e:Exercise,corrected=false):ExerciseCircuit {
 const parts:Part[]=[],leads:Lead[]=[];let serial=0,purpose='',pole:number|undefined;
 const wire=(a:string,b:string)=>{leads.push([a,b]);};
 const path=(expr:Expression,a:string,b:string)=>{if(typeof expr==='string'){const nc=expr.startsWith('!'),owner=nc?expr.slice(1):expr,id='C'+(++serial);parts.push({id,label:`${owner} ${nc?'b (NC)':'a (NO)'}`,kind:'contact',owner,nc,purpose,pole});wire(a,id+':1');wire(id+':2',b);}else if('or'in expr)expr.or.forEach(x=>path(x,a,b));else expr.and.forEach((x,i)=>path(x,i===0?a:`J${serial}-${i}`,i===expr.and.length-1?b:`J${serial}-${i+1}`));};
 // Give each series junction a stable unique name independent of recursion.
 const connect=(expr:Expression,a:string,b:string)=>{if(typeof expr==='string'||'or'in expr){if(typeof expr!=='string')expr.or.forEach(x=>connect(x,a,b));else path(expr,a,b);}else{const nodes=[a,...expr.and.slice(1).map(()=>`J${++serial}`),b];expr.and.forEach((x,i)=>connect(x,nodes[i],nodes[i+1]));}};
 if(e.feed){purpose=e.feed.id;connect(e.feed.when,'24V',e.feed.id);}
 for(const rung of corrected&&e.correction?e.correction:e.rungs){purpose=rung.load;parts.push({id:rung.load,label:rung.load,kind:rung.kind,seconds:rung.seconds,timerMode:rung.timerMode});
  if(e.id===22&&rung.kind==='lamp'&&typeof rung.when==='string')wire(rung.when+':1',rung.load+':1');
  else connect(rung.when,rung.feed??'24V',rung.load+':1');
  wire(rung.load+':2','0V');
 }
 if(e.motor){purpose='M';parts.push({id:'M',label:'모터 (교육용 2단자 등가 모델)',kind:'motor'});
  const invert=(x:Expression):Expression=>typeof x==='string'?(x.startsWith('!')?x.slice(1):'!'+x):'or'in x?all(...x.or.map(invert)):any(...x.and.map(invert));
  if(e.id===24){pole=0;connect('R1','24V','M:1');connect('R2','0V','M:1');pole=1;connect('R2','24V','M:2');connect('R1','0V','M:2');}
  else e.motor.forEach((signal,i)=>{pole=i;const terminal=`M:${i+1}`;if(signal==='OFF'){wire(terminal,'0V');return;}const expr:Expression=signal==='ANY'?any(...e.rungs.filter(r=>r.kind==='relay').map(r=>r.load)):signal;
   const source=e.id===5?'M-enable':e.id===10?'M-enable':'24V';
   connect(expr,source,terminal);if(e.id!==22&&e.id!==23)connect(invert(expr),'0V',terminal);
  });
  pole=undefined;if(e.id===5||e.id===10)connect(e.id===5?'R1':'R3','24V','M-enable');
 }
 const ports=[...new Set(['24V','0V',...parts.flatMap(p=>[p.id+':1',p.id+':2']),...leads.flat()])];
 return {parts,leads,ports};
}
