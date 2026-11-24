import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Cable } from 'lucide-react';
import { componentAssets } from '../../../config/assets';
import { pinsFor } from '../../../config/digitalPins';
import { pinTooltip } from '../../../config/pinTooltip';
import { useCircuitStore } from '../../../store/usePhotoCircuitStore';
import type { CircuitComponent } from '../../../types/circuit';

const componentPins = (c: CircuitComponent | undefined) =>
  !c
    ? []
    : componentAssets[c.assetId].mode === 'digital'
      ? pinsFor(c)
      : componentAssets[c.assetId].pins;

export function KeyboardWiring() {
  const state = useCircuitStore(
    useShallow((s) => ({
      components: s.workspaces[s.mode].components,
      wires: s.workspaces[s.mode].wires,
      powered: s.workspaces[s.mode].power.on,
      calibration: s.calibration,
      wiringMode: s.wiringMode,
      connect: s.connect,
      notice: s.notice,
    })),
  );
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState(''),
    [fromPin, setFromPin] = useState('');
  const [toId, setToId] = useState(''),
    [toPin, setToPin] = useState('');
  const from = state.components.find((c) => c.id === fromId);
  const to = state.components.find((c) => c.id === toId);
  const fromPins = componentPins(from),
    toPins = componentPins(to);
  const sourcePin = fromPins.some((p) => p.id === fromPin) ? fromPin : '';
  const targetPin = toPins.some((p) => p.id === toPin) ? toPin : '';
  const same = !!from && !!to && from.id === to.id && sourcePin === targetPin;
  const connected =
    !!sourcePin &&
    !!targetPin &&
    state.wires.some(
      (w) =>
        (w.from.componentId === fromId &&
          w.from.pinId === sourcePin &&
          w.to.componentId === toId &&
          w.to.pinId === targetPin) ||
        (w.to.componentId === fromId &&
          w.to.pinId === sourcePin &&
          w.from.componentId === toId &&
          w.from.pinId === targetPin),
    );
  const lock = state.powered
    ? '메인 전원을 끈 뒤 배선하세요.'
    : state.calibration
      ? '핀 좌표 디버그 모드를 끈 뒤 배선하세요.'
      : !state.wiringMode
        ? '배선 모드를 켠 뒤 단자를 선택하세요.'
        : '';
  const ready =
    !!from &&
    !!to &&
    !!sourcePin &&
    !!targetPin &&
    !same &&
    !connected &&
    !lock;
  const components = state.components.filter(
    (c) => componentPins(c).length > 0,
  );

  return (
    <section
      id="keyboard-wiring"
      className="inspector-section keyboard-wiring"
      tabIndex={-1}
      aria-labelledby="keyboard-wiring-title"
    >
      <div className="panel-heading">
        <Cable size={17} />
        <h2 id="keyboard-wiring-title">키보드 배선</h2>
      </div>
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>단자 선택으로 배선</summary>
        {open && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (ready)
                state.connect(
                  { componentId: fromId, pinId: sourcePin },
                  { componentId: toId, pinId: targetPin },
                );
            }}
            aria-describedby="keyboard-wiring-help"
          >
            <p id="keyboard-wiring-help" className="panel-description">
              Tab으로 항목을 이동하고 방향키로 부품과 단자를 선택한 뒤
              연결하세요.
            </p>
            <fieldset disabled={!!lock}>
              <legend className="sr-only">출발 및 도착 단자</legend>
              <label className="setting-field">
                <span id="wire-source-component-label">출발 부품</span>
                <select
                  aria-labelledby="wire-source-component-label"
                  value={from?.id ?? ''}
                  onChange={(e) => {
                    setFromId(e.target.value);
                    setFromPin('');
                  }}
                >
                  <option value="">부품 선택</option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} · {c.id.slice(-6)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="setting-field">
                <span id="wire-source-pin-label">출발 단자</span>
                <select
                  aria-labelledby="wire-source-pin-label"
                  disabled={!from}
                  value={sourcePin}
                  onChange={(e) => setFromPin(e.target.value)}
                >
                  <option value="">단자 선택</option>
                  {fromPins.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} · {pinTooltip(from!, p)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="setting-field">
                <span id="wire-target-component-label">도착 부품</span>
                <select
                  aria-labelledby="wire-target-component-label"
                  value={to?.id ?? ''}
                  onChange={(e) => {
                    setToId(e.target.value);
                    setToPin('');
                  }}
                >
                  <option value="">부품 선택</option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} · {c.id.slice(-6)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="setting-field">
                <span id="wire-target-pin-label">도착 단자</span>
                <select
                  aria-labelledby="wire-target-pin-label"
                  disabled={!to}
                  value={targetPin}
                  onChange={(e) => setToPin(e.target.value)}
                >
                  <option value="">단자 선택</option>
                  {toPins.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} · {pinTooltip(to!, p)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="component-control"
                type="submit"
                disabled={!ready}
              >
                배선 연결
              </button>
            </fieldset>
          </form>
        )}
      </details>
      <p
        role="status"
        aria-label="키보드 배선 상태"
        className="panel-description"
      >
        {lock ||
          (!from || !to || !sourcePin || !targetPin
            ? '출발·도착 부품과 단자를 선택하세요.'
            : same
              ? '같은 단자는 연결할 수 없습니다.'
              : connected
                ? '선택한 두 단자는 연결되어 있습니다.'
                : state.notice)}
      </p>
    </section>
  );
}
