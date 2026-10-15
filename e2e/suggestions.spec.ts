import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sessionFixture } from '../tests/session-fixture';
import type { Data } from '../src/lib/model';
const base = process.env.TEST_SUBPATH || '/';

async function importData(page: Page, data: Data) {
  await page.goto(base + '#/settings');
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
    name: 'test-session-suggestion.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        app: 'FORM',
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        data,
      }),
    ),
  });
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Import method').selectOption('replace');
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Confirm replace import' }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(base + '#/today');
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-15T15:00:00Z') });
  await page.goto(base);
  await expect(page.getByRole('heading', { name: 'Make room for progress.' })).toBeVisible();
});

test('suggest session reviews scheduled routine progression and starts the shown targets persistently', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await importData(page, sessionFixture());
  const opener = page.getByRole('button', { name: 'Suggest session', exact: true });
  for (const theme of ['light', 'dark']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== theme)
      await page.getByRole('button', { name: 'Toggle colour theme' }).click();
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Suggested session', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Session to suggest')).toHaveValue('plan:next-upper');
    await expect(dialog.getByTestId('session-comparison')).toHaveText(
      'Compared with Last week upper on 8 Oct 2026.',
    );
    const bench = dialog.getByRole('region', {
      name: 'Barbell bench press suggestion',
      exact: true,
    });
    await expect(bench.getByText('Increase weight', { exact: true })).toBeVisible();
    await expect(bench.locator('.session-target-comparison > div').last()).toContainText(
      '62.5 kg · 8 reps',
    );
    const pushup = dialog.getByRole('region', { name: 'Push-up suggestion', exact: true });
    await expect(pushup.getByText('Build reps', { exact: true })).toBeVisible();
    await expect(pushup.locator('.session-target-comparison > div').last()).toContainText(
      '10 reps',
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: `test-results/suggestion-${theme}-${test.info().project.name}.png`,
    });
    if (theme === 'light') {
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
    }
  }
  await page.getByRole('button', { name: 'Start suggested session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Scheduled upper', exact: true })).toBeVisible();
  const load = page.getByRole('spinbutton', {
    name: 'Barbell bench press set 1 load (kg)',
    exact: true,
  });
  const reps = page.getByRole('spinbutton', {
    name: 'Barbell bench press set 1 reps',
    exact: true,
  });
  await expect(load).toHaveValue('62.5');
  await expect(reps).toHaveValue('8');
  await expect(
    page.getByRole('spinbutton', { name: 'Push-up set 1 reps', exact: true }),
  ).toHaveValue('10');
  await page.reload();
  await expect(load).toHaveValue('62.5');
  await page.goto(base + '#/today');
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Suggested session', exact: true });
  await expect(dialog.getByText(/is already active/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: /Start.*targets|Start suggested session/ }),
  ).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(load).toHaveValue('62.5');
  expect(errors).toEqual([]);
});

test('suggest session respects a weekly rest date and offers an honest first-session baseline', async ({
  page,
}) => {
  const data = sessionFixture();
  data.sessions = [];
  data.sets = [];
  data.plans = [
    { ...data.plans[0], id: 'rest', routineId: undefined, name: 'Rest day', status: 'rest' },
  ];
  await importData(page, data);
  await page.getByRole('button', { name: 'Suggest session', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Suggested session', exact: true });
  await expect(dialog.getByLabel('Session to suggest')).toHaveValue(
    'weekly:suggestion-routine:2026-10-22',
  );
  await expect(dialog.getByText('Today is a planned rest day.', { exact: false })).toBeVisible();
  await expect(dialog.getByTestId('session-comparison')).toContainText('No completed session');
  await expect(dialog.getByText('Set a baseline', { exact: true })).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Start now with these targets', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thursday upper', exact: true })).toBeVisible();
  await expect(
    page.getByRole('spinbutton', { name: 'Barbell bench press set 1 load (kg)', exact: true }),
  ).toHaveValue('60');
  await expect(
    page.getByRole('spinbutton', { name: 'Push-up set 1 reps', exact: true }),
  ).toHaveValue('8');
});

test('suggest session explains how to begin when no routines exist', async ({ page }) => {
  const data = sessionFixture();
  data.routines = [];
  data.plans = [];
  data.sessions = [];
  data.sets = [];
  await importData(page, data);
  await page.getByRole('button', { name: 'Suggest session', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Suggested session', exact: true });
  await expect(
    dialog.getByRole('heading', { name: 'Choose your first routine', exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Create a routine', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Create a routine', exact: true })).toBeVisible();
});
