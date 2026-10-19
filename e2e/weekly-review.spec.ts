import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.TEST_SUBPATH || '/';
test('weekly review is optional, respects system controls and keeps empty food history unknown', async ({
  page,
}) => {
  await page.goto(base + '#/weekly-review?date=2026-10-12');
  await expect(page.getByRole('heading', { name: 'Weekly review', exact: true })).toBeVisible();
  await expect(
    page.getByText('0 of 7 days with food logged. Unlogged days stay unknown.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/kcal|calories/i)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(base + '#/settings');
  await page.getByRole('switch', { name: 'Enable Food system', exact: true }).uncheck();
  await page.goto(base + '#/weekly-review?date=2026-10-12');
  await expect(page.getByRole('heading', { name: 'Food', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
  await page.goto(base + '#/today');
  await expect(page.getByRole('region', { name: 'Weekly review', exact: true })).toHaveCount(0);
});
