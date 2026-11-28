/** Audio-only alarm. No audio files and no AudioContext created at module import.
 * Call unlock() from a user gesture to satisfy browser autoplay policies.
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
 */
export const ALERT_PATTERN = {
  frequency: 1200,
  onSeconds: 0.2,
  offSeconds: 0.15,
  volume: 0.12,
} as const;
export interface SoundAlertOptions {
  continuous?: boolean;
  /** Dependency injection for tests/embedded hosts; not needed by the application. */
  createContext?: () => AudioContext | null;
}
const browserContext = (): AudioContext | null => {
  const host = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  const Constructor = host.AudioContext ?? host.webkitAudioContext;
  return Constructor ? new Constructor() : null;
};

export class SoundAlert {
  private clicks = new Set<OscillatorNode>();
  private context: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private wanted = false;
  private generation = 0;
  private nextPulse = 0;
  private readonly continuous: boolean;
  private readonly createContext: () => AudioContext | null;

  constructor(options: SoundAlertOptions = {}) {
    this.continuous = options.continuous ?? false;
    this.createContext = options.createContext ?? browserContext;
  }
  get isPlaying() {
    return this.oscillator !== null;
  }
  get isRequested() {
    return this.wanted;
  }

  private getContext() {
    if (!this.context || this.context.state === 'closed') {
      try {
        this.context = this.createContext();
      } catch {
        this.context = null;
      }
    }
    return this.context;
  }

  /** Never throws on missing AudioContext, denied autoplay or a closed device. */
  async unlock(): Promise<boolean> {
    const context = this.getContext();
    if (!context) return false;
    const generation = this.generation;
    try {
      // resume() must be invoked synchronously inside the gesture handler,
      // before awaiting it. stop() invalidates pending resume continuations.
      if (context.state !== 'running') await context.resume();
      if (this.context !== context || context.state !== 'running') return false;
      if (generation === this.generation && this.wanted) this.beginTone();
      return true;
    } catch {
      return false;
    }
  }

  click() {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator(),
      gain = context.createGain(),
      now = context.currentTime;
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(1800, now);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    oscillator.connect(gain);
    gain.connect(context.destination);
    this.clicks.add(oscillator);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.clicks.delete(oscillator);
    };
    oscillator.start(now);
    oscillator.stop(now + 0.03);
  }
  start() {
    if (this.wanted) return;
    this.wanted = true;
    this.generation++;
    void this.unlock();
  }
  setActive(active: boolean) {
    if (active) this.start();
    else this.stop();
  }

  private beginTone() {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.wanted || this.oscillator) return;
    let oscillator: OscillatorNode | null = null,
      gain: GainNode | null = null;
    try {
      oscillator = context.createOscillator();
      gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(ALERT_PATTERN.frequency, context.currentTime);
      gain.gain.setValueAtTime(this.continuous ? ALERT_PATTERN.volume : 0, context.currentTime);
      oscillator.connect(gain);
      gain.connect(context.destination);
      this.oscillator = oscillator;
      this.gain = gain;
      if (!this.continuous) {
        this.nextPulse = context.currentTime;
        this.schedule();
      }
      oscillator.start();
      if (!this.continuous) {
        // Audio-clock scheduling also tolerates background-tab timer throttling.
        this.interval = setInterval(() => this.schedule(), 100);
      }
    } catch {
      oscillator?.disconnect();
      gain?.disconnect();
      this.oscillator = null;
      this.gain = null;
    }
  }
  private schedule() {
    const context = this.context,
      gain = this.gain;
    if (!context || !gain || !this.wanted) return;
    const now = context.currentTime;
    if (this.nextPulse < now) this.nextPulse = now;
    while (this.nextPulse < now + 2) {
      gain.gain.setValueAtTime(ALERT_PATTERN.volume, this.nextPulse);
      gain.gain.setValueAtTime(0, this.nextPulse + ALERT_PATTERN.onSeconds);
      this.nextPulse += ALERT_PATTERN.onSeconds + ALERT_PATTERN.offSeconds;
    }
  }

  /** Synchronously cancels every scheduled pulse and disconnects the tone. */
  stop() {
    this.wanted = false;
    this.generation++;
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
    const gain = this.gain,
      oscillator = this.oscillator;
    this.gain = null;
    this.oscillator = null;
    if (gain) {
      try {
        const now = this.context?.currentTime ?? 0;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
      } catch {
        /* Disconnect below guarantees silence even on a closed context. */
      }
      gain.disconnect();
    }
    if (oscillator) {
      try {
        oscillator.stop();
      } catch {
        /* Already stopped/closed. */
      }
      oscillator.disconnect();
    }
  }
  /** Idempotent; the same instance can be used again after React StrictMode cleanup. */
  dispose() {
    this.stop();
    for (const click of this.clicks) {
      try {
        click.stop();
      } catch {}
      click.disconnect();
    }
    this.clicks.clear();
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}
