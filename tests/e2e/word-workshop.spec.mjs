import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function addLearner(page) {
  await page.getByLabel('Learner label (initials or code)').fill('AB');
  await page.getByRole('button', { name: 'Add student' }).click();
}

test('Word Workshop loads with no accessibility violations', async ({ page }) => {
  await page.goto('/activities/word-workshop.html');
  await expect(page.getByRole('heading', { name: 'Word Workshop' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).slice(0, 3000)).toEqual([]);
});

test('screen silent-e keeps the answer covered until reveal and records aggregate tutor outcome', async ({ page }) => {
  await page.goto('/activities/word-workshop.html');
  await addLearner(page);
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('#itemWord')).toHaveText('cap');
  await expect(page.locator('#revealedAnswer')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Independent' })).toBeDisabled();
  await expect(page.locator('body')).not.toContainText('cape');
  await page.getByLabel('Your new word after adding silent e').fill('cape');
  await page.getByRole('button', { name: 'Record response' }).click();
  await expect(page.getByText('Response recorded for the tutor.')).toBeVisible();
  await page.getByRole('button', { name: 'Reveal tutor key' }).click();
  await expect(page.locator('#revealedAnswer')).toContainText('cap → cape');
  await page.getByRole('button', { name: 'Independent' }).click();
  await page.getByRole('button', { name: 'Finish item' }).click();
  await expect(page.locator('#itemWord')).toHaveText('kit');
  await expect(page.getByRole('button', { name: 'Reveal tutor key' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Independent' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reveal tutor key' }).click();
  await expect(page.getByRole('button', { name: 'Independent' })).toBeEnabled();
  await page.getByRole('button', { name: 'End practice' }).click();
  await expect(page.locator('#studentTracker')).toContainText('word-workshop: Silent-e transformations · 1 of 6 items');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-student-progress')));
  expect(saved.sessions.at(-1).outcomeCounts).toEqual({ independent: 1, supported: 0, revisit: 0 });
  expect(JSON.stringify(saved)).not.toContain('cape');
});

test('sort choices work by keyboard and do not expose the key before tutor reveal', async ({ page }) => {
  await page.goto('/activities/word-workshop.html');
  await addLearner(page);
  await page.getByLabel('Workshop', { exact: true }).selectOption('sort');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('#itemWord')).toHaveText('cliff');
  await expect(page.locator('#revealedAnswer')).toBeHidden();
  const floss = page.getByRole('button', { name: 'FLOSS', exact: true });
  await floss.focus();
  await page.keyboard.press('Enter');
  await expect(floss).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#revealedAnswer')).toBeHidden();
  await expect(page.getByRole('button', { name: 'With help' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reveal tutor key' }).click();
  await page.getByRole('button', { name: 'With help' }).click();
  await page.getByRole('button', { name: 'Finish item' }).click();
  await expect(page.locator('#itemWord')).toHaveText('sniff');
});

test('paper response mode keeps onscreen answer concealed and uses tutor-annotated VC.CV key', async ({ page }) => {
  await page.goto('/activities/word-workshop.html');
  await addLearner(page);
  await page.getByLabel('Workshop', { exact: true }).selectOption('vccv');
  await page.getByLabel('Response mode').selectOption('paper');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('#itemWord')).toHaveText('napkin');
  await expect(page.locator('#interaction')).toContainText('respond on paper or verbally');
  await expect(page.locator('#interaction input')).toHaveCount(0);
  await expect(page.locator('#revealedAnswer')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Revisit' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reveal tutor key' }).click();
  await expect(page.locator('#revealedAnswer')).toContainText('nap / kin');
  await page.getByRole('button', { name: 'Revisit' }).click();
  await page.getByRole('button', { name: 'Finish item' }).click();
  await page.getByRole('button', { name: 'End practice' }).click();
  await expect(page.locator('#studentTracker')).toContainText('word-workshop: Annotated VC.CV practice · 1 of 6 items');
});

test('six syllable types identify the marked syllable and custom VC.CV annotations reject hostile input', async ({ page }) => {
  await page.goto('/activities/word-workshop.html');
  await addLearner(page);
  await page.getByLabel('Workshop', { exact: true }).selectOption('syllables');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('#itemWord')).toHaveText('sun');
  await expect(page.locator('#focusSyllable')).toHaveText('Classify this marked syllable: sun');
  await page.getByRole('button', { name: 'End practice' }).click();
  await page.getByLabel('Workshop', { exact: true }).selectOption('vccv');
  await page.locator('#annotationEditor summary').click();
  await page.getByLabel('Word', { exact: true }).fill('<img src=x>');
  await page.getByLabel('Tutor-marked split').fill('img/srcx');
  await page.getByRole('button', { name: 'Save annotation' }).click();
  await expect(page.locator('#annotationStatus')).toContainText('Enter a plain alphabetic word');
  await expect(page.locator('img')).toHaveCount(0);
  await page.getByLabel('Word', { exact: true }).fill('dentist');
  await page.getByLabel('Tutor-marked split').fill('den/tist');
  await page.getByRole('button', { name: 'Save annotation' }).click();
  await expect(page.locator('#annotationStatus')).toContainText('Saved tutor annotation for dentist');
  await page.reload();
  await addLearner(page);
  await page.getByLabel('Workshop', { exact: true }).selectOption('vccv');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('#progressText')).toContainText('of 7');
});

test('Word Workshop has no horizontal overflow at a narrow screen width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/activities/word-workshop.html');
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
});


test('an invalid lesson item selection reports an error without substituting other words', async ({ page }) => {
  await page.goto('/activities/word-workshop.html');
  await addLearner(page);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('bright-steps-student-progress'));
    sessionStorage.setItem('bright-steps-active-lesson', JSON.stringify({
      version: 1, studentId: data.students[0].id, index: 0, completedStepIds: [], startedAt: new Date().toISOString(),
      template: { id: 'invalid-selection', name: 'Review', conceptIds: [], steps: [{ id: 'workshop-step', activityId: 'word-workshop', responseMode: 'paper', settings: { workshop: 'vccv', itemIds: ['unknown-item'] } }] },
    }));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('#setupStatus')).toContainText('No items are available');
  await expect(page.locator('#practicePanel')).toBeHidden();
});

test('custom VC.CV annotations remain intact when unreadable and lesson selection can target a saved annotation', async ({ page }) => {
  await page.goto('/activities/word-workshop.html');
  await page.evaluate(() => localStorage.setItem('bright-steps-word-workshop-v1', '{broken annotations'));
  await page.reload();
  await addLearner(page);
  await expect(page.locator('#annotationStatus')).toContainText('could not be read');
  await page.locator('#annotationEditor summary').click();
  await page.getByLabel('Word', { exact: true }).fill('dentist');
  await page.getByLabel('Tutor-marked split').fill('den/tist');
  await page.getByRole('button', { name: 'Save annotation' }).click();
  await expect(page.locator('#annotationStatus')).toContainText('left untouched');
  expect(await page.evaluate(() => localStorage.getItem('bright-steps-word-workshop-v1'))).toBe('{broken annotations');

  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('bright-steps-student-progress'));
    localStorage.setItem('bright-steps-word-workshop-v1', JSON.stringify([{ word: 'dentist', split: 'den/tist' }]));
    sessionStorage.setItem('bright-steps-active-lesson', JSON.stringify({
      version: 1, studentId: store.students[0].id, index: 0, completedStepIds: [], startedAt: new Date().toISOString(),
      template: { id: 'custom-vccv', name: 'Tutor review', conceptIds: [], steps: [{ id: 'custom-step', activityId: 'word-workshop', responseMode: 'paper', settings: { workshop: 'vccv', itemIds: ['custom-dentist-3'] } }] },
    }));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('#itemWord')).toHaveText('dentist');
});
