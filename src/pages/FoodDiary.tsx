import { AddToPage } from '../components/WorkspaceControls';
import { useId, useState } from 'react';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../lib/context';
import { personalisation } from '../lib/personalisation';
import { uid, now } from '../lib/model';
import {
  mealSlots,
  macroNames,
  type FoodEntry,
  type Macros,
  type FoodSettings,
} from '../lib/food-model';
import { saveFoodEntry, removeFoodEntry, saveFoodSettings } from '../lib/food-actions';
import { db } from '../lib/db';
import {
  recipeNutrition,
  foodDay,
  shiftDay,
  weekDays,
  dailyMacros,
  dailyEnergy,
  scaleMacros,
  addMacros,
  foodNumber,
} from '../lib/food-calc';
import { FoodNav, useFood, MacroSummary, MacroInputs, NutritionNote } from '../components/FoodUI';
import { Card, PageTitle, SectionTitle, Button, AsyncButton, Field, Modal } from '../components/ui';

export function FoodEntryEditor({
  date,
  initial,
  recipeId,
  batchId,
  defaultSlot,
  defaultServings,
  onClose,
}: {
  date: string;
  initial?: FoodEntry;
  recipeId?: string;
  batchId?: string;
  defaultSlot?: FoodEntry['slot'];
  defaultServings?: number;
  onClose: () => void;
}) {
  const food = useFood();
  const { run } = useApp();
  const firstRecipe =
    recipeId ?? initial?.recipeId ?? food.recipes.find((r) => !r.archived && !r.draft)?.id ?? '';
  const [mode, setMode] = useState(
    batchId || initial?.batchId ? 'batch' : firstRecipe ? 'recipe' : 'manual',
  );
  const [recipe, setRecipe] = useState(firstRecipe);
  const [batch, setBatch] = useState(
    batchId ?? initial?.batchId ?? food.batches.find((b) => b.remaining > 0)?.id ?? '',
  );
  const [name, setName] = useState(initial?.name ?? '');
  const [day, setDay] = useState(initial?.date ?? date);
  const [slot, setSlot] = useState<FoodEntry['slot']>(initial?.slot ?? defaultSlot ?? 'Dinner');
  const [servings, setServings] = useState(initial?.servings ?? defaultServings ?? 1);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [manual, setManual] = useState<Macros>(initial?.snapshot.macros ?? {});
  const selectedRecipe = food.recipes.find((r) => r.id === recipe),
    selectedBatch = food.batches.find((b) => b.id === batch);
  const snapshot =
    mode === 'batch'
      ? selectedBatch?.snapshot
      : mode === 'recipe'
        ? initial?.recipeId === recipe && !initial.batchId
          ? initial.snapshot
          : selectedRecipe
            ? recipeNutrition(food, selectedRecipe, 1)
            : undefined
        : {
            macros: manual,
            missing: Object.entries({
              protein: manual.protein,
              carbs: manual.carbs,
              fat: manual.fat,
            })
              .filter(([, v]) => v === undefined)
              .map(([k]) => k + ' unknown'),
            estimated: true,
            ingredients: [],
          };
  return (
    <Modal title={initial ? 'Edit food entry' : 'Log food'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (!snapshot) throw Error('Choose a recipe or prepared batch.');
            await saveFoodEntry({
              id: initial?.id ?? uid(),
              date: day,
              slot,
              name:
                mode === 'manual'
                  ? name
                  : mode === 'batch'
                    ? selectedBatch!.name
                    : selectedRecipe!.name,
              recipeId:
                mode === 'manual' ? undefined : mode === 'batch' ? selectedBatch!.recipeId : recipe,
              batchId: mode === 'batch' ? batch : undefined,
              servings,
              snapshot: structuredClone(snapshot),
              notes,
              createdAt: initial?.createdAt ?? now(),
            });
            onClose();
          }, 'Food entry saved');
        }}
      >
        <Field label="Log from">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="recipe">Saved recipe</option>
            <option value="batch">Prepared portions</option>
            <option value="manual">Other food · enter macros</option>
          </select>
        </Field>
        {mode === 'recipe' && (
          <Field label="Recipe">
            <select required value={recipe} onChange={(e) => setRecipe(e.target.value)}>
              <option value="">Choose recipe</option>
              {food.recipes
                .filter((r) => !r.archived || r.id === recipe)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.draft ? ' (draft)' : ''}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {mode === 'batch' && (
          <>
            <Field label="Prepared batch">
              <select required value={batch} onChange={(e) => setBatch(e.target.value)}>
                <option value="">Choose prepared portions</option>
                {food.batches
                  .filter((b) => b.remaining > 0 || b.id === initial?.batchId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {foodNumber(b.remaining)} left · prepared {b.prepared}
                    </option>
                  ))}
              </select>
            </Field>
            <p className="small-text muted">
              Saving deducts prepared portions once. Editing or deleting returns the previous
              quantity before applying your correction.
            </p>
            {selectedBatch?.expires && selectedBatch.expires < day && (
              <p className="callout">
                This batch’s recorded use-by date is before the diary date. Check that this
                historical entry is correct.
              </p>
            )}
          </>
        )}
        {mode === 'manual' && (
          <>
            <Field label="Food name">
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <p>
              Macros for one portion, from your label or your own estimate. Leave unknown values
              blank.
            </p>
            <MacroInputs value={manual} onChange={setManual} />
          </>
        )}
        <div className="form-grid">
          <Field label="Food date">
            <input
              type="date"
              required
              max={foodDay()}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </Field>
          <Field label="Meal">
            <select value={slot} onChange={(e) => setSlot(e.target.value as FoodEntry['slot'])}>
              {mealSlots.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Servings eaten">
            <input
              type="number"
              min={0.01}
              step="any"
              required
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Meal notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {snapshot && (
          <>
            <MacroSummary macros={scaleMacros(snapshot.macros, servings)} />
            <NutritionNote {...snapshot} />
          </>
        )}
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save food entry</Button>
        </div>
      </form>
    </Modal>
  );
}
function TargetEditor({ onClose }: { onClose: () => void }) {
  const food = useFood();
  const { run } = useApp();
  const keys = ['protein', 'carbs', 'fat', 'fibre'] as const;
  const [energyEnabled, setEnergyEnabled] = useState(food.foodSettings.calorieTarget !== undefined);
  const [energyTarget, setEnergyTarget] = useState(String(food.foodSettings.calorieTarget ?? ''));
  const [enabled, setEnabled] = useState(
    Object.fromEntries(keys.map((k) => [k, food.foodSettings.targets[k] !== undefined])),
  );
  const [values, setValues] = useState(
    Object.fromEntries(keys.map((k) => [k, String(food.foodSettings.targets[k] ?? '')])),
  );
  return (
    <Modal title="Macro targets" onClose={onClose}>
      <p>Choose your own targets in grams. Each target can be disabled independently.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const targets = Object.fromEntries(
              keys.map((k) => [k, enabled[k] ? Number(values[k]) : undefined]),
            ) as FoodSettings['targets'];
            await saveFoodSettings({
              ...food.foodSettings,
              targets,
              calorieTarget: food.foodSettings.showCalories
                ? energyEnabled
                  ? Number(energyTarget)
                  : undefined
                : food.foodSettings.calorieTarget,
            });
            onClose();
          }, 'Macro targets saved');
        }}
      >
        {keys.map((key) => (
          <div key={key}>
            <label className="check-label">
              <input
                type="checkbox"
                checked={enabled[key]}
                onChange={(e) => setEnabled({ ...enabled, [key]: e.target.checked })}
              />
              {macroNames[key]} target enabled
            </label>
            <Field label={macroNames[key] + ' daily target (g)'}>
              <input
                disabled={!enabled[key]}
                required={enabled[key]}
                type="number"
                min={0.1}
                step="any"
                value={values[key]}
                onChange={(e) => setValues({ ...values, [key]: e.target.value })}
              />
            </Field>
          </div>
        ))}
        {food.foodSettings.showCalories && (
          <div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={energyEnabled}
                onChange={(e) => setEnergyEnabled(e.target.checked)}
              />
              Calorie target enabled
            </label>
            <Field label="Daily calorie target (kcal)">
              <input
                type="number"
                min={1}
                max={20000}
                step={1}
                disabled={!energyEnabled}
                required={energyEnabled}
                value={energyTarget}
                onChange={(e) => setEnergyTarget(e.target.value)}
              />
            </Field>
          </div>
        )}
        <div className="modal-actions">
          <Button type="submit">Save targets</Button>
        </div>
      </form>
    </Modal>
  );
}
export function MacroProgress({ date }: { date: string }) {
  const food = useFood();
  const { data } = useApp();
  const display = personalisation(data.settings);
  const totals = dailyMacros(food, date);
  const id = useId();
  const energy = dailyEnergy(food, date);
  return (
    <>
      <MacroSummary macros={totals} targets={food.foodSettings.targets} />
      {food.foodSettings.showCalories && (
        <>
          {energy.missing > 0 && (
            <p className="small-text muted">
              Estimated calories: {foodNumber(energy.total, 0)} kcal known subtotal;{' '}
              {energy.missing} {energy.missing === 1 ? 'entry has' : 'entries have'} incomplete
              macros.
            </p>
          )}
          {food.foodSettings.calorieTarget !== undefined && (
            <div className="macro-target">
              <label htmlFor={id + '-energy'}>
                Estimated calories: {energy.missing ? 'incomplete' : foodNumber(energy.total, 0)} /{' '}
                {foodNumber(food.foodSettings.calorieTarget, 0)} kcal
              </label>
              <progress
                id={id + '-energy'}
                max={food.foodSettings.calorieTarget}
                value={Math.min(energy.total, food.foodSettings.calorieTarget)}
              />
            </div>
          )}
          <p className="small-text muted">
            Estimated from protein, carbohydrates and fat using 4/4/9 kcal per gram. Fibre, alcohol
            and label-specific factors are excluded.
          </p>
        </>
      )}
      {display.macros.map((key) => {
        const target = food.foodSettings.targets[key];
        return target === undefined ? null : (
          <div className="macro-target" key={key}>
            <label htmlFor={id + '-macro-' + key}>
              {macroNames[key]}: {foodNumber(totals[key])} / {foodNumber(target)} g{' '}
              {totals[key] === undefined
                ? '(incomplete)'
                : `· ${foodNumber((totals[key]! / target) * 100, 0)}%`}
            </label>
            <progress
              id={id + '-macro-' + key}
              max={target}
              value={Math.min(target, totals[key] ?? 0)}
            />
          </div>
        );
      })}
    </>
  );
}
export function FoodDiary() {
  const food = useFood();
  const { data, run } = useApp();
  const query = new URLSearchParams(location.hash.split('?')[1]);
  const [date, setDate] = useState(query.get('date') ?? foodDay());
  const [editor, setEditor] = useState<FoodEntry | null | undefined>(
    query.get('recipe') || query.get('batch') ? null : undefined,
  );
  const [targets, setTargets] = useState(false);
  const [copyFrom, setCopyFrom] = useState(shiftDay(date, -1));
  const days = weekDays(date);
  const totals = days.map((d) => dailyMacros(food, d));
  const average = scaleMacros(addMacros(totals), 1 / 7);
  const sessions = data.sessions.filter(
    (s) => s.status === 'completed' && days.includes(foodDay(new Date(s.startAt))),
  ).length;
  return (
    <>
      <FoodNav />
      <PageTitle
        eyebrow="WHAT YOU ACTUALLY ATE"
        title="Food diary"
        description="Saved portions and macros, separate from your meal plan."
        action={
          <Button onClick={() => setEditor(null)}>
            <Plus size={16} />
            Log food
          </Button>
        }
      />
      <AddToPage type="macros" config={{ date }} />
      <div className="food-date-bar">
        <Button
          variant="ghost"
          aria-label="Previous food day"
          onClick={() => setDate(shiftDay(date, -1))}
        >
          <ChevronLeft size={20} />
        </Button>
        <Field label="Diary date">
          <input
            type="date"
            max={foodDay()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Button
          variant="ghost"
          aria-label="Next food day"
          disabled={date >= foodDay()}
          onClick={() => setDate(shiftDay(date, 1))}
        >
          <ChevronRight size={20} />
        </Button>
        <Button variant="secondary" onClick={() => setTargets(true)}>
          Set macro targets
        </Button>
      </div>
      <Card>
        <SectionTitle
          title="Daily macros"
          sub="Totals depend on complete ingredient data and what you log."
        />
        <MacroProgress date={date} />
      </Card>
      <div className="two-col">
        {mealSlots.map((slot) => (
          <Card key={slot}>
            <SectionTitle title={slot} />
            {food.foodEntries
              .filter((e) => e.date === date && e.slot === slot)
              .map((entry) => (
                <div className="food-diary-entry" key={entry.id}>
                  <div className="food-card-heading">
                    <div>
                      <h3>{entry.name}</h3>
                      <p className="small-text muted">
                        {foodNumber(entry.servings)} servings
                        {entry.batchId ? ' · Prepared portions' : ''}
                      </p>
                    </div>
                    <div className="food-actions">
                      <Button
                        variant="ghost"
                        aria-label={'Edit food ' + entry.name}
                        onClick={() => setEditor(entry)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <AsyncButton
                        variant="ghost"
                        aria-label={'Delete food ' + entry.name}
                        onAction={() =>
                          run(async () => {
                            if (
                              confirm(
                                'Delete this diary entry? Prepared portions will be returned to their batch.',
                              )
                            )
                              await removeFoodEntry(entry.id);
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </AsyncButton>
                    </div>
                  </div>
                  <MacroSummary
                    macros={scaleMacros(entry.snapshot.macros, entry.servings)}
                    compact
                  />
                  <p>{entry.notes}</p>
                  <NutritionNote {...entry.snapshot} />
                </div>
              ))}
            <strong>{slot} total</strong>
            <MacroSummary macros={dailyMacros(food, date, slot)} compact />
          </Card>
        ))}
      </div>
      <Card>
        <SectionTitle
          title="Copy another day’s meals"
          sub="Copies the recorded portions and nutrition snapshots. Prepared portions will be deducted again."
        />
        <div className="food-actions">
          <Field label="Copy meals from">
            <input
              type="date"
              max={foodDay()}
              value={copyFrom}
              onChange={(e) => setCopyFrom(e.target.value)}
            />
          </Field>
          <AsyncButton
            variant="secondary"
            disabled={copyFrom === date}
            onAction={() =>
              run(async () => {
                const entries = food.foodEntries.filter((e) => e.date === copyFrom);
                if (!entries.length) throw Error('No food entries on that day.');
                if (!confirm(`Copy ${entries.length} entries to ${date}?`)) return;
                await db.transaction('rw', db.tables, async () => {
                  for (const entry of entries)
                    await saveFoodEntry({ ...entry, id: uid(), date, createdAt: now() });
                });
              }, 'Meals copied')
            }
          >
            Copy meals to selected day
          </AsyncButton>
        </div>
      </Card>
      <Card>
        <SectionTitle
          title="This week, together"
          sub={`${days[0]} to ${days[6]} · ${sessions} completed workouts · ${days.filter((d) => food.foodEntries.some((e) => e.date === d)).length}/7 days with food logged`}
        />
        <p>
          Daily average across 7 calendar days. Unlogged days contribute zero recorded intake; this
          is a record of your logging, not a measure of food you did not enter.
        </p>
        <MacroSummary macros={average} />
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Weekly recorded nutrition"
        >
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Protein (g)</th>
                <th>Carbohydrates (g)</th>
                <th>Fat (g)</th>
                <th>Food entries</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day, index) => (
                <tr key={day}>
                  <td>
                    <button className="food-title-button" onClick={() => setDate(day)}>
                      {day}
                    </button>
                  </td>
                  <td>{foodNumber(totals[index].protein)}</td>
                  <td>{foodNumber(totals[index].carbs)}</td>
                  <td>{foodNumber(totals[index].fat)}</td>
                  <td>{food.foodEntries.filter((e) => e.date === day).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {editor !== undefined && (
        <FoodEntryEditor
          initial={editor ?? undefined}
          date={date}
          recipeId={query.get('recipe') ?? undefined}
          batchId={query.get('batch') ?? undefined}
          onClose={() => setEditor(undefined)}
        />
      )}{' '}
      {targets && <TargetEditor onClose={() => setTargets(false)} />}
    </>
  );
}
