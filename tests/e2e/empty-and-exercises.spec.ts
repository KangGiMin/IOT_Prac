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
 }
 await page.getByRole('button',{name:'배선 초기화',exact:true}).click();await page.getByRole('button',{name:'배선 동작 자동 테스트',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'단계 일치'})).toContainText('배선과 접점 종류');
 await page.locator('.exercise-catalog button').filter({hasText:/^04 ·/}).click();await page.getByRole('checkbox',{name:/수정안과 비교/}).check();await expect(page.locator('.exercise-bench h3')).toContainText('수정안');
 await page.screenshot({path:testInfo.outputPath('exercise-page.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.body.scrollWidth)).toBeLessThanOrEqual(392);
});
