import type {
  AssetId,
  CircuitMode,
  CircuitWorkspace,
  Point,
  CircuitNode,
  PinRole,
} from '../../types/circuit';

/** Absolute local coordinates in a device's fixed viewBox, never percentages. */
export interface PinDefinition {
  id: string;
  label: string;
  position: Point;
  role: PinRole;
  /** Pins with the same bus are internally joined (e.g. a breadboard strip). */
  bus?: string;
  style?: 'screw' | 'hole' | 'lead' | 'socket';
}

export type LocalPin = PinDefinition;

export interface ComponentDefinition {
  id: AssetId;
  modes: readonly CircuitMode[];
  label: string;
  model: string;
  category: 'board' | 'control' | 'instrument' | 'passive' | 'tool';
  viewBox: readonly [number, number, number, number];
  pins: readonly LocalPin[];
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CircuitLog {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: number;
}

export interface MissionResult {
  checks: { label: string; passed: boolean }[];
  score: number;
  /** This stage grades topology only; no electrical correctness is implied. */
  scope: 'wiring-only';
}

export interface SvgWorkspace extends CircuitWorkspace {
  nodes: CircuitNode[];
  viewport: Viewport;
  logs: CircuitLog[];
  missionResult: MissionResult | null;
}
