import { z } from 'zod';
import { ProfileSchema } from './profile-model';
import { MUSCLES, trackingTypes } from './constants';
import {
  DensitySchema,
  AccentSchema,
  ChartOptionsSchema,
  DestinationSchema,
} from './personalisation';

const id = z.string().min(1).max(200);
const text = z.string().max(10000);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + 'T12:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Invalid date');
export const RangeSchema = z
  .object({
    days: z.number().int().min(0).max(36500).default(30),
    from: day.optional(),
    to: day.optional(),
  })
  .refine((r) => !r.from || !r.to || r.from <= r.to, 'From must precede through date');
export type ViewRange = z.infer<typeof RangeSchema>;
export const LoadBasisSchema = z.enum(['unspecified', 'total', 'per_dumbbell', 'per_side']);
export const SetupSnapshotSchema = z.object({
  id,
  name: z.string().min(1).max(150),
  gym: z.string().max(150).default(''),
  machine: z.string().max(150).default(''),
  settings: text.default(''),
  attachment: z.string().max(300).default(''),
  notes: text.default(''),
  basis: LoadBasisSchema.default('unspecified'),
  incrementKg: z.number().finite().positive().max(100).optional(),
});
export const SetupSchema = SetupSnapshotSchema.extend({
  exerciseId: id,
  isDefault: z.boolean().default(false),
  archived: z.boolean().default(false),
  updatedAt: z.string().datetime(),
});
export type SetupSnapshot = z.infer<typeof SetupSnapshotSchema>;
export type EquipmentSetup = z.infer<typeof SetupSchema>;
export const WidgetConfigSchema = z.object({
  climbingType: z.enum(['bouldering', 'top_rope', 'auto_belay', 'lead']).optional(),
  climbingVenue: z.string().max(200).optional(),
  climbingTag: z.string().max(40).optional(),
  goalTarget: z.number().finite().positive().max(1e12).optional(),
  goalCurrent: z.number().finite().nonnegative().max(1e12).optional(),
  goalUnit: z.string().max(40).optional(),
  quickLinks: z.array(DestinationSchema).min(1).max(6).optional(),
  exerciseId: id.optional(),
  ingredientId: id.optional(),
  setupId: id.optional(),
  metric: z
    .enum([
      'volume',
      'bestLoad',
      'bestMax',
      'reps',
      'sets',
      'duration',
      'distance',
      'protein',
      'carbs',
      'fat',
      'fibre',
      'count',
    ])
    .default('volume'),
  tracking: z.enum(trackingTypes).optional(),
  muscle: z.enum(MUSCLES).default('chest'),
  mode: z.enum(['sets', 'score', 'recovery']).default('sets'),
  relative: z.boolean().default(false),
  spendingPeriod: z.enum(['week', 'month']).default('week'),
  calendarMetric: z.enum(['consistency', 'sets', 'volume', 'duration']).default('sets'),
  calendarMax: z.number().finite().positive().max(1e9).default(20),
  includeWarmup: z.boolean().default(false),
  repMin: z.number().nonnegative().max(10000).optional(),
  repMax: z.number().nonnegative().max(10000).optional(),
  loadMinKg: z.number().nonnegative().max(1e6).optional(),
  loadMaxKg: z.number().nonnegative().max(1e6).optional(),
  basis: LoadBasisSchema.optional(),
  range: RangeSchema.optional(),
  date: day.optional(),
  note: text.default(''),
  link: DestinationSchema.default('workout'),
});
export const WidgetPresentationSchema = z.object({
  accent: AccentSchema.default('theme'),
  showTitle: z.boolean().default(true),
  showDescription: z.boolean().default(true),
  showExplore: z.boolean().default(true),
  charts: ChartOptionsSchema.optional(),
});
export const WidgetSchema = z
  .object({
    id,
    type: z.string().min(1).max(80),
    version: z.literal(1).default(1),
    title: z.string().max(150).default(''),
    size: z.enum(['compact', 'half', 'wide']).default('half'),
    phoneSize: z.enum(['full', 'half']).optional(),
    sectionId: id.optional(),
    presentation: WidgetPresentationSchema.optional(),
    config: WidgetConfigSchema,
    dependencies: z
      .array(z.enum(['gym', 'food', 'climbing']))
      .max(3)
      .optional(),
  })
  .refine((w) => validFilterBounds(w.config), 'Minimum filters must not exceed maximum filters.');
export type Widget = z.infer<typeof WidgetSchema>;
export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;
export const PageSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(100),
    range: RangeSchema,
    widgets: z.array(WidgetSchema).max(40),
    revision: z.number().int().nonnegative().default(0),
    importedKey: z.string().max(100).optional(),
    density: DensitySchema.optional(),
    sectionMode: z.enum(['sections', 'tabs']).optional(),
    sections: z
      .array(z.object({ id, title: z.string().trim().min(1).max(100), collapsed: z.boolean() }))
      .max(12)
      .optional(),
    phoneOrder: z.array(id).max(40).optional(),
  })
  .refine(
    (p) =>
      new Set(p.widgets.map((w) => w.id)).size === p.widgets.length &&
      new Set(p.sections?.map((s) => s.id)).size === (p.sections?.length ?? 0) &&
      new Set(p.phoneOrder).size === (p.phoneOrder?.length ?? 0) &&
      (p.phoneOrder ?? []).every((id) => p.widgets.some((w) => w.id === id)) &&
      p.widgets.every((w) => !w.sectionId || p.sections?.some((s) => s.id === w.sectionId)),
    'Duplicate widget identities',
  );
export type WorkspacePage = z.infer<typeof PageSchema>;
export const WorkspaceSchema = z
  .object({
    id: z.literal('workspace'),
    revision: z.number().int().nonnegative().default(0),
    systems: z.object({ gym: z.boolean(), food: z.boolean(), climbing: z.boolean().default(true) }),
    homePageId: id,
    pages: z.array(PageSchema).min(1).max(53),
    setups: z.array(SetupSchema).max(2000).default([]),
    removedPages: z.array(PageSchema).max(20).default([]),
    planBuilds: z.array(id).max(1000).default([]),
    profile: ProfileSchema.optional(),
    pasteDraft: z.string().max(1000000).optional(),
    imports: z
      .array(
        z.object({
          id,
          fingerprint: z.string().max(100),
          workoutKeys: z.array(z.string().max(100)).max(50).optional(),
          sessionIds: z.array(id),
          routineIds: z.array(id),
          undoDigest: z.string().max(100).optional(),
        }),
      )
      .max(10000)
      .default([]),
  })
  .refine(
    (w) =>
      new Set(w.pages.map((p) => p.id)).size === w.pages.length &&
      w.pages.some((p) => p.id === w.homePageId) &&
      w.pages.some((p) => p.id === 'overview') &&
      w.pages.filter((p) => !systemForPage(p.id)).length <= 50 &&
      new Set(w.setups.map((s) => s.id)).size === w.setups.length,
    'Invalid pages or home page',
  );
export type Workspace = z.infer<typeof WorkspaceSchema>;
export function makeWidget(
  type: string,
  config: Partial<WidgetConfig> = {},
  id: string = crypto.randomUUID(),
): Widget {
  return WidgetSchema.parse({ id, type, size: 'half', config });
}
export function overviewPage(): WorkspacePage {
  const types = [
    'start',
    'suggestion',
    'combined-week',
    'streak',
    'training-totals',
    'highlights',
    'bodyweight',
    'macros',
    'meal-plan',
    'expiry',
    'spending',
  ];
  return {
    id: 'overview',
    name: 'Overview',
    range: { days: 30 },
    revision: 0,
    widgets: types.map((type) => ({
      ...makeWidget(type, {}, 'overview-' + type),
      size: type === 'training-totals' ? 'wide' : 'half',
    })),
  };
}
export function systemForPage(id: string): System | undefined {
  return id === 'training-home'
    ? 'gym'
    : id === 'food-home'
      ? 'food'
      : id === 'climbing-home'
        ? 'climbing'
        : undefined;
}
export const pageRoute = (id: string) =>
  id === 'overview' ? 'today' : systemForPage(id) ? id : 'pages?page=' + encodeURIComponent(id);
export function systemHomePage(system: System): WorkspacePage {
  const id = system === 'gym' ? 'training-home' : system === 'food' ? 'food-home' : 'climbing-home';
  const types =
    system === 'climbing'
      ? [
          'climbing-start',
          'climbing-week',
          'climbing-wall-map',
          'climbing-totals',
          'climbing-trend',
          'climbing-sessions',
          'climbing-projects',
          'climbing-grades',
        ]
      : system === 'gym'
        ? [
            'start',
            'suggestion',
            'week',
            'streak',
            'training-totals',
            'highlights',
            'routines',
            'sessions',
            'setups',
          ]
        : [
            'macros',
            'suggest-meal',
            'meal-plan',
            'expiry',
            'shopping',
            'spending',
            'stock',
            'batches',
            'shortages',
            'macro-trend',
          ];
  return {
    id,
    name:
      system === 'gym'
        ? 'Training overview'
        : system === 'food'
          ? 'Food overview'
          : 'Climbing overview',
    range: { days: 30 },
    revision: 0,
    widgets: types.map((type) => ({
      ...makeWidget(type, type === 'macro-trend' ? { metric: 'protein' } : {}, id + '-' + type),
      size: type === 'training-totals' || type === 'climbing-wall-map' ? 'wide' : 'half',
    })),
  };
}
/** Refresh untouched early climbing templates; keep every customised home intact. */
export function climbingHomeNeedsUpdate(page: WorkspacePage) {
  if (page.id !== 'climbing-home' || page.revision !== 0) return false;
  const latest = systemHomePage('climbing');
  if (page.widgets.some((w) => w.type === 'climbing-wall-map' || w.type === 'climbing-week'))
    return false;
  const old = latest.widgets.filter(
    (w) =>
      w.type !== 'climbing-wall-map' &&
      w.type !== 'climbing-week' &&
      (w.type !== 'climbing-trend' || page.widgets.some((p) => p.type === 'climbing-trend')),
  );
  return (
    page.name === latest.name &&
    JSON.stringify(page.range) === JSON.stringify(latest.range) &&
    JSON.stringify(page.widgets) === JSON.stringify(old)
  );
}
export const defaultWorkspace = (): Workspace => ({
  planBuilds: [],
  id: 'workspace',
  revision: 0,
  systems: { gym: true, food: true, climbing: true },
  homePageId: 'overview',
  pages: [overviewPage()],
  setups: [],
  imports: [],
  removedPages: [],
});

export type System = 'gym' | 'food' | 'climbing';
export const gymRoutes = new Set([
  'training-home',
  'workout',
  'routines',
  'history',
  'exercises',
  'progress',
  'muscles',
  'calendar',
  'records',
  'setups',
  'paste-workouts',
]);
export const routeSystems = (route: string): System[] =>
  route.startsWith('climbing-')
    ? ['climbing']
    : route.startsWith('food-')
      ? ['food']
      : gymRoutes.has(route)
        ? ['gym']
        : [];

export function validFilterBounds(c: {
  repMin?: number;
  repMax?: number;
  loadMinKg?: number;
  loadMaxKg?: number;
}) {
  return (
    (c.repMin === undefined || c.repMax === undefined || c.repMin <= c.repMax) &&
    (c.loadMinKg === undefined || c.loadMaxKg === undefined || c.loadMinKg <= c.loadMaxKg)
  );
}
