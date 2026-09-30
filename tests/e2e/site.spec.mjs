import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const activities = [
  ['/activities/sound-boxes.html', 'Sound Boxes'],
  ['/activities/whats-missing-cards.html', 'What’s Missing?'],
  ['/activities/blending-board.html', 'Tutor Blending Board'],
  ['/activities/trace-copy-cover-close.html', 'Trace, Copy, Cover, Close'],
  ['/activities/ufli-blending-board.html', 'UFLI Virtual Blending Board'],
  ['/activities/visual-drill-cards.html', 'Visual Drill Cards'],
  ['/activities/reading-words.html', 'Reading Words'],
  ['/activities/paragraph-reading.html', 'Paragraph Reading'],
  ['/activities/student-progress.html', 'Student Scope & Sequence'],
];

test('landing links to all activities and the site serves security headers', async ({ page, request }) => {
  const response = await request.get('/');
  expect(response.ok()).toBeTruthy();
  expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(response.headers()['permissions-policy']).toContain('microphone=()');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A little practice goes a long way.' })).toBeVisible();
  for (const [path, name] of activities) {
    const link = page.locator(`a[href="${path.slice(1)}"]`);
    await expect(link).toHaveCount(1);
    await expect(link).toContainText(name);
  }
});

for (const [path, title] of activities) {
  test(`${title} loads with shared theme and no accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('body')).toBeVisible();
    const background = await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor);
    expect(background).not.toBe('rgba(0, 0, 0, 0)');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).slice(0, 3000)).toEqual([]);
  });
}

test('all activity pages fit a narrow mobile viewport without horizontal scrolling or runtime errors', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  for (const [path] of activities) {
    await page.goto(path);
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll, `${path} overflows at 375px`).toBeLessThanOrEqual(dimensions.width);
    expect(pageErrors, `${path} raised a browser runtime error`).toEqual([]);
  }
});

test('What’s Missing completes a configured card, reports a wrong answer, and retries safely', async ({ page }) => {
  await page.goto('/activities/whats-missing-cards.html');
  await page.getByLabel('Number of cards').fill('1');
  await page.getByRole('button', { name: 'Last' }).click();
  await page.getByRole('button', { name: 'Go to Letter Review' }).click();
  await expect(page.getByRole('heading', { name: 'Review the alphabet' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Exercise' }).click();
  await page.getByRole('button', { name: 'Wrong' }).click();
  await expect(page.getByText('Almost, let\'s fix that one')).toBeVisible();
  await page.getByRole('button', { name: 'Next Card' }).click();
  await page.getByRole('button', { name: 'Right' }).click();
  await page.getByRole('button', { name: 'Next Card' }).click();
  await expect(page.getByRole('heading', { name: 'Final stats' })).toBeVisible();
  await expect(page.getByText('You finished all 1 cards.')).toBeVisible();
});

test('blending board changes only a matching sound and accepts longer spellings', async ({ page }) => {
  await page.goto('/activities/blending-board.html');
  await expect(page.locator('#currentWord')).toHaveText('fan');
  const original = await page.locator('#currentWord').textContent();
  await page.locator('.card[data-p="2"]').click();
  const firstChanged = await page.locator('#currentWord').textContent();
  expect(firstChanged).not.toBe(original);
  expect(firstChanged.slice(0, 2)).toBe(original.slice(0, 2));
  await page.locator('.card[data-p="0"]').click();
  const changed = await page.locator('#currentWord').textContent();
  expect(changed.slice(1)).toBe(firstChanged.slice(1));
  await page.getByLabel('Single word').fill('black');
  await page.getByLabel('Sound split').fill('b l a ck');
  await page.locator('#addSingle').click();
  await expect(page.locator('#currentWord')).toHaveText('black');
  await expect(page.locator('#dictionary')).toContainText('black');
  await page.locator('.card[data-p="0"]').click();
  await expect(page.locator('#currentWord')).toHaveText('black');
  await expect(page.locator('#feedback')).toContainText('No word in this list changes only this sound');
  await page.getByLabel('Bulk add').fill('think');
  await page.locator('#addBulk').click();
  await expect(page.locator('#dictionary')).toContainText('think');
  await page.reload();
  await expect(page.locator('#dictionary')).toContainText('think');
});

test('blending board rejects malicious storage and hostile word input without executing markup', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('blending-board-words-standalone', JSON.stringify([
    { word: '<img src=x onerror=window.__xss=true>', chunks: ['img','src','x','onerror'] },
  ])));
  await page.goto('/activities/blending-board.html');
  await expect(page.locator('#currentWord')).toHaveText('fan');
  await page.getByLabel('Single word').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('#singleWord')).toHaveValue(/^[a-z]{0,12}$/);
  await page.locator('#addSingle').click();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await expect(page.locator('#dictionary img')).toHaveCount(0);
});

test('TCCC validates tutor word and completes the trace-copy-cover-close sequence', async ({ page }) => {
  await page.goto('/activities/trace-copy-cover-close.html');
  await page.getByLabel('Practice word').fill('two words');
  await page.getByRole('button', { name: 'Begin this word' }).click();
  await expect(page.locator('#setupError')).toContainText('Enter one word');
  await page.getByLabel('Practice word').fill('ship');
  await page.getByRole('button', { name: 'Begin this word' }).click();
  await page.getByRole('button', { name: 'Tutor confirms' }).click();
  for (const label of ['Draw letter 1', 'Draw letter 2', 'Draw letter 3', 'Draw letter 4']) {
    await page.getByRole('button', { name: label }).click();
    await expect(page.locator('.counter').last()).toContainText(/\d \/ 4 letters/);
    await page.waitForTimeout(900);
  }
  await page.getByRole('button', { name: 'Continue to Copy' }).click();
  await page.getByLabel('Copy the word').fill('ship');
  await page.getByRole('button', { name: 'Check copy' }).click();
  await page.getByLabel('Spell the covered word').fill('shap');
  await page.getByRole('button', { name: 'Check spelling' }).click();
  await expect(page.getByText('Compare with the model:')).toBeVisible();
  await page.getByRole('button', { name: 'Try again from memory' }).click();
  await page.getByLabel('Spell the covered word').fill('ship');
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.locator('.step-row.active .step-title')).toHaveText('Close');
  await page.getByRole('button', { name: 'Tutor confirms spoken spelling' }).click();
  await page.getByRole('button', { name: /Finish this word/ }).click();
  await expect(page.getByText('Word practice complete')).toBeVisible();
});

test('starting a new TCCC word cancels an older pending letter animation', async ({ page }) => {
  await page.goto('/activities/trace-copy-cover-close.html');
  await page.getByLabel('Practice word').fill('ship');
  await page.getByRole('button', { name: 'Begin this word' }).click();
  await page.getByRole('button', { name: 'Tutor confirms' }).click();
  await page.getByRole('button', { name: 'Draw letter 1' }).click();
  await page.getByRole('button', { name: 'Set a new word' }).click();
  await page.getByLabel('Practice word').fill('cat');
  await page.getByRole('button', { name: 'Begin this word' }).click();
  await page.getByRole('button', { name: 'Tutor confirms' }).click();
  await page.waitForTimeout(900);
  await expect(page.getByRole('button', { name: 'Draw letter 1' })).toBeEnabled();
  await expect(page.locator('.counter').last()).toHaveText('0 / 3 letters');
});

test('visual drill cards flip, filter, and navigate with keyboard', async ({ page }) => {
  await page.goto('/activities/visual-drill-cards.html');
  await expect(page.locator('#cardCount')).toContainText('Card 1 of');
  await expect(page.locator('.grapheme')).toHaveText('s');
  await page.keyboard.press('Space');
  await expect(page.locator('.keyword')).toHaveText('sun');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.grapheme')).toHaveText('a');
  await page.getByRole('button', { name: /Flip to reveal apple/ }).click();
  await expect(page.locator('.sound')).toHaveText('/ă/');
  await page.getByLabel('Card type').selectOption('vowels');
  await expect(page.locator('.grapheme')).toHaveText('a');
  await expect(page.locator('#cardCount')).toContainText('of 5');
  await page.getByLabel('Learning stage').selectOption({ label: 'Stage 1 · SATPIN' });
  await expect(page.locator('#cardCount')).toContainText('of 2');
});

test('Reading Words reviews only missed words, spaces their retry, and saves per-student history', async ({ page }) => {
  await page.goto('/activities/reading-words.html');
  await expect(page.getByLabel('Words in this list')).toHaveValue(/tap.*duck.*rub.*bog/s);
  await page.getByLabel('Learner label (initials or code)').fill('Alex');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Learner label (initials or code)').fill('Jamie');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Current student').selectOption({ label: 'Alex' });
  await page.getByRole('button', { name: 'Add a list' }).click();
  await page.getByLabel('List name').fill('Short vowels');
  await page.getByLabel('Words in this list').fill('cat\ndog\npig\nsun');
  await page.getByRole('button', { name: 'Save list' }).click();
  await page.getByLabel('Choose a list').selectOption({ label: 'List 1' });
  await expect(page.getByLabel('Words in this list')).toHaveValue(/tap.*duck.*rub.*bog/s);
  await page.getByLabel('Choose a list').selectOption({ label: 'Short vowels' });
  await expect(page.getByLabel('Words in this list')).toHaveValue('cat\ndog\npig\nsun');
  await page.getByRole('button', { name: 'Start reading' }).click();
  await expect(page.locator('#practiceWord')).toHaveText('cat');
  await expect(page.locator('#wordProgressText')).toHaveText('Word 1 of 4');
  await page.getByRole('button', { name: 'Got it right' }).click();
  await expect(page.locator('#practiceWord')).toHaveText('dog');
  await expect(page.locator('#wordProgressText')).toHaveText('Word 2 of 4');
  await page.getByRole('button', { name: 'Got it wrong' }).click();
  await expect(page.locator('#practiceWord')).toHaveText('pig');
  await expect(page.locator('#wordProgressText')).toHaveText('Word 3 of 5');
  await page.getByRole('button', { name: 'Got it right' }).click();
  await expect(page.locator('#practiceWord')).toHaveText('sun');
  await page.getByRole('button', { name: 'Got it right' }).click();
  await expect(page.locator('#practiceWord')).toHaveText('dog');
  await expect(page.locator('#wordKind')).toHaveText('Read this word again');
  await page.getByRole('button', { name: 'Got it right' }).click();
  await expect(page.locator('#doneText')).toContainText('1 missed word was reviewed once');
  await expect(page.locator('#studentTracker')).toContainText('reading words: Short vowels · 5 of 5 items');
  await page.getByLabel('Current student').selectOption({ label: 'Jamie' });
  await expect(page.locator('#studentTracker')).toContainText('No sessions recorded yet.');
  await page.reload();
  await page.getByLabel('Current student').selectOption({ label: 'Alex' });
  await expect(page.locator('#studentTracker')).toContainText('reading words: Short vowels · 5 of 5 items');
  await page.getByLabel('Choose a list').selectOption({ label: 'Short vowels' });
  await expect(page.getByLabel('Words in this list')).toHaveValue('cat\ndog\npig\nsun');
});

test('Paragraph Reading supports tutor lists, spaced review, and saved student sessions', async ({ page }) => {
  await page.goto('/activities/paragraph-reading.html');
  await page.getByLabel('Learner label (initials or code)').fill('Riley');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByRole('button', { name: 'Add a list' }).click();
  await page.getByLabel('List name').fill('Short passages');
  await page.getByLabel('Paragraphs in this list').fill('First passage.\n\nSecond passage.\n\nThird passage.\n\nFourth passage.\n\nFifth passage.');
  await page.getByRole('button', { name: 'Save list' }).click();
  await page.getByLabel('Choose a list').selectOption({ label: 'Paragraphs 1' });
  await expect(page.getByLabel('Paragraphs in this list')).toHaveValue(/Sam has a red cap/);
  await page.getByLabel('Choose a list').selectOption({ label: 'Short passages' });
  await expect(page.getByLabel('Paragraphs in this list')).toHaveValue(/First passage.*Fifth passage/s);
  await page.getByRole('button', { name: 'Start reading' }).click();
  await expect(page.locator('#practiceParagraph')).toHaveText('First passage.');
  for (const paragraph of ['Second passage.', 'Third passage.', 'Fourth passage.', 'First passage.']) {
    await page.getByRole('button', { name: 'Next paragraph' }).click();
    await expect(page.locator('#practiceParagraph')).toHaveText(paragraph);
  }
  await expect(page.locator('#paragraphKind')).toHaveText('Review · Paragraph 1');
  await page.getByRole('button', { name: 'Back to tutor lists' }).click();
  await expect(page.locator('#studentTracker')).toContainText('paragraph reading: Short passages · 4 of 10 items');
  await page.reload();
  await expect(page.locator('#studentTracker')).toContainText('Riley');
  await expect(page.locator('#studentTracker')).toContainText('paragraph reading: Short passages · 4 of 10 items');
  await page.getByLabel('Choose a list').selectOption({ label: 'Short passages' });
  await expect(page.getByLabel('Paragraphs in this list')).toHaveValue(/First passage.*Fifth passage/s);
});

test('Student Scope & Sequence saves assessment statuses separately per student across reloads', async ({ page }) => {
  await page.goto('/activities/student-progress.html');
  await expect(page.getByRole('heading', { name: 'Student Scope & Sequence' })).toBeVisible();
  await page.getByLabel('Learner label (initials or code)').fill('Sam');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Learner label (initials or code)').fill('Ari');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Current student').selectOption({ label: 'Sam' });
  await page.locator('.level-group').nth(1).locator('summary').click();
  await page.getByLabel('Status for Short vowel sounds').selectOption('developing');
  await page.getByLabel('Status for Vowel team syllable').selectOption('secure');
  await expect(page.locator('#selectedStudentSummary')).toContainText('Sam: 2 of');
  await page.getByLabel('Current student').selectOption({ label: 'Ari' });
  await expect(page.getByLabel('Status for Short vowel sounds')).toHaveValue('');
  await page.getByLabel('Status for Short vowel sounds').selectOption('introduced');
  await page.reload();
  await page.getByLabel('Current student').selectOption({ label: 'Sam' });
  await page.locator('.level-group').nth(1).locator('summary').click();
  await expect(page.getByLabel('Status for Short vowel sounds')).toHaveValue('developing');
  await expect(page.getByLabel('Status for Vowel team syllable')).toHaveValue('secure');
  await expect(page.locator('#selectedStudentSummary')).toContainText('1 secure');
  await page.getByLabel('Current student').selectOption({ label: 'Ari' });
  await expect(page.getByLabel('Status for Short vowel sounds')).toHaveValue('introduced');
  await expect(page.getByLabel('Status for Vowel team syllable')).toHaveValue('');
});

test('UFLI third-party frame makes no request until the tutor chooses to load it', async ({ page }) => {
  let externalRequests = 0;
  await page.route('https://research.dwi.ufl.edu/**', async route => {
    externalRequests += 1;
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Mock UFLI</title>' });
  });
  await page.goto('/activities/ufli-blending-board.html');
  await expect(page.locator('#ufliBoard')).not.toHaveAttribute('src', /.+/);
  expect(externalRequests).toBe(0);
  await page.getByRole('button', { name: 'Load external board' }).click();
  await expect.poll(() => page.frameLocator('#ufliBoard').locator('title').evaluate(node => node.textContent)).toBe('Mock UFLI');
  expect(externalRequests).toBeGreaterThan(0);
});
