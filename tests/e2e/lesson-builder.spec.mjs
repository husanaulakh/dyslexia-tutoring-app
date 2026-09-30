import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Lesson Builder creates an ordered template, reloads it, starts and resumes the learner-pinned lesson', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.getByLabel('Learner label (initials or code)').fill('L-01');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Template name').fill('Short vowel review');
  await page.getByText('Level 1 · Basic OG', { exact: true }).click();
  await page.getByLabel('Short vowel sounds').check();

  await page.getByLabel('Practice activity').selectOption('visual-drill-cards');
  await page.getByLabel('Response mode').selectOption('paper');
  const cards = page.getByLabel('Activity item selection');
  await cards.selectOption({ index: 0 });
  await page.getByRole('button', { name: 'Add step' }).click();

  await page.getByLabel('Practice activity').selectOption('reading-words');
  await page.getByLabel('Response mode').selectOption('screen');
  await page.getByLabel('Word/list selection').selectOption('list-1');
  await page.getByRole('button', { name: 'Add step' }).click();
  await expect(page.locator('#lessonSteps [data-step-id]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Move Reading Words up' }).click();
  await expect(page.locator('#lessonSteps [data-step-id]').first()).toContainText('Reading Words');

  await page.getByRole('button', { name: 'Save template' }).click();
  await expect(page.locator('#builderStatus')).toContainText('Template saved');
  await page.reload();
  await page.getByLabel('Saved templates').selectOption({ label: 'Short vowel review' });
  await page.getByRole('button', { name: 'Load template' }).click();
  await expect(page.locator('#lessonSteps [data-step-id]').first()).toContainText('Reading Words');
  await expect(page.getByLabel('Short vowel sounds')).toBeChecked();
  await expect(page.locator('#lessonSteps [data-step-id]')).toHaveCount(2);

  await page.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page).toHaveURL(/\/activities\/reading-words\.html$/);
  await expect(page.locator('#lessonToolbar')).toContainText('Short vowel review');
  await expect(page.locator('#lessonToolbar')).toContainText('L-01');
  await expect(page.locator('#lessonToolbar')).toContainText('Step 1 of 2');
  await expect(page.getByLabel('Current student')).toBeDisabled();
  await expect(page.getByLabel('Learner label (initials or code)')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Finish step' })).toBeEnabled();
  await page.getByRole('button', { name: 'Finish step' }).click();
  await expect(page).toHaveURL(/\/activities\/visual-drill-cards\.html$/);
  await expect(page.locator('#lessonToolbar')).toContainText('Step 2 of 2');

  await page.goto('/activities/lesson-builder.html');
  await expect(page.getByRole('button', { name: 'Resume lesson · Short vowel review' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume lesson · Short vowel review' }).click();
  await expect(page).toHaveURL(/\/activities\/visual-drill-cards\.html$/);
  await expect(page.locator('#lessonToolbar')).toContainText('Step 2 of 2');
});

test('Lesson Builder rejects hostile text safely, handles storage failures, keyboard use, and narrow layout', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bright-steps-reading-word-lists', JSON.stringify([
      { id: 'safe-list', name: '<img src=x onerror=window.__xss=true>', words: ['cat'] },
    ]));
  });
  await page.goto('/activities/lesson-builder.html');
  await page.getByLabel('Practice activity').selectOption('reading-words');
  await expect(page.getByLabel('Word/list selection')).toContainText('img src=x onerror=window.__xss=true');
  await expect(page.locator('#conceptPicker img')).toHaveCount(0);
  await expect(page.getByLabel('Learner label (initials or code)')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();

  await page.setViewportSize({ width: 375, height: 812 });
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map(item => item.id)).toEqual([]);
});

test('Lesson Builder reports failed local template writes', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'bright-steps-lesson-templates') throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto('/activities/lesson-builder.html');
  await page.getByLabel('Template name').fill('Storage error case');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByRole('button', { name: 'Save template' }).click();
  await expect(page.locator('#builderStatus')).toContainText('Browser storage is unavailable');
});
