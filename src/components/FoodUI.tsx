import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useApp } from '../lib/context';
import {
  emptyFood,
  macroKeys,
  macroNames,
  units,
  type Macros,
  type Unit,
  type FoodData,
  type Recipe,
  type FoodDraft,
  readFoodDraft,
} from '../lib/food-model';
import { foodNumber, money, foodDay, recipeNutrition } from '../lib/food-calc';
import { saveFoodDraft, imageFile, saveFoodFile, cookRecipe } from '../lib/food-actions';
import { now } from '../lib/model';
import { Button, Field, Modal } from './ui';

export const useFood = () => useApp().data.food ?? emptyFood;
export const foodLinks = [
  ['food-menu', 'Menu'],
  ['food-diary', 'Food diary'],
  ['food-kitchen', 'Kitchen'],
  ['food-planner', 'Meal planner'],
  ['food-shopping', 'Shopping'],
  ['food-budget', 'Spending'],
  ['food-ingredients', 'Ingredients'],
] as const;
export function FoodNav() {
  const route = location.hash.split('?')[0].replace('#/', '');
  return (
    <nav className="food-tabs" aria-label="Food navigation">
      {foodLinks.map(([id, label]) => (
        <a key={id} href={'#/' + id} aria-current={route === id ? 'page' : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}
export function MacroSummary({ macros, compact = false }: { macros: Macros; compact?: boolean }) {
  return (
    <dl className={`macro-summary ${compact ? 'compact' : ''}`}>
      {macroKeys.map((key) => (
        <div key={key}>
          <dt>{macroNames[key]}</dt>
          <dd>
            {foodNumber(macros[key])}
            <small>{macros[key] === undefined ? ' unknown' : ' g'}</small>
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function MacroInputs({ value, onChange }: { value: Macros; onChange: (m: Macros) => void }) {
  return (
    <div className="form-grid">
      {macroKeys.map((key) => (
        <Field key={key} label={`${macroNames[key]} (g)`} hint="Leave blank if unknown.">
          <input
            type="number"
            min={0}
            step="any"
            value={value[key] ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                [key]: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
          />
        </Field>
      ))}
    </div>
  );
}
export function UnitSelect({
  value,
  onChange,
  label = 'Unit',
  disabled = false,
}: {
  value: Unit;
  onChange: (u: Unit) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Unit)}>
        {units.map((unit) => (
          <option key={unit}>{unit}</option>
        ))}
      </select>
    </Field>
  );
}
export function IngredientSelect({
  food,
  value,
  onChange,
  label = 'Ingredient',
  disabled = false,
}: {
  food: FoodData;
  value: string;
  onChange: (s: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose ingredient</option>
        {food.ingredients
          .filter((i) => !i.archived || i.id === value)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((i) => (
            <option value={i.id} key={i.id}>
              {i.name}
              {i.brand ? ' · ' + i.brand : ''} · {i.state}
            </option>
          ))}
      </select>
    </Field>
  );
}
export function FoodImage({
  id,
  alt,
  className = '',
}: {
  id?: string;
  alt: string;
  className?: string;
}) {
  const file = useLiveQuery(() => (id ? db.foodFiles.get(id) : undefined), [id]);
  return file ? <img src={file.data} alt={alt} className={className} loading="lazy" /> : null;
}
export function ImageInput({
  onChange,
  label = 'Upload image',
}: {
  onChange: (id: string) => void;
  label?: string;
}) {
  const { run } = useApp();
  return (
    <Field
      label={label}
      hint="PNG, JPEG or WebP, up to 5 MB. Stored on this device and included in backups."
    >
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            void run(async () => {
              const record = await imageFile(file);
              await saveFoodFile(record);
              onChange(record.id);
            });
          e.target.value = '';
        }}
      />
    </Field>
  );
}
export function NutritionNote({ missing, estimated }: { missing: string[]; estimated: boolean }) {
  return (
    <p className="small-text muted">
      {missing.length
        ? `Incomplete nutrition: ${missing.slice(0, 3).join('; ')}${missing.length > 3 ? ` (+${missing.length - 3} more)` : ''}. Unknown totals are shown as —.`
        : estimated
          ? 'Based on manually entered or estimated ingredient data.'
          : 'Based on your recorded verified ingredient data.'}
    </p>
  );
}
/** Persist each edit, rather than losing an open editor on route changes or refresh. */
export function useFoodDraft<T extends { id: string }>(
  kind: FoodDraft['kind'],
  initial: T,
  editing = false,
) {
  const food = useFood();
  const { run } = useApp();
  const [value, setValue] = useState<T>(() => {
    const saved = food.foodDrafts.find((d) => d.id === kind + '-editor');
    if (saved) {
      const parsed = readFoodDraft(kind, saved.json) as T | undefined;
      if (parsed && (!editing || parsed.id === initial.id)) return parsed;
    }
    return initial;
  });
  const set = (next: T) => {
    setValue(next);
    void run(() =>
      saveFoodDraft({ id: kind + '-editor', kind, json: JSON.stringify(next), updatedAt: now() }),
    );
  };
  return [value, set] as const;
}
export function CookModal({
  recipe,
  initialServings,
  onClose,
}: {
  recipe: Recipe;
  initialServings?: number;
  onClose: () => void;
}) {
  const food = useFood();
  const { run, toast } = useApp();
  const [servings, setServings] = useState(initialServings ?? recipe.servings);
  const [date, setDate] = useState(foodDay());
  const [location, setLocation] = useState('Fridge');
  const [expires, setExpires] = useState('');
  const nutrition = recipeNutrition(food, recipe, servings);
  return (
    <Modal title={'Confirm cooking · ' + recipe.name} onClose={onClose}>
      <p>
        Confirm only after cooking. This deducts ingredients once and creates prepared portions.
        Packages are used by earliest expiry, then purchase date. Expired or unchecked stock is
        excluded.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await cookRecipe(recipe.id, servings, {
              date,
              location,
              expires: expires || undefined,
            });
            toast('Ingredients deducted and prepared portions saved.');
            onClose();
          });
        }}
      >
        <div className="form-grid">
          <Field label="Portions prepared">
            <input
              type="number"
              required
              min={0.01}
              step="any"
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
            />
          </Field>
          <Field label="Prepared date">
            <input
              type="date"
              required
              max={foodDay()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Storage location">
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              {[...new Set(['Fridge', ...food.foodSettings.locations])].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Use by (optional)">
            <input
              type="date"
              min={date}
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </Field>
        </div>
        <p>
          Estimated batch ingredient cost: {money(nutrition.cost, food.foodSettings.currency)}. No
          stock changes occur until you confirm.
        </p>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Confirm cooking & deduct stock</Button>
        </div>
      </form>
    </Modal>
  );
}
export function FoodEmpty({ children }: { children: ReactNode }) {
  return <p className="food-empty">{children}</p>;
}
