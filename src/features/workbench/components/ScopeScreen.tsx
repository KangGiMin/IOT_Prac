import { useEffect, useRef } from 'react';
import { useCircuitStore } from '../../../store/usePhotoCircuitStore';
import { ttlLevel } from '../../../engine/circuitSolver';
export type ScopeSample = { t: number; ch1: number | null; ch2: number | null };
/** Keep transition times and the two ends of each constant run, including gaps. */
export function appendScopeSample(history: ScopeSample[], next: ScopeSample) {
  const last = history.at(-1),
    before = history.at(-2);
  if (
    last &&
    before &&
    last.ch1 === next.ch1 &&
    last.ch2 === next.ch2 &&
    before.ch1 === last.ch1 &&
    before.ch2 === last.ch2
  )
    last.t = next.t;
  else history.push(next);
  while (
    history.length > 1200 ||
    (history.length > 2 && history[1].t < next.t - 6000)
  )
    history.shift();
}
export function scopeLevel(voltage: number | null) {
  const logic = ttlLevel(voltage);
  return logic === 0 ? 0 : logic === 1 ? 5 : null;
}
/** Real sampled node levels. Floating/undefined signals are gaps, never fabricated waves. */
export function ScopeScreen({ id }: { id: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let frame = 0,
      last = 0;
    const history: ScopeSample[] = [];
    let lastNow = performance.now();
    const sample = (t: number) => {
      const s = useCircuitStore.getState(),
        w = s.workspaces.digital,
        c = w.components.find((c) => c.id === id);
      if (!c || c.settings.scopeRunning === false) return;
      const ground = w.simulation.pinValues[id + ':ref']?.voltage ?? 0;
      const read = (pin: string) => {
        const value = w.simulation.pinValues[id + ':' + pin]?.voltage;
        return w.power.on && value != null ? scopeLevel(value - ground) : null;
      };
      appendScopeSample(history, { t, ch1: read('ch1'), ch2: read('ch2') });
      lastNow = t;
    };
    const unsub = useCircuitStore.subscribe((state, previous) => {
      if (state.workspaces.digital !== previous.workspaces.digital)
        sample(performance.now());
    });
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < 33) return;
      last = now;
      sample(now);
      const el = canvas.current,
        ctx = el?.getContext('2d');
      if (!el || !ctx) return;
      ctx.fillStyle = '#081c2c';
      ctx.fillRect(0, 0, 640, 360);
      ctx.strokeStyle = '#234052';
      ctx.lineWidth = 1;
      for (let x = 0; x <= 640; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 360);
        ctx.stroke();
      }
      for (let y = 0; y <= 360; y += 36) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(640, y);
        ctx.stroke();
      }
      for (const [channel, color, base] of [
        ['ch1', '#ffe04a', 150],
        ['ch2', '#38aaff', 310],
      ] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        let previous: ScopeSample | null = null;
        for (const point of history) {
          const value = point[channel],
            x = 640 - ((lastNow - point.t) / 5000) * 640;
          if (value === null) {
            previous = null;
            continue;
          }
          const y = base - (value / 5) * 90;
          if (!previous) ctx.moveTo(x, y);
          else {
            ctx.lineTo(x, base - ((previous[channel] ?? value) / 5) * 90);
            ctx.lineTo(x, y);
          }
          previous = point;
        }
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = '20px monospace';
        const value = history.at(-1)?.[channel];
        ctx.fillText(
          channel.toUpperCase() +
            ' ' +
            (value == null ? 'FLOAT' : value.toFixed(1) + 'V'),
          12,
          base - 110,
        );
      }
      ctx.fillStyle = '#b8cfda';
      ctx.font = '18px monospace';
      const running =
        useCircuitStore
          .getState()
          .workspaces.digital.components.find((c) => c.id === id)?.settings
          .scopeRunning !== false;
      ctx.fillText((running ? 'RUN' : 'STOP') + ' | 500 ms/div | 5 V', 12, 352);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      unsub();
    };
  }, [id]);
  return (
    <canvas
      ref={canvas}
      width={640}
      height={360}
      className="scope-canvas"
      role="img"
      aria-label="CH1 노란색, CH2 파란색 실시간 디지털 파형"
    />
  );
}
