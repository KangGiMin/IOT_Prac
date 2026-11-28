import { useMemo } from 'react';
import { useCircuitStore } from '../../store/usePhotoCircuitStore';
import { useLearningCenter } from '../learning/useLearningCenter';
import {
  defaultScopeSettings,
  engineering,
  getScopeChannel,
  getScopeSettings,
  TIME_DIVS,
  VOLT_DIVS,
} from './model';
import type { ScopeChannelId, ScopeChannelSettings, ScopeSettings, WaveShape } from './model';
import { ScopeDisplay, scopeAutoSetup } from './ScopeDisplay';
import { measureScope } from './scopeMath';
import { useScopeRuntime } from './runtime';
import { saveScopeCapture, saveScopeImage } from './scopeActions';

const shapes: Record<WaveShape, string> = {
  sine: '정현파',
  square: '구형파',
  triangle: '삼각파',
  ramp: '톱니파',
  dc: '직류 DC',
};
function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="lesson-field">
      <span>{label}</span>
      <input
        type="number"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
      />
    </label>
  );
}
export function ScopeConsole() {
  const components = useCircuitStore((s) => s.workspaces.digital.components);
  const calibration = useCircuitStore((s) => s.calibration);
  const preferred = useLearningCenter((s) => s.scopeId);
  const scopes = components.filter((c) => c.assetId === 'oscilloscope');
  const c = scopes.find((c) => c.id === preferred) ?? scopes[0],
    id = c?.id ?? '';
  const settings = useMemo(() => getScopeSettings(c?.settings.scope), [c?.settings.scope]);
  const record = useScopeRuntime((s) => s.records[id]);
  const reference = useScopeRuntime((s) => s.references[id]);
  const selectedChannel = useLearningCenter((s) => getScopeChannel(s.scopeChannels, id));
  const capture = record?.capture;
  const measurements = useMemo(
    () =>
      capture
        ? { ch1: measureScope(capture.ch1, capture.dt), ch2: measureScope(capture.ch2, capture.dt) }
        : null,
    [capture],
  );
  const update = (next: ScopeSettings, running?: boolean) =>
    useCircuitStore.getState().updateScope(id, next, running);
  const patch = (next: Partial<ScopeSettings>) => update({ ...settings, ...next });
  const channel = (key: ScopeChannelId, next: Partial<ScopeChannelSettings>) =>
    patch({ channels: { ...settings.channels, [key]: { ...settings.channels[key], ...next } } });
  const demo = (shape: WaveShape, xy = false) => {
    const s = defaultScopeSettings();
    s.timeDiv = 0.0002;
    s.trigger.level = 0;
    s.display = xy ? 'xy' : 'yt';
    s.channels.ch1 = {
      ...s.channels.ch1,
      source: 'generator',
      voltsDiv: 1,
      offset: 0,
      generator: { ...s.channels.ch1.generator, shape, frequency: 1000, vpp: 4 },
    };
    s.channels.ch2 = {
      ...s.channels.ch2,
      enabled: xy,
      source: 'generator',
      voltsDiv: 1,
      offset: 0,
      generator: { ...s.channels.ch2.generator, shape: 'sine', frequency: 1000, vpp: 4, phase: 90 },
    };
    update(s, true);
    useScopeRuntime.getState().command(id, 'clear');
  };
  if (!c)
    return (
      <div className="lesson-card">
        <h3>오실로스코프를 먼저 배치하세요</h3>
        <p>
          디지털 회로 모드의 부품 라이브러리에서 오실로스코프를 추가하면 측정과 신호발생기를 사용할
          수 있습니다.
        </p>
        <button onClick={() => useCircuitStore.getState().setMode('digital')}>
          디지털 회로 열기
        </button>
      </div>
    );
  const running = c.settings.scopeRunning !== false;
  const deltaT = Math.abs(settings.cursors.x2 - settings.cursors.x1) * settings.timeDiv * 10;
  return (
    <div className="scope-console">
      <div className="lesson-intro">
        <div>
          <h3>확장 오실로스코프 · 아날로그 신호발생기</h3>
          <p>
            사진의 LCD와 아래 확대 화면은 같은 측정 기록을 표시합니다. 회로 프로브와 내장
            신호발생기를 채널별로 선택하세요.
          </p>
        </div>
        <label className="lesson-field">
          <span>측정 장비</span>
          <select
            aria-label="학습 오실로스코프 선택"
            value={id}
            onChange={(e) => useLearningCenter.setState({ scopeId: e.target.value })}
          >
            {scopes.map((scope) => (
              <option key={scope.id} value={scope.id}>
                {scope.label} · {scope.id}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset
        disabled={calibration || c.settings.scopePowered === false}
        className="scope-control-fieldset"
      >
        <div className="lesson-actions">
          <span>사진 다이얼 대상</span>
          {(['ch1', 'ch2'] as const).map((ch) => (
            <button
              key={ch}
              aria-pressed={selectedChannel === ch}
              onClick={() => useLearningCenter.getState().setChannel(id, ch)}
            >
              {ch.toUpperCase()} 선택
            </button>
          ))}
          <button
            className="lesson-primary"
            aria-pressed={running}
            onClick={() => update(settings, !running)}
          >
            측정 {running ? 'STOP' : 'RUN'}
          </button>
          <button onClick={() => update(scopeAutoSetup(settings, capture), true)}>
            AUTO 자동 설정
          </button>
          <button
            onClick={() => {
              update({ ...settings, trigger: { ...settings.trigger, mode: 'single' } }, true);
              useScopeRuntime.getState().command(id, 'single');
            }}
          >
            SINGLE 단발 측정
          </button>
          <button onClick={() => useScopeRuntime.getState().command(id, 'force')}>
            FORCE 강제 트리거
          </button>
          <button onClick={() => useScopeRuntime.getState().command(id, 'clear')}>
            화면 지우기
          </button>
          <button
            onClick={() => {
              update(defaultScopeSettings(), true);
              useScopeRuntime.getState().command(id, 'clear');
            }}
          >
            계측 설정 초기화
          </button>
        </div>
        <div className="lesson-actions scope-demos">
          <span>바로 측정</span>
          <button onClick={() => demo('sine')}>정현파 예제</button>
          <button onClick={() => demo('square')}>구형파 예제</button>
          <button onClick={() => demo('triangle')}>삼각파 예제</button>
          <button onClick={() => demo('sine', true)}>90° 위상차 · XY 예제</button>
        </div>
        <div className="scope-expanded">
          <ScopeDisplay id={id} expanded />
          <p
            className="scope-live-status"
            role="status"
            data-capture-time={capture?.sampledAt ?? ''}
          >
            {record?.status ?? 'READY'} ·{' '}
            {capture
              ? `${capture.ch1.length}점 · ${engineering(1 / capture.dt, 'Sa/s')}`
              : '아직 취득한 기록이 없습니다.'}
          </p>
        </div>
        <div className="lesson-notice">
          내장 발생기는 계측 학습용 입력입니다. 브레드보드에 전압을 공급하지 않습니다. 회로 측정은
          CH1/CH2와 GND REF를 실제 배선해야 하며 미연결 신호는 빈 구간으로 표시됩니다.
        </div>
        {capture?.warnings.map((w) => (
          <p key={w} className="lesson-warning">
            {w}
          </p>
        ))}
        <div className="lesson-grid scope-channel-grid">
          {(['ch1', 'ch2'] as const).map((key) => {
            const s = settings.channels[key],
              prefix = key.toUpperCase();
            const gen = (next: Partial<ScopeChannelSettings['generator']>) =>
              channel(key, { generator: { ...s.generator, ...next } });
            return (
              <section className={`lesson-card scope-channel ${key}`} key={key}>
                <h4>
                  {prefix} · {key === 'ch1' ? '노란색' : '파란색'}
                </h4>
                <label className="lesson-check">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => channel(key, { enabled: e.target.checked })}
                  />
                  {prefix} 표시
                </label>
                <label className="lesson-field">
                  <span>입력 소스</span>
                  <select
                    aria-label={`${prefix} 입력 소스`}
                    value={s.source}
                    onChange={(e) => channel(key, { source: e.target.value as typeof s.source })}
                  >
                    <option value="probe">회로 프로브</option>
                    <option value="generator">내장 신호발생기</option>
                  </select>
                </label>
                <div className="lesson-fields">
                  <label className="lesson-field">
                    <span>전압축 VOLTS/DIV</span>
                    <select
                      aria-label={`${prefix} VOLTS/DIV`}
                      value={s.voltsDiv}
                      onChange={(e) => channel(key, { voltsDiv: Number(e.target.value) })}
                    >
                      {VOLT_DIVS.map((v) => (
                        <option key={v} value={v}>
                          {engineering(v, 'V')}/div
                        </option>
                      ))}
                    </select>
                  </label>
                  <NumberField
                    label={`${prefix} 수직 위치 (V)`}
                    value={s.offset}
                    min={-50}
                    max={50}
                    step={0.1}
                    onChange={(v) => channel(key, { offset: v })}
                  />
                  <label className="lesson-field">
                    <span>입력 결합</span>
                    <select
                      aria-label={`${prefix} 결합`}
                      value={s.coupling}
                      onChange={(e) =>
                        channel(key, { coupling: e.target.value as typeof s.coupling })
                      }
                    >
                      <option>DC</option>
                      <option>AC</option>
                      <option>GND</option>
                    </select>
                  </label>
                  <label className="lesson-field">
                    <span>실제 프로브 배율</span>
                    <select
                      aria-label={`${prefix} 실제 프로브 배율`}
                      value={s.actualProbe}
                      onChange={(e) =>
                        channel(key, { actualProbe: Number(e.target.value) as 1 | 10 })
                      }
                    >
                      <option value={1}>1×</option>
                      <option value={10}>10×</option>
                    </select>
                  </label>
                  <label className="lesson-field">
                    <span>장비 메뉴 배율</span>
                    <select
                      aria-label={`${prefix} 메뉴 배율`}
                      value={s.probe}
                      onChange={(e) => channel(key, { probe: Number(e.target.value) as 1 | 10 })}
                    >
                      <option value={1}>1×</option>
                      <option value={10}>10×</option>
                    </select>
                  </label>
                </div>
                <label className="lesson-check">
                  <input
                    type="checkbox"
                    checked={s.invert}
                    onChange={(e) => channel(key, { invert: e.target.checked })}
                  />
                  {prefix} 반전 INVERT
                </label>
                {s.source === 'generator' && (
                  <div className="generator-controls">
                    <h5>{prefix} 신호발생기</h5>
                    <label className="lesson-check">
                      <input
                        type="checkbox"
                        checked={s.generator.enabled}
                        onChange={(e) => gen({ enabled: e.target.checked })}
                      />
                      {prefix} 발생기 OUTPUT
                    </label>
                    <label className="lesson-field">
                      <span>파형 종류</span>
                      <select
                        aria-label={`${prefix} 발생 파형`}
                        value={s.generator.shape}
                        onChange={(e) => gen({ shape: e.target.value as WaveShape })}
                      >
                        {Object.entries(shapes).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="lesson-fields">
                      <NumberField
                        label={`${prefix} 주파수 (Hz)`}
                        value={s.generator.frequency}
                        min={0.1}
                        max={10000}
                        step={0.1}
                        onChange={(v) => gen({ frequency: v })}
                      />
                      <NumberField
                        label={`${prefix} 진폭 Vpp (V)`}
                        value={s.generator.vpp}
                        min={0}
                        max={20}
                        step={0.1}
                        onChange={(v) => gen({ vpp: v })}
                      />
                      <NumberField
                        label={`${prefix} DC 오프셋 (V)`}
                        value={s.generator.offset}
                        min={-10}
                        max={10}
                        step={0.1}
                        onChange={(v) => gen({ offset: v })}
                      />
                      <NumberField
                        label={`${prefix} 위상 (°)`}
                        value={s.generator.phase}
                        min={0}
                        max={360}
                        step={1}
                        onChange={(v) => gen({ phase: v })}
                      />
                      {s.generator.shape === 'square' && (
                        <NumberField
                          label={`${prefix} 듀티 (%)`}
                          value={s.generator.duty}
                          min={1}
                          max={99}
                          step={1}
                          onChange={(v) => gen({ duty: v })}
                        />
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <div className="lesson-grid">
          <section className="lesson-card">
            <h4>시간축 · 취득 · 표시</h4>
            <div className="lesson-fields">
              <label className="lesson-field">
                <span>TIME/DIV</span>
                <select
                  aria-label="TIME/DIV"
                  value={settings.timeDiv}
                  onChange={(e) => patch({ timeDiv: Number(e.target.value) })}
                >
                  {TIME_DIVS.map((v) => (
                    <option key={v} value={v}>
                      {engineering(v, 's')}/div
                    </option>
                  ))}
                </select>
              </label>
              <NumberField
                label="수평 트리거 위치 (div)"
                value={settings.delayDiv}
                min={-2}
                max={5}
                step={0.1}
                onChange={(v) => patch({ delayDiv: v })}
              />
              <label className="lesson-field">
                <span>취득 모드</span>
                <select
                  aria-label="취득 모드"
                  value={settings.acquire}
                  onChange={(e) => patch({ acquire: e.target.value as ScopeSettings['acquire'] })}
                >
                  <option value="sample">일반 SAMPLE</option>
                  <option value="average">평균 AVERAGE</option>
                  <option value="peak">피크 표시 PEAK</option>
                </select>
              </label>
              {settings.acquire === 'average' && (
                <label className="lesson-field">
                  <span>평균 횟수</span>
                  <select
                    value={settings.averageCount}
                    onChange={(e) => patch({ averageCount: Number(e.target.value) as 4 | 16 })}
                  >
                    <option value={4}>4</option>
                    <option value={16}>16</option>
                  </select>
                </label>
              )}
              <label className="lesson-field">
                <span>표시 형식</span>
                <select
                  aria-label="파형 표시 형식"
                  value={settings.display}
                  onChange={(e) => patch({ display: e.target.value as ScopeSettings['display'] })}
                >
                  <option value="yt">시간 파형 Y–T</option>
                  <option value="xy">CH1 대 CH2 · XY</option>
                  <option value="fft">CH1 주파수 스펙트럼 FFT</option>
                </select>
              </label>
              <label className="lesson-field">
                <span>MATH</span>
                <select
                  aria-label="MATH 연산"
                  value={settings.math}
                  onChange={(e) => patch({ math: e.target.value as ScopeSettings['math'] })}
                >
                  <option value="off">OFF</option>
                  <option value="add">CH1 + CH2</option>
                  <option value="subtract">CH1 − CH2</option>
                </select>
              </label>
            </div>
            <p className="lesson-small">
              Y–T는 가로 10칸·세로 8칸입니다. XY는 CH1이 X축, CH2가 Y축입니다. FFT는 DC 성분을
              제외한 Hann 창 스펙트럼이며 진폭은 V peak입니다. MATH는 Y–T에서 CH1 전압축을
              사용합니다.
            </p>
          </section>
          <section className="lesson-card">
            <h4>에지 트리거</h4>
            <div className="lesson-fields">
              <label className="lesson-field">
                <span>트리거 모드</span>
                <select
                  aria-label="트리거 모드"
                  value={settings.trigger.mode}
                  onChange={(e) =>
                    patch({
                      trigger: {
                        ...settings.trigger,
                        mode: e.target.value as ScopeSettings['trigger']['mode'],
                      },
                    })
                  }
                >
                  <option value="auto">AUTO · 조건 없으면 자유 취득</option>
                  <option value="normal">NORMAL · 조건을 기다림</option>
                  <option value="single">SINGLE · 한 번 취득 후 정지</option>
                </select>
              </label>
              <label className="lesson-field">
                <span>소스</span>
                <select
                  aria-label="트리거 소스"
                  value={settings.trigger.source}
                  onChange={(e) =>
                    patch({
                      trigger: { ...settings.trigger, source: e.target.value as ScopeChannelId },
                    })
                  }
                >
                  <option value="ch1">CH1</option>
                  <option value="ch2">CH2</option>
                </select>
              </label>
              <label className="lesson-field">
                <span>기울기</span>
                <select
                  aria-label="트리거 기울기"
                  value={settings.trigger.slope}
                  onChange={(e) =>
                    patch({
                      trigger: {
                        ...settings.trigger,
                        slope: e.target.value as 'rising' | 'falling',
                      },
                    })
                  }
                >
                  <option value="rising">상승 ↑</option>
                  <option value="falling">하강 ↓</option>
                </select>
              </label>
              <NumberField
                label="트리거 레벨 (V)"
                value={settings.trigger.level}
                min={-50}
                max={50}
                step={0.1}
                onChange={(v) => patch({ trigger: { ...settings.trigger, level: v } })}
              />
            </div>
            <p className="lesson-small">
              레벨을 신호의 최솟값과 최댓값 사이에 두세요. NORMAL은 조건이 없으면 이전 기록을
              유지하며 WAIT로 표시합니다. SINGLE은 누른 뒤 발생한 에지를 기다리고 이후 구간까지
              취득한 다음 멈춥니다.
            </p>
          </section>
        </div>
        <section className="lesson-card">
          <h4>자동 측정</h4>
          <div className="lesson-table-scroll">
            <table className="lesson-table">
              <thead>
                <tr>
                  <th>항목</th>
                  <th>CH1</th>
                  <th>CH2</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['최솟값', 'min', 'V'],
                    ['최댓값', 'max', 'V'],
                    ['피크 대 피크', 'vpp', 'V'],
                    ['평균 전압', 'mean', 'V'],
                    ['실효값 RMS', 'rms', 'V'],
                    ['주파수', 'frequency', 'Hz'],
                    ['주기', 'period', 's'],
                    ['듀티', 'duty', '%'],
                    ['HIGH 펄스 폭', 'positiveWidth', 's'],
                    ['LOW 펄스 폭', 'negativeWidth', 's'],
                    ['상승 시간 10–90%', 'rise', 's'],
                    ['하강 시간 90–10%', 'fall', 's'],
                  ] as const
                ).map(([label, key, unit]) => (
                  <tr key={key}>
                    <th>{label}</th>
                    {(['ch1', 'ch2'] as const).map((ch) => (
                      <td key={ch} data-testid={`scope-${ch}-${key}`}>
                        {engineering(measurements?.[ch][key], unit)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="lesson-small">
            주파수·주기는 완전한 주기와 연속 신호가 있어야 표시됩니다. 갭·DC 또는 취득 구간 부족이면
            —입니다. 이상적인 구형파의 상승·하강은 실제 장비 사양이 아니라 샘플 간격에 제한되는
            측정값입니다.
          </p>
        </section>
        <section className="lesson-card">
          <h4>시간·전압 커서</h4>
          <label className="lesson-check">
            <input
              type="checkbox"
              checked={settings.cursors.enabled}
              onChange={(e) =>
                patch({ cursors: { ...settings.cursors, enabled: e.target.checked } })
              }
            />
            커서 표시
          </label>
          <div className="lesson-fields">
            <label className="lesson-field">
              <span>전압 커서 채널</span>
              <select
                value={settings.cursors.channel}
                aria-label="전압 커서 채널"
                onChange={(e) =>
                  patch({
                    cursors: { ...settings.cursors, channel: e.target.value as ScopeChannelId },
                  })
                }
              >
                <option value="ch1">CH1</option>
                <option value="ch2">CH2</option>
              </select>
            </label>
            {(['x1', 'x2'] as const).map((key) => (
              <label className="lesson-field" key={key}>
                <span>
                  {key.toUpperCase()} · 화면의 {Math.round(settings.cursors[key] * 100)}%
                </span>
                <input
                  type="range"
                  aria-label={key.toUpperCase()}
                  min={0}
                  max={1}
                  step={0.001}
                  value={settings.cursors[key]}
                  onChange={(e) =>
                    patch({ cursors: { ...settings.cursors, [key]: Number(e.target.value) } })
                  }
                />
              </label>
            ))}
            {(['y1', 'y2'] as const).map((key) => (
              <NumberField
                key={key}
                label={`${key.toUpperCase()} (V)`}
                value={settings.cursors[key]}
                min={-50}
                max={50}
                step={0.1}
                onChange={(v) => patch({ cursors: { ...settings.cursors, [key]: v } })}
              />
            ))}
          </div>
          <p className="lesson-result">
            Δt = {engineering(deltaT, 's')} · 1/Δt = {engineering(deltaT ? 1 / deltaT : null, 'Hz')}{' '}
            · ΔV = {engineering(Math.abs(settings.cursors.y2 - settings.cursors.y1), 'V')}
          </p>
          <p className="lesson-small">
            확대 화면에서 가까운 수직 커서를 드래그하거나 슬라이더·키보드로 이동하세요. 1/Δt를
            주파수로 읽으려면 커서를 연속한 같은 방향 에지에 놓아야 합니다.
          </p>
        </section>
        <section className="lesson-card">
          <h4>REF 기준 파형 비교</h4>
          <p>
            현재 취득한 채널을 기준 파형으로 저장한 뒤 신호를 바꿔 겹쳐 보세요. 앞면 REF 버튼은 기준
            파형 저장 기능이며 GND REF 배선 단자와는 다릅니다.
          </p>
          <div className="lesson-actions">
            <button
              disabled={!capture}
              onClick={() => {
                if (capture) {
                  useScopeRuntime.getState().reference(id, capture, selectedChannel);
                  patch({ reference: true });
                }
              }}
            >
              현재 파형 REF 저장
            </button>
            <button
              onClick={() => {
                useScopeRuntime.getState().reference(id, null, selectedChannel);
                patch({ reference: false });
              }}
            >
              REF 지우기
            </button>
          </div>
          <label className="lesson-check">
            <input
              type="checkbox"
              checked={settings.reference}
              onChange={(e) => patch({ reference: e.target.checked })}
            />
            REF 기준 파형 표시
          </label>
          <p className="lesson-small">
            {reference
              ? `${reference.channel.toUpperCase()} 기준 파형 · ${reference.capture.ch1.length}점`
              : '저장된 기준 파형이 없습니다.'}{' '}
            · 기준 기록은 회색 점선이며 Y–T에서 표시됩니다. 기록은 이 브라우저 세션에서만
            유지됩니다.
          </p>
        </section>
      </fieldset>
      <div className="lesson-actions">
        <button
          disabled={!capture}
          onClick={() => {
            if (capture) saveScopeCapture(capture);
          }}
        >
          측정 CSV 저장
        </button>
        <button
          disabled={!capture}
          onClick={() =>
            saveScopeImage(document.querySelector<HTMLCanvasElement>('.scope-expanded canvas'))
          }
        >
          파형 PNG 저장
        </button>
      </div>
    </div>
  );
}
