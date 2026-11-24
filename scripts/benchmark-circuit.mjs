import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: 'custom',
});
try {
  const { solveCircuit } = await server.ssrLoadModule(
    '/src/engine/circuitSolver.ts',
  );
  const { makeComponent } = await server.ssrLoadModule(
    '/src/features/workbench/data/photoCircuits.ts',
  );
  const components = Array.from({ length: 100 }, (_, i) =>
    makeComponent('breadboard', `board-${i}`, i * 750, 0),
  );
  const connectedWires = Array.from({ length: 2000 }, (_, i) => ({
    id: `wire-${i}`,
    from: {
      componentId: `board-${i % 100}`,
      pinId: `a${Math.floor(i / 100) + 1}`,
    },
    to: {
      componentId: `board-${(i + 1) % 100}`,
      pinId: `f${Math.floor(i / 100) + 1}`,
    },
    color: '#dc4c4c',
  }));
  for (const wires of [[], connectedWires]) {
    for (const compactBreadboards of [false, true]) {
      const times = [];
      let pins = 0;
      for (let run = 0; run < 5; run++) {
        const start = performance.now();
        const result = solveCircuit({
          mode: 'digital',
          components,
          wires,
          power: { on: true, voltage: 5 },
          compactBreadboards,
        });
        times.push(performance.now() - start);
        pins = Object.keys(result.pinValues).length;
      }
      times.sort((a, b) => a - b);
      console.log(
        JSON.stringify({
          mode: compactBreadboards ? 'runtime' : 'full-inspection',
          boards: components.length,
          wires: wires.length,
          medianMs: +times[2].toFixed(2),
          materializedPins: pins,
        }),
      );
    }
  }
} finally {
  await server.close();
}
