import { expect, type Page } from '@playwright/test';
import { test, downloadCircuit, uploadCircuit, nandPreset } from './support';

async function center(page:Page) {
  await page.goto('/');
  await page.getByRole('link',{name:'계측·논리 학습 센터',exact:true}).click();
  await expect(page.getByRole('heading',{name:'계측·논리 학습 센터',exact:true})).toBeVisible();
}
const readSI=(text:string|null)=>{
  const match=text?.match(/^(-?[\d.]+)\s*([kMµmn]?)/);if(!match)return NaN;
  return Number(match[1])*({k:1000,M:1e6,'µ':1e-6,m:1e-3,n:1e-9}[match[2]]??1);
};

test('measures analog sine, AC coupling and physical/menu probe attenuation',async({page})=>{
  await center(page);
  await page.getByRole('button',{name:'정현파 예제',exact:true}).click();
  await expect.poll(async()=>readSI(await page.getByTestId('scope-ch1-frequency').textContent())).toBeGreaterThan(990);
  await expect.poll(async()=>readSI(await page.getByTestId('scope-ch1-frequency').textContent())).toBeLessThan(1010);
  await expect.poll(async()=>readSI(await page.getByTestId('scope-ch1-vpp').textContent())).toBeGreaterThan(3.98);
  await expect.poll(async()=>readSI(await page.getByTestId('scope-ch1-rms').textContent())).toBeGreaterThan(1.40);
  await page.getByLabel('CH1 DC 오프셋 (V)',{exact:true}).fill('1');
  await expect.poll(async()=>readSI(await page.getByTestId('scope-ch1-mean').textContent())).toBeGreaterThan(.98);
  await expect.poll(async()=>readSI(await page.getByTestId('scope-ch1-max').textContent())).toBeGreaterThan(2.98);
  await page.getByLabel('CH1 결합',{exact:true}).selectOption('AC');
  await expect.poll(async()=>Math.abs(readSI(await page.getByTestId('scope-ch1-mean').textContent()))).toBeLessThan(.03);
  await page.getByLabel('CH1 실제 프로브 배율',{exact:true}).selectOption('10');
  await expect.poll(async()=>readSI(await page.getByTestId('scope-ch1-vpp').textContent())).toBeLessThan(.41);
  await expect(page.getByText(/실제 프로브와 메뉴의 배율이 달라/)).toBeVisible();
  await page.getByLabel('CH1 메뉴 배율',{exact:true}).selectOption('10');
  await expect.poll(async()=>readSI(await page.getByTestId('scope-ch1-vpp').textContent())).toBeGreaterThan(3.98);
});

test('measures wired TTL nodes against REF and leaves disconnected/off signals as gaps',async({page})=>{
  await center(page);await nandPreset(page);
  await page.getByRole('switch',{name:'메인 전원',exact:true}).click();
  await page.getByRole('link',{name:'계측·논리 학습 센터',exact:true}).click();
  await expect.poll(async()=>readSI(await page.getByTestId('scope-ch2-mean').textContent())).toBeGreaterThan(4.99);
  await expect.poll(async()=>Math.abs(readSI(await page.getByTestId('scope-ch1-mean').textContent()))).toBeLessThan(.01);
  await page.locator('[data-id="input-a"] .device-control').click();
  await page.locator('[data-id="input-b"] .device-control').click();
  await expect.poll(async()=>Math.abs(readSI(await page.getByTestId('scope-ch2-mean').textContent()))).toBeLessThan(.01);
  await page.getByRole('switch',{name:'메인 전원',exact:true}).click();
  await expect(page.getByTestId('scope-ch2-mean')).toHaveText('—');
});

test('waits on NORMAL, supports FORCE, freezes SINGLE and exports real samples',async({page})=>{
  await center(page);await page.getByRole('button',{name:'정현파 예제',exact:true}).click();
  const status=page.locator('.scope-live-status');
  await expect(status).toHaveAttribute('data-capture-time',/\d/);
  await page.getByLabel('트리거 모드',{exact:true}).selectOption('normal');
  await page.getByLabel('트리거 레벨 (V)',{exact:true}).fill('20');
  await expect(status).toContainText('WAIT');
  const before=await status.getAttribute('data-capture-time');
  await page.getByRole('button',{name:'FORCE 강제 트리거',exact:true}).click();
  await expect(status).not.toHaveAttribute('data-capture-time',before!);
  await page.getByLabel('트리거 레벨 (V)',{exact:true}).fill('0');
  await page.getByRole('button',{name:'SINGLE 단발 측정',exact:true}).click();
  await expect(page.getByRole('button',{name:'측정 RUN',exact:true})).toBeVisible();
  await expect(status).toContainText(/STOP|SINGLE 완료/);
  const csv=async()=>{
    const pending=page.waitForEvent('download');await page.getByRole('button',{name:'측정 CSV 저장',exact:true}).click();
    const download=await pending,stream=await download.createReadStream();const parts:Buffer[]=[];for await(const part of stream)parts.push(Buffer.from(part));return Buffer.concat(parts).toString('utf8');
  };
  const first=await csv();expect(first.split('\n')).toHaveLength(1025);expect(first).toContain('time_s,CH1_V,CH2_V');
  await page.getByLabel('CH1 주파수 (Hz)',{exact:true}).fill('2000');
  expect(await csv()).toBe(first);
  const png=page.waitForEvent('download');await page.getByRole('button',{name:'파형 PNG 저장',exact:true}).click();expect((await png).suggestedFilename()).toBe('scope-screen.png');
  await page.getByRole('button',{name:'측정 RUN',exact:true}).click();
  await expect.poll(async()=>readSI(await page.getByTestId('scope-ch1-frequency').textContent())).toBeGreaterThan(1980);
});

test('operates square duty, FFT, XY, cursors and saved scope configuration',async({page})=>{
  await center(page);await page.getByRole('button',{name:'구형파 예제',exact:true}).click();
  await page.getByLabel('CH1 듀티 (%)',{exact:true}).fill('25');
  await expect.poll(async()=>readSI(await page.getByTestId('scope-ch1-duty').textContent())).toBeGreaterThan(24);
  await expect.poll(async()=>readSI(await page.getByTestId('scope-ch1-duty').textContent())).toBeLessThan(26);
  await page.getByLabel('파형 표시 형식',{exact:true}).selectOption('fft');
  await expect(page.locator('.scope-live-status')).toHaveAttribute('data-capture-time',/\d/);
  await page.getByRole('button',{name:'90° 위상차 · XY 예제',exact:true}).click();
  await expect(page.getByLabel('파형 표시 형식',{exact:true})).toHaveValue('xy');
  await page.getByLabel('파형 표시 형식',{exact:true}).selectOption('yt');
  await page.getByRole('checkbox',{name:'커서 표시',exact:true}).check();
  const x1=page.getByLabel('X1',{exact:true});await x1.focus();await x1.press('Home');
  const x2=page.getByLabel('X2',{exact:true});await x2.focus();await x2.press('End');
  await expect(page.locator('.lesson-result').filter({hasText:'Δt'})).toContainText('2 ms');
  const screen=page.locator('.scope-expanded canvas');await screen.scrollIntoViewIfNeeded();
  const rect=(await screen.boundingBox())!;
  await page.mouse.move(rect.x+rect.width*.058,rect.y+rect.height*.5);await page.mouse.down();
  await page.mouse.move(rect.x+rect.width*(.058+.922*.4),rect.y+rect.height*.5,{steps:4});await page.mouse.up();
  await expect.poll(async()=>Number(await x1.inputValue())).toBeGreaterThan(.39);
  await expect.poll(async()=>Number(await x1.inputValue())).toBeLessThan(.41);
  await page.getByRole('button',{name:'현재 파형 REF 저장',exact:true}).click();
  await expect(screen).toHaveAttribute('data-reference','ch1');
  await page.getByRole('checkbox',{name:'REF 기준 파형 표시',exact:true}).uncheck();
  await expect(screen).toHaveAttribute('data-reference','');
  await page.getByRole('checkbox',{name:'REF 기준 파형 표시',exact:true}).check();
  const saved=await downloadCircuit(page);expect(JSON.stringify(saved)).toContain('"scope"');
  await page.getByRole('button',{name:'계측 설정 초기화',exact:true}).click();
  await expect(page.getByLabel('CH1 입력 소스',{exact:true})).toHaveValue('probe');
  await uploadCircuit(page,saved);
  await expect(page.getByLabel('CH1 입력 소스',{exact:true})).toHaveValue('generator');
  await expect(page.getByRole('checkbox',{name:'커서 표시',exact:true})).toBeChecked();
});

test('uses photographed scope buttons and a keyboard-operated timebase dial',async({page})=>{
  await center(page);await page.getByRole('tab',{name:'디지털 회로',exact:true}).click();
  await page.getByRole('button',{name:'정현파 예제',exact:true}).click();
  const dial=page.locator('[data-id="dig-scope"]').getByLabel('시간축 다이얼',{exact:true});
  await dial.focus();await dial.press('Home');
  await expect(page.getByLabel('TIME/DIV',{exact:true})).toHaveValue('0.00001');
  await page.locator('[data-id="dig-scope"]').getByRole('button',{name:'AUTO 자동 설정',exact:true}).click();
  await expect(page.getByLabel('TIME/DIV',{exact:true})).not.toHaveValue('0.00001');
  await page.locator('[data-id="dig-scope"]').getByRole('button',{name:'CURSOR 커서',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'커서 표시',exact:true})).toBeChecked();
});

test('groups four wrapping corners and compares a minimum SOP answer',async({page})=>{
  await center(page);await page.getByRole('tab',{name:'카르노 맵',exact:true}).click();
  await page.getByLabel('카르노 예제',{exact:true}).selectOption('corners');
  await page.getByRole('button',{name:'묶음 선택 모드',exact:true}).click();
  for(const index of [0,2,8,10])await page.getByRole('button',{name:`카르노 셀 m${index}: 1`,exact:true}).click();
  await page.getByRole('button',{name:'선택 칸 묶기',exact:true}).click();
  await expect(page.locator('.kmap-groups')).toContainText('¬B·¬D');
  await page.getByRole('button',{name:'내 묶음 검사',exact:true}).click();
  await expect(page.locator('.karnaugh-lesson .lesson-result')).toContainText('모든 1을 덮었습니다');
  await page.getByRole('button',{name:'자동 간소화 보기',exact:true}).click();
  await expect(page.getByTestId('kmap-expression')).toHaveText('F = ¬B·¬D');
});

test('rejects diagonal groups and provides POS and dont-care examples',async({page})=>{
  await center(page);await page.getByRole('tab',{name:'카르노 맵',exact:true}).click();
  await page.getByLabel('카르노 예제',{exact:true}).selectOption('XNOR');
  await page.getByRole('button',{name:'묶음 선택 모드',exact:true}).click();
  for(const index of [0,3])await page.getByRole('button',{name:`카르노 셀 m${index}: 1`,exact:true}).click();
  await page.getByRole('button',{name:'선택 칸 묶기',exact:true}).click();
  await expect(page.locator('.karnaugh-lesson .lesson-result')).toContainText('대각선');
  await page.getByLabel('카르노 예제',{exact:true}).selectOption('OR');
  await page.getByLabel('카르노 간소화 형식',{exact:true}).selectOption('pos');
  await page.getByRole('button',{name:'자동 간소화 보기',exact:true}).click();
  await expect(page.getByTestId('kmap-expression')).toHaveText('F = (A + B)');
  await page.getByLabel('카르노 예제',{exact:true}).selectOption('dontcare');
  await page.getByRole('button',{name:'자동 간소화 보기',exact:true}).click();
  await expect(page.getByTestId('kmap-expression')).toHaveText('F = ¬B');
});

test('draws and grades a NAND timing chart, then switches to custom logic and delay',async({page})=>{
  await center(page);await page.getByRole('tab',{name:'타임 차트',exact:true}).click();
  await page.getByRole('button',{name:'모든 입력 조합 채우기',exact:true}).click();
  for(let i=0;i<8;i++){
    const button=page.getByRole('button',{name:`내 출력 t${i}: X`,exact:true});await button.click();
    if(i%4!==3)await page.getByRole('button',{name:`내 출력 t${i}: 0`,exact:true}).click();
  }
  await page.getByRole('button',{name:'내 타임 차트 채점',exact:true}).click();
  await expect(page.getByTestId('timing-score')).toContainText('100점');
  await page.getByLabel('타임 차트 논리회로',{exact:true}).selectOption('custom');
  await page.getByLabel('타임 차트 논리식',{exact:true}).fill('!(A & B) | C');
  await expect(page.getByRole('button',{name:'입력 C t0: 0',exact:true})).toBeVisible();
  await expect(page.getByTestId('timing-score')).toHaveCount(0);
  await page.getByLabel('전파 지연',{exact:true}).fill('0.5');
  await page.getByRole('checkbox',{name:'7가지 게이트 출력 동시에 비교',exact:true}).check();
  const chart=page.getByRole('img',{name:'입력과 논리 출력의 타임 차트',exact:true});
  for(const gate of ['AND','OR','NOT','NAND','NOR','XOR','XNOR'])await expect(chart.getByText(gate,{exact:true})).toBeVisible();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'타임 차트 SVG 저장',exact:true}).click();
  const file=await pending,stream=await file.createReadStream(),chunks:Buffer[]=[];for await(const part of stream)chunks.push(Buffer.from(part));
  const svg=Buffer.concat(chunks).toString('utf8');expect(svg).toContain('<svg');expect(svg).not.toContain('var(--theme');
  await page.getByLabel('타임 차트 논리식',{exact:true}).fill('A || B');
  await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'내 타임 차트 채점',exact:true})).toBeDisabled();
});

test('keeps learning tools usable in dark mode and on a narrow screen',async({page},testInfo)=>{
  await center(page);await page.getByLabel('화면 테마',{exact:true}).selectOption('dark');
  await page.getByRole('button',{name:'정현파 예제',exact:true}).click();
  await page.locator('#learning-center').screenshot({path:testInfo.outputPath('learning-scope-dark.png')});
  await page.getByRole('tab',{name:'카르노 맵',exact:true}).click();
  await page.getByLabel('카르노 예제',{exact:true}).selectOption('corners');
  await page.getByRole('button',{name:'자동 간소화 보기',exact:true}).click();
  await page.getByRole('button',{name:'자동 묶음 표시',exact:true}).click();
  await page.locator('#learning-center').screenshot({path:testInfo.outputPath('learning-kmap-dark.png')});
  await page.getByRole('tab',{name:'타임 차트',exact:true}).click();
  await page.getByRole('checkbox',{name:'7가지 게이트 출력 동시에 비교',exact:true}).check();
  await page.locator('#learning-center').screenshot({path:testInfo.outputPath('learning-timing-dark.png')});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('tab',{name:'타임 차트',exact:true}).click();
  await expect(page.getByRole('button',{name:'내 타임 차트 채점',exact:true})).toBeVisible();
  const widths=await page.evaluate(()=>({viewport:window.innerWidth,body:document.body.scrollWidth}));
  expect(widths.body).toBeLessThanOrEqual(widths.viewport+2);
});
