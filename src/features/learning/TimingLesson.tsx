import { useMemo, useRef, useState } from 'react';
import type { LogicGate } from '../../types/circuit';
import { logicMissions } from '../workbench/data/logicMissions';
import { engineering } from '../scope/model';
import { downloadText } from './download';
import {
  evaluateLogic,
  expressionVariables,
  gateExpressions,
  parseLogicExpression,
  timingEvents,
  timingValue,
} from './timing';
import type { LogicBit, TimingEvent } from './timing';
interface TimingRow {
  name: string;
  color: string;
  events: TimingEvent[];
}
const nextBit = (value: LogicBit): LogicBit => (value === 'X' ? 0 : value === 0 ? 1 : 'X');
const initialInputs = (): Record<string, LogicBit[]> =>
  Object.fromEntries(
    'ABCD'
      .split('')
      .map((name, i) => [
        name,
        Array.from({ length: 8 }, (_, slot) => ((slot >> [1, 0, 2, 3][i]) & 1) as 0 | 1),
      ]),
  );
const highConditions: Record<LogicGate, string> = {
  AND: '모든 입력이 1',
  OR: '하나 이상이 1',
  NOT: '입력이 0',
  NAND: '입력 중 하나 이상이 0',
  NOR: '모든 입력이 0',
  XOR: '두 입력이 서로 다름',
  XNOR: '두 입력이 서로 같음',
};
export function TimingLesson() {
  const [gate, setGate] = useState<LogicGate | 'custom' | 'AND3'>('NAND');
  const [source, setSource] = useState('!(A & B)'),
    [slots, setSlots] = useState(8),
    [inputs, setInputs] = useState(initialInputs);
  const [step, setStep] = useState(1),
    [unit, setUnit] = useState(1e-3),
    [delay, setDelay] = useState(0);
  const [answer, setAnswer] = useState<LogicBit[]>(Array(8).fill('X')),
    [show, setShow] = useState(true),
    [all, setAll] = useState(false),
    [graded, setGraded] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const parsed = useMemo(() => {
    try {
      return { tree: parseLogicExpression(source), error: '' };
    } catch (error) {
      return { tree: null, error: (error as Error).message };
    }
  }, [source]);
  const variables = parsed.tree ? expressionVariables(parsed.tree) : ['A', 'B'];
  const delta = step * unit,
    latency = delay * unit,
    total = slots * delta + latency;
  const expected = Array.from({ length: slots }, (_, i) =>
    parsed.tree
      ? evaluateLogic(
          parsed.tree,
          Object.fromEntries(variables.map((v) => [v, inputs[v]?.[i] ?? 'X'])),
        )
      : 'X',
  );
  const output = timingEvents(expected, delta, latency);
  const atCenters = Array.from({ length: slots }, (_, i) => timingValue(output, (i + 0.5) * delta));
  const rows: TimingRow[] = variables.map((v, i) => ({
    name: v,
    color: ['#d6a000', '#3485d9', '#9a67c9', '#259276'][i],
    events: timingEvents(inputs[v].slice(0, slots), delta),
  }));
  if (show) rows.push({ name: 'Y 정답', color: '#159477', events: output });
  if (all)
    for (const mission of logicMissions) {
      const tree = parseLogicExpression(gateExpressions[mission.id]);
      rows.push({
        name: mission.id,
        color: '#5576ad',
        events: timingEvents(
          Array.from({ length: slots }, (_, i) =>
            evaluateLogic(tree, { A: inputs.A[i], B: inputs.B[i] }),
          ),
          delta,
          latency,
        ),
      });
    }
  rows.push({ name: '내 출력', color: '#ca617f', events: timingEvents(answer, delta) });
  const width = 1100,
    left = 100,
    right = 1080,
    plot = right - left,
    height = 70 + rows.length * 68;
  const invalidate = () => setGraded(false);
  const choose = (value: typeof gate) => {
    setGate(value);
    if (value !== 'custom') setSource(value === 'AND3' ? 'A & B & C' : gateExpressions[value]);
    invalidate();
  };
  const countPattern = () => {
    const names = variables.length ? variables : ['A', 'B'];
    setInputs(
      Object.fromEntries(
        'ABCD'
          .split('')
          .map((name) => [
            name,
            Array.from({ length: slots }, (_, i) =>
              names.includes(name)
                ? (((i >> Math.max(0, names.length - 1 - names.indexOf(name))) & 1) as 0 | 1)
                : 0,
            ),
          ]),
      ),
    );
    invalidate();
  };
  return (
    <div className="timing-lesson">
      <div className="lesson-intro">
        <div>
          <h3>논리회로 타임 차트 · 입력 변화에서 출력 파형까지</h3>
          <p>
            입력을 구간별로 바꾸고 출력 Y를 직접 그려 보세요. 7가지 기본 게이트뿐 아니라 A~D를
            조합한 사용자 논리식도 계산합니다.
          </p>
        </div>
      </div>
      <div className="lesson-fields">
        <label className="lesson-field">
          <span>논리회로</span>
          <select
            aria-label="타임 차트 논리회로"
            value={gate}
            onChange={(e) => choose(e.target.value as typeof gate)}
          >
            {logicMissions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
            <option value="AND3">7411 · 3입력 AND</option>
            <option value="custom">사용자 조합 논리식</option>
          </select>
        </label>
        <label className="lesson-field timing-expression">
          <span>논리식 · ! NOT / & AND / | OR / ^ XOR</span>
          <input
            aria-label="타임 차트 논리식"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setGate('custom');
              invalidate();
            }}
            maxLength={300}
          />
        </label>
        <label className="lesson-field">
          <span>구간 수</span>
          <select
            aria-label="타임 차트 구간 수"
            value={slots}
            onChange={(e) => {
              const n = Number(e.target.value);
              setSlots(n);
              setInputs(
                Object.fromEntries(
                  Object.entries(inputs).map(([k, v]) => [
                    k,
                    Array.from({ length: n }, (_, i) => v[i] ?? 0),
                  ]),
                ),
              );
              setAnswer(Array(n).fill('X'));
              invalidate();
            }}
          >
            <option value={8}>8</option>
            <option value={16}>16</option>
          </select>
        </label>
        <label className="lesson-field">
          <span>한 구간 시간</span>
          <input
            type="number"
            aria-label="한 구간 시간"
            min={0.1}
            max={1000}
            step={0.1}
            value={step}
            onChange={(e) => {
              const v = e.target.valueAsNumber;
              if (Number.isFinite(v)) {
                const next = Math.min(1000, Math.max(0.1, v));
                setStep(next);
                setDelay((d) => Math.min(d, next * 2));
                invalidate();
              }
            }}
          />
        </label>
        <label className="lesson-field">
          <span>시간 단위</span>
          <select
            aria-label="타임 차트 시간 단위"
            value={unit}
            onChange={(e) => {
              setUnit(Number(e.target.value));
              invalidate();
            }}
          >
            <option value={1e-9}>ns</option>
            <option value={1e-6}>µs</option>
            <option value={1e-3}>ms</option>
            <option value={1}>s</option>
          </select>
        </label>
        <label className="lesson-field">
          <span>전파 지연 · 같은 단위</span>
          <input
            type="number"
            aria-label="전파 지연"
            min={0}
            max={step * 2}
            step={0.1}
            value={delay}
            onChange={(e) => {
              const v = e.target.valueAsNumber;
              if (Number.isFinite(v)) {
                setDelay(Math.min(step * 2, Math.max(0, v)));
                invalidate();
              }
            }}
          />
        </label>
      </div>
      {parsed.error && (
        <p role="alert" className="lesson-warning">
          {parsed.error}
        </p>
      )}
      <div className="lesson-actions">
        <button onClick={countPattern}>모든 입력 조합 채우기</button>
        <button
          onClick={() => {
            setShow(!show);
            invalidate();
          }}
        >
          {show ? '정답 출력 가리고 연습' : '정답 출력 보기'}
        </button>
        <label className="lesson-check">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          7가지 게이트 출력 동시에 비교
        </label>
      </div>
      <div className="lesson-card">
        <h4>입력과 내 출력 편집</h4>
        <p className="lesson-small">
          칸을 클릭하면 X → 0 → 1 → X로 바뀝니다. 타임 차트에서 X는 미정 상태이며 카르노 맵의 Don’t
          care와 의미가 다릅니다.
        </p>
        <div className="lesson-table-scroll">
          <table className="timing-input-table">
            <thead>
              <tr>
                <th>신호 / 구간</th>
                {Array.from({ length: slots }, (_, i) => (
                  <th key={i}>t{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variables.map((v) => (
                <tr key={v}>
                  <th>{v}</th>
                  {inputs[v].slice(0, slots).map((bit, i) => (
                    <td key={i}>
                      <button
                        aria-label={`입력 ${v} t${i}: ${bit}`}
                        className={`timing-bit bit-${bit}`}
                        onClick={() => {
                          setInputs({
                            ...inputs,
                            [v]: inputs[v].map((b, j) => (j === i ? nextBit(b) : b)),
                          });
                          invalidate();
                        }}
                      >
                        {bit}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th>내 출력 Y</th>
                {answer.map((bit, i) => (
                  <td key={i}>
                    <button
                      aria-label={`내 출력 t${i}: ${bit}`}
                      className={`timing-bit bit-${bit} ${graded ? (bit === atCenters[i] ? 'answer-pass' : 'answer-fail') : ''}`}
                      onClick={() => {
                        setAnswer(answer.map((b, j) => (j === i ? nextBit(b) : b)));
                        invalidate();
                      }}
                    >
                      {bit}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="lesson-actions">
          <button
            className="lesson-primary"
            disabled={!parsed.tree}
            onClick={() => setGraded(true)}
          >
            내 타임 차트 채점
          </button>
          <button
            onClick={() => {
              setAnswer(Array(slots).fill('X'));
              invalidate();
            }}
          >
            내 출력 지우기
          </button>
        </div>
        {graded && (
          <p className="lesson-result" role="status" data-testid="timing-score">
            {Math.round((answer.filter((b, i) => b === atCenters[i]).length / slots) * 100)}점 ·{' '}
            {answer.filter((b, i) => b === atCenters[i]).length}/{slots}구간 일치. 각 구간 중앙
            시점의 지연 반영 출력을 검사했습니다.
          </p>
        )}
      </div>
      <div className="timing-chart-wrap">
        <svg
          ref={svg}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${width} ${height}`}
          className="timing-chart"
          role="img"
          aria-label="입력과 논리 출력의 타임 차트"
        >
          <rect width={width} height={height} fill="var(--theme-surface, white)" />
          {Array.from({ length: slots + 1 }, (_, i) => {
            const x = left + ((i * delta) / total) * plot;
            return (
              <g key={i}>
                <path
                  d={`M ${x} 28 V ${height - 22}`}
                  stroke="var(--theme-border, #dce7e0)"
                  strokeDasharray="3 4"
                />
                <text
                  x={x}
                  y={18}
                  textAnchor="middle"
                  fontSize={12}
                  fill="var(--theme-muted, #607e6e)"
                >
                  {engineering(i * delta, 's')}
                </text>
              </g>
            );
          })}
          {rows.map((row, index) => {
            const high = 42 + index * 68,
              low = high + 32;
            return (
              <g key={row.name}>
                <text x={8} y={high + 21} fontSize={14} fill={row.color}>
                  {row.name}
                </text>
                {row.events.map((event, i) => {
                  const next = row.events[i + 1],
                    from = left + (event.t / total) * plot,
                    to = Math.min(right, left + ((next?.t ?? total) / total) * plot),
                    y = event.value === 1 ? high : low;
                  if (from > right) return null;
                  if (event.value === 'X')
                    return (
                      <g key={i}>
                        <rect
                          x={from}
                          y={high}
                          width={Math.max(0, to - from)}
                          height={32}
                          fill="#dca72b22"
                        />
                        <path
                          d={`M ${from} ${high + 16} H ${to}`}
                          stroke="#ba8b21"
                          strokeDasharray="4 3"
                        />
                        <text
                          x={(from + to) / 2}
                          y={high + 21}
                          textAnchor="middle"
                          fill="#a87918"
                          fontSize={13}
                        >
                          X
                        </text>
                      </g>
                    );
                  const nextY = next?.value === 1 ? high : next?.value === 0 ? low : null;
                  return (
                    <path
                      key={i}
                      d={`M ${from} ${y} H ${to}${nextY != null ? ` V ${nextY}` : ''}`}
                      fill="none"
                      stroke={row.color}
                      strokeWidth={2.5}
                    />
                  );
                })}
              </g>
            );
          })}
          <text
            x={right}
            y={height - 5}
            textAnchor="end"
            fontSize={13}
            fill="var(--theme-muted, #607e6e)"
          >
            시간 → · 전파 지연 {engineering(latency, 's')}
          </text>
        </svg>
      </div>
      <div className="lesson-actions">
        <button
          onClick={() => {
            if (!svg.current) return;
            const clone = svg.current.cloneNode(true) as SVGSVGElement;
            // Resolve theme variables so the exported SVG is standalone.
            const root = getComputedStyle(document.documentElement);
            let xml = new XMLSerializer().serializeToString(clone);
            for (const token of ['surface', 'border', 'muted'])
              xml = xml.replaceAll(
                new RegExp(`var\\(--theme-${token}, [^)]+\\)`, 'g'),
                root.getPropertyValue(`--theme-${token}`).trim() || '#ffffff',
              );
            downloadText('logic-timing.svg', xml, 'image/svg+xml');
          }}
        >
          타임 차트 SVG 저장
        </button>
        <button
          onClick={() =>
            downloadText(
              'logic-timing.csv',
              [
                'time_s,' + variables.join(',') + ',Y_expected,Y_drawn',
                ...answer.map(
                  (bit, i) =>
                    `${(i + 0.5) * delta},${variables.map((v) => inputs[v][i]).join(',')},${atCenters[i]},${bit}`,
                ),
              ].join('\n'),
              'text/csv;charset=utf-8',
            )
          }
        >
          시간표 CSV 저장
        </button>
      </div>
      <details className="lesson-details">
        <summary>구간별 계산과 지연 반영 정답</summary>
        <table className="lesson-table">
          <thead>
            <tr>
              <th>구간 중앙 시간</th>
              {variables.map((v) => (
                <th key={v}>{v}</th>
              ))}
              <th>현재 조합의 논리값</th>
              <th>지연 후 실제 Y</th>
            </tr>
          </thead>
          <tbody>
            {expected.map((value, i) => (
              <tr key={i}>
                <td>{engineering((i + 0.5) * delta, 's')}</td>
                {variables.map((v) => (
                  <td key={v}>{inputs[v][i]}</td>
                ))}
                <td>{value}</td>
                <td>{atCenters[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <div className="lesson-reading">
        <details open className="lesson-details">
          <summary>1. 타임 차트를 그리는 여섯 단계</summary>
          <ol>
            <li>가로축에 시간을 같은 간격으로 나누고 단위(ns·µs·ms)를 씁니다.</li>
            <li>A·B 등 입력을 위에서부터 배치하고 LOW=0, HIGH=1 기준선을 정합니다.</li>
            <li>어느 입력이든 변하는 시점마다 수직 보조선을 긋습니다.</li>
            <li>각 구간의 입력 조합을 읽고 진리표로 출력 값을 계산합니다.</li>
            <li>같은 값인 동안 수평선을 유지하고 값이 바뀌는 시점에서 수직으로 연결합니다.</li>
            <li>
              전파 지연이 있다면 입력 변화 이후 tpd만큼 뒤에서 출력이 바뀌도록 오른쪽으로 옮깁니다.
            </li>
          </ol>
        </details>
        <details open className="lesson-details">
          <summary>2. 7가지 게이트에서 출력을 결정하는 규칙</summary>
          <table className="lesson-table">
            <thead>
              <tr>
                <th>게이트</th>
                <th>Y=1 조건</th>
                <th>식</th>
              </tr>
            </thead>
            <tbody>
              {logicMissions.map((m) => (
                <tr key={m.id}>
                  <th>{m.id}</th>
                  <td>{highConditions[m.id]}</td>
                  <td>{m.formula}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            NAND는 AND를 반전하고, NOR는 OR를 반전하며, XNOR는 XOR를 반전합니다. NOT는 입력 하나만
            사용합니다. 7411의 3입력 AND는 A·B·C가 모두 1일 때만 HIGH입니다.
          </p>
        </details>
        <details className="lesson-details">
          <summary>3. 예제로 이해하기 · NAND와 XOR</summary>
          <p>
            A가 0인 동안 NAND 출력은 B가 바뀌어도 계속 1입니다. A가 1이 되면 B=0일 때 1, B=1일 때
            0입니다. XOR는 두 입력이 다른 구간만 HIGH로 표시합니다. 00→01→10→11 순서라면 XOR의
            출력은 0→1→1→0이며 중간 두 구간 사이에 굳이 LOW로 내려오지 않습니다.
          </p>
        </details>
        <details className="lesson-details">
          <summary>4. 전파 지연과 미정 X</summary>
          <p>
            실제 게이트 출력은 입력과 완전히 동시에 변하지 않습니다. 이 실습은 전체 논리식의 출력에
            하나의 일정한 전파 지연을 적용합니다. 첫 지연 시간 동안은 이전 출력 상태를 모르므로 X로
            표시합니다. 입력이 X여도 AND의 다른 입력이 0이면 출력은 0, OR의 다른 입력이 1이면 출력은
            1로 확정할 수 있습니다. 내부 경로별 지연·글리치·아날로그 상승시간은 이 논리 타임 차트와
            구분하세요.
          </p>
        </details>
        <details className="lesson-details">
          <summary>5. 사용자 논리식과 오실로스코프로 비교하기</summary>
          <p>
            예를 들어 !(A & B) | C를 입력하면 NAND 출력과 C를 OR한 조합 회로를 연습할 수 있습니다.
            !가 가장 먼저, & 다음 ^ 다음 | 순서로 계산되므로 의도한 결합에는 괄호를 쓰세요. 이
            차트는 시간표를 직접 만드는 연습이며 실제 배선의 측정 기록은 오실로스코프에서
            확인합니다. 회로 입력 스위치를 바꾸며 CH1에 입력, CH2에 출력을 연결하면 같은 원리로
            에지·주기·지연을 읽을 수 있습니다.
          </p>
        </details>
      </div>
    </div>
  );
}
