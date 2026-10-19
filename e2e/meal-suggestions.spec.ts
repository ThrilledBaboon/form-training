import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.TEST_SUBPATH || '/';
test('suggested meals use local recipes and open a reviewed plan while calories stay hidden', async ({
  page,
}) => {
  await page.goto(base + '?demo=jack#/today');
  await expect(page).not.toHaveURL(/demo=jack/);
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
