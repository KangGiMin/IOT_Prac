import { useCircuitStore } from '../../store/usePhotoCircuitStore';
import { useLearningCenter } from '../learning/useLearningCenter';
import { getScopeSettings } from './model';
import { scopeAutoSetup } from './ScopeDisplay';
import { useScopeRuntime } from './runtime';
export type ScopePhotoAction = 'auto'|'single'|'force'|'midpoint'|'ch1'|'ch2'|'math'|'cursor'|'display'|'acquire'|'measure'|'storage'|'utility'|'trigger'|'ref';
export function performScopeAction(id:string,action:ScopePhotoAction) {
  const store=useCircuitStore.getState(),c=store.workspaces.digital.components.find(c=>c.id===id);
  if(!c||store.calibration)return;
  const s=getScopeSettings(c.settings.scope),record=useScopeRuntime.getState().records[id];
  if(action==='auto'){store.updateScope(id,scopeAutoSetup(s,record?.capture),true);return;}
  if(action==='single'){store.updateScope(id,{...s,trigger:{...s.trigger,mode:'single'}},true);useScopeRuntime.getState().command(id,'single');return;}
  if(action==='force'){useScopeRuntime.getState().command(id,'force');return;}
  if(action==='midpoint'){
    const values=record?.capture?.[s.trigger.source].filter((v):v is number=>v!=null)??[];
    const level=values.length?(Math.min(...values)+Math.max(...values))/2:s.channels[s.trigger.source].generator.offset;
    store.updateScope(id,{...s,trigger:{...s.trigger,level:Math.max(-50,Math.min(50,level))}});return;
  }
  if(action==='ch1'||action==='ch2')useLearningCenter.getState().setChannel(action);
  if(action==='math')store.updateScope(id,{...s,math:s.math==='off'?'add':s.math==='add'?'subtract':'off'});
  if(action==='cursor')store.updateScope(id,{...s,cursors:{...s.cursors,enabled:!s.cursors.enabled}});
  if(action==='display')store.updateScope(id,{...s,display:s.display==='yt'?'xy':s.display==='xy'?'fft':'yt'});
  if(action==='acquire')store.updateScope(id,{...s,acquire:s.acquire==='sample'?'average':s.acquire==='average'?'peak':'sample'});
  if(action==='ref'&&record?.capture){useScopeRuntime.getState().reference(id,record.capture,useLearningCenter.getState().scopeChannel);store.updateScope(id,{...s,reference:true});}
  useLearningCenter.getState().openScope(id);
}
