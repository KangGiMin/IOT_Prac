import { DigitalControls } from './DigitalControls';
import { pinsFor } from '../../../config/digitalPins';
import { Check, Copy, Crosshair, Info, MousePointer2, Settings2, Trash2, Zap } from 'lucide-react';
import { componentAssets } from '../../../config/assets';
import { useCircuitStore } from '../../../store/usePhotoCircuitStore';
import { formatCoordinates } from '../utils/geometry';
import { AssetImage } from './AssetImage';
import { LogicMissions } from './LogicMissions';
import { CircuitFaultPanel } from './CircuitFaultPanel';
import { pinKey } from '../../../engine/circuitSolver';

export function PhotoInspector() {
  const state = useCircuitStore();
  const workspace = state.workspaces[state.mode];
  const component = workspace.components.find((c) => c.id === state.selectedId);
  const asset = component && componentAssets[component.assetId];
  const pins=component&&asset?.mode==='digital'?pinsFor(component):asset?.pins??[];
  const wire = workspace.wires.find((w) => w.id === state.selectedWireId);
  const locked = workspace.power.on && workspace.simulation.status !== 'error' || state.calibration;
  return <aside className="photo-inspector" aria-label="부품 제어와 실습 상태">
    <CircuitFaultPanel />
    <section className="inspector-section"><div className="panel-heading"><Settings2 size={17} /><h2>선택 부품</h2></div>
      {component && asset ? <>
        <div className="selected-component"><div className="selected-photo"><AssetImage asset={asset} thumbnail /></div><strong>{asset.label}</strong><span>{asset.model}</span></div>
        <DigitalControls component={component}/>
        <p className="selected-description">{asset.description}</p>
        <dl className="component-properties"><div><dt>단자</dt><dd>{asset.pins.length} PIN</dd></div><div><dt>위치</dt><dd>{Math.round(component.position.x)}, {Math.round(component.position.y)}</dd></div></dl>
        {workspace.power.on && <details className="calibration-pin-list"><summary>단자 전압 / 논리값</summary><div><table><thead><tr><th>단자</th><th>전압</th><th>논리</th></tr></thead><tbody>{pins.map((pin) => { const value = workspace.simulation.pinValues[pinKey({ componentId: component.id, pinId: pin.id })]; return <tr key={pin.id}><td>{pin.label}</td><td>{value?.voltage == null ? '—' : `${value.voltage.toFixed(2)} V`}</td><td>{value?.logic ?? 'floating'}</td></tr>; })}</tbody></table></div></details>}
        {state.calibration && <details className="calibration-pin-list"><summary>설정된 단자 좌표 (%)</summary><div><table><thead><tr><th>단자</th><th>x%</th><th>y%</th></tr></thead><tbody>{pins.map((pin) => <tr key={pin.id}><td>{pin.label}</td><td>{pin.position.x.toFixed(2)}</td><td>{pin.position.y.toFixed(2)}</td></tr>)}</tbody></table>{!asset.pins.length && <p>이 이미지에는 배선 단자가 없습니다.</p>}</div></details>}
        {asset.id==='pb-switch' && <label className="setting-field">버튼 동작<select value={component.settings.buttonMode??'momentary'} disabled={state.calibration} onChange={e=>state.updateSettings(component.id,{buttonMode:e.target.value as 'momentary'|'detent',pressed:false})}><option value="momentary">모멘터리</option><option value="detent">디텐트</option></select></label>}
        {asset.id==='relay-body' && <><p className="panel-description">{component.mountedSocketId?'소켓 장착됨':'소켓 중앙으로 드래그하세요.'}</p></>}
        {asset.id === 'pb-switch' && component.settings.buttonMode!=='detent' && <button className={`component-control ${component.settings.pressed ? 'active' : ''}`} disabled={state.calibration}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); state.updateSettings(component.id, { pressed: true }); }}
          onPointerUp={() => state.updateSettings(component.id, { pressed: false })}
          onPointerCancel={() => state.updateSettings(component.id, { pressed: false })}
          onLostPointerCapture={() => state.updateSettings(component.id, { pressed: false })}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); state.updateSettings(component.id, { pressed: true }); } }}
          onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') state.updateSettings(component.id, { pressed: false }); }}
          onBlur={() => state.updateSettings(component.id, { pressed: false })}>
          {component.settings.pressed ? '누름 상태 · 접점 전환' : '누르고 있는 동안 동작'}</button>}
        {asset.id === 'switch-3pin' && <button className="component-control" disabled={state.calibration} aria-pressed={component.settings.switchOn} onClick={() => state.updateSettings(component.id, { switchOn: !component.settings.switchOn })}>스위치 {component.settings.switchOn ? 'ON · COM → 2' : 'OFF · COM → 1'}</button>}
        {asset.id==='pb-switch' && component.settings.buttonMode==='detent' && <button className="component-control" disabled={state.calibration} aria-pressed={component.settings.pressed} onClick={()=>state.updateSettings(component.id,{pressed:!component.settings.pressed})}>디텐트 {component.settings.pressed?'눌림':'해제'}</button>}
        {asset.id === 'timer-at8n' && <label className="setting-field"><span>설정 시간 <b>{component.settings.timerSeconds.toFixed(1)} s</b></span><input type="range" min="0" max="10" step="0.1" value={component.settings.timerSeconds} disabled={state.calibration} onChange={(e) => state.updateSettings(component.id, { timerSeconds: Number(e.target.value) })} /></label>}
        {asset.id === 'power-supply' && <label className="setting-field"><span>설정 전압 <b>V</b></span><input type="number" min="0" max="30" step="0.1" value={component.settings.voltage} disabled={workspace.power.on || state.calibration} onChange={(e) => { const voltage = e.target.valueAsNumber; if (Number.isFinite(voltage)) state.updateSettings(component.id, { voltage: Math.max(0, Math.min(30, voltage)) }); }} /></label>}
        <button className="delete-component" disabled={locked} onClick={state.deleteSelection}><Trash2 size={14} />부품 삭제</button>
      </> : wire ? <div className="selected-wire"><span style={{ background: wire.color }} /><strong>배선 선택됨</strong><p>Delete 키 또는 버튼으로 삭제하세요.</p><button className="delete-component" disabled={locked} onClick={state.deleteSelection}><Trash2 size={14} />배선 삭제</button></div> : <div className="inspector-empty"><MousePointer2 size={28} strokeWidth={1.2} /><strong>부품을 선택해 주세요</strong><p>보드 위 부품을 클릭하면<br />설정과 단자를 확인할 수 있습니다.</p></div>}
    </section>
    {state.calibration && <section className="inspector-section calibration-result"><div className="panel-heading"><Crosshair size={17} /><h2>핀 좌표 디버그</h2></div><p>사진 안의 위치를 클릭하세요.<br />좌표 기준: 좌측 상단 (0%, 0%)</p>
      {state.sample ? <><strong>{componentAssets[state.sample.assetId].label}</strong><p className="coordinate-percent">x: {state.sample.position.x.toFixed(2)}%, y: {state.sample.position.y.toFixed(2)}%</p><input aria-label="보정 좌표" readOnly value={formatCoordinates(state.sample.position)} onFocus={(e) => e.target.select()} /><button className="component-control" onClick={async () => {
        const sample = state.sample;
        if (!sample) return;
        try { await navigator.clipboard.writeText(formatCoordinates(sample.position)); if (useCircuitStore.getState().sample === sample) state.setSample({ ...sample, copied: true }); }
        catch { document.querySelector<HTMLInputElement>('input[aria-label="보정 좌표"]')?.select(); }
      }}>{state.sample.copied ? <Check size={14} /> : <Copy size={14} />}{state.sample.copied ? '클립보드에 복사됨' : '좌표 복사'}</button>{!state.sample.copied && <small>자동 복사가 제한되면 위 좌표를 선택해 복사하세요.</small>}</> : <div className="coordinate-waiting">{`{ x: —, y: — }`}</div>}
      <small>src/config/assets.ts의 pins[].position 또는 controls[].bounds에 반영하세요. 레터박스 여백은 제외하고 PNG 안의 투명 여백은 포함합니다.</small>
    </section>}
    <LogicMissions />
    <section className="inspector-section"><div className="panel-heading"><Zap size={17} /><h2>상태 알림</h2></div><div className="system-status"><span className={workspace.power.on ? 'status-dot on' : 'status-dot'} />메인 전원<strong>{workspace.power.on ? 'ON' : 'OFF'}</strong></div><div className="short-status"><span>쇼트 검사</span><strong>{workspace.simulation.isShorted ? '쇼트 / 오배선 감지' : '단락 없음'}</strong></div><p className="live-notice" role="status">{state.notice}</p><div className="simulation-note"><Info size={14} /><p>도선·접점·DC 부하와 TTL 6종를 해석합니다. LED·램프·코일은 학습용 근사 모델이며, 계측기는 학습용 DC 근사 모델입니다.</p></div></section>
    <div className="inspector-bottom">반복해서 연결하고, 원리를 익히세요.</div>
  </aside>;
}
