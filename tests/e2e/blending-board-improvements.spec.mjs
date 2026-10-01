import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Blending Board supports two and six spelling tiles and reports invalid manual splits', async ({ page }) => {
  await page.goto('/activities/blending-board.html');
  await expect(page.locator('#currentWord')).toHaveText('fan');
  await page.locator('#toolsDisclosure > summary').click();
  await page.locator('#toolsDisclosure .nested-disclosure').nth(0).locator('summary').click();
  await page.getByLabel('Single word').fill('black');
  await page.getByLabel('Spelling tile split').fill('b l a k');
  await page.getByRole('button', { name: 'Add word' }).click();
  await expect(page.locator('#singleFeedback')).toContainText('Invalid spelling tile split');
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
  await page.locator('#dictionaryDisclosure > summary').click();
  await expect(page.locator('#dictionary')).toContainText('old');
  await expect(page.locator('#currentWord')).toHaveText('old');
  await page.locator('#toolsDisclosure > summary').click();
  await page.locator('#toolsDisclosure .nested-disclosure').nth(0).locator('summary').click();
  await page.getByLabel('Single word').fill('whip');
  await expect(page.locator('#preview')).toContainText('whip: wh · i · p');
  await page.getByRole('button', { name: 'Add word' }).click();
  await expect(page.locator('#singleFeedback')).toContainText('confirm them before adding');
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
  await page.locator('#toolsDisclosure > summary').click();
  await page.locator('#toolsDisclosure .nested-disclosure').nth(1).locator('summary').click();
  await page.getByLabel('Bulk add').fill('think');
  await page.getByRole('button', { name: 'Review bulk suggestions' }).click();
  await expect(page.locator('#bulkPreview')).toContainText('think: th · i · n · k');
  await expect(page.locator('#dictionary')).not.toContainText('think');
  await page.getByRole('button', { name: 'Confirm suggested splits and add words' }).click();
  await expect(page.locator('#dictionary')).toContainText('think');
  await page.locator('#dictionaryDisclosure > summary').click();
  await page.locator('#filterDisclosure > summary').click();
  await page.getByRole('button', { name: '3 spelling tiles' }).click();
  const before = await page.locator('#currentWord').textContent();
  await page.getByRole('button', { name: /Spelling tile 1:/ }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#currentWord')).not.toHaveText(before);
  await expect(page.getByRole('button', { name: /Spelling tile 1:/ })).toBeFocused();
});

test('Blending Board rejects hostile input and fits a narrow accessible viewport', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('blending-board-words-standalone', JSON.stringify([
    { word: '<img src=x onerror=window.__xss=true>', chunks: ['img','src','x','onerror'] },
  ])));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/activities/blending-board.html');
  await expect(page.locator('#currentWord')).toHaveText('fan');
  await page.locator('#toolsDisclosure > summary').click();
  await page.locator('#toolsDisclosure .nested-disclosure').nth(0).locator('summary').click();
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

test('Blending Board uses Builder word IDs and a validated lesson tile-count filter', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('bright-steps-active-lesson', JSON.stringify({
    version: 1, runId: 'run-board-filter', studentId: 'learner-1', index: 0, completedStepIds: [], startedAt: new Date().toISOString(),
    template: { id: 'lesson-board-filter', name: 'Board filter', conceptIds: [], steps: [
      { id: 'step-board', activityId: 'blending-board', responseMode: 'screen', settings: { wordIds: ['frog', 'fan'], tileCount: 4 } },
    ] },
  })));
  await page.goto('/activities/blending-board.html');
  await expect(page.locator('#currentWord')).toHaveText('frog');
  await expect(page.locator('#modeBadge')).toContainText('4 spelling tiles');
  await expect(page.locator('.card')).toHaveCount(4);
});

test('Blending Board does not overwrite malformed existing storage', async ({ page }) => {
  const original = '{broken saved dictionary';
  await page.addInitScript(value => localStorage.setItem('blending-board-words-standalone', value), original);
  await page.goto('/activities/blending-board.html');
  await expect(page.locator('#feedback')).toContainText('existing saved data will not be overwritten');
  await page.locator('#toolsDisclosure > summary').click();
  await page.locator('#toolsDisclosure .nested-disclosure').nth(0).locator('summary').click();
  await page.getByLabel('Single word').fill('zap');
  await page.getByLabel('Spelling tile split').fill('z a p');
  await page.getByRole('button', { name: 'Add word' }).click();
  await expect(page.locator('#dictionary')).toContainText('zap');
  expect(await page.evaluate(() => localStorage.getItem('blending-board-words-standalone'))).toBe(original);
});

test('Blending Board starts uncluttered and its tutor disclosures work by keyboard on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/activities/blending-board.html');
  for (const id of ['filterDisclosure', 'toolsDisclosure', 'dictionaryDisclosure', 'promptDisclosure']) {
    await expect(page.locator(`#${id}`)).not.toHaveAttribute('open', '');
  }
  await expect(page.getByRole('button', { name: 'Next word' })).toBeVisible();
  await expect(page.locator('#singleWord')).toBeHidden();
  await expect(page.locator('#dictionaryDisclosure')).not.toHaveAttribute('open', '');

  const editorSummary = page.locator('#toolsDisclosure > summary');
  await editorSummary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#toolsDisclosure')).toHaveAttribute('open', '');
  const singleSummary = page.locator('#toolsDisclosure .nested-disclosure').nth(0).locator('summary');
  await singleSummary.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Single word')).toBeVisible();
  await expect(singleSummary).toBeFocused();

  await page.locator('#promptDisclosure > summary').focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Show prompt on the board').check();
  await expect(page.locator('#prompt')).toBeVisible();
  await expect(page.locator('#prompt')).toContainText('Read the tiles, then blend');

  const dimensions = await page.evaluate(() => {
    const targets = [...document.querySelectorAll('.home-link, summary, button')]
      .filter(node => node.getClientRects().length)
      .map(node => ({ label: node.textContent.trim(), height: node.getBoundingClientRect().height }));
    return { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, targets };
  });
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  expect(dimensions.targets.filter(target => target.height < 44)).toEqual([]);
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
});

test('Blending Board keeps bulk split review beside confirmation on a short mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/activities/blending-board.html');
  const editor = page.locator('#toolsDisclosure > summary');
  await editor.focus();
  await page.keyboard.press('Enter');
  const bulk = page.locator('#toolsDisclosure .nested-disclosure').nth(1).locator('summary');
  await bulk.focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Bulk add').fill('ship whip');
  const reviewButton = page.getByRole('button', { name: 'Review bulk suggestions' });
  await reviewButton.focus();
  await page.keyboard.press('Enter');

  const review = page.locator('#bulkPreview');
  const confirm = page.getByRole('button', { name: 'Confirm suggested splits and add words' });
  await expect(review).toBeVisible();
  await expect(review).toContainText('ship: sh · i · p');
  await expect(review).toContainText('whip: wh · i · p');
  await expect(confirm).toBeVisible();
  await expect(review).toBeInViewport();
  await expect(confirm).toBeInViewport();
  const reviewBox = await review.boundingBox();
  const confirmBox = await confirm.boundingBox();
  expect(reviewBox.y + reviewBox.height).toBeLessThanOrEqual(confirmBox.y + 2);
  await page.keyboard.press('Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#bulkFeedback')).toContainText('Tutor-confirmed and added 1 word; updated 1');
});
