import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.TEST_SUBPATH || '/';
async function openSuggestion(page: Page) {
  await page.goto(base + '#/training-home');
  await page.getByRole('button', { name: 'Suggest session', exact: true }).click();
  return page.getByRole('dialog', { name: 'Suggested session', exact: true });
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T14:00:00Z') });
  await page.goto(base);
  await expect(page.getByRole('heading', { name: 'Make room for progress.' })).toBeVisible();
});
test('builds a balanced session, saves priorities and keeps individual replacements isolated', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  let dialog = await openSuggestion(page);
  await dialog.getByLabel('Suggestion type', { exact: true }).selectOption('full_body');
  await dialog.getByText('Suggestion preferences', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Chest, shoulders & back', exact: true }).click();
  await dialog.getByLabel('Maximum added accessories', { exact: true }).selectOption('2');
  await dialog.getByLabel('Pair suggested accessories into supersets').check();
  const regions = dialog.locator('.session-exercise-suggestion');
  await expect(regions).toHaveCount(5);
  await expect(regions.nth(0)).toContainText('Core push movement');
  await expect(regions.nth(1)).toContainText('Core pull movement');
  await expect(regions.nth(2)).toContainText('Core legs movement');
  const otherNames = await regions.locator('h4').allTextContents();
  await regions.first().getByRole('button', { name: 'Replace exercise', exact: true }).click();
  const replacedNames = await regions.locator('h4').allTextContents();
  expect(replacedNames[0]).not.toBe(otherNames[0]);
  expect(replacedNames.slice(1)).toEqual(otherNames.slice(1));
  await regions
    .first()
    .getByRole('checkbox', { name: /^Keep / })
    .check();
  await expect(regions.first().getByRole('button', { name: 'Replace exercise' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Regenerate unlocked exercises', exact: true }).click();
  await expect(regions.first().getByRole('heading', { level: 4 })).toHaveText(replacedNames[0]);
  await dialog.getByRole('button', { name: 'Save suggestion defaults', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.reload();
  dialog = await openSuggestion(page);
  await expect(dialog.getByLabel('Suggestion type', { exact: true })).toHaveValue('full_body');
  await dialog.getByText('Suggestion preferences', { exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Chest', exact: true })).toBeChecked();
  await expect(dialog.getByLabel('Maximum added accessories', { exact: true })).toHaveValue('2');
  await expect(dialog.getByLabel('How I feel today', { exact: true })).toHaveValue('normal');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.getByText('Suggestion preferences', { exact: true }).click();
  await page.screenshot({ path: `test-results/session-builder-${test.info().project.name}.png` });
  const names = await regions.locator('h4').allTextContents();
  await dialog.getByRole('button', { name: 'Start suggested session', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Balanced full body', exact: true }),
  ).toBeVisible();
  for (const name of names)
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Balanced full body', exact: true }),
  ).toBeVisible();
});

test('blocks a missing foundation and keeps normal routine targets available', async ({ page }) => {
  const dialog = await openSuggestion(page);
  await dialog.getByLabel('Suggestion type', { exact: true }).selectOption('full_body');
  await dialog.getByText('Suggestion preferences', { exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'Machine', exact: true }).check();
  await expect(dialog.getByRole('status')).toContainText('No eligible compound push');
  await expect(
    dialog.getByRole('button', { name: 'Start suggested session', exact: true }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: 'Use any equipment', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Start suggested session', exact: true }),
  ).toBeEnabled();
  await dialog.getByLabel('Suggestion type', { exact: true }).selectOption('routine');
  await expect(dialog.locator('.session-exercise-suggestion')).toHaveCount(4);
  await expect(
    dialog.getByRole('checkbox', { name: 'Add accessories to this routine', exact: true }),
  ).not.toBeChecked();
});

test('Cindy persists its timer and score offline, finishes into history and separates modified comparisons', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const dialog = await openSuggestion(page);
  await dialog.getByLabel('Suggestion type', { exact: true }).selectOption('cindy');
  await expect(dialog).toContainText('5 pull-ups → 10 push-ups → 15 air squats');
  await expect(dialog.getByRole('button', { name: 'Replace exercise', exact: true })).toHaveCount(
    0,
  );
  await dialog.getByRole('button', { name: 'Start suggested session', exact: true }).click();
  const circuit = page.getByRole('region', { name: 'Cindy circuit', exact: true });
  await expect(circuit).toBeVisible();
  await circuit.getByRole('button', { name: 'Start circuit timer', exact: true }).click();
  await page.clock.fastForward('00:00:12');
  await expect(circuit.getByRole('timer')).toHaveText('19:48');
  await page.reload();
  await expect(circuit.getByRole('timer')).toHaveText('19:48');
  await circuit.getByRole('button', { name: 'Pause circuit timer', exact: true }).click();
  await circuit.getByRole('button', { name: 'Log completed round', exact: true }).click();
  await circuit.getByLabel('Additional reps', { exact: true }).fill('7');
  await expect(circuit.getByText('1 round + 7 reps', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(circuit.getByLabel('Additional reps', { exact: true })).toHaveValue('7');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await expect(page).toHaveURL(/#\/history\?session=/);
  await expect(circuit.getByText('1 round + 7 reps', { exact: true })).toBeVisible();
  await context.setOffline(false);
  await circuit.getByLabel('Additional reps', { exact: true }).fill('9');
  await expect(circuit.getByText('1 round + 9 reps', { exact: true })).toBeVisible();
  await page.reload();
  await expect(circuit.getByLabel('Additional reps', { exact: true })).toHaveValue('9');
  await page.goto(base + '#/today');
  const again = await openSuggestion(page);
  await again.getByLabel('Suggestion type', { exact: true }).selectOption('cindy');
  await again.getByRole('button', { name: 'Start suggested session', exact: true }).click();
  await expect(circuit).toContainText('Best matching format: 1 round + 9 reps.');
  await circuit.getByText('Modified version & comparison', { exact: true }).click();
  await circuit.getByLabel('Cindy version', { exact: true }).selectOption('modified');
  await circuit.getByLabel('Modification description', { exact: true }).fill('Knee push-ups');
  await expect(circuit).toContainText('No earlier score for this exact format yet.');
  await expect(circuit.getByText('Best matching format:', { exact: false })).toHaveCount(0);
  expect(errors).toEqual([]);
});
