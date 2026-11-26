import type { wireColors } from '../config/wireColors';

/** Framework-independent circuit model. Canvas positions are CSS px at 100% zoom. */
export type CircuitMode = 'sequence' | 'digital';
export type AssetId =
  | 'panel-board'
  | 'pilot-lamp'
  | 'motor-unit'
  | 'pb-switch'
  | 'relay-socket'
  | 'relay-unit-11p'
  | 'relay-body'
  | 'timer-at8n'
  | 'screwdriver'
  | 'breadboard'
  | 'power-supply'
  | 'oscilloscope'
  | 'led-red'
  | 'resistor-330'
  | 'ic-dip14'
  | 'switch-3pin';
export interface Point {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}
/** 0–100 relative to the rendered PNG, excluding object-fit letterboxing.
 * Transparent padding INSIDE a PNG remains part of this coordinate system.
 */
export interface PercentPoint {
  x: number;
  y: number;
}
export interface PercentRect extends PercentPoint {
  width: number;
  height: number;
}
export type PinRole =
  'terminal' | 'positive' | 'ground' | 'input' | 'output' | 'passive';
export type LogicLevel = 0 | 1 | 'floating' | 'unknown';
/** PNG terminal hotspot. Wire endpoints refer to its id, never a copied coordinate. */
export interface PhotoPinDefinition {
  id: string;
  label: string;
  position: PercentPoint;
  role: PinRole;
  /** Future netlist builder can join pins sharing this internal bus. */
  bus?: string;
}
export type OverlayDefinition =
  | {
      id: string;
      kind: 'glow';
      bounds: PercentRect;
      color: string;
    }
  | {
      id: string;
      kind: 'needle';
      center: PercentPoint;
      length: number;
      minAngle: number;
      maxAngle: number;
    }
  | {
      id: string;
      kind: 'lcd';
      bounds: PercentRect;
      format: 'supply' | 'scope';
    };
/** Interactive controls share the exact same percentage space as terminal pins. */
export type ControlDefinition =
  | { id:string; label:string; kind:'scope-action'; bounds:PercentRect; action:import('../features/scope/scopeActions').ScopePhotoAction }
  | { id:string; label:string; kind:'scope-dial'; bounds:PercentRect; field:'timeDiv'|'voltsDiv'|'offset'|'triggerLevel'|'delayDiv' }
  | { id:string; label:string; kind:'scope-key'; bounds:PercentRect; index:number }
  | { id:string; label:string; kind:'supply-control'; bounds:PercentRect; field:'ch2Voltage'|'ch1Limit'|'ch2Limit'|'series'|'parallel'|'auxiliaryVoltage' }
  | {
      id: string;
      label: string;
      kind: 'momentary';
      bounds: PercentRect;
      setting: 'pressed';
    }
  | {
      id: string;
      label: string;
      kind: 'toggle';
      bounds: PercentRect;
      setting: 'switchOn' | 'scopeRunning';
    }
  | {
      id: string;
      label: string;
      kind: 'dial';
      bounds: PercentRect;
      setting: 'timerSeconds' | 'voltage';
      min: number;
      max: number;
      step: number;
      unit: 's' | 'V';
    }
  | {
      id: string;
      label: string;
      kind: 'power';
      bounds: PercentRect;
    };
export interface ComponentAsset {
  id: AssetId;
  mode: CircuitMode;
  label: string;
  model: string;
  description: string;
  src: string;
  /** Actual filename under public/assets; independent from the internal asset id. */
  fileName: `${string}.png`;
  size: Size;
  category: 'board' | 'control' | 'instrument' | 'passive' | 'tool';
  pins: readonly PhotoPinDefinition[];
  controls: readonly ControlDefinition[];
  overlays: readonly OverlayDefinition[];
}
export interface ComponentSettings {
  scope?: import('../features/scope/model').ScopeSettings;
  scopePowered?: boolean;
  supply?: import('../config/supplySettings').SupplySettings;
  icModel?: import('../config/ttlModels').IcModel;
  openCollector?: boolean;
  outputEnabled?: boolean;
  scopeRunning?: boolean;
  buttonMode?: 'momentary' | 'detent';
  pressed: boolean;
  switchOn: boolean;
  timerSeconds: number;
  voltage: number;
}
export interface CircuitComponent {
  id: string;
  assetId: AssetId;
  label: string;
  insertion?: {
    boardId: string;
    bank: number;
    column: number;
    row?: string;
  };
  displaySize?: Size;
  mountedSocketId?: string;
  position: Point;
  settings: ComponentSettings;
}
export interface PinRef {
  componentId: string;
  pinId: string;
}
export type WireColor = (typeof wireColors)[number]['value'];
export interface CircuitWire {
  id: string;
  from: PinRef;
  to: PinRef;
  kind?: 'jumper' | 'clip';
  color: WireColor;
}
export interface PowerState {
  on: boolean;
  voltage: number;
}
export interface ShortCircuitState {
  /** unchecked means no solver result; clear must not be inferred from main power. */
  status: 'unchecked' | 'clear' | 'short';
  involvedPins: PinRef[];
  message: string | null;
}
export type CircuitFaultCode =
  | 'POWER_SHORT'
  | 'IC_REVERSED_POWER'
  | 'LED_MISSING_RESISTOR'
  | 'OUTPUT_CONFLICT'
  | 'IC_SUPPLY_VOLTAGE'
  | 'INVALID_WIRE'
  | 'UNSTABLE_CIRCUIT';
export interface CircuitFault {
  code: CircuitFaultCode;
  severity: 'short' | 'error';
  message: string;
  pins: PinRef[];
  componentIds: string[];
  wireIds: string[];
}
/** Solver output. The optional fields preserve compatibility with the retained SVG editor. */
export interface SimulationState {
  status: 'not-connected' | 'ready' | 'running' | 'error';
  pinValues: Record<
    string,
    {
      voltage: number | null;
      logic: LogicLevel;
    }
  >;
  energizedComponents: string[];
  shortCircuit: ShortCircuitState;
  isShorted?: boolean;
  faults?: CircuitFault[];
  nets?: CircuitNode[];
  componentCurrents?: Record<string, number>;
  warnings?: string[];
  sourceCurrents?: Record<string, number>;
  limitedOutputs?: string[];
  timerStates?: Record<
    string,
    {
      since: number;
      elapsed: number;
      output: boolean;
    }
  >;
}
export interface CircuitWorkspace {
  components: CircuitComponent[];
  wires: CircuitWire[];
  power: PowerState;
  simulation: SimulationState;
}
export interface CalibrationSample {
  assetId: AssetId;
  componentId: string;
  position: PercentPoint;
  copied: boolean;
}
export type LogicGate = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR';
export interface LogicMission {
  id: LogicGate;
  title: string;
  formula: string;
  goal: string;
  inputs: 1 | 2;
  recommended?: string;
  hint?: string;
  truthTable: readonly {
    a: 0 | 1;
    b?: 0 | 1;
    output: 0 | 1;
  }[];
}
export interface CircuitNode {
  id: string;
  pins: PinRef[];
  voltage: number | null;
  logic: LogicLevel;
}
