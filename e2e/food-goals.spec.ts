import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.TEST_SUBPATH || '/';
async function details(page: Page, show = false) {
  await page.goto(base + '#/food-home');
  await page.getByRole('button', { name: 'Set food goals', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Age (years)', { exact: true }).fill('30');
  await dialog.getByLabel('Height for estimate (cm)', { exact: true }).fill('180');
  await dialog.getByLabel('Current weight for estimate (kg)', { exact: true }).fill('80');
  await dialog.getByLabel('Equation coefficient', { exact: true }).selectOption('male');
  await dialog
    .getByLabel('Would you like to see calories?', { exact: true })
    .selectOption(show ? 'yes' : 'no');
  await dialog.getByRole('checkbox', { name: /I’m an adult/ }).check();
  await dialog.getByRole('button', { name: 'Preview food goals', exact: true }).click();
  return page.getByRole('dialog', { name: 'Review your food goals', exact: true });
}
test('food goals save reviewed grams while calories remain hidden until an explicit opt-in', async ({
  page,
}) => {
  const dialog = await details(page);
  await expect(dialog.getByLabel('Estimated daily calories (kcal)', { exact: true })).toHaveCount(
    0,
  );
  await expect(dialog.getByLabel('Protein target (g)', { exact: true })).toHaveValue('128');
  await dialog.getByLabel('Protein target (g)', { exact: true }).fill('130');
  await dialog.getByRole('button', { name: 'Apply food goals', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Protein: 0 / 130 g', { exact: false })).toBeVisible();
  await expect(page.getByText(/kcal/)).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Protein: 0 / 130 g', { exact: false })).toBeVisible();
  await page.getByText('Food display', { exact: true }).click();
  await page.getByRole('switch', { name: 'Show calories', exact: true }).check();
  await expect(page.getByText('Estimated calories: 0 / 2,448 kcal', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review food goals', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByLabel('Would you like to see calories?', { exact: true }),
  ).toHaveValue('yes');
  await page.getByRole('dialog').getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.goto(base + '#/settings');
  await page.getByRole('switch', { name: 'Show calories', exact: true }).uncheck();
  await page.goto(base + '#/food-home');
  await expect(page.getByText(/kcal/)).toHaveCount(0);
});
test('explicit calorie choice appears in the review and cancellation leaves goals unset', async ({
  page,
}) => {
  const dialog = await details(page, true);
  await expect(dialog.getByLabel('Estimated daily calories (kcal)', { exact: true })).toHaveValue(
    '2448',
  );
  const results = await new AxeBuilder({ page }).include('dialog').analyze();
  expect(results.violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Set food goals', exact: true })).toBeVisible();
  await expect(page.getByText(/kcal/)).toHaveCount(0);
});

test('background energy follows recorded portions and incomplete entries without losing history when hidden', async ({
  page,
}) => {
  const route = base + '#/food-diary?date=2026-10-18';
  await page.goto(base + '#/settings');
  await page.getByRole('switch', { name: 'Show calories', exact: true }).check();
  await page.goto(route);
  await page.getByRole('button', { name: 'Log food', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Log food', exact: true });
  await dialog.getByLabel('Log from', { exact: true }).selectOption('manual');
  await dialog.getByLabel('Food name', { exact: true }).fill('Recorded lunch');
  await dialog.getByLabel('Protein (g)', { exact: true }).fill('20');
  await dialog.getByLabel('Carbohydrates (g)', { exact: true }).fill('30');
  await dialog.getByLabel('Fat (g)', { exact: true }).fill('10');
  await dialog.getByLabel('Servings eaten', { exact: true }).fill('2');
  await dialog.getByRole('button', { name: 'Save food entry', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.macro-summary').first()).toContainText('580');
  await page.getByRole('button', { name: 'Log food', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Log food', exact: true });
  await dialog.getByLabel('Log from', { exact: true }).selectOption('manual');
  await dialog.getByLabel('Food name', { exact: true }).fill('Unknown snack');
  await dialog.getByRole('button', { name: 'Save food entry', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText('Estimated calories: 580 kcal known subtotal; 1 entry has incomplete macros.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(base + '#/settings');
  await page.getByRole('switch', { name: 'Show calories', exact: true }).uncheck();
  await page.goto(route);
  await page.reload();
  await expect(page.locator('.food-diary-entry')).toHaveCount(2);
  await expect(page.getByText(/kcal/)).toHaveCount(0);
});
