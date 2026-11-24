import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from './usePhotoCircuitStore';
import { capacityWorkspace } from '../test/circuitFixtures';
import { createPhotoWorkspace } from '../features/workbench/data/photoCircuits';
import {
  circuitCapacityIssue,
  exportCircuitFile,
  importCircuitFile,
  MAX_CIRCUIT_COMPONENTS,
  MAX_CIRCUIT_WIRES,
} from '../engine/circuitFile';

beforeEach(() =>
  useCircuitStore.setState({
    mode: 'sequence',
    calibration: false,
    selectedId: null,
    selectedWireId: null,
    dragHistory: null,
    histories: {
      sequence: { past: [], future: [] },
      digital: { past: [], future: [] },
    },
    workspaces: {
      sequence: createPhotoWorkspace('sequence'),
      digital: createPhotoWorkspace('digital'),
    },
  }),
);

describe('editable circuit capacity', () => {
  it('allows the last component, rejects the next without losing history, and saves a reloadable circuit', () => {
    const w = capacityWorkspace('sequence', 0);
    w.components.pop();
    useCircuitStore.setState((s) => ({
      workspaces: { ...s.workspaces, sequence: w },
    }));
    const s = useCircuitStore.getState();
    s.addComponent('pilot-lamp');
    expect(
      useCircuitStore.getState().workspaces.sequence.components,
    ).toHaveLength(MAX_CIRCUIT_COMPONENTS);
    const before = useCircuitStore.getState();
    s.addComponent('pilot-lamp');
    const after = useCircuitStore.getState();
    expect(after.workspaces).toBe(before.workspaces);
    expect(after.histories).toBe(before.histories);
    expect(after.notice).toContain('100');
    expect(
      importCircuitFile(exportCircuitFile(s.mode, after.workspaces)).workspaces
        .sequence.components,
    ).toHaveLength(MAX_CIRCUIT_COMPONENTS);
    s.undo();
    expect(
      useCircuitStore.getState().workspaces.sequence.components,
    ).toHaveLength(MAX_CIRCUIT_COMPONENTS - 1);
  });

  it('allows the last wire and refuses the next without changing the circuit or undo history', () => {
    const w = capacityWorkspace('sequence', MAX_CIRCUIT_WIRES + 1);
    const overflow = w.wires.pop()!,
      last = w.wires.pop()!;
    useCircuitStore.setState((s) => ({
      workspaces: { ...s.workspaces, sequence: w },
    }));
    const s = useCircuitStore.getState();
    s.connect(last.from, last.to);
    expect(useCircuitStore.getState().workspaces.sequence.wires).toHaveLength(
      MAX_CIRCUIT_WIRES,
    );
    const before = useCircuitStore.getState();
    s.connect(overflow.from, overflow.to);
    expect(useCircuitStore.getState().workspaces).toBe(before.workspaces);
    expect(useCircuitStore.getState().histories).toBe(before.histories);
    expect(useCircuitStore.getState().notice).toContain('2000');
    expect(
      importCircuitFile(exportCircuitFile('sequence', before.workspaces))
        .workspaces.sequence.wires,
    ).toHaveLength(MAX_CIRCUIT_WIRES);
  });

  it('rejects an edit that exceeds the combined UTF-8 file budget even below the wire limit', () => {
    const sequence = capacityWorkspace('sequence', MAX_CIRCUIT_WIRES, 80, 36);
    const digital = capacityWorkspace('digital', MAX_CIRCUIT_WIRES, 80, 36);
    const candidates = digital.wires;
    let low = 0,
      high = candidates.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (
        circuitCapacityIssue({
          sequence,
          digital: { ...digital, wires: candidates.slice(0, mid) },
        })
      )
        high = mid - 1;
      else low = mid;
    }
    const upcoming = candidates[low];
    expect(upcoming).toBeDefined();
    const nearLimit = { ...digital, wires: candidates.slice(0, low) };
    useCircuitStore.setState({
      mode: 'digital',
      workspaces: { sequence, digital: nearLimit },
    });
    const before = useCircuitStore.getState();
    const remaining = exportCircuitFile('digital', before.workspaces);
    expect(importCircuitFile(remaining).workspaces.digital.wires).toHaveLength(
      low,
    );
    useCircuitStore.getState().connect(upcoming.from, upcoming.to);
    expect(useCircuitStore.getState().workspaces).toBe(before.workspaces);
    expect(useCircuitStore.getState().histories).toBe(before.histories);
    expect(useCircuitStore.getState().notice).toContain('1MB');
  });
});
