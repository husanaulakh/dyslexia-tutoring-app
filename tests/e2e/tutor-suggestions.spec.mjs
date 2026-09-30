import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Student Scope & Sequence links a concept to its matching tutor suggestions', async ({ page }) => {
  await page.goto('/activities/student-progress.html');
  await page.getByLabel('Learner label (initials or code)').fill('AB');
  await page.getByRole('button', { name: 'Add student' }).click();
  const shortVowels = page.locator('.assessment-item').filter({ has: page.getByRole('heading', { name: 'Short vowel sounds' }) });
  await expect(shortVowels).toBeVisible();
  await shortVowels.getByRole('link', { name: 'Word suggestions' }).click();
  await expect(page).toHaveURL('/activities/tutor-suggestions.html?concept=l1-short-vowels');
  await expect(page.getByLabel('Observed skill or pattern')).toHaveValue('short-vowels');
  await expect(page.getByRole('heading', { name: 'Short vowel sounds' })).toBeVisible();
});

test('a concept link opens a tutor suggestion and adds its word set to Reading Words without starting practice', async ({ page }) => {
  await page.goto('/activities/tutor-suggestions.html?concept=l1-short-vowels');
  await expect(page.getByLabel('Observed skill or pattern')).toHaveValue('short-vowels');
  await expect(page.getByRole('heading', { name: 'Short vowel sounds' })).toBeVisible();
  await expect(page.locator('#suggestionWords li')).toHaveCount(10);
  await expect(page.locator('#suggestionObservation')).toContainText('may pause');
  await expect(page.locator('#suggestionReminder')).toContainText('short vowel');
  await page.getByRole('button', { name: 'Use this set in Reading Words' }).click();
  await expect(page).toHaveURL(/\/activities\/reading-words\.html\?list=suggested-short-vowels-[a-z0-9]+$/);
  await expect(page.getByLabel('Choose a list')).toHaveValue(/suggested-short-vowels-/);
  await expect(page.getByLabel('Words in this list')).toHaveValue('cat\nbed\nsit\nhop\ncup\nmap\nred\nfin\nhot\nsun');
  await expect(page.getByRole('heading', { name: 'Read the word' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Start reading' })).toBeVisible();
});

test('active lesson disables set handoff and leaves Reading Words lists untouched', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bright-steps-reading-word-lists', JSON.stringify([{ id: 'list-1', name: 'Existing', words: ['tap'] }]));
    sessionStorage.setItem('bright-steps-active-lesson', JSON.stringify({
      version: 1,
      template: { id: 'active-lesson', name: 'Current lesson', conceptIds: ['l1-short-vowels'], steps: [{ id: 'first', activityId: 'reading-words', responseMode: 'screen', settings: {} }] },
      studentId: 'student-1', index: 0, completedStepIds: [], startedAt: '2026-01-01T00:00:00.000Z',
    }));
  });
  await page.goto('/activities/tutor-suggestions.html?concept=l1-short-vowels');
  await expect(page.getByRole('button', { name: 'Use this set in Reading Words' })).toBeDisabled();
  await expect(page.locator('#activeLessonNote')).toContainText('End the active lesson');
  await expect(page.locator('#suggestionWords li')).toHaveCount(10);
  await expect(page).toHaveURL(/tutor-suggestions\.html/);
  const rawLists = await page.evaluate(() => localStorage.getItem('bright-steps-reading-word-lists'));
  expect(JSON.parse(rawLists)).toHaveLength(1);
});

test('suggestions handle storage errors, hostile concept query, keyboard controls, accessibility, and narrow screens', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'bright-steps-reading-word-lists') throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto('/activities/tutor-suggestions.html?concept=%3Cscript%3E');
  await expect(page.locator('#suggestionStatus')).toContainText('No word suggestion is linked');
  await page.getByLabel('Observed skill or pattern').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Short vowel sounds' })).toBeVisible();
  await page.getByRole('button', { name: 'Use this set in Reading Words' }).click();
  await expect(page.locator('#suggestionStatus')).toContainText('Browser storage is unavailable');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await expect(page.locator('#suggestionPanel img')).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 812 });
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map(item => item.id)).toEqual([]);
});
