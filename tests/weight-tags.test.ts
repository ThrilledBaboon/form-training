import { describe, expect, it } from 'vitest';
import { fixture } from './fixtures';
import { BodyweightSchema } from '../src/lib/model';
import { filterWeights, weightTags } from '../src/lib/weight-tags';
import { bodyweightTrend } from '../src/lib/calc';
import { widgetWeightTrend, widgetDestination } from '../src/lib/widget-registry';
import { makeWidget, defaultWorkspace } from '../src/lib/workspace-model';
import { exportLayout, parseLayout } from '../src/lib/layout-sharing';
import { parseBackup, serialise, csvExport } from '../src/lib/backup';
import { categoryExport } from '../src/lib/category-backup';

function weights() {
  const data = fixture();
  data.bodyweights = [
    { id: 'old', at: '2026-10-01T08:00:00Z', kg: 75, notes: '' },
    { id: 'fresh1', at: '2026-10-10T08:00:00Z', kg: 80, tags: ['Fresh', 'Morning'], notes: '' },
    { id: 'gym', at: '2026-10-10T18:00:00Z', kg: 90, tags: ['Gym'], notes: '' },
    { id: 'fresh2', at: '2026-10-11T08:00:00Z', kg: 78, tags: ['fresh'], notes: '' },
  ];
  return data;
}
describe('comparable weigh-ins', () => {
  it('filters before averaging, matches tags without case and retains untagged history', () => {
    const data = weights();
    data.settings.weightFilter = { kind: 'tag', tag: 'Fresh' };
    expect(bodyweightTrend(data).map((e) => e.average)).toEqual([80, 79]);
    expect(bodyweightTrend(data, { kind: 'tag', tag: 'Gym' }).map((e) => e.average)).toEqual([90]);
    expect(filterWeights(data.bodyweights, { kind: 'untagged' }).map((e) => e.id)).toEqual(['old']);
    expect(filterWeights(data.bodyweights)).toHaveLength(4);
    expect(BodyweightSchema.parse(data.bodyweights[0]).tags).toBeUndefined();
    expect(weightTags([' Fresh ', 'fresh', '', 'Gym'])).toEqual(['Fresh', 'Gym']);
    expect(() => weightTags(['Fresh; Gym'])).toThrow();
    expect(() =>
      BodyweightSchema.parse({ ...data.bodyweights[0], tags: Array(21).fill('x') }),
    ).toThrow();
  });
  it('keeps widget caches independent and shares filters without sharing measurements', () => {
    const data = weights();
    expect(widgetWeightTrend(data, { kind: 'tag', tag: 'Fresh' })).toHaveLength(2);
    expect(widgetWeightTrend(data, { kind: 'tag', tag: 'Gym' })[0].kg).toBe(90);
    const widget = makeWidget('bodyweight');
    widget.config.weightFilter = { kind: 'tag', tag: 'Fresh' };
    const page = defaultWorkspace().pages[0];
    page.widgets = [widget];
    expect(parseLayout(exportLayout(page, data)).page.widgets[0].config.weightFilter).toEqual(
      widget.config.weightFilter,
    );
    expect(widgetDestination(widget)).toContain('weighIns=tag%3AFresh');
  });
  it('round-trips tags through full and category backups and adds a CSV tag column', () => {
    const data = weights();
    expect(parseBackup(serialise(data)).data.bodyweights).toEqual(data.bodyweights);
    expect(parseBackup(categoryExport(data, ['bodyweights'])).data.bodyweights).toEqual(
      data.bodyweights,
    );
    expect(csvExport(data, 'bodyweight')).toContain('Fresh; Morning');
    expect(csvExport(data, 'bodyweight').split('\n')[0]).toContain('tags');
  });
});
