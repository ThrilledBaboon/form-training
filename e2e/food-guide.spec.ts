import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.TEST_SUBPATH || '/';
test('optional food guide follows real programme actions, can be skipped and replayed, and never logs a meal itself', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00Z'));
  await page.goto(base + '#/food-home');
  const guide = page.getByRole('region', { name: 'Choose a programme', exact: true });
  await expect(page.locator('.food-guide')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show me how', exact: true }).click();
  await expect(guide).toBeVisible();
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await guide.getByRole('button', { name: 'Open Manage programmes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Manage programmes', exact: true })).toBeVisible();
  await expect(guide).toBeVisible();
  await page.getByRole('button', { name: 'Review starter programme', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Review programme import', exact: true });
  await review.getByRole('button', { name: 'Import programme', exact: true }).click();
  await expect(review).not.toBeVisible();
  await guide.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Preview and start', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start programme', exact: true }).click();
  const start = page.getByRole('dialog', { name: 'Start food programme', exact: true });
  await expect(start.getByText('Foods I avoid', { exact: true })).toBeVisible();
  await start
    .getByRole('button', { name: 'Start programme & fill empty slots', exact: true })
    .click();
  await expect(start).not.toBeVisible();
  await page.locator('.food-guide').getByRole('button', { name: 'Next step', exact: true }).click();
  await page
    .locator('.food-guide')
    .getByRole('button', { name: 'Open today’s meals', exact: true })
    .click();
  const row = page.locator('.food-home-daily .programme-meal-row').first();
  await expect(page.locator('.food-home-daily .programme-meal-row')).toHaveCount(3);
  await expect(
    page.locator('.food-home-daily').getByText('Checked in · unmeasured', { exact: true }),
  ).toHaveCount(0);
  await row.getByText('View meal', { exact: true }).click();
  await expect(row.getByRole('heading', { name: 'Ingredients', exact: true })).toBeVisible();
  await expect(row.getByRole('heading', { name: 'Method', exact: true })).toBeVisible();
  await page.locator('.food-guide').getByRole('button', { name: 'Next step', exact: true }).click();
  await row.getByRole('button', { name: 'Ate this', exact: true }).click();
  const check = page.getByRole('dialog', { name: 'Record meal eaten', exact: true });
  await check.getByRole('button', { name: 'Save check-in', exact: true }).click();
  await expect(row.getByText('Checked in · unmeasured', { exact: true })).toBeVisible();
  await page
    .locator('.food-guide')
    .getByRole('button', { name: 'Finish guide', exact: true })
    .click();
  await expect(page.locator('.food-guide')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.food-guide')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show me how', exact: true }).click();
  await expect(guide).toBeVisible();
  await guide.getByRole('button', { name: 'Skip guide', exact: true }).click();
  await expect(page.locator('.food-guide')).toHaveCount(0);
  await expect(row.getByText('Checked in · unmeasured', { exact: true })).toBeVisible();
});
