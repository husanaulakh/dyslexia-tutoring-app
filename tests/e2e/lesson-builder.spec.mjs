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
  await page.locator('#lessonSteps .step-reorder-handle').first().click();
  await expect(page.locator('#lessonSteps .step-reorder-handle').first()).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Move Visual Drill Cards later in the lesson' }).click();
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

test('practice steps reorder by pointer, stable keyboard controls, and click menu; cancellation restores order', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  const addActivity = async id => {
    await page.getByLabel('Practice activity').selectOption(id);
    await page.getByRole('button', { name: 'Add step' }).click();
  };
  await addActivity('reading-words');
  await addActivity('trace-copy-cover-close');
  await addActivity('paragraph-reading');

  const rows = page.locator('#lessonSteps [data-step-id]');
  const originalIds = await rows.evaluateAll(items => items.map(item => item.dataset.stepId));
  const firstHandle = page.locator('#lessonSteps .step-reorder-handle').nth(0);
  const lastRow = rows.nth(2);
  const start = await firstHandle.boundingBox();
  const end = await lastRow.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height - 2, { steps: 6 });
  await page.mouse.up();
  await expect(rows.first()).toContainText('Trace, Copy, Cover, Close');
  const draggedIds = await rows.evaluateAll(items => items.map(item => item.dataset.stepId));
  expect(new Set(draggedIds)).toEqual(new Set(originalIds));
  await expect(page.locator('#reorderStatus')).toContainText('moved to position');

  // A click/tap opens the non-drag alternative, with accessible state and bounds.
  const lastHandle = page.locator('#lessonSteps .step-reorder-handle').last();
  await lastHandle.click();
  await expect(lastHandle).toHaveAttribute('aria-expanded', 'true');
  const menuId = await lastHandle.getAttribute('aria-controls');
  const menu = page.locator(`#${menuId}`);
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: /Move .* later in the lesson/ })).toBeDisabled();
  await menu.getByRole('button', { name: /Move .* earlier in the lesson/ }).click();
  await expect(page.locator('#lessonSteps .step-reorder-handle').last()).toHaveAttribute('aria-expanded', 'false');

  // Keyboard movement uses stable step IDs and safely reports bounds.
  const keyboardHandle = page.locator('#lessonSteps .step-reorder-handle').first();
  const keyboardId = await page.locator('#lessonSteps [data-step-id]').first().getAttribute('data-step-id');
  await keyboardHandle.focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#reorderStatus')).toContainText('already the first step');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#lessonSteps [data-step-id]').nth(1)).toHaveAttribute('data-step-id', keyboardId);

  // Escape during an active pointer drag restores the exact starting order.
  const beforeCancel = await rows.evaluateAll(items => items.map(item => item.dataset.stepId));
  const handle = page.locator('#lessonSteps .step-reorder-handle').first();
  const target = rows.nth(2);
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 2, { steps: 5 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('#reorderStatus')).toContainText('original order was restored');
  await expect(rows.evaluateAll(items => items.map(item => item.dataset.stepId))).resolves.toEqual(beforeCancel);
  await expect(page.locator('#lessonSteps .step-reorder-handle[aria-expanded="true"]')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('#lessonSteps [data-step-id]').evaluateAll(items => items.map(item => item.dataset.stepId))).resolves.toEqual(beforeCancel);
});

test('after a drag, Edit and Remove still act on the step ID shown in that row', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  for (const id of ['reading-words', 'trace-copy-cover-close', 'paragraph-reading']) {
    await page.getByLabel('Practice activity').selectOption(id);
    await page.getByRole('button', { name: 'Add step' }).click();
  }
  const rows = page.locator('#lessonSteps [data-step-id]');
  const trace = page.locator('#lessonSteps [data-step-id]').filter({ hasText: 'Trace, Copy, Cover, Close' });
  const traceId = await trace.getAttribute('data-step-id');
  const reading = page.locator('#lessonSteps [data-step-id]').filter({ hasText: 'Reading Words' });
  const readingId = await reading.getAttribute('data-step-id');
  const source = await page.locator('#lessonSteps .step-reorder-handle').first().boundingBox();
  const target = await rows.nth(2).boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height - 2, { steps: 5 });
  await page.mouse.up();
  await expect(rows.first()).toContainText('Trace, Copy, Cover, Close');

  await page.getByRole('button', { name: 'Edit Trace, Copy, Cover, Close' }).click();
  await expect(page.getByLabel('Tutor-selected word')).toBeVisible();
  await page.getByLabel('Tutor-selected word').fill('splash');
  await page.getByRole('button', { name: 'Update step' }).click();
  await expect(page.locator(`[data-step-id="${traceId}"]`)).toContainText('Tutor word: splash');
  await expect(page.locator(`[data-step-id="${traceId}"]`)).toHaveCount(1);

  await page.getByRole('button', { name: 'Remove Reading Words' }).click();
  await expect(page.locator(`[data-step-id="${readingId}"]`)).toHaveCount(0);
  await expect(rows).toHaveCount(2);
  await expect(rows).toContainText(['Trace, Copy, Cover, Close', 'Paragraph Reading']);
});

test('touch drag reorders with one pointer while the tap menu remains available', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  for (const id of ['reading-words', 'trace-copy-cover-close', 'paragraph-reading']) {
    await page.getByLabel('Practice activity').selectOption(id);
    await page.getByRole('button', { name: 'Add step' }).click();
  }
  const handles = page.locator('#lessonSteps .step-reorder-handle');
  const from = await handles.nth(0).boundingBox();
  const to = await page.locator('#lessonSteps [data-step-id]').nth(2).boundingBox();
  const session = await page.context().newCDPSession(page);
  const touch = (x, y) => ({ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 2, radiusY: 2, force: 1 });
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(from.x + from.width / 2, from.y + from.height / 2)] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(to.x + to.width / 2, to.y + to.height - 2)] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
  await expect(page.locator('#lessonSteps [data-step-id]').first()).toContainText('Trace, Copy, Cover, Close');
  await expect(page.locator('#lessonSteps .step-reorder-handle').first()).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#lessonSteps .step-reorder-handle').first().click();
  await expect(page.locator('#lessonSteps .step-reorder-handle').first()).toHaveAttribute('aria-expanded', 'true');
});

test('edge auto-scroll continues while dragging a long practice sequence without further pointer movement', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 650 });
  await page.goto('/activities/lesson-builder.html');
  for (let i = 0; i < 10; i += 1) {
    await page.getByLabel('Practice activity').selectOption(i % 2 ? 'trace-copy-cover-close' : 'reading-words');
    await page.getByRole('button', { name: 'Add step' }).click();
  }
  const handles = page.locator('#lessonSteps .step-reorder-handle');
  await handles.first().scrollIntoViewIfNeeded();
  const from = await handles.first().boundingBox();
  const before = await page.evaluate(() => window.scrollY);
  const x = from.x + from.width / 2;
  await page.mouse.move(x, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, 640, { steps: 4 });
  await page.waitForTimeout(350);
  const after = await page.evaluate(() => window.scrollY);
  await page.mouse.up();
  expect(after).toBeGreaterThan(before + 10);
  await expect(page.locator('#reorderStatus')).toContainText('moved to position');
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


test('a whole visual preset survives template save and starts only that recall set', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.getByLabel('Learner label (initials or code)').fill('L-01');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Template name').fill('Vowel review');
  await page.getByLabel('Practice activity').selectOption('visual-drill-cards');
  await page.getByLabel('Activity preset').selectOption('vowels');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByRole('button', { name: 'Save template' }).click();
  const templates = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-lesson-templates')));
  expect(templates[0].steps[0].settings).toMatchObject({ preset: 'vowels' });
  await page.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page.getByLabel('Card type')).toHaveValue('vowels');
  await expect(page.locator('.card-choice input:checked')).toHaveCount(5);
  await expect(page.locator('#stage .grapheme')).toHaveText('a');
  await page.getByRole('button', { name: 'Start recall practice' }).click();
  await expect(page.locator('#recallProgress')).toHaveText('Card 1 of 5');
  await expect(page.locator('#recallStage button')).toHaveAccessibleName('Flip to reveal keyword and sound for a.');
});

test('planning wizard guides a learner through concepts, editable activities, review, and draft recovery', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.getByLabel('Learner label (initials or code)').fill('T-14');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Template name').fill('Tutor guided practice');
  await page.getByRole('button', { name: 'Use planning wizard' }).click();
  await expect(page.locator('#wizardProgress')).toContainText('Step 1 of 4: Learner and plan');
  const wizardAxe = await new AxeBuilder({ page }).analyze();
  expect(wizardAxe.violations.map(item => item.id)).toEqual([]);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#wizardStage1')).toBeHidden();
  await expect(page.locator('#wizardStage2')).toBeVisible();
  await page.getByLabel('Short vowel sounds').check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#wizardStage3')).toBeVisible();

  await page.getByLabel('Practice activity').selectOption('trace-copy-cover-close');
  await page.getByLabel('Tutor-selected word').fill('bright');
  await page.getByLabel('Response mode').selectOption('paper');
  await page.getByRole('button', { name: 'Add step' }).click();
  const step = page.locator('#lessonSteps [data-step-id]');
  await expect(step).toContainText('Tutor word: bright');
  const stepId = await step.getAttribute('data-step-id');
  await page.getByRole('button', { name: 'Edit Trace, Copy, Cover, Close' }).click();
  await expect(page.getByLabel('Tutor-selected word')).toHaveValue('bright');
  await page.getByLabel('Tutor-selected word').fill('flight');
  await page.getByRole('button', { name: 'Update step' }).click();
  await expect(step).toContainText('Tutor word: flight');
  await expect(step).toHaveAttribute('data-step-id', stepId);

  await page.getByRole('button', { name: 'Review lesson' }).click();
  await expect(page.locator('#wizardProgress')).toContainText('Step 4 of 4: Review and start');
  await expect(page.locator('#lessonReview')).toContainText('Learner: T-14');
  await expect(page.locator('#lessonReview')).toContainText('Short vowel sounds');
  await expect(page.locator('#lessonReview')).toContainText('Tutor word: flight');
  await page.getByRole('button', { name: 'Save as new template' }).click();
  await expect(page.locator('#builderStatus')).toContainText('Saved as a new template');

  // A same-origin activity visit and reload retain only the composed plan config.
  await page.goto('/activities/reading-words.html');
  await page.goto('/activities/lesson-builder.html');
  await expect(page.getByLabel('Template name')).toHaveValue('Tutor guided practice');
  await expect(page.locator('#lessonSteps [data-step-id]')).toContainText('Tutor word: flight');
  await expect(page.getByLabel('Short vowel sounds')).toBeChecked();
  await expect(page.locator('#wizardProgress')).toContainText('Step 4 of 4: Review and start');
  await expect(page.locator('#wizardStage4')).toBeVisible();
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-lesson-builder-draft')));
  expect(draft).not.toHaveProperty('studentId');
  expect(JSON.stringify(draft)).not.toContain('T-14');
});

test('empty selected item sets cannot silently become an all-items step', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.getByLabel('Practice activity').selectOption('visual-drill-cards');
  await page.getByLabel('Activity preset').selectOption('vowels');
  await page.getByLabel('Activity item selection').selectOption([]);
  await page.getByRole('button', { name: 'Add step' }).click();
  await expect(page.locator('#stepSettingsStatus')).toContainText('Choose at least one item');
  await expect(page.locator('#lessonSteps [data-step-id]')).toHaveCount(0);
});

test('saved templates keep identity on explicit update and New plan creates a separate template', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.getByLabel('Template name').fill('Original plan');
  await page.getByLabel('Practice activity').selectOption('reading-words');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByRole('button', { name: 'Save template' }).click();
  let templates = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-lesson-templates')));
  const originalId = templates[0].id;
  await page.reload();
  await page.getByLabel('Template name').fill('Updated original');
  await page.getByRole('button', { name: 'Save template' }).click();
  templates = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-lesson-templates')));
  expect(templates).toHaveLength(1);
  expect(templates[0]).toMatchObject({ id: originalId, name: 'Updated original' });

  await page.getByRole('button', { name: 'New plan' }).click();
  await page.getByLabel('Template name').fill('Separate plan');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByRole('button', { name: 'Save as new template' }).click();
  templates = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-lesson-templates')));
  expect(templates).toHaveLength(2);
  expect(templates.map(item => item.name)).toEqual(['Updated original', 'Separate plan']);
});

test('active lesson reload preserves a separately edited future plan and resumes the original snapshot', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.getByLabel('Learner label (initials or code)').fill('L-03');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Template name').fill('Original lesson');

  await page.getByLabel('Practice activity').selectOption('reading-words');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByLabel('Practice activity').selectOption('visual-drill-cards');
  await page.getByLabel('Activity preset').selectOption('vowels');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByLabel('Practice activity').selectOption('trace-copy-cover-close');
  await page.getByLabel('Tutor-selected word').fill('bright');
  await page.getByLabel('Response mode').selectOption('paper');
  await page.getByRole('button', { name: 'Add step' }).click();
  await expect(page.locator('#lessonSteps [data-step-id]')).toHaveCount(3);

  await page.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page).toHaveURL(/reading-words\.html$/);
  await page.locator('#lessonToolbar').getByRole('button', { name: 'Finish step' }).click();
  await expect(page).toHaveURL(/visual-drill-cards\.html$/);
  await expect(page.locator('#lessonToolbar')).toContainText('Step 2 of 3');
  await page.locator('#lessonToolbar').getByText('Lesson options', { exact: true }).click();
  await page.locator('#lessonToolbar').getByRole('link', { name: 'Review lesson plan' }).click();
  await expect(page).toHaveURL(/lesson-builder\.html$/);

  await page.getByLabel('Template name').fill('Future revision');
  await page.getByRole('button', { name: 'Remove Trace, Copy, Cover, Close' }).click();
  await expect(page.locator('#lessonSteps [data-step-id]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Edit Visual Drill Cards' }).click();
  await page.getByLabel('Response mode').selectOption('paper');
  await page.getByRole('button', { name: 'Update step' }).click();
  await expect(page.locator('#lessonSteps [data-step-id]').nth(1)).toContainText('Paper or tutor response');

  const activeBeforeReload = await page.evaluate(() => JSON.parse(sessionStorage.getItem('bright-steps-active-lesson')));
  await page.reload();
  await expect(page.getByLabel('Template name')).toHaveValue('Future revision');
  await expect(page.locator('#lessonSteps [data-step-id]')).toHaveCount(2);
  await expect(page.locator('#lessonSteps [data-step-id]').nth(1)).toContainText('Paper or tutor response');
  await expect(page.locator('#activeLessonNotice')).toContainText('Original lesson');
  await expect(page.getByRole('button', { name: 'Resume lesson · Original lesson' })).toBeVisible();
  const futureDraft = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-lesson-builder-draft')));
  expect(futureDraft.name).toBe('Future revision');
  expect(futureDraft.steps).toHaveLength(2);
  expect(futureDraft.steps[1]).toMatchObject({ activityId: 'visual-drill-cards', responseMode: 'paper', settings: { preset: 'vowels' } });
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('bright-steps-active-lesson')))).toEqual(activeBeforeReload);

  await page.getByRole('button', { name: 'Resume lesson · Original lesson' }).click();
  await expect(page).toHaveURL(/visual-drill-cards\.html$/);
  await expect(page.locator('#lessonToolbar')).toContainText('Step 2 of 3');
  await expect(page.getByLabel('Card type')).toHaveValue('vowels');
});

test("What's Missing and paragraph settings appear in the saved review configuration", async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.getByLabel('Template name').fill('Flexible reading practice');
  await page.getByLabel('Practice activity').selectOption('whats-missing-cards');
  await page.getByLabel('Number of cards').fill('7');
  await page.getByLabel('Missing letter position').selectOption('first');
  await page.getByRole('button', { name: 'Add step' }).click();

  await page.getByLabel('Practice activity').selectOption('paragraph-reading');
  await page.getByLabel('Comprehension prompts').selectOption('none');
  await page.getByLabel('Paragraph rereading').selectOption('needs-practice');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByRole('button', { name: 'Save as new template' }).click();

  const templates = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-lesson-templates')));
  expect(templates[0].steps[0].settings).toMatchObject({ count: 7, mode: 'first' });
  expect(templates[0].steps[1].settings).toMatchObject({ questionMode: 'none', rereadMode: 'needs-practice' });
});

test('Workshop lesson planning can select a tutor-saved VC.CV annotation', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.evaluate(() => localStorage.setItem('bright-steps-word-workshop-v1', JSON.stringify([
    { word: 'napkin', split: 'nap/kin', note: 'Tutor-confirmed split.' },
  ])));
  await page.reload();
  await page.getByLabel('Template name').fill('VC.CV practice');
  await page.getByLabel('Practice activity').selectOption('word-workshop');
  await page.getByLabel('Activity preset').selectOption('vccv');
  await page.getByLabel('Activity item selection').selectOption(['napkin']);
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByRole('button', { name: 'Save as new template' }).click();
  const templates = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-lesson-templates')));
  expect(templates[0].steps[0].settings).toMatchObject({ workshop: 'vccv', itemIds: ['napkin'] });
});

test('Blending Board planning uses saved dictionary words and filters by spelling tile count', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.evaluate(() => localStorage.setItem('blending-board-words-standalone', JSON.stringify([
    { word: 'plat', chunks: ['p', 'l', 'a', 't'], lessonTag: 'current' },
    { word: 'ship', chunks: ['sh', 'i', 'p'], lessonTag: 'current' },
  ])));
  await page.reload();
  await page.getByLabel('Template name').fill('Four tile blends');
  await page.getByLabel('Practice activity').selectOption('blending-board');
  await page.getByLabel('Spelling tile count').selectOption('4');
  const items = page.getByLabel('Activity item selection');
  await expect(items).toContainText('plat');
  await expect(items).not.toContainText('ship');
  await items.selectOption(['plat']);
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByRole('button', { name: 'Save as new template' }).click();
  const templates = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-lesson-templates')));
  expect(templates[0].steps[0].settings).toMatchObject({ tileCount: 4, wordIds: ['plat'] });
});

test('Board refuses a tile count with no matching saved words', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.getByLabel('Practice activity').selectOption('blending-board');
  await page.getByLabel('Spelling tile count').selectOption('2');
  await expect(page.getByLabel('Activity item selection')).toBeHidden();
  await page.getByRole('button', { name: 'Add step' }).click();
  await expect(page.locator('#stepSettingsStatus')).toContainText('No saved Board word has 2 spelling tiles');
  await expect(page.getByRole('link', { name: 'Manage the word dictionary' })).toBeVisible();
  await expect(page.locator('#lessonSteps [data-step-id]')).toHaveCount(0);
});

test('lesson start requests repair when an explicit Board word is no longer in the dictionary', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.evaluate(() => localStorage.setItem('bright-steps-lesson-templates', JSON.stringify([{
    id: 'missing-board-word', name: 'Plan with missing Board word', conceptIds: [],
    steps: [{ id: 'step-one', activityId: 'blending-board', responseMode: 'screen', settings: { wordIds: ['removed-word'] } }],
  }])));
  await page.reload();
  await page.getByLabel('Learner label (initials or code)').fill('L-32');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Saved templates').selectOption({ label: 'Plan with missing Board word' });
  await page.getByRole('button', { name: 'Load template' }).click();
  await page.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page.locator('#builderStatus')).toContainText('selected Board words are no longer available');
  expect(await page.evaluate(() => sessionStorage.getItem('bright-steps-active-lesson'))).toBeNull();
});

for (const { activityId, label, collectionKey } of [
  { activityId: 'reading-words', label: 'word list', collectionKey: 'bright-steps-reading-word-lists' },
  { activityId: 'paragraph-reading', label: 'paragraph list', collectionKey: 'bright-steps-paragraph-reading-lists' },
]) {
  test(`lesson start requests repair when a saved ${label} has disappeared`, async ({ page }) => {
    await page.goto('/activities/lesson-builder.html');
    await page.evaluate(({ activityId }) => localStorage.setItem('bright-steps-lesson-templates', JSON.stringify([{
      id: `missing-${activityId}`, name: 'Plan with missing material', conceptIds: [],
      steps: [{ id: 'step-one', activityId, responseMode: 'screen', settings: { listId: 'deleted-list' } }],
    }])), { activityId });
    await page.reload();
    await page.getByLabel('Learner label (initials or code)').fill('L-30');
    await page.getByRole('button', { name: 'Add student' }).click();
    await page.getByLabel('Saved templates').selectOption({ label: 'Plan with missing material' });
    await page.getByRole('button', { name: 'Load template' }).click();
    await page.getByRole('button', { name: 'Start lesson' }).click();
    await expect(page.locator('#builderStatus')).toContainText(`The selected saved ${label} “deleted-list” is no longer available`);
    await expect(page).toHaveURL(/lesson-builder\.html/);
    expect(await page.evaluate(() => sessionStorage.getItem('bright-steps-active-lesson'))).toBeNull();
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), collectionKey)).toBeNull();
  });
}

test('an unreadable explicit list cannot masquerade as fallback list-1', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.evaluate(() => {
    localStorage.setItem('bright-steps-reading-word-lists', '{broken json');
    localStorage.setItem('bright-steps-lesson-templates', JSON.stringify([{
      id: 'unreadable-list', name: 'Plan with unreadable list', conceptIds: [],
      steps: [{ id: 'step-one', activityId: 'reading-words', responseMode: 'screen', settings: { listId: 'list-1' } }],
    }]));
  });
  await page.reload();
  await page.getByLabel('Learner label (initials or code)').fill('L-33');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Saved templates').selectOption({ label: 'Plan with unreadable list' });
  await page.getByRole('button', { name: 'Load template' }).click();
  await page.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page.locator('#builderStatus')).toContainText('could not be verified because its saved list data is unreadable');
  expect(await page.evaluate(() => sessionStorage.getItem('bright-steps-active-lesson'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('bright-steps-reading-word-lists'))).toBe('{broken json');
});

test('lesson start requests repair when an explicit Workshop item selection disappeared', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.evaluate(() => localStorage.setItem('bright-steps-lesson-templates', JSON.stringify([{
    id: 'missing-workshop-item', name: 'Plan with missing Workshop item', conceptIds: [],
    steps: [{ id: 'step-one', activityId: 'word-workshop', responseMode: 'paper', settings: { workshop: 'vccv', itemIds: ['removed-tutor-word'] } }],
  }])));
  await page.reload();
  await page.getByLabel('Learner label (initials or code)').fill('L-31');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Saved templates').selectOption({ label: 'Plan with missing Workshop item' });
  await page.getByRole('button', { name: 'Load template' }).click();
  await page.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page.locator('#builderStatus')).toContainText('One or more selected Workshop words are no longer available');
  expect(await page.evaluate(() => sessionStorage.getItem('bright-steps-active-lesson'))).toBeNull();
});
