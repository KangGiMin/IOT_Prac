import { memo, useId, useState } from 'react';
import type { Ref } from 'react';
import { signalAt } from './workbenchTiming';
import type { TimingSignal, WorkbenchTiming } from './workbenchTiming';
import './workbenchTiming.css';

const labelWidth = 158;
const plotWidth = 612;
const rowHeight = 42;
const axisHeight = 30;
const width = labelWidth + plotWidth + 22;
const seconds = (time: number) => Number(time.toFixed(2)).toString();

function StepWave({
  signal, high, low, x, duration,
}: {
  signal: TimingSignal;
  high: number;
  low: number;
  x: (time: number) => number;
  duration: number;
}) {
  let path = '';
  for (const { time, value } of signal.events) {
    const y = value ? high : low;
    path += path ? ` H ${x(time)} V ${y}` : `M ${x(time)} ${y}`;
  }
  return <path className="workbench-timing-wave" d={`${path} H ${x(duration)}`} />;
}

export const WorkbenchTimingChart = memo(function WorkbenchTimingChart({
  timing,
  sectionRef,
}: {
  timing: WorkbenchTiming;
  sectionRef: Ref<HTMLElement>;
}) {
  const { signals, operations, duration } = timing;
  const titleId = useId();
  const [cursor, setCursor] = useState(0);
  const x = (time: number) => labelWidth + time / duration * plotWidth;
  const chartHeight = axisHeight + rowHeight * signals.length + 12;
  const ticks = Array.from({ length: Math.floor(duration) + 1 }, (_, index) => index);
  const hasPulses = signals.some((signal) => signal.pulses.length > 0);
  return (
    <section className="workbench-timing" ref={sectionRef} tabIndex={-1} aria-labelledby={titleId}>
      <h3 id={titleId}>회로 타임 차트</h3>
      <p>아래 순서대로 버튼을 각각 0.4초간 눌렀을 때의 결과입니다. 높은 선은 동작 상태를 나타냅니다.{hasPulses && ' 점은 같은 시점에 원래 상태로 돌아오는 타이머의 순간 전환입니다.'}</p>
      <ul className="workbench-timing-operations" aria-label="예시 조작 순서">
        {operations.map((operation) => (
          'power' in operation || operation.pressed
            ? <li key={operation.time}>
                <b>{seconds(operation.time)}초</b>{' '}
                {'power' in operation ? `전원 ${operation.power ? 'ON' : 'OFF'}` : `${operation.button} 누름`}
              </li>
            : null
        ))}
      </ul>
      <div className="workbench-timing-scroll" role="region" aria-label="회로 파형 그래프" tabIndex={0}>
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          className="workbench-timing-chart"
          role="img"
          aria-label="시간에 따른 버튼 입력과 회로 출력 파형"
        >
          {ticks.map((time) => (
            <g key={time}>
              <path className="workbench-timing-grid" d={`M ${x(time)} 24 V ${chartHeight - 8}`} />
              <text className="workbench-timing-axis" x={x(time)} y={19} textAnchor="middle">{time}초</text>
            </g>
          ))}
          {signals.map((signal, index) => {
            const top = axisHeight + index * rowHeight;
            return (
              <g key={signal.id} data-timing-signal={signal.id} className={`timing-${signal.kind}`}>
                <text className="workbench-timing-name" x={10} y={top + 24}>{signal.label}</text>
                <path className="workbench-timing-base" d={`M ${labelWidth} ${top + 32} H ${x(duration)}`} />
                {signal.kind === 'motor'
                  ? signal.events.map(({ time, value }, eventIndex) => {
                      const segmentWidth = x(signal.events[eventIndex + 1]?.time ?? duration) - x(time);
                      const label = String(value).replace('정지 / ', '');
                      return (
                        <g key={time}>
                          <rect className="workbench-timing-motor" x={x(time)} y={top + 7} height={25}
                            width={Math.max(0, segmentWidth - 1)} rx={3} />
                          <title>{seconds(time)}초부터 {String(value)}</title>
                          {segmentWidth > 37 && (
                            <text className="workbench-timing-motor-label" x={x(time) + segmentWidth / 2}
                              y={top + 24} textAnchor="middle">{label}</text>
                          )}
                        </g>
                      );
                    })
                  : <StepWave signal={signal} high={top + 9} low={top + 32} x={x} duration={duration} />}
                {signal.pulses.map(({ time, on }) => (
                  <g key={time} className="workbench-timing-pulse">
                    <path d={`M ${x(time)} ${top + 9} V ${top + 32}`} />
                    <circle cx={x(time)} cy={top + (on ? 9 : 32)} r={3.5}>
                      <title>{seconds(time)}초 · 순간 {on ? 'ON' : 'OFF'}</title>
                    </circle>
                  </g>
                ))}
              </g>
            );
          })}
          <path className="workbench-timing-cursor" d={`M ${x(cursor)} 25 V ${chartHeight - 8}`} />
        </svg>
      </div>
      <label className="workbench-timing-position">
        <span>확인 시점 <b>{seconds(cursor)}초</b></span>
        <input type="range" min={0} max={duration} step={0.01} value={cursor}
          aria-label="타임 차트 확인 시점" aria-valuetext={`${seconds(cursor)}초`}
          onChange={(event) => setCursor(event.target.valueAsNumber)} />
      </label>
      <dl className="workbench-timing-values" aria-label="선택 시점의 회로 상태">
        {signals.map((signal) => (
          <div key={signal.id} data-timing-value={signal.id}>
            <dt>{signal.label}</dt><dd>{signalAt(signal, cursor)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
});
