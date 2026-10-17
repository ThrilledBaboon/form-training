import { useState } from 'react';
import { Plus, Pencil, Copy, Archive } from 'lucide-react';
import { useApp } from '../lib/context';
import { uid, now } from '../lib/model';
import { IngredientSchema, type Ingredient } from '../lib/food-model';
import { saveIngredient } from '../lib/food-actions';
import { foodNumber } from '../lib/food-calc';
import { db } from '../lib/db';
import {
  FoodNav,
  useFood,
  MacroSummary,
  MacroInputs,
  UnitSelect,
  useFoodDraft,
  FoodEmpty,
} from '../components/FoodUI';
import { Card, PageTitle, Button, Field, Modal, Badge, AsyncButton } from '../components/ui';
export function newIngredient(): Ingredient {
  return IngredientSchema.parse({
    id: uid(),
    name: 'New ingredient',
    createdAt: now(),
    updatedAt: now(),
  });
}
export function IngredientEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Ingredient;
  onClose: () => void;
  onSaved?: (ingredient: Ingredient) => void;
}) {
  const { run } = useApp();
  const food = useFood();
  const [value, set] = useFoodDraft('ingredient', initial ?? newIngredient(), !!initial);
  const patch = (p: Partial<Ingredient>) => set({ ...value, ...p });
  return (
    <Modal title={initial ? 'Edit ingredient' : 'Add ingredient'} onClose={onClose} wide>
      <p className="small-text muted">
        Edits are saved as a local draft. Nutrition is per 100 {value.basisUnit}, for the selected
        food state.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await saveIngredient(value);
            await db.foodDrafts.delete('ingredient-editor');
            onSaved?.(value);
            onClose();
          }, 'Ingredient saved');
        }}
      >
        <div className="form-grid">
          <Field label="Ingredient name">
            <input
              required
              maxLength={200}
              value={value.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <input
              value={value.category}
              onChange={(e) => patch({ category: e.target.value })}
              list="ingredient-categories"
            />
          </Field>
          <datalist id="ingredient-categories">
            {['Produce', 'Meat & fish', 'Dairy', 'Grains', 'Tinned & dry', 'Frozen', 'Other'].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </datalist>
          <Field label="Brand">
            <input value={value.brand} onChange={(e) => patch({ brand: e.target.value })} />
          </Field>
          <Field label="Barcode / product code">
            <input value={value.barcode} onChange={(e) => patch({ barcode: e.target.value })} />
          </Field>
          <Field label="Alternative names (comma separated)">
            <input
              value={value.aliases.join(', ')}
              onChange={(e) => patch({ aliases: e.target.value.split(',').map((s) => s.trim()) })}
            />
          </Field>
          <UnitSelect
            label="Default quantity unit"
            value={value.defaultUnit}
            onChange={(defaultUnit) => patch({ defaultUnit })}
          />
          <Field label="Nutrition basis">
            <select
              value={value.basisUnit}
              onChange={(e) => patch({ basisUnit: e.target.value as 'g' | 'ml' })}
            >
              <option value="g">Per 100 g</option>
              <option value="ml">Per 100 ml</option>
            </select>
          </Field>
          <Field label="Food state">
            <select
              value={value.state}
              onChange={(e) => patch({ state: e.target.value as Ingredient['state'] })}
            >
              <option>as sold</option>
              <option>raw</option>
              <option>cooked</option>
            </select>
          </Field>
        </div>
        <MacroInputs value={value.macros} onChange={(macros) => patch({ macros })} />
        <div className="form-grid">
          <Field label="Nutrition status">
            <select
              value={value.nutritionStatus}
              onChange={(e) =>
                patch({
                  nutritionStatus: e.target.value as Ingredient['nutritionStatus'],
                  sourceUpdatedAt: now(),
                })
              }
            >
              {['unknown', 'manual', 'estimated', 'verified'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Nutrition source"
            hint="Required when marked verified, for example the product label and date."
          >
            <input
              value={value.source}
              onChange={(e) => patch({ source: e.target.value, sourceUpdatedAt: now() })}
            />
          </Field>
          <Field label="Density (g per ml, optional)">
            <input
              type="number"
              min={0.00001}
              step="any"
              value={value.density ?? ''}
              onChange={(e) =>
                patch({ density: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Field>
          <Field label="Grams per item (optional)">
            <input
              type="number"
              min={0.00001}
              step="any"
              value={value.gramsPerCount ?? ''}
              onChange={(e) =>
                patch({ gramsPerCount: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Field>
          <Field label="Typical package quantity">
            <input
              type="number"
              min={0.00001}
              step="any"
              value={value.package?.quantity ?? ''}
              onChange={(e) =>
                patch({
                  package: e.target.value
                    ? {
                        quantity: Number(e.target.value),
                        unit: value.package?.unit ?? value.defaultUnit,
                      }
                    : undefined,
                })
              }
            />
          </Field>
          <UnitSelect
            label="Package unit"
            value={value.package?.unit ?? value.defaultUnit}
            onChange={(unit) =>
              patch({ package: { quantity: value.package?.quantity ?? 1, unit } })
            }
          />
          <Field label="Default storage location">
            <select value={value.location} onChange={(e) => patch({ location: e.target.value })}>
              {[...new Set([...food.foodSettings.locations, value.location])].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Storage guidance">
            <input value={value.storage} onChange={(e) => patch({ storage: e.target.value })} />
          </Field>
        </div>
        <Field label="Ingredient notes">
          <textarea value={value.notes} onChange={(e) => patch({ notes: e.target.value })} />
        </Field>
        <label className="check-label">
          <input
            type="checkbox"
            checked={value.staple}
            onChange={(e) => patch({ staple: e.target.checked })}
          />
          Kitchen staple
        </label>
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Close editor
          </Button>
          <Button type="submit">Save ingredient</Button>
        </div>
      </form>
    </Modal>
  );
}
export function FoodIngredients() {
  const food = useFood();
  const { run } = useApp();
  const [edit, setEdit] = useState<Ingredient | null | undefined>();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [archived, setArchived] = useState(false);
  const ingredients = food.ingredients
    .filter(
      (i) =>
        (archived || !i.archived) &&
        (!category || i.category === category) &&
        [i.name, i.brand, ...i.aliases].some((s) => s.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <FoodNav />
      <PageTitle
        eyebrow="YOUR FOOD LIBRARY"
        title="Ingredients"
        description="Reusable ingredients, clear quantities and nutrition you can trace."
        action={
          <Button onClick={() => setEdit(null)}>
            <Plus size={16} />
            Add ingredient
          </Button>
        }
      />
      <div className="food-filters">
        <Field label="Search ingredients">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Field label="Ingredient category">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {[...new Set(food.ingredients.map((i) => i.category))].sort().map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <label className="check-label">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Include archived
        </label>
      </div>
      <div className="food-grid">
        {ingredients.map((i) => (
          <Card key={i.id}>
            <div className="food-card-heading">
              <div>
                <span className="eyebrow">
                  {i.category} · {i.state}
                </span>
                <h2>{i.name}</h2>
                <p>{i.brand}</p>
              </div>
              <Badge>{i.archived ? 'Archived' : i.nutritionStatus}</Badge>
            </div>
            <p className="small-text muted">
              Per 100 {i.basisUnit}
              {i.staple ? ' · Staple' : ''}
            </p>
            <MacroSummary macros={i.macros} compact />
            <p className="small-text muted">
              {i.source || 'No nutrition source recorded.'}
              {i.package ? ` · Package ${foodNumber(i.package.quantity)} ${i.package.unit}` : ''}
            </p>
            <p>{i.notes}</p>
            <div className="food-actions">
              <Button variant="secondary" onClick={() => setEdit(i)}>
                <Pencil size={14} />
                Edit
              </Button>
              <Button
                variant="ghost"
                aria-label={'Duplicate ' + i.name}
                onClick={() =>
                  setEdit({
                    ...structuredClone(i),
                    id: uid(),
                    name: i.name + ' (copy)',
                    createdAt: now(),
                  })
                }
              >
                <Copy size={16} />
              </Button>
              <AsyncButton
                variant="ghost"
                aria-label={(i.archived ? 'Restore ' : 'Archive ') + i.name}
                onAction={() => run(() => saveIngredient({ ...i, archived: !i.archived }))}
              >
                <Archive size={16} />
              </AsyncButton>
            </div>
          </Card>
        ))}
      </div>
      {!ingredients.length && (
        <FoodEmpty>
          Add your first ingredient from a product label, or adjust your search. Unknown nutrition
          stays blank.
        </FoodEmpty>
      )}
      {edit !== undefined && (
        <IngredientEditor initial={edit ?? undefined} onClose={() => setEdit(undefined)} />
      )}
    </>
  );
}
