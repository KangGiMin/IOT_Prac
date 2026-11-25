import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

interface DialProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  valueText: string;
  style: CSSProperties;
  disabled: boolean;
  sliding?: boolean;
  onChange: (value: number) => void;
}

export function InstrumentDial(props: DialProps) {
  const { label, value, min, max, valueText, disabled, sliding, style } = props;
  const element = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const current = useRef(value);
  const drag = useRef<{ x: number; y: number; value: number } | null>(null);
  useLayoutEffect(() => { latest.current = props; current.current = value; });

  const change = (raw: number) => {
    const { min, max, step, onChange } = latest.current;
    const next = Math.min(max, Math.max(min, Number((Math.round((raw - min) / step) * step + min).toFixed(8))));
    if (next === current.current) return;
    current.current = next;
    onChange(next);
  };
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if (latest.current.disabled || !event.deltaY || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      change(current.current - Math.sign(event.deltaY) * latest.current.step);
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, []);
  const ratio = (value - min) / (max - min);

  return <div ref={element} role="slider" tabIndex={disabled ? -1 : 0}
    aria-label={label} aria-disabled={disabled} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText}
    title={`${label} · ${valueText}`}
    className={`device-control instrument-dial nodrag nopan nowheel${sliding ? ' instrument-selector' : ''}`}
    style={{ ...style, '--dial-angle': `${ratio * 270 - 135}deg`, '--dial-position': `${ratio * 100}%` } as CSSProperties}
    onPointerDown={(event) => {
      if (disabled || event.button !== 0) return;
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x: event.clientX, y: event.clientY, value: current.current };
      if (sliding) {
        const rect = event.currentTarget.getBoundingClientRect();
        change(min + (event.clientX - rect.left) / rect.width * (max - min));
      }
    }}
    onPointerMove={(event) => {
      if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      if (sliding) {
        const rect = event.currentTarget.getBoundingClientRect();
        change(min + (event.clientX - rect.left) / rect.width * (max - min));
      } else {
        const start = drag.current;
        const detents = Math.round((event.clientX - start.x + start.y - event.clientY) / 6);
        change(start.value + detents * latest.current.step);
      }
    }}
    onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={(event) => {
      if (disabled || !['Home', 'End', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;
      event.preventDefault();
      change(event.key === 'Home' ? min : event.key === 'End' ? max :
        current.current + (event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1) * latest.current.step);
    }}>
    <span>{label} · {valueText}</span>
  </div>;
}
