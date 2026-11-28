import { expect, it } from 'vitest';
import { buildCompletedWorkbench } from './completedCircuit';
import { exercises } from './model';
import { buildWorkbenchTiming, signalAt } from './workbenchTiming';

function timingFor(id: number) {
  const exercise = exercises.find((exercise) => exercise.id === id)!;
  return buildWorkbenchTiming(exercise, buildCompletedWorkbench(exercise));
}

function eventsFor(id: number, signalId: string) {
  return timingFor(id).signals.find((signal) => signal.id === signalId)!.events;
}

it.each(exercises)('charts the assembled drawing $id with every input and output', (exercise) => {
  const board = buildCompletedWorkbench(exercise);
  const { signals, operations, duration } = buildWorkbenchTiming(exercise, board);
  expect(new Set(signals.map((signal) => signal.id))).toEqual(
    new Set([
      'power',
      ...board.devices.filter(({ kind }) => kind !== 'supply').map(({ id }) => id),
      ...board.devices.filter(({ kind }) => kind === 'timer').map(({ id }) => `${id}:supply`),
    ]),
  );
  const inputs = new Set(
    operations.flatMap((operation) => ('button' in operation ? [operation.button] : [])),
  );
  expect(inputs).toEqual(new Set(board.buttons.map(({ id }) => id)));
  expect(signals.find(({ id }) => id === 'power')?.events.map(({ value }) => value)).toEqual([
    false,
    true,
    false,
  ]);
  for (const signal of signals) {
    expect(signal.events[0].time).toBe(0);
    const times = signal.events.map(({ time }) => time);
    expect(new Set(times).size).toBe(times.length);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times.at(-1)).toBeLessThan(duration);
    expect(signalAt(signal, duration)).toBe(signal.states[0]);
  }
});

it('shows polarity reversal and opposite input priority from the actual relay outputs', () => {
  expect(eventsFor(1, 'M').slice(1, 4)).toEqual([
    { time: 0.5, value: 'CCW' },
    { time: 1, value: 'CW' },
    { time: 1.4, value: 'CCW' },
  ]);
  expect(eventsFor(7, 'R2')).toContainEqual({ time: 2, value: true });
  expect(eventsFor(8, 'R2')).toEqual([{ time: 0, value: false }]);
});

it('keeps the exact lamp and buzzer transitions for delay and automatic release', () => {
  expect(eventsFor(16, 'PL1')[1]).toEqual({ time: 2, value: true });
  expect(eventsFor(16, 'PL2')[1]).toEqual({ time: 5, value: true });
  expect(eventsFor(17, 'LAMP1').at(-1)).toEqual({ time: 4, value: false });
  expect(eventsFor(18, 'BZ')).toEqual([
    { time: 0, value: false },
    { time: 1, value: true },
    { time: 1.3, value: false },
    { time: 3, value: true },
    { time: 3.3, value: false },
    { time: 5, value: true },
    { time: 5.3, value: false },
  ]);
});

it.each([
  { id: 25, delay: 1 },
  { id: 26, delay: 0.5 },
])(
  'includes successive timer cycles and the instantaneous trigger in drawing $id',
  ({ id, delay }) => {
    expect(eventsFor(id, 'LAMP1').slice(1, 5)).toEqual([
      { time: 1, value: true },
      { time: 1 + delay, value: false },
      { time: 1 + 2 * delay, value: true },
      { time: 1 + 3 * delay, value: false },
    ]);
    const trigger = timingFor(id).signals.find((signal) => signal.id === 'T1')!;
    expect(trigger.pulses).toContainEqual({ time: 1 + delay, on: true });
    if (id === 26) expect(eventsFor(id, 'LAMP2')[1]).toEqual({ time: 1.5, value: true });
  },
);
