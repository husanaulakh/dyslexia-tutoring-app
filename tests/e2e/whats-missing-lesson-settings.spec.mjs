import { test, expect } from '@playwright/test';

test('What’s Missing applies lesson count and missing position', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('bright-steps-active-lesson', JSON.stringify({
    version: 1, runId: 'run-missing-settings', studentId: 'learner-1', index: 0, completedStepIds: [], startedAt: new Date().toISOString(),
    template: { id: 'lesson-missing-settings', name: 'Missing settings', conceptIds: [], steps: [
      { id: 'step-missing', activityId: 'whats-missing-cards', responseMode: 'screen', settings: { count: 4, mode: 'last' } },
    ] },
  })));
  await page.goto('/activities/whats-missing-cards.html');
  await expect(page.locator('#cardCount')).toHaveValue('4');
  await expect(page.locator('#cardCount')).toBeDisabled();
  await expect(page.locator('[data-mode="last"]')).toHaveClass(/active/);
  await expect(page.locator('[data-mode="last"]')).toBeDisabled();
  await page.getByRole('button', { name: 'Go to Letter Review' }).click();
  await page.getByRole('button', { name: 'Start Exercise' }).click();
  await expect(page.locator('.exercise-row .blank')).toHaveCount(1);
  const positions = await page.locator('.exercise-row .tile').evaluateAll(nodes => nodes.map((node, index) => node.classList.contains('blank') ? index : -1).filter(index => index >= 0));
  expect(positions).toEqual([2]);
});

test('What’s Missing retains editable standalone defaults without a lesson', async ({ page }) => {
  await page.goto('/activities/whats-missing-cards.html');
  await expect(page.locator('#cardCount')).toHaveValue('10');
  await expect(page.locator('#cardCount')).toBeEnabled();
  await expect(page.locator('[data-mode="middle"]')).toHaveClass(/active/);
  await expect(page.locator('[data-mode="middle"]')).toBeEnabled();
});
