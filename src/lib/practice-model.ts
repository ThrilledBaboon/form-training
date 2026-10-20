import { z } from 'zod';

export const practiceSystems = ['rocket-league', 'football'] as const;
export const PracticeSystemSchema = z.enum(practiceSystems);
export type PracticeSystem = z.infer<typeof PracticeSystemSchema>;
export const practiceName = (system: PracticeSystem) =>
  system === 'football' ? 'Football' : 'Rocket League';
const id = z.string().min(1).max(200);
const text = z.string().max(10000);
const count = z.number().int().min(0).max(100000);
const seconds = z.number().finite().min(0).max(86400);
export const DrillSchema = z.object({
  id,
  name: z.string().trim().min(1).max(150),
  category: z.string().trim().min(1).max(100),
  metric: z.enum(['time', 'accuracy', 'streak', 'course']),
  cue: text.default(''),
  setup: z.string().max(2000).default(''),
  equipment: z.string().max(300).default(''),
  space: z.enum(['any', 'small', 'pitch']).default('any'),
  partner: z.boolean().default(false),
  foot: z.enum(['both', 'left', 'right', 'alternating']).default('both'),
  packCode: z.string().max(100).default(''),
  link: z
    .string()
    .max(1000)
    .refine((s) => !s || /^https?:\/\//i.test(s), 'Use an http or https link')
    .default(''),
  cones: z
    .array(z.object({ x: z.number().min(2).max(98), y: z.number().min(2).max(98) }))
    .max(30)
    .default([]),
  archived: z.boolean().default(false),
});
export type PracticeDrill = z.infer<typeof DrillSchema>;
export const BlockSchema = z.object({
  id,
  drillId: id,
  sets: z.number().int().min(1).max(20),
  seconds: seconds.default(0),
  target: count.default(0),
  restSeconds: seconds.max(3600).default(0),
  cue: text.default(''),
});
export type PracticeBlock = z.infer<typeof BlockSchema>;
export const PracticeRoutineSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(150),
    notes: text.default(''),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    blocks: z.array(BlockSchema).min(1).max(50),
  })
  .refine(
    (r) =>
      new Set(r.blocks.map((b) => b.id)).size === r.blocks.length &&
      new Set(r.weekdays).size === r.weekdays.length,
    'Duplicate blocks or days',
  );
export type PracticeRoutine = z.infer<typeof PracticeRoutineSchema>;
export const PracticeResultSchema = z
  .object({
    attempts: count.optional(),
    hits: count.optional(),
    best: count.optional(),
    courseSeconds: seconds.positive().optional(),
    notes: text.default(''),
    shots: z
      .array(z.object({ zone: z.number().int().min(0).max(5), hit: z.boolean() }))
      .max(1000)
      .default([]),
  })
  .refine(
    (r) => r.hits === undefined || (r.attempts !== undefined && r.hits <= r.attempts),
    'Hits cannot exceed attempts',
  );
export type PracticeResult = z.infer<typeof PracticeResultSchema>;
export const PracticeEntrySchema = z.object({
  id,
  drill: DrillSchema,
  block: BlockSchema,
  set: z.number().int().min(1).max(20),
  status: z.enum(['pending', 'completed', 'skipped']),
  elapsedSeconds: seconds.default(0),
  result: PracticeResultSchema.optional(),
});
export type PracticeEntry = z.infer<typeof PracticeEntrySchema>;
export const PracticeSessionSchema = z
  .object({
    id,
    name: z.string().min(1).max(150),
    routineId: id.optional(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime().optional(),
    status: z.enum(['active', 'completed']),
    notes: text.default(''),
    entries: z.array(PracticeEntrySchema).min(1).max(1500),
    cursor: z.number().int().nonnegative(),
    timer: z.object({
      phase: z.enum(['work', 'rest']),
      runningSince: z.number().finite().nonnegative().optional(),
      elapsedSeconds: seconds,
      targetSeconds: seconds,
    }),
  })
  .refine(
    (s) =>
      s.cursor < s.entries.length &&
      new Set(s.entries.map((e) => e.id)).size === s.entries.length &&
      (s.status === 'active' ||
        (s.endAt !== undefined && s.entries.every((e) => e.status !== 'pending'))) &&
      (!s.endAt || s.endAt >= s.startAt),
    'Invalid practice session',
  );
export type PracticeSession = z.infer<typeof PracticeSessionSchema>;
export const PracticeDataSchema = z
  .object({
    id: PracticeSystemSchema,
    revision: z.number().int().nonnegative().default(0),
    goal: z.number().int().min(1).max(14).default(3),
    focus: z.string().max(500).default(''),
    drills: z.array(DrillSchema).max(2000),
    routines: z.array(PracticeRoutineSchema).max(1000),
    sessions: z.array(PracticeSessionSchema).max(10000),
  })
  .superRefine((p, ctx) => {
    for (const key of ['drills', 'routines', 'sessions'] as const)
      if (new Set(p[key].map((r) => r.id)).size !== p[key].length)
        ctx.addIssue({ code: 'custom', message: `Duplicate ${key} identities` });
    if (p.sessions.filter((s) => s.status === 'active').length > 1)
      ctx.addIssue({ code: 'custom', message: 'Only one active practice session per system' });
    if (p.routines.some((r) => r.blocks.some((b) => !p.drills.some((d) => d.id === b.drillId))))
      ctx.addIssue({ code: 'custom', message: 'A routine refers to a missing drill' });
  });
export type PracticeData = z.infer<typeof PracticeDataSchema>;
export const PracticeRowsSchema = z
  .array(PracticeDataSchema)
  .max(2)
  .refine((p) => new Set(p.map((r) => r.id)).size === p.length, 'Duplicate practice systems');
export const emptyPractice = (id: PracticeSystem): PracticeData => ({
  id,
  revision: 0,
  goal: 3,
  focus: '',
  drills: [],
  routines: [],
  sessions: [],
});
export const practiceData = (data: { practice?: PracticeData[] }, system: PracticeSystem) =>
  data.practice?.find((p) => p.id === system) ?? emptyPractice(system);
export function mergePractice(local: PracticeData, incoming: PracticeData): PracticeData {
  if (
    incoming.sessions.some(
      (s) => s.status === 'active' && !local.sessions.some((l) => l.id === s.id),
    ) &&
    local.sessions.some((s) => s.status === 'active')
  )
    throw Error(
      `Finish the active ${practiceName(local.id)} session before merging another active session.`,
    );
  return PracticeDataSchema.parse({
    ...local,
    revision: local.revision + 1,
    drills: [
      ...local.drills,
      ...incoming.drills.filter((d) => !local.drills.some((l) => l.id === d.id)),
    ],
    routines: [
      ...local.routines,
      ...incoming.routines.filter((r) => !local.routines.some((l) => l.id === r.id)),
    ],
    sessions: [
      ...local.sessions,
      ...incoming.sessions.filter((s) => !local.sessions.some((l) => l.id === s.id)),
    ],
  });
}
export function timerSeconds(session: PracticeSession, at = Date.now()) {
  return Math.min(
    86400,
    session.timer.elapsedSeconds +
      (session.timer.runningSince === undefined
        ? 0
        : Math.max(0, (at - session.timer.runningSince) / 1000)),
  );
}
/** A changed setup, metric, foot or cone course creates a separate comparison series. */
export function comparisonKey(drill: PracticeDrill) {
  return JSON.stringify([drill.id, drill.metric, drill.setup, drill.foot, drill.cones]);
}
export function resultValue(entry: PracticeEntry): number | undefined {
  if (entry.status !== 'completed') return undefined;
  const r = entry.result;
  if (entry.drill.metric === 'accuracy')
    return r?.attempts && r.hits !== undefined ? (r.hits / r.attempts) * 100 : undefined;
  if (entry.drill.metric === 'streak') return r?.best;
  if (entry.drill.metric === 'course') return r?.courseSeconds;
  return entry.elapsedSeconds / 60;
}
