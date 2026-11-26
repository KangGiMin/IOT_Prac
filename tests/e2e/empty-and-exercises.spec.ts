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
test('includes every source image, classifies all 24 exercises and tests reference wiring',async({page},testInfo)=>{
 test.setTimeout(90000);await page.goto('/#exercises');await expect(page.getByRole('heading',{name:'연습문제 · 시퀀스 도면 24선'})).toBeVisible();
 for(let id=1;id<=24;id++){
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
