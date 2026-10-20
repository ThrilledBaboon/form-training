import { z } from 'zod';
import type { Bodyweight } from './model';

export const WeightTagSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[^,;\r\n]+$/, 'Use separate tags rather than commas or line breaks inside a tag.');
export const WeightFilterSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }).strict(),
  z.object({ kind: z.literal('untagged') }).strict(),
  z.object({ kind: z.literal('tag'), tag: WeightTagSchema }).strict(),
]);
export type WeightFilter = z.infer<typeof WeightFilterSchema>;
export const allWeights: WeightFilter = { kind: 'all' };
const key = (tag: string) => tag.trim().toLocaleLowerCase();
export function weightTags(tags: string[]) {
  const unique = new Map<string, string>();
  for (const raw of tags) {
    if (!raw.trim()) continue;
    const tag = WeightTagSchema.parse(raw);
    if (!unique.has(key(tag))) unique.set(key(tag), tag);
  }
  return [...unique.values()];
}
export function filterWeights(entries: Bodyweight[], filter: WeightFilter = allWeights) {
  return entries.filter((entry) =>
    filter.kind === 'all'
      ? true
      : filter.kind === 'untagged'
        ? !entry.tags?.length
        : entry.tags?.some((tag) => key(tag) === key(filter.tag)),
  );
}
export const weightFilterLabel = (filter: WeightFilter = allWeights) =>
  filter.kind === 'all' ? 'All weigh-ins' : filter.kind === 'untagged' ? 'Untagged' : filter.tag;
export const weightFilterValue = (filter: WeightFilter = allWeights) =>
  filter.kind === 'tag' ? 'tag:' + filter.tag : filter.kind;
export const weightFilterFromValue = (value: string): WeightFilter =>
  WeightFilterSchema.parse(
    value.startsWith('tag:') ? { kind: 'tag', tag: value.slice(4) } : { kind: value },
  );
