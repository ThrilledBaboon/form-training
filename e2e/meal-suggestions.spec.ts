import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { serialise } from '../src/lib/backup';
import { emptyData } from '../src/lib/model';
import { foodFixture } from '../tests/food-fixture';
const base = process.env.TEST_SUBPATH || '/';
test('suggested meals use local recipes and open a reviewed plan while calories stay hidden', async ({
  page,
}) => {
  await page.goto(base + '#/settings');
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
    name: 'meal-suggestion-fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialise({ ...structuredClone(emptyData), food: foodFixture() })),
  });
  const preview = page.getByRole('dialog', { name: 'Review your backup' });
  await expect(preview).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await preview.getByRole('button', { name: 'Confirm merge import' }).click();
  await expect(preview).not.toBeVisible();
  await page.goto(base + '#/food-home');
  await expect(page.getByRole('button', { name: 'Suggest a meal', exact: true })).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Suggest a meal', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Suggest a meal', exact: true });
  await expect(dialog.locator('.meal-suggestion-list > section').first()).toBeVisible();
  await expect(dialog.getByText(/kcal|calories/i)).toHaveCount(0);
  await dialog.getByLabel('Meal priority', { exact: true }).selectOption('quick');
  expect((await new AxeBuilder({ page }).include('dialog').analyze()).violations).toEqual([]);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await dialog
    .locator('.meal-suggestion-list > section')
    .first()
    .getByRole('button', { name: /^Plan / })
    .click();
  dialog = page.getByRole('dialog', { name: 'Plan a meal', exact: true });
  await expect(dialog.getByLabel('Planned recipe', { exact: true })).not.toHaveValue('');
  await dialog.getByRole('button', { name: 'Save planned meal', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Suggest a meal', exact: true })).toBeVisible();
});
test('empty menu gives a useful empty state', async ({ page }) => {
  await page.goto(base + '#/food-suggest');
  await expect(
    page.getByRole('heading', { name: 'No recipes match this view', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/kcal|calories/i)).toHaveCount(0);
});
