import { easySteps, locateParts, physicalAliases } from './easyGuide';
import { buildExercise } from './model';
import type { Exercise } from './model';

interface Terminal {
  id: string;
  label: string;
}

interface TerminalRow {
  id: string;
  label: string;
  terminals: Terminal[];
}

export interface WorkbenchDevice {
  id: string;
  kind: 'supply' | 'button' | 'relay' | 'timer' | 'lamp' | 'buzzer' | 'motor';
  rows: TerminalRow[];
  seconds?: number;
}

const terminalOrder = ['c', 'a', 'b'];

export function buildCompletedWorkbench(exercise: Exercise) {
  const corrected = !!exercise.correction;
  const circuit = buildExercise(exercise, corrected);
  const locations = locateParts(exercise.id, circuit);
  const aliases = physicalAliases(locations);
  const hiddenTerminals = new Set(aliases.map(([, alias]) => alias));
  const steps = easySteps(circuit, locations);
  const supply: WorkbenchDevice = {
    id: 'supply',
    kind: 'supply',
    rows: [{
      id: 'power',
      label: '전원 단자',
      terminals: [{ id: '24V', label: '+24V' }, { id: '0V', label: '0V' }],
    }],
  };
  const devices = new Map<string, WorkbenchDevice>();
  for (const part of circuit.parts) {
    if (part.kind === 'contact') continue;
    const motor = part.kind === 'motor';
    const labels = part.kind === 'relay' ? ['14 +', '13 −']
      : part.kind === 'timer' ? ['7 +', '2 −'] : motor ? ['왼쪽', '오른쪽'] : ['+', '−'];
    devices.set(part.id, {
      id: part.id,
      kind: part.kind,
      seconds: part.seconds,
      rows: [{
        id: 'load',
        label: part.kind === 'relay' ? '코일' : part.kind === 'timer' ? '전원 단자' : '부하 단자',
        terminals: labels.map((label, index) => ({ id: `${part.id}:${index + 1}`, label })),
      }],
    });
  }

  for (const part of circuit.parts) {
    if (part.kind !== 'contact') continue;
    const owner = part.owner!;
    let device = devices.get(owner);
    if (!device) {
      device = { id: owner, kind: 'button', rows: [] };
      devices.set(owner, device);
    }
    const location = locations[part.id];
    const rowId = location?.mark.kind === 'unknown' ? part.id : (location?.mark.id ?? part.id);
    const roles = location?.roles ?? ['c', part.nc ? 'b' : 'a'];
    const terminals = roles
      .map((label, index) => ({ id: `${part.id}:${index + 1}`, label }))
      .filter(({ id }) => !hiddenTerminals.has(id));
    if (!terminals.length) continue;
    const row = device.rows.find(({ id }) => id === rowId);
    if (row) {
      row.terminals.push(...terminals);
      row.terminals.sort((a, b) => terminalOrder.indexOf(a.label) - terminalOrder.indexOf(b.label));
    } else {
      const label = location ? `도면 ${location.mark.number}번` : '등가 접점';
      device.rows.push({
        id: rowId,
        label: device.kind === 'relay' ? '접점' : label,
        terminals,
      });
    }
  }

  const buttons = [...devices.values()].filter((device) => device.kind === 'button');
  buttons.sort((a, b) => a.id.localeCompare(b.id));
  const loads = [...devices.values()].filter((device) => device.kind !== 'button');
  const placed = [supply, ...buttons, ...loads];
  const deviceByTerminal = new Map(
    placed.flatMap((device) => device.rows.flatMap((row) =>
      row.terminals.map((terminal) => [terminal.id, device.id] as const),
    )),
  );

  return {
    corrected,
    circuit,
    devices: placed,
    buttons,
    deviceByTerminal,
    steps,
    // Shared printed terminals are electrically identical inside the device.
    leads: [...steps.map((step) => step.lead), ...aliases],
  };
}
