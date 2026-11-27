import { memo, useMemo, useState } from 'react';
import type { Ref } from 'react';
import type { EasyStep } from './easyGuide';
import { drawingInk, wireOnDrawing } from './drawingWire';
import type { DrawingWireGeometry } from './drawingWire';
import './completedDrawing.css';

export const CompletedDrawing = memo(function CompletedDrawing({
  id, src, geometry, step, index, sectionRef, onReturnToLog,
}: {
  id: number;
  src: string;
  geometry: DrawingWireGeometry;
  step?: EasyStep;
  index: number | null;
  sectionRef: Ref<HTMLElement>;
  onReturnToLog: () => void;
}) {
  const [zoom, setZoom] = useState(100);
  const [image, setImage] = useState<{ ratio: number; ink?: ReturnType<typeof drawingInk> }>();
  const highlight = useMemo(() => step && wireOnDrawing(geometry, step.lead, image?.ink), [step, geometry, image]);
  const scale = image?.ratio ?? 1;
  const y = (value: number) => value * 10 * scale;
  const locationCount = highlight?.ends.filter(Boolean).length ?? 0;
  return (
    <section ref={sectionRef} className="completed-drawing" tabIndex={-1} aria-labelledby="completed-drawing-title">
      <div className="completed-drawing-heading">
        <h3 id="completed-drawing-title">{String(id).padStart(2, '0')}번 실습 도면</h3>
        <button type="button" onClick={onReturnToLog}>배선 목록으로</button>
      </div>
      <div className="completed-drawing-selection" role="status">
        {step && index !== null ? (
          <>
            <strong>{index + 1}번 배선 · {step.title}</strong>
            <p>{highlight?.path
              ? 'A는 출발, B는 도착 단자입니다. 도면에서 확인한 연결 구간을 강조했습니다.'
              : locationCount === 2
                ? 'A와 B는 도면에 표시된 양 끝입니다. 두 점 사이의 배선 경로는 원본에서 확인되지 않습니다.'
                : locationCount === 1
                  ? '원본에서 위치를 확인한 단자를 표시했습니다. 다른 끝은 원본에서 위치를 확인할 수 없습니다.'
                  : '이 배선은 등가 회로 또는 수정안에 해당하며, 원본 도면에서 대응 위치를 확인할 수 없습니다.'}</p>
          </>
        ) : <p>배선 목록에서 전선을 선택하면 이 도면에서 대응 위치를 확인할 수 있습니다.</p>}
      </div>
      <label className="completed-drawing-zoom">
        도면 확대
        <input type="range" min={100} max={200} step={10} value={zoom}
          aria-label="완성 작업대 도면 확대"
          onChange={(event) => setZoom(event.target.valueAsNumber)} />
        {zoom}%
      </label>
      <div className="drawing-scroll completed-drawing-scroll">
        <div className="annotated-drawing" style={{ width: `${zoom}%` }}>
          <img className="completed-drawing-image exercise-original" src={src} alt={`${id}번 시퀀스 실습 원본 도면`}
            onLoad={({ currentTarget }) => {
              if (!currentTarget.naturalWidth) return;
              setImage({ ratio: currentTarget.naturalHeight / currentTarget.naturalWidth, ink: drawingInk(currentTarget) });
            }} />
          {image && highlight && locationCount > 0 && (
            <svg className="completed-drawing-overlay" viewBox={`0 0 1000 ${scale * 1000}`}
              role="img" aria-label={`${index! + 1}번 배선의 도면 위치`}>
              {highlight.path && (
                <polyline className="completed-drawing-path" fill="none"
                  points={highlight.path.map((point) => `${point.x * 10},${y(point.y)}`).join(' ')} />
              )}
              {highlight.segments?.map(([from, to], i) => (
                <line key={i} className="completed-drawing-path completed-drawing-segment"
                  x1={from.x * 10} y1={y(from.y)} x2={to.x * 10} y2={y(to.y)} />
              ))}
              {highlight.ends.map((point, side) => point && (
                <g key={side} className="completed-drawing-terminal" data-end={side === 0 ? 'from' : 'to'}
                  transform={`translate(${point.x * 10} ${y(point.y)})`}>
                  <title>{side === 0 ? 'A · 출발 단자' : 'B · 도착 단자'}</title>
                  <circle r={9} />
                  <text x={point.x > 90 ? -19 : 19} y={point.y < 9 ? 26 : -13} textAnchor="middle">{side === 0 ? 'A' : 'B'}</text>
                </g>
              ))}
            </svg>
          )}
        </div>
      </div>
    </section>
  );
});
