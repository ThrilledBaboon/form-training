import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.TEST_SUBPATH || '/';
test('combined planner creates and moves dated training and climbing plans', async ({ page }) => {
  await page.goto(base + '#/week-planner?date=2026-10-12');
  await page.getByRole('button', { name: 'Plan training on 2026-10-12', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Save training plan', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  let monday = page.getByRole('region', { name: 'Training for 2026-10-12', exact: true });
  await monday.getByRole('button', { name: /Edit or move/ }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Training date', { exact: true }).fill('2026-10-13');
  await dialog.getByRole('button', { name: 'Save training plan', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page
      .getByRole('region', { name: 'Training for 2026-10-13', exact: true })
      .getByRole('button', { name: /Edit or move/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Plan climbing on 2026-10-12', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Planned session name', { exact: true }).fill('Evening bouldering');
  await dialog.getByLabel('Venue', { exact: true }).fill('Local wall');
  await dialog.getByRole('button', { name: 'Save climbing plan', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Evening bouldering', { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Log this session', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Session name', { exact: true })).toHaveValue(
    'Evening bouldering',
  );
  await expect(dialog.getByLabel('Session date', { exact: true })).toHaveValue('2026-10-12');
});
