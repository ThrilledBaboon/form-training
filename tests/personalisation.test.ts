import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrainingDB, readData } from '../src/lib/db';
import {
  PersonalisationSchema,
  defaultPersonalisation,
  navigationRows,
  weeklyChartData,
} from '../src/lib/personalisation';
import { savePersonalisation } from '../src/lib/personalisation-actions';
import { saveSettings } from '../src/lib/actions';
import { PageSchema, makeWidget } from '../src/lib/workspace-model';
import { pageWidgets, movePageWidget, copyPage } from '../src/lib/page-design';
import { savePage } from '../src/lib/workspace';
import { exportLayout, parseLayout, importLayout } from '../src/lib/layout-sharing';
import { parseBackup, serialise } from '../src/lib/backup';
import { ClimbSchema, climbSnapshot } from '../src/lib/climbing-model';
let database: TrainingDB;
beforeEach(async () => {
  database = new TrainingDB('custom-' + crypto.randomUUID());
  await database.open();
  await readData(database);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.delete();
});
describe('personal preferences and portable views', () => {
  it('keeps old data valid and preferences separate between people while detecting stale saves', async () => {
    const before = await readData(database);
    expect(before.settings.personalisation).toBeUndefined();
    expect(parseBackup(serialise(before)).data.settings.personalisation).toBeUndefined();
    const value = PersonalisationSchema.parse({
      density: 'minimal',
      effortScale: 'rir',
      macros: ['protein'],
      navigation: [{ route: 'settings', label: 'My settings', hidden: true }],
    });
    await saveSettings({ unit: 'lb' }, database);
    await savePersonalisation(value, undefined, database);
    expect((await readData(database)).settings).toMatchObject({
      unit: 'lb',
      personalisation: value,
    });
    expect(navigationRows(value).find((r) => r.route === 'settings')?.hidden).toBe(false);
    await expect(savePersonalisation(defaultPersonalisation, undefined, database)).rejects.toThrow(
      'another tab',
    );
    const friend = new TrainingDB('friend-' + crypto.randomUUID());
    try {
      await friend.open();
      expect((await readData(friend)).settings.personalisation).toBeUndefined();
    } finally {
      await friend.delete();
    }
    const roundtrip = parseBackup(serialise(await readData(database)));
    expect(roundtrip.data.settings.personalisation).toEqual(value);
  });
  it('rejects broken and unsafe customisation without losing the previous preferences', async () => {
    for (const patch of [
      { macros: [] },
      { macros: ['protein', 'protein'] },
      { mobileRoutes: ['today', 'today'] },
      { mobileRoutes: [] },
      { navigation: [{ route: 'javascript:alert(1)', label: 'Link', hidden: false }] },
      {
        circuits: [
          { venue: 'Gym', grade: 'purple', scale: 'colours', colour: 'url(https://invalid)' },
        ],
      },
    ])
      expect(PersonalisationSchema.safeParse(patch).success).toBe(false);
    const before = await readData(database);
    vi.spyOn(database.settings, 'put').mockRejectedValueOnce(Error('Disk full'));
    await expect(savePersonalisation(defaultPersonalisation, undefined, database)).rejects.toThrow(
      'Disk full',
    );
    expect((await readData(database)).settings).toEqual(before.settings);
  });
  it('changes phone order independently, maps duplicates to new identities and prunes removed widgets', async () => {
    const page = PageSchema.parse({
      id: 'desk',
      name: 'Desk',
      range: { days: 30 },
      sections: [{ id: 'training', title: 'Training', collapsed: false }],
      widgets: [
        makeWidget('notes', {}, 'one'),
        { ...makeWidget('bodyweight', {}, 'two'), sectionId: 'training' },
        { ...makeWidget('personal-goal', {}, 'three'), sectionId: 'training' },
      ],
    });
    const phone = movePageWidget(page, 'three', 'two', true);
    expect(pageWidgets(phone, true).map((w) => w.id)).toEqual(['one', 'three', 'two']);
    expect(pageWidgets(phone, false).map((w) => w.id)).toEqual(['one', 'two', 'three']);
    const copy = copyPage(phone, 'Friend desk');
    expect(PageSchema.safeParse(copy).success).toBe(true);
    expect(copy.widgets.every((w) => !phone.widgets.some((p) => p.id === w.id))).toBe(true);
    expect(pageWidgets(copy, true).map((w) => w.type)).toEqual([
      'notes',
      'personal-goal',
      'bodyweight',
    ]);
    await savePage(phone, -1, database);
    await savePage(
      { ...phone, widgets: phone.widgets.filter((w) => w.id !== 'three') },
      0,
      database,
    );
    expect(
      (await readData(database)).workspace!.pages.find((p) => p.id === 'desk')!.phoneOrder,
    ).not.toContain('three');
    expect(PageSchema.safeParse({ ...page, phoneOrder: ['missing'] }).success).toBe(false);
  });
  it('shares sections, phone layouts and appearance without private progress or logging preferences', async () => {
    const data = await readData(database);
    data.settings.personalisation = PersonalisationSchema.parse({
      density: 'compact',
      climbingVenue: 'PRIVATE CRAG',
      navigation: [{ route: 'today', label: 'PRIVATE LABEL', hidden: false }],
      charts: { style: 'bar', target: 12345 },
    });
    const page = PageSchema.parse({
      id: 'desk',
      name: 'Desk',
      density: 'minimal',
      range: { days: 90 },
      sections: [{ id: 'section-private-id', title: 'This week', collapsed: true }],
      sectionMode: 'tabs',
      phoneOrder: ['two', 'one'],
      widgets: [
        {
          ...makeWidget('notes', { note: 'PRIVATE NOTE' }, 'one'),
          sectionId: 'section-private-id',
          presentation: {
            accent: 'blue',
            showTitle: false,
            showDescription: false,
            showExplore: false,
          },
        },
        makeWidget('personal-goal', { goalCurrent: 9876, goalTarget: 20 }, 'two'),
      ],
    });
    const text = exportLayout(page, data, false, true);
    for (const value of [
      'PRIVATE CRAG',
      'PRIVATE LABEL',
      'PRIVATE NOTE',
      '9876',
      '12345',
      'section-private-id',
    ])
      expect(text).not.toContain(value);
    const layout = parseLayout(text);
    expect(layout.formatVersion).toBe(2);
    expect(layout.page.widgets[1].config.goalCurrent).toBe(0);
    await savePersonalisation(
      PersonalisationSchema.parse({ density: 'comfortable', effortScale: 'rir' }),
      undefined,
      database,
    );
    const before = (await readData(database)).settings;
    const imported = await importLayout(layout, {}, {}, database);
    expect((await readData(database)).settings).toEqual(before);
    expect(pageWidgets(imported, true).map((w) => w.type)).toEqual(['personal-goal', 'notes']);
    expect(imported.widgets[0].sectionId).toBe(imported.sections![0].id);
    expect(imported.widgets[0].presentation?.accent).toBe('blue');
    await importLayout(layout, {}, { copy: true, applyAppearance: true }, database);
    expect((await readData(database)).settings.personalisation).toMatchObject({
      density: 'compact',
      effortScale: 'rir',
      charts: { style: 'bar' },
    });
  });
  it('rolls appearance back if the layout fails and reads older version-one layouts', async () => {
    const data = await readData(database);
    data.settings.personalisation = PersonalisationSchema.parse({ density: 'compact' });
    const layout = parseLayout(exportLayout(data.workspace!.pages[0], data, false, true));
    const before = await readData(database);
    vi.spyOn(database.workspaces, 'put').mockRejectedValueOnce(Error('Disk full'));
    await expect(importLayout(layout, {}, { applyAppearance: true }, database)).rejects.toThrow(
      'Disk full',
    );
    expect((await readData(database)).settings).toEqual(before.settings);
    const legacy = { ...layout, formatVersion: 1 };
    delete legacy.appearance;
    expect(parseLayout(JSON.stringify(legacy)).formatVersion).toBe(1);
    expect(() =>
      parseLayout(JSON.stringify({ ...layout, page: { ...layout.page, phoneOrder: [100] } })),
    ).toThrow();
  });
  it('averages only recorded values in their Monday-based week without inventing missing days', () => {
    expect(
      weeklyChartData([
        { date: 'x', day: '2026-10-13', value: 10, secondary: 4 },
        { date: 'y', day: '2026-10-15', value: 20 },
        { date: '2026-10-19', value: 40 },
      ]),
    ).toEqual([
      { date: '2026-10-12', day: '2026-10-12', value: 15, secondary: 4 },
      { date: '2026-10-19', day: '2026-10-19', value: 40 },
    ]);
    expect(weeklyChartData([{ date: '13 Oct', value: 10 }])).toBeUndefined();
  });
  it('preserves historical climbing tags and accepts exact venue-specific colour labels', () => {
    const climb = ClimbSchema.parse({
      id: 'climb',
      name: 'Balance',
      venue: 'Gym',
      grade: 'Purple',
      gradeScale: 'circuits',
      tags: ['footwork'],
      updatedAt: new Date().toISOString(),
    });
    const snapshot = climbSnapshot(climb);
    climb.tags = ['power'];
    expect(snapshot.tags).toEqual(['footwork']);
    expect(climbSnapshot({ ...climb, tags: undefined }).tags).toBeUndefined();
    expect(
      PersonalisationSchema.parse({
        circuits: [{ venue: 'Gym', grade: 'Purple', scale: 'circuits', colour: '#7654ab' }],
      }).circuits,
    ).toHaveLength(1);
  });
});
