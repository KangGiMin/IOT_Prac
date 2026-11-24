import { describe, expect, it } from 'vitest';
import { pinTooltip } from './pinTooltip';
import { IC_MODELS } from './ttlModels';
import { pinsFor } from './digitalPins';
import { makeComponent } from '../features/workbench/data/photoCircuits';
describe('pin tooltips', () => {
  it.each(IC_MODELS)(
    'labels VCC, GND and every functional pin for %s',
    (model) => {
      const c = makeComponent('ic-dip14', 'ic', 0, 0);
      c.settings.icModel = model;
      const pins = pinsFor(c);
      expect(
        pinTooltip(
          c,
          pins.find((p) => p.id === '14')!,
        ),
      ).toBe('Pin 14: VCC (+5V)');
      expect(
        pinTooltip(
          c,
          pins.find((p) => p.id === '7')!,
        ),
      ).toBe('Pin 7: GND (0V)');
      for (const p of pins)
        expect(pinTooltip(c, p)).not.toMatch(/undefined|Gate 0/);
      if (model === '7411')
        expect(
          pinTooltip(
            c,
            pins.find((p) => p.id === '13')!,
          ),
        ).toContain('C (INPUT)');
      if (model === '7402')
        expect(
          pinTooltip(
            c,
            pins.find((p) => p.id === '1')!,
          ),
        ).toContain('Y (OUTPUT)');
    },
  );
});
