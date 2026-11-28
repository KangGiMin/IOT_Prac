import { useEffect } from 'react';
import { useCircuitStore } from '../../store/usePhotoCircuitStore';
import { getScopeSettings } from './model';
import { acquireScope } from './scopeMath';
import type { ScopeCapture } from './scopeMath';
import { useScopeRuntime } from './runtime';
interface Point {
  t: number;
  ch1: number | null;
  ch2: number | null;
}
interface Instrument {
  points: Point[];
  command: number;
  armedAt: number;
  running: boolean;
  mode: string;
  capture: ScopeCapture | null;
  signature: string;
  averages: ScopeCapture[];
}
export function ScopeAcquisition() {
  useEffect(() => {
    const instruments = new Map<string, Instrument>();
    const append = (now: number) => {
      const w = useCircuitStore.getState().workspaces.digital;
      for (const c of w.components.filter((c) => c.assetId === 'oscilloscope')) {
        let instrument = instruments.get(c.id);
        if (!instrument) {
          instrument = {
            points: [],
            command: 0,
            armedAt: now,
            running: false,
            mode: '',
            capture: null,
            signature: '',
            averages: [],
          };
          instruments.set(c.id, instrument);
        }
        const ref = w.simulation.pinValues[`${c.id}:ref`]?.voltage;
        const read = (id: string) => {
          const value = w.simulation.pinValues[`${c.id}:${id}`]?.voltage;
          return w.power.on && ref != null && value != null ? value - ref : null;
        };
        const next = { t: now, ch1: read('ch1'), ch2: read('ch2') };
        const a = instrument.points.at(-1),
          b = instrument.points.at(-2);
        if (
          a &&
          b &&
          a.ch1 === next.ch1 &&
          a.ch2 === next.ch2 &&
          b.ch1 === a.ch1 &&
          b.ch2 === a.ch2
        )
          a.t = now;
        else instrument.points.push(next);
        while (
          instrument.points.length > 4000 ||
          (instrument.points.length > 2 && instrument.points[1].t < now - 300)
        )
          instrument.points.shift();
      }
      for (const id of instruments.keys())
        if (!w.components.some((c) => c.id === id && c.assetId === 'oscilloscope'))
          instruments.delete(id);
    };
    const unsub = useCircuitStore.subscribe((state, previous) => {
      if (state.workspaces.digital !== previous.workspaces.digital)
        append(performance.now() / 1000);
    });
    const tick = () => {
      const now = performance.now() / 1000;
      append(now);
      const state = useCircuitStore.getState();
      for (const c of state.workspaces.digital.components.filter(
        (c) => c.assetId === 'oscilloscope',
      )) {
        const instrument = instruments.get(c.id)!;
        if (c.settings.scopePowered === false) {
          instrument.running = false;
          instrument.capture = null;
          instrument.averages = [];
          if (useScopeRuntime.getState().records[c.id]?.status !== 'OFF')
            useScopeRuntime.getState().publish(c.id, { capture: null, status: 'OFF' });
          continue;
        }
        const settings = getScopeSettings(c.settings.scope),
          running = c.settings.scopeRunning !== false;
        const signature = JSON.stringify(settings);
        if (signature !== instrument.signature) {
          instrument.signature = signature;
          instrument.averages = [];
        }
        if ((running && !instrument.running) || settings.trigger.mode !== instrument.mode)
          instrument.armedAt = now;
        instrument.running = running;
        instrument.mode = settings.trigger.mode;
        const command = useScopeRuntime.getState().commands[c.id];
        let force = false;
        if (command && command.nonce !== instrument.command) {
          instrument.command = command.nonce;
          if (command.type === 'clear') {
            instrument.capture = null;
            instrument.averages = [];
            instrument.points = [];
            useScopeRuntime.getState().publish(c.id, { capture: null, status: 'CLEARED' });
            continue;
          }
          if (command.type === 'single') instrument.armedAt = now;
          force = command.type === 'force';
        }
        if (!running && !force) {
          const record = useScopeRuntime.getState().records[c.id];
          if (record?.status !== 'STOP')
            useScopeRuntime
              .getState()
              .publish(c.id, { capture: instrument.capture, status: 'STOP' });
          continue;
        }
        const probe = (id: 'ch1' | 'ch2', t: number) => {
          const points = instrument.points;
          let low = 0,
            high = points.length - 1,
            index = -1;
          while (low <= high) {
            const mid = (low + high) >> 1;
            if (points[mid].t <= t) {
              index = mid;
              low = mid + 1;
            } else high = mid - 1;
          }
          return index < 0 ? null : points[index][id];
        };
        let capture = acquireScope(settings, now, probe, {
          force,
          armedAt: settings.trigger.mode === 'single' ? instrument.armedAt : undefined,
        });
        if (capture) {
          if (settings.acquire === 'average') {
            instrument.averages.push(capture);
            while (instrument.averages.length > settings.averageCount) instrument.averages.shift();
            const records = instrument.averages;
            capture = {
              ...capture,
              ch1: capture.ch1.map((_, i) =>
                records.every((r) => r.ch1[i] != null)
                  ? records.reduce((s, r) => s + r.ch1[i]!, 0) / records.length
                  : null,
              ),
              ch2: capture.ch2.map((_, i) =>
                records.every((r) => r.ch2[i] != null)
                  ? records.reduce((s, r) => s + r.ch2[i]!, 0) / records.length
                  : null,
              ),
            };
          }
          instrument.capture = capture;
          if (settings.trigger.mode === 'single' && !force) {
            useCircuitStore.getState().updateScope(c.id, settings, false);
            instrument.running = false;
          }
        }
        useScopeRuntime.getState().publish(c.id, {
          capture: instrument.capture,
          status: capture
            ? settings.trigger.mode === 'single' && !force
              ? 'SINGLE 완료'
              : capture.triggerTime == null
                ? 'AUTO / FORCE'
                : 'TRIGGERED'
            : 'WAIT · 트리거 대기',
        });
      }
    };
    tick();
    const timer = window.setInterval(tick, 80);
    return () => {
      window.clearInterval(timer);
      unsub();
    };
  }, []);
  return null;
}
