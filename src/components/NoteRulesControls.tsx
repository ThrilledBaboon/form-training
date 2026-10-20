import { useState } from 'react';
import { useApp } from '../lib/context';
import { defaultNoteRules, parseNoteRules } from '../lib/note-rules';
import { changeWorkspace } from '../lib/workspace';
import { download } from '../lib/backup';
import { Button, Field } from './ui';
import { ImportPrompt } from './ImportPrompt';

export function NoteRulesControls() {
  const { data, run, pending } = useApp();
  const active = data.workspace?.noteRules ?? defaultNoteRules;
  const [editor, setEditor] = useState(JSON.stringify(active, null, 2));
  const [preview, setPreview] = useState('');
  return (
    <details className="food-section">
      <summary>Note parsing rules · {active.name}</summary>
      <p>
        Share rules for your notes’ format: date order, aliases, literal replacements and line
        templates. Loading a file previews it below; apply it when ready. Saved workouts are
        retained. Parsing rules run locally.
      </p>
      <div className="food-actions">
        <ImportPrompt kind="note-rules" />
        <Button
          variant="secondary"
          onClick={() => download(JSON.stringify(active, null, 2), 'form-note-rules.json')}
        >
          Export rules
        </Button>
        <label className="button secondary file-button">
          Import rules
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Import note rules"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file)
                void run(async () => {
                  if (file.size > 100000) throw Error('Rules files must be smaller than 100 KB.');
                  const rules = parseNoteRules(await file.text());
                  setEditor(JSON.stringify(rules, null, 2));
                  setPreview('Ready to apply: ' + rules.name);
                });
            }}
          />
        </label>
      </div>
      {preview && <p role="status">{preview}</p>}
      <Field
        label="Parsing rules JSON"
        hint="Edit JSON here or generate it with Get prompt. Applying rules affects your next Parse notes action."
      >
        <textarea
          rows={12}
          maxLength={100000}
          value={editor}
          onChange={(e) => {
            setEditor(e.target.value);
            setPreview('Unapplied changes');
          }}
        />
      </Field>
      <div className="food-actions">
        <Button
          disabled={pending}
          onClick={() =>
            void run(async () => {
              const rules = parseNoteRules(editor);
              await changeWorkspace((w) => {
                w.noteRules = rules;
              });
              setPreview('Applied: ' + rules.name);
            }, 'Parsing rules saved')
          }
        >
          Apply rules
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            void run(async () => {
              await changeWorkspace((w) => {
                w.noteRules = undefined;
              });
              setEditor(JSON.stringify(defaultNoteRules, null, 2));
              setPreview('Standard rules restored');
            })
          }
        >
          Restore standard rules
        </Button>
      </div>
    </details>
  );
}
