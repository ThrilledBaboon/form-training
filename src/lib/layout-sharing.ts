import { z } from 'zod';
import type { Data } from './model';
import {
  RangeSchema,
  WidgetConfigSchema,
  makeWidget,
  validFilterBounds,
  type WorkspacePage,
  WidgetPresentationSchema,
} from './workspace-model';
import {
  DensitySchema,
  ChartOptionsSchema,
  PersonalisationSchema,
  personalisation,
} from './personalisation';
import { SettingsSchema } from './model';
import { changeWorkspace } from './workspace';
import { requiredSystems } from './widget-registry';
import { db } from './db';

const PortableConfig = WidgetConfigSchema.omit({
  exerciseId: true,
  ingredientId: true,
  setupId: true,
});
const Hint = z
  .object({
    name: z.string().max(150),
    tracking: z.string().max(50).optional(),
    equipment: z.string().max(150).optional(),
  })
  .strict();
const SharedWidget = z
  .object({
    type: z.string().min(1).max(80),
    version: z.literal(1),
    title: z.string().max(150),
    size: z.enum(['compact', 'half', 'wide']),
    phoneSize: z.enum(['full', 'half']).optional(),
    section: z.number().int().min(0).max(11).optional(),
    presentation: WidgetPresentationSchema.optional(),
    requiredSystems: z
      .array(z.enum(['gym', 'food', 'climbing', 'rocket-league', 'football']))
      .max(5)
      .default([]),
    config: PortableConfig.strict(),
    exercise: Hint.optional(),
    ingredient: Hint.optional(),
  })
  .strict()
  .refine((w) => validFilterBounds(w.config), 'Minimum filters must not exceed maximum filters.');
const LayoutSchema = z
  .object({
    app: z.literal('FORM'),
    type: z.literal('page-layout'),
    formatVersion: z.union([z.literal(1), z.literal(2)]),
    appearance: z
      .object({
        theme: z.enum(['light', 'dark', 'system']),
        palette: z.enum(['sage', 'sand', 'slate', 'plum']),
        reducedMotion: z.boolean(),
        density: DensitySchema,
        textSize: z.enum(['standard', 'large', 'larger']),
        highContrast: z.boolean(),
        charts: ChartOptionsSchema.omit({ target: true }).strict(),
      })
      .strict()
      .optional(),
    page: z
      .object({
        name: z.string().trim().min(1).max(100),
        range: RangeSchema,
        widgets: z.array(SharedWidget).max(40),
        density: DensitySchema.optional(),
        sections: z
          .array(
            z.object({ title: z.string().trim().min(1).max(100), collapsed: z.boolean() }).strict(),
          )
          .max(12)
          .optional(),
        sectionMode: z.enum(['sections', 'tabs']).optional(),
        phoneOrder: z.array(z.number().int().min(0).max(39)).max(40).optional(),
      })
      .strict()
      .refine(
        (p) =>
          new Set(p.phoneOrder).size === (p.phoneOrder?.length ?? 0) &&
          (p.phoneOrder ?? []).every((i) => i < p.widgets.length) &&
          p.widgets.every((w) => w.section === undefined || w.section < (p.sections?.length ?? 0)),
        'Invalid section or phone layout references',
      ),
  })
  .strict();
export type SharedLayout = z.infer<typeof LayoutSchema>;
export function exportLayout(
  page: WorkspacePage,
  data: Data,
  includeNotes = false,
  includeAppearance = false,
): string {
  const widgets = page.widgets.map((w) => {
    const c = w.config;
    const config = PortableConfig.parse({
      metric: c.metric,
      tracking: c.tracking,
      muscle: c.muscle,
      mode: c.mode,
      relative: c.relative,
      includeWarmup: c.includeWarmup,
      spendingPeriod: c.spendingPeriod,
      calendarMetric: c.calendarMetric,
      calendarMax: c.calendarMax,
      repMin: c.repMin,
      repMax: c.repMax,
      loadMinKg: c.loadMinKg,
      loadMaxKg: c.loadMaxKg,
      basis: c.basis,
      range: c.range,
      date: c.date,
      note: includeNotes && w.type === 'notes' ? c.note : '',
      link: c.link,
      climbingType: c.climbingType,
      climbingVenue: c.climbingVenue,
      climbingTag: c.climbingTag,
      goalTarget: c.goalTarget,
      goalCurrent: w.type === 'personal-goal' ? 0 : undefined,
      goalUnit: c.goalUnit,
      quickLinks: c.quickLinks,
    });
    const e = data.exercises.find((e) => e.id === c.exerciseId);
    const i = data.food?.ingredients.find((i) => i.id === c.ingredientId);
    return {
      type: w.type,
      version: w.version,
      title: w.title,
      size: w.size,
      phoneSize: w.phoneSize,
      presentation: w.presentation,
      section: w.sectionId ? page.sections?.findIndex((s) => s.id === w.sectionId) : undefined,
      requiredSystems: requiredSystems(w),
      config,
      exercise: e ? { name: e.name, tracking: e.tracking, equipment: e.equipment } : undefined,
      ingredient: i ? { name: i.name } : undefined,
    };
  });
  return JSON.stringify(
    LayoutSchema.parse({
      app: 'FORM',
      type: 'page-layout',
      formatVersion: 2,
      appearance: includeAppearance
        ? {
            theme: data.settings.theme,
            palette: data.settings.palette,
            reducedMotion: data.settings.reducedMotion,
            density: personalisation(data.settings).density,
            textSize: personalisation(data.settings).textSize,
            highContrast: personalisation(data.settings).highContrast,
            charts: ChartOptionsSchema.omit({ target: true }).parse(
              personalisation(data.settings).charts,
            ),
          }
        : undefined,
      page: {
        name: page.name,
        range: page.range,
        widgets,
        density: page.density,
        sectionMode: page.sectionMode,
        sections: page.sections?.map(({ title, collapsed }) => ({ title, collapsed })),
        phoneOrder: page.phoneOrder?.map((id) => page.widgets.findIndex((w) => w.id === id)),
      },
    }),
    null,
    2,
  );
}
export function parseLayout(input: string): SharedLayout {
  if (input.length > 500000)
    throw Error('Layout files are limited to 500 KB. Use Import backup for complete records.');
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw Error('This layout is not valid JSON. Nothing was changed.');
  }
  const r = LayoutSchema.safeParse(value);
  if (!r.success)
    throw Error(
      'Expected a FORM page-layout file, format version 1 or 2, with valid widget settings. Backups and library files use their own import tools. Nothing was changed.',
    );
  return r.data;
}
export async function contentKey(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function referenceMatches(layout: SharedLayout, data: Data): Record<number, string> {
  const result: Record<number, string> = {};
  layout.page.widgets.forEach((w, index) => {
    const matches = w.exercise
      ? data.exercises.filter(
          (e) =>
            [e.name, ...e.aliases].some(
              (n) => n.toLocaleLowerCase() === w.exercise!.name.toLocaleLowerCase(),
            ) &&
            (!w.exercise!.tracking || w.exercise!.tracking === e.tracking) &&
            (!w.exercise!.equipment || w.exercise!.equipment === e.equipment),
        )
      : w.ingredient
        ? (data.food?.ingredients.filter(
            (i) => i.name.toLowerCase() === w.ingredient!.name.toLowerCase(),
          ) ?? [])
        : [];
    if (matches.length === 1) result[index] = matches[0].id;
  });
  return result;
}
export async function importLayout(
  layout: SharedLayout,
  mappings: Record<number, string>,
  options: {
    copy?: boolean;
    replaceId?: string;
    expectedRevision?: number;
    applyAppearance?: boolean;
  } = {},
  database = db,
) {
  const checked = parseLayout(JSON.stringify(layout));
  const key = await contentKey(JSON.stringify(checked));
  const id = crypto.randomUUID();
  return database.transaction(
    'rw',
    [database.workspaces, database.exercises, database.ingredients, database.settings],
    async () => {
      if (options.applyAppearance && checked.appearance) {
        const current = await database.settings.get('preferences');
        if (!current) throw Error('Your preferences could not be read. Nothing was imported.');
        const { theme, palette, reducedMotion, ...display } = checked.appearance;
        await database.settings.put(
          SettingsSchema.parse({
            ...current,
            theme,
            palette,
            reducedMotion,
            personalisation: PersonalisationSchema.parse({
              ...personalisation(current),
              ...display,
            }),
          }),
        );
      }
      for (const [index, value] of Object.entries(mappings)) {
        const widget = checked.page.widgets[Number(index)];
        if (!value) continue;
        if (!widget) throw Error('Invalid reference mapping.');
        const exercise = widget.exercise ? await database.exercises.get(value) : undefined;
        const ingredient = widget.ingredient ? await database.ingredients.get(value) : undefined;
        if (
          (widget.exercise &&
            (!exercise ||
              (widget.exercise.tracking && exercise.tracking !== widget.exercise.tracking))) ||
          (widget.ingredient && !ingredient)
        )
          throw Error('A chosen reference changed. Refresh the preview before importing.');
      }
      return changeWorkspace((w) => {
        if (!options.copy && !options.replaceId && w.pages.some((p) => p.importedKey === key))
          throw Error(
            'This layout was already imported. Open that page or explicitly choose Create another copy.',
          );
        const previous = options.replaceId
          ? w.pages.find((p) => p.id === options.replaceId)
          : undefined;
        if (options.replaceId && (!previous || previous.revision !== options.expectedRevision))
          throw Error('The destination changed. Refresh the preview before replacing it.');
        const page: WorkspacePage = {
          id: previous?.id ?? id,
          name: checked.page.name,
          range: checked.page.range,
          importedKey: key,
          revision: previous ? previous.revision + 1 : 0,
          density: checked.page.density,
          sectionMode: checked.page.sectionMode,
          sections: checked.page.sections?.map((s) => ({ ...s, id: crypto.randomUUID() })),
          widgets: checked.page.widgets.map((widget, index) => ({
            ...makeWidget(widget.type, {
              ...widget.config,
              exerciseId: widget.exercise ? mappings[index] || undefined : undefined,
              ingredientId: widget.ingredient ? mappings[index] || undefined : undefined,
            }),
            dependencies: widget.requiredSystems,
            title: widget.title,
            size: widget.size,
            phoneSize: widget.phoneSize,
            presentation: widget.presentation,
          })),
        };
        page.widgets = page.widgets.map((widget, i) => ({
          ...widget,
          sectionId:
            checked.page.widgets[i].section === undefined
              ? undefined
              : page.sections![checked.page.widgets[i].section!].id,
        }));
        page.phoneOrder = checked.page.phoneOrder?.map((i) => page.widgets[i].id);
        if (previous) w.removedPages = [previous, ...w.removedPages].slice(0, 20);
        w.pages = previous
          ? w.pages.map((p) => (p.id === previous.id ? page : p))
          : [...w.pages, page];
      }, database).then((w) => w.pages.find((p) => p.id === (options.replaceId ?? id))!);
    },
  );
}
