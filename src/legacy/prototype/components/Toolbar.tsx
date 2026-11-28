import { BookOpen, ChevronRight, Power, RotateCcw } from 'lucide-react';
import { usePrototypeLabStore } from '../store/usePrototypeLabStore';

export function Toolbar() {
  const { activeLab, powerOn, togglePower, guideOpen, setGuideOpen, resetWiring } =
    usePrototypeLabStore();
  const theory = activeLab === 'theory';
  return (
    <div className="app-toolbar">
      <div className="toolbar-controls">
        <button
          className={`power-button ${powerOn ? 'is-on' : ''}`}
          role="switch"
          aria-checked={powerOn}
          disabled={theory}
          onClick={togglePower}
          title={theory ? '회로 실습실에서 전원을 전환할 수 있습니다' : 'UI 전원 상태 전환'}
        >
          <Power size={16} />
          POWER {powerOn ? 'ON' : 'OFF'}
          <span className="switch-track">
            <span />
          </span>
        </button>
        <span className="toolbar-divider" />
        <button
          className="reset-button"
          onClick={resetWiring}
          disabled={powerOn || theory}
          title={
            powerOn ? '전원을 끄면 배선을 초기화할 수 있습니다' : '현재 실습실의 배선만 초기화'
          }
        >
          <RotateCcw size={16} />
          배선 초기화
        </button>
        <span className="toolbar-hint">
          {theory
            ? '원리를 배우고, 실습으로 연결하세요'
            : powerOn
              ? '전원 상태 ON · 회로 편집 잠금'
              : '전원을 끈 상태에서 회로를 편집하세요'}
        </span>
      </div>
      <button
        className="guide-button"
        aria-expanded={guideOpen}
        aria-controls="learning-guide"
        onClick={() => setGuideOpen(!guideOpen)}
      >
        <BookOpen size={17} />
        학습 가이드 & 타임차트
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
