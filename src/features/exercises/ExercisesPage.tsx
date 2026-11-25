import { useEffect, useMemo, useState } from 'react';
import { buildExercise, describeExpression, exercises, type Lead } from './model';
import { gradeExercise, motorState, stepCircuit, stopped, type TestRow } from './solver';
import './exercises.css';
import { CompletedWorkbench } from './CompletedWorkbench';
import { DrawingLesson } from './DrawingLesson';
import { locateParts, simplePort } from './easyGuide';
const imageRoot=import.meta.env.DEV?`${import.meta.env.BASE_URL}exercises/sequence/`:new URL(/* @vite-ignore */ '../exercises/sequence/',import.meta.url).href;
const drawing=(id:number)=>`${imageRoot}${String(id).padStart(2,'0')}.png`;
export function ExercisesPage(){
 const [id,setId]=useState(1),[category,setCategory]=useState('전체'),[corrected,setCorrected]=useState(false);
 const [showCompleted, setShowCompleted] = useState(false);
 const e=exercises.find(x=>x.id===id)!;const c=useMemo(()=>buildExercise(e,corrected),[e,corrected]);
 const [leads,setLeads]=useState<Lead[]>([]),[from,setFrom]=useState(''),[to,setTo]=useState(''),[power,setPower]=useState(false),[buttons,setButtons]=useState<Record<string,boolean>>({}),[state,setState]=useState(stopped),[grade,setGrade]=useState<TestRow[]>([]);
 const choose=(n:number,fix=false)=>{setId(n);setCorrected(fix);setLeads([]);setPower(false);setButtons({});setState(stopped());setGrade([]);setFrom('');setTo('');};
 useEffect(()=>{let last=performance.now();const tick=window.setInterval(()=>{const now=performance.now(),dt=(now-last)/1000;last=now;setState(s=>stepCircuit(c,leads,buttons,s,dt,power));},50);return()=>clearInterval(tick);},[c,leads,buttons,power]);
 useEffect(()=>{const release=()=>setButtons({});window.addEventListener('blur',release);return()=>window.removeEventListener('blur',release);},[]);
 const names=[...new Set(c.parts.map(p=>p.owner).filter((p):p is string=>!!p&&p.startsWith('PB')))].sort();
 const locations=useMemo(()=>locateParts(id,c),[id,c]);
 const portLabel=(port:string)=>simplePort(c,locations,port);
 const add=()=>{if(!from||!to||from===to||power||leads.some(([a,b])=>a===from&&b===to||a===to&&b===from))return;setLeads([...leads,[from,to]]);setFrom(to);setTo('');setGrade([]);};
 return <main className="exercise-page"><a href="#">← 실습 작업대로</a><h1>연습문제 · 시퀀스 도면 24선</h1><p>수업 도면 원본을 보며 접점 단위로 배선하고 동작을 비교합니다. 이 페이지의 작업은 기존 PNG 작업대와 독립적으로 유지됩니다.</p>
 <label>카테고리 <select value={category} onChange={x=>setCategory(x.target.value)}>{['전체',...new Set(exercises.map(x=>x.category))].map(x=><option key={x}>{x}</option>)}</select></label>
 <nav className="exercise-catalog">{exercises.filter(x=>category==='전체'||x.category===category).map(x=><button aria-pressed={id===x.id} key={x.id} onClick={()=>choose(x.id)}>{String(x.id).padStart(2,'0')} · {x.title}<small>{x.category}</small></button>)}</nav>
 <div className="exercise-drawing-heading">
  <h2>{String(id).padStart(2,'0')} · {e.title}</h2>
  <button type="button" aria-haspopup="dialog" onClick={()=>setShowCompleted(true)}>완성된 작업대 보기</button>
 </div>
 <p>{e.category} 연습이에요. 먼저 그림에서 버튼과 릴레이 이름을 찾아보세요. 같은 R1이라고 적힌 접점들은 R1 릴레이가 켜질 때 함께 움직여요.</p>
 {e.note&&<p className="lesson-warning">원본 해석 주의: {e.note}</p>}{e.correction&&<label><input type="checkbox" checked={corrected} onChange={x=>choose(id,x.target.checked)}/> 수정안과 비교 (원본 이미지 보존, 배선은 새로 시작)</label>}
 <DrawingLesson key={id+':'+corrected} id={id} c={c} src={drawing(id)} power={power} leads={leads} corrected={corrected} onConnect={added=>{if(power)return;setLeads(previous=>{const next=[...previous];for(const lead of added)if(!next.some(([a,b])=>a===lead[0]&&b===lead[1]||a===lead[1]&&b===lead[0]))next.push(lead);return next;});setGrade([]);}}/>
 {showCompleted && <CompletedWorkbench exercise={e} onClose={()=>setShowCompleted(false)} />}
 <section><h3>선을 이은 뒤 이렇게 눌러 보세요</h3><ol><li>전원을 켜고 PB1을 잠깐 눌렀다 놓아요.</li><li>버튼을 놓아도 릴레이나 램프가 계속 켜지는지 보세요.</li><li>PB2를 눌러 보고, 다음에는 PB2부터 먼저 눌러 보세요. 먼저 누른 쪽이 유지되는지, 나중에 누른 쪽으로 바뀌는지 비교해요.</li><li>타이머가 있으면 그림에 적힌 초만큼 기다려요.</li><li>정지 버튼과 전원 OFF도 확인한 뒤, 아래의 자동 테스트를 눌러 결과를 비교하세요.</li></ol>
 <details><summary>접점 조건을 수식으로 자세히 보기</summary><table className="lesson-table"><thead><tr><th>부품</th><th>동작 조건 · AND는 둘 다, OR는 하나라도</th></tr></thead><tbody>{(corrected&&e.correction?e.correction:e.rungs).map(r=><tr key={r.load}><td>{r.load}</td><td>{describeExpression(r.when)}{r.kind==='timer'?` · ${r.seconds}초 기다림`:''}</td></tr>)}</tbody></table></details></section>
 <section className="exercise-bench"><h3>접점 배선 실습대 · {corrected?'수정안':'원본 해석'}</h3><p>아래에서 연결할 점 두 개를 고를 수도 있어요. 먼저 출발점을 누르고, 다음에 도착점을 누른 뒤 ‘배선 연결’을 눌러요.</p><div className="exercise-parts">{c.parts.map(p=><article key={p.id}><strong>{p.kind==='contact'?`${locations[p.id]?.mark.number?`${locations[p.id].mark.number}번`:'연습 모델'} ${p.owner} ${p.nc?'b':'a'}접점`:p.label}</strong><span>{p.kind==='contact'?`${p.owner}가 동작하면 ${p.nc?'떨어져요':'붙어요'}`:`${p.seconds?`${p.seconds}초 기다림 · `:''}${state.on[p.id]?'켜짐':'꺼짐'}`}</span>{['1','2'].map(pin=><button disabled={power} key={pin} title={portLabel(`${p.id}:${pin}`)} aria-pressed={from===`${p.id}:${pin}`} onClick={()=>{if(!from)setFrom(`${p.id}:${pin}`);else setTo(`${p.id}:${pin}`);}}>{p.kind==='contact'?`${locations[p.id]?.roles[Number(pin)-1]??(pin==='1'?'한쪽':'다른 쪽')} 점`:p.kind==='relay'||p.kind==='timer'?(pin==='1'?'+쪽':'−쪽'):(pin==='1'?'한쪽':'다른 쪽')}</button>)}</article>)}</div>
 <fieldset disabled={power}><label>출발 단자<select aria-label="연습 출발 단자" value={from} onChange={x=>setFrom(x.target.value)}><option value="">선택</option>{c.ports.map(p=><option key={p} value={p}>{portLabel(p)}</option>)}</select></label><label>도착 단자<select aria-label="연습 도착 단자" value={to} onChange={x=>setTo(x.target.value)}><option value="">선택</option>{c.ports.map(p=><option key={p} value={p}>{portLabel(p)}</option>)}</select></label><button onClick={add}>배선 연결</button><button onClick={()=>{setLeads(c.leads.map(x=>[...x]));setGrade([]);}}>해설 배선 불러오기</button><button onClick={()=>choose(id,corrected)}>배선 초기화</button></fieldset>
 <details><summary>내 배선 {leads.length}개 · 삭제</summary>{leads.map(([a,b],i)=><p key={i}>{portLabel(a)} → {portLabel(b)} <button disabled={power} onClick={()=>{setLeads(leads.filter((_,j)=>i!==j));setGrade([]);}}>삭제</button></p>)}</details>
 <button role="switch" aria-checked={power} onClick={()=>{setPower(!power);setState(stopped());}}>연습 전원 {power?'ON':'OFF'}</button>{names.map(pb=><button key={pb} aria-pressed={!!buttons[pb]} onPointerDown={x=>{x.currentTarget.setPointerCapture(x.pointerId);setButtons(b=>({...b,[pb]:true}));}} onPointerUp={()=>setButtons(b=>({...b,[pb]:false}))} onPointerCancel={()=>setButtons({})} onKeyDown={x=>{if(x.key===' '||x.key==='Enter'){x.preventDefault();setButtons(b=>({...b,[pb]:true}));}}} onKeyUp={()=>setButtons(b=>({...b,[pb]:false}))} onBlur={()=>setButtons(b=>({...b,[pb]:false}))}>{pb} 누르고 있기</button>)}
 <p role="status">{state.short?'단락: +와 −가 부하 없이 연결되었습니다. 출력을 차단했습니다.':state.unstable?'접점 경합: 안정된 상태를 찾지 못했습니다. 동시 입력을 해제하세요.':`${power?'24V 동작 중':'전원 OFF'} · ${power?motorState(e,state):'정지'}`}</p><p>{Object.entries(state.elapsed).map(([k,v])=>`${k}: ${v.toFixed(2)}s`).join(' · ')}</p>
 <button onClick={()=>setGrade(gradeExercise(e,leads,corrected))}>배선 동작 자동 테스트</button>{grade.length>0&&<><p role="status">{grade.filter(x=>x.pass).length}/{grade.length} 단계 일치 · {grade.every(x=>x.pass)?'원본 해석과 일치':'배선과 접점 종류를 확인하세요. 전원·부하 복귀·자기유지 병렬 분기를 점검하세요.'}</p><div className="lesson-table-scroll"><table className="lesson-table"><thead><tr><th>시험 조작</th><th>기준 동작</th><th>내 회로</th><th>결과</th></tr></thead><tbody>{grade.map((g,i)=><tr key={i}><td>{g.action}</td><td>{g.expected}</td><td>{g.actual}</td><td>{g.pass?'일치':'실패'}</td></tr>)}</tbody></table></div></>}
 </section><p>모터 표시는 제어 접점 상태의 교육용 방향 판독입니다. 실제 모터 권선·기동전류·기계적 지연과 원본에 없는 내부 접속은 해석하지 않습니다. 동시 입력의 기계적 우선순위를 임의로 정하지 않습니다.</p><p>접점·타이머 개념 참고: <a href="https://www.ia.omron.com/support/guide/19/further_information.html" target="_blank" rel="noreferrer">OMRON 타이머 기술 안내</a></p></main>;
}
