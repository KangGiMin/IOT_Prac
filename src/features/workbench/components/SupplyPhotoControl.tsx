import { auxiliaryVoltages, getSupplySettings } from '../../../config/supplySettings';
import type { SupplySettings } from '../../../config/supplySettings';
import { useCircuitStore } from '../../../store/usePhotoCircuitStore';
import type { CircuitComponent, ControlDefinition } from '../../../types/circuit';
import { InstrumentDial } from './InstrumentDial';

export function SupplyPhotoControl({ component, control, calibration }: {
  component: CircuitComponent;
  control: Extract<ControlDefinition, { kind: 'supply-control' }>;
  calibration: boolean;
}) {
  const settings = getSupplySettings(component.settings.supply);
  const { field, label, bounds } = control;
  const style = { left: `${bounds.x}%`, top: `${bounds.y}%`, width: `${bounds.width}%`, height: `${bounds.height}%` };
  const update = (patch: Partial<SupplySettings>) => {
    const store = useCircuitStore.getState();
    const current = store.workspaces.digital.components.find(({ id }) => id === component.id);
    if (!current) return;
    store.select(component.id);
    store.updateSettings(component.id, { supply: { ...getSupplySettings(current.settings.supply), ...patch } });
  };
  if (field === 'series' || field === 'parallel') {
    const active = settings.tracking === field;
    return <button type="button" style={style} className={`device-control instrument-key nodrag nopan${active ? ' is-pressed' : ''}`}
      aria-label={label} aria-pressed={active} title={label} disabled={calibration}
      onClick={() => update({ tracking: active ? 'independent' : field })}><span>{label}</span></button>;
  }
  if (field === 'auxiliaryVoltage') return <InstrumentDial label={label} style={style} disabled={calibration}
    value={auxiliaryVoltages.indexOf(settings.auxiliaryVoltage)} min={0} max={2} step={1} sliding
    valueText={`${settings.auxiliaryVoltage} V`} onChange={(index) => update({ auxiliaryVoltage: auxiliaryVoltages[index] })} />;

  const voltage = field === 'ch2Voltage';
  const followsMaster = voltage && settings.tracking !== 'independent';
  const value = followsMaster ? component.settings.voltage : settings[field];
  return <InstrumentDial label={label} value={value} min={0} max={voltage ? 30 : 3} step={voltage ? 0.1 : 0.01}
    valueText={`${value.toFixed(voltage ? 1 : 2)} ${voltage ? 'V' : 'A'}${followsMaster ? ' · CH1 연동' : ''}`}
    disabled={calibration || followsMaster} style={style} onChange={(next) => update({ [field]: next })} />;
}
