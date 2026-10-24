import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.TEST_SUBPATH || '/';

test('food keeps four primary tabs and preserves access to its existing tools under More', async ({
  page,
}) => {
  await page.goto(base + '#/food-more');
  const navigation = page.getByRole('navigation', { name: 'Food navigation', exact: true });
  await expect(navigation.getByRole('link')).toHaveText([
    'Today',
    'Manage programmes',
    'Food diary',
    'More',
  ]);
  await expect(navigation.getByRole('link', { name: 'More', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  expect(
    await page
      .locator('main')
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  for (const [name, route] of [
    ['Menu', 'food-menu'],
    ['Meal planner', 'food-planner'],
    ['Shopping', 'food-shopping'],
    ['Kitchen stock', 'food-kitchen'],
    ['Spending', 'food-budget'],
    ['Ingredients', 'food-ingredients'],
  ]) {
    await page
      .locator('main .food-grid')
      .getByRole('link', { name: new RegExp('^' + name) })
      .click();
    await expect(page).toHaveURL(new RegExp('#/' + route + '$'));
    await expect(navigation.getByRole('link', { name: 'More', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await navigation.getByRole('link', { name: 'More', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'More food tools', exact: true })).toBeVisible();
  }
});
