import {expect} from '@playwright/test';
import {test,nandPreset,selfHoldPreset,downloadCircuit} from './support';
test('opens empty boards and resets only the active workspace with undo support',async({page})=>{
 await page.goto('/');await expect(page.locator('.react-flow__node')).toHaveCount(1);await expect(page.locator('[data-id="seq-board"]')).toBeVisible();
 await page.getByRole('tab',{name:'디지털 회로',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(1);await expect(page.locator('[data-id="dig-board"]')).toBeVisible();
 await selfHoldPreset(page);const sequence=(await downloadCircuit(page)).workspaces.sequence;
 await nandPreset(page);await page.getByRole('button',{name:'초기화',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(1);await expect(page.locator('.react-flow__edge')).toHaveCount(0);
 expect((await downloadCircuit(page)).workspaces.sequence).toEqual(sequence);
 await page.getByRole('button',{name:/실행 취소/}).click();await expect(page.locator('.photo-board-toolbar')).toContainText('16 배선');
 await page.getByRole('tab',{name:'시퀀스 제어',exact:true}).click();await page.getByRole('button',{name:'초기화',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(1);
});

test('places and wires the photographed motor from the sequence library', async ({page}) => {
  await page.goto('/');
  const addMotor = page.getByRole('button', {name:'모터 유닛 추가', exact:true});
  await expect(addMotor.locator('img')).toHaveAttribute('src', /\/Motor\.png$/);
  await addMotor.click();
  const motor = page.locator('.photo-node[data-asset="motor-unit"]');
  await expect.poll(() => motor.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1201);
  await expect(motor.locator('.photo-pin')).toHaveCount(2);
  for (const [id, x] of [['plus', 540], ['minus', 672]] as const) {
    const motorPin = motor.locator(`.photo-pin[data-handleid="${id}"]`);
    const image = await motor.locator('.asset-interactions').boundingBox();
    const pin = await motorPin.boundingBox();
    expect(Math.abs(pin!.x + pin!.width / 2 - (image!.x + image!.width * x / 1201))).toBeLessThan(1);
    expect(Math.abs(pin!.y + pin!.height / 2 - (image!.y + image!.height * 332 / 1309))).toBeLessThan(1);
    await page.locator(`[data-id="seq-board"] .photo-pin[data-handleid="${id}"]`).click();
    await motorPin.click();
  }
  await expect(page.locator('.photo-board-toolbar')).toContainText('2 배선');
  const power = page.getByRole('switch', {name:'메인 전원', exact:true});
  await power.click();
  await expect(motor.locator('.motor-status')).toHaveText('정회전 (CW)');
  await power.click();
  await expect(motor.locator('.motor-status')).toHaveText('정지');
  await page.getByRole('tab', {name:'디지털 회로', exact:true}).click();
  await expect(addMotor).toHaveCount(0);
});

test('includes every drawing, classifies all 26 exercises and tests reference wiring',async({page},testInfo)=>{
 test.setTimeout(90000);await page.goto('/#exercises');await expect(page.getByRole('heading',{name:'연습문제 · 시퀀스 도면 26선'})).toBeVisible();
 await expect(page.locator('.exercise-catalog button')).toHaveCount(26);
 for(let id=1;id<=26;id++){
  await page.locator('.exercise-catalog button').filter({hasText:new RegExp('^'+String(id).padStart(2,'0')+' ·')}).click();
  await expect.poll(()=>page.locator('.exercise-original').evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'해설 배선 불러오기',exact:true}).click();await page.getByRole('button',{name:'배선 동작 자동 테스트',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'단계 일치'})).toContainText('원본 해석과 일치');
  const open=page.getByRole('button',{name:'완성된 작업대 보기',exact:true});
  await expect(open).toHaveCount(1);
  await expect(page.locator('.exercise-drawing-heading').getByRole('button',{name:'완성된 작업대 보기',exact:true})).toBeVisible();
  await open.click();
  const completed=page.getByRole('dialog',{name:'완성된 작업대',exact:true});
  await expect(completed).toBeVisible();
  await expect(completed.locator('.completed-workbench-header p')).toHaveText(new RegExp('^'+String(id).padStart(2,'0')+' ·'));
  if(id===4||id===10)await expect(completed.locator('.completed-workbench-header p')).toContainText('수정안 적용');
  const wireCount=await completed.getByRole('listitem').count();
  expect(wireCount).toBeGreaterThan(0);
  await expect(completed.locator('.react-flow__edge')).toHaveCount(wireCount);
  await completed.getByRole('button',{name:'동작 자동 테스트',exact:true}).click();
  await expect(completed.getByRole('status')).toContainText(/자동 테스트 (\d+)\/\1단계 일치/);
  await completed.getByRole('button',{name:'완성된 작업대 닫기',exact:true}).click();
  await expect(completed).toBeHidden();
 }
 await page.getByRole('button',{name:'배선 초기화',exact:true}).click();await page.getByRole('button',{name:'배선 동작 자동 테스트',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'단계 일치'})).toContainText('배선과 접점 종류');
 await page.locator('.exercise-catalog button').filter({hasText:/^04 ·/}).click();await page.getByRole('checkbox',{name:/수정안과 비교/}).check();await expect(page.locator('.exercise-bench h3')).toContainText('수정안');
 await page.screenshot({path:testInfo.outputPath('exercise-page.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.body.scrollWidth)).toBeLessThanOrEqual(392);
});

test('shows and operates the alternate-lamp drawing and completed workbench', async ({page}, testInfo) => {
  await page.goto('/#exercises');
  await page.getByRole('combobox', {name:'카테고리'}).selectOption('타이머·경보');
  await expect(page.locator('.exercise-catalog button')).toHaveCount(5);
  await page.getByRole('button', {name:/^26 · 깜박이 회로 2/}).click();
  await expect(page.locator('.exercise-original')).toHaveAttribute('src', /\/26\.svg$/);
  await expect.poll(() => page.locator('.exercise-original').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1000);
  await page.getByRole('button', {name:/^4번 R1 · c–a 접점 도면에서 찾기$/}).click();
  await expect(page.locator('.contact-explanation')).toContainText('아래 점선에 전원을');
  await page.getByRole('button', {name:'이 선 연결하기',exact:true}).first().click();
  await expect(page.locator('.easy-progress')).toHaveText(/^배선 완료 1 \/ \d+가닥$/);
  await page.locator('.drawing-lesson').screenshot({path:testInfo.outputPath('alternating-lamps-drawing.png')});
  await page.getByRole('button', {name:'완성된 작업대 보기',exact:true}).click();
  const board=page.getByRole('dialog', {name:'완성된 작업대',exact:true});
  await expect(board.locator('[data-device="T2"]')).toContainText('OFF 지연');
  await expect(board.locator('[data-device="T2"]')).toContainText('설정 0.5초');
  await board.getByRole('switch', {name:'완성 작업대 전원'}).click();
  await board.getByRole('button', {name:'PB1 누르기'}).press('Space');
  const lamp1=board.locator('[data-device="LAMP1"]');
  const lamp2=board.locator('[data-device="LAMP2"]');
  await expect(lamp1).toHaveAttribute('data-active','true');
  await expect(lamp2).toHaveAttribute('data-active','true');
  await expect(lamp1).toHaveAttribute('data-active','true');
  await board.getByRole('button', {name:'PB2 누르기'}).press('Space');
  await expect(lamp1).toHaveAttribute('data-active','false');
  await expect(lamp2).toHaveAttribute('data-active','false');
});

test('tests the assembled 3-input workbench without replacing the learner wiring', async ({ page }) => {
  await page.goto('/#exercises');
  await page.locator('.exercise-catalog button').filter({ hasText: /^21 ·/ }).click();
  await page.getByRole('button', { name: '이 선 연결하기', exact: true }).first().click();
  await expect(page.locator('.easy-progress')).toHaveText('배선 완료 1 / 31가닥');

  const open = page.getByRole('button', { name: '완성된 작업대 보기', exact: true });
  await open.click();
  const completed = page.getByRole('dialog', { name: '완성된 작업대', exact: true });
  await expect(completed.getByRole('listitem')).toHaveCount(31);
  await expect.poll(() => completed.locator('[data-device="PB1"]').evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThan(100);
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

test('renders the motor photo and retains the wired forward and reverse operation', async ({ page }) => {
  await page.goto('/#exercises');
  await page.locator('.exercise-catalog button').filter({ hasText: /^24 ·/ }).click();
  await page.getByRole('button', { name: '완성된 작업대 보기', exact: true }).click();
  const completed = page.getByRole('dialog', { name: '완성된 작업대', exact: true });
  const motor = completed.locator('[data-device="M"]');
  const photo = motor.locator('img.asset-photo');
  await expect(photo).toHaveAttribute('src', /\/assets\/Motor\.png$/);
  await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1201);
  await expect(motor.locator('.react-flow__handle')).toHaveCount(2);
  await expect(motor.locator('.completed-motor')).toHaveCount(0);
  await completed.getByRole('switch', { name: '완성 작업대 전원' }).click();

  for (const [button, direction, animationDirection] of [
    ['PB1', 'CW', 'normal'], ['PB2', 'CCW', 'reverse'],
  ]) {
    await completed.getByRole('button', { name: `${button} 누르기` }).focus();
    await page.keyboard.down('Space');
    await expect(motor.locator('.completed-device-state')).toHaveText(direction);
    await expect(motor.locator('.completed-motor')).toHaveCSS('animation-direction', animationDirection);
    await page.keyboard.up('Space');
    await expect(motor.locator('.completed-device-state')).toHaveText('정지 / 개방');
  }
});
