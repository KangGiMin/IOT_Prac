import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  LockKeyhole,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
} from 'lucide-react';
import { DeviceSvg } from './devices/DeviceSvg';
import { deviceDefinitions } from './devices/definitions';
import { useSvgCircuitStore } from './store/useSvgCircuitStore';
import { pinPosition, samePin, wirePath, zoomAt } from './utils/svgGeometry';
import type { CircuitComponent, PinRef, Point } from '../../types/circuit';
import type { Viewport } from './types.ts';
type Gesture = {
  pointerId: number;
} & (
  | {
      kind: 'pan';
      start: Point;
      viewport: Viewport;
    }
  | {
      kind: 'component';
      id: string;
      offset: Point;
    }
);
/** One root SVG; grid, equipment, wires and terminal hit targets share world units. */
export function WorkspaceCanvas() {
  const state = useSvgCircuitStore();
  const workspace = state.workspaces[state.mode];
  const { viewport, components, wires } = workspace;
  const locked = workspace.power.on;
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const spaceDown = useRef(false);
  const initialized = useRef(new Set<string>());
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [cursor, setCursor] = useState<Point | null>(null);
  const [panning, setPanning] = useState(false);
  const gridId = useId().replace(/:/g, '') + '-grid';
  // Inverting actual SVG matrices also handles CSS scaling and browser zoom.
  const pointAt = (
    clientX: number,
    clientY: number,
    world = true,
  ): Point | null => {
    const element = world ? worldRef.current : svgRef.current;
    const matrix = element?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(
      matrix.inverse(),
    );
    return { x: point.x, y: point.y };
  };
  const fit = useCallback(() => {
    const current = useSvgCircuitStore.getState();
    const items = current.workspaces[current.mode].components;
    if (!items.length) {
      current.setViewport({ x: 40, y: 40, zoom: 1 });
      return;
    }
    const minX = Math.min(...items.map((c) => c.position.x));
    const minY = Math.min(...items.map((c) => c.position.y));
    const maxX = Math.max(
      ...items.map(
        (c) => c.position.x + deviceDefinitions[c.assetId].viewBox[2],
      ),
    );
    const maxY = Math.max(
      ...items.map(
        (c) => c.position.y + deviceDefinitions[c.assetId].viewBox[3],
      ),
    );
    const zoom = Math.max(
      0.25,
      Math.min(
        1.4,
        (size.width - 80) / (maxX - minX),
        (size.height - 110) / (maxY - minY),
      ),
    );
    current.setViewport({
      x: (size.width - (maxX - minX) * zoom) / 2 - minX * zoom,
      y: (size.height - (maxY - minY) * zoom) / 2 - minY * zoom,
      zoom,
    });
  }, [size]);
  useEffect(() => {
    if (!frameRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      });
    });
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (
      size.width <= 1 ||
      size.height <= 1 ||
      initialized.current.has(state.mode)
    )
      return;
    initialized.current.add(state.mode);
    fit();
  }, [state.mode, size, fit]);
  useEffect(() => {
    gesture.current = null;
    spaceDown.current = false;
    setPanning(false);
    setCursor(null);
  }, [state.mode, locked]);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      );
      const s = useSvgCircuitStore.getState();
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1);
      s.setViewport(
        zoomAt(
          s.workspaces[s.mode].viewport,
          p,
          Math.exp(-Math.max(-250, Math.min(250, delta)) * 0.002),
        ),
      );
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => svg.removeEventListener('wheel', wheel);
  }, [size.height]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement;
      if (element.matches('input, textarea, select, [contenteditable="true"]'))
        return;
      const s = useSvgCircuitStore.getState();
      if (event.key === 'Escape') {
        s.setPendingPin(null);
        gesture.current = null;
        setPanning(false);
      }
      if (
        event.code === 'Space' &&
        svgRef.current?.contains(document.activeElement)
      ) {
        event.preventDefault();
        spaceDown.current = true;
      }
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        svgRef.current?.contains(document.activeElement)
      ) {
        event.preventDefault();
        s.deleteSelection();
      }
    };
    const release = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceDown.current = false;
    };
    const blur = () => {
      spaceDown.current = false;
      gesture.current = null;
      setPanning(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', release);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', blur);
    };
  }, []);
  const capture = (event: ReactPointerEvent) => {
    svgRef.current?.focus();
    svgRef.current?.setPointerCapture(event.pointerId);
  };
  const onBackgroundDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    const point = pointAt(event.clientX, event.clientY, false);
    if (!point) return;
    event.preventDefault();
    capture(event);
    if (!spaceDown.current && event.button === 0) {
      state.select(null);
      state.setPendingPin(null);
    }
    gesture.current = {
      kind: 'pan',
      pointerId: event.pointerId,
      start: point,
      viewport: { ...viewport },
    };
    setPanning(true);
  };
  const onComponentDown = (
    event: ReactPointerEvent,
    component: CircuitComponent,
  ) => {
    if (spaceDown.current || event.button === 1) return;
    if (event.button !== 0) return;
    event.stopPropagation();
    state.select(component.id);
    capture(event);
    const point = pointAt(event.clientX, event.clientY);
    if (!point || locked) return;
    gesture.current = {
      kind: 'component',
      pointerId: event.pointerId,
      id: component.id,
      offset: {
        x: point.x - component.position.x,
        y: point.y - component.position.y,
      },
    };
  };
  const activatePin = (ref: PinRef) => {
    if (locked) return;
    if (state.pendingPin) state.connect(state.pendingPin, ref);
    else {
      setCursor(pinPosition(components, ref));
      state.setPendingPin(ref);
    }
  };
  const onMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const worldPoint = pointAt(event.clientX, event.clientY);
    if (state.pendingPin && worldPoint) setCursor(worldPoint);
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.kind === 'component' && worldPoint)
      state.moveComponent(current.id, {
        x: worldPoint.x - current.offset.x,
        y: worldPoint.y - current.offset.y,
      });
    if (current.kind === 'pan') {
      const point = pointAt(event.clientX, event.clientY, false);
      if (point)
        state.setViewport({
          ...current.viewport,
          x: current.viewport.x + point.x - current.start.x,
          y: current.viewport.y + point.y - current.start.y,
        });
    }
  };
  const endGesture = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    setPanning(false);
    if (svgRef.current?.hasPointerCapture(event.pointerId))
      svgRef.current.releasePointerCapture(event.pointerId);
  };
  const zoomButton = (factor: number) =>
    state.setViewport(
      zoomAt(viewport, { x: size.width / 2, y: size.height / 2 }, factor),
    );
  const pendingPosition =
    state.pendingPin && pinPosition(components, state.pendingPin);
  // Boards render first, regardless of addition order. Pin targets render above wires.
  const ordered = [...components].sort(
    (a, b) =>
      Number(deviceDefinitions[b.assetId].category === 'board') -
      Number(deviceDefinitions[a.assetId].category === 'board'),
  );
  return (
    <div className="workspace-frame" ref={frameRef}>
      <svg
        ref={svgRef}
        className={`workspace-svg ${panning ? 'is-panning' : ''}`}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="application"
        aria-label="회로 작업대. 휠로 확대 축소, 빈 곳이나 Space 키를 누르고 드래그하여 이동. 단자 두 개를 차례로 선택하여 배선."
        tabIndex={0}
        onPointerDown={onBackgroundDown}
        onPointerMove={onMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onLostPointerCapture={() => {
          gesture.current = null;
          setPanning(false);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <title>IoT 전기·전자 회로 SVG 작업대</title>
        <defs>
          <pattern
            id={gridId}
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="#d1d9e0" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="#f4f6f8" />
        <g
          ref={worldRef}
          transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}
        >
          <g data-layer="grid" pointerEvents="none">
            <rect
              x={-viewport.x / viewport.zoom}
              y={-viewport.y / viewport.zoom}
              width={size.width / viewport.zoom}
              height={size.height / viewport.zoom}
              fill={`url(#${gridId})`}
            />
          </g>
          <g data-layer="components">
            {ordered.map((component) => {
              const definition = deviceDefinitions[component.assetId];
              return (
                <g
                  key={component.id}
                  transform={`translate(${component.position.x} ${component.position.y})`}
                  className={locked ? 'device-locked' : 'device-draggable'}
                  role="button"
                  tabIndex={0}
                  aria-label={`${component.label} 선택`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') state.select(component.id);
                  }}
                  onPointerDown={(event) => onComponentDown(event, component)}
                >
                  <rect
                    width={definition.viewBox[2]}
                    height={definition.viewBox[3]}
                    fill="transparent"
                  />
                  <DeviceSvg
                    assetId={component.assetId}
                    settings={component.settings}
                    energized={workspace.simulation.energizedComponents.includes(
                      component.id,
                    )}
                  />
                  {state.selectedId === component.id && (
                    <rect
                      x="-5"
                      y="-5"
                      width={definition.viewBox[2] + 10}
                      height={definition.viewBox[3] + 10}
                      rx="8"
                      fill="none"
                      stroke="#2979db"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}
          </g>
          <g data-layer="wires" fill="none">
            {wires.map((wire) => {
              const a = pinPosition(components, wire.from);
              const b = pinPosition(components, wire.to);
              if (!a || !b) return null;
              const path = wirePath(a, b);
              const selected = state.selectedWireId === wire.id;
              return (
                <g
                  key={wire.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`전선 ${wire.from.pinId} → ${wire.to.pinId}`}
                  onPointerDown={(event) => {
                    if (spaceDown.current || event.button === 1) return;
                    event.stopPropagation();
                    state.selectWire(wire.id);
                    svgRef.current?.focus();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') state.selectWire(wire.id);
                  }}
                >
                  {selected && (
                    <path
                      d={path}
                      stroke="#98beff"
                      strokeWidth="8"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  )}
                  <path
                    d={path}
                    stroke="#24364d"
                    strokeOpacity=".18"
                    strokeWidth="5"
                    transform="translate(0 2)"
                    pointerEvents="none"
                  />
                  <path
                    d={path}
                    stroke={wire.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                  <path
                    d={path}
                    stroke="transparent"
                    strokeWidth="13"
                    vectorEffect="non-scaling-stroke"
                    className="wire-hit"
                  />
                </g>
              );
            })}
            {pendingPosition && cursor && (
              <path
                d={wirePath(pendingPosition, cursor)}
                stroke={state.wireColor}
                strokeWidth="2.5"
                strokeDasharray="6 5"
                vectorEffect="non-scaling-stroke"
                opacity=".8"
                pointerEvents="none"
              />
            )}
          </g>
          <g data-layer="terminals">
            {ordered.map((component) =>
              deviceDefinitions[component.assetId].pins.map((pin) => {
                const ref = { componentId: component.id, pinId: pin.id };
                const pending =
                  state.pendingPin && samePin(state.pendingPin, ref);
                const radius =
                  pin.style === 'hole' ? 4.8 : pin.style === 'lead' ? 6 : 10;
                return (
                  <circle
                    key={`${component.id}:${pin.id}`}
                    cx={component.position.x + pin.position.x}
                    cy={component.position.y + pin.position.y}
                    r={radius}
                    className={`pin-hit ${pending ? 'is-pending' : ''}`}
                    role="button"
                    tabIndex={locked ? -1 : 0}
                    aria-disabled={locked}
                    aria-label={`${component.label} 단자 ${pin.label}`}
                    aria-pressed={!!pending}
                    onPointerDown={(event) => {
                      if (spaceDown.current || event.button === 1) return;
                      event.stopPropagation();
                      svgRef.current?.focus();
                      if (event.button === 0) activatePin(ref);
                    }}
                    onPointerEnter={() => {
                      if (state.pendingPin)
                        setCursor({
                          x: component.position.x + pin.position.x,
                          y: component.position.y + pin.position.y,
                        });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        activatePin(ref);
                      }
                    }}
                  >
                    <title>{`${component.label} · ${pin.label} (${pin.position.x}, ${pin.position.y})`}</title>
                  </circle>
                );
              }),
            )}
          </g>
        </g>
      </svg>
      <div className="canvas-mode-badge">
        {locked ? <LockKeyhole size={14} /> : <MousePointer2 size={14} />}{' '}
        {locked
          ? '전원 ON · 편집 잠금'
          : state.pendingPin
            ? '도착 단자를 선택하세요 · Esc 취소'
            : '배선 편집 모드'}
      </div>
      <div className="canvas-navigation">
        <button aria-label="축소" onClick={() => zoomButton(1 / 1.2)}>
          <Minus size={16} />
        </button>
        <output>{Math.round(viewport.zoom * 100)}%</output>
        <button aria-label="확대" onClick={() => zoomButton(1.2)}>
          <Plus size={16} />
        </button>
        <span />
        <button aria-label="전체 보기" onClick={fit}>
          <Maximize2 size={16} />
        </button>
      </div>
      <div className="canvas-help">
        휠: 확대/축소 <i /> 빈 곳 / Space + 드래그: 이동 <i /> Delete: 삭제
      </div>
    </div>
  );
}
