import { LearningToolbar } from './components/LearningToolbar';
import { ThemeControl } from './components/ThemeControl';
import {
  Cable,
  CircuitBoard,
  Crosshair,
  Cpu,
  FlaskConical,
  Power,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { CSSProperties } from 'react';
import { wireColors } from '../config/assets';
import { useCircuitStore } from '../store/usePhotoCircuitStore';
import type { CircuitMode } from '../types/circuit';
import { PhotoCanvas } from '../features/workbench/components/PhotoCanvas';
import { PhotoInspector } from '../features/workbench/components/PhotoInspector';
import { PhotoPalette } from '../features/workbench/components/PhotoPalette';
import { SoundAlert } from '../engine/soundAlert';

const modes = [
  { id: 'sequence', label: '시퀀스 제어', Icon: CircuitBoard },
  { id: 'digital', label: '디지털 회로', Icon: Cpu },
] as const;

/** Full-width workbench first; library and inspector follow in page flow. */
export function App() {
  const state = useCircuitStore(
    useShallow(({ workspaces: _workspaces, ...state }) => state),
  );
  const power = useCircuitStore((s) => s.workspaces[s.mode].power);
  const [alarm] = useState(() => new SoundAlert());
  const [audioReady, setAudioReady] = useState(false);
  const faultMode = useCircuitStore((s) =>
    modes.find(
      ({ id }) =>
        s.workspaces[id].power.on &&
        s.workspaces[id].simulation.status === 'error',
    ),
  );
  const faultShorted = useCircuitStore((s) =>
    faultMode ? s.workspaces[faultMode.id].simulation.isShorted : false,
  );
  const unlockAlarm = () => {
    void alarm.unlock().then(setAudioReady);
  };
  useEffect(() => {
    // Subscription is synchronous: power-off/wire removal silences scheduled
    // audio immediately, including a powered fault in the other mode.
    let priorRelays = new Set<string>();
    const syncAlarm = () => {
      const current = useCircuitStore.getState();
      const relays = new Set(
        current.workspaces.sequence.simulation.energizedComponents.filter(
          (id) =>
            current.workspaces.sequence.components.some(
              (c) => c.id === id && c.assetId === 'relay-socket',
            ),
        ),
      );
      if (
        [...relays].some((id) => !priorRelays.has(id)) &&
        !current.workspaces.sequence.simulation.isShorted
      )
        alarm.click();
      priorRelays = relays;
      alarm.setActive(
        modes.some(
          ({ id }) =>
            current.workspaces[id].power.on &&
            current.workspaces[id].simulation.isShorted === true,
        ),
      );
    };
    const clock = window.setInterval(
      () => useCircuitStore.getState().tick(Date.now()),
      40,
    );
    syncAlarm();
    const unsubscribe = useCircuitStore.subscribe(syncAlarm);
    const endInteraction = () => useCircuitStore.getState().endInteraction();
    const visibilityChanged = () => {
      if (document.hidden) endInteraction();
    };
    window.addEventListener('blur', endInteraction);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      window.clearInterval(clock);
      unsubscribe();
      window.removeEventListener('blur', endInteraction);
      document.removeEventListener('visibilitychange', visibilityChanged);
      alarm.dispose();
    };
  }, [alarm]);
  return (
    <div
      className="circuit-app"
      onPointerDownCapture={unlockAlarm}
      onKeyDownCapture={unlockAlarm}
    >
      <a className="skip-workspace" href="#circuit-workspace">
        실습 영역으로 이동
      </a>
      <a className="skip-workspace" href="#keyboard-wiring">
        키보드 배선으로 이동
      </a>
      <header className="workspace-header">
        <div className="circuit-header">
          <div className="circuit-brand">
            <span className="circuit-logo">
              <CircuitBoard size={25} />
            </span>
            <div>
              <strong>
                CIRCUIT<span>LAB</span>
              </strong>
              <small>한국폴리텍대학 · 소프트웨어융합과</small>
            </div>
          </div>
          <nav className="circuit-tabs" role="tablist" aria-label="실습 모드">
            {modes.map(({ id, label, Icon }) => (
              <button
                key={id}
                id={`photo-tab-${id}`}
                role="tab"
                aria-selected={state.mode === id}
                aria-controls={`photo-panel-${id}`}
                tabIndex={state.mode === id ? 0 : -1}
                onClick={() => state.setMode(id)}
                onKeyDown={(event) => {
                  if (
                    !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const next: CircuitMode =
                    event.key === 'Home'
                      ? 'sequence'
                      : event.key === 'End'
                        ? 'digital'
                        : state.mode === 'sequence'
                          ? 'digital'
                          : 'sequence';
                  state.setMode(next);
                  document.getElementById(`photo-tab-${next}`)?.focus();
                }}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
          <div className="header-lab-tag">
            <FlaskConical size={16} />
            <span>IoT 전기·전자 실습실</span>
            <span className="version-label">실시간 해석</span>
          </div>
          <ThemeControl />
        </div>
        <div className="circuit-toolbar" role="group" aria-label="실습 도구">
          <button
            className={`main-power ${power.on ? 'is-on' : ''}`}
            role="switch"
            aria-checked={power.on}
            aria-label="메인 전원"
            disabled={state.calibration}
            onClick={state.togglePower}
          >
            <Power size={16} />
            <span>메인 전원</span>
            <span className="power-track" aria-hidden="true">
              <span />
            </span>
            <b>{power.on ? 'ON' : 'OFF'}</b>
          </button>
          <span className="tool-separator" aria-hidden="true" />
          <div
            className="wire-color-picker"
            role="group"
            aria-label="전선 색상"
          >
            <span>
              <Cable size={16} />
              전선 색상
            </span>
            {wireColors.map((color) => (
              <button
                key={color.value}
                aria-label={`${color.label} 전선`}
                aria-pressed={color.value === state.wireColor}
                title={`${color.label} 전선`}
                style={{ '--swatch': color.value } as CSSProperties}
                onClick={() => state.setWireColor(color.value)}
              />
            ))}
          </div>
          <span className="tool-separator" aria-hidden="true" />
          <button
            className="reset-workspace"
            disabled={power.on || state.calibration}
            onClick={state.reset}
          >
            <RotateCcw size={15} />
            초기화
          </button>
          <button
            className="component-control wiring-toggle"
            aria-pressed={state.wiringMode}
            disabled={power.on || state.calibration}
            onClick={() => state.setWiringMode(!state.wiringMode)}
          >
            배선 모드 {state.wiringMode ? 'ON' : 'OFF'}
          </button>
          <span className="toolbar-spacer" />
          {state.mode === 'digital' && (
            <label className="wire-kind-label">
              전선
              <select
                aria-label="Cable type"
                value={state.wireKind}
                onChange={(e) =>
                  state.setWireKind(e.target.value as 'jumper' | 'clip')
                }
              >
                <option value="jumper">점퍼선</option>
                <option value="clip">악어클립</option>
              </select>
            </label>
          )}
          <button
            className={`calibration-toggle ${state.calibration ? 'is-active' : ''}`}
            role="switch"
            aria-label="핀 좌표 디버그 모드"
            aria-checked={state.calibration}
            disabled={power.on}
            onClick={state.toggleCalibration}
          >
            <Crosshair size={16} />
            <span>핀 좌표 디버그 모드</span>
            <span className="power-track" aria-hidden="true">
              <span />
            </span>
          </button>
        </div>
        <LearningToolbar />
        {faultMode && (
          <div className="circuit-fault-banner" role="status">
            <strong>{faultMode.label} · 보호 정지</strong>
            <span>전원을 끄거나 오류 배선을 제거하세요.</span>
            {faultMode.id !== state.mode && (
              <button onClick={() => state.setMode(faultMode.id)}>
                해당 회로 보기
              </button>
            )}
            {faultShorted && !audioReady && (
              <button onClick={unlockAlarm}>경고음 활성화</button>
            )}
          </div>
        )}
      </header>
      <main id="circuit-workspace" tabIndex={-1}>
        <div
          id={`photo-panel-${state.mode}`}
          role="tabpanel"
          aria-labelledby={`photo-tab-${state.mode}`}
          className="photo-layout"
        >
          <PhotoCanvas />
          <div className="photo-support-panels">
            <PhotoPalette key={state.mode} />
            <PhotoInspector />
          </div>
        </div>
      </main>
      <footer className="circuit-footer">
        <span>
          <b>CL</b>
          <strong>CIRCUIT LAB</strong>
          <i />
          직접 연결하며 배우는 전기·전자
        </span>
        <span>
          한국폴리텍대학 소프트웨어융합과
          <span className="footer-desktop"> · IoT Circuit Practice</span>
        </span>
      </footer>
    </div>
  );
}
