import { expect } from '@playwright/test';
import {
  test,
  downloadCircuit,
  uploadCircuit,
  nandPreset,
  selfHoldPreset,
  openWiring,
  selectCircuitNode,
  loadPopulatedWorkspace,
  loadTestCircuit,
} from './support';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await loadPopulatedWorkspace(page);
  await expect(
    page.getByRole('link', { name: '키보드 배선으로 이동', exact: true }),
  ).toBeAttached();
});

test('centers the six shared toolbar actions across both practice modes', async ({ page }) => {
  const toolbar = page.getByRole('group', { name: '학습 편의 기능', exact: true });
  const actions = toolbar.locator(':scope > a, :scope > button');
  const layouts = [['시퀀스 제어', 1440], ['디지털 회로', 1440], ['시퀀스 제어', 390], ['디지털 회로', 390]] as const;
  for (const [tab, width] of layouts) {
    await page.setViewportSize({ width, height: 1100 });
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await expect(actions).toHaveText([
      '계측·논리 학습 센터', '연습문제 · 수업 도면 26선', '실행 취소 Ctrl+Z',
      '다시 실행 Ctrl+Y', '회로 JSON 저장', '회로 JSON 불러오기',
    ]);
    await expect(toolbar).not.toContainText('예제 회로');
    const layout = await toolbar.evaluate((element) => {
      const toolbarRect = element.getBoundingClientRect();
      const css = getComputedStyle(element);
      const rows = new Map<number, DOMRect[]>();
      for (const action of Array.from(element.querySelectorAll('a, button'))) {
        const rect = action.getBoundingClientRect();
        const centerY = Math.round(rect.top + rect.height / 2);
        const row = rows.get(centerY) ?? [];
        row.push(rect);
        rows.set(centerY, row);
      }
      return {
        centerX: toolbarRect.left + toolbarRect.width / 2,
        gap: parseFloat(css.columnGap),
        rows: [...rows.values()].map((row) => row.map(({ left, right }) => ({ left, right }))),
      };
    });
    if (width === 1440) expect(layout.rows).toHaveLength(1);
    else expect(layout.rows.length).toBeGreaterThan(1);
    for (const row of layout.rows) {
      const rowCenter = (row[0].left + row.at(-1)!.right) / 2;
      expect(rowCenter).toBeCloseTo(layout.centerX, 0);
      row.slice(1).forEach((action, i) => expect(action.left - row[i].right).toBeCloseTo(layout.gap, 0));
    }
  }
});

test('connects and undoes/redoes a wire using only the keyboard', async ({
  page,
}) => {
  // Loading the explicit test circuit leaves focus in the file toolbar.
  await page.getByRole('link', { name: '실습 영역으로 이동', exact: true }).focus();
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
  const log = page.getByRole('region', { name: '배선 로그', exact: true });
  const entry = log.getByRole('button', { name: /1번 배선/ });
  await expect(entry).toContainText('seq-board · +24V (실습 전원)');
  await expect(entry).toContainText('seq-lamp · +');
  await expect(
    page.getByRole('status', { name: '키보드 배선 상태' }),
  ).toHaveText('선택한 두 단자는 연결되어 있습니다.');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.photo-board-toolbar')).toContainText('0 배선');
  await expect(log.getByRole('listitem')).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+y');
  await expect(page.locator('.photo-board-toolbar')).toContainText('1 배선');
  await expect(entry).toBeVisible();
});

test('uses all eight wire colors in both modes and restores the three new colors from JSON', async ({ page }) => {
  const colors = [
    ['보라', '#8b5cdb'],
    ['주황', '#e67731'],
    ['분홍', '#cc4f9c'],
  ];
  const layouts = [
    { tab: '시퀀스 제어', from: 'seq-board', to: 'seq-relay', pins: ['1', '2', '3'] },
    { tab: '디지털 회로', from: 'dig-power', to: 'dig-board', pins: ['a1', 'a2', 'a3'] },
  ];
  for (const { tab, from, to, pins } of layouts) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    const picker = page.getByRole('group', { name: '전선 색상', exact: true });
    await expect(picker.getByRole('button')).toHaveCount(8);
    await openWiring(page);
    await page.getByLabel('출발 부품', { exact: true }).selectOption(from);
    await page.getByLabel('출발 단자', { exact: true }).selectOption('plus');
    await page.getByLabel('도착 부품', { exact: true }).selectOption(to);
    for (const [index, [name]] of colors.entries()) {
      const swatch = picker.getByRole('button', { name: `${name} 전선`, exact: true });
      await swatch.click();
      await expect(swatch).toHaveAttribute('aria-pressed', 'true');
      await page.getByLabel('도착 단자', { exact: true }).selectOption(pins[index]);
      await page.getByRole('button', { name: '배선 연결', exact: true }).click();
    }
  }

  const saved = await downloadCircuit(page);
  for (const { wires } of Object.values(saved.workspaces)) {
    expect(wires.map(({ color }) => color)).toEqual(colors.map(([, color]) => color));
  }
  await uploadCircuit(page, saved);
  await expect(page.getByText('JSON 회로를 전원 OFF로 불러왔습니다.', { exact: true })).toBeVisible();
  const restored = await downloadCircuit(page);
  expect(restored.workspaces).toEqual(saved.workspaces);
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
  await expect(page.locator('.photo-canvas')).toHaveCount(1);
  const hole = page.locator(
    '[data-id="dig-board"] .photo-pin[data-handleid="bank4-j63"]',
  );
  const log = page.getByRole('region', { name: '배선 로그', exact: true });
  await expect(hole).toHaveCount(0);
  await expect(log).toContainText('연결된 배선이 없습니다.');
  await page.getByLabel('Cable type').selectOption('clip');
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
    kind: 'clip',
  });
  const entry = log.getByRole('button', { name: /1번 배선/ });
  await expect(entry).toContainText('악어클립');
  await expect(entry).toContainText('dig-board · 4구역 J63');
  await expect(entry).toContainText('dig-led · A (+) 긴 다리');
  await entry.click();
  await expect(entry).toHaveAttribute('aria-pressed', 'true');
  const selectedEdge = page.locator(`.react-flow__edge.selected[data-id="${wires[0].id}"]`);
  await expect(selectedEdge.locator('.wire-terminal-highlight')).toHaveCount(2);
  await page.getByRole('tab', { name: '시퀀스 제어', exact: true }).click();
  await expect(log.getByRole('listitem')).toHaveCount(0);
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
  await expect(entry).toBeVisible();
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

test('toggles a sequence pushbutton and its lamp on each click', async ({
  page,
}) => {
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await page.getByRole('button', { name: '푸시버튼 스위치 추가' }).click();
  await page.getByRole('button', { name: '표시 램프 추가' }).click();
  const saved = await downloadCircuit(page);
  const components = saved.workspaces.sequence.components;
  const pbId = components.find((c) => c.assetId === 'pb-switch')!.id;
  const lampId = components.find((c) => c.assetId === 'pilot-lamp')!.id;
  saved.workspaces.sequence.wires = [
    {
      id: 'supply-to-pb',
      from: { componentId: 'seq-board', pinId: 'plus' },
      to: { componentId: pbId, pinId: 'no1' },
      color: '#dc4c4c',
    },
    {
      id: 'pb-to-lamp',
      from: { componentId: pbId, pinId: 'no2' },
      to: { componentId: lampId, pinId: 'plus' },
      color: '#dc4c4c',
    },
    {
      id: 'lamp-return',
      from: { componentId: lampId, pinId: 'minus' },
      to: { componentId: 'seq-board', pinId: 'minus' },
      color: '#303b48',
    },
  ];
  await uploadCircuit(page, saved);
  await expect(page.locator('.photo-board-toolbar')).toContainText('3 배선');
  await page.getByRole('switch', { name: '메인 전원', exact: true }).click();
  const button = page.locator(`[data-id="${pbId}"] .momentary-control`);
  const lamp = page.locator(`[data-id="${lampId}"] .light-overlay`);
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(lamp).toHaveCSS('opacity', '0');

  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(lamp).toHaveCSS('opacity', '0.9');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(lamp).toHaveCSS('opacity', '0');

  const panelButton = page.getByRole('button', { name: '푸시버튼 ON/OFF' });
  await panelButton.press('Space');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(lamp).toHaveCSS('opacity', '0.9');
  await panelButton.press('Space');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(lamp).toHaveCSS('opacity', '0');
});

test('releases a held momentary button when changing tabs before pointer-up', async ({
  page,
}) => {
  await selfHoldPreset(page);
  await selectCircuitNode(page, 'start');
  await page
    .getByRole('combobox', { name: '버튼 동작' })
    .selectOption('momentary');
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
  await loadTestCircuit(page, 'nor');
  const log = page.getByRole('region', { name: '배선 로그', exact: true });
  await expect(log.getByRole('listitem')).toHaveCount(16);
  await expect(log.getByText('TTL IC 7402 · 1 OUT', { exact: true })).toHaveCount(2);
  await expect(log.getByText('브레드보드 · 상단 + 레일 1번', { exact: true })).toBeVisible();
  await expect(log.getByText('점퍼선', { exact: true })).toHaveCount(16);
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
