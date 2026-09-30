import { test, expect } from '@playwright/test';

async function addStep(page, activity, mode, { preset, items, list } = {}) {
  await page.getByLabel('Practice activity').selectOption(activity);
  await page.getByLabel('Response mode').selectOption(mode);
  if (preset) await page.getByLabel('Activity preset').selectOption(preset);
  if (items) await page.getByLabel('Activity item selection').selectOption(items);
  if (list) await page.getByLabel('Word/list selection').selectOption(list);
  await page.getByRole('button', { name: 'Add step', exact: true }).click();
}
async function finishStep(page, next) {
  await page.locator('#lessonToolbar').getByRole('button', { name: 'Finish step' }).click();
  await expect(page).toHaveURL(new RegExp(`/activities/${next}\\.html(?:\\?.*)?$`));
}

test('a complete mixed-level lesson spans existing and new paper/screen activities with pinned attribution', async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('bright-steps-reading-word-lists', JSON.stringify([{ id: 'mixed-words', name: 'Mixed skills', words: ['ship', 'train'] }]));
    localStorage.setItem('bright-steps-paragraph-reading-lists', JSON.stringify([{ id: 'mixed-passages', name: 'Shared passage', paragraphs: ['The ship came in. We saw rain on the deck.'], questions: ['What happened? Which sentence tells you about the weather?'] }]));
  });
  await page.goto('/activities/lesson-builder.html');
  await page.getByLabel('Learner label (initials or code)').fill('L01');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Learner label (initials or code)').fill('L02');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Current student').selectOption({ label: 'L01' });
  await page.getByLabel('Template name').fill('Mixed level review');
  for (const id of ['l1-digraphs', 'l2-vowel-teams']) {
    const concept = page.locator(`[data-concept-id="${id}"]`);
    await concept.evaluate(node => { node.closest('details').open = true; });
    await concept.check();
  }
  await addStep(page, 'blending-board', 'screen');
  await addStep(page, 'sound-boxes', 'paper', { items: ['ship'] });
  await addStep(page, 'auditory-dictation', 'screen', { preset: 'words', items: ['word-map'] });
  await addStep(page, 'trace-copy-cover-close', 'paper');
  await addStep(page, 'word-workshop', 'paper', { preset: 'vccv', items: ['napkin'] });
  await addStep(page, 'reading-words', 'screen', { list: 'mixed-words' });
  await addStep(page, 'paragraph-reading', 'screen', { list: 'mixed-passages' });
  await addStep(page, 'visual-drill-cards', 'screen', { preset: 'all', items: ['vowel-teams-ai-train'] });
  await expect(page.locator('#lessonSteps li')).toHaveCount(8);
  await page.getByRole('button', { name: 'Save template' }).click();
  await page.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page).toHaveURL(/blending-board\.html$/);
  await page.evaluate(() => {
    const key = 'bright-steps-student-progress';
    const data = JSON.parse(localStorage.getItem(key));
    data.selectedStudentId = data.students[1].id;
    data.assessment = [{ studentId: data.students[0].id, itemId: 'l1-digraphs', status: 'developing', updatedAt: new Date().toISOString() }];
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await expect(page.locator('#lessonToolbar')).toContainText('L01');
  await expect(page.locator('#stage .card')).toHaveCount(3);
  await finishStep(page, 'sound-boxes');
  await page.locator('#lessonToolbar').getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/blending-board\.html$/);
  await page.locator('#lessonToolbar').getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/sound-boxes\.html$/);
  await page.reload();
  await expect(page.locator('#boxes .sound-box')).toHaveCount(3);
  await expect(page.locator('#boxes button')).toHaveCount(0);
  await expect(page.locator('#targetWord')).toBeEmpty();
  await page.getByRole('button', { name: 'Reveal written word' }).click();
  await page.getByRole('button', { name: 'Independent', exact: true }).click();
  await page.getByRole('button', { name: 'Finish word and continue' }).click();
  await finishStep(page, 'auditory-dictation');
  await expect(page.locator('#prompt')).toBeHidden();
  await page.getByRole('button', { name: 'Show tutor prompt' }).click();
  await expect(page.locator('#prompt')).toContainText('map');
  await page.getByLabel('Learner response').fill('map');
  await page.getByRole('button', { name: 'Reveal accepted spelling' }).click();
  await page.getByRole('button', { name: 'With help', exact: true }).click();
  await page.getByRole('button', { name: 'Finish item and continue' }).click();
  await finishStep(page, 'trace-copy-cover-close');
  await page.getByLabel('Practice word').fill('ship');
  await page.getByRole('button', { name: 'Begin this word' }).click();
  await page.getByRole('button', { name: 'Tutor confirms', exact: true }).click();
  for (let i = 1; i <= 4; i++) await page.getByRole('button', { name: `Draw letter ${i}` }).click();
  await page.getByRole('button', { name: /Continue to Copy/ }).click();
  await page.getByRole('button', { name: 'Tutor confirms copy completed on paper' }).click();
  await page.getByRole('button', { name: 'Tutor confirms spelling from memory on paper' }).click();
  await page.getByRole('button', { name: 'Tutor confirms spoken spelling' }).click();
  await page.getByRole('button', { name: /Finish this word/ }).click();
  await finishStep(page, 'word-workshop');
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await expect(page.locator('#itemWord')).toHaveText('napkin');
  await expect(page.locator('#interaction input')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal tutor key' }).click();
  await page.getByRole('button', { name: 'Revisit', exact: true }).click();
  await page.getByRole('button', { name: 'Finish item', exact: true }).click();
  await finishStep(page, 'reading-words');
  await expect(page.getByLabel('Words in this list')).toHaveValue('ship\ntrain');
  await page.getByRole('button', { name: 'Start reading' }).click();
  for (const word of ['ship', 'train']) {
    await expect(page.locator('#practiceWord')).toHaveText(word);
    await page.getByRole('button', { name: 'Independent', exact: true }).click();
  }
  await finishStep(page, 'paragraph-reading');
  await expect(page.getByLabel('Reread selection')).toHaveValue('all');
  await page.getByRole('button', { name: 'Start reading' }).click();
  for (let i = 0; i < 2; i++) {
    await expect(page.locator('#practiceQuestion')).toContainText('Which sentence');
    await page.getByRole('button', { name: 'Independent', exact: true }).click();
    await page.getByRole('button', { name: 'Finish paragraph' }).click();
  }
  await finishStep(page, 'visual-drill-cards');
  await expect(page.locator('.grapheme')).toHaveText('ai');
  await page.getByRole('button', { name: 'Start recall practice' }).click();
  await page.getByRole('button', { name: 'Show keyword' }).click();
  await expect(page.locator('#recallStage .keyword')).toHaveText('train');
  await page.getByRole('button', { name: 'Independent', exact: true }).click();
  await page.getByRole('button', { name: 'Finish recall practice' }).click();
  await finishStep(page, 'lesson-builder');
  const result = await page.evaluate(() => ({ data: JSON.parse(localStorage.getItem('bright-steps-student-progress')), active: sessionStorage.getItem('bright-steps-active-lesson') }));
  expect(result.active).toBeNull();
  expect(result.data.sessions.every(session => session.studentId === result.data.students[0].id)).toBe(true);
  expect(result.data.sessions.at(-1)).toMatchObject({ activity: 'lesson', completedItems: 8, totalItems: 8, conceptIds: ['l1-digraphs', 'l2-vowel-teams'] });
  expect(result.data.assessment[0].status).toBe('developing');
  expect(result.data.sessions.map(session => session.activity)).toEqual(expect.arrayContaining(['sound-boxes', 'auditory-dictation', 'trace-copy-cover-close', 'word-workshop', 'reading-words', 'paragraph-reading', 'visual-drill-cards', 'lesson']));
  expect(JSON.stringify(result.data.sessions)).not.toContain('Which sentence');
  expect(errors).toEqual([]);
});
