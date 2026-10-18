import { test, expect } from '@playwright/test';
const base = process.env.TEST_SUBPATH || '/';
test('first-use profile is optional, persists and remains editable without duplicate weigh-ins', async ({
  page,
}) => {
  await page.goto(base);
  await expect(page.getByRole('heading', { name: 'Welcome to FORM', exact: true })).toBeVisible();
  await page.getByLabel('Name (optional)', { exact: true }).fill('Sam');
  await page.getByLabel('Birthday (optional)', { exact: true }).fill('1998-03-12');
  await page.getByLabel('Height (cm)', { exact: true }).fill('175');
  await page.getByLabel('Starting weight (kg)', { exact: true }).fill('70');
  await page.getByLabel('Goal weight (kg)', { exact: true }).fill('75');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to FORM', exact: true })).toHaveCount(0);
  await page.reload();
  await page.goto(base + '#/settings');
  await expect(page.getByLabel('Name (optional)', { exact: true })).toHaveValue('Sam');
  await page.getByLabel('Height (cm)', { exact: true }).fill('176');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Profile saved' })).toBeVisible();
  await page.goto(base + '#/weight');
  await expect(page.getByRole('button', { name: 'Edit measurement', exact: true })).toHaveCount(1);
  await expect(page.getByText(/Starting weight from your profile/)).toBeVisible();
});
test('skipping welcome is remembered without inventing measurements', async ({ page }) => {
  await page.goto(base);
  await page.getByLabel('Name (optional)', { exact: true }).fill('Unsaved name');
  await page.getByLabel('Starting weight (kg)', { exact: true }).fill('70');
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to FORM', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Make room for progress.', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome to FORM', exact: true })).toHaveCount(0);
  await page.goto(base + '#/weight');
  await expect(page.getByRole('button', { name: 'Edit measurement', exact: true })).toHaveCount(0);
  await page.goto(base + '#/settings');
  await expect(page.getByLabel('Name (optional)', { exact: true })).toHaveValue('');
});
