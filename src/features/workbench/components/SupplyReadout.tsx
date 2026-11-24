import type { CircuitComponent, CircuitWorkspace } from '../../../types/circuit';
export function SupplyReadout({component:c,workspace:w}:{component:CircuitComponent;workspace:CircuitWorkspace}) {
  const trip=w.simulation.status==='error',active=w.power.on&&c.settings.outputEnabled!==false&&!trip;
  return <div className="supply-readout">
    {[{name:'CH2',pin:'ch2-plus',voltage:5},{name:'CH1',pin:'plus',voltage:c.settings.voltage}].map(channel=><div key={channel.name}><small>{channel.name}</small><strong>{(trip?0:channel.voltage).toFixed(1)}<small>V</small></strong><b>{(active?w.simulation.sourceCurrents?.[c.id+':'+channel.pin]??0:0).toFixed(2)}<small>A</small></b></div>)}
    <span>{trip?'C.C / OVERLOAD':active?'OUTPUT ON':'OUTPUT OFF'}</span>
  </div>;
}
