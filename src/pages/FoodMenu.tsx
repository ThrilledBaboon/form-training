import { useRef, useState } from 'react';
import {
  Plus,
  Star,
  Utensils,
  Clock3,
  Pencil,
  Copy,
  Archive,
  ArrowUp,
  ArrowDown,
  Trash2,
  Camera,
} from 'lucide-react';
import { useApp, go } from '../lib/context';
import { uid, now } from '../lib/model';
import {
  RecipeSchema,
  mealSlots,
  type Recipe,
  type RecipeLine,
  type Ingredient,
} from '../lib/food-model';
import {
  saveRecipe,
  saveRecipePhoto,
  imageFile,
  saveShoppingList,
  regenerateShopping,
} from '../lib/food-actions';
import {
  recipeNutrition,
  lineNutrition,
  recipeAvailability,
  foodNumber,
  money,
  foodDay,
  shiftDay,
  usableStock,
} from '../lib/food-calc';
import {
  FoodNav,
  useFood,
  MacroSummary,
  FoodImage,
  ImageInput,
  IngredientSelect,
  UnitSelect,
  NutritionNote,
  useFoodDraft,
  CookModal,
  FoodEmpty,
} from '../components/FoodUI';
import { IngredientEditor } from './FoodIngredients';
import {
  Card,
  PageTitle,
  SectionTitle,
  Button,
  AsyncButton,
  Field,
  Modal,
  Badge,
} from '../components/ui';

export function newRecipe(): Recipe {
  return RecipeSchema.parse({
    id: uid(),
    name: 'New recipe',
    servings: 1,
    ingredients: [],
    steps: [],
    createdAt: now(),
    updatedAt: now(),
  });
}
function move<T>(items: T[], index: number, delta: number) {
  const copy = [...items];
  const other = index + delta;
  if (other < 0 || other >= items.length) return copy;
  [copy[index], copy[other]] = [copy[other], copy[index]];
  return copy;
}
function RecipePhotoUpload({ recipe }: { recipe: Recipe }) {
  const { run } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={input}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label={'Upload photo for ' + recipe.name}
        disabled={busy}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (!file || lock.current) return;
          lock.current = true;
          setBusy(true);
          void run(async () => {
            const photo = await imageFile(file);
            await saveRecipePhoto(recipe.id, photo);
          }, 'Recipe photo saved').finally(() => {
            lock.current = false;
            setBusy(false);
          });
        }}
      />
      <Button
        variant="secondary"
        disabled={busy}
        aria-label={(recipe.imageId ? 'Change photo for ' : 'Add photo to ') + recipe.name}
        title="PNG, JPEG or WebP, up to 5 MB"
        onClick={() => input.current?.click()}
      >
        <Camera size={16} />
        {busy ? 'Saving photo…' : recipe.imageId ? 'Change photo' : 'Add photo'}
      </Button>
    </>
  );
}
export function RecipeEditor({ initial, onClose }: { initial?: Recipe; onClose: () => void }) {
  const food = useFood();
  const { run } = useApp();
  const [value, set] = useFoodDraft('recipe', initial ?? newRecipe(), !!initial);
  const [addingIngredient, setAddingIngredient] = useState(false);
  const patch = (p: Partial<Recipe>) => set({ ...value, ...p });
  const linePatch = (index: number, p: Partial<RecipeLine>) =>
    patch({
      ingredients: value.ingredients.map((line, i) => (i === index ? { ...line, ...p } : line)),
    });
  const addLine = (ingredient?: Ingredient) => {
    const i = ingredient ?? food.ingredients.find((i) => !i.archived);
    patch({
      ingredients: [
        ...value.ingredients,
        {
          id: uid(),
          ingredientId: i?.id ?? '',
          quantity: 100,
          unit: i?.defaultUnit ?? 'g',
          state: i?.state ?? 'as sold',
          optional: false,
          notes: '',
        },
      ],
    });
  };
  const nutrition = recipeNutrition(food, value);
  return (
    <Modal title={initial ? 'Edit recipe' : 'Create recipe'} onClose={onClose} wide>
      <p className="small-text muted">
        Changes are saved as a local editor draft. Ingredient amounts below are for the whole
        recipe.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            async () => {
              await saveRecipe(value);
              onClose();
            },
            value.draft ? 'Recipe draft saved' : 'Recipe saved',
          );
        }}
      >
        <div className="form-grid">
          <Field label="Recipe name">
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
          <Field label="Recipe servings">
            <input
              type="number"
              min={0.01}
              step="any"
              required
              value={value.servings}
              onChange={(e) => patch({ servings: Number(e.target.value) })}
            />
          </Field>
          <Field label="Difficulty">
            <select
              value={value.difficulty}
              onChange={(e) => patch({ difficulty: e.target.value as Recipe['difficulty'] })}
            >
              {['Easy', 'Medium', 'Involved'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Preparation time (minutes)">
            <input
              type="number"
              min={0}
              value={value.prepMinutes}
              onChange={(e) => patch({ prepMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field label="Cooking time (minutes)">
            <input
              type="number"
              min={0}
              value={value.cookMinutes}
              onChange={(e) => patch({ cookMinutes: Number(e.target.value) })}
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            value={value.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </Field>
        <ImageInput label="Recipe photo" onChange={(imageId) => patch({ imageId })} />
        <FoodImage id={value.imageId} alt="Recipe preview" className="food-editor-image" />
        {value.imageId && (
          <Button type="button" variant="ghost" onClick={() => patch({ imageId: undefined })}>
            <Trash2 size={16} />
            Remove photo
          </Button>
        )}
        <SectionTitle
          title="Ingredients for the whole recipe"
          action={
            <Button type="button" variant="secondary" onClick={() => setAddingIngredient(true)}>
              New ingredient
            </Button>
          }
        />
        {value.ingredients.map((line, index) => (
          <fieldset className="food-editor-row" key={line.id}>
            <legend>Ingredient {index + 1}</legend>
            <div className="form-grid">
              <IngredientSelect
                food={food}
                value={line.ingredientId}
                onChange={(ingredientId) => {
                  const ingredient = food.ingredients.find((i) => i.id === ingredientId);
                  linePatch(index, {
                    ingredientId,
                    state: ingredient?.state ?? 'as sold',
                    unit: ingredient?.defaultUnit ?? 'g',
                  });
                }}
              />
              <Field label={'Quantity ' + (index + 1)}>
                <input
                  type="number"
                  min={0}
                  step="any"
                  required
                  value={line.quantity}
                  onChange={(e) => linePatch(index, { quantity: Number(e.target.value) })}
                />
              </Field>
              <UnitSelect value={line.unit} onChange={(unit) => linePatch(index, { unit })} />
              <Field label="Quantity food state">
                <select
                  value={line.state}
                  onChange={(e) =>
                    linePatch(index, { state: e.target.value as RecipeLine['state'] })
                  }
                >
                  {['as sold', 'raw', 'cooked'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={'Ingredient note ' + (index + 1)}>
              <input
                value={line.notes}
                onChange={(e) => linePatch(index, { notes: e.target.value })}
              />
            </Field>
            <label className="check-label">
              <input
                type="checkbox"
                checked={line.optional}
                onChange={(e) => linePatch(index, { optional: e.target.checked })}
              />
              Optional (use quantity 0 to omit)
            </label>
            <div className="food-actions">
              <Button
                type="button"
                variant="ghost"
                aria-label={'Move ingredient ' + (index + 1) + ' up'}
                disabled={index === 0}
                onClick={() => patch({ ingredients: move(value.ingredients, index, -1) })}
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-label={'Move ingredient ' + (index + 1) + ' down'}
                disabled={index === value.ingredients.length - 1}
                onClick={() => patch({ ingredients: move(value.ingredients, index, 1) })}
              >
                <ArrowDown size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-label={'Remove ingredient ' + (index + 1)}
                onClick={() =>
                  patch({ ingredients: value.ingredients.filter((_, i) => i !== index) })
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </fieldset>
        ))}
        <Button type="button" variant="secondary" onClick={() => addLine()}>
          <Plus size={16} />
          Add recipe ingredient
        </Button>
        <div className="food-live-summary">
          <strong>Whole recipe macros</strong>
          <MacroSummary macros={nutrition.macros} />
          <NutritionNote {...nutrition} />
        </div>
        <SectionTitle title="Cooking steps" />
        {value.steps.map((step, index) => (
          <fieldset className="food-editor-row" key={step.id}>
            <legend>Step {index + 1}</legend>
            <Field label={'Instruction ' + (index + 1)}>
              <textarea
                value={step.text}
                onChange={(e) =>
                  patch({
                    steps: value.steps.map((s, i) =>
                      i === index ? { ...s, text: e.target.value } : s,
                    ),
                  })
                }
              />
            </Field>
            <ImageInput
              label={'Step ' + (index + 1) + ' image'}
              onChange={(imageId) =>
                patch({ steps: value.steps.map((s, i) => (i === index ? { ...s, imageId } : s)) })
              }
            />
            <div className="food-actions">
              <Button
                type="button"
                variant="ghost"
                aria-label={'Move step ' + (index + 1) + ' up'}
                disabled={index === 0}
                onClick={() => patch({ steps: move(value.steps, index, -1) })}
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-label={'Move step ' + (index + 1) + ' down'}
                disabled={index === value.steps.length - 1}
                onClick={() => patch({ steps: move(value.steps, index, 1) })}
              >
                <ArrowDown size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-label={'Remove step ' + (index + 1)}
                onClick={() => patch({ steps: value.steps.filter((_, i) => i !== index) })}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => patch({ steps: [...value.steps, { id: uid(), text: '' }] })}
        >
          Add cooking step
        </Button>
        <div className="form-grid">
          <Field label="Equipment (comma separated)">
            <input
              value={value.equipment.join(', ')}
              onChange={(e) => patch({ equipment: e.target.value.split(',').map((s) => s.trim()) })}
            />
          </Field>
          <Field label="Dietary tags (comma separated)">
            <input
              value={value.dietary.join(', ')}
              onChange={(e) => patch({ dietary: e.target.value.split(',').map((s) => s.trim()) })}
            />
          </Field>
          <Field label="Storage instructions">
            <textarea value={value.storage} onChange={(e) => patch({ storage: e.target.value })} />
          </Field>
          <Field label="Reheating instructions">
            <textarea
              value={value.reheating}
              onChange={(e) => patch({ reheating: e.target.value })}
            />
          </Field>
          <Field label="Batch cooking guidance">
            <textarea
              value={value.batchNotes}
              onChange={(e) => patch({ batchNotes: e.target.value })}
            />
          </Field>
          <Field label="Personal notes">
            <textarea value={value.notes} onChange={(e) => patch({ notes: e.target.value })} />
          </Field>
          <Field label="Rating (0–5)">
            <input
              type="number"
              min={0}
              max={5}
              step={1}
              value={value.rating}
              onChange={(e) => patch({ rating: Number(e.target.value) })}
            />
          </Field>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={value.draft}
            onChange={(e) => patch({ draft: e.target.checked })}
          />
          Save as recipe draft
        </label>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close editor
          </Button>
          <Button type="submit">Save recipe</Button>
        </div>
      </form>
      {addingIngredient && (
        <IngredientEditor onClose={() => setAddingIngredient(false)} onSaved={(i) => addLine(i)} />
      )}
    </Modal>
  );
}
function RecipeDetails({
  recipe,
  onClose,
  onEdit,
}: {
  recipe: Recipe;
  onClose: () => void;
  onEdit: () => void;
}) {
  const food = useFood();
  const { run } = useApp();
  const [servings, setServings] = useState(recipe.servings);
  const [preview, setPreview] = useState(recipe);
  const [cooking, setCooking] = useState(false);
  const total = recipeNutrition(food, preview, servings),
    per = recipeNutrition(food, preview, 1);
  const missing = recipeAvailability(
    { ...food, recipes: food.recipes.map((r) => (r.id === preview.id ? preview : r)) },
    preview,
    servings,
  );
  const substituted = JSON.stringify(preview.ingredients) !== JSON.stringify(recipe.ingredients);
  return (
    <Modal title={recipe.name} onClose={onClose} wide>
      <FoodImage id={recipe.imageId} alt={recipe.name} className="food-detail-image" />
      <p>{recipe.description}</p>
      <div className="food-detail-meta">
        <Badge>{recipe.category}</Badge>
        <span>
          <Clock3 size={15} />
          {recipe.prepMinutes + recipe.cookMinutes} min
        </span>
        <span>{recipe.difficulty}</span>
        <span>{recipe.rating ? `${recipe.rating}/5` : 'Not rated'}</span>
      </div>
      <Field label="Scale to servings">
        <input
          type="number"
          min={0.01}
          step="any"
          value={servings}
          onChange={(e) => setServings(Number(e.target.value))}
        />
      </Field>
      <div className="two-col">
        <div>
          <h3>Whole scaled recipe · {foodNumber(servings)} servings</h3>
          <MacroSummary macros={total.macros} />
          <p>Estimated ingredient cost: {money(total.cost, food.foodSettings.currency)}</p>
        </div>
        <div>
          <h3>One serving</h3>
          <MacroSummary macros={per.macros} />
          <p>Estimated cost per serving: {money(per.cost, food.foodSettings.currency)}</p>
        </div>
      </div>
      <NutritionNote {...total} />
      <SectionTitle title="Ingredients for the scaled recipe" />
      <p className="small-text muted">
        Substitutions below recalculate amounts, macros and costs using the selected ingredient.
        Taste and cooking behaviour may change; check suitability yourself.
      </p>
      {preview.ingredients.map((line, index) => {
        const i = food.ingredients.find((i) => i.id === line.ingredientId);
        const scaled = { ...line, quantity: (line.quantity * servings) / preview.servings };
        const alternatives = food.ingredients
          .filter(
            (a) =>
              a.id !== i?.id &&
              !a.archived &&
              a.category === i?.category &&
              food.stock.some((s) => s.ingredientId === a.id && usableStock(s)),
          )
          .slice(0, 4);
        return (
          <div className="food-ingredient-detail" key={line.id}>
            <strong>
              {foodNumber(scaled.quantity)} {line.unit} · {i?.name ?? 'Missing ingredient'} (
              {line.state})
            </strong>
            <p>{line.notes}</p>
            <MacroSummary macros={lineNutrition(scaled, i).macros} compact />
            {alternatives.length > 0 && (
              <p className="small-text muted">
                Other ingredients in this category with usable stock:{' '}
                {alternatives.map((a) => a.name).join(', ')}. These are ideas, not equivalent
                ingredients; choose one below and check its quantity and cooking method.
              </p>
            )}
            <div className="form-grid">
              <IngredientSelect
                food={food}
                label={'Substitute ingredient ' + (index + 1)}
                value={line.ingredientId}
                onChange={(ingredientId) => {
                  const next = food.ingredients.find((i) => i.id === ingredientId);
                  setPreview({
                    ...preview,
                    ingredients: preview.ingredients.map((l, j) =>
                      j === index ? { ...l, ingredientId, state: next?.state ?? l.state } : l,
                    ),
                  });
                }}
              />
              <Field label={'Substitution quantity ' + (index + 1) + ' (whole original recipe)'}>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={line.quantity}
                  onChange={(e) =>
                    setPreview({
                      ...preview,
                      ingredients: preview.ingredients.map((l, j) =>
                        j === index ? { ...l, quantity: Number(e.target.value) } : l,
                      ),
                    })
                  }
                />
              </Field>
            </div>
          </div>
        );
      })}
      {substituted && (
        <p className="callout">
          Recipe changed. Save this variation before logging, planning or cooking it. Check
          quantities, units and the method for your replacement ingredients.
        </p>
      )}
      {substituted && (
        <AsyncButton
          variant="secondary"
          onAction={() =>
            run(async () => {
              await saveRecipe({
                ...preview,
                id: uid(),
                name: recipe.name + ' · variation',
                createdAt: now(),
                updatedAt: now(),
              });
              onClose();
            }, 'Variation saved as a separate recipe')
          }
        >
          Save variation as a new recipe
        </AsyncButton>
      )}
      <p className="callout">
        {missing.length
          ? `${missing.length} ingredient shortages for ${foodNumber(servings)} servings: ${missing.map((m) => `${m.name} (${foodNumber(m.shortage)} ${m.unit})`).join(', ')}`
          : 'Ingredients available in usable stock for this quantity.'}
      </p>
      <SectionTitle title="Method" />
      {recipe.steps.length ? (
        <ol className="food-method">
          {recipe.steps.map((s) => (
            <li key={s.id}>
              <p>{s.text}</p>
              <FoodImage id={s.imageId} alt="Cooking step" className="food-step-image" />
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No cooking steps recorded yet.</p>
      )}
      <p>
        <strong>Equipment:</strong> {recipe.equipment.filter(Boolean).join(', ') || 'Not recorded'}
      </p>
      {[
        ['Storage', recipe.storage],
        ['Reheating', recipe.reheating],
        ['Batch cooking', recipe.batchNotes],
        ['Notes', recipe.notes],
      ]
        .filter(([, v]) => v)
        .map(([label, value]) => (
          <p key={label}>
            <strong>{label}:</strong> {value}
          </p>
        ))}
      <div className="food-actions">
        <Button variant="secondary" onClick={onEdit}>
          <Pencil size={15} />
          Edit recipe
        </Button>
        <Button disabled={substituted} onClick={() => setCooking(true)}>
          I cooked this
        </Button>
        <Button
          variant="secondary"
          disabled={substituted}
          onClick={() => go('food-diary?recipe=' + encodeURIComponent(recipe.id))}
        >
          Log a serving
        </Button>
        <Button
          variant="secondary"
          disabled={substituted}
          onClick={() => go('food-planner?recipe=' + encodeURIComponent(recipe.id))}
        >
          Plan this meal
        </Button>
        <AsyncButton
          variant="secondary"
          disabled={substituted}
          onAction={() =>
            run(async () => {
              const id = uid();
              await saveShoppingList({
                id,
                name: recipe.name + ' shopping',
                recipeId: recipe.id,
                servings,
                items: [],
                createdAt: now(),
                updatedAt: now(),
              });
              await regenerateShopping(id);
              go('food-shopping');
            })
          }
        >
          Generate shopping list
        </AsyncButton>
      </div>
      {cooking && (
        <CookModal recipe={recipe} initialServings={servings} onClose={() => setCooking(false)} />
      )}
    </Modal>
  );
}
export function FoodMenu() {
  const food = useFood();
  const { run } = useApp();
  const [edit, setEdit] = useState<Recipe | null | undefined>();
  const [detail, setDetail] = useState<string>();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [favourites, setFavourites] = useState(false);
  const [available, setAvailable] = useState(false);
  const [useSoon, setUseSoon] = useState(false);
  const soonIds = new Set(
    food.stock
      .filter((s) => usableStock(s) && s.expires && s.expires <= shiftDay(foodDay(), 3))
      .map((s) => s.ingredientId),
  );
  const [includeArchived, setIncludeArchived] = useState(false);
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [time, setTime] = useState('');
  const [cost, setCost] = useState('');
  const [equipment, setEquipment] = useState('');
  const [dietary, setDietary] = useState('');
  const [sort, setSort] = useState('name');
  const rows = food.recipes
    .filter((r) => includeArchived || !r.archived)
    .map((recipe) => ({
      recipe,
      nutrition: recipeNutrition(food, recipe, 1),
      missing: recipeAvailability(food, recipe, 1),
    }))
    .filter(
      ({ recipe: r, nutrition: n, missing }) =>
        (!category || r.category === category) &&
        (!favourites || r.favourite) &&
        (!available || (!missing.length && r.ingredients.some((i) => i.quantity > 0))) &&
        (!useSoon || r.ingredients.some((i) => soonIds.has(i.ingredientId))) &&
        (!time || r.prepMinutes + r.cookMinutes <= Number(time)) &&
        (!protein || (n.macros.protein !== undefined && n.macros.protein >= Number(protein))) &&
        (!carbs || (n.macros.carbs !== undefined && n.macros.carbs <= Number(carbs))) &&
        (!fat || (n.macros.fat !== undefined && n.macros.fat <= Number(fat))) &&
        (!cost || (n.cost !== undefined && n.cost <= Number(cost))) &&
        (!equipment ||
          r.equipment.some((s) => s.toLowerCase().includes(equipment.toLowerCase()))) &&
        (!dietary || r.dietary.some((s) => s.toLowerCase().includes(dietary.toLowerCase()))) &&
        [
          r.name,
          ...r.ingredients.map(
            (l) => food.ingredients.find((i) => i.id === l.ingredientId)?.name ?? '',
          ),
        ].some((s) => s.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) =>
      sort === 'protein'
        ? (b.nutrition.macros.protein ?? -1) - (a.nutrition.macros.protein ?? -1)
        : sort === 'cost'
          ? (a.nutrition.cost ?? Infinity) - (b.nutrition.cost ?? Infinity)
          : sort === 'time'
            ? a.recipe.prepMinutes +
              a.recipe.cookMinutes -
              (b.recipe.prepMinutes + b.recipe.cookMinutes)
            : sort === 'rating'
              ? b.recipe.rating - a.recipe.rating
              : sort === 'stock'
                ? a.missing.length - b.missing.length
                : a.recipe.name.localeCompare(b.recipe.name),
    );
  const selected = food.recipes.find((r) => r.id === detail);
  return (
    <>
      <FoodNav />
      <PageTitle
        eyebrow="YOUR PERSONAL MENU"
        title="Good food, on your terms."
        description="Your recipes, their macros and what’s already in the kitchen."
        action={
          <Button onClick={() => setEdit(null)}>
            <Plus size={16} />
            Create recipe
          </Button>
        }
      />
      <div className="food-menu-intro">
        <Utensils size={30} />
        <div>
          <h2>Something worth cooking.</h2>
          <p>
            Build a menu from meals you enjoy. Browse by your ingredients, available time or
            recorded macros.
          </p>
        </div>
        <a href="#/food-ingredients" className="text-link">
          Manage ingredients →
        </a>
      </div>
      <div className="food-filters">
        <Field label="Search meals or ingredients">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Field label="Menu category">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Every meal</option>
            {mealSlots.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Sort menu">
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Name</option>
            <option value="protein">Most protein</option>
            <option value="cost">Lowest estimated cost</option>
            <option value="time">Quickest</option>
            <option value="rating">Highest rating</option>
            <option value="stock">Fewest missing ingredients</option>
          </select>
        </Field>
      </div>
      <details className="food-filter-details">
        <summary>Macro, time, cost & kitchen filters</summary>
        <div className="form-grid">
          {[
            ['Minimum protein per serving (g)', protein, setProtein],
            ['Maximum carbohydrates per serving (g)', carbs, setCarbs],
            ['Maximum fat per serving (g)', fat, setFat],
            ['Maximum time (minutes)', time, setTime],
            ['Maximum cost per serving', cost, setCost],
          ].map(([label, value, setter]) => (
            <Field key={String(label)} label={String(label)}>
              <input
                type="number"
                min={0}
                step="any"
                value={value as string}
                onChange={(e) => (setter as (s: string) => void)(e.target.value)}
              />
            </Field>
          ))}
          <Field label="Required equipment">
            <input value={equipment} onChange={(e) => setEquipment(e.target.value)} />
          </Field>
          <Field label="Dietary preference tag">
            <input value={dietary} onChange={(e) => setDietary(e.target.value)} />
          </Field>
        </div>
        <div className="food-actions">
          <label className="check-label">
            <input
              type="checkbox"
              checked={favourites}
              onChange={(e) => setFavourites(e.target.checked)}
            />
            Favourites
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />
            Can make one serving from stock
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Include archived
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={useSoon}
              onChange={(e) => setUseSoon(e.target.checked)}
            />
            Use ingredients expiring within 3 days
          </label>
        </div>
      </details>
      <div className="food-grid">
        {rows.map(({ recipe: r, nutrition: n, missing }) => (
          <Card className="recipe-card" key={r.id}>
            <button
              className="recipe-cover"
              aria-label={'View recipe ' + r.name}
              onClick={() => setDetail(r.id)}
            >
              {r.imageId ? (
                <FoodImage id={r.imageId} alt={r.name} />
              ) : (
                <span className="recipe-plate">
                  <Utensils size={34} />
                </span>
              )}
              <span className="recipe-cover-tag">
                {r.category}
                {r.draft ? ' · Draft' : ''}
                {r.archived ? ' · Archived' : ''}
              </span>
            </button>
            <div className="recipe-card-content">
              <div className="food-card-heading">
                <h2>
                  <button className="food-title-button" onClick={() => setDetail(r.id)}>
                    {r.name}
                  </button>
                </h2>
                <AsyncButton
                  variant="ghost"
                  aria-label={(r.favourite ? 'Unfavourite ' : 'Favourite ') + r.name}
                  onAction={() => run(() => saveRecipe({ ...r, favourite: !r.favourite }))}
                >
                  <Star size={18} fill={r.favourite ? 'currentColor' : 'none'} />
                </AsyncButton>
              </div>
              <p>{r.description || 'Your own recipe, ready to make your own.'}</p>
              <p className="small-text muted">
                {r.prepMinutes + r.cookMinutes} min · {r.difficulty} ·{' '}
                {money(n.cost, food.foodSettings.currency)} / serving
              </p>
              <MacroSummary macros={n.macros} compact />
              <p className="recipe-stock">
                {!r.ingredients.some((i) => i.quantity > 0)
                  ? 'No ingredient quantities recorded'
                  : missing.length
                    ? `${missing.length} ingredient shortages for one serving`
                    : 'One serving available from stock'}
                {r.ingredients.some((i) => soonIds.has(i.ingredientId))
                  ? ' · Uses ingredients approaching expiry'
                  : ''}
              </p>
              <div className="food-actions">
                <Button variant="secondary" onClick={() => setDetail(r.id)}>
                  View recipe
                </Button>
                <RecipePhotoUpload recipe={r} />
                <Button variant="ghost" aria-label={'Edit ' + r.name} onClick={() => setEdit(r)}>
                  <Pencil size={16} />
                </Button>
                <Button
                  variant="ghost"
                  aria-label={'Duplicate ' + r.name}
                  onClick={() =>
                    setEdit({
                      ...structuredClone(r),
                      id: uid(),
                      name: r.name + ' (copy)',
                      createdAt: now(),
                    })
                  }
                >
                  <Copy size={16} />
                </Button>
                <AsyncButton
                  variant="ghost"
                  aria-label={(r.archived ? 'Restore ' : 'Archive ') + r.name}
                  onAction={() => run(() => saveRecipe({ ...r, archived: !r.archived }))}
                >
                  <Archive size={16} />
                </AsyncButton>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {!rows.length && (
        <FoodEmpty>
          {food.recipes.length
            ? 'No recipes match these filters.'
            : 'Your menu starts here. Add ingredients from your labels, then create your first recipe.'}
        </FoodEmpty>
      )}
      {edit !== undefined && (
        <RecipeEditor initial={edit ?? undefined} onClose={() => setEdit(undefined)} />
      )}{' '}
      {selected && (
        <RecipeDetails
          key={selected.id}
          recipe={selected}
          onClose={() => setDetail(undefined)}
          onEdit={() => {
            setDetail(undefined);
            setEdit(selected);
          }}
        />
      )}
    </>
  );
}
