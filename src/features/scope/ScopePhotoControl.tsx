import type { CircuitComponent, ControlDefinition } from '../../types/circuit';
import { useCircuitStore } from '../../store/usePhotoCircuitStore';
import { useLearningCenter } from '../learning/useLearningCenter';
import { getScopeSettings, TIME_DIVS, VOLT_DIVS } from './model';
import { performScopeAction } from './scopeActions';
type ScopeControl = Extract<ControlDefinition,{kind:'scope-action'|'scope-dial'}>;
export function ScopePhotoControl({component,control,calibration}:{component:CircuitComponent;control:ScopeControl;calibration:boolean}) {
  const selected=useLearningCenter(s=>s.scopeChannel);
  const settings=getScopeSettings(component.settings.scope);
  const style={left:`${control.bounds.x}%`,top:`${control.bounds.y}%`,width:`${control.bounds.width}%`,height:`${control.bounds.height}%`};
  if(control.kind==='scope-action')return <button className="device-control nodrag nopan" style={style} disabled={calibration} aria-label={control.label} title={control.label}
    onClick={()=>{useCircuitStore.getState().select(component.id);performScopeAction(component.id,control.action);}}><span>{control.label}</span></button>;
  const field=control.field;
  const list=field==='timeDiv'?TIME_DIVS:field==='voltsDiv'?VOLT_DIVS:null;
  const value=field==='timeDiv'?settings.timeDiv:field==='voltsDiv'?settings.channels[selected].voltsDiv:field==='offset'?settings.channels[selected].offset:field==='triggerLevel'?settings.trigger.level:settings.delayDiv;
  return <label className="device-control device-dial nodrag nopan" style={style} title={`${control.label}: ${value}`}>
    <input type="range" aria-label={control.label} disabled={calibration} min={list?0:field==='delayDiv'?-2:-50} max={list?list.length-1:field==='delayDiv'?5:50} step={list?1:.1} value={list?list.indexOf(value):value}
      onChange={e=>{
        const next=list?list[e.target.valueAsNumber]:e.target.valueAsNumber;if(!Number.isFinite(next))return;
        const s=field==='timeDiv'?{...settings,timeDiv:next}:field==='voltsDiv'||field==='offset'?{...settings,channels:{...settings.channels,[selected]:{...settings.channels[selected],[field]:next}}}:field==='triggerLevel'?{...settings,trigger:{...settings.trigger,level:next}}:{...settings,delayDiv:next};
        useCircuitStore.getState().select(component.id);useCircuitStore.getState().updateScope(component.id,s);
      }}/><span>{control.label}</span>
  </label>;
}
