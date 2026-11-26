import { describe, expect, it } from 'vitest';
import { componentAssets } from './assets';
import type { PercentPoint, PercentRect } from '../types/circuit';

describe('user-supplied PNG contract', () => {
  it('uses readable equipment descriptions, control names and polarity labels', () => {
    for (const asset of Object.values(componentAssets)) {
      expect(asset.model).not.toMatch(/[?\uFFFD]/);
      expect(asset.description).not.toMatch(/\.ts\b|[?\uFFFD]/);
      for (const item of [...asset.pins, ...asset.controls])
        expect(item.label).not.toMatch(/[?\uFFFD]/);
    }
    expect(componentAssets['pb-switch'].controls[0].label).toBe(
      '푸시버튼 누르기',
    );
    expect(
      componentAssets['pilot-lamp'].pins.find((p) => p.id === 'minus')!.label,
    ).toBe('−');
    expect(
      componentAssets['relay-socket'].pins.find((p) => p.id === '13')!.label,
    ).toContain('−');
    expect(
      componentAssets['timer-at8n'].pins.find((p) => p.id === '2')!.label,
    ).toContain('−');
  });
  it('loads the exact filenames directly under assets, without mode subfolders', () => {
    const expected = [
      'panel-board.png',
      'pilot-lamp.png',
      'pb-switch.png',
      'relay-socket.png',
      'relay-body.png',
      'RelayTimer.png',
      'timer-at8n.png',
      'screwdriver.png',
      'breadboard.png',
      'power-supply.png',
      'oscilloscope.png',
      'led-red.png',
      'resistor-330.png',
      'ic-14pin.png',
      'switch-3pin.png',
    ];
    const assets = Object.values(componentAssets);
    expect(assets.map((asset) => asset.fileName).sort()).toEqual(
      expected.sort(),
    );
    for (const asset of assets)
      expect(asset.src).toMatch(
        new RegExp(`/assets/${asset.fileName.replace('.', '\\.')}$`),
      );
  });
  it('keeps every terminal/control inside the shared percentage coordinate space', () => {
    const point = (p: PercentPoint) => {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    };
    const rect = (r: PercentRect) => {
      point(r);
      point({ x: r.x + r.width, y: r.y + r.height });
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
    };
    for (const asset of Object.values(componentAssets)) {
      expect(new Set(asset.pins.map((pin) => pin.id)).size).toBe(
        asset.pins.length,
      );
      asset.pins.forEach((pin) => point(pin.position));
      asset.controls.forEach((control) => rect(control.bounds));
      asset.overlays.forEach((overlay) => {
        if (overlay.kind === 'needle') point(overlay.center);
        else rect(overlay.bounds);
      });
    }
  });
  it('keeps five-hole strips joined while separating the center gap and rails', () => {
    const pins = componentAssets.breadboard.pins;
    const bus = (id: string) => pins.find((pin) => pin.id === id)?.bus;
    expect(bus('a1')).toBeDefined();
    expect(bus('a1')).toBe(bus('e1'));
    expect(bus('a1')).not.toBe(bus('f1'));
    expect(bus('a1')).not.toBe(bus('a2'));
    expect(bus('top-plus-1')).toBe(bus('top-plus-30'));
    expect(bus('top-plus-1')).not.toBe(bus('top-minus-1'));
    expect(bus('top-plus-1')).not.toBe(bus('bottom-plus-1'));
  });
});
