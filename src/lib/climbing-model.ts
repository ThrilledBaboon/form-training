import { z } from 'zod';
import { FoodFileSchema } from './food-model';

const id = z.string().min(1).max(200);
const text = z.string().max(10000);
export const ClimbingDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + 'T12:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Invalid date');
export const climbTypes = ['bouldering', 'top_rope', 'auto_belay', 'lead'] as const;
export const climbTypeName = {
  bouldering: 'Bouldering',
  top_rope: 'Top rope',
  auto_belay: 'Auto belay',
  lead: 'Lead',
};
export const ClimbSnapshotSchema = z.object({
  name: z.string().trim().min(1).max(200),
  venue: z.string().trim().max(200).default(''),
  environment: z.enum(['indoor', 'outdoor']).default('indoor'),
  type: z.enum(climbTypes).default('bouldering'),
  grade: z.string().trim().max(80).default(''),
  gradeScale: z.string().trim().max(80).default(''),
});
export const ClimbSchema = ClimbSnapshotSchema.extend({
  id,
  notes: text.default(''),
  nextTry: text.default(''),
  project: z.enum(['none', 'active', 'completed']).default('none'),
  archived: z.boolean().default(false),
  photo: FoodFileSchema.optional(),
  updatedAt: z.string().datetime(),
});
export const ClimbingEntrySchema = z
  .object({
    id,
    climbId: id,
    snapshot: ClimbSnapshotSchema,
    attempts: z.number().int().min(1).max(10000),
    result: z.enum(['attempt', 'completed', 'with_rests', 'flash']).default('attempt'),
    notes: text.default(''),
  })
  .refine((e) => e.result !== 'flash' || e.attempts === 1, 'A flash must have one attempt');
export const ClimbingSessionSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(200),
    date: ClimbingDay,
    planId: id.optional(),
    durationMinutes: z.number().finite().positive().max(1440).optional(),
    notes: text.default(''),
    status: z.enum(['draft', 'completed']),
    entries: z.array(ClimbingEntrySchema).max(500),
    updatedAt: z.string().datetime(),
  })
  .refine(
    (s) => new Set(s.entries.map((e) => e.id)).size === s.entries.length,
    'Duplicate session entries',
  )
  .refine(
    (s) => s.status === 'draft' || s.entries.length > 0,
    'Log a climb before finishing a session',
  );
export const ClimbingPlanSchema = z.object({
  id,
  name: z.string().trim().min(1).max(200),
  date: ClimbingDay,
  venue: z.string().max(200).default(''),
  notes: text.default(''),
  type: z.enum(climbTypes).default('bouldering'),
  updatedAt: z.string().datetime(),
});
export const ClimbingDataSchema = z
  .object({
    id: z.literal('climbing'),
    revision: z.number().int().nonnegative().default(0),
    climbs: z.array(ClimbSchema).max(20000).default([]),
    sessions: z.array(ClimbingSessionSchema).max(100000).default([]),
    plans: z.array(ClimbingPlanSchema).max(10000).default([]),
  })
  .superRefine((d, ctx) => {
    for (const key of ['climbs', 'sessions', 'plans'] as const)
      if (new Set(d[key].map((r) => r.id)).size !== d[key].length)
        ctx.addIssue({ code: 'custom', message: `Duplicate climbing ${key} identifiers` });
    const ids = new Set(d.climbs.map((c) => c.id));
    if (d.sessions.some((s) => s.entries.some((e) => !ids.has(e.climbId))))
      ctx.addIssue({
        code: 'custom',
        message: 'A climbing session references a missing library climb',
      });
  });
export type Climb = z.infer<typeof ClimbSchema>;
export type ClimbingEntry = z.infer<typeof ClimbingEntrySchema>;
export type ClimbingSession = z.infer<typeof ClimbingSessionSchema>;
export type ClimbingPlan = z.infer<typeof ClimbingPlanSchema>;
export type ClimbingData = z.infer<typeof ClimbingDataSchema>;
export const emptyClimbing: ClimbingData = {
  id: 'climbing',
  revision: 0,
  climbs: [],
  sessions: [],
  plans: [],
};
export const climbSnapshot = (climb: Climb) => ClimbSnapshotSchema.parse(climb);
export const climbingAttachments = (data: ClimbingData) =>
  data.climbs.filter((c) => c.photo).length;
/** Keep local records in their entirety when importing the same identity. */
export function mergeClimbing(current: ClimbingData, incoming: ClimbingData): ClimbingData {
  const result = structuredClone(current);
  for (const key of ['climbs', 'sessions', 'plans'] as const)
    Object.assign(result, {
      [key]: [
        ...current[key],
        ...incoming[key].filter((r) => !current[key].some((c) => c.id === r.id)),
      ],
    });
  result.revision++;
  return ClimbingDataSchema.parse(result);
}
/** Grades remain grouped by discipline, venue and scale; no cross-scale conversion. */
export function climbingGradeGroups(sessions: ClimbingSession[]) {
  const groups = new Map<
    string,
    { label: string; grade: string; attempts: number; completions: number; flashes: number }
  >();
  for (const s of sessions.filter((s) => s.status === 'completed'))
    for (const e of s.entries) {
      const c = e.snapshot;
      const key = JSON.stringify([c.type, c.environment, c.venue, c.gradeScale, c.grade]);
      const row = groups.get(key) ?? {
        label: [
          climbTypeName[c.type],
          c.environment,
          c.venue || 'Venue unspecified',
          c.gradeScale || 'Scale unspecified',
        ].join(' · '),
        grade: c.grade || 'Ungraded',
        attempts: 0,
        completions: 0,
        flashes: 0,
      };
      row.attempts += e.attempts;
      row.completions += Number(e.result === 'completed' || e.result === 'flash');
      row.flashes += Number(e.result === 'flash');
      groups.set(key, row);
    }
  return [...groups.values()];
}
