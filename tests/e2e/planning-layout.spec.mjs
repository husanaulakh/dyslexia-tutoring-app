import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('planning hierarchy reflows across widths, enlarged layout, and mirrored reading order', async ({ page }) => {
  await page.goto('/activities/lesson-builder.html');
  await page.getByLabel('Learner label (initials or code)').fill('P01');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Template name').fill('Review / careful blending and reading practice');
  await page.getByLabel('Practice activity').selectOption('trace-copy-cover-close');
  await page.getByLabel('Tutor-selected word').fill('bright');
  await page.getByRole('button', { name: 'Add step', exact: true }).click();
  await page.getByLabel('Practice activity').selectOption('paragraph-reading');
  await page.getByRole('button', { name: 'Add step', exact: true }).click();
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `layout at ${width}px`).toBe(true);
    await expect(page.getByRole('button', { name: 'Start lesson', exact: true })).toBeVisible();
    const targets = await page.locator('.step-reorder-handle').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
    expect(targets.every(target => target.width >= 44 && target.height >= 44)).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => { document.documentElement.style.zoom = ''; document.documentElement.dir = 'rtl'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByLabel('Practice activity')).toBeVisible();
  await page.evaluate(() => { document.documentElement.dir = 'ltr'; });
  await page.setViewportSize({ width: 375, height: 812 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const duration = await page.locator('#addStep').evaluate(node => getComputedStyle(node).transitionDuration);
  expect(duration.split(',').every(value => parseFloat(value) < .01)).toBe(true);
});
