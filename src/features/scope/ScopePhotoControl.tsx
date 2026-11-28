import { useCircuitStore } from '../../store/usePhotoCircuitStore';
import type { CircuitComponent, ControlDefinition } from '../../types/circuit';
import { useLearningCenter } from '../learning/useLearningCenter';
import { InstrumentDial } from '../workbench/components/InstrumentDial';
import { getScopeChannel, getScopeSettings, TIME_DIVS, VOLT_DIVS } from './model';
import { performScopeAction, scopeDialText, scopeMenuKeys } from './scopeActions';
import { useScopeRuntime } from './runtime';

type ScopeControl = Extract<
  ControlDefinition,
  { kind: 'scope-action' | 'scope-dial' | 'scope-key' }
>;

export function ScopePhotoControl({
  component,
  control,
  calibration,
}: {
  component: CircuitComponent;
  control: ScopeControl;
  calibration: boolean;
}) {
  const id = component.id;
  const selected = useLearningCenter((s) => getScopeChannel(s.scopeChannels, id));
  const menu = useLearningCenter((s) => (s.photoMenu?.id === id ? s.photoMenu.menu : null));
  useScopeRuntime((s) => control.kind === 'scope-key' && !!s.records[id]?.capture);
  const settings = getScopeSettings(component.settings.scope);
  const powered = component.settings.scopePowered !== false;
  const { bounds, label } = control;
  const style = {
    left: `${bounds.x}%`,
    top: `${bounds.y}%`,
    width: `${bounds.width}%`,
    height: `${bounds.height}%`,
  };
  if (control.kind === 'scope-key') {
    const item = menu && scopeMenuKeys(id, menu, settings, selected)[control.index];
    const name = item ? `${label} · ${item.label}` : label;
    return (
      <>
        {item && (
          <span
            className="scope-soft-key-label"
            style={{ top: style.top, height: style.height }}
            aria-hidden="true"
          >
            F{control.index + 1}
          </span>
        )}
        <button
          type="button"
          className="device-control instrument-key nodrag nopan"
          style={style}
          disabled={calibration || !powered || !item || item.disabled}
          aria-label={name}
          title={name}
          onClick={() => item && item.run()}
        >
          <span>{name}</span>
        </button>
      </>
    );
  }
  if (control.kind === 'scope-action') {
    const active =
      control.action === 'power' ? powered : menu === control.action ? true : undefined;
    return (
      <button
        type="button"
        className={`device-control instrument-key nodrag nopan${active ? ' is-pressed' : ''}`}
        style={style}
        disabled={calibration || (!powered && control.action !== 'power')}
        aria-label={label}
        aria-pressed={active}
        title={label}
        onClick={() => {
          useCircuitStore.getState().select(id);
          performScopeAction(id, control.action);
        }}
      >
        <span>{label}</span>
      </button>
    );
  }
  const { field } = control;
  const choices = field === 'timeDiv' ? TIME_DIVS : field === 'voltsDiv' ? VOLT_DIVS : null;
  const value =
    field === 'timeDiv'
      ? settings.timeDiv
      : field === 'delayDiv'
        ? settings.delayDiv
        : field === 'triggerLevel'
          ? settings.trigger.level
          : settings.channels[selected][field];
  return (
    <InstrumentDial
      label={label}
      value={choices ? choices.indexOf(value) : value}
      min={choices ? 0 : field === 'delayDiv' ? -2 : -50}
      max={choices ? choices.length - 1 : field === 'delayDiv' ? 5 : 50}
      step={choices ? 1 : 0.1}
      valueText={scopeDialText(field, value)}
      disabled={calibration || !powered}
      style={style}
      onChange={(raw) => {
        const next = choices ? choices[raw] : raw;
        const store = useCircuitStore.getState();
        const current = store.workspaces.digital.components.find((c) => c.id === id);
        if (!current || current.settings.scopePowered === false) return;
        const live = getScopeSettings(current.settings.scope);
        const update =
          field === 'voltsDiv' || field === 'offset'
            ? {
                ...live,
                channels: {
                  ...live.channels,
                  [selected]: { ...live.channels[selected], [field]: next },
                },
              }
            : field === 'triggerLevel'
              ? { ...live, trigger: { ...live.trigger, level: next } }
              : { ...live, [field]: next };
        store.select(id);
        store.updateScope(id, update);
      }}
    />
  );
}
