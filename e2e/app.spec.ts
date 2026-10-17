import { test, expect, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { fixture } from '../tests/fixtures';
const base = process.env.TEST_SUBPATH || '/';
const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  await expect(page.getByRole('heading', { name: 'Make room for progress.' })).toBeVisible();
});
test.afterEach(async () => {
  expect(errors.splice(0)).toEqual([]);
});
async function navigate(page: Page, route: string) {
  await page.goto(base + '#/' + route);
}
async function blankWorkout(page: Page) {
  await page.getByRole('button', { name: 'Start a workout', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Freestyle workout', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Find an exercise' }).fill('Barbell bench press');
  await dialog.getByRole('button', { name: 'Barbell bench press Barbell' }).click();
  await expect(
    page.getByRole('heading', { name: 'Barbell bench press', exact: true }),
  ).toBeVisible();
}
async function logBench(page: Page) {
  const load = page.getByRole('spinbutton', {
    name: 'Barbell bench press set 1 load (kg)',
    exact: true,
  });
  await load.fill('60');
  await load.blur();
  const reps = page.getByRole('spinbutton', {
    name: 'Barbell bench press set 1 reps',
    exact: true,
  });
  await reps.fill('10');
  await reps.blur();
  await page
    .getByRole('button', { name: 'Complete Barbell bench press set 1', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Undo completion of Barbell bench press set 1', exact: true }),
  ).toBeVisible();
}
async function importStreakHistory(page: Page, days: string[]) {
  const data = fixture();
  const session = data.sessions[0];
  const set = data.sets[0];
  data.sessions = days.map((day, i) => ({
    ...session,
    id: `streak-session-${i}`,
    startAt: new Date(day + 'T08:00:00').toISOString(),
    endAt: new Date(day + 'T09:00:00').toISOString(),
  }));
  data.sets = data.sessions.map((session, i) => ({
    ...set,
    id: `streak-set-${i}`,
    sessionId: session.id,
    completedAt: session.endAt,
  }));
  await navigate(page, 'settings');
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
    name: 'test-streak-history.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ app: 'FORM', schemaVersion: 2, exportedAt: new Date().toISOString(), data }),
    ),
  });
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Import method').selectOption('replace');
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Confirm replace import' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('workout streak counts finished workout days once, survives reload and opens from the dashboard', async ({
  page,
}) => {
  await blankWorkout(page);
  await logBench(page);
  await expect(
    page.getByRole('button', { name: 'Open workout streak, 0 workout days' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open workout streak, 1 workout day' }),
  ).toBeVisible();
  await navigate(page, 'today');
  await page.locator('.streak-card').click();
  await expect(page.getByRole('dialog', { name: 'Workout streak', exact: true })).toBeVisible();
  await expect(page.getByTestId('streak-count')).toHaveText('1');
  await expect(page.getByTestId('streak-rest-balance')).toHaveText('5');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await blankWorkout(page);
  await logBench(page);
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await expect(page.locator('.page-title p')).toContainText('Completed');
  await page.reload();
  await page.getByRole('button', { name: 'Open workout streak, 1 workout day' }).click();
  await expect(page.getByTestId('streak-rest-balance')).toHaveText('5');
  await expect(page.locator('.streak-day.workout')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /2 completed workouts/ })).toHaveCount(1);
});
test('streak calendar shows protected rest, month navigation, history corrections and accessible themes', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-15T12:00:00') });
  await page.goto(base);
  await importStreakHistory(page, ['2026-10-10', '2026-10-13', '2026-10-14']);
  for (const theme of ['light', 'dark']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== theme) {
      await page.getByRole('button', { name: 'Toggle colour theme' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    }
    await page.getByRole('button', { name: 'Open workout streak, 3 workout days' }).click();
    const dialog = page.getByRole('dialog', { name: 'Workout streak', exact: true });
    await expect(page.getByTestId('streak-rest-balance')).toHaveText('5');
    await expect(dialog.locator('.streak-day.workout')).toHaveCount(3);
    await expect(dialog.locator('.streak-day.rest')).toHaveCount(2);
    await dialog.getByRole('button', { name: /11 October 2026, protected rest day/ }).click();
    await expect(
      dialog.getByText('1 rest day used to protect your streak', { exact: true }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Previous streak month' }).click();
    await expect(dialog.getByRole('heading', { name: 'September 2026' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Next streak month' }).click();
    await expect(dialog.getByRole('heading', { name: 'October 2026' })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({
      path: `test-results/streak-${theme}-${test.info().project.name}.png`,
      fullPage: false,
    });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Open workout streak, 3 workout days' }),
    ).toBeFocused();
  }
  await page.getByRole('button', { name: 'Open workout streak, 3 workout days' }).click();
  await page.getByRole('button', { name: /13 October 2026, 1 completed workout/ }).click();
  await page.getByRole('button', { name: 'View workouts on selected streak day' }).click();
  await expect(page).toHaveURL(/#\/calendar\?date=2026-10-13$/);
  await page.getByRole('link', { name: /COMPLETED Upper session/ }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete session', exact: true }).click();
  await page.getByRole('button', { name: 'Open workout streak, 2 workout days' }).click();
  await expect(page.getByTestId('streak-rest-balance')).toHaveText('3');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open workout streak, 3 workout days' }),
  ).toBeVisible();
});
test('streak rest balance and expiry update at local midnight without a reload', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-15T23:59:30') });
  await page.goto(base);
  await importStreakHistory(page, ['2026-10-10']);
  await page.getByRole('button', { name: 'Open workout streak, 1 workout day' }).click();
  await expect(page.getByTestId('streak-rest-balance')).toHaveText('1');
  await page.clock.fastForward(31_000);
  await expect(page.getByTestId('streak-rest-balance')).toHaveText('0');
  await expect(page.getByTestId('streak-count')).toHaveText('1');
  await expect(page.getByText('No rest days left. Train today to keep your streak.')).toBeVisible();
  await page.clock.fastForward(86_400_000);
  await expect(page.getByTestId('streak-count')).toHaveText('0');
  await expect(page.locator('.streak-best')).toContainText('1 workout day');
});
test('reset requires typed confirmation, keeps a downloadable backup and restores a clean start', async ({
  page,
}) => {
  await blankWorkout(page);
  await logBench(page);
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await expect(page.locator('.page-title p')).toContainText('Completed');
  await navigate(page, 'today');
  await blankWorkout(page);
  await logBench(page);
  await navigate(page, 'settings');
  await page.getByRole('button', { name: 'Reset all data', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Reset all FORM data?' });
  await expect(dialog.getByRole('button', { name: 'Permanently reset FORM' })).toBeDisabled();
  await dialog.getByLabel('Type RESET to confirm', { exact: true }).fill('reset');
  await expect(dialog.getByRole('button', { name: 'Permanently reset FORM' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open workout streak, 1 workout day' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset all data', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Reset all FORM data?' });
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export backup before resetting' }).click();
  const backupPath = await (await download).path();
  expect(backupPath).toBeTruthy();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  await dialog.getByLabel('Type RESET to confirm', { exact: true }).fill('RESET');
  await dialog.getByRole('button', { name: 'Permanently reset FORM' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('FORM has been reset. Your starter library is ready.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open workout streak, 0 workout days' }),
  ).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Rest timer' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('No file backup exported yet', { exact: true })).toBeVisible();
  await navigate(page, 'history');
  await expect(page.getByText('A blank page, with potential', { exact: true })).toBeVisible();
  await navigate(page, 'workout');
  await expect(page.getByRole('heading', { name: 'Your next session awaits.' })).toBeVisible();
  await navigate(page, 'settings');
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles(backupPath!);
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Import method').selectOption('replace');
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Confirm replace import' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Open workout streak, 1 workout day' }),
  ).toBeVisible();
  await navigate(page, 'workout');
  await expect(
    page.getByRole('button', { name: 'Undo completion of Barbell bench press set 1', exact: true }),
  ).toBeVisible();
});
test('starts with honest empty states and no fake charts', async ({ page }) => {
  await expect(page.getByText('Your story starts with a set')).toBeVisible();
  await expect(page.getByText('Earn your first personal record')).toBeVisible();
  await page.screenshot({
    path: `test-results/overview-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('restores the active workout after closing and reopening the browser profile', async ({
  playwright,
  browserName,
  baseURL,
}) => {
  const directory = await mkdtemp(join(tmpdir(), 'form-browser-'));
  let persistent = await playwright[browserName].launchPersistentContext(directory);
  try {
    let restoredPage = await persistent.newPage();
    await restoredPage.goto(new URL(base, baseURL).href);
    await expect(
      restoredPage.getByRole('heading', { name: 'Make room for progress.' }),
    ).toBeVisible();
    await blankWorkout(restoredPage);
    await logBench(restoredPage);
    await persistent.close();
    persistent = await playwright[browserName].launchPersistentContext(directory);
    restoredPage = await persistent.newPage();
    await restoredPage.goto(new URL(base, baseURL).href + '#/workout');
    await expect(
      restoredPage.getByRole('heading', { name: 'Freestyle workout', exact: true }),
    ).toBeVisible();
    await expect(
      restoredPage.getByRole('spinbutton', {
        name: 'Barbell bench press set 1 load (kg)',
        exact: true,
      }),
    ).toHaveValue('60');
    await expect(
      restoredPage.getByRole('button', {
        name: 'Undo completion of Barbell bench press set 1',
        exact: true,
      }),
    ).toBeVisible();
    await expect(restoredPage.getByRole('complementary', { name: 'Rest timer' })).toBeVisible();
  } finally {
    await persistent.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test('logs persistently, runs rest timer, finishes and updates all analytics', async ({ page }) => {
  await blankWorkout(page);
  await logBench(page);
  await expect(page.getByRole('complementary', { name: 'Rest timer' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause timer' }).click();
  await expect(page.getByText('Timer paused')).toBeVisible();
  await page.getByRole('button', { name: 'Add 15 seconds' }).click();
  await page.getByRole('button', { name: 'Resume timer' }).click();
  await expect(page.getByText('Rest timer', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Undo completion of Barbell bench press set 1', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('spinbutton', { name: 'Barbell bench press set 1 load (kg)', exact: true }),
  ).toHaveValue('60');
  await page.screenshot({
    path: `test-results/workout-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await expect(page.locator('.page-title p')).toContainText('Completed');
  await navigate(page, 'progress?exercise=exercise-barbell-bench-press');
  await expect(
    page.getByRole('img', { name: /External volume: 1 recorded points. Latest 600 kg/ }),
  ).toBeVisible();
  await navigate(page, 'muscles?muscle=chest');
  await expect(page.getByText('Barbell bench press', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: /Muscle set contributions: 1 recorded points. Latest 1 contributions/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText('No contribution was recorded in the preceding period.', { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/muscles-${test.info().project.name}.png`,
    fullPage: true,
  });
  await navigate(page, 'calendar');
  await expect(page.getByRole('link', { name: /COMPLETED Freestyle workout/ })).toBeVisible();
  await navigate(page, 'records');
  await expect(page.getByRole('heading', { name: 'Barbell bench press' }).first()).toBeVisible();
  await navigate(page, 'today');
  await expect(page.getByText('First-session baseline', { exact: false })).toBeVisible();
  await blankWorkout(page);
  await page
    .getByRole('spinbutton', { name: 'Barbell bench press set 2 load (kg)', exact: true })
    .fill('20');
  await page.getByText('Notes, groups & suggested targets', { exact: true }).click();
  await page.getByRole('button', { name: 'Use suggested targets', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Barbell bench press set 2 load (kg)', exact: true }),
  ).toHaveValue('60');
  await expect(
    page.getByRole('button', { name: 'Complete Barbell bench press set 1', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Copy previous session', exact: true }).click();
  await expect(page.locator('.set-row')).toHaveCount(4);
  await expect(
    page.getByRole('button', { name: 'Complete Barbell bench press set 4', exact: true }),
  ).toBeVisible();
});
test('substitutes an uncompleted exercise and persists the replacement', async ({ page }) => {
  await blankWorkout(page);
  await page.getByRole('button', { name: 'Substitute', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Find an exercise' }).fill('Plank');
  await dialog.getByRole('button', { name: /^Plank Bodyweight/ }).click();
  await expect(page.getByRole('heading', { name: 'Plank', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Barbell bench press', exact: true })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(
    page.getByRole('spinbutton', { name: 'Plank set 1 duration (s)', exact: true }),
  ).toHaveValue('45');
});
test('creates a custom exercise and a grouped routine, schedules and starts its snapshot', async ({
  page,
}) => {
  await navigate(page, 'exercises');
  await page.getByRole('button', { name: 'Create exercise', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Exercise name', { exact: true }).fill('My test press');
  await dialog.getByLabel('Chest contribution', { exact: true }).selectOption('primary');
  await dialog.getByRole('button', { name: 'Save exercise', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My test press', exact: true })).toBeVisible();
  await navigate(page, 'routines');
  await page.getByRole('button', { name: 'Create routine', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Routine name', { exact: true }).fill('My test routine');
  await dialog.getByRole('button', { name: 'Add exercise', exact: true }).click();
  const picker = page.getByRole('dialog').last();
  await picker.getByRole('textbox', { name: 'Find an exercise' }).fill('My test press');
  await picker.getByRole('button', { name: /My test press/ }).click();
  await dialog.getByRole('textbox', { name: 'New group name' }).fill('Round A');
  await dialog.getByRole('combobox', { name: 'Group type', exact: true }).selectOption('circuit');
  await dialog.getByRole('button', { name: 'Add group', exact: true }).click();
  await dialog.getByLabel('Group', { exact: true }).selectOption({ label: 'Round A · circuit' });
  await dialog.getByRole('button', { name: 'Save plan', exact: true }).click();
  const card = page
    .locator('.routine-card')
    .filter({ has: page.getByRole('heading', { name: 'My test routine', exact: true }) });
  await card.getByRole('button', { name: 'Schedule', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Schedule session', exact: true })
    .click();
  const planned = page
    .locator('.session-row')
    .filter({ has: page.getByText('My test routine', { exact: true }) });
  await planned.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My test routine', exact: true })).toBeVisible();
  await expect(page.locator('.badge').filter({ hasText: 'Round A · circuit' })).toBeVisible();
});
test('bodyweight entries, goal and raw versus moving-average chart', async ({ page }) => {
  await navigate(page, 'weight');
  await page.getByRole('button', { name: 'Log bodyweight', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Bodyweight (kg)', { exact: true }).fill('80.5');
  await dialog.getByRole('button', { name: 'Save measurement' }).click();
  await expect(
    page.getByRole('img', { name: /Bodyweight: 1 recorded points. Latest 80.5 kg/ }),
  ).toBeVisible();
  await page.getByLabel('Goal bodyweight (kg)', { exact: true }).fill('78');
  await page.getByRole('button', { name: 'Save goal' }).click();
  await expect(page.getByText('Goal updated', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Goal bodyweight (kg)', { exact: true })).toHaveValue('78');
  await navigate(page, 'today');
  await expect(
    page.getByRole('img', { name: /Bodyweight: 1 recorded points. Latest 80.5 kg/ }),
  ).toBeVisible();
});
test('JSON backup restores after replacement; repeated merge does not duplicate', async ({
  page,
}) => {
  await blankWorkout(page);
  await logBench(page);
  await navigate(page, 'settings');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export everything' }).click();
  const file = await downloaded;
  const path = await file.path();
  expect(path).toBeTruthy();
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles(path!);
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Review your backup' })).toBeVisible();
  await dialog.getByLabel('Import method').selectOption('replace');
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Confirm replace import' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles(path!);
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Import method').selectOption('merge');
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Confirm merge import' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await navigate(page, 'workout');
  await expect(
    page.getByRole('button', { name: 'Undo completion of Barbell bench press set 1', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.set-row')).toHaveCount(3);
});
test('offline cached navigation and active workout survive reload', async ({ page, context }) => {
  await blankWorkout(page);
  await logBench(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Freestyle workout', exact: true })).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Undo completion of Barbell bench press set 1', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('spinbutton', { name: 'Barbell bench press set 2 load (kg)', exact: true })
    .fill('60');
  await page
    .getByRole('button', { name: 'Complete Barbell bench press set 2', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Undo completion of Barbell bench press set 2', exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
});
test('routes, dark theme and narrow layouts have no horizontal overflow', async ({ page }) => {
  for (const route of [
    'today',
    'exercises',
    'routines',
    'progress',
    'muscles',
    'calendar',
    'weight',
    'records',
    'settings',
    'history',
    'workout',
    'missing',
  ]) {
    await navigate(page, route);
    await expect(page.locator('main')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      `Overflow on ${route}`,
    ).toBe(true);
  }
  await page.getByRole('button', { name: 'Toggle colour theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: `test-results/dark-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('makes no external requests while logging private workout data', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== new URL(page.url()).origin) external.push(r.url());
  });
  await blankWorkout(page);
  await logBench(page);
  await navigate(page, 'settings');
  await expect(
    page.getByRole('heading', { name: 'Settings & your data', exact: true }),
  ).toBeVisible();
  expect(external).toEqual([]);
});
test('logs timed, distance and assisted sets with appropriate fields', async ({ page }) => {
  await blankWorkout(page);
  for (const name of ['Plank', 'Running', 'Assisted pull-up']) {
    await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Find an exercise' }).fill(name);
    await dialog.getByRole('button', { name: new RegExp('^' + name) }).click();
    if (name === 'Plank') {
      await page
        .getByRole('spinbutton', { name: 'Plank set 1 duration (s)', exact: true })
        .fill('60');
      await page.getByRole('spinbutton', { name: 'Plank set 1 duration (s)', exact: true }).blur();
    }
    await page.getByRole('button', { name: `Complete ${name} set 1`, exact: true }).click();
    await expect(
      page.getByRole('button', { name: `Undo completion of ${name} set 1`, exact: true }),
    ).toBeVisible();
  }
  await page.reload();
  await expect(
    page.getByRole('spinbutton', { name: 'Plank set 1 duration (s)', exact: true }),
  ).toHaveValue('60');
  await expect(
    page.getByRole('spinbutton', { name: 'Running set 1 distance (m)', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('spinbutton', { name: 'Assisted pull-up set 1 assistance (kg)', exact: true }),
  ).toBeVisible();
});
