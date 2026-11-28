import { memo, useMemo, useState } from 'react';
import type { MouseEvent, Ref } from 'react';
import type { EasyStep } from './easyGuide';
import { drawingInk, wireOnDrawing, wiresAtDrawingPoint } from './drawingWire';
import type { DrawingWireGeometry } from './drawingWire';
import './completedDrawing.css';

export const CompletedDrawing = memo(function CompletedDrawing({
  id,
  src,
  geometry,
  steps,
  selection,
  sectionRef,
  onReturnToLog,
  onSelect,
}: {
  id: number;
  src: string;
  geometry: DrawingWireGeometry;
  steps: readonly EasyStep[];
  selection: readonly number[];
  sectionRef: Ref<HTMLElement>;
  onReturnToLog: () => void;
  onSelect: (indexes: number[]) => void;
}) {
  const [zoom, setZoom] = useState(100);
  const [missed, setMissed] = useState(false);
  const [image, setImage] = useState<{ ratio: number; ink?: ReturnType<typeof drawingInk> }>();
  const leads = useMemo(() => steps.map(({ lead }) => lead), [steps]);
  const traces = useMemo(
    () => leads.map((lead) => wireOnDrawing(geometry, lead, image?.ink)),
    [leads, geometry, image],
  );
  const highlights = selection.map((index) => traces[index]);
  const shared = selection.length > 1;
  const [index] = selection;
  const highlight = highlights[0];
  const scale = image?.ratio ?? 1;
  const y = (value: number) => value * 10 * scale;
  const locationCount = highlight?.ends.filter(Boolean).length ?? 0;

  const hitTest = (
    { currentTarget, clientX, clientY }: MouseEvent<HTMLImageElement>,
    radius: number,
  ) => {
    const bounds = currentTarget.getBoundingClientRect();
    if (!image || !bounds.width || !bounds.height) return [];
    return wiresAtDrawingPoint(
      traces,
      geometry,
      leads,
      {
        x: ((clientX - bounds.left) * 100) / bounds.width,
        y: ((clientY - bounds.top) * 100) / bounds.height,
      },
      bounds,
      radius,
    );
  };
  return (
    <section
      ref={sectionRef}
      className="completed-drawing"
      tabIndex={-1}
      aria-labelledby="completed-drawing-title"
    >
      <div className="completed-drawing-heading">
        <h3 id="completed-drawing-title">{String(id).padStart(2, '0')}번 실습 도면</h3>
        <button type="button" onClick={onReturnToLog}>
          배선 목록으로
        </button>
      </div>
      <p id="completed-drawing-hint" className="completed-drawing-hint">
        도면의 배선이나 단자를 누르면 완성 작업대에서 해당 전선을 볼 수 있습니다.
      </p>
      <div className="completed-drawing-selection" role="status">
        {shared ? (
          <p>
            여러 전선이 이 구간을 공유합니다. 완성 배선 목록에서 강조된 전선을 각각 확인할 수
            있습니다.
          </p>
        ) : highlight ? (
          <>
            <strong>
              {index + 1}번 배선 · {steps[index].title}
            </strong>
            <p>
              {highlight?.path
                ? 'A는 출발, B는 도착 단자입니다. 도면에서 확인한 연결 구간을 강조했습니다.'
                : locationCount === 2
                  ? 'A와 B는 도면에 표시된 양 끝입니다. 두 점 사이의 배선 경로는 원본에서 확인되지 않습니다.'
                  : locationCount === 1
                    ? '원본에서 위치를 확인한 단자를 표시했습니다. 다른 끝은 원본에서 위치를 확인할 수 없습니다.'
                    : '이 배선은 등가 회로 또는 수정안에 해당하며, 원본 도면에서 대응 위치를 확인할 수 없습니다.'}
            </p>
          </>
        ) : (
          <p>
            {missed
              ? '이 위치에서 완성 배선을 찾을 수 없습니다. 도면의 선이나 단자를 눌러 보세요.'
              : '배선 목록에서 전선을 선택하면 이 도면에서 대응 위치를 확인할 수 있습니다.'}
          </p>
        )}
      </div>
      <label className="completed-drawing-zoom">
        도면 확대
        <input
          type="range"
          min={100}
          max={200}
          step={10}
          value={zoom}
          aria-label="완성 작업대 도면 확대"
          onChange={(event) => setZoom(event.target.valueAsNumber)}
        />
        {zoom}%
      </label>
      <div className="drawing-scroll completed-drawing-scroll">
        <div className="annotated-drawing" style={{ width: `${zoom}%` }}>
          <img
            className="completed-drawing-image exercise-original"
            src={src}
            alt={`${id}번 시퀀스 실습 원본 도면`}
            draggable={false}
            aria-describedby="completed-drawing-hint"
            onPointerMove={(event) => {
              if (event.pointerType === 'mouse')
                event.currentTarget.style.cursor = hitTest(event, 8).length
                  ? 'pointer'
                  : 'crosshair';
            }}
            onClick={(event) => {
              if (!image) return;
              const touch =
                'pointerType' in event.nativeEvent && event.nativeEvent.pointerType === 'touch';
              const hits = hitTest(event, touch ? 14 : 8);
              setMissed(!hits.length);
              onSelect(hits);
            }}
            onLoad={({ currentTarget }) => {
              if (!currentTarget.naturalWidth) return;
              setImage({
                ratio: currentTarget.naturalHeight / currentTarget.naturalWidth,
                ink: drawingInk(currentTarget),
              });
            }}
          />
          {image && highlights.some(({ ends }) => ends.some(Boolean)) && (
            <svg
              className="completed-drawing-overlay"
              viewBox={`0 0 1000 ${scale * 1000}`}
              role="img"
              aria-label={shared ? '공유 구간의 배선 위치' : `${index + 1}번 배선의 도면 위치`}
            >
              {highlights.map(({ path, segments, ends }, i) => (
                <g key={selection[i]}>
                  {path && (
                    <polyline
                      className="completed-drawing-path"
                      fill="none"
                      points={path.map((point) => `${point.x * 10},${y(point.y)}`).join(' ')}
                    />
                  )}
                  {segments?.map(([from, to], i) => (
                    <line
                      key={i}
                      className="completed-drawing-path completed-drawing-segment"
                      x1={from.x * 10}
                      y1={y(from.y)}
                      x2={to.x * 10}
                      y2={y(to.y)}
                    />
                  ))}
                  {ends.map(
                    (point, side) =>
                      point && (
                        <g
                          key={side}
                          className="completed-drawing-terminal"
                          data-end={side === 0 ? 'from' : 'to'}
                          transform={`translate(${point.x * 10} ${y(point.y)})`}
                        >
                          <title>{side === 0 ? 'A · 출발 단자' : 'B · 도착 단자'}</title>
                          <circle r={9} />
                          {!shared && (
                            <text
                              x={point.x > 90 ? -19 : 19}
                              y={point.y < 9 ? 26 : -13}
                              textAnchor="middle"
                            >
                              {side === 0 ? 'A' : 'B'}
                            </text>
                          )}
                        </g>
                      ),
                  )}
                </g>
              ))}
            </svg>
          )}
        </div>
      </div>
    </section>
  );
});
