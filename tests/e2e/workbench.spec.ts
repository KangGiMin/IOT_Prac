import { expect } from '@playwright/test';
import {
  test,
  downloadCircuit,
  uploadCircuit,
  nandPreset,
  selfHoldPreset,
  openWiring,
  selectCircuitNode,
} from './support';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('link', { name: '키보드 배선으로 이동', exact: true }),
  ).toBeAttached();
});

test('connects and undoes/redoes a wire using only the keyboard', async ({
  page,
}) => {
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: '실습 영역으로 이동', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: '키보드 배선으로 이동', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#keyboard-wiring')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByText('단자 선택으로 배선', { exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('출발 부품', { exact: true })).toBeVisible();
  const fields = [
    { label: '출발 부품', steps: 1, value: 'seq-board' },
    { label: '출발 단자', steps: 1, value: 'plus' },
    { label: '도착 부품', steps: 4, value: 'seq-lamp' },
    { label: '도착 단자', steps: 1, value: 'plus' },
  ];
  for (const field of fields) {
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(field.label, { exact: true })).toBeFocused();
    await page.keyboard.press('Home');
    for (let i = 0; i < field.steps; i++)
      await page.keyboard.press('ArrowDown');
    await expect(page.getByLabel(field.label, { exact: true })).toHaveValue(
      field.value,
    );
  }
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: '배선 연결', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.photo-board-toolbar')).toContainText('1 배선');
  await expect(
    page.getByRole('status', { name: '키보드 배선 상태' }),
  ).toHaveText('선택한 두 단자는 연결되어 있습니다.');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.photo-board-toolbar')).toContainText('0 배선');
  await page.keyboard.press('ControlOrMeta+y');
  await expect(page.locator('.photo-board-toolbar')).toContainText('1 배선');
});

test('prevents self-connections, duplicates and wiring while power/calibration/wiring locks apply', async ({
  page,
}) => {
  await openWiring(page);
  await page.getByLabel('출발 부품', { exact: true }).selectOption('seq-board');
  await page.getByLabel('출발 단자', { exact: true }).selectOption('plus');
  await page.getByLabel('도착 부품', { exact: true }).selectOption('seq-board');
  await page.getByLabel('도착 단자', { exact: true }).selectOption('plus');
  await expect(
    page.getByRole('button', { name: '배선 연결', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('status', { name: '키보드 배선 상태' }),
  ).toContainText('같은 단자');
  await page.getByLabel('도착 단자', { exact: true }).selectOption('minus');
  await page.getByRole('button', { name: '배선 연결', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '배선 연결', exact: true }),
  ).toBeDisabled();
  await expect(page.locator('.photo-board-toolbar')).toContainText('1 배선');
  await page.getByRole('switch', { name: '메인 전원', exact: true }).click();
  await expect(page.getByLabel('출발 부품', { exact: true })).toBeDisabled();
  await page.getByRole('switch', { name: '메인 전원', exact: true }).click();
  await page
    .getByRole('switch', { name: '핀 좌표 디버그 모드', exact: true })
    .click();
  await expect(page.getByLabel('출발 부품', { exact: true })).toBeDisabled();
  await page
    .getByRole('switch', { name: '핀 좌표 디버그 모드', exact: true })
    .click();
  await page.getByRole('button', { name: '배선 모드 ON', exact: true }).click();
  await expect(page.getByLabel('출발 부품', { exact: true })).toBeDisabled();
  await expect(page.locator('.photo-board-toolbar')).toContainText('1 배선');
});

test('wires an unrendered breadboard hole and resets terminal choices across modes', async ({
  page,
}) => {
  await page.getByRole('tab', { name: '디지털 회로', exact: true }).click();
  const hole = page.locator(
    '[data-id="dig-board"] .photo-pin[data-handleid="bank4-j63"]',
  );
  await expect(hole).toHaveCount(0);
  await openWiring(page);
  await page.getByLabel('출발 부품', { exact: true }).selectOption('dig-board');
  await page.getByLabel('출발 단자', { exact: true }).selectOption('bank4-j63');
  await page.getByLabel('도착 부품', { exact: true }).selectOption('dig-led');
  await page.getByLabel('도착 단자', { exact: true }).selectOption('anode');
  await page.getByRole('button', { name: '배선 연결', exact: true }).click();
  await expect(page.locator('.photo-board-toolbar')).toContainText('1 배선');
  await expect(hole).toHaveCount(1);
  const wires = (await downloadCircuit(page)).workspaces.digital.wires;
  expect(wires).toHaveLength(1);
  expect(wires[0]).toMatchObject({
    from: { componentId: 'dig-board', pinId: 'bank4-j63' },
    to: { componentId: 'dig-led', pinId: 'anode' },
  });
  await page.getByRole('tab', { name: '시퀀스 제어', exact: true }).click();
  await openWiring(page);
  await expect(page.getByLabel('출발 부품', { exact: true })).toHaveValue('');
  await page.getByRole('tab', { name: '디지털 회로', exact: true }).click();
  await openWiring(page);
  await expect(page.getByLabel('출발 부품', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('출발 단자', { exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '배선 연결', exact: true }),
  ).toBeDisabled();
  await expect(page.locator('.photo-board-toolbar')).toContainText('1 배선');
});

test('keyboard movement detaches an inserted IC and history restores it', async ({
  page,
}) => {
  await nandPreset(page);
  const before = (
    await downloadCircuit(page)
  ).workspaces.digital.components.find((c) => c.id === 'ic')!;
  expect(before.insertion).toBeDefined();
  await selectCircuitNode(page, 'ic');
  await page.keyboard.down('Shift');
  for (let i = 0; i < 30; i++) await page.keyboard.down('ArrowRight');
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('Shift');
  const moved = (
    await downloadCircuit(page)
  ).workspaces.digital.components.find((c) => c.id === 'ic')!;
  expect(moved.insertion).toBeUndefined();
  expect(moved.displaySize).toBeUndefined();
  await page.keyboard.press('ControlOrMeta+z');
  const restored = (
    await downloadCircuit(page)
  ).workspaces.digital.components.find((c) => c.id === 'ic')!;
  expect(restored).toEqual(before);
  await page.keyboard.press('ControlOrMeta+y');
  expect(
    (await downloadCircuit(page)).workspaces.digital.components.find(
      (c) => c.id === 'ic',
    ),
  ).toEqual(moved);
});

test('releases a held momentary button when changing tabs before pointer-up', async ({
  page,
}) => {
  await selfHoldPreset(page);
  const button = page.locator('[data-id="start"] .momentary-control');
  await button.scrollIntoViewIfNeeded();
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: '디지털 회로', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.mouse.up();
  await page.getByRole('tab', { name: '시퀀스 제어', exact: true }).click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('commits an interrupted pointer drag and keeps undo/redo available across tabs', async ({
  page,
}) => {
  await selfHoldPreset(page);
  const node = page.locator('.react-flow__node[data-id="start"]');
  await node.scrollIntoViewIfNeeded();
  const before = await node.getAttribute('style');
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + box.height - 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y + box.height - 20, { steps: 8 });
  await page.getByRole('tab', { name: '디지털 회로', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.mouse.up();
  await page.getByRole('tab', { name: '시퀀스 제어', exact: true }).click();
  await expect(page.getByRole('button', { name: /실행 취소/ })).toBeEnabled();
  const moved = await node.getAttribute('style');
  expect(moved).not.toBe(before);
  await page.getByRole('button', { name: /실행 취소/ }).click();
  await expect(node).toHaveAttribute('style', before!);
  await page.getByRole('button', { name: /다시 실행/ }).click();
  await expect(node).toHaveAttribute('style', moved!);
});

test('downloads a circuit and restores it through the actual file input', async ({
  page,
}) => {
  await nandPreset(page);
  const saved = await downloadCircuit(page);
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(page.locator('.photo-board-toolbar')).toContainText('0 배선');
  await uploadCircuit(page, saved);
  await expect(page.locator('.photo-board-toolbar')).toContainText('16 배선');
  expect((await downloadCircuit(page)).workspaces.digital).toEqual(
    saved.workspaces.digital,
  );
  await page.getByRole('switch', { name: '메인 전원', exact: true }).click();
  await expect(page.locator('[data-id="output-led"] .light-overlay')).toHaveCSS(
    'opacity',
    '0.9',
  );
});

test('supports prototype-named IDs through file loading and live rendering', async ({
  page,
}) => {
  await nandPreset(page);
  const data = await downloadCircuit(page);
  data.workspaces.digital.components.find((c) => c.id === 'output-led')!.id =
    '__proto__';
  for (const wire of data.workspaces.digital.wires)
    for (const pin of [wire.from, wire.to])
      if (pin.componentId === 'output-led') pin.componentId = '__proto__';
  data.workspaces.sequence.components.push({
    id: 'constructor',
    assetId: 'timer-at8n',
    label: 'Timer',
    position: { x: 0, y: 0 },
    settings: { pressed: false, switchOn: false, voltage: 5, timerSeconds: 3 },
  });
  await uploadCircuit(page, data);
  await page.getByRole('switch', { name: '메인 전원', exact: true }).click();
  await expect(page.locator('[data-id="__proto__"] .light-overlay')).toHaveCSS(
    'opacity',
    '0.9',
  );
  await page.getByRole('tab', { name: '시퀀스 제어', exact: true }).click();
  await page.getByRole('switch', { name: '메인 전원', exact: true }).click();
  await expect(
    page.locator('[data-id="constructor"] .timer-socket-label'),
  ).toHaveText('후면 소켓 · POWER OFF');
});

test('updates inspector descriptions and model names for all six TTL models', async ({
  page,
}) => {
  await nandPreset(page);
  await selectCircuitNode(page, 'ic');
  for (const [model, name, outputs] of [
    ['7400', 'NAND', '3·6·8·11'],
    ['7402', 'NOR', '1·4·10·13'],
    ['7406', 'NOT', '2·4·6·8·10·12'],
    ['7408', 'AND', '3·6·8·11'],
    ['7411', '3-INPUT AND', '12·6·8'],
    ['7486', 'XOR', '3·6·8·11'],
  ]) {
    await page.getByLabel('TTL IC 모델', { exact: true }).selectOption(model);
    await expect(page.locator('.selected-description')).toContainText(outputs);
    await expect(page.locator('.selected-component > span')).toHaveText(
      `${model} · ${name} · DIP-14`,
    );
    if (model !== '7400')
      await expect(page.locator('.selected-description')).not.toContainText(
        'NAND',
      );
  }
});

test('runs the 7402 NOR preset through live switches and grades all four rows', async ({ page }) => {
  await page.getByRole('button', { name: '디지털 · 7402 NOR', exact: true }).click();
  await expect(page.locator('.photo-board-toolbar')).toContainText('16 배선');
  const power = page.getByRole('switch', { name: '메인 전원', exact: true });
  const led = page.locator('[data-id="output-led"] .light-overlay');
  const a = page.locator('[data-id="input-a"] .device-control');
  const b = page.locator('[data-id="input-b"] .device-control');
  await expect(power).not.toBeChecked();
  await expect(led).toHaveCSS('opacity', '0');
  await power.click();
  await expect(led).toHaveCSS('opacity', '0.9'); // 00 -> 1
  await b.click();
  await expect(led).toHaveCSS('opacity', '0'); // 01 -> 0
  await a.click();
  await expect(led).toHaveCSS('opacity', '0'); // 11 -> 0
  await b.click();
  await expect(led).toHaveCSS('opacity', '0'); // 10 -> 0
  await a.click();
  await expect(led).toHaveCSS('opacity', '0.9');
  await page.getByRole('button', { name: 'NOR', exact: true }).click();
  await expect(page.getByRole('img', { name: 'NOR 논리 기호', exact: true })).toBeVisible();
  await page.getByText('배선 힌트 펼치기', { exact: true }).click();
  await expect(page.locator('.mission-hint')).toContainText('Y=1번');
  await page.getByRole('button', { name: '회로 검증하기', exact: true }).click();
  await expect(page.locator('.mission-grade-score')).toContainText('100점');
  await expect(page.locator('.mission-truth-table .grade-pass')).toHaveCount(4);
  await expect(led).toHaveCSS('opacity', '0.9');
  await power.click();
  await expect(led).toHaveCSS('opacity', '0');
});

test('keeps a 100-board file interactive without creating hundreds of thousands of handles', async ({
  page,
}) => {
  await nandPreset(page);
  const data = await downloadCircuit(page);
  data.workspaces.digital.components = Array.from({ length: 100 }, (_, i) => ({
    id: `board-${i}`,
    assetId: 'breadboard',
    label: 'Board',
    position: { x: 0, y: 0 },
    settings: { pressed: false, switchOn: false, voltage: 5, timerSeconds: 3 },
  }));
  data.workspaces.digital.wires = [];
  await uploadCircuit(page, data);
  await expect(page.locator('.react-flow__node')).toHaveCount(100);
  expect(await page.locator('.photo-pin').count()).toBeLessThan(7000);
  await page.getByRole('switch', { name: '메인 전원', exact: true }).click();
  await expect(
    page.getByRole('switch', { name: '메인 전원', exact: true }),
  ).toBeChecked();
  await page.getByRole('switch', { name: '메인 전원', exact: true }).click();
  await page
    .getByRole('button', { name: '브레드보드 추가', exact: true })
    .click();
  await expect(page.locator('.react-flow__node')).toHaveCount(100);
  await expect(page.locator('.live-notice')).toContainText('100');
});
