import { sequenceGeometry } from '../../../config/sequencePins';
import { ScopePhotoControl } from '../../scope/ScopePhotoControl';
import { InstrumentDial } from './InstrumentDial';
import { SupplyPhotoControl } from './SupplyPhotoControl';
import type {
  CircuitComponent,
  ControlDefinition,
} from '../../../types/circuit';
import { useCircuitStore } from '../../../store/usePhotoCircuitStore';

/** Uses the same image-content rectangle as pins, regardless of image aspect ratio/zoom. */
export function PhotoControl({
  component,
  control,
  calibration,
  powered,
}: {
  component: CircuitComponent;
  control: ControlDefinition;
  calibration: boolean;
  powered: boolean;
}) {
  const style = {
    left: `${control.bounds.x}%`,
    top: `${control.bounds.y}%`,
    width: `${control.bounds.width}%`,
    height: `${control.bounds.height}%`,
  };
  const select = () => useCircuitStore.getState().select(component.id);
  const pressed = (value: boolean) =>
    useCircuitStore.getState().updateSettings(component.id, { pressed: value });

  if (control.kind === 'scope-action' || control.kind === 'scope-dial' || control.kind === 'scope-key')
    return <ScopePhotoControl component={component} control={control} calibration={calibration}/>;
  if (control.kind === 'supply-control')
    return <SupplyPhotoControl component={component} control={control} calibration={calibration} />;

  if (control.kind === 'dial' && control.setting === 'timerSeconds') {
    const update = (event: React.PointerEvent<HTMLElement>) => {
      const image = event.currentTarget.parentElement!.getBoundingClientRect();
      const center = sequenceGeometry.dialCenter;
      const angle =
        (Math.atan2(
          event.clientY - (image.top + (image.height * center.y) / 100),
          event.clientX - (image.left + (image.width * center.x) / 100),
        ) *
          180) /
        Math.PI;
      const dial = ((((angle + 90 + 180) % 360) + 360) % 360) - 180;
      const value =
        Math.round(Math.max(0, Math.min(10, ((dial + 135) / 270) * 10)) * 10) /
        10;
      useCircuitStore
        .getState()
        .updateSettings(component.id, { timerSeconds: value });
    };
    return (
      <div
        role="slider"
        tabIndex={calibration ? -1 : 0}
        aria-label={control.label}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={component.settings.timerSeconds}
        className="device-control device-dial nodrag nopan"
        style={style}
        onPointerDown={(e) => {
          if (calibration) return;
          select();
          e.currentTarget.setPointerCapture(e.pointerId);
          update(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) update(e);
        }}
        onKeyDown={(e) => {
          if (calibration) return;
          if (
            [
              'ArrowLeft',
              'ArrowDown',
              'ArrowRight',
              'ArrowUp',
              'Home',
              'End',
            ].includes(e.key)
          ) {
            e.preventDefault();
            useCircuitStore.getState().updateSettings(component.id, {
              timerSeconds:
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? 10
                    : component.settings.timerSeconds +
                      (['ArrowRight', 'ArrowUp'].includes(e.key) ? 0.1 : -0.1),
            });
          }
        }}
      >
        <span>{component.settings.timerSeconds.toFixed(1)} s</span>
      </div>
    );
  }
  if (control.kind === 'dial') {
    const value = component.settings[control.setting];
    return <InstrumentDial style={style} label={control.label} disabled={calibration}
      min={control.min} max={control.max} step={control.step} value={value}
      valueText={`${value.toFixed(1)} ${control.unit}`} onChange={(next) => {
        select();
        useCircuitStore.getState().updateSettings(component.id, { [control.setting]: next });
      }} />;
  }
  if (control.kind === 'momentary') {
    const detent = component.settings.buttonMode === 'detent';
    const isPressed = component.settings.pressed;
    return (
      <button
        className={`device-control momentary-control nodrag nopan ${component.settings.pressed ? 'is-pressed' : ''}`}
        style={style}
        disabled={calibration}
        aria-label={control.label}
        aria-pressed={component.settings.pressed}
        title={detent ? `푸시버튼 ${isPressed ? 'ON' : 'OFF'}` : control.label}
        onClick={() => {
          select();
          if (detent) pressed(!isPressed);
        }}
        onPointerDown={(event) => {
          if (detent) return;
          select();
          event.currentTarget.setPointerCapture(event.pointerId);
          pressed(true);
        }}
        onPointerUp={() => {
          if (!detent) pressed(false);
        }}
        onPointerCancel={() => {
          if (!detent) pressed(false);
        }}
        onLostPointerCapture={() => {
          if (!detent) pressed(false);
        }}
        onKeyDown={(event) => {
          if (detent && event.key === 'Enter' && event.repeat) {
            event.preventDefault();
          }
          if (!detent && (event.key === ' ' || event.key === 'Enter')) {
            event.preventDefault();
            select();
            pressed(true);
          }
        }}
        onKeyUp={(event) => {
          if (!detent && (event.key === ' ' || event.key === 'Enter')) {
            event.preventDefault();
            pressed(false);
          }
        }}
        onBlur={() => {
          if (!detent) pressed(false);
        }}
      >
        <span>
          {detent ? (isPressed ? 'ON' : 'OFF') : isPressed ? '누름' : '누르기'}
        </span>
      </button>
    );
  }
  const supplyOutput = component.assetId === 'power-supply' && control.id === 'output';
  const active =
    control.kind === 'power'
      ? supplyOutput
        ? component.settings.outputEnabled !== false
        : powered
      : (component.settings[control.setting] ??
        control.setting === 'scopeRunning');
  return (
    <button
      className={`device-control nodrag nopan ${active ? 'is-pressed' : ''}`}
      style={style}
      disabled={calibration || (control.kind === 'toggle' && control.setting === 'scopeRunning' && component.settings.scopePowered === false)}
      aria-label={control.label}
      aria-pressed={active}
      title={`${control.label}: ${active ? 'ON' : 'OFF'}`}
      onClick={() => {
        select();
        const state = useCircuitStore.getState();
        if (control.kind === 'power' && supplyOutput)
          state.updateSettings(component.id, { outputEnabled: !active });
        else if (control.kind === 'power') state.togglePower();
        else state.updateSettings(component.id, { [control.setting]: !active });
      }}
    >
      <span>{active ? 'ON' : 'OFF'}</span>
    </button>
  );
}
