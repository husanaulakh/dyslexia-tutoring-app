import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function addLearner(page, label = 'JD') {
  await page.getByLabel('Learner label (initials or code)').fill(label);
  await page.getByRole('button', { name: 'Add student' }).click();
}

async function seedActiveLesson(page, studentIndex = 0, cardIds = ['consonants-s-sun', 'vowels-a-apple']) {
  await page.evaluate(({ studentIndex, cardIds }) => {
    const data = JSON.parse(localStorage.getItem('bright-steps-student-progress'));
    const studentId = data.students[studentIndex].id;
    sessionStorage.setItem('bright-steps-active-lesson', JSON.stringify({
      version: 1,
      studentId,
      index: 0,
      completedStepIds: [],
      startedAt: new Date().toISOString(),
      template: {
        id: 'lesson-visual', name: 'Visual recall', conceptIds: ['l1-learned-words'],
        steps: [{ id: 'visual-step', activityId: 'visual-drill-cards', responseMode: 'screen', settings: { preset: 'all', cardIds } }],
      },
    }));
  }, { studentIndex, cardIds });
}

test('visual drill selection page has no accessibility violations', async ({ page }) => {
  await page.goto('/activities/visual-drill-cards.html');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('tutor can select a subset and mark each card once after the keyword is revealed', async ({ page }) => {
  await page.goto('/activities/visual-drill-cards.html');
  await addLearner(page);
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await page.getByLabel('Include s, keyword sun').check();
  await page.getByLabel('Include a, keyword apple').check();
  await expect(page.locator('#tutorStatus')).toHaveText('2 cards selected for recall practice.');
  await page.getByRole('button', { name: 'Start recall practice' }).click();
  await expect(page.locator('#recallProgress')).toHaveText('Card 1 of 2');
  await expect(page.getByRole('button', { name: 'Independent' })).toBeDisabled();
  await expect(page.locator('#recallStage .face.back')).toHaveAttribute('aria-hidden', 'true');
  await page.getByRole('button', { name: 'Show keyword' }).click();
  await expect(page.locator('#recallStage .keyword')).toHaveText('sun');
  await expect(page.getByRole('button', { name: /Flip back to s\. Keyword sun; sound \/s\// })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Independent' })).toBeEnabled();
  await page.getByRole('button', { name: 'With help' }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#outcomeLegend')).toContainText('With help');
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Show keyword' }).click();
  await page.getByRole('button', { name: 'Independent' }).click();
  await page.getByRole('button', { name: 'Previous card' }).click();
  await expect(page.getByRole('button', { name: 'Independent' })).toBeDisabled();
  await expect(page.locator('#outcomeLegend')).toContainText('With help');
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Finish recall practice' }).click();
  await expect(page.locator('#doneText')).toContainText('1 independent, 1 with help, 0 revisit');
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-student-progress')));
  const session = data.sessions.at(-1);
  expect(session.activity).toBe('visual-drill-cards');
  expect(session.completedItems).toBe(2);
  expect(session.outcomeCounts).toEqual({ independent: 1, supported: 1, revisit: 0 });
  expect(JSON.stringify(session)).not.toContain('sun');
});

test('lesson selection restores only chosen IDs and saves recall for the pinned learner', async ({ page }) => {
  await page.goto('/activities/visual-drill-cards.html');
  await addLearner(page, 'JD');
  await addLearner(page, 'KM');
  await seedActiveLesson(page, 0);
  await page.reload();
  await expect(page.getByLabel('Include s, keyword sun')).toBeChecked();
  await expect(page.getByLabel('Include a, keyword apple')).toBeChecked();
  await expect(page.locator('.card-choice input:checked')).toHaveCount(2);
  await expect(page.getByLabel('Current student')).toBeDisabled();
  await page.getByRole('button', { name: 'Start recall practice' }).click();
  await page.getByRole('button', { name: 'Show keyword' }).click();
  await page.getByRole('button', { name: 'Revisit' }).click();
  await page.getByRole('button', { name: 'Save and end' }).click();
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-student-progress')));
  const session = data.sessions.at(-1);
  expect(session.studentId).toBe(data.students[0].id);
  expect(session.studentId).not.toBe(data.students[1].id);
  expect(session.conceptIds).toEqual(['l1-learned-words']);
  expect(session.totalItems).toBe(2);
});

test('hostile or invalid lesson card IDs produce no selection and never become markup', async ({ page }) => {
  await page.goto('/activities/visual-drill-cards.html');
  await addLearner(page);
  await seedActiveLesson(page, 0, ['<img src=x onerror=alert(1)>', 'invalid-id']);
  await page.reload();
  await expect(page.locator('.card-choice input:checked')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start recall practice' })).toBeDisabled();
  await expect(page.locator('img')).toHaveCount(0);
  await expect(page.locator('#tutorStatus')).toContainText('0 cards selected');
});

test('visual drill fits a narrow viewport and remains operable with keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/activities/visual-drill-cards.html');
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  await page.getByRole('button', { name: /Flip to reveal keyword and sound for s/ }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#stage .keyword')).toHaveText('sun');
  await page.getByRole('button', { name: /Flip back to s/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.grapheme')).toHaveText('a');
});
