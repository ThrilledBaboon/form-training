import { z } from 'zod';
import { uid, type Data } from './model';
import {
  ImportSessionSchema,
  ImportItemSchema,
  WorkoutDraftSchema,
  type WorkoutDraft,
} from './workout-import';
const PortableItem = ImportItemSchema.omit({
  exerciseId: true,
  setupId: true,
  create: true,
}).strict();
export const WorkoutFileSchema = z
  .object({
    app: z.literal('FORM'),
    type: z.literal('workout-draft'),
    schemaVersion: z.literal(1),
    sessions: z
      .array(
        ImportSessionSchema.omit({ accepted: true, selected: true, warnings: true })
          .extend({ items: z.array(PortableItem).min(1).max(100) })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
export function exportWorkoutFile(draft: WorkoutDraft) {
  const text = JSON.stringify(
    WorkoutFileSchema.parse({
      app: 'FORM',
      type: 'workout-draft',
      schemaVersion: 1,
      sessions: draft.sessions.map(({ accepted: _a, selected: _s, warnings: _w, ...s }) => ({
        ...s,
        items: s.items.map(({ exerciseId: _e, setupId: _p, create: _c, ...item }) => item),
      })),
    }),
    null,
    2,
  );
  if (text.length > 1000000)
    throw Error('This draft exceeds the 1 MB import limit. Export fewer workouts at a time.');
  return text;
}
export function parseWorkoutFile(text: string, data: Data): WorkoutDraft {
  if (text.length > 1000000) throw Error('Workout JSON must be smaller than 1 MB.');
  const file = WorkoutFileSchema.parse(JSON.parse(text));
  const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const draft = WorkoutDraftSchema.parse({
    id: uid(),
    source: '',
    sessions: file.sessions.map((s) => ({
      ...s,
      selected: true,
      accepted: false,
      warnings: [
        'Imported JSON: review the date, exercise matches, load conventions and every set before saving.',
      ],
      items: s.items.map((item) => {
        const matches = data.exercises.filter(
          (e) =>
            e.tracking === item.tracking &&
            [e.name, ...e.aliases].some((a) => normal(a) === normal(item.name)),
        );
        return {
          ...item,
          create: false,
          exerciseId: matches.length === 1 ? matches[0].id : undefined,
        };
      }),
    })),
  });
  if (JSON.stringify(draft).length > 1000000)
    throw Error('The reviewed draft exceeds 1 MB. Split the file into smaller groups of workouts.');
  return draft;
}
