import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { GuideDrawer } from './components/GuideDrawer';
import { Workbench } from '../features/workbench/Workbench';
import { TheoryLab } from '../features/theory/TheoryLab';
import { useLabStore } from '../store/useLabStore';

export function App() {
  const activeLab = useLabStore((s) => s.activeLab);
  return <div className="app-shell"><a className="skip-link" href="#lab-content">실습 영역으로 이동</a><Header /><Toolbar />
    <div id={`panel-${activeLab}`} role="tabpanel" aria-labelledby={`tab-${activeLab}`} className="lab-panel"><div id="lab-content" tabIndex={-1}>
      {activeLab === 'theory' ? <TheoryLab /> : <Workbench key={activeLab} lab={activeLab} />}
    </div></div>
    <footer className="app-footer"><span><span className="footer-mark">CL</span>CIRCUIT LAB <span className="footer-separator">/</span> 직접 연결하며 배우는 전자공학</span><span>학습용 UI 프로토타입 <span className="footer-separator">·</span> v0.1.0</span></footer>
    <GuideDrawer />
  </div>;
}
