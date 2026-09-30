import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The local static server resolves extensionless files; emulate Vercel's
// configured .html redirects so browser location matches the deployed site.
async function useCleanUrls(page) {
  await page.route(/\/activities\/[^/?]+\.html(?:\?.*)?$/, async route => {
    if (!route.request().isNavigationRequest()) return route.continue();
    const url = new URL(route.request().url());
    url.pathname = url.pathname.replace(/\.html$/, '');
    await route.fulfill({ status: 308, headers: { location: url.toString() } });
  });
}

test('production clean URLs preserve lesson completion and selected-list handoff', async ({ page }) => {
  await useCleanUrls(page);
  await page.goto('/activities/lesson-builder.html');
  await expect(page).toHaveURL(/\/activities\/lesson-builder$/);
  await page.getByLabel('Learner label (initials or code)').fill('L01');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Template name').fill('Production review');
  await page.getByLabel('Practice activity').selectOption('sound-boxes');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page).toHaveURL(/\/activities\/sound-boxes$/);
  await expect(page.locator('#lessonToolbar').getByRole('button', { name: 'Finish step' })).toBeEnabled();
  await page.locator('#lessonToolbar').getByRole('button', { name: 'Finish step' }).click();
  await expect(page).toHaveURL(/\/activities\/lesson-builder\?completed=[A-Za-z0-9_-]+$/);
  await page.goto('/activities/tutor-suggestions.html?concept=l1-short-vowels');
  await expect(page).toHaveURL(/\/activities\/tutor-suggestions\?concept=l1-short-vowels$/);
  await page.getByRole('button', { name: 'Use this set in Reading Words' }).click();
  await expect(page).toHaveURL(/\/activities\/reading-words\?list=suggested-short-vowels-/);
  await expect(page.getByLabel('Words in this list')).toHaveValue(/cat\nbed\nsit/);
});

async function seedLesson(page, activityId, settings = {}) {
  await page.goto('/');
  await page.evaluate(({ activityId, settings }) => {
    localStorage.setItem('bright-steps-student-progress', JSON.stringify({ schemaVersion: 3, students: [{ id: 'learner-1', name: 'L01' }], selectedStudentId: 'learner-1', sessions: [], assessment: [] }));
    localStorage.setItem('bright-steps-reading-word-lists', JSON.stringify([{ id: 'test-words', name: 'Review', words: ['ship', 'map'] }]));
    localStorage.setItem('bright-steps-paragraph-reading-lists', JSON.stringify([{ id: 'test-passages', name: 'Review', paragraphs: ['A ship is in port.', 'Rain fell on the deck.'], questions: ['', ''] }]));
    sessionStorage.setItem('bright-steps-active-lesson', JSON.stringify({ version: 1, studentId: 'learner-1', index: 0, completedStepIds: [], startedAt: '2026-09-30T01:00:00Z', template: { id: 'partial-lesson', name: 'Partial review', conceptIds: ['l1-digraphs'], steps: [{ id: 'step-1', activityId, responseMode: 'paper', settings }] } }));
  }, { activityId, settings });
  await page.goto(`/activities/${activityId}.html`);
}
async function sessions(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-student-progress')).sessions);
}

const partialCases = [
  ['sound-boxes', { wordIds: ['map', 'ship'] }, async page => {
    await page.getByRole('button', { name: 'Reveal written word' }).click();
    await page.getByRole('button', { name: 'Independent', exact: true }).click();
    await page.getByRole('button', { name: 'Finish word and continue' }).click();
  }],
  ['auditory-dictation', { itemIds: ['word-map', 'word-ship'] }, async page => {
    await page.getByRole('button', { name: 'Reveal accepted spelling' }).click();
    await page.getByRole('button', { name: 'Independent', exact: true }).click();
    await page.getByRole('button', { name: 'Finish item and continue' }).click();
  }],
  ['word-workshop', { workshop: 'vccv', itemIds: ['napkin', 'sunset'] }, async page => {
    await page.getByRole('button', { name: 'Start practice', exact: true }).click();
    await page.getByRole('button', { name: 'Reveal tutor key' }).click();
    await page.getByRole('button', { name: 'Independent', exact: true }).click();
    await page.getByRole('button', { name: 'Finish item', exact: true }).click();
  }],
  ['reading-words', { listId: 'test-words' }, async page => {
    await page.getByRole('button', { name: 'Start reading' }).click();
    await page.getByRole('button', { name: 'Independent', exact: true }).click();
  }],
  ['paragraph-reading', { listId: 'test-passages' }, async page => {
    await page.getByRole('button', { name: 'Start reading' }).click();
    await page.getByRole('button', { name: 'Independent', exact: true }).click();
    await page.getByRole('button', { name: 'Finish paragraph', exact: true }).click();
  }],
  ['visual-drill-cards', { cardIds: ['consonants-s-sun', 'vowels-a-apple'] }, async page => {
    await page.getByRole('button', { name: 'Start recall practice' }).click();
    await page.getByRole('button', { name: 'Show keyword' }).click();
    await page.getByRole('button', { name: 'Independent', exact: true }).click();
  }],
];
for (const [activity, settings, mark] of partialCases) {
  test(`${activity} retains a single partial aggregate on reload and early lesson completion`, async ({ page }) => {
    await seedLesson(page, activity, settings);
    await mark(page);
    let records = await sessions(page);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ activity, studentId: 'learner-1', completedItems: 1, outcomeCounts: { independent: 1, supported: 0, revisit: 0 } });
    const id = records[0].id;
    await page.reload();
    expect((await sessions(page))[0].id).toBe(id);
    await page.locator('#lessonToolbar').getByRole('button', { name: 'Finish step' }).click();
    await expect(page).toHaveURL(/lesson-builder\.html(?:\?completed=[A-Za-z0-9_-]+)?$/);
    records = await sessions(page);
    expect(records.filter(item => item.activity === activity)).toHaveLength(1);
    expect(records.filter(item => item.activity === 'lesson')).toHaveLength(1);
    expect(JSON.stringify(records)).not.toContain('A ship is in port.');
  });
}

test('failed aggregate writes block lesson navigation and retained outcomes save after recovery', async ({ page }) => {
  await seedLesson(page, 'reading-words', { listId: 'test-words' });
  await page.evaluate(() => {
    window.__saveBlocked = true;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (window.__saveBlocked && key === 'bright-steps-student-progress') throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Start reading' }).click();
  await page.getByRole('button', { name: 'Independent', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry saving outcomes' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#lessonToolbar').getByRole('button', { name: 'Finish step' }).click();
  await expect(page).toHaveURL(/reading-words\.html$/);
  expect(await sessions(page)).toHaveLength(0);
  await page.evaluate(() => { window.__saveBlocked = false; });
  await page.getByRole('button', { name: 'Retry saving outcomes' }).click();
  expect(await sessions(page)).toHaveLength(1);
  await page.locator('#lessonToolbar').getByRole('button', { name: 'Finish step' }).click();
  await expect(page).toHaveURL(/lesson-builder\.html(?:\?completed=[A-Za-z0-9_-]+)?$/);
  expect(await sessions(page)).toHaveLength(2);
});

test('a failed active-lesson clear never duplicates its completion summary', async ({ page }) => {
  await seedLesson(page, 'reading-words', { listId: 'test-words' });
  await page.evaluate(() => {
    window.__clearBlocked = true;
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (window.__clearBlocked && key === 'bright-steps-active-lesson') throw new DOMException('Blocked', 'SecurityError');
      return original.call(this, key);
    };
  });
  await page.locator('#lessonToolbar').getByRole('button', { name: 'End lesson' }).click();
  await expect(page.locator('#lessonToolbar')).toContainText('Could not end the lesson');
  const id = (await sessions(page))[0].id;
  await page.evaluate(() => { window.__clearBlocked = false; });
  await page.locator('#lessonToolbar').getByRole('button', { name: 'End lesson' }).click();
  await expect(page).toHaveURL(/lesson-builder\.html(?:\?completed=[A-Za-z0-9_-]+)?$/);
  const records = await sessions(page);
  expect(records).toHaveLength(1);
  expect(records[0].id).toBe(id);
});

test('future learner storage is preserved and editing controls are disabled', async ({ page }) => {
  const raw = JSON.stringify({ schemaVersion: 99, students: [{ id: 'next-version', name: 'L01' }], futureField: 'retain' });
  await page.addInitScript(raw => localStorage.setItem('bright-steps-student-progress', raw), raw);
  await page.goto('/activities/student-progress.html');
  await expect(page.getByRole('button', { name: 'Add student' })).toBeDisabled();
  await expect(page.locator('#studentTracker')).toContainText('newer app version');
  expect(await page.evaluate(() => localStorage.getItem('bright-steps-student-progress'))).toBe(raw);
});


test('failed writes retain aggregate-only recovery across browser reload', async ({ page }) => {
  await seedLesson(page, 'reading-words', { listId: 'test-words' });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'bright-steps-student-progress') throw new Error('blocked');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Start reading' }).click();
  await page.getByRole('button', { name: 'Independent', exact: true }).click();
  const pending = await page.evaluate(() => sessionStorage.getItem('bright-steps-pending-outcomes'));
  expect(pending).not.toContain('ship');
  expect(JSON.parse(pending).items[0]).toMatchObject({ studentId: 'learner-1', completedItems: 1 });
  page.on('dialog', dialog => dialog.accept());
  await page.reload();
  expect(await sessions(page)).toHaveLength(1);
  expect(await page.evaluate(() => sessionStorage.getItem('bright-steps-pending-outcomes'))).toBeNull();
  await page.reload();
  expect(await sessions(page)).toHaveLength(1);
});

test('ending a lesson preserves its context when the pinned learner is missing', async ({ page }) => {
  await seedLesson(page, 'reading-words', { listId: 'test-words' });
  await page.evaluate(() => localStorage.setItem('bright-steps-student-progress', JSON.stringify({ schemaVersion: 3, students: [], selectedStudentId: '', sessions: [], assessment: [] })));
  await page.reload();
  await page.locator('#lessonToolbar').getByRole('button', { name: 'End lesson' }).click();
  await expect(page).toHaveURL(/reading-words\.html$/);
  expect(await page.evaluate(() => sessionStorage.getItem('bright-steps-active-lesson'))).not.toBeNull();
  expect(await sessions(page)).toHaveLength(0);
});


for (const activity of ['reading-words', 'paragraph-reading']) {
  test(`${activity} never substitutes starter material for a missing planned list`, async ({ page }) => {
    await seedLesson(page, activity, { listId: 'deleted-list' });
    await expect(page.locator('#tutorStatus')).toContainText('not available');
    await expect(page.getByRole('button', { name: 'Start reading' })).toBeDisabled();
    await page.getByRole('link', { name: 'Review lesson plan' }).click();
    await expect(page).toHaveURL(/lesson-builder\.html$/);
    expect(await page.evaluate(() => sessionStorage.getItem('bright-steps-active-lesson'))).not.toBeNull();
  });
}

for (const activity of ['reading-words', 'paragraph-reading']) {
  test(`${activity} refuses an unreadable planned list even when its ID matches a starter`, async ({ page }) => {
    await seedLesson(page, activity, { listId: 'list-1' });
    const key = activity === 'reading-words' ? 'bright-steps-reading-word-lists' : 'bright-steps-paragraph-reading-lists';
    await page.evaluate(key => localStorage.setItem(key, '{unreadable saved tutor material'), key);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Start reading' })).toBeDisabled();
    await expect(page.locator('#tutorStatus')).toContainText('not available');
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('{unreadable saved tutor material');
  });
}
