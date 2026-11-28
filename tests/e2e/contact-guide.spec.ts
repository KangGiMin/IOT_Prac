import { expect } from '@playwright/test';
import { test } from './support';
test('shows contacts on every diagram and guides real terminal wiring without internal codes', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await page.goto('/#exercises');
  for (let id = 1; id <= 26; id++) {
    await page
      .locator('.exercise-catalog button')
      .filter({ hasText: new RegExp('^' + String(id).padStart(2, '0') + ' ·') })
      .click();
    await expect(page.getByTestId('contact-overlay')).toBeVisible();
    expect(await page.locator('.drawing-contact').count()).toBeGreaterThan(0);
    expect(await page.locator('.easy-wiring-steps').textContent()).not.toMatch(/[CJ]\d+:/);
  }
  await page.locator('.exercise-catalog button').filter({ hasText: /^20 ·/ }).click();
  await page.locator('.drawing-contact[data-contact="drawing-20-contact-3"]').click();
  await expect(page.locator('.contact-explanation')).toContainText('동작하면');
  await expect(page.locator('.drawing-contact.is-focused')).toHaveCount(1);
  await page.getByRole('checkbox', { name: '접점 이름 표시', exact: true }).uncheck();
  await expect(page.getByTestId('contact-overlay')).toHaveCount(0);
  await page
    .locator('.easy-wiring-steps li')
    .first()
    .getByRole('button', { name: '이 접점 도면에서 보기', exact: true })
    .click();
  await expect(page.getByTestId('contact-overlay')).toBeVisible();
  await expect(page.locator('.drawing-contact.is-focused')).toHaveCount(1);
  const cards = page.locator('.easy-wiring-steps li');
  for (let i = 0; i < (await cards.count()); i++) {
    const add = cards.nth(i).getByRole('button', { name: '이 선 연결하기', exact: true });
    if (await add.count()) await add.click();
  }
  await page.getByRole('button', { name: '배선 동작 자동 테스트', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '단계 일치' })).toContainText(
    '원본 해석과 일치',
  );
  await page.locator('.drawing-contact[data-contact="drawing-20-contact-4"]').click();
  await page
    .locator('.drawing-lesson')
    .screenshot({ path: testInfo.outputPath('easy-guide-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('도면 확대', { exact: true }).fill('180');
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(392);
  await page
    .locator('.drawing-column')
    .screenshot({ path: testInfo.outputPath('easy-guide-mobile.png') });
});
