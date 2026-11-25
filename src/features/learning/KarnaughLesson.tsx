import { useMemo, useState } from 'react';
import { logicMissions } from '../workbench/data/logicMissions';
import { combineTerms, mapLayout, minimizeKMap, validateKGroup } from './kmap';
import type { KGroup, KMode, KValue } from './kmap';
const colors=['#189b7b','#437de1','#c47b18','#a56bd1','#dc627a','#348d9e'];
export function KarnaughLesson() {
  const [variables,setVariables]=useState(2),[values,setValues]=useState<KValue[]>([0,1,1,1]);
  const [mode,setMode]=useState<KMode>('sop'),[selecting,setSelecting]=useState(false),[selection,setSelection]=useState<number[]>([]),[groups,setGroups]=useState<KGroup[]>([]);
  const [message,setMessage]=useState('칸을 클릭하면 0 → 1 → X 순서로 바뀝니다.'),[showAnswer,setShowAnswer]=useState(false);
  const layout=mapLayout(variables),answer=useMemo(()=>minimizeKMap(values,variables,mode),[values,variables,mode]);
  const reset=(next:KValue[],count=variables)=>{setVariables(count);setValues(next);setGroups([]);setSelection([]);setShowAnswer(false);setSelecting(false);setMessage('출력 값을 정한 뒤 묶음을 만들어 보세요.');};
  const load=(id:string)=>{
    if(id==='corners'){reset(Array.from({length:16},(_,i)=>[0,2,8,10].includes(i)?1:0),4);setMode('sop');return;}
    if(id==='dontcare'){reset([1,'X',0,0,1,'X',0,0],3);setMode('sop');return;}
    const mission=logicMissions.find(m=>m.id===id);if(!mission)return;
    reset(Array.from({length:4},(_,i)=>mission.truthTable.find(row=>row.a===(i>>1)&&(mission.inputs===1||row.b===(i&1)))!.output),2);
  };
  const addGroup=()=>{
    const result=validateKGroup(selection,values,variables,mode);
    if(result.error){setMessage(result.error);return;}
    if(groups.some(g=>g.mask===result.group!.mask)){setMessage('이미 추가한 묶음입니다.');return;}
    setGroups([...groups,result.group!]);setSelection([]);setMessage(`묶음 추가: ${result.group!.term}. 변하지 않는 변수만 남깁니다.`);
  };
  return <div className="karnaugh-lesson">
    <div className="lesson-intro"><div><h3>카르노 맵 · 진리표에서 간단한 회로로</h3><p>출력 값이 같은 이웃 칸을 묶으면 변하는 입력은 사라지고, 고정된 입력만 식에 남습니다. 먼저 직접 묶고 자동 최소식과 비교해 보세요.</p></div></div>
    <div className="lesson-fields"><label className="lesson-field"><span>변수 수</span><select aria-label="카르노 변수 수" value={variables} onChange={e=>reset(Array(2**Number(e.target.value)).fill(0),Number(e.target.value))}><option value={2}>2변수 A B</option><option value={3}>3변수 A B C</option><option value={4}>4변수 A B C D</option></select></label>
      <label className="lesson-field"><span>간소화 형식</span><select aria-label="카르노 간소화 형식" value={mode} onChange={e=>{setMode(e.target.value as KMode);setGroups([]);setSelection([]);setShowAnswer(false);}}><option value="sop">SOP · 1을 묶어 곱의 합</option><option value="pos">POS · 0을 묶어 합의 곱</option></select></label>
      <label className="lesson-field"><span>예제 불러오기</span><select aria-label="카르노 예제" defaultValue="" onChange={e=>{load(e.target.value);e.currentTarget.value='';}}><option value="" disabled>예제 선택</option>{logicMissions.map(m=><option key={m.id} value={m.id}>{m.id}{m.id==='NOT'?' (B 무관)':''}</option>)}<option value="corners">4변수 · 네 모서리 묶기</option><option value="dontcare">3변수 · Don’t care 활용</option></select></label></div>
    <div className="lesson-grid">
      <section className="lesson-card"><h4>Gray 코드 맵</h4><p className="lesson-small">행: {'ABCD'.slice(0,layout.rowBits)} · 열: {'ABCD'.slice(layout.rowBits,variables)}. {selecting?'묶을 칸을 선택하세요.':'출력 값을 클릭해 수정하세요.'}</p>
        <div className="lesson-table-scroll"><table className="kmap-table"><thead><tr><th>행 / 열</th>{layout.cols.map(col=><th key={col}>{col.toString(2).padStart(layout.colBits,'0')}</th>)}</tr></thead><tbody>{layout.rows.map(row=><tr key={row}><th>{row.toString(2).padStart(layout.rowBits,'0')}</th>{layout.cols.map(col=>{
          const index=(row<<layout.colBits)|col, memberships=groups.flatMap((g,i)=>g.cells.includes(index)?[i]:[]);
          return <td key={col}><button aria-label={`카르노 셀 m${index}: ${values[index]}`} aria-pressed={selection.includes(index)} className={`kmap-cell ${selection.includes(index)?'is-selected':''}`}
            style={memberships.length?{boxShadow:`inset 0 0 0 3px ${colors[memberships[0]%colors.length]}`,background:`${colors[memberships[0]%colors.length]}20`}:undefined}
            onClick={()=>{if(selecting)setSelection(selection.includes(index)?selection.filter(i=>i!==index):[...selection,index]);else {setValues(values.map((v,i)=>i!==index?v:v===0?1:v===1?'X':0));setGroups([]);setShowAnswer(false);}}}>
            <small>m{index} · {index.toString(2).padStart(variables,'0')}</small><strong>{values[index]}</strong><span>{memberships.map(i=>`G${i+1}`).join(' ')||'　'}</span></button></td>;
        })}</tr>)}</tbody></table></div>
        <div className="lesson-actions"><button aria-pressed={selecting} onClick={()=>{setSelecting(!selecting);setSelection([]);}}>{selecting?'값 편집으로 전환':'묶음 선택 모드'}</button><button disabled={!selecting} onClick={addGroup}>선택 칸 묶기</button><button onClick={()=>{setGroups([]);setSelection([]);setShowAnswer(false);}}>묶음 지우기</button></div>
        <p className="lesson-result" role="status">{message}</p>
      </section>
      <section className="lesson-card"><h4>내가 만든 묶음과 식</h4>{groups.length?<ol className="kmap-groups">{groups.map((g,i)=><li key={g.mask}><span style={{color:colors[i%colors.length]}}>G{i+1}</span> · {'{'}{g.cells.join(', ')}{'}'} → <code>{g.term}</code><button aria-label={`묶음 G${i+1} 삭제`} onClick={()=>setGroups(groups.filter(other=>other!==g))}>삭제</button></li>)}</ol>:<p>아직 묶음이 없습니다. 1칸도 유효하지만 가능한 큰 직사각형을 먼저 찾아보세요.</p>}
        <p className="lesson-formula">F = {combineTerms(groups,mode)}</p>
        <div className="lesson-actions"><button onClick={()=>{
          const target=mode==='sop'?1:0,missing=values.flatMap((v,i)=>v===target&&!groups.some(g=>g.cells.includes(i))?[i]:[]);
          const invalid=groups.map(g=>validateKGroup(g.cells,values,variables,mode)).find(r=>r.error);
          setMessage(invalid?.error??(missing.length?`아직 덮지 않은 ${target}: m${missing.join(', m')}`:`모든 ${target}을 덮었습니다. ${groups.length}묶음 · 자동 최소 답안 ${answer.groups.length}묶음. 같은 값의 최소식이 여러 개일 수 있습니다.`));
        }}>내 묶음 검사</button><button className="lesson-primary" onClick={()=>setShowAnswer(true)}>자동 간소화 보기</button></div>
        {showAnswer&&<div className="kmap-answer"><h5>최소 {mode.toUpperCase()} 식</h5><p className="lesson-formula" data-testid="kmap-expression">F = {answer.expression}</p><p>{answer.groups.length}개 항 · 리터럴 {answer.literals}개</p><ol>{answer.groups.map((g,i)=><li key={g.mask}>{g.cells.map(c=>`m${c}`).join(', ')} → {g.pattern} → <strong>{g.term}</strong>{i===0?'':''}</li>)}</ol><button onClick={()=>{setGroups(answer.groups);setMessage('자동 묶음을 맵에 표시했습니다. 가장자리의 연결도 살펴보세요.');}}>자동 묶음 표시</button></div>}
        <details className="lesson-details"><summary>전체 진리표와 최소항 번호</summary><table className="lesson-table"><thead><tr><th>m</th><th>{'ABCD'.slice(0,variables)}</th><th>F</th></tr></thead><tbody>{values.map((v,i)=><tr key={i}><td>{i}</td><td>{i.toString(2).padStart(variables,'0')}</td><td>{v}</td></tr>)}</tbody></table></details>
      </section>
    </div>
    <div className="lesson-reading">
      <details open className="lesson-details"><summary>1. 왜 00, 01, 11, 10 순서인가요?</summary><p>이 순서는 Gray 코드입니다. 가로·세로의 이웃은 입력 하나만 다릅니다. 예를 들어 AB=00과 01은 B만 바뀌므로 두 칸을 묶으면 B가 소거됩니다. 01 다음에 10을 놓으면 두 비트가 동시에 바뀌어 이 규칙을 사용할 수 없습니다. 3변수는 A / BC, 4변수는 AB / CD로 나눕니다.</p></details>
      <details open className="lesson-details"><summary>2. 묶음 만들기 · 2의 거듭제곱 · 가장자리 연결</summary><p>SOP에서는 1을, POS에서는 0을 묶습니다. 묶음은 1·2·4·8·16칸의 직사각형이어야 합니다. 맵의 왼쪽과 오른쪽, 위쪽과 아래쪽도 서로 붙어 있다고 생각하세요. 네 모서리는 하나의 4칸 묶음이 될 수 있지만 대각선 두 칸이나 L자 모양은 묶을 수 없습니다. 한 칸을 여러 묶음에서 재사용하는 중복 묶기는 허용됩니다.</p></details>
      <details open className="lesson-details"><summary>3. 묶음에서 식을 읽는 방법</summary><p>각 묶음의 모든 칸에서 값이 같은 변수만 남깁니다. SOP에서는 고정 1은 A, 고정 0은 ¬A로 쓰고 변수들을 AND로 연결합니다. 마지막으로 묶음들의 항을 OR로 합칩니다. POS는 0을 묶으므로 고정 0을 A, 고정 1을 ¬A로 쓰고 각 괄호 안은 OR, 괄호 사이는 AND로 연결합니다.</p><p>예: 4변수에서 m0·m2·m8·m10은 네 모서리입니다. A와 C는 변하지만 B=0, D=0은 고정이므로 SOP 항은 ¬B·¬D입니다.</p></details>
      <details className="lesson-details"><summary>4. 큰 묶음 · 주항 · 필수 주항 · 최소식</summary><p>2칸을 묶으면 변수 1개, 4칸이면 2개, 8칸이면 3개를 없앨 수 있습니다. 더 큰 유효 묶음에 포함되지 않는 묶음을 주항이라고 합니다. 어떤 1을 덮는 주항이 오직 하나라면 그 주항은 필수입니다. 큰 묶음만 무작정 고르는 대신 모든 필요한 칸을 덮어야 합니다. 이 도구는 항 수가 가장 적은 답을 찾고, 항 수가 같으면 리터럴 수가 적은 답을 선택합니다.</p></details>
      <details className="lesson-details"><summary>5. X(Don’t care)와 0·1 상수 함수</summary><p>X는 해당 입력 조합의 출력이 명세에 없다는 뜻입니다. 식을 줄이는 데 유리할 때만 0 또는 1처럼 활용하고, 반드시 묶을 필요는 없습니다. X만 있는 묶음은 불필요합니다. 모든 입력에서 0이면 F=0, 모두 1이면 F=1입니다. 전부 X인 맵은 정해진 출력이 없으므로 0이나 1 모두 유효하며 이 도구는 선택한 형식의 기본 상수로 표시합니다.</p></details>
      <details className="lesson-details"><summary>6. 실습 순서와 자주 하는 실수</summary><ol><li>진리표의 입력을 이진수로 읽고 최소항 m 번호를 붙입니다.</li><li>Gray 코드 순서의 칸에 출력 값을 옮깁니다.</li><li>가장 큰 유효 묶음과 필수 묶음을 찾습니다.</li><li>빠진 1(SOP) 또는 0(POS)이 없는지 확인합니다.</li><li>고정 변수로 식을 쓰고 모든 입력 조합으로 원래 진리표와 비교합니다.</li></ol><p>대각선 묶기, 3칸·6칸 묶기, X를 무조건 포함하기, SOP에서 0을 섞기, 가장자리 연결을 놓치기, 식이 짧아졌다는 이유만으로 빠진 칸을 무시하는 실수를 주의하세요. 간소화는 정적 논리 기능을 보존하지만 실제 게이트 지연으로 생기는 해저드까지 자동 제거하지는 않습니다.</p></details>
      <p className="lesson-source">학습 참고: <a href="https://www.ece.uvic.ca/~amiralib/courses/CENG241/Lecture5-CENG241-2012.pdf" target="_blank" rel="noreferrer">University of Victoria · Karnaugh map 강의</a></p>
    </div>
  </div>;
}
