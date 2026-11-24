import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DeviceSvg } from './DeviceSvg';
import { deviceDefinitions } from './definitions';

describe('retained SVG device compatibility', () => {
  it('renders every legacy SVG device with its declared viewBox', () => {
    for (const definition of Object.values(deviceDefinitions)) {
      const html = renderToStaticMarkup(<DeviceSvg assetId={definition.id} />);
      expect(html).toContain(`viewBox="${definition.viewBox.join(' ')}"`);
      expect(html).not.toMatch(/NaN|undefined/);
    }
  });
});
