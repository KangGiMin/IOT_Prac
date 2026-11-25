import { describe, expect, it } from 'vitest';
import { defaultScopeSettings, parseScopeSettings } from './model';
import { acquireScope, generatorValue, measureScope, scopeSpectrum } from './scopeMath';
import { scopeTimeWindow } from './ScopeDisplay';
function sine() {
  const s=defaultScopeSettings();s.timeDiv=.0002;s.trigger.level=1;
  s.channels.ch1.source='generator';s.channels.ch2.enabled=false;
  Object.assign(s.channels.ch1.generator,{frequency:1000,vpp:4,offset:1});return s;
}
describe('educational analog acquisition',()=>{
  it('zooms a frozen record around its trigger without changing recorded samples',()=>{
    const s=sine(),capture=acquireScope(s,1.234,()=>null)!;
    const before=structuredClone(capture),initial=scopeTimeWindow(s,capture);
    expect(initial.span).toBeCloseTo(.002);
    s.timeDiv=.0001;
    const zoomed=scopeTimeWindow(s,capture);
    expect(zoomed.span).toBeCloseTo(.001);
    expect((capture.triggerTime!-zoomed.start)/zoomed.span).toBeCloseTo(.3);
    s.delayDiv=2;
    const moved=scopeTimeWindow(s,capture);
    expect((capture.triggerTime!-moved.start)/moved.span).toBeCloseTo(.5);
    expect(capture).toEqual(before);
  });
  it('measures a 1kHz sine with DC offset from actual sampled values',()=>{
    const capture=acquireScope(sine(),1.234,()=>null)!;
    const m=measureScope(capture.ch1,capture.dt);
    expect(m.min).toBeCloseTo(-1,2);expect(m.max).toBeCloseTo(3,2);
    expect(m.vpp).toBeCloseTo(4,2);expect(m.mean).toBeCloseTo(1,2);
    expect(m.rms).toBeCloseTo(Math.sqrt(3),2);expect(m.frequency).toBeCloseTo(1000,0);
    expect(capture.triggerTime).not.toBeNull();expect(capture.ch1).toHaveLength(1024);
  });
  it('distinguishes AUTO, waiting NORMAL, FORCE and armed SINGLE',()=>{
    const s=sine();s.trigger.level=20;s.trigger.mode='normal';
    expect(acquireScope(s,1,()=>null)).toBeNull();
    expect(acquireScope(s,1,()=>null,{force:true})!.triggerTime).toBeNull();
    s.trigger.mode='auto';expect(acquireScope(s,1,()=>null)).not.toBeNull();
    s.trigger.mode='single';s.trigger.level=1;
    expect(acquireScope(s,1,()=>null,{armedAt:1})).toBeNull();
    expect(acquireScope(s,1,()=>null,{armedAt:.99})!.triggerTime).toBeGreaterThan(.99);
  });
  it('handles AC, GND, inversion and real/menu probe mismatch independently',()=>{
    const s=sine();s.channels.ch1.coupling='AC';s.trigger.level=0;
    let capture=acquireScope(s,1.234,()=>null)!;
    expect(measureScope(capture.ch1,capture.dt).mean).toBeCloseTo(0,2);
    s.channels.ch1.actualProbe=10;s.channels.ch1.probe=1;
    capture=acquireScope(s,1.234,()=>null)!;
    expect(measureScope(capture.ch1,capture.dt).vpp).toBeCloseTo(.4,2);
    expect(capture.warnings.join(' ')).toContain('0.1배');
    s.channels.ch1.probe=10;s.channels.ch1.coupling='DC';s.channels.ch1.invert=true;
    capture=acquireScope(s,1.234,()=>null)!;
    expect(measureScope(capture.ch1,capture.dt).mean).toBeCloseTo(-1,2);
    s.channels.ch1.coupling='GND';
    expect(acquireScope(s,1,()=>null)!.ch1.every(v=>v===0)).toBe(true);
  });
  it('measures 25% duty and never invents a period for DC or missing samples',()=>{
    const s=sine();Object.assign(s.channels.ch1.generator,{shape:'square',vpp:5,offset:2.5,duty:25});s.trigger.level=2.5;
    const c=acquireScope(s,1.234,()=>null)!,m=measureScope(c.ch1,c.dt);
    // A discontinuous edge is resolved to the acquisition sample interval.
    expect(Math.abs(m.frequency!-1000)).toBeLessThan(2);expect(m.duty!).toBeGreaterThan(24);expect(m.duty!).toBeLessThan(26);
    expect(m.positiveWidth!).toBeCloseTo(.00025,5);
    expect(measureScope(Array(1024).fill(5),.001).frequency).toBeNull();
    const gap=[...c.ch1];gap[500]=null;expect(measureScope(gap,c.dt).period).toBeNull();
    const probe=defaultScopeSettings();expect(acquireScope(probe,1,()=>null)!.ch1.every(v=>v===null)).toBe(true);
  });
  it('generates all waveform shapes and reports undersampling',()=>{
    const g=sine().channels.ch1.generator;g.offset=0;g.frequency=1;
    expect(generatorValue(g,.25)).toBeCloseTo(2);
    g.shape='triangle';expect(generatorValue(g,0)).toBe(-2);expect(generatorValue(g,.5)).toBe(2);
    g.shape='ramp';expect(generatorValue(g,0)).toBe(-2);expect(generatorValue(g,.75)).toBe(1);
    g.shape='dc';g.offset=3;expect(generatorValue(g,.77)).toBe(3);
    g.enabled=false;expect(generatorValue(g,0)).toBeNull();
    const s=sine();s.timeDiv=.01;s.channels.ch1.generator.frequency=10000;
    expect(acquireScope(s,1,()=>null)!.warnings.join(' ')).toContain('20점 미만');
  });
  it('finds FFT frequency and peak amplitude without fabricating missing data',()=>{
    const values=Array.from({length:1024},(_,i)=>3+2*Math.sin(2*Math.PI*64*i/1024));
    const spectrum=scopeSpectrum(values,1/1024),peak=spectrum.reduce((a,b)=>a.amplitude>b.amplitude?a:b);
    expect(peak.frequency).toBe(64);expect(peak.amplitude).toBeCloseTo(2,2);expect(spectrum[0].amplitude).toBeLessThan(.001);
    expect(scopeSpectrum([null,1,0,1],.001)).toEqual([]);
  });
  it('validates bounded saved settings rather than accepting unsafe/unknown values',()=>{
    const s=sine();expect(parseScopeSettings(s)).toEqual(s);
    s.channels.ch1.generator.frequency=NaN;expect(()=>parseScopeSettings(s)).toThrow();
    expect(()=>parseScopeSettings({})).toThrow();
  });
});
