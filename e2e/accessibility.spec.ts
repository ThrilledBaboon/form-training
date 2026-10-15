import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.TEST_SUBPATH || '/';
test('core screens pass automated WCAG A/AA checks', async ({ page }) => {
  const violations: unknown[] = [];
  for (const theme of ['light', 'dark']) {
    for (const route of [
      'today',
      'exercises',
      'routines',
      'progress',
      'muscles',
      'calendar',
      'weight',
      'settings',
    ]) {
      await page.goto(base + '#/' + route);
      await expect(page.locator('main h1')).toBeVisible();
      if ((await page.locator('html').getAttribute('data-theme')) !== theme) {
        await page.getByRole('button', { name: 'Toggle colour theme' }).click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      }
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      violations.push(
        ...results.violations.map((v) => ({
          route,
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })).slice(0, 8),
        })),
      );
    }
  }
  expect(violations).toEqual([]);
});
