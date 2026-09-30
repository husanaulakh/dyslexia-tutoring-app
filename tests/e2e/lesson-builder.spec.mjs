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
