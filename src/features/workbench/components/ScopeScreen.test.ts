import { describe, expect, it } from 'vitest';
import { appendScopeSample, type ScopeSample } from './ScopeScreen';

describe('scope history compression', () => {
  it('draws a minute of steady DC from two endpoints instead of 1800 repeated samples', () => {
    const history: ScopeSample[] = [];
    for (let t = 0; t <= 60000; t += 33)
      appendScopeSample(history, { t, ch1: 0, ch2: 5 });
    expect(history).toHaveLength(2);
    expect(history[0].t).toBe(0);
    expect(history[1].t).toBe(59994);
  });
  it('preserves both-channel transitions and floating gaps', () => {
    const history: ScopeSample[] = [];
    const values = [
      [0, 0],
      [0, 0],
      [0, 0],
      [5, 0],
      [5, 0],
      [5, 0],
      [null, null],
      [null, null],
      [null, null],
      [0, 5],
    ];
    values.forEach(([ch1, ch2], t) =>
      appendScopeSample(history, { t, ch1, ch2 }),
    );
    expect(history).toEqual([
      { t: 0, ch1: 0, ch2: 0 },
      { t: 2, ch1: 0, ch2: 0 },
      { t: 3, ch1: 5, ch2: 0 },
      { t: 5, ch1: 5, ch2: 0 },
      { t: 6, ch1: null, ch2: null },
      { t: 8, ch1: null, ch2: null },
      { t: 9, ch1: 0, ch2: 5 },
    ]);
  });
  it('bounds rapid transitions and retains the sample preceding the visible window', () => {
    const history: ScopeSample[] = [];
    for (let t = 0; t <= 20000; t += 10)
      appendScopeSample(history, { t, ch1: t % 20 ? 0 : 5, ch2: null });
    expect(history.length).toBeLessThanOrEqual(1200);
    expect(history[0].t).toBeLessThanOrEqual(14000);
    expect(history[1].t).toBeGreaterThanOrEqual(14000);
    expect(history.at(-1)!.t).toBe(20000);
  });
});
