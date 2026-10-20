import { z } from 'zod';
import { BodyweightSchema, uid, type Bodyweight } from './model';
import { weightTags } from './weight-tags';
import { db } from './db';

const MeasurementSchema = BodyweightSchema.omit({ id: true })
  .extend({ notes: z.string().max(10000).default('') })
  .strict();
export const BodyweightFileSchema = z
  .object({
    app: z.literal('FORM'),
    type: z.literal('bodyweight'),
    schemaVersion: z.literal(1),
    measurements: z.array(MeasurementSchema).min(1).max(10000),
  })
  .strict();
export type BodyweightFile = z.infer<typeof BodyweightFileSchema>;
export const bodyweightFileLimit = 10 * 1024 * 1024;

export function parseBodyweightFile(text: string): BodyweightFile {
  if (text.length > bodyweightFileLimit) throw Error('Bodyweight JSON must be smaller than 10 MB.');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw Error('This file is not valid JSON. Use Get prompt to convert a spreadsheet or notes.');
  }
  const result = BodyweightFileSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw Error(
      `Choose a FORM bodyweight JSON file. ${issue.path.join('.') || 'File'}: ${issue.message}. Use Settings for complete backups.`,
    );
  }
  return result.data;
}

export function previewBodyweightImport(
  file: BodyweightFile,
  existing: Bodyweight[],
  additionalTags: string[] = [],
) {
  const measurements = BodyweightFileSchema.parse(file).measurements.map((entry) =>
    MeasurementSchema.parse({
      ...entry,
      at: new Date(entry.at).toISOString(),
      tags: weightTags([...(entry.tags ?? []), ...additionalTags]),
    }),
  );
  const incoming = new Map<string, Set<number>>();
  for (const entry of measurements) {
    const weights = incoming.get(entry.at) ?? new Set<number>();
    weights.add(entry.kg);
    incoming.set(entry.at, weights);
  }
  const saved = new Map<string, Set<number>>();
  for (const entry of existing) {
    const at = new Date(entry.at).toISOString();
    const weights = saved.get(at) ?? new Set<number>();
    weights.add(entry.kg);
    saved.set(at, weights);
  }
  const seen = new Set<string>();
  return measurements.map((entry) => {
    const key = entry.at + '/' + entry.kg;
    const status =
      incoming.get(entry.at)!.size > 1
        ? 'conflict'
        : saved.get(entry.at)?.has(entry.kg) || seen.has(key)
          ? 'duplicate'
          : saved.has(entry.at)
            ? 'conflict'
            : 'new';
    seen.add(key);
    return { entry, status } as const;
  });
}

/** Recheck duplicates and conflicts inside the write transaction, including imports in other tabs. */
export async function importBodyweightFile(
  file: BodyweightFile,
  additionalTags: string[] = [],
  database = db,
) {
  return database.transaction('rw', database.bodyweights, async () => {
    const existing = await database.bodyweights.toArray();
    const preview = previewBodyweightImport(file, existing, additionalTags);
    const additions = preview
      .filter((row) => row.status === 'new')
      .map(({ entry }) => BodyweightSchema.parse({ ...entry, id: uid() }));
    if (existing.length + additions.length > 100000)
      throw Error('This import would exceed the 100,000-measurement limit.');
    if (additions.length) await database.bodyweights.bulkAdd(additions);
    return {
      added: additions.length,
      duplicates: preview.filter((row) => row.status === 'duplicate').length,
      conflicts: preview.filter((row) => row.status === 'conflict').length,
    };
  });
}
