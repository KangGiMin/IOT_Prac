import { Activity, BookOpen, Grid2X2, Lightbulb } from 'lucide-react';
import { usePrototypeTheoryStore, type Lesson } from './store/usePrototypeTheoryStore';

const lessons = [
  {
    id: 'kmap' as const,
    title: '카르노 맵',
    subtitle: '논리식을 더 간단하게',
    icon: Grid2X2,
  },
  {
    id: 'scope' as const,
    title: '오실로스코프',
    subtitle: '시간에 따른 신호 읽기',
    icon: Activity,
  },
  {
    id: 'logic' as const,
    title: '논리식 & 타임차트',
    subtitle: '입력과 출력의 관계',
    icon: BookOpen,
  },
];
const expression = (cells: boolean[]) => {
  if (cells.every(Boolean)) return 'Y = 1';
  if (cells.every((v) => !v)) return 'Y = 0';
  const terms = ['A̅B̅', 'A̅B', 'AB̅', 'AB'];
  return `Y = ${cells.flatMap((v, i) => (v ? [terms[i]] : [])).join(' + ')}`;
};

export function TimingChart() {
  return (
    <div className="timing-chart">
      <svg
        viewBox="0 0 520 160"
        role="img"
        aria-label="AND 게이트 예시 타임차트. A와 B가 모두 1인 구간에서 Y가 1입니다."
      >
        {[40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 440, 480].map((x) => (
          <path key={x} d={`M${x} 10v135`} stroke="#dce5e1" strokeDasharray="3 4" />
        ))}
        <g fill="#66766f" fontSize="13" fontFamily="monospace">
          <text x="5" y="36">
            A
          </text>
          <text x="5" y="81">
            B
          </text>
          <text x="5" y="126">
            Y
          </text>
          <text x="440" y="156">
            time (t)
          </text>
        </g>
        <path d="M40 40h80V16h160v24h200" fill="none" stroke="#6696bf" strokeWidth="2.5" />
        <path d="M40 85h160V61h160v24h120" fill="none" stroke="#d29a53" strokeWidth="2.5" />
        <path d="M40 130h160v-24h80v24h200" fill="none" stroke="#138573" strokeWidth="2.5" />
      </svg>
      <small>AND 게이트 학습용 예시 · 실제 회로 계측값이 아닙니다.</small>
    </div>
  );
}

export function TheoryLab() {
  const { lesson, cells, setLesson, toggleCell } = usePrototypeTheoryStore();
  const selected = lessons.find((item) => item.id === lesson)!;
  return (
    <main className="theory-lab">
      <div className="eyebrow">LEARN THE FUNDAMENTALS</div>
      <h1>이론 & 계측기 학습</h1>
      <p className="theory-intro">회로를 연결하기 전에, 원리를 이해하는 시간.</p>
      <div className="lesson-tabs" role="tablist" aria-label="학습 주제">
        {lessons.map(({ id, title, subtitle, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={lesson === id}
            id={`lesson-${id}`}
            aria-controls="lesson-content"
            tabIndex={lesson === id ? 0 : -1}
            onClick={() => setLesson(id)}
            onKeyDown={(event) => {
              const index = lessons.findIndex((item) => item.id === lesson);
              let target: Lesson | undefined;
              if (event.key === 'ArrowRight') target = lessons[(index + 1) % lessons.length].id;
              if (event.key === 'ArrowLeft')
                target = lessons[(index + lessons.length - 1) % lessons.length].id;
              if (target) {
                event.preventDefault();
                setLesson(target);
                document.getElementById(`lesson-${target}`)?.focus();
              }
            }}
          >
            <Icon size={24} />
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </button>
        ))}
      </div>
      <section
        className="lesson-content"
        id="lesson-content"
        role="tabpanel"
        aria-labelledby={`lesson-${lesson}`}
      >
        <div className="lesson-title">
          <div>
            <span className="eyebrow">FOUNDATION</span>
            <h2>{selected.title}</h2>
          </div>
          <span className="outline-badge">
            {lesson === 'kmap' ? '2변수 실습' : '학습 미리보기'}
          </span>
        </div>
        {lesson === 'kmap' ? (
          <div className="kmap-layout">
            <div>
              <p>셀을 클릭해 0과 1을 전환해 보세요.</p>
              <div className="kmap">
                <span>A ∖ B</span>
                <span>0</span>
                <span>1</span>
                {[0, 1].map((row) => (
                  <div className="kmap-row" key={row}>
                    <span>{row}</span>
                    {[0, 1].map((col) => (
                      <button
                        key={col}
                        aria-label={`A=${row}, B=${col}`}
                        aria-pressed={cells[row * 2 + col]}
                        className={cells[row * 2 + col] ? 'cell-active' : ''}
                        onClick={() => toggleCell(row * 2 + col)}
                      >
                        {cells[row * 2 + col] ? 1 : 0}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="formula-panel">
              <Lightbulb size={24} />
              <h3>맵과 논리식 연결하기</h3>
              <p>1이 선택된 각 셀은 하나의 최소항을 나타냅니다.</p>
              <code>{expression(cells)}</code>
              <small>
                현재는 최소항 합을 표시합니다. 그룹 묶기와 자동 최소화 엔진은 확장 영역입니다.
              </small>
            </div>
          </div>
        ) : lesson === 'scope' ? (
          <>
            <p>가로축은 시간, 세로축은 전압입니다. 신호의 진폭과 주기를 읽는 방법을 익혀 보세요.</p>
            <div className="scope-display">
              <div>
                CH 1 <span>예시 파형 · 1 V/div · 1 ms/div</span>
              </div>
              <svg viewBox="0 0 800 180" role="img" aria-label="주기적인 구형파 예시">
                <path
                  d="M0 135h80V45h120v90h120V45h120v90h120V45h120v90h120"
                  fill="none"
                  stroke="#69d9a9"
                  strokeWidth="3"
                />
              </svg>
            </div>
            <p className="muted">
              계측기 컨트롤과 회로 신호 연결은 다음 단계에서 구현할 수 있습니다.
            </p>
          </>
        ) : (
          <>
            <p>
              AND 논리식 <code>Y = A · B</code>에서는 두 입력이 모두 1일 때만 출력이 1입니다.
            </p>
            <TimingChart />
            <div className="truth-table">
              <table>
                <caption>AND 게이트 진리표</caption>
                <thead>
                  <tr>
                    <th>A</th>
                    <th>B</th>
                    <th>Y = A · B</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [0, 0],
                    [0, 1],
                    [1, 0],
                    [1, 1],
                  ].map(([a, b]) => (
                    <tr key={`${a}${b}`}>
                      <td>{a}</td>
                      <td>{b}</td>
                      <td>{a & b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
