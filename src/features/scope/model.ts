export type ScopeChannelId = 'ch1' | 'ch2';
export const getScopeChannel = (channels: Record<string, ScopeChannelId>, id: string): ScopeChannelId =>
  Object.hasOwn(channels, id) ? channels[id] : 'ch1';
export type WaveShape = 'sine' | 'square' | 'triangle' | 'ramp' | 'dc';
export interface GeneratorSettings {
  enabled: boolean; shape: WaveShape; frequency: number; vpp: number;
  offset: number; phase: number; duty: number;
}
export interface ScopeChannelSettings {
  enabled: boolean; source: 'probe' | 'generator'; coupling: 'DC' | 'AC' | 'GND';
  voltsDiv: number; offset: number; probe: 1 | 10; actualProbe: 1 | 10; invert: boolean;
  generator: GeneratorSettings;
}
export interface ScopeSettings {
  timeDiv: number; delayDiv: number;
  channels: Record<ScopeChannelId, ScopeChannelSettings>;
  trigger: { mode: 'auto' | 'normal' | 'single'; source: ScopeChannelId; slope: 'rising' | 'falling'; level: number };
  display: 'yt' | 'xy' | 'fft'; math: 'off' | 'add' | 'subtract';
  reference: boolean;
  acquire: 'sample' | 'average' | 'peak'; averageCount: 4 | 16;
  cursors: { enabled: boolean; channel: ScopeChannelId; x1: number; x2: number; y1: number; y2: number };
}
export const TIME_DIVS = [0.00001,0.00002,0.00005,0.0001,0.0002,0.0005,0.001,0.002,0.005,0.01,0.02,0.05,0.1,0.2,0.5,1,2,5,10];
export const VOLT_DIVS = [0.02,0.05,0.1,0.2,0.5,1,2,5,10];
const channel = (offset: number): ScopeChannelSettings => ({
  enabled: true, source: 'probe', coupling: 'DC', voltsDiv: 2, offset, probe: 1, actualProbe: 1, invert: false,
  generator: { enabled: true, shape: 'sine', frequency: 100, vpp: 4, offset: 0, phase: 0, duty: 50 },
});
export function defaultScopeSettings(): ScopeSettings {
  return { timeDiv: 0.001, delayDiv: 0, channels: { ch1: channel(1), ch2: channel(-4) },
    trigger: { mode: 'auto', source: 'ch1', slope: 'rising', level: 2.5 },
    display: 'yt', math: 'off', reference: false, acquire: 'sample', averageCount: 4,
    cursors: { enabled: false, channel: 'ch1', x1: 0.25, x2: 0.75, y1: 0, y2: 5 } };
}
export const getScopeSettings = (scope?: ScopeSettings): ScopeSettings => scope ?? defaultScopeSettings();
/** A bounded file contract: captures never enter circuit JSON or undo history. */
export function parseScopeSettings(input: unknown): ScopeSettings {
  const object = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('계측 설정 객체가 올바르지 않습니다.');
    return v as Record<string, unknown>;
  };
  const num = (v: unknown, a: number, b: number) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < a || v > b) throw new Error(`계측 값은 ${a}~${b} 범위여야 합니다.`);
    return v;
  };
  const bool = (v: unknown) => { if (typeof v !== 'boolean') throw new Error('계측 ON/OFF 값이 올바르지 않습니다.'); return v; };
  const choice = <T extends string | number>(v: unknown, choices: readonly T[]): T => {
    if (!choices.includes(v as T)) throw new Error('지원하지 않는 계측 설정입니다.'); return v as T;
  };
  const s = object(input), channels = object(s.channels), trigger = object(s.trigger), cursors = object(s.cursors);
  const readChannel = (id: ScopeChannelId): ScopeChannelSettings => {
    const c = object(channels[id]), g = object(c.generator);
    return { enabled: bool(c.enabled), source: choice(c.source,['probe','generator']), coupling: choice(c.coupling,['DC','AC','GND']),
      voltsDiv: choice(c.voltsDiv,VOLT_DIVS), offset: num(c.offset,-50,50), probe: choice(c.probe,[1,10]), actualProbe: choice(c.actualProbe,[1,10]), invert: bool(c.invert),
      generator: { enabled: bool(g.enabled), shape: choice(g.shape,['sine','square','triangle','ramp','dc']), frequency: num(g.frequency,0.1,10000), vpp: num(g.vpp,0,20), offset: num(g.offset,-10,10), phase: num(g.phase,0,360), duty: num(g.duty,1,99) } };
  };
  return { timeDiv: choice(s.timeDiv,TIME_DIVS), delayDiv: num(s.delayDiv,-2,5), channels: { ch1: readChannel('ch1'), ch2: readChannel('ch2') },
    trigger: { mode: choice(trigger.mode,['auto','normal','single']), source: choice(trigger.source,['ch1','ch2']), slope: choice(trigger.slope,['rising','falling']), level: num(trigger.level,-50,50) },
    display: choice(s.display,['yt','xy','fft']), math: choice(s.math,['off','add','subtract']), reference: s.reference === undefined ? false : bool(s.reference), acquire: choice(s.acquire,['sample','average','peak']), averageCount: choice(s.averageCount,[4,16]),
    cursors: { enabled: bool(cursors.enabled), channel: choice(cursors.channel,['ch1','ch2']), x1: num(cursors.x1,0,1), x2: num(cursors.x2,0,1), y1: num(cursors.y1,-50,50), y2: num(cursors.y2,-50,50) } };
}
export function engineering(value: number | null | undefined, unit: string): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const a = Math.abs(value);
  const [factor,prefix] = a === 0 ? [1,''] : a >= 1e6 ? [1e6,'M'] : a >= 1e3 ? [1e3,'k'] : a >= 1 ? [1,''] : a >= 1e-3 ? [1e-3,'m'] : a >= 1e-6 ? [1e-6,'µ'] : [1e-9,'n'];
  return `${Number((value / Number(factor)).toPrecision(4))} ${prefix}${unit}`;
}
