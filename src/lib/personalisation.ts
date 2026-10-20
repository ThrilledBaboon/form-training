import { z } from 'zod';

export const destinations = [
  ['today', 'Overview'],
  ['pages', 'My pages'],
  ['week-planner', 'Week planner'],
  ['weekly-review', 'Weekly review'],
  ['training-home', 'Training overview'],
  ['workout', 'Active workout'],
  ['routines', 'Routines & plans'],
  ['history', 'Workout history'],
  ['climbing-home', 'Climbing overview'],
  ['climbing-log', 'Climbing sessions'],
  ['climbing-library', 'Climb library'],
  ['climbing-projects', 'Climbing projects'],
  ['food-home', 'Food overview'],
  ['food-menu', 'Menu & recipes'],
  ['food-suggest', 'Suggest a meal'],
  ['food-diary', 'Food diary'],
  ['food-kitchen', 'Kitchen'],
  ['food-planner', 'Meal planner'],
  ['food-shopping', 'Shopping'],
  ['food-budget', 'Food spending'],
  ['food-ingredients', 'Ingredients'],
  ['progress', 'Exercise progress'],
  ['muscles', 'Muscle insights'],
  ['calendar', 'Training calendar'],
  ['weight', 'Bodyweight'],
  ['records', 'Personal records'],
  ['setups', 'Equipment setups'],
  ['paste-workouts', 'Paste workout notes'],
  ['exercises', 'Exercise library'],
  ['settings', 'Settings & data'],
] as const;
export const DestinationSchema = z.enum(destinations.map(([id]) => id));
export type Destination = z.infer<typeof DestinationSchema>;
export const DensitySchema = z.enum(['comfortable', 'compact', 'minimal']);
export const AccentSchema = z.enum(['theme', 'green', 'blue', 'purple', 'orange']);
export const ChartOptionsSchema = z.object({
  style: z.enum(['area', 'line', 'bar']).default('area'),
  axes: z.boolean().default(true),
  legend: z.boolean().default(false),
  caption: z.boolean().default(true),
  patterns: z.boolean().default(false),
  aggregation: z.enum(['records', 'weekly']).default('records'),
  target: z.number().finite().min(0).max(1e12).optional(),
});
export type ChartOptions = z.infer<typeof ChartOptionsSchema>;
export const PersonalisationSchema = z.object({
  density: DensitySchema.default('comfortable'),
  textSize: z.enum(['standard', 'large', 'larger']).default('standard'),
  highContrast: z.boolean().default(false),
  showFooter: z.boolean().default(true),
  showPageDescription: z.boolean().default(true),
  feedback: z.enum(['messages', 'quiet']).default('messages'),
  navigation: z
    .array(
      z.object({
        route: DestinationSchema,
        label: z.string().trim().min(1).max(40),
        hidden: z.boolean(),
      }),
    )
    .max(30)
    .refine((v) => new Set(v.map((r) => r.route)).size === v.length, 'Duplicate navigation links')
    .default([]),
  mobileRoutes: z
    .array(DestinationSchema)
    .min(1)
    .max(4)
    .refine((v) => new Set(v).size === v.length, 'Duplicate phone shortcuts')
    .default(['today', 'training-home', 'food-home', 'climbing-home']),
  charts: ChartOptionsSchema.default(() => ChartOptionsSchema.parse({})),
  macros: z
    .array(z.enum(['protein', 'carbs', 'fat', 'fibre']))
    .min(1)
    .max(4)
    .refine((v) => new Set(v).size === v.length, 'Duplicate macros')
    .default(['protein', 'carbs', 'fat', 'fibre']),
  macroDisplay: z.enum(['consumed', 'remaining', 'both']).default('consumed'),
  workoutNotesOpen: z.boolean().default(false),
  effortScale: z.enum(['rpe', 'rir']).default('rpe'),
  climbingType: z.enum(['bouldering', 'top_rope', 'auto_belay', 'lead']).default('bouldering'),
  climbingVenue: z.string().trim().max(200).default(''),
  climbingScale: z.string().trim().max(80).default(''),
  climbingTags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  circuits: z
    .array(
      z.object({
        venue: z.string().trim().min(1).max(200),
        grade: z.string().trim().min(1).max(80),
        scale: z.string().trim().min(1).max(80),
        colour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    )
    .max(100)
    .default([]),
});
export type Personalisation = z.infer<typeof PersonalisationSchema>;
export const defaultPersonalisation = PersonalisationSchema.parse({});
export const personalisation = (settings: { personalisation?: Personalisation }) =>
  settings.personalisation ?? defaultPersonalisation;
export function navigationRows(p: Personalisation) {
  return [
    ...p.navigation,
    ...destinations
      .filter(([route]) => !p.navigation.some((r) => r.route === route))
      .map(([route, label]) => ({ route, label, hidden: false })),
  ].map((r) => (r.route === 'settings' ? { ...r, hidden: false } : r));
}
export const linkName = (p: Personalisation, route: string, fallback: string) =>
  p.navigation.find((r) => r.route === route)?.label ?? fallback;

/** Only known dates are grouped. Each bucket averages recorded points, never fills missing days. */
export function weeklyChartData(data: Record<string, string | number>[]) {
  if (data.some((p) => !/^\d{4}-\d{2}-\d{2}$/.test(String(p.day ?? p.date)))) return undefined;
  const groups = new Map<string, Record<string, string | number>[]>();
  for (const point of data) {
    const day = String(point.day ?? point.date);
    const d = new Date(day + 'T12:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== day) return undefined;
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const week = d.toISOString().slice(0, 10);
    groups.set(week, [...(groups.get(week) ?? []), point]);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, points]) => {
      const row: Record<string, string | number> = { date, day: date };
      for (const key of new Set(points.flatMap((p) => Object.keys(p)))) {
        const values = points.map((p) => p[key]).filter((v): v is number => typeof v === 'number');
        if (values.length) row[key] = values.reduce((a, b) => a + b, 0) / values.length;
      }
      return row;
    });
}
