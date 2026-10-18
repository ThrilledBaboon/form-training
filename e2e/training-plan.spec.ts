import { test, expect } from '@playwright/test';
const base = process.env.TEST_SUBPATH || '/';
test('training home offers reviewed plan creation and saves the requested schedule', async ({
  page,
}) => {
  await page.goto(base + '#/training-home');
  await page.getByRole('button', { name: 'Generate a plan', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Workout days per week', { exact: true }).selectOption('4');
  await expect(dialog.getByLabel('Training split', { exact: true })).toHaveValue('upper_lower');
  await dialog.getByRole('button', { name: 'Preview plan', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Review your training plan', exact: true });
  await expect(
    dialog.getByRole('heading', { name: 'Upper A · Monday', exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel('Upper A: exercise 1', { exact: true })
    .selectOption({ label: 'Dumbbell bench press' });
  await dialog.getByRole('button', { name: 'Save plan to routines', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(base + '#/routines');
  await expect(
    page.getByRole('option', { name: 'Upper / lower · 4 days', exact: true }),
  ).toHaveCount(1);
  await expect(page.getByText('Upper A', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('option', { name: 'Upper / lower · 4 days', exact: true }),
  ).toHaveCount(1);
});
test('cancelled previews do not create routines', async ({ page }) => {
  await page.goto(base + '#/training-home');
  await page.getByRole('button', { name: 'Generate a plan', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Preview plan', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.goto(base + '#/routines');
  await expect(page.getByRole('option', { name: 'Full body · 3 days', exact: true })).toHaveCount(
    0,
  );
});
