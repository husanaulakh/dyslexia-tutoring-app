import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const storeKey = 'bright-steps-student-progress';

async function installPaperLesson(page, word = 'ship') {
  await page.addInitScript(({ storeKey, word }) => {
    localStorage.setItem(storeKey, JSON.stringify({
      schemaVersion: 3,
      students: [{ id: 'lesson-learner', name: 'T1' }],
      selectedStudentId: 'lesson-learner', sessions: [], assessment: [],
    }));
    sessionStorage.setItem('bright-steps-active-lesson', JSON.stringify({
      version: 1,
      template: {
        id: 'paper-lesson', name: 'Paper spelling', conceptIds: ['l1-short-vowel-spelling'],
        steps: [{ id: 'step-1', activityId: 'trace-copy-cover-close', responseMode: 'paper', settings: { word } }],
      },
      studentId: 'lesson-learner', index: 0, completedStepIds: [], startedAt: new Date().toISOString(),
    }));
  }, { storeKey, word });
}

test('TCCC lesson paper mode confirms Copy and Cover, skips timed tracing with reduced motion, and saves only completion', async ({ page }) => {
  await installPaperLesson(page, 'ship');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/activities/trace-copy-cover-close.html');
  await expect(page.locator('#targetWord')).toHaveValue('ship');
  await expect(page.locator('#wordForm')).toContainText('paper and tutor confirmation');
  await page.getByRole('button', { name: 'Begin this word' }).click();
  await page.getByRole('button', { name: 'Tutor confirms', exact: true }).click();
  for (let i = 1; i <= 4; i += 1) {
    await page.getByRole('button', { name: `Draw letter ${i}` }).click();
    await expect(page.locator('.counter').last()).toHaveText(`${i} / 4 letters`);
  }
  await page.getByRole('button', { name: /Continue to Copy/ }).click();
  await expect(page.getByRole('button', { name: 'Tutor confirms copy completed on paper' })).toBeVisible();
  await expect(page.locator('#copyInput')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tutor confirms copy completed on paper' }).click();
  await expect(page.locator('.step-row.active .step-title')).toHaveText('Cover');
  await expect(page.locator('#coverInput')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tutor confirms spelling from memory on paper' }).click();
  await expect(page.locator('.step-row.active .step-title')).toHaveText('Close');
  await page.getByRole('button', { name: 'Tutor confirms spoken spelling' }).click();
  await page.getByRole('button', { name: /Finish this word/ }).click();
  await expect(page.locator('.completion')).toContainText('Session saved on this device.');
  const store = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storeKey);
  expect(store.sessions.at(-1)).toMatchObject({ activity: 'trace-copy-cover-close', studentId: 'lesson-learner', completedItems: 1, totalItems: 1 });
  expect(JSON.stringify(store.sessions.at(-1))).not.toContain('ship');
});

test('TCCC keeps typed responses available in screen mode and validates tutor words', async ({ page }) => {
  await page.goto('/activities/trace-copy-cover-close.html');
  await page.getByLabel('Practice word').fill('two words');
  await page.getByRole('button', { name: 'Begin this word' }).click();
  await expect(page.locator('#setupError')).toContainText('Enter one word');
  await page.getByLabel('Practice word').fill('cat');
  await page.getByLabel('Response mode').selectOption('screen');
  await page.getByRole('button', { name: 'Begin this word' }).click();
  await page.getByRole('button', { name: 'Tutor confirms', exact: true }).click();
  for (let i = 1; i <= 3; i += 1) {
    await page.getByRole('button', { name: `Draw letter ${i}` }).click();
    await page.waitForTimeout(900);
  }
  await page.getByRole('button', { name: /Continue to Copy/ }).click();
  await expect(page.getByLabel('Copy the word')).toBeVisible();
  await page.getByLabel('Copy the word').fill('cat');
  await page.getByRole('button', { name: 'Check copy' }).click();
  await expect(page.locator('.step-row.active .step-title')).toHaveText('Cover');
  await expect(page.getByLabel('Spell the covered word')).toBeVisible();
});

test('TCCC paper setup remains accessible and fits a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/activities/trace-copy-cover-close.html');
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
});
