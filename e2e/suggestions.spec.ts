import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sessionFixture } from '../tests/session-fixture';
import type { Data } from '../src/lib/model';
import { defaultWorkspace, makeWidget } from '../src/lib/workspace-model';
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
  const opener = page
    .getByRole('region', { name: 'Workout actions', exact: true })
    .getByRole('button', { name: 'Suggest session', exact: true });
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

test('workout actions choose routines, start a workout and resume the saved workout from either home', async ({
  page,
}) => {
  const actions = page.getByRole('region', { name: 'Workout actions', exact: true });
  await expect(actions.getByRole('button')).toHaveCount(3);
  await actions.getByRole('button', { name: 'Choose a routine', exact: true }).click();
  await expect(page).toHaveURL(/#\/routines$/);
  await page.goto(base + '#/training-home');
  await expect(actions.getByRole('button')).toHaveCount(3);
  await actions.getByRole('button', { name: 'Start a workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Freestyle workout', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Details', exact: true }).click();
  await page.getByLabel('Workout name', { exact: true }).fill('Saved widget workout');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await page.goto(base + '#/today');
  await page.reload();
  await expect(actions.getByText('Saved widget workout', { exact: true })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Start a workout', exact: true })).toHaveCount(
    0,
  );
  await actions.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Saved widget workout', exact: true }),
  ).toBeVisible();
  await page.goto(base + '#/training-home');
  await actions.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Saved widget workout', exact: true }),
  ).toBeVisible();
});

test('existing saved layouts gain merged actions without losing their standalone suggestion widget', async ({
  page,
}) => {
  const data = sessionFixture();
  data.workspace = defaultWorkspace();
  const overview = data.workspace.pages[0];
  overview.revision = 4;
  overview.widgets[0].title = 'My workout buttons';
  overview.widgets.splice(1, 0, makeWidget('suggestion', {}, 'saved-suggestion'));
  await importData(page, data);
  await expect(page.getByRole('button', { name: 'Suggest session', exact: true })).toHaveCount(2);
  const actions = page.getByRole('region', { name: 'My workout buttons', exact: true });
  await expect(actions.getByRole('button')).toHaveCount(3);
  await actions.getByRole('button', { name: 'Suggest session', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Suggested session', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .getByRole('region', { name: 'Suggested session', exact: true })
    .getByRole('button', { name: 'Suggest session', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'Suggested session', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Suggest session', exact: true })).toHaveCount(2);
  await expect(actions.getByRole('button')).toHaveCount(3);
});

test('merged workout actions fit a half-width widget on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const actions = page.getByRole('region', { name: 'Workout actions', exact: true });
  await page.getByRole('button', { name: 'Edit page', exact: true }).click();
  await actions.getByRole('button', { name: 'Configure widget', exact: true }).click();
  await page.getByText('Appearance & phone layout', { exact: true }).click();
  await page.getByLabel('Phone widget width', { exact: true }).selectOption('half');
  await page.getByRole('button', { name: 'Save widget', exact: true }).click();
  await page.getByRole('button', { name: 'Done editing', exact: true }).click();
  const buttons = actions.getByRole('button');
  await expect(buttons).toHaveCount(3);
  expect(
    await buttons.evaluateAll((nodes) =>
      nodes.every((node) => node.scrollWidth <= node.clientWidth),
    ),
  ).toBe(true);
  await buttons.filter({ hasText: 'Suggest session' }).click();
  await expect(page.getByRole('dialog', { name: 'Suggested session', exact: true })).toBeVisible();
});
