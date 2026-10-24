import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fixture } from '../tests/fixtures';
import { serialise } from '../src/lib/backup';
import { defaultWorkspace } from '../src/lib/workspace-model';
import { emptyClimbing, ClimbSchema, ClimbingSessionSchema } from '../src/lib/climbing-model';
import { emptyPractice, PracticeSessionSchema } from '../src/lib/practice-model';
import { footballStarters, rocketLeagueStarters } from '../src/lib/practice-library';
const base = process.env.TEST_SUBPATH || '/';
async function loadActivityHistory(page: Page) {
  const data = fixture();
  data.workspace = defaultWorkspace();
  data.workspace.systems.football = true;
  data.workspace.systems['rocket-league'] = true;
  data.practice = (['football', 'rocket-league'] as const).map((system) => {
    const library = system === 'football' ? footballStarters() : rocketLeagueStarters();
    return {
      ...emptyPractice(system),
      ...library,
      sessions: (system === 'football' ? [15] : [13, 15]).map((day) =>
        PracticeSessionSchema.parse({
          id: 's' + day,
          name: 'Recorded practice',
          startAt: new Date(`2026-10-${day}T12:00:00`).toISOString(),
          endAt: new Date(`2026-10-${day}T13:00:00`).toISOString(),
          status: 'completed',
          cursor: 0,
          timer: { phase: 'work', elapsedSeconds: 30, targetSeconds: 60 },
          entries: [
            {
              id: 'e',
              drill: library.drills[0],
              block: library.routines[0].blocks[0],
              set: 1,
              status: 'completed',
              elapsedSeconds: 30,
            },
          ],
        }),
      ),
    };
  });
  data.climbing = {
    ...emptyClimbing,
    climbs: [
      ClimbSchema.parse({ id: 'climb', name: 'Project', updatedAt: '2026-10-15T12:00:00Z' }),
    ],
    sessions: [13, 15].map((day) =>
      ClimbingSessionSchema.parse({
        id: 'c' + day,
        name: 'Climbing practice',
        date: `2026-10-${day}`,
        status: 'completed',
        updatedAt: '2026-10-15T12:00:00Z',
        entries: [
          {
            id: 'e',
            climbId: 'climb',
            snapshot: { name: 'Project' },
            attempts: 2,
            result: 'attempt',
          },
        ],
      }),
    ),
  };
  await page.goto(base + '#/settings');
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
    name: 'activity-streaks.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialise(data)),
  });
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Import method').selectOption('replace');
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Confirm replace import' }).click();
  await expect(dialog).toHaveCount(0);
}
test('each activity has its own calendar and widget, while food has no streak', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-15T14:00:00') });
  await loadActivityHistory(page);
  for (const [system, title, count] of [
    ['rocket-league', 'Rocket League', 2],
    ['football', 'Football', 1],
    ['climbing', 'Climbing', 2],
  ] as const) {
    await page.goto(base + `#/${system}-home`);
    const widget = page.getByRole('region', { name: title + ' streak', exact: true });
    await expect(widget).toContainText(
      `${count} ${system === 'climbing' ? 'climbing' : 'practice'} day`,
    );
    await page.locator('.streak-trigger').click();
    const dialog = page.getByRole('dialog', { name: title + ' streak', exact: true });
    await expect(dialog.getByTestId('streak-count')).toHaveText(String(count));
    await expect(dialog.getByTestId('streak-rest-balance')).toHaveText(
      count === 2 ? '5+1 today' : '5',
    );
    await expect(dialog.locator('.streak-day.workout')).toHaveCount(count);
    await dialog.getByRole('button', { name: 'Previous streak month' }).click();
    await expect(dialog.getByRole('heading', { name: 'September 2026' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Next streak month' }).click();
    if (count === 2) {
      await dialog.getByRole('button', { name: /14 October 2026, protected rest day/ }).click();
      await expect(dialog).toContainText('1 rest day used to protect your streak');
    }
    expect((await new AxeBuilder({ page }).include('dialog').analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await expect(page.locator('.streak-trigger')).toBeFocused();
    await widget.getByRole('button', { name: /^Open / }).click();
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.reload();
    await expect(widget).toContainText(
      `${count} ${system === 'climbing' ? 'climbing' : 'practice'} day`,
    );
  }
  await page.goto(base + '#/training-home');
  await expect(
    page.getByRole('button', { name: 'Open workout streak, 1 workout day', exact: true }),
  ).toBeVisible();
  await page.goto(base + '#/food-home');
  await expect(page.getByRole('heading', { name: 'Today’s food', exact: true })).toBeVisible();
  await expect(page.locator('.streak-trigger')).toHaveCount(0);
  await expect(page.locator('.streak-card')).toHaveCount(0);
});
test('a practice rest bank and longest streak update at midnight without a reload', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-20T23:59:30') });
  await loadActivityHistory(page);
  await page.goto(base + '#/football-home');
  await page.locator('.streak-trigger').click();
  await expect(page.getByTestId('streak-rest-balance')).toHaveText('1');
  await page.clock.fastForward(31_000);
  await expect(page.getByTestId('streak-rest-balance')).toHaveText('0');
  await expect(page.getByTestId('streak-count')).toHaveText('1');
  await page.clock.fastForward(86_400_000);
  await expect(page.getByTestId('streak-count')).toHaveText('0');
  await expect(page.locator('.streak-best')).toContainText('1 practice day');
});
