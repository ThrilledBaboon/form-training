import { saveSettings } from '../lib/actions';
import { useApp } from '../lib/context';
import type { Settings } from '../lib/model';
import { Card, Field, SectionTitle } from './ui';

const palettes = [
  {
    id: 'sage',
    name: 'Sage',
    description: 'Soft greens',
    swatches: ['#e9eee4', '#9bc5a2', '#346b52'],
  },
  {
    id: 'sand',
    name: 'Sand',
    description: 'Warm neutrals',
    swatches: ['#ede5d9', '#ddbd87', '#7e572b'],
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Cool blues',
    swatches: ['#e5ebf0', '#a2c5e5', '#3e6385'],
  },
  {
    id: 'plum',
    name: 'Plum',
    description: 'Muted purples',
    swatches: ['#ede3eb', '#d7b0d0', '#805477'],
  },
] as const;

export function AppearanceSettings() {
  const { data, run } = useApp();
  const s = data.settings;
  const patch = (value: Partial<Settings>) => void run(() => saveSettings(value));
  return (
    <Card className="appearance-settings">
      <SectionTitle
        title="Appearance"
        sub="Choose your colours. Widgets blend into the page in every palette."
      />
      <div className="appearance-controls">
        <Field label="Theme">
          <select
            value={s.theme}
            onChange={(e) => patch({ theme: e.target.value as Settings['theme'] })}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">Use device setting</option>
          </select>
        </Field>
        <label className="check-label">
          <input
            type="checkbox"
            checked={s.reducedMotion}
            onChange={(e) => patch({ reducedMotion: e.target.checked })}
          />
          Reduce interface motion
        </label>
      </div>
      <fieldset className="palette-picker">
        <legend>Colour palette</legend>
        <div className="palette-options">
          {palettes.map((palette) => (
            <label
              className={`palette-option ${s.palette === palette.id ? 'selected' : ''}`}
              key={palette.id}
            >
              <span className="palette-preview" aria-hidden="true">
                {palette.swatches.map((colour) => (
                  <span key={colour} style={{ backgroundColor: colour }} />
                ))}
              </span>
              <span className="palette-option-title">
                <input
                  type="radio"
                  name="colour-palette"
                  value={palette.id}
                  aria-label={palette.name}
                  checked={s.palette === palette.id}
                  onChange={() => patch({ palette: palette.id })}
                />
                <strong>{palette.name}</strong>
              </span>
              <span className="palette-description">{palette.description}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}
