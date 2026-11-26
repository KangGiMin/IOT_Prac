import { useMemo, useState } from 'react';
import type { ExerciseCircuit, Lead } from './model';
import { contactSummary, numberedContacts } from './drawingContacts';
import { relay14 } from '../../config/sequencePins';
import { RelayScrewPhoto } from './RelayScrewPhoto';
import type { WiringGuide } from './easyGuide';
const colors={c:'#b35b00',a:'#08795d',b:'#205fbd','?':'#8052a0'};
export function DrawingLesson({id,c,src,power,leads,onConnect,corrected,guide}:{id:number;c:ExerciseCircuit;src:string;power:boolean;leads:Lead[];onConnect:(lead:Lead)=>void;corrected:boolean;guide:WiringGuide}){
 const marks=useMemo(()=>numberedContacts(id),[id]);
 const {steps,aliases}=guide;
 const [visible,setVisible]=useState(true),[selected,setSelected]=useState<string[]>([]),[zoom,setZoom]=useState(100),[ratio,setRatio]=useState(.75);
 const active=marks.find(m=>selected.includes(m.id));
 const activeDevice=active?.owner.startsWith('PB')?'버튼':active?.owner.startsWith('T')?'타이머':'릴레이';
 const connected=useMemo(()=>{
  const parents=new Map(c.ports.map(p=>[p,p]));const root=(p:string):string=>{const r=parents.get(p)!;if(r===p)return r;const n=root(r);parents.set(p,n);return n;};
  for(const [a,b] of [...leads,...aliases])parents.set(root(a),root(b));
  return steps.map(s=>root(s.lead[0])===root(s.lead[1]));
 },[c,leads,steps,aliases]);
 const locate=(ids:string[])=>{setVisible(true);setSelected(ids);};
 return <div className="exercise-columns drawing-lesson">
  <section className="drawing-column"><h3>도면에서 접점 찾기</h3>
   <div className="drawing-tools"><label><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/>접점 이름 표시</label><label>확대 <input aria-label="도면 확대" type="range" min={100} max={220} step={10} value={zoom} onChange={e=>setZoom(Number(e.target.value))}/>{zoom}%</label><a href={src} target="_blank" rel="noreferrer">정리된 도면 크게 열기 / 저장</a></div>
   <div className="drawing-scroll"><div className="annotated-drawing" style={{width:`${zoom}%`}}>
    <img className="exercise-original" src={src} alt={`${id}번 실습 도면 · 접점 위치 설명 포함`} onLoad={e=>setRatio(e.currentTarget.naturalHeight/e.currentTarget.naturalWidth)}/>
    {visible&&<svg className="drawing-contact-overlay" viewBox={`0 0 1000 ${ratio*1000}`} aria-label="도면 위 c a b 접점 위치" data-testid="contact-overlay">
     {marks.map(m=>{const xs=m.points.map(p=>p.x*10),ys=m.points.map(p=>p.y*ratio*10),left=Math.min(...xs),top=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys),focused=selected.includes(m.id);
      return <g key={m.id} className={`drawing-contact ${focused?'is-focused':''}`} data-contact={m.id} role="button" tabIndex={0} aria-label={`${m.number}번 ${contactSummary(m)} 도면에서 찾기`} onClick={()=>setSelected([m.id])} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected([m.id]);}}}>
       <title>{m.number}번 {contactSummary(m)}</title>
       <rect className="contact-hitbox" x={left-14} y={top-14} width={Math.max(28,right-left+28)} height={Math.max(28,bottom-top+28)} rx={10}/>
       <circle className="contact-number" cx={left-24} cy={(top+bottom)/2} r={11}/><text className="contact-number-text" x={left-24} y={(top+bottom)/2+4} textAnchor="middle">{m.number}</text>
       {m.points.map((p,index)=>{const x=p.x*10,y=p.y*ratio*10,leftSide=!(m.kind==='changeover'&&index===2);const label=`${p.role}${m.kind!=='changeover'&&m.kind!=='unknown'?'*':''}`;
        return <g key={index} className={`contact-point role-${p.role}`}><circle cx={x} cy={y} r={6} fill="white" stroke={colors[p.role]} strokeWidth={2.5}/><rect x={leftSide?x-36:x+10} y={y-10} width={25} height={20} rx={4} fill="white" stroke={colors[p.role]}/><text x={leftSide?x-24:x+22} y={y+5} textAnchor="middle" fill={colors[p.role]} fontSize={16} fontWeight={700}>{label}</text></g>;
       })}
      </g>;
     })}
    </svg>}
   </div></div>
   <div className="contact-key"><span className="key-c">c: 공통</span><span className="key-a">a: 평소 떨어짐</span><span className="key-b">b: 평소 붙음</span></div>
   <p className="contact-convention">별표(*)가 있는 두 점은 한 쌍으로 읽으세요. <b>c–a</b>는 동작하면 붙고, <b>c–b</b>는 동작하면 떨어져요. 두 점짜리 기호의 c*는 설명을 위한 기준입니다. 실제 소켓의 공통 핀이 어느 쪽인지는 핀 번호로 확인해야 해요.</p>
   <div className="contact-explanation" aria-live="polite">{active?<><strong>{active.number}번 · {contactSummary(active)}</strong><p>{active.kind==='changeover'?'c는 움직이는 선의 시작점이에요. 지금 선이 닿아 있는 점이 b, 떨어져 있는 점이 a예요. 릴레이가 동작하면 c가 b에서 떨어져 a로 옮겨 붙어요.':active.kind==='unknown'?'이 부분은 원본의 기호가 빠져 있어요. 점 위치는 표시하되 접점 종류를 확정하지 않았어요.':`${activeDevice==='버튼'?'버튼을 누르기 전':activeDevice+'가 동작하기 전'}에는 두 점이 ${active.kind==='a'?'떨어져':'붙어'} 있어요. ${activeDevice==='버튼'?'누르면':'동작하면'} ${active.kind==='a'?'두 점이 붙어 전기가 지나가요.':'두 점이 떨어져 전기가 멈춰요.'}`}</p>{active.note&&<p className="contact-note">확인할 점 · {active.note}</p>}</>:<p>그림의 번호나 아래 목록을 누르면 그 접점만 크게 눈에 띄게 표시돼요.</p>}</div>
   <details className="contact-directory"><summary>이 도면의 접점 목록 · {marks.length}곳</summary>{marks.map(m=><button key={m.id} aria-pressed={selected.includes(m.id)} onClick={()=>locate([m.id])}>{m.number}번 {contactSummary(m)}</button>)}</details>
  </section>
  <section className="beginner-wiring"><h3>한 가닥씩 따라 하는 배선</h3><p>먼저 <b>전원을 끄세요.</b> 부품 이름을 찾은 다음, 아래에 적힌 두 점을 선 하나로 이어 보세요. 같은 점에 선이 두 가닥 연결되는 곳도 있어요.</p>
   {corrected&&<p className="lesson-warning">수정안 연습 중입니다. 왼쪽 그림과 접점 이름은 원본 그대로예요. 원본에 없는 수정안 접점은 위치를 임의로 표시하지 않아요.</p>}
   <p className="easy-progress">배선 완료 {connected.filter(Boolean).length} / {steps.length}가닥</p>
   <ol className="exercise-guide easy-wiring-steps">{steps.map((step,i)=><li key={`${step.lead[0]}-${step.lead[1]}`} className={connected[i]?'is-connected':''}>
    <strong>{step.title}</strong><p>{step.why}</p>
    <div><button disabled={!step.marks.length} onClick={()=>locate(step.marks)}>이 접점 도면에서 보기</button><button disabled={power||connected[i]} onClick={()=>{locate(step.marks);onConnect(step.lead);}}>{connected[i]?'연결했어요':'이 선 연결하기'}</button></div>
   </li>)}</ol>
   <details className="contact-pin-reference"><summary>릴레이 본체 사진에서 나사 찾기</summary><RelayScrewPhoto /><p>맨 위는 a(NO), 둘째 줄은 b(NC), 맨 아래는 c(공통)입니다. 코일은 왼쪽 {relay14.coil.plus}번이 +, 오른쪽 {relay14.coil.minus}번이 −입니다.</p><table><thead><tr><th>왼쪽부터</th><th>a · NO</th><th>b · NC</th><th>c · 공통</th></tr></thead><tbody>{relay14.poles.map(({ no, nc, com }, index)=><tr key={com}><td>{index + 1}열</td><td>{no}</td><td>{nc}</td><td>{com}</td></tr>)}</tbody></table></details>
  </section>
 </div>;
}
