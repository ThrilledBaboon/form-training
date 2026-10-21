import { useState } from 'react';
import { useApp } from '../lib/context';
import { saveSettings } from '../lib/actions';
import { MUSCLES, muscleName } from '../lib/model';
import {
  defaultSuggestionPreferences,
  type SuggestionPreferences as Preferences,
} from '../lib/suggestion-preferences';
import { AsyncButton, Button, Field } from './ui';

export function SuggestionPreferences({
  value: p,
  onChange,
}: {
  value: Preferences;
  onChange: (p: Preferences) => void;
}) {
  const { data, run } = useApp();
  const [search, setSearch] = useState('');
  const patch = (v: Partial<Preferences>) => onChange({ ...p, ...v });
  const toggle = (key: 'priorityMuscles' | 'equipment' | 'excludedExerciseIds', value: string) =>
    patch({
      [key]: p[key].includes(value as never)
        ? p[key].filter((v) => v !== value)
        : [...p[key], value],
    });
  const equipment = [
    ...new Set(
      data.exercises
        .filter((e) => !e.archived)
        .map((e) => e.equipment)
        .filter(Boolean)
        .concat(p.equipment),
    ),
  ].sort();
  return (
    <details className="suggestion-preferences">
      <summary>Suggestion preferences</summary>
      <p className="muted">
        Changes update this preview. Save defaults to reuse them next time. Today’s energy and
        soreness stay separate.
      </p>
      {p.mode !== 'cindy' && (
        <>
          <div className="suggestion-checks">
            <label>
              <input
                type="checkbox"
                checked={p.balanceCoverage}
                onChange={(e) => patch({ balanceCoverage: e.target.checked })}
              />
              Balance muscle coverage in accessory slots
            </label>
            {p.mode === 'routine' && (
              <label>
                <input
                  type="checkbox"
                  checked={p.addAccessories}
                  onChange={(e) => patch({ addAccessories: e.target.checked })}
                />
                Add accessories to this routine
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={p.respectSchedule}
                onChange={(e) => patch({ respectSchedule: e.target.checked })}
              />
              Respect upcoming scheduled sessions
            </label>
            <label>
              <input
                type="checkbox"
                checked={p.considerClimbing}
                onChange={(e) => patch({ considerClimbing: e.target.checked })}
              />
              Consider recent and planned climbing
            </label>
            <label>
              <input
                type="checkbox"
                checked={p.allowSupersets}
                onChange={(e) => patch({ allowSupersets: e.target.checked })}
              />
              Pair suggested accessories into supersets
            </label>
            {p.mode === 'full_body' && (
              <label>
                <input
                  type="checkbox"
                  checked={p.includeWarmup}
                  onChange={(e) => patch({ includeWarmup: e.target.checked })}
                />
                Include warm-up sets with loads left to choose
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={p.explainChoices}
                onChange={(e) => patch({ explainChoices: e.target.checked })}
              />
              Explain exercise choices
            </label>
          </div>
          {p.mode === 'full_body' && (
            <p className="callout">
              Full body always keeps a compound push, pull and leg movement. Coverage balancing only
              chooses the accessories.
            </p>
          )}
          <div className="form-grid">
            <Field label="Coverage window">
              <select
                value={p.coverageDays}
                onChange={(e) =>
                  patch({ coverageDays: +e.target.value as Preferences['coverageDays'] })
                }
              >
                {[7, 14, 28].map((n) => (
                  <option key={n} value={n}>
                    {n} days
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Maximum added accessories">
              <select
                value={p.accessoryLimit}
                onChange={(e) => patch({ accessoryLimit: +e.target.value })}
              >
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Exercise familiarity">
              <select
                value={p.familiarity}
                onChange={(e) =>
                  patch({ familiarity: e.target.value as Preferences['familiarity'] })
                }
              >
                <option value="familiar">Prefer familiar exercises</option>
                <option value="variety">Allow more variety</option>
              </select>
            </Field>
            <Field label="Progression">
              <select
                value={p.progression}
                onChange={(e) =>
                  patch({ progression: e.target.value as Preferences['progression'] })
                }
              >
                <option value="normal">Normal · reps, then load</option>
                <option value="conservative">Conservative · reps only</option>
                <option value="off">Off · repeat comparable targets</option>
              </select>
            </Field>
          </div>
          <fieldset>
            <legend>Priority muscles</legend>
            <div className="inline-actions">
              <Button
                variant="secondary"
                onClick={() =>
                  patch({
                    priorityMuscles: [
                      'chest',
                      'front_delts',
                      'side_delts',
                      'rear_delts',
                      'upper_back',
                      'lats',
                    ],
                  })
                }
              >
                Chest, shoulders & back
              </Button>
              <Button variant="ghost" onClick={() => patch({ priorityMuscles: [] })}>
                Clear priorities
              </Button>
            </div>
            <div className="suggestion-options">
              {MUSCLES.map((m) => (
                <label key={m}>
                  <input
                    type="checkbox"
                    checked={p.priorityMuscles.includes(m)}
                    onChange={() => toggle('priorityMuscles', m)}
                  />
                  {muscleName(m)}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      <fieldset>
        <legend>Available equipment</legend>
        <p className="small-text muted">
          Nothing selected means any equipment. Selecting equipment limits new suggestions and
          checks saved routines.
        </p>
        <div className="suggestion-options">
          {equipment.map((e) => (
            <label key={e}>
              <input
                type="checkbox"
                checked={p.equipment.includes(e)}
                onChange={() => toggle('equipment', e)}
              />
              {e || 'Unspecified'}
            </label>
          ))}
        </div>
        <Button variant="ghost" onClick={() => patch({ equipment: [] })}>
          Use any equipment
        </Button>
      </fieldset>
      <details>
        <summary>Excluded exercises ({p.excludedExerciseIds.length})</summary>
        <Field label="Find exercises to exclude">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <div className="suggestion-exclusions suggestion-checks">
          {data.exercises
            .filter((e) => !e.archived && e.name.toLowerCase().includes(search.toLowerCase()))
            .map((e) => (
              <label key={e.id}>
                <input
                  type="checkbox"
                  checked={p.excludedExerciseIds.includes(e.id)}
                  onChange={() => toggle('excludedExerciseIds', e.id)}
                />
                {e.name}
              </label>
            ))}
        </div>
      </details>
      <div className="inline-actions">
        <AsyncButton
          variant="secondary"
          onAction={() => run(() => saveSettings({ suggestions: p }), 'Suggestion defaults saved')}
        >
          Save suggestion defaults
        </AsyncButton>
        <Button
          variant="ghost"
          onClick={() => onChange(structuredClone(defaultSuggestionPreferences))}
        >
          Reset preview preferences
        </Button>
      </div>
    </details>
  );
}
