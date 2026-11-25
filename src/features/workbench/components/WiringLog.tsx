import { memo, useEffect, useMemo, useState } from 'react';
import { List } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { componentAssets } from '../../../config/assets';
import { breadboardPinById, pinsFor } from '../../../config/digitalPins';
import { icModel } from '../../../config/ttlModels';
import { useCircuitStore } from '../../../store/usePhotoCircuitStore';
import type { CircuitMode, PinRef } from '../../../types/circuit';

function breadboardTerminalLabel(pinId: string) {
  const pin = breadboardPinById.get(pinId);
  if (!pin) return pinId;
  const rail = /^(top|middle[1-3]|bottom)-(plus|minus) (\d+)$/.exec(pin.label);
  if (!rail) return pin.label.replace(' / ', '구역 ');

  const [, section, polarity, number] = rail;
  const position =
    section === 'top'
      ? '상단'
      : section === 'bottom'
        ? '하단'
        : `중간 ${section.slice(-1)}`;
  return `${position} ${polarity === 'plus' ? '+' : '−'} 레일 ${number}번`;
}

export const WiringLog = memo(function WiringLog({ mode }: { mode: CircuitMode }) {
  const { components, wires, selectedWireId, selectWire } = useCircuitStore(
    useShallow((s) => ({
      components: s.workspaces[mode].components,
      wires: s.workspaces[mode].wires,
      selectedWireId: s.selectedWireId,
      selectWire: s.selectWire,
    })),
  );
  const faultWireIds = useCircuitStore(
    useShallow((s) =>
      s.workspaces[mode].simulation.faults?.flatMap((fault) => fault.wireIds) ?? [],
    ),
  );
  const relatedWires = useMemo(() => new Set(faultWireIds), [faultWireIds]);
  const [recentFault, setRecentFault] = useState<Set<string>>();
  useEffect(
    () => useCircuitStore.subscribe((state, previous) => {
      const workspace = state.workspaces[mode];
      const before = previous.workspaces[mode];
      if (workspace.wires !== before.wires) setRecentFault(undefined);
      if (!workspace.power.on || workspace.simulation === before.simulation) return;
      const ids = workspace.simulation.faults?.flatMap((fault) => fault.wireIds);
      // A test can clear the fault as soon as the user changes the inputs back.
      if (ids?.length) setRecentFault(new Set(ids));
    }),
    [mode],
  );

  const entries = useMemo(() => {
    const labels = new Map<string, number>();
    const componentsById = new Map(
      components.map((component) => {
        const { assetId } = component;
        const asset = componentAssets[assetId];
        const name = component.label || asset.label;
        const isIc = assetId === 'ic-dip14';
        const label = isIc
          ? `${name === asset.label ? 'TTL IC' : name} ${icModel(component)}`
          : name;
        const number = (labels.get(label) ?? 0) + 1;
        labels.set(label, number);
        const pins = isIc ? pinsFor(component) : asset.pins;
        return [component.id, { label, number, assetId, pins }] as const;
      }),
    );
    const describe = ({ componentId, pinId }: PinRef) => {
      const component = componentsById.get(componentId);
      if (!component) return `${componentId} · ${pinId}`;
      const { label, number, assetId, pins } = component;
      const name = (labels.get(label) ?? 0) > 1 ? `${label} ${number}번` : label;
      const terminal =
        assetId === 'breadboard'
          ? breadboardTerminalLabel(pinId)
          : (pins.find((pin) => pin.id === pinId)?.label ?? pinId);
      return `${name} · ${terminal}`;
    };
    return wires
      .map((wire, index) => ({
        wire,
        number: index + 1,
        from: describe(wire.from),
        to: describe(wire.to),
      }))
      .reverse();
  }, [components, wires]);

  return (
    <section
      className="wiring-log"
      aria-labelledby="wiring-log-title"
    >
      <div className="wiring-log-heading">
        <List size={17} aria-hidden="true" />
        <h2 id="wiring-log-title">배선 로그</h2>
        <span role="status">{entries.length}개</span>
      </div>
      {entries.length ? (
        <>
          <p>최근 연결 순 · 배선을 선택하면 양쪽 단자가 강조됩니다.</p>
          <ol className="wiring-log-list" role="list" reversed>
            {entries.map(({ wire, number, from, to }) => (
              <li key={wire.id}>
                <button
                  type="button"
                  aria-pressed={wire.id === selectedWireId}
                  onClick={() => selectWire(wire.id === selectedWireId ? null : wire.id)}
                >
                  <span className="wiring-log-row-heading">
                    <span
                      className="wiring-log-swatch"
                      style={{ backgroundColor: wire.color }}
                      aria-hidden="true"
                    />
                    <strong>{number}번 배선</strong>
                    {mode === 'digital' && (
                      <span className="wiring-log-kind">
                        {wire.kind === 'clip' ? '악어클립' : '점퍼선'}
                      </span>
                    )}
                    {(relatedWires.has(wire.id) || recentFault?.has(wire.id)) && (
                      <span className="wiring-log-fault">
                        {relatedWires.has(wire.id) ? '오류 관련' : '최근 오류 관련'}
                      </span>
                    )}
                  </span>
                  <span className="wiring-log-endpoint">
                    <span>출발</span>
                    <span>{from}</span>
                  </span>
                  <span className="wiring-log-endpoint">
                    <span>도착</span>
                    <span>{to}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p>연결된 배선이 없습니다.</p>
      )}
    </section>
  );
});
