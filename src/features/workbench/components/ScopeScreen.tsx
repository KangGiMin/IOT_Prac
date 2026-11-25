import { ScopeDisplay } from '../../scope/ScopeDisplay';
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
  return <ScopeDisplay id={id} />;
}
