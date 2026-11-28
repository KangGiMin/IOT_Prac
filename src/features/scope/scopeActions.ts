import { useCircuitStore } from '../../store/usePhotoCircuitStore';
import { downloadText } from '../learning/download';
import { useLearningCenter } from '../learning/useLearningCenter';
import { defaultScopeSettings, engineering, getScopeChannel, getScopeSettings } from './model';
import type { ScopeChannelId, ScopeChannelSettings, ScopeSettings } from './model';
import { scopeAutoSetup } from './ScopeDisplay';
import { useScopeRuntime } from './runtime';
import type { ScopeCapture } from './scopeMath';

export type ScopeMenu =
  | 'ch1'
  | 'ch2'
  | 'math'
  | 'cursor'
  | 'display'
  | 'acquire'
  | 'measure'
  | 'storage'
  | 'utility'
  | 'trigger'
  | 'ref'
  | 'horizontal';
export type ScopePhotoAction =
  ScopeMenu | 'auto' | 'single' | 'force' | 'midpoint' | 'off' | 'power';
export const scopeMeasurements = [
  { id: 'vpp', label: '피크 대 피크', unit: 'V' },
  { id: 'rms', label: '실효값', unit: 'V' },
  { id: 'frequency', label: '주파수', unit: 'Hz' },
  { id: 'period', label: '주기', unit: 's' },
  { id: 'mean', label: '평균', unit: 'V' },
] as const;
export type ScopeMetric = (typeof scopeMeasurements)[number]['id'];

export const scopeMenuNames: Record<ScopeMenu, string> = {
  ch1: 'CH1 채널 설정',
  ch2: 'CH2 채널 설정',
  math: 'MATH 연산',
  cursor: 'CURSOR 커서',
  display: 'DISPLAY 표시',
  acquire: 'ACQUIRE 취득',
  measure: 'MEASURE 측정',
  storage: 'STORAGE 저장',
  utility: 'UTILITY 계측 설정',
  trigger: 'TRIGGER 설정',
  ref: 'REF 기준 파형',
  horizontal: '수평 시간축',
};

const scope = (id: string) =>
  useCircuitStore
    .getState()
    .workspaces.digital.components.find((c) => c.id === id && c.assetId === 'oscilloscope');

function changeScope(id: string, change: (s: ScopeSettings) => ScopeSettings, running?: boolean) {
  const c = scope(id);
  if (!c || c.settings.scopePowered === false) return;
  useCircuitStore.getState().updateScope(id, change(getScopeSettings(c.settings.scope)), running);
}

const nextChoice = <T>(options: readonly T[], current: T) =>
  options[(options.indexOf(current) + 1) % options.length];

export function performScopeAction(id: string, action: ScopePhotoAction) {
  const store = useCircuitStore.getState(),
    c = scope(id);
  if (!c || store.calibration || store.mode !== 'digital') return;
  const learning = useLearningCenter.getState();
  if (action === 'power') {
    const turningOn = c.settings.scopePowered === false;
    store.updateSettings(id, { scopePowered: turningOn });
    if (!turningOn && learning.photoMenu?.id === id) learning.closePhotoMenu();
    return;
  }
  if (c.settings.scopePowered === false) return;
  const runtime = useScopeRuntime.getState();
  const capture = runtime.records[id]?.capture;
  if (action === 'auto') return changeScope(id, (s) => scopeAutoSetup(s, capture), true);
  if (action === 'single') {
    changeScope(id, (s) => ({ ...s, trigger: { ...s.trigger, mode: 'single' } }), true);
    runtime.command(id, 'single');
    return;
  }
  if (action === 'force') return runtime.command(id, 'force');
  if (action === 'midpoint')
    return changeScope(id, (s) => {
      const values = capture?.[s.trigger.source].filter((v): v is number => v != null) ?? [];
      const level = values.length
        ? (Math.min(...values) + Math.max(...values)) / 2
        : s.channels[s.trigger.source].generator.offset;
      return { ...s, trigger: { ...s.trigger, level: Math.max(-50, Math.min(50, level)) } };
    });
  if (action === 'ch1' || action === 'ch2') {
    learning.setChannel(id, action);
    changeScope(id, (s) => ({
      ...s,
      channels: { ...s.channels, [action]: { ...s.channels[action], enabled: true } },
    }));
  }
  if (action === 'off') {
    const menu = learning.photoMenu?.id === id ? learning.photoMenu.menu : undefined;
    changeScope(id, (s) => {
      if (menu === 'math') return { ...s, math: 'off' };
      if (menu === 'ref') return { ...s, reference: false };
      const channel = getScopeChannel(learning.scopeChannels, id);
      return {
        ...s,
        channels: { ...s.channels, [channel]: { ...s.channels[channel], enabled: false } },
      };
    });
    if (learning.photoMenu?.id === id) learning.closePhotoMenu();
    return;
  }
  if (action === 'math')
    changeScope(id, (s) => ({ ...s, math: nextChoice(['off', 'add', 'subtract'], s.math) }));
  if (action === 'cursor')
    changeScope(id, (s) => ({ ...s, cursors: { ...s.cursors, enabled: !s.cursors.enabled } }));
  if (action === 'display')
    changeScope(id, (s) => ({ ...s, display: nextChoice(['yt', 'xy', 'fft'], s.display) }));
  if (action === 'acquire')
    changeScope(id, (s) => ({
      ...s,
      acquire: nextChoice(['sample', 'average', 'peak'], s.acquire),
    }));
  if (action === 'ref' && capture) {
    runtime.reference(id, capture, getScopeChannel(learning.scopeChannels, id));
    changeScope(id, (s) => ({ ...s, reference: true }));
  }
  learning.showPhotoMenu(id, action);
}

export function saveScopeCapture(capture: ScopeCapture) {
  const values = capture.ch1.map((v, i) => `${i * capture.dt},${v ?? ''},${capture.ch2[i] ?? ''}`);
  downloadText(
    'scope-capture.csv',
    ['time_s,CH1_V,CH2_V', ...values].join('\n'),
    'text/csv;charset=utf-8',
  );
}

export function saveScopeImage(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = 'scope-screen.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function scopeMenuKeys(
  id: string,
  menu: ScopeMenu,
  s: ScopeSettings,
  selected: ScopeChannelId,
) {
  const patch = (values: Partial<ScopeSettings>) =>
    changeScope(id, (current) => ({ ...current, ...values }));
  const updateChannel = (channel: ScopeChannelId, values: Partial<ScopeChannelSettings>) =>
    changeScope(id, (current) => ({
      ...current,
      channels: { ...current.channels, [channel]: { ...current.channels[channel], ...values } },
    }));
  const trigger = (values: Partial<ScopeSettings['trigger']>) =>
    changeScope(id, (current) => ({ ...current, trigger: { ...current.trigger, ...values } }));
  const key = (label: string, run: () => void, disabled = false) => ({ label, run, disabled });
  const capture = () => useScopeRuntime.getState().records[id]?.capture;
  const saveRef = () => {
    const value = capture();
    if (!value) return;
    useScopeRuntime.getState().reference(id, value, selected);
    patch({ reference: true });
  };
  const clear = () => useScopeRuntime.getState().command(id, 'clear');
  const displays = () =>
    (['yt', 'xy', 'fft'] as const).map((display) =>
      key(display === 'yt' ? 'Y–T' : display.toUpperCase(), () => patch({ display })),
    );
  switch (menu) {
    case 'ch1':
    case 'ch2': {
      const channel = s.channels[menu];
      return [
        key(`결합 ${channel.coupling}`, () =>
          updateChannel(menu, { coupling: nextChoice(['DC', 'AC', 'GND'], channel.coupling) }),
        ),
        key(`메뉴 프로브 ${channel.probe}×`, () =>
          updateChannel(menu, { probe: channel.probe === 1 ? 10 : 1 }),
        ),
        key(`반전 ${channel.invert ? 'ON' : 'OFF'}`, () =>
          updateChannel(menu, { invert: !channel.invert }),
        ),
        key(`입력 ${channel.source === 'probe' ? '프로브' : '발생기'}`, () =>
          updateChannel(menu, { source: channel.source === 'probe' ? 'generator' : 'probe' }),
        ),
        key(`채널 표시 ${channel.enabled ? 'ON' : 'OFF'}`, () =>
          updateChannel(menu, { enabled: !channel.enabled }),
        ),
      ];
    }
    case 'measure':
      return scopeMeasurements.map(({ id, label }) =>
        key(label, () => useLearningCenter.getState().setPhotoMetric(id)),
      );
    case 'cursor':
      return [
        key(`커서 ${s.cursors.enabled ? 'ON' : 'OFF'}`, () =>
          patch({ cursors: { ...s.cursors, enabled: !s.cursors.enabled } }),
        ),
        ...(['ch1', 'ch2'] as const).map((channel) =>
          key(channel.toUpperCase(), () => patch({ cursors: { ...s.cursors, channel } })),
        ),
        key('커서 위치 초기화', () =>
          patch({
            cursors: {
              ...defaultScopeSettings().cursors,
              enabled: true,
              channel: s.cursors.channel,
            },
          }),
        ),
      ];
    case 'display':
      return [...displays(), key('기준 파형 표시 전환', () => patch({ reference: !s.reference }))];
    case 'acquire':
      return [
        ...(['sample', 'average', 'peak'] as const).map((acquire) =>
          key(acquire.toUpperCase(), () => patch({ acquire })),
        ),
        key(`평균 ${s.averageCount}회`, () =>
          patch({ averageCount: s.averageCount === 4 ? 16 : 4 }),
        ),
        key('SINGLE 단발 취득', () => performScopeAction(id, 'single')),
      ];
    case 'trigger':
      return [
        ...(['auto', 'normal', 'single'] as const).map((mode) =>
          key(mode.toUpperCase(), () =>
            mode === 'single' ? performScopeAction(id, 'single') : trigger({ mode }),
          ),
        ),
        key(`소스 ${s.trigger.source.toUpperCase()}`, () =>
          trigger({ source: s.trigger.source === 'ch1' ? 'ch2' : 'ch1' }),
        ),
        key(`에지 ${s.trigger.slope === 'rising' ? '상승' : '하강'}`, () =>
          trigger({ slope: s.trigger.slope === 'rising' ? 'falling' : 'rising' }),
        ),
      ];
    case 'horizontal':
      return [
        ...displays(),
        key('수평 위치 초기화', () => patch({ delayDiv: 0 })),
        key('시간축 1 ms/div', () => patch({ timeDiv: 0.001 })),
      ];
    case 'math':
      return [
        key('CH1 + CH2', () => patch({ math: 'add' })),
        key('CH1 − CH2', () => patch({ math: 'subtract' })),
        key('MATH OFF', () => patch({ math: 'off' })),
      ];
    case 'ref':
      return [
        key('현재 파형 기준 저장', saveRef, !capture()),
        key(`기준 파형 ${s.reference ? 'ON' : 'OFF'}`, () => patch({ reference: !s.reference })),
        key('기준 파형 지우기', () => {
          useScopeRuntime.getState().reference(id, null, selected);
          patch({ reference: false });
        }),
      ];
    case 'storage':
      return [
        key(
          '측정 CSV 저장',
          () => {
            const value = capture();
            if (value) saveScopeCapture(value);
          },
          !capture(),
        ),
        key(
          '파형 PNG 저장',
          () =>
            saveScopeImage(
              document.querySelector(
                `.scope-overlay canvas[data-scope-display="${CSS.escape(id)}"]`,
              ),
            ),
          !capture(),
        ),
        key('기준 파형 저장', saveRef, !capture()),
      ];
    case 'utility':
      return [
        key('화면 지우기', clear),
        key('계측 설정 초기화', () => {
          changeScope(id, defaultScopeSettings, true);
          clear();
        }),
        key('확장 계측 열기', () => useLearningCenter.getState().openScope(id)),
      ];
  }
}

export function scopeDialText(
  field: 'timeDiv' | 'voltsDiv' | 'offset' | 'triggerLevel' | 'delayDiv',
  value: number,
) {
  if (field === 'delayDiv') return `${value.toFixed(1)} div`;
  return `${engineering(value, field === 'timeDiv' ? 's' : 'V')}${field === 'timeDiv' || field === 'voltsDiv' ? '/div' : ''}`;
}
