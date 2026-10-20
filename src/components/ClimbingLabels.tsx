import { useState } from 'react';
import { useApp } from '../lib/context';
import { personalisation } from '../lib/personalisation';
import { Field, Button } from './ui';
export function CircuitGrade({
  climb,
}: {
  climb: { grade: string; venue: string; gradeScale: string };
}) {
  const { data } = useApp();
  const circuit = personalisation(data.settings).circuits.find(
    (c) => c.venue === climb.venue && c.grade === climb.grade && c.scale === climb.gradeScale,
  );
  return (
    <span className="circuit-chip">
      {circuit && <i style={{ backgroundColor: circuit.colour }} aria-hidden="true" />}
      {climb.grade || 'Ungraded'}
    </span>
  );
}
export function ClimbingTagsInput({
  value,
  onChange,
  label = 'Climbing tags',
}: {
  value?: string[];
  onChange: (tags: string[]) => void;
  label?: string;
}) {
  const { data } = useApp();
  const [text, setText] = useState(value?.join(', ') ?? '');
  const update = (text: string) => {
    setText(text);
    onChange([
      ...new Set(
        text
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ]);
  };
  return (
    <>
      <Field
        label={label}
        hint="Comma-separated tags. These are copied into new entries; past sessions keep their recorded tags."
      >
        <input value={text} onChange={(e) => update(e.target.value)} />
      </Field>
      <div className="climbing-tags">
        {personalisation(data.settings).climbingTags.map((tag) => (
          <Button
            key={tag}
            type="button"
            variant="ghost"
            aria-pressed={value?.includes(tag) ?? false}
            onClick={() =>
              update(
                (value?.includes(tag)
                  ? value.filter((t) => t !== tag)
                  : [...(value ?? []), tag]
                ).join(', '),
              )
            }
          >
            {tag}
          </Button>
        ))}
      </div>
    </>
  );
}
