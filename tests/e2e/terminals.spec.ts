import { expect, type Page } from '@playwright/test';
import { test, downloadCircuit, uploadCircuit } from './support';

const terminal = (page: Page, component: string, pin: string) =>
  page.locator(
    `.react-flow__node[data-id="${component}"] .photo-pin[data-handleid="${pin}"]`,
  );

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('seats bare jumper tips at real breadboard holes in both directions and after zooming', async ({
  page,
}, testInfo) => {
  await page.getByRole('tab', { name: '디지털 회로', exact: true }).click();
  const saved = await downloadCircuit(page);
  // Include wires without a kind field, as found in older saved circuits.
  saved.workspaces.digital.wires = [
    {
      id: 'to-board',
      from: { componentId: 'dig-power', pinId: 'ch2-plus' },
      to: { componentId: 'dig-board', pinId: 'middle1-plus-63' },
      color: '#dc4c4c',
    },
    {
      id: 'from-board',
      from: { componentId: 'dig-board', pinId: 'middle1-minus-1' },
      to: { componentId: 'dig-power', pinId: 'ch2-minus' },
      color: '#303b48',
    },
  ];
  await uploadCircuit(page, saved);
  await expect(page.locator('.photo-board-toolbar')).toContainText('2 배선');
  const assertSeated = async () => {
    await expect(
      page.locator('.react-flow__edge rect, .react-flow__edge > g'),
    ).toHaveCount(0);
    for (const wire of saved.workspaces.digital.wires) {
      const curve = page.locator(
        `.react-flow__edge[data-id="${wire.id}"] .react-flow__edge-path`,
      );
      await expect(curve).toHaveCSS('stroke-linecap', 'round');
      const ends = await curve.evaluate((el) => {
        const path = el as SVGPathElement;
        return [0, path.getTotalLength()].map((length) => {
          const p = path
            .getPointAtLength(length)
            .matrixTransform(path.getScreenCTM()!);
          return { x: p.x, y: p.y };
        });
      });
      for (const [index, pin] of [wire.from, wire.to].entries()) {
        const rect = (await terminal(
          page,
          pin.componentId,
          pin.pinId,
        ).boundingBox())!;
        expect(Math.abs(ends[index].x - rect.x - rect.width / 2)).toBeLessThan(
          0.75,
        );
        expect(Math.abs(ends[index].y - rect.y - rect.height / 2)).toBeLessThan(
          0.75,
        );
      }
    }
    const board = (await page
      .locator('[data-id="dig-board"] .asset-interactions')
      .boundingBox())!;
    for (const [id, x, y] of [
      ['middle1-plus-63', 1243, 313.5],
      ['middle1-minus-1', 486, 300],
    ] as const) {
      const rect = (await terminal(page, 'dig-board', id).boundingBox())!;
      expect(
        Math.abs(rect.x + rect.width / 2 - board.x - (board.width * x) / 1448),
      ).toBeLessThan(0.75);
      expect(
        Math.abs(
          rect.y + rect.height / 2 - board.y - (board.height * y) / 1086,
        ),
      ).toBeLessThan(0.75);
    }
  };
  await terminal(page, 'dig-power', 'ch2-plus').hover();
  await assertSeated();
  await page.getByRole('button', { name: 'Zoom In', exact: true }).click();
  await terminal(page, 'dig-power', 'ch2-plus').hover();
  await assertSeated();
  await page
    .locator('.photo-board-shell')
    .screenshot({ path: testInfo.outputPath('inserted-jumpers.png') });
});

test('keeps terminal targets transparent in both modes, including hover and an active connection', async ({
  page,
}, testInfo) => {
  const assertTransparent = async () => {
    const rendered = await page.locator('.photo-pin').evaluateAll((pins) =>
      pins.map((pin) => {
        const s = getComputedStyle(pin);
        return {
          background: s.backgroundColor,
          border: s.borderTopWidth,
          shadow: s.boxShadow,
        };
      }),
    );
    expect(rendered.length).toBeGreaterThan(0);
    expect(
      rendered.every(
        (s) =>
          s.background === 'rgba(0, 0, 0, 0)' &&
          s.border === '0px' &&
          s.shadow === 'none',
      ),
    ).toBe(true);
  };
  await terminal(page, 'seq-pb', 'no1').hover();
  await assertTransparent();
  await terminal(page, 'seq-pb', 'no1').click();
  await assertTransparent();
  await page.keyboard.press('Escape');
  await page.mouse.move(0, 0);
  await page
    .locator('.photo-board-shell')
    .screenshot({ path: testInfo.outputPath('screw-terminals.png') });
  await page.getByRole('tab', { name: '디지털 회로', exact: true }).click();
  await terminal(page, 'dig-power', 'plus').hover();
  await assertTransparent();
  await page
    .getByRole('switch', { name: '핀 좌표 디버그 모드', exact: true })
    .click();
  await expect(terminal(page, 'dig-power', 'plus')).toHaveCSS(
    'pointer-events',
    'none',
  );
  await expect(terminal(page, 'dig-power', 'plus')).not.toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
});

test('clicks and drags directly on photographed PB, lamp and relay screws, including a branch', async ({
  page,
}) => {
  // Pixel centers read from the supplied 1134 × 1400 photographs, independently
  // of the app's pin definitions. Wait for layout stability before raw input.
  await terminal(page, 'seq-pb', 'no1').hover();
  const photoPoint = async (id: string, pixelX: number, pixelY: number) => {
    const rect = (await page
      .locator(`[data-id="${id}"] .asset-interactions`)
      .boundingBox())!;
    return {
      x: rect.x + (rect.width * pixelX) / 1134,
      y: rect.y + (rect.height * pixelY) / 1400,
    };
  };
  const clickPhoto = async (id: string, pixelX: number, pixelY: number) => {
    const p = await photoPoint(id, pixelX, pixelY);
    await page.mouse.click(p.x, p.y);
  };
  await clickPhoto('seq-pb', 402, 278);
  await clickPhoto('seq-lamp', 513, 273);
  await expect(page.locator('.photo-board-toolbar')).toContainText('1 배선');
  // Start another connection on a screw that already has a wire.
  await clickPhoto('seq-pb', 402, 278);
  await clickPhoto('seq-relay', 751, 298);
  await expect(page.locator('.photo-board-toolbar')).toContainText('2 배선');
  const from = await photoPoint('seq-relay', 754, 386);
  const to = await photoPoint('seq-lamp', 619, 273);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.photo-board-toolbar')).toContainText('3 배선');
  const wires = (await downloadCircuit(page)).workspaces.sequence.wires;
  expect(
    wires.map((w) => [
      w.from.componentId,
      w.from.pinId,
      w.to.componentId,
      w.to.pinId,
    ]),
  ).toEqual([
    ['seq-pb', 'no1', 'seq-lamp', 'plus'],
    ['seq-pb', 'no1', 'seq-relay', '1'],
    ['seq-relay', '5', 'seq-lamp', 'minus'],
  ]);
});

test('keeps virtual supply and rear timer socket usable without green pin circles', async ({
  page,
}) => {
  await expect(
    page.locator('[data-id="seq-timer"] .terminal-hardware'),
  ).toHaveCount(8);
  await expect(
    page.locator('[data-id="seq-timer"] .timer-socket-label'),
  ).toContainText('후면 소켓');
  await terminal(page, 'seq-board', 'plus').click();
  await terminal(page, 'seq-timer', '7').click();
  await terminal(page, 'seq-board', 'minus').click();
  await terminal(page, 'seq-timer', '2').click();
  await expect(page.locator('.photo-board-toolbar')).toContainText('2 배선');
  await page.getByRole('switch', { name: '메인 전원', exact: true }).click();
  await expect(
    page.locator('[data-id="seq-timer"] .timer-socket-label'),
  ).toContainText('/ 3.0 s');
  await expect(terminal(page, 'seq-timer', '7')).not.toHaveClass(
    /connectionindicator/,
  );
});

test('allows component controls beneath a crossing wire and still selects/deletes the wire away from controls', async ({
  page,
}) => {
  const saved = await downloadCircuit(page);
  saved.workspaces.sequence.wires = [
    {
      id: 'crossing',
      from: { componentId: 'seq-board', pinId: 'plus' },
      to: { componentId: 'seq-lamp', pinId: 'plus' },
      color: '#dc4c4c',
    },
  ];
  await uploadCircuit(page, saved);
  const edge = page.locator('.react-flow__edge-path');
  await expect(edge).toHaveCount(1);
  const middle = await edge.evaluate((el) => {
    const path = el as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() / 2);
    return { x: p.x, y: p.y };
  });
  // Align the real PB's pressable center underneath the actual wire curve.
  const pb = saved.workspaces.sequence.components.find(
    (c) => c.id === 'seq-pb',
  )!;
  pb.position = {
    x: middle.x - 80,
    y:
      middle.y -
      (200 - (160 * 1400) / 1134) / 2 -
      ((160 * 1400) / 1134) * 0.555,
  };
  await uploadCircuit(page, saved);
  const control = page.locator('[data-id="seq-pb"] .momentary-control');
  await control.click();
  await expect(page.locator('[data-id="seq-pb"]')).toHaveClass(/selected/);
  const freePoint = await edge.evaluate((el) => {
    const path = el as SVGPathElement;
    for (let fraction = 0.05; fraction < 0.95; fraction += 0.05) {
      const p = path
        .getPointAtLength(path.getTotalLength() * fraction)
        .matrixTransform(path.getScreenCTM()!);
      if (document.elementFromPoint(p.x, p.y)?.closest('.react-flow__edge'))
        return { x: p.x, y: p.y };
    }
    return null;
  });
  expect(freePoint).not.toBeNull();
  await page.mouse.click(freePoint!.x, freePoint!.y);
  await expect(page.locator('.react-flow__edge')).toHaveClass(/selected/);
  await page.mouse.click(freePoint!.x, freePoint!.y, { button: 'right' });
  await expect(page.locator('.photo-board-toolbar')).toContainText('0 배선');
});
