import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Background, ConnectionMode, Controls, Handle, Position, ReactFlow } from '@xyflow/react';
import type { Edge, Node, NodeProps } from '@xyflow/react';
import { BellRing, Power, X } from 'lucide-react';
import { componentAssets } from '../../config/assets';
import { SoundAlert } from '../../engine/soundAlert';
import type { AssetId } from '../../types/circuit';
import { AssetImage } from '../workbench/components/AssetImage';
import { MotorRotor } from '../workbench/components/MotorRotor';
import { buildCompletedWorkbench } from './completedCircuit';
import type { WorkbenchDevice } from './completedCircuit';
import { RelayScrewPhoto } from './RelayScrewPhoto';
import { WorkbenchTimingChart } from './WorkbenchTimingChart';
import { buildWorkbenchTiming } from './workbenchTiming';
import type { Exercise } from './model';
import { gradeExercise, motorState, stepCircuit, stopped } from './solver';
import type { RunState } from './solver';
import './completedWorkbench.css';

const deviceNames: Record<WorkbenchDevice['kind'], string> = {
  supply: '실습 전원', button: 'PB 스위치', relay: '릴레이', timer: '타이머',
  lamp: '표시등', buzzer: '부저', motor: '모터',
};
const deviceAssets: Partial<Record<WorkbenchDevice['kind'], AssetId>> = {
  supply: 'panel-board', button: 'pb-switch', relay: 'relay-socket',
  timer: 'timer-at8n', lamp: 'pilot-lamp',
};

type DeviceNode = Node<{
  device: WorkbenchDevice;
  active: boolean;
  status: string;
  highlighted: string[];
}, 'device'>;

function Device({ data: { device, active, status, highlighted } }: NodeProps<DeviceNode>) {
  const asset = deviceAssets[device.kind];
  const name = device.kind === 'supply' ? 'DC 24V' : device.id;
  const [motorPhotoLoaded, setMotorPhotoLoaded] = useState(false);
  return (
    <article className="completed-device" data-device={device.id} data-active={active}>
      <header className="completed-device-heading">
        {device.kind !== 'relay' && <div className="completed-device-photo" aria-hidden="true">
          {device.kind === 'motor' ? (
            <div className="completed-motor-photo">
              <AssetImage
                asset={componentAssets['motor-unit']}
                thumbnail
                onLoad={() => setMotorPhotoLoaded(true)}
                onFallback={() => setMotorPhotoLoaded(false)}
              />
              {active && motorPhotoLoaded && <MotorRotor reverse={status === 'CCW'} />}
            </div>
          ) : asset ? <AssetImage asset={componentAssets[asset]} thumbnail /> : <BellRing size={34} />}
          {device.kind === 'lamp' && active && <span className="completed-lamp-glow" />}
        </div>}
        <div>
          <strong>{name}</strong>
          <span>{deviceNames[device.kind]}{device.timerMode && (device.timerMode === 'off-delay' ? ' · OFF 지연' : ' · ON 지연')}</span>
          <span className="completed-device-state">{status}</span>
        </div>
      </header>
      {device.screwPorts ? <RelayScrewPhoto ports={device.screwPorts} highlighted={highlighted} /> : <div className="completed-device-terminals">
        {device.rows.map((row) => (
          <div className="completed-terminal-row" key={row.id}>
            <span>{row.label}</span>
            <div className="completed-terminal-group">
              {row.terminals.map((terminal) => (
                <span className="completed-terminal" key={terminal.id}>
                  {terminal.label}
                  <Handle
                    id={terminal.id}
                    className={highlighted.includes(terminal.id) ? 'is-highlighted' : undefined}
                    type="source"
                    position={Position.Bottom}
                    isConnectable={false}
                  />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>}
    </article>
  );
}

const nodeTypes = { device: Device };
const nodeWidth = 225;
const canvasColors = ['#288c83', '#806cc5', '#bb7622'];

interface WorkbenchRun {
  power: boolean;
  buttons: Record<string, boolean>;
  state: RunState;
  now: number;
}

type Control = { now: number } & (
  | { type: 'power' | 'tick' | 'release' }
  | { type: 'button'; id: string; pressed: boolean }
);

const powerOff: WorkbenchRun = { power: false, buttons: {}, state: stopped(), now: 0 };

function deviceState(device: WorkbenchDevice, run: WorkbenchRun, exercise: Exercise) {
  const { state } = run;
  const healthy = run.power && !state.short && !state.unstable;
  const output = healthy && !!state.on[device.id];
  switch (device.kind) {
    case 'supply': return { active: run.power, status: run.power ? '전원 ON' : '전원 OFF' };
    case 'button': {
      const active = !!run.buttons[device.id];
      return { active, status: active ? '눌림' : '해제' };
    }
    case 'relay': return { active: output, status: output ? '여자' : '무여자' };
    case 'timer': {
      const elapsed = Math.min(state.elapsed[device.id] ?? 0, device.seconds!);
      const timing = healthy && !!state.timing[device.id];
      const holding = device.timerMode === 'off-delay' && output && !timing;
      return {
        active: output,
        status: holding ? `차단 지연 · ${Math.max(0, device.seconds! - elapsed).toFixed(1)}초 남음`
          : output ? `출력 ON · ${device.seconds}초`
          : timing ? `${elapsed.toFixed(1)} / ${device.seconds}초`
            : `설정 ${device.seconds}초 · 대기`,
      };
    }
    case 'motor': return { active: output, status: run.power ? motorState(exercise, state) : '정지' };
    case 'buzzer': return { active: output, status: output ? '울림' : '정지' };
    case 'lamp': return { active: output, status: output ? '점등' : '소등' };
  }
}

export function CompletedWorkbench({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const timingSection = useRef<HTMLElement>(null);
  const [columnCount, setColumnCount] = useState<number>();
  const board = useMemo(() => buildCompletedWorkbench(exercise), [exercise]);
  const timing = useMemo(() => buildWorkbenchTiming(exercise, board), [exercise, board]);
  const [selected, setSelected] = useState<number | null>(null);
  const [verified, setVerified] = useState<{ passed: number; total: number }>();
  const [sound] = useState(() => new SoundAlert({ continuous: true }));
  const buzzer = board.devices.find((device) => device.kind === 'buzzer');
  const hasTimer = board.devices.some((device) => device.kind === 'timer');
  const [run, dispatch] = useReducer((previous: WorkbenchRun, control: Control): WorkbenchRun => {
    const { now } = control;
    if (control.type === 'power') {
      if (previous.power) return powerOff;
      return { power: true, buttons: {}, now, state: stepCircuit(board.circuit, board.leads, {}, stopped(), 0) };
    }
    if (!previous.power) return previous;
    let buttons = previous.buttons;
    if (control.type === 'button') {
      if (!!buttons[control.id] === control.pressed) return previous;
      buttons = { ...buttons, [control.id]: control.pressed };
    } else if (control.type === 'release') {
      if (!Object.values(buttons).some(Boolean)) return previous;
      buttons = {};
    }
    const dt = Math.max(0, (now - previous.now) / 1000);
    const elapsed = stepCircuit(board.circuit, board.leads, previous.buttons, previous.state, dt);
    const state = buttons === previous.buttons ? elapsed : stepCircuit(board.circuit, board.leads, buttons, elapsed, 0);
    return { power: true, buttons, now, state };
  }, powerOff);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    const release = () => dispatch({ type: 'release', now: performance.now() });
    const onVisibility = () => { if (document.hidden) release(); };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    // Fit the graph only after the dialog has measurable bounds.
    const measure = () => {
      const width = element.clientWidth;
      if (width > 0) setColumnCount(width < 540 ? 2 : width < 820 ? 3 : 4);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!run.power || !hasTimer) return;
    const clock = window.setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 40);
    return () => window.clearInterval(clock);
  }, [run.power, hasTimer]);
  const buzzerOn = !!buzzer && deviceState(buzzer, run, exercise).active;
  useEffect(() => { sound.setActive(buzzerOn); }, [sound, buzzerOn]);
  useEffect(() => () => sound.dispose(), [sound]);

  const positions = useMemo(() => {
    const result: { x: number; y: number }[] = [];
    const columns = columnCount ?? 4;
    let y = 0;
    for (let start = 0; start < board.devices.length; start += columns) {
      const row = board.devices.slice(start, start + columns);
      row.forEach((_, column) => result.push({ x: column * (nodeWidth + 65), y }));
      y += Math.max(...row.map((device) =>
        device.kind === 'relay' ? 98 + nodeWidth * 1402 / 1122 + 48 : 146 + device.rows.length * 43,
      ));
    }
    return result;
  }, [board, columnCount]);
  const highlighted = selected === null ? [] : board.steps[selected].lead;
  const nodes: DeviceNode[] = board.devices.map((device, index) => ({
    id: device.id,
    type: 'device',
    position: positions[index],
    style: { width: nodeWidth },
    data: { device, ...deviceState(device, run, exercise), highlighted },
    zIndex: 1,
  }));
  const edges: Edge[] = useMemo(() => board.steps.map((step, index) => {
    const [from, to] = step.lead;
    const active = selected === index;
    const stroke = active ? '#00a4d6' : from === '24V' ? '#dc4c4c' : from === '0V' ? '#3780d5'
      : canvasColors[index % canvasColors.length];
    return {
      id: String(index),
      source: board.deviceByTerminal.get(from)!,
      sourceHandle: from,
      target: board.deviceByTerminal.get(to)!,
      targetHandle: to,
      ariaLabel: step.title,
      selected: active,
      zIndex: active ? 4 : 2,
      style: { stroke, strokeWidth: active ? 4 : 2.3, opacity: selected === null || active ? 0.9 : 0.22 },
    };
  }), [board, selected]);

  const togglePower = () => {
    if (buzzer) void sound.unlock();
    dispatch({ type: 'power', now: performance.now() });
  };
  const press = (id: string, pressed: boolean) => {
    if (buzzer && pressed) void sound.unlock();
    dispatch({ type: 'button', id, pressed, now: performance.now() });
  };
  const chooseWire = (index: number) => setSelected((current) => current === index ? null : index);

  return (
    <dialog ref={dialog} className="completed-workbench" aria-labelledby="completed-workbench-title" onClose={onClose}>
      <header className="completed-workbench-header">
        <div>
          <h2 id="completed-workbench-title">완성된 작업대</h2>
          <p>{String(exercise.id).padStart(2, '0')} · {exercise.title}{board.corrected && ' · 수정안 적용'}</p>
        </div>
        <button type="button" aria-label="완성된 작업대 닫기" onClick={() => dialog.current?.close()}><X size={20} /></button>
      </header>
      <div className="completed-workbench-content">
        {board.corrected && <p className="completed-workbench-note">원본의 기동·자기유지 오류를 바로잡은 수정안입니다.</p>}
        <div className="completed-workbench-controls" role="group" aria-label="완성 회로 동작 테스트">
          <button type="button" role="switch" aria-label="완성 작업대 전원" aria-checked={run.power} onClick={togglePower}>
            <Power size={16} /> 전원 {run.power ? 'ON' : 'OFF'}
          </button>
          {board.buttons.map(({ id }) => (
            <button
              type="button"
              key={id}
              aria-label={`${id} 누르기`}
              aria-pressed={!!run.buttons[id]}
              disabled={!run.power}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                press(id, true);
              }}
              onPointerUp={() => press(id, false)}
              onPointerCancel={() => press(id, false)}
              onLostPointerCapture={() => press(id, false)}
              onKeyDown={(event) => {
                if (event.key !== ' ' && event.key !== 'Enter') return;
                event.preventDefault();
                if (!event.repeat) press(id, true);
              }}
              onKeyUp={(event) => {
                if (event.key === ' ' || event.key === 'Enter') press(id, false);
              }}
              onBlur={() => press(id, false)}
            >{id}</button>
          ))}
          <button type="button" onClick={() => {
            const result = gradeExercise(exercise, board.leads, board.corrected);
            setVerified({ passed: result.filter((row) => row.pass).length, total: result.length });
          }}>동작 자동 테스트</button>
          <button type="button" onClick={() => {
            timingSection.current?.focus({ preventScroll: true });
            timingSection.current?.scrollIntoView({ block: 'start' });
          }}>타임 차트 보기</button>
        </div>
        <div className="completed-workbench-status" role="status">
          {run.state.short ? '단락 · 출력 정지' : run.state.unstable ? '접점 경합 · 동시 입력을 해제하세요.'
            : run.power ? 'PB를 눌렀다 놓고 부품 상태를 확인하세요.' : '전원을 켜면 PB로 동작을 테스트할 수 있습니다.'}
          {verified && <strong>자동 테스트 {verified.passed}/{verified.total}단계 일치</strong>}
        </div>
        <div className="completed-workbench-layout">
          <div ref={canvas} className="completed-workbench-canvas">
            {columnCount && <ReactFlow<DeviceNode>
              key={columnCount}
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              connectionMode={ConnectionMode.Loose}
              nodesDraggable={false}
              nodesConnectable={false}
              nodesFocusable={false}
              elementsSelectable={false}
              deleteKeyCode={null}
              onEdgeClick={(_, edge) => chooseWire(Number(edge.id))}
              onPaneClick={() => setSelected(null)}
              fitView
              fitViewOptions={{ padding: 0.13 }}
              minZoom={0.15}
              maxZoom={2}
              aria-label="도면의 완성 배선 작업대"
            >
              <Background gap={20} size={1} color="#88a499" />
              <Controls showInteractive={false} aria-label="완성 작업대 확대·축소" />
            </ReactFlow>}
          </div>
          <section className="wiring-log completed-workbench-wiring" aria-labelledby="completed-wiring-title">
            <div className="wiring-log-heading">
              <h3 id="completed-wiring-title">완성 배선</h3>
              <span>{board.steps.length}가닥</span>
            </div>
            <ol className="wiring-log-list" role="list">
              {board.steps.map((step, index) => (
                <li key={index}>
                  <button type="button" aria-pressed={selected === index} onClick={() => chooseWire(index)}>
                    <span className="wiring-log-row-heading">
                      <span className="wiring-log-swatch" style={{ backgroundColor: edges[index].style?.stroke }} aria-hidden="true" />
                      <strong>{index + 1}번 배선</strong>
                    </span>
                    {step.title}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <p className="completed-workbench-note">릴레이 배선은 사진의 실제 나사 번호에 연결됩니다.{exercise.motor && ' 모터는 도면의 전압 방향에 따른 교육용 상태를 표시합니다.'}</p>
        <WorkbenchTimingChart timing={timing} sectionRef={timingSection} />
      </div>
    </dialog>
  );
}
