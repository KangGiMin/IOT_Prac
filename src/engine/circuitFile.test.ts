import { describe, expect, it } from 'vitest';
import {
  circuitCapacityIssue,
  exportCircuitFile,
  importCircuitFile,
  MAX_CIRCUIT_COMPONENTS,
  MAX_CIRCUIT_FILE_BYTES,
  MAX_CIRCUIT_WIRES,
} from './circuitFile';
import { createPreset } from '../features/workbench/data/presets';
import { placeDigital } from '../features/workbench/utils/digitalPlacement';
import { makeComponent } from '../features/workbench/data/photoCircuits';
import { capacityWorkspace } from '../test/circuitFixtures';
import { defaultScopeSettings } from '../features/scope/model';
const workspaces = () => ({
  sequence: createPreset('self-hold').workspace,
  digital: createPreset('nand').workspace,
});
const saved = () => exportCircuitFile('digital', workspaces());
function invalid(change: (data: ReturnType<typeof JSON.parse>) => void) {
  const data = JSON.parse(saved());
  change(data);
  return JSON.stringify(data);
}

describe('versioned circuit JSON', () => {
  it('round-trips scope and analog generator settings and rejects invalid ranges', () => {
    const w = workspaces(),
      scope = w.digital.components.find((c) => c.assetId === 'oscilloscope')!;
    scope.settings.scope = defaultScopeSettings();
    scope.settings.scope.channels.ch1.source = 'generator';
    scope.settings.scope.channels.ch1.generator.frequency = 1234;
    const source = exportCircuitFile('digital', w),
      loaded = importCircuitFile(source);
    expect(
      loaded.workspaces.digital.components.find((c) => c.id === scope.id)!.settings.scope,
    ).toEqual(scope.settings.scope);
    const broken = JSON.parse(source);
    broken.workspaces.digital.components.find(
      (c: { id: string }) => c.id === scope.id,
    ).settings.scope.channels.ch1.generator.frequency = -1;
    expect(() => importCircuitFile(JSON.stringify(broken))).toThrow();
  });
  it('refits the large mounted relay frame in older JSON while preserving its wiring', () => {
    const before = workspaces();
    const body = before.sequence.components.find((c) => c.id === 'body')!;
    delete body.displaySize;
    body.position = { x: 599.6, y: 236.5 };
    const result = importCircuitFile(exportCircuitFile('sequence', before));
    const loaded = result.workspaces.sequence.components.find((c) => c.id === 'body')!;
    expect(loaded.mountedSocketId).toBe('relay');
    expect(loaded.displaySize!.width).toBeLessThan(50);
    expect(loaded.position).not.toEqual(body.position);
    expect(result.workspaces.sequence.wires).toEqual(before.sequence.wires);
  });
  it('round-trips an IC inserted in the fourth bank of the supplied breadboard', () => {
    const w = workspaces();
    w.digital.components = w.digital.components.map((c) =>
      c.id === 'ic' ? { ...c, position: { x: 240, y: 570 } } : c,
    );
    w.digital.components = placeDigital(w.digital.components, 'ic');
    expect(w.digital.components.find((c) => c.id === 'ic')!.insertion?.bank).toBe(3);
    const loaded = importCircuitFile(exportCircuitFile('digital', w));
    expect(loaded.workspaces.digital.components.find((c) => c.id === 'ic')!.insertion?.bank).toBe(
      3,
    );
  });
  it('round-trips both presets with metadata, wires and power OFF', () => {
    const before = workspaces();
    before.digital.power.on = true;
    before.sequence.power.on = true;
    const source = exportCircuitFile('digital', before),
      result = importCircuitFile(source);
    expect(result.mode).toBe('digital');
    expect(result.workspaces.digital.components).toEqual(before.digital.components);
    expect(result.workspaces.sequence.wires).toEqual(before.sequence.wires);
    expect(result.workspaces.digital.power.on).toBe(false);
    expect(result.workspaces.sequence.power.on).toBe(false);
    expect(source).not.toContain('"simulation"');
    expect(result.workspaces.digital.simulation.isShorted).toBe(false);
  });
  it.each(['bad JSON', '[]', '{}', 'null'])('rejects malformed or unsupported input %s', (source) =>
    expect(() => importCircuitFile(source)).toThrow(),
  );
  it('rejects a future version and oversize files', () => {
    expect(() => importCircuitFile(invalid((d) => (d.version = 2)))).toThrow('버전');
    expect(() => importCircuitFile(' '.repeat(1_000_001))).toThrow('1MB');
  });
  it('rejects unknown assets, duplicate IDs and dangling endpoints', () => {
    expect(() =>
      importCircuitFile(invalid((d) => (d.workspaces.digital.components[0].assetId = '__proto__'))),
    ).toThrow();
    expect(() =>
      importCircuitFile(
        invalid(
          (d) => (d.workspaces.digital.components[1].id = d.workspaces.digital.components[0].id),
        ),
      ),
    ).toThrow('중복');
    expect(() =>
      importCircuitFile(invalid((d) => (d.workspaces.digital.wires[0].to.pinId = 'missing'))),
    ).toThrow('단자');
  });
  it('rejects invalid numeric settings, IC models and mount references', () => {
    expect(() =>
      importCircuitFile(invalid((d) => (d.workspaces.digital.components[0].position.x = null))),
    ).toThrow();
    expect(() =>
      importCircuitFile(
        invalid(
          (d) =>
            (d.workspaces.digital.components.find(
              (c: { id: string }) => c.id === 'ic',
            ).settings.icModel = '7499'),
        ),
      ),
    ).toThrow('TTL');
    expect(() =>
      importCircuitFile(
        invalid(
          (d) =>
            (d.workspaces.sequence.components.find(
              (c: { id: string }) => c.id === 'body',
            ).mountedSocketId = 'missing'),
        ),
      ),
    ).toThrow('장착');
  });
  it('ignores execution state and clears physically held momentary buttons', () => {
    const data = JSON.parse(saved());
    data.workspaces.sequence.power.on = true;
    const start = data.workspaces.sequence.components.find((c: { id: string }) => c.id === 'start');
    // Older files omitted the setting and used momentary behavior.
    delete start.settings.buttonMode;
    start.settings.pressed = true;
    const result = importCircuitFile(JSON.stringify(data));
    expect(result.workspaces.sequence.power.on).toBe(false);
    expect(
      result.workspaces.sequence.components.find((c) => c.id === 'start')!.settings.pressed,
    ).toBe(false);
  });

  it('round-trips both modes at their component and wire limits within the byte limit', () => {
    const w = {
      sequence: capacityWorkspace('sequence', MAX_CIRCUIT_WIRES),
      digital: capacityWorkspace('digital', MAX_CIRCUIT_WIRES),
    };
    const source = exportCircuitFile('digital', w);
    expect(new TextEncoder().encode(source).length).toBeLessThanOrEqual(MAX_CIRCUIT_FILE_BYTES);
    expect(source).not.toContain('\n');
    const loaded = importCircuitFile(source);
    for (const mode of ['sequence', 'digital'] as const) {
      expect(loaded.workspaces[mode].components).toHaveLength(MAX_CIRCUIT_COMPONENTS);
      expect(loaded.workspaces[mode].wires).toHaveLength(MAX_CIRCUIT_WIRES);
    }
  });

  it('rejects over-limit exports instead of generating files the importer rejects', () => {
    const w = workspaces();
    w.sequence = capacityWorkspace('sequence', 0);
    w.sequence.components.push(makeComponent('screwdriver', 'extra', 0, 0));
    expect(() => exportCircuitFile('sequence', w)).toThrow('100');
    w.sequence = capacityWorkspace('sequence', MAX_CIRCUIT_WIRES + 1);
    expect(() => exportCircuitFile('sequence', w)).toThrow('2000');
    w.sequence = capacityWorkspace('sequence', MAX_CIRCUIT_WIRES, 80);
    w.digital = capacityWorkspace('digital', MAX_CIRCUIT_WIRES, 80);
    expect(circuitCapacityIssue(w)).toContain('1MB');
    expect(() => exportCircuitFile('digital', w)).toThrow('1MB');
  });

  it('checks exported metadata with the same validator used by import', () => {
    const w = workspaces();
    w.digital.components.find((c) => c.id === 'ic')!.insertion!.column = 0;
    expect(() => exportCircuitFile('digital', w)).toThrow();
  });

  it('does not persist a held momentary button or make its release consume more file space', () => {
    const w = workspaces();
    const start = w.sequence.components.find((c) => c.id === 'start')!;
    start.settings.buttonMode = 'momentary';
    const released = exportCircuitFile('sequence', w);
    start.settings.pressed = true;
    expect(exportCircuitFile('sequence', w)).toBe(released);
    expect(start.settings.pressed).toBe(true);
    start.settings.buttonMode = 'detent';
    const saved = JSON.parse(exportCircuitFile('sequence', w));
    expect(
      saved.workspaces.sequence.components.find((c: { id: string }) => c.id === 'start').settings
        .pressed,
    ).toBe(true);
  });
});
