import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Auditory Dictation hides tutor prompt and answer until requested, then saves aggregate outcome only', async ({ page }) => {
  await page.goto('/activities/auditory-dictation.html');
  await page.getByLabel('Learner label (initials or code)').fill('AD1');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Practice set').selectOption('words');
  await page.getByRole('button', { name: 'Start dictation' }).click();
  await expect(page.locator('#itemKind')).toHaveText('Word dictation');
  await expect(page.locator('#prompt')).toBeHidden();
  await expect(page.locator('#answerSpellings')).toBeEmpty();
  await page.getByRole('button', { name: 'Show tutor prompt' }).click();
  await expect(page.locator('#prompt')).toContainText('Say the word map');
  await page.getByLabel('Learner response').fill('map');
  await page.getByRole('button', { name: 'Reveal accepted spelling' }).click();
  await expect(page.locator('#answerSpellings')).toHaveText('map');
  await expect(page.locator('#practiceStatus')).toContainText('matches an accepted spelling');
  await page.getByRole('button', { name: 'With help' }).click();
  await page.getByRole('button', { name: 'Finish item and continue' }).click();
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('button', { name: 'Reveal accepted spelling' }).click();
    await page.getByRole('button', { name: 'Independent' }).click();
    await page.getByRole('button', { name: 'Finish item and continue' }).click();
  }
  const store = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-student-progress')));
  expect(store.sessions.at(-1)).toMatchObject({ activity: 'auditory-dictation', completedItems: 4, totalItems: 4, outcomeCounts: { independent: 3, supported: 1, revisit: 0 } });
  expect(JSON.stringify(store)).not.toContain('map');
});

test('Auditory Dictation paper mode hides response entry and marks tutor outcome after reveal', async ({ page }) => {
  await page.goto('/activities/auditory-dictation.html');
  await page.getByLabel('Practice set').selectOption('sounds');
  await page.getByLabel('Response mode').selectOption('paper');
  await page.getByRole('button', { name: 'Start dictation' }).click();
  await expect(page.locator('#typedResponse')).toBeHidden();
  await expect(page.locator('#paperHelp')).toBeVisible();
  await page.getByRole('button', { name: 'Reveal accepted spelling' }).click();
  await expect(page.locator('#answerSpellings')).toHaveText('a');
  await page.getByRole('button', { name: 'Independent' }).click();
  await page.getByRole('button', { name: 'Finish item and continue' }).click();
  await expect(page.locator('#progressText')).toHaveText('Item 2 of 4');
});

test('Auditory Dictation has no accessibility violations and fits a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/activities/auditory-dictation.html');
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
  const dims = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dims.scroll).toBeLessThanOrEqual(dims.client);
});
