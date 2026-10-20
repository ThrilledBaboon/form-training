import { ChartPreferences } from './ChartPreferences';
import { useState } from 'react';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { useApp } from '../lib/context';
import {
  defaultPersonalisation,
  personalisation,
  navigationRows,
  destinations,
  type Personalisation,
  type Destination,
} from '../lib/personalisation';
import { savePersonalisation } from '../lib/personalisation-actions';
import { moveEntry } from '../lib/workspace';
import { Card, SectionTitle, Field, Button } from './ui';

export function PersonalisationSettings() {
  const { data, run, pending, toast } = useApp();
  const [draft, setDraft] = useState(() => structuredClone(personalisation(data.settings)));
  const [expected, setExpected] = useState(() => JSON.stringify(data.settings.personalisation));
  const patch = (p: Partial<Personalisation>) => setDraft((d) => ({ ...d, ...p }));
  const rows = navigationRows(draft);
  const check = (
    key: 'highContrast' | 'showFooter' | 'showPageDescription' | 'workoutNotesOpen',
    label: string,
  ) => (
    <label className="check-label">
      <input
        type="checkbox"
        checked={draft[key]}
        onChange={(e) => patch({ [key]: e.target.checked })}
      />
      {label}
    </label>
  );
  return (
    <Card className="personalisation-settings">
      <SectionTitle
        title="Make FORM yours"
        sub="These choices belong to this browser. Your friends can use different layouts, goals and preferences on their own devices."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await savePersonalisation(draft, expected);
            setExpected(JSON.stringify(draft));
            toast('Customisation saved');
          });
        }}
      >
        <details open>
          <summary>Spacing, text & feedback</summary>
          <div className="form-grid">
            <Field label="Interface spacing">
              <select
                value={draft.density}
                onChange={(e) => patch({ density: e.target.value as Personalisation['density'] })}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
                <option value="minimal">Minimal</option>
              </select>
            </Field>
            <Field label="Text size">
              <select
                value={draft.textSize}
                onChange={(e) => patch({ textSize: e.target.value as Personalisation['textSize'] })}
              >
                <option value="standard">Standard</option>
                <option value="large">Large</option>
                <option value="larger">Larger</option>
              </select>
            </Field>
            <Field label="Success feedback">
              <select
                value={draft.feedback}
                onChange={(e) => patch({ feedback: e.target.value as Personalisation['feedback'] })}
              >
                <option value="messages">Show success messages</option>
                <option value="quiet">Quiet · keep errors and Undo available</option>
              </select>
            </Field>
          </div>
          {check('highContrast', 'Stronger contrast')}
          {check('showPageDescription', 'Show page descriptions')}
          {check('showFooter', 'Show the page footer')}
        </details>
        <details>
          <summary>Navigation & your words</summary>
          <p className="small-text muted">
            Rename, reorder or hide links. Hidden links remain available through direct links.
            Settings always stays available.
          </p>
          {rows.map((row, index) => (
            <div className="personal-nav-row" key={row.route}>
              <label className="check-label">
                <input
                  type="checkbox"
                  aria-label={'Show ' + row.route}
                  disabled={row.route === 'settings'}
                  checked={!row.hidden}
                  onChange={(e) =>
                    patch({
                      navigation: rows.map((r) =>
                        r.route === row.route ? { ...r, hidden: !e.target.checked } : r,
                      ),
                    })
                  }
                />
                <span>{destinations.find(([id]) => id === row.route)?.[1]}</span>
              </label>
              <input
                aria-label={'Navigation label for ' + row.route}
                maxLength={40}
                required
                value={row.label}
                onChange={(e) =>
                  patch({
                    navigation: rows.map((r) =>
                      r.route === row.route ? { ...r, label: e.target.value } : r,
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                aria-label={'Move ' + row.route + ' up'}
                disabled={index === 0}
                onClick={() => patch({ navigation: moveEntry(rows, index, index - 1) })}
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-label={'Move ' + row.route + ' down'}
                disabled={index === rows.length - 1}
                onClick={() => patch({ navigation: moveEntry(rows, index, index + 1) })}
              >
                <ArrowDown size={16} />
              </Button>
            </div>
          ))}
        </details>
        <details>
          <summary>Phone shortcuts</summary>
          <p className="small-text muted">
            Choose up to four bottom-bar links. More always opens the full navigation.
          </p>
          {Array.from({ length: 4 }, (_, index) => (
            <Field key={index} label={'Phone shortcut ' + (index + 1)}>
              <select
                value={draft.mobileRoutes[index] ?? ''}
                onChange={(e) => {
                  const next = [...draft.mobileRoutes];
                  if (e.target.value) next[index] = e.target.value as Destination;
                  else next.splice(index, 1);
                  patch({ mobileRoutes: next.filter(Boolean) });
                }}
              >
                <option value="">No shortcut</option>
                {destinations
                  .filter(
                    ([id]) => id === draft.mobileRoutes[index] || !draft.mobileRoutes.includes(id),
                  )
                  .map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
              </select>
            </Field>
          ))}
        </details>
        <details>
          <summary>Chart defaults</summary>
          <ChartPreferences value={draft.charts} onChange={(charts) => patch({ charts })} />
          <p className="small-text muted">
            Widgets can override these defaults. Weekly averages use recorded points; missing days
            are not filled.
          </p>
        </details>
        <details>
          <summary>Food display</summary>
          <p className="small-text muted">
            Choose the macros you see and their order. All recorded nutrition is retained. Calories
            keep their separate opt-in setting.
          </p>
          {(['protein', 'carbs', 'fat', 'fibre'] as const).map((key) => (
            <label key={key} className="check-label">
              <input
                type="checkbox"
                checked={draft.macros.includes(key)}
                onChange={(e) =>
                  patch({
                    macros: e.target.checked
                      ? [...draft.macros, key]
                      : draft.macros.filter((m) => m !== key),
                  })
                }
              />
              {key === 'carbs' ? 'Carbs' : key[0].toUpperCase() + key.slice(1)}
            </label>
          ))}
          {draft.macros.map((key, index) => (
            <div className="inline-actions" key={key}>
              <span>
                {index + 1}. {key}
              </span>
              <Button
                type="button"
                variant="ghost"
                aria-label={'Move ' + key + ' earlier'}
                disabled={index === 0}
                onClick={() => patch({ macros: moveEntry(draft.macros, index, index - 1) })}
              >
                <ArrowUp size={16} />
              </Button>
            </div>
          ))}
          <Field label="Daily macro numbers">
            <select
              value={draft.macroDisplay}
              onChange={(e) =>
                patch({ macroDisplay: e.target.value as Personalisation['macroDisplay'] })
              }
            >
              <option value="consumed">Consumed</option>
              <option value="remaining">Remaining to target</option>
              <option value="both">Consumed and remaining</option>
            </select>
          </Field>
        </details>
        <details>
          <summary>Logging defaults</summary>
          {check('workoutNotesOpen', 'Open exercise notes and suggestions by default')}
          <Field label="Preferred effort scale">
            <select
              value={draft.effortScale}
              onChange={(e) =>
                patch({ effortScale: e.target.value as Personalisation['effortScale'] })
              }
            >
              <option value="rpe">RPE</option>
              <option value="rir">Reps in reserve</option>
            </select>
          </Field>
          <p className="small-text muted">
            This chooses the input for sets without an effort rating. Recorded effort is never
            converted.
          </p>
          <Field label="Default climbing type">
            <select
              value={draft.climbingType}
              onChange={(e) =>
                patch({ climbingType: e.target.value as Personalisation['climbingType'] })
              }
            >
              {['bouldering', 'top_rope', 'auto_belay', 'lead'].map((t) => (
                <option key={t} value={t}>
                  {t.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Usual climbing venue">
            <input
              maxLength={200}
              value={draft.climbingVenue}
              onChange={(e) => patch({ climbingVenue: e.target.value })}
            />
          </Field>
          <Field label="Preferred climbing grade scale">
            <input
              maxLength={80}
              value={draft.climbingScale}
              onChange={(e) => patch({ climbingScale: e.target.value })}
            />
          </Field>
          <Field
            label="Your climbing tags"
            hint="Comma-separated, for example balance, crimps, slopers, footwork."
          >
            <input
              key={draft.climbingTags.join(',')}
              defaultValue={draft.climbingTags.join(', ')}
              onBlur={(e) =>
                patch({
                  climbingTags: [
                    ...new Set(
                      e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    ),
                  ],
                })
              }
            />
          </Field>
        </details>
        <details>
          <summary>Climbing gym colour circuits</summary>
          <p className="small-text muted">
            Give a venue's exact grade and scale a colour. Colours are labels, not grade
            conversions.
          </p>
          {draft.circuits.map((c, index) => (
            <div className="form-grid circuit-editor" key={index}>
              {(['venue', 'grade', 'scale'] as const).map((key) => (
                <Field key={key} label={'Circuit ' + (index + 1) + ' ' + key}>
                  <input
                    maxLength={key === 'venue' ? 200 : 80}
                    value={c[key]}
                    onChange={(e) =>
                      patch({
                        circuits: draft.circuits.map((r, i) =>
                          i === index ? { ...r, [key]: e.target.value } : r,
                        ),
                      })
                    }
                  />
                </Field>
              ))}
              <Field label={'Circuit ' + (index + 1) + ' colour'}>
                <input
                  type="color"
                  value={c.colour}
                  onChange={(e) =>
                    patch({
                      circuits: draft.circuits.map((r, i) =>
                        i === index ? { ...r, colour: e.target.value } : r,
                      ),
                    })
                  }
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                aria-label={'Remove circuit ' + (index + 1)}
                onClick={() => patch({ circuits: draft.circuits.filter((_, i) => i !== index) })}
              >
                <X size={16} />
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={draft.circuits.length >= 100}
            onClick={() =>
              patch({
                circuits: [
                  ...draft.circuits,
                  {
                    venue: draft.climbingVenue,
                    grade: '',
                    scale: draft.climbingScale,
                    colour: '#657db5',
                  },
                ],
              })
            }
          >
            Add colour circuit
          </Button>
        </details>
        <div className="modal-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDraft(structuredClone(defaultPersonalisation))}
          >
            Use default customisation
          </Button>
          <Button type="submit" disabled={pending}>
            Save customisation
          </Button>
        </div>
      </form>
    </Card>
  );
}
