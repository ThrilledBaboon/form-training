import { z } from 'zod';

const placeholders = [
  'date',
  'exercise',
  'set',
  'sets',
  'reps',
  'load',
  'unit',
  'restSeconds',
  'durationSeconds',
  'distanceM',
  'notes',
] as const;
const literal = z.string().trim().min(1).max(200);
const TemplateSchema = z
  .object({
    kind: z.enum(['date', 'exercise', 'set', 'note']),
    template: z.string().trim().min(1).max(500),
  })
  .strict()
  .superRefine((rule, ctx) => {
    const fields = [...rule.template.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]);
    if (
      !fields.length ||
      fields.some((field) => !placeholders.includes(field as (typeof placeholders)[number])) ||
      new Set(fields).size !== fields.length ||
      /\}\s*\{/.test(rule.template) ||
      /[{}]/.test(rule.template.replace(/\{[^{}]+\}/g, ''))
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Use unique supported placeholders separated by literal text, for example {load} x {reps}.',
      });
    const required =
      rule.kind === 'date'
        ? 'date'
        : rule.kind === 'exercise'
          ? 'exercise'
          : rule.kind === 'note'
            ? 'notes'
            : undefined;
    if (required && !fields.includes(required))
      ctx.addIssue({ code: 'custom', message: `A ${rule.kind} template needs {${required}}.` });
    const allowed: readonly string[] =
      rule.kind === 'date'
        ? ['date']
        : rule.kind === 'note'
          ? ['notes']
          : placeholders.filter(
              (f) =>
                !['date', ...(rule.kind === 'set' ? ['exercise', 'sets'] : ['set'])].includes(f),
            );
    if (fields.some((field) => !allowed.includes(field)))
      ctx.addIssue({
        code: 'custom',
        message: 'A template contains a placeholder that does not belong to its kind.',
      });
    if (
      rule.kind === 'set' &&
      !fields.some((f) => ['reps', 'load', 'durationSeconds', 'distanceM'].includes(f))
    )
      ctx.addIssue({ code: 'custom', message: 'A set template needs a measurement.' });
  });
export const NoteRulesSchema = z
  .object({
    app: z.literal('FORM'),
    type: z.literal('workout-note-rules'),
    schemaVersion: z.literal(1),
    name: z.string().trim().min(1).max(100),
    rules: z
      .object({
        dateOrder: z.enum(['day-first', 'month-first']).default('day-first'),
        defaultLoadUnit: z.enum(['kg', 'lb']).default('kg'),
        notePrefixes: z.array(literal).max(30).default(['Note:', 'Notes:', 'Reminder:']),
        ignoreLines: z.array(literal).max(50).default([]),
        replacements: z
          .array(z.object({ find: literal, replace: z.string().max(200) }).strict())
          .max(50)
          .default([]),
        exerciseAliases: z
          .array(z.object({ from: literal, to: literal }).strict())
          .max(200)
          .default([]),
        templates: z.array(TemplateSchema).max(30).default([]),
      })
      .strict(),
  })
  .strict();
export type NoteRules = z.infer<typeof NoteRulesSchema>;
export const defaultNoteRules: NoteRules = NoteRulesSchema.parse({
  app: 'FORM',
  type: 'workout-note-rules',
  schemaVersion: 1,
  name: 'Standard workout notes',
  rules: {},
});
export function parseNoteRules(text: string): NoteRules {
  if (text.length > 100000) throw Error('Rules files must be smaller than 100 KB.');
  return NoteRulesSchema.parse(JSON.parse(text));
}

// Match literal separators in one pass. Rule files cannot execute code or supply regular expressions.
function matchTemplate(line: string, template: string): Record<string, string> | undefined {
  const tokens = [...template.matchAll(/\{([^{}]+)\}/g)];
  const result: Record<string, string> = {};
  let offset = 0,
    end = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i],
      prefix = template.slice(end, token.index);
    if (line.slice(offset, offset + prefix.length).toLowerCase() !== prefix.toLowerCase()) return;
    offset += prefix.length;
    end = token.index! + token[0].length;
    const next = template.slice(end, tokens[i + 1]?.index ?? template.length);
    const at = next ? line.toLowerCase().indexOf(next.toLowerCase(), offset) : line.length;
    if (at < offset) return;
    result[token[1]] = line.slice(offset, at).trim();
    if (!result[token[1]]) return;
    offset = at;
  }
  return line.slice(offset).toLowerCase() === template.slice(end).toLowerCase()
    ? result
    : undefined;
}
function canonicalDate(text: string, order: NoteRules['rules']['dateOrder']) {
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const local = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!iso && !local) throw Error('A date rule needs an ISO or numeric date.');
  const year = iso ? iso[1] : local![3].length === 2 ? '20' + local![3] : local![3];
  const month = iso ? iso[2] : local![order === 'month-first' ? 1 : 2].padStart(2, '0');
  const day = iso ? iso[3] : local![order === 'month-first' ? 2 : 1].padStart(2, '0');
  const value = `${year}-${month}-${day}`;
  const parsed = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value)
    throw Error('A note contains an invalid date: ' + text);
  return value;
}
export function prepareWorkoutNotes(source: string, input: NoteRules = defaultNoteRules): string {
  if (source.length > 100000) throw Error('Paste up to 100,000 characters at a time.');
  const { rules } = NoteRulesSchema.parse(input);
  let nextSet = 1,
    total = 0;
  const alias = (name: string) =>
    rules.exerciseAliases.find((a) => a.from.toLowerCase() === name.toLowerCase())?.to ?? name;
  const prepared = source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((original) => {
      let line = original
        .trim()
        .replace(/\*\*/g, '')
        .replace(/&#x20;|&nbsp;/g, ' ');
      for (const r of rules.replacements) {
        line = line.split(r.find).join(r.replace);
        if (line.length > 100000)
          throw Error('A replacement expanded a line beyond the size limit.');
      }
      total += line.length + 1;
      if (total > 100000) throw Error('Rules expanded these notes beyond 100,000 characters.');
      if (rules.ignoreLines.some((s) => s.toLowerCase() === line.toLowerCase())) return '';
      const prefix = rules.notePrefixes.find((s) => line.toLowerCase().startsWith(s.toLowerCase()));
      if (prefix) return 'Note: ' + line.slice(prefix.length).trim();
      for (const rule of rules.templates) {
        const values = matchTemplate(line, rule.template);
        if (!values) continue;
        if (rule.kind === 'date') {
          nextSet = 1;
          return canonicalDate(values.date, rules.dateOrder);
        }
        if (rule.kind === 'note') return 'Note: ' + values.notes;
        const numeric = (key: string) => {
          const text = values[key];
          if (text === undefined) return undefined;
          if (!/^\d+(?:[.,]\d+)?$/.test(text) || +text.replace(',', '.') > 1e6)
            throw Error(`Invalid {${key}} in a matched note rule.`);
          const n = Number(text.replace(',', '.'));
          if (['set', 'sets'].includes(key) && (!Number.isInteger(n) || n < 1 || n > 100))
            throw Error('Set numbers and counts must be between 1 and 100.');
          return n;
        };
        const unit = values.unit?.toLowerCase() ?? rules.defaultLoadUnit;
        if (!['kg', 'lb', 'lbs'].includes(unit)) throw Error('A load unit must be kg or lb.');
        const fields = [
          ['load', unit],
          ['reps', 'reps'],
          ['sets', 'sets'],
          ['restSeconds', 'seconds rest'],
          ['durationSeconds', 'seconds'],
          ['distanceM', 'm'],
        ]
          .flatMap(([key, suffix]) => {
            const n = numeric(key);
            return n === undefined
              ? []
              : [(key === 'durationSeconds' ? 'duration: ' : '') + n + ' ' + suffix];
          })
          .join(' ');
        if (rule.kind === 'exercise') {
          nextSet = 1;
          return (
            alias(values.exercise) + ' ' + fields + (values.notes ? '\nNote: ' + values.notes : '')
          );
        }
        const index = numeric('set') ?? nextSet;
        nextSet = index + 1;
        return `${index}. ${fields}${values.notes ? ' ' + values.notes : ''}`;
      }
      const date = line.match(/^(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-](?:\d{4}|\d{2}))\b/);
      if (date) {
        nextSet = 1;
        line = canonicalDate(date[0], rules.dateOrder) + line.slice(date[0].length);
      }
      for (const a of rules.exerciseAliases) {
        if (
          line.toLowerCase() === a.from.toLowerCase() ||
          (line.toLowerCase().startsWith(a.from.toLowerCase()) &&
            /^[\s:,\d]/.test(line.slice(a.from.length)))
        ) {
          line = a.to + line.slice(a.from.length);
          break;
        }
      }
      return line;
    })
    .join('\n');
  if (prepared.length > 100000)
    throw Error('Rules expanded these notes beyond 100,000 characters.');
  return prepared;
}
