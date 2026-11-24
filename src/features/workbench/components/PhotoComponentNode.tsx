import { pinTooltip } from '../../../config/pinTooltip';
import { SupplyReadout } from './SupplyReadout';
import { ScopeScreen } from './ScopeScreen';
import { pinsFor, insertedPins, breadboardPins } from '../../../config/digitalPins';
import { icModel } from '../../../config/ttlModels';
import { sequenceGeometry } from '../../../config/sequencePins';
import { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { componentAssets } from '../../../config/assets';
import { useCircuitStore } from '../../../store/usePhotoCircuitStore';
import type { CircuitComponent, Size } from '../../../types/circuit';
import { containBounds, formatCoordinates, percentAt } from '../utils/geometry';
import { AssetImage } from './AssetImage';
import { PhotoControl } from './PhotoControl';

export type PhotoNode = Node<{ component: CircuitComponent }, 'photo'>;

export const PhotoComponentNode = memo(function PhotoComponentNode({ id, data, selected }: NodeProps<PhotoNode>) {
  const component = data.component;
  const baseAsset=componentAssets[component.assetId];
  const asset=useMemo(()=>component.displaySize?{...baseAsset,size:component.displaySize}:baseAsset,[baseAsset,component.displaySize]);
  const pins=asset.mode==='digital'?pinsFor(component):asset.pins;
  const [hoverBus,setHoverBus]=useState<string|null>(null);
  const workspace=useCircuitStore(s=>s.workspaces[s.mode]);
  const boardComponent=workspace.components.find(c=>c.id===component.insertion?.boardId);
  const inserted=insertedPins(component);
  const pinPosition=(pin:typeof pins[number])=>{const target=inserted[pin.id];const hole=target&&breadboardPins.find(p=>p.id===target.pinId);if(!hole||!boardComponent)return pin.position;return {x:(boardComponent.position.x+(boardComponent.displaySize??componentAssets.breadboard.size).width*hole.position.x/100-component.position.x-bounds.x)/bounds.width*100,y:(boardComponent.position.y+(boardComponent.displaySize??componentAssets.breadboard.size).height*hole.position.y/100-component.position.y-bounds.y)/bounds.height*100};};
  const calibration = useCircuitStore((s) => s.calibration);
  const sample = useCircuitStore((s) => s.sample);
  const powered = useCircuitStore((s) => s.workspaces[s.mode].power.on);
  const energized = useCircuitStore((s) => s.workspaces[s.mode].simulation.energizedComponents.includes(id));
  const faulted = useCircuitStore((s) => s.workspaces[s.mode].simulation.faults?.some((fault) => fault.componentIds.includes(id)) ?? false);
  const wiringMode=useCircuitStore(s=>s.wiringMode);
  const timer=useCircuitStore(s=>s.workspaces[s.mode].simulation.timerStates?.[id]);
  const recent=useCircuitStore(s=>s.workspaces[s.mode].wires.at(-1));
  const halted = useCircuitStore((s) => s.workspaces[s.mode].simulation.status === 'error');
  const updateInternals = useUpdateNodeInternals();
  const [bounds, setBounds] = useState({ x: 0, y: 0, ...asset.size });
  const [natural, setNatural] = useState<Size|null>(null);
  const imageLoaded = useCallback((natural: Size) => {setNatural(natural);setBounds(containBounds(asset.size, natural));}, [asset]);
  useEffect(()=>setBounds(natural?containBounds(asset.size,natural):{x:0,y:0,...asset.size}),[asset,natural]);
  useEffect(() => updateInternals(id), [bounds, id, updateInternals]);
  const board = asset.category === 'board';

  return (
    <div className={`photo-node ${board ? 'is-board' : ''} ${selected ? 'is-selected' : ''} ${calibration ? 'is-calibrating' : ''} ${faulted ? 'has-circuit-fault' : ''} ${component.mountedSocketId ? 'mounted-relay' : ''}`}
      data-asset={asset.id} data-compact={asset.size.height < 150 || asset.size.width < 100} style={asset.size}>
      <AssetImage asset={asset} onLoad={imageLoaded} onFallback={() => {setNatural(null);setBounds({ x: 0, y: 0, ...asset.size });}} />
      <div className={`asset-interactions ${calibration ? 'nodrag nopan' : ''}`}
        style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }}
        onClick={async (event) => {
          if (!calibration) return;
          event.stopPropagation();
          const position = percentAt(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
          const next = { assetId: asset.id, componentId: id, position, copied: false };
          useCircuitStore.getState().select(id);
          useCircuitStore.getState().setSample(next);
          try {
            await navigator.clipboard.writeText(formatCoordinates(position));
            // An older clipboard promise must not overwrite a newer click/mode change.
            if (useCircuitStore.getState().sample === next) useCircuitStore.getState().setSample({ ...next, copied: true });
          } catch { /* The selected coordinate stays available for manual copying. */ }
        }}>
        {asset.id==='panel-board' && calibration && sequenceGeometry.railYs.map(y=><div key={y} className="rail-guide" style={{top:y+'%',left:sequenceGeometry.left+'%',right:(100-sequenceGeometry.right)+'%'}}/>)}
        {asset.id==='relay-socket' && !powered && <div className="relay-mount-target" style={{left:(sequenceGeometry.mount.x-sequenceGeometry.mount.width/2)+'%',top:(sequenceGeometry.mount.y-sequenceGeometry.mount.height/2)+'%',width:sequenceGeometry.mount.width+'%',height:sequenceGeometry.mount.height+'%'}}>RELAY<br/>장착</div>}
        {asset.overlays.map((overlay) => {
          if (overlay.kind === 'needle') {
            const angle = overlay.minAngle + component.settings.timerSeconds / 10 * (overlay.maxAngle - overlay.minAngle);
            return <div key={overlay.id} className="timer-needle" style={{ left: `${overlay.center.x}%`, top: `${overlay.center.y}%`, width: `${overlay.length}%`, transform: `rotate(${angle - 90}deg)` }} />;
          }
          const style = { left: `${overlay.bounds.x}%`, top: `${overlay.bounds.y}%`, width: `${overlay.bounds.width}%`, height: `${overlay.bounds.height}%` };
          if (overlay.kind === 'glow') return <div key={overlay.id} className={`light-overlay ${overlay.id} ${overlay.id==='timer-run' && timer && !timer.output ? 'is-timing' : ''}`} title={overlay.id==='timer-run'?'POWER / RUN':overlay.id==='timer-out'?'OUT':asset.label} style={{ ...style, opacity: ((overlay.id==='cc'||overlay.id==='overload')?powered&&halted:powered && !halted && (component.assetId!=='power-supply'||component.settings.outputEnabled!==false) && (overlay.id==='timer-out'?timer?.output:overlay.id==='timer-run'?!!timer:energized)) ? 0.9 : 0, background: `radial-gradient(ellipse, white 0%, ${overlay.color} 35%, transparent 75%)`, boxShadow: `0 0 28px 14px ${overlay.color}` }} />;
          if(overlay.format==='scope') return <div key={overlay.id} className="scope-overlay nodrag nopan" style={style}><ScopeScreen id={id}/></div>;
          if(overlay.format==='supply') return <div key={overlay.id} className="lcd-overlay supply" style={style}><SupplyReadout component={component} workspace={workspace}/></div>;
          return <div key={overlay.id} className={`lcd-overlay ${overlay.format}`} style={style}>
            {String(overlay.format) === 'supply' ? <><strong>{halted?'0.0':component.settings.voltage.toFixed(1)} <small>V</small></strong><b className="supply-current">{(workspace.simulation.sourceCurrents?.[id+':plus']??0).toFixed(2)} A</b><span>{halted ? 'TRIPPED' : powered && component.settings.outputEnabled!==false ? 'OUTPUT ON' : 'OUTPUT OFF'}</span></> : <><span>CH1 / CH2</span><strong>DC 측정</strong><small>파형 표시 준비 중</small></>}
          </div>;
        })}
        {asset.controls.map((control) => <PhotoControl key={control.id} component={component} control={control} calibration={calibration} powered={powered} />)}
        {pins.map((pin) => <Handle id={pin.id} type="source" position={Position.Top}
          isConnectable={!calibration && !powered && wiringMode} onMouseEnter={()=>setHoverBus(pin.bus??null)} onMouseLeave={()=>setHoverBus(null)} className={`photo-pin ${hoverBus && pin.bus===hoverBus?'bus-highlight':''} ${pin.role} ${recent && ((recent.from.componentId===id && recent.from.pinId===pin.id)||(recent.to.componentId===id && recent.to.pinId===pin.id))?'screw-turn':''}`} key={pin.id+((recent?.from.componentId===id || recent?.to.componentId===id)?recent.id:'')}
          style={{ left: `${pinPosition(pin).x}%`, top: `${pinPosition(pin).y}%` }}
          title={`${pinTooltip(component,pin)} · x: ${pin.position.x.toFixed(2)}%, y: ${pin.position.y.toFixed(2)}%`} aria-label={`${asset.label} 단자 ${pin.label}`}>
        </Handle>)}
        {calibration && sample?.componentId === id && <div className="coordinate-marker" style={{ left: `${sample.position.x}%`, top: `${sample.position.y}%` }}>
          <span /><code>x: {sample.position.x.toFixed(2)}%, y: {sample.position.y.toFixed(2)}%</code>
        </div>}
      </div>
      {asset.id==='timer-at8n' && <div className="timer-socket-label">후면 소켓 · {timer ? `${Math.min(timer.elapsed,component.settings.timerSeconds).toFixed(1)} / ${component.settings.timerSeconds.toFixed(1)} s` : 'POWER OFF'}</div>}
      {asset.id==='ic-dip14' && <div className="ic-model-label">{icModel(component)}</div>}
      {asset.id==='switch-3pin' && <div className="switch-state-overlay" style={{left:component.settings.switchOn?'57%':'24%'}}> {component.settings.switchOn?'R':'L'} </div>}
      <div className="photo-node-caption"><span>{asset.label}</span><small>{board ? 'BASE BOARD' : asset.model}</small></div>
    </div>
  );
});
