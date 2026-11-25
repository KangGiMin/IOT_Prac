import type { GeneratorSettings, ScopeChannelId, ScopeSettings } from './model';
export interface ScopeCapture {
  start: number; dt: number; ch1: (number | null)[]; ch2: (number | null)[];
  triggerTime: number | null; sampledAt: number; warnings: string[];
}
export const SCOPE_POINTS = 1024;
export function generatorValue(g: GeneratorSettings, t: number): number | null {
  if (!g.enabled) return null;
  const phase = ((t * g.frequency + g.phase / 360) % 1 + 1) % 1;
  const shape = g.shape === 'sine' ? Math.sin(phase * Math.PI * 2)
    : g.shape === 'square' ? (phase < g.duty / 100 ? 1 : -1)
    : g.shape === 'triangle' ? 1 - 4 * Math.abs(phase - 0.5)
    : g.shape === 'ramp' ? 2 * phase - 1 : 0;
  return g.offset + g.vpp / 2 * shape;
}
export function acquireScope(s: ScopeSettings, now: number, probe: (id: ScopeChannelId,t: number) => number | null, options: { force?: boolean; armedAt?: number } = {}): ScopeCapture | null {
  const span = s.timeDiv * 10, dt = span / (SCOPE_POINTS - 1), length = SCOPE_POINTS * 2;
  const start = now - (length - 1) * dt;
  const channels = {} as Record<ScopeChannelId,(number | null)[]>;
  const warnings: string[] = [];
  for (const id of ['ch1','ch2'] as const) {
    const c = s.channels[id];
    const raw = Array.from({length},(_,i) => {
      if (!c.enabled) return null;
      if (c.coupling === 'GND') return 0;
      const value = c.source === 'generator' ? generatorValue(c.generator,start + i * dt) : probe(id,start + i * dt);
      return value == null ? null : value / c.actualProbe * c.probe;
    });
    const known = raw.filter((v): v is number => v !== null);
    const dc = c.coupling === 'AC' && known.length ? known.reduce((a,b)=>a+b,0)/known.length : 0;
    channels[id] = raw.map(v => v == null ? null : (v - dc) * (c.invert ? -1 : 1));
    if (c.enabled && c.source === 'generator' && c.generator.enabled && c.generator.frequency * dt > 1/20)
      warnings.push(`${id.toUpperCase()}: 한 주기당 20점 미만입니다. 시간축을 줄여 앨리어싱과 측정 오차를 줄이세요.`);
    if (c.probe !== c.actualProbe) warnings.push(`${id.toUpperCase()}: 실제 프로브와 메뉴의 배율이 달라 전압 표시가 ${c.probe / c.actualProbe}배입니다.`);
  }
  const position = Math.max(0.05, Math.min(0.95, 0.3 + s.delayDiv / 10));
  const pre = Math.round(position * (SCOPE_POINTS - 1));
  let crossing: number | null = null;
  const signal = channels[s.trigger.source];
  for (let i = pre + 1; i <= length - SCOPE_POINTS + pre; i++) {
    const a=signal[i-1],b=signal[i];
    if (a == null || b == null || start+i*dt < (options.armedAt ?? -Infinity)) continue;
    if (s.trigger.slope === 'rising' ? a < s.trigger.level && b >= s.trigger.level : a > s.trigger.level && b <= s.trigger.level) crossing=i;
  }
  if (crossing === null && s.trigger.mode !== 'auto' && !options.force) return null;
  const first = crossing === null || options.force ? length - SCOPE_POINTS : crossing - pre;
  return { start: start + first * dt, dt, ch1: channels.ch1.slice(first,first+SCOPE_POINTS), ch2: channels.ch2.slice(first,first+SCOPE_POINTS),
    triggerTime: crossing === null || options.force ? null : start + crossing * dt, sampledAt: now, warnings };
}
export interface ScopeMeasurements {
  min: number | null; max: number | null; vpp: number | null; mean: number | null; rms: number | null;
  frequency: number | null; period: number | null; duty: number | null; positiveWidth: number | null; negativeWidth: number | null;
  rise: number | null; fall: number | null;
}
export function measureScope(values: readonly (number | null)[], dt: number): ScopeMeasurements {
  const empty: ScopeMeasurements = { min:null,max:null,vpp:null,mean:null,rms:null,frequency:null,period:null,duty:null,positiveWidth:null,negativeWidth:null,rise:null,fall:null };
  const known=values.filter((v):v is number=>v!=null);
  if(!known.length)return empty;
  const min=Math.min(...known),max=Math.max(...known),vpp=max-min;
  const result={...empty,min,max,vpp,mean:known.reduce((a,b)=>a+b,0)/known.length,rms:Math.sqrt(known.reduce((a,b)=>a+b*b,0)/known.length)};
  // A gap or a constant signal cannot establish a full period.
  if(known.length!==values.length || vpp < 1e-8)return result;
  const mid=(min+max)/2, rising:number[]=[],falling:number[]=[];
  const cross=(level:number,up:boolean)=>{
    const times:number[]=[];
    for(let i=1;i<known.length;i++){
      const a=known[i-1],b=known[i];
      if(up ? a<level&&b>=level : a>level&&b<=level) times.push((i-1+(level-a)/(b-a))*dt);
    }
    return times;
  };
  rising.push(...cross(mid,true)); falling.push(...cross(mid,false));
  const periods = rising.slice(1).map((t,i)=>t-rising[i]);
  if(periods.length){
    result.period=periods.reduce((a,b)=>a+b,0)/periods.length;
    result.frequency=1/result.period;
    const widths=rising.flatMap(t=>{const next=falling.find(f=>f>t);return next!=null&&next-t<=result.period!*1.05?[next-t]:[];});
    if(widths.length){result.positiveWidth=widths.reduce((a,b)=>a+b,0)/widths.length;result.duty=result.positiveWidth/result.period*100;result.negativeWidth=result.period-result.positiveWidth;}
  }
  const duration=(low:number[],high:number[])=>{for(const t of low){const end=high.find(x=>x>=t);if(end!==undefined)return end-t;}return null;};
  result.rise=duration(cross(min+vpp*.1,true),cross(min+vpp*.9,true));
  result.fall=duration(cross(min+vpp*.9,false),cross(min+vpp*.1,false));
  return result;
}
export function scopeSpectrum(values: readonly (number | null)[], dt: number) {
  if(values.some(v=>v==null))return [];
  const n=values.length;
  if(n<2 || (n&(n-1)))return [];
  const mean=values.reduce<number>((a,b)=>a+(b??0),0)/n;
  const real=new Float64Array(n),imag=new Float64Array(n);
  let weight=0;
  for(let i=0;i<n;i++){const w=.5*(1-Math.cos(2*Math.PI*i/(n-1)));real[i]=(values[i]!-mean)*w;weight+=w;}
  for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){const t=real[i];real[i]=real[j];real[j]=t;}}
  for(let size=2;size<=n;size<<=1)for(let from=0;from<n;from+=size)for(let j=0;j<size/2;j++){
    const angle=-2*Math.PI*j/size,c=Math.cos(angle),s=Math.sin(angle),a=from+j,b=a+size/2;
    const tr=real[b]*c-imag[b]*s,ti=real[b]*s+imag[b]*c;
    real[b]=real[a]-tr;imag[b]=imag[a]-ti;real[a]+=tr;imag[a]+=ti;
  }
  return Array.from({length:n/2+1},(_,i)=>({frequency:i/(n*dt),amplitude:Math.hypot(real[i],imag[i])/weight*(i===0||i===n/2?1:2)}));
}
