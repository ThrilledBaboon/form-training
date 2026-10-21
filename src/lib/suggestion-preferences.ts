import { z } from 'zod';
import { MUSCLES } from './constants';

export const suggestionRoles = ['push', 'pull', 'squat', 'hinge', 'accessory'] as const;
export const SuggestionPreferencesSchema = z.object({
  mode: z.enum(['routine', 'full_body', 'cindy']).default('routine'),
  balanceCoverage: z.boolean().default(true),
  coverageDays: z.union([z.literal(7), z.literal(14), z.literal(28)]).default(14),
  priorityMuscles: z.array(z.enum(MUSCLES)).max(MUSCLES.length).default([]),
  accessoryLimit: z.number().int().min(0).max(5).default(3),
  addAccessories: z.boolean().default(false),
  timeMinutes: z.number().int().min(10).max(180).default(60),
  equipment: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  excludedExerciseIds: z.array(z.string().min(1).max(200)).max(10000).default([]),
  familiarity: z.enum(['familiar', 'variety']).default('familiar'),
  respectSchedule: z.boolean().default(true),
  considerClimbing: z.boolean().default(true),
  allowSupersets: z.boolean().default(false),
  progression: z.enum(['normal', 'conservative', 'off']).default('normal'),
  includeWarmup: z.boolean().default(false),
  explainChoices: z.boolean().default(true),
});
export type SuggestionPreferences = z.infer<typeof SuggestionPreferencesSchema>;
export const defaultSuggestionPreferences = SuggestionPreferencesSchema.parse({});
export type Readiness = 'normal' | 'low_energy' | 'tired_grip' | 'sore_legs';

/** A circuit score is stored separately from conventional working sets. */
export const BenchmarkSchema = z
  .object({
    kind: z.literal('cindy'),
    variant: z.enum(['standard', 'modified']),
    modification: z.string().max(150).optional(),
    durationSeconds: z.number().int().min(60).max(7200),
    reps: z.tuple([
      z.number().int().min(1).max(100),
      z.number().int().min(1).max(100),
      z.number().int().min(1).max(100),
    ]),
    rounds: z.number().int().min(0).max(10000).default(0),
    extraReps: z.number().int().min(0).max(299).default(0),
    timerStartedAt: z.string().datetime({ offset: true }).optional(),
    elapsedSeconds: z.number().finite().min(0).max(1e9).default(0),
  })
  .superRefine((b, ctx) => {
    if (b.extraReps >= b.reps.reduce((a, n) => a + n, 0))
      ctx.addIssue({
        code: 'custom',
        message: 'Additional reps must be less than one full round.',
      });
    if (b.variant === 'standard' && (b.durationSeconds !== 1200 || b.reps.join(',') !== '5,10,15'))
      ctx.addIssue({
        code: 'custom',
        message: 'Standard Cindy keeps its 20-minute, 5/10/15 format.',
      });
  });
export type Benchmark = z.infer<typeof BenchmarkSchema>;
