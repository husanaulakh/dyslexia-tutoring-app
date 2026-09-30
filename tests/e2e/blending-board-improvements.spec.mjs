import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Blending Board supports two and six spelling tiles and reports invalid manual splits', async ({ page }) => {
  await page.goto('/activities/blending-board.html');
  await expect(page.locator('#currentWord')).toHaveText('fan');
  await page.getByLabel('Single word').fill('black');
  await page.getByLabel('Spelling tile split').fill('b l a k');
  await page.getByRole('button', { name: 'Add word' }).click();
  await expect(page.locator('#feedback')).toContainText('Invalid spelling tile split');
  await expect(page.locator('#dictionary')).not.toContainText('black');
  await page.getByLabel('Spelling tile split').fill('b l a ck');
  await page.getByRole('button', { name: 'Add word' }).click();
  await expect(page.locator('#currentWord')).toHaveText('black');
  await expect(page.locator('.card')).toHaveCount(4);
  await expect(page.locator('.card').nth(3)).toHaveAttribute('aria-label', 'Spelling tile 4: ck');

  await page.getByLabel('Single word').fill('at');
  await page.getByLabel('Spelling tile split').fill('a t');
  await page.getByRole('button', { name: 'Add word' }).click();
  await expect(page.locator('#currentWord')).toHaveText('at');
  await expect(page.locator('.card')).toHaveCount(2);

  await page.getByLabel('Single word').fill('scrunch');
  await page.getByLabel('Spelling tile split').fill('s c r u n ch');
  await page.getByRole('button', { name: 'Add word' }).click();
  await expect(page.locator('#currentWord')).toHaveText('scrunch');
  await expect(page.locator('.card')).toHaveCount(6);
});

test('Blending Board requires tutor confirmation for suggested splits and preserves old saved words', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('blending-board-words-standalone')) localStorage.setItem('blending-board-words-standalone', JSON.stringify([
      { word: 'old', chunks: ['o','l','d'], lessonTag: 'current' },
    ]));
  });
  await page.goto('/activities/blending-board.html');
  await expect(page.locator('#dictionary')).toContainText('old');
  await expect(page.locator('#currentWord')).toHaveText('old');
  await page.getByLabel('Single word').fill('whip');
  await expect(page.locator('#preview')).toContainText('whip: wh · i · p');
  await page.getByRole('button', { name: 'Add word' }).click();
  await expect(page.locator('#feedback')).toContainText('confirm them before adding');
  await expect(page.locator('#dictionary')).not.toContainText('whip');
  await page.getByRole('button', { name: 'Tutor: confirm suggested split' }).click();
  await page.getByRole('button', { name: 'Add word' }).click();
  await expect(page.locator('#dictionary')).toContainText('whip');
  const savedWords = await page.evaluate(() => JSON.parse(localStorage.getItem('blending-board-words-standalone')));
  expect(savedWords.map(item => item.word)).toContain('whip');
  await page.reload();
  const reloadedWords = await page.evaluate(() => JSON.parse(localStorage.getItem('blending-board-words-standalone')));
  expect(reloadedWords.map(item => item.word)).toContain('whip');
  await expect(page.locator('#dictionary')).toContainText('old');
  await expect(page.locator('#dictionary')).toContainText('whip');
});

test('Blending Board suggested bulk tiles require one visible tutor confirmation and tiles work from keyboard', async ({ page }) => {
  await page.goto('/activities/blending-board.html');
  await page.getByLabel('Bulk add').fill('think');
  await page.getByRole('button', { name: 'Review bulk suggestions' }).click();
  await expect(page.locator('#feedback')).toContainText('think: th · i · n · k');
  await expect(page.locator('#dictionary')).not.toContainText('think');
  await page.getByRole('button', { name: 'Confirm suggested splits and add words' }).click();
  await expect(page.locator('#dictionary')).toContainText('think');
  await page.getByRole('button', { name: '3 spelling tiles' }).click();
  const before = await page.locator('#currentWord').textContent();
  await page.getByRole('button', { name: /Spelling tile 1:/ }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#currentWord')).not.toHaveText(before);
});

test('Blending Board rejects hostile input and fits a narrow accessible viewport', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('blending-board-words-standalone', JSON.stringify([
    { word: '<img src=x onerror=window.__xss=true>', chunks: ['img','src','x','onerror'] },
  ])));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/activities/blending-board.html');
  await expect(page.locator('#currentWord')).toHaveText('fan');
  await page.getByLabel('Single word').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('#singleWord')).toHaveValue(/^[a-z]{0,12}$/);
  await page.locator('#addSingle').click();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await expect(page.locator('#dictionary img')).toHaveCount(0);
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
});
