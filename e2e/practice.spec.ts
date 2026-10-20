import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.TEST_SUBPATH || '/';
test('Rocket League is opt-in, runs a saved warm-up, records results and keeps them when hidden', async ({
  page,
}) => {
  await page.goto(base + '#/rocket-league-home');
  await expect(page.getByRole('heading', { name: 'Rocket League is switched off' })).toBeVisible();
  await page.goto(base + '#/settings');
  await page.getByRole('switch', { name: 'Enable Rocket League system', exact: true }).check();
  await page.goto(base + '#/rocket-league-library');
  await page.getByRole('button', { name: 'Add starter warm-ups', exact: true }).click();
  await expect(page.getByRole('heading', { name: '5-minute warm-up', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Practice goals', exact: true }).click();
  await page.getByLabel('Sessions per week').fill('4');
  await page.getByLabel('Current focus', { exact: true }).fill('Shooting with control');
  await page.getByRole('button', { name: 'Save goals', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Shooting accuracy', exact: true }).click();
  await page.getByLabel('Training pack code').fill('TEST-1234-ABCD-EFGH');
  await page.getByLabel('Setup / difficulty').fill('Stationary ball at midfield');
  expect((await new AxeBuilder({ page }).include('dialog').analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Save drill', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(base + '#/rocket-league-home');
  await expect(page.getByRole('progressbar', { name: 'Weekly practice goal' })).toHaveAttribute(
    'max',
    '4',
  );
  await page.getByRole('button', { name: 'Start 5-minute warm-up', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ball control', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause timer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume timer', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume timer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Complete without results', exact: true }).click();
  await page.getByRole('button', { name: 'Next set', exact: true }).click();
  await expect(page.getByText('TEST-1234-ABCD-EFGH', { exact: true })).toBeVisible();
  await page.getByLabel('Attempts', { exact: true }).fill('10');
  await page.getByLabel('Hits', { exact: true }).fill('7');
  await page.getByLabel('Set notes', { exact: true }).fill('Kept the approach consistent');
  await page.getByRole('button', { name: 'Record & rest', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Finish session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Practice history', exact: true })).toBeVisible();
  await page
    .getByLabel('Drill & setup')
    .selectOption({ label: 'Shooting accuracy · both · Stationary ball at midfield' });
  await expect(page.getByText('Personal best:', { exact: false })).toContainText('70.0 %');
  await page.getByRole('button', { name: 'View 5-minute warm-up', exact: true }).click();
  await page.getByText('Shooting accuracy · set 1 · completed', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Set notes', exact: true })).toHaveValue(
    'Kept the approach consistent',
  );
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto(base + '#/settings');
  await page.getByRole('switch', { name: 'Enable Rocket League system', exact: true }).uncheck();
  await page.goto(base + '#/rocket-league-history');
  await expect(page.getByRole('heading', { name: 'Rocket League is switched off' })).toBeVisible();
  await page.getByRole('button', { name: 'Enable rocket-league', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'View 5-minute warm-up', exact: true }),
  ).toBeVisible();
});
