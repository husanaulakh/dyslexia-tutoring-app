import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Sound Boxes keeps the spelling concealed, supports keyboard counters, and saves tutor outcomes by learner', async ({ page }) => {
  await page.goto('/activities/sound-boxes.html');
  await page.getByLabel('Learner label (initials or code)').fill('SB1');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Word set').selectOption('ship');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('#progressText')).toHaveText('Word 1 of 1');
  await expect(page.locator('#boxes button')).toHaveCount(3);
  await expect(page.locator('#targetWord')).toBeEmpty();
  await expect(page.locator('#practicePanel')).not.toContainText('ship');
  await page.getByRole('button', { name: 'Show tutor word' }).click();
  await expect(page.locator('#tutorWord')).toHaveText('Word: ship');
  await page.getByRole('button', { name: 'Place counter in sound box 1' }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Remove counter from sound box 1' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Reveal written word' }).click();
  await expect(page.locator('#targetWord')).toHaveText('ship');
  await expect(page.getByRole('group', { name: 'Tutor-confirmed outcome' })).toBeVisible();
  await page.getByRole('button', { name: 'Independent' }).click();
  await page.getByRole('button', { name: 'Finish word and continue' }).click();
  await expect(page.locator('#doneSummary')).toContainText('1 independent');
  await expect(page.locator('#saveNotice')).toHaveText('Session saved on this device.');
  const store = await page.evaluate(() => JSON.parse(localStorage.getItem('bright-steps-student-progress')));
  expect(store.sessions.at(-1)).toMatchObject({ activity: 'sound-boxes', completedItems: 1, totalItems: 1, outcomeCounts: { independent: 1, supported: 0, revisit: 0 } });
  expect(store.sessions.at(-1).studentId).toBe(store.selectedStudentId);
});

test('Sound Boxes paper mode shows physical boxes and validates hostile or invalid annotations', async ({ page }) => {
  await page.goto('/activities/sound-boxes.html');
  await page.locator('#customWords').fill('bad | /b/');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('#setupError')).toContainText('2–6 explicit phonemes');
  await page.locator('#customWords').fill('<img src=x onerror=alert(1)> | /x/ /y/');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('#setupError')).toContainText('2–6 explicit phonemes');
  await expect(page.locator('#setupPanel img')).toHaveCount(0);
  const tooManyWords = Array.from({ length: 41 }, () => 'at | /ă/ /t/').join('\n');
  await page.locator('#customWords').fill(tooManyWords);
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('#setupError')).toContainText('no more than 40');
  await expect(page.locator('#practicePanel')).toBeHidden();
  await page.locator('#customWords').fill('at | /ă/ /t/');
  await page.getByLabel('Response mode').selectOption('paper');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('#boxes .sound-box')).toHaveCount(2);
  await expect(page.locator('#boxes button')).toHaveCount(0);
  await expect(page.locator('#counterHelp')).toContainText('physical counters');
  await page.getByRole('button', { name: 'Reveal written word' }).click();
  await expect(page.locator('#targetWord')).toHaveText('at');
  await page.getByRole('button', { name: 'Revisit' }).click();
  await page.getByRole('button', { name: 'Finish word and continue' }).click();
  await expect(page.locator('#doneSummary')).toContainText('1 to revisit');
  await expect(page.locator('#saveNotice')).toContainText('No learner was selected');
});

test('Sound Boxes has no accessibility violations and fits a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/activities/sound-boxes.html');
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
  const dims = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dims.scroll).toBeLessThanOrEqual(dims.client);
});
