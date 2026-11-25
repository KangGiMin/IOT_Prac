import { expect, type Locator, type Page } from '@playwright/test';
import { test, downloadCircuit, uploadCircuit, selfHoldPreset, loadPopulatedWorkspace, selectCircuitNode } from './support';

const terminal = (page: Page, component: string, pin: string) =>
  page.locator(
    `.react-flow__node[data-id="${component}"] .photo-pin[data-handleid="${pin}"]`,
  );

// Native PNG measurements, independent of the application's percentage hotspots.
const photographedRims: [string, string, number, number, number, number][] = [
  ['seq-pb', 'no1', 403.5, 278.5, 38.5, 41.5],
  ['seq-pb', 'no2', 510.5, 277.5, 38.5, 41.5],
  ['seq-pb', 'nc1', 619.5, 276.5, 38.5, 41.5],
  ['seq-pb', 'nc2', 724.5, 278.5, 38.5, 41.5],
  ['seq-lamp', 'plus', 517.5, 274, 36, 41.5],
  ['seq-lamp', 'minus', 618, 275.5, 35.5, 40],
  ['seq-relay', '1', 750.5, 301.5, 29.5, 31],
  ['seq-relay', '2', 838.5, 301.5, 30.5, 33.5],
  ['seq-relay', '3', 921, 300.5, 32.5, 33.5],
  ['seq-relay', '4', 1005.5, 301, 32.5, 33.5],
  ['seq-relay', '5', 755, 386, 30, 28.5],
  ['seq-relay', '6', 840.5, 387, 29.5, 28.5],
  ['seq-relay', '7', 927.5, 386, 29.5, 28.5],
  ['seq-relay', '8', 1013.5, 387, 29.5, 28.5],
  ['seq-relay', '9', 755, 901.5, 29.5, 34.5],
  ['seq-relay', '10', 840, 902.5, 29.5, 32],
  ['seq-relay', '11', 925.5, 902.5, 29.5, 32],
  ['seq-relay', '12', 1011.5, 902.5, 29.5, 32],
  ['seq-relay', '13', 754, 793.5, 29.5, 30],
  ['seq-relay', '14', 1011, 793.5, 29.5, 29.5],
];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await loadPopulatedWorkspace(page);
});

test('sizes both Y terminals to each screw and joins cables at their crimps before and after zooming', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const saved = await downloadCircuit(page);
  const points = [
    ['seq-board', 'plus'], ...photographedRims.map(([node, pin]) => [node, pin]),
    ['seq-timer', '7'], ['seq-timer', '2'], ['seq-board', 'minus'],
  ];
  const connections = points.map(([node, pin], i) => [node, pin, ...points[(i + 1) % points.length]]);
  saved.workspaces.sequence.wires = connections.map(([a, ap, b, bp], index) => ({
    id: `fitted-${index}`, from: { componentId: a, pinId: ap },
    to: { componentId: b, pinId: bp }, color: '#dc4c4c',
  }));
  await uploadCircuit(page, saved);
  for (let zoom = 0; zoom < 2; zoom++) {
    if (zoom) await page.getByRole('button', { name: 'Zoom In', exact: true }).click();
    for (const wire of saved.workspaces.sequence.wires) {
      const edge = page.locator(`.react-flow__edge[data-id="${wire.id}"]`);
      for (const [index, ref] of [wire.from, wire.to].entries()) {
        const pin = terminal(page, ref.componentId, ref.pinId);
        await pin.hover();
        const end = edge.locator(`[data-terminal-end="${index ? 'target' : 'source'}"]`);
        const metrics = await end.evaluate(el => {
          const group = el as SVGGraphicsElement;
          const matrix = group.getScreenCTM()!;
          const center = new DOMPoint(0, 0).matrixTransform(matrix);
          const fork = group.querySelector('.sequence-fork') as SVGPathElement;
          const bounds = fork.getBBox();
          const metal = Number.parseFloat(getComputedStyle(fork).strokeWidth);
          return { x: center.x, y: center.y,
            radius: Number(group.getAttribute('data-screw-radius')) * Math.hypot(matrix.a, matrix.b),
            radiusY: Number(group.getAttribute('data-screw-radius-y')) * Math.hypot(matrix.c, matrix.d),
            innerX: (bounds.width / 2 - metal / 2) * Math.hypot(matrix.a, matrix.b),
            innerY: (bounds.y + bounds.height - metal / 2) * Math.hypot(matrix.c, matrix.d),
            openCenter: !fork.isPointInStroke(new DOMPoint(0, 0)),
            followsRim: !/[LV]/.test(fork.getAttribute('d')!),
            decorative: getComputedStyle(group).pointerEvents === 'none' };
        });
        const screw = (await pin.boundingBox())!;
        expect(Math.abs(metrics.x - screw.x - screw.width / 2)).toBeLessThan(0.75);
        expect(Math.abs(metrics.y - screw.y - screw.height / 2)).toBeLessThan(0.75);
        expect(metrics.openCenter).toBe(true);
        expect(metrics.followsRim).toBe(true);
        expect(metrics.decorative).toBe(true);
        const photo = (await page.locator(`[data-id="${ref.componentId}"] .asset-interactions`).boundingBox())!;
        const head = pin.locator('.terminal-screw');
        const rim = photographedRims.find(([node, pin]) => node === ref.componentId && pin === ref.pinId);
        if (rim) {
          const [, , x, y, rx, ry] = rim;
          expect(Math.abs(metrics.x - photo.x - photo.width * x / 1122)).toBeLessThan(0.75);
          expect(Math.abs(metrics.y - photo.y - photo.height * y / 1402)).toBeLessThan(0.75);
          expect(Math.abs(metrics.radius - photo.width * rx / 1122)).toBeLessThan(0.75);
          expect(Math.abs(metrics.radiusY - photo.height * ry / 1402)).toBeLessThan(0.75);
          expect(Math.abs(metrics.innerX - photo.width * rx / 1122)).toBeLessThan(0.75);
          expect(Math.abs(metrics.innerY - photo.height * ry / 1402)).toBeLessThan(0.75);
        } else {
          expect(Math.abs(metrics.radius - (await head.boundingBox())!.width / 2)).toBeLessThan(0.75);
        }
        const cablePoint = await edge.locator('.react-flow__edge-path').evaluate((el, first) => {
          const path = el as SVGPathElement;
          const point = path.getPointAtLength(first ? 0 : path.getTotalLength()).matrixTransform(path.getScreenCTM()!);
          return { x: point.x, y: point.y };
        }, index === 0);
        const crimp = (await end.locator('.sequence-wire-crimp').boundingBox())!;
        expect(cablePoint.x).toBeGreaterThanOrEqual(crimp.x - 0.5);
        expect(cablePoint.x).toBeLessThanOrEqual(crimp.x + crimp.width + 0.5);
        expect(cablePoint.y).toBeGreaterThanOrEqual(crimp.y - 0.5);
        expect(cablePoint.y).toBeLessThanOrEqual(crimp.y + crimp.height + 0.5);
      }
    }
  }
  // Inspect a normal, unpowered circuit without fault highlights or dense wiring.
  saved.workspaces.sequence.wires = [
    { id: 'preview-a', from: { componentId: 'seq-board', pinId: 'plus' }, to: { componentId: 'seq-pb', pinId: 'nc1' }, color: '#dc4c4c' },
    { id: 'preview-b', from: { componentId: 'seq-pb', pinId: 'nc1' }, to: { componentId: 'seq-relay', pinId: '8' }, color: '#dc4c4c' },
    { id: 'preview-c', from: { componentId: 'seq-board', pinId: 'minus' }, to: { componentId: 'seq-relay', pinId: '12' }, color: '#3780d5' },
  ];
  await uploadCircuit(page, saved);
  await page.getByRole('button', { name: '전체 보기', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom In', exact: true }).click();
  await terminal(page, 'seq-pb', 'nc1').hover();
  await page.locator('.photo-board-shell').screenshot({ path: testInfo.outputPath('fitted-y-terminals.png') });
  await page.locator('[data-id="seq-relay"]').screenshot({ path: testInfo.outputPath('fitted-relay.png') });
});

test('fits the mounted relay inside the slot and leaves all fourteen screws clickable after zooming', async ({ page }, testInfo) => {
  await selfHoldPreset(page);
  const body = page.locator('[data-id="body"] .photo-node');
  await expect(body.locator('.asset-photo')).toBeVisible();
  await expect(body).toHaveCSS('transform', 'none');
  const pins = page.locator('[data-id="relay"] .photo-pin');
  await expect(pins).toHaveCount(14);
  for (let zoom = 0; zoom < 2; zoom++) {
    if (zoom) await page.getByRole('button', { name: 'Zoom In', exact: true }).click();
    for (const pin of await pins.all()) {
      await pin.scrollIntoViewIfNeeded();
      const hit = await pin.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return el === target || el.contains(target);
      });
      expect(hit, await pin.getAttribute('aria-label') ?? 'relay screw').toBe(true);
      const screw = (await pin.boundingBox())!;
      const mounted = (await body.boundingBox())!;
      const x = screw.x + screw.width / 2, y = screw.y + screw.height / 2;
      expect(x > mounted.x && x < mounted.x + mounted.width && y > mounted.y && y < mounted.y + mounted.height).toBe(false);
    }
  }
  await page.locator('.photo-board-shell').screenshot({ path: testInfo.outputPath('relay-screws-visible.png') });
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
        const tip = page.locator(`.react-flow__edge[data-id="${wire.id}"] .jumper-inserted-tip[data-end="${index === 0 ? 'source' : 'target'}"]`);
        const end = pin.componentId === 'dig-board' ? await tip.evaluate((element) => {
          const path = element as SVGPathElement;
          const point = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM()!);
          return { x: point.x, y: point.y };
        }) : ends[index];
        const rect = (await terminal(
          page,
          pin.componentId,
          pin.pinId,
        ).boundingBox())!;
        expect(Math.abs(end.x - rect.x - rect.width / 2)).toBeLessThan(
          0.75,
        );
        expect(Math.abs(end.y - rect.y - rect.height / 2)).toBeLessThan(
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

async function expectPluggedTips(
  part: Locator,
  board: Locator,
  reference: { holes: number[]; y: number; photoSize: number[]; tips: number[][] },
) {
  const photo = part.locator('.plugged-part-photo > img');
  const image = (await board.boundingBox())!;
  const positions = await photo.evaluate((element, { tips, photoSize }) => {
    const box = element.parentElement!.getBoundingClientRect();
    const style = getComputedStyle(element);
    const width = parseFloat(style.width), height = parseFloat(style.height);
    const matrix = new DOMMatrix(style.transform);
    return tips.map(([x, y]) => {
      const point = new DOMPoint(x / photoSize[0] * width, y / photoSize[1] * height).matrixTransform(matrix);
      return { x: box.left + point.x * box.width / width, y: box.top + point.y * box.width / width };
    });
  }, reference);
  positions.forEach((tip, index) => {
    expect(Math.abs(tip.x - image.x - image.width * reference.holes[index] / 1448)).toBeLessThan(0.8);
    expect(Math.abs(tip.y - image.y - image.height * reference.y / 1086)).toBeLessThan(0.8);
  });
}

test('plugs a dragged resistor, 3-pin slide switch and LED into exact signal holes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 2000 });
  const saved = await downloadCircuit(page);
  saved.activeMode = 'digital';
  const supply = saved.workspaces.digital.components.find((component) => component.assetId === 'power-supply')!;
  saved.workspaces.digital.components = saved.workspaces.digital.components.filter((component) => component.assetId === 'breadboard');
  await uploadCircuit(page, saved);
  const board = page.locator('[data-id="dig-board"] .asset-interactions');
  const layout = [
    { asset: 'resistor-330', name: '저항 330Ω 추가', group: 0, row: 'e', column: 11, holes: [589, 640.5], y: 170, photoSize: [1122, 1402], tips: [[99, 1278], [1027, 1178]] },
    { asset: 'switch-3pin', name: '슬라이드 스위치 추가', group: 1, row: 'g', column: 23, holes: [745, 757, 770], y: 455, photoSize: [1122, 1402], tips: [[414, 1244], [576, 1244], [738, 1244]] },
    { asset: 'led-red', name: '적색 LED 추가', group: 2, row: 'd', column: 31, holes: [848, 861], y: 621, photoSize: [1086, 1448], tips: [[419, 1330], [658, 1299]] },
  ];
  for (const placement of layout) {
    const { name, holes, y, asset } = placement;
    await page.getByRole('textbox', { name: '부품 검색', exact: true }).fill(name.replace(' 추가', ''));
    const image = (await board.boundingBox())!;
    await page.getByRole('button', { name, exact: true }).dragTo(board, { targetPosition: {
      x: image.width * (holes[0] + holes.at(-1)!) / (2 * 1448),
      y: image.height * y / 1086,
    } });
    await expect(page.locator(`[data-asset="${asset}"]`)).toHaveAttribute('data-plugged', 'true');
  }
  const result = await downloadCircuit(page);
  for (const placement of layout) {
    const { asset, group, row, column } = placement;
    const component = result.workspaces.digital.components.find((c) => c.assetId === asset)!;
    expect(component.insertion).toEqual({ boardId: 'dig-board', bank: group, column, row });
    await expectPluggedTips(page.locator(`[data-asset="${asset}"]`), board, placement);
  }
  const digital = result.workspaces.digital;
  digital.components.push(supply);
  const jumper = (id: string, fromPin: string, toPin: string) => ({
    id,
    from: { componentId: fromPin === 'plus' || fromPin === 'minus' ? 'dig-power' : 'dig-board', pinId: fromPin },
    to: { componentId: 'dig-board', pinId: toPin },
    color: '#dc4c4c',
  });
  digital.wires = [jumper('led-supply', 'plus', 'a11'), jumper('led-series', 'a15', 'bank3-a31'), jumper('led-ground', 'minus', 'bank3-a32')];
  await uploadCircuit(page, result);
  await expect(page.locator('[data-plugged="true"]')).toHaveCount(3);
  const toggle = page.locator('[data-asset="switch-3pin"]').getByRole('button', { name: '슬라이드 스위치', exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  const glow = page.locator('[data-asset="led-red"] .light-overlay.led');
  const power = page.getByRole('switch', { name: '메인 전원', exact: true });
  await expect(glow).toHaveCSS('opacity', '0');
  await power.click();
  await expect(glow).toHaveCSS('opacity', '0.9');

  digital.wires = [jumper('led-supply', 'plus', 'a11'), jumper('led-series', 'a15', 'bank3-a32'), jumper('led-ground', 'minus', 'bank3-a31')];
  await uploadCircuit(page, result);
  await expect(power).toHaveAttribute('aria-checked', 'false');
  await power.click();
  await expect(glow).toHaveCSS('opacity', '0');
});

test('seats both resistor leads when dragging its body onto the last row and across a board gap', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 2000 });
  const saved = await downloadCircuit(page);
  const digital = saved.workspaces.digital;
  saved.activeMode = 'digital';
  digital.components = digital.components.filter(({ id }) => id === 'dig-board' || id === 'dig-resistor');
  const resistor = digital.components.find(({ id }) => id === 'dig-resistor')!;
  resistor.position = { x: 155, y: 215 };
  await uploadCircuit(page, saved);

  const board = page.locator('[data-id="dig-board"] .asset-interactions');
  const part = page.locator('[data-asset="resistor-330"]');
  await page.locator('.react-flow__controls-fitview').click();
  await expect(part).toHaveAttribute('data-plugged', 'false');

  const dragBodyTo = async (y: number) => {
    const body = (await part.boundingBox())!;
    const image = (await board.boundingBox())!;
    await page.mouse.move(body.x + body.width * 0.44, body.y + body.height * 0.14);
    await page.mouse.down();
    await page.mouse.move(image.x + image.width * 731 / 1448, image.y + image.height * y / 1086, { steps: 15 });
    await page.mouse.up();
  };
  const verify = async (bank: number, y: number, holes: number[]) => {
    await expect(part).toHaveAttribute('data-plugged', 'true');
    const actual = (await downloadCircuit(page)).workspaces.digital.components.find(({ id }) => id === resistor.id)!;
    expect(actual.insertion).toEqual({ boardId: 'dig-board', bank, column: 20, row: 'j' });
    await expectPluggedTips(part, board, { holes, y, photoSize: [1122, 1402], tips: [[99, 1278], [1027, 1178]] });
  };

  await dragBodyTo(954.5);
  await verify(3, 954.5, [705, 756.5]);
  await dragBodyTo(534);
  await verify(1, 493, [706, 757]);
});

test('drags a jumper between two breadboard holes and seats both tips', async ({ page }) => {
  await page.getByRole('tab', { name: '디지털 회로', exact: true }).click();
  await selectCircuitNode(page, 'dig-board');
  const from = terminal(page, 'dig-board', 'a10');
  const to = terminal(page, 'dig-board', 'd19');
  await from.dragTo(to);
  await expect(page.locator('.jumper-inserted-tip')).toHaveCount(2);
  const { wires } = (await downloadCircuit(page)).workspaces.digital;
  expect(wires).toMatchObject([{ from: { componentId: 'dig-board', pinId: 'a10' }, to: { componentId: 'dig-board', pinId: 'd19' }, kind: 'jumper' }]);
  for (const [direction, hole] of [['source', from], ['target', to]] as const) {
    const rect = (await hole.boundingBox())!;
    const endpoint = await page.locator(`.jumper-inserted-tip[data-end="${direction}"]`).evaluate((element) => {
      const path = element as SVGPathElement;
      const p = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM()!);
      return { x: p.x, y: p.y };
    });
    expect(Math.abs(endpoint.x - rect.x - rect.width / 2)).toBeLessThan(0.75);
    expect(Math.abs(endpoint.y - rect.y - rect.height / 2)).toBeLessThan(0.75);
  }
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

test('lists each sequence lead and flags the wires involved in a PB-triggered short', async ({ page }) => {
  const log = page.getByRole('region', { name: '배선 로그', exact: true });
  await terminal(page, 'seq-board', 'plus').click();
  await terminal(page, 'seq-pb', 'no1').click();
  await expect(log.getByRole('listitem')).toHaveCount(1);
  await terminal(page, 'seq-pb', 'no2').click();
  await terminal(page, 'seq-board', 'minus').click();
  await expect(log.getByRole('listitem')).toHaveCount(2);

  const latest = log.getByRole('button', { name: /2번 배선/ });
  await expect(log.getByRole('button').first()).toBeVisible();
  await expect(log.getByRole('button').first()).toHaveText(/2번 배선/);
  await expect(latest).toContainText('seq-pb · NO 2');
  await expect(latest).toContainText('seq-board · 0V (실습 전원)');
  await latest.click();
  await expect(latest).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.react-flow__edge.selected .wire-terminal-highlight')).toHaveCount(2);

  const power = page.getByRole('switch', { name: '메인 전원', exact: true });
  await power.click();
  await expect(log.getByText('오류 관련', { exact: true })).toHaveCount(0);
  const pb = page.locator('[data-id="seq-pb"] .momentary-control');
  await pb.focus();
  await page.keyboard.down('Space');
  await expect(log.getByText('오류 관련', { exact: true })).toHaveCount(2);
  await page.keyboard.up('Space');
  await expect(log.getByText('오류 관련', { exact: true })).toHaveCount(0);
  await expect(log.getByText('최근 오류 관련', { exact: true })).toHaveCount(2);
  await expect(log.getByRole('listitem')).toHaveCount(2);
  await latest.click();
  await expect(page.locator('.react-flow__edge.selected .wire-terminal-highlight')).toHaveCount(2);

  await power.click();
  await page.getByRole('button', { name: '배선 삭제', exact: true }).click();
  await expect(log.getByRole('listitem')).toHaveCount(1);
  await expect(log.getByRole('button').first()).toHaveText(/1번 배선/);
  await expect(log.getByText('최근 오류 관련', { exact: true })).toHaveCount(0);
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
