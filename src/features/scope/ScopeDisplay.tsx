import { useEffect, useMemo, useRef, useState } from 'react';
import { useCircuitStore } from '../../store/usePhotoCircuitStore';
import { engineering, getScopeSettings, TIME_DIVS } from './model';
import type { ScopeSettings } from './model';
import { measureScope, scopeSpectrum } from './scopeMath';
import { useScopeRuntime } from './runtime';

export function scopeTimeWindow(s:ScopeSettings,capture:{start:number;dt:number;ch1:readonly unknown[];triggerTime:number|null}) {
  const span=s.timeDiv*10,position=Math.max(.05,Math.min(.95,.3+s.delayDiv/10));
  const anchor=capture.triggerTime??capture.start+capture.dt*(capture.ch1.length-1)*.3;
  return {start:anchor-position*span,span};
}
export function ScopeDisplay({ id, expanded = false }: { id: string; expanded?: boolean }) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const raw=useCircuitStore(s=>s.workspaces.digital.components.find(c=>c.id===id)?.settings.scope);
  const s=useMemo(()=>getScopeSettings(raw),[raw]);
  const record=useScopeRuntime(state=>state.records[id]);
  const reference=useScopeRuntime(state=>state.references[id]);
  const [drag,setDrag]=useState<{key:'x1'|'x2';value:number}|null>(null);
  const capture=record?.capture;
  useEffect(()=>{
    const ctx=canvas.current?.getContext('2d');if(!ctx)return;
    const width=1000,height=600,left=58,right=980,top=42,bottom=548,w=right-left,h=bottom-top;
    ctx.fillStyle='#081c2c';ctx.fillRect(0,0,width,height);
    ctx.lineWidth=1;ctx.strokeStyle='#294656';
    for(let i=0;i<=10;i++){const x=left+w*i/10;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();}
    for(let i=0;i<=8;i++){const y=top+h*i/8;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}
    ctx.fillStyle='#c3d9e2';ctx.font='20px monospace';ctx.fillText(`${record?.status??'READY'}  |  ${s.display.toUpperCase()}`,left,27);
    ctx.font='18px monospace';ctx.fillText(`${engineering(s.timeDiv,'s')}/div`,left,height-10);
    if(!capture){ctx.fillText('신호를 연결하거나 내장 신호발생기를 선택하세요.',110,290);return;}
    const n=capture.ch1.length;
    const window=scopeTimeWindow(s,capture);
    const timeX=(time:number)=>left+(time-window.start)/window.span*w;
    const y=(v:number,id:'ch1'|'ch2')=>top+h/2-(v+s.channels[id].offset)/s.channels[id].voltsDiv*h/8;
    ctx.save();ctx.beginPath();ctx.rect(left,top,w,h);ctx.clip();
    if(s.display==='yt'){
      for(const [id,color] of [['ch1','#ffe04a'],['ch2','#38aaff']] as const){
        if(!s.channels[id].enabled)continue;
        const values=capture[id];ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.beginPath();let connected=false;
        for(let i=0;i<n;i++){const v=values[i];if(v==null){connected=false;continue;}const x=timeX(capture.start+i*capture.dt);if(!connected)ctx.moveTo(x,y(v,id));else ctx.lineTo(x,y(v,id));connected=true;}ctx.stroke();
        if(s.acquire==='peak')for(let i=0;i<n-1;i+=2){const a=values[i],b=values[i+1];if(a==null||b==null)continue;ctx.beginPath();ctx.moveTo(timeX(capture.start+i*capture.dt),y(Math.min(a,b),id));ctx.lineTo(timeX(capture.start+i*capture.dt),y(Math.max(a,b),id));ctx.stroke();}
      }
      if(s.math!=='off'){
        ctx.strokeStyle='#f08bff';ctx.beginPath();let connected=false;
        for(let i=0;i<n;i++){const a=capture.ch1[i],b=capture.ch2[i];if(a==null||b==null){connected=false;continue;}const value=s.math==='add'?a+b:a-b,x=timeX(capture.start+i*capture.dt);
          if(!connected)ctx.moveTo(x,y(value,'ch1'));else ctx.lineTo(x,y(value,'ch1'));connected=true;}ctx.stroke();
      }
      if(s.reference&&reference){
        const ref=reference.capture,values=ref[reference.channel];
        const anchor=capture.triggerTime??capture.start+capture.dt*(n-1)*.3;
        const refOrigin=(ref.triggerTime??ref.start+ref.dt*(values.length-1)*.3)-ref.start;
        ctx.strokeStyle='#c9cbd2';ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.beginPath();let connected=false;
        for(let i=0;i<values.length;i++){const value=values[i];if(value==null){connected=false;continue;}
          const x=timeX(anchor+i*ref.dt-refOrigin);
          if(!connected)ctx.moveTo(x,y(value,reference.channel));else ctx.lineTo(x,y(value,reference.channel));connected=true;
        }ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#c9cbd2';ctx.font='16px monospace';ctx.fillText(`REF ${reference.channel.toUpperCase()}`,right-100,top+22);
      }
      if(capture.triggerTime!=null){const x=timeX(capture.triggerTime);ctx.strokeStyle='#f3a35c';ctx.setLineDash([7,7]);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();ctx.setLineDash([]);}
      if(s.cursors.enabled){
        const cursors={...s.cursors,...(drag?{[drag.key]:drag.value}:{})};ctx.strokeStyle='#d5d5ff';ctx.lineWidth=1.5;ctx.setLineDash([6,5]);
        for(const key of ['x1','x2'] as const){const x=left+cursors[key]*w;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();}
        for(const v of [cursors.y1,cursors.y2]){ctx.beginPath();ctx.moveTo(left,y(v,cursors.channel));ctx.lineTo(right,y(v,cursors.channel));ctx.stroke();}ctx.setLineDash([]);
      }
    }else if(s.display==='xy'){
      ctx.strokeStyle='#88efc0';ctx.lineWidth=2;ctx.beginPath();let connected=false;
      for(let i=0;i<n;i++){const a=capture.ch1[i],b=capture.ch2[i];if(a==null||b==null){connected=false;continue;}
        const x=left+w/2+(a+s.channels.ch1.offset)/s.channels.ch1.voltsDiv*w/10;
        if(!connected)ctx.moveTo(x,y(b,'ch2'));else ctx.lineTo(x,y(b,'ch2'));connected=true;}ctx.stroke();
    }else{
      const spectrum=scopeSpectrum(capture.ch1,capture.dt),max=Math.max(0.001,...spectrum.map(p=>p.amplitude))*1.15;
      ctx.strokeStyle='#ffe04a';ctx.lineWidth=2;ctx.beginPath();
      spectrum.forEach((p,i)=>{const x=left+i/Math.max(1,spectrum.length-1)*w,yy=bottom-p.amplitude/max*h;if(i===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);});ctx.stroke();
      ctx.fillStyle='#c3d9e2';ctx.font='18px monospace';ctx.fillText(`0 ~ ${engineering(1/(2*capture.dt),'Hz')} | ${engineering(max,'V')} peak`,left+12,top+28);
    }
    ctx.restore();
    ctx.font='18px monospace';
    for(const [id,color,x] of [['ch1','#ffe04a',320],['ch2','#38aaff',650]] as const){ctx.fillStyle=color;ctx.fillText(`${id.toUpperCase()} ${engineering(s.channels[id].voltsDiv,'V')}/div ${s.channels[id].coupling}`,x,height-10);}
    ctx.fillStyle='#91aebb';ctx.font='16px monospace';ctx.fillText(`${engineering(1/capture.dt,'Sa/s')} · ${n} points`,left,bottom+18);
  },[capture,record?.status,s,drag,reference]);
  const position=(event:React.PointerEvent<HTMLCanvasElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();return Math.max(0,Math.min(1,((event.clientX-rect.left)/rect.width*1000-58)/922));
  };
  return <canvas ref={canvas} width={1000} height={600} className={`scope-canvas ${expanded?'scope-canvas-expanded':''}`}
    data-scope-display={id} data-reference={s.reference&&reference?reference.channel:''} role="img" aria-label="CH1 노란색, CH2 파란색 실시간 계측 파형" title="프로브·내장 발생기 파형. 커서를 켜면 수직 커서를 마우스로 이동할 수 있습니다."
    onPointerDown={event=>{if(!expanded||!s.cursors.enabled||s.display!=='yt')return;const value=position(event);const key=Math.abs(value-s.cursors.x1)<Math.abs(value-s.cursors.x2)?'x1':'x2';event.currentTarget.setPointerCapture(event.pointerId);setDrag({key,value});}}
    onPointerMove={event=>{if(drag&&event.currentTarget.hasPointerCapture(event.pointerId))setDrag({...drag,value:position(event)});}}
    onPointerUp={event=>{if(!drag)return;useCircuitStore.getState().updateScope(id,{...s,cursors:{...s.cursors,[drag.key]:position(event)}});setDrag(null);}}
    onPointerCancel={()=>setDrag(null)} />;
}

export function scopeAutoSetup(s: ScopeSettings, capture?: {ch1:(number|null)[];ch2:(number|null)[];dt:number}|null): ScopeSettings {
  const next=structuredClone(s);next.display='yt';next.trigger.mode='auto';next.delayDiv=0;
  const available=(['ch1','ch2'] as const).find(id=>s.channels[id].enabled&&(
    (s.channels[id].source==='generator'&&s.channels[id].generator.enabled&&s.channels[id].generator.shape!=='dc')||
    (capture&&measureScope(capture[id],capture.dt).frequency!=null)));
  if(available)next.trigger.source=available;
  for(const id of ['ch1','ch2'] as const){
    const c=next.channels[id],known=capture?.[id].filter((v):v is number=>v!=null)??[];
    const min=known.length?Math.min(...known):c.source==='generator'?c.generator.offset-c.generator.vpp/2:0;
    const max=known.length?Math.max(...known):c.source==='generator'?c.generator.offset+c.generator.vpp/2:5;
    c.voltsDiv=[.02,.05,.1,.2,.5,1,2,5,10].find(v=>v>=Math.max(.02,(max-min)/6))??10;c.offset=Math.max(-50,Math.min(50,-(max+min)/2));
    if(id===next.trigger.source)next.trigger.level=(max+min)/2;
  }
  const channel=next.channels[next.trigger.source];
  const frequency=channel.source==='generator'&&channel.generator.shape!=='dc'?channel.generator.frequency:capture?measureScope(capture[next.trigger.source],capture.dt).frequency:null;
  if(frequency){
    const ideal=1/frequency*.25;
    next.timeDiv=TIME_DIVS.reduce((best,v)=>Math.abs(Math.log(v/ideal))<Math.abs(Math.log(best/ideal))?v:best,.001);
  }
  return next;
}
