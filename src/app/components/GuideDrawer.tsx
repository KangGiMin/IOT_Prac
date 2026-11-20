import { useEffect, useRef } from 'react';
import { BookOpen, Check, X } from 'lucide-react';
import { useLabStore } from '../../store/useLabStore';
import { TimingChart } from '../../features/theory/TheoryLab';

const guides = {
  sequence: { title: '시퀀스 제어 시작하기', intro: '입력, 제어, 출력 부품을 연결하며 제어 회로의 구조를 익혀 보세요.', steps: ['전원을 OFF로 두고 필요한 부품을 추가하세요.', '부품을 드래그하여 판넬 위에 배치하세요.', '부품의 오른쪽 단자에서 다른 부품의 왼쪽 단자로 드래그하세요.', '배선을 선택한 뒤 Delete 키로 수정할 수 있습니다.'], note: '초기 배치는 UI 사용법을 보여주는 예제입니다. 자기유지 회로와 접점별 배선 검증은 향후 시뮬레이션 엔진에서 구현합니다.' },
  breadboard: { title: '디지털 회로 시작하기', intro: '74xx TTL IC와 저항, LED를 배치하며 논리 회로를 설계해 보세요.', steps: ['라이브러리에서 사용할 TTL IC를 선택하세요.', '저항과 LED를 추가하고 부품을 배치하세요.', '단자 사이를 드래그하여 연결선을 추가하세요.', '이론 학습실에서 게이트의 진리표를 확인하세요.'], note: '현재 단자는 부품 단위의 연결을 나타냅니다. 실제 IC 핀 번호, 브레드보드 홀의 내부 연결, 전류·논리 레벨 계산은 확장 영역입니다.' },
  theory: { title: '이론을 실습으로 연결하기', intro: '논리식과 파형의 관계를 눈으로 확인해 보세요.', steps: ['카르노 맵의 셀을 클릭해 최소항 합의 변화를 확인하세요.', '오실로스코프 예시에서 전압과 시간 축을 살펴보세요.', 'AND 게이트 진리표를 타임차트와 비교하세요.', '회로 실습실로 돌아가 배운 소자를 배치해 보세요.'], note: '계측 파형과 타임차트는 학습용 예시입니다. 실제 회로 신호와 동기화되어 있지 않습니다.' },
};

export function GuideDrawer() {
  const { guideOpen, guideTab, setGuideTab, setGuideOpen, activeLab } = useLabStore();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (guideOpen && element && !element.open) element.showModal();
    else if (!guideOpen && element?.open) element.close();
  }, [guideOpen]);
  const guide = guides[activeLab];
  return <dialog id="learning-guide" ref={dialog} className="guide-drawer" aria-labelledby="guide-title" onClose={() => setGuideOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setGuideOpen(false); }}>
    <div className="drawer-content"><div className="drawer-heading"><span className="drawer-icon"><BookOpen size={20} /></span><div><small>LAB COMPANION</small><h2 id="guide-title">학습 가이드 & 타임차트</h2></div><button autoFocus className="icon-button" aria-label="학습 가이드 닫기" onClick={() => setGuideOpen(false)}><X size={20} /></button></div>
      <div className="drawer-tabs" role="tablist" aria-label="가이드 종류">{(['guide', 'timing'] as const).map((tab) => <button key={tab} id={`guide-tab-${tab}`} role="tab" aria-controls="guide-content" aria-selected={guideTab === tab} onClick={() => setGuideTab(tab)}>{tab === 'guide' ? '실습 가이드' : '타임차트'}</button>)}</div>
      <div className="drawer-body" id="guide-content" role="tabpanel" aria-labelledby={`guide-tab-${guideTab}`}>
        {guideTab === 'guide' ? <><span className="eyebrow">GETTING STARTED</span><h3>{guide.title}</h3><p>{guide.intro}</p><ol className="guide-steps">{guide.steps.map((step, i) => <li key={step}><span>{i + 1}</span><p>{step}</p></li>)}</ol><div className="guide-callout"><Check size={18} /><div><strong>현재 구현 범위</strong><p>{guide.note}</p></div></div></>
          : <><span className="eyebrow">READ THE SIGNAL</span><h3>입력과 출력의 시간 관계</h3><p>A와 B가 모두 1인 구간에서 AND 출력 Y가 1이 됩니다.</p><TimingChart /><div className="guide-callout"><BookOpen size={18} /><p>회로별 계측 결과를 표시할 수 있도록 이 영역에 시뮬레이션 엔진의 신호 데이터를 연결하세요.</p></div></>}
      </div><div className="drawer-footer">작은 연결 하나가, 이해의 시작이 됩니다.</div>
    </div>
  </dialog>;
}
