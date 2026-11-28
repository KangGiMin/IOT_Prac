import { BookOpen, ChartNoAxesCombined, Grid2X2, Waves } from 'lucide-react';
import { ScopeConsole } from '../scope/ScopeConsole';
import { KarnaughLesson } from './KarnaughLesson';
import { TimingLesson } from './TimingLesson';
import { ScopeGuide } from './ScopeGuide';
import { useLearningCenter } from './useLearningCenter';
const tabs = [
  { id: 'scope', label: '오실로스코프 사용법', Icon: Waves },
  { id: 'kmap', label: '카르노 맵', Icon: Grid2X2 },
  { id: 'timing', label: '타임 차트', Icon: ChartNoAxesCombined },
] as const;
export function LearningCenter() {
  const selected = useLearningCenter((s) => s.tab);
  return (
    <section
      id="learning-center"
      className="learning-center"
      aria-labelledby="learning-center-title"
      tabIndex={-1}
    >
      <div className="learning-center-heading">
        <span className="learning-center-icon">
          <BookOpen size={24} />
        </span>
        <div>
          <p>LEARN · MEASURE · PRACTICE</p>
          <h2 id="learning-center-title">계측·논리 학습 센터</h2>
          <span>측정 도구를 익히고, 논리식을 줄이고, 시간에 따른 신호를 직접 그려 보세요.</span>
        </div>
      </div>
      <nav className="lesson-tabs" role="tablist" aria-label="학습 영역">
        {tabs.map(({ id, label, Icon }, index) => (
          <button
            id={`lesson-tab-${id}`}
            role="tab"
            aria-selected={selected === id}
            aria-controls={`lesson-panel-${id}`}
            tabIndex={selected === id ? 0 : -1}
            key={id}
            onClick={() => useLearningCenter.getState().setTab(id)}
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
              e.preventDefault();
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? tabs.length - 1
                    : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
              useLearningCenter.getState().setTab(tabs[next].id);
              document.getElementById(`lesson-tab-${tabs[next].id}`)?.focus();
            }}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
      <div
        role="tabpanel"
        id="lesson-panel-scope"
        aria-labelledby="lesson-tab-scope"
        hidden={selected !== 'scope'}
      >
        <ScopeConsole />
        <ScopeGuide />
      </div>
      <div
        role="tabpanel"
        id="lesson-panel-kmap"
        aria-labelledby="lesson-tab-kmap"
        hidden={selected !== 'kmap'}
      >
        <KarnaughLesson />
      </div>
      <div
        role="tabpanel"
        id="lesson-panel-timing"
        aria-labelledby="lesson-tab-timing"
        hidden={selected !== 'timing'}
      >
        <TimingLesson />
      </div>
    </section>
  );
}
