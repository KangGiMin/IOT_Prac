import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALERT_PATTERN, SoundAlert } from './soundAlert';

function fakeAudio(state: AudioContextState = 'running') {
  const param = () => ({
    setValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const oscillator = {
    type: '',
    frequency: param(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = { gain: param(), connect: vi.fn(), disconnect: vi.fn() };
  const context = {
    state,
    currentTime: 10,
    destination: {},
    resume: vi.fn(async () => {
      context.state = 'running';
    }),
    close: vi.fn(async () => {
      context.state = 'closed';
    }),
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
  };
  const alarm = new SoundAlert({
    createContext: () => context as unknown as AudioContext,
  });
  return { alarm, context, oscillator, gain };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Web Audio short alarm', () => {
  it('plays a 1200Hz square wave with 0.2s ON / 0.15s OFF on the audio clock', () => {
    vi.useFakeTimers();
    const { alarm, oscillator, gain } = fakeAudio();
    alarm.start();
    expect(oscillator.type).toBe('square');
    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(1200, 10);
    const calls = gain.gain.setValueAtTime.mock.calls;
    expect(calls).toContainEqual([ALERT_PATTERN.volume, 10]);
    expect(calls).toContainEqual([0, 10.2]);
    const onTimes = calls
      .filter(([value]) => value === ALERT_PATTERN.volume)
      .map(([, time]) => time as number);
    expect(onTimes[1] - onTimes[0]).toBeCloseTo(0.35);
    expect(oscillator.start).toHaveBeenCalledOnce();
    alarm.dispose();
  });
  it('does not overlap duplicate start requests and synchronously silences queued pulses', () => {
    vi.useFakeTimers();
    const { alarm, context, oscillator, gain } = fakeAudio();
    alarm.start();
    alarm.start();
    alarm.setActive(true);
    expect(context.createOscillator).toHaveBeenCalledOnce();
    context.currentTime = 10.1;
    alarm.stop();
    expect(gain.gain.cancelScheduledValues).toHaveBeenCalledWith(10.1);
    expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 10.1);
    expect(oscillator.stop).toHaveBeenCalledOnce();
    expect(oscillator.disconnect).toHaveBeenCalledOnce();
    expect(alarm.isPlaying).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    alarm.dispose();
  });
  it('cannot restart from an old resume promise after power-off', async () => {
    vi.useFakeTimers();
    const { alarm, context } = fakeAudio('suspended');
    let resume!: () => void;
    context.resume.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resume = () => {
            context.state = 'running';
            resolve();
          };
        }),
    );
    alarm.start();
    alarm.stop();
    resume();
    await Promise.resolve();
    expect(context.createOscillator).not.toHaveBeenCalled();
    expect(alarm.isRequested).toBe(false);
    alarm.dispose();
  });
  it('retries a denied autoplay request from the next user gesture', async () => {
    vi.useFakeTimers();
    const { alarm, context } = fakeAudio('suspended');
    context.resume.mockRejectedValueOnce(new Error('autoplay denied'));
    alarm.start();
    await Promise.resolve();
    expect(alarm.isPlaying).toBe(false);
    expect(await alarm.unlock()).toBe(true);
    expect(alarm.isPlaying).toBe(true);
    alarm.dispose();
  });
  it('handles unsupported audio, repeated disposal and context recreation', async () => {
    const unsupported = new SoundAlert({ createContext: () => null });
    unsupported.start();
    expect(await unsupported.unlock()).toBe(false);
    unsupported.stop();
    unsupported.dispose();
    unsupported.dispose();
    expect(unsupported.isPlaying).toBe(false);
    vi.useFakeTimers();
    const first = fakeAudio(),
      second = fakeAudio();
    const factory = vi
      .fn()
      .mockReturnValueOnce(first.context)
      .mockReturnValueOnce(second.context);
    const alarm = new SoundAlert({ createContext: factory });
    alarm.start();
    alarm.dispose();
    alarm.start();
    expect(factory).toHaveBeenCalledTimes(2);
    expect(second.oscillator.start).toHaveBeenCalledOnce();
    alarm.dispose();
  });
});
