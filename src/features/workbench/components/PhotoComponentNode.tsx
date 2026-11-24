import { pinTooltip } from '../../../config/pinTooltip';
import { SupplyReadout } from './SupplyReadout';
import { ScopeScreen } from './ScopeScreen';
import {
  pinsFor,
  insertedPins,
  breadboardPinById,
} from '../../../config/digitalPins';
import { sequenceGeometry } from '../../../config/sequencePins';
import { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { componentAssets } from '../../../config/assets';
import { useCircuitStore } from '../../../store/usePhotoCircuitStore';
import type { CircuitComponent, Size } from '../../../types/circuit';
import { containBounds, formatCoordinates, percentAt } from '../utils/geometry';
import { AssetImage } from './AssetImage';
import { PhotoControl } from './PhotoControl';

export type PhotoNode = Node<{ component: CircuitComponent }, 'photo'>;

export const PhotoComponentNode = memo(function PhotoComponentNode({
  id,
  data,
  selected,
}: NodeProps<PhotoNode>) {
  const component = data.component;
  const baseAsset = componentAssets[component.assetId];
  const asset = useMemo(
    () =>
      component.displaySize
        ? { ...baseAsset, size: component.displaySize }
        : baseAsset,
    [baseAsset, component.displaySize],
  );
  const pins = useMemo(
    () => (asset.mode === 'digital' ? pinsFor(component) : asset.pins),
    [asset, component.settings.icModel],
  );
  const [hovered, setHovered] = useState(false);
  const workspace = useCircuitStore((s) =>
    component.assetId === 'power-supply' ? s.workspaces[s.mode] : null,
  );
  const boardComponent = useCircuitStore((s) =>
    component.insertion
      ? s.workspaces[s.mode].components.find(
          (c) => c.id === component.insertion!.boardId,
        )
      : undefined,
  );
  const wires = useCircuitStore((s) => s.workspaces[s.mode].wires);
  const visiblePins = useMemo(() => {
    if (asset.id !== 'breadboard' || selected || hovered) return pins;
    // Endpoints remain mounted so existing wires never lose their geometry.
    const endpoints = new Set(
      wires
        .flatMap((w) => [w.from, w.to])
        .filter((p) => p.componentId === id)
        .map((p) => p.pinId),
    );
    return pins.filter((p) => endpoints.has(p.id));
  }, [asset.id, pins, selected, hovered, wires, id]);
  const inserted = insertedPins(component);
  const pinPosition = (pin: (typeof pins)[number]) => {
    const target = inserted[pin.id];
    const hole = target && breadboardPinById.get(target.pinId);
    if (!hole || !boardComponent) return pin.position;
    return {
      x:
        ((boardComponent.position.x +
          ((boardComponent.displaySize ?? componentAssets.breadboard.size)
            .width *
            hole.position.x) /
            100 -
          component.position.x -
          bounds.x) /
          bounds.width) *
        100,
      y:
        ((boardComponent.position.y +
          ((boardComponent.displaySize ?? componentAssets.breadboard.size)
            .height *
            hole.position.y) /
            100 -
          component.position.y -
          bounds.y) /
          bounds.height) *
        100,
    };
  };
  const calibration = useCircuitStore((s) => s.calibration);
  const sample = useCircuitStore((s) => s.sample);
  const powered = useCircuitStore((s) => s.workspaces[s.mode].power.on);
  const energized = useCircuitStore((s) =>
    s.workspaces[s.mode].simulation.energizedComponents.includes(id),
  );
  const faulted = useCircuitStore(
    (s) =>
      s.workspaces[s.mode].simulation.faults?.some((fault) =>
        fault.componentIds.includes(id),
      ) ?? false,
  );
  const wiringMode = useCircuitStore((s) => s.wiringMode);
  const timer = useCircuitStore(
    (s) => s.workspaces[s.mode].simulation.timerStates?.[id],
  );
  const halted = useCircuitStore(
    (s) => s.workspaces[s.mode].simulation.status === 'error',
  );
  const updateInternals = useUpdateNodeInternals();
  const [bounds, setBounds] = useState({ x: 0, y: 0, ...asset.size });
  const [natural, setNatural] = useState<Size | null>(null);
  const imageLoaded = useCallback(
    (natural: Size) => {
      setNatural(natural);
      setBounds(containBounds(asset.size, natural));
    },
    [asset],
  );
  useEffect(
    () =>
      setBounds(
        natural
          ? containBounds(asset.size, natural)
          : { x: 0, y: 0, ...asset.size },
      ),
    [asset, natural],
  );
  useEffect(
    () => updateInternals(id),
    [bounds, visiblePins, id, updateInternals],
  );
  const board = asset.category === 'board';

  return (
    <div
      className={`photo-node ${board ? 'is-board' : ''} ${selected ? 'is-selected' : ''} ${calibration ? 'is-calibrating' : ''} ${faulted ? 'has-circuit-fault' : ''} ${component.mountedSocketId ? 'mounted-relay' : ''}`}
      data-asset={asset.id}
      data-compact={asset.size.height < 150 || asset.size.width < 100}
      onPointerEnter={() => {
        if (asset.id === 'breadboard') setHovered(true);
      }}
      onPointerLeave={() => {
        if (asset.id === 'breadboard') setHovered(false);
      }}
      style={asset.size}
    >
      <AssetImage
        asset={asset}
        onLoad={imageLoaded}
        onFallback={() => {
          setNatural(null);
          setBounds({ x: 0, y: 0, ...asset.size });
        }}
      />
      <div
        className={`asset-interactions ${calibration ? 'nodrag nopan' : ''}`}
        style={{
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height,
        }}
        onClick={async (event) => {
          if (!calibration) return;
          event.stopPropagation();
          const position = percentAt(
            event.clientX,
            event.clientY,
            event.currentTarget.getBoundingClientRect(),
          );
          const next = {
            assetId: asset.id,
            componentId: id,
            position,
            copied: false,
          };
          useCircuitStore.getState().select(id);
          useCircuitStore.getState().setSample(next);
          try {
            await navigator.clipboard.writeText(formatCoordinates(position));
            // An older clipboard promise must not overwrite a newer click/mode change.
            if (useCircuitStore.getState().sample === next)
              useCircuitStore.getState().setSample({ ...next, copied: true });
          } catch {
            /* The selected coordinate stays available for manual copying. */
          }
        }}
      >
        {asset.id === 'panel-board' &&
          calibration &&
          sequenceGeometry.railYs.map((y) => (
            <div
              key={y}
              className="rail-guide"
              style={{
                top: y + '%',
                left: sequenceGeometry.left + '%',
                right: 100 - sequenceGeometry.right + '%',
              }}
            />
          ))}
        {asset.overlays.map((overlay) => {
          if (overlay.kind === 'needle') {
            const angle =
              overlay.minAngle +
              (component.settings.timerSeconds / 10) *
                (overlay.maxAngle - overlay.minAngle);
            return (
              <div
                key={overlay.id}
                className="timer-needle"
                style={{
                  left: `${overlay.center.x}%`,
                  top: `${overlay.center.y}%`,
                  width: `${overlay.length}%`,
                  transform: `rotate(${angle - 90}deg)`,
                }}
              />
            );
          }
          const style = {
            left: `${overlay.bounds.x}%`,
            top: `${overlay.bounds.y}%`,
            width: `${overlay.bounds.width}%`,
            height: `${overlay.bounds.height}%`,
          };
          if (overlay.kind === 'glow')
            return (
              <div
                key={overlay.id}
                className={`light-overlay ${overlay.id} ${overlay.id === 'timer-run' && timer && !timer.output ? 'is-timing' : ''}`}
                title={
                  overlay.id === 'timer-run'
                    ? 'POWER / RUN'
                    : overlay.id === 'timer-out'
                      ? 'OUT'
                      : asset.label
                }
                style={{
                  ...style,
                  opacity: (
                    overlay.id === 'cc' || overlay.id === 'overload'
                      ? powered && halted
                      : powered &&
                        !halted &&
                        (component.assetId !== 'power-supply' ||
                          component.settings.outputEnabled !== false) &&
                        (overlay.id === 'timer-out'
                          ? timer?.output
                          : overlay.id === 'timer-run'
                            ? !!timer
                            : energized)
                  )
                    ? 0.9
                    : 0,
                  background: `radial-gradient(ellipse, white 0%, ${overlay.color} 35%, transparent 75%)`,
                  boxShadow: `0 0 28px 14px ${overlay.color}`,
                }}
              />
            );
          if (overlay.format === 'scope')
            return (
              <div
                key={overlay.id}
                className="scope-overlay nodrag nopan"
                style={style}
              >
                <ScopeScreen id={id} />
              </div>
            );
          if (overlay.format === 'supply')
            return (
              <div
                key={overlay.id}
                className="lcd-overlay supply"
                style={style}
              >
                <SupplyReadout component={component} workspace={workspace!} />
              </div>
            );
          return (
            <div
              key={overlay.id}
              className={`lcd-overlay ${overlay.format}`}
              style={style}
            >
              {String(overlay.format) === 'supply' ? (
                <>
                  <strong>
                    {halted ? '0.0' : component.settings.voltage.toFixed(1)}{' '}
                    <small>V</small>
                  </strong>
                  <b className="supply-current">
                    {(
                      workspace?.simulation.sourceCurrents?.[id + ':plus'] ?? 0
                    ).toFixed(2)}{' '}
                    A
                  </b>
                  <span>
                    {halted
                      ? 'TRIPPED'
                      : powered && component.settings.outputEnabled !== false
                        ? 'OUTPUT ON'
                        : 'OUTPUT OFF'}
                  </span>
                </>
              ) : (
                <>
                  <span>CH1 / CH2</span>
                  <strong>DC 측정</strong>
                  <small>파형 표시 준비 중</small>
                </>
              )}
            </div>
          );
        })}
        {asset.controls.map((control) => (
          <PhotoControl
            key={control.id}
            component={component}
            control={control}
            calibration={calibration}
            powered={powered}
          />
        ))}
        {visiblePins.map((pin) => (
          <Handle
            id={pin.id}
            type="source"
            position={Position.Top}
            isConnectable={!calibration && !powered && wiringMode}
            className={`photo-pin ${pin.role}`}
            key={pin.id}
            style={{
              left: `${pinPosition(pin).x}%`,
              top: `${pinPosition(pin).y}%`,
            }}
            title={pinTooltip(component, pin)}
            aria-label={`${asset.label} 단자 ${pin.label}`}
          >
            {(asset.id === 'panel-board' || asset.id === 'timer-at8n') && (
              <span className="terminal-hardware" aria-hidden="true">
                <span className="terminal-screw" />
                <small>
                  {asset.id === 'panel-board'
                    ? pin.id === 'plus'
                      ? '+24V'
                      : '0V'
                    : pin.id}
                </small>
              </span>
            )}
          </Handle>
        ))}
        {calibration && sample?.componentId === id && (
          <div
            className="coordinate-marker"
            style={{
              left: `${sample.position.x}%`,
              top: `${sample.position.y}%`,
            }}
          >
            <span />
            <code>
              x: {sample.position.x.toFixed(2)}%, y:{' '}
              {sample.position.y.toFixed(2)}%
            </code>
          </div>
        )}
      </div>
      {asset.id === 'timer-at8n' && (
        <div className="timer-socket-label">
          후면 소켓 ·{' '}
          {timer
            ? `${Math.min(timer.elapsed, component.settings.timerSeconds).toFixed(1)} / ${component.settings.timerSeconds.toFixed(1)} s`
            : 'POWER OFF'}
        </div>
      )}
      {asset.id === 'switch-3pin' && (
        <div
          className="switch-state-overlay"
          style={{ left: component.settings.switchOn ? '57%' : '24%' }}
        >
          {' '}
          {component.settings.switchOn ? 'R' : 'L'}{' '}
        </div>
      )}
    </div>
  );
});
