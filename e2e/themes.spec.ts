import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.TEST_SUBPATH || '/';

test('palette choices survive navigation, reload, device colour changes and the theme shortcut', async ({
  page,
}) => {
  await page.goto(base + '#/settings');
  const slate = page.getByRole('radio', { name: 'Slate', exact: true });
  await slate.focus();
  await slate.press('Space');
  await expect(slate).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'slate');
  await page.getByLabel('Theme', { exact: true }).selectOption('system');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto(base + '#/food-home');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'slate');
  await page.getByRole('button', { name: 'Toggle colour theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'slate');
  await page.goto(base + '#/settings');
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('dark');
  await slate.focus();
  await slate.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Plum', exact: true })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'plum');
});

test('every palette has accessible controls and readable widgets in light and dark modes', async ({
  page,
}) => {
  test.setTimeout(120000);
  const violations: unknown[] = [];
  for (const palette of ['Sage', 'Sand', 'Slate', 'Plum']) {
    for (const theme of ['light', 'dark']) {
      await page.goto(base + '#/settings');
      const choice = page.getByRole('radio', { name: palette, exact: true });
      await choice.click();
      await expect(choice).toBeChecked();
      await page.getByLabel('Theme', { exact: true }).selectOption(theme);
      await expect(page.locator('html')).toHaveAttribute('data-palette', palette.toLowerCase());
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const route of ['settings', 'food-home']) {
        if (route !== 'settings') await page.goto(base + '#/' + route);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        violations.push(
          ...results.violations.map((v) => ({
            palette,
            theme,
            route,
            id: v.id,
            nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
          })),
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
    }
  }
  expect(violations).toEqual([]);
});
