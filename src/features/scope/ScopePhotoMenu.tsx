import { X } from 'lucide-react';
import { useCircuitStore } from '../../store/usePhotoCircuitStore';
import { useLearningCenter } from '../learning/useLearningCenter';
import { engineering, getScopeChannel, getScopeSettings } from './model';
import { scopeMeasurements, scopeMenuKeys, scopeMenuNames } from './scopeActions';
import { measureScope } from './scopeMath';
import { useScopeRuntime } from './runtime';

export function ScopePhotoMenu() {
  const active = useLearningCenter((s) => s.photoMenu);
  const metric = useLearningCenter((s) => s.photoMetric);
  const selected = useLearningCenter((s) => getScopeChannel(s.scopeChannels, active?.id ?? ''));
  const component = useCircuitStore((s) => s.workspaces.digital.components.find((c) => c.id === active?.id));
  const disabled = useCircuitStore((s) => s.calibration || s.mode !== 'digital');
  const record = useScopeRuntime((s) => active ? s.records[active.id] : undefined);
  if (!active || !component || component.settings.scopePowered === false || disabled) return null;
  const { id, menu } = active;
  const settings = getScopeSettings(component.settings.scope);
  const close = useLearningCenter.getState().closePhotoMenu;
  const items = scopeMenuKeys(id, menu, settings, selected);
  const measurement = scopeMeasurements.find((item) => item.id === metric)!;
  const capture = record?.capture;
  const measure = (channel: 'ch1' | 'ch2') => capture ? engineering(measureScope(capture[channel], capture.dt)[metric], measurement.unit) : '—';
  return <section className="scope-photo-menu nodrag nopan nowheel" aria-labelledby="scope-photo-menu-title"
    onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    <header>
      <h3 id="scope-photo-menu-title">{scopeMenuNames[menu]}</h3>
      <button type="button" onClick={close} aria-label="오실로스코프 메뉴 닫기"><X size={16} /></button>
    </header>
    {menu === 'measure' && <output>{measurement.label} · CH1 {measure('ch1')} · CH2 {measure('ch2')}</output>}
    {menu === 'cursor' && <output>Δt {engineering(Math.abs(settings.cursors.x2 - settings.cursors.x1) * settings.timeDiv * 10, 's')} · ΔV {engineering(Math.abs(settings.cursors.y2 - settings.cursors.y1), 'V')}</output>}
    {menu === 'trigger' && <p>{settings.trigger.mode.toUpperCase()} · {engineering(settings.trigger.level, 'V')} · {record?.status ?? 'READY'}</p>}
    {menu === 'display' && <p>{settings.display.toUpperCase()}</p>}
    {menu === 'acquire' && <p>{settings.acquire.toUpperCase()}</p>}
    <ul>
      {items.map((item, index) => <li key={index}><button type="button" disabled={item.disabled} onClick={item.run}>
        <span>F{index + 1}</span>{item.label}
      </button></li>)}
    </ul>
  </section>;
}
