import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function addLearner(page, label = 'AB') {
  await page.getByLabel('Learner label (initials or code)').fill(label);
  await page.getByRole('button', { name: 'Add student' }).click();
}

test('reading feedback pages load without accessibility violations', async ({ page }) => {
  for (const [path, title] of [
    ['/activities/reading-words.html', 'Reading Words'],
    ['/activities/paragraph-reading.html', 'Paragraph Reading'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `${path}: ${JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).slice(0, 2500)}`).toEqual([]);
  }
});

test('Reading Words records first responses separately from a single retry', async ({ page }) => {
  await page.goto('/activities/reading-words.html');
  await addLearner(page);
  await page.getByRole('button', { name: 'Add a list' }).click();
  await page.getByLabel('List name').fill('Tutor set');
  await page.getByLabel('Words in this list').fill('cat\ndog\npig\nsun');
  await page.getByRole('button', { name: 'Save list' }).click();
  await page.getByRole('button', { name: 'Start reading' }).click();
  await expect(page.locator('#practiceWord')).toHaveText('cat');
  await page.getByRole('button', { name: 'With help' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#practiceWord')).toHaveText('dog');
  for (const word of ['dog', 'pig', 'sun']) {
    await expect(page.locator('#practiceWord')).toHaveText(word);
    await page.getByRole('button', { name: 'Independent' }).click();
  }
  await expect(page.locator('#practiceWord')).toHaveText('cat');
  await expect(page.locator('#wordKind')).toHaveText('Read this word again');
  await page.getByRole('button', { name: 'Independent' }).click();
  await expect(page.getByRole('heading', { name: 'Nice reading' })).toBeVisible();
  await expect(page.locator('#doneText')).toContainText('First responses: 3 independent, 1 with help, 0 revisit.');
  await expect(page.locator('#doneText')).toContainText('Retry outcomes: 1 independent, 0 with help, 0 revisit.');
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-student-progress')));
  const session = data.sessions.at(-1);
  expect(session.activity).toBe('reading-words');
  expect(session.completedItems).toBe(5);
  expect(session.outcomeCounts).toEqual({ independent: 3, supported: 1, revisit: 0 });
  expect(session.retryOutcomeCounts).toEqual({ independent: 1, supported: 0, revisit: 0 });
  expect(JSON.stringify(session)).not.toContain('cat');
});

test('Paragraph Reading defaults to all rereads, supports needs-practice with oral questions and separated outcomes', async ({ page }) => {
  await page.goto('/activities/paragraph-reading.html');
  await expect(page.getByLabel('Reread selection')).toHaveValue('all');
  await addLearner(page);
  await page.getByRole('button', { name: 'Add a list' }).click();
  await page.getByLabel('List name').fill('Prompted passages');
  await page.getByLabel('Paragraphs in this list').fill('Sam has a cap.\n\nThe cap is red.');
  await page.getByLabel('Optional oral comprehension prompts').fill('What does Sam have?\n');
  await page.getByLabel('Reread selection').selectOption('needs-practice');
  await page.getByRole('button', { name: 'Save list' }).click();
  await page.getByRole('button', { name: 'Start reading' }).click();
  await expect(page.locator('#practiceParagraph')).toHaveText('Sam has a cap.');
  await expect(page.locator('#practiceQuestion')).toHaveText('What does Sam have?');
  await page.getByRole('button', { name: 'Revisit' }).click();
  await page.getByRole('button', { name: 'Finish paragraph' }).click();
  await expect(page.locator('#practiceParagraph')).toHaveText('The cap is red.');
  await expect(page.locator('#comprehensionPrompt')).toBeHidden();
  await page.getByRole('button', { name: 'Independent' }).click();
  await page.getByRole('button', { name: 'Finish paragraph' }).click();
  await expect(page.locator('#practiceParagraph')).toHaveText('Sam has a cap.');
  await expect(page.locator('#paragraphKind')).toContainText('Review');
  await expect(page.locator('#practiceQuestion')).toHaveText('What does Sam have?');
  await page.getByRole('button', { name: 'With help' }).click();
  await page.getByRole('button', { name: 'Finish paragraph' }).click();
  await expect(page.getByRole('heading', { name: 'Nice reading' })).toBeVisible();
  await expect(page.locator('#doneText')).toContainText('First responses: 1 independent, 0 with help, 1 revisit.');
  await expect(page.locator('#doneText')).toContainText('Retry outcomes: 0 independent, 1 with help, 0 revisit.');
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-student-progress')));
  const session = data.sessions.at(-1);
  expect(session.activity).toBe('paragraph-reading');
  expect(session.completedItems).toBe(3);
  expect(session.totalItems).toBe(3);
  expect(session.outcomeCounts).toEqual({ independent: 1, supported: 0, revisit: 1 });
  expect(session.retryOutcomeCounts).toEqual({ independent: 0, supported: 1, revisit: 0 });
  expect(JSON.stringify(session)).not.toContain('What does Sam have?');
});

test('active lesson fixes the learner and selects its saved reading list', async ({ page }) => {
  await page.goto('/activities/reading-words.html');
  await addLearner(page, 'AA');
  await addLearner(page, 'BB');
  await page.evaluate(() => {
    const storeKey = 'bright-steps-student-progress';
    const data = JSON.parse(localStorage.getItem(storeKey));
    const fixedStudent = data.students[0];
    data.selectedStudentId = data.students[1].id;
    localStorage.setItem(storeKey, JSON.stringify(data));
    localStorage.setItem('bright-steps-reading-word-lists', JSON.stringify([
      { id: 'lesson-list', name: 'Lesson words', words: ['ship'] },
    ]));
    sessionStorage.setItem('bright-steps-active-lesson', JSON.stringify({
      version: 1,
      template: { id: 'read-lesson', name: 'Read together', conceptIds: ['l1-digraphs'], steps: [
        { id: 'read-step', activityId: 'reading-words', responseMode: 'screen', settings: { listId: 'lesson-list' } },
      ] },
      studentId: fixedStudent.id, index: 0, completedStepIds: [], startedAt: new Date().toISOString(),
    }));
  });
  await page.reload();
  await expect(page.getByLabel('Choose a list')).toBeDisabled();
  await expect(page.getByLabel('Current student')).toHaveValue(/student-/);
  await expect(page.getByLabel('Words in this list')).toHaveValue('ship');
  await page.getByRole('button', { name: 'Start reading' }).click();
  await page.getByRole('button', { name: 'Independent' }).click();
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-student-progress')));
  const session = data.sessions.at(-1);
  expect(session.studentId).toBe(data.students[0].id);
  expect(session.studentId).not.toBe(data.students[1].id);
  expect(session.conceptIds).toEqual(['l1-digraphs']);
});

test('partial session storage failures are reported after leaving either activity', async ({ page }) => {
  await page.goto('/activities/reading-words.html');
  await addLearner(page);
  await page.getByRole('button', { name: 'Start reading' }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'bright-steps-student-progress') throw new Error('blocked');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Revisit' }).click();
  await page.getByRole('button', { name: 'Back to tutor lists' }).click();
  await expect(page.locator('#tutorStatus')).toContainText('could not be saved in browser storage');

  await page.goto('/activities/paragraph-reading.html');
  await addLearner(page, 'CD');
  await page.getByRole('button', { name: 'Start reading' }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'bright-steps-student-progress') throw new Error('blocked');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Independent' }).click();
  await page.getByRole('button', { name: 'Finish paragraph' }).click();
  await page.getByRole('button', { name: 'Back to tutor lists' }).click();
  await expect(page.locator('#tutorStatus')).toContainText('could not be saved in browser storage');
});

test('unreadable saved list data stays untouched and new lists are reported as session-only', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bright-steps-reading-word-lists', '{broken word lists');
    localStorage.setItem('bright-steps-paragraph-reading-lists', '{broken paragraph lists');
  });

  await page.goto('/activities/reading-words.html');
  await expect(page.locator('#tutorStatus')).toContainText('could not be read');
  await page.getByRole('button', { name: 'Save list' }).click();
  await expect(page.locator('#tutorStatus')).toContainText('Stored word-list data is unreadable');
  await page.getByRole('button', { name: 'Add a list' }).click();
  await expect(page.locator('#tutorStatus')).toContainText('Added List 2 for this session only');
  expect(await page.evaluate(() => localStorage.getItem('bright-steps-reading-word-lists'))).toBe('{broken word lists');

  await page.goto('/activities/paragraph-reading.html');
  await expect(page.locator('#tutorStatus')).toContainText('could not be read');
  await page.getByRole('button', { name: 'Add a list' }).click();
  await expect(page.locator('#tutorStatus')).toContainText('Added Paragraphs 2 for this session only');
  expect(await page.evaluate(() => localStorage.getItem('bright-steps-paragraph-reading-lists'))).toBe('{broken paragraph lists');
});

test('reading feedback pages fit a narrow viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ['/activities/reading-words.html', '/activities/paragraph-reading.html']) {
    await page.goto(path);
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll, `${path} horizontal overflow`).toBeLessThanOrEqual(dimensions.width);
  }
});
