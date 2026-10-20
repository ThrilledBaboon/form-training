import { test, expect } from '@playwright/test';
import { fixture } from '../tests/fixtures';
import { foodFixture } from '../tests/food-fixture';
import { defaultWorkspace, makeWidget } from '../src/lib/workspace-model';
import { emptyPractice, PracticeSessionSchema } from '../src/lib/practice-model';
import { footballStarters } from '../src/lib/practice-library';
import { FoodEntrySchema } from '../src/lib/food-model';

const base = process.env.TEST_SUBPATH || '/';
const types = [
  'streak',
  'climbing-streak',
  'rocket-league-streak',
  'football-streak',
  'start',
  'week',
  'calendar',
  'training-totals',
  'routines',
  'weight-summary',
  'macros',
  'combined-week',
  'football-start',
  'football-skills',
  'bodyweight',
  'climbing-wall-map',
  'training-trend',
  'suggestion',
];

test('widgets fit half and full cards on small phones without clipping content or actions', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.clock.install({ time: new Date('2026-10-15T15:00:00Z') });
  const data = fixture();
  data.food = foodFixture();
  data.food.foodSettings.targets = { protein: 160, carbs: 250, fat: 70, fibre: 30 };
  data.food.foodEntries = [
    FoodEntrySchema.parse({
      id: 'food',
      date: '2026-10-15',
      slot: 'Lunch',
      name: 'Recorded food',
      servings: 1,
      snapshot: {
        macros: { protein: 128.5, carbs: 245.8, fat: 62.5, fibre: 24 },
        missing: [],
        estimated: false,
      },
      createdAt: '2026-10-15T12:00:00.000Z',
    }),
  ];
  data.bodyweights = [0, 1, 2].map((n) => ({
    id: 'weight-' + n,
    at: `2026-10-${13 + n}T08:00:00.000Z`,
    kg: 80.25 + n,
    tags: ['Fresh'],
    notes: '',
  }));
  data.routines[0].name = 'Upper body strength and accessories';
  const practice = { ...emptyPractice('football'), ...footballStarters() };
  practice.routines = practice.routines.slice(0, 2);
  practice.sessions = [
    PracticeSessionSchema.parse({
      id: 'practice',
      name: 'Ball control practice',
      status: 'completed',
      startAt: '2026-10-15T09:00:00.000Z',
      endAt: '2026-10-15T09:30:00.000Z',
      cursor: 0,
      timer: { phase: 'work', elapsedSeconds: 0, targetSeconds: 60 },
      entries: practice.drills.slice(0, 2).map((drill, n) => ({
        id: 'entry-' + n,
        drill,
        block: { id: 'block-' + n, drillId: drill.id, sets: 1 },
        set: 1,
        status: 'completed',
        elapsedSeconds: 600,
      })),
    }),
  ];
  data.practice = [practice];
  data.workspace = defaultWorkspace();
  data.workspace.systems = {
    gym: true,
    food: true,
    climbing: true,
    'rocket-league': true,
    football: true,
  };
  const overview = data.workspace.pages.find((p) => p.id === 'overview')!;
  overview.widgets = types.flatMap((type) =>
    ['half', 'full'].map((phoneSize) => ({
      ...makeWidget(type, {}, `${type}-${phoneSize}`),
      phoneSize: phoneSize as 'half' | 'full',
    })),
  );
  await page.goto(base + '#/settings');
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
    name: 'widget-layout.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ app: 'FORM', schemaVersion: 6, exportedAt: new Date().toISOString(), data }),
    ),
  });
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Import method').selectOption('replace');
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Confirm replace import' }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(base + '#/today');
  const dismiss = page.getByRole('button', { name: 'Dismiss message', exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  for (const [width, textSize] of [
    [375, 'normal'],
    [320, 'normal'],
    [375, 'larger'],
    [1440, 'normal'],
  ] as const) {
    await page.setViewportSize({ width, height: 812 });
    await page
      .locator('html')
      .evaluate((html, size) => html.setAttribute('data-text-size', size), textSize);
    await expect(page.locator('.workspace-widget')).toHaveCount(types.length * 2);
    await expect(page.locator('.practice-wheel')).toHaveCount(2);
    await expect(page.locator('.recharts-surface').first()).toBeVisible();
    const clipped = await page.locator('.workspace-widget').evaluateAll((cards) =>
      cards.flatMap((card) => {
        const bounds = card.getBoundingClientRect();
        const elements = card.querySelectorAll(
          'button, a, p, strong, small, h2, label, select, .practice-wheel, .metric, .macro-summary > div',
        );
        return [...elements]
          .filter((el) => {
            if (!el.getClientRects().length || el.classList.contains('widget-title-hidden'))
              return false;
            const box = el.getBoundingClientRect();
            return (
              box.left < bounds.left - 1 ||
              box.right > bounds.right + 1 ||
              el.scrollWidth > el.clientWidth + 1
            );
          })
          .map((el) => ({
            widget: card.getAttribute('data-widget-id'),
            element: el.tagName,
            text: el.textContent?.slice(0, 100),
          }));
      }),
    );
    expect(clipped, `Clipped widget content at ${width}px`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const id of ['streak', 'climbing-streak', 'rocket-league-streak', 'football-streak']) {
      const card = page.locator(`[data-widget-id="${id}-half"]`);
      const copy = await card.locator('.streak-card-copy').boundingBox();
      const link = await card.locator('.streak-card-link').boundingBox();
      expect(link!.y).toBeGreaterThanOrEqual(copy!.y + copy!.height);
      await expect(card.locator('.widget-explore')).toHaveCount(0);
    }
    const totals = page.locator('[data-widget-id="training-totals-half"]');
    const explore = await totals
      .getByRole('link', { name: 'Explore Training totals', exact: true })
      .boundingBox();
    const metrics = await totals.locator('.widget-metrics').boundingBox();
    expect(explore!.y).toBeGreaterThanOrEqual(metrics!.y + metrics!.height);
    const macros = page.locator('[data-widget-id="macros-half"]');
    await expect(macros).toContainText('128.5');
    if (width < 650) {
      await expect(
        macros.getByRole('progressbar', { name: 'Protein goal', exact: true }),
      ).toHaveAttribute('value', '128.5');
      await expect(
        macros.getByRole('progressbar', { name: 'Protein goal', exact: true }),
      ).toHaveAttribute('max', '160');
    }
    await page.locator('[data-widget-id="streak-half"]').screenshot({
      path: `test-results/streak-half-${width}-${textSize}-${info.project.name}.png`,
    });
    await page.locator('[data-widget-id="streak-full"]').screenshot({
      path: `test-results/streak-full-${width}-${textSize}-${info.project.name}.png`,
    });
    await page.locator('[data-widget-id="macros-half"]').screenshot({
      path: `test-results/macros-half-${width}-${textSize}-${info.project.name}.png`,
    });
    await page.locator('[data-widget-id="training-totals-half"]').screenshot({
      path: `test-results/totals-half-${width}-${textSize}-${info.project.name}.png`,
    });
    await page.locator('[data-widget-id="streak-half"] .streak-card').click();
    await expect(page.getByRole('dialog', { name: 'Workout streak', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  }
});
