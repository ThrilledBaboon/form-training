import { Fragment, useMemo, useState } from 'react';
import { Plus, Pencil, Copy, Archive, ArrowLeftRight, Check, Undo2 } from 'lucide-react';
import { useApp, go } from '../lib/context';
import { db, readData } from '../lib/db';
import { uid, now } from '../lib/model';
import { download } from '../lib/backup';
import { foodDay, foodNumber, shiftDay } from '../lib/food-calc';
import {
  FoodProgrammeSchema,
  FoodScheduleSchema,
  RecipeSchema,
  mealSlots,
  mealRoles,
  units,
  type FoodProgramme,
  type FoodSchedule,
  type Recipe,
  type CompositionLine,
  type MealPlan,
  type FoodEntry,
} from '../lib/food-model';
import {
  activeFoodSchedule,
  programmePreview,
  saveFoodProgramme,
  saveComposition,
  startFoodSchedule,
  changeFoodSchedule,
  fillFoodSchedule,
  removeFutureProgrammePlans,
  checkInMeal,
  scheduleEnd,
  mealIngredientIds,
} from '../lib/food-programmes';
import { fillingBowlStarter } from '../lib/food-programme-starter';
import {
  foodProgrammeLibrary,
  parseFoodProgrammeLibrary,
  programmeImportPreview,
  importFoodProgrammeLibrary,
  type FoodProgrammeLibrary,
} from '../lib/food-programme-library';
import { saveMealPlan, removeFoodEntry } from '../lib/food-actions';
import { FoodNav, useFood, useFoodDraft } from '../components/FoodUI';
import { MealRecipeGuide } from '../components/MealRecipeGuide';
import { FoodAvoidances } from '../components/FoodAvoidances';
import { ImportPrompt } from '../components/ImportPrompt';
import { IngredientEditor } from './FoodIngredients';
import { FoodEntryEditor } from './FoodDiary';
import { Button, AsyncButton, Card, PageTitle, Field, Modal, Badge, Empty } from '../components/ui';

const roleNames = {
  protein: 'Protein',
  volume: 'Fruit, vegetables & volume',
  fat: 'Fat choice',
  flavouring: 'Flavourings',
  other: 'Other foods',
};
export function MealComposition({
  recipe,
  headingLevel = 'h3',
}: {
  recipe: Recipe;
  headingLevel?: 'h3' | 'h4' | 'h5';
}) {
  return <MealRecipeGuide recipe={recipe} headingLevel={headingLevel} />;
}

export function ProgrammeMealEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Recipe;
  onClose: () => void;
  onSaved?: (recipe: Recipe) => void;
}) {
  const food = useFood();
  const { run } = useApp();
  const [value, set] = useFoodDraft<Recipe>(
    'bowl',
    initial ?? {
      ...RecipeSchema.parse({
        id: uid(),
        name: 'New bowl',
        servings: 1,
        ingredients: [],
        steps: [],
        composition: [],
        unmeasured: true,
        createdAt: now(),
        updatedAt: now(),
      }),
      name: '',
    },
    !!initial,
  );
  const [ingredientOpen, setIngredientOpen] = useState(false);
  const patch = (p: Partial<Recipe>) => set({ ...value, ...p });
  const lines = value.composition ?? [];
  const change = (i: number, p: Partial<CompositionLine>) =>
    patch({ composition: lines.map((line, j) => (i === j ? { ...line, ...p } : line)) });
  return (
    <>
      <Modal title={initial ? 'Edit bowl or meal' : 'Build a bowl'} onClose={onClose} wide>
        <p className="small-text muted">
          Edits are saved in a local bowl draft. Save bowl adds it to Menu; closing keeps the draft.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!lines.length) throw Error('Add at least one ingredient.');
              const quantified = lines.every((line) => line.quantity !== undefined && line.unit);
              const recipe = RecipeSchema.parse({
                ...value,
                unmeasured: !quantified,
                servings: 1,
                composition: lines,
                ingredients: quantified
                  ? lines.map((line) => ({
                      id: uid(),
                      ingredientId: line.ingredientId,
                      quantity: line.quantity!,
                      unit: line.unit!,
                      state: line.state,
                      optional: false,
                      notes: line.guidance,
                    }))
                  : [],
              });
              await saveComposition(recipe);
              onSaved?.(recipe);
              onClose();
            }, 'Meal saved in Menu');
          }}
        >
          <div className="form-grid">
            <Field label="Meal name">
              <input
                required
                maxLength={200}
                value={value.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </Field>
            <Field label="Meal category">
              <select
                value={value.category}
                onChange={(e) => patch({ category: e.target.value as Recipe['category'] })}
              >
                {mealSlots.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <p>
            Choose your foods. Leave amounts blank for a quick bowl; add every ingredient amount to
            make a quantified recipe. A listed fat choice includes the fat used in cooking or
            dressing.
          </p>
          {mealRoles.map((role) => (
            <fieldset className="food-editor-row" key={role}>
              <legend>{roleNames[role]}</legend>
              {lines.map(
                (line, i) =>
                  line.role === role && (
                    <div className="programme-ingredient" key={i}>
                      <strong>
                        {food.ingredients.find((ing) => ing.id === line.ingredientId)?.name ??
                          line.name}
                      </strong>
                      <div className="form-grid">
                        <Field label={`Amount ${i + 1} (optional)`}>
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={line.quantity ?? ''}
                            onChange={(e) =>
                              change(i, {
                                quantity: e.target.value ? Number(e.target.value) : undefined,
                                unit: e.target.value ? (line.unit ?? 'g') : undefined,
                              })
                            }
                          />
                        </Field>
                        <Field label={`Unit ${i + 1}`}>
                          <select
                            disabled={line.quantity === undefined}
                            value={line.unit ?? 'g'}
                            onChange={(e) =>
                              change(i, { unit: e.target.value as CompositionLine['unit'] })
                            }
                          >
                            {units.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label={`Food state ${i + 1}`}>
                          <select
                            value={line.state}
                            onChange={(e) =>
                              change(i, { state: e.target.value as CompositionLine['state'] })
                            }
                          >
                            {['raw', 'cooked', 'as sold'].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <Field label={`Portion guidance ${i + 1}`}>
                        <input
                          maxLength={500}
                          value={line.guidance}
                          onChange={(e) => change(i, { guidance: e.target.value })}
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={`Remove ingredient ${i + 1}`}
                        onClick={() => patch({ composition: lines.filter((_, j) => i !== j) })}
                      >
                        Remove ingredient
                      </Button>
                    </div>
                  ),
              )}
              <Field label={`Add ${roleNames[role].toLowerCase()}`}>
                <select
                  value=""
                  onChange={(e) => {
                    const ingredient = food.ingredients.find((i) => i.id === e.target.value);
                    if (ingredient)
                      patch({
                        composition: [
                          ...lines,
                          {
                            ingredientId: ingredient.id,
                            role,
                            state: ingredient.state,
                            guidance: '',
                          },
                        ],
                      });
                  }}
                >
                  <option value="">Choose ingredient</option>
                  {food.ingredients
                    .filter((i) => !i.archived)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                        {i.brand ? ' · ' + i.brand : ''}
                      </option>
                    ))}
                </select>
              </Field>
            </fieldset>
          ))}
          <Button type="button" variant="secondary" onClick={() => setIngredientOpen(true)}>
            Add a new ingredient
          </Button>
          <Field label="Meal description">
            <textarea
              value={value.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Field>
          <Field label="Preparation notes">
            <textarea
              value={value.steps.map((s) => s.text).join('\n\n')}
              onChange={(e) => patch({ steps: [{ id: 'method', text: e.target.value }] })}
            />
          </Field>
          <Field label="Meal source URL (optional)">
            <input
              type="url"
              value={value.sourceUrl ?? ''}
              onChange={(e) => patch({ sourceUrl: e.target.value || undefined })}
            />
          </Field>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save bowl</Button>
          </div>
        </form>
      </Modal>
      {ingredientOpen && <IngredientEditor onClose={() => setIngredientOpen(false)} />}
    </>
  );
}

function ProgrammeEditor({ initial, onClose }: { initial?: FoodProgramme; onClose: () => void }) {
  const food = useFood();
  const { run } = useApp();
  const [value, set] = useFoodDraft<FoodProgramme>(
    'food-programme',
    initial ?? {
      ...FoodProgrammeSchema.parse({
        id: uid(),
        name: 'New programme',
        createdAt: now(),
        updatedAt: now(),
      }),
      name: '',
    },
    !!initial,
  );
  const [mealOpen, setMealOpen] = useState(false);
  const patch = (p: Partial<FoodProgramme>) => set({ ...value, ...p });
  const recipes = food.recipes.filter((r) => !r.archived && !r.draft);
  const setRow = (day: number, slot: Recipe['category'], ids: string[]) =>
    patch({
      rotation: [
        ...value.rotation.filter((r) => r.day !== day || r.slot !== slot),
        ...(ids.length ? [{ day, slot, recipeIds: ids }] : []),
      ],
    });
  return (
    <>
      <Modal
        title={initial ? 'Edit food programme' : 'Create food programme'}
        onClose={onClose}
        wide
      >
        <p className="small-text muted">
          Edits are saved in a local programme draft. Closing keeps it; Save programme updates the
          library.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!value.rotation.length) throw Error('Choose at least one meal in the rotation.');
              await saveFoodProgramme(value);
              onClose();
            }, 'Programme saved; active schedules keep their snapshot');
          }}
        >
          <Field label="Programme name">
            <input
              required
              maxLength={200}
              value={value.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
          <Field label="Programme description">
            <textarea
              rows={4}
              value={value.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Field>
          <div className="form-grid">
            <Field label="Default duration (days)">
              <input
                required
                type="number"
                min={1}
                max={366}
                value={value.days}
                onChange={(e) => patch({ days: Number(e.target.value) })}
              />
            </Field>
            <Field label="Repeat cycle (days)">
              <input
                required
                type="number"
                min={1}
                max={28}
                value={value.cycleDays}
                onChange={(e) => {
                  const days = Number(e.target.value);
                  patch({ cycleDays: days, rotation: value.rotation.filter((r) => r.day < days) });
                }}
              />
            </Field>
          </div>
          <Field label="Source or inspiration">
            <input
              maxLength={200}
              value={value.sourceName}
              onChange={(e) => patch({ sourceName: e.target.value })}
            />
          </Field>
          <Field label="Programme source URL (optional)">
            <input
              type="url"
              value={value.sourceUrl}
              onChange={(e) => patch({ sourceUrl: e.target.value })}
            />
          </Field>
          <details>
            <summary>Food groups & portion guidance</summary>
            <p>
              These guide meal choices. They do not certify allergy suitability or prevent you from
              recording what you ate.
            </p>
            {value.groups.map((group, index) => (
              <fieldset key={group.id} className="food-editor-row">
                <legend>{group.name || 'Food group'}</legend>
                <Field label={`Group name ${index + 1}`}>
                  <input
                    required
                    value={group.name}
                    onChange={(e) =>
                      patch({
                        groups: value.groups.map((g, i) =>
                          i === index ? { ...g, name: e.target.value } : g,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label={`Group role ${index + 1}`}>
                  <select
                    value={group.role}
                    onChange={(e) =>
                      patch({
                        groups: value.groups.map((g, i) =>
                          i === index ? { ...g, role: e.target.value as typeof g.role } : g,
                        ),
                      })
                    }
                  >
                    {mealRoles.map((r) => (
                      <option key={r} value={r}>
                        {roleNames[r]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={`Group guidance ${index + 1}`}>
                  <textarea
                    value={group.guidance}
                    onChange={(e) =>
                      patch({
                        groups: value.groups.map((g, i) =>
                          i === index ? { ...g, guidance: e.target.value } : g,
                        ),
                      })
                    }
                  />
                </Field>
                {group.ingredientIds.map((id) => (
                  <div className="programme-choice" key={id}>
                    <span>
                      {food.ingredients.find((i) => i.id === id)?.name ?? 'Unavailable ingredient'}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Remove ${food.ingredients.find((i) => i.id === id)?.name} from ${group.name}`}
                      onClick={() =>
                        patch({
                          groups: value.groups.map((g, i) =>
                            i === index
                              ? { ...g, ingredientIds: g.ingredientIds.filter((x) => x !== id) }
                              : g,
                          ),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Field label={`Add food to group ${index + 1}`}>
                  <select
                    value=""
                    onChange={(e) =>
                      patch({
                        groups: value.groups.map((g, i) =>
                          i === index
                            ? {
                                ...g,
                                ingredientIds: [...new Set([...g.ingredientIds, e.target.value])],
                              }
                            : g,
                        ),
                      })
                    }
                  >
                    <option value="">Choose food</option>
                    {food.ingredients
                      .filter((i) => !i.archived && !group.ingredientIds.includes(i.id))
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => patch({ groups: value.groups.filter((_, i) => i !== index) })}
                >
                  Remove group
                </Button>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                patch({
                  groups: [
                    ...value.groups,
                    {
                      id: uid(),
                      name: 'Food choices',
                      role: 'other',
                      ingredientIds: [],
                      guidance: '',
                    },
                  ],
                })
              }
            >
              Add food group
            </Button>
          </details>
          <details>
            <summary>Optional habits</summary>
            {value.habits.map((habit, i) => (
              <fieldset className="food-editor-row" key={habit.id}>
                <legend>Habit {i + 1}</legend>
                <Field label={`Habit name ${i + 1}`}>
                  <input
                    required
                    value={habit.name}
                    onChange={(e) =>
                      patch({
                        habits: value.habits.map((h, j) =>
                          i === j ? { ...h, name: e.target.value } : h,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label={`Habit notes ${i + 1}`}>
                  <textarea
                    value={habit.notes}
                    onChange={(e) =>
                      patch({
                        habits: value.habits.map((h, j) =>
                          i === j ? { ...h, notes: e.target.value } : h,
                        ),
                      })
                    }
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => patch({ habits: value.habits.filter((_, j) => i !== j) })}
                >
                  Remove habit
                </Button>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                patch({
                  habits: [...value.habits, { id: uid(), name: 'Optional habit', notes: '' }],
                })
              }
            >
              Add optional habit
            </Button>
          </details>
          <h3>Meal rotation</h3>
          <p>
            Choose a default meal for each included slot. Leave unwanted slots empty. Expand a slot
            to choose additional swaps. New bowls save in Menu and can be selected here.
          </p>
          <Button type="button" variant="secondary" onClick={() => setMealOpen(true)}>
            Build a bowl
          </Button>
          {Array.from({ length: Math.min(28, Math.max(1, value.cycleDays || 1)) }, (_, day) => (
            <details key={day} open={day === 0}>
              <summary>Day {day + 1}</summary>
              {mealSlots.map((slot) => {
                const ids =
                  value.rotation.find((r) => r.day === day && r.slot === slot)?.recipeIds ?? [];
                return (
                  <div className="programme-rotation-slot" key={slot}>
                    <Field label={`Day ${day + 1} ${slot}`}>
                      <select
                        value={ids[0] ?? ''}
                        onChange={(e) =>
                          setRow(
                            day,
                            slot,
                            e.target.value
                              ? [e.target.value, ...ids.filter((id) => id !== e.target.value)]
                              : [],
                          )
                        }
                      >
                        <option value="">No planned meal</option>
                        {recipes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {ids.length > 0 && (
                      <details>
                        <summary>Alternative meals ({Math.max(0, ids.length - 1)})</summary>
                        {recipes
                          .filter((r) => r.id !== ids[0])
                          .map((r) => (
                            <label className="check-label" key={r.id}>
                              <input
                                type="checkbox"
                                checked={ids.includes(r.id)}
                                onChange={(e) =>
                                  setRow(
                                    day,
                                    slot,
                                    e.target.checked
                                      ? [...ids, r.id]
                                      : ids.filter((id) => id !== r.id),
                                  )
                                }
                              />
                              {r.name}
                            </label>
                          ))}
                      </details>
                    )}
                  </div>
                );
              })}
            </details>
          ))}
          <p className="small-text muted">
            Saving this definition does not rewrite active schedules or meal history. Start a new
            schedule to use an edited definition.
          </p>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save programme</Button>
          </div>
        </form>
      </Modal>
      {mealOpen && <ProgrammeMealEditor onClose={() => setMealOpen(false)} />}
    </>
  );
}

function ActivateProgramme({
  programme,
  onClose,
}: {
  programme: FoodProgramme;
  onClose: () => void;
}) {
  const food = useFood();
  const { run } = useApp();
  const [value, set] = useState<FoodSchedule>(() =>
    FoodScheduleSchema.parse({
      id: uid(),
      programmeId: programme.id,
      snapshot: programme,
      start: foodDay(),
      days: programme.days,
      slots: [...new Set(programme.rotation.map((r) => r.slot))],
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
    }),
  );
  const patch = (p: Partial<FoodSchedule>) => set((v) => ({ ...v, ...p }));
  const valid = FoodScheduleSchema.safeParse(value);
  const preview = useMemo(
    () => (valid.success ? programmePreview(food, valid.data) : []),
    [food, value],
  );
  return (
    <Modal title="Start food programme" onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await startFoodSchedule(value);
            onClose();
          }, 'Programme started; existing plans preserved');
        }}
      >
        <h3>{programme.name}</h3>
        <div className="form-grid">
          <Field label="Programme start date">
            <input
              required
              type="date"
              value={value.start}
              onChange={(e) => patch({ start: e.target.value })}
            />
          </Field>
          <Field label="Programme duration (days)">
            <input
              required
              type="number"
              min={1}
              max={366}
              value={value.days}
              onChange={(e) => patch({ days: Number(e.target.value) })}
            />
          </Field>
        </div>
        <fieldset className="food-editor-row">
          <legend>Included meals</legend>
          {mealSlots.map((slot) => (
            <label className="check-label" key={slot}>
              <input
                type="checkbox"
                checked={value.slots.includes(slot)}
                onChange={(e) =>
                  patch({
                    slots: e.target.checked
                      ? [...value.slots, slot]
                      : value.slots.filter((s) => s !== slot),
                  })
                }
              />
              {slot}
            </label>
          ))}
        </fieldset>
        {programme.habits.length > 0 && (
          <fieldset className="food-editor-row">
            <legend>Optional reminders</legend>
            {programme.habits.map((habit) => (
              <label className="check-label" key={habit.id}>
                <input
                  type="checkbox"
                  checked={value.habits.includes(habit.id)}
                  onChange={(e) =>
                    patch({
                      habits: e.target.checked
                        ? [...value.habits, habit.id]
                        : value.habits.filter((id) => id !== habit.id),
                    })
                  }
                />
                <span>
                  {habit.name}
                  <small>{habit.notes}</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <details>
          <summary>Foods I avoid</summary>
          <p>
            Choose foods you dislike or avoid. Meals containing those recorded ingredients are
            omitted. Always check ingredients yourself for allergies or intolerances.
          </p>
          {food.ingredients
            .filter((i) => !i.archived)
            .map((ingredient) => (
              <label className="check-label" key={ingredient.id}>
                <input
                  type="checkbox"
                  checked={value.exclusions.includes(ingredient.id)}
                  onChange={(e) =>
                    patch({
                      exclusions: e.target.checked
                        ? [...value.exclusions, ingredient.id]
                        : value.exclusions.filter((id) => id !== ingredient.id),
                    })
                  }
                />
                {ingredient.name}
              </label>
            ))}
        </details>
        <p role="status">
          {preview.length} eligible meals · {preview.filter((r) => r.conflict).length} occupied
          slots kept · {preview.filter((r) => !r.conflict && !r.existing).length} new plans
        </p>
        <p>
          Existing plans are kept. Only empty slots are filled. Activation does not log food eaten,
          change nutrition goals, enable calories or consume stock. Exclusions may leave slots
          empty.
        </p>
        <details>
          <summary>Preview dated meals</summary>
          <div className="programme-preview">
            {preview.map((row) => (
              <p key={row.plan.id}>
                {row.plan.date} · {row.plan.slot} ·{' '}
                {food.recipes.find((r) => r.id === row.plan.recipeId)?.name}
                {row.conflict ? ' — existing plan kept' : ''}
              </p>
            ))}
          </div>
        </details>
        {!valid.success && (
          <p role="alert">Choose a valid start date, duration and at least one meal slot.</p>
        )}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid.success || !preview.length}>
            Start programme & fill empty slots
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ProgrammeCheckIn({
  plan,
  entry,
  onClose,
}: {
  plan: MealPlan;
  entry?: FoodEntry;
  onClose: () => void;
}) {
  const food = useFood();
  const { run } = useApp();
  const [recipeId, setRecipeId] = useState(entry?.recipeId ?? plan.recipeId);
  const [date, setDate] = useState(entry?.date ?? plan.date);
  const [slot, setSlot] = useState(entry?.slot ?? plan.slot);
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [measured, setMeasured] = useState(entry ? !entry.unmeasured : false);
  const [servings, setServings] = useState(entry?.servings ?? 1);
  const recipe = food.recipes.find((r) => r.id === recipeId);
  return (
    <Modal title={entry ? 'Edit meal check-in' : 'Record meal eaten'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await checkInMeal(plan, {
              recipeId,
              date,
              slot,
              notes,
              measured,
              servings,
              entryId: entry?.id,
            });
            onClose();
          }, 'Meal recorded in your food diary');
        }}
      >
        <Field label="Meal actually eaten">
          <select
            value={recipeId}
            onChange={(e) => {
              setRecipeId(e.target.value);
              setMeasured(false);
            }}
          >
            {food.recipes
              .filter((r) => !r.archived || r.id === recipeId)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Check-in date">
            <input
              required
              type="date"
              max={foodDay()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Check-in meal">
            <select value={slot} onChange={(e) => setSlot(e.target.value as typeof slot)}>
              {mealSlots.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        {!recipe?.unmeasured && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={measured}
              onChange={(e) => setMeasured(e.target.checked)}
            />
            I confirm the recipe and portion eaten
          </label>
        )}
        {measured ? (
          <Field label="Actual servings eaten">
            <input
              required
              type="number"
              min={0.01}
              step="any"
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
            />
          </Field>
        ) : (
          <p className="small-text muted">
            Quick check-in: amounts and nutrition stay unknown. No stock is deducted.
          </p>
        )}
        <Field label="Check-in notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Changes, hunger or satisfaction (optional)"
          />
        </Field>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save check-in</Button>
        </div>
      </form>
    </Modal>
  );
}

function SwapProgrammeMeal({ plan, onClose }: { plan: MealPlan; onClose: () => void }) {
  const food = useFood();
  const { run } = useApp();
  const schedule = food.foodSchedules.find((s) => s.id === plan.scheduleId);
  const options = new Set(
    schedule?.snapshot.rotation.filter((r) => r.slot === plan.slot).flatMap((r) => r.recipeIds) ??
      [],
  );
  const [all, setAll] = useState(false);
  const [id, setId] = useState(plan.recipeId);
  const recipes = food.recipes.filter(
    (r) =>
      !r.archived &&
      !r.draft &&
      (all || !schedule || options.has(r.id)) &&
      !mealIngredientIds(r).some((id) => schedule?.exclusions.includes(id)),
  );
  return (
    <Modal title="Swap planned meal" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await saveMealPlan({ ...plan, recipeId: id, batchId: undefined, servings: 1 });
            onClose();
          }, 'Meal swapped; other days kept');
        }}
      >
        <label className="check-label">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          Show all saved meals
        </label>
        <Field label="Swap meal">
          <select required value={id} onChange={(e) => setId(e.target.value)}>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        {all && (
          <p className="small-text muted">
            Choices outside the programme have not been checked against its food guidance.
          </p>
        )}
        {!recipes.length && <p>No meals match. Build a bowl or review your exclusions.</p>}
        <p className="small-text muted">
          A swap changes this planned meal, not your diary or the original programme.
        </p>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!recipes.some((r) => r.id === id)}>
            Save swap
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ProgrammeDay({
  date = foodDay(),
  compact = false,
  includeAllPlans = false,
  showEmptySlots = false,
  onPlanSlot,
}: {
  date?: string;
  compact?: boolean;
  includeAllPlans?: boolean;
  showEmptySlots?: boolean;
  onPlanSlot?: (slot: MealPlan['slot']) => void;
}) {
  const food = useFood();
  const { run } = useApp();
  const [swap, setSwap] = useState<MealPlan>();
  const [check, setCheck] = useState<{ plan: MealPlan; entry?: FoodEntry }>();
  const [diary, setDiary] = useState<{ plan?: MealPlan; entry?: FoodEntry }>();
  const schedule = activeFoodSchedule(food, date);
  const plans = food.mealPlans
    .filter((p) => p.date === date && (includeAllPlans || p.scheduleId))
    .sort((a, b) => mealSlots.indexOf(a.slot) - mealSlots.indexOf(b.slot));
  const otherEntries = includeAllPlans
    ? food.foodEntries.filter(
        (entry) =>
          entry.date === date &&
          !plans.some((plan) => entry.occurrenceId === (plan.occurrenceId ?? plan.id)),
      )
    : [];
  if (!schedule && !plans.length && !showEmptySlots)
    return (
      <div className="programme-day">
        <p className="muted">No programme planned for {date}.</p>
        <Button variant="secondary" onClick={() => go('food-programmes')}>
          Choose a food programme
        </Button>
      </div>
    );
  return (
    <div className={'programme-day ' + (compact ? 'compact' : '')}>
      {schedule ? (
        <p className="small-text muted">
          {schedule.snapshot.name} · {date}
        </p>
      ) : showEmptySlots && !plans.length && !otherEntries.length ? (
        <p>
          Choose a programme to fill your meals, or plan them individually.{' '}
          <a href="#/food-programmes">Choose a food programme</a>
        </p>
      ) : (
        <p className="small-text muted">
          {includeAllPlans ? 'Your meals' : 'Planned programme meals'} · {date}
        </p>
      )}
      {!plans.length && schedule && (
        <AsyncButton
          variant="secondary"
          onAction={() => run(() => fillFoodSchedule(schedule.id, date), 'Empty slots filled')}
        >
          Plan this week
        </AsyncButton>
      )}
      {mealSlots.map((slot) => {
        const slotPlans = plans.filter((plan) => plan.slot === slot);
        const slotEntries = otherEntries.filter((entry) => entry.slot === slot);
        return (
          <Fragment key={slot}>
            {showEmptySlots && slot !== 'Snacks' && !slotPlans.length && !slotEntries.length && (
              <div className="programme-meal-row programme-empty-meal">
                <h3>{slot}</h3>
                <p className="small-text muted">No meal planned.</p>
                <Button
                  variant="secondary"
                  onClick={() => (onPlanSlot ? onPlanSlot(slot) : go('food-planner?date=' + date))}
                >
                  Plan {slot.toLowerCase()}
                </Button>
              </div>
            )}
            {slotPlans.map((plan) => {
              const recipe = food.recipes.find((r) => r.id === plan.recipeId);
              const entry = food.foodEntries.find(
                (e) => e.occurrenceId === (plan.occurrenceId ?? plan.id),
              );
              return (
                <div className="programme-meal-row" key={plan.id}>
                  <div>
                    <span className="eyebrow">{plan.slot}</span>
                    <h3>{entry?.name ?? recipe?.name ?? 'Meal unavailable'}</h3>
                    <span className="small-text muted">
                      {entry
                        ? entry.unmeasured
                          ? 'Checked in · unmeasured'
                          : 'Checked in · recorded portion'
                        : 'Planned'}
                    </span>
                  </div>
                  <div className="programme-meal-actions">
                    <Button
                      variant="secondary"
                      disabled={!recipe}
                      onClick={() =>
                        plan.batchId || entry?.batchId
                          ? setDiary({ plan, entry })
                          : setCheck({ plan, entry })
                      }
                    >
                      {entry ? (
                        <>
                          <Check size={14} />
                          Edit check-in
                        </>
                      ) : (
                        'Ate this'
                      )}
                    </Button>
                    {!entry && (
                      <Button
                        variant="ghost"
                        aria-label={`Swap ${recipe?.name}`}
                        onClick={() => setSwap(plan)}
                      >
                        <ArrowLeftRight size={14} />
                        Swap
                      </Button>
                    )}
                    {entry && (
                      <AsyncButton
                        variant="ghost"
                        aria-label={`Undo ${entry.name}`}
                        onAction={() => run(() => removeFoodEntry(entry.id), 'Check-in removed')}
                      >
                        <Undo2 size={14} />
                        Undo
                      </AsyncButton>
                    )}
                  </div>
                  {recipe && (
                    <details>
                      <summary>View meal</summary>
                      <MealComposition
                        headingLevel="h4"
                        recipe={
                          entry?.composition
                            ? {
                                ...recipe,
                                name: entry.name,
                                composition: entry.composition,
                                unmeasured: entry.unmeasured,
                              }
                            : recipe
                        }
                      />
                    </details>
                  )}
                </div>
              );
            })}
            {slotEntries.map((entry) => {
              const recipe = food.recipes.find((recipe) => recipe.id === entry.recipeId);
              return (
                <div className="programme-meal-row diary-meal-row" key={entry.id}>
                  <span className="eyebrow">{slot}</span>
                  <h3>{entry.name}</h3>
                  <span className="small-text muted">Recorded in your food diary</span>
                  <div className="programme-meal-actions">
                    <Button variant="secondary" onClick={() => setDiary({ entry })}>
                      Edit diary entry
                    </Button>
                  </div>
                  {recipe && (
                    <details>
                      <summary>View meal</summary>
                      <MealComposition
                        headingLevel="h4"
                        recipe={{
                          ...recipe,
                          name: entry.name,
                          composition: entry.composition ?? recipe.composition,
                          unmeasured: entry.unmeasured,
                        }}
                      />
                    </details>
                  )}
                  {entry.notes && <p className="small-text muted">{entry.notes}</p>}
                </div>
              );
            })}
          </Fragment>
        );
      })}
      {schedule && schedule.habits.length > 0 && (
        <details>
          <summary>Optional reminders</summary>
          {schedule.snapshot.habits
            .filter((h) => schedule.habits.includes(h.id))
            .map((h) => (
              <p key={h.id}>
                <strong>{h.name}</strong> · {h.notes}
              </p>
            ))}
        </details>
      )}
      {compact && (
        <a className="small-text" href="#/food-programmes">
          Open programme
        </a>
      )}
      {swap && <SwapProgrammeMeal plan={swap} onClose={() => setSwap(undefined)} />}
      {check && <ProgrammeCheckIn {...check} onClose={() => setCheck(undefined)} />}
      {diary && (
        <FoodEntryEditor
          date={date}
          initial={diary.entry}
          recipeId={diary.entry ? undefined : diary.plan?.recipeId}
          batchId={diary.entry ? undefined : diary.plan?.batchId}
          occurrenceId={diary.plan?.occurrenceId ?? diary.plan?.id}
          defaultSlot={diary.plan?.slot}
          defaultServings={diary.plan?.servings}
          onClose={() => setDiary(undefined)}
        />
      )}
    </div>
  );
}

export function FoodProgrammes({ onShowHelp }: { onShowHelp?: () => void }) {
  const food = useFood();
  const { run } = useApp();
  const [editor, setEditor] = useState<FoodProgramme | null>();
  const [meal, setMeal] = useState(false);
  const [activate, setActivate] = useState<FoodProgramme>();
  const [detail, setDetail] = useState<FoodProgramme>();
  const [incoming, setIncoming] = useState<FoodProgrammeLibrary>();
  const [error, setError] = useState('');
  const [date, setDate] = useState(foodDay());
  const [showArchived, setShowArchived] = useState(false);
  const [avoiding, setAvoiding] = useState<string>();
  const starter = fillingBowlStarter();
  const installed = food.foodProgrammes.some((p) => p.id === starter.programmes[0].id);
  const preview = incoming ? programmeImportPreview(food, incoming) : [];
  const share = (programme: FoodProgramme) =>
    run(async () => {
      const complete = (await readData()).food!;
      download(
        JSON.stringify(foodProgrammeLibrary(complete, [programme.id]), null, 2),
        'form-food-programme.json',
      );
    });
  return (
    <>
      <FoodNav />
      <PageTitle
        eyebrow="YOUR EATING PATTERN"
        title="Manage programmes"
        description="Choose, start, edit or share your eating pattern. Your daily meals are on Today."
        action={
          <div className="inline-actions">
            {onShowHelp && (
              <Button variant="secondary" onClick={onShowHelp}>
                Show me how
              </Button>
            )}
            <Button onClick={() => setEditor(null)}>
              <Plus size={16} />
              Create programme
            </Button>
          </div>
        }
      />
      <div className="food-actions">
        <Button variant="secondary" onClick={() => setMeal(true)}>
          Build a bowl
        </Button>
        <label className="button secondary">
          Import programme
          <input
            className="sr-only"
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setError('');
              try {
                if (file.size > 20 * 1024 * 1024)
                  throw Error('Programme files must be at most 20 MB.');
                setIncoming(parseFoodProgrammeLibrary(await file.text()));
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not read programme file.');
              }
              e.target.value = '';
            }}
          />
        </label>
        <ImportPrompt kind="food-programmes" />
        <Button variant="ghost" onClick={() => go('food-planner')}>
          Meal planner
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      <details className="food-programme-day-preview">
        <summary>Preview programme day</summary>
        <h2>Programme meals</h2>
        <Field label="Programme day">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || foodDay())} />
        </Field>
        <ProgrammeDay date={date} />
      </details>
      {!installed && (
        <Card>
          <h2>Filling bowls — 30 days</h2>
          <p>
            An optional seven-day rotation of protein, fruit/vegetables, volume foods and a fat
            choice. Repeat, swap or edit your own version. Product nutrition and unmeasured amounts
            stay unknown.
          </p>
          <p className="small-text muted">
            Adding the starter creates reusable ingredients and meals only. It does not activate a
            diet, log meals or change your settings.
          </p>
          <Button variant="secondary" onClick={() => setIncoming(starter)}>
            Review starter programme
          </Button>
        </Card>
      )}
      {food.foodSchedules.length > 0 && (
        <details>
          <summary>My schedules ({food.foodSchedules.length})</summary>
          <h2>Programme schedules</h2>
          {food.foodSchedules.map((s) => (
            <Card key={s.id}>
              <h3>{s.snapshot.name}</h3>
              <p>
                {s.start} to {scheduleEnd(s)} · {s.status}
                {scheduleEnd(s) < foodDay() ? ' · date window ended' : ''}
              </p>
              <p className="small-text muted">
                Pausing stops reminders and new generation. Existing plans stay; resuming follows
                the original calendar cycle.
              </p>
              <div className="food-actions">
                {s.status !== 'completed' && (
                  <Button variant="secondary" onClick={() => setAvoiding(s.id)}>
                    Foods I avoid
                  </Button>
                )}
                <AsyncButton
                  variant="secondary"
                  onAction={() =>
                    run(
                      () =>
                        changeFoodSchedule(s.id, {
                          status: s.status === 'active' ? 'paused' : 'active',
                        }),
                      'Schedule updated',
                    )
                  }
                >
                  {s.status === 'active' ? 'Pause programme' : 'Resume programme'}
                </AsyncButton>
                <AsyncButton
                  variant="ghost"
                  disabled={s.status !== 'active'}
                  onAction={() =>
                    run(() => fillFoodSchedule(s.id, date), 'Empty slots filled; swaps kept')
                  }
                >
                  Plan this week
                </AsyncButton>
                <AsyncButton
                  variant="ghost"
                  onAction={() =>
                    run(
                      () => changeFoodSchedule(s.id, { status: 'completed' }),
                      'Programme ended; history kept',
                    )
                  }
                >
                  End programme
                </AsyncButton>
                <AsyncButton
                  variant="ghost"
                  onAction={() =>
                    run(async () => {
                      if (
                        confirm(
                          'Remove this programme’s unchecked plans from today onwards? Recorded meals and other plans are kept.',
                        )
                      )
                        await removeFutureProgrammePlans(s.id);
                    }, 'Future plan update saved')
                  }
                >
                  Remove future plans
                </AsyncButton>
              </div>
              <Field label={'Duration for ' + s.snapshot.name}>
                <input
                  type="number"
                  min={1}
                  max={366}
                  defaultValue={s.days}
                  key={s.id + s.days}
                  onBlur={(e) => {
                    const days = Number(e.target.value);
                    if (days !== s.days)
                      void run(
                        () => changeFoodSchedule(s.id, { days }),
                        'Duration changed; use Plan this week to fill additional dates. Existing plans stay.',
                      );
                  }}
                />
              </Field>
            </Card>
          ))}
        </details>
      )}
      <label className="check-label">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived programmes
      </label>
      {avoiding && <FoodAvoidances scheduleId={avoiding} onClose={() => setAvoiding(undefined)} />}
      <div className="food-grid">
        {food.foodProgrammes
          .filter((p) => showArchived || !p.archived)
          .map((p) => (
            <Card key={p.id}>
              <h2>{p.name}</h2>
              {p.archived && <Badge>Archived</Badge>}
              <p>{p.description}</p>
              <p className="small-text muted">
                {p.cycleDays}-day rotation · {p.days} days by default ·{' '}
                {new Set(p.rotation.flatMap((r) => r.recipeIds)).size} meal options
              </p>
              <div className="food-actions">
                <Button disabled={p.archived || !p.rotation.length} onClick={() => setActivate(p)}>
                  Start programme
                </Button>
                <Button variant="secondary" onClick={() => setDetail(p)}>
                  View programme
                </Button>
                <Button
                  variant="ghost"
                  aria-label={'Edit programme ' + p.name}
                  onClick={() => setEditor(p)}
                >
                  <Pencil size={16} />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setEditor({
                      ...structuredClone(p),
                      id: uid(),
                      name: p.name + ' (my version)',
                      archived: false,
                      createdAt: now(),
                      updatedAt: now(),
                    })
                  }
                >
                  <Copy size={16} />
                  Edit my version
                </Button>
                <AsyncButton variant="ghost" onAction={() => share(p)}>
                  Share programme
                </AsyncButton>
                <AsyncButton
                  variant="ghost"
                  aria-label={(p.archived ? 'Restore ' : 'Archive ') + p.name}
                  onAction={() =>
                    run(
                      () => saveFoodProgramme({ ...p, archived: !p.archived }),
                      'Programme library updated; history kept',
                    )
                  }
                >
                  <Archive size={16} />
                  {p.archived ? 'Restore' : 'Archive'}
                </AsyncButton>
              </div>
            </Card>
          ))}
      </div>
      {!food.foodProgrammes.length && installed && (
        <Empty title="No food programmes">Create or import a programme to begin.</Empty>
      )}
      {editor !== undefined && (
        <ProgrammeEditor initial={editor ?? undefined} onClose={() => setEditor(undefined)} />
      )}
      {meal && <ProgrammeMealEditor onClose={() => setMeal(false)} />}
      {activate && (
        <ActivateProgramme programme={activate} onClose={() => setActivate(undefined)} />
      )}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(undefined)} wide>
          <p>{detail.description}</p>
          <p className="small-text muted">{detail.sourceName}</p>
          {detail.sourceUrl && (
            <a href={detail.sourceUrl} target="_blank" rel="noreferrer">
              Source
            </a>
          )}
          {detail.groups.map((g) => (
            <details key={g.id}>
              <summary>{g.name}</summary>
              <p>{g.guidance}</p>
              <p>
                {g.ingredientIds
                  .map((id) => food.ingredients.find((i) => i.id === id)?.name)
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </details>
          ))}
          {Array.from({ length: detail.cycleDays }, (_, day) => (
            <section key={day}>
              <h3>Day {day + 1}</h3>
              {detail.rotation
                .filter((r) => r.day === day)
                .map((r) => (
                  <details key={r.slot}>
                    <summary>
                      {r.slot} ·{' '}
                      {food.recipes.find((m) => m.id === r.recipeIds[0])?.name ??
                        'Meal unavailable'}
                    </summary>
                    {r.recipeIds.map((id, i) => {
                      const recipe = food.recipes.find((m) => m.id === id);
                      return (
                        recipe && (
                          <div key={id}>
                            <h4>
                              {i ? 'Swap: ' : ''}
                              {recipe.name}
                            </h4>
                            <MealComposition recipe={recipe} headingLevel="h5" />
                          </div>
                        )
                      );
                    })}
                  </details>
                ))}
            </section>
          ))}
        </Modal>
      )}
      {incoming && (
        <Modal title="Review programme import" onClose={() => setIncoming(undefined)} wide>
          <h3>{incoming.title}</h3>
          <p>
            Reusable programme content only. No personal schedule, diary, stock or settings will be
            imported.
          </p>
          <ul>
            {preview.map((r) => (
              <li key={r.table}>
                {r.table}: {r.added} new · {r.duplicates} reused · {r.conflicts} conflicting
              </li>
            ))}
          </ul>
          <p>
            {incoming.recipes.filter((r) => r.unmeasured).length} unmeasured meals. Review portions
            and product nutrition before relying on estimates.
          </p>
          {incoming.programmes.map((p) => (
            <div key={p.id}>
              <h4>{p.name}</h4>
              <p>{p.description}</p>
              <p>{p.sourceName}</p>
            </div>
          ))}
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setIncoming(undefined)}>
              Cancel
            </Button>
            <AsyncButton
              disabled={preview.some((p) => p.conflicts)}
              onAction={() =>
                run(async () => {
                  await importFoodProgrammeLibrary(incoming);
                  setIncoming(undefined);
                }, 'Programme library imported; nothing activated')
              }
            >
              Import programme
            </AsyncButton>
            {preview.some((p) => p.conflicts) && (
              <AsyncButton
                variant="secondary"
                onAction={() =>
                  run(async () => {
                    await importFoodProgrammeLibrary(incoming, true);
                    setIncoming(undefined);
                  }, 'Separate programme copy imported; existing records kept')
                }
              >
                Import a separate copy
              </AsyncButton>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
