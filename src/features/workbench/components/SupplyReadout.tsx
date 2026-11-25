import type {
  CircuitComponent,
  CircuitWorkspace,
} from '../../../types/circuit';
import { getSupplySettings } from '../../../config/supplySettings';
export function SupplyReadout({
  component: c,
  workspace: w,
}: {
  component: CircuitComponent;
  workspace: CircuitWorkspace;
}) {
  const trip = w.simulation.status === 'error',
    active = w.power.on && c.settings.outputEnabled !== false && !trip;
  const supply = getSupplySettings(c.settings.supply);
  const potential = (pin: string) => w.simulation.pinValues[`${c.id}:${pin}`]?.voltage ?? 0;
  return (
    <div className="supply-readout">
      {[
        { name: 'CH2', pin: 'ch2-plus', minus: 'ch2-minus', voltage: supply.tracking === 'independent' ? supply.ch2Voltage : c.settings.voltage },
        { name: 'CH1', pin: 'plus', minus: 'minus', voltage: c.settings.voltage },
      ].map((channel) => (
        <div key={channel.name} data-channel={channel.name}>
          <small>{channel.name}{w.simulation.limitedOutputs?.includes(c.id + ':' + channel.pin) ? ' CC' : ''}</small>
          <strong>
            {(trip ? 0 : active ? potential(channel.pin) - potential(channel.minus) : channel.voltage).toFixed(1)}
            <small>V</small>
          </strong>
          <b>
            {(active
              ? (w.simulation.sourceCurrents?.[c.id + ':' + channel.pin] ?? 0)
              : 0
            ).toFixed(2)}
            <small>A</small>
          </b>
        </div>
      ))}
      <span>
        {trip ? 'C.C / OVERLOAD' : active ? 'OUTPUT ON' : 'OUTPUT OFF'}
        {' · '}{supply.tracking === 'independent' ? 'INDEP' : supply.tracking.toUpperCase()} · CH3 {supply.auxiliaryVoltage}V
      </span>
    </div>
  );
}
