import { Field } from './ui';
import {
  weightTags,
  weightFilterValue,
  weightFilterFromValue,
  type WeightFilter,
} from '../lib/weight-tags';
import type { Bodyweight } from '../lib/model';

export function WeightTagFilter({
  entries,
  value,
  onChange,
  label = 'Weigh-in tag filter',
  disabled = false,
}: {
  entries: Bodyweight[];
  value: WeightFilter;
  onChange: (filter: WeightFilter) => void;
  label?: string;
  disabled?: boolean;
}) {
  const tags = weightTags([
    ...entries.flatMap((e) => e.tags ?? []),
    ...(value.kind === 'tag' ? [value.tag] : []),
  ]).sort((a, b) => a.localeCompare(b));
  const selected: WeightFilter =
    value.kind === 'tag'
      ? {
          kind: 'tag',
          tag:
            tags.find((tag) => tag.toLocaleLowerCase() === value.tag.toLocaleLowerCase()) ??
            value.tag,
        }
      : value;
  return (
    <Field label={label}>
      <select
        disabled={disabled}
        value={weightFilterValue(selected)}
        onChange={(e) => onChange(weightFilterFromValue(e.target.value))}
      >
        <option value="all">All weigh-ins</option>
        <option value="untagged">Untagged</option>
        {tags.map((tag) => (
          <option key={tag} value={'tag:' + tag}>
            {tag}
          </option>
        ))}
      </select>
    </Field>
  );
}
