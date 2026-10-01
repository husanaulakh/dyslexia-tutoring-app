import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const paths = ['tutor-suggestions', 'lesson-builder', 'sound-boxes', 'auditory-dictation', 'word-workshop', 'reading-words', 'paragraph-reading', 'blending-board', 'trace-copy-cover-close', 'visual-drill-cards', 'whats-missing-cards', 'student-progress', 'ufli-blending-board'];

test('presentation settings change actual reading text, persist valid settings, and hide tutor editors', async ({ page }) => {
  await page.goto('/activities/word-workshop.html');
  await page.getByText('Display options', { exact: true }).click();
  await page.getByLabel('Learner label (initials or code)').fill('L01');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByRole('button', { name: 'Start practice' }).click();
  const word = page.locator('#itemWord');
  const base = await word.evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  for (const [size, ratio] of [['125', 1.25], ['150', 1.5], ['100', 1]]) {
    await page.getByLabel('Text size', { exact: true }).selectOption(size);
    expect(await word.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeCloseTo(base * ratio, 1);
  }
  await page.getByLabel('Text size', { exact: true }).selectOption('150');
  for (const spacing of ['1.5', '1.8', '2']) {
    await page.getByLabel('Line spacing', { exact: true }).selectOption(spacing);
    const ratio = await word.evaluate(node => parseFloat(getComputedStyle(node).lineHeight) / parseFloat(getComputedStyle(node).fontSize));
    expect(ratio).toBeCloseTo(Number(spacing), 1);
  }
  await page.getByRole('button', { name: 'Show learner view' }).focus();
  await expect(page.getByRole('button', { name: 'Show learner view' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Show learner view' })).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Show tutor tools' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Show tutor tools' })).toHaveCSS('background-color', 'rgb(69, 107, 8)');
  await expect(page.locator('#studentTracker')).toBeHidden();
  await expect(page.locator('#revealAnswer')).toBeHidden();
  await expect(word).toBeVisible();
  await expect(page.getByRole('button', { name: 'End practice', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Show tutor tools' }).click();
  await expect(page.locator('#revealAnswer')).toBeVisible();
  await page.reload();
  await page.getByText('Display options', { exact: true }).click();
  await expect(page.getByLabel('Text size', { exact: true })).toHaveValue('150');
  await expect(page.getByLabel('Line spacing', { exact: true })).toHaveValue('2');
  await expect(page.getByRole('button', { name: 'Show learner view' })).toBeVisible();
});

test('all shared presentation controls fit narrow screens and remain accessible', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 375, height: 812 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const activity of paths) {
    await page.goto(`/activities/${activity}.html`);
    await page.getByText('Display options', { exact: true }).click();
    await page.getByLabel('Text size', { exact: true }).selectOption('150');
    await page.getByLabel('Line spacing', { exact: true }).selectOption('2');
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll, `${activity} overflows`).toBeLessThanOrEqual(dimensions.width);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })), activity).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('dynamic letter practice preserves lesson and presentation controls through each render', async ({ page }) => {
  await page.goto('/activities/whats-missing-cards.html');
  await page.getByText('Display options', { exact: true }).click();
  await page.getByLabel('Text size', { exact: true }).selectOption('125');
  await page.getByLabel('Number of cards').fill('1');
  await page.getByRole('button', { name: 'Go to Letter Review' }).click();
  await page.getByText('Display options', { exact: true }).click();
  await expect(page.getByLabel('Text size', { exact: true })).toHaveValue('125');
  await expect(page.locator('#lessonToolbar')).toContainText('Plan a lesson');
  await page.getByRole('button', { name: 'Start Exercise' }).click();
  await page.getByText('Display options', { exact: true }).click();
  await expect(page.getByLabel('Text size', { exact: true })).toBeVisible();
  await expect(page.locator('.tile.exercise').first()).toHaveAttribute('data-reading-base', /\d/);
  await page.getByRole('button', { name: 'Show learner view' }).click();
  await page.getByRole('button', { name: 'Right', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show tutor tools' })).toBeVisible();
});

test('hostile saved settings fall back safely and blocked storage preserves usable controls', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bright-steps-presentation', JSON.stringify({ size: '<img src=x>', spacing: 200 }));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'bright-steps-presentation') throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto('/activities/reading-words.html');
  await page.getByText('Display options', { exact: true }).click();
  await expect(page.getByLabel('Text size', { exact: true })).toHaveValue('100');
  await expect(page.getByLabel('Line spacing', { exact: true })).toHaveValue('1.5');
  await page.getByLabel('Text size', { exact: true }).selectOption('125');
  await expect(page.locator('.presentation-controls')).toContainText('could not be saved');
  await page.getByRole('button', { name: 'Show learner view' }).click();
  await expect(page.locator('#tutorPanel')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Show tutor tools' })).toBeVisible();
});

test('presentation and lesson controls keep secondary settings compact and label shared-screen behavior', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.setViewportSize({ width: 195, height: 844 });
  await expect(page.getByRole('button', { name: 'Show learner view' })).toBeVisible();
  await expect(page.getByText('Display options', { exact: true })).toBeVisible();
  await expect(page.locator('.presentation-note')).toBeHidden();
  const displayOptions = page.locator('.presentation-controls__options');
  const displaySummary = displayOptions.locator('summary');
  await displaySummary.focus();
  await page.keyboard.press('Enter');
  await expect(displayOptions).toHaveJSProperty('open', true);
  await expect(page.locator('.presentation-note')).toContainText('Anyone viewing a shared screen sees this same view');
  const narrowDimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(narrowDimensions.scroll).toBeLessThanOrEqual(narrowDimensions.width);
  await page.keyboard.press('Space');
  await expect(displayOptions).toHaveJSProperty('open', false);
  await page.keyboard.press('Enter');
  await expect(displayOptions).toHaveJSProperty('open', true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Use planning wizard' }).click();
  await page.locator('#wizardContinue').click();
  await page.getByLabel('Learner label (initials or code)').fill('L02');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Template name').fill('Short lesson');
  await page.locator('#wizardContinue').click();
  await page.locator('#wizardContinue').click();
  await page.getByLabel('Practice activity').selectOption('word-workshop');
  await page.getByLabel('Activity preset').selectOption('silent-e');
  await page.getByRole('button', { name: 'Add step', exact: true }).click();
  await page.locator('#wizardContinue').click();
  await page.getByRole('button', { name: 'Start lesson', exact: true }).click();
  await expect(page.locator('#lessonToolbar')).toContainText('Step 1 of 1');
  await expect(page.locator('#lessonToolbar').getByRole('button', { name: 'Finish step' })).toBeVisible();
  await expect(page.locator('#lessonToolbar').getByText('Lesson options', { exact: true })).toBeVisible();
  await expect(page.locator('#lessonToolbar').getByRole('button', { name: 'End lesson' })).toBeHidden();
  const lessonOptions = page.locator('#lessonToolbar .lesson-toolbar__options');
  const lessonSummary = lessonOptions.locator('summary');
  await lessonSummary.focus();
  await page.keyboard.press('Space');
  await expect(lessonOptions).toHaveJSProperty('open', true);
  await expect(page.locator('#lessonToolbar').getByRole('button', { name: 'End lesson' })).toBeVisible();
  await expect(page.locator('#lessonToolbar').getByRole('link', { name: 'Review lesson plan' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(lessonOptions).toHaveJSProperty('open', false);
});


test('learner view keeps list exits hidden while reading and restores tutor navigation explicitly', async ({ page }) => {
  await page.goto('/activities/reading-words.html');
  await page.getByLabel('Learner label (initials or code)').fill('L01');
  await page.getByRole('button', { name: 'Add student' }).click();
  for (const activity of ['reading-words', 'paragraph-reading']) {
    await page.goto(`/activities/${activity}.html`);
    await page.getByRole('button', { name: 'Start reading' }).click();
    await expect(page.locator('#backToLists')).toBeVisible();
    await page.getByRole('button', { name: 'Show learner view' }).click();
    await expect(page.locator('#backToLists')).toBeHidden();
    await expect(page.locator('#endPractice')).toBeHidden();
    await expect(page.locator('#practicePanel')).toBeVisible();
    await page.getByRole('button', { name: 'Show tutor tools' }).click();
    await page.locator('#backToLists').click();
    await expect(page.locator('#tutorPanel')).toBeVisible();
  }
});


test('the activity planning link starts the guided wizard with quick edit still available', async ({ page }) => {
  await page.goto('/activities/blending-board.html');
  await page.getByRole('link', { name: 'Plan a lesson', exact: true }).click();
  await expect(page).toHaveURL(/lesson-builder\.html\?wizard=1$/);
  await expect(page.locator('#wizardProgress')).toContainText('Step 1 of 4');
  await expect(page.locator('#wizardStage3')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Use quick edit (show all sections)' })).toBeVisible();
});
