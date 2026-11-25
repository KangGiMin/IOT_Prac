import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from './usePhotoCircuitStore';
import { createPhotoWorkspace } from '../features/workbench/data/photoCircuits';
import { gradeLogicMission } from '../engine/missionGrader';
import { logicMissions } from '../features/workbench/data/logicMissions';

beforeEach(() => {
  useCircuitStore.setState({
    mode: 'digital', calibration: false, selectedId: null, selectedWireId: null,
    sample: null, dragHistory: null,
    histories: { sequence: { past: [], future: [] }, digital: { past: [], future: [] } },
    workspaces: { sequence: createPhotoWorkspace('sequence'), digital: createPhotoWorkspace('digital') },
  });
  useCircuitStore.getState().loadPreset('nor');
});

describe('live 7402 NOR preset', () => {
  it.each([
    [false, false, 1], [false, true, 0], [true, false, 0], [true, true, 0],
  ] as const)('switches A=%s B=%s produce LED/probe Y=%s', (a, b, expected) => {
    const s = useCircuitStore.getState();
    expect(s.workspaces.digital.power.on).toBe(false);
    expect(s.workspaces.digital.components.find(c => c.id === 'ic')?.settings.icModel).toBe('7402');
    s.togglePower();
    s.updateSettings('input-a', { switchOn: a });
    s.updateSettings('input-b', { switchOn: b });
    const simulation = useCircuitStore.getState().workspaces.digital.simulation;
    expect(simulation.faults).toEqual([]);
    expect(simulation.isShorted).toBe(false);
    expect(simulation.pinValues['ic:1'].logic).toBe(expected);
    expect(simulation.pinValues['scope:ch2'].logic).toBe(expected);
    expect(simulation.energizedComponents.includes('output-led')).toBe(Boolean(expected));
    if (expected) expect(simulation.componentCurrents?.['output-led']).toBeGreaterThan(0);
    s.togglePower();
    expect(useCircuitStore.getState().workspaces.digital.simulation.energizedComponents).not.toContain('output-led');
  });

  it('grades all four rows without changing the powered live switches or wiring', () => {
    const s = useCircuitStore.getState();
    s.togglePower();
    s.updateSettings('input-a', { switchOn: true });
    const w = useCircuitStore.getState().workspaces.digital;
    const before = JSON.stringify(w);
    const result = gradeLogicMission(w, logicMissions.find(m => m.id === 'NOR')!, {
      a: 'input-a', b: 'input-b', led: 'output-led',
    });
    expect(result.score).toBe(100);
    expect(result.rows.map(row => row.actual)).toEqual([1, 0, 0, 0]);
    expect(result.hints).toEqual([]);
    expect(JSON.stringify(useCircuitStore.getState().workspaces.digital)).toBe(before);
  });
});
