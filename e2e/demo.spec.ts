import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.TEST_SUBPATH || '/';

test('local demo fills six-month charts, persists, avoids duplicates and can be removed', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '?demo=jack#/today');
  await expect(page.getByRole('heading', { name: 'Make room for progress.' })).toBeVisible({
    timeout: 30000,
  });
  await expect(page).not.toHaveURL(/demo=jack/);
  await expect(page.getByText('A little stronger. Every session.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Find your rhythm.', { exact: true })).toHaveCount(0);
  await page.locator('.streak-card').click();
  await expect(page.getByRole('dialog', { name: 'Workout streak', exact: true })).toBeVisible();
  await expect(page.getByTestId('streak-count')).not.toHaveText('0');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.goto(base + '#/pages?page=demo-jack-v1-page');
  await expect(
    page.getByRole('heading', { name: 'Jack · six months [Demo]', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();
  await page.screenshot({
    path: `test-results/jack-demo-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto(base + '#/pages?page=demo-jack-v1-climbing-page');
  await expect(
    page.getByRole('heading', { name: 'Jack · climbing [Demo]', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Climbing activity', exact: true })).toBeVisible();
  await expect(
    page.getByRole('img', { name: /Climbing attempts: \d+ recorded points/ }),
  ).toBeVisible();
  await expect(page.getByText('Dashed line: Clean completions.', { exact: false })).toBeVisible();
  const climbingTotals = page.getByRole('region', { name: 'Climbing totals', exact: true });
  await expect(climbingTotals).toContainText(/\d+ attempts/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole('img', { name: /Climbing attempts: \d+ recorded points/ }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/jack-climbing-demo-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto(base + '#/settings');
  const panel = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Jack demo data', exact: true }) });
  await expect(panel.getByRole('status')).toContainText('sample workouts loaded');
  await expect(panel.getByRole('status')).toContainText(/\d+ sample climbing sessions/);
  const counts = await panel.getByRole('status').textContent();
  await page.reload();
  await panel.getByRole('button', { name: 'Load Jack’s demo data', exact: true }).click();
  await expect(
    page.getByText('Jack’s demo data is already loaded; no duplicates added.', { exact: true }),
  ).toBeVisible();
  await expect(panel.getByRole('status')).toHaveText(counts!);
  await panel.getByRole('button', { name: 'Remove Jack’s demo data', exact: true }).click();
  await expect(
    page.getByText('Jack’s demo data removed. Your own records were kept.', { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    panel.getByRole('button', { name: 'Remove Jack’s demo data', exact: true }),
  ).toBeDisabled();
  await page.goto(base + '#/today');
  await expect(page.locator('.streak-card')).toContainText('0 workout days');
  await page.goto(base + '#/climbing-home');
  await expect(
    page.getByText('0 attempts · 0 clean completions · 0 flashes', { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
