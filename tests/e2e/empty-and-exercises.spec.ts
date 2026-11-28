import { expect } from '@playwright/test';
import { test, nandPreset, selfHoldPreset, downloadCircuit } from './support';
test('opens empty boards and resets only the active workspace with undo support', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(page.locator('[data-id="seq-board"]')).toBeVisible();
  await page.getByRole('tab', { name: '디지털 회로', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(page.locator('[data-id="dig-board"]')).toBeVisible();
  await selfHoldPreset(page);
  const sequence = (await downloadCircuit(page)).workspaces.sequence;
  await nandPreset(page);
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  expect((await downloadCircuit(page)).workspaces.sequence).toEqual(sequence);
  await page.getByRole('button', { name: /실행 취소/ }).click();
  await expect(page.locator('.photo-board-toolbar')).toContainText('16 배선');
  await page.getByRole('tab', { name: '시퀀스 제어', exact: true }).click();
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
});

test('turns the photographed motor blades only while the wired PB is held', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  const addMotor = page.getByRole('button', { name: '모터 유닛 추가', exact: true });
  await expect(addMotor.locator('img')).toHaveAttribute('src', /\/Motor\.png$/);
  await addMotor.click();
  const motor = page.locator('.photo-node[data-asset="motor-unit"]');
  await expect
    .poll(() => motor.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1201);
  await expect(motor.locator('.photo-pin')).toHaveCount(2);
  for (const [id, x] of [
    ['plus', 540],
    ['minus', 672],
  ] as const) {
    const motorPin = motor.locator(`.photo-pin[data-handleid="${id}"]`);
    const image = await motor.locator('.asset-interactions').boundingBox();
    const pin = await motorPin.boundingBox();
    expect(Math.abs(pin!.x + pin!.width / 2 - (image!.x + (image!.width * x) / 1201))).toBeLessThan(
      1,
    );
    expect(
      Math.abs(pin!.y + pin!.height / 2 - (image!.y + (image!.height * 332) / 1309)),
    ).toBeLessThan(1);
  }
  await page.getByRole('button', { name: '푸시버튼 스위치 추가', exact: true }).click();
  await page.getByRole('combobox', { name: '버튼 동작' }).selectOption('momentary');
  const board = page.locator('[data-id="seq-board"]');
  const pb = page.locator('.photo-node[data-asset="pb-switch"]');
  const pin = (device: typeof board, id: string) =>
    device.locator(`.photo-pin[data-handleid="${id}"]`);
  for (const [from, to] of [
    [pin(board, 'minus'), pin(motor, 'minus')],
    [pin(board, 'plus'), pin(pb, 'no1')],
    [pin(pb, 'no2'), pin(motor, 'plus')],
  ]) {
    await from.click();
    await to.click();
  }
  await expect(page.locator('.photo-board-toolbar')).toContainText('3 배선');
  const power = page.getByRole('switch', { name: '메인 전원', exact: true });
  await power.click();
  await expect(motor.locator('.motor-status')).toHaveText('정지');
  const push = pb.getByRole('button', { name: '푸시버튼 누르기' });
  await push.focus();
  await page.keyboard.down('Space');
  await expect(motor.locator('.motor-status')).toHaveText('정회전 (CW)');
  const blades = motor.locator('.motor-blades');
  await expect(blades).toHaveCSS('animation-name', 'motor-turn');
  const [first, later] = await blades.evaluate((element) => {
    const animation = element.getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
    const firstAngle = getComputedStyle(element).transform;
    animation.currentTime = 250;
    return [firstAngle, getComputedStyle(element).transform];
  });
  expect(later).not.toBe(first);
  await motor.screenshot({ path: testInfo.outputPath('running-motor.png') });
  await page.keyboard.up('Space');
  await expect(motor.locator('.motor-status')).toHaveText('정지');
  await expect(blades).toHaveCount(0);
  await power.click();
  await page.getByRole('tab', { name: '디지털 회로', exact: true }).click();
  await expect(addMotor).toHaveCount(0);
});

test('includes every drawing, classifies all 26 exercises and tests reference wiring', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await page.goto('/#exercises');
  await expect(page.getByRole('heading', { name: '연습문제 · 시퀀스 도면 26선' })).toBeVisible();
  await expect(page.locator('.exercise-catalog button')).toHaveCount(26);
  for (let id = 1; id <= 26; id++) {
    await page
      .locator('.exercise-catalog button')
      .filter({ hasText: new RegExp('^' + String(id).padStart(2, '0') + ' ·') })
      .click();
    await expect
      .poll(() =>
        page.locator('.exercise-original').evaluate((el) => (el as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.getByRole('button', { name: '해설 배선 불러오기', exact: true }).click();
    await page.getByRole('button', { name: '배선 동작 자동 테스트', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '단계 일치' })).toContainText(
      '원본 해석과 일치',
    );
    const open = page.getByRole('button', { name: '완성된 작업대 보기', exact: true });
    await expect(open).toHaveCount(1);
    await expect(
      page
        .locator('.exercise-drawing-heading')
        .getByRole('button', { name: '완성된 작업대 보기', exact: true }),
    ).toBeVisible();
    await open.click();
    const completed = page.getByRole('dialog', { name: '완성된 작업대', exact: true });
    await expect(completed).toBeVisible();
    await expect(completed.locator('.completed-workbench-header p')).toHaveText(
      new RegExp('^' + String(id).padStart(2, '0') + ' ·'),
    );
    const diagram = completed.locator('.completed-drawing-image');
    await expect(diagram).toHaveAttribute(
      'src',
      new RegExp('/' + String(id).padStart(2, '0') + '\\.(png|svg)$'),
    );
    await expect
      .poll(() => diagram.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
    const timing = completed.getByRole('region', { name: '회로 타임 차트', exact: true });
    await expect(
      timing.getByRole('img', { name: '시간에 따른 버튼 입력과 회로 출력 파형' }),
    ).toBeVisible();
    await expect(
      timing.locator('[data-timing-signal="power"] path.workbench-timing-wave'),
    ).toHaveAttribute('d', / H .* V /);
    await expect(
      timing.locator('[data-timing-signal="PB1"] path.workbench-timing-wave'),
    ).toHaveAttribute('d', / H .* V /);
    if (id === 4 || id === 10)
      await expect(completed.locator('.completed-workbench-header p')).toContainText('수정안 적용');
    const wireList = completed.getByRole('region', { name: '완성 배선', exact: true });
    const wireCount = await wireList.getByRole('listitem').count();
    expect(wireCount).toBeGreaterThan(0);
    await expect(completed.locator('.react-flow__edge')).toHaveCount(wireCount);
    const relayPhotos = completed.locator('.relay-screw-photo');
    expect(await relayPhotos.count()).toBeGreaterThan(0);
    for (const photo of await relayPhotos.all()) {
      const screws = photo.locator('[data-screw]');
      await expect(screws).toHaveCount(14);
      await expect(screws.locator('.react-flow__handle')).toHaveCount(14);
      const centers = await screws.evaluateAll((elements) =>
        Object.fromEntries(
          elements.map((element) => {
            const { left, top } = (element as HTMLElement).style;
            return [element.getAttribute('data-screw'), [parseFloat(left), parseFloat(top)]];
          }),
        ),
      );
      expect(centers['14'][0]).toBeLessThan(centers['13'][0]);
      expect(centers['5'][1]).toBeLessThan(centers['1'][1]);
      expect(centers['1'][1]).toBeLessThan(centers['14'][1]);
      expect(centers['14'][1]).toBeLessThan(centers['9'][1]);
    }
    await expect(
      wireList
        .getByRole('listitem')
        .filter({ hasText: /코일 \+ \(14번 나사\)|코일 − \(13번 나사\)/ })
        .first(),
    ).toBeVisible();
    await completed.getByRole('button', { name: '동작 자동 테스트', exact: true }).click();
    await expect(completed.locator('.completed-workbench-status')).toContainText(
      /자동 테스트 (\d+)\/\1단계 일치/,
    );
    await completed.getByRole('button', { name: '완성된 작업대 닫기', exact: true }).click();
    await expect(completed).toBeHidden();
    if (id === 4 || id === 10) {
      await page.getByRole('checkbox', { name: /수정안과 비교/ }).check();
      await page.getByRole('button', { name: '해설 배선 불러오기', exact: true }).click();
      await page.getByRole('button', { name: '배선 동작 자동 테스트', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: '단계 일치' })).toContainText(
        '원본 해석과 일치',
      );
    }
  }
  await page.getByRole('button', { name: '배선 초기화', exact: true }).click();
  await page.getByRole('button', { name: '배선 동작 자동 테스트', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '단계 일치' })).toContainText(
    '배선과 접점 종류',
  );
  await page.locator('.exercise-catalog button').filter({ hasText: /^04 ·/ }).click();
  await page.getByRole('checkbox', { name: /수정안과 비교/ }).check();
  await expect(page.locator('.exercise-bench h3')).toContainText('수정안');
  await page.screenshot({ path: testInfo.outputPath('exercise-page.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(392);
});

test('selects the same wire on the completed board and the original drawing', async ({
  page,
}, testInfo) => {
  await page.goto('/#exercises');
  await page.getByRole('button', { name: '완성된 작업대 보기', exact: true }).click();
  const completed = page.getByRole('dialog', { name: '완성된 작업대' });
  const log = completed.getByRole('region', { name: '완성 배선', exact: true });
  const drawing = completed.getByRole('region', { name: '01번 실습 도면' });
  const first = log.getByRole('button', { name: /^1번 배선/ });
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(drawing).toBeFocused();
  await expect(drawing.getByRole('status')).toContainText('1번 배선');
  const line = drawing.locator('polyline.completed-drawing-path');
  await expect(drawing.locator('.completed-drawing-overlay')).toBeVisible();
  await expect(line).toHaveCount(1);
  const points = (await line.getAttribute('points'))!
    .split(' ')
    .map((point) => point.split(',').map(Number));
  expect(points[0][0]).toBeCloseTo(197, 0);
  expect(points.at(-1)![0]).toBeCloseTo(197, 0);
  expect(points[0][1]).toBeLessThan(points.at(-1)![1]);
  await expect(drawing.locator('[data-end="from"] text')).toHaveText('A');
  await expect(drawing.locator('[data-end="to"] text')).toHaveText('B');
  await drawing
    .locator('.completed-drawing-scroll')
    .screenshot({ path: testInfo.outputPath('selected-wire-on-drawing.png') });
  await drawing.getByRole('button', { name: '배선 목록으로', exact: true }).click();
  await expect(first).toBeFocused();
  const second = log.getByRole('button', { name: /^2번 배선/ });
  await second.click();
  await expect(drawing.getByRole('status')).toContainText('2번 배선');
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await second.click();
  await expect(drawing.locator('.completed-drawing-overlay')).toHaveCount(0);
});

test('labels an unverified end without inventing a path on the source drawing', async ({
  page,
}) => {
  await page.goto('/#exercises');
  await page.getByRole('button', { name: /^05 ·/ }).click();
  await page.getByRole('button', { name: '완성된 작업대 보기', exact: true }).click();
  const completed = page.getByRole('dialog', { name: '완성된 작업대' });
  const wire = completed
    .getByRole('region', { name: '완성 배선', exact: true })
    .getByRole('button', { name: /전원 \+ .*PB1/ })
    .first();
  await wire.click();
  const drawing = completed.getByRole('region', { name: '05번 실습 도면' });
  await expect(drawing.getByRole('status')).toContainText(
    '다른 끝은 원본에서 위치를 확인할 수 없습니다',
  );
  await expect(drawing.locator('[data-end="to"]')).toHaveCount(1);
  await expect(drawing.locator('polyline.completed-drawing-path')).toHaveCount(0);
});

test('picks a conductor on the original drawing and shows only its completed wire', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#exercises');
  await page.getByRole('button', { name: '완성된 작업대 보기', exact: true }).click();
  const completed = page.getByRole('dialog', { name: '완성된 작업대', exact: true });
  const drawing = completed.getByRole('region', { name: '01번 실습 도면' });
  const image = drawing.locator('.completed-drawing-image');
  await image.evaluate((element: HTMLImageElement) => element.decode());
  await drawing.getByRole('slider', { name: '완성 작업대 도면 확대' }).fill('200');
  const size = (await image.boundingBox())!;
  await image.click({ position: { x: size.width * 0.197, y: size.height * 0.228 } });
  const view = completed.getByRole('region', { name: '완성 작업대 배선 보기', exact: true });
  await expect(view).toBeFocused();
  await expect(view.getByRole('status')).toContainText('1번 배선');
  await expect(view.getByRole('status')).toBeInViewport();
  await expect(completed.locator('.react-flow__edge.selected')).toHaveCount(1);
  await expect(completed.locator('.react-flow__handle.is-highlighted')).toHaveCount(2);
  await expect(view.getByRole('button', { pressed: true })).toHaveText(/1번 배선/);
  await view.getByRole('button', { name: '실습 도면으로', exact: true }).click();
  await expect(drawing).toBeFocused();
  await image.click({ position: { x: size.width * 0.1, y: size.height * 0.07 } });
  await expect(drawing.getByRole('status')).toContainText('완성 배선을 찾을 수 없습니다');
  await expect(completed.locator('.react-flow__edge.selected')).toHaveCount(0);
});

test('highlights only related leads from a shared supply rail', async ({ page }) => {
  await page.goto('/#exercises');
  await page.getByRole('button', { name: '완성된 작업대 보기', exact: true }).click();
  const completed = page.getByRole('dialog', { name: '완성된 작업대', exact: true });
  const image = completed.locator('.completed-drawing-image');
  await image.evaluate((element: HTMLImageElement) => element.decode());
  const size = (await image.boundingBox())!;
  await image.click({ position: { x: size.width * 0.43, y: size.height * 0.1494 } });
  const view = completed.getByRole('region', { name: '완성 작업대 배선 보기', exact: true });
  await expect(view.getByRole('status')).toContainText('공유 구간');
  const wires = view.getByRole('button', { pressed: true });
  const titles = await wires.allTextContents();
  expect(titles.length).toBeGreaterThan(1);
  expect(titles.every((title) => title.includes('전원 +'))).toBe(true);
  await expect(completed.locator('.react-flow__edge.selected')).toHaveCount(titles.length);
  await wires.first().click();
  await expect(completed.locator('.react-flow__edge.selected')).toHaveCount(1);
});

test('reads the alternating-lamp timing chart on a narrow screen without changing the workbench', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#exercises');
  await page.getByRole('button', { name: /^26 ·/ }).click();
  await page.getByRole('button', { name: '완성된 작업대 보기', exact: true }).click();
  const completed = page.getByRole('dialog', { name: '완성된 작업대', exact: true });
  const electricalPower = completed.getByRole('switch', { name: '완성 작업대 전원' });
  await completed.getByRole('button', { name: '타임 차트 보기', exact: true }).click();
  const timing = completed.getByRole('region', { name: '회로 타임 차트', exact: true });
  await expect(timing).toBeFocused();
  const chart = timing.getByRole('region', { name: '회로 파형 그래프' });
  expect(await chart.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  const slider = timing.getByRole('slider', { name: '타임 차트 확인 시점' });
  const lamp = (id: number) => timing.locator(`[data-timing-value="LAMP${id}"] dd`);
  await slider.fill('1.49');
  await expect(lamp(1)).toHaveText('점등');
  await expect(lamp(2)).toHaveText('소등');
  await slider.fill('1.5');
  await expect(lamp(1)).toHaveText('소등');
  await expect(lamp(2)).toHaveText('점등');
  await expect(
    timing.locator('[data-timing-signal="T1"] .workbench-timing-pulse').first(),
  ).toBeAttached();
  await expect(electricalPower).toHaveAttribute('aria-checked', 'false');
  await timing.screenshot({ path: testInfo.outputPath('sequence-timing-chart.png') });
});

test('shows and operates the alternate-lamp drawing and completed workbench', async ({
  page,
}, testInfo) => {
  await page.goto('/#exercises');
  await page.getByRole('combobox', { name: '카테고리' }).selectOption('타이머·경보');
  await expect(page.locator('.exercise-catalog button')).toHaveCount(5);
  await page.getByRole('button', { name: /^26 · 깜박이 회로 2/ }).click();
  await expect(page.locator('.exercise-original')).toHaveAttribute('src', /\/26\.svg$/);
  await expect
    .poll(() =>
      page.locator('.exercise-original').evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBe(1000);
  await page.getByRole('button', { name: /^4번 R1 · c–a 접점 도면에서 찾기$/ }).click();
  await expect(page.locator('.contact-explanation')).toContainText('아래 점선에 전원을');
  await page.getByRole('button', { name: '이 선 연결하기', exact: true }).first().click();
  await expect(page.locator('.easy-progress')).toHaveText(/^배선 완료 1 \/ \d+가닥$/);
  await page
    .locator('.drawing-lesson')
    .screenshot({ path: testInfo.outputPath('alternating-lamps-drawing.png') });
  await page.getByRole('button', { name: '완성된 작업대 보기', exact: true }).click();
  const board = page.getByRole('dialog', { name: '완성된 작업대', exact: true });
  await expect(board.locator('[data-device="T2"]')).toContainText('OFF 지연');
  await expect(board.locator('[data-device="T2"]')).toContainText('설정 0.5초');
  await board.getByRole('switch', { name: '완성 작업대 전원' }).click();
  await board.getByRole('button', { name: 'PB1 누르기' }).press('Space');
  const lamp1 = board.locator('[data-device="LAMP1"]');
  const lamp2 = board.locator('[data-device="LAMP2"]');
  await expect(lamp1).toHaveAttribute('data-active', 'true');
  await expect(lamp2).toHaveAttribute('data-active', 'true');
  await expect(lamp1).toHaveAttribute('data-active', 'true');
  await board.getByRole('button', { name: 'PB2 누르기' }).press('Space');
  await expect(lamp1).toHaveAttribute('data-active', 'false');
  await expect(lamp2).toHaveAttribute('data-active', 'false');
});

test('tests the assembled 3-input workbench without replacing the learner wiring', async ({
  page,
}) => {
  await page.goto('/#exercises');
  await page.locator('.exercise-catalog button').filter({ hasText: /^21 ·/ }).click();
  await page.getByRole('button', { name: '이 선 연결하기', exact: true }).first().click();
  await expect(page.locator('.easy-progress')).toHaveText('배선 완료 1 / 31가닥');

  const open = page.getByRole('button', { name: '완성된 작업대 보기', exact: true });
  await open.click();
  const completed = page.getByRole('dialog', { name: '완성된 작업대', exact: true });
  await expect(
    completed.getByRole('region', { name: '완성 배선', exact: true }).getByRole('listitem'),
  ).toHaveCount(31);
  await expect
    .poll(() =>
      completed
        .locator('[data-device="PB1"]')
        .evaluate((node) => node.getBoundingClientRect().width),
    )
    .toBeGreaterThan(100);
  await completed.getByRole('button', { name: /^1번 배선/ }).click();
  await expect(completed.locator('.completed-terminal .is-highlighted')).toHaveCount(2);
  await completed.getByRole('switch', { name: '완성 작업대 전원' }).click();
  const push = async (id: string) => {
    await completed.getByRole('button', { name: `${id} 누르기` }).press('Space');
  };
  const lamp = (id: number) => completed.locator(`[data-device="L${id}"]`);
  await push('PB1');
  await expect(lamp(1)).toHaveAttribute('data-active', 'true');
  await push('PB2');
  await expect(lamp(1)).toHaveAttribute('data-active', 'false');
  await expect(lamp(2)).toHaveAttribute('data-active', 'true');
  await push('PB4');
  await expect(lamp(2)).toHaveAttribute('data-active', 'false');
  await page.keyboard.press('Escape');
  await expect(completed).toBeHidden();
  await expect(page.locator('.easy-progress')).toHaveText('배선 완료 1 / 31가닥');
});

test('shows the timer settings and delayed lamps in the completed workbench', async ({ page }) => {
  await page.goto('/#exercises');
  await page.locator('.exercise-catalog button').filter({ hasText: /^16 ·/ }).click();
  await page.getByRole('button', { name: '완성된 작업대 보기', exact: true }).click();
  const completed = page.getByRole('dialog', { name: '완성된 작업대', exact: true });
  await expect(completed.locator('[data-device="T2"]')).toContainText('설정 1초');
  await expect(completed.locator('[data-device="T1"]')).toContainText('설정 3초');
  await completed.getByRole('switch', { name: '완성 작업대 전원' }).click();
  await completed.getByRole('button', { name: 'PB1 누르기' }).press('Space');
  await expect(completed.locator('[data-device="PL1"]')).toHaveAttribute('data-active', 'true');
  await expect(completed.locator('[data-device="PL2"]')).toHaveAttribute('data-active', 'false');
  await expect(completed.locator('[data-device="PL2"]')).toHaveAttribute('data-active', 'true');
  await completed.getByRole('button', { name: 'PB2 누르기' }).press('Space');
  await expect(completed.locator('[data-device="PL1"]')).toHaveAttribute('data-active', 'false');
  await expect(completed.locator('[data-device="PL2"]')).toHaveAttribute('data-active', 'false');
});

test('renders the motor photo and retains the wired forward and reverse operation', async ({
  page,
}) => {
  await page.goto('/#exercises');
  await page.locator('.exercise-catalog button').filter({ hasText: /^24 ·/ }).click();
  await page.getByRole('button', { name: '완성된 작업대 보기', exact: true }).click();
  const completed = page.getByRole('dialog', { name: '완성된 작업대', exact: true });
  const motor = completed.locator('[data-device="M"]');
  const photo = motor.locator('img.asset-photo');
  await expect(photo).toHaveAttribute('src', /\/assets\/Motor\.png$/);
  await expect
    .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(1201);
  await expect(motor.locator('.react-flow__handle')).toHaveCount(2);
  await expect(motor.locator('.motor-blades')).toHaveCount(0);
  await completed.getByRole('switch', { name: '완성 작업대 전원' }).click();

  for (const [button, direction, animationDirection] of [
    ['PB1', 'CW', 'normal'],
    ['PB2', 'CCW', 'reverse'],
  ]) {
    await completed.getByRole('button', { name: `${button} 누르기` }).focus();
    await page.keyboard.down('Space');
    await expect(motor.locator('.completed-device-state')).toHaveText(direction);
    await expect(motor.locator('.motor-blades')).toHaveCSS(
      'animation-direction',
      animationDirection,
    );
    await page.keyboard.up('Space');
    await expect(motor.locator('.completed-device-state')).toHaveText('정지 / 개방');
  }
});
