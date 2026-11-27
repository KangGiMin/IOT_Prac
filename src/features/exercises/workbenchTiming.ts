import type { buildCompletedWorkbench } from './completedCircuit';
import type { Exercise } from './model';
import { motorState, stepCircuit, stopped } from './solver';
import type { RunState } from './solver';

type Board = ReturnType<typeof buildCompletedWorkbench>;
type SignalValue = boolean | string;
export interface TimingEvent { time: number; value: SignalValue }
export interface TimingSignal {
  id: string;
  label: string;
  kind: 'input' | 'relay' | 'timer' | 'load' | 'motor';
  states: [off: string, on: string];
  events: TimingEvent[];
  pulses: { time: number; on: boolean }[];
}

interface TimingSnapshot {
  power: boolean;
  buttons: Record<string, boolean>;
  state: RunState;
}

interface SignalDefinition extends Omit<TimingSignal, 'events' | 'pulses'> {
  read: (snapshot: TimingSnapshot) => SignalValue;
}

// PB presses in the reference example. Times leave room to see self-holding,
// priority, delayed outputs, or several cycles of the alternating lamps.
const referencePresses: Record<number, readonly [second: number, button: number][]> = {
  1: [[1, 1]], 2: [[1, 1]], 3: [[1, 1], [2, 2]],
  4: [[1, 1], [2, 2], [3, 3]], 5: [[1, 1], [2, 3], [3, 2]],
  6: [[1, 1], [2, 2], [3, 4]], 7: [[1, 1], [2, 2], [3, 4]],
  8: [[1, 1], [2, 2], [3, 4]], 9: [[1, 1], [2, 2], [3, 4]],
  10: [[1, 3], [2, 2], [3, 1], [4, 4]], 11: [[1, 3], [2, 1], [3, 2], [4, 4]],
  12: [[1, 1], [2, 2], [3, 4]],
  13: [[1, 2], [2, 1], [3, 2]], 14: [[1, 2], [2, 1], [3, 2], [4, 3]],
  15: [[1, 2], [2, 1], [3, 2], [4, 3], [5, 4]],
  16: [[1, 1], [6, 2]], 17: [[1, 1]],
  18: [[1, 1], [2, 4], [3, 2], [4, 4], [5, 3], [6, 4]],
  19: [[1, 1], [2, 2]], 20: [[1, 1], [2, 2], [3, 4]],
  21: [[1, 1], [2, 2], [3, 3], [4, 4]], 22: [[1, 1], [2, 2], [3, 3], [4, 4]],
  23: [[1, 1], [3, 2]], 24: [[1, 1], [2, 2]],
  25: [[1, 1], [5.5, 2]], 26: [[1, 1], [4.5, 2]],
};

type Operation = { time: number } & (
  | { power: boolean }
  | { button: string; pressed: boolean }
);

function referenceOperations(id: number): Operation[] {
  const presses = referencePresses[id];
  const off = id === 17 ? 5 : Math.ceil(presses.at(-1)![0] + 1);
  return [
    { time: 0.5, power: true },
    ...presses.flatMap(([time, number]) => [
      { time, button: `PB${number}`, pressed: true },
      { time: time + 0.4, button: `PB${number}`, pressed: false },
    ]),
    { time: off, power: false },
  ];
}

function signalDefinitions(exercise: Exercise, board: Board): SignalDefinition[] {
  const definitions: SignalDefinition[] = [
    { id: 'power', label: '전원', kind: 'input', states: ['OFF', 'ON'], read: ({ power }) => power },
    ...board.buttons.map(({ id }): SignalDefinition => ({
      id, label: id, kind: 'input', states: ['해제', '누름'],
      read: ({ buttons }) => !!buttons[id],
    })),
  ];
  for (const { id, kind, seconds, timerMode } of board.devices) {
    switch (kind) {
      case 'relay':
        definitions.push({ id, label: `${id} 코일`, kind, states: ['무여자', '여자'], read: ({ state }) => !!state.on[id] });
        break;
      case 'timer':
        definitions.push(
          { id: `${id}:supply`, label: `${id} 전원`, kind, states: ['차단', '급전'], read: ({ state }) => !!state.timing[id] },
          { id, label: `${id} 출력 (${timerMode === 'off-delay' ? 'OFF' : 'ON'} ${seconds}초)`, kind,
            states: ['OFF', 'ON'], read: ({ state }) => !!state.on[id] },
        );
        break;
      case 'lamp':
      case 'buzzer':
        definitions.push({ id, label: `${id} ${kind === 'lamp' ? '램프' : '부저'}`, kind: 'load',
          states: kind === 'lamp' ? ['소등', '점등'] : ['정지', '울림'], read: ({ state }) => !!state.on[id] });
        break;
      case 'motor':
        definitions.push({ id, label: 'M 모터', kind, states: ['정지', '운전'],
          read: ({ power, state }) => power ? motorState(exercise, state) : '정지' });
        break;
    }
  }
  return definitions;
}

export function buildWorkbenchTiming(exercise: Exercise, board: Board) {
  const operations = referenceOperations(exercise.id);
  const definitions = signalDefinitions(exercise, board);
  const signals: TimingSignal[] = definitions.map(({ read: _, ...definition }) => ({
    ...definition, events: [], pulses: [],
  }));
  const signalById = new Map(signals.map((signal) => [signal.id, signal]));
  const timestamp = (time: number) => Math.round(time * 1e6) / 1e6;
  let power = false;
  let buttons: Record<string, boolean> = {};
  let state = stopped();
  const capture = (time: number, settled: RunState) => {
    // The solver calculates exact timer boundaries. Round only floating-point
    // representation noise when events share a timestamp.
    const stamp = timestamp(time);
    const healthy = power && !settled.short && !settled.unstable;
    const snapshot = { power, buttons, state: healthy ? settled : stopped() };
    definitions.forEach(({ read, kind }, index) => {
      const value = kind === 'motor' && power && !healthy
        ? '보호 정지' : read(snapshot);
      const events = signals[index].events;
      if (events.at(-1)?.time === stamp) events.pop();
      if (events.at(-1)?.value !== value) events.push({ time: stamp, value });
    });
  };
  let time = 0;
  capture(time, state);
  for (const operation of operations) {
    state = stepCircuit(board.circuit, board.leads, buttons, state, operation.time - time, power,
      (after, settled, changes) => {
        const stamp = time + after;
        capture(stamp, settled);
        for (const { id, on } of changes) {
          if (!!settled.on[id] !== on)
            signalById.get(id)?.pulses.push({ time: timestamp(stamp), on });
        }
      });
    time = operation.time;
    if ('power' in operation) {
      power = operation.power;
      if (!power) buttons = {};
    } else {
      buttons = { ...buttons, [operation.button]: operation.pressed };
    }
    state = stepCircuit(board.circuit, board.leads, buttons, state, 0, power);
    capture(time, state);
  }
  return { signals, operations, duration: time + 0.5 };
}

export type WorkbenchTiming = ReturnType<typeof buildWorkbenchTiming>;

export function signalAt(signal: TimingSignal, time: number): string {
  let value: SignalValue = false;
  for (const event of signal.events) {
    if (event.time > time) break;
    value = event.value;
  }
  return typeof value === 'string' ? value : signal.states[value ? 1 : 0];
}
