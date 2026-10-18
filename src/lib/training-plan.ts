import { z } from 'zod';
import { db } from './db';
import { RoutineSchema, ProgrammeSchema, now, type Data, type Routine } from './model';
import { defaultWorkspace, WorkspaceSchema } from './workspace-model';
export const splitNames = {
  full_body: 'Full body',
  upper_lower: 'Upper / lower',
  push_pull_legs: 'Push / pull / legs',
} as const;
export const validSplits = (days: number) =>
  (Object.keys(splitNames) as (keyof typeof splitNames)[]).filter((split) =>
    split === 'full_body'
      ? days <= 3
      : split === 'upper_lower'
        ? [2, 4, 5].includes(days)
        : [3, 6].includes(days),
  );
export const PlanChoicesSchema = z
  .object({
    days: z.number().int().min(1).max(6),
    split: z.enum(['full_body', 'upper_lower', 'push_pull_legs']),
    experience: z.enum(['beginner', 'regular']),
    weekdays: z.array(z.number().int().min(0).max(6)).max(6),
  })
  .refine(
    (c) => validSplits(c.days).includes(c.split),
    'Choose a split compatible with your number of days.',
  )
  .refine(
    (c) => c.weekdays.length === c.days && new Set(c.weekdays).size === c.days,
    'Choose exactly one different weekday per session.',
  );
export type PlanChoices = z.infer<typeof PlanChoicesSchema>;
export const defaultDays = (days: number) =>
  [[], [3], [1, 4], [1, 3, 5], [1, 2, 4, 5], [1, 2, 3, 5, 6], [1, 2, 3, 4, 5, 6]][days];
const templates: Record<string, string[]> = {
  'Full body A': ['Back squat', 'Barbell bench press', 'Lat pulldown', 'Plank'],
  'Full body B': ['Romanian deadlift', 'Overhead press', 'Seated cable row', 'Walking lunge'],
  'Full body C': ['Leg press', 'Dumbbell bench press', 'Lat pulldown', 'Lateral raise'],
  'Upper A': [
    'Barbell bench press',
    'Seated cable row',
    'Overhead press',
    'Lat pulldown',
    'Biceps curl',
  ],
  'Lower A': ['Back squat', 'Romanian deadlift', 'Leg curl', 'Standing calf raise', 'Plank'],
  'Upper B': [
    'Incline bench press',
    'Lat pulldown',
    'Lateral raise',
    'Triceps pushdown',
    'Biceps curl',
  ],
  'Lower B': ['Leg press', 'Hip thrust', 'Leg curl', 'Standing calf raise', 'Side plank'],
  Push: ['Barbell bench press', 'Overhead press', 'Cable fly', 'Lateral raise', 'Triceps pushdown'],
  Pull: ['Lat pulldown', 'Seated cable row', 'Face pull', 'Biceps curl'],
  Legs: ['Back squat', 'Romanian deadlift', 'Leg curl', 'Standing calf raise', 'Plank'],
};
export type BuiltPlan = {
  id: string;
  programme: z.infer<typeof ProgrammeSchema>;
  routines: Routine[];
};
export function buildTrainingPlan(
  input: PlanChoices,
  data: Data,
  id = crypto.randomUUID(),
): BuiltPlan {
  const choices = PlanChoicesSchema.parse(input);
  const sequence =
    choices.split === 'full_body'
      ? ['Full body A', 'Full body B', 'Full body C'].slice(0, choices.days)
      : choices.split === 'upper_lower'
        ? ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Full body C'].slice(0, choices.days)
        : choices.days === 3
          ? ['Push', 'Pull', 'Legs']
          : ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'];
  const programme = ProgrammeSchema.parse({
    id: 'generated-' + id,
    name: `${splitNames[choices.split]} · ${choices.days} days`,
    notes:
      'Reviewed starter template from FORM. Editable routines; loads are intentionally left for you to choose. No completed sessions were created.',
  });
  const t = now();
  return {
    id,
    programme,
    routines: sequence.map((name, index) =>
      RoutineSchema.parse({
        id: `${id}:routine:${index}`,
        programmeId: programme.id,
        name: sequence.indexOf(name) !== index ? name + ' B' : name,
        description:
          'Starter template. Use controlled technique and a comfortable working load, leaving about two reps in reserve. Adjust or substitute exercises to suit your equipment and ability.',
        color: '#8cd5a5',
        weekdays: [choices.weekdays[index]],
        createdAt: t,
        updatedAt: t,
        groups: [],
        items: templates[name].map((exerciseName, itemIndex) => {
          const exercise = data.exercises.find(
            (e) =>
              !e.archived &&
              (e.name.toLowerCase() === exerciseName.toLowerCase() ||
                e.aliases.some((a) => a.toLowerCase() === exerciseName.toLowerCase())),
          );
          if (!exercise || !['weighted', 'duration'].includes(exercise.tracking))
            throw Error(
              `The template needs ${exerciseName}. Restore it in your exercise library, then generate again.`,
            );
          const duration = exercise.tracking === 'duration';
          return {
            id: `${id}:${index}:item:${itemIndex}`,
            exerciseId: exercise.id,
            name: exercise.name,
            tracking: exercise.tracking,
            includeBodyweight: false,
            notes: duration
              ? 'Comfortable hold; shorten it if form slips.'
              : 'Choose your load when you start. Stop with about two reps in reserve.',
            repMin: duration ? 0 : 8,
            repMax: duration ? 0 : 12,
            restSeconds: itemIndex < 2 ? 120 : 90,
            sets: Array.from({ length: choices.experience === 'beginner' ? 2 : 3 }, () =>
              duration ? { durationSeconds: 30, label: 'working' } : { reps: 8, label: 'working' },
            ),
          };
        }),
      }),
    ),
  };
}
export async function saveTrainingPlan(plan: BuiltPlan, database = db) {
  const programme = ProgrammeSchema.parse(plan.programme);
  const routines = plan.routines.map((r) => RoutineSchema.parse(r));
  if (
    !plan.id ||
    routines.length < 1 ||
    routines.length > 6 ||
    new Set(routines.map((r) => r.id)).size !== routines.length ||
    routines.some((r) => r.programmeId !== programme.id)
  )
    throw Error('Invalid plan. Generate a new preview.');
  return database.transaction(
    'rw',
    [database.workspaces, database.programmes, database.routines, database.exercises],
    async () => {
      const workspace = (await database.workspaces.get('workspace')) ?? defaultWorkspace();
      if (!workspace.systems.gym) throw Error('Enable Gym before saving a training plan.');
      if (workspace.planBuilds?.includes(plan.id)) return { alreadySaved: true };
      if (
        (await database.programmes.get(programme.id)) ||
        (await database.routines.bulkGet(routines.map((r) => r.id))).some(Boolean)
      )
        throw Error('This preview conflicts with a saved plan. Generate a new preview.');
      for (const item of routines.flatMap((r) => r.items)) {
        const exercise = await database.exercises.get(item.exerciseId);
        if (!exercise || exercise.archived || exercise.tracking !== item.tracking)
          throw Error(`${item.name} changed in your library. Generate a fresh preview.`);
      }
      await database.programmes.add(programme);
      await database.routines.bulkAdd(routines);
      workspace.planBuilds = [...(workspace.planBuilds ?? []), plan.id];
      workspace.revision++;
      await database.workspaces.put(WorkspaceSchema.parse(workspace));
      return { alreadySaved: false };
    },
  );
}
