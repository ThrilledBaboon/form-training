import type { PracticeData } from './practice-model';
import { WeightTagSchema, WeightFilterSchema } from './weight-tags';
import type { ClimbingData } from './climbing-model';
import { z } from 'zod';
import { PersonalisationSchema } from './personalisation';
import { SetupSnapshotSchema, type Workspace } from './workspace-model';
import type { FoodData } from './food-model';
import { MUSCLES, trackingTypes } from './constants';
export { MUSCLES, trackingTypes } from './constants';
export type Muscle = (typeof MUSCLES)[number];
export const muscleName = (s: string) =>
  ({
    front_delts: 'Front delts',
    side_delts: 'Side delts',
    rear_delts: 'Rear delts',
    upper_back: 'Upper back',
    erectors: 'Spinal erectors',
    abs: 'Abdominals',
    quads: 'Quadriceps',
    traps: 'Trapezius',
    abductors: 'Hip abductors',
  })[s] || s.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
const id = z.string().min(1).max(200);
const text = z.string().max(10000);
const date = z.string().datetime({ offset: true });
const num = z.number().finite().nonnegative().max(1e9);
const positive = z.number().finite().positive().max(1e6);
export const ExerciseSchema = z.object({
  id,
  name: z.string().trim().min(1).max(150),
  aliases: z.array(z.string().max(150)).max(50).default([]),
  equipment: z.string().max(100),
  category: z.string().max(100),
  movement: z.string().max(100),
  unilateral: z.boolean(),
  tracking: z.enum(trackingTypes),
  restSeconds: num.max(3600),
  repMin: num.max(1000),
  repMax: num.max(1000),
  defaultSets: z.number().int().min(1).max(30),
  notes: text,
  tags: z.array(z.string().max(100)).max(50),
  archived: z.boolean(),
  includeBodyweight: z.boolean(),
  createdAt: date,
  updatedAt: date,
});
export const MappingSchema = z.object({
  id,
  exerciseId: id,
  muscle: z.enum(MUSCLES),
  role: z.enum(['primary', 'secondary']),
  contribution: z.number().min(0).max(2),
});
export const GroupSchema = z.object({
  id,
  name: z.string().max(100),
  type: z.enum(['superset', 'triset', 'circuit', 'dropset', 'custom']),
  restSeconds: num.max(3600),
  notes: text,
  betweenSeconds: num.max(3600).optional(),
});
export const PlannedSetSchema = z.object({
  notes: text.optional(),
  groupId: id.optional(),
  reps: num.max(10000).optional(),
  loadKg: num.optional(),
  durationSeconds: num.optional(),
  distanceM: num.optional(),
  label: z.enum(['working', 'warmup', 'failure', 'PR', 'custom']).default('working'),
  customLabel: z.string().max(100).optional(),
  restSeconds: num.max(3600).optional(),
});
export const ItemSchema = z.object({
  id,
  exerciseId: id,
  name: z.string().max(150),
  tracking: z.enum(trackingTypes),
  setup: SetupSnapshotSchema.optional(),
  restUnknown: z.boolean().optional(),
  includeBodyweight: z.boolean().default(false),
  notes: text,
  groupId: id.optional(),
  sets: z.array(PlannedSetSchema).max(200),
  repMin: num.max(1000),
  repMax: num.max(1000),
  restSeconds: num.max(3600),
});
export const RoutineSchema = z.object({
  id,
  sortOrder: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  name: z.string().trim().min(1).max(150),
  description: text,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  programmeId: id.optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  items: z.array(ItemSchema).max(100),
  groups: z.array(GroupSchema).max(100),
  createdAt: date,
  updatedAt: date,
});
export const ProgrammeSchema = z.object({
  id,
  name: z.string().trim().min(1).max(150),
  notes: text,
});
export const PlanSchema = z.object({
  id,
  routineId: id.optional(),
  name: z.string().min(1).max(150),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => {
      const d = new Date(s + 'T12:00:00Z');
      return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    }, 'Invalid date'),
  status: z.enum(['planned', 'started', 'rest']),
  items: z.array(ItemSchema).max(100),
  groups: z.array(GroupSchema).max(100),
  notes: text,
});
export const SessionSchema = z.object({
  id,
  name: z.string().trim().min(1).max(150),
  dateOnly: z.boolean().optional(),
  importId: id.optional(),
  startAt: date,
  endAt: date.optional(),
  status: z.enum(['active', 'completed', 'cancelled']),
  routineId: id.optional(),
  planId: id.optional(),
  items: z.array(ItemSchema).max(100),
  groups: z.array(GroupSchema).max(100),
  notes: text,
  rpe: num.max(10).optional(),
  energy: num.max(5).optional(),
  calories: num.optional(),
  updatedAt: date,
});
export const SetSchema = z.object({
  id,
  setup: SetupSnapshotSchema.optional(),
  partialReps: num.max(10000).optional(),
  restUnknown: z.boolean().optional(),
  groupId: id.optional(),
  sessionId: id,
  itemId: id,
  exerciseId: id,
  order: z.number().int().nonnegative(),
  reps: num.max(10000).optional(),
  loadKg: num.optional(),
  bodyweightKg: num.optional(),
  durationSeconds: num.optional(),
  distanceM: num.optional(),
  rpe: num.max(10).optional(),
  rir: num.max(10).optional(),
  restSeconds: num.max(3600),
  label: z.enum(['working', 'warmup', 'failure', 'PR', 'custom']),
  customLabel: z.string().max(100).optional(),
  completed: z.boolean(),
  completedAt: date.optional(),
  notes: text,
});
export const BodyweightSchema = z.object({
  id,
  at: date,
  kg: positive.max(1000),
  notes: text,
  tags: z.array(WeightTagSchema).max(20).optional(),
});
export const SettingsSchema = z.object({
  weightFilter: WeightFilterSchema.optional(),
  personalisation: PersonalisationSchema.optional(),
  id: z.literal('preferences'),
  unit: z.enum(['kg', 'lb']),
  theme: z.enum(['light', 'dark', 'system']),
  palette: z.enum(['sage', 'sand', 'slate', 'plum']).default('sage'),
  weightIncrement: positive.max(100),
  repIncrement: positive.max(100),
  formula: z.enum(['epley', 'brzycki']),
  primaryFactor: num.max(2),
  secondaryFactor: num.max(2),
  recoveryHours: positive.max(336),
  muscleScale: positive.max(100),
  calendarMetric: z.enum(['sets', 'volume', 'duration', 'consistency']),
  calendarMax: positive,
  goalKg: positive.max(1000).optional(),
  sound: z.boolean(),
  vibration: z.boolean(),
  keepAwake: z.boolean(),
  reducedMotion: z.boolean(),
  progressionPercent: positive.max(20),
  progressionRpe: positive.max(10),
  defaultRest: num.max(3600),
  lastBackupAt: date.optional(),
  weekTarget: z.number().int().min(1).max(14),
});
export const TimerSchema = z.object({
  id: z.literal('rest'),
  endAt: z.number().finite().nonnegative().optional(),
  pausedMs: num.optional(),
  durationMs: num,
  exerciseName: z.string().max(150),
  notified: z.boolean(),
});
export type Exercise = z.infer<typeof ExerciseSchema>;
export type Mapping = z.infer<typeof MappingSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type PlannedSet = z.infer<typeof PlannedSetSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Routine = z.infer<typeof RoutineSchema>;
export type Programme = z.infer<typeof ProgrammeSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type WorkoutSet = z.infer<typeof SetSchema>;
export type Bodyweight = z.infer<typeof BodyweightSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Timer = z.infer<typeof TimerSchema>;
export const defaults: Settings = {
  id: 'preferences',
  unit: 'kg',
  theme: 'light',
  palette: 'sage',
  weightIncrement: 2.5,
  repIncrement: 1,
  formula: 'epley',
  primaryFactor: 1,
  secondaryFactor: 0.5,
  recoveryHours: 48,
  muscleScale: 12,
  calendarMetric: 'sets',
  calendarMax: 20,
  sound: false,
  vibration: false,
  keepAwake: false,
  reducedMotion: false,
  progressionPercent: 2.5,
  progressionRpe: 9,
  defaultRest: 90,
  weekTarget: 4,
};
export type Data = {
  practice?: PracticeData[];
  climbing?: ClimbingData;
  workspace?: Workspace;
  food?: FoodData;
  /** Lightweight UI reads omit image payloads; backups always use a complete read. */
  foodFileIds?: string[];
  exercises: Exercise[];
  mappings: Mapping[];
  routines: Routine[];
  programmes: Programme[];
  plans: Plan[];
  sessions: Session[];
  sets: WorkoutSet[];
  bodyweights: Bodyweight[];
  settings: Settings;
  timer?: Timer;
};
export const emptyData: Data = {
  exercises: [],
  mappings: [],
  routines: [],
  programmes: [],
  plans: [],
  sessions: [],
  sets: [],
  bodyweights: [],
  settings: defaults,
};
