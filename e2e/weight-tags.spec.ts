import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.TEST_SUBPATH || '/';
test('weigh-in tags filter history, averages and independent widgets after reload', async ({
  page,
}) => {
  await page.goto(base + '#/weight');
  await expect(page.getByRole('heading', { name: 'Bodyweight', exact: true })).toBeVisible();
  for (const [kg, tag] of [
    ['80', 'Fresh'],
    ['90', 'Gym'],
    ['75', ''],
  ]) {
    await page.getByRole('button', { name: 'Log bodyweight', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Bodyweight (kg)', { exact: true }).fill(kg);
    await dialog.getByLabel('Tags (comma separated)', { exact: true }).fill(tag);
    await dialog.getByRole('button', { name: 'Save measurement' }).click();
    await expect(dialog).toHaveCount(0);
  }
  await page.getByLabel('Weigh-in tag filter', { exact: true }).selectOption('tag:Fresh');
  await expect(page.locator('.weight-history > div')).toHaveCount(1);
  await expect(page.locator('.weight-history')).toContainText('80');
  await expect(page.locator('.metric-grid .metric-value').filter({ hasText: /^80\s*kg$/ })).toHaveCount(3);
  await page.reload();
  await expect(page.getByLabel('Weigh-in tag filter', { exact: true })).toHaveValue('tag:Fresh');
  await page.getByLabel('Weigh-in tag filter', { exact: true }).selectOption('untagged');
  await expect(page.locator('.weight-history')).toContainText('75');
  await page.getByRole('button', { name: 'Edit measurement', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Tags (comma separated)', { exact: true })
    .fill('Morning');
  await page.getByRole('button', { name: 'Save measurement' }).click();
  await expect(page.getByText('No measurements match this view')).toBeVisible();
  await page.getByLabel('Weigh-in tag filter', { exact: true }).selectOption('tag:Fresh');
  await page.goto(base + '#/today');
  const widget = page
    .locator('.workspace-widget')
    .filter({ has: page.getByRole('heading', { name: 'Bodyweight trend', exact: true }) });
  await expect(widget.getByLabel('Weigh-in tag filter', { exact: true })).toHaveValue('tag:Fresh');
  await widget.getByLabel('Weigh-in tag filter', { exact: true }).selectOption('tag:Gym');
  await page.reload();
  await expect(widget.getByLabel('Weigh-in tag filter', { exact: true })).toHaveValue('tag:Gym');
  await widget.getByRole('link', { name: /Explore/ }).click();
  await expect(page.getByLabel('Weigh-in tag filter', { exact: true })).toHaveValue('tag:Gym');
  await expect(page.locator('.weight-history')).toContainText('90');
  await page.goto(base + '#/weight');
  await expect(page.getByLabel('Weigh-in tag filter', { exact: true })).toHaveValue('tag:Fresh');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
